import { useMemo } from 'react'
import {
  Brain,
  Target,
  Flame,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Circle,
  ChevronRight,
  Timer,
  NotebookPen,
  ListChecks,
  Hourglass,
  Smile,
  Sparkles,
  TrendingUp,
  Clock,
  MapPin,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Badge, Card, EmptyState, ProgressBar, SectionTitle, cx } from '../../../ui'
import { ActivityRings, WeekBars, MoodTrend, MiniRing, ActivityDot, type RingSpec } from './charts'
import {
  fmtMin,
  relTime,
  truncate,
  todayKey,
  dayKey,
  addDays,
  WEEKDAYS,
  type DashInput,
  type KpiData,
  type DaySignal,
  type ActivityItem,
  type ActivityKind,
} from './util'
import { computeProgress, catMeta, daysUntil } from '../goals/util'
import { isScheduledDay, colorOf as habitColorOf } from '../habits/types'
import { moodDef, moodScore } from '../journal/util'
import type { Milestone, GoalMeta } from '../goals/types'
import type { Goal, CalendarEvent, CalendarCategory, Countdown, QuizAttempt } from '../../../data/types'
import {
  getOccurrences,
  indexByDate,
  isAllDay,
  colorOf as calColorOf,
} from '../../shared/calendar/util'

// ============================================================
//  儀表板各 widget（自給自足卡片）
//  共用 props 由主元件餵入；每個 widget 標題右上可跳對應功能。
// ============================================================

type Open = (id: string) => void

/** 最後一節閱讀日期（無 Array.at，相容低 target lib） */
function lastSessionDate(b: { sessions: { date: string }[] }): string {
  const ss = b.sessions
  return ss.length ? ss[ss.length - 1].date : ''
}

function GoLink({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-0.5 text-xs text-accent transition hover:underline"
    >
      {label}
      <ChevronRight size={13} />
    </button>
  )
}

// ───────── 今日聚焦三環 ─────────
export function RingsWidget({
  kpis,
  signals,
  focusGoalMin,
  open,
}: {
  kpis: KpiData
  signals: DaySignal[]
  focusGoalMin: number
  open: Open
}) {
  const today = signals.length ? signals[signals.length - 1] : undefined
  const reviewGoal = Math.max(10, kpis.dueCards || 10)
  const rings: RingSpec[] = [
    {
      label: '專注',
      value: today?.focusMin ?? 0,
      goal: focusGoalMin,
      unit: '分',
      stroke: 'stroke-accent',
      text: 'text-accent-strong dark:text-accent',
    },
    {
      label: '複習',
      value: today?.reviews ?? 0,
      goal: reviewGoal,
      unit: '張',
      stroke: 'stroke-emerald-500',
      text: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      label: '習慣',
      value: kpis.habitDoneToday,
      goal: Math.max(1, kpis.habitDueToday),
      unit: '個',
      stroke: 'stroke-amber-500',
      text: 'text-amber-600 dark:text-amber-400',
    },
  ]
  return (
    <Card className="p-4">
      <SectionTitle
        icon={Sparkles}
        right={<GoLink onClick={() => open('learning-focus')} label="專注" />}
      >
        今日聚焦
      </SectionTitle>
      <ActivityRings rings={rings} />
    </Card>
  )
}

// ───────── 本週專注趨勢 + 數字 ─────────
export function FocusWeekWidget({ kpis, signals }: { kpis: KpiData; signals: DaySignal[] }) {
  return (
    <Card className="p-4">
      <SectionTitle icon={Timer}>本週專注</SectionTitle>
      <div className="mb-3 flex items-baseline gap-3">
        <span className="text-2xl font-bold tabular-nums text-slate-800 dark:text-slate-100">
          {fmtMin(kpis.focusMinWeek)}
        </span>
        <span className="text-xs text-slate-400">
          {kpis.focusSessionsWeek} 節 · 平均{' '}
          {kpis.focusSessionsWeek ? fmtMin(kpis.focusMinWeek / kpis.focusSessionsWeek) : '—'}
        </span>
      </div>
      <WeekBars signals={signals} />
    </Card>
  )
}

