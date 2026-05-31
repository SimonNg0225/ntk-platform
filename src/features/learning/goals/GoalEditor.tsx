// ============================================================
//  學習目標 — 建立 / 編輯 Modal（含里程碑管理）
// ============================================================
import { useEffect, useMemo, useState } from 'react'
import { GripVertical, Plus, Trash2, Target } from 'lucide-react'
import {
  Modal,
  Button,
  Input,
  Textarea,
  Field,
  SegmentedControl,
  Pills,
  IconButton,
  cx,
} from '../../../ui'
import { goalsCol } from '../../../data/collections'
import { uid } from '../../../lib/store'
import {
  goalMetaCol,
  milestonesCol,
  type GoalCategory,
  type GoalPriority,
  type Milestone,
} from './types'
import { CATEGORIES, PRIORITIES } from './util'

interface DraftMilestone {
  id: string
  title: string
  done: boolean
  weight: number
}

export interface EditorSeed {
  goalId?: string // 有 = 編輯；無 = 新增
}

export default function GoalEditor({
  open,
  seed,
  onClose,
  onSaved,
}: {
  open: boolean
  seed: EditorSeed
  onClose: () => void
  onSaved: (msg: string) => void
}) {
  const editing = !!seed.goalId

  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<GoalCategory>('study')
  const [priority, setPriority] = useState<GoalPriority>('medium')
  const [targetDate, setTargetDate] = useState('')
  const [notes, setNotes] = useState('')
  const [milestones, setMilestones] = useState<DraftMilestone[]>([])
  const [msInput, setMsInput] = useState('')
  const [dragIdx, setDragIdx] = useState<number | null>(null)

  // 載入既有資料（編輯模式）
  useEffect(() => {
    if (!open) return
    if (seed.goalId) {
      const g = goalsCol.get().find((x) => x.id === seed.goalId)
      const meta = goalMetaCol.get().find((m) => m.id === seed.goalId)
      const ms = milestonesCol
        .get()
        .filter((m) => m.goalId === seed.goalId)
        .sort((a, b) => a.order - b.order)
      setTitle(g?.title ?? '')
      setCategory(meta?.category ?? 'study')
      setPriority(meta?.priority ?? 'medium')
      setTargetDate(meta?.targetDate ?? '')
      setNotes(meta?.notes ?? '')
      setMilestones(ms.map((m) => ({ id: m.id, title: m.title, done: m.done, weight: m.weight })))
    } else {
      setTitle('')
      setCategory('study')
      setPriority('medium')
      setTargetDate('')
      setNotes('')
      setMilestones([])
    }
    setMsInput('')
  }, [open, seed.goalId])

  const canSave = title.trim().length > 0

  const previewProgress = useMemo(() => {
    if (milestones.length === 0) return null
    let total = 0
    let done = 0
    for (const m of milestones) {
      const w = Math.max(1, m.weight || 1)
      total += w
      if (m.done) done += w
    }
    return total ? Math.round((done / total) * 100) : 0
  }, [milestones])

  function addMilestone() {
    const t = msInput.trim()
    if (!t) return
    setMilestones((prev) => [...prev, { id: uid(), title: t, done: false, weight: 1 }])
    setMsInput('')
  }

  function toggleMs(id: string) {
    setMilestones((prev) => prev.map((m) => (m.id === id ? { ...m, done: !m.done } : m)))
  }

  function setWeight(id: string, w: number) {
    setMilestones((prev) => prev.map((m) => (m.id === id ? { ...m, weight: w } : m)))
  }

  function removeMs(id: string) {
    setMilestones((prev) => prev.filter((m) => m.id !== id))
  }

  function reorder(from: number, to: number) {
    if (from === to) return
    setMilestones((prev) => {
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }

  function handleSave() {
    if (!canSave) return
    const cleanTitle = title.trim()

    if (editing && seed.goalId) {
      const goalId = seed.goalId
      // 進度：有里程碑就用加權，否則保留原值
      const existing = goalsCol.get().find((x) => x.id === goalId)
      const prog = previewProgress ?? existing?.progress ?? 0
      goalsCol.update(goalId, { title: cleanTitle, progress: prog })
      // meta：可能未存在（舊資料），用 set 容錯
      const hasMeta = goalMetaCol.get().some((m) => m.id === goalId)
      if (hasMeta) {
        goalMetaCol.update(goalId, { category, priority, targetDate: targetDate || undefined, notes: notes.trim() || undefined })
      } else {
        goalMetaCol.add({ id: goalId, category, priority, status: prog >= 100 ? 'done' : 'active', targetDate: targetDate || undefined, notes: notes.trim() || undefined })
      }
      syncMilestones(goalId)
      onSaved('已更新目標')
    } else {
      const goalId = uid()
      const prog = previewProgress ?? 0
      goalsCol.add({ id: goalId, title: cleanTitle, progress: prog, createdAt: new Date().toISOString() })
      goalMetaCol.add({ id: goalId, category, priority, status: 'active', targetDate: targetDate || undefined, startDate: undefined, notes: notes.trim() || undefined })
      syncMilestones(goalId)
      onSaved('已新增目標')
    }
    onClose()
  }

  // 把 draft 里程碑寫返 collection（先刪舊有、再加新嘅，簡單可靠）
  function syncMilestones(goalId: string) {
    const old = milestonesCol.get().filter((m) => m.goalId === goalId)
    for (const m of old) milestonesCol.remove(m.id)
    milestones.forEach((m, i) => {
      const rec: Omit<Milestone, 'id'> & { id?: string } = {
        id: m.id,
        goalId,
        title: m.title,
        done: m.done,
        weight: Math.max(1, m.weight || 1),
        order: i,
        createdAt: new Date().toISOString(),
        doneAt: m.done ? new Date().toISOString() : undefined,
      }
      milestonesCol.add(rec)
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? '編輯目標' : '新增目標'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={!canSave} icon={Target}>
            {editing ? '儲存' : '建立目標'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="目標名稱" required>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例如：考好 BAFS 文憑試"
            autoFocus
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="目標日期" hint="可留空">
            <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
          </Field>
          <Field label="優先程度">
            <SegmentedControl<GoalPriority>
              options={PRIORITIES.map((p) => ({ id: p.id, label: p.label }))}
              value={priority}
              onChange={setPriority}
            />
          </Field>
        </div>

        <Field label="分類">
          <Pills<GoalCategory>
            options={CATEGORIES.map((c) => ({ id: c.id, label: c.label }))}
            active={category}
            onChange={setCategory}
            size="sm"
          />
        </Field>

        {/* 里程碑 */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
              里程碑
              <span className="ml-1 font-normal text-slate-400">（拆細步驟，自動計加權進度）</span>
            </span>
            {previewProgress != null && (
              <span className="text-xs font-semibold tabular-nums text-accent">
                進度 {previewProgress}%
              </span>
            )}
          </div>

          {milestones.length > 0 && (
            <ul className="mb-2 space-y-1.5">
              {milestones.map((m, i) => (
                <li
                  key={m.id}
                  draggable
                  onDragStart={() => setDragIdx(i)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragIdx != null) reorder(dragIdx, i)
                    setDragIdx(null)
                  }}
                  className={cx(
                    'group flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-800',
                    dragIdx === i && 'opacity-50',
                  )}
                >
                  <GripVertical size={14} className="shrink-0 cursor-grab text-slate-300 dark:text-slate-600" />
                  <button
                    type="button"
                    onClick={() => toggleMs(m.id)}
                    aria-pressed={m.done}
                    aria-label={m.done ? `標記「${m.title}」為未完成` : `標記「${m.title}」為完成`}
                    className={cx(
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-1',
                      m.done
                        ? 'border-accent bg-accent text-white'
                        : 'border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-700',
                    )}
                  >
                    {m.done && (
                      <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path d="M2.5 6.5 5 9l4.5-5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                  <span
                    className={cx(
                      'min-w-0 flex-1 truncate text-sm',
                      m.done ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-200',
                    )}
                  >
                    {m.title}
                  </span>
                  {/* 權重 */}
                  <div
                    className="flex shrink-0 items-center gap-0.5"
                    role="group"
                    aria-label={`「${m.title}」權重（越大佔比越重）`}
                  >
                    {[1, 2, 3].map((w) => (
                      <button
                        key={w}
                        type="button"
                        onClick={() => setWeight(m.id, w)}
                        aria-label={`設定權重為 ${w}`}
                        aria-pressed={(m.weight || 1) === w}
                        className={cx(
                          'h-1.5 w-3 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
                          (m.weight || 1) >= w ? 'bg-accent' : 'bg-slate-200 dark:bg-slate-600',
                        )}
                      />
                    ))}
                  </div>
                  <IconButton
                    label="刪除里程碑"
                    tone="danger"
                    size="sm"
                    onClick={() => removeMs(m.id)}
                    className="opacity-0 transition group-hover:opacity-100"
                  >
                    <Trash2 size={14} />
                  </IconButton>
                </li>
              ))}
            </ul>
          )}

          <div className="flex gap-2">
            <Input
              value={msInput}
              onChange={(e) => setMsInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addMilestone()
                }
              }}
              placeholder="新增里程碑步驟…"
              className="flex-1"
            />
            <Button variant="secondary" icon={Plus} onClick={addMilestone} className="shrink-0" disabled={!msInput.trim()}>
              加
            </Button>
          </div>
        </div>

        <Field label="備註" hint="動機、策略、資源…（可留空）">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="寫低點解想達成、打算點做…" />
        </Field>
      </div>
    </Modal>
  )
}
