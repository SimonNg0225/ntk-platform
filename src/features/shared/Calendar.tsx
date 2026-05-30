import { useMemo, useState } from 'react'
import { useCollection } from '../../lib/store'
import { eventsCol } from '../../data/collections'
import type { CalendarEvent } from '../../data/types'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  IconButton,
  Input,
  Modal,
  SectionTitle,
  Select,
  Textarea,
} from '../../ui'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'] as const

const EVENT_TYPES = ['測驗', '會議', '死線', '提醒', '其他'] as const
type EventType = (typeof EVENT_TYPES)[number]

type TypeTone = 'rose' | 'blue' | 'amber' | 'accent' | 'slate'

/** 事件類型 → Badge 色調 */
const TYPE_TONE: Record<EventType, TypeTone> = {
  測驗: 'rose',
  會議: 'blue',
  死線: 'amber',
  提醒: 'accent',
  其他: 'slate',
}

/** 事件類型 → 月曆小圓點 / 直紋色（Tailwind class） */
const TYPE_DOT: Record<TypeTone, string> = {
  rose: 'bg-rose-500',
  blue: 'bg-blue-500',
  amber: 'bg-amber-500',
  accent: 'bg-accent',
  slate: 'bg-slate-400',
}

function toneOf(type?: string): TypeTone {
  if (type && type in TYPE_TONE) return TYPE_TONE[type as EventType]
  return 'slate'
}

