import type { AttendanceRecord, AttendanceStatus } from '../../../data/types'
import type { Entity } from '../../../lib/store'

// ============================================================
//  點名 / 出席 — 核心工具
//  ------------------------------------------------------------
//  - 共用 attendanceCol 仍然係 present / late / absent 三態（向後相容）
//  - 細項（病假 / 事假 / 早退 / 遲到分鐘 / 原因）放喺本功能自己嘅
//    attendance_notes 集合，用 (classId|studentId|date) 做 key
//  - 對齊真實學校考勤系統（WebSAMS / eClass 學生考勤）：
//    出席率、連續缺席偵測、月度點名冊、原因分類統計
// ============================================================

// ───────── 出席細項（本功能專屬，疊加喺共用三態之上）─────────
// 缺席子類（病假 vs 事假 vs 無故缺席）
export type AbsenceKind = 'sick' | 'personal' | 'official' | 'unexcused'

export interface AttendanceNote extends Entity {
  classId: string
  studentId: string
  date: string // YYYY-MM-DD（同 AttendanceRecord 對齊）
  absenceKind?: AbsenceKind // status=absent 時生效
  lateMinutes?: number // status=late 時：遲到分鐘
  earlyLeave?: boolean // 任何狀態都可標：早退
  reason?: string // 自由文字原因 / 備註
  updatedAt: string
}

// ───────── 狀態顯示 ─────────
export const STATUS_ORDER: AttendanceStatus[] = ['present', 'late', 'absent']

export const STATUS_LABEL: Record<AttendanceStatus, string> = {
  present: '出席',
  late: '遲到',
  absent: '缺席',
}

// 月度點名冊用嘅單字母代號（行內逐格）
export const STATUS_GLYPH: Record<AttendanceStatus, string> = {
  present: '✓',
  late: 'L',
  absent: '✕',
}

export interface StatusStyle {
  /** 點名卡 active 按鈕 */
  solid: string
  /** 點名卡 inactive 按鈕 */
  soft: string
  /** badge / 文字色 */
  text: string
  /** 點名冊格仔底色 */
  cell: string
  /** 圖表填色（Tailwind bg-*）*/
  bar: string
  /** SVG stroke / fill 用嘅實際色（CSS 變數或 hex）*/
  hex: string
}

export const STATUS_STYLE: Record<AttendanceStatus, StatusStyle> = {
  present: {
    solid: 'bg-accent text-white hover:bg-accent-strong focus-visible:ring-accent/40',
    soft: 'bg-accent-soft text-accent-strong hover:bg-accent hover:text-white focus-visible:ring-accent/40 dark:bg-accent/15 dark:text-accent dark:hover:text-white',
    text: 'text-accent-strong dark:text-accent',
    cell: 'bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent',
    bar: 'bg-accent',
    hex: 'var(--accent)',
  },
  late: {
    solid: 'bg-amber-500 text-white hover:bg-amber-600 focus-visible:ring-amber-500/40',
    soft: 'bg-amber-50 text-amber-700 hover:bg-amber-500 hover:text-white focus-visible:ring-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500 dark:hover:text-white',
    text: 'text-amber-600 dark:text-amber-300',
    cell: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    bar: 'bg-amber-500',
    hex: '#f59e0b',
  },
  absent: {
    solid: 'bg-rose-500 text-white hover:bg-rose-600 focus-visible:ring-rose-500/40',
    soft: 'bg-rose-50 text-rose-700 hover:bg-rose-500 hover:text-white focus-visible:ring-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500 dark:hover:text-white',
    text: 'text-rose-600 dark:text-rose-300',
    cell: 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
    bar: 'bg-rose-500',
    hex: '#f43f5e',
  },
}

export const ABSENCE_KIND_LABEL: Record<AbsenceKind, string> = {
  sick: '病假',
  personal: '事假',
  official: '公假',
  unexcused: '無故缺席',
}

export const ABSENCE_KIND_OPTIONS: { value: AbsenceKind; label: string }[] = [
  { value: 'sick', label: '病假' },
  { value: 'personal', label: '事假' },
  { value: 'official', label: '公假（official）' },
  { value: 'unexcused', label: '無故缺席' },
]

/** 病假 / 事假 / 公假 視為「准假」，唔計入無故缺席 */
export function isExcused(kind?: AbsenceKind): boolean {
  return kind === 'sick' || kind === 'personal' || kind === 'official'
}

// ───────── 日期工具（本地時區，避開 toISOString 時差）─────────
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'] as const

export function toKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function fromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0)
}

export function todayKey(): string {
  return toKey(new Date())
}

