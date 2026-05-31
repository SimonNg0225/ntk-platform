import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  BarChart3,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  Flag,
  FolderPlus,
  Inbox as InboxIcon,
  LayoutList,
  ListChecks,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Sun,
  Tag,
  Trash2,
  X,
} from 'lucide-react'
import { useCollection } from '../../lib/store'
import { tasksCol } from '../../data/collections'
import type { Task } from '../../data/types'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  IconButton,
  Input,
  Menu,
  Modal,
  SectionTitle,
  SegmentedControl,
  StatCard,
  Tabs,
  cx,
} from '../../ui'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import { TaskEditor } from './todo/TaskEditor'
import { CompletionHeatmap, Donut, HBars, TrendChart } from './todo/charts'
import {
  cascadeDeleteTask,
  ensureMeta,
  projectsCol,
  pruneOrphans,
  subtasksCol,
  taskMetaCol,
  templatesCol,
  upsertMeta,
} from './todo/store'
import type { FullTask, Priority, Project, TaskTemplate } from './todo/types'
import {
  PRIORITY_META,
  PROJ_COLORS,
  buildHeat,
  buildTrend,
  completionStreak,
  daysBetween,
  dueBucket,
  dueLabel,
  offsetFromToday,
  parseQuickAdd,
  projColorCls,
  smartSort,
  todayISO,
} from './todo/util'

// ============================================================
//  待辦 / 批改 — Things 3 / Todoist 級任務管理
//  ------------------------------------------------------------
//  參考真實 app：Things 3 / Todoist。
//  共用 tasksCol（Task）做真相來源；優先級 / 到期 / 專案 / 標籤 /
//  備註 / 子任務存喺 feature 自己嘅 collection（見 todo/store.ts）。
//  視圖：今日 · 之後 · 所有（按專案）· 統計。
//  Power：智能快速輸入、優先級、到期分組、子任務、標籤、專案、
//  搜尋、批量、範本、生產力圖表。
// ============================================================

type ViewId = 'today' | 'upcoming' | 'all' | 'stats'
type SortMode = 'smart' | 'priority' | 'due' | 'created'

const SORT_LABEL: Record<SortMode, string> = {
  smart: '智能',
  priority: '優先級',
  due: '到期',
  created: '建立',
}

