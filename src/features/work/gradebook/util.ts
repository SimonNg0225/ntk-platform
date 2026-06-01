import { createCollection, type Entity } from '../../../lib/store'
import type { Assessment, Score, Student } from '../../../data/types'

// ============================================================
//  Gradebook 核心：加權計分、等級制、統計（純函式，零副作用）
//  參考真實教師 gradebook（PowerSchool / Jupiter / Google Classroom）：
//  - 類別加權（測驗 40% + 考試 40% + 功課 20% …）
//  - 香港中學常見等級制 + GPA
//  - 分數分佈、及格率、標準差、趨勢
// ============================================================

// ───────── 自訂持久化資料：每班一個評分方案 ─────────
// 「類別 → 權重(%)」+ 等級分界。存 localStorage，唔掂 data/collections。
export type GradeScaleKey = 'hkdse' | 'percent' | 'simple'

export interface GradingScheme extends Entity {
  classId: string
  /** 類別權重；key = assessment.type（測驗/考試/功課/專題…），value = 百分比 */
  weights: Record<string, number>
  /** 是否啟用加權（關閉 = 全部評估等權平均）*/
  weighted: boolean
  /** 等級制 */
  scale: GradeScaleKey
  /** 計平均時剔除每類最低分一次（drop lowest）*/
  dropLowest: boolean
  /**
   * 自訂等級分界（選填，向後相容）：每種等級制 → { 等級 label → 百分比下限 }。
   * 只覆蓋有提供嘅 label 嘅 min；其餘沿用內建。空 / 缺值 → 全用內建。
   * 例：{ hkdse: { '5**': 90, '3': 45 } } 把 5** 收緊到 90、合格線降到 45。
   */
  bandCuts?: Partial<Record<GradeScaleKey, Record<string, number>>>
  updatedAt: string
}

export const gradingSchemesCol = createCollection<GradingScheme>(
  'gradebook_schemes',
  [],
)

export const DEFAULT_WEIGHTS: Record<string, number> = {
  測驗: 30,
  考試: 50,
  功課: 10,
  專題: 10,
}

export function ensureScheme(
  classId: string,
  schemes: GradingScheme[],
): GradingScheme {
  return (
    schemes.find((s) => s.classId === classId) ?? {
      id: '',
      classId,
      weights: { ...DEFAULT_WEIGHTS },
      weighted: true,
      scale: 'hkdse',
      dropLowest: false,
      updatedAt: '',
    }
  )
}

// ───────── 等級制 ─────────
export type GradeTone = 'green' | 'accent' | 'blue' | 'amber' | 'rose' | 'slate'

export interface GradeBand {
  min: number // 百分比下限（含）
  label: string
  tone: GradeTone
  gpa: number // 績點（用於 GPA 計算）
}

// HKDSE 風格（5** / 5* / 5 / 4 / 3 / 2 / 1）按百分比近似映射
const HKDSE_BANDS: GradeBand[] = [
  { min: 88, label: '5**', tone: 'green', gpa: 7 },
  { min: 80, label: '5*', tone: 'green', gpa: 6.5 },
  { min: 72, label: '5', tone: 'accent', gpa: 6 },
  { min: 62, label: '4', tone: 'accent', gpa: 5 },
  { min: 50, label: '3', tone: 'blue', gpa: 4 },
  { min: 40, label: '2', tone: 'amber', gpa: 3 },
  { min: 30, label: '1', tone: 'amber', gpa: 2 },
  { min: 0, label: 'U', tone: 'rose', gpa: 0 },
]

// 等第制（優 / 良 / 及格 / 待改進）
const PERCENT_BANDS: GradeBand[] = [
  { min: 75, label: '優', tone: 'green', gpa: 4 },
  { min: 60, label: '良', tone: 'accent', gpa: 3 },
  { min: 50, label: '及格', tone: 'amber', gpa: 2 },
  { min: 0, label: '待改進', tone: 'rose', gpa: 0 },
]

// 簡單 A–F
const SIMPLE_BANDS: GradeBand[] = [
  { min: 80, label: 'A', tone: 'green', gpa: 4 },
  { min: 70, label: 'B', tone: 'accent', gpa: 3 },
  { min: 60, label: 'C', tone: 'blue', gpa: 2 },
  { min: 50, label: 'D', tone: 'amber', gpa: 1 },
  { min: 0, label: 'F', tone: 'rose', gpa: 0 },
]

