import type {
  CalendarEvent,
  CalendarCategory,
  RecurrenceRule,
} from '../../../data/types'

// ============================================================
//  行事曆核心工具：日期、色系、重複展開、occurrence 收集
// ============================================================

export const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'] as const
export const HOURS = Array.from({ length: 24 }, (_, i) => i)

// ───────── 日期 key（本地時區 YYYY-MM-DD，避開 toISOString 時差）─────────
export function toKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 由 key 砌返本地 Date（中午，避開時區邊界） */
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

export function startOfWeek(d: Date): Date {
  return addDays(d, -d.getDay()) // 由星期日開始
}

export function weekKeys(d: Date): string[] {
  const s = startOfWeek(d)
  return Array.from({ length: 7 }, (_, i) => toKey(addDays(s, i)))
}

/** 某年某月嘅 6×7 = 42 格（由當月第一日嗰個星期日開始） */
export function monthMatrix(year: number, month: number): Date[] {
  const first = new Date(year, month, 1)
  const start = addDays(first, -first.getDay())
  return Array.from({ length: 42 }, (_, i) => addDays(start, i))
}

export function todayKey(): string {
  return toKey(new Date())
}

// ───────── 標籤 ─────────
export function longDateLabel(key: string): string {
  const d = fromKey(key)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（星期${WEEKDAYS[d.getDay()]}）`
}

export function monthLabel(year: number, month: number): string {
  return `${year}年${month + 1}月`
}

export function hourLabel(h: number): string {
  if (h === 0) return '凌晨 12'
  if (h < 12) return `上午 ${h}`
  if (h === 12) return '中午 12'
  return `下午 ${h - 12}`
}

export function minutesOf(time?: string): number {
  if (!time) return 0
  const [h, m] = time.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

// ───────── 色系（多個有色行事曆）─────────
export const CAL_COLORS = {
  accent: { label: '海軍藍', dot: 'bg-accent', chip: 'bg-accent/15 text-accent-strong dark:text-accent', block: 'border-l-[3px] border-accent bg-accent/10 text-accent-strong dark:bg-accent/15 dark:text-accent', solid: 'bg-accent text-white' },
  blue: { label: '藍', dot: 'bg-blue-500', chip: 'bg-blue-500/15 text-blue-700 dark:text-blue-300', block: 'border-l-[3px] border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-300', solid: 'bg-blue-500 text-white' },
  green: { label: '綠', dot: 'bg-emerald-500', chip: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300', block: 'border-l-[3px] border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300', solid: 'bg-emerald-500 text-white' },
  amber: { label: '橙', dot: 'bg-amber-500', chip: 'bg-amber-500/15 text-amber-700 dark:text-amber-300', block: 'border-l-[3px] border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300', solid: 'bg-amber-500 text-white' },
  rose: { label: '紅', dot: 'bg-rose-500', chip: 'bg-rose-500/15 text-rose-700 dark:text-rose-300', block: 'border-l-[3px] border-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-300', solid: 'bg-rose-500 text-white' },
  violet: { label: '紫', dot: 'bg-violet-500', chip: 'bg-violet-500/15 text-violet-700 dark:text-violet-300', block: 'border-l-[3px] border-violet-500 bg-violet-500/10 text-violet-700 dark:text-violet-300', solid: 'bg-violet-500 text-white' },
  cyan: { label: '青', dot: 'bg-cyan-500', chip: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300', block: 'border-l-[3px] border-cyan-500 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300', solid: 'bg-cyan-500 text-white' },
  pink: { label: '粉紅', dot: 'bg-pink-500', chip: 'bg-pink-500/15 text-pink-700 dark:text-pink-300', block: 'border-l-[3px] border-pink-500 bg-pink-500/10 text-pink-700 dark:text-pink-300', solid: 'bg-pink-500 text-white' },
} as const

export type CalColor = keyof typeof CAL_COLORS
export const CAL_COLOR_KEYS = Object.keys(CAL_COLORS) as CalColor[]

export function colorOf(color: string | undefined) {
  return CAL_COLORS[color as CalColor] ?? CAL_COLORS.accent
}

// ───────── 重複展開 ─────────
/** 某年某月（month 0-indexed）嘅日數 */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

/**
 * 由 series 開始日計第 i 個 occurrence（i 由 0 起）。
 * monthly/yearly 由 seriesStart 嘅 day-of-month 作基準逐步推算，跨短月時
 * clamp 返當月最後一日（如 1/31 → 2/28 → 3/31…），唔會由 roll 後嘅日期繼續
 * 漂移；yearly 由閏日 2/29 起非閏年同樣 clamp 到 2/28，唔會永久變 3/1。
 */
function nthOccurrence(
  seriesStart: Date,
  freq: RecurrenceRule['freq'],
  interval: number,
  i: number,
): Date {
  const y0 = seriesStart.getFullYear()
  const m0 = seriesStart.getMonth()
  const d0 = seriesStart.getDate()
  switch (freq) {
    case 'daily':
      return new Date(y0, m0, d0 + i * interval, 12)
    case 'weekly':
      return new Date(y0, m0, d0 + i * interval * 7, 12)
    case 'monthly': {
      const total = m0 + i * interval
      const y = y0 + Math.floor(total / 12)
      const m = ((total % 12) + 12) % 12
      return new Date(y, m, Math.min(d0, daysInMonth(y, m)), 12)
    }
    case 'yearly': {
      const y = y0 + i * interval
      return new Date(y, m0, Math.min(d0, daysInMonth(y, m0)), 12)
    }
    default:
      return new Date(y0, m0, d0 + i, 12)
  }
}

/** 展開一個事件喺 [startKey, endKey] 內嘅所有 occurrence 開始日（YYYY-MM-DD） */
export function expandOccurrences(
  ev: CalendarEvent,
  startKey: string,
  endKey: string,
): string[] {
  const ex = new Set(ev.exDates ?? [])
  const rec = ev.recurrence
  const out: string[] = []

  if (!rec || rec.freq === 'none') {
    if (ev.date >= startKey && ev.date <= endKey && !ex.has(ev.date)) {
      out.push(ev.date)
    }
    return out
  }

  const interval = Math.max(1, rec.interval ?? 1)
  const maxCount = rec.count ?? Infinity
  const end = fromKey(endKey)
  const seriesStart = fromKey(ev.date)
  let count = 0
  let guard = 0

  // 統一處理一個候選日：回 'stop' 代表整個系列到此為止
  const consider = (d: Date): 'stop' | 'cont' => {
    if (count >= maxCount) return 'stop'
    if (d > end) return 'stop'
    const key = toKey(d)
    if (rec.until && key > rec.until) return 'stop'
    if (d >= seriesStart) {
      if (key >= startKey && key <= endKey && !ex.has(key)) out.push(key)
      count += 1
    }
    return 'cont'
  }

  // 每週 + 指定星期幾（例如逢一三五）：每 interval 週，喺選中嘅星期出現
  if (rec.freq === 'weekly' && rec.byWeekday && rec.byWeekday.length) {
    const days = [...new Set(rec.byWeekday)].sort((a, b) => a - b)
    let weekStart = startOfWeek(seriesStart)
    while (guard++ < 3000) {
      let stopped = false
      for (const wd of days) {
        const d = addDays(weekStart, wd)
        if (d < seriesStart) continue // 第一週跳過開始日之前
        if (consider(d) === 'stop') {
          stopped = true
          break
        }
      }
      if (stopped || weekStart > end) break
      weekStart = addDays(weekStart, interval * 7)
    }
    return out
  }

  // 其餘：由開始日逐步推算第 i 個 occurrence（monthly/yearly clamp，唔漂移）
  let i = 0
  while (guard++ < 3000) {
    if (consider(nthOccurrence(seriesStart, rec.freq, interval, i)) === 'stop') break
    i += 1
  }
  return out
}

export function recurrenceLabel(rule?: RecurrenceRule): string {
  if (!rule || rule.freq === 'none') return '不重複'
  const n = Math.max(1, rule.interval ?? 1)
  const unit =
    rule.freq === 'daily'
      ? '日'
      : rule.freq === 'weekly'
        ? '週'
        : rule.freq === 'monthly'
          ? '個月'
          : '年'
  let base = n === 1 ? `每${unit}` : `每 ${n} ${unit}`
  if (rule.freq === 'weekly' && rule.byWeekday && rule.byWeekday.length) {
    const names = [...rule.byWeekday].sort((a, b) => a - b).map((d) => WEEKDAYS[d]).join('')
    base += ` ${names}`
  }
  if (rule.until) base += `，至 ${rule.until}`
  else if (rule.count) base += `，共 ${rule.count} 次`
  return base
}

// ───────── occurrence 收集（過濾隱藏行事曆）─────────
export interface Occurrence {
  event: CalendarEvent
  dateKey: string
  category?: CalendarCategory
}

export function getOccurrences(
  events: CalendarEvent[],
  cats: CalendarCategory[],
  startKey: string,
  endKey: string,
): Occurrence[] {
  const catById = new Map(cats.map((c) => [c.id, c]))
  const out: Occurrence[] = []
  for (const ev of events) {
    // 事件有指定行事曆而該行事曆隱藏 → 跳過
    const cat = ev.calendarId ? catById.get(ev.calendarId) : undefined
    if (cat && !cat.visible) continue
    for (const dateKey of expandOccurrences(ev, startKey, endKey)) {
      out.push({ event: ev, dateKey, category: cat })
    }
  }
  return out
}

export function isAllDay(ev: CalendarEvent): boolean {
  return ev.allDay === true || !ev.time
}

export function sortOccurrences(a: Occurrence, b: Occurrence): number {
  const aAll = isAllDay(a.event)
  const bAll = isAllDay(b.event)
  if (aAll !== bAll) return aAll ? -1 : 1
  return (a.event.time ?? '').localeCompare(b.event.time ?? '')
}

/** 把某日嘅 occurrence 索引化（dateKey → Occurrence[]，已排序） */
export function indexByDate(occurrences: Occurrence[]): Map<string, Occurrence[]> {
  const map = new Map<string, Occurrence[]>()
  for (const occ of occurrences) {
    const list = map.get(occ.dateKey)
    if (list) list.push(occ)
    else map.set(occ.dateKey, [occ])
  }
  for (const list of map.values()) list.sort(sortOccurrences)
  return map
}
