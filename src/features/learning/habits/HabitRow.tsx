import { Badge, IconButton, cx } from '../../../ui'
import { Flame, Check, MoreVertical } from 'lucide-react'
import { colorOf, freqLabel, type Habit } from './types'
import {
  currentStreak,
  recentDays,
  todayKey,
  weekdayOf,
  WEEKDAY_LABELS,
  thisWeekProgress,
} from './util'

// ============================================================
//  習慣列（「全部」清單用）— 7 日迷你格 + streak + 快速打卡
// ============================================================

export default function HabitRow({
  habit,
  done,
  onToggle,
  onOpen,
}: {
  habit: Habit
  done: Set<string>
  onToggle: (habitId: string, dateKey: string) => void
  onOpen: (habit: Habit) => void
}) {
  const spec = colorOf(habit.color)
  const tKey = todayKey()
  const streak = currentStreak(done, habit.frequency)
  const todayWd = new Date().getDay()
  const dueToday =
    habit.frequency.kind !== 'weekdays' || habit.frequency.days.includes(todayWd)
  const doneToday = done.has(tKey)
  const last7 = recentDays(7)
  const week = thisWeekProgress(done, habit.frequency)

  return (
    <div className="flex items-center gap-3 p-4">
      {/* 大圓打卡鈕（今日） */}
      <button
        type="button"
        onClick={() => onToggle(habit.id, tKey)}
        aria-pressed={doneToday}
        aria-label={`${habit.name} 今日${doneToday ? '已完成' : '打卡'}`}
        className={cx(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-95',
          doneToday
            ? spec.solid
            : cx(
                'border-2 border-dashed bg-transparent',
                dueToday
                  ? 'border-slate-300 text-slate-400 hover:border-slate-400 dark:border-slate-600 dark:hover:border-slate-500'
                  : 'border-slate-200 text-slate-300 dark:border-slate-700 dark:text-slate-600',
              ),
        )}
      >
        {doneToday ? <Check size={20} strokeWidth={3} /> : <span>{habit.icon ?? '⭐'}</span>}
      </button>

      {/* 名稱 + meta */}
      <button
        type="button"
        onClick={() => onOpen(habit)}
        className="min-w-0 flex-1 text-left"
      >
        <h3 className="truncate text-[15px] font-semibold text-slate-900 dark:text-slate-100">
          {habit.name}
        </h3>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <Badge tone={streak > 0 ? 'amber' : 'slate'} icon={Flame}>
            <span className="tabular-nums">{streak}</span> 日
          </Badge>
          <span className="text-xs text-slate-400 dark:text-slate-500">
            {freqLabel(habit.frequency)}
          </span>
          {habit.frequency.kind === 'weekly' && (
            <span className="text-xs tabular-nums text-slate-400 dark:text-slate-500">
              · 本週 {week.count}/{week.target}
            </span>
          )}
        </div>
      </button>

      {/* 7 日迷你格（桌面） */}
      <div className="hidden items-center gap-1 sm:flex">
        {last7.map((k) => {
          const isDone = done.has(k)
          const isToday = k === tKey
          const wd = weekdayOf(k)
          return (
            <div key={k} className="flex flex-col items-center gap-1">
              <span className="text-[9px] text-slate-300 dark:text-slate-600">
                {WEEKDAY_LABELS[wd]}
              </span>
              <button
                type="button"
                onClick={() => onToggle(habit.id, k)}
                aria-label={`${k} ${isDone ? '已完成' : '未完成'}`}
                className={cx(
                  'h-6 w-6 rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
                  isDone
                    ? spec.solid
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-700/60 dark:hover:bg-slate-600',
                  isToday && !isDone && cx('ring-1 ring-inset', spec.ring),
                )}
              />
            </div>
          )
        })}
      </div>

      <IconButton label={`${habit.name} 詳情`} onClick={() => onOpen(habit)} className="shrink-0">
        <MoreVertical size={18} />
      </IconButton>
    </div>
  )
}
