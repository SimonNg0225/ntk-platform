import type { TimetableSlot } from '../../../data/types'

// ============================================================
//  學校時間表核心工具
//  ------------------------------------------------------------
//  - 香港中學情境：星期一至六 × 多節，含小息/午膳/班主任堂
//  - 鐘聲時間 (bell times) 令格仔有真實上下課時間
//  - 循環週 (A/B 週) — 部分學校隔週上唔同堂
//  - 衝突偵測：同一節同時段被佔用、同班/同室撞堂
//  - 工作量統計：每日堂數、每班堂數、時段分佈、空堂
// ============================================================

// ───────── 星期 ─────────
export const DAY_DEFS: { day: number; label: string; short: string }[] = [
  { day: 1, label: '星期一', short: '一' },
  { day: 2, label: '星期二', short: '二' },
  { day: 3, label: '星期三', short: '三' },
  { day: 4, label: '星期四', short: '四' },
  { day: 5, label: '星期五', short: '五' },
  { day: 6, label: '星期六', short: '六' },
]

export function dayLabel(day: number): string {
  return DAY_DEFS.find((d) => d.day === day)?.label ?? `星期${day}`
}

export function dayShort(day: number): string {
  return DAY_DEFS.find((d) => d.day === day)?.short ?? String(day)
}

// ───────── 日循環（Day A–F）─────────
// 部分學校（如本校）用 6 日循環取代固定星期：A=1 … F=6，直接對上 slot.day。
// 邊個真實日期屬邊個 cycle day，由校曆決定（跳過週末/假期），存喺 cycleCalendar。
export const CYCLE_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'] as const

/** day(1..6) → 'Day A'..'Day F'（cycle 模式欄標題用）。 */
export function cycleLabel(day: number): string {
  const c = CYCLE_LABELS[day - 1]
  return c ? `Day ${c}` : `Day ${day}`
}
export function cycleShort(day: number): string {
  return CYCLE_LABELS[day - 1] ?? String(day)
}

/** 由校曆查某日期(YYYY-MM-DD)係邊個 cycle day(1..6)；無記錄（假期/未排）回 null。 */
export function cycleDayForDate(
  dateKey: string,
  calendar: { date: string; cycleDay: number }[],
): number | null {
  const e = calendar.find((c) => c.date === dateKey)
  return e ? e.cycleDay : null
}

// ───────── 循環週（A/B 週）─────────
export type WeekCycle = 'all' | 'A' | 'B'

export function weekCycleLabel(w?: WeekCycle): string {
  if (w === 'A') return 'A 週'
  if (w === 'B') return 'B 週'
  return '每週'
}

/** 兩個 slot 嘅循環週會唔會同時發生（衝突判斷用）。all 同任何都重疊。 */
export function weeksOverlap(a?: WeekCycle, b?: WeekCycle): boolean {
  const x = a ?? 'all'
  const y = b ?? 'all'
  if (x === 'all' || y === 'all') return true
  return x === y
}

// ───────── 鐘聲時間（每節對應時段）─────────
// 香港中學常見編排：1-2 節後小息，第 4 節後午膳。可由使用者改。
export interface BellRow {
  period: number
  kind: 'lesson' | 'recess' | 'lunch'
  label: string // 顯示名（第 1 節 / 小息 / 午膳）
  start: string // HH:mm
  end: string // HH:mm
}

// 預設鐘聲（8 節 + 小息 + 午膳），對齊一般 HK 中學作息
export const DEFAULT_BELLS: BellRow[] = [
  { period: 1, kind: 'lesson', label: '第 1 節', start: '08:15', end: '08:55' },
  { period: 2, kind: 'lesson', label: '第 2 節', start: '08:55', end: '09:35' },
  { period: 0, kind: 'recess', label: '小息', start: '09:35', end: '09:55' },
  { period: 3, kind: 'lesson', label: '第 3 節', start: '09:55', end: '10:35' },
  { period: 4, kind: 'lesson', label: '第 4 節', start: '10:35', end: '11:15' },
  { period: 5, kind: 'lesson', label: '第 5 節', start: '11:15', end: '11:55' },
  { period: 0, kind: 'lunch', label: '午膳', start: '11:55', end: '13:00' },
  { period: 6, kind: 'lesson', label: '第 6 節', start: '13:00', end: '13:40' },
  { period: 7, kind: 'lesson', label: '第 7 節', start: '13:40', end: '14:20' },
  { period: 8, kind: 'lesson', label: '第 8 節', start: '14:20', end: '15:00' },
]

export function lessonPeriods(bells: BellRow[]): number[] {
  return bells.filter((b) => b.kind === 'lesson').map((b) => b.period)
}

