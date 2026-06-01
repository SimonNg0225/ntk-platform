import { useMemo, useState } from 'react'
import {
  Plus,
  Target,
  TrendingUp,
  Trophy,
  Flame,
  Search,
  LayoutGrid,
  List,
  PieChart,
  CalendarClock,
  Flag,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react'
import { useCollection, uid } from '../../lib/store'
import { goalsCol } from '../../data/collections'
import type { Goal } from '../../data/types'
import {
  Button,
  Input,
  Card,
  Badge,
  ProgressBar,
  StatCard,
  EmptyState,
  Pills,
  Select,
  SectionTitle,
  Tabs,
  cx,
} from '../../ui'
import { useToast } from '../../context/ToastContext'
import {
  goalMetaCol,
  milestonesCol,
  goalCheckinsCol,
  type GoalCategory,
  type GoalMeta,
  type Milestone,
} from './goals/types'
import {
  CATEGORIES,
  catMeta,
  statusMeta,
  priorityMeta,
  priorityRank,
  computeProgress,
  dueLabel,
  daysUntil,
  momentumGain,
  matchesStatusFilter,
  STATUS_FILTERS,
  type StatusFilter,
} from './goals/util'
import { StatusDonut, CategoryBars, ProgressRing } from './goals/Charts'
import GoalEditor, { type EditorSeed } from './goals/GoalEditor'
import GoalDetail from './goals/GoalDetail'

type ViewId = 'board' | 'list' | 'insights'
type SortId = 'recent' | 'progress' | 'due' | 'priority' | 'momentum' | 'name'
type CatFilter = GoalCategory | 'all'

// 一個目標 + 佢嘅元資料 + 里程碑（運算用）
interface EnrichedGoal {
  goal: Goal
  meta?: GoalMeta
  milestones: Milestone[]
  progress: number
  status: GoalMeta['status']
  /** 近 14 日淨推進（動量排序用；由簽到歷史計） */
  momentum: number
}

export default function GoalsWidget() {
  const goals = useCollection(goalsCol)
  const metas = useCollection(goalMetaCol)
  const allMilestones = useCollection(milestonesCol)
  const checkins = useCollection(goalCheckinsCol)
  const toast = useToast()

  const [view, setView] = useState<ViewId>('board')
  const [query, setQuery] = useState('')
  const [catFilter, setCatFilter] = useState<CatFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sort, setSort] = useState<SortId>('recent')
  const [quick, setQuick] = useState('')

  const [editor, setEditor] = useState<{ open: boolean; seed: EditorSeed }>({ open: false, seed: {} })
  const [detailId, setDetailId] = useState<string | null>(null)

  // ───────── enrich ─────────
  const metaById = useMemo(() => new Map(metas.map((m) => [m.id, m])), [metas])
  const msByGoal = useMemo(() => {
    const map = new Map<string, Milestone[]>()
    for (const m of allMilestones) {
      const arr = map.get(m.goalId)
      if (arr) arr.push(m)
      else map.set(m.goalId, [m])
    }
    for (const arr of map.values()) arr.sort((a, b) => a.order - b.order)
    return map
  }, [allMilestones])

  // 每個目標嘅簽到（按時間遞增排好，畀 momentumGain 用）
  const checkinsByGoal = useMemo(() => {
    const map = new Map<string, typeof checkins>()
    for (const c of checkins) {
      const arr = map.get(c.goalId)
      if (arr) arr.push(c)
      else map.set(c.goalId, [c])
    }
    for (const arr of map.values()) arr.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
    return map
  }, [checkins])

  const enriched: EnrichedGoal[] = useMemo(
    () =>
      goals.map((goal) => {
        const meta = metaById.get(goal.id)
        const milestones = msByGoal.get(goal.id) ?? []
        const progress = computeProgress(milestones, goal.progress)
        const status: GoalMeta['status'] = meta?.status ?? (progress >= 100 ? 'done' : 'active')
        const momentum = momentumGain(checkinsByGoal.get(goal.id) ?? [], progress, 14)
        return { goal, meta, milestones, progress, status, momentum }
      }),
    [goals, metaById, msByGoal, checkinsByGoal],
  )

  // ───────── 統計 ─────────
  const stats = useMemo(() => {
    const total = enriched.length
    const done = enriched.filter((e) => e.status === 'done').length
    const active = enriched.filter((e) => e.status === 'active').length
    const paused = enriched.filter((e) => e.status === 'paused').length
    const avg = total ? Math.round(enriched.reduce((s, e) => s + e.progress, 0) / total) : 0
    // 近 7 日有簽到嘅日數（動量）— 用本地日曆日做 key（避免 UTC slice 喺 UTC+8 落錯日）
    const recent = new Set<string>()
    const cut = Date.now() - 7 * 864e5
    for (const c of checkins) {
      const d = new Date(c.createdAt)
      if (d.getTime() >= cut)
        recent.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
    }
    // 即將到期（7 日內、未完成）
    const dueSoon = enriched.filter((e) => {
      if (e.status === 'done') return false
      const d = daysUntil(e.meta?.targetDate)
      return d !== undefined && d >= 0 && d <= 7
    }).length
    const overdue = enriched.filter((e) => {
      if (e.status === 'done') return false
      const d = daysUntil(e.meta?.targetDate)
      return d !== undefined && d < 0
    }).length
    return { total, done, active, paused, avg, checkinDays: recent.size, dueSoon, overdue }
  }, [enriched, checkins])

  // ───────── 篩選 + 排序 ─────────
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = enriched.filter((e) => {
      if (catFilter !== 'all' && (e.meta?.category ?? 'study') !== catFilter) return false
      if (!matchesStatusFilter({ status: e.status, targetDate: e.meta?.targetDate }, statusFilter)) return false
      if (q && !e.goal.title.toLowerCase().includes(q) && !(e.meta?.notes ?? '').toLowerCase().includes(q)) return false
      return true
    })
    list = [...list].sort((a, b) => {
      switch (sort) {
        case 'progress':
          return b.progress - a.progress
        case 'name':
          return a.goal.title.localeCompare(b.goal.title, 'zh-HK')
        case 'priority':
          return priorityRank(b.meta?.priority) - priorityRank(a.meta?.priority)
        case 'momentum':
          // 近 14 日推進多者排先；打和回退「最新建立」保穩定次序
          if (b.momentum !== a.momentum) return b.momentum - a.momentum
          return a.goal.createdAt < b.goal.createdAt ? 1 : -1
        case 'due': {
          const da = daysUntil(a.meta?.targetDate)
          const db = daysUntil(b.meta?.targetDate)
          if (da === undefined && db === undefined) return 0
          if (da === undefined) return 1
          if (db === undefined) return -1
          return da - db
        }
        default:
          return a.goal.createdAt < b.goal.createdAt ? 1 : -1
      }
    })
    return list
  }, [enriched, query, catFilter, statusFilter, sort])

  // 分類計數（畀 Pills 顯示）
  const catCounts = useMemo(() => {
    const counts: Partial<Record<CatFilter, number>> = { all: enriched.length }
    for (const e of enriched) {
      const c = (e.meta?.category ?? 'study') as GoalCategory
      counts[c] = (counts[c] ?? 0) + 1
    }
    return counts
  }, [enriched])

  // 狀態 + 到期視窗計數（每個 pill 各自跑 matchesStatusFilter，定義一致唔走樣）
  const statusCounts = useMemo(() => {
    const counts: Partial<Record<StatusFilter, number>> = {}
    for (const f of STATUS_FILTERS) {
      counts[f.id] = enriched.filter((e) =>
        matchesStatusFilter({ status: e.status, targetDate: e.meta?.targetDate }, f.id),
      ).length
    }
    return counts
  }, [enriched])

  // insights 用
  const donutSegments = useMemo(
    () => [
      { id: 'active', label: '進行中', value: stats.active },
      { id: 'paused', label: '暫停', value: stats.paused },
      { id: 'done', label: '已完成', value: stats.done },
    ],
    [stats],
  )
  const categoryRows = useMemo(() => {
    return CATEGORIES.map((c) => {
      const items = enriched.filter((e) => (e.meta?.category ?? 'study') === c.id)
      const avg = items.length ? Math.round(items.reduce((s, e) => s + e.progress, 0) / items.length) : 0
      return { id: c.id, label: c.label, dot: c.dot, count: items.length, avg }
    }).filter((r) => r.count > 0)
  }, [enriched])

  // ───────── actions ─────────
  function quickAdd() {
    const title = quick.trim()
    if (!title) return
    const id = uid()
    goalsCol.add({ id, title, progress: 0, createdAt: new Date().toISOString() })
    goalMetaCol.add({ id, category: catFilter === 'all' ? 'study' : catFilter, priority: 'medium', status: 'active' })
    setQuick('')
    toast.success('已新增目標')
  }

  function openNew() {
    setEditor({ open: true, seed: {} })
  }
  function openEdit(goalId: string) {
    setDetailId(null)
    setEditor({ open: true, seed: { goalId } })
  }

  const isFiltering = query.trim() !== '' || catFilter !== 'all' || statusFilter !== 'all'

  return (
    <div className="space-y-5">
      {/* 頂部統計 */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="目標總數"
          value={stats.total}
          unit="個"
          icon={Target}
          highlight
          hint={stats.active > 0 ? `${stats.active} 個進行中` : undefined}
        />
        <StatCard label="平均進度" value={stats.avg} unit="%" icon={TrendingUp} />
        <StatCard
          label="已達成"
          value={stats.done}
          unit="個"
          icon={Trophy}
          hint={stats.total ? `達成率 ${Math.round((stats.done / stats.total) * 100)}%` : undefined}
        />
        <StatCard
          label="本週簽到"
          value={stats.checkinDays}
          unit="日"
          icon={Flame}
          hint={stats.overdue > 0 ? `${stats.overdue} 個逾期` : stats.dueSoon > 0 ? `${stats.dueSoon} 個快到期` : undefined}
        />
      </div>

      {/* 快速新增 + 完整新增 */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-2 dark:border-slate-700/60 dark:bg-slate-800/40">
        <Input
          value={quick}
          onChange={(e) => setQuick(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && quickAdd()}
          placeholder="今個禮拜想達成啲咩？打低個目標…"
          icon={Target}
          className="min-w-[12rem] flex-1 border-transparent bg-white shadow-none dark:bg-slate-900/40"
        />
        <Button onClick={quickAdd} icon={Plus} variant="secondary" className="shrink-0">
          快速加
        </Button>
        <Button onClick={openNew} icon={Plus} className="hidden shrink-0 sm:inline-flex">
          詳細新增
        </Button>
      </div>

      {/* 視圖切換 */}
      <Tabs<ViewId>
        tabs={[
          { id: 'board', label: '看板' },
          { id: 'list', label: '清單' },
          { id: 'insights', label: '統計' },
        ]}
        active={view}
        onChange={setView}
        icons={{ board: LayoutGrid, list: List, insights: PieChart }}
      />

      {/* 篩選列（board / list 共用）*/}
      {view !== 'insights' && (
        <div className="space-y-3">
          <Pills<CatFilter>
            options={[{ id: 'all', label: '全部' }, ...CATEGORIES.map((c) => ({ id: c.id, label: c.label }))]}
            active={catFilter}
            onChange={setCatFilter}
            size="sm"
            counts={catCounts}
          />
          <Pills<StatusFilter>
            options={STATUS_FILTERS}
            active={statusFilter}
            onChange={setStatusFilter}
            size="sm"
            counts={statusCounts}
          />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜尋目標、備註…"
              icon={Search}
              className="flex-1"
            />
            <Select value={sort} onChange={(e) => setSort(e.target.value as SortId)} className="sm:w-44">
              <option value="recent">最新建立</option>
              <option value="progress">進度（高→低）</option>
              <option value="momentum">動量（近 14 日）</option>
              <option value="due">截止日（近→遠）</option>
              <option value="priority">優先程度</option>
              <option value="name">名稱</option>
            </Select>
          </div>
        </div>
      )}

      {/* 動態結果數（畀螢幕閱讀器播報；篩選時生效）*/}
      {view !== 'insights' && isFiltering && enriched.length > 0 && (
        <p className="sr-only" role="status" aria-live="polite">
          搵到 {filtered.length} 個符合嘅目標
        </p>
      )}

      {/* ───────── 內容 ───────── */}
      {enriched.length === 0 ? (
        <EmptyState
          icon={Target}
          art="empty-goals"
          title="仲未有個人目標"
          hint="設定一個目標，拆成里程碑，逐步追蹤進度同動量。"
          action={
            <Button onClick={openNew} icon={Plus}>
              建立第一個目標
            </Button>
          }
        />
      ) : view === 'insights' ? (
        <InsightsView donutSegments={donutSegments} total={stats.total} categoryRows={categoryRows} avg={stats.avg} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Search} title="搵唔到符合嘅目標" hint="試吓換個分類或清除搜尋。" />
      ) : view === 'board' ? (
        <BoardView items={filtered} onOpen={setDetailId} grouped={!isFiltering} />
      ) : (
        <ListView items={filtered} onOpen={setDetailId} />
      )}

      {/* Modals */}
      <GoalEditor
        open={editor.open}
        seed={editor.seed}
        onClose={() => setEditor({ open: false, seed: {} })}
        onSaved={(msg) => toast.success(msg)}
      />
      {detailId && <GoalDetail goalId={detailId} onClose={() => setDetailId(null)} onEdit={openEdit} />}
    </div>
  )
}

// ============================================================
//  看板視圖（按狀態分欄；篩選時退為單一網格）
// ============================================================
function BoardView({
  items,
  onOpen,
  grouped,
}: {
  items: EnrichedGoal[]
  onOpen: (id: string) => void
  grouped: boolean
}) {
  if (!grouped) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {items.map((e) => (
          <GoalCard key={e.goal.id} e={e} onOpen={onOpen} />
        ))}
      </div>
    )
  }
  const columns: { id: GoalMeta['status']; label: string; empty: string }[] = [
    { id: 'active', label: '進行中', empty: '未有進行中嘅目標' },
    { id: 'paused', label: '暫停', empty: '冇暫停嘅目標' },
    { id: 'done', label: '已完成', empty: '仲未達成任何目標' },
  ]
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {columns.map((col) => {
        const colItems = items.filter((e) => e.status === col.id)
        const st = statusMeta(col.id)
        return (
          <div key={col.id} className="space-y-2.5">
            <div className="flex items-center gap-2 px-1">
              <Badge tone={st.tone as 'accent'} dot>
                {col.label}
              </Badge>
              <span className="text-xs font-medium tabular-nums text-slate-400">{colItems.length}</span>
            </div>
            {colItems.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-200/80 bg-slate-50/40 px-3 py-7 text-center text-xs text-slate-400 dark:border-slate-700/60 dark:bg-slate-800/30 dark:text-slate-500">
                {col.empty}
              </div>
            ) : (
              colItems.map((e) => <GoalCard key={e.goal.id} e={e} onOpen={onOpen} />)
            )}
          </div>
        )
      })}
    </div>
  )
}

