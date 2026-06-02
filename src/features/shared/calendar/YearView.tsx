import { cx } from '../../../ui'
import { WEEKDAYS, monthMatrix, toKey, todayKey, type Occurrence } from './util'

export default function YearView({
  year,
  occByDate,
  onPickMonth,
  onPickDay,
}: {
  year: number
  occByDate: Map<string, Occurrence[]>
  onPickMonth: (month: number) => void
  onPickDay: (dateKey: string) => void
}) {
  const tKey = todayKey()

  return (
    <div className="min-h-0 flex-1 overflow-y-auto rounded-3xl border border-slate-200/80 bg-white p-3 shadow-xs dark:border-slate-700/60 dark:bg-slate-800 dark:shadow-none sm:p-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
        {Array.from({ length: 12 }, (_, month) => {
          const cells = monthMatrix(year, month)
          return (
            <div
              key={month}
              className="rounded-2xl border border-slate-100 bg-slate-50/40 p-3 transition duration-200 hover:border-slate-200 hover:bg-white hover:shadow-xs dark:border-slate-700/50 dark:bg-slate-800/40 dark:hover:border-slate-600 dark:hover:bg-slate-800"
            >
              <button
                type="button"
                onClick={() => onPickMonth(month)}
                className="mb-1.5 inline-flex items-baseline gap-1 font-serif text-base font-semibold text-slate-700 transition-colors hover:text-accent dark:text-slate-200"
              >
                {month + 1}
                <span className="text-[11px] font-sans font-medium text-slate-400 dark:text-slate-500">月</span>
              </button>
              <div className="grid grid-cols-7 gap-px text-center text-[9px] text-slate-300 dark:text-slate-600">
                {WEEKDAYS.map((w) => (
                  <div key={w} className="pb-0.5">
                    {w}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-px">
                {cells.map((cell) => {
                  const inMonth = cell.getMonth() === month
                  const key = toKey(cell)
                  const isToday = key === tKey
                  const has = inMonth && occByDate.has(key)
                  if (!inMonth) return <div key={key} />
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-label={`${month + 1}月${cell.getDate()}日${has ? '，有活動' : ''}`}
                      aria-current={isToday ? 'date' : undefined}
                      onClick={() => onPickDay(key)}
                      className={cx(
                        'relative flex aspect-square items-center justify-center rounded-full text-[10px] tabular-nums transition-colors',
                        isToday
                          ? 'bg-accent font-semibold text-white shadow-sm shadow-accent/30'
                          : 'text-slate-600 hover:bg-accent-soft/70 dark:text-slate-300 dark:hover:bg-accent/15',
                      )}
                    >
                      {cell.getDate()}
                      {/* 有活動：底部柔和 accent 圓點（唔搶日子數字） */}
                      {has && !isToday && (
                        <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-accent/70" />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