export const SCALE_LABEL: Record<GradeScaleKey, string> = {
  hkdse: 'DSE 等級（5**–U）',
  percent: '等第（優／良／及格）',
  simple: '字母（A–F）',
}

export function bandsOf(scale: GradeScaleKey): GradeBand[] {
  return scale === 'hkdse'
    ? HKDSE_BANDS
    : scale === 'simple'
      ? SIMPLE_BANDS
      : PERCENT_BANDS
}

/**
 * 把內建等級制套用「自訂分界」(label → 百分比下限) 後回傳。
 * 規則（守邊界 / 缺值 / 亂序）：
 *  - 只覆蓋有 finite 數值嘅 label 嘅 min，clamp 落 0–100；其餘沿用內建。
 *  - 最底一級（內建 min=0）強制保持 0，確保任何分數都有對應等級（唔會漏底）。
 *  - 覆蓋後按 min 由高到低重新排序，令 gradeOf 嘅「由高揾第一個 >=」邏輯仍正確，
 *    即使老師亂咁填（例如把 5* 設得高過 5**）。
 * cuts 為 undefined / 空物件 → 直接回內建（zero-cost、向後相容）。
 */
export function resolveBands(
  scale: GradeScaleKey,
  cuts?: Record<string, number>,
): GradeBand[] {
  const base = bandsOf(scale)
  if (!cuts || Object.keys(cuts).length === 0) return base
  const next = base.map((b) => {
    // 最底一級永遠由 0 起，唔接受覆蓋（避免分數跌穿所有 band）
    if (b.min === 0) return b
    const raw = cuts[b.label]
    if (raw == null || !Number.isFinite(raw)) return b
    const min = Math.max(0, Math.min(100, raw))
    return min === b.min ? b : { ...b, min }
  })
  // 亂序保護：由高到低排（同分時保持原本相對次序 = 穩定排序）
  return [...next].sort((a, b) => b.min - a.min)
}

/** 等級制每級嘅內建下限（畀 UI 顯示「預設」對照用）*/
export function defaultBandCuts(scale: GradeScaleKey): Record<string, number> {
  const out: Record<string, number> = {}
  for (const b of bandsOf(scale)) out[b.label] = b.min
  return out
}

export function gradeOf(
  pct: number,
  scale: GradeScaleKey,
  bands?: GradeBand[],
): GradeBand {
  const list = bands ?? bandsOf(scale)
  return list.find((b) => pct >= b.min) ?? list[list.length - 1]
}

// 通用「分數高低」色調（用於進度條/儲存格底色，與等級制無關）
export function pctTone(pct: number): GradeTone {
  if (pct >= 75) return 'green'
  if (pct >= 60) return 'accent'
  if (pct >= 50) return 'amber'
  return 'rose'
}

export const TONE_FILL: Record<GradeTone, string> = {
  green: 'bg-emerald-500',
  accent: 'bg-accent',
  blue: 'bg-blue-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
  slate: 'bg-slate-400',
}

export const TONE_TEXT: Record<GradeTone, string> = {
  green: 'text-emerald-600 dark:text-emerald-400',
  accent: 'text-accent',
  blue: 'text-blue-600 dark:text-blue-400',
  amber: 'text-amber-600 dark:text-amber-400',
  rose: 'text-rose-600 dark:text-rose-400',
  slate: 'text-slate-500 dark:text-slate-400',
}

export const TONE_STROKE: Record<GradeTone, string> = {
  green: 'stroke-emerald-500',
  accent: 'stroke-accent',
  blue: 'stroke-blue-500',
  amber: 'stroke-amber-500',
  rose: 'stroke-rose-500',
  slate: 'stroke-slate-400',
}

