// ============================================================
//  學習儀表板 — 跨功能彙整核心（純函式 + 自家偏好持久化）
//  ------------------------------------------------------------
//  參考：Notion Home / Apple 健康摘要 — 可配置 widget、KPI + 趨勢、
//  今日聚焦環、活動時間線、跨功能 roll-up。
//
//  鐵則：唔掂任何共用檔。呢度只「讀」現有共用 col + 各功能自家 col，
//  自己一個 createCollection 存「儀表板偏好」（widget 開關 / 次序 / KPI 揀選）。
// ============================================================
import { createCollection, type Entity } from '../../../lib/store'
import type { Card } from '../../../data/types'
import type { Book } from '../reading/types'
import type { FocusLog, FocusProject } from '../focus/types'
import type { Habit, HabitLog } from '../habits/types'
import { isScheduledDay } from '../habits/types'
import type { GoalMeta, Milestone } from '../goals/types'
import type { Goal } from '../../../data/types'
import { computeProgress } from '../goals/util'
import type { JournalDoc } from '../journal/util'
import { moodScore } from '../journal/util'
import { isDue } from '../../../lib/srs'

// 日誌真實資料源 journalDocsCol 喺 ../journal/store（單一 canonical instance）；
// LearningDashboard 直接由嗰度 import，同其他功能 col 一致，唔再經呢度轉手。

// ───────── 日期工具（本地時區，避開 toISOString 時差）─────────
export const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'] as const

export function dayKey(d: Date): string {
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
export function todayKey(): string {
  return dayKey(new Date())
}
export function keyOf(iso: string): string {
  return dayKey(new Date(iso))
}
/** [from, to] 範圍內每一日嘅 key（由舊到新，含頭尾） */
export function rangeKeys(from: Date, to: Date): string[] {
  const out: string[] = []
  let cur = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 12)
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 12)
  while (cur <= end) {
    out.push(dayKey(cur))
    cur = addDays(cur, 1)
  }
  return out
}

export function greeting(): string {
  const h = new Date().getHours()
  if (h < 5) return '夜深啦'
  if (h < 12) return '早晨'
  if (h < 18) return '午安'
  return '晚安'
}

export function longToday(): string {
  const d = new Date()
  return `${d.getMonth() + 1}月${d.getDate()}日 · 星期${WEEKDAYS[d.getDay()]}`
}

export function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '啱啱'
  if (mins < 60) return `${mins} 分鐘前`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} 小時前`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days} 日前`
  const d = fromKey(iso.slice(0, 10))
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

export function fmtMin(min: number): string {
  const m = Math.round(min)
  if (m < 60) return `${m}分`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r ? `${h}時${r}分` : `${h}時`
}

// ───────── 連續活躍天數（任何學習動作）─────────
export function streakOf(activeKeys: Set<string>): number {
  let streak = 0
  let cur = new Date()
  if (!activeKeys.has(dayKey(cur))) cur = addDays(cur, -1)
  while (activeKeys.has(dayKey(cur))) {
    streak += 1
    cur = addDays(cur, -1)
  }
  return streak
}
export function longestStreakOf(activeKeys: Set<string>): number {
  const days = [...activeKeys].sort()
  if (!days.length) return 0
  let best = 1
  let run = 1
  for (let i = 1; i < days.length; i++) {
    const prev = fromKey(days[i - 1]).getTime()
    const cur = fromKey(days[i]).getTime()
    if (Math.round((cur - prev) / 864e5) === 1) run += 1
    else run = 1
    if (run > best) best = run
  }
  return best
}

// ───────── 趨勢（本週 vs 上週）─────────
export type TrendDir = 'up' | 'down' | 'flat'
export interface Trend {
  dir: TrendDir
  value: string
}
/** 由本期 / 上期數值砌出趨勢箭咀（給 StatCard.trend 用） */
export function trendOf(current: number, previous: number): Trend {
  if (previous === 0) {
    if (current === 0) return { dir: 'flat', value: '—' }
    return { dir: 'up', value: '新' }
  }
  const pct = Math.round(((current - previous) / previous) * 100)
  if (pct === 0) return { dir: 'flat', value: '0%' }
  return { dir: pct > 0 ? 'up' : 'down', value: `${pct > 0 ? '+' : ''}${pct}%` }
}