// ───────── 知識卡複習 ─────────
export function FlashcardsWidget({ input, kpis, open }: { input: DashInput; kpis: KpiData; open: Open }) {
  const total = input.cards.length
  const mature = input.cards.filter((c) => c.intervalDays >= 21).length
  const young = input.cards.filter((c) => c.intervalDays > 0 && c.intervalDays < 21).length
  const fresh = total - mature - young
  const matureRate = total ? Math.round((mature / total) * 100) : 0
  return (
    <Card className="p-4">
      <SectionTitle icon={Brain} right={<GoLink onClick={() => open('learning-flashcards')} label="複習" />}>
        知識卡
      </SectionTitle>
      {total === 0 ? (
        <EmptyState icon={Brain} title="仲未有知識卡" hint="生成或新增知識卡，開始間隔重複。" />
      ) : (
        <div className="flex items-center gap-4">
          <MiniRing value={total ? ((total - kpis.dueCards) / total) * 100 : 0} size={68} stroke={7}>
            <div className="text-center leading-none">
              <div className="text-base font-bold tabular-nums text-accent-strong dark:text-accent">
                {kpis.dueCards}
              </div>
              <div className="text-[9px] text-slate-400">到期</div>
            </div>
          </MiniRing>
          <div className="flex-1 space-y-1.5">
            <CardStat label="記熟（&ge;21日）" value={mature} tone="bg-emerald-500" />
            <CardStat label="複習中" value={young} tone="bg-accent" />
            <CardStat label="新卡 / 學習" value={fresh} tone="bg-blue-500" />
            <p className="pt-0.5 text-[11px] text-slate-400">
              記熟率 <span className="font-semibold tabular-nums text-slate-600 dark:text-slate-300">{matureRate}%</span> · 共{' '}
              {total} 張
            </p>
          </div>
        </div>
      )}
    </Card>
  )
}
function CardStat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={cx('h-2 w-2 rounded-sm', tone)} />
      <span className="text-slate-600 dark:text-slate-300">{label}</span>
      <span className="ml-auto font-semibold tabular-nums text-slate-700 dark:text-slate-200">{value}</span>
    </div>
  )
}

