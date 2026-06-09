// ============================================================
//  學習目標 — 建立 / 編輯 Modal（含里程碑管理）
// ============================================================
import { useEffect, useMemo, useState } from 'react'
import {
  GripVertical,
  Plus,
  Trash2,
  Flag,
  Mountain,
  MountainSnow,
  Footprints,
  Route,
  CalendarClock,
} from 'lucide-react'
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
} from './types'
import { CATEGORIES, PRIORITIES, catMeta, syncMilestonesInto, type DraftMilestone } from './util'

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

  // 揀咗嘅分類做路線色票（呼應主畫面卡片以分類上色）
  const cat = catMeta(category)
  const doneMsCount = milestones.filter((m) => m.done).length

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

  // 把 draft 里程碑寫返 collection（按 id upsert：保留原 createdAt，
  // 只在 done 狀態真正轉換時改 doneAt，避免每次儲存都重設時間戳）
  function syncMilestones(goalId: string) {
    syncMilestonesInto(milestonesCol, goalId, milestones)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={!canSave} icon={editing ? Footprints : Mountain}>
            {editing ? '儲存路線' : '立此山頭'}
          </Button>
        </>
      }
    >
      {/* ───────── 攀登誌 masthead：呼應主畫面（kicker + serif 功能名）───────── */}
      <header className="mb-5 border-b border-slate-200/70 pb-4 dark:border-slate-700/60">
        <p className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.3em] text-accent/70">
          <Mountain size={13} className="shrink-0" />
          攀登誌 · Summit Log
        </p>
        <h3 className="mt-1 text-2xl font-semibold leading-tight tracking-tight text-slate-800 dark:text-slate-100">
          {editing ? '修整路線' : '立一個山頭'}
        </h3>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {editing
            ? '改名、調日子，或重排沿途里程碑。'
            : '揀座山頭、拆里程碑，一步步攀上去。'}
        </p>
      </header>

      <div className="space-y-4">
        <Field label="山頭名稱" required>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例如：考好 BAFS 文憑試"
            autoFocus
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="登頂日期" hint="可留空">
            <Input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              icon={CalendarClock}
            />
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

        {/* 攀升路線：拆細里程碑（加權自動計海拔）+ 即時路徑預覽 */}
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-50/50 dark:border-slate-700/60 dark:bg-slate-800/40">
          <div className="flex items-center justify-between gap-3 px-3.5 pt-3.5">
            <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
                <Route size={14} />
              </span>
              <span className="truncate">攀升路線</span>
            </span>
            {previewProgress != null && (
              <span className="inline-flex shrink-0 items-baseline gap-1">
                <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  海拔
                </span>
                <span className="text-base font-semibold tabular-nums text-accent">
                  {previewProgress}%
                </span>
              </span>
            )}
          </div>

          {/* 即時攀升軌跡：沿途里程碑做節點，終點放山頂旗（呼應卡片 AscentTrail）*/}
          <div className="px-3.5 pt-3">
            <PreviewTrail
              progress={previewProgress ?? 0}
              count={milestones.length}
              doneCount={doneMsCount}
              fillClass={cx(cat.dot)}
            />
            <p className="mt-2 text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">
              {milestones.length === 0
                ? '加幾個沿途路標，海拔就會跟住里程碑自動行。'
                : `沿途 ${milestones.length} 個路標，已踏 ${doneMsCount} 個。權重越重，登頂佔比越大。`}
            </p>
          </div>

          <div className="px-3.5 pb-3.5">

          {milestones.length > 0 && (
            <ul className="mb-2.5 space-y-1.5">
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
                    'group flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-2 transition-colors dark:border-slate-700 dark:bg-slate-800',
                    m.done && 'border-emerald-200/70 bg-emerald-50/40 dark:border-emerald-500/20 dark:bg-emerald-500/5',
                    dragIdx === i && 'opacity-50',
                  )}
                >
                  <GripVertical size={14} className="shrink-0 cursor-grab text-slate-300 dark:text-slate-600" />
                  {/* 沿途路標序號（呼應 AscentTrail 節點）*/}
                  <span
                    aria-hidden="true"
                    className={cx(
                      'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums',
                      m.done
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-500',
                    )}
                  >
                    {i + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleMs(m.id)}
                    aria-pressed={m.done}
                    aria-label={m.done ? `將路標「${m.title}」標記為未踏` : `踏過路標「${m.title}」`}
                    className={cx(
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-1',
                      m.done
                        ? 'border-emerald-500 bg-emerald-500 text-white'
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
                  {/* 權重：路段難度（越重佔登頂比越大）*/}
                  <div
                    className="flex shrink-0 items-center gap-0.5"
                    role="group"
                    aria-label={`路標「${m.title}」路段難度（越大佔登頂比越重）`}
                  >
                    {[1, 2, 3].map((w) => (
                      <button
                        key={w}
                        type="button"
                        onClick={() => setWeight(m.id, w)}
                        aria-label={`設定路段難度為 ${w}`}
                        aria-pressed={(m.weight || 1) === w}
                        className={cx(
                          'h-1.5 w-3 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
                          (m.weight || 1) >= w ? 'bg-accent' : 'bg-slate-200 dark:bg-slate-600',
                        )}
                      />
                    ))}
                  </div>
                  <IconButton
                    label="移除路標"
                    tone="danger"
                    onClick={() => removeMs(m.id)}
                    className="min-h-[36px] min-w-[36px] opacity-100 transition focus-within:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
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
              placeholder="下一個沿途路標…"
              icon={Flag}
              className="flex-1"
            />
            <Button variant="secondary" icon={Plus} onClick={addMilestone} className="shrink-0" disabled={!msInput.trim()}>
              加站
            </Button>
          </div>
          </div>
        </div>

        <Field label="登山筆記" hint="動機、策略、資源…（可留空）">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="寫低點解想登呢座山、打算點行…" />
        </Field>
      </div>
    </Modal>
  )
}