// ═══════════════════════════════════════════════════════════
//  彙整輸入（由 dashboard 主元件由各 col 餵入）
// ═══════════════════════════════════════════════════════════
export interface DashInput {
  cards: Card[]
  goals: Goal[]
  goalMeta: GoalMeta[]
  milestones: Milestone[]
  books: Book[]
  focusLogs: FocusLog[]
  focusProjects: FocusProject[]
  habits: Habit[]
  habitLogs: HabitLog[]
  journal: JournalDoc[]
}

// ───────── 每日活動分數（用嚟砌 sparkline / 熱圖）─────────
export interface DaySignal {
  key: string
  label: string // 1/5 之類
  weekday: number
  focusMin: number
  reviews: number
  habitsDone: number
  journaled: boolean
  /** 綜合活躍度（heat 用） */
  score: number
}

export function buildDaySignals(input: DashInput, days: number): DaySignal[] {
  const to = new Date()
  const from = addDays(to, -(days - 1))
  const keys = rangeKeys(from, to)

  const focusByDay = new Map<string, number>()
  for (const l of input.focusLogs) {
    if (l.kind !== 'focus' || !l.completed) continue
    const k = keyOf(l.startedAt)
    focusByDay.set(k, (focusByDay.get(k) ?? 0) + l.actualMin)
  }
  const reviewByDay = new Map<string, number>()
  for (const c of input.cards) {
    if (!c.lastReviewed) continue
    const k = keyOf(c.lastReviewed) // 本地日（與 focus / 習慣 / 日誌 一致；避 UTC 漂移）
    reviewByDay.set(k, (reviewByDay.get(k) ?? 0) + 1)
  }
  const habitByDay = new Map<string, number>()
  for (const l of input.habitLogs) {
    habitByDay.set(l.date, (habitByDay.get(l.date) ?? 0) + 1)
  }
  const journalDays = new Set(input.journal.map((j) => j.date))

  return keys.map((key) => {
    const d = fromKey(key)
    const focusMin = focusByDay.get(key) ?? 0
    const reviews = reviewByDay.get(key) ?? 0
    const habitsDone = habitByDay.get(key) ?? 0
    const journaled = journalDays.has(key)
    // 綜合分：focus(每25分=1) + reviews(每5=1) + habits + journal
    const score =
      focusMin / 25 + reviews / 5 + habitsDone + (journaled ? 1 : 0)
    return {
      key,
      label: `${d.getMonth() + 1}/${d.getDate()}`,
      weekday: d.getDay(),
      focusMin,
      reviews,
      habitsDone,
      journaled,
      score,
    }
  })
}

/** 全部活躍日期（streak 用） */
export function activeKeysOf(input: DashInput): Set<string> {
  const s = new Set<string>()
  for (const l of input.focusLogs)
    if (l.kind === 'focus' && l.completed) s.add(keyOf(l.startedAt))
  for (const c of input.cards) if (c.lastReviewed) s.add(keyOf(c.lastReviewed))
  for (const l of input.habitLogs) s.add(l.date)
  for (const j of input.journal) s.add(j.date)
  return s
}

// ───────── KPI（本期值 + 趨勢）─────────
export interface KpiData {
  dueCards: number
  streak: number
  longestStreak: number
  focusMinWeek: number
  focusMinPrevWeek: number
  reviewsWeek: number
  reviewsPrevWeek: number
  focusSessionsWeek: number
  habitRate: number // 今日完成率 0-100
  habitDoneToday: number
  habitDueToday: number
  goalsActive: number
  goalsAvgProgress: number
  booksReading: number
  pagesWeek: number
  journalWeek: number
  moodAvg: number | null // 近 7 日平均心情 1-5
  quizDays: number // 占位（quiz 由主元件另計）
}