export function bellByPeriod(bells: BellRow[]): Map<number, BellRow> {
  const m = new Map<number, BellRow>()
  for (const b of bells) if (b.kind === 'lesson') m.set(b.period, b)
  return m
}

export function minutesOf(time?: string): number {
  if (!time) return 0
  const [h, m] = time.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

export function durationMin(b: BellRow): number {
  return Math.max(0, minutesOf(b.end) - minutesOf(b.start))
}

/**
 * 當日最後一節（lesson）嘅放學時間（由 0:00 起嘅分鐘）。
 * 用嚟判斷「今日課堂已完」而唔好寫死 16:00（鐘聲可由用家自訂，含晚課）。
 * 無任何 lesson → 0。
 */
export function lastLessonEndMin(bells: BellRow[]): number {
  let end = 0
  for (const b of bells) {
    if (b.kind !== 'lesson') continue
    const e = minutesOf(b.end)
    if (e > end) end = e
  }
  return end
}

// 把分鐘變返「X 小時 Y 分」/「Y 分」
export function fmtDuration(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h && m) return `${h} 小時 ${m} 分`
  if (h) return `${h} 小時`
  return `${m} 分`
}

// ───────── 顏色（科目/班別上色，純 Tailwind class）─────────
export const SLOT_COLORS = {
  accent: {
    label: '海軍藍',
    dot: 'bg-accent',
    cell: 'border-l-[3px] border-accent bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent',
    soft: 'bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent',
    bar: 'bg-accent',
  },
  blue: {
    label: '藍',
    dot: 'bg-blue-500',
    cell: 'border-l-[3px] border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
    soft: 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
    bar: 'bg-blue-500',
  },
  green: {
    label: '綠',
    dot: 'bg-emerald-500',
    cell: 'border-l-[3px] border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    soft: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    bar: 'bg-emerald-500',
  },
  amber: {
    label: '橙',
    dot: 'bg-amber-500',
    cell: 'border-l-[3px] border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    soft: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    bar: 'bg-amber-500',
  },
  rose: {
    label: '紅',
    dot: 'bg-rose-500',
    cell: 'border-l-[3px] border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
    soft: 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
    bar: 'bg-rose-500',
  },
  violet: {
    label: '紫',
    dot: 'bg-violet-500',
    cell: 'border-l-[3px] border-violet-500 bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
    soft: 'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
    bar: 'bg-violet-500',
  },
  cyan: {
    label: '青',
    dot: 'bg-cyan-500',
    cell: 'border-l-[3px] border-cyan-500 bg-cyan-50 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300',
    soft: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300',
    bar: 'bg-cyan-500',
  },
  pink: {
    label: '粉紅',
    dot: 'bg-pink-500',
    cell: 'border-l-[3px] border-pink-500 bg-pink-50 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300',
    soft: 'bg-pink-50 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300',
    bar: 'bg-pink-500',
  },
} as const

export type SlotColor = keyof typeof SLOT_COLORS
export const SLOT_COLOR_KEYS = Object.keys(SLOT_COLORS) as SlotColor[]

export function colorOf(c?: string) {
  return SLOT_COLORS[c as SlotColor] ?? SLOT_COLORS.accent
}

// 由科目名穩定推一個顏色（未指定時用），令同科目自動同色
export function autoColorFor(key: string): SlotColor {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
  return SLOT_COLOR_KEYS[h % SLOT_COLOR_KEYS.length]
}

// ───────── 每格附加資料（我哋自己嘅 collection；唔改共用 TimetableSlot）─────────
// 用 slotKey = `${day}-${period}` 對應到一格
export interface SlotMeta {
  id: string // = slotKey
  week?: WeekCycle // 循環週
  color?: SlotColor // 手動上色（無則 auto by subject）
  note?: string // 備課提示 / 課題
  coTeacher?: string // 協作老師
}

export function slotKey(day: number, period: number): string {
  return `${day}-${period}`
}

// ───────── 衝突偵測 ─────────
export type ConflictKind = 'class' | 'room'
export interface Conflict {
  kind: ConflictKind
  day: number
  period: number
  value: string // 班別 id / 課室名
  slotKeys: string[] // 涉事格（通常 1 格已含重複，這裡保留擴充）
}

/**
 * 偵測撞堂：同一時段（day+period+重疊週）唔應該有兩格指向同一班別或同一課室。
 * 本資料模型每格 (day,period) 唯一，所以實際衝突來自「跨日同名課室／同班於同一節」
 * → 這裡偵測「同一 (day, period) 區間內」唔可能重複；改為偵測整週層面嘅資源重用：
 *   - 同一節 (period) + 同一日 (day) 已唯一；
 *   - 但同一格 vs 另一格若 day 相同 period 相同係 Map 唯一，故衝突主要係「資料匯入」造成。
 * 我哋更實用地偵測：同一 (day, period) 下，如果使用者用「批量套用」整到兩條 slot
 *   指向同班同室但週重疊 → 標示。
 */
