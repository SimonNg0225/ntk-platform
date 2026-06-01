import type { Card } from '../../../data/types'
import type { Rating } from '../../../lib/srs'
import { todayStr } from '../../../lib/srs'
import type {
  CardMeta,
  CardState,
  DeckPref,
  ReviewLog,
  StudyMode,
} from './types'

// ============================================================
//  本功能專屬 SRS 衍生工具（建喺 lib/srs 之上，零改共用檔）
//  - 卡片狀態推導（new / learning / young / mature / suspended）
//  - 隊列建構（含每日新卡上限、暫停、排序）
//  - 統計：留存率、預測、答題分布、連續日數、heatmap
// ============================================================

export const MATURE_DAYS = 21 // Anki 慣例：interval ≥ 21 日 = 熟卡
export const LEECH_LAPSES = 4 // 累計唔記得達此數 = leech（難頂卡）

// ───────── 本地日期工具（避開時區，對齊 calendar/util）─────────
export function dayKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
export function addDaysKey(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number)
  const dt = new Date(y, (m ?? 1) - 1, (d ?? 1) + n, 12)
  return dayKey(dt)
}
export function diffDays(aKey: string, bKey: string): number {
  const [ay, am, ad] = aKey.split('-').map(Number)
  const [by, bm, bd] = bKey.split('-').map(Number)
  const a = new Date(ay, (am ?? 1) - 1, ad ?? 1, 12).getTime()
  const b = new Date(by, (bm ?? 1) - 1, bd ?? 1, 12).getTime()
  return Math.round((a - b) / 864e5)
}

// ───────── 預設值 ─────────
export const DEFAULT_PREF: Omit<DeckPref, 'id'> = {
  newPerDay: 20,
  reviewPerDay: 0,
  order: 'due',
}

export function prefOf(prefs: DeckPref[], deckId: string): DeckPref {
  return prefs.find((p) => p.id === deckId) ?? { id: deckId, ...DEFAULT_PREF }
}

export function metaOf(metas: CardMeta[], cardId: string): CardMeta {
  return (
    metas.find((m) => m.id === cardId) ?? {
      id: cardId,
      tags: [],
      suspended: false,
      flagged: false,
      lapses: 0,
      updatedAt: '',
    }
  )
}

// ───────── 卡片狀態 ─────────
export function cardState(card: Card, meta?: CardMeta): CardState {
  if (meta?.suspended) return 'suspended'
  if (card.repetitions === 0) return 'new'
  if (card.intervalDays < 1) return 'learning'
  if (card.intervalDays < MATURE_DAYS) return 'young'
  return 'mature'
}

export const STATE_LABEL: Record<CardState, string> = {
  new: '新卡',
  learning: '學習中',
  young: '生卡',
  mature: '熟卡',
  suspended: '已暫停',
}

export const STATE_TONE: Record<
  CardState,
  'slate' | 'accent' | 'amber' | 'green' | 'blue'
> = {
  new: 'blue',
  learning: 'amber',
  young: 'accent',
  mature: 'green',
  suspended: 'slate',
}

export function isLeech(meta?: CardMeta): boolean {
  return (meta?.lapses ?? 0) >= LEECH_LAPSES
}

export function isDueToday(card: Card): boolean {
  return card.dueDate <= todayStr()
}

// ───────── 隊列建構（複習主流程）─────────
export interface QueueOpts {
  deckId: string
  cards: Card[]
  metas: CardMeta[]
  pref: DeckPref
  mode: StudyMode
  typedAnswer?: string // typed 模式答案比對提示用（此處唔需要）
}

/**
 * 起一條複習隊列（回傳 card id 陣列）。
 * - srs：到期卡 + 受每日新卡上限規限嘅新卡；排除暫停
 * - cram：全部卡（除暫停）；唔理到期
 * - typed：同 srs，但只揀有清晰答案嘅卡（背面短）
 * - starred：只揀 flagged
 */
export function buildQueue(opts: QueueOpts): string[] {
  const { deckId, cards, metas, pref, mode } = opts
  const metaById = new Map(metas.map((m) => [m.id, m]))
  let pool = cards.filter((c) => c.deckId === deckId)

  // 暫停卡永遠唔入（cram 都唔出，符合 Anki）
  pool = pool.filter((c) => !metaById.get(c.id)?.suspended)

  if (mode === 'starred') {
    pool = pool.filter((c) => metaById.get(c.id)?.flagged)
  } else if (mode === 'srs' || mode === 'typed') {
    const due = pool.filter(isDueToday)
    // 已複習過（repetitions>0）嘅到期卡，受每日複習上限規限（0 = 不限）
    let reviewDue = due.filter((c) => c.repetitions > 0)
    if (pref.reviewPerDay > 0) {
      reviewDue = reviewDue.slice(0, pref.reviewPerDay)
    }
    // 未學過嘅新卡，受每日新卡上限規限
    const newDue = due
      .filter((c) => c.repetitions === 0)
      .slice(0, Math.max(0, pref.newPerDay))
    pool = [...reviewDue, ...newDue]
  }
  // cram：pool 維持全部（除暫停）

  // 排序
  const sorted = sortQueue(pool, pref.order)
  return sorted.map((c) => c.id)
}

