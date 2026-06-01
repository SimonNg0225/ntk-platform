import { useState } from 'react'
import {
  AlignLeft,
  Bell,
  CalendarDays,
  Check,
  Clock,
  Link2,
  MapPin,
  Repeat,
  Trash2,
} from 'lucide-react'
import { eventsCol } from '../../../data/collections'
import type {
  CalendarCategory,
  CalendarEvent,
  RecurrenceFreq,
} from '../../../data/types'
import { useToast } from '../../../context/ToastContext'
import { useConfirm } from '../../../context/ConfirmContext'
import { Button, Field, Input, Modal, Select, Textarea, cx } from '../../../ui'
import { WEEKDAYS, addDays, colorOf, fromKey, toKey } from './util'

const FREQ_OPTIONS: { v: RecurrenceFreq; l: string }[] = [
  { v: 'none', l: '不重複' },
  { v: 'daily', l: '每日' },
  { v: 'weekly', l: '每週' },
  { v: 'monthly', l: '每月' },
  { v: 'yearly', l: '每年' },
]

const ALERT_OPTIONS: { v: number; l: string }[] = [
  { v: -1, l: '無提醒' },
  { v: 0, l: '事件發生時' },
  { v: 5, l: '5 分鐘前' },
  { v: 15, l: '15 分鐘前' },
  { v: 30, l: '30 分鐘前' },
  { v: 60, l: '1 小時前' },
  { v: 1440, l: '1 日前' },
]

export function plusHour(t: string): string {
  const [h, m] = t.split(':').map(Number)
  // 加 1 小時作結束時間預設；clamp 喺 23:59 唔好 wrap 過午夜，
  // 否則結束時間預設會早過開始（如 23:30 變 00:30）。
  const tot = Math.min(23 * 60 + 59, ((h || 0) + 1) * 60 + (m || 0))
  const hh = Math.floor(tot / 60)
  const mm = tot % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2.5 rounded-lg text-sm font-medium text-slate-700 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:text-slate-200 dark:focus-visible:ring-offset-slate-800"
    >
      <span
        className={cx(
          'relative h-5 w-9 rounded-full transition-colors duration-200',
          checked ? 'bg-accent' : 'bg-slate-300 dark:bg-slate-600',
        )}
      >
        <span
          className={cx(
            'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all duration-200',
            checked ? 'left-[1.125rem]' : 'left-0.5',
          )}
        />
      </span>
      {label}
    </button>
  )
}

