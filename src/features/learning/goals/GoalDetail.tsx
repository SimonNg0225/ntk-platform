// ============================================================
//  學習目標 — 詳情 Modal（里程碑 / 簽到 / 動量 / 狀態流轉）
// ============================================================
import { useMemo, useState } from 'react'
import {
  CalendarClock,
  CheckCircle2,
  Flag,
  History,
  Pencil,
  Plus,
  TrendingUp,
  Trash2,
} from 'lucide-react'
import {
  Modal,
  Button,
  Input,
  Badge,
  Card,
  ProgressBar,
  SegmentedControl,
  IconButton,
  EmptyState,
  Separator,
  cx,
} from '../../../ui'
import { useToast } from '../../../context/ToastContext'
import { useConfirm } from '../../../context/ConfirmContext'
import { goalsCol } from '../../../data/collections'
import { useCollection } from '../../../lib/store'
import type { Goal } from '../../../data/types'
import {
  goalMetaCol,
  milestonesCol,
  goalCheckinsCol,
  type GoalStatus,
} from './types'
import {
  catMeta,
  statusMeta,
  priorityMeta,
  computeProgress,
  dueLabel,
  buildMomentum,
  relTime,
  clampPct,
  STATUSES,
} from './util'
import { MomentumChart, ProgressRing } from './Charts'

// util 嘅 Tone（含 violet / cyan）比 Badge 支援嘅多；
// 收窄到 Badge 接受嘅 tone，唔支援嘅（violet / cyan）對應做 blue，
// 避免傳咗 Badge 無定義嘅 key 而渲染出無樣式嘅 badge。
type BadgeTone = 'slate' | 'accent' | 'green' | 'amber' | 'rose' | 'blue'
function badgeTone(tone: string): BadgeTone {
  switch (tone) {
    case 'accent':
    case 'green':
    case 'amber':
    case 'rose':
    case 'blue':
    case 'slate':
      return tone
    case 'violet':
    case 'cyan':
      return 'blue'
    default:
      return 'slate'
  }
}