// ============================================================
//  清單視圖（密集列；快速掃描）
// ============================================================
function ListView({ items, onOpen }: { items: EnrichedGoal[]; onOpen: (id: string) => void }) {
  return (
    <ul className="space-y-2">
      {items.map((e) => {
        const cat = catMeta(e.meta?.category)
        const due = dueLabel(e.meta?.targetDate)
        const doneMs = e.milestones.filter((m) => m.done).length
        const CatIcon = cat.icon
        const isDone = e.status === 'done'
        return (
          <li key={e.goal.id}>
            <button
              type="button"
              onClick={() => onOpen(e.goal.id)}
              className="group flex w-full items-center gap-3.5 rounded-2xl border border-slate-200/80 bg-white p-3 text-left shadow-xs transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:border-slate-700/60 dark:bg-slate-800 dark:shadow-none dark:hover:border-slate-600"
            >
              <ProgressRing value={e.progress} size={40} stroke={5} tone={isDone ? 'green' : 'accent'} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className={cx('inline-flex h-5 w-5 shrink-0 items-center justify-center', cat.text)}>
                    <CatIcon size={14} />
                  </span>
                  <span className={cx(
                    'truncate text-sm font-medium',
                    isDone ? 'text-slate-400' : 'text-slate-800 dark:text-slate-100',
                  )}>
                    {e.goal.title}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                  {e.milestones.length > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <Flag size={11} className="text-slate-400" />
                      <span className="tabular-nums">
                        {doneMs}/{e.milestones.length}
                      </span>
                    </span>
                  )}
                  {due && (
                    <span className={cx('inline-flex items-center gap-1', due.tone === 'rose' ? 'font-medium text-rose-500' : due.tone === 'amber' && 'text-amber-600 dark:text-amber-400')}>
                      <CalendarClock size={11} />
                      {due.text}
                    </span>
                  )}
                </div>
              </div>
              <span className={cx('shrink-0 text-sm font-bold tabular-nums', isDone ? 'text-emerald-500' : 'text-accent')}>{e.progress}%</span>
              <ChevronRight size={16} className="shrink-0 text-slate-300 transition-transform duration-200 group-hover:translate-x-0.5 dark:text-slate-600" />
            </button>
          </li>
        )
      })}
    </ul>
  )
}