export default function TodoWidget() {
  const tasks = useCollection(tasksCol)
  const metas = useCollection(taskMetaCol)
  const subs = useCollection(subtasksCol)
  const projects = useCollection(projectsCol)
  const templates = useCollection(templatesCol)
  const toast = useToast()
  const confirm = useConfirm()

  const [view, setView] = useState<ViewId>('today')
  const [quick, setQuick] = useState('')
  const [search, setSearch] = useState('')
  const [activeProject, setActiveProject] = useState<string | 'all' | 'inbox'>('all')
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [sort, setSort] = useState<SortMode>('smart')
  const [showDone, setShowDone] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  // 批量選取
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Modal：專案管理 / 範本
  const [projModal, setProjModal] = useState(false)
  const [tmplModal, setTmplModal] = useState(false)

  const QUICK_INPUT_ID = 'todo-quick-add'

  // ───────── 合併成 FullTask（補底 meta）─────────
  const full: FullTask[] = useMemo(() => {
    const metaMap = new Map(metas.map((m) => [m.id, m]))
    const subMap = new Map<string, typeof subs>()
    for (const s of subs) {
      const arr = subMap.get(s.taskId) ?? []
      arr.push(s)
      subMap.set(s.taskId, arr)
    }
    return tasks.map((t) => {
      const meta =
        metaMap.get(t.id) ?? {
          id: t.id,
          priority: 4 as Priority,
          tags: [] as string[],
          order: new Date(t.createdAt).getTime(),
          updatedAt: t.createdAt,
        }
      return {
        id: t.id,
        text: t.text,
        done: t.done,
        createdAt: t.createdAt,
        meta,
        subtasks: subMap.get(t.id) ?? [],
      }
    })
  }, [tasks, metas, subs])

  // 一次性補底：為冇 meta 嘅舊任務 / Inbox 建立嘅任務建 meta；清孤兒
  const ranBackfill = useRef(false)
  useEffect(() => {
    if (ranBackfill.current) return
    ranBackfill.current = true
    const metaIds = new Set(taskMetaCol.get().map((m) => m.id))
    for (const t of tasksCol.get()) if (!metaIds.has(t.id)) ensureMeta(t.id)
    pruneOrphans(new Set(tasksCol.get().map((t) => t.id)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ⌘K / Ctrl+K 聚焦快速輸入
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        document.getElementById(QUICK_INPUT_ID)?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const editing = editingId ? full.find((t) => t.id === editingId) ?? null : null

  // ───────── 全部標籤 ─────────
  const allTags = useMemo(() => {
    const set = new Set<string>()
    full.forEach((t) => t.meta.tags.forEach((x) => set.add(x)))
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [full])

  // ───────── 統計數字 ─────────
  const today = todayISO()
  const counts = useMemo(() => {
    let overdue = 0
    let todayDue = 0
    let active = 0
    let done = 0
    for (const t of full) {
      if (t.done) {
        done++
        continue
      }
      active++
      const b = dueBucket(t.meta.due, today)
      if (b === 'overdue') overdue++
      else if (b === 'today') todayDue++
    }
    return { overdue, todayDue, active, done, total: full.length }
  }, [full, today])

  // ───────── 篩選器（搜尋 / 專案 / 標籤）─────────
  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase()
    return full.filter((t) => {
      if (kw) {
        const inText = t.text.toLowerCase().includes(kw)
        const inNote = (t.meta.note ?? '').toLowerCase().includes(kw)
        const inSub = t.subtasks.some((s) => s.text.toLowerCase().includes(kw))
        if (!inText && !inNote && !inSub) return false
      }
      if (activeTag && !t.meta.tags.includes(activeTag)) return false
      return true
    })
  }, [full, search, activeTag])

  // ───────── 排序器 ─────────
  const sorter = useMemo(() => {
    if (sort === 'priority')
      return (a: FullTask, b: FullTask) =>
        a.done !== b.done
          ? a.done
            ? 1
            : -1
          : a.meta.priority - b.meta.priority || a.meta.order - b.meta.order
    if (sort === 'due')
      return (a: FullTask, b: FullTask) => {
        if (a.done !== b.done) return a.done ? 1 : -1
        const ad = a.meta.due ?? '9999'
        const bd = b.meta.due ?? '9999'
        return ad < bd ? -1 : ad > bd ? 1 : a.meta.order - b.meta.order
      }
    if (sort === 'created')
      return (a: FullTask, b: FullTask) =>
        a.done !== b.done ? (a.done ? 1 : -1) : a.createdAt < b.createdAt ? 1 : -1
    return smartSort
  }, [sort])

  // ───────── 動作 ─────────
  const addQuick = () => {
    const raw = quick.trim()
    if (!raw) return
    const p = parseQuickAdd(raw, projects)
    if (!p.text) {
      toast.error('請輸入任務內容')
      return
    }
    // 視圖／篩選預設值
    const ctxProject =
      p.projectId ??
      (activeProject !== 'all' && activeProject !== 'inbox' ? activeProject : undefined)
    const ctxDue = p.due ?? (view === 'today' ? today : undefined)
    const created = tasksCol.add({
      text: p.text,
      done: false,
      createdAt: new Date().toISOString(),
    })
    const maxOrder = taskMetaCol.get().reduce((m, x) => Math.min(m, x.order), 0)
    upsertMeta(created.id, {
      priority: p.priority ?? 4,
      due: ctxDue,
      projectId: ctxProject,
      tags: p.tags,
      order: maxOrder - 1,
    })
    setQuick('')
    toast.success('已新增待辦')
  }

  const toggle = (t: FullTask) => {
    const next = !t.done
    tasksCol.update(t.id, { done: next })
    upsertMeta(t.id, { completedAt: next ? new Date().toISOString() : undefined })
  }

  const patchTask = (id: string, patch: Partial<Pick<Task, 'text' | 'done'>>) => {
    tasksCol.update(id, patch)
    if (patch.done !== undefined)
      upsertMeta(id, { completedAt: patch.done ? new Date().toISOString() : undefined })
  }

  const removeTask = async (t: FullTask) => {
    const ok = await confirm({
      title: '刪除待辦？',
      message: `「${t.text}」將會被刪除，呢個動作無法復原。`,
      confirmText: '刪除',
      tone: 'danger',
    })
    if (!ok) return
    tasksCol.remove(t.id)
    cascadeDeleteTask(t.id)
    toast.success('已刪除待辦')
  }
  // 編輯器內已自行確認，直接刪
  const removeTaskDirect = (t: FullTask) => {
    tasksCol.remove(t.id)
    cascadeDeleteTask(t.id)
    toast.success('已刪除待辦')
  }

  // ───────── 批量 ─────────
  const toggleSelect = (id: string) =>
    setSelected((s) => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  const exitSelect = () => {
    setSelecting(false)
    setSelected(new Set())
  }
  const bulkComplete = () => {
    selected.forEach((id) => {
      tasksCol.update(id, { done: true })
      upsertMeta(id, { completedAt: new Date().toISOString() })
    })
    toast.success(`已完成 ${selected.size} 項`)
    exitSelect()
  }
  const bulkDue = (days: number) => {
    const d = offsetFromToday(days)
    selected.forEach((id) => upsertMeta(id, { due: d }))
    toast.success(`已設到期：${dueLabel(d)}`)
    exitSelect()
  }
  const bulkPriority = (p: Priority) => {
    selected.forEach((id) => upsertMeta(id, { priority: p }))
    toast.success(`已設優先級 P${p}`)
    exitSelect()
  }
  const bulkProject = (projectId: string | undefined) => {
    selected.forEach((id) => upsertMeta(id, { projectId }))
    toast.success('已移動')
    exitSelect()
  }
  const bulkDelete = async () => {
    const ok = await confirm({
      title: `刪除 ${selected.size} 項待辦？`,
      message: '呢個動作無法復原。',
      confirmText: '刪除',
      tone: 'danger',
    })
    if (!ok) return
    selected.forEach((id) => {
      tasksCol.remove(id)
      cascadeDeleteTask(id)
    })
    toast.success(`已刪除 ${selected.size} 項`)
    exitSelect()
  }
  const clearCompleted = async () => {
    const doneTasks = full.filter((t) => t.done)
    if (doneTasks.length === 0) return
    const ok = await confirm({
      title: `清除 ${doneTasks.length} 項已完成？`,
      message: '所有已完成嘅待辦會被刪除，呢個動作無法復原。',
      confirmText: '清除',
      tone: 'danger',
    })
    if (!ok) return
    doneTasks.forEach((t) => {
      tasksCol.remove(t.id)
      cascadeDeleteTask(t.id)
    })
    toast.success('已清除已完成項目')
  }

  return (
    <div className="space-y-5">
      {/* 工具列（標題由 App 外殼提供，呢度只放動作）*/}
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="secondary"
          size="sm"
          icon={Sparkles}
          onClick={() => setTmplModal(true)}
        >
          範本
        </Button>
        <Menu
          align="end"
          trigger={
            <span className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
              更多
              <ChevronRight size={14} className="rotate-90" />
            </span>
          }
          items={[
            {
              id: 'select',
              label: '批量選取',
              icon: CheckCircle2,
              onSelect: () => setSelecting(true),
            },
            {
              id: 'projects',
              label: '管理專案',
              icon: FolderPlus,
              onSelect: () => setProjModal(true),
            },
            {
              id: 'clear',
              label: '清除已完成',
              icon: Trash2,
              tone: 'danger',
              onSelect: clearCompleted,
            },
          ]}
        />
      </div>

      {/* 統計卡 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="逾期"
          value={counts.overdue}
          unit="項"
          icon={Flag}
          onClick={() => {
            setView('upcoming')
            setSearch('')
          }}
          hint={counts.overdue > 0 ? '需要跟進' : '無逾期 👍'}
        />
        <StatCard
          label="今日到期"
          value={counts.todayDue}
          unit="項"
          icon={Sun}
          highlight
          onClick={() => setView('today')}
        />
        <StatCard label="未完成" value={counts.active} unit="項" icon={CircleDashed} />
        <StatCard label="已完成" value={counts.done} unit="項" icon={CheckCircle2} />
      </div>

      {/* 快速輸入 */}
      <div className="space-y-1.5">
        <div className="flex gap-2">
          <Input
            id={QUICK_INPUT_ID}
            icon={Plus}
            value={quick}
            onChange={(e) => setQuick(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addQuick()}
            placeholder="新增待辦… 試吓「批改 5A 練習 !! #教學 @批改 +2」"
            className="flex-1"
          />
          <Button onClick={addQuick} icon={Plus}>
            加入
          </Button>
        </div>
        <p className="px-1 text-[11px] text-slate-400 dark:text-slate-500">
          <span className="font-medium text-slate-500 dark:text-slate-400">!</span> 優先級 ·{' '}
          <span className="font-medium text-slate-500 dark:text-slate-400">#</span> 專案 ·{' '}
          <span className="font-medium text-slate-500 dark:text-slate-400">@</span> 標籤 ·{' '}
          <span className="font-medium text-slate-500 dark:text-slate-400">今日/聽日/+N</span> 到期
        </p>
      </div>

      {/* 視圖切換 */}
      <Tabs<ViewId>
        tabs={[
          { id: 'today', label: '今日' },
          { id: 'upcoming', label: '之後' },
          { id: 'all', label: '所有' },
          { id: 'stats', label: '統計' },
        ]}
        active={view}
        onChange={(v) => {
          setView(v)
          if (selecting) exitSelect()
        }}
        icons={{
          today: Sun,
          upcoming: CalendarDays,
          all: LayoutList,
          stats: BarChart3,
        }}
      />

      {/* 搜尋 + 排序（統計以外）*/}
      {view !== 'stats' && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            icon={Search}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜尋任務、子任務、備註…"
            className="flex-1"
          />
          <div className="flex items-center gap-2">
            <SegmentedControl<SortMode>
              size="sm"
              options={(Object.keys(SORT_LABEL) as SortMode[]).map((s) => ({
                id: s,
                label: SORT_LABEL[s],
              }))}
              value={sort}
              onChange={setSort}
            />
          </div>
        </div>
      )}

      {/* 標籤列 */}
      {view !== 'stats' && allTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <Tag size={13} className="text-slate-400" />
          {allTags.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setActiveTag((c) => (c === t ? null : t))}
            >
              <Badge tone={activeTag === t ? 'accent' : 'slate'}>{t}</Badge>
            </button>
          ))}
          {activeTag && (
            <button
              type="button"
              onClick={() => setActiveTag(null)}
              className="text-xs text-slate-400 hover:text-rose-500"
            >
              清除
            </button>
          )}
        </div>
      )}

      {/* 批量操作條 */}
      {selecting && (
        <BulkBar
          count={selected.size}
          projects={projects}
          onComplete={bulkComplete}
          onDue={bulkDue}
          onPriority={bulkPriority}
          onProject={bulkProject}
          onDelete={bulkDelete}
          onCancel={exitSelect}
        />
      )}

      {/* ── 視圖內容 ── */}
      {view === 'stats' ? (
        <StatsView tasks={full} projects={projects} />
      ) : view === 'today' ? (
        <TodayView
          tasks={filtered}
          sorter={sorter}
          projects={projects}
          selecting={selecting}
          selected={selected}
          onToggle={toggle}
          onOpen={setEditingId}
          onSelect={toggleSelect}
          onRemove={removeTask}
        />
      ) : view === 'upcoming' ? (
        <UpcomingView
          tasks={filtered}
          sorter={sorter}
          projects={projects}
          selecting={selecting}
          selected={selected}
          onToggle={toggle}
          onOpen={setEditingId}
          onSelect={toggleSelect}
          onRemove={removeTask}
        />
      ) : (
        <AllView
          tasks={filtered}
          sorter={sorter}
          projects={projects}
          activeProject={activeProject}
          setActiveProject={setActiveProject}
          showDone={showDone}
          setShowDone={setShowDone}
          selecting={selecting}
          selected={selected}
          onToggle={toggle}
          onOpen={setEditingId}
          onSelect={toggleSelect}
          onRemove={removeTask}
          onManageProjects={() => setProjModal(true)}
        />
      )}

      {/* 任務詳情 */}
      {editing && (
        <TaskEditor
          task={editing}
          projects={projects}
          allTags={allTags}
          onClose={() => setEditingId(null)}
          onPatchTask={patchTask}
          onDeleteTask={removeTaskDirect}
          onToggleTask={toggle}
        />
      )}

      {/* 專案管理 */}
      {projModal && (
        <ProjectManager projects={projects} onClose={() => setProjModal(false)} />
      )}

      {/* 範本 */}
      {tmplModal && (
        <TemplatePicker
          templates={templates}
          onClose={() => setTmplModal(false)}
          onApply={(ids) => {
            toast.success(`已由範本建立 ${ids} 項待辦`)
            setTmplModal(false)
          }}
        />
      )}
    </div>
  )
}