/** 將 Date 轉成本地時區嘅 YYYY-MM-DD（避免用 toISOString 出現時差問題） */
function toKey(d: Date): string {
  const y = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${mm}-${dd}`
}

/** 由 YYYY-MM-DD 砌返一個本地 Date（中午，避開時區邊界） */
function fromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0)
}

function formatLongDate(key: string): string {
  const d = fromKey(key)
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

function sortByTime(a: CalendarEvent, b: CalendarEvent): number {
  return (a.time ?? '').localeCompare(b.time ?? '')
}

export default function Calendar() {
  const events = useCollection(eventsCol)
  const toast = useToast()
  const confirm = useConfirm()

  const today = useMemo(() => new Date(), [])
  const todayKey = useMemo(() => toKey(today), [today])

  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [selectedKey, setSelectedKey] = useState<string>(todayKey)

  // 新增 Modal 狀態
  const [modalOpen, setModalOpen] = useState(false)
  const [fTitle, setFTitle] = useState('')
  const [fDate, setFDate] = useState(todayKey)
  const [fTime, setFTime] = useState('')
  const [fType, setFType] = useState<EventType | ''>('')
  const [fNotes, setFNotes] = useState('')

  // 每日事件（用嚟畫月曆格小圓點 + 預覽 title）
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const ev of events) {
      const list = map.get(ev.date)
      if (list) list.push(ev)
      else map.set(ev.date, [ev])
    }
    for (const list of map.values()) list.sort(sortByTime)
    return map
  }, [events])

  const monthCells = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth])

  const selectedEvents = useMemo(
    () => events.filter((ev) => ev.date === selectedKey).slice().sort(sortByTime),
    [events, selectedKey],
  )

  const upcoming = useMemo(() => {
    const start = fromKey(todayKey)
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 8)
    return events
      .filter((ev) => {
        const d = fromKey(ev.date)
        return d >= start && d < end
      })
      .slice()
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date)
        return sortByTime(a, b)
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

  function jumpTo(key: string) {
    const d = fromKey(key)
    setViewYear(d.getFullYear())
    setViewMonth(d.getMonth())
    setSelectedKey(key)
  }

  function openAddModal() {
    setFTitle('')
    setFDate(selectedKey)
    setFTime('')
    setFType('')
    setFNotes('')
    setModalOpen(true)
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = fTitle.trim()
    if (!trimmed) return
    const payload: Omit<CalendarEvent, 'id'> = {
      title: trimmed,
      date: fDate,
    }
    if (fTime) payload.time = fTime
    if (fType) payload.type = fType
    const trimmedNotes = fNotes.trim()
    if (trimmedNotes) payload.notes = trimmedNotes
    eventsCol.add(payload)
    setSelectedKey(fDate)
    setModalOpen(false)
    toast.success('已新增活動')
  }

  async function handleRemove(ev: CalendarEvent) {
    const ok = await confirm({
      title: '刪除活動？',
      message: `確定要刪除「${ev.title}」？此動作無法復原。`,
      confirmText: '刪除',
      tone: 'danger',
    })
    if (!ok) return
    eventsCol.remove(ev.id)
    toast.success('已刪除活動')
  }

  const monthLabel = `${viewYear}年${viewMonth + 1}月`

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* 月曆卡片 */}
      <Card className="p-4 sm:p-5">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <IconButton label="上一個月" onClick={goPrevMonth}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path
                  d="M15 6l-6 6 6 6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </IconButton>
            <h2 className="min-w-[6.5rem] text-center text-lg font-semibold text-slate-800 dark:text-slate-100">
              {monthLabel}
            </h2>
            <IconButton label="下一個月" onClick={goNextMonth}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path
                  d="M9 6l6 6-6 6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </IconButton>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={goToday}>
              今日
            </Button>
            <Button size="sm" onClick={openAddModal}>
              ＋ 新增
            </Button>
          </div>
        </header>

        {/* 星期標頭 */}
        <div className="mb-1 grid grid-cols-7 gap-1 text-center text-xs font-medium text-slate-400 dark:text-slate-500">
          {WEEKDAYS.map((w) => (
            <div key={w} className="py-1">
              {w}
            </div>
          ))}
        </div>

        {/* 日期格仔 */}
        <div className="grid grid-cols-7 gap-1">
          {monthCells.map((cell) => {
            const key = toKey(cell)
            const inMonth = cell.getMonth() === viewMonth
            const isToday = key === todayKey
            const isSelected = key === selectedKey
            const dayEvents = eventsByDate.get(key) ?? []

            const base =
              'relative flex aspect-square flex-col items-stretch rounded-xl p-1 text-left text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40'
            const tone = isSelected
              ? 'bg-accent text-white'
              : isToday
                ? 'bg-accent-soft text-accent-strong'
                : inMonth
                  ? 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700/60'
                  : 'text-slate-300 hover:bg-slate-50 dark:text-slate-600 dark:hover:bg-slate-800'

            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedKey(key)}
                aria-pressed={isSelected}
                aria-label={`${formatLongDate(key)}${
                  dayEvents.length ? `，有 ${dayEvents.length} 項活動` : ''
                }`}
                className={`${base} ${tone}`}
              >
                <span
                  className={`text-center text-xs font-semibold sm:text-sm ${
                    isToday && !isSelected ? 'text-accent-strong' : ''
                  }`}
                >
                  {cell.getDate()}
                </span>

                {/* 桌面：顯示最多 2 條 title，多過就 +N */}
                <div className="mt-0.5 hidden min-h-0 flex-1 flex-col gap-0.5 overflow-hidden sm:flex">
                  {dayEvents.slice(0, 2).map((ev) => (
                    <span
                      key={ev.id}
                      className={`flex items-center gap-1 truncate text-[10px] leading-tight ${
                        isSelected ? 'text-white/90' : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                          isSelected ? 'bg-white' : TYPE_DOT[toneOf(ev.type)]
                        }`}
                      />
                      <span className="truncate">{ev.title}</span>
                    </span>
                  ))}
                  {dayEvents.length > 2 && (
                    <span
                      className={`text-[10px] leading-tight ${
                        isSelected ? 'text-white/80' : 'text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      ＋{dayEvents.length - 2}
                    </span>
                  )}
                </div>

                {/* 手機：只顯示類型小圓點 */}
                <div className="mt-auto flex items-center justify-center gap-0.5 pb-0.5 sm:hidden">
                  {dayEvents.slice(0, 3).map((ev) => (
                    <span
                      key={ev.id}
                      className={`h-1.5 w-1.5 rounded-full ${
                        isSelected ? 'bg-white' : TYPE_DOT[toneOf(ev.type)]
                      }`}
                    />
                  ))}
                </div>
              </button>
            )
          })}
        </div>
      </Card>

      {/* 選定日子 + 當日事件 */}
      <Card className="p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">
            {formatLongDate(selectedKey)}
          </h3>
          <Button variant="secondary" size="sm" onClick={openAddModal}>
            ＋ 新增活動
          </Button>
        </div>

        {selectedEvents.length === 0 ? (
          <EmptyState
            icon="🗓️"
            title="呢日暫時無活動"
            hint="撳「新增活動」加入測驗、會議、死線或提醒。"
          />
        ) : (
          <ul className="space-y-2">
            {selectedEvents.map((ev) => (
              <li
                key={ev.id}
                className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800"
              >
                <span
                  className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${TYPE_DOT[toneOf(ev.type)]}`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {ev.time && (
                      <Badge tone="slate">{ev.time}</Badge>
                    )}
                    <span className="truncate font-medium text-slate-800 dark:text-slate-100">{ev.title}</span>
                    {ev.type && <Badge tone={toneOf(ev.type)}>{ev.type}</Badge>}
                  </div>
                  {ev.notes && (
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-500 dark:text-slate-400">
                      {ev.notes}
                    </p>
                  )}
                </div>
                <IconButton
                  label={`刪除「${ev.title}」`}
                  onClick={() => handleRemove(ev)}
                  className="hover:bg-rose-50 hover:text-rose-600"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M6 7h12M9 7V5h6v2m-7 0v12a1 1 0 001 1h6a1 1 0 001-1V7"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </IconButton>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* 即將到嚟 */}
      <Card className="p-4 sm:p-5">
        <SectionTitle>即將到嚟 · 未來 7 日</SectionTitle>
        {upcoming.length === 0 ? (
          <EmptyState icon="✨" title="未來 7 日暫時無活動" />
        ) : (
          <ul className="space-y-2">
            {upcoming.map((ev) => {
              const d = fromKey(ev.date)
              return (
                <li key={ev.id}>
                  <button
                    type="button"
                    onClick={() => jumpTo(ev.date)}
                    className="flex w-full items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 text-left transition hover:bg-accent-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:border-slate-700"
                  >
                    <div className="flex w-14 shrink-0 flex-col items-center rounded-lg bg-accent-soft py-1 text-accent-strong">
                      <span className="text-xs">{d.getMonth() + 1}月</span>
                      <span className="text-base font-semibold leading-none">{d.getDate()}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {ev.time && <span className="text-xs font-medium text-accent">{ev.time}</span>}
                        {ev.type && <Badge tone={toneOf(ev.type)}>{ev.type}</Badge>}
                        <span className="truncate font-medium text-slate-800 dark:text-slate-100">{ev.title}</span>
                      </div>
                      <span className="text-xs text-slate-400 dark:text-slate-500">星期{WEEKDAYS[d.getDay()]}</span>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      {/* 新增事件 Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="新增活動">
        <form onSubmit={handleAdd} className="space-y-3">
          <Field label="標題（必填）">
            <Input
              type="text"
              value={fTitle}
              onChange={(e) => setFTitle(e.target.value)}
              placeholder="例如：中文默書"
              autoFocus
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="日期">
              <Input type="date" value={fDate} onChange={(e) => setFDate(e.target.value)} />
            </Field>
            <Field label="時間（選填）">
              <Input type="time" value={fTime} onChange={(e) => setFTime(e.target.value)} />
            </Field>
          </div>
          <Field label="類型（選填）">
            <Select value={fType} onChange={(e) => setFType(e.target.value as EventType | '')}>
              <option value="">未分類</option>
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="備註（選填）">
            <Textarea
              value={fNotes}
              onChange={(e) => setFNotes(e.target.value)}
              rows={2}
              placeholder="補充資料……"
            />
          </Field>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
              取消
            </Button>
            <Button type="submit" disabled={!fTitle.trim()}>
              加入活動
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