function sortQueue(cards: Card[], order: DeckPref['order']): Card[] {
  const arr = [...cards]
  if (order === 'random') {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  }
  if (order === 'added') {
    return arr.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }
  // due：到期先（新卡 dueDate 通常 = 今日，會排前）
  return arr.sort((a, b) => a.dueDate.localeCompare(b.dueDate))
}

// ───────── 答題後的「下次間隔預估」（顯示喺評分掣上）─────────
// 重用 lib/srs schedule 嘅邏輯結果：呢度只係輕量預估，畀用家睇。
export function previewIntervals(card: Card): Record<Rating, string> {
  const ease = card.ease
  const reps = card.repetitions
  const cur = card.intervalDays

  const next = (rating: Rating): number => {
    if (rating === 'again') return 0
    if (reps === 0) return rating === 'easy' ? 3 : 1
    if (reps === 1) return rating === 'easy' ? 8 : 6
    // easy：對齊 lib/srs.schedule —— 佢對 easy 會先 ease += 0.15 再乘 1.3，
    // 故此處同樣用 (ease + 0.15) * 1.3，避免預估永遠少報約 1 日。
    const factor =
      rating === 'hard' ? 1.2 : rating === 'easy' ? (ease + 0.15) * 1.3 : ease
    return Math.max(1, Math.round(cur * factor))
  }

  return {
    again: '10 分鐘',
    hard: fmtInterval(next('hard')),
    good: fmtInterval(next('good')),
    easy: fmtInterval(next('easy')),
  }
}

export function fmtInterval(days: number): string {
  if (days <= 0) return '今日'
  if (days === 1) return '1 日'
  if (days < 30) return `${days} 日`
  if (days < 365) {
    const mo = Math.round(days / 30)
    return `${mo} 個月`
  }
  const yr = (days / 365).toFixed(1)
  return `${yr} 年`
}

// ============================================================
//  統計（全部自家計，畀 charts.tsx 畫）
// ============================================================

// ───── 連續學習日數（streak）─────
export function computeStreak(logs: ReviewLog[]): {
  current: number
  best: number
} {
  if (logs.length === 0) return { current: 0, best: 0 }
  const days = new Set(logs.map((l) => l.ts.slice(0, 10)))
  const sorted = [...days].sort()
  let best = 1
  let run = 1
  for (let i = 1; i < sorted.length; i++) {
    if (diffDays(sorted[i], sorted[i - 1]) === 1) run += 1
    else run = 1
    if (run > best) best = run
  }
  // current：由今日（或昨日）往回數連續
  const today = todayStr()
  let cursor = days.has(today) ? today : addDaysKey(today, -1)
  if (!days.has(cursor)) return { current: 0, best }
  let current = 0
  while (days.has(cursor)) {
    current += 1
    cursor = addDaysKey(cursor, -1)
  }
  return { current, best }
}