// ============================================================
//  任務列（共用）
// ============================================================
function TaskRow({
  task,
  project,
  selecting,
  selected,
  onToggle,
  onOpen,
  onSelect,
  onRemove,
}: {
  task: FullTask
  project?: Project
  selecting: boolean
  selected: boolean
  onToggle: (t: FullTask) => void
  onOpen: (id: string) => void
  onSelect: (id: string) => void
  onRemove: (t: FullTask) => void
}) {
  const pm = PRIORITY_META[task.meta.priority]
  const due = task.meta.due
  const diff = due ? daysBetween(todayISO(), due) : null
  const dueTone =
    diff !== null && diff < 0
      ? 'text-rose-500 dark:text-rose-400'
      : diff === 0
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-slate-400 dark:text-slate-500'
  const subDone = task.subtasks.filter((s) => s.done).length

  return (
    <div
      className={cx(
        'group flex items-start gap-3 px-3 py-2.5 transition-colors sm:px-4',
        selected && 'bg-accent-soft/60 dark:bg-accent/10',
        !selecting && 'hover:bg-slate-50 dark:hover:bg-slate-800/50',
      )}
    >
      {selecting ? (
        <button
          type="button"
          onClick={() => onSelect(task.id)}
          aria-label="選取"
          className={cx(
            'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition',
            selected
              ? 'border-accent bg-accent text-white'
              : 'border-slate-300 dark:border-slate-600',
          )}
        >
          {selected && <Check size={12} strokeWidth={3} />}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => onToggle(task)}
          aria-label={task.done ? '標記未完成' : '標記完成'}
          className={cx(
            'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition',
            task.done
              ? 'border-emerald-500 bg-emerald-500 text-white'
              : task.meta.priority <= 2
                ? cx('hover:bg-slate-50 dark:hover:bg-slate-700', pm.flag.replace('text-', 'border-'))
                : 'border-slate-300 hover:border-accent dark:border-slate-600',
          )}
        >
          {task.done && <Check size={12} strokeWidth={3} />}
        </button>
      )}

      <button
        type="button"
        onClick={() => (selecting ? onSelect(task.id) : onOpen(task.id))}
        className="min-w-0 flex-1 text-left"
      >
        <div className="flex items-center gap-1.5">
          {task.meta.priority <= 2 && !task.done && (
            <Flag size={12} className={cx('shrink-0', pm.flag)} />
          )}
          <span
            className={cx(
              'truncate text-sm',
              task.done
                ? 'text-slate-400 line-through dark:text-slate-500'
                : 'text-slate-800 dark:text-slate-100',
            )}
          >
            {task.text}
          </span>
        </div>
        {/* meta 行 */}
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px]">
          {due && (
            <span className={cx('inline-flex items-center gap-1 tabular-nums', dueTone)}>
              <CalendarDays size={11} />
              {dueLabel(due)}
            </span>
          )}
          {project && (
            <span className="inline-flex items-center gap-1 text-slate-400 dark:text-slate-500">
              <span className={cx('h-1.5 w-1.5 rounded-full', projColorCls(project.color).dot)} />
              {project.name}
            </span>
          )}
          {task.subtasks.length > 0 && (
            <span className="inline-flex items-center gap-1 tabular-nums text-slate-400 dark:text-slate-500">
              <ListChecks size={11} />
              {subDone}/{task.subtasks.length}
            </span>
          )}
          {task.meta.tags.slice(0, 3).map((t) => (
            <span key={t} className="text-slate-400 dark:text-slate-500">
              #{t}
            </span>
          ))}
          {task.meta.note && (
            <Pencil size={10} className="text-slate-300 dark:text-slate-600" />
          )}
        </div>
      </button>

      {!selecting && (
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
          <IconButton label="編輯" size="sm" onClick={() => onOpen(task.id)}>
            <Pencil size={14} />
          </IconButton>
          <IconButton label="刪除" size="sm" tone="danger" onClick={() => onRemove(task)}>
            <Trash2 size={14} />
          </IconButton>
        </div>
      )}
    </div>
  )
}