function sumFocus(logs: FocusLog[], fromKeyStr: string, toKeyStr: string): { min: number; sessions: number } {
  let min = 0
  let sessions = 0
  for (const l of logs) {
    if (l.kind !== 'focus' || !l.completed) continue
    const k = keyOf(l.startedAt)
    if (k >= fromKeyStr && k <= toKeyStr) {
      min += l.actualMin
      sessions += 1
    }
  }
  return { min, sessions }
}
function countReviews(cards: Card[], fromKeyStr: string, toKeyStr: string): number {
  let n = 0
  for (const c of cards) {
    if (!c.lastReviewed) continue
    const k = keyOf(c.lastReviewed) // 本地日（與 focus 計法一致；避 UTC 漂移）
    if (k >= fromKeyStr && k <= toKeyStr) n += 1
  }
  return n
}

export function computeKpis(input: DashInput): KpiData {
  const today = todayKey()
  const week0 = dayKey(addDays(new Date(), -6))
  const prevWeekEnd = dayKey(addDays(new Date(), -7))
  const prevWeekStart = dayKey(addDays(new Date(), -13))

  const active = activeKeysOf(input)
  const f = sumFocus(input.focusLogs, week0, today)
  const fPrev = sumFocus(input.focusLogs, prevWeekStart, prevWeekEnd)

  // 今日習慣排程 + 完成
  const todayWeekday = new Date().getDay()
  const doneToday = new Set(
    input.habitLogs.filter((l) => l.date === today).map((l) => l.habitId),
  )
  const activeHabits = input.habits.filter((h) => !h.archived)
  const dueHabits = activeHabits.filter((h) => isScheduledDay(h.frequency, todayWeekday))
  const habitDoneToday = dueHabits.filter((h) => doneToday.has(h.id)).length

  // 目標：用里程碑加權進度
  const msByGoal = new Map<string, Milestone[]>()
  for (const m of input.milestones) {
    const arr = msByGoal.get(m.goalId)
    if (arr) arr.push(m)
    else msByGoal.set(m.goalId, [m])
  }
  const metaById = new Map(input.goalMeta.map((m) => [m.id, m]))
  const activeGoals = input.goals.filter((g) => {
    const meta = metaById.get(g.id)
    return !meta?.archived && meta?.status !== 'done'
  })
  const progresses = activeGoals.map((g) =>
    computeProgress(msByGoal.get(g.id) ?? [], g.progress),
  )
  const goalsAvg = progresses.length
    ? Math.round(progresses.reduce((s, p) => s + p, 0) / progresses.length)
    : 0

  // 閱讀：本週頁數
  let pagesWeek = 0
  for (const b of input.books)
    for (const s of b.sessions)
      if (s.date >= week0 && s.date <= today) pagesWeek += s.pages
  const booksReading = input.books.filter((b) => b.status === 'reading').length

  // 日誌：本週篇數 + 近 7 日平均心情
  const journalWeek = input.journal.filter((j) => j.date >= week0 && j.date <= today).length
  const moodScores: number[] = []
  for (const j of input.journal) {
    if (j.date >= week0 && j.date <= today) {
      const s = moodScore(j.mood)
      if (typeof s === 'number') moodScores.push(s)
    }
  }
  const moodAvg = moodScores.length
    ? Math.round((moodScores.reduce((s, x) => s + x, 0) / moodScores.length) * 10) / 10
    : null

  return {
    dueCards: input.cards.filter(isDue).length,
    streak: streakOf(active),
    longestStreak: longestStreakOf(active),
    focusMinWeek: f.min,
    focusMinPrevWeek: fPrev.min,
    reviewsWeek: countReviews(input.cards, week0, today),
    reviewsPrevWeek: countReviews(input.cards, prevWeekStart, prevWeekEnd),
    focusSessionsWeek: f.sessions,
    habitRate: dueHabits.length ? Math.round((habitDoneToday / dueHabits.length) * 100) : 0,
    habitDoneToday,
    habitDueToday: dueHabits.length,
    goalsActive: activeGoals.length,
    goalsAvgProgress: goalsAvg,
    booksReading,
    pagesWeek,
    journalWeek,
    moodAvg,
    quizDays: 0,
  }
}

