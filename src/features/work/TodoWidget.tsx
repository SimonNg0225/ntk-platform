import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  BarChart3,
  CalendarDays,
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  ClipboardCheck,
  Flag,
  FolderPlus,
  Highlighter,
  Inbox as InboxIcon,
  LayoutList,
  ListChecks,
  ListTodo,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Sun,
  Tag,
  Trash2,
  X,
  type LucideIcon,
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
  groupByDue,
  localDay,
  offsetFromToday,
  parseQuickAdd,
  projColorCls,
  smartSort,
  todayISO,
} from './todo/util'

// ============================================================
//  待辦 / 批改 — 老師嘅「改簿檯」任務清單
//  ------------------------------------------------------------
//  訂造概念：checklist + 批改紅筆。成頁似一本攤開嘅改簿——
//  勾選格 = 老師喺簿上打剔；屬「批改」嘅任務披上紅筆 accent
//  （紅邊欄線 + 紅「批」筆章），同其餘待辦一眼分得開。
//  模式主色（青藍 teal）做頁面身份；紅筆只係批改任務嘅 accent。
//
//  邏輯完全沿用 Things / Todoist 級實作：共用 tasksCol（Task）做
//  真相來源；優先級 / 到期 / 專案 / 標籤 / 備註 / 子任務存喺 feature
//  自己嘅 collection（見 todo/store.ts）。視圖：今日 · 之後 ·
//  所有（按專案）· 統計。Power：智能快速輸入、優先級、到期分組、
//  子任務、標籤、專案、搜尋、批量、範本、生產力圖表。
// ============================================================

// 「批改任務」純表現層偵測：由現有資料（標籤 / 任務文字）推斷，
// 唔改任何資料流。命中即披紅筆 accent（紅邊欄 + 紅「批」章）。
// 關鍵字覆蓋老師日常用語：批改 / 改卷 / 改簿 / 批卷 / 派卷 / marking。
const MARK_RE = /(批改|批卷|改卷|改簿|派卷|評卷|marking|mark\b)/i
function isMarkingTask(t: FullTask): boolean {
  if (t.meta.tags.some((tag) => MARK_RE.test(tag))) return true
  return MARK_RE.test(t.text)
}

type ViewId = 'today' | 'upcoming' | 'all' | 'stats'
type SortMode = 'smart' | 'priority' | 'due' | 'created'

const SORT_LABEL: Record<SortMode, string> = {
  smart: '智能',
  priority: '優先級',
  due: '到期',
  created: '建立',
}

// 清點格色調（hot 高亮：rose=要跟進 / accent=今日焦點 / emerald=做完）
type TallyTone = 'plain' | 'accent' | 'rose' | 'emerald'

// ───────── 改簿清點帶（hairline grid · serif 大數字）─────────
//  改簿檯概念：頁頂一條「清點帶」似老師埋班簿前嘅點算——逾期幾本、
//  今日要改幾本、未剔幾項、已剔幾項。可撳嗰格直接跳對應視圖。
function TallyStat({
  label,
  value,
  unit,
  hint,
  icon: Icon,
  tone = 'plain',
  hot,
  onClick,
}: {
  label: string
  value: number | string
  unit?: string
  hint?: string
  icon: LucideIcon
  tone?: TallyTone
  hot?: boolean
  onClick?: () => void
}) {
  // hot 底色 + 數字色（紅=逾期 / 青=今日焦點 / 綠=完成）
  const hotBg =
    tone === 'rose'
      ? 'bg-rose-50 dark:bg-rose-500/10'
      : tone === 'emerald'
        ? 'bg-emerald-50 dark:bg-emerald-500/10'
        : 'bg-accent-soft dark:bg-accent/12'
  const hotLabel =
    tone === 'rose'
      ? 'text-rose-600/80 dark:text-rose-400/80'
      : tone === 'emerald'
        ? 'text-emerald-600/80 dark:text-emerald-400/80'
        : 'text-accent/80 dark:text-accent/80'
  const hotNum =
    tone === 'rose'
      ? 'text-rose-600 dark:text-rose-400'
      : tone === 'emerald'
        ? 'text-emerald-600 dark:text-emerald-400'
        : 'text-accent-strong dark:text-accent'
  const interactive = !!onClick
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!interactive}
      aria-label={interactive ? `${label}：${value}${unit ?? ''}` : undefined}
      className={cx(
        'group/tally px-3.5 py-3.5 text-left transition-colors sm:px-4',
        hot ? hotBg : 'bg-white dark:bg-slate-800',
        interactive
          ? 'cursor-pointer hover:bg-slate-50 focus-visible:relative focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40 dark:hover:bg-slate-700/60'
          : 'cursor-default',
        hot && interactive && 'hover:brightness-[0.98]',
      )}
    >
      <span
        className={cx(
          'flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide',
          hot ? hotLabel : 'text-slate-400 dark:text-slate-500',
        )}
      >
        <Icon size={12} className="shrink-0" />
        <span className="truncate">{label}</span>
      </span>
      <span
        className={cx(
          'mt-1 block text-[26px] font-semibold leading-none tabular-nums slashed-zero',
          hot ? hotNum : 'text-slate-800 dark:text-slate-100',
        )}
      >
        {value}
        {unit && (
          <span className="ml-1 font-sans text-sm font-normal text-slate-400">{unit}</span>
        )}
      </span>
      {hint && (
        <span className="mt-1 block truncate text-[11px] text-slate-400 dark:text-slate-500">
          {hint}
        </span>
      )}
    </button>
  )
}

