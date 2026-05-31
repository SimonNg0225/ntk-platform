import type {
  Assessment,
  AttendanceRecord,
  Klass,
  Score,
  Student,
} from '../../../data/types'
import {
  type ClassMeta,
  type ClassTone,
  type Gender,
  type StudentMeta,
  type StudentStatus,
} from './types'

// ============================================================
//  班別管理 — 純函式工具（零副作用，方便測試 / 重用）
// ============================================================

// ───────── meta 取值（永遠回傳完整 default，避免到處 ?. ）─────────
export function metaFor(
  studentId: string,
  metas: StudentMeta[],
): StudentMeta {
  return (
    metas.find((m) => m.studentId === studentId) ?? {
      id: '',
      studentId,
      status: 'active' as StudentStatus,
      seat: -1,
      updatedAt: '',
    }
  )
}

export function classMetaFor(
  classId: string,
  metas: ClassMeta[],
): ClassMeta {
  return (
    metas.find((m) => m.classId === classId) ?? {
      id: '',
      classId,
      color: 'accent' as ClassTone,
      seatCols: 6,
      updatedAt: '',
    }
  )
}

// ───────── 名冊完整度（SIS data-quality 指標）─────────
export interface Completeness {
  total: number
  filled: number
  pct: number
  missing: { studentNo: number; gender: number; guardian: number }
}

export function completenessOf(
  students: Student[],
  metas: StudentMeta[],
): Completeness {
  let filled = 0
  const missing = { studentNo: 0, gender: 0, guardian: 0 }
  // 每位學生 3 個關鍵欄位：學號 / 性別 / 監護人電話
  for (const s of students) {
    const m = metaFor(s.id, metas)
    const hasNo = !!s.studentNo?.trim()
    const hasGender = !!m.gender
    const hasGuardian = !!m.guardianPhone?.trim()
    if (hasNo) filled++
    else missing.studentNo++
    if (hasGender) filled++
    else missing.gender++
    if (hasGuardian) filled++
    else missing.guardian++
  }
  const denom = students.length * 3
  return {
    total: students.length,
    filled,
    pct: denom ? Math.round((filled / denom) * 100) : 0,
    missing,
  }
}

// ───────── 人口統計聚合 ─────────
export interface Demographics {
  gender: Record<Gender, number>
  genderUnknown: number
  house: { name: string; count: number }[]
  status: Record<StudentStatus, number>
}

export function demographicsOf(
  students: Student[],
  metas: StudentMeta[],
): Demographics {
  const gender: Record<Gender, number> = { M: 0, F: 0, X: 0 }
  let genderUnknown = 0
  const status: Record<StudentStatus, number> = {
    active: 0,
    transferred: 0,
    withdrawn: 0,
  }
  const houseMap = new Map<string, number>()
  for (const s of students) {
    const m = metaFor(s.id, metas)
    if (m.gender) gender[m.gender]++
    else genderUnknown++
    status[m.status]++
    const h = m.house?.trim()
    if (h) houseMap.set(h, (houseMap.get(h) ?? 0) + 1)
  }
  const house = [...houseMap.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
  return { gender, genderUnknown, house, status }
}

// ───────── 學號排序（數字學號照數字排，否則照字串）─────────
export function studentSortKey(s: Student): [number, string] {
  const no = s.studentNo?.trim() ?? ''
  const num = Number(no)
  return [Number.isFinite(num) && no !== '' ? num : Number.MAX_SAFE_INTEGER, no || s.name]
}

export function sortStudents(students: Student[]): Student[] {
  return [...students].sort((a, b) => {
    const [an, as] = studentSortKey(a)
    const [bn, bs] = studentSortKey(b)
    if (an !== bn) return an - bn
    return as.localeCompare(bs, 'zh-HK')
  })
}

// ───────── 批量貼上解析（每行：學號 名 / 名）─────────
export interface ParsedRow {
  studentNo?: string
  name: string
}

/**
 * 解析多行貼上文字。支援分隔：tab / 逗號 / 多個空格。
 * 規則：若第一欄似學號（含數字且短），當學號，其餘做名；
 * 否則整行做名。空行略過。
 */
export function parseBulk(text: string): ParsedRow[] {
  const out: ParsedRow[] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    const parts = line.split(/\t|,|\s{2,}/).map((p) => p.trim()).filter(Boolean)
    if (parts.length >= 2 && looksLikeNo(parts[0])) {
      out.push({ studentNo: parts[0], name: parts.slice(1).join(' ') })
    } else if (parts.length >= 2 && looksLikeNo(parts[parts.length - 1])) {
      // 名喺前、學號喺後
      out.push({
        studentNo: parts[parts.length - 1],
        name: parts.slice(0, -1).join(' '),
      })
    } else {
      out.push({ name: parts.join(' ') })
    }
  }
  return out
}

