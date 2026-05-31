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

export function gradeOf(pct: number, scale: GradeScaleKey): GradeBand {
  const bands = bandsOf(scale)
  return bands.find((b) => pct >= b.min) ?? bands[bands.length - 1]
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
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getMonth() + 1}/${d.getDate()}`
}

/** 評估排序：有 date 先按 date，否則按 createdAt */
export function assessmentSortKey(a: Assessment): string {
  return a.date ?? a.createdAt ?? ''
}

// ───────── CSV 工具 ─────────
export function csvEscape(v: string | number): string {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map(csvEscape).join(',')).join('\r\n')
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
