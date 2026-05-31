import type { Klass, Student } from '../../../data/types'
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
