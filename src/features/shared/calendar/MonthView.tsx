import { useRef } from 'react'
import type { CalendarEvent } from '../../../data/types'
import { cx } from '../../../ui'
import {
  WEEKDAYS,
  colorOf,
  isAllDay,
  monthMatrix,
  toKey,
  todayKey,
  type Occurrence,
} from './util'

export default function MonthView({
  year,
  month,
  occByDate,
  selectedKey,
  onSelectDay,
  onOpenEvent,
  onMoreDay,
  onMoveToDay,
}: {
  year: number
  month: number
  occByDate: Map<string, Occurrence[]>
  selectedKey: string
  onSelectDay: (key: string) => void
  onOpenEvent: (ev: CalendarEvent, dateKey: string) => void
  onMoreDay: (key: string) => void
  onMoveToDay: (ev: CalendarEvent, dateKey: string) => void
}) {
  const cells = monthMatrix(year, month)
  const tKey = todayKey()
  const dragRef = useRef<{ ev: CalendarEvent; from: string } | null>(null)

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700/60">
      {/* 星期標頭 */}
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/80 text-center text-xs font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-2">
            {w}
          </div>
        ))}
      </div>

      {/* 6 行格仔 */}
      <div className="grid flex-1 grid-cols-7 grid-rows-6">
        {cells.map((cell, i) => {
          const key = toKey(cell)
          const inMonth = cell.getMonth() === month
          const isToday = key === tKey
          const isSelected = key === selectedKey
          const list = occByDate.get(key) ?? []
          const isSun = i % 7 === 0

          return (
            <button
              key={key}
              type="button"
              aria-label={`${cell.getMonth() + 1}月${cell.getDate()}日，${list.length} 項活動`}
              aria-current={isToday ? 'date' : undefined}
              aria-pressed={isSelected}
              onClick={() => onSelectDay(key)}
              onDragOver={(e) => {
                if (dragRef.current) e.preventDefault()
              }}
              onDrop={() => {
                const d = dragRef.current
                dragRef.current = null
                if (d && d.from !== key) onMoveToDay(d.ev, key)
              }}
              className={cx(
                'group flex min-h-0 flex-col items-stretch border-b border-r border-slate-100 p-1 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40 dark:border-slate-800',
                isSun && '',
                isSelected
                  ? 'bg-accent-soft/60 dark:bg-accent/10'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-800/50',
                !inMonth && 'bg-slate-50/40 dark:bg-slate-900/30',
              )}
            >
              {/* 日期數字 */}
              <div className="flex items-center justify-center sm:justify-start">
                <span
                  className={cx(
                    'flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums sm:text-[13px]',
                    isToday
                      ? 'bg-accent text-white'
                      : inMonth
                        ? 'text-slate-700 dark:text-slate-200'
                        : 'text-slate-300 dark:text-slate-600',
                  )}
                >
                  {cell.getDate()}
                </span>
              </div>

              {/* 桌面：彩色 chip（最多 3）+ N */}
              <div className="mt-0.5 hidden min-h-0 flex-1 flex-col gap-0.5 overflow-hidden sm:flex">
                {list.slice(0, 3).map((occ) => {
                  const c = colorOf(occ.category?.color)
                  return (
                    <button
                      key={`${occ.event.id}-${occ.dateKey}`}
                      type="button"
                      draggable
                      onDragStart={() => {
                        dragRef.current = { ev: occ.event, from: occ.dateKey }
                      }}
                      onDragEnd={() => {
                        dragRef.current = null
                      }}
                      onClick={(e) => {
                        e.stopPropagation()
                        onOpenEvent(occ.event, occ.dateKey)
                      }}
                      className={cx(
                        'flex cursor-grab items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[11px] leading-tight active:cursor-grabbing',
                        c.chip,
                      )}
                    >
                      {!isAllDay(occ.event) && (
                        <span className="shrink-0 tabular-nums opacity-70">
                          {occ.event.time}
                        </span>
                      )}
                      <span className="truncate">{occ.event.title}</span>
                    </button>
                  )
                })}
                {list.length > 3 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onMoreDay(key)
                    }}
                    className="px-1 text-left text-[11px] font-medium tabular-nums text-slate-400 hover:text-accent dark:text-slate-500"
                  >
                    +{list.length - 3} 項
                  </button>
                )}
              </div>

              {/* 手機：彩色小圓點 */}
              <div className="mt-auto flex items-center justify-center gap-0.5 pb-0.5 sm:hidden">
                {list.slice(0, 4).map((occ) => (
                  <span
                    key={`${occ.event.id}-${occ.dateKey}`}
                    className={cx(
                      'h-1.5 w-1.5 rounded-full',
                      colorOf(occ.category?.color).dot,
                    )}
                  />
                ))}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
