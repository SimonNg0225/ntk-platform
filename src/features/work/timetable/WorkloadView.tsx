import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarDays, Clock, Layers, Coffee, CupSoda, PieChart } from 'lucide-react'
import { Badge, Card, EmptyState, SectionTitle, StatCard, cx } from '../../../ui'
import {
  colorOf,
  cycleLabel,
  cycleShort,
  dayLabel,
  dayShort,
  fmtDuration,
  type FreeSegment,
  type Workload,
} from './util'

// ============================================================
//  工作量分析（全自製 SVG / div 圖表，零依賴）
//  - 每日節數直條圖
//  - 每節（跨日）熱度橫條
//  - 每班佔比甜甜圈
//  - 空堂 vs 上堂（每日）
// ============================================================

export default function WorkloadView({
  workload,
  classColorKey,
  cycle,
  freeSegments = [],
}: {
  workload: Workload
  // 班別 → 用嚟畀甜甜圈上色（key = classId 或 undefined）
  classColorKey: (classId?: string) => string
  // 日循環模式：日子標籤用 Day A–F 而唔係星期一至六
  cycle?: boolean
  // 空堂時段（連續成段，含鐘聲時間）— 純衍生自 slots/bells/days
  freeSegments?: FreeSegment[]
}) {
  const { t } = useTranslation()

  if (workload.total === 0) {
    return (
      <EmptyState
        icon={PieChart}
        title={t('tt.emptyTitle', { defaultValue: '仲未有課堂可以分析' })}
        hint={t('tt.emptyHint', { defaultValue: '返去「週課表」撳吓格仔加堂，呢度就會幫你算好每日節數、最忙一日同空堂時段。' })}
      />
    )
  }

  const avgPerDay =
    workload.daysWithLessons > 0
      ? (workload.total / workload.daysWithLessons).toFixed(1)
      : '0'

  return (
    <div className="space-y-4">
      {/* 概覽數字 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label={t('tt.statTotalLabel', { defaultValue: '每週總節數' })}
          value={workload.total}
          unit={t('tt.statTotalUnit', { defaultValue: '節' })}
          icon={Layers}
        />
        <StatCard
          label={t('tt.statHoursLabel', { defaultValue: '每週教學時數' })}
          value={(workload.totalMinutes / 60).toFixed(1)}
          unit={t('tt.statHoursUnit', { defaultValue: '小時' })}
          icon={Clock}
          hint={fmtDuration(workload.totalMinutes)}
        />
        <StatCard
          label={t('tt.statBusiestLabel', { defaultValue: '最忙一日' })}
          value={workload.busiestDay ? workload.busiestDay.count : 0}
          unit={t('tt.statBusiestUnit', { defaultValue: '節' })}
          icon={CalendarDays}
          hint={
            workload.busiestDay
              ? cycle
                ? cycleLabel(workload.busiestDay.day)
                : dayLabel(workload.busiestDay.day)
              : undefined
          }
        />
        <StatCard
          label={t('tt.statConsecLabel', { defaultValue: '最長連堂' })}
          value={workload.maxConsecutive}
          unit={t('tt.statConsecUnit', { defaultValue: '節' })}
          icon={Coffee}
          hint={t('tt.statAvgHint', { defaultValue: `平均每日 ${avgPerDay} 節`, avg: avgPerDay })}
        />
      </div>

      {/* 每日節數 + 每班佔比 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card padded>
          <SectionTitle icon={CalendarDays}>{t('tt.chartDailyTitle', { defaultValue: '每日節數分佈' })}</SectionTitle>
          <DayBars workload={workload} cycle={cycle} />
        </Card>

        <Card padded>
          <SectionTitle icon={Layers}>{t('tt.chartClassTitle', { defaultValue: '各班節數佔比' })}</SectionTitle>
          <ClassDonut workload={workload} classColorKey={classColorKey} />
        </Card>
      </div>

      {/* 每節熱度 + 空堂 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card padded>
          <SectionTitle icon={Clock} description={t('tt.chartPeriodDesc', { defaultValue: '邊幾節最多堂（跨星期累計）' })}>
            {t('tt.chartPeriodTitle', { defaultValue: '節次熱度' })}
          </SectionTitle>
          <PeriodHeat workload={workload} />
        </Card>

        <Card padded>
          <SectionTitle icon={Coffee} description={t('tt.chartFreeBusyDesc', { defaultValue: '每日上堂 vs 空堂' })}>
            {t('tt.chartFreeBusyTitle', { defaultValue: '空堂分析' })}
          </SectionTitle>
          <FreeBusy workload={workload} cycle={cycle} />
        </Card>
      </div>

      {/* 空堂時段（連續成段，含鐘聲時間）*/}
      <Card padded>
        <SectionTitle
          icon={CupSoda}
          description={t('tt.chartFreeSegsDesc', { defaultValue: '邊日邊節有得抖／改簿／開會（連續節數會合成一段）' })}
          right={
            <span className="text-[11px] tabular-nums text-slate-400">
              {t('tt.freeSegsCount', { defaultValue: `共 ${freeSegments.length} 段`, count: freeSegments.length })}
            </span>
          }
        >
          {t('tt.chartFreeSegsTitle', { defaultValue: '空堂時段' })}
        </SectionTitle>
        <FreeSegments segments={freeSegments} cycle={cycle} />
      </Card>
    </div>
  )
}