export function weekdayOf(key: string): string {
  return WEEKDAYS[fromKey(key).getDay()]
}

export function isWeekend(key: string): boolean {
  const d = fromKey(key).getDay()
  return d === 0 || d === 6
}

export function longDateLabel(key: string): string {
  const d = fromKey(key)
  return `${d.getMonth() + 1}月${d.getDate()}日（星期${WEEKDAYS[d.getDay()]}）`
}

export function shortDateLabel(key: string): string {
  const d = fromKey(key)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

/** 上 / 下一日 */
export function shiftKey(key: string, days: number): string {
  const d = fromKey(key)
  return toKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + days, 12))
}

/** 一個月嘅所有日 key（1 號到月尾） */
export function monthDays(year: number, month: number): string[] {
  const last = new Date(year, month + 1, 0).getDate()
  return Array.from({ length: last }, (_, i) => toKey(new Date(year, month, i + 1, 12)))
}

/** 由今日倒數 n 日（含今日）嘅 key 陣列（由舊到新） */
export function recentDayKeys(n: number, anchor = todayKey()): string[] {
  return Array.from({ length: n }, (_, i) => shiftKey(anchor, -(n - 1 - i)))
}

export function monthLabel(year: number, month: number): string {
  return `${year}年${month + 1}月`
}

// ───────── 統計 ─────────
export interface DayCount {
  present: number
  late: number
  absent: number
  unmarked: number
  total: number
  /** 出席率 %（present+late 算到，缺席唔算）；無人時 null */
  rate: number | null
}

/** 計某一日某班嘅點名分佈 */
export function countDay(
  statusByStudent: Map<string, AttendanceStatus>,
  totalStudents: number,
): DayCount {
  let present = 0
  let late = 0
  let absent = 0
  for (const st of statusByStudent.values()) {
    if (st === 'present') present += 1
    else if (st === 'late') late += 1
    else if (st === 'absent') absent += 1
  }
  const marked = present + late + absent
  const unmarked = Math.max(0, totalStudents - marked)
  const rate = marked === 0 ? null : Math.round(((present + late) / marked) * 100)
  return { present, late, absent, unmarked, total: totalStudents, rate }
}

export interface StudentTally {
  present: number
  late: number
  absent: number
  /** 有標記嘅總日數 */
  marked: number
  /** 出席率 %（present+late）/ marked；無記錄 null */
  rate: number | null
  /** 連續缺席日數（最近一段，由名單最新嗰日往前數）*/
  currentAbsentStreak: number
}

/**
 * 為每位學生彙總一段日期內嘅出席記錄。
 * @param records 已過濾到該班嘅 AttendanceRecord
 * @param dayKeys 要統計嘅日子（由舊到新），用嚟計連續缺席
 */
export function tallyByStudent(
  records: AttendanceRecord[],
  studentIds: string[],
  dayKeys: string[],
): Map<string, StudentTally> {
  // index: studentId -> date -> status
  const idx = new Map<string, Map<string, AttendanceStatus>>()
  for (const r of records) {
    let m = idx.get(r.studentId)
    if (!m) {
      m = new Map()
      idx.set(r.studentId, m)
    }
    m.set(r.date, r.status)
  }

  const out = new Map<string, StudentTally>()
  const sortedDays = [...dayKeys].sort()
  for (const sid of studentIds) {
    const m = idx.get(sid)
    let present = 0
    let late = 0
    let absent = 0
    if (m) {
      for (const day of dayKeys) {
        const st = m.get(day)
        if (st === 'present') present += 1
        else if (st === 'late') late += 1
        else if (st === 'absent') absent += 1
      }
    }
    const marked = present + late + absent
    const rate = marked === 0 ? null : Math.round(((present + late) / marked) * 100)

    // 連續缺席：由最新嘅有標記日往前數
    let streak = 0
    if (m) {
      for (let i = sortedDays.length - 1; i >= 0; i--) {
        const st = m.get(sortedDays[i])
        if (st === undefined) continue // 無上堂 / 未標記 → 跳過唔斷
        if (st === 'absent') streak += 1
        else break
      }
    }

    out.set(sid, { present, late, absent, marked, rate, currentAbsentStreak: streak })
  }
  return out
}

// ───────── 個別學生摘要（drill-down）─────────
// 班級層面已有 tallyByStudent / 趨勢 / 排行；呢組純函式專為「單一學生」
// 嘅深入摘要服務，補足之前未被聚合嘅 attendance_notes（病假類別 / 遲到分鐘 /
// 早退），同埋 currentAbsentStreak 以外嘅指標。全部守空 / 缺值 / 除零。

