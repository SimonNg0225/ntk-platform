import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarArrowDown, CalendarDays, CalendarPlus, ChevronLeft, ChevronRight, Dot, Plus, SlidersHorizontal, Smartphone } from 'lucide-react'
import { useCollection } from '../../lib/store'
import { eventsCol, calendarsCol, countdownsCol } from '../../data/collections'
import type { CalendarEvent } from '../../data/types'
import { Button, FeatureGuide, IconButton, PageHero, SegmentedControl, cx } from '../../ui'
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

// 工具列嘅小字眉題（slate kicker，純中文唔用 uppercase；點明而家睇緊邊個範圍）
const VIEW_EYEBROW: Record<View, string> = {
  day: '當日',
  week: '本週',
  month: '本月',
  year: '全年',
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

  // 副題用嘅事件統計（顯示中行事曆嘅事件數；純呈現，唔影響資料流）
  const visibleEventCount = useMemo(() => {
    const hidden = new Set(cals.filter((c) => !c.visible).map((c) => c.id))
    // 未指定行事曆嘅事件當顯示；其餘睇所屬行事曆有冇被收起
    return events.filter((e) => !e.calendarId || !hidden.has(e.calendarId)).length
  }, [events, cals])

  return (
    <div className="flex min-h-[78vh] flex-col gap-4">
      {/* ───────── 頁頂 accent hero（共用 PageHero，統一各功能頁頂部語言）───────── */}
      <PageHero
        icon={CalendarDays}
        kicker={t('cal.kicker', { defaultValue: '日程行事曆' })}
        title={t('cal.title', { defaultValue: '行事曆' })}
        description={t('cal.subtitle', {
          n: visibleEventCount,
          defaultValue: `共 ${visibleEventCount} 項活動 · 日 / 週 / 月 / 年 · 重複事件 · 匯出訂閱`,
        })}
        guideKey="calendar"
      />

      {/* ───────── 教學引導：教用家點用行事曆（可摺疊 + 可永久收起）───────── */}
      <FeatureGuide
        storageKey="calendar"
        title={t('cal.guideTitle', { defaultValue: '行事曆點用？' })}
        steps={[
          {
            title: t('cal.guideStep1Title', { defaultValue: '揀檢視範圍' }),
            desc: t('cal.guideStep1Desc', { defaultValue: '右上揀「日 / 週 / 月 / 年」，用箭咀前後翻，按「今日」即刻跳返今天。' }),
          },
          {
            title: t('cal.guideStep2Title', { defaultValue: '加活動' }),
            desc: t('cal.guideStep2Desc', { defaultValue: '撳「新增」，或喺週／日格直接撳一格揀時段；要重複嘅喺編輯窗設定。' }),
          },
          {
            title: t('cal.guideStep3Title', { defaultValue: '用顏色分類' }),
            desc: t('cal.guideStep3Desc', { defaultValue: '撳色標籤可即時收起／顯示該類行事曆；按「管理」改名同顏色。' }),
          },
          {
            title: t('cal.guideStep4Title', { defaultValue: '匯出或訂閱手機' }),
            desc: t('cal.guideStep4Desc', { defaultValue: '「匯出 .ics」存檔，或「訂閱到手機日曆」一拉就同步入電話。' }),
          },
        ]}
      />

      {/* 工具列 — 當前日期 + 前後／今日導覽，右邊放檢視切換同新增 */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-400 dark:text-slate-500">
            {VIEW_EYEBROW[view]}
          </p>
          <h2 className="mt-0.5 text-xl font-semibold tracking-tight text-slate-700 dark:text-slate-200 sm:text-2xl">
            {title}
          </h2>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex items-center rounded-full border border-slate-200/80 bg-white p-0.5 dark:border-slate-700/60 dark:bg-slate-800">
            <IconButton label={t('cal.prev', { defaultValue: '上一個' })} onClick={() => nav(-1)}>
              <ChevronLeft size={18} />
            </IconButton>
            <IconButton label={t('cal.next', { defaultValue: '下一個' })} onClick={() => nav(1)}>
              <ChevronRight size={18} />
            </IconButton>
          </div>
          {!isOnToday && (
            <button
              type="button"
              onClick={() => setCursor(new Date())}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200/80 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition duration-200 hover:border-slate-300 hover:text-accent active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:border-slate-700/60 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-accent"
            >
              <Dot size={16} className="-mx-1 text-accent" />
              {t('cal.today', { defaultValue: '今日' })}
            </button>
          )}
        </div>
        <div className="flex-1" />
        <SegmentedControl options={VIEWS} value={view} onChange={setView} />
        <Button size="sm" icon={Plus} onClick={openCreate}>
          {t('cal.new', { defaultValue: '新增' })}
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
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-accent transition hover:text-accent-strong active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            >
              <Plus size={14} /> {t('cal.new', { defaultValue: '新增' })}
            </button>
          </div>
          {(occByDate.get(cursorKey) ?? []).length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200/80 bg-slate-50/60 px-6 py-8 text-center dark:border-slate-700/60 dark:bg-slate-800/40">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                <CalendarPlus size={22} strokeWidth={1.75} />
              </span>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                {t('cal.emptyDayTitle', { defaultValue: '呢日仲未有安排' })}
              </p>
              <p className="max-w-xs text-xs text-slate-400 dark:text-slate-500">
                {t('cal.emptyDayHint', { defaultValue: '撳一下加返堂、會議或提醒，今日就一目了然。' })}
              </p>
              <button
                type="button"
                onClick={openCreate}
                className="mt-1 text-xs font-medium text-accent transition hover:text-accent-strong active:scale-[0.98]"
              >
                {t('cal.emptyDayCta', { defaultValue: '加第一項活動 →' })}
              </button>
            </div>
          ) : (
            (occByDate.get(cursorKey) ?? []).map((occ) => (
              <button
                key={`${occ.event.id}-${occ.dateKey}`}
                type="button"
                onClick={() => openEdit(occ.event, occ.dateKey)}
                className="flex w-full items-center gap-2.5 rounded-xl border border-slate-200/80 bg-white px-3 py-2.5 text-left transition hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:border-slate-700/60 dark:bg-slate-800 dark:hover:border-slate-600 dark:hover:bg-slate-800/60"
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
