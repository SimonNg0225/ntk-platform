import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { ParentComm, Klass, Student } from '../../../data/types'
import {
  Button,
  Field,
  Input,
  Menu,
  Modal,
  Select,
  Textarea,
  cx,
} from '../../../ui'
import type { LucideIcon } from 'lucide-react'
import {
  CATEGORY_OPTIONS,
  CHANNELS,
  OUTCOME_LABEL,
  type Category,
  type Channel,
  type CommMeta,
  type CommRow,
  type CommTemplate,
  type Direction,
  type Outcome,
  shiftKey,
  todayKey,
} from './util'
import {
  ArrowDownLeft,
  CalendarClock,
  FileText,
  Frown,
  Mail,
  Meh,
  MessageSquareText,
  PenLine,
  Send,
  Smile,
  Sparkles,
  Users,
  X,
} from 'lucide-react'

// ============================================================
//  撰寫信件 — 往來書信編輯器（新增 / 編輯共用）
//  ------------------------------------------------------------
//  呼應主畫面通訊錄信箋語言：信箋封面（kicker + serif 標題 + 郵戳）、
//  發函 / 來函信頭、區段做信封段落小帽、信文似一張稿箋。
//  純表現層 —— 兩層寫入（parentCommsCol + 本地 metaCol）、驗證、
//  鍵盤、focus、onSave / onClose 簽名一律不變。
// ============================================================

// 信封段落小帽：uppercase kicker + 幼線，對齊主畫面 SectionLabel 節奏
function SectionLabel({
  icon: I,
  children,
}: {
  icon: LucideIcon
  children: ReactNode
}) {
  return (
    <div className="flex items-center gap-2.5">
      <p className="flex shrink-0 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
        <I size={13} className="shrink-0" />
        {children}
      </p>
      <span
        aria-hidden
        className="h-px flex-1 bg-gradient-to-r from-slate-200 to-transparent dark:from-slate-700/70"
      />
    </div>
  )
}

export interface CommDraft {
  classId: string
  studentId: string
  date: string
  channel: Channel
  summary: string
  followUp: boolean
  // metadata
  direction: Direction
  category: Category | ''
  outcome: Outcome | ''
  contactName: string
  followUpDate: string
  followUpNote: string
  remindMinutes: number | ''
}

function emptyDraft(): CommDraft {
  return {
    classId: '',
    studentId: '',
    date: todayKey(),
    channel: '電話',
    summary: '',
    followUp: false,
    direction: 'outgoing',
    category: '',
    outcome: '',
    contactName: '',
    followUpDate: '',
    followUpNote: '',
    remindMinutes: '',
  }
}

function draftFromRow(row: CommRow): CommDraft {
  const { comm, meta } = row
  return {
    classId: comm.classId,
    studentId: comm.studentId ?? '',
    date: comm.date,
    channel: (CHANNELS as readonly string[]).includes(comm.channel)
      ? (comm.channel as Channel)
      : '電話',
    summary: comm.summary,
    followUp: comm.followUp ?? false,
    direction: meta?.direction ?? 'outgoing',
    category: meta?.category ?? '',
    outcome: meta?.outcome ?? '',
    contactName: meta?.contactName ?? '',
    followUpDate: meta?.followUpDate ?? '',
    followUpNote: meta?.followUpNote ?? '',
    remindMinutes: meta?.remindMinutes ?? '',
  }
}

export type SaveResult = {
  comm: Omit<ParentComm, 'id'> & { id?: string }
  meta: Omit<CommMeta, 'id' | 'commId' | 'updatedAt'>
}

const REMIND_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: '當日' },
  { value: 60 * 24, label: '提前 1 日' },
  { value: 60 * 24 * 2, label: '提前 2 日' },
  { value: 60 * 24 * 7, label: '提前 1 週' },
]

const DIRECTIONS: Direction[] = ['outgoing', 'incoming']

