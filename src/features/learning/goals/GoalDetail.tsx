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
  Mountain,
  MountainSnow,
  Footprints,
  Route,
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

// 登山語境：進度區間 → 攀升狀態（同主畫面 GoalsWidget altitudeLabel 一致）
function altitudeLabel(progress: number, isDone: boolean): string {
  if (isDone) return '已登頂'
  if (progress >= 75) return '逼近山頂'
  if (progress >= 40) return '穩步上山'
  if (progress > 0) return '剛起步'
  return '喺山腳'
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
    } else if (meta?.status === 'done') {
      // 進度跌返 <100（uncheck 里程碑 / 手動 −%）：撤銷 done，回復進行中，
      // 令 meta.status 同 progress 一致；唔掂 'paused' 等非終態。
      ensureMeta({ status: 'active' })
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
        {/* ───────── 攀登誌 masthead ───────── */}
        <header>
          <div className="flex items-start justify-between gap-3">
            <p className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.3em] text-accent/70">
              <Mountain size={13} className="shrink-0" />
              攀登誌 · Summit Log
            </p>
            <div className="-mt-1 flex shrink-0 items-center gap-1">
              <IconButton label="編輯目標" onClick={() => onEdit(goalId)}>
                <Pencil size={16} />
              </IconButton>
              <IconButton label="刪除目標" tone="danger" onClick={handleDelete}>
                <Trash2 size={16} />
              </IconButton>
            </div>
          </div>
          <div className="mt-1.5 flex items-start gap-3.5">
            <div className="relative shrink-0">
              <ProgressRing value={progress} size={56} stroke={6} tone={progress >= 100 ? 'green' : 'accent'} />
              <span className="absolute inset-0 flex items-center justify-center">
                {progress >= 100 ? (
                  <MountainSnow size={18} className="text-emerald-500" />
                ) : (
                  <Mountain size={16} className="text-accent" />
                )}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-xl font-semibold leading-tight tracking-tight text-slate-800 dark:text-slate-100">
                {goal.title}
              </h3>
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
          </div>
        </header>

        {/* 海拔：整體進度 + 手動調整（無里程碑時）*/}
        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-slate-700/60 dark:bg-slate-800/40">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
              <Footprints size={13} className="text-slate-400" />
              海拔 · {altitudeLabel(progress, progress >= 100)}
            </span>
            <span className={cx('text-2xl font-semibold leading-none tabular-nums', progress >= 100 ? 'text-emerald-500' : 'text-accent')}>
              {progress}<span className="ml-0.5 align-top font-sans text-sm font-medium text-slate-400">%</span>
            </span>
          </div>
          <ProgressBar value={progress} tone={progress >= 100 ? 'green' : 'accent'} />
          {hasMilestones ? (
            <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">海拔由沿途里程碑加權自動計算。</p>
          ) : (
            <div className="mt-3 flex items-center gap-1.5">
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
          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">狀態</span>
          <SegmentedControl<GoalStatus>
            options={STATUSES.map((s) => ({ id: s.id, label: s.label }))}
            value={meta?.status ?? 'active'}
            onChange={setStatus}
            size="sm"
          />
        </div>

        <Separator />

        {/* 沿途路標（里程碑）*/}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
              <Route size={15} className="text-accent" />
              沿途路標
            </h4>
            {hasMilestones && (
              <span className="text-xs tabular-nums text-slate-400">
                已踏 {doneMs}/{milestones.length}
              </span>
            )}
          </div>
          {hasMilestones ? (
            <ul className="space-y-1.5">
              {milestones.map((m, i) => (
                <li
                  key={m.id}
                  className={cx(
                    'flex items-center gap-2.5 rounded-xl border px-3 py-2.5 transition-colors',
                    m.done
                      ? 'border-emerald-200/70 bg-emerald-50/50 dark:border-emerald-500/20 dark:bg-emerald-500/5'
                      : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800',
                  )}
                >
                  {/* 路標序號（呼應卡片 AscentTrail 節點）*/}
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
                    onClick={() => toggleMilestone(m.id, m.done)}
                    aria-pressed={m.done}
                    aria-label={m.done ? `將路標「${m.title}」標記為未踏` : `踏過路標「${m.title}」`}
                    className={cx(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-1',
                      m.done
                        ? 'border-emerald-500 bg-emerald-500 text-white'
                        : 'border-slate-300 hover:border-accent dark:border-slate-600',
                    )}
                  >
                    {m.done && <CheckCircle2 size={14} />}
                  </button>
                  <span
                    className={cx(
                      'min-w-0 flex-1 break-words text-sm',
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
            <div className="rounded-xl border border-dashed border-slate-200/80 bg-slate-50/50 px-4 py-5 text-center dark:border-slate-700/60 dark:bg-slate-800/30">
              <p className="text-sm text-slate-500 dark:text-slate-400">仲未標下沿途路標</p>
              <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                撳右上「編輯」拆幾個路標，海拔就會自動跟住行。
              </p>
            </div>
          )}
        </section>

        {meta?.notes && (
          <section>
            <h4 className="mb-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">登山筆記</h4>
            <p className="whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
              {meta.notes}
            </p>
          </section>
        )}

        <Separator />

        {/* 攀升動量曲線 */}
        <section>
          <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <TrendingUp size={15} className="text-accent" />
            攀升動量（近 30 日）
          </h4>
          <Card className="p-3">
            <MomentumChart data={momentum} />
          </Card>
        </section>

        {/* 攀登日誌（簽到）*/}
        <section>
          <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <History size={15} className="text-accent" />
            攀登日誌
          </h4>
          <div className="flex gap-2">
            <Input
              value={checkinNote}
              onChange={(e) => setCheckinNote(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && logCheckin()}
              placeholder={`今日行到邊？（現時海拔 ${progress}%）…`}
              icon={Footprints}
              className="flex-1"
            />
            <Button icon={Plus} onClick={logCheckin} className="shrink-0">
              記一筆
            </Button>
          </div>
          {checkins.length === 0 ? (
            <div className="mt-3">
              <EmptyState icon={History} title="攀登日誌仲係白紙" hint="每次行多幾步就記一筆，砌出你嘅攀升動量。" />
            </div>
          ) : (
            <ul className="mt-3 space-y-2">
              {[...checkins].reverse().map((c) => (
                <li key={c.id} className="group flex items-start gap-3 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
                  <span className="mt-0.5 flex h-8 w-12 shrink-0 flex-col items-center justify-center rounded-md bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
                    <span className="text-sm font-semibold leading-none tabular-nums">{c.progress}%</span>
                    <span className="mt-0.5 text-[8px] font-medium uppercase tracking-wide opacity-70">海拔</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    {c.note && <p className="whitespace-pre-wrap break-words text-sm text-slate-700 dark:text-slate-200">{c.note}</p>}
                    <p className="text-xs text-slate-400">{relTime(c.createdAt)}</p>
                  </div>
                  <IconButton
                    label="刪除日誌"
                    tone="danger"
                    onClick={() => removeCheckin(c.id)}
                    className="min-h-[36px] min-w-[36px] opacity-100 transition focus-within:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
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