// 一組（標題 + 任務）
function Group({
  title,
  tone = 'slate',
  count,
  children,
}: {
  title: string
  tone?: 'slate' | 'rose' | 'amber' | 'accent'
  count: number
  children: ReactNode
}) {
  const toneCls =
    tone === 'rose'
      ? 'text-rose-600 dark:text-rose-400'
      : tone === 'amber'
        ? 'text-amber-600 dark:text-amber-400'
        : tone === 'accent'
          ? 'text-accent-strong dark:text-accent'
          : 'text-slate-500 dark:text-slate-400'
  if (count === 0) return null
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 px-1">
        <h3 className={cx('text-xs font-semibold uppercase tracking-wider', toneCls)}>
          {title}
        </h3>
        <span className="tabular-nums text-xs text-slate-400">{count}</span>
      </div>
      <Card className="divide-y divide-slate-100 overflow-hidden dark:divide-slate-700/60">
        {children}
      </Card>
    </div>
  )
}

// ============================================================
//  今日視圖（逾期 + 今日；含已完成可摺）
// ============================================================
function TodayView(props: {
  tasks: FullTask[]
  sorter: (a: FullTask, b: FullTask) => number
  projects: Project[]
  selecting: boolean
  selected: Set<string>
  onToggle: (t: FullTask) => void
  onOpen: (id: string) => void
  onSelect: (id: string) => void
  onRemove: (t: FullTask) => void
}) {
  const { tasks, sorter, projects } = props
  const today = todayISO()
  const projOf = (t: FullTask) => projects.find((p) => p.id === t.meta.projectId)

  const overdue = tasks
    .filter((t) => !t.done && dueBucket(t.meta.due, today) === 'overdue')
    .sort(sorter)
  const todayList = tasks
    .filter((t) => !t.done && dueBucket(t.meta.due, today) === 'today')
    .sort(sorter)
  const doneToday = tasks
    .filter((t) => t.done && t.meta.completedAt?.slice(0, 10) === today)
    .sort((a, b) => (a.meta.completedAt! < b.meta.completedAt! ? 1 : -1))

  const empty = overdue.length === 0 && todayList.length === 0 && doneToday.length === 0

  if (empty)
    return (
      <EmptyState
        icon={CheckCircle2}
        title="今日清晒 🎉"
        hint="冇逾期或今日到期嘅任務。喺上面快速輸入加一項，或者去「之後」睇將來嘅任務。"
      />
    )

  return (
    <div className="space-y-4">
      <Group title="逾期" tone="rose" count={overdue.length}>
        {overdue.map((t) => (
          <TaskRow key={t.id} task={t} project={projOf(t)} {...rowProps(props, t.id)} />
        ))}
      </Group>
      <Group title="今日" tone="amber" count={todayList.length}>
        {todayList.map((t) => (
          <TaskRow key={t.id} task={t} project={projOf(t)} {...rowProps(props, t.id)} />
        ))}
      </Group>
      <Group title="今日完成" count={doneToday.length}>
        {doneToday.map((t) => (
          <TaskRow key={t.id} task={t} project={projOf(t)} {...rowProps(props, t.id)} />
        ))}
      </Group>
    </div>
  )
}