export default function EventEditor({
  editing,
  defaultDate,
  defaultTime,
  occurrenceKey,
  calendars,
  onClose,
  onSaved,
}: {
  editing: CalendarEvent | null
  defaultDate: string
  defaultTime?: string
  occurrenceKey?: string
  calendars: CalendarCategory[]
  onClose: () => void
  onSaved?: (dateKey: string) => void
}) {
  const toast = useToast()
  const confirm = useConfirm()

  const [title, setTitle] = useState(editing?.title ?? '')
  const [location, setLocation] = useState(editing?.location ?? '')
  const [allDay, setAllDay] = useState(editing ? editing.allDay === true : false)
  const [startDate, setStartDate] = useState(editing?.date ?? defaultDate)
  const [startTime, setStartTime] = useState(editing?.time ?? defaultTime ?? '09:00')
  const [endDate, setEndDate] = useState(editing?.endDate ?? editing?.date ?? defaultDate)
  const [endTime, setEndTime] = useState(
    editing?.endTime ?? (defaultTime ? plusHour(defaultTime) : '10:00'),
  )
  const [calendarId, setCalendarId] = useState(
    editing?.calendarId ?? calendars[0]?.id ?? '',
  )
  const [freq, setFreq] = useState<RecurrenceFreq>(editing?.recurrence?.freq ?? 'none')
  const [interval, setIntervalN] = useState(
    String(editing?.recurrence?.interval ?? 1),
  )
  const [until, setUntil] = useState(editing?.recurrence?.until ?? '')
  const [byWeekday, setByWeekday] = useState<number[]>(
    editing?.recurrence?.byWeekday ?? [],
  )
  const [alert, setAlert] = useState(editing?.alertMinutes ?? -1)
  const [url, setUrl] = useState(editing?.url ?? '')
  const [notes, setNotes] = useState(editing?.notes ?? '')
  const [scopeAction, setScopeAction] = useState<null | 'delete' | 'save'>(null)

  const cat = calendars.find((c) => c.id === calendarId)
  const valid = title.trim().length > 0 && startDate !== ''

  function buildPayload(): Omit<CalendarEvent, 'id'> {
    const payload: Omit<CalendarEvent, 'id'> = {
      title: title.trim(),
      date: startDate,
      allDay,
    }
    if (!allDay) {
      if (startTime) payload.time = startTime
      if (endTime) payload.endTime = endTime
    }
    if (endDate && endDate !== startDate) payload.endDate = endDate
    if (calendarId) payload.calendarId = calendarId
    if (location.trim()) payload.location = location.trim()
    if (url.trim()) payload.url = url.trim()
    if (notes.trim()) payload.notes = notes.trim()
    if (alert >= 0) payload.alertMinutes = alert
    if (freq !== 'none') {
      payload.recurrence = {
        freq,
        interval: Math.max(1, Number(interval) || 1),
        ...(until ? { until } : {}),
        ...(freq === 'weekly' && byWeekday.length
          ? { byWeekday: [...byWeekday].sort((a, b) => a - b) }
          : {}),
      }
    }
    return payload
  }

  function save() {
    if (!valid) return
    // 編輯緊「重複事件嘅某次」→ 問改此 / 全部
    if (editing && editing.recurrence && occurrenceKey) {
      setScopeAction('save')
      return
    }
    const payload = buildPayload()
    if (editing) {
      if (editing.exDates?.length) payload.exDates = editing.exDates
      eventsCol.update(editing.id, payload)
      toast.success('已儲存活動')
    } else {
      eventsCol.add(payload)
      toast.success('已新增活動')
    }
    onSaved?.(startDate)
    onClose()
  }

  function saveAll() {
    if (!editing) return
    const payload = buildPayload()
    if (editing.exDates?.length) payload.exDates = editing.exDates
    eventsCol.update(editing.id, payload)
    toast.success('已更新所有活動')
    onSaved?.(startDate)
    onClose()
  }

  function saveThis() {
    if (!editing || !occurrenceKey) return
    // 原系列：將此 occurrence 加入例外（嗰日唔再出現）
    const ex = Array.from(new Set([...(editing.exDates ?? []), occurrenceKey]))
    eventsCol.update(editing.id, { exDates: ex })
    // 建立此日獨立（非重複）事件，帶新值。
    // 編輯器嘅日期欄預設係「系列開始日」(editing.date)，而非今次被編輯嗰個
    // occurrence；若照用 startDate，新事件會錯誤落喺系列開始日（重複咗 +
    // 被編輯嗰日反而消失）。所以以 occurrenceKey 為基準，套返用戶喺日期欄
    // 相對系列開始日所作嘅位移，保留時長。
    const payload = buildPayload()
    delete payload.recurrence
    delete payload.exDates
    const dayDelta = Math.round(
      (fromKey(occurrenceKey).getTime() - fromKey(editing.date).getTime()) / 86400000,
    )
    payload.date = toKey(addDays(fromKey(payload.date), dayDelta))
    if (payload.endDate) {
      payload.endDate = toKey(addDays(fromKey(payload.endDate), dayDelta))
    }
    eventsCol.add(payload)
    toast.success('已更新此活動')
    onSaved?.(payload.date)
    onClose()
  }

  async function remove() {
    if (!editing) return
    if (editing.recurrence) {
      setScopeAction('delete') // 重複事件：問刪此 / 全部
      return
    }
    const ok = await confirm({
      title: '刪除活動？',
      message: `確定要刪除「${editing.title}」？此動作無法復原。`,
      confirmText: '刪除',
      tone: 'danger',
    })
    if (!ok) return
    eventsCol.remove(editing.id)
    toast.success('已刪除活動')
    onClose()
  }

  function deleteThis() {
    if (!editing || !occurrenceKey) return
    const ex = Array.from(new Set([...(editing.exDates ?? []), occurrenceKey]))
    eventsCol.update(editing.id, { exDates: ex })
    toast.success('已刪除此活動')
    onClose()
  }

  function deleteAll() {
    if (!editing) return
    eventsCol.remove(editing.id)
    toast.success('已刪除所有活動')
    onClose()
  }

  return (
    <>
      <Modal
      open
      onClose={onClose}
      title={editing ? '編輯活動' : '新增活動'}
      size="lg"
      footer={
        <>
          {editing && (
            <Button
              variant="ghost"
              icon={Trash2}
              className="mr-auto text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"
              onClick={remove}
            >
              刪除
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button icon={Check} onClick={save} disabled={!valid}>
            {editing ? '儲存' : '加入行事曆'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* 標題 — 放大，作為主焦點 */}
        <div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="想安排啲咩？"
            autoFocus
            className="w-full border-0 border-b border-slate-200 bg-transparent pb-2 text-lg font-semibold text-slate-800 outline-none transition-colors placeholder:font-normal placeholder:text-slate-400 focus:border-accent dark:border-slate-700 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
        </div>

        <Field label="地點">
          <Input
            icon={MapPin}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="喺邊度？（選填）"
          />
        </Field>

        {/* 時間 — 分組卡片，留多啲呼吸位 */}
        <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-slate-700/60 dark:bg-slate-800/40">
          <Toggle checked={allDay} onChange={setAllDay} label="全日活動" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="開始">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  type="date"
                  value={startDate}
                  className="min-w-0"
                  onChange={(e) => {
                    setStartDate(e.target.value)
                    if (endDate < e.target.value) setEndDate(e.target.value)
                  }}
                />
                {!allDay && (
                  <Input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full min-w-0 sm:w-32"
                  />
                )}
              </div>
            </Field>
            <Field label="結束">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  type="date"
                  value={endDate}
                  min={startDate}
                  className="min-w-0"
                  onChange={(e) => setEndDate(e.target.value)}
                />
                {!allDay && (
                  <Input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full min-w-0 sm:w-32"
                  />
                )}
              </div>
            </Field>
          </div>
        </div>

        <Field label="行事曆">
          <div className="flex items-center gap-2">
            <span
              className={cx('h-3 w-3 shrink-0 rounded-full', colorOf(cat?.color).dot)}
            />
            <Select value={calendarId} onChange={(e) => setCalendarId(e.target.value)}>
              {calendars.length === 0 && <option value="">（未有行事曆）</option>}
              {calendars.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
        </Field>

        {/* 重複 — 分組卡片，揀咗先展開細節 */}
        <div
          className={cx(
            'space-y-3 rounded-2xl border p-4 transition-colors',
            freq !== 'none'
              ? 'border-slate-200/80 bg-slate-50/50 dark:border-slate-700/60 dark:bg-slate-800/40'
              : 'border-slate-200/80 dark:border-slate-700/60',
          )}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="重複">
              <Select
                value={freq}
                onChange={(e) => setFreq(e.target.value as RecurrenceFreq)}
              >
                {FREQ_OPTIONS.map((o) => (
                  <option key={o.v} value={o.v}>
                    {o.l}
                  </option>
                ))}
              </Select>
            </Field>
            {freq !== 'none' && (
              <Field label="每隔">
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    value={interval}
                    onChange={(e) => setIntervalN(e.target.value)}
                    className="w-20"
                  />
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    {freq === 'daily'
                      ? '日'
                      : freq === 'weekly'
                        ? '週'
                        : freq === 'monthly'
                          ? '個月'
                          : '年'}
                  </span>
                </div>
              </Field>
            )}
          </div>

          {freq === 'weekly' && (
            <Field label="揀邊幾日重複（留空就跟開始日）">
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAYS.map((w, i) => {
                  const on = byWeekday.includes(i)
                  return (
                    <button
                      key={i}
                      type="button"
                      aria-pressed={on}
                      aria-label={`星期${w}`}
                      onClick={() =>
                        setByWeekday((prev) =>
                          prev.includes(i)
                            ? prev.filter((d) => d !== i)
                            : [...prev, i],
                        )
                      }
                      className={cx(
                        'h-9 w-9 rounded-full text-sm font-medium transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
                        on
                          ? 'bg-accent text-white shadow-sm shadow-accent/25'
                          : 'bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-100 hover:text-slate-800 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-700',
                      )}
                    >
                      {w}
                    </button>
                  )
                })}
              </div>
            </Field>
          )}

          {freq !== 'none' && (
            <Field label="重複到幾時（選填，留空就一直重複）">
              <Input
                type="date"
                icon={Repeat}
                value={until}
                min={startDate}
                onChange={(e) => setUntil(e.target.value)}
              />
            </Field>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="提醒">
            <Select
              value={String(alert)}
              onChange={(e) => setAlert(Number(e.target.value))}
            >
              {ALERT_OPTIONS.map((o) => (
                <option key={o.v} value={o.v}>
                  {o.l}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="網址">
            <Input
              icon={Link2}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://（選填）"
            />
          </Field>
        </div>

        <Field label="備註">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="想補充啲咩？（選填）"
          />
        </Field>

        {/* 摘要列 — 一眼睇晒已填嘅重點 */}
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-200/70 pt-4 text-xs text-slate-500 dark:border-slate-700/60 dark:text-slate-400">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 font-medium tabular-nums dark:bg-slate-800">
            <CalendarDays size={13} className="text-slate-400" /> {startDate}
          </span>
          {!allDay && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 font-medium tabular-nums dark:bg-slate-800">
              <Clock size={13} className="text-slate-400" /> {startTime}–{endTime}
            </span>
          )}
          {alert >= 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 font-medium dark:bg-slate-800">
              <Bell size={13} className="text-slate-400" /> {ALERT_OPTIONS.find((a) => a.v === alert)?.l}
            </span>
          )}
          {notes.trim() && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 font-medium dark:bg-slate-800">
              <AlignLeft size={13} className="text-slate-400" /> 有備註
            </span>
          )}
        </div>
      </div>
    </Modal>

      {scopeAction && editing && (
        <Modal
          open
          onClose={() => setScopeAction(null)}
          title={scopeAction === 'delete' ? '刪除重複活動' : '更新重複活動'}
          size="sm"
        >
          <p className="mb-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            「{editing.title}」係重複活動，你想{scopeAction === 'delete' ? '刪除' : '更新'}邊一啲？
          </p>
          <div className="flex flex-col gap-2">
            {occurrenceKey && (
              <Button
                variant="secondary"
                fullWidth
                onClick={scopeAction === 'delete' ? deleteThis : saveThis}
              >
                只{scopeAction === 'delete' ? '刪除' : '更新'}呢一日（{occurrenceKey}）
              </Button>
            )}
            <Button
              variant={scopeAction === 'delete' ? 'danger' : 'primary'}
              fullWidth
              onClick={scopeAction === 'delete' ? deleteAll : saveAll}
            >
              {scopeAction === 'delete' ? '刪除' : '更新'}成個系列
            </Button>
            <Button variant="ghost" fullWidth onClick={() => setScopeAction(null)}>
              取消
            </Button>
          </div>
        </Modal>
      )}
    </>
  )
}
