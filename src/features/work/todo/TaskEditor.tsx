import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import './i18n'
import {
  CalendarClock,
  Check,
  ClipboardCheck,
  Flag,
  GripVertical,
  Highlighter,
  ListChecks,
  Plus,
  StickyNote,
  Sun,
  Sunrise,
  Tag,
  Trash2,
  X,
  type LucideIcon,
} from 'lucide-react'
import {
  Badge,
  Button,
  Field,
  IconButton,
  Input,
  Modal,
  SegmentedControl,
  Select,
  Textarea,
  cx,
} from '../../../ui'
import { useToast } from '../../../context/ToastContext'
import { useConfirm } from '../../../context/ConfirmContext'
import { subtasksCol, upsertMeta } from './store'
import type { FullTask, Priority, Project, SubTask } from './types'
import {
  PRIORITY_META,
  daysBetween,
  dueLabel,
  offsetFromToday,
  projColorCls,
  todayISO,
} from './util'

// ============================================================
//  任務詳情 — 改簿檯抽出嘅「批改卷宗」
//  ------------------------------------------------------------
//  訂造概念：呼應主畫面（TodoWidget）嘅改簿檯——checklist + 批改紅筆。
//  彈窗似老師由簿堆裡抽出一張卷宗攤開逐項處理：頁眉用 serif 標題 +
//  uppercase kicker + 雙線封面分隔；屬「批改」嘅任務披返同一套紅筆
//  accent（紅 margin 邊欄 + 紅「批改」章 + 方剔格），同主畫面卡片一眼
//  對得返。每個分區用 icon chip + 向右散開 hairline 做冊頁分段。
//
//  邏輯完全沿用：改 tasksCol（text / done）+ upsertMeta（優先級 / 到期 /
//  專案 / 標籤 / 備註）+ subtasksCol（子任務）。淨係動外觀 / 排版 / 文案。
// ============================================================

// 「批改任務」純表現層偵測（與 TodoWidget 同一套語意：標籤 / 任務文字
// 命中即披紅筆 accent）。本檔自帶一份，唔跨檔 import 主畫面內部 helper。
const MARK_RE = /(批改|批卷|改卷|改簿|派卷|評卷|marking|mark\b)/i
function isMarkingTask(t: FullTask): boolean {
  if (t.meta.tags.some((tag) => MARK_RE.test(tag))) return true
  return MARK_RE.test(t.text)
}

const PR_OPTIONS = [
  { id: '1' as const, label: 'P1' },
  { id: '2' as const, label: 'P2' },
  { id: '3' as const, label: 'P3' },
  { id: '4' as const, label: 'P4' },
]

// ───────── 冊頁分區頁眉（icon chip + 向右散開 hairline）─────────
//  改簿檯概念：每個分區（屬性 / 子任務 / 標籤 / 備註）似簿冊上一段
//  分節——左邊一個方形 icon 牌，右邊一條淡到透明嘅尺線，數字計點。
//  同主畫面 Group / 任務冊頁眉同一套視覺語言。
function CardSection({
  icon: Icon,
  title,
  count,
  children,
}: {
  icon: LucideIcon
  title: string
  count?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-center gap-2 px-0.5">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500 dark:bg-slate-700/60 dark:text-slate-300">
          <Icon size={14} />
        </span>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {title}
        </h3>
        {count !== undefined && count !== null && (
          <span className="tabular-nums text-[11px] font-semibold text-slate-400 dark:text-slate-500">
            {count}
          </span>
        )}
        <span
          aria-hidden
          className="ml-1 h-px flex-1 bg-gradient-to-r from-slate-200 to-transparent dark:from-slate-700/70"
        />
      </div>
      {children}
    </section>
  )
}

