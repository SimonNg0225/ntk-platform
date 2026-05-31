import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, SlidersHorizontal } from 'lucide-react'
import { useCollection } from '../../lib/store'
import { eventsCol, calendarsCol } from '../../data/collections'
import type { CalendarEvent } from '../../data/types'
import { Button, IconButton, SegmentedControl, cx } from '../../ui'
import EventEditor from './calendar/EventEditor'
import MonthView from './calendar/MonthView'
import TimeGridView from './calendar/TimeGridView'
import YearView from './calendar/YearView'
import CalendarManager from './calendar/CalendarManager'
import {
  colorOf,
  fromKey,
  getOccurrences,
  indexByDate,
  longDateLabel,
  monthLabel,
  monthMatrix,
  toKey,
  weekKeys,
} from './calendar/util'

type View = 'day' | 'week' | 'month' | 'year'
const VIEWS: { id: View; label: string }[] = [
  { id: 'day', label: '日' },
  { id: 'week', label: '週' },
  { id: 'month', label: '月' },
  { id: 'year', label: '年' },
]

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, d.getDate(), 12)
}

export default function Calendar() {
  const events = useCollection(eventsCol)
  const cals = useCollection(calendarsCol)

  const [view, setView] = useState<View>('month')
  const [cursor, setCursor] = useState(() => new Date())
  const cursorKey = toKey(cursor)

  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<CalendarEvent | null>(null)
  const [editingOcc, setEditingOcc] = useState<string | undefined>(undefined)
  const [createTime, setCreateTime] = useState<string | undefined>(undefined)
  const [managerOpen, setManagerOpen] = useState(false)

  // 視圖範圍
  const { rangeStart, rangeEnd } = useMemo(() => {
    if (view === 'month') {
      const cells = monthMatrix(cursor.getFullYear(), cursor.getMonth())
      return { rangeStart: toKey(cells[0]), rangeEnd: toKey(cells[41]) }
    }
    if (view === 'week') {
      const wk = weekKeys(cursor)
      return { rangeStart: wk[0], rangeEnd: wk[6] }
    }
    if (view === 'day') {
      return { rangeStart: cursorKey, rangeEnd: cursorKey }
    }
    return {
      rangeStart: `${cursor.getFullYear()}-01-01`,
      rangeEnd: `${cursor.getFullYear()}-12-31`,
    }
  }, [view, cursor, cursorKey])

  const occByDate = useMemo(
    () => indexByDate(getOccurrences(events, cals, rangeStart, rangeEnd)),
    [events, cals, rangeStart, rangeEnd],
  )

  const title = useMemo(() => {
    if (view === 'month') return monthLabel(cursor.getFullYear(), cursor.getMonth())
    if (view === 'day') return longDateLabel(cursorKey)
    if (view === 'year') return `${cursor.getFullYear()}年`
    const wk = weekKeys(cursor)
    const a = fromKey(wk[0])
    const b = fromKey(wk[6])
    return `${a.getMonth() + 1}月${a.getDate()}日 – ${b.getMonth() + 1}月${b.getDate()}日`
  }, [view, cursor, cursorKey])

  function nav(dir: number) {
    if (view === 'month') setCursor((d) => addMonths(d, dir))
    else if (view === 'week') setCursor((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + dir * 7, 12))
    else if (view === 'day') setCursor((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + dir, 12))
    else setCursor((d) => new Date(d.getFullYear() + dir, d.getMonth(), d.getDate(), 12))
  }

  function openCreate() {
    setEditing(null)
    setCreateTime(undefined)
    setEditorOpen(true)
  }
  function openEdit(ev: CalendarEvent, dateKey?: string) {
    setEditing(ev)
    setEditingOcc(dateKey)
    setEditorOpen(true)
  }
  function createAt(dateKey: string, time: string) {
    setCursor(fromKey(dateKey))
    setEditing(null)
    setCreateTime(time)
    setEditorOpen(true)
  }
  function toggleCal(id: string, visible: boolean) {
    calendarsCol.update(id, { visible: !visible })
  }

  return (
    <div className="flex h-[78vh] flex-col gap-3">
      {/* 工具列 */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-0.5">
          <IconButton label="上一個" onClick={() => nav(-1)}>
            <ChevronLeft size={20} />
          </IconButton>
          <h2 className="min-w-[8rem] text-center text-base font-semibold tabular-nums text-slate-800 dark:text-slate-100 sm:text-lg">
            {title}
          </h2>
          <IconButton label="下一個" onClick={() => nav(1)}>
            <ChevronRight size={20} />
          </IconButton>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setCursor(new Date())}>
          今日
        </Button>
        <div className="flex-1" />
        <SegmentedControl options={VIEWS} value={view} onChange={setView} />
        <Button size="sm" icon={Plus} onClick={openCreate}>
          新增
        </Button>
      </div>

      {/* 行事曆開關 */}
      <div className="flex flex-wrap items-center gap-1.5">
        {cals.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => toggleCal(c.id, c.visible)}
            className={cx(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition',
              c.visible
                ? 'border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                : 'border-transparent bg-slate-100 text-slate-400 line-through dark:bg-slate-800/60 dark:text-slate-500',
            )}
          >
            <span
              className={cx(
                'h-2.5 w-2.5 rounded-full',
                c.visible ? colorOf(c.color).dot : 'bg-slate-300 dark:bg-slate-600',
              )}
            />
            {c.name}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setManagerOpen(true)}
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-slate-400 transition hover:text-accent"
        >
          <SlidersHorizontal size={13} /> 管理
        </button>
      </div>

      {/* 視圖主體 */}
      {view === 'month' && (
        <MonthView
          year={cursor.getFullYear()}
          month={cursor.getMonth()}
          occByDate={occByDate}
          selectedKey={cursorKey}
          onSelectDay={(k) => setCursor(fromKey(k))}
          onOpenEvent={openEdit}
          onMoreDay={(k) => {
            setCursor(fromKey(k))
            setView('day')
          }}
        />
      )}

      {(view === 'week' || view === 'day') && (
        <TimeGridView
          days={view === 'week' ? weekKeys(cursor) : [cursorKey]}
          occByDate={occByDate}
          onOpenEvent={openEdit}
          onCreateAt={createAt}
          onPickDay={(k) => {
            setCursor(fromKey(k))
            setView('day')
          }}
        />
      )}
      {view === 'year' && (
        <YearView
          year={cursor.getFullYear()}
          occByDate={occByDate}
          onPickMonth={(m) => {
            setCursor(new Date(cursor.getFullYear(), m, 1, 12))
            setView('month')
          }}
          onPickDay={(k) => {
            setCursor(fromKey(k))
            setView('day')
          }}
        />
      )}

      {editorOpen && (
        <EventEditor
          editing={editing}
          defaultDate={cursorKey}
          defaultTime={createTime}
          occurrenceKey={editingOcc}
          calendars={cals}
          onClose={() => setEditorOpen(false)}
          onSaved={(k) => setCursor(fromKey(k))}
        />
      )}

      {managerOpen && (
        <CalendarManager calendars={cals} onClose={() => setManagerOpen(false)} />
      )}
    </div>
  )
}