export function detectConflicts(
  slots: TimetableSlot[],
  metaByKey: Map<string, SlotMeta>,
): Conflict[] {
  // 以 (day-period) 分組，組內若多過一條 = 重複（資料異常）→ 班/室衝突
  const byCell = new Map<string, TimetableSlot[]>()
  for (const s of slots) {
    const k = slotKey(s.day, s.period)
    const arr = byCell.get(k)
    if (arr) arr.push(s)
    else byCell.set(k, [s])
  }
  const out: Conflict[] = []
  for (const [k, arr] of byCell) {
    if (arr.length < 2) continue
    const [day, period] = k.split('-').map(Number)
    // 班別重複
    const classGroups = new Map<string, TimetableSlot[]>()
    const roomGroups = new Map<string, TimetableSlot[]>()
    for (const s of arr) {
      if (s.classId) {
        const g = classGroups.get(s.classId) ?? []
        g.push(s)
        classGroups.set(s.classId, g)
      }
      if (s.room) {
        const g = roomGroups.get(s.room) ?? []
        g.push(s)
        roomGroups.set(s.room, g)
      }
    }
    for (const [cid, g] of classGroups) {
      if (g.length > 1 && pairOverlaps(g, metaByKey)) {
        out.push({ kind: 'class', day, period, value: cid, slotKeys: [k] })
      }
    }
    for (const [room, g] of roomGroups) {
      if (g.length > 1 && pairOverlaps(g, metaByKey)) {
        out.push({ kind: 'room', day, period, value: room, slotKeys: [k] })
      }
    }
  }
  return out
}

function pairOverlaps(
  group: TimetableSlot[],
  metaByKey: Map<string, SlotMeta>,
): boolean {
  // 任何兩條週重疊就算撞
  for (let i = 0; i < group.length; i++) {
    for (let j = i + 1; j < group.length; j++) {
      const a = metaByKey.get(slotKey(group[i].day, group[i].period))?.week
      const b = metaByKey.get(slotKey(group[j].day, group[j].period))?.week
      if (weeksOverlap(a, b)) return true
    }
  }
  return false
}

// ───────── 工作量統計 ─────────
export interface Workload {
  total: number // 總教學節數
  byDay: { day: number; count: number }[] // 每日節數
  byClass: { classId?: string; label: string; count: number }[]
  byPeriod: { period: number; count: number }[] // 每節（跨日）出現次數
  totalMinutes: number // 總教學分鐘
  busiestDay?: { day: number; count: number }
  freeByDay: { day: number; free: number; busy: number }[] // 每日空堂 vs 上堂
  maxConsecutive: number // 最長連堂
  daysWithLessons: number // 有上堂嘅日數
}

export function computeWorkload(
  slots: TimetableSlot[],
  bells: BellRow[],
  days: number[],
  classNameById: Map<string, string>,
): Workload {
  const periods = lessonPeriods(bells)
  const bellMap = bellByPeriod(bells)
  // 只計落喺顯示星期(days)範圍內嘅 slot，令 total / byDay / byClass / 分鐘一致
  // （否則範圍外嘅堂會入 total 但唔入 byDay，總數同每日分佈對唔上）
  const daySet = new Set(days)
  const inRange = slots.filter((s) => daySet.has(s.day))
  const occupied = new Set(inRange.map((s) => slotKey(s.day, s.period)))

  const byDayMap = new Map<number, number>()
  const byClassMap = new Map<string, number>()
  const byPeriodMap = new Map<number, number>()
  let totalMinutes = 0

  for (const s of inRange) {
    byDayMap.set(s.day, (byDayMap.get(s.day) ?? 0) + 1)
    byPeriodMap.set(s.period, (byPeriodMap.get(s.period) ?? 0) + 1)
    const cKey = s.classId ?? '__none__'
    byClassMap.set(cKey, (byClassMap.get(cKey) ?? 0) + 1)
    const b = bellMap.get(s.period)
    if (b) totalMinutes += durationMin(b)
  }

  const byDay = days.map((day) => ({ day, count: byDayMap.get(day) ?? 0 }))
  const byPeriod = periods.map((period) => ({
    period,
    count: byPeriodMap.get(period) ?? 0,
  }))
  const byClass = [...byClassMap.entries()]
    .map(([cid, count]) => ({
      classId: cid === '__none__' ? undefined : cid,
      label:
        cid === '__none__'
          ? '未指定班別'
          : (classNameById.get(cid) ?? '已刪班別'),
      count,
    }))
    .sort((a, b) => b.count - a.count)

  const busiestDay = byDay.reduce<{ day: number; count: number } | undefined>(
    (best, d) => (!best || d.count > best.count ? d : best),
    undefined,
  )

  // 每日空堂 vs 上堂 + 最長連堂
  const freeByDay = days.map((day) => {
    let busy = 0
    for (const p of periods) if (occupied.has(slotKey(day, p))) busy++
    return { day, busy, free: periods.length - busy }
  })

  let maxConsecutive = 0
  for (const day of days) {
    let run = 0
    // 行返整個鐘聲序列：遇到小息/午膳要斷開 run（嗰刻有得抖，唔算連堂）
    for (const b of bells) {
      if (b.kind !== 'lesson') {
        run = 0
        continue
      }
      if (occupied.has(slotKey(day, b.period))) {
        run++
        maxConsecutive = Math.max(maxConsecutive, run)
      } else {
        run = 0
      }
    }
  }

  const daysWithLessons = byDay.filter((d) => d.count > 0).length

  return {
    total: inRange.length,
    byDay,
    byClass,
    byPeriod,
    totalMinutes,
    busiestDay: busiestDay && busiestDay.count > 0 ? busiestDay : undefined,
    freeByDay,
    maxConsecutive,
    daysWithLessons,
  }
}

