import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import type { CalendarEvent } from '../../../data/types'
import { cx } from '../../../ui'
import {
  HOURS,
  WEEKDAYS,
  colorOf,
  fromKey,
  hourLabel,
  isAllDay,
  minutesOf,
  todayKey,
  type Occurrence,
} from './util'

const HOUR_PX = 48
const SNAP = 15 // 拖拉對齊到 15 分鐘

export function fmtMin(min: number): string {
  const m = Math.max(0, Math.min(1439, Math.round(min)))
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

export function endMinutes(ev: CalendarEvent): number {
  const s = minutesOf(ev.time)
  if (ev.endTime) {
    const e = minutesOf(ev.endTime)
    if (e > s) return e
  }
  return s + 60
}

interface Laid {
  occ: Occurrence
  start: number
  end: number
  lane: number
  lanes: number
}

/** 同日重疊事件分欄（cluster-based lane assignment） */
export function layoutDay(list: Occurrence[]): Laid[] {
  const timed = list
    .filter((o) => !isAllDay(o.event))
    .map((o) => ({ occ: o, start: minutesOf(o.event.time), end: endMinutes(o.event), lane: 0, lanes: 1 }))
    .sort((a, b) => a.start - b.start || a.end - b.end)

  const result: Laid[] = []
  let cluster: typeof timed = []
  let clusterEnd = -1

  const flush = () => {
    const laneEnds: number[] = []
    for (const it of cluster) {
      let lane = laneEnds.findIndex((e) => e <= it.start)
      if (lane === -1) {
        lane = laneEnds.length
        laneEnds.push(it.end)
      } else {
        laneEnds[lane] = it.end
      }
      it.lane = lane
    }
    const n = Math.max(1, laneEnds.length)
    for (const it of cluster) result.push({ ...it, lanes: n })
    cluster = []
    clusterEnd = -1
  }

  for (const it of timed) {
    if (cluster.length && it.start >= clusterEnd) flush()
    cluster.push(it)
    clusterEnd = Math.max(clusterEnd, it.end)
  }
  flush()
  return result
}

export default function TimeGridView({
  days,
  occByDate,
  onOpenEvent,
  onCreateAt,
  onPickDay,
  onMoveEvent,
}: {
  days: string[]
  occByDate: Map<string, Occurrence[]>
  onOpenEvent: (ev: CalendarEvent, dateKey: string) => void
  onCreateAt: (dateKey: string, time: string) => void
  onPickDay: (dateKey: string) => void
  onMoveEvent: (ev: CalendarEvent, time: string, endTime: string) => void
}) {
  const tKey = todayKey()
  const [nowMin, setNowMin] = useState(() => {
    const d = new Date()
    return d.getHours() * 60 + d.getMinutes()
  })
  const scrollRef = useRef<HTMLDivElement>(null)
  // 拖拉中嘅事件即時位置（preview）
  const [drag, setDrag] = useState<{ id: string; start: number; end: number } | null>(null)
  const movedRef = useRef(false)

  useEffect(() => {
    const id = setInterval(() => {
      const d = new Date()
      setNowMin(d.getHours() * 60 + d.getMinutes())
    }, 60000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 7 * HOUR_PX
  }, [])

  // 拖拉：move = 改開始時間（保持時長）；resize = 改結束時間。snap 15 分鐘。
  function startDrag(e: ReactPointerEvent, p: Laid, mode: 'move' | 'resize') {
    e.preventDefault()
    e.stopPropagation()
    const origStart = p.start
    const origEnd = p.end
    const dur = origEnd - origStart
    const startY = e.clientY
    movedRef.current = false
    let live = { start: origStart, end: origEnd }
    setDrag({ id: p.occ.event.id, start: origStart, end: origEnd })

    const onMove = (ev: PointerEvent) => {
      const delta = Math.round((((ev.clientY - startY) / HOUR_PX) * 60) / SNAP) * SNAP
      if (delta !== 0) movedRef.current = true
      if (mode === 'move') {
        const s = Math.max(0, Math.min(1440 - dur, origStart + delta))
        live = { start: s, end: s + dur }
      } else {
        const en = Math.max(origStart + SNAP, Math.min(1440, origEnd + delta))
        live = { start: origStart, end: en }
      }
      setDrag({ id: p.occ.event.id, start: live.start, end: live.end })
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      if (movedRef.current && (live.start !== origStart || live.end !== origEnd)) {
        onMoveEvent(p.occ.event, fmtMin(live.start), fmtMin(live.end))
      }
      setDrag(null)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const layouts = useMemo(() => {
    const m = new Map<string, Laid[]>()
    for (const dk of days) m.set(dk, layoutDay(occByDate.get(dk) ?? []))
    return m
  }, [days, occByDate])

  const hasAllDay = days.some((dk) =>
    (occByDate.get(dk) ?? []).some((o) => isAllDay(o.event)),
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xs dark:border-slate-700/60 dark:bg-slate-800 dark:shadow-none">
      {/* 日子標頭 */}
      <div className="flex border-b border-slate-100 dark:border-slate-700/50">
        <div className="w-16 shrink-0" />
        {days.map((dk, i) => {
          const d = fromKey(dk)
          const isToday = dk === tKey
          const isWeekend = d.getDay() === 0 || d.getDay() === 6
          return (
            <button
              key={dk}
              type="button"
              onClick={() => onPickDay(dk)}
              className={cx(
                'flex flex-1 flex-col items-center gap-1 py-2.5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40',
                i > 0 && 'border-l border-slate-100/70 dark:border-slate-800/50',
                isToday ? 'bg-accent-soft/40 dark:bg-accent/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50',
              )}
            >
              <span
                className={cx(
                  'text-[11px] font-medium uppercase tracking-wide',
                  isToday
                    ? 'text-accent-strong dark:text-accent'
                    : isWeekend
                      ? 'text-slate-300 dark:text-slate-600'
                      : 'text-slate-400 dark:text-slate-500',
                )}
              >
                星期{WEEKDAYS[d.getDay()]}
              </span>
              <span
                className={cx(
                  'flex h-8 w-8 items-center justify-center rounded-full text-base font-semibold tabular-nums transition',
                  isToday
                    ? 'bg-accent text-white shadow-sm shadow-accent/30'
                    : 'text-slate-700 dark:text-slate-200',
                )}
              >
                {d.getDate()}
              </span>
            </button>
          )
        })}
      </div>

      {/* 全日列 */}
      {hasAllDay && (
        <div className="flex border-b border-slate-100 bg-slate-50/40 dark:border-slate-700/50 dark:bg-slate-800/30">
          <div className="flex w-16 shrink-0 items-center justify-end pr-2 text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
            全日
          </div>
          {days.map((dk, i) => (
            <div
              key={dk}
              className={cx(
                'min-w-0 flex-1 space-y-1 p-1.5',
                i > 0 && 'border-l border-slate-100/70 dark:border-slate-800/50',
              )}
            >
              {(occByDate.get(dk) ?? [])
                .filter((o) => isAllDay(o.event))
                .map((occ) => (
                  <button
                    key={`${occ.event.id}-${occ.dateKey}`}
                    type="button"
                    onClick={() => onOpenEvent(occ.event, occ.dateKey)}
                    className={cx(
                      'flex w-full items-center gap-1.5 truncate rounded-md py-1 pl-1.5 pr-2 text-left text-[11px] font-medium transition duration-200 hover:brightness-95 active:brightness-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:hover:brightness-110',
                      colorOf(occ.category?.color).chip,
                    )}
                  >
                    <span className={cx('h-1.5 w-1.5 shrink-0 rounded-full', colorOf(occ.category?.color).dot)} />
                    <span className="truncate">{occ.event.title}</span>
                  </button>
                ))}
            </div>
          ))}
        </div>
      )}

      {/* 時間格（可捲） */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <div className="relative flex" style={{ height: 24 * HOUR_PX }}>
          {/* 小時標籤 */}
          <div className="w-16 shrink-0">
            {HOURS.map((h) => (
              <div
                key={h}
                style={{ height: HOUR_PX }}
                className="relative -top-2 pr-2 text-right text-[10px] font-medium tabular-nums text-slate-400 dark:text-slate-500"
              >
                {h === 0 ? '' : hourLabel(h)}
              </div>
            ))}
          </div>

          {/* 每日欄 */}
          {days.map((dk, di) => {
            const laid = layouts.get(dk) ?? []
            const isToday = dk === tKey
            const d = fromKey(dk)
            const isWeekend = d.getDay() === 0 || d.getDay() === 6
            return (
              <div
                key={dk}
                className={cx(
                  'relative min-w-0 flex-1',
                  di > 0 && 'border-l border-slate-100/70 dark:border-slate-800/50',
                  isToday
                    ? 'bg-accent-soft/20 dark:bg-accent/[0.06]'
                    : isWeekend && 'bg-slate-50/30 dark:bg-slate-900/20',
                )}
              >
                {/* 小時格（可撳新增） */}
                {HOURS.map((h) => (
                  <button
                    key={h}
                    type="button"
                    aria-label={`新增 ${hourLabel(h)}:00`}
                    onClick={() => onCreateAt(dk, `${String(h).padStart(2, '0')}:00`)}
                    style={{ height: HOUR_PX }}
                    className={cx(
                      'block w-full border-b transition-colors hover:bg-accent-soft/40 dark:hover:bg-accent/10',
                      h === 23
                        ? 'border-transparent'
                        : 'border-slate-100/60 dark:border-slate-800/40',
                    )}
                  />
                ))}

                {/* 現在時間線（柔和 accent 指示） */}
                {isToday && (
                  <div
                    className="pointer-events-none absolute left-0 right-0 z-20 flex items-center"
                    style={{ top: (nowMin / 60) * HOUR_PX }}
                  >
                    <span className="-ml-1.5 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-800" />
                    <span className="h-[1.5px] flex-1 bg-rose-500/80" />
                  </div>
                )}

                {/* 事件 chip */}
                {laid.map((p) => {
                  const dragging = drag?.id === p.occ.event.id
                  const s = dragging ? drag!.start : p.start
                  const en = dragging ? drag!.end : p.end
                  const top = (s / 60) * HOUR_PX
                  const height = Math.max(((en - s) / 60) * HOUR_PX, 18)
                  const widthPct = 100 / p.lanes
                  const leftPct = p.lane * widthPct
                  const c = colorOf(p.occ.category?.color)
                  return (
                    <div
                      key={`${p.occ.event.id}-${p.occ.dateKey}`}
                      role="button"
                      tabIndex={0}
                      aria-label={`${p.occ.event.title}，${p.occ.event.time ?? ''}${
                        p.occ.event.endTime ? `–${p.occ.event.endTime}` : ''
                      }`}
                      onPointerDown={(e) => startDrag(e, p, 'move')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          onOpenEvent(p.occ.event, p.occ.dateKey)
                        }
                      }}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (movedRef.current) {
                          movedRef.current = false
                          return
                        }
                        onOpenEvent(p.occ.event, p.occ.dateKey)
                      }}
                      style={{
                        top,
                        height,
                        left: `calc(${leftPct}% + 3px)`,
                        width: `calc(${widthPct}% - 6px)`,
                      }}
                      className={cx(
                        'group absolute z-10 cursor-pointer touch-none select-none overflow-hidden rounded-xl px-2 py-1 text-left text-[11px] leading-tight shadow-xs ring-1 ring-black/[0.03] transition duration-200 hover:shadow-md hover:brightness-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 dark:ring-white/[0.04] dark:hover:brightness-110',
                        dragging && 'z-30 cursor-grabbing opacity-95 shadow-md ring-2 ring-accent/50',
                        c.block,
                      )}
                    >
                      <span className="block truncate font-semibold">
                        {p.occ.event.title}
                      </span>
                      {height > 28 && (
                        <span className="block truncate tabular-nums opacity-75">
                          {dragging ? fmtMin(s) : p.occ.event.time}
                          {dragging
                            ? `–${fmtMin(en)}`
                            : p.occ.event.endTime
                              ? `–${p.occ.event.endTime}`
                              : ''}
                        </span>
                      )}
                      {/* 底邊縮放手柄（純拖拉；鍵盤用戶可開編輯器改時間） */}
                      <span
                        aria-hidden
                        onPointerDown={(e) => startDrag(e, p, 'resize')}
                        className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize"
                      />
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
