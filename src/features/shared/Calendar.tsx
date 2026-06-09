import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarArrowDown, CalendarRange, ChevronLeft, ChevronRight, Dot, Plus, SlidersHorizontal, Smartphone } from 'lucide-react'
import { useCollection } from '../../lib/store'
import { eventsCol, calendarsCol, countdownsCol } from '../../data/collections'
import type { CalendarEvent } from '../../data/types'
import { Button, IconButton, SegmentedControl, cx } from '../../ui'
import { useToast } from '../../context/ToastContext'
import EventEditor from './calendar/EventEditor'
import MonthView from './calendar/MonthView'
import TimeGridView from './calendar/TimeGridView'
import YearView from './calendar/YearView'
import CalendarManager from './calendar/CalendarManager'
import IcsExportModal from './calendar/IcsExportModal'
import CalendarSubscribe from './calendar/CalendarSubscribe'
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

// 標題上方嘅小字眉題（按視圖換口吻，呼應「精緻週記」氣質）
const VIEW_EYEBROW: Record<View, string> = {
  day: 'Today',
  week: 'This Week',
  month: 'This Month',
  year: 'This Year',
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, d.getDate(), 12)
}

// 是否 ≥ sm 斷點（640px）。手機週視圖塞唔落 7 欄，改逐日睇。
function useIsWide(): boolean {
  const query = '(min-width: 640px)'
  const [wide, setWide] = useState(
    () => typeof matchMedia !== 'undefined' && matchMedia(query).matches,
  )
  useEffect(() => {
    if (typeof matchMedia === 'undefined') return
    const mq = matchMedia(query)
    const handler = () => setWide(mq.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return wide
}

export default function Calendar() {
  const { t } = useTranslation()
  const events = useCollection(eventsCol)
  const cals = useCollection(calendarsCol)
  const countdowns = useCollection(countdownsCol)
  const toast = useToast()

  // 拖拉移動：重複事件唔好盲改 master（會搬郁／重錨成個系列，繞過「僅此次/全部」）。
  // 暫擋住 + 引導去編輯器處理，避免破壞重複規則。
  const blockRecurringDrag = (ev: CalendarEvent): boolean => {
    if (ev.recurrence) {
      toast.info('重複事件請開編輯器調整（可揀「僅此次」或「全部」）')
      return true
    }
    return false
  }

  const isWide = useIsWide()
  const [view, setView] = useState<View>('month')
  const [cursor, setCursor] = useState(() => new Date())
  const cursorKey = toKey(cursor)
  const isOnToday = cursorKey === toKey(new Date())

  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<CalendarEvent | null>(null)
  const [editingOcc, setEditingOcc] = useState<string | undefined>(undefined)
  const [createTime, setCreateTime] = useState<string | undefined>(undefined)
  const [managerOpen, setManagerOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [subscribeOpen, setSubscribeOpen] = useState(false)

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
    // 週視圖喺手機收成單日，標題跟住顯示嗰一日。
    if (!isWide) return longDateLabel(cursorKey)
    const wk = weekKeys(cursor)
    const a = fromKey(wk[0])
    const b = fromKey(wk[6])
    return `${a.getMonth() + 1}月${a.getDate()}日 – ${b.getMonth() + 1}月${b.getDate()}日`
  }, [view, cursor, cursorKey, isWide])

  function nav(dir: number) {
    // 手機週視圖收窄成單日，逐日翻；闊屏先逐週翻。
    const weekStep = view === 'week' && isWide ? 7 : 1
    if (view === 'month') setCursor((d) => addMonths(d, dir))
    else if (view === 'week') setCursor((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + dir * weekStep, 12))
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
    <div className="flex h-[78vh] flex-col gap-4">
      {/* ───────── 週記 masthead：功能名「行事曆」做頁面身份（kicker + serif 大標題）───────── */}
      <header className="min-w-0">
        <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.3em] text-accent/70">
          <CalendarRange size={13} className="shrink-0" />
          日程週記 · Calendar
        </p>
        <h1 className="mt-1 text-[26px] font-semibold leading-none tracking-tight text-slate-800 dark:text-slate-100 sm:text-[30px]">
          行事曆
        </h1>
      </header>

      {/* 工具列 — 當前日期 + 前後／今日導覽，右邊放檢視切換同新增 */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-accent/70">
            {VIEW_EYEBROW[view]}
          </p>
          <h2 className="mt-0.5 text-xl font-semibold leading-none tracking-tight text-slate-700 dark:text-slate-200 sm:text-2xl">
            {title}
          </h2>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex items-center rounded-full border border-slate-200/80 bg-white p-0.5 shadow-xs dark:border-slate-700/60 dark:bg-slate-800 dark:shadow-none">
            <IconButton label="上一個" onClick={() => nav(-1)}>
              <ChevronLeft size={18} />
            </IconButton>
            <IconButton label="下一個" onClick={() => nav(1)}>
              <ChevronRight size={18} />
            </IconButton>
          </div>
          {!isOnToday && (
            <button
              type="button"
              onClick={() => setCursor(new Date())}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200/80 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-xs transition duration-200 hover:border-accent/40 hover:text-accent active:scale-[0.98] dark:border-slate-700/60 dark:bg-slate-800 dark:text-slate-300 dark:shadow-none dark:hover:text-accent"
            >
              <Dot size={16} className="-mx-1 text-accent" />
              今日
            </button>
          )}
        </div>
        <div className="flex-1" />
        <SegmentedControl options={VIEWS} value={view} onChange={setView} />
        <Button size="sm" icon={Plus} onClick={openCreate}>
          新增
        </Button>
      </div>

      {/* 行事曆開關 — 顯示中嘅戴返自己嘅柔和色衣；隱藏嘅退做灰底刪線 */}
      <div className="flex flex-wrap items-center gap-2">
        {cals.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={c.visible}
            aria-label={`${c.name}（${c.visible ? '顯示中，按一下隱藏' : '已隱藏，按一下顯示'}）`}
            onClick={() => toggleCal(c.id, c.visible)}
            className={cx(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
              c.visible
                ? cx('ring-1 ring-inset ring-black/5 hover:brightness-95 dark:ring-white/10 dark:hover:brightness-110', colorOf(c.color).chip)
                : 'bg-slate-100/80 text-slate-400 line-through hover:text-slate-500 dark:bg-slate-800/60 dark:text-slate-500',
            )}
          >
            <span
              className={cx(
                'h-2 w-2 rounded-full transition',
                c.visible ? colorOf(c.color).dot : 'bg-slate-300 dark:bg-slate-600',
              )}
            />
            {c.name}
          </button>
        ))}
        <span aria-hidden="true" className="mx-0.5 h-4 w-px bg-slate-200 dark:bg-slate-700/70" />
        <button
          type="button"
          onClick={() => setManagerOpen(true)}
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-slate-400 transition hover:text-accent active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <SlidersHorizontal size={13} /> 管理
        </button>
        <button
          type="button"
          onClick={() => setExportOpen(true)}
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-slate-400 transition hover:text-accent active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <CalendarArrowDown size={13} /> 匯出 .ics
        </button>
        <button
          type="button"
          onClick={() => setSubscribeOpen(true)}
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-slate-400 transition hover:text-accent active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <Smartphone size={13} /> {t('cal.subscribeMobile', { defaultValue: '訂閱到手機日曆' })}
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
          onMoveToDay={(ev, dk) => {
            if (!blockRecurringDrag(ev)) eventsCol.update(ev.id, { date: dk })
          }}
          onMoreDay={(k) => {
            setCursor(fromKey(k))
            setView('day')
          }}
        />
      )}

      {/* 手機：月view 下方列出「揀中嗰日」嘅事件（月格太細淨見點點，喺度補返內容）*/}
      {view === 'month' && (
        <div className="max-h-[40%] shrink-0 space-y-1.5 overflow-y-auto sm:hidden">
          <div className="flex items-center justify-between px-1 pt-0.5">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {longDateLabel(cursorKey)}
            </p>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-accent transition active:scale-[0.98] active:opacity-70"
            >
              <Plus size={14} /> 新增
            </button>
          </div>
          {(occByDate.get(cursorKey) ?? []).length === 0 ? (
            <p className="px-1 py-4 text-center text-sm text-slate-400 dark:text-slate-500">
              呢日冇活動
            </p>
          ) : (
            (occByDate.get(cursorKey) ?? []).map((occ) => (
              <button
                key={`${occ.event.id}-${occ.dateKey}`}
                type="button"
                onClick={() => openEdit(occ.event, occ.dateKey)}
                className="flex w-full items-center gap-2.5 rounded-xl border border-slate-200/70 bg-white px-3 py-2.5 text-left shadow-xs transition active:scale-[0.98] active:bg-slate-50 dark:border-slate-700/60 dark:bg-slate-800 dark:active:bg-slate-700/60"
              >
                <span
                  className={cx(
                    'h-2.5 w-2.5 shrink-0 rounded-full',
                    colorOf(occ.category?.color).dot,
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                    {occ.event.title}
                  </span>
                  {occ.event.time && (
                    <span className="text-xs tabular-nums text-slate-400 dark:text-slate-500">
                      {occ.event.time}
                      {occ.event.endTime ? `–${occ.event.endTime}` : ''}
                    </span>
                  )}
                </span>
              </button>
            ))
          )}
        </div>
      )}

      {(view === 'week' || view === 'day') && (
        <TimeGridView
          days={view === 'week' && isWide ? weekKeys(cursor) : [cursorKey]}
          occByDate={occByDate}
          onOpenEvent={openEdit}
          onCreateAt={createAt}
          onMoveEvent={(ev, time, endTime) => {
            if (!blockRecurringDrag(ev)) {
              eventsCol.update(ev.id, { time, endTime, allDay: false })
            }
          }}
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

      {exportOpen && (
        <IcsExportModal
          events={events}
          cats={cals}
          countdowns={countdowns}
          onClose={() => setExportOpen(false)}
        />
      )}

      {subscribeOpen && (
        <CalendarSubscribe onClose={() => setSubscribeOpen(false)} />
      )}
    </div>
  )
}
