import { useMemo, useState } from 'react'
import {
  Plus,
  TrendingUp,
  Flag,
  Footprints,
  Mountain,
  MountainSnow,
  Search,
  LayoutGrid,
  List,
  PieChart,
  CalendarClock,
  ChevronRight,
  CheckCircle2,
  Tent,
} from 'lucide-react'
import { useCollection, uid } from '../../lib/store'
import { goalsCol } from '../../data/collections'
import type { Goal } from '../../data/types'
import {
  Button,
  Input,
  Card,
  Badge,
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
import { StatusDonut, CategoryBars, AscentMeter } from './goals/Charts'
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

// 登山語境：每個進度區間對應一句「攀升狀態」+ 海拔感詞彙
function altitudeLabel(progress: number, isDone: boolean): string {
  if (isDone) return '已登頂'
  if (progress >= 75) return '逼近山頂'
  if (progress >= 40) return '穩步上山'
  if (progress > 0) return '剛起步'
  return '喺山腳'
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
  const hasGoals = enriched.length > 0

  return (
    <div className="space-y-6">
      {/* ───────── 大本營：攀升主視覺（整體海拔 / 動量）───────── */}
      {hasGoals && (
        <BaseCamp
          avg={stats.avg}
          total={stats.total}
          done={stats.done}
          active={stats.active}
          dueSoon={stats.dueSoon}
          overdue={stats.overdue}
          checkinDays={stats.checkinDays}
          onNew={openNew}
        />
      )}

      {/* 快速新增：山腳起步 */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-2 dark:border-slate-700/60 dark:bg-slate-800/40">
        <Input
          value={quick}
          onChange={(e) => setQuick(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && quickAdd()}
          placeholder="想攻頂啲咩？寫低一個目標就出發…"
          icon={Footprints}
          className="min-w-[12rem] flex-1 border-transparent bg-white shadow-none dark:bg-slate-900/40"
        />
        <Button onClick={quickAdd} icon={Plus} variant="secondary" className="shrink-0">
          快速加
        </Button>
        <Button onClick={openNew} icon={Plus} className="hidden shrink-0 sm:inline-flex">
          細拆路線
        </Button>
      </div>

      {/* 視圖切換 */}
      <Tabs<ViewId>
        tabs={[
          { id: 'board', label: '路線圖' },
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
              placeholder="搵目標、備註…"
              icon={Search}
              className="flex-1"
            />
            <Select value={sort} onChange={(e) => setSort(e.target.value as SortId)} className="sm:w-44">
              <option value="recent">最新建立</option>
              <option value="progress">海拔（高→低）</option>
              <option value="momentum">攀升動量（近 14 日）</option>
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
          icon={MountainSnow}
          art="empty-goals"
          title="仲未有要攀嘅山"
          hint="揀一個想達成嘅目標當山頂，拆成幾個沿途里程碑，一步步行上去。"
          action={
            <Button onClick={openNew} icon={Plus}>
              立一個山頭
            </Button>
          }
        />
      ) : view === 'insights' ? (
        <InsightsView donutSegments={donutSegments} total={stats.total} categoryRows={categoryRows} avg={stats.avg} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Search} title="呢條路線冇目標" hint="試吓換個分類，或者清除搜尋。" />
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
//  大本營 Hero — 整體攀升概覽（海拔錶 + 沿途數字 + 等高線底紋）
// ============================================================
function BaseCamp({
  avg,
  total,
  done,
  active,
  dueSoon,
  overdue,
  checkinDays,
  onNew,
}: {
  avg: number
  total: number
  done: number
  active: number
  dueSoon: number
  overdue: number
  checkinDays: number
  onNew: () => void
}) {
  // 攀升提示：用整體海拔 + 逾期/快到期狀況講一句有溫度嘅話
  const summitLine =
    total > 0 && done === total
      ? '全部山頭都登頂喇，犀利！'
      : overdue > 0
        ? `有 ${overdue} 個目標蘇州過後，今日追返少少？`
        : dueSoon > 0
          ? `${dueSoon} 個山頭就到頂，加把勁衝刺。`
          : avg >= 75
            ? '大隊已逼近山頂，最後一段最關鍵。'
            : avg >= 40
              ? '穩步上山中，保持節奏。'
              : '啱啱由山腳出發，行多步得多步。'

  return (
    <section className="hero-gradient relative isolate overflow-hidden rounded-3xl p-5 text-white shadow-lg shadow-accent/25 sm:p-6">
      {/* 等高線 / 山稜底紋（純裝飾，pointer-events-none）*/}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.18]">
        <svg className="h-full w-full" viewBox="0 0 400 200" preserveAspectRatio="xMidYMax slice">
          {/* 三層等高山稜，由淺入深疊出縱深感 */}
          <path d="M0 200 L70 118 L130 150 L210 70 L280 116 L340 60 L400 104 L400 200 Z" fill="white" opacity="0.18" />
          <path d="M0 200 L60 150 L140 168 L220 120 L300 156 L360 118 L400 150 L400 200 Z" fill="white" opacity="0.22" />
          <path d="M0 200 L90 176 L170 188 L250 162 L330 184 L400 172 L400 200 Z" fill="white" opacity="0.3" />
        </svg>
      </div>
      <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-12 h-44 w-44 rounded-full bg-white/10 blur-2xl" />

      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        {/* 左：身份 + 攀升提示 */}
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-white/70">
            <Mountain size={13} />
            攀登中
          </p>
          <h2 className="mt-2 font-serif text-2xl font-semibold leading-tight tracking-tight sm:text-[28px]">
            {done === total && total > 0 ? '全員登頂' : `攀緊 ${active} 座山`}
          </h2>
          <p className="mt-1.5 max-w-md text-sm leading-relaxed text-white/75">{summitLine}</p>

          {/* 沿途數字：細口 hairline，唔搶海拔錶 */}
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-white/80">
            <span className="inline-flex items-center gap-1.5">
              <Flag size={13} className="text-white/60" />
              <span className="font-serif text-base font-semibold tabular-nums">{total}</span> 個山頭
            </span>
            <span aria-hidden="true" className="h-3 w-px bg-white/20" />
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-white/60" />
              <span className="font-serif text-base font-semibold tabular-nums">{done}</span> 已登頂
            </span>
            <span aria-hidden="true" className="h-3 w-px bg-white/20" />
            <span className="inline-flex items-center gap-1.5">
              <Footprints size={13} className="text-white/60" />
              本週行咗 <span className="font-serif text-base font-semibold tabular-nums">{checkinDays}</span> 日
            </span>
          </div>
        </div>

        {/* 右：海拔錶（整體平均進度做攀升軌跡）*/}
        <div className="flex shrink-0 items-center gap-4 self-stretch sm:self-auto">
          <AscentMeter value={avg} />
          <div className="hidden sm:block">
            <Button
              onClick={onNew}
              variant="secondary"
              icon={Plus}
              className="border-white/30 bg-white/15 text-white backdrop-blur hover:bg-white/25 dark:border-white/20 dark:bg-white/15 dark:text-white dark:hover:bg-white/25"
            >
              新目標
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}

// ============================================================
//  路線圖視圖（按攀升階段分欄；篩選時退為單一網格）
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
        {items.map((e, i) => (
          <GoalCard key={e.goal.id} e={e} onOpen={onOpen} index={i} />
        ))}
      </div>
    )
  }
  // 攀升三階段：上山中 / 紮營休息 / 已登頂
  const columns: { id: GoalMeta['status']; label: string; empty: string; icon: typeof Mountain }[] = [
    { id: 'active', label: '上山中', empty: '冇山頭喺路上，立一個？', icon: Footprints },
    { id: 'paused', label: '紮營休息', empty: '冇暫停嘅山頭', icon: Tent },
    { id: 'done', label: '已登頂', empty: '仲未登頂任何山頭', icon: MountainSnow },
  ]
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {columns.map((col) => {
        const colItems = items.filter((e) => e.status === col.id)
        const st = statusMeta(col.id)
        const ColIcon = col.icon
        return (
          <div key={col.id} className="space-y-2.5">
            <div className="flex items-center gap-2 px-1">
              <span className={cx('inline-flex h-6 w-6 items-center justify-center rounded-lg', col.id === 'done' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300' : col.id === 'paused' ? 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300' : 'bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent')}>
                <ColIcon size={14} />
              </span>
              <Badge tone={st.tone as 'accent'} dot>
                {col.label}
              </Badge>
              <span className="text-xs font-medium tabular-nums text-slate-400">{colItems.length}</span>
            </div>
            {colItems.length === 0 ? (
              <div className="flex flex-col items-center gap-1.5 rounded-3xl border border-dashed border-slate-200/80 bg-slate-50/40 px-3 py-8 text-center dark:border-slate-700/60 dark:bg-slate-800/30">
                <ColIcon size={20} className="text-slate-300 dark:text-slate-600" />
                <span className="text-xs text-slate-400 dark:text-slate-500">{col.empty}</span>
              </div>
            ) : (
              colItems.map((e, i) => <GoalCard key={e.goal.id} e={e} onOpen={onOpen} index={i} />)
            )}
          </div>
        )
      })}
    </div>
  )
}

// ============================================================
//  清單視圖（密集列；快速掃描）— 左側海拔軌
// ============================================================
function ListView({ items, onOpen }: { items: EnrichedGoal[]; onOpen: (id: string) => void }) {
  return (
    <ul className="space-y-2">
      {items.map((e, i) => {
        const cat = catMeta(e.meta?.category)
        const due = dueLabel(e.meta?.targetDate)
        const doneMs = e.milestones.filter((m) => m.done).length
        const CatIcon = cat.icon
        const isDone = e.status === 'done'
        return (
          <li key={e.goal.id} className="animate-fade-in-up" style={{ animationDelay: `${Math.min(i, 12) * 28}ms` }}>
            <button
              type="button"
              onClick={() => onOpen(e.goal.id)}
              className="group flex w-full items-stretch gap-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-white text-left shadow-xs transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:border-slate-700/60 dark:bg-slate-800 dark:shadow-none dark:hover:border-slate-600"
            >
              {/* 左側垂直海拔軌：填到對應高度 */}
              <span aria-hidden="true" className="relative w-1.5 shrink-0 bg-slate-100 dark:bg-slate-700/70">
                <span
                  className={cx('absolute inset-x-0 bottom-0 rounded-t-full transition-all duration-500', isDone ? 'bg-emerald-500' : 'bg-accent')}
                  style={{ height: `${Math.max(4, e.progress)}%` }}
                />
              </span>
              <div className="flex flex-1 items-center gap-3 p-3">
                <span className={cx('inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset', cat.ring, cat.text)}>
                  <CatIcon size={15} />
                </span>
                <div className="min-w-0 flex-1">
                  <span className={cx(
                    'block truncate text-sm font-medium',
                    isDone ? 'text-slate-400' : 'text-slate-800 dark:text-slate-100',
                  )}>
                    {e.goal.title}
                  </span>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                    <span className="text-slate-400 dark:text-slate-500">{altitudeLabel(e.progress, isDone)}</span>
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
                <span className={cx('shrink-0 font-serif text-lg font-semibold tabular-nums', isDone ? 'text-emerald-500' : 'text-accent')}>{e.progress}%</span>
                <ChevronRight size={16} className="shrink-0 text-slate-300 transition-transform duration-200 group-hover:translate-x-0.5 dark:text-slate-600" />
              </div>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

// ============================================================
//  目標卡（路線圖用）— 攀升軌跡 + 里程碑沿途節點
// ============================================================
function GoalCard({ e, onOpen, index }: { e: EnrichedGoal; onOpen: (id: string) => void; index: number }) {
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
      style={{ animationDelay: `${Math.min(index, 12) * 32}ms` }}
      className="group flex w-full animate-fade-in-up flex-col rounded-3xl border border-slate-200/80 bg-white p-4 text-left shadow-xs transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:border-slate-700/60 dark:bg-slate-800 dark:shadow-none dark:hover:border-slate-600"
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
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
            <span className="truncate">{cat.label}</span>
            <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">·</span>
            <span className="shrink-0">{altitudeLabel(e.progress, isDone)}</span>
          </p>
        </div>
        {isDone ? (
          <MountainSnow size={18} className="shrink-0 text-emerald-500" />
        ) : (
          e.meta?.priority === 'high' && <Flag size={15} className="mt-0.5 shrink-0 text-rose-500" />
        )}
      </div>

      {/* 攀升軌跡：水平路徑 + 里程碑沿途節點 + 終點旗（serif 海拔數字）*/}
      <div className="mt-4">
        <AscentTrail progress={e.progress} milestones={e.milestones} isDone={isDone} />
        <div className="mt-2 flex items-baseline justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">海拔</span>
          <span className={cx('font-serif text-xl font-semibold leading-none tabular-nums', isDone ? 'text-emerald-500' : 'text-accent')}>
            {e.progress}<span className="ml-0.5 text-xs font-sans font-medium text-slate-400">%</span>
          </span>
        </div>
      </div>

      {(e.milestones.length > 0 || due || pr.id !== 'medium') && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {e.milestones.length > 0 && (
            <Badge tone={doneMs === e.milestones.length ? 'green' : 'slate'} icon={Flag}>
              <span className="tabular-nums">
                {doneMs}/{e.milestones.length} 站
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

// ───────── 攀升軌跡（卡內）：路徑線 + 已行段填色 + 里程碑節點 + 終點旗 ─────────
function AscentTrail({
  progress,
  milestones,
  isDone,
}: {
  progress: number
  milestones: Milestone[]
  isDone: boolean
}) {
  const fill = isDone ? 'bg-emerald-500' : 'bg-accent'
  const v = Math.max(0, Math.min(100, progress))
  // 里程碑沿路徑均分做節點（最多顯示 6 個，避免細卡擠擁）
  const shown = milestones.slice(0, 6)
  const n = shown.length
  return (
    <div className="relative h-3.5">
      {/* 底軌 */}
      <span aria-hidden="true" className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-slate-100 dark:bg-slate-700/70" />
      {/* 已攀升段 */}
      <span
        aria-hidden="true"
        className={cx('absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full transition-all duration-500 ease-out', fill)}
        style={{ width: `${v}%` }}
      />
      {/* 里程碑沿途節點 */}
      {n > 0 &&
        shown.map((m, i) => {
          // 均分定位（首站近起點、尾站近終點），避免重疊端點旗
          const pos = n === 1 ? 50 : (i / (n - 1)) * 92 + 4
          return (
            <span
              key={m.id}
              aria-hidden="true"
              className={cx(
                'absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white transition-colors dark:ring-slate-800',
                m.done ? (isDone ? 'bg-emerald-500' : 'bg-accent') : 'bg-slate-300 dark:bg-slate-600',
              )}
              style={{ left: `${pos}%` }}
            />
          )
        })}
      {/* 終點：山頂旗 */}
      <span
        aria-hidden="true"
        className={cx(
          'absolute right-0 top-1/2 flex h-5 w-5 -translate-y-1/2 translate-x-1 items-center justify-center rounded-full ring-2 transition-colors',
          isDone
            ? 'bg-emerald-500 text-white ring-white dark:ring-slate-800'
            : v >= 100
              ? 'bg-accent text-white ring-white dark:ring-slate-800'
              : 'bg-white text-slate-300 ring-slate-200 dark:bg-slate-800 dark:text-slate-500 dark:ring-slate-600',
        )}
      >
        <Flag size={11} className={isDone || v >= 100 ? 'fill-current' : ''} />
      </span>
    </div>
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
      <Card className="rounded-3xl p-4 sm:p-5">
        <SectionTitle icon={PieChart}>登山隊狀態</SectionTitle>
        <div className="flex justify-center py-2">
          <StatusDonut segments={donutSegments} total={total} />
        </div>
      </Card>

      <Card className="rounded-3xl p-4 sm:p-5">
        <SectionTitle icon={TrendingUp}>各路線平均海拔</SectionTitle>
        <p className="mb-3 text-xs text-slate-400">整體平均海拔 <span className="font-serif text-sm font-semibold tabular-nums text-accent">{avg}%</span></p>
        <CategoryBars rows={categoryRows} />
      </Card>
    </div>
  )
}
