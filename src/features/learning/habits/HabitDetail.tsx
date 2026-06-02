import { useMemo, useState, type ReactNode } from 'react'
import {
  Modal,
  Button,
  Badge,
  IconButton,
  cx,
} from '../../../ui'
import {
  Flame,
  Trophy,
  Percent,
  CalendarCheck,
  Pencil,
  ChevronLeft,
  ChevronRight,
  Target,
  X,
  CalendarDays,
  Grid3x3,
  CalendarRange,
} from 'lucide-react'
import Heatmap from './Heatmap'
import { colorOf, freqLabel, type Habit } from './types'
import {
  bestStreak,
  currentStreak,
  rateOverDays,
  monthMatrix,
  toKey,
  todayKey,
  WEEKDAY_LABELS,
  MONTH_LABELS,
} from './util'

// ============================================================
//  習慣詳情（per-habit）— 年度 heatmap + 統計 + 可點月曆
//  ------------------------------------------------------------
//  美學：呼應主畫面「老黃曆 + 連續鏈條」——
//  單一習慣嘅一頁曆書：serif 抬頭、戳印圖示、hairline 分節、
//  連續日數做主角（鏈條意象）。可點月曆 / heatmap 功能一律不變。
// ============================================================

export default function HabitDetail({
  habit,
  done,
  onClose,
  onToggle,
  onEdit,
}: {
  habit: Habit | null
  done: Set<string>
  onClose: () => void
  onToggle: (habitId: string, dateKey: string) => void
  onEdit: (habit: Habit) => void
}) {
  const now = new Date()
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() })

  const spec = habit ? colorOf(habit.color) : colorOf('accent')

  const stats = useMemo(() => {
    if (!habit) return null
    return {
      cur: currentStreak(done, habit.frequency),
      best: bestStreak(done, habit.frequency),
      rate30: rateOverDays(done, habit.frequency, 30),
      total: done.size,
    }
  }, [habit, done])

  const cells = useMemo(() => monthMatrix(ym.y, ym.m), [ym])
  const tKey = todayKey()

  if (!habit || !stats) return null

  const targetPct =
    habit.targetStreak > 0
      ? Math.min(100, Math.round((stats.cur / habit.targetStreak) * 100))
      : 0

  function shiftMonth(delta: number) {
    setYm((prev) => {
      const d = new Date(prev.y, prev.m + delta, 1)
      return { y: d.getFullYear(), m: d.getMonth() }
    })
  }

  return (
    <Modal
      open={!!habit}
      onClose={onClose}
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            關閉
          </Button>
          <Button icon={Pencil} onClick={() => onEdit(habit)}>
            編輯
          </Button>
        </>
      }
    >
      {/* ───────── 老黃曆抬頭：kicker + 戳印圖示 + serif 名稱 + 自家關閉鈕 ───────── */}
      <div className="mb-5 flex items-start gap-3.5">
        <span
          className={cx(
            'relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-3xl shadow-xs ring-1 ring-inset ring-black/5 dark:ring-white/5',
            spec.soft,
          )}
        >
          {habit.icon ?? '⭐'}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.3em] text-accent/70">
            <CalendarDays size={13} className="shrink-0" />
            習慣冊 · Habit Almanac
          </p>
          <h2 className="mt-0.5 truncate font-serif text-2xl font-semibold leading-tight tracking-tight text-slate-900 dark:text-slate-100">
            {habit.name}
          </h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge tone="slate">{freqLabel(habit.frequency)}</Badge>
            {habit.category && <Badge tone="accent">{habit.category}</Badge>}
            <Badge tone={habit.goalKind === 'quit' ? 'rose' : 'green'}>
              {habit.goalKind === 'quit' ? '戒除' : '養成'}
            </Badge>
            {habit.reminderTime && (
              <Badge tone="blue">
                <span className="tabular-nums">{habit.reminderTime}</span> 提醒
              </Badge>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="關閉"
          className="-mr-1 -mt-1 shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:hover:bg-slate-700"
        >
          <X size={18} />
        </button>
      </div>

      {habit.notes && (
        <p className="mb-5 rounded-xl border-l-2 border-slate-300 bg-slate-50 px-3.5 py-2.5 font-serif text-sm italic leading-relaxed text-slate-600 dark:border-slate-600 dark:bg-slate-700/40 dark:text-slate-300">
          {habit.notes}
        </p>
      )}

      {/* ───────── 連續紀錄：曆書帶（hairline grid · serif 大數字；呼應主畫面 AlmanacStat） ───────── */}
      <div className="mb-5 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-slate-200/70 ring-1 ring-slate-200/80 dark:bg-slate-700/50 dark:ring-slate-700/60 sm:grid-cols-4">
        <LeafStat label="目前連續" value={stats.cur} unit="日" icon={Flame} hot={stats.cur > 0} />
        <LeafStat label="史上最長" value={stats.best} unit="日" icon={Trophy} />
        <LeafStat label="30 日完成" value={`${stats.rate30}%`} icon={Percent} />
        <LeafStat label="累計打卡" value={stats.total} unit="次" icon={CalendarCheck} />
      </div>

      {/* ───────── 目標連續進度（鏈條意象：節節相扣行向目標） ───────── */}
      {habit.targetStreak > 0 && (
        <div className="mb-5 rounded-2xl border border-slate-200/80 p-4 dark:border-slate-700/60">
          <div className="mb-2.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
              <Target size={15} className={spec.text} />
              目標連續 {habit.targetStreak} 日
            </span>
            <span className={cx('font-serif text-sm font-semibold tabular-nums slashed-zero', spec.text)}>
              {stats.cur}/{habit.targetStreak}
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
            <div
              className={cx('h-full rounded-full transition-all duration-500', spec.solid.split(' ')[0])}
              style={{ width: `${targetPct}%` }}
            />
          </div>
          {stats.cur >= habit.targetStreak && (
            <p className="mt-2 flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <Trophy size={13} className="shrink-0" />
              已達成目標！繼續保持。
            </p>
          )}
        </div>
      )}

      {/* ───────── 年度打卡熱圖 ───────── */}
      <div className="mb-6">
        <LeafHeading icon={Grid3x3}>年度打卡熱圖</LeafHeading>
        <div className="mt-3">
          <Heatmap done={done} color={habit.color} weeks={27} />
        </div>
      </div>

      {/* ───────── 可點月曆（補打卡） ───────── */}
      <div>
        <LeafHeading
          icon={CalendarRange}
          right={
            <div className="flex items-center gap-1">
              <IconButton label="上個月" size="sm" onClick={() => shiftMonth(-1)}>
                <ChevronLeft size={16} />
              </IconButton>
              <span className="min-w-[5.5rem] text-center font-serif text-sm font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                {ym.y}年{MONTH_LABELS[ym.m]}
              </span>
              <IconButton label="下個月" size="sm" onClick={() => shiftMonth(1)}>
                <ChevronRight size={16} />
              </IconButton>
            </div>
          }
        >
          月曆檢視
        </LeafHeading>
        <div className="mt-3 grid grid-cols-7 gap-1 rounded-2xl border border-slate-200/70 bg-[#fcfbf7] p-2.5 dark:border-slate-700/50 dark:bg-slate-800/40">
          {WEEKDAY_LABELS.map((w) => (
            <div key={w} className="py-1 text-center text-[11px] font-medium text-slate-400 dark:text-slate-500">
              {w}
            </div>
          ))}
          {cells.map((cell) => {
            const key = toKey(cell)
            const inMonth = cell.getMonth() === ym.m
            const isDone = done.has(key)
            const isToday = key === tKey
            const future = key > tKey
            const wd = cell.getDay()
            const scheduled =
              habit.frequency.kind !== 'weekdays' || habit.frequency.days.includes(wd)
            return (
              <button
                key={key}
                type="button"
                disabled={future}
                onClick={() => onToggle(habit.id, key)}
                aria-pressed={isDone}
                aria-label={`${key} ${isDone ? '已完成' : '未完成'}`}
                className={cx(
                  'flex aspect-square items-center justify-center rounded-lg text-xs font-medium tabular-nums transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-30',
                  isDone
                    ? cx(spec.solid, 'shadow-xs')
                    : scheduled
                      ? 'bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-700/60 dark:text-slate-300 dark:hover:bg-slate-600'
                      : 'text-slate-300 hover:bg-white dark:text-slate-600 dark:hover:bg-slate-700/40',
                  !inMonth && 'opacity-40',
                  isToday && !isDone && cx('ring-2 ring-inset', spec.ring),
                )}
              >
                {cell.getDate()}
              </button>
            )
          })}
        </div>
        <p className="mt-2 text-center text-[11px] text-slate-400 dark:text-slate-500">
          淡色 = 非排程日 · 外框 = 今日 · 未來日子不可打卡
        </p>
      </div>
    </Modal>
  )
}

