import { useMemo, useState } from 'react'
import { useCollection } from '../../lib/store'
import { lessonPlansCol, classesCol, topicsCol } from '../../data/collections'
import type { LessonPlan } from '../../data/types'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import {
  Button,
  Input,
  Select,
  Field,
  Card,
  Badge,
  SectionTitle,
  EmptyState,
  IconButton,
  Modal,
  Tooltip,
  StatCard,
  SegmentedControl,
  ProgressBar,
  Menu,
  Pills,
  cx,
} from '../../ui'
import {
  Plus,
  Pencil,
  Copy,
  Trash2,
  Calendar,
  NotebookPen,
  Printer,
  Clock,
  CheckCircle2,
  CircleDot,
  Circle,
  LayoutGrid,
  CalendarRange,
  PieChart,
  Sparkles,
  MoreVertical,
  ListChecks,
  ChevronLeft,
  ChevronRight,
  CalendarCheck,
} from 'lucide-react'
import PlanEditor, {
  emptyDraft,
  planToDraft,
  type PlanDraft,
} from './lessonPlanner/PlanEditor'
import CoverageChart from './lessonPlanner/CoverageChart'
import {
  STATUS_META,
  STATUS_ORDER,
  computeCoverage,
  emptyMeta,
  materialsDone,
  planMetaCol,
  planTemplatesCol,
  printPlan,
  startOfWeekKey,
  addDaysKey,
  weekRangeLabel,
  weekdayDateKeys,
  WEEKDAY_SHORT,
  shortDateLabel,
  longDateLabel,
  todayKey,
  totalPhaseMinutes,
  uidLocal,
  type PlanMeta,
  type PlanStatus,
} from './lessonPlanner/util'

// ============================================================
//  備課 / 教案 — 媲美 Planbook / Common Curriculum 嘅教師備課工具
//  ------------------------------------------------------------
//  · 三視圖：教案卡列表 / 週備課格 / 課程覆蓋分析
//  · 結構化教學環節時間軸 + 教材清單 + 備課狀態工作流
//  · 範本庫（可重用骨架）· 列印教案 · 複製到指定日 · 篩選排序統計
// ============================================================

type View = 'list' | 'week' | 'coverage'
type SortKey = 'date' | 'created' | 'title' | 'status'

const STATUS_ICON: Record<PlanStatus, typeof Circle> = {
  draft: Circle,
  ready: CircleDot,
  taught: CheckCircle2,
}

