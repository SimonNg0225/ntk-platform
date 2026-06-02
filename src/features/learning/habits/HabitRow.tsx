import { IconButton, cx } from '../../../ui'
import { Flame, Check, ChevronRight } from 'lucide-react'
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
//  習慣列（「全部」/「今日」清單用）
//  ------------------------------------------------------------
//  訂造概念：連續鏈條（streak chain）。
//  右側 14 日「鏈節」——完成日係實心節點，相鄰完成日之間以連桿駁起，
//  一條未斷嘅鏈 = 一段未斷嘅連勝；一斷就見到鏈缺口。一眼睇到節奏。
// ============================================================

// 鏈條長度（日）：手機收窄、桌面展開
const CHAIN_DAYS_MOBILE = 7
const CHAIN_DAYS_DESKTOP = 14

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
  const week = thisWeekProgress(done, habit.frequency)

  return (
    <div className="flex items-center gap-3.5 p-4">
      {/* 大圓打卡鈕（今日）— 完成時實心 + 火花，未完成虛線等待感 */}
      <button
        type="button"
        onClick={() => onToggle(habit.id, tKey)}
        aria-pressed={doneToday}
        aria-label={`${habit.name} 今日${doneToday ? '已完成' : '打卡'}`}
        className={cx(
          'group/check relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-lg transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-95',
          doneToday
            ? cx(spec.solid, 'shadow-sm')
            : cx(
                'border-[1.5px] border-dashed bg-transparent',
                dueToday
                  ? 'border-slate-300 text-slate-400 hover:border-slate-400 hover:bg-slate-50 dark:border-slate-600 dark:hover:border-slate-500 dark:hover:bg-slate-700/40'
                  : 'border-slate-200 text-slate-300 dark:border-slate-700 dark:text-slate-600',
              ),
        )}
      >
        {doneToday ? (
          <Check size={22} strokeWidth={3} className="transition-transform duration-200" />
        ) : (
          <span aria-hidden="true">{habit.icon ?? '⭐'}</span>
        )}
      </button>

      {/* 名稱 + meta */}
      <button
        type="button"
        onClick={() => onOpen(habit)}
        className="min-w-0 flex-1 text-left"
      >
        <h3 className="truncate text-[15px] font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          {habit.name}
        </h3>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-400 dark:text-slate-500">
          {streak > 0 ? (
            <span className={cx('inline-flex items-center gap-1 font-semibold', spec.text)}>
              <Flame size={13} className="shrink-0" />
              <span className="tabular-nums">{streak}</span> 日連續
            </span>
          ) : (
            <span className="text-slate-400 dark:text-slate-500">未開始連續</span>
          )}
          <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">·</span>
          <span>{freqLabel(habit.frequency)}</span>
          {habit.frequency.kind === 'weekly' && (
            <span className="tabular-nums">· 本週 {week.count}/{week.target}</span>
          )}
        </div>
      </button>

      {/* 連續鏈條（桌面 14 日 / 手機 7 日）— 完成節點以連桿駁成一條鏈 */}
      <div className="hidden sm:block">
        <StreakChain
          habit={habit}
          done={done}
          days={CHAIN_DAYS_DESKTOP}
          tKey={tKey}
          onToggle={onToggle}
        />
      </div>
      <div className="block sm:hidden">
        <StreakChain
          habit={habit}
          done={done}
          days={CHAIN_DAYS_MOBILE}
          tKey={tKey}
          onToggle={onToggle}
        />
      </div>

      <IconButton label={`${habit.name} 詳情`} onClick={() => onOpen(habit)} className="shrink-0">
        <ChevronRight size={18} />
      </IconButton>
    </div>
  )
}

// ───────── 連續鏈條（streak chain）─────────
//  每節 = 一日；完成 = 實心圓節點，相鄰完成日之間畫連桿（鏈駁起）。
//  今日格加外框；非排程日（weekdays 模式）淡化做底色。可逐格補打卡。
function StreakChain({
  habit,
  done,
  days,
  tKey,
  onToggle,
}: {
  habit: Habit
  done: Set<string>
  days: number
  tKey: string
  onToggle: (habitId: string, dateKey: string) => void
}) {
  const spec = colorOf(habit.color)
  const keys = recentDays(days)

  return (
    <div className="flex items-end gap-0">
      {keys.map((k, i) => {
        const isDone = done.has(k)
        const isToday = k === tKey
        const wd = weekdayOf(k)
        const prevDone = i > 0 && done.has(keys[i - 1])
        // 連桿：當前一格同呢格都完成，先連線（視覺上「鏈未斷」）。
        const linked = isDone && prevDone
        const scheduled =
          habit.frequency.kind !== 'weekdays' || habit.frequency.days.includes(wd)
        return (
          <div key={k} className="flex flex-col items-center gap-1">
            {/* 星期標（只標頭尾少數，留白唔擠迫；今日標「今」）*/}
            <span
              className={cx(
                'h-3 text-[9px] leading-none',
                isToday
                  ? cx('font-semibold', spec.text)
                  : 'text-slate-300 dark:text-slate-600',
              )}
            >
              {isToday ? '今' : i % 2 === 1 ? WEEKDAY_LABELS[wd] : ''}
            </span>
            <div className="relative flex items-center">
              {/* 連桿（駁去前一節）*/}
              {i > 0 && (
                <span
                  aria-hidden="true"
                  className={cx(
                    'h-[3px] w-2 shrink-0 transition-colors duration-200',
                    linked ? spec.solid.split(' ')[0] : 'bg-transparent',
                  )}
                />
              )}
              <button
                type="button"
                onClick={() => onToggle(habit.id, k)}
                aria-label={`${k} ${isDone ? '已完成' : '未完成'}`}
                className={cx(
                  'relative h-[18px] w-[18px] shrink-0 rounded-full transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
                  isDone
                    ? cx(spec.solid, 'shadow-xs')
                    : scheduled
                      ? 'bg-slate-100 ring-1 ring-inset ring-slate-200/70 hover:bg-slate-200 dark:bg-slate-700/60 dark:ring-slate-600/50 dark:hover:bg-slate-600'
                      : 'bg-slate-50 ring-1 ring-inset ring-slate-200/60 dark:bg-slate-800/60 dark:ring-slate-700/50',
                  isToday && !isDone && cx('ring-2', spec.ring),
                )}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
