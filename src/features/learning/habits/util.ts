import type { Habit, HabitFrequency, HabitLog } from './types'
import { isScheduledDay } from './types'

// ============================================================
//  日期 + 統計引擎（本地時區，避開 toISOString 時差）
// ============================================================

export const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'] as const
export const MONTH_LABELS = [
  '1月', '2月', '3月', '4月', '5月', '6月',
  '7月', '8月', '9月', '10月', '11月', '12月',
] as const

/** 本地時區 YYYY-MM-DD */
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

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12)
}

export function addDaysKey(key: string, n: number): string {
  return toKey(addDays(fromKey(key), n))
}

export function todayKey(): string {
  return toKey(new Date())
}

export function weekdayOf(key: string): number {
  return fromKey(key).getDay()
}

/** 由 today 起回推 n 日（含今日），由舊到新。 */
export function recentDays(n: number, anchor = new Date()): string[] {
  const out: string[] = []
  for (let i = n - 1; i >= 0; i -= 1) out.push(toKey(addDays(anchor, -i)))
  return out
}

export function longDateLabel(key: string): string {
  const d = fromKey(key)
  return `${d.getMonth() + 1}月${d.getDate()}日（星期${WEEKDAY_LABELS[d.getDay()]}）`
}

/** 兩個 key 相差日數（b - a）。 */
export function daysBetween(a: string, b: string): number {
  return Math.round((fromKey(b).getTime() - fromKey(a).getTime()) / 864e5)
}

