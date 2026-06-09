import { Coffee, Plus, Utensils, AlertTriangle, MapPin } from 'lucide-react'
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
//  週課表網格（去 Excel 化：循環日 token 欄頭 + 柔和堂 chip）
//  ------------------------------------------------------------
//  - 欄頭 = 圓潤 Day A–F token（serif 字母），今日填實 accent 一條 lane
//  - 細線格改成淡 hairline + 大留白，唔再似 spreadsheet
//  - 每堂 = 柔色 chip（左側色棒 + 科目 + 班別/課室 pill）
//  - 小息/午膳 = 中央 hairline 分隔，唔搶視覺
// ============================================================

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
    <div className="overflow-x-auto rounded-3xl border border-slate-200/70 bg-white p-2.5 shadow-xs dark:border-slate-700/60 dark:bg-slate-800 dark:shadow-none sm:p-4">
      <table className="w-full min-w-[600px] border-separate border-spacing-x-1.5 border-spacing-y-1.5 text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 w-20 bg-white pb-2 pl-1 text-left align-bottom text-[10px] font-medium uppercase tracking-[0.15em] text-slate-400 dark:bg-slate-800 dark:text-slate-500">
              節 / 時間
            </th>
            {days.map((day) => {
              const isToday = day === todayDay
              const letter = cycle ? cycleShort(day) : dayShort(day)
              return (
                <th key={day} className="px-0.5 pb-1 align-bottom">
                  <div
                    className={cx(
                      'flex flex-col items-center gap-1 rounded-2xl py-2 transition-colors',
                      isToday
                        ? 'bg-accent text-white shadow-sm shadow-accent/25'
                        : 'text-slate-500 dark:text-slate-400',
                    )}
                  >
                    <span
                      className={cx(
                        'flex h-8 w-8 items-center justify-center rounded-xl text-base font-semibold leading-none',
                        isToday
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-700/60 dark:text-slate-200',
                      )}
                    >
                      {letter}
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wide">
                      {isToday ? '今日' : cycle ? 'Day' : '星期'}
                    </span>
                  </div>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {bells.map((bell, idx) => {
            if (bell.kind !== 'lesson') {
              // 小息 / 午膳：中央 hairline 分隔（唔再用整條實 bar 搶視覺）
              const Icon = bell.kind === 'lunch' ? Utensils : Coffee
              return (
                <tr key={`break-${idx}`}>
                  <td colSpan={days.length + 1} className="px-1 py-0.5">
                    <div className="flex items-center gap-2.5 px-1 text-[11px] font-medium text-slate-400 dark:text-slate-500">
                      <Icon size={12} className="shrink-0" />
                      <span className="shrink-0">{bell.label}</span>
                      <span className="shrink-0 tabular-nums text-slate-300 dark:text-slate-600">
                        {bell.start}–{bell.end}
                      </span>
                      <span
                        aria-hidden="true"
                        className="h-px flex-1 bg-gradient-to-r from-slate-200 to-transparent dark:from-slate-700/70"
                      />
                    </div>
                  </td>
                </tr>
              )
            }
            return (
              <tr key={bell.period} className="group/row">
                <th className="sticky left-0 z-10 bg-white pl-1 pr-2 text-left align-middle dark:bg-slate-800">
                  <div className="text-lg font-semibold leading-none text-slate-700 tabular-nums dark:text-slate-200">
                    {bell.period}
                  </div>
                  <div className="mt-1 tabular-nums text-[10px] leading-tight text-slate-400 dark:text-slate-500">
                    {bell.start}
                    <br />
                    {bell.end}
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
                        'rounded-2xl p-0 align-top',
                        isToday && 'bg-accent-soft/40 dark:bg-accent/[0.07]',
                      )}
                    >
                      <button
                        type="button"
                        aria-label={cellLabel}
                        onClick={() => onOpenCell(day, bell.period)}
                        className={cx(
                          'group relative flex h-[80px] w-full flex-col items-start gap-1 overflow-hidden rounded-2xl p-2.5 text-left transition duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-1 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-800',
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
                                className="absolute right-1.5 top-1.5 text-rose-500"
                                title="撞堂"
                              >
                                <AlertTriangle size={13} />
                              </span>
                            )}
                            <span className="line-clamp-2 pr-3 text-[13px] font-semibold leading-snug">
                              {title}
                            </span>
                            <div className="mt-auto flex flex-wrap items-center gap-1">
                              {className && (
                                <span className="rounded-md bg-black/[0.06] px-1.5 py-px text-[10px] font-medium dark:bg-white/10">
                                  {className}
                                </span>
                              )}
                              {slot.room && (
                                <span className="inline-flex items-center gap-0.5 rounded-md bg-black/[0.06] px-1.5 py-px text-[10px] dark:bg-white/10">
                                  <MapPin size={9} className="shrink-0 opacity-70" />
                                  {slot.room}
                                </span>
                              )}
                              {meta?.week && meta.week !== 'all' && (
                                <span className="rounded-md bg-black/[0.06] px-1.5 py-px text-[10px] font-semibold dark:bg-white/10">
                                  {meta.week}
                                </span>
                              )}
                            </div>
                          </>
                        ) : (
                          <Plus
                            size={16}
                            className="m-auto text-slate-300 transition group-hover:scale-110 group-hover:text-accent dark:text-slate-600 dark:group-hover:text-accent"
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
