import {
  Brain, Flame, Timer, Sparkles, Target, BookOpen, BookText, Smile,
  Check, ChevronRight, Zap, type LucideIcon,
} from 'lucide-react'
import { SegmentedControl, cx } from '../../../ui'
import { ActivityArea, MiniRing } from './charts'
import { greeting, longToday, fmtMin, trendOf, type KpiData, type DaySignal } from './util'

// ============================================================
//  個人儀表板 — 「重型」Bento overview（不規則大小磚 + 真實統計）
//  ------------------------------------------------------------
//  全部數字由 computeKpis(真實資料層) 而嚟；磚塊大小唔一，
//  hero 2×2、活動走勢 / 今日任務 2 格闊，其餘 1×1 統計磚。
// ============================================================

interface Task {
  label: string
  done: boolean
  target: string
  icon: LucideIcon
}

const RANGE_OPTS = [
  { id: '14', label: '14 日' },
  { id: '30', label: '30 日' },
  { id: '90', label: '90 日' },
]

type Tone = 'accent' | 'amber' | 'emerald' | 'violet' | 'sky' | 'rose'
const TONE: Record<Tone, { chip: string; val: string }> = {
  accent: { chip: 'bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent', val: 'text-accent' },
  amber: { chip: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300', val: 'text-amber-500' },
  emerald: { chip: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300', val: 'text-emerald-500' },
  violet: { chip: 'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300', val: 'text-violet-500' },
  sky: { chip: 'bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300', val: 'text-sky-500' },
  rose: { chip: 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300', val: 'text-rose-500' },
}

// 1×1 統計磚
function StatTile({
  label, value, unit, hint, icon: Icon, tone, trend, onClick, span,
}: {
  label: string
  value: number | string
  unit?: string
  hint?: string
  icon: LucideIcon
  tone: Tone
  trend?: { dir: 'up' | 'down' | 'flat'; value: string }
  onClick: () => void
  span?: string
}) {
  const t = TONE[tone]
  return (
    <button
      onClick={onClick}
      className={cx(
        'group flex cursor-pointer flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md dark:border-slate-700/60 dark:bg-slate-800 dark:hover:border-slate-600',
        span,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-400 dark:text-slate-500">{label}</span>
        <span className={cx('flex h-8 w-8 items-center justify-center rounded-xl transition group-hover:scale-105', t.chip)}>
          <Icon size={16} />
        </span>
      </div>
      <div>
        <p className="flex items-baseline gap-1">
          <span className={cx('text-3xl font-bold tabular-nums', t.val)}>{value}</span>
          {unit && <span className="text-sm font-medium text-slate-400">{unit}</span>}
          {trend && trend.dir !== 'flat' && (
            <span
              className={cx(
                'ml-auto text-xs font-semibold tabular-nums',
                trend.dir === 'up' ? 'text-emerald-500' : 'text-rose-500',
              )}
            >
              {trend.dir === 'up' ? '↑' : '↓'} {trend.value}
            </span>
          )}
        </p>
        {hint && <p className="mt-0.5 truncate text-[11px] text-slate-400">{hint}</p>}
      </div>
    </button>
  )
}

export default function BentoOverview({
  name, kpis, signals, focusGoalMin, range, onRange, tasks, open,
}: {
  name: string
  kpis: KpiData
  signals: DaySignal[]
  focusGoalMin: number
  range: number
  onRange: (n: number) => void
  tasks: Task[]
  open: (id: string) => void
}) {
  const todayFocus = signals.length ? signals[signals.length - 1].focusMin : 0
  const focusPct = Math.min(100, Math.round((todayFocus / Math.max(1, focusGoalMin)) * 100))
  const tasksDone = tasks.filter((t) => t.done).length

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:auto-rows-[132px] lg:grid-cols-4">
      {/* ── HERO 2×2 ── */}
      <section className="hero-gradient relative flex flex-col justify-between overflow-hidden rounded-3xl p-5 text-white shadow-lg shadow-accent/25 sm:col-span-2 lg:row-span-2">
        <div className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="relative">
          <p className="text-xs font-medium text-white/70">{longToday()}</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">
            {greeting()}{name ? `，${name}` : ''}
          </h1>
          {kpis.streak > 0 && (
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur">
              <Flame size={13} /> 連續 {kpis.streak} 日
              {kpis.longestStreak > kpis.streak && (
                <span className="text-white/60">· 最長 {kpis.longestStreak}</span>
              )}
            </span>
          )}
        </div>
        <div className="relative">
          <p className="text-xs text-white/70">今日專注</p>
          <p className="mt-0.5 text-4xl font-bold tabular-nums">
            {fmtMin(todayFocus)}
            <span className="ml-2 text-sm font-medium text-white/60">/ {fmtMin(focusGoalMin)}</span>
          </p>
          <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-white/20">
            <div className="h-full rounded-full bg-white transition-all duration-700" style={{ width: `${focusPct}%` }} />
          </div>
        </div>
      </section>

      {/* ── 1×1 統計磚 ── */}
      <StatTile
        label="今日要複習" value={kpis.dueCards} unit="張" icon={Brain} tone="accent"
        hint={kpis.dueCards === 0 ? '已清晒 🎉' : '間隔重複到期'}
        onClick={() => open('learning-flashcards')}
      />
      {/* 習慣環 */}
      <button
        onClick={() => open('learning-habits')}
        className="group flex cursor-pointer items-center gap-3 rounded-3xl border border-slate-200/80 bg-white p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md dark:border-slate-700/60 dark:bg-slate-800 dark:hover:border-slate-600"
      >
        <MiniRing value={kpis.habitRate} size={56} stroke={6} tone={kpis.habitRate >= 100 ? 'green' : 'accent'}>
          <span className="text-[11px] font-bold tabular-nums text-slate-700 dark:text-slate-200">{kpis.habitRate}%</span>
        </MiniRing>
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-400 dark:text-slate-500">今日習慣</p>
          <p className="mt-0.5 text-lg font-bold tabular-nums text-slate-800 dark:text-slate-100">
            {kpis.habitDoneToday}<span className="text-sm text-slate-400">/{kpis.habitDueToday || 0}</span>
          </p>
          <p className="text-[11px] text-slate-400">{kpis.habitDueToday > 0 ? '已完成' : '未設習慣'}</p>
        </div>
      </button>

      <StatTile
        label="連續活躍" value={kpis.streak} unit="日" icon={Flame} tone="amber"
        hint={kpis.longestStreak > 0 ? `最長 ${kpis.longestStreak} 日` : undefined}
        onClick={() => open('learning-journal')}
      />
      <StatTile
        label="本週專注" value={Math.round(kpis.focusMinWeek)} unit="分" icon={Timer} tone="sky"
        trend={trendOf(kpis.focusMinWeek, kpis.focusMinPrevWeek)}
        hint={`${kpis.focusSessionsWeek} 節`}
        onClick={() => open('learning-focus')}
      />

      {/* 活動走勢 2×1 */}
      <section className="flex flex-col rounded-3xl border border-slate-200/80 bg-white p-4 dark:border-slate-700/60 dark:bg-slate-800 sm:col-span-2">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-300">活動走勢</span>
          <SegmentedControl
            size="sm"
            options={RANGE_OPTS}
            value={String(range)}
            onChange={(v) => onRange(Number(v))}
          />
        </div>
        <div className="min-h-0 flex-1">
          <ActivityArea signals={signals} height={56} />
        </div>
      </section>

      <StatTile
        label="本週複習" value={kpis.reviewsWeek} unit="張" icon={Sparkles} tone="violet"
        trend={trendOf(kpis.reviewsWeek, kpis.reviewsPrevWeek)}
        onClick={() => open('learning-flashcards')}
      />
      <StatTile
        label="目標進度" value={kpis.goalsAvgProgress} unit="%" icon={Target} tone="emerald"
        hint={`${kpis.goalsActive} 個進行中`}
        onClick={() => open('learning-goals')}
      />

      {/* 今日任務 2×2 */}
      <section className="flex flex-col rounded-3xl border border-slate-200/80 bg-white p-4 dark:border-slate-700/60 dark:bg-slate-800 sm:col-span-2 lg:row-span-2">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">今日任務</span>
          <span className="text-xs font-medium tabular-nums text-slate-400">{tasksDone}/{tasks.length}</span>
        </div>
        <ul className="flex-1 space-y-1">
          {tasks.map((t) => (
            <li key={t.label}>
              <button
                onClick={() => !t.done && open(t.target)}
                disabled={t.done}
                className={cx(
                  'flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left text-sm transition',
                  t.done
                    ? 'cursor-default text-slate-400'
                    : 'cursor-pointer text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800/60',
                )}
              >
                <span className={cx(
                  'flex h-5 w-5 flex-none items-center justify-center rounded-full border',
                  t.done ? 'border-emerald-400 bg-emerald-400 text-white' : 'border-slate-300 dark:border-slate-600',
                )}>
                  {t.done && <Check size={12} strokeWidth={3} />}
                </span>
                <t.icon size={15} className={t.done ? 'text-slate-300 dark:text-slate-600' : 'text-slate-400'} />
                <span className={cx('truncate', t.done && 'line-through')}>{t.label}</span>
                {!t.done && <ChevronRight size={14} className="ml-auto flex-none text-accent" />}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <StatTile
        label="本週閱讀" value={kpis.pagesWeek} unit="頁" icon={BookOpen} tone="amber"
        hint={kpis.booksReading > 0 ? `${kpis.booksReading} 本在讀` : undefined}
        onClick={() => open('learning-reading')}
      />
      <StatTile
        label="本週日誌" value={kpis.journalWeek} unit="篇" icon={BookText} tone="rose"
        hint={kpis.moodAvg != null ? `心情 ${kpis.moodAvg}/5` : undefined}
        onClick={() => open('learning-journal')}
      />
      <StatTile
        label="平均心情" value={kpis.moodAvg != null ? kpis.moodAvg : '—'} unit={kpis.moodAvg != null ? '/5' : undefined}
        icon={Smile} tone="emerald" hint="近 7 日" onClick={() => open('learning-journal')}
      />
      {/* 問 AI CTA */}
      <button
        onClick={() => open('learning-ai')}
        className="group flex cursor-pointer flex-col justify-between rounded-3xl border border-dashed border-accent/40 bg-accent-soft/50 p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-accent hover:shadow-md dark:bg-accent/10"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent text-white transition group-hover:scale-105">
          <Zap size={16} />
        </span>
        <div>
          <p className="text-sm font-semibold text-accent-strong dark:text-accent">問 AI 助手</p>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">問答 · 總結 · 出練習</p>
        </div>
      </button>
    </div>
  )
}