// ============================================================
//  之後視圖（按到期分組：逾期 / 聽日 / 7 日內 / 之後 / 無到期）
// ============================================================
function UpcomingView(props: {
  tasks: FullTask[]
  sorter: (a: FullTask, b: FullTask) => number
  projects: Project[]
  selecting: boolean
  selected: Set<string>
  onToggle: (t: FullTask) => void
  onOpen: (id: string) => void
  onSelect: (id: string) => void
  onRemove: (t: FullTask) => void
}) {
  const { tasks, sorter, projects } = props
  const today = todayISO()
  const projOf = (t: FullTask) => projects.find((p) => p.id === t.meta.projectId)
  const active = tasks.filter((t) => !t.done)

  const buckets = {
    overdue: active.filter((t) => dueBucket(t.meta.due, today) === 'overdue').sort(sorter),
    today: active.filter((t) => dueBucket(t.meta.due, today) === 'today').sort(sorter),
    tomorrow: active.filter((t) => dueBucket(t.meta.due, today) === 'tomorrow').sort(sorter),
    soon: active.filter((t) => dueBucket(t.meta.due, today) === 'soon').sort(sorter),
    later: active.filter((t) => dueBucket(t.meta.due, today) === 'later').sort(sorter),
    none: active.filter((t) => dueBucket(t.meta.due, today) === 'none').sort(sorter),
  }
  const total = active.length

  if (total === 0)
    return (
      <EmptyState
        icon={CalendarDays}
        title="冇未完成嘅任務"
        hint="所有任務都搞掂咗，或者試吓喺上面加一項。"
      />
    )

  return (
    <div className="space-y-4">
      <Group title="逾期" tone="rose" count={buckets.overdue.length}>
        {buckets.overdue.map((t) => (
          <TaskRow key={t.id} task={t} project={projOf(t)} {...rowProps(props, t.id)} />
        ))}
      </Group>
      <Group title="今日" tone="amber" count={buckets.today.length}>
        {buckets.today.map((t) => (
          <TaskRow key={t.id} task={t} project={projOf(t)} {...rowProps(props, t.id)} />
        ))}
      </Group>
      <Group title="聽日" tone="accent" count={buckets.tomorrow.length}>
        {buckets.tomorrow.map((t) => (
          <TaskRow key={t.id} task={t} project={projOf(t)} {...rowProps(props, t.id)} />
        ))}
      </Group>
      <Group title="未來 7 日" count={buckets.soon.length}>
        {buckets.soon.map((t) => (
          <TaskRow key={t.id} task={t} project={projOf(t)} {...rowProps(props, t.id)} />
        ))}
      </Group>
      <Group title="之後" count={buckets.later.length}>
        {buckets.later.map((t) => (
          <TaskRow key={t.id} task={t} project={projOf(t)} {...rowProps(props, t.id)} />
        ))}
      </Group>
      <Group title="無到期" count={buckets.none.length}>
        {buckets.none.map((t) => (
          <TaskRow key={t.id} task={t} project={projOf(t)} {...rowProps(props, t.id)} />
        ))}
      </Group>
    </div>
  )
}

