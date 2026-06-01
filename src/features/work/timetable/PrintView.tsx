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

// ============================================================
//  列印友善週課表
//  - 螢幕上係預覽卡；撳「列印」用瀏覽器列印（print:* 隱藏外框）
//  - 線條簡潔、淺底，慳墨水
// ============================================================

export default function PrintView({
  title,
  cycle,
  bells,
  days,
  slotByKey,
  metaByKey,
  classNameById,
}: {
  title: string
  cycle?: boolean
  bells: BellRow[]
  days: number[]
  slotByKey: Map<string, TimetableSlot>
  metaByKey: Map<string, SlotMeta>
  classNameById: Map<string, string>
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-700/60 dark:bg-slate-800 dark:shadow-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
      <div className="mb-4 text-center">
        <h2 className="text-lg font-bold tracking-tight text-slate-800 dark:text-slate-100">
          {title}
        </h2>
        <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
          每週教學時間表 · 共 <span className="tabular-nums">{slotByKey.size}</span> 節
        </p>
      </div>

      <table className="w-full table-fixed border-collapse text-[11px]">
        <thead>
          <tr>
            <th className="w-16 border border-slate-300 bg-slate-50 p-1 text-slate-600 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300">
              節 / 時間
            </th>
            {days.map((day) => (
              <th
                key={day}
                className="border border-slate-300 bg-slate-50 p-1 text-slate-600 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300"
              >
                {cycle ? `Day ${cycleShort(day)}` : `星期${dayShort(day)}`}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bells.map((bell, idx) => {
            if (bell.kind !== 'lesson') {
              return (
                <tr key={`b-${idx}`}>
                  <td
                    colSpan={days.length + 1}
                    className="border border-slate-300 bg-slate-100/70 p-0.5 text-center text-[10px] text-slate-500 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-400"
                  >
                    {bell.label}（{bell.start}–{bell.end}）
                  </td>
                </tr>
              )
            }
            return (
              <tr key={bell.period}>
                <td className="border border-slate-300 bg-slate-50 p-1 text-center align-middle dark:border-slate-600 dark:bg-slate-700/50">
                  <div className="font-semibold text-slate-700 dark:text-slate-200">
                    {bell.period}
                  </div>
                  <div className="tabular-nums text-[9px] text-slate-400">
                    {bell.start}
                  </div>
                </td>
                {days.map((day) => {
                  const key = `${day}-${bell.period}`
                  const slot = slotByKey.get(key)
                  const meta = metaByKey.get(key)
                  const className = slot?.classId
                    ? classNameById.get(slot.classId)
                    : undefined
                  const c = colorOf(
                    meta?.color || autoColorFor(slot?.subject || slot?.classId || 'x'),
                  )
                  return (
                    <td
                      key={day}
                      className="h-12 border border-slate-300 p-1 align-top dark:border-slate-600"
                    >
                      {slot && (
                        <div className="flex h-full flex-col">
                          <span
                            className={cx(
                              'rounded px-1 font-semibold leading-tight',
                              c.soft,
                            )}
                          >
                            {slot.subject || className}
                          </span>
                          <span className="mt-auto flex flex-wrap gap-1 text-[9px] text-slate-500 dark:text-slate-400">
                            {className && <span>{className}</span>}
                            {slot.room && <span>· {slot.room}</span>}
                            {meta?.week && meta.week !== 'all' && (
                              <span>· {meta.week}</span>
                            )}
                          </span>
                        </div>
                      )}
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