function looksLikeNo(s: string): boolean {
  // 1–8 位、含至少一個數字、唔含中文
  return /^[A-Za-z0-9()/-]{1,8}$/.test(s) && /\d/.test(s)
}

// ───────── 座位表幾何 ─────────
/** 把學生排入座位網格；seat<0 嘅排去尾。回傳 rows × cols 嘅 (Student|null) */
export function buildSeatGrid(
  students: Student[],
  metas: StudentMeta[],
  cols: number,
): (Student | null)[][] {
  const C = Math.max(1, cols)
  const byId = new Map(students.map((s) => [s.id, s]))
  const placed: (Student | null)[] = []
  const seated = new Set<string>()
  // 先放有固定座位嘅（若該位已被佔用，唔覆寫；交返畀下面補位流程，避免學生消失）
  for (const s of students) {
    const m = metaFor(s.id, metas)
    if (typeof m.seat === 'number' && m.seat >= 0 && !placed[m.seat]) {
      placed[m.seat] = s
      seated.add(s.id)
    }
  }
  // 未排座位嘅：填最前嘅空格
  const rest = students.filter((s) => !seated.has(s.id))
  let cursor = 0
  for (const s of rest) {
    while (placed[cursor]) cursor++
    placed[cursor] = s
    cursor++
  }
  const filledLen = placed.length
  const rows = Math.max(1, Math.ceil(filledLen / C))
  const grid: (Student | null)[][] = []
  for (let r = 0; r < rows; r++) {
    const row: (Student | null)[] = []
    for (let c = 0; c < C; c++) {
      const idx = r * C + c
      row.push(byId.get(placed[idx]?.id ?? '') ?? null)
    }
    grid.push(row)
  }
  return grid
}

// ───────── 隨機分組 / 點名（教學常用）─────────
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** 平均分成 n 組 */
export function splitGroups<T>(items: T[], n: number): T[][] {
  const groups: T[][] = Array.from({ length: Math.max(1, n) }, () => [])
  shuffle(items).forEach((it, i) => {
    groups[i % groups.length].push(it)
  })
  return groups
}