// ───────── 紅筆「批」章（批改任務專屬 accent）─────────
//  改簿檯概念：批改任務似老師喺簿邊用紅筆寫個「批」字。細牌、紅墨、
//  手寫感（serif）。純標示，唔搶剔格主次。
function MarkPen({ className }: { className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center gap-1 rounded-md border border-rose-300/70 bg-rose-50/80 px-1.5 py-0.5 text-[10px] font-semibold text-rose-600 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300',
        className,
      )}
    >
      <Highlighter size={10} className="opacity-80" />
      <span className="leading-none">批改</span>
    </span>
  )
}

// 快速輸入語法提示 chip
function SyntaxHint({ sym, label }: { sym: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <code className="rounded bg-slate-200/70 px-1 py-px font-mono text-[10px] font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
        {sym}
      </code>
      {label}
    </span>
  )
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
    let marking = 0 // 未完成嘅批改任務（紅筆 accent；masthead surfacing）
    for (const t of full) {
      if (t.done) {
        done++
        continue
      }
      active++
      if (isMarkingTask(t)) marking++
      const b = dueBucket(t.meta.due, today)
      if (b === 'overdue') overdue++
      else if (b === 'today') todayDue++
    }
    return { overdue, todayDue, active, done, marking, total: full.length }
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
      {/* ───────── 改簿檯 masthead：本頁自管標題（含功能名「待辦 / 批改」）───────── */}
      <header className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white px-5 py-5 shadow-xs dark:border-slate-700/60 dark:bg-slate-800 dark:shadow-none sm:px-7 sm:py-6">
        {/* 右側紅墨裝飾：似改簿時隨手剔嘅一筆（純裝飾，唔搶主次）*/}
        <span
          aria-hidden
          className="pointer-events-none absolute -right-5 top-4 hidden -rotate-6 select-none text-[3.5rem] font-bold leading-none text-rose-500/10 dark:text-rose-500/15 sm:block"
        >
          ✓
        </span>
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.3em] text-accent/70">
              <ClipboardCheck size={13} />
              改簿檯 · Marking Desk
            </p>
            <h1 className="mt-1.5 text-[28px] font-semibold leading-none tracking-tight text-slate-800 dark:text-slate-100 sm:text-[34px]">
              待辦 / 批改
            </h1>
            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
              <span className="tabular-nums">
                未剔 {counts.active} 項 · 今日到期 {counts.todayDue} 項
              </span>
              {counts.marking > 0 && (
                <>
                  <span aria-hidden className="text-slate-300 dark:text-slate-600">·</span>
                  <span className="inline-flex items-center gap-1 font-medium text-rose-600 dark:text-rose-400">
                    <Highlighter size={12} /> {counts.marking} 項待批改
                  </span>
                </>
              )}
            </p>
          </div>
          {/* 卷務操作：範本 + 更多（似改簿檯上嘅工具）*/}
          <div className="flex shrink-0 items-center gap-2">
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
                <span className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700/60 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-600">
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
        </div>
        {/* 改簿檯雙線（封面分隔感）*/}
        <div className="mt-5 space-y-1" aria-hidden>
          <span className="block h-px bg-slate-200/90 dark:bg-slate-700/70" />
          <span className="block h-px bg-slate-200/60 dark:bg-slate-700/40" />
        </div>
      </header>

      {/* ───────── 清點帶：hairline grid · serif 大數字（可撳跳視圖）───────── */}
      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-slate-200/70 ring-1 ring-slate-200/80 dark:bg-slate-700/50 dark:ring-slate-700/60 sm:grid-cols-4">
        <TallyStat
          label="逾期"
          value={counts.overdue}
          unit="項"
          icon={Flag}
          tone="rose"
          hot={counts.overdue > 0}
          hint={counts.overdue > 0 ? '需要跟進' : '一切如常'}
          onClick={() => {
            setView('upcoming')
            setSearch('')
          }}
        />
        <TallyStat
          label="今日到期"
          value={counts.todayDue}
          unit="項"
          icon={Sun}
          tone="accent"
          hot={counts.todayDue > 0}
          hint={counts.todayDue > 0 ? '今日搞掂佢' : '今日好輕鬆'}
          onClick={() => setView('today')}
        />
        <TallyStat
          label="未剔"
          value={counts.active}
          unit="項"
          icon={ListTodo}
          hint={counts.marking > 0 ? `含 ${counts.marking} 項批改` : '清單仲有嘢做'}
          onClick={() => setView('all')}
        />
        <TallyStat
          label="已剔"
          value={counts.done}
          unit="項"
          icon={CheckCheck}
          tone="emerald"
          hot={counts.done > 0 && counts.active === 0}
          hint="累計打剔"
        />
      </section>

      {/* ───────── 新一筆：似喺改簿邊用紅筆寫低待辦（accent focus 環）───────── */}
      <div className="space-y-2 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-3 transition focus-within:border-accent/40 focus-within:bg-white dark:border-slate-700/60 dark:bg-slate-800/40 dark:focus-within:bg-slate-800">
        <div className="flex gap-2">
          <Input
            id={QUICK_INPUT_ID}
            icon={Plus}
            value={quick}
            onChange={(e) => setQuick(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addQuick()}
            placeholder="記低一筆… 試吓「批改 5A 練習 !! #教學 @批改 +2」"
            className="flex-1 border-transparent bg-white shadow-none dark:bg-slate-900/40"
          />
          <Button onClick={addQuick} icon={Plus}>
            記低
          </Button>
        </div>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 px-1 text-[11px] text-slate-400 dark:text-slate-500">
          <SyntaxHint sym="!" label="優先級" />
          <SyntaxHint sym="#" label="專案" />
          <SyntaxHint sym="@" label="標籤" />
          <SyntaxHint sym="今日 / 聽日 / +N" label="到期" />
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

      {/* 搜尋結果計數（螢幕閱讀器即時播報）*/}
      {view !== 'stats' && search.trim() && (
        <p className="sr-only" role="status" aria-live="polite">
          搜尋「{search.trim()}」找到 {filtered.length} 項
        </p>
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
              aria-pressed={activeTag === t}
              aria-label={`標籤篩選 ${t}`}
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
  // 到期 chip 色調（逾期 rose / 今日 amber / 其餘柔和）
  const dueChip =
    diff !== null && diff < 0
      ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300'
      : diff === 0
        ? 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300'
        : 'bg-slate-100 text-slate-500 dark:bg-slate-700/50 dark:text-slate-400'
  const subDone = task.subtasks.filter((s) => s.done).length
  const hot = task.meta.priority <= 2 && !task.done
  // 批改任務：披紅筆 accent（紅邊欄 + 紅「批」章 + 紅墨剔格）
  const marking = isMarkingTask(task)

  return (
    <div
      className={cx(
        'group relative flex items-start gap-3 py-2.5 pr-3 transition-colors',
        // 批改任務向左讓位畀紅邊欄（似改簿嘅紅 margin）
        marking ? 'pl-5 sm:pl-6' : 'pl-4 sm:pl-5',
        selected && 'bg-accent-soft/60 dark:bg-accent/10',
        marking && !selected && 'bg-rose-50/40 dark:bg-rose-500/[0.06]',
        !selecting && 'hover:bg-slate-50 dark:hover:bg-slate-800/50',
      )}
    >
      {/* 批改任務：紅筆雙邊欄（改簿 margin）。否則高優先級用柔和優先色條。*/}
      {marking ? (
        <span aria-hidden="true" className="absolute inset-y-0 left-2 flex gap-[3px] sm:left-2.5">
          <span className="w-[3px] rounded-full bg-rose-400 dark:bg-rose-500/70" />
          <span className="w-px rounded-full bg-rose-300/70 dark:bg-rose-500/40" />
        </span>
      ) : (
        hot && (
          <span
            aria-hidden="true"
            className={cx('absolute inset-y-1.5 left-0 w-1 rounded-full', pm.dot)}
          />
        )
      )}

      {selecting ? (
        <button
          type="button"
          onClick={() => onSelect(task.id)}
          aria-label={selected ? '取消選取' : '選取'}
          aria-pressed={selected}
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
          aria-label={task.done ? '標記未完成' : marking ? '打剔（已批改）' : '打剔（完成）'}
          className={cx(
            'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border-2 transition duration-200 active:scale-90',
            // 批改任務用方剔格（似簿上方格）；其餘用圓剔格
            marking ? 'rounded-md' : 'rounded-full',
            task.done
              ? 'border-emerald-500 bg-emerald-500 text-white shadow-sm shadow-emerald-500/30'
              : marking
                ? 'border-rose-300 text-rose-500 hover:border-rose-500 hover:bg-rose-50 dark:border-rose-500/50 dark:hover:bg-rose-500/10'
                : task.meta.priority <= 2
                  ? cx('hover:bg-slate-50 dark:hover:bg-slate-700', pm.flag.replace('text-', 'border-'))
                  : 'border-slate-300 hover:border-accent hover:bg-accent-soft/40 dark:border-slate-600',
          )}
        >
          {task.done ? (
            <Check size={12} strokeWidth={3} />
          ) : (
            // 批改任務未剔：淡淡紅剔做「等批」提示（hover 先明顯）
            marking && (
              <Check
                size={12}
                strokeWidth={3}
                className="opacity-0 transition-opacity group-hover:opacity-40"
              />
            )
          )}
        </button>
      )}

      <button
        type="button"
        onClick={() => (selecting ? onSelect(task.id) : onOpen(task.id))}
        className="min-w-0 flex-1 text-left"
      >
        <div className="flex items-center gap-1.5">
          {marking && <MarkPen />}
          {hot && !marking && <Flag size={12} className={cx('shrink-0', pm.flag)} />}
          <span
            className={cx(
              'truncate text-sm transition-colors',
              task.done
                ? 'text-slate-400 line-through dark:text-slate-500'
                : 'font-medium text-slate-800 dark:text-slate-100',
            )}
          >
            {task.text}
          </span>
        </div>
        {/* meta 行：到期 / 專案 / 子任務 / 標籤 —— 圓潤 tone chip */}
        {(due || project || task.subtasks.length > 0 || task.meta.tags.length > 0 || task.meta.note) && (
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
            {due && (
              <span className={cx('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium tabular-nums', dueChip)}>
                <CalendarDays size={11} />
                {dueLabel(due)}
              </span>
            )}
            {project && (
              <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 font-medium text-slate-500 dark:bg-slate-700/50 dark:text-slate-300">
                <span className={cx('h-1.5 w-1.5 rounded-full', projColorCls(project.color).dot)} />
                {project.name}
              </span>
            )}
            {task.subtasks.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 tabular-nums text-slate-500 dark:bg-slate-700/50 dark:text-slate-300">
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
        )}
      </button>

      {!selecting && (
        <div className="flex shrink-0 items-center gap-0.5 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
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

// 一組（改簿冊頁眉 + 任務冊）—— icon chip 標頭 + 計數 + 向右延伸 hairline；
// 卡片帶柔和 tone 左緣，似簿冊嘅分段。
function Group({
  title,
  tone = 'slate',
  count,
  icon: Icon,
  children,
}: {
  title: string
  tone?: 'slate' | 'rose' | 'amber' | 'accent'
  count: number
  icon?: LucideIcon
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
  const chipCls =
    tone === 'rose'
      ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300'
      : tone === 'amber'
        ? 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300'
        : tone === 'accent'
          ? 'bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent'
          : 'bg-slate-100 text-slate-500 dark:bg-slate-700/60 dark:text-slate-300'
  if (count === 0) return null
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-0.5">
        {Icon && (
          <span className={cx('flex h-6 w-6 shrink-0 items-center justify-center rounded-md', chipCls)}>
            <Icon size={14} />
          </span>
        )}
        <h3 className={cx('text-xs font-semibold uppercase tracking-wider', toneCls)}>
          {title}
        </h3>
        <span className="tabular-nums text-[11px] font-semibold text-slate-400 dark:text-slate-500">
          {count}
        </span>
        <span aria-hidden className="ml-1 h-px flex-1 bg-gradient-to-r from-slate-200 to-transparent dark:from-slate-700/70" />
      </div>
      <Card clip className="divide-y divide-slate-100 dark:divide-slate-700/60">
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

  // 共用分桶（未完成）→ 今日視圖只取逾期 + 今日。
  const grouped = groupByDue(tasks, today, { sorter })
  const overdue = grouped.overdue
  const todayList = grouped.today
  const doneToday = tasks
    .filter((t) => t.done && t.meta.completedAt && localDay(t.meta.completedAt) === today)
    .sort((a, b) => (a.meta.completedAt! < b.meta.completedAt! ? 1 : -1))

  const empty = overdue.length === 0 && todayList.length === 0 && doneToday.length === 0

  if (empty)
    return (
      <EmptyState
        icon={Sun}
        title="今日好清爽 ☀️"
        hint="冇逾期或今日到期嘅任務。喺上面快速輸入加一項，或者去「之後」睇將來嘅安排。"
      />
    )

  return (
    <div className="space-y-5">
      <Group title="逾期" tone="rose" icon={Flag} count={overdue.length}>
        {overdue.map((t) => (
          <TaskRow key={t.id} task={t} project={projOf(t)} {...rowProps(props, t.id)} />
        ))}
      </Group>
      <Group title="今日" tone="amber" icon={Sun} count={todayList.length}>
        {todayList.map((t) => (
          <TaskRow key={t.id} task={t} project={projOf(t)} {...rowProps(props, t.id)} />
        ))}
      </Group>
      <Group title="今日打剔" icon={CheckCheck} count={doneToday.length}>
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

  // 單次分桶（未完成）→ 每桶內按目前排序。
  const buckets = groupByDue(tasks, today, { sorter })
  const total =
    buckets.overdue.length +
    buckets.today.length +
    buckets.tomorrow.length +
    buckets.soon.length +
    buckets.later.length +
    buckets.none.length

  if (total === 0)
    return (
      <EmptyState
        icon={CalendarDays}
        title="日程一片空白"
        hint="所有任務都搞掂咗，或者試吓喺上面加一項。"
      />
    )

  return (
    <div className="space-y-5">
      <Group title="逾期" tone="rose" icon={Flag} count={buckets.overdue.length}>
        {buckets.overdue.map((t) => (
          <TaskRow key={t.id} task={t} project={projOf(t)} {...rowProps(props, t.id)} />
        ))}
      </Group>
      <Group title="今日" tone="amber" icon={Sun} count={buckets.today.length}>
        {buckets.today.map((t) => (
          <TaskRow key={t.id} task={t} project={projOf(t)} {...rowProps(props, t.id)} />
        ))}
      </Group>
      <Group title="聽日" tone="accent" icon={CalendarDays} count={buckets.tomorrow.length}>
        {buckets.tomorrow.map((t) => (
          <TaskRow key={t.id} task={t} project={projOf(t)} {...rowProps(props, t.id)} />
        ))}
      </Group>
      <Group title="未來 7 日" icon={CalendarDays} count={buckets.soon.length}>
        {buckets.soon.map((t) => (
          <TaskRow key={t.id} task={t} project={projOf(t)} {...rowProps(props, t.id)} />
        ))}
      </Group>
      <Group title="之後" icon={CalendarDays} count={buckets.later.length}>
        {buckets.later.map((t) => (
          <TaskRow key={t.id} task={t} project={projOf(t)} {...rowProps(props, t.id)} />
        ))}
      </Group>
      <Group title="無到期" icon={InboxIcon} count={buckets.none.length}>
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
      <div className="min-w-0 space-y-2">
        <div className="flex items-center gap-2 px-0.5">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500 dark:bg-slate-700/60 dark:text-slate-300">
            <ClipboardCheck size={14} />
          </span>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            任務冊
          </h3>
          <span className="tabular-nums text-[11px] font-semibold text-slate-400 dark:text-slate-500">
            {visible.length}
          </span>
          <span aria-hidden className="ml-1 h-px flex-1 bg-gradient-to-r from-slate-200 to-transparent dark:from-slate-700/70" />
          <button
            type="button"
            onClick={() => setShowDone(!showDone)}
            className="inline-flex shrink-0 items-center gap-1.5 text-[11px] font-medium text-slate-400 transition hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
          >
            <CheckCheck size={13} />
            {showDone ? '隱藏已剔' : `已剔 ${doneCount}`}
          </button>
        </div>
        {visible.length === 0 ? (
          <EmptyState
            icon={InboxIcon}
            title={activeProject === 'inbox' ? '收件匣空空如也' : '呢個專案仲未有任務'}
            hint="喺上面快速輸入加一項，或者揀返第個專案睇睇。"
          />
        ) : (
          <Card clip className="divide-y divide-slate-100 dark:divide-slate-700/60">
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
      aria-current={active ? 'true' : undefined}
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
      aria-current={active ? 'true' : undefined}
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
        title="統計仲係一張白紙"
        hint="加幾項待辦、逐一完成，呢度就會慢慢長出你嘅生產力走勢同熱力圖。"
      />
    )

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-slate-200/70 ring-1 ring-slate-200/80 dark:bg-slate-700/50 dark:ring-slate-700/60 sm:grid-cols-4">
        <TallyStat
          label="連續完成"
          value={streak}
          unit="日"
          icon={Sparkles}
          tone="accent"
          hot={streak > 0}
          hint={streak > 0 ? '繼續保持！' : '今日完成一項就開始'}
        />
        <TallyStat
          label="完成率"
          value={completionRate}
          unit="%"
          icon={CheckCircle2}
          tone="emerald"
          hot={completionRate >= 80}
          hint={`近 ${range} 日完成 ${completedInRange}`}
        />
        <TallyStat label="進行中" value={active.length} unit="項" icon={CircleDashed} />
        <TallyStat label="累計完成" value={completed.length} unit="項" icon={ListChecks} />
      </section>

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
        揀個常用流程，一鍵鋪好成組任務（含優先級、相對到期、子任務）—— 例如批改一份練習嘅完整步驟。
      </p>
      <div className="space-y-2">
        {templates.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => apply(t.id)}
            className="group flex w-full items-center gap-3 rounded-2xl border border-slate-200 p-3 text-left transition duration-200 hover:-translate-y-0.5 hover:border-accent hover:shadow-md dark:border-slate-700 dark:hover:border-accent/60"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-xl dark:bg-accent/15">
              {t.emoji ?? '📋'}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {t.name}
                </p>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-slate-500 dark:bg-slate-700/60 dark:text-slate-300">
                  <ListChecks size={10} />
                  {t.items.length} 項
                </span>
              </div>
              <p className="mt-0.5 truncate text-xs text-slate-400 dark:text-slate-500">
                {t.items.map((i) => i.text).join(' · ')}
              </p>
            </div>
            <Plus size={16} className="shrink-0 text-accent transition group-hover:translate-x-0.5" />
          </button>
        ))}
      </div>
    </Modal>
  )
}