export function TaskEditor({
  task,
  projects,
  allTags,
  onClose,
  onPatchTask,
  onDeleteTask,
  onToggleTask,
}: {
  task: FullTask
  projects: Project[]
  allTags: string[]
  onClose: () => void
  onPatchTask: (id: string, patch: { text?: string; done?: boolean }) => void
  onDeleteTask: (task: FullTask) => void
  onToggleTask: (task: FullTask) => void
}) {
  const { t: tt } = useTranslation()
  const toast = useToast()
  const confirm = useConfirm()

  const [text, setText] = useState(task.text)
  const [note, setNote] = useState(task.meta.note ?? '')
  const [subDraft, setSubDraft] = useState('')
  const [tagDraft, setTagDraft] = useState('')
  const subInputId = `todo-sub-input-${task.id}`

  // task 換咗（外部）就同步本地草稿
  useEffect(() => {
    setText(task.text)
    setNote(task.meta.note ?? '')
  }, [task.id, task.text, task.meta.note])

  const subtasks = useMemo(
    () => [...task.subtasks].sort((a, b) => a.order - b.order),
    [task.subtasks],
  )
  const subDone = subtasks.filter((s) => s.done).length

  const commitText = () => {
    const t = text.trim()
    if (t && t !== task.text) onPatchTask(task.id, { text: t })
    else if (!t) setText(task.text)
  }
  const commitNote = () => {
    const n = note.trim()
    if (n !== (task.meta.note ?? '')) upsertMeta(task.id, { note: n || undefined })
  }

  const setPriority = (p: Priority) => upsertMeta(task.id, { priority: p })
  const setDue = (due?: string) => upsertMeta(task.id, { due })
  const setProject = (projectId?: string) => upsertMeta(task.id, { projectId })

  const addTag = (raw: string) => {
    const t = raw.trim().replace(/^[#@]/, '')
    if (!t) return
    if (task.meta.tags.includes(t)) {
      setTagDraft('')
      return
    }
    upsertMeta(task.id, { tags: [...task.meta.tags, t] })
    setTagDraft('')
  }
  const removeTag = (t: string) =>
    upsertMeta(task.id, { tags: task.meta.tags.filter((x) => x !== t) })

  const addSub = () => {
    const t = subDraft.trim()
    if (!t) return
    const maxOrder = subtasks.reduce((m, s) => Math.max(m, s.order), -1)
    subtasksCol.add({ taskId: task.id, text: t, done: false, order: maxOrder + 1 })
    setSubDraft('')
    // 加完保持輸入焦點，方便連續加（Things 體驗）
    requestAnimationFrame(() => document.getElementById(subInputId)?.focus())
  }
  const toggleSub = (s: SubTask) => subtasksCol.update(s.id, { done: !s.done })
  const removeSub = (s: SubTask) => subtasksCol.remove(s.id)

  const askDelete = async () => {
    const ok = await confirm({
      title: tt('todo.confirmDeleteTaskTitle', { defaultValue: '刪除呢項待辦？' }),
      message: tt('todo.confirmDeleteTaskMsg', {
        text: task.text,
        count: subtasks.length,
        defaultValue: `「${task.text}」連同 ${subtasks.length} 個子任務會被刪除，無法復原。`,
      }),
      confirmText: tt('todo.confirmText', { defaultValue: '刪除' }),
      tone: 'danger',
    })
    if (!ok) return
    onDeleteTask(task)
    onClose()
  }

  const due = task.meta.due
  const dueDiff = due ? daysBetween(todayISO(), due) : null
  const pm = PRIORITY_META[task.meta.priority]
  const project = projects.find((p) => p.id === task.meta.projectId)
  const marking = isMarkingTask(task)
  const tagSuggest = allTags
    .filter((t) => !task.meta.tags.includes(t))
    .filter((t) => (tagDraft.trim() ? t.includes(tagDraft.trim().replace(/^[#@]/, '')) : true))
    .slice(0, 6)

  // 頁眉狀態副題（似卷宗封面下嘅一行批註）
  const stateLine = task.done
    ? tt('todo.stateDone', { defaultValue: '已剔 · 完成' })
    : marking
      ? tt('todo.stateMarking', { defaultValue: '待批改' })
      : due
        ? tt('todo.stateDue', { label: dueLabel(due), defaultValue: `到期 ${dueLabel(due)}` })
        : tt('todo.stateUnticked', { defaultValue: '未剔' })

  return (
    // 唔傳 title → 唔用 Modal 通用粗體頁眉；改喺內文自管「批改卷宗」頁眉，
    // 令彈窗用返主畫面改簿檯嘅 serif + kicker + 雙線視覺語言。
    <Modal open onClose={onClose} size="lg">
      <div className="space-y-5">
        {/* ───────── 卷宗頁眉：kicker + serif 標題狀態 + 雙線封面分隔 ───────── */}
        <header className="-mx-5 -mt-5 mb-1 px-5 pt-5 sm:-mx-6 sm:-mt-6 sm:px-6 sm:pt-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p
                className={cx(
                  'flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.25em]',
                  marking ? 'text-rose-500/80 dark:text-rose-400/80' : 'text-accent/70',
                )}
              >
                {marking ? <Highlighter size={12} /> : <ClipboardCheck size={12} />}
                {marking
                  ? tt('todo.headerMarking', { defaultValue: '批改卷宗 · Marking' })
                  : tt('todo.headerTask', { defaultValue: '任務卡 · Task Card' })}
              </p>
              <h2 className="mt-1 font-serif text-[22px] font-semibold leading-tight tracking-tight text-slate-800 dark:text-slate-100 sm:text-[26px]">
                {tt('todo.taskDetail', { defaultValue: '任務詳情' })}
              </h2>
              <p className="mt-1 truncate text-xs text-slate-400 dark:text-slate-500">
                {stateLine}
              </p>
            </div>
            <IconButton
              label={tt('todo.close', { defaultValue: '關閉' })}
              onClick={onClose}
              className="-mr-1 shrink-0"
            >
              <X size={18} />
            </IconButton>
          </div>
          {/* 改簿檯雙線（封面分隔感）*/}
          <div className="mt-4 space-y-1" aria-hidden>
            <span className="block h-px bg-slate-200/90 dark:bg-slate-700/70" />
            <span className="block h-px bg-slate-200/60 dark:bg-slate-700/40" />
          </div>
        </header>

        {/* ───────── 卷面：標題 + 完成。批改任務披紅筆 accent（紅 margin + 方剔格 + 批改章）───────── */}
        <div
          className={cx(
            'relative flex items-start gap-3 overflow-hidden rounded-2xl border p-3.5 pl-4 transition',
            task.done
              ? 'border-emerald-200/70 bg-emerald-50/50 dark:border-emerald-500/20 dark:bg-emerald-500/5'
              : marking
                ? 'border-rose-200/70 bg-rose-50/50 dark:border-rose-500/25 dark:bg-rose-500/[0.06]'
                : 'border-slate-200/80 bg-slate-50/60 dark:border-slate-700/60 dark:bg-slate-800/40',
          )}
        >
          {/* 批改任務：紅筆雙邊欄（似改簿嘅紅 margin）。未完成先顯示。*/}
          {marking && !task.done && (
            <span aria-hidden className="absolute inset-y-0 left-0 flex gap-[3px] pl-1">
              <span className="w-[3px] rounded-full bg-rose-400 dark:bg-rose-500/70" />
              <span className="w-px rounded-full bg-rose-300/70 dark:bg-rose-500/40" />
            </span>
          )}
          <button
            type="button"
            onClick={() => onToggleTask(task)}
            aria-label={
              task.done
                ? tt('todo.ariaMarkUndone', { defaultValue: '標記未完成' })
                : marking
                  ? tt('todo.ariaTickMarked', { defaultValue: '打剔（已批改）' })
                  : tt('todo.ariaTickDone', { defaultValue: '標記完成' })
            }
            className={cx(
              // 批改任務用方剔格（似簿上方格）；其餘用圓剔格，呼應主畫面 TaskRow
              'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border-2 transition duration-200 active:scale-90',
              marking && !task.done ? 'rounded-md' : 'rounded-full',
              task.done
                ? 'border-emerald-500 bg-emerald-500 text-white shadow-sm shadow-emerald-500/30'
                : marking
                  ? 'border-rose-300 text-rose-500 hover:border-rose-500 hover:bg-rose-50 dark:border-rose-500/50 dark:hover:bg-rose-500/10'
                  : 'border-slate-300 hover:border-accent hover:bg-accent-soft/40 dark:border-slate-600',
            )}
          >
            {task.done && <Check size={14} strokeWidth={3} />}
          </button>
          <div className="min-w-0 flex-1">
            {/* 批改章（呼應主畫面 MarkPen）：未完成嘅批改任務先掛 */}
            {marking && !task.done && (
              <span className="mb-1 inline-flex shrink-0 items-center gap-1 rounded-md border border-rose-300/70 bg-rose-50/80 px-1.5 py-0.5 text-[10px] font-semibold text-rose-600 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300">
                <Highlighter size={10} className="opacity-80" />
                <span className="font-serif leading-none">
                  {tt('todo.markStamp', { defaultValue: '批改' })}
                </span>
              </span>
            )}
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onBlur={commitText}
              rows={1}
              className={cx(
                'min-h-0 w-full resize-none border-0 bg-transparent px-0 py-0.5 font-serif text-base font-semibold shadow-none focus:ring-0 sm:text-lg',
                task.done && 'text-slate-400 line-through dark:text-slate-500',
              )}
              placeholder={tt('todo.taskTitlePlaceholder', { defaultValue: '任務標題' })}
            />
          </div>
        </div>

        {/* 屬性：優先級 / 專案 / 到期（一組柔和卡，唔似散開嘅表單）*/}
        <div className="space-y-3 rounded-2xl border border-slate-200/80 p-4 dark:border-slate-700/60">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label={tt('todo.fieldPriority', { defaultValue: '優先級' })}>
              <div className="flex items-center gap-2">
                <Flag size={15} className={pm.flag} />
                <SegmentedControl<'1' | '2' | '3' | '4'>
                  size="sm"
                  options={PR_OPTIONS}
                  value={String(task.meta.priority) as '1' | '2' | '3' | '4'}
                  onChange={(v) => setPriority(Number(v) as Priority)}
                />
              </div>
            </Field>

            <Field label={tt('todo.fieldProject', { defaultValue: '專案' })}>
              <Select
                value={task.meta.projectId ?? ''}
                onChange={(e) => setProject(e.target.value || undefined)}
              >
                <option value="">{tt('todo.optionInbox', { defaultValue: '收件匣' })}</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.emoji ? `${p.emoji} ` : ''}
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label={tt('todo.fieldDue', { defaultValue: '到期' })}>
              <Input
                type="date"
                value={due ?? ''}
                onChange={(e) => setDue(e.target.value || undefined)}
              />
            </Field>
          </div>

          {/* 到期快捷 + 狀態 */}
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-700/60">
            <QuickDue
              label={tt('todo.quickToday', { defaultValue: '今日' })}
              icon={Sun}
              onClick={() => setDue(offsetFromToday(0))}
            />
            <QuickDue
              label={tt('todo.quickTomorrow', { defaultValue: '聽日' })}
              icon={Sunrise}
              onClick={() => setDue(offsetFromToday(1))}
            />
            <QuickDue
              label={tt('todo.quick3Days', { defaultValue: '3 日後' })}
              icon={CalendarClock}
              onClick={() => setDue(offsetFromToday(3))}
            />
            {due && (
              <button
                type="button"
                onClick={() => setDue(undefined)}
                className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-slate-400 transition hover:text-rose-500"
              >
                <X size={12} /> {tt('todo.clearDue', { defaultValue: '清除到期' })}
              </button>
            )}
            {due && (
              <Badge tone={dueDiff !== null && dueDiff < 0 ? 'rose' : dueDiff === 0 ? 'amber' : 'slate'}>
                {dueLabel(due)}
              </Badge>
            )}
            {project && (
              <Badge tone="slate" className="gap-1">
                <span className={cx('h-1.5 w-1.5 rounded-full', projColorCls(project.color).dot)} />
                {project.emoji} {project.name}
              </Badge>
            )}
          </div>
        </div>

        {/* 子任務（拆卷項；方剔格呼應改簿格）*/}
        <CardSection
          icon={ListChecks}
          title={tt('todo.sectionSubtasks', { defaultValue: '子任務' })}
          count={subtasks.length > 0 ? `${subDone}/${subtasks.length}` : undefined}
        >
          {subtasks.length > 0 && (
            <ul className="space-y-0.5">
              {subtasks.map((s) => (
                <li
                  key={s.id}
                  className="group flex items-center gap-2 rounded-xl px-1.5 py-1.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  <GripVertical
                    size={13}
                    className="shrink-0 cursor-grab text-slate-300 dark:text-slate-600"
                  />
                  <input
                    type="checkbox"
                    checked={s.done}
                    onChange={() => toggleSub(s)}
                    aria-label={`${s.done ? tt('todo.ariaSubUndone', { defaultValue: '取消完成' }) : tt('todo.ariaSubDone', { defaultValue: '完成' })}子任務：${s.text}`}
                    className={cx(
                      'h-4 w-4',
                      // 批改卷宗內：未剔子任務用紅墨剔（呼應紅筆 accent）；
                      // 一剔變綠（完成）。其餘任務沿用 mode accent。
                      marking ? 'rounded-sm accent-rose-500' : 'rounded accent-[color:var(--accent)]',
                      s.done && 'accent-emerald-500',
                    )}
                  />
                  <span
                    className={cx(
                      'flex-1 text-sm transition-colors',
                      s.done
                        ? 'text-slate-400 line-through dark:text-slate-500'
                        : 'text-slate-700 dark:text-slate-200',
                    )}
                  >
                    {s.text}
                  </span>
                  <IconButton
                    label={tt('todo.ariaDeleteSubtask', { defaultValue: '刪除子任務' })}
                    size="sm"
                    tone="danger"
                    onClick={() => removeSub(s)}
                    className="opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                  >
                    <Trash2 size={13} />
                  </IconButton>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <Input
              id={subInputId}
              icon={Plus}
              value={subDraft}
              onChange={(e) => setSubDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addSub()}
              placeholder={tt('todo.subtaskPlaceholder', { defaultValue: '拆解成更細嘅步驟…' })}
              className="flex-1"
            />
            <Button variant="secondary" icon={Plus} onClick={addSub}>
              {tt('todo.subtaskAdd', { defaultValue: '加入' })}
            </Button>
          </div>
        </CardSection>

        {/* 標籤（卷宗側標）*/}
        <CardSection
          icon={Tag}
          title={tt('todo.sectionTags', { defaultValue: '標籤' })}
          count={task.meta.tags.length > 0 ? task.meta.tags.length : undefined}
        >
          {task.meta.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {task.meta.tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 rounded-md bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent-strong dark:bg-accent/15 dark:text-accent"
                >
                  <Tag size={10} />
                  {t}
                  <button
                    type="button"
                    onClick={() => removeTag(t)}
                    className="transition hover:text-rose-500"
                    aria-label={tt('todo.ariaRemoveTag', { tag: t, defaultValue: `移除標籤 ${t}` })}
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <Input
            value={tagDraft}
            onChange={(e) => setTagDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addTag(tagDraft)
              }
            }}
            placeholder={tt('todo.tagPlaceholder', { defaultValue: '輸入標籤後按 Enter…' })}
          />
          {tagSuggest.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tagSuggest.map((t) => (
                <button key={t} type="button" onClick={() => addTag(t)}>
                  <Badge tone="slate" className="transition hover:ring-accent/40">
                    + {t}
                  </Badge>
                </button>
              ))}
            </div>
          )}
        </CardSection>

        {/* 備註（卷宗批註欄）*/}
        <CardSection icon={StickyNote} title={tt('todo.sectionNote', { defaultValue: '備註' })}>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={commitNote}
            placeholder={
              marking
                ? tt('todo.notePlaceholderMarking', { defaultValue: '批改重點、常見錯處、跟進…' })
                : tt('todo.notePlaceholderDefault', { defaultValue: '補充資料、連結、上下文…' })
            }
            className="min-h-[90px]"
          />
        </CardSection>

        {/* 收卷：刪除（紅筆語意）+ 完成。雙線封底呼應頁眉。*/}
        <footer className="-mx-5 -mb-5 mt-1 px-5 pb-5 sm:-mx-6 sm:-mb-6 sm:px-6 sm:pb-6">
          <div className="mb-4 space-y-1" aria-hidden>
            <span className="block h-px bg-slate-200/60 dark:bg-slate-700/40" />
            <span className="block h-px bg-slate-200/90 dark:bg-slate-700/70" />
          </div>
          <div className="flex items-center justify-between gap-3">
            <Button
              variant="ghost"
              icon={Trash2}
              onClick={askDelete}
              className="text-rose-500 hover:text-rose-600"
            >
              {tt('todo.deleteTask', { defaultValue: '刪除任務' })}
            </Button>
            <Button
              icon={Check}
              onClick={() => {
                commitText()
                commitNote()
                toast.success(tt('todo.toastSaved', { defaultValue: '已儲存' }))
                onClose()
              }}
            >
              {tt('todo.done', { defaultValue: '完成' })}
            </Button>
          </div>
        </footer>
      </div>
    </Modal>
  )
}

function QuickDue({
  label,
  icon: I,
  onClick,
}: {
  label: string
  icon: typeof Sun
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:border-accent/40 hover:bg-accent-soft hover:text-accent-strong dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-accent/15 dark:hover:text-accent"
    >
      <I size={13} />
      {label}
    </button>
  )
}
