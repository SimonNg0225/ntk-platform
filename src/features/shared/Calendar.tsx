import { useMemo, useState } from 'react'
import { useCollection } from '../../lib/store'
import { eventsCol } from '../../data/collections'
import type { CalendarEvent } from '../../data/types'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'] as const

const EVENT_TYPES = ['測驗', '會議', '死線', '提醒'] as const
type EventType = (typeof EVENT_TYPES)[number]

/** 將 Date 轉成本地時區嘅 YYYY-MM-DD（避免用 toISOString 出現時差問題） */
function toDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 由 YYYY-MM-DD 砌返一個本地 Date（中午，避開時區邊界） */
function fromDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0)
}

function formatLongDate(key: string): string {
  const d = fromDateKey(key)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（星期${WEEKDAYS[d.getDay()]}）`
}

/** 產生指定年月嘅 6 行 x 7 欄格仔（由當月第一日嗰個星期日開始） */
function buildMonthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1)
  const start = new Date(year, month, 1 - first.getDay())
  const cells: Date[] = []
  for (let i = 0; i < 42; i++) {
    cells.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))
  }
  return cells
}

export default function Calendar() {
  const events = useCollection(eventsCol)

  const today = useMemo(() => new Date(), [])
  const todayKey = useMemo(() => toDateKey(today), [today])

  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [selectedKey, setSelectedKey] = useState<string>(todayKey)

  // 新增表單狀態
  const [title, setTitle] = useState('')
  const [time, setTime] = useState('')
  const [type, setType] = useState<EventType | ''>('')
  const [notes, setNotes] = useState('')

  // 每日事件數量（用嚟畫小圓點）
  const countByDate = useMemo(() => {
    const map = new Map<string, number>()
    for (const ev of events) {
      map.set(ev.date, (map.get(ev.date) ?? 0) + 1)
    }
    return map
  }, [events])

  const monthCells = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth])

  const selectedEvents = useMemo(() => {
    return events
      .filter((ev) => ev.date === selectedKey)
      .slice()
      .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))
  }, [events, selectedKey])

  const upcoming = useMemo(() => {
    const start = fromDateKey(todayKey)
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 8) // 未來 7 日（含今日起 8 個邊界）
    return events
      .filter((ev) => {
        const d = fromDateKey(ev.date)
        return d >= start && d < end
      })
      .slice()
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date)
        return (a.time ?? '').localeCompare(b.time ?? '')
      })
  }, [events, todayKey])

  function goPrevMonth() {
    setViewMonth((m) => {
      if (m === 0) {
        setViewYear((y) => y - 1)
        return 11
      }
      return m - 1
    })
  }

  function goNextMonth() {
    setViewMonth((m) => {
      if (m === 11) {
        setViewYear((y) => y + 1)
        return 0
      }
      return m + 1
    })
  }

  function goToday() {
    setViewYear(today.getFullYear())
    setViewMonth(today.getMonth())
    setSelectedKey(todayKey)
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    const payload: Omit<CalendarEvent, 'id'> = {
      title: trimmed,
      date: selectedKey,
    }
    if (time) payload.time = time
    if (type) payload.type = type
    const trimmedNotes = notes.trim()
    if (trimmedNotes) payload.notes = trimmedNotes
    eventsCol.add(payload)
    setTitle('')
    setTime('')
    setType('')
    setNotes('')
  }

  function handleRemove(id: CalendarEvent['id']) {
    eventsCol.remove(id)
  }

  const monthLabel = `${viewYear}年${viewMonth + 1}月`

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* 月曆卡片 */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={goPrevMonth}
              aria-label="上一個月"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-accent-soft hover:text-accent-strong focus:outline-none focus:ring-2 focus:ring-accent/30"
            >
              ‹
            </button>
            <h2 className="min-w-[6.5rem] text-center text-lg font-semibold text-slate-800">
              {monthLabel}
            </h2>
            <button
              type="button"
              onClick={goNextMonth}
              aria-label="下一個月"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-accent-soft hover:text-accent-strong focus:outline-none focus:ring-2 focus:ring-accent/30"
            >
              ›
            </button>
          </div>
          <button
            type="button"
            onClick={goToday}
            className="rounded-xl border border-accent bg-accent-soft px-3 py-1.5 text-sm font-medium text-accent-strong transition hover:bg-accent hover:text-white focus:outline-none focus:ring-2 focus:ring-accent/30"
          >
            今日
          </button>
        </header>

        {/* 星期標頭 */}
        <div className="mb-1 grid grid-cols-7 gap-1 text-center text-xs font-medium text-slate-400">
          {WEEKDAYS.map((w) => (
            <div key={w} className="py-1">
              {w}
            </div>
          ))}
        </div>

        {/* 日期格仔 */}
        <div className="grid grid-cols-7 gap-1">
          {monthCells.map((cell) => {
            const key = toDateKey(cell)
            const inMonth = cell.getMonth() === viewMonth
            const isToday = key === todayKey
            const isSelected = key === selectedKey
            const count = countByDate.get(key) ?? 0

            const base =
              'relative flex aspect-square flex-col items-center justify-center rounded-xl text-sm transition focus:outline-none focus:ring-2 focus:ring-accent/30'
            const tone = isSelected
              ? 'bg-accent text-white font-semibold'
              : isToday
                ? 'bg-accent-soft text-accent-strong font-semibold'
                : inMonth
                  ? 'text-slate-700 hover:bg-slate-100'
                  : 'text-slate-300 hover:bg-slate-50'

            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedKey(key)}
                aria-pressed={isSelected}
                aria-label={`${formatLongDate(key)}${count ? `，有 ${count} 項活動` : ''}`}
                className={`${base} ${tone}`}
              >
                <span>{cell.getDate()}</span>
                {count > 0 && (
                  <span
                    className={`absolute bottom-1 h-1.5 w-1.5 rounded-full ${
                      isSelected ? 'bg-white' : 'bg-accent'
                    }`}
                  />
                )}
              </button>
            )
          })}
        </div>
      </section>

      {/* 選定日子 + 新增 */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <h3 className="text-base font-semibold text-slate-800">{formatLongDate(selectedKey)}</h3>

        {/* 當日事件清單 */}
        <ul className="mt-3 space-y-2">
          {selectedEvents.length === 0 && (
            <li className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-400">
              呢日暫時無活動
            </li>
          )}
          {selectedEvents.map((ev) => (
            <li
              key={ev.id}
              className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {ev.time && (
                    <span className="shrink-0 rounded-lg bg-accent-soft px-1.5 py-0.5 text-xs font-medium text-accent-strong">
                      {ev.time}
                    </span>
                  )}
                  <span className="truncate font-medium text-slate-800">{ev.title}</span>
                  {ev.type && (
                    <span className="shrink-0 rounded-lg border border-accent px-1.5 py-0.5 text-xs text-accent-strong">
                      {ev.type}
                    </span>
                  )}
                </div>
                {ev.notes && (
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-500">
                    {ev.notes}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleRemove(ev.id)}
                aria-label={`刪除「${ev.title}」`}
                className="shrink-0 rounded-lg px-2 py-1 text-sm text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 focus:outline-none focus:ring-2 focus:ring-accent/30"
              >
                刪除
              </button>
            </li>
          ))}
        </ul>

        {/* 新增表單 */}
        <form onSubmit={handleAdd} className="mt-4 space-y-3 border-t border-slate-100 pt-4">
          <p className="text-sm font-medium text-slate-600">新增活動</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs text-slate-500">標題（必填）</span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例如：中文默書"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-300 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-slate-500">時間（選填）</span>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-slate-500">類型（選填）</span>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as EventType | '')}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
              >
                <option value="">未分類</option>
                {EVENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs text-slate-500">備註（選填）</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="補充資料……"
                className="w-full resize-y rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-300 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={!title.trim()}
            className="w-full rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-strong focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            加入活動
          </button>
        </form>
      </section>

      {/* 即將到嚟 */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <h3 className="text-base font-semibold text-slate-800">即將到嚟（未來 7 日）</h3>
        <ul className="mt-3 space-y-2">
          {upcoming.length === 0 && (
            <li className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-400">
              未來 7 日暫時無活動
            </li>
          )}
          {upcoming.map((ev) => (
            <li key={ev.id}>
              <button
                type="button"
                onClick={() => {
                  const d = fromDateKey(ev.date)
                  setViewYear(d.getFullYear())
                  setViewMonth(d.getMonth())
                  setSelectedKey(ev.date)
                }}
                className="flex w-full items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 text-left transition hover:bg-accent-soft focus:outline-none focus:ring-2 focus:ring-accent/30"
              >
                <div className="flex w-14 shrink-0 flex-col items-center rounded-lg bg-accent-soft py-1 text-accent-strong">
                  <span className="text-xs">
                    {fromDateKey(ev.date).getMonth() + 1}月
                  </span>
                  <span className="text-base font-semibold leading-none">
                    {fromDateKey(ev.date).getDate()}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {ev.time && (
                      <span className="text-xs font-medium text-accent">{ev.time}</span>
                    )}
                    <span className="truncate font-medium text-slate-800">{ev.title}</span>
                    {ev.type && (
                      <span className="shrink-0 rounded-lg border border-accent px-1.5 py-0.5 text-xs text-accent-strong">
                        {ev.type}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-400">
                    星期{WEEKDAYS[fromDateKey(ev.date).getDay()]}
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
