import type { CalendarEvent, Task, MeetingNote } from '../../../data/types'
import { expandOccurrences } from '../../shared/calendar/util'

// ============================================================
//  工作週報／月報 — 時段解析 + 聚合（純函式，可單元測試）
//  令組件薄：時段解析、過濾、分桶、計數都集中在這裡。
// ============================================================

export type RangePreset = 'week' | 'month' | 'custom'

/** 解析後的時段（含頭含尾，YYYY-MM-DD）。 */
export interface ResolvedRange {
  start: string // YYYY-MM-DD（含）
  end: string // YYYY-MM-DD（含）
}

// ── 本地日期工具（避開時區：全部用 local 年月日，不經 UTC）──

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** Date → YYYY-MM-DD（local）。 */
export function toKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/**
 * 解析時段。
 * - week：本週日至週六（對齊現有行事曆 `startOfWeek` = 星期日起，香港行事曆慣例）。
 * - month：當月 1 號至月底。
 * - custom：clamp/校驗 start<=end；缺值 fallback 今日；若 start>end 自動對調。
 */
export function resolveRange(
  preset: RangePreset,
  customStart?: string,
  customEnd?: string,
  now: Date = new Date(),
): ResolvedRange {
  if (preset === 'week') {
    const start = new Date(now)
    start.setDate(now.getDate() - now.getDay()) // 退到星期日
    const end = new Date(start)
    end.setDate(start.getDate() + 6) // 至星期六
    return { start: toKey(start), end: toKey(end) }
  }
  if (preset === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0) // 下月第 0 日 = 今月最後一日
    return { start: toKey(start), end: toKey(end) }
  }
  // custom
  const today = toKey(now)
  let s = customStart && /^\d{4}-\d{2}-\d{2}$/.test(customStart) ? customStart : today
  let e = customEnd && /^\d{4}-\d{2}-\d{2}$/.test(customEnd) ? customEnd : today
  if (s > e) [s, e] = [e, s] // YYYY-MM-DD 字串比較安全，倒轉就對調
  return { start: s, end: e }
}

/**
 * 用 YYYY-MM-DD 字串 lexicographic 比較（安全）過濾落 range 內的項目。
 * getDate 抽不到日期（undefined / 非標準格式）的項目會被剔除。
 */
export function filterByRange<T>(
  items: T[],
  getDate: (t: T) => string | undefined,
  range: ResolvedRange,
): T[] {
  return items.filter((it) => {
    const d = getDate(it)
    if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d.slice(0, 10))) return false
    const key = d.slice(0, 10)
    return key >= range.start && key <= range.end
  })
}

/** 聚合結果（純讀，不 persist）。 */
export interface AggregatedData {
  events: CalendarEvent[]
  tasksDone: Task[]
  tasksOpen: Task[]
  notes: MeetingNote[]
  counts: {
    events: number
    done: number
    open: number
    notes: number
  }
}

/**
 * 聚合該時段：
 * - 行事曆事件：用 `expandOccurrences` 展開週期性事項（每週科組會、循環日課堂等），
 *   令該時段內每個 occurrence 都計一條，並尊重 exDates；非週期事件照按起始日落 range。
 *   （MVP 仍以起始日為準，跨多日事件只算起始 occurrence。）
 * - 待辦：Task 只有 `createdAt`（無到期 / 完成日），MVP 以 **建立日期** 落 range，再按 `done` 分桶。
 * - 會議筆記：按 `.date` 落 range。
 * counts 給 UI 即時預覽 + 判斷零資料（不用等 AI）。
 */
export function aggregate(
  events: CalendarEvent[],
  tasks: Task[],
  notes: MeetingNote[],
  range: ResolvedRange,
): AggregatedData {
  // 展開週期性事件：每個落 range 內的 occurrence 當一條記錄（尊重 exDates）。
  const evs: CalendarEvent[] = []
  for (const e of events) {
    const occ = expandOccurrences(e, range.start, range.end)
    for (const date of occ) evs.push(date === e.date ? e : { ...e, date })
  }
  evs.sort((a, b) => a.date.localeCompare(b.date))
  const tks = filterByRange(tasks, (t) => t.createdAt, range)
  const tasksDone = tks.filter((t) => t.done)
  const tasksOpen = tks.filter((t) => !t.done)
  const nts = filterByRange(notes, (n) => n.date, range)
  return {
    events: evs,
    tasksDone,
    tasksOpen,
    notes: nts,
    counts: {
      events: evs.length,
      done: tasksDone.length,
      open: tasksOpen.length,
      notes: nts.length,
    },
  }
}

/** 該時段係咪完全沒有紀錄（給 UI 判斷零資料空狀態 / 慳 AI 額度）。 */
export function isEmptyAggregate(agg: AggregatedData): boolean {
  const c = agg.counts
  return c.events === 0 && c.done === 0 && c.open === 0 && c.notes === 0
}
