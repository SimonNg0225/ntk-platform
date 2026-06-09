import type { ReactNode } from 'react'
import { useState } from 'react'
import {
  AlignLeft,
  Bell,
  CalendarDays,
  CalendarPlus,
  Check,
  Clock,
  Link2,
  MapPin,
  PenLine,
  Repeat,
  Trash2,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { eventsCol } from '../../../data/collections'
import type {
  CalendarCategory,
  CalendarEvent,
  RecurrenceFreq,
} from '../../../data/types'
import { useToast } from '../../../context/ToastContext'
import { useConfirm } from '../../../context/ConfirmContext'
import { Button, Field, IconButton, Input, Modal, Select, Textarea, cx } from '../../../ui'
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

/**
 * 「整體編輯」儲存用：將完整 payload 套落原事件，並真正剔走被清空（undefined）
 * 嘅 optional 欄位 —— store.update() 係 merge `{...old, ...patch}`，剷唔到 key，
 * 所以呢度自己砌返一個乾淨物件再用 set() 整體取代。保留原 id 同 exDates。
 */
export function applyFullEdit(
  existing: CalendarEvent,
  payload: Omit<CalendarEvent, 'id'>,
): CalendarEvent {
  const merged: Record<string, unknown> = {
    ...existing,
    ...payload,
    id: existing.id,
    exDates: existing.exDates,
  }
  for (const k of Object.keys(merged)) {
    if (merged[k] === undefined) delete merged[k]
  }
  return merged as unknown as CalendarEvent
}

// ───────── 週記分區頁眉（方形 icon 牌 + uppercase 小題 + 向右散開 hairline）─────────
//  呼應主畫面行事曆嘅冊頁分段語言：每個分區（時間 / 重複 / 提醒…）似週記
//  上一段分節——左邊一個方形 icon 牌，右邊一條淡到透明嘅尺線。
function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon
  title: string
  children?: ReactNode
}) {
  return (
    <div className="flex items-center gap-2 px-0.5">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500 dark:bg-slate-700/60 dark:text-slate-300">
        <Icon size={13} />
      </span>
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
        {title}
      </h3>
      <span
        aria-hidden
        className="ml-1 h-px flex-1 bg-gradient-to-r from-slate-200 to-transparent dark:from-slate-700/70"
      />
      {children}
    </div>
  )
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
    // 「整體編輯」嘅 payload：每個 optional 欄位都顯式表達（空 = undefined），
    // 唔好「省略 key」。否則用 merge 儲存時，清空咗嘅欄位會殘留舊值
    // （最嚴重：改成『不重複』後 recurrence 殘留 → 事件永遠繼續重複）。
    // saveThis() 係新增獨立事件（fresh add），唔受 merge 影響。
    const payload: Omit<CalendarEvent, 'id'> = {
      title: title.trim(),
      date: startDate,
      allDay,
      time: !allDay && startTime ? startTime : undefined,
      endTime: !allDay && endTime ? endTime : undefined,
      endDate: endDate && endDate !== startDate ? endDate : undefined,
      calendarId: calendarId || undefined,
      location: location.trim() || undefined,
      url: url.trim() || undefined,
      notes: notes.trim() || undefined,
      alertMinutes: alert >= 0 ? alert : undefined,
      recurrence:
        freq !== 'none'
          ? {
              freq,
              interval: Math.max(1, Number(interval) || 1),
              ...(until ? { until } : {}),
              ...(freq === 'weekly' && byWeekday.length
                ? { byWeekday: [...byWeekday].sort((a, b) => a - b) }
                : {}),
            }
          : undefined,
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
      // 整體取代（剔走清空欄位），唔可以用 merge update —— 見 applyFullEdit
      const next = applyFullEdit(editing, payload)
      eventsCol.set(eventsCol.get().map((e) => (e.id === editing.id ? next : e)))
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
    // 整體取代（剔走清空欄位）—— 見 applyFullEdit；唔可以用 merge update
    const next = applyFullEdit(editing, payload)
    eventsCol.set(eventsCol.get().map((e) => (e.id === editing.id ? next : e)))
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
        {/* ───────── 週記頁眉：kicker + serif 標題 + 雙線封面分隔（呼應主畫面）───────── */}
        <header className="-mx-5 -mt-5 mb-1 px-5 pt-5 sm:-mx-6 sm:-mt-6 sm:px-6 sm:pt-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.3em] text-accent/70">
                {editing ? <PenLine size={12} className="shrink-0" /> : <CalendarPlus size={12} className="shrink-0" />}
                {editing ? '日程一則 · Entry' : '新一則 · New Entry'}
              </p>
              <h2 className="mt-1 text-[22px] font-semibold leading-tight tracking-tight text-slate-800 dark:text-slate-100 sm:text-[26px]">
                {editing ? '編輯活動' : '新增活動'}
              </h2>
            </div>
            <IconButton label="關閉" onClick={onClose} className="-mr-1 shrink-0">
              <X size={18} />
            </IconButton>
          </div>
          {/* 週記雙線（封面分隔感）*/}
          <div className="mt-4 space-y-1" aria-hidden>
            <span className="block h-px bg-slate-200/90 dark:bg-slate-700/70" />
            <span className="block h-px bg-slate-200/60 dark:bg-slate-700/40" />
          </div>
        </header>

        {/* 標題 — 放大作主焦點，左邊披返所選行事曆嘅柔和色脊（呼應事件 chip）*/}
        <div className="flex items-stretch gap-3">
          <span
            aria-hidden
            className={cx('mt-0.5 w-1 shrink-0 rounded-full transition-colors', colorOf(cat?.color).dot)}
          />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="想安排啲咩？"
            autoFocus
            className="w-full border-0 border-b border-slate-200 bg-transparent pb-2 text-lg font-semibold text-slate-800 outline-none transition-colors placeholder:font-normal placeholder:text-slate-400 focus:border-accent dark:border-slate-700 dark:text-slate-100 dark:placeholder:text-slate-500 sm:text-xl"
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

        {/* 時間 — 分區頁眉 + 分組卡片，留多啲呼吸位 */}
        <div className="space-y-3">
          <Section icon={Clock} title="時間" />
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

        {/* 重複 — 分區頁眉 + 分組卡片，揀咗先展開細節 */}
        <div className="space-y-3">
          <Section icon={Repeat} title="重複" />
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
        </div>

        {/* 提醒 + 連結 — 分區頁眉 */}
        <div className="space-y-3">
          <Section icon={Bell} title="提醒與連結" />
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
        </div>

        <Field label="備註">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="想補充啲咩？（選填）"
          />
        </Field>

        {/* ───────── 週記事件預覽：此刻會點樣落喺日程上嘅一枚柔和 chip ───────── */}
        <div className="space-y-2.5 border-t border-slate-200/70 pt-4 dark:border-slate-700/60">
          <p className="flex items-center gap-1.5 px-0.5 text-[11px] font-medium uppercase tracking-[0.18em] text-accent/70">
            <CalendarDays size={12} className="shrink-0" />
            落在日程上
          </p>
          {/* 一枚事件 chip：戴返所選行事曆嘅柔和色衣 + 色脊（同主畫面月／週視圖一致）*/}
          <div
            className={cx(
              'relative overflow-hidden rounded-xl py-2 pl-3.5 pr-3 ring-1 ring-inset ring-black/5 dark:ring-white/10',
              colorOf(cat?.color).chip,
            )}
          >
            <span aria-hidden className={cx('absolute inset-y-1.5 left-0 w-1 rounded-full', colorOf(cat?.color).dot)} />
            <p className="truncate text-sm font-semibold">
              {title.trim() || '未命名活動'}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] font-medium opacity-80">
              <span className="inline-flex items-center gap-1 tabular-nums">
                <CalendarDays size={11} /> {startDate}
              </span>
              <span className="inline-flex items-center gap-1 tabular-nums">
                <Clock size={11} /> {allDay ? '全日' : `${startTime}–${endTime}`}
              </span>
              {freq !== 'none' && (
                <span className="inline-flex items-center gap-1">
                  <Repeat size={11} /> {FREQ_OPTIONS.find((f) => f.v === freq)?.l}
                </span>
              )}
              {alert >= 0 && (
                <span className="inline-flex items-center gap-1">
                  <Bell size={11} /> {ALERT_OPTIONS.find((a) => a.v === alert)?.l}
                </span>
              )}
              {notes.trim() && (
                <span className="inline-flex items-center gap-1">
                  <AlignLeft size={11} /> 有備註
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </Modal>

      {scopeAction && editing && (
        <Modal open onClose={() => setScopeAction(null)} size="sm">
          <div className="mb-4">
            <p
              className={cx(
                'flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.3em]',
                scopeAction === 'delete' ? 'text-rose-500/80 dark:text-rose-400/80' : 'text-accent/70',
              )}
            >
              <Repeat size={12} className="shrink-0" />
              重複系列 · Series
            </p>
            <h3 className="mt-1 text-lg font-semibold leading-tight text-slate-800 dark:text-slate-100">
              {scopeAction === 'delete' ? '刪除重複活動' : '更新重複活動'}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              「{editing.title}」係重複活動，你想{scopeAction === 'delete' ? '刪除' : '更新'}邊一啲？
            </p>
          </div>
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