// ───────── 即時攀升軌跡（編輯器預覽）─────────
// 呼應主畫面卡片 AscentTrail：底軌 + 已攀升段 + 沿途路標節點 + 終點山頂旗。
// 純裝飾（aria-hidden）；資料已由上方文字 + 進度標示交代。
function PreviewTrail({
  progress,
  count,
  doneCount,
  fillClass,
}: {
  progress: number
  count: number
  doneCount: number
  fillClass: string
}) {
  const v = Math.max(0, Math.min(100, progress))
  const summit = v >= 100 && count > 0
  // 沿途節點均分（最多 6 個，避免擠擁）；前 doneCount 個當已踏
  const shown = Math.min(count, 6)
  return (
    <div aria-hidden="true" className="relative h-4">
      {/* 底軌 */}
      <span className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-slate-200 dark:bg-slate-700" />
      {/* 已攀升段（跟分類色；登頂轉翠綠）*/}
      <span
        className={cx(
          'absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full transition-all duration-500 ease-out',
          summit ? 'bg-emerald-500' : fillClass,
        )}
        style={{ width: `${v}%` }}
      />
      {/* 沿途路標節點 */}
      {shown > 0 &&
        Array.from({ length: shown }).map((_, i) => {
          const pos = shown === 1 ? 50 : (i / (shown - 1)) * 92 + 4
          const done = i < Math.min(doneCount, shown)
          return (
            <span
              key={i}
              className={cx(
                'absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white transition-colors dark:ring-slate-800',
                done ? (summit ? 'bg-emerald-500' : fillClass) : 'bg-slate-300 dark:bg-slate-600',
              )}
              style={{ left: `${pos}%` }}
            />
          )
        })}
      {/* 終點：山頂旗 */}
      <span
        className={cx(
          'absolute right-0 top-1/2 flex h-5 w-5 -translate-y-1/2 translate-x-1 items-center justify-center rounded-full ring-2 transition-colors',
          summit
            ? 'bg-emerald-500 text-white ring-white dark:ring-slate-800'
            : 'bg-white text-slate-300 ring-slate-200 dark:bg-slate-800 dark:text-slate-500 dark:ring-slate-600',
        )}
      >
        {summit ? <MountainSnow size={11} /> : <Flag size={11} />}
      </span>
    </div>
  )
}
