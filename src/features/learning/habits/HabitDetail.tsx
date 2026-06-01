import { useMemo, useState } from 'react'
import {
  Modal,
  Button,
  Badge,
  StatCard,
  SectionTitle,
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
      {/* 標題列 */}
      <div className="mb-5 flex items-start gap-3">
        <span
          className={cx(
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl',
            spec.soft,
          )}
        >
          {habit.icon ?? '⭐'}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-bold text-slate-900 dark:text-slate-100">
            {habit.name}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
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
      </div>

      {habit.notes && (
        <p className="mb-5 rounded-xl border border-slate-200/70 bg-slate-50 px-3.5 py-2.5 text-sm leading-relaxed text-slate-600 dark:border-slate-700/50 dark:bg-slate-700/40 dark:text-slate-300">
          {habit.notes}
        </p>
      )}

      {/* 四大統計 */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="目前連續" value={stats.cur} unit="日" icon={Flame} highlight={stats.cur > 0} />
        <StatCard label="史上最長" value={stats.best} unit="日" icon={Trophy} />
        <StatCard label="30 日完成" value={`${stats.rate30}%`} icon={Percent} />
        <StatCard label="累計打卡" value={stats.total} unit="次" icon={CalendarCheck} />
      </div>

      {/* 目標連續進度 */}
      {habit.targetStreak > 0 && (
        <div className="mb-5 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
              <Target size={15} className={spec.text} />
              目標連續 {habit.targetStreak} 日
            </span>
            <span className={cx('text-sm font-semibold tabular-nums', spec.text)}>
              {stats.cur}/{habit.targetStreak}
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
            <div
              className={cx('h-full rounded-full transition-all duration-500', spec.solid)}
              style={{ width: `${targetPct}%` }}
            />
          </div>
          {stats.cur >= habit.targetStreak && (
            <p className="mt-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              🎉 已達成目標！繼續保持。
            </p>
          )}
        </div>
      )}

      {/* 年度 heatmap */}
      <div className="mb-6">
        <SectionTitle>年度打卡熱圖</SectionTitle>
        <Heatmap done={done} color={habit.color} weeks={27} />
      </div>

      {/* 可點月曆 */}
      <div>
        <SectionTitle
          right={
            <div className="flex items-center gap-1">
              <IconButton label="上個月" size="sm" onClick={() => shiftMonth(-1)}>
                <ChevronLeft size={16} />
              </IconButton>
              <span className="min-w-[5.5rem] text-center text-sm font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                {ym.y}年{MONTH_LABELS[ym.m]}
              </span>
              <IconButton label="下個月" size="sm" onClick={() => shiftMonth(1)}>
                <ChevronRight size={16} />
              </IconButton>
            </div>
          }
        >
          月曆檢視（點格補打卡）
        </SectionTitle>
        <div className="grid grid-cols-7 gap-1 rounded-2xl border border-slate-200/70 bg-slate-50/50 p-2.5 dark:border-slate-700/50 dark:bg-slate-800/40">
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
