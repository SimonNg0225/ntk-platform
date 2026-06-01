import { useMemo, useState } from 'react'
import {
  Flame,
  Timer,
  Target,
  TrendingUp,
  Zap,
  Clock,
  Trophy,
  Star,
  Activity,
} from 'lucide-react'
import { SectionTitle, StatCard, EmptyState, Badge, SegmentedControl, cx } from '../../../ui'
import {
  dailySeries,
  currentStreak,
  longestStreak,
  weekdayDistribution,
  hourDistribution,
  projectBreakdown,
  tagBreakdown,
  totalsOf,
  fmtDuration,
  addDays,
  dayKey,
  relativeDay,
  WEEKDAY_LABELS,
  todayKey,
} from './store'
import type { FocusLog, FocusProject } from './types'
import {
  BarChart,
  BarAxis,
  LineChart,
  DonutChart,
  Heatmap,
  HourRadial,
  paletteOf,
} from './charts'

type Range = '7d' | '30d' | '90d' | 'all'

export default function StatsView({
  logs,
  projects,
}: {
  logs: FocusLog[]
  projects: FocusProject[]
}) {
  const [range, setRange] = useState<Range>('30d')

  const projById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects])
  const projName = (id?: string | null) =>
    (id != null ? projById.get(id)?.name : undefined) ?? '未分類'
  const projColor = (id?: string | null) =>
    (id != null ? projById.get(id)?.color : undefined) ?? 'slate'

  // 範圍內 logs
  const { rangedLogs, from, to, days } = useMemo(() => {
    const to = new Date()
    let n = 30
    if (range === '7d') n = 7
    else if (range === '90d') n = 90
    else if (range === 'all') {
      const first = logs.reduce<string | null>(
        (min, l) => (!min || l.startedAt < min ? l.startedAt : min),
        null,
      )
      n = first
        ? Math.max(7, Math.ceil((to.getTime() - new Date(first).getTime()) / 86400000) + 1)
        : 30
    }
    const from = addDays(to, -(n - 1))
    const fromKey = dayKey(from)
    const ranged = logs.filter((l) => dayKey(new Date(l.startedAt)) >= fromKey)
    return { rangedLogs: ranged, from, to, days: n }
  }, [logs, range])

  const totals = useMemo(() => totalsOf(rangedLogs), [rangedLogs])
  const series = useMemo(() => dailySeries(rangedLogs, from, to), [rangedLogs, from, to])
  const streak = useMemo(() => currentStreak(logs), [logs])
  const best = useMemo(() => longestStreak(logs), [logs])
  const weekday = useMemo(() => weekdayDistribution(rangedLogs), [rangedLogs])
  const hours = useMemo(() => hourDistribution(rangedLogs), [rangedLogs])
  const byProject = useMemo(() => projectBreakdown(rangedLogs), [rangedLogs])
  const byTag = useMemo(() => tagBreakdown(rangedLogs), [rangedLogs])

  // 全期間熱力圖（近 ~18 週）
  const heat = useMemo(() => {
    const to = new Date()
    // 對齊星期日結尾，方便排成 7×N 列
    const back = addDays(to, -7 * 18 + 1)
    const start = addDays(back, -back.getDay())
    const s = dailySeries(logs, start, to)
    return s.map((d) => ({ key: d.key, value: d.minutes, label: relativeDay(d.key) }))
  }, [logs])

  const hasData = logs.some((l) => l.kind === 'focus' && l.completed)

  if (!hasData) {
    return (
      <EmptyState
        icon={Activity}
        title="未有專注紀錄"
        hint="完成第一節專注後，呢度就會顯示你嘅趨勢、熱力圖、黃金時段同專案分析。"
      />
    )
  }

  // 比較：範圍前半 vs 後半，做趨勢箭咀
  const half = Math.floor(series.length / 2)
  const firstHalf = series.slice(0, half).reduce((s, d) => s + d.minutes, 0)
  const secondHalf = series.slice(half).reduce((s, d) => s + d.minutes, 0)
  const trendDir: 'up' | 'down' | 'flat' =
    secondHalf > firstHalf * 1.05 ? 'up' : secondHalf < firstHalf * 0.95 ? 'down' : 'flat'
  const trendPct =
    firstHalf > 0 ? Math.round(((secondHalf - firstHalf) / firstHalf) * 100) : secondHalf > 0 ? 100 : 0

  const peakHour = hours.indexOf(Math.max(...hours))
  const bestWeekday = weekday.indexOf(Math.max(...weekday))
  const dailyAvg = days > 0 ? totals.focusMin / days : 0

  const axisStep = series.length > 40 ? 7 : series.length > 14 ? 3 : 1

  return (
    <div className="space-y-6">
      {/* 範圍選擇 */}
      <div className="flex items-center justify-between">
        <SectionTitle icon={TrendingUp}>數據總覽</SectionTitle>
        <SegmentedControl<Range>
          size="sm"
          value={range}
          onChange={setRange}
          options={[
            { id: '7d', label: '7 日' },
            { id: '30d', label: '30 日' },
            { id: '90d', label: '90 日' },
            { id: 'all', label: '全部' },
          ]}
        />
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="專注時數"
          value={fmtDuration(totals.focusMin)}
          icon={Timer}
          highlight
          trend={{ value: `${trendPct > 0 ? '+' : ''}${trendPct}%`, dir: trendDir }}
          hint={`日均 ${fmtDuration(dailyAvg)}`}
        />
        <StatCard label="完成節數" value={totals.sessions} unit="節" icon={Target} hint={`完成率 ${Math.round(totals.completionRate)}%`} />
        <StatCard label="連續達標" value={streak} unit="日" icon={Flame} hint={`最長 ${best} 日`} />
        <StatCard
          label="平均專注度"
          value={totals.avgRating !== null ? totals.avgRating.toFixed(1) : '—'}
          icon={Star}
          hint={totals.avgRating !== null ? '滿分 5.0' : '未有評分'}
        />
      </div>

      {/* 每日趨勢直條 */}
      <section className="rounded-3xl border border-slate-200/80 bg-white p-4 dark:border-slate-700/60 dark:bg-slate-800 sm:p-5">
        <SectionTitle
          icon={Activity}
          right={<Badge tone="slate">每日專注分鐘</Badge>}
        >
          趨勢
        </SectionTitle>
        <BarChart
          data={series.map((d) => ({ key: d.key, value: d.minutes, label: relativeDay(d.key) }))}
          highlightKey={todayKey()}
        />
        <BarAxis
          data={series.map((d) => ({
            key: d.key,
            short: `${new Date(d.key + 'T12:00:00').getMonth() + 1}/${new Date(d.key + 'T12:00:00').getDate()}`,
          }))}
          step={axisStep}
        />
      </section>

      {/* 熱力圖 + 折線 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-3xl border border-slate-200/80 bg-white p-4 dark:border-slate-700/60 dark:bg-slate-800 sm:p-5">
          <SectionTitle icon={Flame}>專注熱力圖</SectionTitle>
          <Heatmap cells={heat} />
        </section>
        <section className="rounded-3xl border border-slate-200/80 bg-white p-4 dark:border-slate-700/60 dark:bg-slate-800 sm:p-5">
          <SectionTitle icon={TrendingUp}>累積趨勢線</SectionTitle>
          <LineChart
            values={series.map((d) => d.minutes)}
            labels={series.map((d) => relativeDay(d.key))}
          />
          <p className="mt-2 text-center text-xs text-slate-400">
            範圍內共 {fmtDuration(totals.focusMin)} · {totals.sessions} 節
          </p>
        </section>
      </div>

      {/* 專案佔比 + 黃金時段 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-3xl border border-slate-200/80 bg-white p-4 dark:border-slate-700/60 dark:bg-slate-800 sm:p-5">
          <SectionTitle icon={Target}>專案佔比</SectionTitle>
          {byProject.length > 0 && totals.focusMin > 0 ? (
            <div className="flex flex-col items-center gap-4 sm:flex-row">
              <DonutChart
                segments={byProject.map((p) => ({
                  value: p.minutes,
                  color: projColor(p.projectId),
                  label: projName(p.projectId),
                }))}
                centerLabel={fmtDuration(totals.focusMin)}
                centerSub="總計"
              />
              <div className="flex-1 space-y-1.5">
                {byProject.slice(0, 6).map((p) => {
                  const pal = paletteOf(projColor(p.projectId))
                  const pctv = Math.round((p.minutes / totals.focusMin) * 100)
                  return (
                    <div key={p.projectId ?? 'none'} className="flex items-center gap-2 text-sm">
                      <span className={cx('h-2.5 w-2.5 shrink-0 rounded-full', pal.dot)} />
                      <span className="flex-1 truncate text-slate-600 dark:text-slate-300">
                        {projName(p.projectId)}
                      </span>
                      <span className="tabular-nums text-slate-400">{pctv}%</span>
                      <span className="w-14 text-right tabular-nums text-slate-500 dark:text-slate-400">
                        {fmtDuration(p.minutes)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-slate-400">範圍內未有資料</p>
          )}
        </section>

        <section className="rounded-3xl border border-slate-200/80 bg-white p-4 dark:border-slate-700/60 dark:bg-slate-800 sm:p-5">
          <SectionTitle icon={Clock}>一日黃金時段</SectionTitle>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-around">
            <HourRadial hours={hours} />
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Zap size={15} className="text-amber-500" />
                <span className="text-slate-500 dark:text-slate-400">最高效</span>
                <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                  {Math.max(...hours) > 0 ? `${peakHour}:00–${peakHour + 1}:00` : '—'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Trophy size={15} className="text-accent" />
                <span className="text-slate-500 dark:text-slate-400">最佳星期</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {Math.max(...weekday) > 0 ? `星期${WEEKDAY_LABELS[bestWeekday]}` : '—'}
                </span>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* 星期分佈條 */}
      <section className="rounded-3xl border border-slate-200/80 bg-white p-4 dark:border-slate-700/60 dark:bg-slate-800 sm:p-5">
        <SectionTitle icon={Activity}>星期分佈</SectionTitle>
        <div className="flex items-end gap-2" style={{ height: 120 }}>
          {weekday.map((m, i) => {
            const max = Math.max(...weekday, 1)
            const h = (m / max) * 100
            return (
              <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1">
                <span className="text-[10px] tabular-nums text-slate-400">
                  {m > 0 ? Math.round(m) : ''}
                </span>
                <div
                  className={cx(
                    'w-full rounded-t-md transition-all duration-500',
                    i === bestWeekday && m > 0 ? 'bg-accent' : 'bg-accent/40',
                  )}
                  style={{ height: `${Math.max(h, m > 0 ? 5 : 2)}%` }}
                />
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {WEEKDAY_LABELS[i]}
                </span>
              </div>
            )
          })}
        </div>
      </section>

      {/* 標籤 + 中斷統計 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-3xl border border-slate-200/80 bg-white p-4 dark:border-slate-700/60 dark:bg-slate-800 sm:p-5">
          <SectionTitle icon={Target}>熱門標籤</SectionTitle>
          {byTag.length ? (
            <div className="space-y-2">
              {byTag.slice(0, 8).map((t) => {
                const max = byTag[0].minutes || 1
                return (
                  <div key={t.tag} className="flex items-center gap-2">
                    <span className="w-24 shrink-0 truncate text-sm text-slate-600 dark:text-slate-300">
                      #{t.tag}
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                      <div
                        className="h-full rounded-full bg-accent transition-all duration-500"
                        style={{ width: `${(t.minutes / max) * 100}%` }}
                      />
                    </div>
                    <span className="w-12 text-right text-xs tabular-nums text-slate-400">
                      {fmtDuration(t.minutes)}
                    </span>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-slate-400">未有標籤資料</p>
          )}
        </section>

        <section className="rounded-3xl border border-slate-200/80 bg-white p-4 dark:border-slate-700/60 dark:bg-slate-800 sm:p-5">
          <SectionTitle icon={Zap}>專注品質</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <Mini label="完成率" value={`${Math.round(totals.completionRate)}%`} sub={`放棄 ${totals.abandoned} 節`} />
            <Mini label="平均每節" value={fmtDuration(totals.avgSessionMin)} sub="專注長度" />
            <Mini label="總分心次數" value={String(totals.interruptions)} sub={totals.sessions ? `平均 ${(totals.interruptions / totals.sessions).toFixed(1)}/節` : '—'} />
            <Mini label="日均專注" value={fmtDuration(dailyAvg)} sub={`近 ${days} 日`} />
          </div>
        </section>
      </div>
    </div>
  )
}

function Mini({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-slate-200/70 bg-slate-50/70 p-3 dark:border-slate-700/50 dark:bg-slate-900/40">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-0.5 text-xl font-bold tabular-nums text-slate-800 dark:text-slate-100">{value}</p>
      <p className="text-[11px] text-slate-400">{sub}</p>
    </div>
  )
}