// ───────── 統計小工具 ─────────
export function mean(xs: number[]): number | null {
  if (!xs.length) return null
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

export function median(xs: number[]): number | null {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

export function stdev(xs: number[]): number | null {
  const m = mean(xs)
  if (m == null || xs.length < 2) return null
  const v = xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length
  return Math.sqrt(v)
}

/** 四分位（用於箱形圖）。回傳 [min, q1, median, q3, max] */
export function quartiles(
  xs: number[],
): [number, number, number, number, number] | null {
  if (xs.length < 1) return null
  const s = [...xs].sort((a, b) => a - b)
  const q = (p: number) => {
    const pos = (s.length - 1) * p
    const lo = Math.floor(pos)
    const hi = Math.ceil(pos)
    if (lo === hi) return s[lo]
    return s[lo] + (s[hi] - s[lo]) * (pos - lo)
  }
  return [s[0], q(0.25), q(0.5), q(0.75), s[s.length - 1]]
}

export function round1(x: number): number {
  return Math.round(x * 10) / 10
}

// ───────── 加權計分核心 ─────────
export interface StudentResult {
  student: Student
  /** 加權後總平均（百分比）；null = 完全無分 */
  weighted: number | null
  /** 簡單平均（每評估等權）*/
  simple: number | null
  /** 已交 / 應交 */
  submitted: number
  expected: number
  /** 逐評估百分比（無分 = null）*/
  perAssessment: Record<string, number | null>
}

/** 取某學生喺某評估嘅百分比（0–100） */
export function pctFor(
  scores: Score[],
  assessmentId: string,
  studentId: string,
  max: number,
): number | null {
  if (max <= 0) return null
  const rec = scores.find(
    (x) => x.assessmentId === assessmentId && x.studentId === studentId,
  )
  if (!rec || rec.score == null) return null
  return (rec.score / max) * 100
}

/**
 * 計算全班每個學生嘅加權成績。
 * 加權邏輯：先把每個評估歸入其 type 類別，計該類別平均（可剔最低），
 * 再按 scheme.weights 對「有資料嘅類別」重新正規化權重做加權總和。
 */
export function computeResults(
  students: Student[],
  assessments: Assessment[],
  scores: Score[],
  scheme: GradingScheme,
): StudentResult[] {
  return students.map((stu) => {
    const perAssessment: Record<string, number | null> = {}
    let submitted = 0
    for (const a of assessments) {
      const p = pctFor(scores, a.id, stu.id, a.maxScore)
      perAssessment[a.id] = p
      if (p != null) submitted += 1
    }

    // 簡單平均
    const allPts = assessments
      .map((a) => perAssessment[a.id])
      .filter((x): x is number => x != null)
    const simple = mean(allPts)

    // 加權平均：按類別
    const byCat = new Map<string, number[]>()
    for (const a of assessments) {
      const p = perAssessment[a.id]
      if (p == null) continue
      const arr = byCat.get(a.type) ?? []
      arr.push(p)
      byCat.set(a.type, arr)
    }

    let weighted: number | null = simple
    if (scheme.weighted && byCat.size > 0) {
      let totalW = 0
      let acc = 0
      for (const [cat, ptsRaw] of byCat.entries()) {
        let pts = ptsRaw
        if (scheme.dropLowest && pts.length > 1) {
          const min = Math.min(...pts)
          const idx = pts.indexOf(min)
          pts = pts.filter((_, i) => i !== idx)
        }
        const catAvg = mean(pts)
        if (catAvg == null) continue
        const w = scheme.weights[cat] ?? 0
        if (w <= 0) continue
        acc += catAvg * w
        totalW += w
      }
      weighted = totalW > 0 ? acc / totalW : simple
    }

    return {
      student: stu,
      weighted: weighted == null ? null : round1(weighted),
      simple: simple == null ? null : round1(simple),
      submitted,
      expected: assessments.length,
      perAssessment,
    }
  })
}

// ───────── 班內百分位（percentile rank）─────────
/**
 * 把一個數值轉成喺整個分佈入面嘅百分位（0–100）。
 * 用「低於 + 一半相等」嘅標準定義（midrank），對打和友善、唔會偏高/偏低：
 *   pr = (低於 value 嘅個數 + 0.5 × 等於 value 嘅個數) / 總數 × 100
 * 好處：
 *  - 最高分唔會永遠 100、最低分唔會永遠 0（同分學生攤分位置，公平）。
 *  - 全部同分 → 大家都 50（中間）。
 * 規則：
 *  - all 為空 → null（無從比較）。
 *  - value 唔喺 all 入面都照計（當作「插入」嘅相對位置），方便傳入已知總分。
 *  - 結果 clamp 落 0–100 並四捨五入到整數（百分位慣常用整數顯示）。
 */
export function percentileOf(value: number, all: number[]): number | null {
  if (!all.length) return null
  let below = 0
  let equal = 0
  for (const x of all) {
    if (x < value) below += 1
    else if (x === value) equal += 1
  }
  const pr = ((below + 0.5 * equal) / all.length) * 100
  return Math.round(Math.max(0, Math.min(100, pr)))
}

// ───────── 評估趨勢（most-improved / declining）─────────
/**
 * 用最小二乘法計一條學生「逐評估 %」嘅簡單線性趨勢斜率（每個評估嘅升幅，單位：百分點/評估）。
 * x = 已交評估嘅次序（0,1,2…，只計有分嘅，跳過未交），y = 該評估百分比。
 * 回傳：
 *  - 正數 = 一路上升、負數 = 一路下跌、0 = 平。
 *  - 少於 2 個有效分數 → null（無從定走勢）。
 *  - 全部同分 → 0（無升跌）。
 * 注意：orderedIds 決定時間次序（呼叫方應先按 assessmentSortKey 排好）。
 */
export function assessmentTrendSlope(
  perAssessment: Record<string, number | null>,
  orderedIds: string[],
): number | null {
  const ys: number[] = []
  for (const id of orderedIds) {
    const p = perAssessment[id]
    if (p != null) ys.push(p)
  }
  const n = ys.length
  if (n < 2) return null
  // x = 0..n-1；用閉式解（centered）避免大數相消。
  const xMean = (n - 1) / 2
  const yMean = ys.reduce((a, b) => a + b, 0) / n
  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) {
    const dx = i - xMean
    num += dx * (ys[i] - yMean)
    den += dx * dx
  }
  if (den === 0) return 0
  return num / den
}

export interface ImprovementEntry {
  student: Student
  /** 線性趨勢斜率（百分點/評估），null = 有效分數不足 */
  slope: number | null
  /** 用於計斜率嘅有效評估數 */
  points: number
}

/**
 * 由 computeResults 嘅結果衍生「進步榜」：每位學生嘅趨勢斜率，由高到低排（最進步喺前）。
 * 只保留有得計斜率（≥2 個有效分數）嘅學生；同斜率時按學生姓名穩定排序。
 * UI 可直接喺頭/尾抽 most-improved / declining。
 */
export function rankByImprovement(
  results: StudentResult[],
  orderedIds: string[],
): ImprovementEntry[] {
  return results
    .map((r) => {
      let points = 0
      for (const id of orderedIds) if (r.perAssessment[id] != null) points += 1
      return {
        student: r.student,
        slope: assessmentTrendSlope(r.perAssessment, orderedIds),
        points,
      }
    })
    .filter((e): e is ImprovementEntry => e.slope != null)
    .sort(
      (a, b) =>
        (b.slope ?? 0) - (a.slope ?? 0) ||
        (a.student.studentNo ?? a.student.name).localeCompare(
          b.student.studentNo ?? b.student.name,
          'zh-Hant',
        ),
    )
}

// ───────── 分數分佈直方圖（10 個 bin）─────────
export interface HistBin {
  from: number
  to: number
  count: number
  label: string
}

export function histogram(values: number[]): HistBin[] {
  const bins: HistBin[] = Array.from({ length: 10 }, (_, i) => ({
    from: i * 10,
    to: i * 10 + 10,
    count: 0,
    label: `${i * 10}–${i * 10 + 10}`,
  }))
  for (const v of values) {
    let idx = Math.floor(v / 10)
    if (idx > 9) idx = 9
    if (idx < 0) idx = 0
    bins[idx].count += 1
  }
  return bins
}

// ───────── 日期標籤（評估趨勢用）─────────
export function shortDate(iso?: string): string {
  if (!iso) return ''
  // 純日期字串（YYYY-MM-DD）會被 new Date() 當成 UTC 午夜解析，
  // 喺 UTC 以西時區會 off-by-one（例如 2026-01-15 變 1/14）。
  // 故此偵測純日期就用本地時區砌 Date，確保顯示嘅係本地日期。
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (dateOnly) {
    const y = Number(dateOnly[1])
    const mo = Number(dateOnly[2])
    const day = Number(dateOnly[3])
    const d = new Date(y, mo - 1, day)
    // 確認無滾溢（如 2026-13-40 會被 Date 默默進位），否則當無效日期
    if (
      d.getFullYear() !== y ||
      d.getMonth() !== mo - 1 ||
      d.getDate() !== day
    ) {
      return ''
    }
    return `${mo}/${day}`
  }
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getMonth() + 1}/${d.getDate()}`
}

/** 評估排序：有 date 先按 date，否則按 createdAt */
export function assessmentSortKey(a: Assessment): string {
  return a.date ?? a.createdAt ?? ''
}

// ───────── CSV 工具（共用層，見 ../shared/csv）─────────
export { csvEscape, downloadCsv } from '../shared/csv'