// ============================================================
//  所有視圖（按專案分；專案側欄篩選 + 進度）
// ============================================================
function AllView(props: {
  tasks: FullTask[]
  sorter: (a: FullTask, b: FullTask) => number
  projects: Project[]
  activeProject: string | 'all' | 'inbox'
  setActiveProject: (v: string | 'all' | 'inbox') => void
  showDone: boolean
  setShowDone: (v: boolean) => void
  selecting: boolean
  selected: Set<string>
  onToggle: (t: FullTask) => void
  onOpen: (id: string) => void
  onSelect: (id: string) => void
  onRemove: (t: FullTask) => void
  onManageProjects: () => void
}) {
  const {
    tasks,
    sorter,
    projects,
    activeProject,
    setActiveProject,
    showDone,
    setShowDone,
    onManageProjects,
  } = props

  const inboxCount = tasks.filter((t) => !t.done && !t.meta.projectId).length
  const projCount = (pid: string) =>
    tasks.filter((t) => !t.done && t.meta.projectId === pid).length

  const ordered = [...projects].sort((a, b) => a.order - b.order)

  // 應用專案篩選
  const scoped = tasks.filter((t) => {
    if (activeProject === 'all') return true
    if (activeProject === 'inbox') return !t.meta.projectId
    return t.meta.projectId === activeProject
  })
  const visible = scoped.filter((t) => showDone || !t.done).sort(sorter)
  const doneCount = scoped.filter((t) => t.done).length

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-[180px_1fr]">
      {/* 專案側欄 */}
      <aside className="space-y-1">
        {/* 手機：橫向滾動 chip（含所有專案）*/}
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 sm:hidden">
          <ScopeChip
            label="全部"
            active={activeProject === 'all'}
            onClick={() => setActiveProject('all')}
          />
          <ScopeChip
            label="收件匣"
            count={inboxCount}
            active={activeProject === 'inbox'}
            onClick={() => setActiveProject('inbox')}
          />
          {ordered.map((p) => (
            <ScopeChip
              key={p.id}
              label={`${p.emoji ? p.emoji + ' ' : ''}${p.name}`}
              dot={projColorCls(p.color).dot}
              count={projCount(p.id)}
              active={activeProject === p.id}
              onClick={() => setActiveProject(p.id)}
            />
          ))}
        </div>
        {/* 桌面：垂直側欄 */}
        <div className="hidden flex-col gap-0.5 pt-1 sm:flex">
          <SidebarItem
            label="全部"
            icon={<LayoutList size={15} />}
            active={activeProject === 'all'}
            onClick={() => setActiveProject('all')}
          />
          <SidebarItem
            label="收件匣"
            icon={<InboxIcon size={15} />}
            count={inboxCount}
            active={activeProject === 'inbox'}
            onClick={() => setActiveProject('inbox')}
          />
          <div className="my-1 h-px bg-slate-100 dark:bg-slate-800" />
          {ordered.map((p) => (
            <SidebarItem
              key={p.id}
              label={`${p.emoji ? p.emoji + ' ' : ''}${p.name}`}
              icon={
                <span className={cx('h-2.5 w-2.5 rounded-full', projColorCls(p.color).dot)} />
              }
              count={projCount(p.id)}
              active={activeProject === p.id}
              onClick={() => setActiveProject(p.id)}
            />
          ))}
          <button
            type="button"
            onClick={onManageProjects}
            className="mt-1 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            <FolderPlus size={14} /> 管理專案
          </button>
        </div>
      </aside>

      {/* 任務 */}
      <div className="min-w-0 space-y-3">
        <div className="flex items-center justify-between px-1">
          <button
            type="button"
            onClick={() => setShowDone(!showDone)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <CheckCircle2 size={13} />
            {showDone ? '隱藏已完成' : `顯示已完成（${doneCount}）`}
          </button>
        </div>
        {visible.length === 0 ? (
          <EmptyState
            icon={InboxIcon}
            title={activeProject === 'inbox' ? '收件匣係空嘅' : '呢度未有任務'}
            hint="喺上面快速輸入加一項，或者揀第個專案。"
          />
        ) : (
          <Card className="divide-y divide-slate-100 overflow-hidden dark:divide-slate-700/60">
            {visible.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                project={props.projects.find((p) => p.id === t.meta.projectId)}
                {...rowProps(props, t.id)}
              />
            ))}
          </Card>
        )}
      </div>
    </div>
  )
}

function SidebarItem({
  label,
  icon,
  count,
  active,
  onClick,
}: {
  label: string
  icon: ReactNode
  count?: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition',
        active
          ? 'bg-accent-soft font-medium text-accent-strong dark:bg-accent/15 dark:text-accent'
          : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
      )}
    >
      <span className="flex w-4 shrink-0 items-center justify-center">{icon}</span>
      <span className="flex-1 truncate text-left">{label}</span>
      {typeof count === 'number' && count > 0 && (
        <span className="tabular-nums text-xs text-slate-400">{count}</span>
      )}
    </button>
  )
}

// 手機橫向 scope chip
function ScopeChip({
  label,
  dot,
  count,
  active,
  onClick,
}: {
  label: string
  dot?: string
  count?: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition',
        active
          ? 'bg-accent text-white shadow-sm dark:shadow-none'
          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
      )}
    >
      {dot && <span className={cx('h-1.5 w-1.5 rounded-full', active ? 'bg-white/80' : dot)} />}
      {label}
      {typeof count === 'number' && count > 0 && (
        <span className={cx('tabular-nums text-xs', active ? 'text-white/80' : 'text-slate-400')}>
          {count}
        </span>
      )}
    </button>
  )
}

// 共用 handler bundle 型別（畀各視圖傳落 TaskRow）
interface RowHandlers {
  selecting: boolean
  selected: Set<string>
  onToggle: (t: FullTask) => void
  onOpen: (id: string) => void
  onSelect: (id: string) => void
  onRemove: (t: FullTask) => void
}

// 把視圖 props 收窄成 TaskRow 需要嘅 props（按 task 計 selected）
function rowProps(p: RowHandlers, taskId: string) {
  return {
    selecting: p.selecting,
    selected: p.selected.has(taskId),
    onToggle: p.onToggle,
    onOpen: p.onOpen,
    onSelect: p.onSelect,
    onRemove: p.onRemove,
  }
}

