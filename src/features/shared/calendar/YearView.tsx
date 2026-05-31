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
    <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-slate-200 p-3 dark:border-slate-700/60">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 12 }, (_, month) => {
          const cells = monthMatrix(year, month)
          return (
            <div key={month}>
              <button
                type="button"
                onClick={() => onPickMonth(month)}
                className="mb-1 text-sm font-semibold text-accent transition-colors hover:text-accent-strong"
              >
                {month + 1}月
              </button>
              <div className="grid grid-cols-7 gap-px text-center text-[9px] text-slate-400 dark:text-slate-500">

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
                        'flex aspect-square items-center justify-center rounded-full text-[10px] tabular-nums transition-colors',
                        isToday
                          ? 'bg-accent font-semibold text-white'
                          : has
                            ? 'font-semibold text-accent hover:bg-accent-soft'
                            : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
                      )}
                    >
                      {cell.getDate()}
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