export default function CommEditor({
  open,
  editing,
  preset,
  classes,
  students,
  templates,
  onClose,
  onSave,
}: {
  open: boolean
  editing: CommRow | null
  /** 新增時預填班別 / 學生（例如由「需聯絡」名單一鍵起草）；editing 時忽略 */
  preset?: { classId: string; studentId: string }
  classes: Klass[]
  students: Student[]
  templates: CommTemplate[]
  onClose: () => void
  onSave: (result: SaveResult, editingId: string | null) => void
}) {
  const [d, setD] = useState<CommDraft>(emptyDraft)

  useEffect(() => {
    if (!open) return
    if (editing) {
      setD(draftFromRow(editing))
    } else {
      setD({
        ...emptyDraft(),
        classId: preset?.classId ?? '',
        studentId: preset?.studentId ?? '',
      })
    }
  }, [open, editing, preset])

  const set = <K extends keyof CommDraft>(key: K, value: CommDraft[K]) =>
    setD((prev) => ({ ...prev, [key]: value }))

  const formStudents = useMemo(
    () => (d.classId ? students.filter((s) => s.classId === d.classId) : []),
    [students, d.classId],
  )

  const canSubmit = d.classId !== '' && d.summary.trim() !== ''

  const applyTemplate = (t: CommTemplate) => {
    setD((prev) => ({
      ...prev,
      channel: (CHANNELS as readonly string[]).includes(t.channel)
        ? (t.channel as Channel)
        : prev.channel,
      category: t.category,
      // 已有內容就接喺後面，避免覆寫
      summary: prev.summary.trim() ? `${prev.summary.trim()}\n\n${t.body}` : t.body,
    }))
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    const followUp = d.followUp
    onSave(
      {
        comm: {
          classId: d.classId,
          studentId: d.studentId || undefined,
          date: d.date,
          channel: d.channel,
          summary: d.summary.trim(),
          followUp,
          createdAt: editing?.comm.createdAt ?? new Date().toISOString(),
        },
        meta: {
          direction: d.direction,
          category: d.category || undefined,
          outcome: d.outcome || undefined,
          contactName: d.contactName.trim() || undefined,
          followUpDate: followUp ? d.followUpDate || undefined : undefined,
          followUpNote: followUp ? d.followUpNote.trim() || undefined : undefined,
          remindMinutes:
            followUp && d.followUpDate && d.remindMinutes !== ''
              ? Number(d.remindMinutes)
              : undefined,
        },
      },
      editing?.comm.id ?? null,
    )
  }

  return (
    <Modal open={open} onClose={onClose} size="lg">
      {/* ───────── 信箋封面：kicker + serif 標題 + 郵戳（呼應主畫面 masthead）───────── */}
      <header className="relative -mx-5 -mt-5 overflow-hidden px-5 pb-4 pt-5 sm:-mx-6 sm:-mt-6 sm:px-6 sm:pt-6">
        {/* 右上郵戳裝飾（純裝飾，唔搶主次；手機收起） */}
        <span
          aria-hidden
          className="pointer-events-none absolute -right-5 top-3 hidden -rotate-[8deg] select-none flex-col items-center rounded-full border-2 border-dashed border-accent/20 px-4 py-2.5 font-serif text-[9px] font-semibold uppercase tracking-[0.28em] text-accent/25 dark:border-accent/25 dark:text-accent/25 sm:flex">
          <Mail size={14} className="mb-0.5" />
          {editing ? '修函' : '草擬'}
        </span>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.3em] text-accent/70">
              <PenLine size={12} />
              通訊錄 · Correspondence
            </p>
            <h2 className="mt-1.5 font-serif text-[24px] font-semibold leading-none tracking-tight text-slate-800 dark:text-slate-100 sm:text-[26px]">
              {editing ? '編輯信件' : '撰寫信件'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="關閉"
            className="-mr-1.5 -mt-1 shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:hover:bg-slate-700">
            <X size={18} />
          </button>
        </div>
        {/* 信箋雙線（封面分隔感） */}
        <div className="mt-4 space-y-1" aria-hidden>
          <span className="block h-px bg-slate-200/90 dark:bg-slate-700/70" />
          <span className="block h-px bg-slate-200/60 dark:bg-slate-700/40" />
        </div>
      </header>

      <form onSubmit={submit} className="space-y-6">
        {/* 收件人 */}
        <section className="space-y-3">
          <SectionLabel icon={Users}>收件人 · Recipient</SectionLabel>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="班別" required>
              <Select
                value={d.classId}
                onChange={(e) => {
                  set('classId', e.target.value)
                  set('studentId', '')
                }}
              >
                <option value="">請揀班別</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.subject ? `（${c.subject}）` : ''}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="學生（選填）">
              <Select
                value={d.studentId}
                disabled={!d.classId}
                onChange={(e) => set('studentId', e.target.value)}
              >
                <option value="">{d.classId ? '全班 / 不指定' : '請先揀班別'}</option>
                {formStudents.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.studentNo ? `（${s.studentNo}）` : ''}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </section>

        {/* 寄件詳情 */}
        <section className="space-y-3">
          <SectionLabel icon={CalendarClock}>寄件詳情 · Dispatch</SectionLabel>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="信件方向">
              {/* 發函 / 來函：選中色跟方向（發函 teal accent · 來函 blue），呼應時間線信頭 */}
              <div className="grid grid-cols-2 gap-2">
                {DIRECTIONS.map((dir) => {
                  const DirIco = dir === 'incoming' ? ArrowDownLeft : Send
                  const on = d.direction === dir
                  const incoming = dir === 'incoming'
                  return (
                    <button
                      key={dir}
                      type="button"
                      onClick={() => set('direction', dir)}
                      aria-pressed={on}
                      className={cx(
                        'inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
                        on
                          ? incoming
                            ? 'border-blue-400 bg-blue-50 text-blue-700 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-300'
                            : 'border-accent bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
                      )}
                    >
                      <DirIco size={14} />
                      {incoming ? '來函' : '發函'}
                    </button>
                  )
                })}
              </div>
            </Field>

            <Field label="收信人稱呼（選填）" hint="例如：陳太、父親">
              <Input
                value={d.contactName}
                onChange={(e) => set('contactName', e.target.value)}
                placeholder="家長 / 監護人稱呼"
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="日期">
              <Input type="date" value={d.date} onChange={(e) => set('date', e.target.value)} />
            </Field>
            <Field label="聯絡方式">
              <Select value={d.channel} onChange={(e) => set('channel', e.target.value as Channel)}>
                {CHANNELS.map((ch) => (
                  <option key={ch} value={ch}>
                    {ch}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="主題分類">
              <Select
                value={d.category}
                onChange={(e) => set('category', e.target.value as Category | '')}
              >
                <option value="">未分類</option>
                {CATEGORY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </section>

        {/* 信文 + 範本：似一張稿箋 */}
        <section className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="comm-body"
              className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500"
            >
              <MessageSquareText size={13} className="shrink-0" />
              信文 · Letter body
              <span className="text-rose-500" aria-hidden>*</span>
            </label>
            {templates.length > 0 && (
              <Menu
                align="end"
                trigger={
                  <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700">
                    <Sparkles size={13} />
                    取信件範本
                  </span>
                }
                items={templates.map((t) => ({
                  id: t.id,
                  label: t.title,
                  icon: FileText,
                  onSelect: () => applyTemplate(t),
                }))}
              />
            )}
          </div>
          {/* 稿箋框：頂部一條 accent 細線似抬頭橫線；focus 落框身（鍵盤可見） */}
          <div className="overflow-hidden rounded-xl ring-1 ring-slate-200/80 transition focus-within:ring-2 focus-within:ring-accent/40 dark:ring-slate-700/70">
            <span aria-hidden className="block h-0.5 bg-accent/30 dark:bg-accent/25" />
            <Textarea
              id="comm-body"
              className="min-h-[132px] rounded-none border-0 bg-white leading-relaxed focus:border-0 focus:ring-0 dark:bg-slate-800"
              value={d.summary}
              onChange={(e) => set('summary', e.target.value)}
              placeholder="敬啟者…&#10;記低溝通內容、家長回應、達成共識。"
            />
          </div>
          <p className="px-0.5 text-xs text-slate-400 dark:text-slate-500">
            落筆記低呢次往來嘅重點，日後喺通訊錄一翻就見到。
          </p>
        </section>

        {/* 觀感 */}
        <Field label="家長回響（選填）">
          <div className="grid grid-cols-3 gap-2">
            {(['positive', 'neutral', 'concern'] as Outcome[]).map((o) => {
              const ICON: Record<Outcome, LucideIcon> = {
                positive: Smile,
                neutral: Meh,
                concern: Frown,
              }
              const I = ICON[o]
              return (
                <button
                  key={o}
                  type="button"
                  onClick={() => set('outcome', d.outcome === o ? '' : o)}
                  className={cx(
                    'inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
                    d.outcome === o
                      ? o === 'positive'
                        ? 'border-emerald-400 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300'
                        : o === 'concern'
                          ? 'border-rose-400 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300'
                          : 'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200'
                      : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700',
                  )}
                >
                  <I size={14} />
                  {OUTCOME_LABEL[o]}
                </button>
              )
            })}
          </div>
        </Field>

        {/* 跟進 */}
        <div
          className={cx(
            'rounded-2xl border p-3.5 transition-colors',
            d.followUp
              ? 'border-accent/30 bg-accent-soft/40 dark:border-accent/30 dark:bg-accent/10'
              : 'border-slate-200 bg-slate-50/60 dark:border-slate-700 dark:bg-slate-800/40',
          )}
        >
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-accent focus:ring-accent/30 dark:border-slate-700"
              checked={d.followUp}
              onChange={(e) => set('followUp', e.target.checked)}
            />
            <CalendarClock size={15} className="text-accent" />
            待回覆跟進（記低回郵到期）
          </label>
          {d.followUp && (
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="跟進到期日">
                  <Input
                    type="date"
                    value={d.followUpDate}
                    onChange={(e) => set('followUpDate', e.target.value)}
                  />
                </Field>
                <Field label="提醒">
                  <Select
                    value={d.remindMinutes === '' ? '' : String(d.remindMinutes)}
                    disabled={!d.followUpDate}
                    onChange={(e) =>
                      set('remindMinutes', e.target.value === '' ? '' : Number(e.target.value))
                    }
                  >
                    <option value="">不提醒</option>
                    {REMIND_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Field label="回覆待辦（選填）">
                <Input
                  value={d.followUpNote}
                  onChange={(e) => set('followUpNote', e.target.value)}
                  placeholder="例如：再致電了解測驗準備情況"
                />
              </Field>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: '明日', days: 1 },
                  { label: '3 日後', days: 3 },
                  { label: '1 週後', days: 7 },
                  { label: '2 週後', days: 14 },
                ].map((q) => (
                  <button
                    key={q.days}
                    type="button"
                    onClick={() => set('followUpDate', shiftKey(todayKey(), q.days))}
                    className="rounded-md bg-white px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-200 transition hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-700"
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 動作列：信箋雙線分隔，呼應封面 */}
        <div className="-mx-5 mt-1 space-y-1 px-5 pt-1 sm:-mx-6 sm:px-6" aria-hidden>
          <span className="block h-px bg-slate-200/80 dark:bg-slate-700/60" />
          <span className="block h-px bg-slate-200/50 dark:bg-slate-700/35" />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button type="submit" disabled={!canSubmit} icon={Send}>
            {editing ? '儲存變更' : '存入通訊錄'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
