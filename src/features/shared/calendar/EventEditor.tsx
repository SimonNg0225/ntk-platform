import { useState } from 'react'
import {
  AlignLeft,
  Bell,
  CalendarDays,
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

function plusHour(t: string): string {
  const [h, m] = t.split(':').map(Number)
  const tot = ((h || 0) + 1) * 60 + (m || 0)
  const hh = Math.floor(tot / 60) % 24
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
      className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200"
    >
      <span
        className={cx(
          'relative h-5 w-9 rounded-full transition-colors',
          checked ? 'bg-accent' : 'bg-slate-300 dark:bg-slate-600',
        )}
      >
        <span
          className={cx(
            'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all',
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
          <Button onClick={save} disabled={!valid}>
            {editing ? '儲存' : '新增'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="標題">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="活動名稱"
            autoFocus
          />
        </Field>

        <Field label="地點">
          <Input
            icon={MapPin}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="加入地點（選填）"
          />
        </Field>

        <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
          <Toggle checked={allDay} onChange={setAllDay} label="全日" />
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="開始">
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={startDate}
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
                    className="w-32"
                  />
                )}
              </div>
            </Field>
            <Field label="結束">
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
                {!allDay && (
                  <Input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-32"
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
          <Field label="喺呢啲日子重複（留空 = 跟開始日）">
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAYS.map((w, i) => {
                const on = byWeekday.includes(i)
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() =>
                      setByWeekday((prev) =>
                        prev.includes(i)
                          ? prev.filter((d) => d !== i)
                          : [...prev, i],
                      )
                    }
                    className={cx(
                      'h-8 w-8 rounded-full text-sm font-medium transition',
                      on
                        ? 'bg-accent text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
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
          <Field label="重複至（選填，留空 = 永遠）">
            <Input
              type="date"
              icon={Repeat}
              value={until}
              min={startDate}
              onChange={(e) => setUntil(e.target.value)}
            />
          </Field>
        )}

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
            placeholder="補充資料……"
          />
        </Field>

        {/* 圖示提示列（純裝飾，呼應 Apple 編輯器欄位） */}
        <div className="flex flex-wrap gap-3 pt-1 text-xs text-slate-400 dark:text-slate-500">
          <span className="inline-flex items-center gap-1">
            <CalendarDays size={13} /> {startDate}
          </span>
          {!allDay && (
            <span className="inline-flex items-center gap-1">
              <Clock size={13} /> {startTime}–{endTime}
            </span>
          )}
          {alert >= 0 && (
            <span className="inline-flex items-center gap-1">
              <Bell size={13} /> {ALERT_OPTIONS.find((a) => a.v === alert)?.l}
            </span>
          )}
          {notes.trim() && (
            <span className="inline-flex items-center gap-1">
              <AlignLeft size={13} /> 有備註
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
          <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
            「{editing.title}」係重複活動，你想
            {scopeAction === 'delete' ? '刪除' : '更新'}邊啲？
          </p>
          <div className="flex flex-col gap-2">
            {occurrenceKey && (
              <Button
                variant="secondary"
                onClick={scopeAction === 'delete' ? deleteThis : saveThis}
              >
                僅{scopeAction === 'delete' ? '刪除' : '更新'}此活動（{occurrenceKey}）
              </Button>
            )}
            <Button
              variant={scopeAction === 'delete' ? 'danger' : 'primary'}
              onClick={scopeAction === 'delete' ? deleteAll : saveAll}
            >
              {scopeAction === 'delete' ? '刪除' : '更新'}所有活動
            </Button>
            <Button variant="ghost" onClick={() => setScopeAction(null)}>
              取消
            </Button>
          </div>
        </Modal>
      )}
    </>
  )
}