// ============================================================
//  統計視圖（自製圖表）
// ============================================================
function StatsView({ tasks, projects }: { tasks: FullTask[]; projects: Project[] }) {
  const [range, setRange] = useState<14 | 30 | 90>(30)
  const trend = useMemo(() => buildTrend(tasks, range), [tasks, range])
  const heat = useMemo(() => buildHeat(tasks, 119), [tasks]) // 17 週
  const streak = useMemo(() => completionStreak(heat), [heat])

  const active = tasks.filter((t) => !t.done)
  const completed = tasks.filter((t) => t.done)
  const completionRate = tasks.length
    ? Math.round((completed.length / tasks.length) * 100)
    : 0

  // 近 range 日完成總數
  const completedInRange = trend.reduce((s, d) => s + d.completed, 0)
  const createdInRange = trend.reduce((s, d) => s + d.created, 0)

  // 優先級占比（未完成）
  const prioSegments = ([1, 2, 3, 4] as Priority[])
    .map((p) => ({
      value: active.filter((t) => t.meta.priority === p).length,
      color:
        p === 1
          ? 'stroke-rose-500'
          : p === 2
            ? 'stroke-amber-500'
            : p === 3
              ? 'stroke-blue-500'
              : 'stroke-slate-300 dark:stroke-slate-600',
      label: `${PRIORITY_META[p].short} ${PRIORITY_META[p].label}`,
    }))
    .filter((s) => s.value > 0)

  // 按專案分布（未完成）
  const projBars = [
    ...projects.map((p) => ({
      label: p.name,
      value: active.filter((t) => t.meta.projectId === p.id).length,
      bar: projColorCls(p.color).bar,
    })),
    {
      label: '收件匣',
      value: active.filter((t) => !t.meta.projectId).length,
      bar: 'bg-slate-400',
    },
  ].filter((b) => b.value > 0)

  if (tasks.length === 0)
    return (
      <EmptyState
        icon={BarChart3}
        title="仲未有資料"
        hint="加幾項待辦、完成佢哋，呢度就會出生產力統計。"
      />
    )

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="連續完成"
          value={streak}
          unit="日"
          icon={Sparkles}
          highlight
          hint={streak > 0 ? '繼續保持！' : '今日完成一項就開始'}
        />
        <StatCard
          label="完成率"
          value={completionRate}
          unit="%"
          icon={CheckCircle2}
          trend={{
            value: `${completedInRange}`,
            dir: completedInRange >= createdInRange ? 'up' : 'down',
          }}
          hint={`近 ${range} 日完成 ${completedInRange}`}
        />
        <StatCard label="進行中" value={active.length} unit="項" icon={CircleDashed} />
        <StatCard label="累計完成" value={completed.length} unit="項" icon={ListChecks} />
      </div>

      <Card padded>
        <SectionTitle
          icon={BarChart3}
          right={
            <SegmentedControl<'14' | '30' | '90'>
              size="sm"
              options={[
                { id: '14', label: '14 日' },
                { id: '30', label: '30 日' },
                { id: '90', label: '90 日' },
              ]}
              value={String(range) as '14' | '30' | '90'}
              onChange={(v) => setRange(Number(v) as 14 | 30 | 90)}
            />
          }
        >
          完成 / 新增趨勢
        </SectionTitle>
        <TrendChart data={trend} />
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card padded>
          <SectionTitle icon={Flag}>未完成 · 按優先級</SectionTitle>
          {prioSegments.length > 0 ? (
            <Donut
              segments={prioSegments}
              centerValue={String(active.length)}
              centerLabel="未完成"
            />
          ) : (
            <p className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">
              冇未完成任務 🎉
            </p>
          )}
        </Card>
        <Card padded>
          <SectionTitle icon={LayoutList}>未完成 · 按專案</SectionTitle>
          <HBars data={projBars} />
        </Card>
      </div>

      <Card padded>
        <SectionTitle icon={CalendarDays}>完成熱力圖（近 17 週）</SectionTitle>
        <CompletionHeatmap cells={heat} />
      </Card>
    </div>
  )
}

// ============================================================
//  批量操作條
// ============================================================
function BulkBar({
  count,
  projects,
  onComplete,
  onDue,
  onPriority,
  onProject,
  onDelete,
  onCancel,
}: {
  count: number
  projects: Project[]
  onComplete: () => void
  onDue: (days: number) => void
  onPriority: (p: Priority) => void
  onProject: (projectId: string | undefined) => void
  onDelete: () => void
  onCancel: () => void
}) {
  return (
    <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-accent/30 bg-accent-soft px-3 py-2 shadow-sm dark:border-accent/40 dark:bg-accent/15">
      <span className="text-sm font-medium text-accent-strong dark:text-accent">
        已選 <span className="tabular-nums">{count}</span> 項
      </span>
      <div className="h-4 w-px bg-accent/30" />
      <Button size="sm" variant="secondary" icon={Check} onClick={onComplete} disabled={count === 0}>
        完成
      </Button>
      <Menu
        align="start"
        trigger={
          <span className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
            <CalendarDays size={13} /> 到期
          </span>
        }
        items={[
          { id: 'd0', label: '今日', icon: Sun, onSelect: () => onDue(0) },
          { id: 'd1', label: '聽日', icon: CalendarDays, onSelect: () => onDue(1) },
          { id: 'd7', label: '一週後', icon: CalendarDays, onSelect: () => onDue(7) },
        ]}
      />
      <Menu
        align="start"
        trigger={
          <span className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
            <Flag size={13} /> 優先級
          </span>
        }
        items={([1, 2, 3, 4] as Priority[]).map((p) => ({
          id: `p${p}`,
          label: `${PRIORITY_META[p].short} · ${PRIORITY_META[p].label}`,
          icon: Flag,
          onSelect: () => onPriority(p),
        }))}
      />
      <Menu
        align="start"
        trigger={
          <span className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
            <InboxIcon size={13} /> 移到
          </span>
        }
        items={[
          { id: 'inbox', label: '收件匣', icon: InboxIcon, onSelect: () => onProject(undefined) },
          ...projects.map((p) => ({
            id: p.id,
            label: `${p.emoji ? p.emoji + ' ' : ''}${p.name}`,
            onSelect: () => onProject(p.id),
          })),
        ]}
      />
      <Button size="sm" variant="ghost" icon={Trash2} onClick={onDelete} disabled={count === 0} className="text-rose-500 hover:text-rose-600">
        刪除
      </Button>
      <div className="ml-auto">
        <IconButton label="取消批量" onClick={onCancel}>
          <X size={16} />
        </IconButton>
      </div>
    </div>
  )
}

