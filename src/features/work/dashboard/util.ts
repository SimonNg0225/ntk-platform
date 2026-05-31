import type {
  Task,
  TimetableSlot,
  Klass,
  CalendarEvent,
  CalendarCategory,
  AttendanceRecord,
  Score,
  Assessment,
  ClassProgress,
  ParentComm,
  Countdown,
} from '../../../data/types'
import type { TaskMeta } from '../todo/types'
import { localDay } from '../todo/util'
import { getOccurrences, colorOf, minutesOf } from '../../shared/calendar/util'
import type {
  AgendaItem,
  ClassProgressRow,
  DayLoad,
  GradeBin,
  HeatCell,
  TrendPoint,
} from './types'

// ============================================================
//  工作儀表板：跨功能彙整（純函式，零 npm 依賴）
//  ------------------------------------------------------------
//  全部讀取共用 collection（唔改），計出 widget 用嘅 view model。
//  日期一律用「本地時區 YYYY-MM-DD」（同行事曆 / 待辦慣例一致）。
// ============================================================

export const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'] as const

export function localKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function addKey(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number)
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1)
  dt.setDate(dt.getDate() + n)
  return localKey(dt)
}

export function daysBetween(a: string, b: string): number {
  const pa = a.split('-').map(Number)
  const pb = b.split('-').map(Number)
  const da = new Date(pa[0], (pa[1] ?? 1) - 1, pa[2] ?? 1).getTime()
  const db = new Date(pb[0], (pb[1] ?? 1) - 1, pb[2] ?? 1).getTime()
  return Math.round((db - da) / 864e5)
}

export function greeting(hour: number): string {
  if (hour < 6) return '夜深了'
  if (hour < 12) return '早晨'
  if (hour < 18) return '午安'
  return '晚安'
}

// ───────── 待辦：合併 meta（到期 / 完成時間）─────────
export interface MergedTask {
  id: string
  text: string
  done: boolean
  createdAt: string
  due?: string
  priority: number
  completedAt?: string
}

export function mergeTasks(tasks: Task[], metas: TaskMeta[]): MergedTask[] {
  const byId = new Map(metas.map((m) => [m.id, m]))
  return tasks.map((t) => {
    const m = byId.get(t.id)
    return {
      id: t.id,
      text: t.text,
      done: t.done,
      createdAt: t.createdAt,
      due: m?.due,
      priority: m?.priority ?? 4,
      completedAt: m?.completedAt,
    }
  })
}

// ───────── 待辦完成趨勢（近 N 日）─────────
export function buildTaskTrend(tasks: MergedTask[], days: number): TrendPoint[] {
  const today = localKey(new Date())
  const out: TrendPoint[] = []
  for (let i = days - 1; i >= 0; i--) {
    const key = addKey(today, -i)
    const [, , d] = key.split('-')
    out.push({ key, label: String(Number(d)), created: 0, completed: 0 })
  }
  const idx = new Map(out.map((p, i) => [p.key, i]))
  for (const t of tasks) {
    const ck = localDay(t.createdAt)
    if (idx.has(ck)) out[idx.get(ck)!].created++
    if (t.done && t.completedAt) {
      const dk = localDay(t.completedAt)
      if (idx.has(dk)) out[idx.get(dk)!].completed++
    }
  }
  return out
}

// ───────── 完成熱力（近 N 日）+ streak ─────────
export function buildHeat(tasks: MergedTask[], days: number): HeatCell[] {
  const today = localKey(new Date())
  const counts = new Map<string, number>()
  for (const t of tasks) {
    if (t.done && t.completedAt) {
      const k = localDay(t.completedAt)
      counts.set(k, (counts.get(k) ?? 0) + 1)
    }
  }
  const cells: HeatCell[] = []
  for (let i = days - 1; i >= 0; i--) {
    const key = addKey(today, -i)
    cells.push({ key, count: counts.get(key) ?? 0 })
  }
  return cells
}

export function completionStreak(cells: HeatCell[]): number {
  let streak = 0
  for (let i = cells.length - 1; i >= 0; i--) {
    if (cells[i].count > 0) streak++
    else if (i === cells.length - 1) continue // 今日未做都唔斷
    else break
  }
  return streak
}

// 計某段日子內完成嘅待辦數（週對比用）
export function completedInRange(
  tasks: MergedTask[],
  startKey: string,
  endKey: string,
): number {
  let n = 0
  for (const t of tasks) {
    if (t.done && t.completedAt) {
      const k = localDay(t.completedAt)
      if (k >= startKey && k <= endKey) n++
    }
  }
  return n
}

// ───────── 今日課堂（時間表）─────────
export function todaySlots(
  timetable: TimetableSlot[],
  jsDay: number,
): TimetableSlot[] {
  return timetable
    .filter((s) => s.day === jsDay)
    .slice()
    .sort((a, b) => a.period - b.period)
}