// ───────── CSV 匯出 ─────────
export function csvEscape(v: string | number): string {
  const s = String(v ?? '')
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

// ───────── 雜項 ─────────
export function initials(name: string): string {
  const t = name.trim()
  if (!t) return '?'
  return t.charAt(0)
}

export function pctTone(pct: number): ClassTone {
  if (pct >= 80) return 'green'
  if (pct >= 50) return 'accent'
  if (pct >= 25) return 'amber'
  return 'rose'
}

export const TONE_FILL: Record<ClassTone, string> = {
  accent: 'bg-accent',
  blue: 'bg-blue-500',
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
  slate: 'bg-slate-400',
}

export const TONE_STROKE: Record<ClassTone, string> = {
  accent: 'stroke-accent',
  blue: 'stroke-blue-500',
  green: 'stroke-emerald-500',
  amber: 'stroke-amber-500',
  rose: 'stroke-rose-500',
  slate: 'stroke-slate-400',
}

/** 由共用 classes 計每班人數（用於班級規模圖）*/
export function classSizes(
  classes: Klass[],
  students: Student[],
): { klass: Klass; count: number }[] {
  return classes.map((k) => ({
    klass: k,
    count: students.filter((s) => s.classId === k.id).length,
  }))
}

// ============================================================
//  班級學業 / 出席健康摘要（跨功能聚合，唯讀）
//  ------------------------------------------------------------
//  成績、出席各自有專屬功能；呢度只把同一班嘅資料 roll-up 成
//  班情概覽（班平均分 %、出席率 %、需關注學生數），方便班主任
//  一眼睇班。全部守空 / 除零 / 缺值 / null score。
// ============================================================

/** 單個學生喺呢班嘅學業 / 出席指標（缺資料 → null，唔當 0）*/
export interface StudentAcademics {
  /** 已評分平均（百分制 0–100，四捨五入）；無已評分 → null */
  avgPct: number | null
  /** 計入平均嘅已評分數目 */
  gradedCount: number
  /** 出席率（present / 全部紀錄 × 100）；無紀錄 → null */
  attRate: number | null
  /** 出席紀錄總日數 */
  attTotal: number
  absentCount: number
  lateCount: number
}

/**
 * 計單一學生跨功能學業指標。
 * - 只計屬於傳入 assessments 嘅 score（避免殘留孤兒分數）。
 * - score 為 null 或 assessment.maxScore <= 0 一律略過（守除零）。
 */
export function studentAcademics(
  studentId: string,
  scores: Score[],
  assessments: Assessment[],
  attendance: AttendanceRecord[],
): StudentAcademics {
  const byAssessment = new Map(assessments.map((a) => [a.id, a]))
  const pcts: number[] = []
  for (const sc of scores) {
    if (sc.studentId !== studentId) continue
    if (sc.score == null) continue
    const a = byAssessment.get(sc.assessmentId)
    if (!a || a.maxScore <= 0) continue
    pcts.push((sc.score / a.maxScore) * 100)
  }
  const avgPct = pcts.length
    ? Math.round(pcts.reduce((s, x) => s + x, 0) / pcts.length)
    : null

  let attTotal = 0
  let present = 0
  let absentCount = 0
  let lateCount = 0
  for (const r of attendance) {
    if (r.studentId !== studentId) continue
    attTotal++
    if (r.status === 'present') present++
    else if (r.status === 'absent') absentCount++
    else if (r.status === 'late') lateCount++
  }
  const attRate = attTotal ? Math.round((present / attTotal) * 100) : null

  return { avgPct, gradedCount: pcts.length, attRate, attTotal, absentCount, lateCount }
}

/** 「需關注」判定門檻（可向後相容調整，預設貼近常見校本警界）*/
export const RISK_THRESHOLDS = { gradePct: 50, attRate: 80 } as const

/**
 * 學生係咪「需關注」：已評分平均偏低，或出席率偏低。
 * 完全冇任何資料（avg + att 皆 null）→ 唔當需關注（資料不足，避免誤報）。
 */
export function isAtRisk(a: StudentAcademics): boolean {
  const lowGrade = a.avgPct != null && a.avgPct < RISK_THRESHOLDS.gradePct
  const lowAtt = a.attRate != null && a.attRate < RISK_THRESHOLDS.attRate
  return lowGrade || lowAtt
}

/** 班級層面學業 / 出席聚合（roster 全體 roll-up）*/
export interface ClassAcademicSummary {
  /** 班平均分 %（只在有已評分學生時計，等權平均各生 avg）；否則 null */
  avgGradePct: number | null
  /** 有已評分嘅學生人數（班平均分嘅 N）*/
  gradedStudents: number
  /** 班出席率 %（全班 present 總數 / 全班紀錄總數）；無紀錄 → null */
  attendanceRate: number | null
  /** 有出席紀錄嘅學生人數 */
  attendedStudents: number
  /** 需關注學生數（成績低或出席低）*/
  atRiskCount: number
  /** 名冊總人數（分母參考）*/
  total: number
}

/**
 * 把一班學生嘅成績 / 出席聚合成班情摘要。
 * - 班平均分：對「有已評分」嘅學生 avg 取等權平均（避免多測驗學生過度加權）。
 * - 班出席率：用原始紀錄總數，較能反映實際整體出席。
 * - 全部守空名冊 / 無資料 / 除零。
 */
export function classAcademicSummary(
  roster: Student[],
  scores: Score[],
  assessments: Assessment[],
  attendance: AttendanceRecord[],
): ClassAcademicSummary {
  const rosterIds = new Set(roster.map((s) => s.id))
  // 只保留屬於本班學生嘅紀錄，避免其他班混入
  const myScores = scores.filter((s) => rosterIds.has(s.studentId))
  const myAtt = attendance.filter((r) => rosterIds.has(r.studentId))

  const studentAvgs: number[] = []
  let attPresent = 0
  let attTotalAll = 0
  const attendedSet = new Set<string>()
  let atRiskCount = 0

  for (const s of roster) {
    const a = studentAcademics(s.id, myScores, assessments, myAtt)
    if (a.avgPct != null) studentAvgs.push(a.avgPct)
    if (a.attTotal > 0) {
      attendedSet.add(s.id)
      attTotalAll += a.attTotal
      // 由 rate 反推 present 會有捨入誤差，故直接重數 present
      attPresent += a.attTotal - a.absentCount - a.lateCount
    }
    if (isAtRisk(a)) atRiskCount++
  }

  const avgGradePct = studentAvgs.length
    ? Math.round(studentAvgs.reduce((x, y) => x + y, 0) / studentAvgs.length)
    : null
  const attendanceRate = attTotalAll
    ? Math.round((attPresent / attTotalAll) * 100)
    : null

  return {
    avgGradePct,
    gradedStudents: studentAvgs.length,
    attendanceRate,
    attendedStudents: attendedSet.size,
    atRiskCount,
    total: roster.length,
  }
}