/**
 * 期內「最長」連續缺席段（唔同 currentAbsentStreak 嘅「最近」段）。
 * 與 currentAbsentStreak 一致：未標記 / 無上堂日 gap 跳過唔斷，遇 present/late 即斷。
 * @param records 已過濾到該班嘅 AttendanceRecord（含其他學生亦可）
 * @param studentId 目標學生
 * @param dayKeys 統計窗口（任意次序，內部按真實日期排序）
 */
export function longestAbsentStreak(
  records: AttendanceRecord[],
  studentId: string,
  dayKeys: string[],
): number {
  const byDate = new Map<string, AttendanceStatus>()
  for (const r of records) {
    if (r.studentId === studentId) byDate.set(r.date, r.status)
  }
  const sortedDays = [...dayKeys].sort()
  let longest = 0
  let run = 0
  for (const day of sortedDays) {
    const st = byDate.get(day)
    if (st === undefined) continue // gap：跳過，唔斷亦唔加
    if (st === 'absent') {
      run += 1
      if (run > longest) longest = run
    } else {
      run = 0 // present / late → 斷
    }
  }
  return longest
}

/**
 * 窗口內該學生「最後一次有出席（present 或 late）」嘅日 key；從未出席返 null。
 * 用嚟提示「已經幾耐冇返學」。
 */
export function lastPresentKey(
  records: AttendanceRecord[],
  studentId: string,
  dayKeys: string[],
): string | null {
  const present = new Set<string>()
  for (const r of records) {
    if (r.studentId === studentId && (r.status === 'present' || r.status === 'late')) {
      present.add(r.date)
    }
  }
  if (present.size === 0) return null
  const sortedDays = [...dayKeys].sort()
  for (let i = sortedDays.length - 1; i >= 0; i--) {
    if (present.has(sortedDays[i])) return sortedDays[i]
  }
  return null
}

export interface NoteSummary {
  /** 各缺席類別出現次數（病 / 事 / 公 / 無故）；缺類別不計 */
  byKind: Record<AbsenceKind, number>
  /** 准假（病 / 事 / 公）合計 */
  excusedCount: number
  /** 無故缺席合計 */
  unexcusedCount: number
  /** 有填遲到分鐘嘅次數 */
  lateLoggedCount: number
  /** 遲到分鐘總和 */
  lateMinutesTotal: number
  /** 平均每次遲到分鐘（只計有填者）；無資料 null（避免除零 NaN）*/
  lateMinutesAvg: number | null
  /** 標記早退次數 */
  earlyLeaveCount: number
}

/**
 * 聚合一批 attendance_notes（通常已過濾到某學生某窗口）。
 * 守：空陣列 → 全 0、lateMinutesAvg = null；缺欄位唔當數；負分鐘夾 0。
 */
export function summarizeNotes(notes: AttendanceNote[]): NoteSummary {
  const byKind: Record<AbsenceKind, number> = {
    sick: 0,
    personal: 0,
    official: 0,
    unexcused: 0,
  }
  let lateLoggedCount = 0
  let lateMinutesTotal = 0
  let earlyLeaveCount = 0
  for (const n of notes) {
    if (n.absenceKind) byKind[n.absenceKind] += 1
    if (typeof n.lateMinutes === 'number' && n.lateMinutes > 0) {
      lateLoggedCount += 1
      lateMinutesTotal += n.lateMinutes
    }
    if (n.earlyLeave) earlyLeaveCount += 1
  }
  const excusedCount = byKind.sick + byKind.personal + byKind.official
  const lateMinutesAvg =
    lateLoggedCount === 0 ? null : Math.round(lateMinutesTotal / lateLoggedCount)
  return {
    byKind,
    excusedCount,
    unexcusedCount: byKind.unexcused,
    lateLoggedCount,
    lateMinutesTotal,
    lateMinutesAvg,
    earlyLeaveCount,
  }
}

/** 出席率 → 色調（配合 ProgressBar / Badge tone）*/
export function rateTone(rate: number | null): 'green' | 'accent' | 'amber' | 'rose' | 'slate' {
  if (rate == null) return 'slate'
  if (rate >= 95) return 'green'
  if (rate >= 90) return 'accent'
  if (rate >= 80) return 'amber'
  return 'rose'
}

export function rateBarTone(rate: number | null): 'accent' | 'green' | 'amber' | 'rose' {
  if (rate == null) return 'accent'
  if (rate >= 95) return 'green'
  if (rate >= 90) return 'accent'
  if (rate >= 80) return 'amber'
  return 'rose'
}

// ───────── CSV 匯出（共用層，見 ../shared/csv；BOM 令 Excel 正確讀中文）─────────
export { downloadCsv } from '../shared/csv'