// ───────── 完成集合 ─────────
/** 由全部 logs 整 habitId → Set<dateKey>。 */
export function logsByHabit(logs: HabitLog[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>()
  for (const l of logs) {
    let s = map.get(l.habitId)
    if (!s) {
      s = new Set<string>()
      map.set(l.habitId, s)
    }
    s.add(l.date)
  }
  return map
}

// ───────── 連續日（streak）─────────
// 計法尊重頻率：對於「指定星期」習慣，跳過非排程日唔會中斷連續。
// 「每日」「每週 N 次」就用日曆連續（最直觀）。
// anchor 預設 new Date()（即真實今日）；可傳明確日期把「今日」釘死，
// 方便 streakAtRisk 在同一錨點計算，亦方便測試。屬純增量：既有 2-arg
// caller 行為不變。
export function currentStreak(
  done: Set<string>,
  freq: HabitFrequency,
  anchor: Date = new Date(),
): number {
  const today = toKey(anchor)
  // 起點：今日完成 → 由今日計；否則由琴日計（保住琴日 streak）。
  let cursor = done.has(today) ? today : addDaysKey(today, -1)
  let streak = 0
  let guard = 0
  while (guard++ < 5000) {
    const wd = weekdayOf(cursor)
    const scheduled = freq.kind === 'weekdays' ? freq.days.includes(wd) : true
    if (!scheduled) {
      // 非排程日：唔計、唔中斷，繼續向前。
      cursor = addDaysKey(cursor, -1)
      continue
    }
    if (done.has(cursor)) {
      streak += 1
      cursor = addDaysKey(cursor, -1)
    } else {
      break
    }
  }
  return streak
}

/** 史上最長連續（同樣尊重頻率排程日）。 */
export function bestStreak(done: Set<string>, freq: HabitFrequency): number {
  if (done.size === 0) return 0
  const sorted = Array.from(done).sort()
  const earliest = sorted[0]
  const today = todayKey()
  let best = 0
  let run = 0
  let cursor = earliest
  let guard = 0
  while (guard++ < 20000 && cursor <= today) {
    const wd = weekdayOf(cursor)
    const scheduled = freq.kind === 'weekdays' ? freq.days.includes(wd) : true
    if (scheduled) {
      if (done.has(cursor)) {
        run += 1
        if (run > best) best = run
      } else {
        run = 0
      }
    }
    cursor = addDaysKey(cursor, 1)
  }
  return best
}

// ───────── 週期完成率 ─────────
/** 過去 n 個排程日內，完成幾多（按頻率分母）。回傳 0-100。 */
export function rateOverDays(
  done: Set<string>,
  freq: HabitFrequency,
  windowDays: number,
): number {
  const days = recentDays(windowDays)
  let scheduled = 0
  let completed = 0
  for (const k of days) {
    const wd = weekdayOf(k)
    if (freq.kind === 'weekdays' && !freq.days.includes(wd)) continue
    scheduled += 1
    if (done.has(k)) completed += 1
  }
  if (freq.kind === 'weekly') {
    // 每週 N 次：分母 = 週數 × N，分子 = 實際完成（封頂）。
    // 用精確週數（windowDays / 7），唔取整：30 日橫跨 4.29 週而非 4，
    // 取整會少計分母、令部分完成率偏高。target=0（windowDays/times=0）由下方守衞。
    const weeks = windowDays / 7
    const target = weeks * freq.times
    return target > 0 ? Math.min(100, Math.round((completed / target) * 100)) : 0
  }
  return scheduled > 0 ? Math.round((completed / scheduled) * 100) : 0
}

/** 本週（由週日起）已完成次數 vs 目標（每週 N 次用）。 */
export function thisWeekProgress(
  done: Set<string>,
  freq: HabitFrequency,
): { count: number; target: number } {
  const today = new Date()
  const start = addDays(today, -today.getDay()) // 本週日
  let count = 0
  for (let i = 0; i <= today.getDay(); i += 1) {
    const day = addDays(start, i)
    const k = toKey(day)
    // 只數「排程日」嘅完成，令分子基數同 target（排程日數）一致：
    // weekdays 模式喺非排程日（如逢一至五習慣嘅星期日）打卡唔應計入。
    if (isScheduledDay(freq, day.getDay()) && done.has(k)) count += 1
  }
  let target = 7
  if (freq.kind === 'weekly') target = freq.times
  else if (freq.kind === 'weekdays') target = freq.days.length
  return { count, target }
}

// ───────── 今日是否「應做」+ 是否完成 ─────────
export function isDueToday(freq: HabitFrequency): boolean {
  return isScheduledDay(freq, new Date().getDay())
}

// ───────── Heatmap：把完成密度分 0-4 級 ─────────
// 習慣完成係 0/1，所以「級數」用滾動連續氣勢表達：
// 0=未完成，1-4 = 完成 + 周邊 7 日完成密度愈高愈深，似 Streaks 火焰感。
export function heatLevel(done: Set<string>, key: string): number {
  if (!done.has(key)) return 0
  // 計呢日連同前 6 日嘅完成密度（0-1），映射 1-4。
  let around = 0
  for (let i = 0; i < 7; i += 1) {
    if (done.has(addDaysKey(key, -i))) around += 1
  }
  if (around >= 7) return 4
  if (around >= 5) return 3
  if (around >= 3) return 2
  return 1
}

// ───────── 年度 heatmap 格網（GitHub 式：列=星期，欄=週）─────────
export interface HeatCell {
  key: string
  inRange: boolean
}
export interface HeatGrid {
  weeks: HeatCell[][] // 每欄 7 格（週日→週六）
  monthMarks: { col: number; label: string }[] // 月份標籤位置
}

/** 由 (endKey 那週六) 向前 `weeks` 欄；對齊星期日起。 */
export function buildHeatGrid(endKey: string, weeks: number): HeatGrid {
  const end = fromKey(endKey)
  // 對齊到本週六
  const lastSat = addDays(end, 6 - end.getDay())
  const firstSun = addDays(lastSat, -(weeks * 7 - 1))
  const cols: HeatCell[][] = []
  const monthMarks: { col: number; label: string }[] = []
  let lastMonth = -1
  for (let w = 0; w < weeks; w += 1) {
    const col: HeatCell[] = []
    for (let d = 0; d < 7; d += 1) {
      const cell = addDays(firstSun, w * 7 + d)
      const inRange = cell <= end
      col.push({ key: toKey(cell), inRange })
      // 月份標籤：每欄第一格（週日）若月份變咗就標
      if (d === 0) {
        const m = cell.getMonth()
        if (m !== lastMonth) {
          monthMarks.push({ col: w, label: MONTH_LABELS[m] })
          lastMonth = m
        }
      }
    }
    cols.push(col)
  }
  return { weeks: cols, monthMarks }
}

// ───────── 月曆格（單月，6×7）─────────
export function monthMatrix(year: number, month: number): Date[] {
  const first = new Date(year, month, 1)
  const start = addDays(first, -first.getDay())
  return Array.from({ length: 42 }, (_, i) => addDays(start, i))
}

// ───────── 整體聚合（多習慣）─────────
export interface OverallStat {
  totalHabits: number
  dueToday: number
  doneToday: number
  bestCurrentStreak: number
  todayRate: number // 0-100（按今日 due 計）
  perfectDays7: number // 過去 7 日全 due 都完成嘅日數
}

export function overallStats(
  habits: Habit[],
  byHabit: Map<string, Set<string>>,
): OverallStat {
  const today = todayKey()
  const todayWd = new Date().getDay()
  let dueToday = 0
  let doneToday = 0
  let bestCurrent = 0
  for (const h of habits) {
    const done = byHabit.get(h.id) ?? new Set<string>()
    if (h.frequency.kind !== 'weekdays' || h.frequency.days.includes(todayWd)) {
      dueToday += 1
      if (done.has(today)) doneToday += 1
    }
    const s = currentStreak(done, h.frequency)
    if (s > bestCurrent) bestCurrent = s
  }

  // 過去 7 日「完美日」：每個 due 習慣當日都完成
  const last7 = recentDays(7)
  let perfect = 0
  for (const k of last7) {
    const wd = weekdayOf(k)
    let due = 0
    let ok = 0
    for (const h of habits) {
      if (h.frequency.kind === 'weekdays' && !h.frequency.days.includes(wd)) continue
      due += 1
      const done = byHabit.get(h.id) ?? new Set<string>()
      if (done.has(k)) ok += 1
    }
    if (due > 0 && ok === due) perfect += 1
  }

  return {
    totalHabits: habits.length,
    dueToday,
    doneToday,
    bestCurrentStreak: bestCurrent,
    todayRate: dueToday > 0 ? Math.round((doneToday / dueToday) * 100) : 0,
    perfectDays7: perfect,
  }
}

// ───────── 斷 streak 警報（今日未保住嘅連勝）─────────
export interface AtRiskHabit {
  id: string
  name: string
  streak: number
}

/**
 * 揀出「今日就會斷」嘅連勝習慣：
 *   ① 今日係排程日（應做）
 *   ② 今日未完成（done 內冇 anchor 當日 key）
 *   ③ 目前 currentStreak >= 1（即仲有連勝可保 / 可斷）
 * 已封存習慣略過。回傳按 streak 由大到小排（同分按名稱穩定排序）。
 * anchor 預設真實今日；測試可傳明確日期釘死。純讀取，唔改任何狀態。
 */
export function streakAtRisk(
  habits: Habit[],
  byHabit: Map<string, Set<string>>,
  anchor: Date = new Date(),
): AtRiskHabit[] {
  const wd = anchor.getDay()
  const todayK = toKey(anchor)
  const out: AtRiskHabit[] = []
  for (const h of habits) {
    if (h.archived) continue
    if (!isScheduledDay(h.frequency, wd)) continue
    const done = byHabit.get(h.id) ?? new Set<string>()
    if (done.has(todayK)) continue // 今日已保住
    const streak = currentStreak(done, h.frequency, anchor)
    if (streak < 1) continue // 冇連勝可斷
    out.push({ id: h.id, name: h.name, streak })
  }
  out.sort((a, b) => b.streak - a.streak || a.name.localeCompare(b.name))
  return out
}

// ───────── 數字格式 ─────────
export function pct(n: number): string {
  return `${Math.round(n)}%`
}