// ───────── 今日日程（行事曆 occurrence + 倒數）─────────
export function AgendaWidget({
  events,
  calendars,
  countdowns,
  open,
}: {
  events: CalendarEvent[]
  calendars: CalendarCategory[]
  countdowns: Countdown[]
  open: Open
}) {
  const today = todayKey()
  const in7 = dayKey(addDays(new Date(), 7))
  const todays = useMemo(() => {
    const occ = getOccurrences(events, calendars, today, today)
    return indexByDate(occ).get(today) ?? []
  }, [events, calendars, today])

  // 7 日內倒數（learning / both）
  const cds = useMemo(
    () =>
      countdowns
        .filter((c) => (!c.mode || c.mode === 'learning' || c.mode === 'both') && c.date >= today && c.date <= in7)
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 3),
    [countdowns, today, in7],
  )

  const empty = todays.length === 0 && cds.length === 0
  return (
    <Card className="p-4">
      <SectionTitle icon={CalendarDays} right={<GoLink onClick={() => open('calendar')} label="行事曆" />}>
        今日日程
      </SectionTitle>
      {empty ? (
        <EmptyState icon={CalendarDays} title="今日無安排" hint="行事曆冇事件，倒數亦未到。輕鬆一日。" />
      ) : (
        <div className="space-y-3">
          {todays.length > 0 && (
            <ul className="space-y-1.5">
              {todays.slice(0, 5).map((o) => {
                const col = calColorOf(o.category?.color)
                return (
                  <li key={`${o.event.id}-${o.dateKey}`} className="flex items-center gap-2 text-sm">
                    <span className={cx('h-2 w-2 shrink-0 rounded-full', col.dot)} />
                    <span className="w-12 shrink-0 text-xs tabular-nums text-slate-400">
                      {isAllDay(o.event) ? '全日' : o.event.time}
                    </span>
                    <span className="truncate text-slate-700 dark:text-slate-200">{o.event.title}</span>
                    {o.event.location && (
                      <span className="ml-auto hidden items-center gap-0.5 text-[11px] text-slate-400 sm:flex">
                        <MapPin size={11} />
                        {truncate(o.event.location, 12)}
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
          {cds.length > 0 && (
            <div className="space-y-1.5 border-t border-slate-100 pt-2 dark:border-slate-800">
              {cds.map((c) => {
                const d = daysUntil(c.date) ?? 0
                return (
                  <button
                    key={c.id}
                    onClick={() => open('countdown')}
                    className="flex w-full items-center gap-2 rounded-lg px-1 py-0.5 text-left text-sm transition hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    <Hourglass size={14} className="shrink-0 text-amber-500" />
                    <span className="truncate text-slate-700 dark:text-slate-200">{c.title}</span>
                    <Badge tone={d <= 3 ? 'rose' : d <= 7 ? 'amber' : 'slate'} className="ml-auto shrink-0">
                      {d === 0 ? '今日' : `${d} 日`}
                    </Badge>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

// ───────── 學習目標（加權進度 + 到期）─────────
export function GoalsWidget({
  goals,
  goalMeta,
  milestones,
  open,
}: {
  goals: Goal[]
  goalMeta: GoalMeta[]
  milestones: Milestone[]
  open: Open
}) {
  const metaById = useMemo(() => new Map(goalMeta.map((m) => [m.id, m])), [goalMeta])
  const msByGoal = useMemo(() => {
    const m = new Map<string, Milestone[]>()
    for (const x of milestones) {
      const arr = m.get(x.goalId)
      if (arr) arr.push(x)
      else m.set(x.goalId, [x])
    }
    return m
  }, [milestones])

  const rows = useMemo(() => {
    return goals
      .map((g) => {
        const meta = metaById.get(g.id)
        const ms = msByGoal.get(g.id) ?? []
        return {
          goal: g,
          meta,
          progress: computeProgress(ms, g.progress),
          done: ms.filter((x) => x.done).length,
          total: ms.length,
          archived: meta?.archived || meta?.status === 'done',
        }
      })
      .filter((r) => !r.archived)
      .sort((a, b) => {
        // 近到期排前；其餘按進度
        const da = daysUntil(a.meta?.targetDate)
        const db = daysUntil(b.meta?.targetDate)
        if (da != null && db != null) return da - db
        if (da != null) return -1
        if (db != null) return 1
        return a.progress - b.progress
      })
      .slice(0, 4)
  }, [goals, metaById, msByGoal])

  return (
    <Card className="p-4">
      <SectionTitle icon={Target} right={<GoLink onClick={() => open('learning-goals')} label="管理" />}>
        個人目標
      </SectionTitle>
      {rows.length === 0 ? (
        <EmptyState icon={Target} title="仲未有目標" hint="設定個人目標，追蹤每一步進度。" />
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const cat = catMeta(r.meta?.category)
            const d = daysUntil(r.meta?.targetDate)
            const tone =
              r.progress >= 100 ? 'green' : r.progress >= 50 ? 'accent' : r.progress >= 25 ? 'amber' : 'rose'
            return (
              <li key={r.goal.id}>
                <div className="mb-1 flex items-center gap-2">
                  <cat.icon size={14} className={cat.text} />
                  <span className="truncate text-sm text-slate-700 dark:text-slate-200">{r.goal.title}</span>
                  {d != null && (
                    <Badge tone={d < 0 ? 'rose' : d <= 7 ? 'amber' : 'slate'} className="ml-auto shrink-0">
                      {d < 0 ? `逾期${Math.abs(d)}日` : d === 0 ? '今日' : `${d}日`}
                    </Badge>
                  )}
                  <span className={cx('flex-none text-xs font-bold tabular-nums', d == null ? 'ml-auto' : '', cat.text)}>
                    {r.progress}%
                  </span>
                </div>
                <ProgressBar value={r.progress} tone={tone} size="sm" />
                {r.total > 0 && (
                  <p className="mt-0.5 text-[11px] tabular-nums text-slate-400">
                    里程碑 {r.done}/{r.total}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

// ───────── 習慣打卡（今日應做，一撳完成）─────────
export function HabitsTodayWidget({
  habits,
  habitLogs,
  onToggle,
  open,
}: {
  habits: DashInput['habits']
  habitLogs: DashInput['habitLogs']
  onToggle: (habitId: string, done: boolean) => void
  open: Open
}) {
  const today = todayKey()
  const weekday = new Date().getDay()
  const doneSet = useMemo(
    () => new Set(habitLogs.filter((l) => l.date === today).map((l) => l.habitId)),
    [habitLogs, today],
  )
  const due = useMemo(
    () =>
      habits
        .filter((h) => !h.archived && isScheduledDay(h.frequency, weekday))
        .sort((a, b) => a.order - b.order),
    [habits, weekday],
  )
  const doneCount = due.filter((h) => doneSet.has(h.id)).length

  return (
    <Card className="p-4">
      <SectionTitle
        icon={Flame}
        right={
          <span className="text-xs tabular-nums text-slate-400">
            {doneCount}/{due.length} ·{' '}
            <button onClick={() => open('learning-habits')} className="text-accent hover:underline">
              全部
            </button>
          </span>
        }
      >
        今日習慣
      </SectionTitle>
      {due.length === 0 ? (
        <EmptyState icon={Flame} title="今日無習慣" hint="設定每日習慣，建立生活節奏。" />
      ) : (
        <ul className="space-y-1">
          {due.slice(0, 6).map((h) => {
            const done = doneSet.has(h.id)
            const spec = habitColorOf(h.color)
            return (
              <li key={h.id}>
                <button
                  type="button"
                  onClick={() => onToggle(h.id, !done)}
                  aria-pressed={done}
                  className={cx(
                    'flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left text-sm transition',
                    'hover:bg-slate-50 dark:hover:bg-slate-800/50',
                  )}
                >
                  <span
                    className={cx(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition',
                      done ? spec.solid : 'border border-slate-300 text-transparent dark:border-slate-600',
                    )}
                  >
                    {done ? <CheckCircle2 size={15} /> : <Circle size={0} />}
                  </span>
                  <span className="text-base leading-none">{h.icon ?? '•'}</span>
                  <span
                    className={cx(
                      'truncate',
                      done ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-200',
                    )}
                  >
                    {h.name}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

// ───────── 在讀書籍（進度條 + 本週頁數）─────────
export function ReadingWidget({ input, kpis, open }: { input: DashInput; kpis: KpiData; open: Open }) {
  const reading = useMemo(
    () =>
      input.books
        .filter((b) => b.status === 'reading')
        .sort((a, b) => lastSessionDate(b).localeCompare(lastSessionDate(a)))
        .slice(0, 3),
    [input.books],
  )
  return (
    <Card className="p-4">
      <SectionTitle icon={BookOpen} right={<GoLink onClick={() => open('learning-reading')} label="書架" />}>
        在讀書籍
      </SectionTitle>
      {reading.length === 0 ? (
        <EmptyState icon={BookOpen} title="而家無讀緊嘅書" hint="加本書入閱讀清單，開始閱讀之旅。" />
      ) : (
        <>
          <ul className="space-y-3">
            {reading.map((b) => {
              const pct =
                b.totalPages && b.currentPage ? Math.min(100, Math.round((b.currentPage / b.totalPages) * 100)) : 0
              return (
                <li key={b.id}>
                  <div className="mb-1 flex items-center gap-2">
                    <span className="truncate text-sm text-slate-700 dark:text-slate-200">{b.title}</span>
                    {b.author && <span className="shrink-0 text-[11px] text-slate-400">· {truncate(b.author, 10)}</span>}
                    {b.totalPages ? (
                      <span className="ml-auto shrink-0 text-xs font-semibold tabular-nums text-accent">{pct}%</span>
                    ) : null}
                  </div>
                  {b.totalPages ? (
                    <>
                      <ProgressBar value={pct} size="sm" />
                      <p className="mt-0.5 text-[11px] tabular-nums text-slate-400">
                        {b.currentPage ?? 0} / {b.totalPages} 頁
                      </p>
                    </>
                  ) : (
                    <p className="text-[11px] text-slate-400">未設總頁數</p>
                  )}
                </li>
              )
            })}
          </ul>
          {kpis.pagesWeek > 0 && (
            <p className="mt-3 border-t border-slate-100 pt-2 text-[11px] text-slate-400 dark:border-slate-800">
              本週已讀 <span className="font-semibold tabular-nums text-slate-600 dark:text-slate-300">{kpis.pagesWeek}</span> 頁
            </p>
          )}
        </>
      )}
    </Card>
  )
}

// ───────── 心情走勢（近 14 日日誌）─────────
export function MoodWidget({ input, open }: { input: DashInput; open: Open }) {
  const points = useMemo(() => {
    const byDate = new Map(input.journal.map((j) => [j.date, j]))
    const out: { key: string; label: string; score: number | null; emoji?: string }[] = []
    for (let i = 13; i >= 0; i--) {
      const d = addDays(new Date(), -i)
      const key = dayKey(d)
      const j = byDate.get(key)
      const s = j ? moodScore(j.mood) ?? null : null
      out.push({ key, label: `${d.getMonth() + 1}/${d.getDate()}`, score: s, emoji: j?.mood })
    }
    return out
  }, [input.journal])

  const recentMood = useMemo(() => {
    const withMood = input.journal
      .filter((j) => j.mood)
      .sort((a, b) => b.date.localeCompare(a.date))[0]
    return withMood ? moodDef(withMood.mood) : undefined
  }, [input.journal])

  const hasData = points.some((p) => p.score != null)
  return (
    <Card className="p-4">
      <SectionTitle icon={Smile} right={<GoLink onClick={() => open('learning-journal')} label="日誌" />}>
        心情走勢
      </SectionTitle>
      {!hasData ? (
        <EmptyState icon={Smile} title="仲未有心情記錄" hint="寫日誌時揀返心情，呢度自動成圖。" />
      ) : (
        <>
          {recentMood && (
            <div className="mb-2 flex items-center gap-2">
              <span className="text-2xl leading-none">{recentMood.emoji}</span>
              <span className={cx('text-sm font-medium', recentMood.text)}>近期：{recentMood.label}</span>
            </div>
          )}
          <MoodTrend points={points} />
        </>
      )}
    </Card>
  )
}

// ───────── 測驗表現（近期準確率 + 弱項）─────────
export function QuizWidget({ attempts, open }: { attempts: QuizAttempt[]; open: Open }) {
  const learning = useMemo(
    () => attempts.filter((a) => a.mode === 'learning').sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [attempts],
  )
  const recent = learning.slice(0, 5)
  const stats = useMemo(() => {
    if (learning.length === 0) return null
    const last10 = learning.slice(0, 10)
    const totalQ = last10.reduce((s, a) => s + a.total, 0)
    const correct = last10.reduce((s, a) => s + a.correctCount, 0)
    const acc = totalQ ? Math.round((correct / totalQ) * 100) : 0
    return { acc, totalQ, attempts: learning.length }
  }, [learning])

  return (
    <Card className="p-4">
      <SectionTitle icon={ListChecks} right={<GoLink onClick={() => open('quiz')} label="測驗" />}>
        測驗表現
      </SectionTitle>
      {!stats ? (
        <EmptyState icon={ListChecks} title="仲未做過測驗" hint="由題庫抽 MC 即時測驗，呢度睇返表現。" />
      ) : (
        <div className="flex items-center gap-4">
          <MiniRing value={stats.acc} size={68} stroke={7} tone={stats.acc >= 70 ? 'green' : stats.acc >= 50 ? 'amber' : 'rose'}>
            <div className="text-center leading-none">
              <div className="text-base font-bold tabular-nums text-slate-700 dark:text-slate-200">{stats.acc}%</div>
              <div className="text-[9px] text-slate-400">準確率</div>
            </div>
          </MiniRing>
          <ul className="flex-1 space-y-1">
            {recent.slice(0, 3).map((a) => {
              const acc = a.total ? Math.round((a.correctCount / a.total) * 100) : 0
              return (
                <li key={a.id} className="flex items-center gap-2 text-xs">
                  <span className="truncate text-slate-600 dark:text-slate-300">{truncate(a.title, 16)}</span>
                  <span className="ml-auto shrink-0 tabular-nums text-slate-400">
                    {a.correctCount}/{a.total}
                  </span>
                  <Badge tone={acc >= 70 ? 'green' : acc >= 50 ? 'amber' : 'rose'} className="shrink-0">
                    {acc}%
                  </Badge>
                </li>
              )
            })}
            <li className="pt-0.5 text-[11px] text-slate-400">共做 {stats.attempts} 份</li>
          </ul>
        </div>
      )}
    </Card>
  )
}

// ───────── 活動時間線（跨功能最近動作）─────────
const ACT_META: Record<ActivityKind, { icon: LucideIcon; dot: string }> = {
  focus: { icon: Timer, dot: 'bg-accent' },
  review: { icon: Brain, dot: 'bg-emerald-500' },
  habit: { icon: Flame, dot: 'bg-amber-500' },
  journal: { icon: NotebookPen, dot: 'bg-violet-500' },
  reading: { icon: BookOpen, dot: 'bg-cyan-500' },
  goal: { icon: Target, dot: 'bg-rose-500' },
  note: { icon: NotebookPen, dot: 'bg-blue-500' },
}

export function ActivityWidget({ items, open }: { items: ActivityItem[]; open: Open }) {
  return (
    <Card className="p-4">
      <SectionTitle icon={TrendingUp}>最近活動</SectionTitle>
      {items.length === 0 ? (
        <EmptyState icon={Clock} title="仲未有活動" hint="開始記錄，呢度會記低你嘅每一步。" />
      ) : (
        <ul className="space-y-2.5">
          {items.map((it) => {
            const meta = ACT_META[it.kind]
            return (
              <li key={it.id}>
                <button
                  onClick={() => open(it.target)}
                  className="flex w-full items-start gap-2.5 rounded-lg px-1 py-0.5 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  <ActivityDot className={meta.dot} />
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-700 dark:text-slate-200">{it.text}</span>
                  <span className="shrink-0 text-[11px] tabular-nums text-slate-400">{relTime(it.at)}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

// 對外導出（主元件 weekday 標籤共用）
export { WEEKDAYS }