// ============================================================
//  目標卡（看板用）
// ============================================================
function GoalCard({ e, onOpen }: { e: EnrichedGoal; onOpen: (id: string) => void }) {
  const cat = catMeta(e.meta?.category)
  const pr = priorityMeta(e.meta?.priority)
  const due = dueLabel(e.meta?.targetDate)
  const doneMs = e.milestones.filter((m) => m.done).length
  const CatIcon = cat.icon
  const isDone = e.status === 'done'
  return (
    <button
      type="button"
      onClick={() => onOpen(e.goal.id)}
      className="group flex w-full flex-col rounded-3xl border border-slate-200/80 bg-white p-4 text-left shadow-xs transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:border-slate-700/60 dark:bg-slate-800 dark:shadow-none dark:hover:border-slate-600"
    >
      <div className="flex items-start gap-2.5">
        <span className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ring-1 ring-inset transition duration-200 group-hover:scale-105', cat.ring, cat.text)}>
          <CatIcon size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <p className={cx(
            'truncate text-sm font-semibold leading-snug',
            isDone ? 'text-slate-400' : 'text-slate-800 dark:text-slate-100',
          )}>
            {e.goal.title}
          </p>
          <p className="mt-0.5 truncate text-xs text-slate-400 dark:text-slate-500">{cat.label}</p>
        </div>
        {isDone ? (
          <CheckCircle2 size={18} className="shrink-0 text-emerald-500" />
        ) : (
          e.meta?.priority === 'high' && <Flag size={15} className="mt-0.5 shrink-0 text-rose-500" />
        )}
      </div>

      <div className="mt-3.5 flex items-center gap-2.5">
        <ProgressBar value={e.progress} tone={isDone ? 'green' : 'accent'} className="flex-1" />
        <span className={cx('shrink-0 text-sm font-bold tabular-nums', isDone ? 'text-emerald-500' : 'text-accent')}>{e.progress}%</span>
      </div>

      {(e.milestones.length > 0 || due || pr.id !== 'medium') && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {e.milestones.length > 0 && (
            <Badge tone={doneMs === e.milestones.length ? 'green' : 'slate'} icon={Flag}>
              <span className="tabular-nums">
                {doneMs}/{e.milestones.length}
              </span>
            </Badge>
          )}
          {due && (
            <Badge tone={due.tone as 'amber'} icon={CalendarClock} dot={due.tone === 'rose'}>
              {due.text}
            </Badge>
          )}
          {pr.id !== 'medium' && (
            <Badge tone={pr.tone === 'slate' ? 'slate' : (pr.tone as 'rose')}>{pr.label}優先</Badge>
          )}
        </div>
      )}
    </button>
  )
}

// ============================================================
//  統計視圖（自製圖表）
// ============================================================
function InsightsView({
  donutSegments,
  total,
  categoryRows,
  avg,
}: {
  donutSegments: { id: string; label: string; value: number }[]
  total: number
  categoryRows: { id: string; label: string; dot: string; count: number; avg: number }[]
  avg: number
}) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card className="p-4 sm:p-5">
        <SectionTitle icon={PieChart}>狀態分佈</SectionTitle>
        <div className="flex justify-center py-2">
          <StatusDonut segments={donutSegments} total={total} />
        </div>
      </Card>

      <Card className="p-4 sm:p-5">
        <SectionTitle icon={TrendingUp}>各分類平均進度</SectionTitle>
        <p className="mb-3 text-xs text-slate-400">整體平均 <span className="font-semibold tabular-nums text-accent">{avg}%</span></p>
        <CategoryBars rows={categoryRows} />
      </Card>
    </div>
  )
}
