import { useEffect, useMemo, useState } from 'react'
import {
  CalendarClock,
  Check,
  Flag,
  GripVertical,
  Plus,
  Sun,
  Sunrise,
  Tag,
  Trash2,
  X,
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
//  任務詳情編輯器（Things 嘅「打開卡」體驗）
//  改 tasksCol（text / done）+ upsertMeta（優先級 / 到期 / 專案 /
//  標籤 / 備註）+ subtasksCol（子任務清單）。
// ============================================================

const PR_OPTIONS = [
  { id: '1' as const, label: 'P1' },
  { id: '2' as const, label: 'P2' },
  { id: '3' as const, label: 'P3' },
  { id: '4' as const, label: 'P4' },
]

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
      title: '刪除呢項待辦？',
      message: `「${task.text}」連同 ${subtasks.length} 個子任務會被刪除，無法復原。`,
      confirmText: '刪除',
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
  const tagSuggest = allTags
    .filter((t) => !task.meta.tags.includes(t))
    .filter((t) => (tagDraft.trim() ? t.includes(tagDraft.trim().replace(/^[#@]/, '')) : true))
    .slice(0, 6)

  return (
    <Modal open onClose={onClose} size="lg" title="任務詳情">
      <div className="space-y-5">
        {/* 標題 + 完成 */}
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => onToggleTask(task)}
            aria-label={task.done ? '標記未完成' : '標記完成'}
            className={cx(
              'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition',
              task.done
                ? 'border-emerald-500 bg-emerald-500 text-white'
                : 'border-slate-300 hover:border-accent dark:border-slate-600',
            )}
          >
            {task.done && <Check size={14} strokeWidth={3} />}
          </button>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={commitText}
            rows={1}
            className={cx(
              'min-h-0 resize-none border-0 px-0 py-0 text-base font-semibold shadow-none focus:ring-0',
              task.done && 'text-slate-400 line-through dark:text-slate-500',
            )}
            placeholder="任務標題"
          />
        </div>

        {/* 優先級 / 到期 / 專案 */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="優先級">
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

          <Field label="專案">
            <Select
              value={task.meta.projectId ?? ''}
              onChange={(e) => setProject(e.target.value || undefined)}
            >
              <option value="">收件匣</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.emoji ? `${p.emoji} ` : ''}
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="到期">
            <Input
              type="date"
              value={due ?? ''}
              onChange={(e) => setDue(e.target.value || undefined)}
            />
          </Field>
        </div>

        {/* 到期快捷 + 狀態 */}
        <div className="-mt-2 flex flex-wrap items-center gap-2">
          <QuickDue label="今日" icon={Sun} onClick={() => setDue(offsetFromToday(0))} />
          <QuickDue label="聽日" icon={Sunrise} onClick={() => setDue(offsetFromToday(1))} />
          <QuickDue
            label="3 日後"
            icon={CalendarClock}
            onClick={() => setDue(offsetFromToday(3))}
          />
          {due && (
            <button
              type="button"
              onClick={() => setDue(undefined)}
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-slate-400 hover:text-rose-500"
            >
              <X size={12} /> 清除到期
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

        {/* 子任務 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
              <Check size={14} /> 子任務
              {subtasks.length > 0 && (
                <span className="tabular-nums text-slate-400">
                  {subDone}/{subtasks.length}
                </span>
              )}
            </span>
          </div>
          {subtasks.length > 0 && (
            <ul className="space-y-1">
              {subtasks.map((s) => (
                <li
                  key={s.id}
                  className="group flex items-center gap-2 rounded-lg px-1 py-0.5"
                >
                  <GripVertical
                    size={13}
                    className="shrink-0 text-slate-300 dark:text-slate-600"
                  />
                  <input
                    type="checkbox"
                    checked={s.done}
                    onChange={() => toggleSub(s)}
                    className="h-3.5 w-3.5 accent-[color:var(--accent)]"
                  />
                  <span
                    className={cx(
                      'flex-1 text-sm',
                      s.done
                        ? 'text-slate-400 line-through dark:text-slate-500'
                        : 'text-slate-700 dark:text-slate-200',
                    )}
                  >
                    {s.text}
                  </span>
                  <IconButton
                    label="刪除子任務"
                    size="sm"
                    tone="danger"
                    onClick={() => removeSub(s)}
                    className="opacity-0 group-hover:opacity-100"
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
              value={subDraft}
              onChange={(e) => setSubDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addSub()}
              placeholder="加一個子任務…"
              className="flex-1"
            />
            <Button variant="secondary" icon={Plus} onClick={addSub}>
              加入
            </Button>
          </div>
        </div>

        {/* 標籤 */}
        <Field label="標籤">
          <div className="space-y-2">
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
                      className="hover:text-rose-500"
                      aria-label={`移除標籤 ${t}`}
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
              placeholder="輸入標籤後按 Enter…"
            />
            {tagSuggest.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tagSuggest.map((t) => (
                  <button key={t} type="button" onClick={() => addTag(t)}>
                    <Badge tone="slate" className="hover:ring-accent/40">
                      + {t}
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </div>
        </Field>

        {/* 備註 */}
        <Field label="備註">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={commitNote}
            placeholder="補充資料、連結、上下文…"
            className="min-h-[80px]"
          />
        </Field>

        <div className="flex items-center justify-between border-t border-slate-200 pt-4 dark:border-slate-700">
          <Button variant="ghost" icon={Trash2} onClick={askDelete} className="text-rose-500 hover:text-rose-600">
            刪除任務
          </Button>
          <Button
            onClick={() => {
              commitText()
              commitNote()
              toast.success('已儲存')
              onClose()
            }}
          >
            完成
          </Button>
        </div>
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
      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:border-accent hover:text-accent dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
    >
      <I size={13} />
      {label}
    </button>
  )
}
