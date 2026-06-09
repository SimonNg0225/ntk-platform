import { useMemo, useState } from 'react'
import {
  Plus,
  Pencil,
  Trash2,
  Archive,
  ArchiveRestore,
  Target,
  Timer,
  FolderOpen,
  FolderKanban,
  Check,
} from 'lucide-react'
import {
  Button,
  Input,
  Field,
  Modal,
  EmptyState,
  IconButton,
  Tooltip,
  ProgressBar,
  cx,
} from '../../../ui'
import { useToast } from '../../../context/ToastContext'
import { useConfirm } from '../../../context/ConfirmContext'
import { focusProjectsCol, fmtDuration, todayKey, keyOf } from './store'
import type { FocusLog, FocusProject } from './types'
import { PALETTE_KEYS, paletteOf } from './charts'

const EMOJIS = ['📚', '💼', '📖', '💻', '✍️', '🎯', '🧪', '🎨', '🏃', '🧘', '🌱', '🎵']

export default function ProjectsView({
  projects,
  logs,
}: {
  projects: FocusProject[]
  logs: FocusLog[]
}) {
  const toast = useToast()
  const confirm = useConfirm()
  const [editing, setEditing] = useState<FocusProject | 'new' | null>(null)

  // 逐專案統計
  const stats = useMemo(() => {
    const map = new Map<string, { min: number; sessions: number; today: number }>()
    for (const l of logs) {
      if (l.kind !== 'focus' || !l.completed || !l.projectId) continue
      const s = map.get(l.projectId) ?? { min: 0, sessions: 0, today: 0 }
      s.min += l.actualMin
      s.sessions += 1
      if (keyOf(l.startedAt) === todayKey()) s.today += 1
      map.set(l.projectId, s)
    }
    return map
  }, [logs])

  const active = projects.filter((p) => !p.archived)
  const archived = projects.filter((p) => p.archived)

  async function del(p: FocusProject) {
    const used = logs.some((l) => l.projectId === p.id)
    const ok = await confirm({
      title: `刪除專案「${p.name}」？`,
      message: used
        ? '相關紀錄會保留，但會變成「未分類」。'
        : '此操作無法復原。',
      tone: 'danger',
      confirmText: '刪除',
    })
    if (!ok) return
    focusProjectsCol.remove(p.id)
    toast.success('已刪除專案')
  }

  function toggleArchive(p: FocusProject) {
    focusProjectsCol.update(p.id, { archived: !p.archived })
    toast.info(p.archived ? '已復原專案' : '已封存專案')
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* ── 安靜引：kicker + serif 標題，呼應主畫面扉頁 ── */}
      <header className="text-center">
        <p className="flex items-center justify-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.22em] text-accent/70">
          <FolderKanban size={12} className="shrink-0" />
          專注專案 · Projects
        </p>
        <h2 className="mt-2 text-[22px] font-semibold leading-none tracking-tight text-slate-800 dark:text-slate-100 sm:text-[26px]">
          一件事，慢慢累積
        </h2>
        <p className="mx-auto mt-2.5 max-w-sm text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
          以專案組織專注時間，逐個追蹤累積成果同每日目標。
        </p>
      </header>

      {/* 動作列：纖細 hairline，唔搶卡片風頭 */}
      <div className="flex items-center justify-between border-b border-slate-200/70 pb-3 dark:border-slate-700/50">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
          進行中 <span className="text-sm tabular-nums text-slate-600 dark:text-slate-300">{active.length}</span>
        </p>
        <Button size="sm" icon={Plus} onClick={() => setEditing('new')}>
          新專案
        </Button>
      </div>

      {active.length === 0 && archived.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="未有專案"
          hint="建立專案（例如「溫習」「論文」），開始計時時就可以歸類。"
          action={
            <Button size="sm" icon={Plus} onClick={() => setEditing('new')}>
              建立第一個專案
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {active.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              stat={stats.get(p.id)}
              onEdit={() => setEditing(p)}
              onDelete={() => del(p)}
              onArchive={() => toggleArchive(p)}
            />
          ))}
        </div>
      )}

      {archived.length > 0 && (
        <div className="pt-2">
          <div className="mb-3 flex items-baseline gap-3">
            <h3 className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
              <Archive size={12} className="shrink-0" />
              已封存
            </h3>
            <span className="h-px flex-1 translate-y-[-3px] bg-slate-200/70 dark:bg-slate-700/50" />
            <span className="text-sm italic tabular-nums text-slate-400 dark:text-slate-500">
              {archived.length}
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {archived.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                stat={stats.get(p.id)}
                onEdit={() => setEditing(p)}
                onDelete={() => del(p)}
                onArchive={() => toggleArchive(p)}
              />
            ))}
          </div>
        </div>
      )}

      {editing && (
        <ProjectModal
          project={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function ProjectCard({
  project,
  stat,
  onEdit,
  onDelete,
  onArchive,
}: {
  project: FocusProject
  stat?: { min: number; sessions: number; today: number }
  onEdit: () => void
  onDelete: () => void
  onArchive: () => void
}) {
  const pal = paletteOf(project.color)
  const goal = project.dailyGoal ?? 0
  const today = stat?.today ?? 0
  const met = goal > 0 && today >= goal
  return (
    <div className={cx('group relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-4 pl-5 transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md dark:border-slate-700/60 dark:bg-slate-800 dark:hover:border-slate-600', project.archived && 'opacity-60')}>
      {/* 色脊：專案調色盤，靜靜標示身份 */}
      <span aria-hidden="true" className={cx('absolute inset-y-0 left-0 w-1', pal.dot)} />
      <div className="flex items-start gap-3">
        <span className={cx('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-lg', pal.soft)}>
          {project.icon || <Target size={18} className={pal.text} />}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[17px] font-semibold tracking-tight text-slate-800 dark:text-slate-100">
            {project.name}
          </h3>
          <div className="mt-0.5 flex items-center gap-2.5 text-[11px] text-slate-400">
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Timer size={12} />
              <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
                {fmtDuration(stat?.min ?? 0)}
              </span>
            </span>
            <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">·</span>
            <span className="tabular-nums">{stat?.sessions ?? 0} 節</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5 transition focus-within:opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
          <Tooltip label="編輯">
            <IconButton label="編輯" size="md" className="p-2" onClick={onEdit}>
              <Pencil size={14} />
            </IconButton>
          </Tooltip>
          <Tooltip label={project.archived ? '復原' : '封存'}>
            <IconButton label={project.archived ? '復原' : '封存'} size="md" className="p-2" onClick={onArchive}>
              {project.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
            </IconButton>
          </Tooltip>
          <Tooltip label="刪除">
            <IconButton label="刪除" size="md" className="p-2" tone="danger" onClick={onDelete}>
              <Trash2 size={14} />
            </IconButton>
          </Tooltip>
        </div>
      </div>

      {goal > 0 && (
        <div className="mt-3.5">
          <div className="mb-1.5 flex items-center justify-between text-[11px]">
            <span className="font-medium uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
              今日目標
            </span>
            <span
              className={cx(
                'inline-flex items-center gap-1 tabular-nums',
                met ? 'font-medium text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400',
              )}
            >
              {today}/{goal} 節
              {met && <Check size={12} className="shrink-0" />}
            </span>
          </div>
          <ProgressBar value={(today / goal) * 100} size="sm" tone={met ? 'green' : 'accent'} />
        </div>
      )}
    </div>
  )
}

function ProjectModal({
  project,
  onClose,
}: {
  project: FocusProject | null
  onClose: () => void
}) {
  const toast = useToast()
  const [name, setName] = useState(project?.name ?? '')
  const [color, setColor] = useState(project?.color ?? 'accent')
  const [icon, setIcon] = useState(project?.icon ?? '📚')
  const [goal, setGoal] = useState(project?.dailyGoal ?? 0)

  function save() {
    if (!name.trim()) {
      toast.error('請輸入專案名稱')
      return
    }
    if (project) {
      focusProjectsCol.update(project.id, {
        name: name.trim(),
        color,
        icon,
        dailyGoal: goal || undefined,
      })
      toast.success('已更新專案')
    } else {
      focusProjectsCol.add({
        name: name.trim(),
        color,
        icon,
        dailyGoal: goal || undefined,
        createdAt: new Date().toISOString(),
      })
      toast.success('已建立專案')
    }
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={project ? '編輯專案' : '新專案'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button onClick={save}>{project ? '儲存' : '建立'}</Button>
        </>
      }
    >
      <div className="space-y-5">
        <Field label="名稱" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：BAFS 溫習" autoFocus />
        </Field>

        {/* 外觀：圖示 + 顏色一組，hairline 分隔 */}
        <div className="space-y-4 border-t border-slate-200/70 pt-4 dark:border-slate-700/50">
          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
              圖示
            </p>
            <div className="flex flex-wrap gap-1.5">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  aria-label={`圖示 ${e}`}
                  aria-pressed={icon === e}
                  onClick={() => setIcon(e)}
                  className={cx(
                    'flex h-9 w-9 items-center justify-center rounded-xl text-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
                    icon === e
                      ? 'bg-accent-soft ring-2 ring-accent dark:bg-accent/15'
                      : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600',
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
              顏色
            </p>
            <div className="flex flex-wrap gap-2.5">
              {PALETTE_KEYS.map((c) => {
                const pal = paletteOf(c)
                const on = color === c
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={cx(
                      'flex h-8 w-8 items-center justify-center rounded-full text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800',
                      pal.dot,
                      on ? 'ring-2 ring-offset-2 ring-slate-400 dark:ring-offset-slate-800' : 'hover:scale-110',
                    )}
                    aria-label={`顏色 ${c}`}
                    aria-pressed={on}
                  >
                    {on && <Check size={14} strokeWidth={3} className="drop-shadow-sm" />}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* 節律：每日目標 */}
        <div className="border-t border-slate-200/70 pt-4 dark:border-slate-700/50">
          <Field label="每日目標番茄數（0 = 不設）" hint="達標後卡片會顯示綠色完成">
            <Input
              type="number"
              min={0}
              value={goal}
              onChange={(e) => setGoal(Math.max(0, Number(e.target.value) || 0))}
            />
          </Field>
        </div>

        {project && (
          <p className="text-[11px] italic text-slate-400 dark:text-slate-500">
            建立於 {keyOf(project.createdAt)}
          </p>
        )}
      </div>
    </Modal>
  )
}