// ───────── 活動時間線（最近跨功能事件）─────────
export type ActivityKind = 'focus' | 'review' | 'habit' | 'journal' | 'reading' | 'goal' | 'note'
export interface ActivityItem {
  id: string
  kind: ActivityKind
  text: string
  at: string // ISO（排序用）
  target: string // featureId
}

export function buildActivity(
  input: DashInput,
  noteEvents: { id: string; text: string; at: string }[],
  limit: number,
): ActivityItem[] {
  const out: ActivityItem[] = []
  const projName = new Map(input.focusProjects.map((p) => [p.id, p.name]))

  for (const l of input.focusLogs) {
    if (l.kind !== 'focus' || !l.completed) continue
    const tag = l.label || (l.projectId ? projName.get(l.projectId) : undefined)
    out.push({
      id: `f-${l.id}`,
      kind: 'focus',
      text: `專注 ${fmtMin(l.actualMin)}${tag ? ` · ${tag}` : ''}`,
      at: l.endedAt || l.startedAt,
      target: 'learning-focus',
    })
  }
  // 知識卡：用最後複習時間（每張一條，取近排）
  for (const c of input.cards) {
    if (!c.lastReviewed) continue
    out.push({
      id: `c-${c.id}`,
      kind: 'review',
      text: `複習咗一張卡：${truncate(c.front, 24)}`,
      // 統一用本地日正午（同習慣/日誌/書事件一致），避免 UTC instant 同
      // 本地正午字串混排令時間線次序錯亂（lastReviewed 由 srs.ts 寫 UTC）。
      at: `${keyOf(c.lastReviewed)}T12:00:00`,
      target: 'learning-flashcards',
    })
  }
  for (const l of input.habitLogs) {
    const h = input.habits.find((x) => x.id === l.habitId)
    out.push({
      id: `h-${l.id}`,
      kind: 'habit',
      text: `完成習慣${h ? `「${h.name}」` : ''}`,
      at: `${l.date}T12:00:00`,
      target: 'learning-habits',
    })
  }
  for (const j of input.journal) {
    out.push({
      id: `j-${j.id}`,
      kind: 'journal',
      text: `寫咗日誌${j.title ? `：${truncate(j.title, 24)}` : ''}`,
      at: j.updatedAt || j.createdAt || `${j.date}T12:00:00`,
      target: 'learning-journal',
    })
  }
  for (const b of input.books) {
    if (b.finishedOn)
      out.push({
        id: `b-done-${b.id}`,
        kind: 'reading',
        text: `讀完《${truncate(b.title, 20)}》`,
        at: `${b.finishedOn}T12:00:00`,
        target: 'learning-reading',
      })
  }
  for (const ev of noteEvents) {
    out.push({ id: `n-${ev.id}`, kind: 'note', text: ev.text, at: ev.at, target: 'learning-notes' })
  }

  return out
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
    .slice(0, limit)
}

export function truncate(s: string, n: number): string {
  const t = s.replace(/\s+/g, ' ').trim()
  return t.length > n ? `${t.slice(0, n)}…` : t
}

// ═══════════════════════════════════════════════════════════
//  Widget 配置 + 偏好持久化（Notion 式可配置首頁）
// ═══════════════════════════════════════════════════════════
export type WidgetId =
  | 'rings'
  | 'agenda'
  | 'goals'
  | 'habits'
  | 'reading'
  | 'activity'
  | 'mood'
  | 'quiz'
  | 'flashcards'
  | 'health'

export interface WidgetDef {
  id: WidgetId
  label: string
  desc: string
}

export const WIDGET_DEFS: WidgetDef[] = [
  { id: 'rings', label: '今日聚焦環', desc: '專注 · 複習 · 習慣 三環進度' },
  { id: 'agenda', label: '今日日程', desc: '行事曆事件 + 倒數' },
  { id: 'flashcards', label: '知識卡複習', desc: '到期卡 + 記憶曲線' },
  { id: 'goals', label: '個人目標', desc: '加權進度 + 到期' },
  { id: 'habits', label: '習慣打卡', desc: '今日應做習慣，一撳完成' },
  { id: 'health', label: '健康快照', desc: '飲水 · 睡眠 · 運動 · 心情' },
  { id: 'reading', label: '在讀書籍', desc: '進度 + 本週頁數' },
  { id: 'mood', label: '心情走勢', desc: '近 14 日日誌心情' },
  { id: 'quiz', label: '測驗表現', desc: '近期測驗準確率' },
  { id: 'activity', label: '活動時間線', desc: '跨功能最近動作' },
]

