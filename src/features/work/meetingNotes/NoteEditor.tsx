import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Badge,
  Button,
  Field,
  IconButton,
  Input,
  Menu,
  Modal,
  SectionTitle,
  Select,
  Textarea,
  Tooltip,
  cx,
} from '../../../ui'
import {
  CalendarClock,
  CheckSquare,
  CornerDownRight,
  FileText,
  Gavel,
  MapPin,
  Plus,
  Sparkles,
  Square,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import type { MeetingNote } from '../../../data/types'
import {
  MEETING_TYPE_META,
  MEETING_TYPE_ORDER,
  makeAction,
  parseContent,
  todayKey,
  uidLocal,
  type ActionItem,
  type MeetingType,
  type NoteMeta,
  type NoteTemplate,
} from './util'

// ============================================================
//  會議筆記編輯器（同時編輯 MeetingNote + NoteMeta）
//  ------------------------------------------------------------
//  · 標題 / 類型 / 日期 / 時間 / 時長 / 地點
//  · 出席者（chips，逐個加）
//  · 內容（Markdown-ish，支援 - [ ] 行動 / > 決議）
//  · 結構化行動項目（負責人 + 到期）+ 議決事項
//  · 套用議程範本 · 由內容一鍵抽取行動 / 決議
// ============================================================

export interface EditorDraft {
  title: string
  date: string
  time: string
  durationMin: string
  location: string
  type: MeetingType
  tagsInput: string
  content: string
  attendees: string[]
  decisions: string[]
  actions: ActionItem[]
}

export const emptyDraft = (): EditorDraft => ({
  title: '',
  date: todayKey(),
  time: '',
  durationMin: '',
  location: '',
  type: 'other',
  tagsInput: '',
  content: '',
  attendees: [],
  decisions: [],
  actions: [],
})

export function toDraft(note: MeetingNote, meta: NoteMeta): EditorDraft {
  return {
    title: note.title,
    date: note.date,
    time: meta.time ?? '',
    durationMin: meta.durationMin ? String(meta.durationMin) : '',
    location: meta.location ?? '',
    type: meta.type,
    tagsInput: note.tags?.join(', ') ?? '',
    content: note.content,
    attendees: [...meta.attendees],
    decisions: [...meta.decisions],
    actions: meta.actions.map((a) => ({ ...a })),
  }
}

export default function NoteEditor({
  open,
  mode,
  initial,
  templates,
  onClose,
  onSave,
}: {
  open: boolean
  mode: 'create' | 'edit'
  initial: EditorDraft
  templates: NoteTemplate[]
  onClose: () => void
  onSave: (draft: EditorDraft) => void
}) {
  const [draft, setDraft] = useState<EditorDraft>(initial)
  const [attendeeInput, setAttendeeInput] = useState('')
  const [decisionInput, setDecisionInput] = useState('')
  const contentRef = useRef<HTMLTextAreaElement | null>(null)

  // 每次開啟 / 切換初值時重設
  useEffect(() => {
    if (open) {
      setDraft(initial)
      setAttendeeInput('')
      setDecisionInput('')
    }
  }, [open, initial])

  const canSave =
    draft.title.trim().length > 0 && draft.content.trim().length > 0

  const patch = (p: Partial<EditorDraft>) => setDraft((d) => ({ ...d, ...p }))

  // ───────── 出席者 chips ─────────
  function addAttendees(raw: string) {
    const names = raw
      .split(/[,，、;；]+/)
      .map((s) => s.trim())
      .filter(Boolean)
    if (names.length === 0) return
    setDraft((d) => {
      const set = new Set(d.attendees)
      names.forEach((n) => set.add(n))
      return { ...d, attendees: Array.from(set) }
    })
    setAttendeeInput('')
  }
  function removeAttendee(name: string) {
    patch({ attendees: draft.attendees.filter((a) => a !== name) })
  }

  // ───────── 議決事項 ─────────
  function addDecision(raw: string) {
    const t = raw.trim()
    if (!t) return
    patch({ decisions: [...draft.decisions, t] })
    setDecisionInput('')
  }
  function removeDecision(idx: number) {
    patch({ decisions: draft.decisions.filter((_, i) => i !== idx) })
  }

  // ───────── 行動項目 ─────────
  function addAction() {
    patch({ actions: [...draft.actions, makeAction()] })
  }
  function updateAction(id: string, p: Partial<ActionItem>) {
    patch({
      actions: draft.actions.map((a) => (a.id === id ? { ...a, ...p } : a)),
    })
  }
  function removeAction(id: string) {
    patch({ actions: draft.actions.filter((a) => a.id !== id) })
  }

  // ───────── 範本 ─────────
  function applyTemplate(tpl: NoteTemplate) {
    setDraft((d) => ({
      ...d,
      type: tpl.type,
      // 若內容空 → 直接套；否則喺尾巴接落去
      content: d.content.trim() ? `${d.content}\n\n${tpl.content}` : tpl.content,
    }))
    // 套範本後自動聚焦內容
    setTimeout(() => contentRef.current?.focus(), 50)
  }

  // ───────── 由內容抽取行動 / 決議（似 Granola）─────────
  const parsed = useMemo(() => parseContent(draft.content), [draft.content])
  const extractCount = parsed.actions.length + parsed.decisions.length

  function extractFromContent() {
    setDraft((d) => {
      // 行動：以 text 去重（避免重覆抽）
      const existingTexts = new Set(d.actions.map((a) => a.text.trim()))
      const newActions: ActionItem[] = parsed.actions
        .filter((a) => !existingTexts.has(a.text.trim()))
        .map((a) => ({
          id: uidLocal('act'),
          text: a.text,
          owner: a.owner,
          due: a.due,
          done: a.done,
          createdAt: new Date().toISOString(),
        }))
      const existingDec = new Set(d.decisions.map((x) => x.trim()))
      const newDec = parsed.decisions.filter((x) => !existingDec.has(x.trim()))
      return {
        ...d,
        actions: [...d.actions, ...newActions],
        decisions: [...d.decisions, ...newDec],
      }
    })
  }

  const tpItems = templates.map((t) => ({
    id: t.id,
    label: t.name,
    icon: FileText,
    onSelect: () => applyTemplate(t),
  }))

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={mode === 'edit' ? '編輯會議筆記' : '新增會議筆記'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button onClick={() => onSave(draft)} disabled={!canSave} icon={CheckSquare}>
            {mode === 'edit' ? '儲存' : '新增筆記'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* 標題 + 類型 */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <Field label="標題" required>
              <Input
                value={draft.title}
                onChange={(e) => patch({ title: e.target.value })}
                placeholder="例如：科組會議 — 第二次"
                autoFocus
              />
            </Field>
          </div>
          <Field label="會議類型">
            <Select
              value={draft.type}
              onChange={(e) => patch({ type: e.target.value as MeetingType })}
            >
              {MEETING_TYPE_ORDER.map((t) => (
                <option key={t} value={t}>
                  {MEETING_TYPE_META[t].label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {/* 日期 / 時間 / 時長 / 地點（一組柔和卡）*/}
        <div className="grid grid-cols-2 gap-3 rounded-2xl border border-slate-200/80 p-4 dark:border-slate-700/60 sm:grid-cols-4">
          <Field label="日期">
            <Input
              type="date"
              value={draft.date}
              onChange={(e) => patch({ date: e.target.value })}
            />
          </Field>
          <Field label="時間">
            <Input
              type="time"
              value={draft.time}
              onChange={(e) => patch({ time: e.target.value })}
            />
          </Field>
          <Field label="時長（分鐘）">
            <Input
              type="number"
              min={0}
              value={draft.durationMin}
              onChange={(e) => patch({ durationMin: e.target.value })}
              placeholder="60"
            />
          </Field>
          <Field label="地點">
            <Input
              icon={MapPin}
              value={draft.location}
              onChange={(e) => patch({ location: e.target.value })}
              placeholder="會議室"
            />
          </Field>
        </div>

        {/* 出席者 */}
        <div>
          <SectionTitle icon={Users}>出席者</SectionTitle>
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200/80 bg-slate-50/60 p-2 transition focus-within:border-accent/40 focus-within:bg-white dark:border-slate-700/60 dark:bg-slate-800/40 dark:focus-within:bg-slate-800">
            {draft.attendees.map((a) => (
              <span
                key={a}
                className="inline-flex items-center gap-1 rounded-md bg-slate-100 py-0.5 pl-2 pr-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300"
              >
                {a}
                <button
                  type="button"
                  onClick={() => removeAttendee(a)}
                  className="rounded p-0.5 text-slate-400 transition hover:bg-slate-200 hover:text-rose-500 dark:hover:bg-slate-700"
                  aria-label={`移除 ${a}`}
                >
                  <X size={11} />
                </button>
              </span>
            ))}
            <input
              value={attendeeInput}
              onChange={(e) => setAttendeeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault()
                  addAttendees(attendeeInput)
                } else if (
                  e.key === 'Backspace' &&
                  attendeeInput === '' &&
                  draft.attendees.length > 0
                ) {
                  removeAttendee(draft.attendees[draft.attendees.length - 1])
                }
              }}
              onBlur={() => addAttendees(attendeeInput)}
              placeholder={draft.attendees.length ? '繼續加…' : '輸入姓名，Enter 加入'}
              className="min-w-[8rem] flex-1 bg-transparent py-1 text-base sm:text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>
        </div>

        {/* 內容 + 範本 + 抽取 */}
        <div>
          <SectionTitle
            icon={FileText}
            right={
              <div className="flex items-center gap-1.5">
                <Menu
                  align="end"
                  trigger={
                    <span className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-accent transition hover:bg-accent-soft dark:hover:bg-accent/15">
                      <FileText size={13} />
                      套用範本
                    </span>
                  }
                  items={tpItems}
                />
                <Tooltip label="由內容嘅 - [ ] / &gt; 自動抽出行動同決議">
                  <button
                    type="button"
                    onClick={extractFromContent}
                    disabled={extractCount === 0}
                    className={cx(
                      'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition disabled:opacity-40',
                      'text-accent hover:bg-accent-soft dark:hover:bg-accent/15',
                    )}
                  >
                    <Sparkles size={13} />
                    抽取 {extractCount > 0 ? `(${extractCount})` : ''}
                  </button>
                </Tooltip>
              </div>
            }
          >
            內容
          </SectionTitle>
          <Textarea
            ref={contentRef}
            className="min-h-[180px] font-[450] leading-relaxed"
            value={draft.content}
            onChange={(e) => patch({ content: e.target.value })}
            placeholder={'會議重點…\n\n小貼士：\n- [ ] 行動項目（可加 @負責人 !2026-06-01）\n> 決議事項'}
          />
          <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
            支援 <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">- [ ]</code>{' '}
            行動項目（<code className="rounded bg-slate-100 px-1 dark:bg-slate-800">@人 !日期</code>）同{' '}
            <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">&gt;</code> 決議；撳「抽取」轉成下面結構化清單。
          </p>
        </div>

        {/* 議決事項 */}
        <div>
          <SectionTitle icon={Gavel}>議決事項</SectionTitle>
          <div className="space-y-1.5">
            {draft.decisions.map((d, i) => (
              <div
                key={i}
                className="flex items-start gap-2 rounded-lg bg-accent-soft/50 px-2.5 py-1.5 dark:bg-accent/10"
              >
                <CornerDownRight
                  size={14}
                  className="mt-0.5 shrink-0 text-accent-strong dark:text-accent"
                />
                <span className="flex-1 text-sm text-slate-700 dark:text-slate-200">
                  {d}
                </span>
                <IconButton
                  label="刪除決議"
                  tone="danger"
                  size="sm"
                  onClick={() => removeDecision(i)}
                >
                  <X size={13} />
                </IconButton>
              </div>
            ))}
            <Input
              value={decisionInput}
              onChange={(e) => setDecisionInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addDecision(decisionInput)
                }
              }}
              placeholder="新增議決事項，Enter 加入…"
            />
          </div>
        </div>

        {/* 行動項目 */}
        <div>
          <SectionTitle
            icon={CheckSquare}
            right={
              <Button size="sm" variant="ghost" icon={Plus} onClick={addAction}>
                加項目
              </Button>
            }
          >
            跟進行動
          </SectionTitle>
          {draft.actions.length === 0 ? (
            <div className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-3 py-5 text-center dark:border-slate-700 dark:bg-slate-800/30">
              <CheckSquare size={20} className="text-slate-300 dark:text-slate-600" />
              <p className="text-xs text-slate-400 dark:text-slate-500">
                仲未有跟進項目。可手動加，或喺內容用{' '}
                <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">- [ ]</code>{' '}
                寫好再撳「抽取」。
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {draft.actions.map((a) => (
                <div
                  key={a.id}
                  className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200/80 bg-white p-2.5 shadow-xs transition focus-within:border-accent/40 dark:border-slate-700/60 dark:bg-slate-800 dark:shadow-none"
                >
                  <button
                    type="button"
                    onClick={() => updateAction(a.id, { done: !a.done })}
                    className={cx(
                      'shrink-0 transition active:scale-90',
                      a.done
                        ? 'text-emerald-500'
                        : 'text-slate-300 hover:text-accent dark:text-slate-600',
                    )}
                    aria-label={a.done ? '標記未完成' : '標記完成'}
                  >
                    {a.done ? <CheckSquare size={18} /> : <Square size={18} />}
                  </button>
                  <input
                    value={a.text}
                    onChange={(e) => updateAction(a.id, { text: e.target.value })}
                    placeholder="跟進事項…"
                    className={cx(
                      'min-w-[8rem] flex-1 bg-transparent text-base sm:text-sm outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500',
                      a.done
                        ? 'text-slate-400 line-through dark:text-slate-500'
                        : 'text-slate-800 dark:text-slate-100',
                    )}
                  />
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center rounded-md bg-slate-50 pl-2 dark:bg-slate-800/60">
                      <span className="text-xs text-slate-400">@</span>
                      <input
                        value={a.owner ?? ''}
                        onChange={(e) =>
                          updateAction(a.id, {
                            owner: e.target.value || undefined,
                          })
                        }
                        placeholder="負責人"
                        className="w-20 bg-transparent py-1 pr-2 text-base sm:text-xs text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-200"
                      />
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-1 dark:bg-slate-800/60">
                      <CalendarClock size={12} className="text-slate-400" />
                      <input
                        type="date"
                        value={a.due ?? ''}
                        onChange={(e) =>
                          updateAction(a.id, { due: e.target.value || undefined })
                        }
                        className="bg-transparent text-base sm:text-xs text-slate-700 outline-none dark:text-slate-200 [color-scheme:light] dark:[color-scheme:dark]"
                      />
                    </span>
                    <IconButton
                      label="刪除項目"
                      tone="danger"
                      size="sm"
                      onClick={() => removeAction(a.id)}
                    >
                      <Trash2 size={14} />
                    </IconButton>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 標籤 */}
        <Field label="標籤（用逗號或空格分隔）">
          <Input
            value={draft.tagsInput}
            onChange={(e) => patch({ tagsInput: e.target.value })}
            placeholder="例如：人事 財務 課程"
          />
          {draft.tagsInput.trim() && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {draft.tagsInput
                .split(/[,\s]+/)
                .map((t) => t.trim())
                .filter(Boolean)
                .map((t, i) => (
                  <Badge key={`${t}-${i}`} tone="slate">
                    #{t}
                  </Badge>
                ))}
            </div>
          )}
        </Field>
      </div>
    </Modal>
  )
}