// 概略把「第幾節」對應到時間（08:00 起，每節 1 小時）用嚟排序入議程
function periodToMinutes(period: number): number {
  return 8 * 60 + (period - 1) * 60
}

function periodTimeLabel(period: number): string {
  const start = periodToMinutes(period)
  const h = Math.floor(start / 60)
  const m = start % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// ───────── 今日議程（合併課堂 / 事件 / 到期待辦 / 倒數）─────────
export function buildAgenda(opts: {
  timetable: TimetableSlot[]
  classNameById: Map<string, string>
  events: CalendarEvent[]
  calendars: CalendarCategory[]
  tasks: MergedTask[]
  countdowns: Countdown[]
  todayKey: string
  jsDay: number
}): AgendaItem[] {
  const { timetable, classNameById, events, calendars, tasks, countdowns, todayKey, jsDay } = opts
  const items: AgendaItem[] = []

  // 課堂（星期日 jsDay=0 通常無）
  for (const s of todaySlots(timetable, jsDay)) {
    const label = s.classId ? classNameById.get(s.classId) ?? s.subject : s.subject
    items.push({
      id: `class-${s.id}`,
      kind: 'class',
      time: periodTimeLabel(s.period),
      sortKey: periodToMinutes(s.period),
      title: label,
      subtitle: `第 ${s.period} 節 · ${s.subject}`,
      colorClass: 'bg-accent',
      badge: s.room || undefined,
      navTo: 'work-timetable',
    })
  }

  // 行事曆事件（只計工作 / both，過濾隱藏行事曆）
  const occ = getOccurrences(events, calendars, todayKey, todayKey)
  for (const o of occ) {
    const ev = o.event
    if (ev.mode === 'learning') continue // 只顯示工作 / both / 未標
    const allDay = ev.allDay === true || !ev.time
    const c = colorOf(o.category?.color)
    items.push({
      id: `event-${ev.id}-${o.dateKey}`,
      kind: 'event',
      time: allDay ? undefined : ev.time,
      sortKey: allDay ? -1 : minutesOf(ev.time),
      title: ev.title,
      subtitle: ev.location || o.category?.name || ev.type || undefined,
      colorClass: c.dot,
      badge: allDay ? '全日' : undefined,
      navTo: 'calendar',
    })
  }

  // 今日到期 / 逾期未完成待辦
  for (const t of tasks) {
    if (t.done || !t.due) continue
    if (t.due > todayKey) continue // 只列今日及之前（逾期）
    const overdue = t.due < todayKey
    items.push({
      id: `task-${t.id}`,
      kind: 'task',
      time: undefined,
      sortKey: overdue ? -2 : 999, // 逾期置頂、今日到期置尾（時間未定）
      title: t.text,
      subtitle: overdue ? `逾期 ${daysBetween(t.due, todayKey)} 日` : '今日到期',
      colorClass: overdue ? 'bg-rose-500' : 'bg-amber-500',
      overdue,
      taskId: t.id,
      navTo: 'work-tasks',
    })
  }

  // 今日嘅倒數（work / both）
  for (const cd of countdowns) {
    if (cd.mode === 'learning') continue
    if (cd.date !== todayKey) continue
    items.push({
      id: `cd-${cd.id}`,
      kind: 'countdown',
      time: cd.time,
      sortKey: cd.time ? minutesOf(cd.time) : -1,
      title: cd.title,
      subtitle: '重要日子',
      colorClass: 'bg-violet-500',
      badge: '今日',
      navTo: 'countdown',
    })
  }

  items.sort((a, b) => a.sortKey - b.sortKey || a.title.localeCompare(b.title))
  return items
}

// ───────── 各班課程進度 ─────────
export function buildClassProgress(
  classes: Klass[],
  progress: ClassProgress[],
  totalTopics: number,
): ClassProgressRow[] {
  return classes.map((k) => {
    const rows = progress.filter((p) => p.classId === k.id)
    const done = rows.filter((p) => p.status === 'done').length
    const inProgress = rows.filter((p) => p.status === 'in_progress').length
    const total = totalTopics || rows.length
    // done 可能多過 total（刪咗 topic 但 progress 列殘留）→ clamp，避免顯示 5/3（167%）
    const doneCapped = Math.min(done, total)
    const percent = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0
    return { id: k.id, name: k.name, done: doneCapped, inProgress, total, percent }
  })
}

// 整體課程完成百分比（所有班平均）
export function overallProgressPercent(rows: ClassProgressRow[]): number {
  if (rows.length === 0) return 0
  const sum = rows.reduce((s, r) => s + r.percent, 0)
  return Math.round(sum / rows.length)
}

// ───────── 出席率（近 N 日整體）─────────
export interface AttendanceSummary {
  present: number
  late: number
  absent: number
  total: number
  rate: number // present+late 視為到（出席率 %）
}

export function buildAttendance(
  records: AttendanceRecord[],
  sinceKey: string,
): AttendanceSummary {
  let present = 0
  let late = 0
  let absent = 0
  for (const r of records) {
    if (r.date < sinceKey) continue
    if (r.status === 'present') present++
    else if (r.status === 'late') late++
    else absent++
  }
  const total = present + late + absent
  const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0
  return { present, late, absent, total, rate }
}

// ───────── 成績分布（最近一次評估，分數區間直方圖）─────────
export interface GradeSummary {
  assessment?: Assessment
  bins: GradeBin[]
  average: number // 百分比
  graded: number
  max: number
}

export function buildGradeSummary(
  assessments: Assessment[],
  scores: Score[],
): GradeSummary {
  // 揀最近（有日期者按日期；否則 createdAt）有成績嘅評估
  const withScores = assessments.filter((a) =>
    scores.some((s) => s.assessmentId === a.id && s.score != null),
  )
  if (withScores.length === 0) {
    return { bins: emptyBins(), average: 0, graded: 0, max: 0 }
  }
  // 統一做日 key（10 字）再比較：避免裸 date '2026-05-10' 同 ISO createdAt
  // '2026-05-10T08:00…' 因長度唔同而字典序錯位（同曆日下誤選只有 createdAt 嗰份）
  const dayKey = (a: Assessment) => (a.date ?? a.createdAt).slice(0, 10)
  const latest = withScores
    .slice()
    .sort((a, b) => dayKey(b).localeCompare(dayKey(a)))[0]
  const rows = scores.filter(
    (s) => s.assessmentId === latest.id && s.score != null,
  )
  const max = latest.maxScore || 100
  const bins = emptyBins()
  let sumPct = 0
  for (const s of rows) {
    const pct = Math.max(0, Math.min(100, ((s.score as number) / max) * 100))
    sumPct += pct
    const bi = pct >= 100 ? 4 : Math.min(4, Math.floor(pct / 20))
    bins[bi].count++
  }
  const average = rows.length > 0 ? Math.round(sumPct / rows.length) : 0
  return { assessment: latest, bins, average, graded: rows.length, max }
}

function emptyBins(): GradeBin[] {
  return [
    { label: '0–19', count: 0 },
    { label: '20–39', count: 0 },
    { label: '40–59', count: 0 },
    { label: '60–79', count: 0 },
    { label: '80–100', count: 0 },
  ]
}

// ───────── 本週課擔（每日節數）─────────
export function buildWeekLoad(
  timetable: TimetableSlot[],
  jsDay: number,
): DayLoad[] {
  const counts = new Map<number, number>()
  for (const s of timetable) counts.set(s.day, (counts.get(s.day) ?? 0) + 1)
  // 顯示一～六（教學日；忽略日）
  const out: DayLoad[] = []
  for (let d = 1; d <= 6; d++) {
    out.push({
      day: d,
      label: WEEKDAY_LABELS[d],
      periods: counts.get(d) ?? 0,
      isToday: d === jsDay,
    })
  }
  return out
}

// ───────── 待跟進家長（按班分組）─────────
export interface FollowUpRow {
  comm: ParentComm
  className: string
}

export function buildFollowUps(
  comms: ParentComm[],
  classNameById: Map<string, string>,
): FollowUpRow[] {
  return comms
    .filter((c) => c.followUp === true)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((c) => ({ comm: c, className: classNameById.get(c.classId) ?? '—' }))
}

// ───────── 倒數（work / both，未過期，最近排前）─────────
export interface CountdownRow {
  cd: Countdown
  daysLeft: number
}

export function buildCountdowns(
  countdowns: Countdown[],
  todayKey: string,
): CountdownRow[] {
  return countdowns
    .filter((c) => c.mode !== 'learning')
    .map((c) => ({ cd: c, daysLeft: daysBetween(todayKey, c.date) }))
    .filter((r) => r.daysLeft >= 0)
    .sort((a, b) => a.daysLeft - b.daysLeft)
}

// ───────── 倒數分類 meta ─────────
export const COUNTDOWN_META: Record<
  string,
  { label: string; tone: 'rose' | 'amber' | 'blue' | 'green' | 'slate' }
> = {
  exam: { label: '考試', tone: 'rose' },
  deadline: { label: '死線', tone: 'amber' },
  assessment: { label: '評估', tone: 'blue' },
  event: { label: '活動', tone: 'green' },
  other: { label: '其他', tone: 'slate' },
}
