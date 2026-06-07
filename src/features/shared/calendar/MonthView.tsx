import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import './i18n'
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
  const { t } = useTranslation()
  const cells = monthMatrix(year, month)
  const tKey = todayKey()
  const dragRef = useRef<{ ev: CalendarEvent; from: string } | null>(null)

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xs dark:border-slate-700/60 dark:bg-slate-800 dark:shadow-none">
      {/* 星期標頭 —— 週末用淡色，去掉硬底線改幼分隔 */}
      <div className="grid grid-cols-7 px-1 pb-1 pt-2.5 text-center">
        {WEEKDAYS.map((w, i) => (
          <div
            key={w}
            className={cx(
              'text-[11px] font-semibold uppercase tracking-wide',
              i === 0 || i === 6
                ? 'text-slate-300 dark:text-slate-600'
                : 'text-slate-400 dark:text-slate-500',
            )}
          >
            {w}
          </div>
        ))}
      </div>

      {/* 6 行格仔 —— 用內襯幼線分隔（gap + ring）取代逐格硬框 */}
      <div className="grid flex-1 grid-cols-7 grid-rows-6 gap-px bg-slate-100/70 dark:bg-slate-700/40">
        {cells.map((cell, i) => {
          const key = toKey(cell)
          const inMonth = cell.getMonth() === month
          const isToday = key === tKey
          const isSelected = key === selectedKey
          const list = occByDate.get(key) ?? []
          const isWeekend = i % 7 === 0 || i % 7 === 6

          return (
            <button
              key={key}
              type="button"
              aria-label={t('cal.dayAria', {
                month: cell.getMonth() + 1,
                day: cell.getDate(),
                count: list.length,
                defaultValue: `${cell.getMonth() + 1}月${cell.getDate()}日，${list.length} 項活動`,
              })}
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
                'group relative flex min-h-0 flex-col items-stretch p-1 text-left transition-colors duration-200 focus:outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40',
                // 底色層次：今日柔和 accent 暈染 > 選中淡 accent > 平日白 / 週末微灰 / 鄰月更淡
                isToday
                  ? 'bg-accent-soft/70 dark:bg-accent/15'
                  : isSelected
                    ? 'bg-accent-soft/40 dark:bg-accent/10'
                    : !inMonth
                      ? 'bg-slate-50/70 hover:bg-slate-100/70 dark:bg-slate-900/40 dark:hover:bg-slate-800/60'
                      : isWeekend
                        ? 'bg-slate-50/40 hover:bg-slate-100/60 dark:bg-slate-800/40 dark:hover:bg-slate-800/70'
                        : 'bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-800/60',
                // 選中態：內襯 accent 細框，輕巧唔搶
                isSelected && !isToday && 'ring-1 ring-inset ring-accent/30',
              )}
            >
              {/* 日期數字 —— 今日填實 accent 圓點，其餘淨數字 */}
              <div className="flex items-center justify-center sm:justify-start">
                <span
                  className={cx(
                    'flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-semibold tabular-nums transition sm:text-[13px]',
                    isToday
                      ? 'bg-accent text-white shadow-sm shadow-accent/30'
                      : inMonth
                        ? isWeekend
                          ? 'text-slate-400 dark:text-slate-500'
                          : 'text-slate-700 dark:text-slate-200'
                        : 'text-slate-300 dark:text-slate-600',
                  )}
                >
                  {cell.getDate()}
                </span>
              </div>

              {/* 桌面：柔和事件 chip（前置色點 + 標題，最多 3）+ N */}
              <div className="mt-1 hidden min-h-0 flex-1 flex-col gap-1 overflow-hidden sm:flex">
                {list.slice(0, 3).map((occ) => {
                  const c = colorOf(occ.category?.color)
                  const timed = !isAllDay(occ.event)
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
                        'flex cursor-grab items-center gap-1.5 truncate rounded-md py-0.5 pl-1.5 pr-1 text-left text-[11px] font-medium leading-tight transition duration-200 hover:brightness-95 active:cursor-grabbing dark:hover:brightness-110',
                        timed
                          ? 'text-slate-600 hover:bg-slate-100/80 dark:text-slate-300 dark:hover:bg-slate-700/50'
                          : c.chip,
                      )}
                    >
                      <span
                        className={cx(
                          'h-1.5 w-1.5 shrink-0 rounded-full',
                          colorOf(occ.category?.color).dot,
                        )}
                      />
                      {timed && (
                        <span className="shrink-0 tabular-nums text-slate-400 dark:text-slate-500">
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
                    className="px-1.5 text-left text-[11px] font-medium tabular-nums text-slate-400 transition hover:text-accent dark:text-slate-500"
                  >
                    {t('cal.moreCount', { count: list.length - 3, defaultValue: `還有 ${list.length - 3} 項` })}
                  </button>
                )}
              </div>

              {/* 手機：彩色小圓點 */}
              <div className="mt-auto flex items-center justify-center gap-1 pb-0.5 sm:hidden">
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