const WIDGET_LABEL = new Map(WIDGET_DEFS.map((w) => [w.id, w.label]))
export function widgetLabel(id: WidgetId): string {
  return WIDGET_LABEL.get(id) ?? id
}

export const DEFAULT_WIDGET_ORDER: WidgetId[] = [
  'rings',
  'agenda',
  'flashcards',
  'goals',
  'habits',
  'health',
  'reading',
  'mood',
  'quiz',
  'activity',
]

export type KpiId =
  | 'due'
  | 'streak'
  | 'focusWeek'
  | 'reviewsWeek'
  | 'habitRate'
  | 'goalsProgress'
  | 'pagesWeek'
  | 'journalWeek'

export interface KpiDef {
  id: KpiId
  label: string
}
export const KPI_DEFS: KpiDef[] = [
  { id: 'due', label: '今日要複習' },
  { id: 'streak', label: '連續學習' },
  { id: 'focusWeek', label: '本週專注' },
  { id: 'reviewsWeek', label: '本週複習' },
  { id: 'habitRate', label: '今日習慣' },
  { id: 'goalsProgress', label: '目標進度' },
  { id: 'pagesWeek', label: '本週閱讀' },
  { id: 'journalWeek', label: '本週日誌' },
]
export const DEFAULT_KPIS: KpiId[] = ['due', 'streak', 'focusWeek', 'habitRate']

/** 儀表板偏好（單一 record，id 固定） */
export interface DashPrefs extends Entity {
  hiddenWidgets: WidgetId[] // 隱藏咗嘅 widget
  widgetOrder: WidgetId[] // 顯示次序
  kpis: KpiId[] // KPI 卡（最多 4 個顯示）
  range: number // 趨勢圖天數（14 / 30 / 90）
  density: 'comfortable' | 'compact'
}

export const PREFS_ID = 'dash-prefs'
export const DEFAULT_PREFS: Omit<DashPrefs, 'id'> = {
  hiddenWidgets: [],
  widgetOrder: DEFAULT_WIDGET_ORDER,
  kpis: DEFAULT_KPIS,
  range: 30,
  density: 'comfortable',
}

export const dashPrefsCol = createCollection<DashPrefs>('learning_dashboard_prefs_v1', [
  { id: PREFS_ID, ...DEFAULT_PREFS },
])

/** 由 col 取回偏好（補齊缺失欄位，向後相容 + 過濾已失效 id） */
export function readPrefs(all: DashPrefs[]): DashPrefs {
  const raw = all.find((p) => p.id === PREFS_ID)
  const merged = { id: PREFS_ID, ...DEFAULT_PREFS, ...raw }
  // 確保 order 包含全部已知 widget（新加嘅排去尾），剔走未知 id
  const known = new Set(DEFAULT_WIDGET_ORDER)
  const order = merged.widgetOrder.filter((w) => known.has(w))
  for (const w of DEFAULT_WIDGET_ORDER) if (!order.includes(w)) order.push(w)
  merged.widgetOrder = order
  merged.hiddenWidgets = merged.hiddenWidgets.filter((w) => known.has(w))
  const knownKpi = new Set(KPI_DEFS.map((k) => k.id))
  merged.kpis = merged.kpis.filter((k) => knownKpi.has(k)).slice(0, 4)
  if (merged.kpis.length === 0) merged.kpis = DEFAULT_KPIS
  return merged
}

/** 可見 widget（依次序、剔走隱藏） */
export function visibleWidgets(prefs: DashPrefs): WidgetId[] {
  const hidden = new Set(prefs.hiddenWidgets)
  return prefs.widgetOrder.filter((w) => !hidden.has(w))
}