// ───────── 曆書分節抬頭（小帽 + icon + hairline 收尾；呼應主畫面 SectionLabel / 編輯器 AlmanacHeading）─────────
function LeafHeading({
  icon: Icon,
  children,
  right,
}: {
  icon: typeof Flame
  children: ReactNode
  right?: ReactNode
}) {
  return (
    <div className="flex items-center gap-2">
      <p className="flex shrink-0 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
        <Icon size={12} className="shrink-0" />
        {children}
      </p>
      <span aria-hidden="true" className="h-px flex-1 bg-slate-200/80 dark:bg-slate-700/60" />
      {right && <div className="shrink-0">{right}</div>}
    </div>
  )
}

// ───────── 曆書帶統計格（hairline grid · serif 大數字；目前連續 hot 高亮，呼應主畫面 AlmanacStat）─────────
function LeafStat({
  label,
  value,
  unit,
  icon: Icon,
  hot,
}: {
  label: string
  value: number | string
  unit?: string
  icon: typeof Flame
  hot?: boolean
}) {
  return (
    <div
      className={cx(
        'px-3.5 py-3 transition-colors',
        hot ? 'bg-amber-50 dark:bg-amber-500/10' : 'bg-white dark:bg-slate-800',
      )}
    >
      <p
        className={cx(
          'flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide',
          hot ? 'text-amber-600/80 dark:text-amber-400/80' : 'text-slate-400 dark:text-slate-500',
        )}
      >
        <Icon size={12} className="shrink-0" />
        <span className="truncate">{label}</span>
      </p>
      <p
        className={cx(
          'mt-1 font-serif text-[26px] font-semibold leading-none tabular-nums slashed-zero',
          hot ? 'text-amber-600 dark:text-amber-400' : 'text-slate-800 dark:text-slate-100',
        )}
      >
        {value}
        {unit && <span className="ml-1 font-sans text-sm font-normal text-slate-400">{unit}</span>}
      </p>
    </div>
  )
}
