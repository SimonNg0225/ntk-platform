import { useMemo } from 'react'
import { Card, SectionTitle, EmptyState, StatCard, cx } from '../../../ui'
import { BarChart3, Flame, CalendarCheck, TrendingUp, Activity, Lightbulb, ThumbsUp, ThumbsDown } from 'lucide-react'
import { colorOf, type Habit } from './types'
import {
  bestStreak,
  currentStreak,
  rateOverDays,
  recentDays,
  weekdayOf,
  toKey,
  addDays,
  weekdayInsights,
  WEEKDAY_LABELS,
  MONTH_LABELS,
  type WeekdayInsights,
} from './util'

// ============================================================
//  統計分析視圖 — 全部圖表用 SVG / div 自製，零依賴
//  ① 30 日整體完成趨勢（面積折線）
//  ② 逐星期幾完成率（長條）
//  ③ 近 12 週每週完成次數（長條）
//  ④ 逐習慣完成率排行（水平條）
// ============================================================

export default function StatsView({
  habits,
  byHabit,
}: {
  habits: Habit[]
  byHabit: Map<string, Set<string>>
}) {
  // ─── 整體：今日 / 過去 30 日各日完成率 ───
  const trend30 = useMemo(() => {
    const days = recentDays(30)
    return days.map((k) => {
      const wd = weekdayOf(k)
      let due = 0
      let done = 0
      for (const h of habits) {
        if (h.frequency.kind === 'weekdays' && !h.frequency.days.includes(wd)) continue
        due += 1
        if ((byHabit.get(h.id) ?? new Set()).has(k)) done += 1
      }
      return { key: k, rate: due > 0 ? done / due : 0, due, done }
    })
  }, [habits, byHabit])

  // ─── 逐星期幾平均完成率（過去 12 週）───
  const byWeekday = useMemo(() => {
    const days = recentDays(84)
    const acc = Array.from({ length: 7 }, () => ({ due: 0, done: 0 }))
    for (const k of days) {
      const wd = weekdayOf(k)
      for (const h of habits) {
        if (h.frequency.kind === 'weekdays' && !h.frequency.days.includes(wd)) continue
        acc[wd].due += 1
        if ((byHabit.get(h.id) ?? new Set()).has(k)) acc[wd].done += 1
      }
    }
    return acc.map((a, i) => ({
      label: WEEKDAY_LABELS[i],
      rate: a.due > 0 ? a.done / a.due : 0,
    }))
  }, [habits, byHabit])

  // ─── 星期分佈洞察（最易堅持／最易甩底 + 逐習慣最常完成日）───
  // 與上面星期長條圖同窗口（84 日 = 12 週），淨係加總結 + 排行。
  const insights = useMemo(() => weekdayInsights(habits, byHabit), [habits, byHabit])

  // ─── 近 12 週每週完成總次數 ───
  const weekly = useMemo(() => {
    const today = new Date()
    const out: { label: string; count: number }[] = []
    for (let w = 11; w >= 0; w -= 1) {
      const end = addDays(today, -w * 7)
      const start = addDays(end, -6)
      let count = 0
      for (let i = 0; i < 7; i += 1) {
        const k = toKey(addDays(start, i))
        for (const h of habits) {
          if ((byHabit.get(h.id) ?? new Set()).has(k)) count += 1
        }
      }
      const m = end.getMonth()
      out.push({ label: `${MONTH_LABELS[m].replace('月', '')}/${end.getDate()}`, count })
    }
    return out
  }, [habits, byHabit])

  // ─── 逐習慣完成率排行 ───
  const ranking = useMemo(() => {
    return habits
      .map((h) => {
        const done = byHabit.get(h.id) ?? new Set<string>()
        return {
          habit: h,
          rate: rateOverDays(done, h.frequency, 30),
          cur: currentStreak(done, h.frequency),
          best: bestStreak(done, h.frequency),
          total: done.size,
        }
      })
      .sort((a, b) => b.rate - a.rate)
  }, [habits, byHabit])

  // ─── 摘要數字 ───
  const summary = useMemo(() => {
    const totalDone = ranking.reduce((s, r) => s + r.total, 0)
    const avg30 =
      ranking.length > 0
        ? Math.round(ranking.reduce((s, r) => s + r.rate, 0) / ranking.length)
        : 0
    const topBest = ranking.reduce((m, r) => Math.max(m, r.best), 0)
    return { totalDone, avg30, topBest }
  }, [ranking])

  if (habits.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="仲未有數據"
        hint="新增習慣並開始打卡，呢度就會出現完成趨勢、星期分佈同每週統計圖表。"
      />
    )
  }

  const maxWeekly = Math.max(1, ...weekly.map((w) => w.count))

  return (
    <div className="space-y-6">
      {/* 摘要 */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label="累計打卡"
          value={summary.totalDone}
          unit="次"
          icon={CalendarCheck}
        />
        <StatCard
          label="30 日平均"
          value={`${summary.avg30}%`}
          icon={TrendingUp}
          hint="所有習慣"
        />
        <StatCard label="史上最長" value={summary.topBest} unit="日" icon={Flame} />
      </div>

      {/* 30 日完成趨勢（SVG 面積折線） */}
      <Card className="rounded-3xl p-4 sm:p-5">
        <SectionTitle icon={Activity}>30 日完成趨勢</SectionTitle>
        <TrendArea data={trend30.map((d) => d.rate)} />
        <div className="mt-1 flex justify-between text-[10px] text-slate-400 dark:text-slate-500">
          <span>30 日前</span>
          <span>今日</span>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* 逐星期幾完成率 */}
        <Card className="rounded-3xl p-4 sm:p-5">
          <SectionTitle icon={BarChart3}>星期分佈</SectionTitle>
          <div className="flex items-end justify-between gap-2" style={{ height: 140 }}>
            {byWeekday.map((d, i) => {
              const h = Math.round(d.rate * 100)
              const weekend = i === 0 || i === 6
              return (
                <div key={d.label} className="flex flex-1 flex-col items-center gap-1.5">
                  <div className="flex w-full flex-1 items-end">
                    <div className="relative w-full overflow-hidden rounded-t-md bg-slate-100 dark:bg-slate-700/50" style={{ height: '100%' }}>
                      <div
                        className={cx(
                          'absolute bottom-0 w-full rounded-t-md transition-all duration-500',
                          weekend ? 'bg-accent/60' : 'bg-accent',
                        )}
                        style={{ height: `${h}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-[10px] tabular-nums text-slate-400 dark:text-slate-500">
                    {h}%
                  </span>
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {d.label}
                  </span>
                </div>
              )
            })}
          </div>
        </Card>

        {/* 近 12 週每週完成次數 */}
        <Card className="rounded-3xl p-4 sm:p-5">
          <SectionTitle icon={BarChart3}>每週打卡次數</SectionTitle>
          <div className="flex items-end justify-between gap-1" style={{ height: 140 }}>
            {weekly.map((w, i) => {
              const h = Math.round((w.count / maxWeekly) * 100)
              return (
                <div key={i} className="group flex flex-1 flex-col items-center gap-1">
                  <span className="text-[10px] tabular-nums text-slate-400 opacity-0 transition group-hover:opacity-100 dark:text-slate-500">
                    {w.count}
                  </span>
                  <div className="flex w-full flex-1 items-end">
                    <div
                      className="w-full rounded-t bg-gradient-to-t from-accent/70 to-accent transition-all duration-500"
                      style={{ height: `${Math.max(2, h)}%` }}
                    />
                  </div>
                  <span className="text-[9px] tabular-nums text-slate-400 dark:text-slate-500">
                    {i % 2 === 0 ? w.label : ''}
                  </span>
                </div>
              )
            })}
          </div>
        </Card>
      </div>

      {/* 星期分佈洞察（最易堅持／最易甩底 + 逐習慣最常完成日） */}
      <WeekdayInsightCard insights={insights} habits={habits} />

      {/* 逐習慣完成率排行 */}
      <Card className="rounded-3xl p-4 sm:p-5">
        <SectionTitle icon={TrendingUp} description="過去 30 日排程完成率">
          習慣排行
        </SectionTitle>
        <div className="space-y-1">
          {ranking.map((r) => {
            const spec = colorOf(r.habit.color)
            return (
              <div
                key={r.habit.id}
                className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60"
              >
                <span className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base', spec.soft)}>
                  {r.habit.icon ?? '⭐'}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                      {r.habit.name}
                    </span>
                    <span className={cx('shrink-0 text-sm font-semibold tabular-nums', spec.text)}>
                      {r.rate}%
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700/60">
                    <div
                      className={cx('h-full rounded-full transition-all duration-500', spec.solid)}
                      style={{ width: `${r.rate}%` }}
                    />
                  </div>
                </div>
                <div className="flex w-14 shrink-0 items-center justify-end gap-1 text-xs font-medium tabular-nums text-amber-600 dark:text-amber-400">
                  <Flame size={13} />
                  {r.cur}
                </div>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}

// ───────── SVG 面積折線（自製） ─────────
function TrendArea({ data }: { data: number[] }) {
  const W = 600
  const H = 120
  const PAD = 4
  const n = data.length
  if (n === 0) return null

  const pts = data.map((v, i) => {
    const x = n === 1 ? W / 2 : PAD + (i / (n - 1)) * (W - PAD * 2)
    const y = H - PAD - v * (H - PAD * 2)
    return [x, y] as const
  })

  const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const area = `${line} L${pts[n - 1][0].toFixed(1)},${H - PAD} L${pts[0][0].toFixed(1)},${H - PAD} Z`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-32 w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="habitTrendFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {/* 25/50/75% 參考線 */}
      {[0.25, 0.5, 0.75].map((g) => {
        const y = H - PAD - g * (H - PAD * 2)
        return (
          <line
            key={g}
            x1={PAD}
            x2={W - PAD}
            y1={y}
            y2={y}
            className="stroke-slate-200 dark:stroke-slate-700"
            strokeWidth={1}
            strokeDasharray="3 4"
          />
        )
      })}
      <path d={area} fill="url(#habitTrendFill)" />
      <path
        d={line}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

// ───────── 星期分佈洞察卡（純衍生自 byHabit，無新狀態） ─────────
function WeekdayInsightCard({
  insights,
  habits,
}: {
  insights: WeekdayInsights
  habits: Habit[]
}) {
  const { best, worst, perHabitBest } = insights
  const habitById = useMemo(() => {
    const m = new Map<string, Habit>()
    for (const h of habits) m.set(h.id, h)
    return m
  }, [habits])

  // 完全冇排程日（best=null）兼且冇任何完成 → 唔顯示卡（避免空殼）。
  if (!best && perHabitBest.length === 0) return null

  // best === worst（得一個有排程嘅星期幾）就唔重複出 worst chip。
  const showWorst = worst != null && best != null && worst.weekday !== best.weekday
  const topHabits = perHabitBest.slice(0, 5)

  return (
    <Card className="rounded-3xl p-4 sm:p-5">
      <SectionTitle icon={Lightbulb} description="過去 12 週按完成率衍生">
        星期洞察
      </SectionTitle>

      {best && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 px-3 py-2.5 dark:bg-emerald-500/10">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <ThumbsUp size={16} />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-600/80 dark:text-emerald-400/80">
                最易堅持
              </p>
              <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                星期{best.label}
                <span className="ml-1.5 text-xs font-normal tabular-nums text-emerald-600/70 dark:text-emerald-400/70">
                  {best.rate}% 完成率
                </span>
              </p>
            </div>
          </div>

          {showWorst && worst && (
            <div className="flex items-center gap-3 rounded-2xl bg-rose-50 px-3 py-2.5 dark:bg-rose-500/10">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400">
                <ThumbsDown size={16} />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wide text-rose-600/80 dark:text-rose-400/80">
                  最易甩底
                </p>
                <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">
                  星期{worst.label}
                  <span className="ml-1.5 text-xs font-normal tabular-nums text-rose-600/70 dark:text-rose-400/70">
                    {worst.rate}% 完成率
                  </span>
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {topHabits.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium text-slate-400 dark:text-slate-500">
            各習慣最常完成嘅日子
          </p>
          <div className="space-y-1">
            {topHabits.map((p) => {
              const h = habitById.get(p.id)
              const spec = colorOf(h?.color)
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60"
                >
                  <span className={cx('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm', spec.soft)}>
                    {h?.icon ?? '⭐'}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-700 dark:text-slate-200">
                    {p.name}
                  </span>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-700/60 dark:text-slate-300">
                    星期{p.label}
                  </span>
                  <span className="w-10 shrink-0 text-right text-xs tabular-nums text-slate-400 dark:text-slate-500">
                    {p.count} 次
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </Card>
  )
}