// ───── Heatmap：過去 N 日每日複習數 ─────
export interface HeatCell {
  key: string
  count: number
}
export function reviewHeatmap(logs: ReviewLog[], days = 119): HeatCell[] {
  const counts = new Map<string, number>()
  for (const l of logs) {
    const k = l.ts.slice(0, 10)
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  const today = todayStr()
  const out: HeatCell[] = []
  for (let i = days - 1; i >= 0; i--) {
    const k = addDaysKey(today, -i)
    out.push({ key: k, count: counts.get(k) ?? 0 })
  }
  return out
}

// ───── 預測：未來 N 日將到期嘅卡數（按 dueDate）─────
export interface ForecastBar {
  key: string
  label: string
  young: number
  mature: number
}
export function dueForecast(
  cards: Card[],
  metas: CardMeta[],
  days = 14,
): ForecastBar[] {
  const metaById = new Map(metas.map((m) => [m.id, m]))
  const today = todayStr()
  const buckets: ForecastBar[] = []
  for (let i = 0; i < days; i++) {
    const k = addDaysKey(today, i)
    buckets.push({
      key: k,
      label: i === 0 ? '今日' : i === 1 ? '聽日' : `+${i}`,
      young: 0,
      mature: 0,
    })
  }
  const idx = new Map(buckets.map((b, i) => [b.key, i]))
  for (const c of cards) {
    if (metaById.get(c.id)?.suspended) continue
    if (c.repetitions === 0) continue // 新卡唔計入預測
    // 到期日早過今日嘅，全部歸今日
    const key = c.dueDate < today ? today : c.dueDate
    const i = idx.get(key)
    if (i === undefined) continue
    if (c.intervalDays >= MATURE_DAYS) buckets[i].mature += 1
    else buckets[i].young += 1
  }
  return buckets
}

// ───── 到期負荷日曆（未來 N 週，7 欄 × N 列，按當日到期卡數著色）─────
// 對齊 dueForecast 語意：新卡 / 暫停卡唔計；逾期卡歸今日。
// 由今日（含）起向後鋪 weeks×7 日，再補頭部空白令第一格落正確星期（日=0）。
export interface DueCalCell {
  key: string
  count: number
  isToday: boolean
  inRange: boolean // 是否屬統計區間（補白格 false；天數超出 weeks×7 亦 false）
}
export function dueLoadCalendar(
  cards: Card[],
  metas: CardMeta[],
  weeks = 6,
): { weeks: DueCalCell[][]; total: number; max: number } {
  const span = Math.max(0, weeks) * 7
  const metaById = new Map(metas.map((m) => [m.id, m]))
  const today = todayStr()

  // 統計每日到期卡數（只計區間內；逾期歸今日）
  const counts = new Map<string, number>()
  for (let i = 0; i < span; i++) counts.set(addDaysKey(today, i), 0)
  for (const c of cards) {
    if (metaById.get(c.id)?.suspended) continue
    if (c.repetitions === 0) continue // 新卡唔計
    const key = c.dueDate < today ? today : c.dueDate
    if (!counts.has(key)) continue // 超出區間
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  // 頭部補白：令今日落喺正確星期欄（日=0 … 六=6）
  const [y, m, d] = today.split('-').map(Number)
  const dow = new Date(y, (m ?? 1) - 1, d ?? 1).getDay()
  const cells: DueCalCell[] = []
  for (let i = 0; i < dow; i++) {
    cells.push({ key: `pad-${i}`, count: 0, isToday: false, inRange: false })
  }
  for (let i = 0; i < span; i++) {
    const key = addDaysKey(today, i)
    cells.push({
      key,
      count: counts.get(key) ?? 0,
      isToday: i === 0,
      inRange: true,
    })
  }
  // 尾部補白：補滿最後一行
  while (cells.length % 7 !== 0) {
    cells.push({
      key: `pad-end-${cells.length}`,
      count: 0,
      isToday: false,
      inRange: false,
    })
  }

  const out: DueCalCell[][] = []
  for (let i = 0; i < cells.length; i += 7) out.push(cells.slice(i, i + 7))

  let total = 0
  let max = 0
  for (const c of cells) {
    if (!c.inRange) continue
    total += c.count
    if (c.count > max) max = c.count
  }
  return { weeks: out, total, max }
}

// ───── 留存率：依評分 again 為「答錯」─────
export function retention(logs: ReviewLog[]): {
  rate: number
  total: number
  pass: number
} {
  // 只計複習過嘅卡（prevInterval>0），符合 Anki「true retention」
  const real = logs.filter((l) => l.prevInterval > 0)
  if (real.length === 0) return { rate: 0, total: 0, pass: 0 }
  const pass = real.filter((l) => l.rating !== 'again').length
  return { rate: (pass / real.length) * 100, total: real.length, pass }
}

// ───── 答題掣分布（again/hard/good/easy 各佔幾多）─────
export function answerBreakdown(logs: ReviewLog[]): Record<Rating, number> {
  const out: Record<Rating, number> = { again: 0, hard: 0, good: 0, easy: 0 }
  for (const l of logs) out[l.rating] += 1
  return out
}

// ───── 卡片狀態分布（new/learning/young/mature/suspended）─────
export function stateBreakdown(
  cards: Card[],
  metas: CardMeta[],
): Record<CardState, number> {
  const metaById = new Map(metas.map((m) => [m.id, m]))
  const out: Record<CardState, number> = {
    new: 0,
    learning: 0,
    young: 0,
    mature: 0,
    suspended: 0,
  }
  for (const c of cards) out[cardState(c, metaById.get(c.id))] += 1
  return out
}

// ───── 間隔分布直方圖（成熟卡 interval 嘅分布）─────
export interface IntervalBin {
  label: string
  count: number
}
export function intervalHistogram(cards: Card[]): IntervalBin[] {
  const bins: { label: string; max: number }[] = [
    { label: '<1日', max: 1 },
    { label: '1-7日', max: 7 },
    { label: '1-3週', max: 21 },
    { label: '3週-2月', max: 60 },
    { label: '2-6月', max: 180 },
    { label: '6月+', max: Infinity },
  ]
  const counts = bins.map(() => 0)
  for (const c of cards) {
    if (c.repetitions === 0) continue
    const i = bins.findIndex((b) => c.intervalDays < b.max)
    counts[i >= 0 ? i : bins.length - 1] += 1
  }
  return bins.map((b, i) => ({ label: b.label, count: counts[i] }))
}

// ───── 每日複習量（過去 N 日，畀長條趨勢圖）─────
export function dailyReviewCounts(
  logs: ReviewLog[],
  days = 14,
): { key: string; label: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const l of logs) {
    const k = l.ts.slice(0, 10)
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  const today = todayStr()
  const out: { key: string; label: string; count: number }[] = []
  for (let i = days - 1; i >= 0; i--) {
    const k = addDaysKey(today, -i)
    const [, , dd] = k.split('-')
    out.push({ key: k, label: dd, count: counts.get(k) ?? 0 })
  }
  return out
}