// ============================================================
//  專案管理
// ============================================================
function ProjectManager({
  projects,
  onClose,
}: {
  projects: Project[]
  onClose: () => void
}) {
  const toast = useToast()
  const confirm = useConfirm()
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('')
  const [color, setColor] = useState(PROJ_COLORS[0])

  const ordered = [...projects].sort((a, b) => a.order - b.order)

  const add = () => {
    const n = name.trim()
    if (!n) return
    const maxOrder = projects.reduce((m, p) => Math.max(m, p.order), -1)
    projectsCol.add({
      name: n,
      emoji: emoji.trim() || undefined,
      color,
      order: maxOrder + 1,
      createdAt: new Date().toISOString(),
    })
    setName('')
    setEmoji('')
    toast.success('已新增專案')
  }

  const removeProject = async (p: Project) => {
    // 該專案下任務數（讀 taskMetaCol，唔改 tasksCol）
    const cnt = taskMetaCol.get().filter((m) => m.projectId === p.id).length
    const ok = await confirm({
      title: `刪除專案「${p.name}」？`,
      message:
        cnt > 0
          ? `專案內 ${cnt} 項任務唔會被刪，會移返去收件匣。`
          : '呢個動作無法復原。',
      confirmText: '刪除',
      tone: 'danger',
    })
    if (!ok) return
    // 任務移返收件匣（清 projectId）
    for (const m of taskMetaCol.get().filter((m) => m.projectId === p.id)) {
      upsertMeta(m.id, { projectId: undefined })
    }
    projectsCol.remove(p.id)
    toast.success('已刪除專案')
  }

  return (
    <Modal open onClose={onClose} title="管理專案" size="md">
      <div className="space-y-4">
        <div className="space-y-2">
          {ordered.length === 0 && (
            <p className="rounded-lg bg-slate-50 px-3 py-4 text-center text-sm text-slate-400 dark:bg-slate-800/60 dark:text-slate-500">
              仲未有專案，喺下面加一個。
            </p>
          )}
          {ordered.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700"
            >
              <span className={cx('h-3 w-3 rounded-full', projColorCls(p.color).dot)} />
              <span className="text-base leading-none">{p.emoji}</span>
              <span className="flex-1 truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                {p.name}
              </span>
              <span className="tabular-nums text-xs text-slate-400">
                {taskMetaCol.get().filter((m) => m.projectId === p.id).length}
              </span>
              <IconButton label="刪除專案" size="sm" tone="danger" onClick={() => removeProject(p)}>
                <Trash2 size={14} />
              </IconButton>
            </div>
          ))}
        </div>

        <div className="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
          <div className="grid grid-cols-[auto_1fr] gap-2">
            <Field label="圖示">
              <Input
                value={emoji}
                onChange={(e) => setEmoji(e.target.value.slice(0, 2))}
                placeholder="📚"
                className="w-16 text-center"
              />
            </Field>
            <Field label="名稱">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && add()}
                placeholder="例如：考試準備"
              />
            </Field>
          </div>
          <Field label="顏色">
            <div className="flex flex-wrap gap-2">
              {PROJ_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={c}
                  className={cx(
                    'h-7 w-7 rounded-full ring-2 ring-offset-2 ring-offset-white transition dark:ring-offset-slate-800',
                    projColorCls(c).dot,
                    color === c ? 'ring-slate-400 dark:ring-slate-300' : 'ring-transparent',
                  )}
                />
              ))}
            </div>
          </Field>
          <Button onClick={add} icon={Plus} disabled={!name.trim()} fullWidth>
            新增專案
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ============================================================
//  範本選擇器（一鍵展開成一組任務）
// ============================================================
function TemplatePicker({
  templates,
  onClose,
  onApply,
}: {
  templates: TaskTemplate[]
  onClose: () => void
  onApply: (createdCount: number) => void
}) {
  const apply = (tmplId: string) => {
    const tmpl = templatesCol.get().find((t) => t.id === tmplId)
    if (!tmpl) return
    let created = 0
    const baseOrder = taskMetaCol.get().reduce((m, x) => Math.min(m, x.order), 0)
    tmpl.items.forEach((item, i) => {
      const task = tasksCol.add({
        text: item.text,
        done: false,
        createdAt: new Date().toISOString(),
      })
      upsertMeta(task.id, {
        priority: item.priority ?? 4,
        due: item.dueOffset !== undefined ? offsetFromToday(item.dueOffset) : undefined,
        order: baseOrder - (tmpl.items.length - i),
      })
      item.subtasks?.forEach((sub, si) => {
        subtasksCol.add({ taskId: task.id, text: sub, done: false, order: si })
      })
      created++
    })
    onApply(created)
  }

  return (
    <Modal open onClose={onClose} title="由範本快速建立" size="md">
      <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
        揀一個範本，一鍵建立一組相關任務（含優先級、相對到期、子任務）。
      </p>
      <div className="space-y-2">
        {templates.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => apply(t.id)}
            className="flex w-full items-center gap-3 rounded-xl border border-slate-200 p-3 text-left transition hover:-translate-y-0.5 hover:border-accent hover:shadow-md dark:border-slate-700 dark:hover:border-accent/60"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-xl dark:bg-accent/15">
              {t.emoji ?? '📋'}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {t.name}
              </p>
              <p className="truncate text-xs text-slate-400 dark:text-slate-500">
                {t.items.length} 項 · {t.items.map((i) => i.text).join(' · ')}
              </p>
            </div>
            <Plus size={16} className="shrink-0 text-accent" />
          </button>
        ))}
      </div>
    </Modal>
  )
}