export default function GoalDetail({
  goalId,
  onClose,
  onEdit,
}: {
  goalId: string
  onClose: () => void
  onEdit: (goalId: string) => void
}) {
  const goals = useCollection(goalsCol)
  const metas = useCollection(goalMetaCol)
  const allMilestones = useCollection(milestonesCol)
  const allCheckins = useCollection(goalCheckinsCol)
  const toast = useToast()
  const confirm = useConfirm()

  const [checkinNote, setCheckinNote] = useState('')

  const goal = goals.find((g) => g.id === goalId)
  const meta = metas.find((m) => m.id === goalId)
  const milestones = useMemo(
    () => allMilestones.filter((m) => m.goalId === goalId).sort((a, b) => a.order - b.order),
    [allMilestones, goalId],
  )
  const checkins = useMemo(
    () =>
      allCheckins
        .filter((c) => c.goalId === goalId)
        .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)),
    [allCheckins, goalId],
  )

  const progress = goal ? computeProgress(milestones, goal.progress) : 0
  const hasMilestones = milestones.length > 0
  const cat = catMeta(meta?.category)
  const st = statusMeta(meta?.status)
  const pr = priorityMeta(meta?.priority)
  const due = dueLabel(meta?.targetDate)
  const CatIcon = cat.icon

  const momentum = useMemo(
    () => buildMomentum(checkins, progress, 30),
    [checkins, progress],
  )

  if (!goal) return null

  function persistProgress(g: Goal, next: number) {
    goalsCol.update(g.id, { progress: next })
    if (next >= 100) {
      ensureMeta({ status: 'done' })
      if (g.progress < 100) toast.success('恭喜達成目標')
    }
  }

  function ensureMeta(patch: Partial<typeof meta extends infer T ? T : never>) {
    if (meta) goalMetaCol.update(goalId, patch as never)
    else
      goalMetaCol.add({
        id: goalId,
        category: 'study',
        priority: 'medium',
        status: 'active',
        ...(patch as object),
      } as never)
  }

  function toggleMilestone(id: string, done: boolean) {
    milestonesCol.update(id, { done: !done, doneAt: !done ? new Date().toISOString() : undefined })
    // 重算加權進度並寫返 goal
    const next = milestones.map((m) => (m.id === id ? { ...m, done: !done } : m))
    const prog = computeProgress(next, goal!.progress)
    persistProgress(goal!, prog)
  }

  function setStatus(s: GoalStatus) {
    ensureMeta({ status: s })
    if (s === 'done') {
      goalsCol.update(goalId, { progress: 100 })
    }
    toast.success(`狀態：${statusMeta(s).label}`)
  }

  function bump(delta: number) {
    if (hasMilestones) return // 有里程碑時進度由里程碑話事
    const next = clampPct(goal!.progress + delta)
    persistProgress(goal!, next)
  }

  function logCheckin() {
    goalCheckinsCol.add({
      goalId,
      progress,
      note: checkinNote.trim() || undefined,
      createdAt: new Date().toISOString(),
    })
    setCheckinNote('')
    toast.success('已記錄簽到')
  }

  async function removeCheckin(id: string) {
    goalCheckinsCol.remove(id)
    toast.success('已刪除簽到')
  }

  async function handleDelete() {
    const ok = await confirm({
      title: '刪除目標？',
      message: `「${goal!.title}」連同里程碑同簽到記錄會一併刪除，無法復原。`,
      confirmText: '刪除',
      tone: 'danger',
    })
    if (!ok) return
    for (const m of allMilestones.filter((x) => x.goalId === goalId)) milestonesCol.remove(m.id)
    for (const c of allCheckins.filter((x) => x.goalId === goalId)) goalCheckinsCol.remove(c.id)
    if (meta) goalMetaCol.remove(goalId)
    goalsCol.remove(goalId)
    toast.success('已刪除目標')
    onClose()
  }

  const doneMs = milestones.filter((m) => m.done).length

  return (
    <Modal open onClose={onClose} size="xl">
      <div className="space-y-5">
        {/* 標題列 */}
        <div className="flex items-start gap-3">
          <ProgressRing value={progress} size={52} stroke={6} tone={progress >= 100 ? 'green' : 'accent'} />
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-bold leading-tight text-slate-800 dark:text-slate-100">{goal.title}</h3>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Badge tone={badgeTone(cat.tone)} icon={CatIcon}>
                {cat.label}
              </Badge>
              <Badge tone={badgeTone(pr.tone)} icon={Flag}>
                {pr.label}優先
              </Badge>
              <Badge tone={badgeTone(st.tone)} dot>
                {st.label}
              </Badge>
              {due && (
                <Badge tone={badgeTone(due.tone)} icon={CalendarClock}>
                  {due.text}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <IconButton label="編輯目標" onClick={() => onEdit(goalId)}>
              <Pencil size={16} />
            </IconButton>
            <IconButton label="刪除目標" tone="danger" onClick={handleDelete}>
              <Trash2 size={16} />
            </IconButton>
          </div>
        </div>

        {/* 進度條 + 手動調整（無里程碑時）*/}
        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="font-medium text-slate-500 dark:text-slate-400">整體進度</span>
            <span className="font-semibold tabular-nums text-accent">{progress}%</span>
          </div>
          <ProgressBar value={progress} tone={progress >= 100 ? 'green' : 'accent'} />
          {!hasMilestones && (
            <div className="mt-2.5 flex items-center gap-2">
              {[-25, -10, +10, +25].map((d) => (
                <Button
                  key={d}
                  size="sm"
                  variant="secondary"
                  onClick={() => bump(d)}
                  disabled={(d < 0 && progress <= 0) || (d > 0 && progress >= 100)}
                >
                  {d > 0 ? `+${d}` : d}%
                </Button>
              ))}
            </div>
          )}
        </div>

        {/* 狀態流轉 */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">狀態</span>
          <SegmentedControl<GoalStatus>
            options={STATUSES.map((s) => ({ id: s.id, label: s.label }))}
            value={meta?.status ?? 'active'}
            onChange={setStatus}
            size="sm"
          />
        </div>

        <Separator />

        {/* 里程碑 */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
              <Flag size={15} className="text-accent" />
              里程碑
            </h4>
            {hasMilestones && (
              <span className="text-xs tabular-nums text-slate-400">
                {doneMs}/{milestones.length} 完成
              </span>
            )}
          </div>
          {hasMilestones ? (
            <ul className="space-y-1.5">
              {milestones.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
                >
                  <button
                    type="button"
                    onClick={() => toggleMilestone(m.id, m.done)}
                    aria-pressed={m.done}
                    className={cx(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors',
                      m.done
                        ? 'border-emerald-500 bg-emerald-500 text-white'
                        : 'border-slate-300 hover:border-accent dark:border-slate-600',
                    )}
                  >
                    {m.done && <CheckCircle2 size={14} />}
                  </button>
                  <span
                    className={cx(
                      'min-w-0 flex-1 text-sm',
                      m.done ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-200',
                    )}
                  >
                    {m.title}
                  </span>
                  {m.weight > 1 && (
                    <Badge tone="slate" className="shrink-0">
                      ×{m.weight}
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-lg border border-dashed border-slate-200 px-3 py-3 text-center text-xs text-slate-400 dark:border-slate-700">
              未設里程碑。撳「編輯」加入拆細步驟，進度會自動計算。
            </p>
          )}
        </section>

        {meta?.notes && (
          <section>
            <h4 className="mb-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">備註</h4>
            <p className="whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
              {meta.notes}
            </p>
          </section>
        )}

        <Separator />

        {/* 動量曲線 */}
        <section>
          <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <TrendingUp size={15} className="text-accent" />
            進度動量（近 30 日）
          </h4>
          <Card className="p-3">
            <MomentumChart data={momentum} />
          </Card>
        </section>

        {/* 簽到 */}
        <section>
          <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <History size={15} className="text-accent" />
            進度簽到
          </h4>
          <div className="flex gap-2">
            <Input
              value={checkinNote}
              onChange={(e) => setCheckinNote(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && logCheckin()}
              placeholder={`記錄今日進度（現時 ${progress}%）…`}
              className="flex-1"
            />
            <Button icon={Plus} onClick={logCheckin} className="shrink-0">
              簽到
            </Button>
          </div>
          {checkins.length === 0 ? (
            <div className="mt-3">
              <EmptyState icon={History} title="未有簽到記錄" hint="每次有進展就簽到一次，砌出你嘅動量曲線。" />
            </div>
          ) : (
            <ul className="mt-3 space-y-2">
              {[...checkins].reverse().map((c) => (
                <li key={c.id} className="group flex items-start gap-3 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
                  <span className="mt-0.5 flex h-7 w-11 shrink-0 items-center justify-center rounded-md bg-accent-soft text-xs font-semibold tabular-nums text-accent-strong dark:bg-accent/15 dark:text-accent">
                    {c.progress}%
                  </span>
                  <div className="min-w-0 flex-1">
                    {c.note && <p className="text-sm text-slate-700 dark:text-slate-200">{c.note}</p>}
                    <p className="text-xs text-slate-400">{relTime(c.createdAt)}</p>
                  </div>
                  <IconButton
                    label="刪除簽到"
                    tone="danger"
                    size="sm"
                    onClick={() => removeCheckin(c.id)}
                    className="opacity-0 transition group-hover:opacity-100"
                  >
                    <Trash2 size={14} />
                  </IconButton>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Modal>
  )
}