// ───────── 今日 / 下一堂 ─────────
// JS getDay(): 0=日 … 6=六。我哋 day 1..6 對應一至六。
export function jsDayToTimetable(jsDay: number): number {
  return jsDay // 1..6 一致；0（星期日）→ 0（無堂）
}

export interface UpNext {
  slot: TimetableSlot
  bell: BellRow
  status: 'now' | 'soon' | 'later'
  startsInMin: number
}

/** 計今日「下一堂 / 現正上緊」。nowMin = 由 0:00 起嘅分鐘。 */
export function findUpNext(
  slots: TimetableSlot[],
  bells: BellRow[],
  todayDay: number,
  nowMin: number,
): UpNext | undefined {
  const bellMap = bellByPeriod(bells)
  const todays = slots
    .filter((s) => s.day === todayDay)
    .map((s) => ({ slot: s, bell: bellMap.get(s.period) }))
    .filter((x): x is { slot: TimetableSlot; bell: BellRow } => !!x.bell)
    .sort((a, b) => minutesOf(a.bell.start) - minutesOf(b.bell.start))

  // 現正上緊
  for (const x of todays) {
    const s = minutesOf(x.bell.start)
    const e = minutesOf(x.bell.end)
    if (nowMin >= s && nowMin < e) {
      return { slot: x.slot, bell: x.bell, status: 'now', startsInMin: 0 }
    }
  }
  // 下一堂
  for (const x of todays) {
    const s = minutesOf(x.bell.start)
    if (s >= nowMin) {
      const diff = s - nowMin
      return {
        slot: x.slot,
        bell: x.bell,
        status: diff <= 15 ? 'soon' : 'later',
        startsInMin: diff,
      }
    }
  }
  return undefined
}

// ───────── 匯出（CSV，列印/Excel 友善）─────────
export function buildCsv(
  slots: TimetableSlot[],
  bells: BellRow[],
  days: number[],
  classNameById: Map<string, string>,
  metaByKey: Map<string, SlotMeta>,
): string {
  const head = ['星期', '節數', '時間', '科目', '班別', '課室', '循環週', '備註']
  const rows = [head]
  const sorted = [...slots].sort(
    (a, b) => a.day - b.day || a.period - b.period,
  )
  const bellMap = bellByPeriod(bells)
  for (const s of sorted) {
    if (!days.includes(s.day)) continue
    const b = bellMap.get(s.period)
    const meta = metaByKey.get(slotKey(s.day, s.period))
    rows.push([
      dayLabel(s.day),
      `第 ${s.period} 節`,
      b ? `${b.start}-${b.end}` : '',
      s.subject ?? '',
      s.classId ? (classNameById.get(s.classId) ?? '') : '',
      s.room ?? '',
      weekCycleLabel(meta?.week),
      meta?.note ?? '',
    ])
  }
  return rows
    .map((r) =>
      r
        .map((cell) => {
          const v = String(cell ?? '')
          return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
        })
        .join(','),
    )
    .join('\n')
}

export function downloadText(filename: string, text: string, mime: string) {
  const BOM = '﻿' // Excel 中文正常顯示
  const blob = new Blob([BOM + text], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