export default function LessonPlanner() {
  const plans = useCollection(lessonPlansCol)
  const classes = useCollection(classesCol)
  const topics = useCollection(topicsCol)
  const metas = useCollection(planMetaCol)
  const templates = useCollection(planTemplatesCol)
  const toast = useToast()
  const confirm = useConfirm()

  const [view, setView] = useState<View>('list')

  // 篩選 / 搜尋 / 排序
  const [filterClass, setFilterClass] = useState('')
  const [filterTopic, setFilterTopic] = useState('')
  const [filterStatus, setFilterStatus] = useState<PlanStatus | ''>('')
  const [filterArea, setFilterArea] = useState('')
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('date')

  // Modal 狀態
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create')
  const [editorInitial, setEditorInitial] = useState<PlanDraft>(emptyDraft)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [dupTarget, setDupTarget] = useState<LessonPlan | null>(null)
  const [dupDate, setDupDate] = useState(todayKey())

  // 週視圖：當前週開始（星期一）
  const [weekStart, setWeekStart] = useState(() => startOfWeekKey(new Date()))

  // ── lookups ──
  const metaById = useMemo(() => {
    const m = new Map<string, PlanMeta>()
    for (const x of metas) m.set(x.id, x)
    return m
  }, [metas])

  const sortedTopics = useMemo(
    () => [...topics].sort((a, b) => a.order - b.order),
    [topics],
  )
  const topicById = useMemo(() => {
    const m = new Map(topics.map((t) => [t.id, t]))
    return m
  }, [topics])

  const areas = useMemo(() => {
    const seen = new Set<string>()
    const out: string[] = []
    for (const t of sortedTopics)
      if (!seen.has(t.area)) {
        seen.add(t.area)
        out.push(t.area)
      }
    return out
  }, [sortedTopics])

  const className = (id?: string) => classes.find((c) => c.id === id)?.name
  const topicName = (id?: string) => (id ? topicById.get(id)?.topic : undefined)
  const topicArea = (id?: string) => (id ? topicById.get(id)?.area : undefined)
  const statusOf = (id: string): PlanStatus => metaById.get(id)?.status ?? 'draft'

  // ── 篩選 + 排序 ──
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = plans.filter((p) => {
      if (filterClass && p.classId !== filterClass) return false
      if (filterTopic && p.topicId !== filterTopic) return false
      if (filterArea && topicArea(p.topicId) !== filterArea) return false
      if (filterStatus && statusOf(p.id) !== filterStatus) return false
      if (q) {
        const hay = `${p.title} ${p.objectives ?? ''} ${
          topicName(p.topicId) ?? ''
        }`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
    const sorted = [...filtered]
    sorted.sort((a, b) => {
      switch (sortKey) {
        case 'title':
          return a.title.localeCompare(b.title, 'zh-Hant')
        case 'status':
          return (
            STATUS_META[statusOf(a.id)].order - STATUS_META[statusOf(b.id)].order
          )
        case 'created':
          return (b.createdAt ?? '').localeCompare(a.createdAt ?? '')
        case 'date':
        default: {
          // 有日期者按日期升序排前，無日期者排後
          const da = a.date ?? ''
          const db = b.date ?? ''
          if (da && db) return da.localeCompare(db)
          if (da) return -1
          if (db) return 1
          return (b.createdAt ?? '').localeCompare(a.createdAt ?? '')
        }
      }
    })
    return sorted
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    plans,
    filterClass,
    filterTopic,
    filterArea,
    filterStatus,
    search,
    sortKey,
    metaById,
    topicById,
  ])

  // ── 統計 ──
  const stats = useMemo(() => {
    const wkKeys = new Set(weekdayDateKeys(startOfWeekKey(new Date())))
    let thisWeek = 0
    let taught = 0
    let ready = 0
    for (const p of plans) {
      if (p.date && wkKeys.has(p.date)) thisWeek += 1
      const s = statusOf(p.id)
      if (s === 'taught') taught += 1
      else if (s === 'ready') ready += 1
    }
    const plannedTopicIds = new Set<string>()
    const taughtTopicIds = new Set<string>()
    for (const p of plans) {
      if (!p.topicId) continue
      plannedTopicIds.add(p.topicId)
      if (statusOf(p.id) === 'taught') taughtTopicIds.add(p.topicId)
    }
    const coverPct = topics.length
      ? Math.round((plannedTopicIds.size / topics.length) * 100)
      : 0
    return {
      total: plans.length,
      thisWeek,
      taught,
      ready,
      coverPct,
      plannedCount: plannedTopicIds.size,
      plannedTopicIds,
      taughtTopicIds,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plans, topics, metaById])

  const coverageRows = useMemo(
    () => computeCoverage(topics, stats.plannedTopicIds, stats.taughtTopicIds),
    [topics, stats.plannedTopicIds, stats.taughtTopicIds],
  )

  // ── 週視圖：按上課日分組 ──
  const weekDays = useMemo(() => weekdayDateKeys(weekStart), [weekStart])
  const weekBuckets = useMemo(() => {
    const map = new Map<string, LessonPlan[]>()
    for (const k of weekDays) map.set(k, [])
    for (const p of plans) {
      if (p.date && map.has(p.date)) map.get(p.date)!.push(p)
    }
    for (const list of map.values()) {
      list.sort((a, b) => {
        const pa = metaById.get(a.id)?.period ?? 99
        const pb = metaById.get(b.id)?.period ?? 99
        if (pa !== pb) return pa - pb
        return a.title.localeCompare(b.title, 'zh-Hant')
      })
    }
    return map
  }, [plans, weekDays, metaById])

  const weekTotal = useMemo(
    () => weekDays.reduce((s, k) => s + (weekBuckets.get(k)?.length ?? 0), 0),
    [weekDays, weekBuckets],
  )

  // ── 寫入持久化 ──
  const toPlanPayload = (d: PlanDraft) => ({
    title: d.title.trim(),
    classId: d.classId || undefined,
    topicId: d.topicId || undefined,
    date: d.date || undefined,
    objectives: d.objectives.trim() || undefined,
    activities:
      d.phases
        .map((p) => `${p.label}（${p.minutes} 分）${p.detail ? '：' + p.detail : ''}`)
        .join('\n') || undefined,
    resourcesNote: d.resourcesNote.trim() || undefined,
  })

  const writeMeta = (id: string, d: PlanDraft) => {
    const payload: PlanMeta = {
      id,
      status: d.status,
      period: d.period ? Math.max(1, Number(d.period) || 0) : undefined,
      durationMin: totalPhaseMinutes(d.phases) || undefined,
      taughtDate:
        d.status === 'taught' ? d.taughtDate || todayKey() : d.taughtDate || undefined,
      phases: d.phases.map((p) => ({ ...p })),
      materials: d.materials.map((m) => ({ ...m })),
      reflection: d.reflection.trim() || undefined,
      updatedAt: new Date().toISOString(),
    }
    if (metaById.has(id)) planMetaCol.update(id, payload)
    else planMetaCol.add(payload)
  }

  // ── 開 Modal ──
  const openCreate = (presetDate?: string) => {
    setEditorMode('create')
    setEditorInitial({ ...emptyDraft, date: presetDate ?? '' })
    setEditingId(null)
    setEditorOpen(true)
  }
  const openEdit = (p: LessonPlan) => {
    setEditorMode('edit')
    setEditorInitial(planToDraft(p, metaById.get(p.id)))
    setEditingId(p.id)
    setEditorOpen(true)
  }
  const closeEditor = () => setEditorOpen(false)

  const submitEditor = (d: PlanDraft) => {
    if (!d.title.trim()) return
    if (editorMode === 'create') {
      const created = lessonPlansCol.add({
        ...toPlanPayload(d),
        createdAt: new Date().toISOString(),
      })
      writeMeta(created.id, d)
      toast.success('已新增教案')
    } else if (editingId) {
      lessonPlansCol.update(editingId, toPlanPayload(d))
      writeMeta(editingId, d)
      toast.success('已儲存教案')
    }
    setEditorOpen(false)
  }

  // ── 範本 ──
  const saveAsTemplate = (d: PlanDraft) => {
    if (!d.phases.length && !d.materials.length) return
    planTemplatesCol.add({
      id: uidLocal('tpl'),
      name: d.title.trim() || '未命名範本',
      objectives: d.objectives.trim(),
      phases: d.phases.map((p) => ({ ...p })),
      materials: d.materials.map((m) => ({ text: m.text })),
      createdAt: new Date().toISOString(),
    })
    toast.success('已存為範本')
  }

  const removeTemplate = async (id: string, name: string) => {
    const ok = await confirm({
      title: '刪除範本？',
      message: `「${name}」將會被刪除。`,
      confirmText: '刪除',
      tone: 'danger',
    })
    if (ok) {
      planTemplatesCol.remove(id)
      toast.success('已刪除範本')
    }
  }

  const newFromTemplate = (tplId: string) => {
    const tpl = templates.find((t) => t.id === tplId)
    if (!tpl) return
    setEditorMode('create')
    setEditorInitial({
      ...emptyDraft,
      objectives: tpl.objectives,
      phases: tpl.phases.map((p) => ({ ...p, id: uidLocal('ph') })),
      materials: tpl.materials.map((m) => ({
        id: uidLocal('mt'),
        text: m.text,
        done: false,
      })),
    })
    setEditingId(null)
    setTemplatesOpen(false)
    setEditorOpen(true)
  }

  // ── 複製 / 複製到指定日 / 狀態切換 / 刪除 / 列印 ──
  const cloneTo = (p: LessonPlan, date?: string, suffix = '（副本）') => {
    const created = lessonPlansCol.add({
      title: `${p.title}${suffix}`,
      classId: p.classId,
      topicId: p.topicId,
      date: date ?? p.date,
      objectives: p.objectives,
      activities: p.activities,
      resourcesNote: p.resourcesNote,
      createdAt: new Date().toISOString(),
    })
    const src = metaById.get(p.id)
    if (src) {
      planMetaCol.add({
        ...src,
        id: created.id,
        status: 'draft',
        taughtDate: undefined,
        reflection: undefined,
        phases: src.phases.map((x) => ({ ...x })),
        materials: src.materials.map((x) => ({ ...x, done: false })),
        updatedAt: new Date().toISOString(),
      })
    }
    return created
  }

  const duplicate = (p: LessonPlan) => {
    cloneTo(p)
    toast.success('已複製教案')
  }

  const confirmDupToDate = () => {
    if (!dupTarget) return
    cloneTo(dupTarget, dupDate, '')
    toast.success(`已複製到 ${shortDateLabel(dupDate)}`)
    setDupTarget(null)
  }

  const cycleStatus = (p: LessonPlan) => {
    const cur = statusOf(p.id)
    const idx = STATUS_ORDER.indexOf(cur)
    const next = STATUS_ORDER[(idx + 1) % STATUS_ORDER.length]
    const base = metaById.get(p.id) ?? emptyMeta(p.id)
    const patch: PlanMeta = {
      ...base,
      status: next,
      taughtDate: next === 'taught' ? base.taughtDate || todayKey() : base.taughtDate,
      updatedAt: new Date().toISOString(),
    }
    if (metaById.has(p.id)) planMetaCol.update(p.id, patch)
    else planMetaCol.add(patch)
    toast.success(`狀態：${STATUS_META[next].label}`)
  }

  const remove = async (p: LessonPlan) => {
    const ok = await confirm({
      title: '刪除教案？',
      message: `「${p.title}」將會被永久刪除，呢個動作無法復原。`,
      confirmText: '刪除',
      tone: 'danger',
    })
    if (!ok) return
    lessonPlansCol.remove(p.id)
    if (metaById.has(p.id)) planMetaCol.remove(p.id)
    toast.success('已刪除教案')
  }

  const doPrint = (p: LessonPlan) => {
    const ok = printPlan({
      plan: p,
      meta: metaById.get(p.id),
      className: className(p.classId),
      topicName: topicName(p.topicId),
      area: topicArea(p.topicId),
    })
    if (!ok) toast.error('瀏覽器封鎖咗彈窗，請允許後再試')
  }

  const hasFilter =
    !!filterClass || !!filterTopic || !!filterStatus || !!filterArea || !!search.trim()
  const clearFilters = () => {
    setFilterClass('')
    setFilterTopic('')
    setFilterStatus('')
    setFilterArea('')
    setSearch('')
  }

  // ── 第一行目標 ──
  const firstObjective = (text?: string) => {
    if (!text) return ''
    return text.split('\n').find((l) => l.trim())?.trim() ?? ''
  }

  return (
    <div className="space-y-4">
      <SectionTitle
        icon={NotebookPen}
        description="結構化備課：教學環節、教材清單、課程覆蓋、可列印"
        right={
          <div className="flex items-center gap-2">
            <Tooltip label="範本庫">
              <Button
                size="sm"
                variant="secondary"
                icon={Sparkles}
                onClick={() => setTemplatesOpen(true)}
              >
                範本
              </Button>
            </Tooltip>
            <Button size="sm" icon={Plus} onClick={() => openCreate()}>
              新增教案
            </Button>
          </div>
        }
      >
        備課 / 教案
      </SectionTitle>

      {/* 統計卡 */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <StatCard label="教案總數" value={stats.total} icon={NotebookPen} />
        <StatCard
          label="本週課堂"
          value={stats.thisWeek}
          icon={CalendarRange}
          hint="星期一至五"
        />
        <StatCard
          label="已授課"
          value={stats.taught}
          icon={CheckCircle2}
          hint={stats.ready ? `另有 ${stats.ready} 個已就緒` : '完成授課嘅教案'}
        />
        <StatCard
          label="課程覆蓋"
          value={stats.coverPct}
          unit="%"
          icon={PieChart}
          highlight
          hint={`已備 ${stats.plannedCount}/${topics.length} 課題`}
        />
      </div>

      {/* 視圖切換 */}
      <div className="flex items-center justify-between gap-2">
        <SegmentedControl<View>
          value={view}
          onChange={setView}
          options={[
            { id: 'list', label: '列表', icon: LayoutGrid },
            { id: 'week', label: '週備課', icon: CalendarRange },
            { id: 'coverage', label: '覆蓋分析', icon: PieChart },
          ]}
        />
        {view === 'list' && (
          <div className="hidden items-center gap-1.5 sm:flex">
            <span className="text-xs text-slate-400">排序</span>
            <Select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="w-auto"
            >
              <option value="date">授課日期</option>
              <option value="created">最新建立</option>
              <option value="title">標題</option>
              <option value="status">狀態</option>
            </Select>
          </div>
        )}
      </div>

      {/* ─────────────── 列表視圖 ─────────────── */}
      {view === 'list' && (
        <>
          {/* 篩選列 */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜尋標題 / 目標 / 課題…"
            />
            <Select
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
            >
              <option value="">全部班別</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Select
              value={filterArea}
              onChange={(e) => setFilterArea(e.target.value)}
            >
              <option value="">全部範疇</option>
              {areas.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </Select>
            <Select
              value={filterTopic}
              onChange={(e) => setFilterTopic(e.target.value)}
            >
              <option value="">全部課題</option>
              {sortedTopics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.topic}
                </option>
              ))}
            </Select>
          </div>

          {/* 狀態 pills + 清除 */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Pills<PlanStatus | 'all'>
              size="sm"
              active={(filterStatus || 'all') as PlanStatus | 'all'}
              onChange={(id) => setFilterStatus(id === 'all' ? '' : id)}
              options={[
                { id: 'all', label: '全部' },
                ...STATUS_ORDER.map((s) => ({ id: s, label: STATUS_META[s].label })),
              ]}
              counts={{
                all: plans.length,
                draft: plans.filter((p) => statusOf(p.id) === 'draft').length,
                ready: stats.ready,
                taught: stats.taught,
              }}
            />
            {hasFilter && (
              <Button size="sm" variant="ghost" onClick={clearFilters}>
                清除篩選
              </Button>
            )}
          </div>

          {visible.length === 0 ? (
            <EmptyState
              icon={NotebookPen}
              title={hasFilter ? '揾唔到符合條件嘅教案' : '仲未有教案'}
              hint={
                hasFilter
                  ? '試吓清除篩選或搜尋條件。'
                  : '撳「新增教案」開始，或由「範本」快速建立。'
              }
              action={
                hasFilter ? (
                  <Button size="sm" variant="secondary" onClick={clearFilters}>
                    清除篩選
                  </Button>
                ) : (
                  <Button size="sm" icon={Plus} onClick={() => openCreate()}>
                    新增教案
                  </Button>
                )
              }
            />
          ) : (
            <ul className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
              {visible.map((p) => (
                <PlanCard
                  key={p.id}
                  plan={p}
                  meta={metaById.get(p.id)}
                  className={className(p.classId)}
                  topicName={topicName(p.topicId)}
                  area={topicArea(p.topicId)}
                  objective={firstObjective(p.objectives)}
                  onEdit={() => openEdit(p)}
                  onDuplicate={() => duplicate(p)}
                  onDupToDate={() => {
                    setDupTarget(p)
                    setDupDate(p.date || todayKey())
                  }}
                  onCycleStatus={() => cycleStatus(p)}
                  onPrint={() => doPrint(p)}
                  onRemove={() => remove(p)}
                />
              ))}
            </ul>
          )}
        </>
      )}

      {/* ─────────────── 週備課視圖 ─────────────── */}
      {view === 'week' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <IconButton
                label="上一週"
                onClick={() => setWeekStart(addDaysKey(weekStart, -7))}
              >
                <ChevronLeft size={18} />
              </IconButton>
              <span className="min-w-[7.5rem] text-center text-sm font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                {weekRangeLabel(weekStart)}
              </span>
              <IconButton
                label="下一週"
                onClick={() => setWeekStart(addDaysKey(weekStart, 7))}
              >
                <ChevronRight size={18} />
              </IconButton>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone="slate">
                <span className="tabular-nums">{weekTotal}</span> 個課堂
              </Badge>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setWeekStart(startOfWeekKey(new Date()))}
              >
                本週
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
            {weekDays.map((key, i) => {
              const list = weekBuckets.get(key) ?? []
              const isToday = key === todayKey()
              return (
                <div
                  key={key}
                  className={cx(
                    'flex min-h-[8rem] flex-col rounded-xl border bg-white p-2 dark:bg-slate-800/60',
                    isToday
                      ? 'border-accent/40 ring-1 ring-accent/20 dark:border-accent/40'
                      : 'border-slate-200 dark:border-slate-700/60',
                  )}
                >
                  <div className="mb-1.5 flex items-center justify-between px-0.5">
                    <span
                      className={cx(
                        'text-xs font-semibold',
                        isToday
                          ? 'text-accent-strong dark:text-accent'
                          : 'text-slate-600 dark:text-slate-300',
                      )}
                    >
                      星期{WEEKDAY_SHORT[i]}
                    </span>
                    <span className="text-[11px] tabular-nums text-slate-400">
                      {shortDateLabel(key)}
                    </span>
                  </div>

                  <div className="flex flex-1 flex-col gap-1.5">
                    {list.map((p) => {
                      const m = metaById.get(p.id)
                      const st = m?.status ?? 'draft'
                      const dur = m?.durationMin ?? totalPhaseMinutes(m?.phases ?? [])
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => openEdit(p)}
                          className={cx(
                            'rounded-lg border-l-[3px] bg-slate-50 px-2 py-1.5 text-left transition hover:bg-slate-100 dark:bg-slate-900/40 dark:hover:bg-slate-900/70',
                            st === 'taught'
                              ? 'border-emerald-500'
                              : st === 'ready'
                                ? 'border-amber-500'
                                : 'border-slate-300 dark:border-slate-600',
                          )}
                        >
                          <div className="flex items-center gap-1">
                            {m?.period != null && (
                              <span className="rounded bg-slate-200 px-1 text-[10px] font-semibold tabular-nums text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                                第{m.period}節
                              </span>
                            )}
                            <span className="truncate text-xs font-medium text-slate-700 dark:text-slate-200">
                              {p.title}
                            </span>
                          </div>
                          <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-slate-400">
                            {p.classId && <span>{className(p.classId)}</span>}
                            {dur > 0 && (
                              <span className="inline-flex items-center gap-0.5 tabular-nums">
                                <Clock size={10} />
                                {dur}分
                              </span>
                            )}
                          </div>
                        </button>
                      )
                    })}
                    <button
                      type="button"
                      onClick={() => openCreate(key)}
                      className="mt-auto flex items-center justify-center gap-1 rounded-lg border border-dashed border-slate-200 py-1 text-[11px] text-slate-400 transition hover:border-accent/40 hover:text-accent dark:border-slate-700"
                    >
                      <Plus size={12} />
                      加課
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ─────────────── 覆蓋分析視圖 ─────────────── */}
      {view === 'coverage' && (
        <div className="space-y-4">
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  BAFS 課程覆蓋率
                </h3>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  按課題範疇統計：已授課 / 已備課 / 全部課題
                </p>
              </div>
              <Badge tone="accent">
                <span className="tabular-nums">{stats.coverPct}%</span> 已備
              </Badge>
            </div>
            <CoverageChart
              rows={coverageRows}
              activeArea={filterArea}
              onSelectArea={(a) => {
                setFilterArea(a)
                if (a) setView('list')
              }}
            />
          </Card>

          {/* 未備課題清單 */}
          <Card className="p-4">
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
              <Circle size={14} className="text-slate-400" />
              未備課嘅課題
            </h3>
            {(() => {
              const missing = sortedTopics.filter(
                (t) => !stats.plannedTopicIds.has(t.id),
              )
              if (missing.length === 0)
                return (
                  <p className="py-4 text-center text-sm text-emerald-600 dark:text-emerald-400">
                    所有課題都已備課 🎉
                  </p>
                )
              return (
                <div className="flex flex-wrap gap-1.5">
                  {missing.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setEditorMode('create')
                        setEditorInitial({ ...emptyDraft, topicId: t.id })
                        setEditingId(null)
                        setEditorOpen(true)
                      }}
                      className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600 transition hover:bg-accent-soft hover:text-accent-strong dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-accent/15 dark:hover:text-accent"
                    >
                      <Plus size={11} />
                      {t.topic}
                    </button>
                  ))}
                </div>
              )
            })()}
          </Card>
        </div>
      )}

      {/* ─────────────── 編輯器 ─────────────── */}
      <PlanEditor
        open={editorOpen}
        mode={editorMode}
        initial={editorInitial}
        classes={classes}
        topics={sortedTopics}
        templates={templates}
        onClose={closeEditor}
        onSubmit={submitEditor}
        onSaveAsTemplate={saveAsTemplate}
      />

      {/* ─────────────── 範本庫 ─────────────── */}
      <Modal
        open={templatesOpen}
        onClose={() => setTemplatesOpen(false)}
        title="教案範本庫"
        size="lg"
      >
        <div className="space-y-2.5">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            範本包含教學環節同教材骨架。喺編輯教案時撳「存為範本」可加入更多。
          </p>
          {templates.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="仲未有範本"
              hint="編輯任何教案時，於底部撳「存為範本」即可建立。"
            />
          ) : (
            <ul className="space-y-2">
              {templates.map((t) => {
                const mins = totalPhaseMinutes(t.phases)
                return (
                  <li
                    key={t.id}
                    className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {t.name}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <Badge tone="slate" icon={ListChecks}>
                          <span className="tabular-nums">{t.phases.length}</span> 環節
                        </Badge>
                        {mins > 0 && (
                          <Badge tone="slate" icon={Clock}>
                            <span className="tabular-nums">{mins}</span> 分
                          </Badge>
                        )}
                        {t.materials.length > 0 && (
                          <Badge tone="slate">
                            <span className="tabular-nums">{t.materials.length}</span>{' '}
                            教材
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={Plus}
                        onClick={() => newFromTemplate(t.id)}
                      >
                        用此建立
                      </Button>
                      <IconButton
                        label="刪除範本"
                        tone="danger"
                        onClick={() => removeTemplate(t.id, t.name)}
                      >
                        <Trash2 size={16} strokeWidth={1.8} />
                      </IconButton>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </Modal>

      {/* ─────────────── 複製到指定日 ─────────────── */}
      <Modal
        open={dupTarget !== null}
        onClose={() => setDupTarget(null)}
        title="複製到指定日期"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDupTarget(null)}>
              取消
            </Button>
            <Button icon={CalendarCheck} onClick={confirmDupToDate}>
              複製
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            複製「{dupTarget?.title}」並設定新嘅授課日期（新副本狀態為草稿）。
          </p>
          <Field label="授課日期">
            <Input
              type="date"
              value={dupDate}
              onChange={(e) => setDupDate(e.target.value)}
            />
          </Field>
          <p className="text-xs text-slate-400">{longDateLabel(dupDate)}</p>
        </div>
      </Modal>
    </div>
  )
}

// ============================================================
//  教案卡（列表用）
// ============================================================
function PlanCard({
  plan,
  meta,
  className,
  topicName,
  area,
  objective,
  onEdit,
  onDuplicate,
  onDupToDate,
  onCycleStatus,
  onPrint,
  onRemove,
}: {
  plan: LessonPlan
  meta: PlanMeta | undefined
  className?: string
  topicName?: string
  area?: string
  objective: string
  onEdit: () => void
  onDuplicate: () => void
  onDupToDate: () => void
  onCycleStatus: () => void
  onPrint: () => void
  onRemove: () => void
}) {
  const status = meta?.status ?? 'draft'
  const sMeta = STATUS_META[status]
  const SIcon = STATUS_ICON[status]
  const dur = meta?.durationMin ?? totalPhaseMinutes(meta?.phases ?? [])
  const phaseCount = meta?.phases.length ?? 0
  const mat = materialsDone(meta?.materials ?? [])
  const matPct = mat.total ? Math.round((mat.done / mat.total) * 100) : 0

  return (
    <Card className="flex flex-col p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={onEdit}
            className="block text-left text-sm font-semibold text-slate-800 hover:text-accent dark:text-slate-100 dark:hover:text-accent"
          >
            {plan.title}
          </button>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Tooltip label="撳一下切換狀態">
              <button type="button" onClick={onCycleStatus}>
                <Badge tone={sMeta.tone} icon={SIcon}>
                  {sMeta.label}
                </Badge>
              </button>
            </Tooltip>
            {className && <Badge tone="accent">{className}</Badge>}
            {area && <Badge tone="slate">{area}</Badge>}
            {plan.date && (
              <Badge tone="blue" icon={Calendar}>
                <span className="tabular-nums">{plan.date}</span>
              </Badge>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <Tooltip label="編輯">
            <IconButton label="編輯教案" onClick={onEdit}>
              <Pencil size={17} strokeWidth={1.8} />
            </IconButton>
          </Tooltip>
          <Tooltip label="列印">
            <IconButton label="列印教案" onClick={onPrint}>
              <Printer size={17} strokeWidth={1.8} />
            </IconButton>
          </Tooltip>
          <Menu
            trigger={
              <span className="inline-flex items-center justify-center rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-800">
                <MoreVertical size={17} strokeWidth={1.8} />
              </span>
            }
            items={[
              { id: 'edit', label: '編輯', icon: Pencil, onSelect: onEdit },
              { id: 'dup', label: '複製', icon: Copy, onSelect: onDuplicate },
              {
                id: 'dupdate',
                label: '複製到指定日…',
                icon: CalendarCheck,
                onSelect: onDupToDate,
              },
              { id: 'print', label: '列印', icon: Printer, onSelect: onPrint },
              {
                id: 'status',
                label: `切換狀態（${sMeta.label}）`,
                icon: SIcon,
                onSelect: onCycleStatus,
              },
              {
                id: 'del',
                label: '刪除',
                icon: Trash2,
                tone: 'danger',
                onSelect: onRemove,
              },
            ]}
          />
        </div>
      </div>

      {topicName && (
        <p className="mt-2 truncate text-xs text-slate-500 dark:text-slate-400">
          <span className="font-medium text-slate-400 dark:text-slate-500">課題：</span>
          {topicName}
        </p>
      )}
      {objective && (
        <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
          <span className="font-medium text-slate-400 dark:text-slate-500">目標：</span>
          {objective}
        </p>
      )}

      {/* 底部 meta 條 */}
      {(phaseCount > 0 || dur > 0 || mat.total > 0) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-slate-100 pt-2.5 dark:border-slate-700/60">
          {phaseCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
              <ListChecks size={13} className="text-slate-400" />
              <span className="tabular-nums">{phaseCount}</span> 環節
            </span>
          )}
          {dur > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
              <Clock size={13} className="text-slate-400" />
              <span className="tabular-nums">{dur}</span> 分鐘
            </span>
          )}
          {mat.total > 0 && (
            <span className="ml-auto inline-flex min-w-[7rem] items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              <span className="shrink-0">教材</span>
              <ProgressBar
                value={matPct}
                size="sm"
                tone={matPct === 100 ? 'green' : 'accent'}
              />
              <span className="shrink-0 tabular-nums">
                {mat.done}/{mat.total}
              </span>
            </span>
          )}
        </div>
      )}
    </Card>
  )
}
