import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Badge,
  Button,
  IconButton,
  Input,
  Menu,
  Modal,
  Select,
  Textarea,
  Tooltip,
  cx,
} from '../../../ui'
import {
  CalendarClock,
  CheckSquare,
  FileText,
  Gavel,
  ListChecks,
  MapPin,
  NotebookPen,
  Plus,
  Sparkles,
  Square,
  Trash2,
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
//  概念：呼應主畫面「會議記事簿（Minute Book）/ 議程」——
//    · 彈窗 = 一頁記事擬稿：裝訂線孔 + kicker + serif 簿名 + 雙線封面分隔
//    · 欄位分組似議程條款（serif § 號牌 + uppercase kicker），唔似散開表單
//    · 議決 = serif R-NN 決議章；內容 = 朱紅起始線稿紙面（同詳情一致）
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

// 類型色脊（同主畫面 TYPE_RAIL 對齊）——卷首左側貼一條會議類型色脊，
// 令「揀類型」似為議程定一條色脊（呼應筆記卡左脊）。
const TYPE_RAIL: Record<string, string> = {
  accent: 'bg-accent',
  blue: 'bg-blue-500',
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
  slate: 'bg-slate-300 dark:bg-slate-600',
}

// ───────── 議程條款標題（serif § 號牌 + uppercase kicker）─────────
//  記事簿語言：每個欄位分組當一條「議程條款」，左貼 serif 條款記號，
//  令編輯流程讀落似草擬一份正式議程，而非填一張通用表單。
function ClauseTitle({
  mark,
  kicker,
  children,
  right,
}: {
  mark: string
  kicker: string
  children: React.ReactNode
  right?: React.ReactNode
}) {
  return (
    <div className="mb-2.5 flex items-end justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <span
          aria-hidden
          className="inline-flex h-6 min-w-[1.6rem] shrink-0 items-center justify-center rounded-md bg-slate-100 px-1 font-serif text-[13px] font-bold tabular-nums slashed-zero text-slate-500 dark:bg-slate-700/60 dark:text-slate-300"
        >
          {mark}
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
            {kicker}
          </p>
          <h2 className="font-serif text-[15px] font-semibold leading-tight text-slate-700 dark:text-slate-200">
            {children}
          </h2>
        </div>
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  )
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

  const tm = MEETING_TYPE_META[draft.type]
  const doneActions = draft.actions.filter((a) => a.done).length

  return (
    // 唔傳 title → 唔用 Modal 通用粗體頁眉；改喺內文自管「記事擬稿」頁眉，
    // 令彈窗用返主畫面記事簿嘅 serif + kicker + 裝訂線 + 雙線視覺語言。
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button onClick={() => onSave(draft)} disabled={!canSave} icon={CheckSquare}>
            {mode === 'edit' ? '存入記事簿' : '記低議程'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* ───────── 擬稿頁眉：裝訂線孔 + kicker + serif 簿名 + 雙線封面分隔 ───────── */}
        <header className="relative -mx-5 -mt-5 mb-1 overflow-hidden pl-7 pr-5 pt-5 sm:-mx-6 sm:-mt-6 sm:pl-9 sm:pr-6 sm:pt-6">
          {/* 左側裝訂孔（速記簿螺旋孔，純裝飾，呼應主畫面 masthead）*/}
          <span
            aria-hidden
            className="pointer-events-none absolute left-2.5 top-6 flex flex-col gap-2 sm:left-3.5"
          >
            {Array.from({ length: 5 }).map((_, i) => (
              <span
                key={i}
                className="h-1 w-1 rounded-full bg-accent/25 dark:bg-accent/30"
              />
            ))}
          </span>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.28em] text-accent/70">
                <NotebookPen size={12} />
                Minutes · {mode === 'edit' ? '修訂記事' : '記事擬稿'}
              </p>
              <h2 className="mt-1 font-serif text-[23px] font-semibold leading-tight tracking-tight text-slate-800 dark:text-slate-100 sm:text-[27px]">
                {mode === 'edit' ? '修訂議程' : '草擬新議程'}
              </h2>
              <p className="mt-1 truncate text-xs text-slate-400 dark:text-slate-500">
                {tm.label}
                {draft.title.trim() ? ` · ${draft.title.trim()}` : ' · 未命名記事'}
              </p>
            </div>
            <IconButton label="關閉" onClick={onClose} className="-mr-1 shrink-0">
              <X size={18} />
            </IconButton>
          </div>
          {/* 封面雙線（一實一虛，似簿頁開頭留白線）*/}
          <div className="mt-4 space-y-1.5" aria-hidden>
            <span className="block h-px bg-slate-200/90 dark:bg-slate-700/70" />
            <span className="block h-px bg-slate-200/50 dark:bg-slate-700/40" />
          </div>
        </header>

        {/* ───────── 卷首：議程名（serif 卷面標題）+ 類型色脊 ───────── */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 pl-5 dark:border-slate-700/60 dark:bg-slate-800/40">
          <span
            aria-hidden
            className={cx(
              'absolute inset-y-0 left-0 w-1',
              TYPE_RAIL[tm.tone] ?? TYPE_RAIL.slate,
            )}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
            <label className="block min-w-0">
              <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                議程名稱
              </span>
              <input
                value={draft.title}
                onChange={(e) => patch({ title: e.target.value })}
                placeholder="例如：科組會議 — 第二次"
                autoFocus
                className="mt-0.5 w-full border-0 bg-transparent p-0 font-serif text-lg font-semibold text-slate-800 outline-none placeholder:font-sans placeholder:text-base placeholder:font-normal placeholder:text-slate-400 focus:ring-0 dark:text-slate-100 dark:placeholder:text-slate-500 sm:text-xl"
              />
            </label>
            <label className="block sm:w-44">
              <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                會議類型
              </span>
              <Select
                value={draft.type}
                onChange={(e) => patch({ type: e.target.value as MeetingType })}
                className="mt-0.5"
              >
                {MEETING_TYPE_ORDER.map((t) => (
                  <option key={t} value={t}>
                    {MEETING_TYPE_META[t].label}
                  </option>
                ))}
              </Select>
            </label>
          </div>
        </div>

        {/* ───────── §1 開會詳情：日期 / 時間 / 時長 / 地點 ───────── */}
        <section>
          <ClauseTitle mark="§1" kicker="Convening">
            開會詳情
          </ClauseTitle>
          <div className="grid grid-cols-2 gap-3 rounded-2xl border border-slate-200/80 p-4 dark:border-slate-700/60 sm:grid-cols-4">
            <label className="block space-y-1">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                日期
              </span>
              <Input
                type="date"
                value={draft.date}
                onChange={(e) => patch({ date: e.target.value })}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                時間
              </span>
              <Input
                type="time"
                value={draft.time}
                onChange={(e) => patch({ time: e.target.value })}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                時長（分鐘）
              </span>
              <Input
                type="number"
                min={0}
                value={draft.durationMin}
                onChange={(e) => patch({ durationMin: e.target.value })}
                placeholder="60"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                地點
              </span>
              <Input
                icon={MapPin}
                value={draft.location}
                onChange={(e) => patch({ location: e.target.value })}
                placeholder="會議室"
              />
            </label>
          </div>
        </section>

        {/* ───────── §2 出席者（chips）───────── */}
        <section>
          <ClauseTitle
            mark="§2"
            kicker="Present"
            right={
              draft.attendees.length > 0 ? (
                <span className="font-serif text-[13px] font-semibold tabular-nums text-slate-400 dark:text-slate-500">
                  {draft.attendees.length} 人
                </span>
              ) : undefined
            }
          >
            出席者
          </ClauseTitle>
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200/80 bg-slate-50/60 p-2 transition focus-within:border-accent/40 focus-within:bg-white dark:border-slate-700/60 dark:bg-slate-800/40 dark:focus-within:bg-slate-800">
            {draft.attendees.map((a) => (
              <span
                key={a}
                className="inline-flex items-center gap-1 rounded-md bg-white py-0.5 pl-2 pr-1 text-xs text-slate-600 ring-1 ring-slate-200/80 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700"
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
        </section>

        {/* ───────── §3 記事內容（朱紅起始線稿紙面）+ 範本 + 抽取 ───────── */}
        <section>
          <ClauseTitle
            mark="§3"
            kicker="Minutes"
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
            記事內容
          </ClauseTitle>
          {/* 稿紙面：左側朱紅起始線（同詳情「記事內容」一致）*/}
          <div className="relative overflow-hidden rounded-xl border border-slate-200/80 bg-slate-50/40 transition focus-within:border-accent/40 focus-within:bg-white dark:border-slate-700/60 dark:bg-slate-800/30 dark:focus-within:bg-slate-800">
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-2.5 left-3 w-px bg-rose-300/50 dark:bg-rose-500/30"
            />
            <Textarea
              ref={contentRef}
              className="min-h-[180px] resize-y border-0 bg-transparent py-3.5 pl-6 pr-3.5 font-[450] leading-relaxed shadow-none focus:ring-0"
              value={draft.content}
              onChange={(e) => patch({ content: e.target.value })}
              placeholder={'會議重點…\n\n小貼士：\n- [ ] 行動項目（可加 @負責人 !2026-06-01）\n> 決議事項'}
            />
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">
            支援 <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">- [ ]</code>{' '}
            行動項目（<code className="rounded bg-slate-100 px-1 dark:bg-slate-800">@人 !日期</code>）同{' '}
            <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">&gt;</code> 決議；撳「抽取」轉成下面結構化清單。
          </p>
        </section>

        {/* ───────── §4 議決事項（serif R-NN 決議章，同詳情一致）───────── */}
        <section>
          <ClauseTitle
            mark="§4"
            kicker="Resolutions"
            right={
              draft.decisions.length > 0 ? (
                <Badge tone="accent" icon={Gavel}>
                  {draft.decisions.length}
                </Badge>
              ) : undefined
            }
          >
            議決事項
          </ClauseTitle>
          <div className="space-y-1.5">
            {draft.decisions.map((d, i) => (
              <div
                key={i}
                className="flex items-start gap-2.5 rounded-lg bg-accent-soft/50 px-3 py-2 dark:bg-accent/10"
              >
                <span
                  aria-hidden
                  className="mt-px shrink-0 font-serif text-[13px] font-bold tabular-nums slashed-zero text-accent-strong dark:text-accent"
                >
                  R{String(i + 1).padStart(2, '0')}
                </span>
                <span className="min-w-0 flex-1 text-sm text-slate-700 dark:text-slate-200">
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
            <div className="flex items-center gap-2 pl-0.5">
              <span
                aria-hidden
                className="shrink-0 font-serif text-[13px] font-bold tabular-nums slashed-zero text-slate-300 dark:text-slate-600"
              >
                R{String(draft.decisions.length + 1).padStart(2, '0')}
              </span>
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
        </section>

        {/* ───────── §5 跟進行動（可勾選改卷格）───────── */}
        <section>
          <ClauseTitle
            mark="§5"
            kicker="Action items"
            right={
              <div className="flex items-center gap-2">
                {draft.actions.length > 0 && (
                  <span className="font-serif text-[13px] font-semibold tabular-nums text-slate-400 dark:text-slate-500">
                    {doneActions}/{draft.actions.length}
                  </span>
                )}
                <Button size="sm" variant="ghost" icon={Plus} onClick={addAction}>
                  加項目
                </Button>
              </div>
            }
          >
            跟進行動
          </ClauseTitle>
          {draft.actions.length === 0 ? (
            <div className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-3 py-5 text-center dark:border-slate-700 dark:bg-slate-800/30">
              <ListChecks size={20} className="text-slate-300 dark:text-slate-600" />
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
        </section>

        {/* ───────── §6 索引標籤 ───────── */}
        <section>
          <ClauseTitle mark="§6" kicker="Index tags">
            標籤
          </ClauseTitle>
          <Input
            value={draft.tagsInput}
            onChange={(e) => patch({ tagsInput: e.target.value })}
            placeholder="用逗號或空格分隔，例如：人事 財務 課程"
          />
          {draft.tagsInput.trim() && (
            <div className="mt-2 flex flex-wrap gap-1.5">
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
        </section>
      </div>
    </Modal>
  )
}
