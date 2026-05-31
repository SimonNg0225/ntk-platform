import { useEffect, useMemo, useState } from 'react'
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
import {
  CATEGORY_OPTIONS,
  CHANNELS,
  DIRECTION_LABEL,
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
import { FileText, Sparkles } from 'lucide-react'

// ============================================================
//  溝通記錄編輯器（新增 / 編輯共用）
//  寫返兩層：核心欄位 → parentCommsCol；進階 metadata → 本地 metaCol
// ============================================================

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
  classes,
  students,
  templates,
  onClose,
  onSave,
}: {
  open: boolean
  editing: CommRow | null
  classes: Klass[]
  students: Student[]
  templates: CommTemplate[]
  onClose: () => void
  onSave: (result: SaveResult, editingId: string | null) => void
}) {
  const [d, setD] = useState<CommDraft>(emptyDraft)

  useEffect(() => {
    if (!open) return
    setD(editing ? draftFromRow(editing) : emptyDraft())
  }, [open, editing])

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
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={editing ? '編輯溝通記錄' : '新增溝通記錄'}
    >
      <form onSubmit={submit} className="space-y-4">
        {/* 對象 */}
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

        {/* 方向 + 聯絡人 */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="方向">
            <div className="grid grid-cols-2 gap-2">
              {DIRECTIONS.map((dir) => (
                <button
                  key={dir}
                  type="button"
                  onClick={() => set('direction', dir)}
                  className={cx(
                    'rounded-lg border px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
                    d.direction === dir
                      ? 'border-accent bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
                  )}
                >
                  {DIRECTION_LABEL[dir]}
                </button>
              ))}
            </div>
          </Field>

          <Field label="聯絡人（選填）" hint="例如：陳太、父親">
            <Input
              value={d.contactName}
              onChange={(e) => set('contactName', e.target.value)}
              placeholder="家長 / 監護人稱呼"
            />
          </Field>
        </div>

        {/* 日期 / 方式 / 分類 */}
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

        {/* 內容 + 範本 */}
        <Field
          label="內容摘要"
          required
        >
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs text-slate-400 dark:text-slate-500">
              記錄溝通重點
            </span>
            {templates.length > 0 && (
              <Menu
                align="end"
                trigger={
                  <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700">
                    <Sparkles size={13} />
                    套用範本
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
          <Textarea
            className="min-h-[120px]"
            value={d.summary}
            onChange={(e) => set('summary', e.target.value)}
            placeholder="溝通內容、家長回應、達成共識…"
          />
        </Field>

        {/* 觀感 */}
        <Field label="溝通觀感（選填）">
          <div className="grid grid-cols-3 gap-2">
            {(['positive', 'neutral', 'concern'] as Outcome[]).map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => set('outcome', d.outcome === o ? '' : o)}
                className={cx(
                  'rounded-lg border px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
                  d.outcome === o
                    ? o === 'positive'
                      ? 'border-emerald-400 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300'
                      : o === 'concern'
                        ? 'border-rose-400 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300'
                        : 'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200'
                    : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700',
                )}
              >
                {OUTCOME_LABEL[o]}
              </button>
            ))}
          </div>
        </Field>

        {/* 跟進 */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-slate-800/40">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-accent focus:ring-accent/30 dark:border-slate-700"
              checked={d.followUp}
              onChange={(e) => set('followUp', e.target.checked)}
            />
            需要跟進
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
              <Field label="跟進待辦（選填）">
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

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button type="submit" disabled={!canSubmit}>
            {editing ? '儲存變更' : '新增記錄'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
