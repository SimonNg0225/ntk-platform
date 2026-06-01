import { Coffee, Plus, Utensils, AlertTriangle } from 'lucide-react'
import type { TimetableSlot } from '../../../data/types'
import { cx } from '../../../ui'
import {
  autoColorFor,
  colorOf,
  cycleShort,
  dayShort,
  type BellRow,
  type SlotMeta,
} from './util'

export default function WeekGrid({
  bells,
  days,
  cycle,
  todayDay,
  slotByKey,
  metaByKey,
  classNameById,
  conflictKeys,
  dimClassId,
  onOpenCell,
}: {
  bells: BellRow[]
  days: number[]
  cycle?: boolean
  todayDay: number
  slotByKey: Map<string, TimetableSlot>
  metaByKey: Map<string, SlotMeta>
  classNameById: Map<string, string>
  conflictKeys: Set<string>
  dimClassId: string // '' = 全部；否則非此班別嘅格淡化
  onOpenCell: (day: number, period: number) => void
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white p-2 dark:border-slate-700/60 dark:bg-slate-800 sm:p-3">
      <table className="w-full min-w-[680px] border-separate border-spacing-x-1 border-spacing-y-1 text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 w-24 bg-white px-2 pb-2 text-left text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:bg-slate-800 dark:text-slate-500">
              節數 / 時間
            </th>
            {days.map((day) => {
              const isToday = day === todayDay
              return (
                <th
                  key={day}
                  className={cx(
                    'rounded-xl px-2 py-1.5 text-center text-xs font-semibold transition-colors',
                    isToday
                      ? 'bg-accent text-white shadow-sm shadow-accent/25'
                      : 'text-slate-500 dark:text-slate-400',
                  )}
                >
                  <span className="inline-flex items-center gap-1">
                    {cycle ? `Day ${cycleShort(day)}` : `星期${dayShort(day)}`}
                    {isToday && (
                      <span className="rounded-full bg-white/25 px-1.5 py-px text-[9px] font-bold">
                        今日
                      </span>
                    )}
                  </span>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {bells.map((bell, idx) => {
            if (bell.kind !== 'lesson') {
              // 小息 / 午膳：整行橫跨
              const Icon = bell.kind === 'lunch' ? Utensils : Coffee
              return (
                <tr key={`break-${idx}`}>
                  <td colSpan={days.length + 1} className="px-1 py-0.5">
                    <div className="flex items-center justify-center gap-1.5 rounded-full bg-slate-50 py-1 text-[11px] font-medium text-slate-400 dark:bg-slate-900/40 dark:text-slate-500">
                      <Icon size={12} />
                      {bell.label}
                      <span className="tabular-nums">
                        {bell.start}–{bell.end}
                      </span>
                    </div>
                  </td>
                </tr>
              )
            }
            return (
              <tr key={bell.period} className="group/row">
                <th className="sticky left-0 z-10 bg-white px-2 py-1.5 text-left align-middle dark:bg-slate-800">
                  <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    第 {bell.period} 節
                  </div>
                  <div className="tabular-nums text-[10px] text-slate-400 dark:text-slate-500">
                    {bell.start}–{bell.end}
                  </div>
                </th>
                {days.map((day) => {
                  const key = `${day}-${bell.period}`
                  const slot = slotByKey.get(key)
                  const meta = metaByKey.get(key)
                  const isToday = day === todayDay
                  const className = slot?.classId
                    ? classNameById.get(slot.classId)
                    : undefined
                  const title = slot?.subject || className || ''
                  const color = colorOf(
                    meta?.color || autoColorFor(slot?.subject || slot?.classId || 'x'),
                  )
                  const hasConflict = conflictKeys.has(key)
                  const dimmed =
                    !!dimClassId && !!slot && slot.classId !== dimClassId
                  const cellPos = `${cycle ? `Day ${cycleShort(day)}` : `星期${dayShort(day)}`} 第 ${bell.period} 節`
                  const cellLabel = slot
                    ? `編輯 ${cellPos}：${title || className || '課堂'}${hasConflict ? '（撞堂）' : ''}`
                    : `新增課堂 — ${cellPos}`
                  return (
                    <td
                      key={day}
                      className={cx(
                        'rounded-xl p-0 align-top',
                        isToday && 'bg-accent-soft/30 dark:bg-accent/5',
                      )}
                    >
                      <button
                        type="button"
                        aria-label={cellLabel}
                        onClick={() => onOpenCell(day, bell.period)}
                        className={cx(
                          'group relative flex h-[78px] w-full flex-col items-start gap-1 rounded-xl p-2 text-left transition duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
                          slot
                            ? cx(
                                color.cell,
                                'shadow-xs hover:-translate-y-0.5 hover:shadow-md',
                                dimmed && 'opacity-30',
                              )
                            : 'border border-dashed border-slate-200/70 hover:border-accent/40 hover:bg-accent-soft/40 dark:border-slate-700/60 dark:hover:bg-accent/10',
                        )}
                      >
                        {slot ? (
                          <>
                            {hasConflict && (
                              <span
                                className="absolute right-1 top-1 text-rose-500"
                                title="撞堂"
                              >
                                <AlertTriangle size={13} />
                              </span>
                            )}
                            <span className="line-clamp-2 pr-3 text-[13px] font-semibold leading-tight">
                              {title}
                            </span>
                            <div className="mt-auto flex flex-wrap items-center gap-1">
                              {className && (
                                <span className="rounded bg-black/5 px-1 py-px text-[10px] font-medium dark:bg-white/10">
                                  {className}
                                </span>
                              )}
                              {slot.room && (
                                <span className="rounded bg-black/5 px-1 py-px text-[10px] dark:bg-white/10">
                                  {slot.room}
                                </span>
                              )}
                              {meta?.week && meta.week !== 'all' && (
                                <span className="rounded bg-black/5 px-1 py-px text-[10px] font-semibold dark:bg-white/10">
                                  {meta.week}
                                </span>
                              )}
                            </div>
                          </>
                        ) : (
                          <Plus
                            size={16}
                            className="m-auto text-slate-300 transition group-hover:text-accent dark:text-slate-600 dark:group-hover:text-accent"
                            aria-hidden
                          />
                        )}
                      </button>
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