// ───────── 每日節數：垂直條形圖 ─────────
function DayBars({ workload, cycle }: { workload: Workload; cycle?: boolean }) {
  const { t } = useTranslation()
  const max = Math.max(1, ...workload.byDay.map((d) => d.count))
  return (
    <div className="flex h-44 items-end justify-around gap-2 pt-2">
      {workload.byDay.map((d) => {
        const h = (d.count / max) * 100
        const isBusiest = workload.busiestDay?.day === d.day && d.count > 0
        return (
          <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-xs font-semibold tabular-nums text-slate-600 dark:text-slate-300">
              {d.count}
            </span>
            <div className="flex w-full flex-1 items-end">
              <div
                className={cx(
                  'w-full rounded-t-md transition-all duration-500',
                  isBusiest
                    ? 'bg-accent'
                    : 'bg-accent/40 dark:bg-accent/30',
                )}
                style={{ height: `${Math.max(h, d.count > 0 ? 6 : 0)}%` }}
              />
            </div>
            <span className="text-[11px] text-slate-400 dark:text-slate-500">
              {cycle ? cycleShort(d.day) : t(`tt.day${['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.day] ?? 'Mon'}`, { defaultValue: dayShort(d.day) })}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ───────── 各班佔比：SVG 甜甜圈 ─────────
function ClassDonut({
  workload,
  classColorKey,
}: {
  workload: Workload
  classColorKey: (classId?: string) => string
}) {
  const { t } = useTranslation()
  const total = workload.total
  const R = 52
  const C = 2 * Math.PI * R
  const segments = useMemo(() => {
    let acc = 0
    return workload.byClass.map((c) => {
      const frac = c.count / total
      const seg = {
        ...c,
        colorKey: classColorKey(c.classId),
        dash: frac * C,
        offset: -acc * C,
        pct: Math.round(frac * 100),
      }
      acc += frac
      return seg
    })
  }, [workload.byClass, total, C, classColorKey])

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative h-36 w-36 shrink-0">
        <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
          <circle
            cx="70"
            cy="70"
            r={R}
            fill="none"
            strokeWidth="16"
            className="stroke-slate-100 dark:stroke-slate-700"
          />
          {segments.map((s) => (
            <circle
              key={s.label}
              cx="70"
              cy="70"
              r={R}
              fill="none"
              strokeWidth="16"
              strokeDasharray={`${s.dash} ${C - s.dash}`}
              strokeDashoffset={s.offset}
              className={cx('transition-all duration-700', colorOf(s.colorKey).bar)}
              style={{ stroke: 'currentColor' }}
            />
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold tabular-nums text-slate-800 dark:text-slate-100">
            {total}
          </span>
          <span className="text-[11px] text-slate-400">{t('tt.donutTotal', { defaultValue: '總節數' })}</span>
        </div>
      </div>
      <ul className="flex-1 space-y-1.5">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-2 text-sm">
            <span
              className={cx('h-2.5 w-2.5 shrink-0 rounded-full', colorOf(s.colorKey).bar)}
            />
            <span className="flex-1 truncate text-slate-600 dark:text-slate-300">
              {s.label}
            </span>
            <span className="tabular-nums text-slate-400">{s.count}</span>
            <span className="w-10 text-right tabular-nums text-xs font-medium text-slate-500 dark:text-slate-400">
              {s.pct}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ───────── 每節熱度：橫條 ─────────
function PeriodHeat({ workload }: { workload: Workload }) {
  const { t } = useTranslation()
  const max = Math.max(1, ...workload.byPeriod.map((p) => p.count))
  return (
    <div className="space-y-1.5">
      {workload.byPeriod.map((p) => {
        const w = (p.count / max) * 100
        return (
          <div key={p.period} className="flex items-center gap-2">
            <span className="w-12 shrink-0 text-right text-[11px] tabular-nums text-slate-400">
              {t('tt.periodRowLabel', { defaultValue: `第 ${p.period} 節`, n: p.period })}
            </span>
            <div className="h-4 flex-1 overflow-hidden rounded bg-slate-100 dark:bg-slate-700/60">
              <div
                className="h-full rounded bg-gradient-to-r from-accent/60 to-accent transition-all duration-500"
                style={{ width: `${Math.max(w, p.count > 0 ? 4 : 0)}%` }}
              />
            </div>
            <span className="w-5 text-right text-xs tabular-nums text-slate-500 dark:text-slate-400">
              {p.count}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ───────── 空堂 vs 上堂：堆疊橫條 ─────────
function FreeBusy({ workload, cycle }: { workload: Workload; cycle?: boolean }) {
  const { t } = useTranslation()
  return (
    <div className="space-y-2">
      {workload.freeByDay.map((d) => {
        const tot = d.busy + d.free
        const busyPct = tot > 0 ? (d.busy / tot) * 100 : 0
        return (
          <div key={d.day} className="flex items-center gap-2">
            <span className="w-8 shrink-0 text-xs text-slate-400">
              {cycle ? cycleShort(d.day) : t(`tt.day${['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.day] ?? 'Mon'}`, { defaultValue: dayShort(d.day) })}
            </span>
            <div className="flex h-5 flex-1 overflow-hidden rounded-md bg-slate-100 dark:bg-slate-700/60">
              <div
                className="flex items-center justify-end bg-accent pr-1 text-[10px] font-medium text-white transition-all duration-500"
                style={{ width: `${busyPct}%` }}
              >
                {d.busy > 0 && busyPct > 18 ? d.busy : ''}
              </div>
            </div>
            <span className="w-16 shrink-0 text-right text-[11px] tabular-nums text-slate-400">
              {t('tt.busyFreeCell', { defaultValue: `${d.busy} 堂 · ${d.free} 空`, busy: d.busy, free: d.free })}
            </span>
          </div>
        )
      })}
      <div className="flex items-center gap-3 pt-1 text-[11px] text-slate-400">
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-accent" /> {t('tt.busyLabel', { defaultValue: '上堂' })}
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-slate-200 dark:bg-slate-600" />{' '}
          {t('tt.freeLabel', { defaultValue: '空堂' })}
        </span>
      </div>
    </div>
  )
}

// ───────── 空堂時段：逐日列出每段（含鐘聲時間 + 連堂標示）─────────
function FreeSegments({
  segments,
  cycle,
}: {
  segments: FreeSegment[]
  cycle?: boolean
}) {
  const { t } = useTranslation()
  // 依出現次序按 day 分組（computeFreePeriods 已先 day 後 period 排好）
  const byDay = useMemo(() => {
    const groups: { day: number; segs: FreeSegment[] }[] = []
    for (const s of segments) {
      const g = groups[groups.length - 1]
      if (g && g.day === s.day) g.segs.push(s)
      else groups.push({ day: s.day, segs: [s] })
    }
    return groups
  }, [segments])

  if (segments.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-slate-400 dark:text-slate-500">
        {t('tt.noFreeSlots', { defaultValue: '顯示範圍內冇空堂 — 堂堂爆滿。' })}
      </p>
    )
  }

  const periodLabel = (periods: number[]) =>
    periods.length > 1
      ? t('tt.freeSegPeriod', { defaultValue: `第 ${periods[0]}–${periods[periods.length - 1]} 節`, start: periods[0], end: periods[periods.length - 1] })
      : t('tt.freeSegSingle', { defaultValue: `第 ${periods[0]} 節`, n: periods[0] })

  return (
    <div className="space-y-3">
      {byDay.map(({ day, segs }) => (
        <div key={day} className="flex flex-col gap-1.5 sm:flex-row sm:items-start">
          <span className="w-14 shrink-0 pt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
            {cycle ? cycleLabel(day) : dayLabel(day)}
          </span>
          <div className="flex flex-1 flex-wrap gap-1.5">
            {segs.map((s) => (
              <div
                key={s.periods.join('-')}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/60 px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-800/40"
              >
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  {periodLabel(s.periods)}
                </span>
                <span className="text-xs tabular-nums text-slate-400">
                  {s.start}–{s.end}
                </span>
                {s.periods.length > 1 && (
                  <Badge tone="green">{t('tt.freeSegConsec', { defaultValue: `連續 ${s.periods.length} 節`, count: s.periods.length })}</Badge>
                )}
                <span className="text-[11px] tabular-nums text-slate-400">
                  {fmtDuration(s.minutes)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
