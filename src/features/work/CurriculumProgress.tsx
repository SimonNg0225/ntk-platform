import { useMemo, useState } from 'react'
import {
  BookMarked,
  CalendarClock,
  Check,
  CheckCheck,
  CheckSquare,
  ChevronDown,
  ClipboardList,
  Columns3,
  Download,
  Gauge,
  Hourglass,
  LayoutList,
  ListChecks,
  Printer,
  School,
  Search,
  SlidersHorizontal,
  Target,
  TrendingUp,
  X,
} from 'lucide-react'
import { useCollection, createCollection, uid } from '../../lib/store'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import { classesCol, topicsCol, progressCol } from '../../data/collections'
import type { ProgressStatus, Topic } from '../../data/types'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  IconButton,
  Input,
  Modal,
  Pills,
  ProgressBar,
  SectionTitle,
  SegmentedControl,
  Select,
  StatCard,
  Table,
  Tabs,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  Tooltip,
  cx,
} from '../../ui'
import { DonutWithLegend, PacingChart, AreaBars, type PacingPoint } from './curriculum/Charts'
import {
  type CurriculumPlan,
  type PaceState,
  STATUS_META,
  PACE_META,
  NEXT_STATUS,
  recordOf,
  statusOf,
  planOf,
  paceOf,
  todayKey,
  fmtDate,
  groupTopics,
  countStatuses,
  downloadCsv,
} from './curriculum/util'

// 新持久化集合：每班每課題嘅教學計劃（計劃週/節數/目標日）
// 唔掂 data/collections.ts；喺 newCollections 申報 key = curriculum_plan
const planCol = createCollection<CurriculumPlan>('curriculum_plan', [])

type ViewTab = 'list' | 'schedule' | 'matrix' | 'analysis'
const VIEW_TABS: { id: ViewTab; label: string }[] = [
  { id: 'list', label: '進度清單' },
  { id: 'schedule', label: '教學進度表' },
  { id: 'matrix', label: '全校對照' },
  { id: 'analysis', label: '分析' },
]
const VIEW_ICONS: Partial<Record<ViewTab, typeof LayoutList>> = {
  list: LayoutList,
  schedule: CalendarClock,
  matrix: Columns3,
  analysis: TrendingUp,
}

type StatusFilter = 'all' | ProgressStatus

export default function CurriculumProgress() {
  const classes = useCollection(classesCol)
  const topics = useCollection(topicsCol)
  const [classId, setClassId] = useState<string>(classes[0]?.id ?? '')
  const [view, setView] = useState<ViewTab>('list')

  const activeClass = classes.find((c) => c.id === classId) ?? classes[0]

  if (classes.length === 0) {
    return (
      <EmptyState
        icon={School}
        title="仲未有班別"
        hint="先去「班別管理」新增班別，再返嚟標記課程進度。"
      />
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Pills
          options={classes.map((c) => ({ id: c.id, label: c.name }))}
          active={activeClass?.id ?? ''}
          onChange={setClassId}
        />
      </div>

      <Tabs tabs={VIEW_TABS} active={view} onChange={setView} icons={VIEW_ICONS} />

      {activeClass && view === 'list' && (
        <ListView classId={activeClass.id} className={activeClass.name} topics={topics} />
      )}
      {activeClass && view === 'schedule' && (
        <ScheduleView classId={activeClass.id} className={activeClass.name} topics={topics} />
      )}
      {view === 'matrix' && <MatrixView classes={classes} topics={topics} />}
      {activeClass && view === 'analysis' && (
        <AnalysisView classId={activeClass.id} className={activeClass.name} topics={topics} />
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════
//  進度清單（清單視圖 + 篩選 + 搜尋 + 批量 + 計劃編輯）
// ════════════════════════════════════════════════════════════
function ListView({
  classId,
  className,
  topics,
}: {
  classId: string
  className: string
  topics: Topic[]
}) {
  const toast = useToast()
  const confirm = useConfirm()
  const progress = useCollection(progressCol)
  const plans = useCollection(planCol)
  const today = todayKey()

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [partFilter, setPartFilter] = useState<string>('all')
  const [query, setQuery] = useState('')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [editing, setEditing] = useState<Topic | null>(null)

  const parts = useMemo(() => Array.from(new Set(topics.map((t) => t.part))), [topics])

  // 套用篩選 + 搜尋
  const filteredTopics = useMemo(() => {
    const q = query.trim().toLowerCase()
    return topics.filter((t) => {
      if (partFilter !== 'all' && t.part !== partFilter) return false
      if (statusFilter !== 'all' && statusOf(progress, classId, t.id) !== statusFilter)
        return false
      if (q && !`${t.topic} ${t.area}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [topics, partFilter, statusFilter, query, progress, classId])

  const grouped = useMemo(() => groupTopics(filteredTopics), [filteredTopics])
  const overall = useMemo(
    () => countStatuses(progress, classId, topics.map((t) => t.id)),
    [progress, classId, topics],
  )

  // 落後課題數（有目標日、未完成、已過期）
  const behindCount = useMemo(
    () =>
      topics.filter((t) => {
        const st = statusOf(progress, classId, t.id)
        const p = planOf(plans, classId, t.id)
        return paceOf(st, p?.targetDate, today) === 'behind'
      }).length,
    [topics, progress, plans, classId, today],
  )

  const cycle = (topicId: string) => {
    const rec = recordOf(progress, classId, topicId)
    const next = NEXT_STATUS[rec?.status ?? 'not_started']
    if (rec) {
      progressCol.update(rec.id, {
        status: next,
        dateDone: next === 'done' ? new Date().toISOString() : undefined,
      })
    } else {
      progressCol.add({
        classId,
        topicId,
        status: next,
        dateDone: next === 'done' ? new Date().toISOString() : undefined,
      })
    }
    if (next === 'done' && topics.length > 0 && overall.done + 1 === topics.length) {
      toast.success(`${className} 已完成全部課題 🎉`)
    }
  }

  const setStatus = (topicId: string, status: ProgressStatus) => {
    const rec = recordOf(progress, classId, topicId)
    const patch = {
      status,
      dateDone: status === 'done' ? new Date().toISOString() : undefined,
    }
    if (rec) progressCol.update(rec.id, patch)
    else progressCol.add({ classId, topicId, ...patch })
  }

  // 批量：將某範疇全部標記完成 / 重設
  const bulkArea = async (items: Topic[], to: ProgressStatus, areaName: string) => {
    if (to === 'not_started') {
      const ok = await confirm({
        title: '重設範疇進度？',
        message: `將「${areaName}」全部 ${items.length} 個課題設為未開始。`,
        confirmText: '重設',
      })
      if (!ok) return
    }
    items.forEach((t) => setStatus(t.id, to))
    toast.success(
      to === 'done'
        ? `已標記「${areaName}」全部完成`
        : `已重設「${areaName}」進度`,
    )
  }

  const allCollapsed = grouped.length > 0 && grouped.every((p) => collapsed[p.part])
  const toggleAll = () => {
    if (allCollapsed) setCollapsed({})
    else {
      const next: Record<string, boolean> = {}
      for (const p of grouped) next[p.part] = true
      setCollapsed(next)
    }
  }

  const exportCsv = () => {
    const rows: (string | number)[][] = [
      ['部分', '範疇', '課題', '狀態', '完成日期', '目標完成日', '進度'],
    ]
    for (const t of [...topics].sort((a, b) => a.order - b.order)) {
      const rec = recordOf(progress, classId, t.id)
      const st = rec?.status ?? 'not_started'
      const p = planOf(plans, classId, t.id)
      rows.push([
        t.part,
        t.area,
        t.topic,
        STATUS_META[st].label,
        st === 'done' ? fmtDate(rec?.dateDone) : '',
        p?.targetDate ?? '',
        PACE_META[paceOf(st, p?.targetDate, today)].label,
      ])
    }
    downloadCsv(`${className}_課程進度.csv`, rows)
    toast.success(`已匯出 ${className} 課程進度 CSV`)
  }

  return (
    <div className="space-y-4">
      {/* 統計卡 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="總課題" value={topics.length} unit="個" icon={BookMarked} />
        <StatCard label="已完成" value={overall.done} unit="個" icon={CheckSquare} />
        <StatCard label="進行中" value={overall.inProgress} unit="個" icon={Hourglass} />
        <StatCard
          label="落後課題"
          value={behindCount}
          unit="個"
          icon={CalendarClock}
          hint={behindCount > 0 ? '已過目標完成日' : '進度準時'}
        />
      </div>

      {/* 整體進度 */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
            {className} 整體完成度
          </span>
          <span className="nums text-sm font-bold text-accent-strong dark:text-accent">
            {overall.done}/{topics.length}（{overall.pct}%）
          </span>
        </div>
        <ProgressBar value={overall.pct} className="mt-2" />
      </Card>

      {/* 工具列：搜尋 + 篩選 + 匯出 */}
      <Card className="space-y-3 p-3 sm:p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="sm:max-w-xs sm:flex-1">
            <Input
              icon={Search}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜尋課題或範疇…"
            />
          </div>
          <div className="flex items-center gap-2 sm:ml-auto">
            <Button variant="secondary" size="sm" icon={Download} onClick={exportCsv}>
              匯出 CSV
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={Printer}
              onClick={() => window.print()}
            >
              列印
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 dark:text-slate-500">
            <SlidersHorizontal size={13} /> 狀態
          </span>
          <SegmentedControl<StatusFilter>
            size="sm"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { id: 'all', label: '全部' },
              { id: 'not_started', label: '未開始' },
              { id: 'in_progress', label: '進行中' },
              { id: 'done', label: '完成' },
            ]}
          />
          {parts.length > 1 && (
            <Select
              value={partFilter}
              onChange={(e) => setPartFilter(e.target.value)}
              className="h-8 w-auto py-1 text-xs"
            >
              <option value="all">全部部分</option>
              {parts.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          )}
          {grouped.length > 0 && (
            <button
              onClick={toggleAll}
              className="ml-auto text-xs font-medium text-accent-strong hover:underline dark:text-accent"
            >
              {allCollapsed ? '全部展開' : '全部收起'}
            </button>
          )}
        </div>
      </Card>

      {/* 課題列表 */}
      {grouped.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title={query || statusFilter !== 'all' || partFilter !== 'all' ? '冇符合條件嘅課題' : '仲未有課題'}
          hint={
            query || statusFilter !== 'all' || partFilter !== 'all'
              ? '試吓清除搜尋或篩選。'
              : '課題資料載入後會喺度顯示。'
          }
        />
      ) : (
        <div className="space-y-4">
          {grouped.map((part) => {
            const isCollapsed = !!collapsed[part.part]
            const c = countStatuses(progress, classId, part.items.map((t) => t.id))
            return (
              <div key={part.part}>
                <button
                  onClick={() =>
                    setCollapsed((prev) => ({ ...prev, [part.part]: !prev[part.part] }))
                  }
                  className="flex w-full items-center justify-between gap-2 py-1.5"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      {part.part}
                    </span>
                    <Badge tone="slate" className="nums">
                      {c.done}/{c.total}
                    </Badge>
                  </span>
                  <ChevronDown
                    size={16}
                    className={cx(
                      'text-slate-400 transition-transform',
                      isCollapsed ? '' : 'rotate-180',
                    )}
                  />
                </button>

                {!isCollapsed && (
                  <div className="mt-2 space-y-3">
                    {part.areas.map((area) => {
                      const ac = countStatuses(progress, classId, area.items.map((t) => t.id))
                      return (
                        <Card key={area.area} className="overflow-hidden">
                          <div className="flex items-center justify-between gap-3 bg-slate-50 px-4 py-2.5 dark:bg-slate-800/50">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-3">
                                <span className="truncate text-sm font-semibold text-slate-700 dark:text-slate-200">
                                  {area.area}
                                </span>
                                <span className="nums shrink-0 text-xs font-medium text-slate-400 dark:text-slate-500">
                                  {ac.done}/{ac.total}
                                </span>
                              </div>
                              <ProgressBar value={ac.pct} className="mt-2 h-1.5" />
                            </div>
                            <Tooltip label="整個範疇標記完成">
                              <IconButton
                                label="整個範疇標記完成"
                                size="sm"
                                onClick={() => bulkArea(area.items, 'done', area.area)}
                              >
                                <CheckCheck size={15} />
                              </IconButton>
                            </Tooltip>
                          </div>
                          <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                            {area.items.map((tp) => (
                              <TopicRow
                                key={tp.id}
                                topic={tp}
                                status={statusOf(progress, classId, tp.id)}
                                dateDone={recordOf(progress, classId, tp.id)?.dateDone}
                                plan={planOf(plans, classId, tp.id)}
                                today={today}
                                onCycle={() => cycle(tp.id)}
                                onSetStatus={(s) => setStatus(tp.id, s)}
                                onEditPlan={() => setEditing(tp)}
                              />
                            ))}
                          </ul>
                        </Card>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {editing && (
        <PlanEditor
          classId={classId}
          topic={editing}
          existing={planOf(plans, classId, editing.id)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

// ───── 單一課題列 ─────
function TopicRow({
  topic,
  status,
  dateDone,
  plan,
  today,
  onCycle,
  onSetStatus,
  onEditPlan,
}: {
  topic: Topic
  status: ProgressStatus
  dateDone?: string
  plan?: CurriculumPlan
  today: string
  onCycle: () => void
  onSetStatus: (s: ProgressStatus) => void
  onEditPlan: () => void
}) {
  const cfg = STATUS_META[status]
  const pace = paceOf(status, plan?.targetDate, today)
  const paceCfg = PACE_META[pace]

  return (
    <li className="group flex items-center gap-2 px-4 py-2.5">
      <span className={cx('h-2 w-2 shrink-0 rounded-full', cfg.dot)} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm text-slate-700 dark:text-slate-200">
            {topic.topic}
          </span>
          {status === 'done' && dateDone && (
            <span className="inline-flex shrink-0 items-center gap-0.5 text-xs text-slate-400 dark:text-slate-500">
              <Check size={12} className="text-emerald-500" />
              <span className="tabular-nums">{fmtDate(dateDone)}</span>
            </span>
          )}
        </div>
        {(plan?.targetDate || plan?.plannedWeek || plan?.periods) && (
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-400 dark:text-slate-500">
            {plan?.plannedWeek != null && <span className="tabular-nums">第 {plan.plannedWeek} 週</span>}
            {plan?.periods != null && <span className="tabular-nums">{plan.periods} 節</span>}
            {plan?.targetDate && (
              <span className={cx('inline-flex items-center gap-0.5 tabular-nums', paceCfg.text)}>
                <CalendarClock size={11} /> {fmtDate(plan.targetDate)}
                {pace !== 'none' && status !== 'done' && <span className="ml-0.5">· {paceCfg.label}</span>}
              </span>
            )}
          </div>
        )}
      </div>

      <IconButton
        label="排期 / 計劃"
        size="sm"
        onClick={onEditPlan}
        active={!!plan?.targetDate}
        className="opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100"
      >
        <CalendarClock size={15} />
      </IconButton>

      {/* 狀態快速切換（segmented 點 + 撳 badge 循環） */}
      <div className="hidden shrink-0 items-center gap-1 sm:flex">
        {(['not_started', 'in_progress', 'done'] as ProgressStatus[]).map((s) => (
          <Tooltip key={s} label={STATUS_META[s].label}>
            <button
              onClick={() => onSetStatus(s)}
              aria-label={`設為${STATUS_META[s].label}`}
              className={cx(
                'h-5 w-5 rounded-full ring-1 ring-inset transition',
                status === s
                  ? cx(STATUS_META[s].dot, 'ring-transparent')
                  : 'bg-transparent ring-slate-200 hover:ring-slate-400 dark:ring-slate-600',
              )}
            />
          </Tooltip>
        ))}
      </div>
      <button
        onClick={onCycle}
        className="shrink-0 sm:hidden"
        aria-label={`切換狀態：${cfg.label}`}
      >
        <Badge tone={cfg.tone}>{cfg.label}</Badge>
      </button>
    </li>
  )
}

// ───── 計劃編輯 Modal ─────
function PlanEditor({
  classId,
  topic,
  existing,
  onClose,
}: {
  classId: string
  topic: Topic
  existing?: CurriculumPlan
  onClose: () => void
}) {
  const toast = useToast()
  const [week, setWeek] = useState(existing?.plannedWeek?.toString() ?? '')
  const [periods, setPeriods] = useState(existing?.periods?.toString() ?? '')
  const [targetDate, setTargetDate] = useState(existing?.targetDate ?? '')
  const [note, setNote] = useState(existing?.note ?? '')

  const save = () => {
    const patch: Partial<CurriculumPlan> = {
      plannedWeek: week ? Math.max(1, Number(week)) : undefined,
      periods: periods ? Math.max(0, Number(periods)) : undefined,
      targetDate: targetDate || undefined,
      note: note.trim() || undefined,
    }
    if (existing) planCol.update(existing.id, patch)
    else planCol.add({ id: uid(), classId, topicId: topic.id, ...patch })
    toast.success('已儲存教學計劃')
    onClose()
  }

  const clear = () => {
    if (existing) planCol.remove(existing.id)
    toast.success('已清除排期')
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="教學計劃"
      size="sm"
      footer={
        <>
          {existing && (
            <Button variant="ghost" onClick={clear} className="mr-auto text-rose-600">
              清除
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button onClick={save}>儲存</Button>
        </>
      }
    >
      <p className="mb-3 text-sm font-medium text-slate-700 dark:text-slate-200">{topic.topic}</p>
      <p className="-mt-2 mb-4 text-xs text-slate-400">
        {topic.part} · {topic.area}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="教學週" hint="第幾週教">
          <Input
            type="number"
            min={1}
            value={week}
            onChange={(e) => setWeek(e.target.value.replace(/\D/g, ''))}
            placeholder="例如 3"
          />
        </Field>
        <Field label="預計節數">
          <Input
            type="number"
            min={0}
            value={periods}
            onChange={(e) => setPeriods(e.target.value.replace(/\D/g, ''))}
            placeholder="例如 4"
          />
        </Field>
      </div>
      <div className="mt-3">
        <Field label="目標完成日" hint="用嚟判斷進度落後 / 準時">
          <Input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
          />
        </Field>
      </div>
      <div className="mt-3">
        <Field label="備註（選填）">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="例如 配合中期考" />
        </Field>
      </div>
    </Modal>
  )
}

// ════════════════════════════════════════════════════════════
//  教學進度表（Scheme of Work / pacing 表）
//  按教學週排序，顯示計劃週、節數、目標日、pace 燈號
// ════════════════════════════════════════════════════════════
function ScheduleView({
  classId,
  className,
  topics,
}: {
  classId: string
  className: string
  topics: Topic[]
}) {
  const toast = useToast()
  const progress = useCollection(progressCol)
  const plans = useCollection(planCol)
  const today = todayKey()
  const [paceFilter, setPaceFilter] = useState<'all' | PaceState>('all')

  const rows = useMemo(() => {
    const list = topics.map((t) => {
      const st = statusOf(progress, classId, t.id)
      const plan = planOf(plans, classId, t.id)
      const pace = paceOf(st, plan?.targetDate, today)
      return { topic: t, status: st, plan, pace }
    })
    // 排序：有教學週嘅排前（按週），其餘按 order
    list.sort((a, b) => {
      const aw = a.plan?.plannedWeek
      const bw = b.plan?.plannedWeek
      if (aw != null && bw != null) return aw - bw
      if (aw != null) return -1
      if (bw != null) return 1
      return a.topic.order - b.topic.order
    })
    return list
  }, [topics, progress, plans, classId, today])

  const filtered = paceFilter === 'all' ? rows : rows.filter((r) => r.pace === paceFilter)

  const scheduledCount = rows.filter((r) => r.plan?.targetDate || r.plan?.plannedWeek).length
  const totalPeriods = rows.reduce((s, r) => s + (r.plan?.periods ?? 0), 0)
  const behindCount = rows.filter((r) => r.pace === 'behind').length

  const exportCsv = () => {
    const out: (string | number)[][] = [['教學週', '課題', '範疇', '節數', '目標完成日', '狀態', '進度']]
    for (const r of rows) {
      out.push([
        r.plan?.plannedWeek ?? '',
        r.topic.topic,
        r.topic.area,
        r.plan?.periods ?? '',
        r.plan?.targetDate ?? '',
        STATUS_META[r.status].label,
        PACE_META[r.pace].label,
      ])
    }
    downloadCsv(`${className}_教學進度表.csv`, out)
    toast.success('已匯出教學進度表 CSV')
  }

  if (topics.length === 0) {
    return <EmptyState icon={ClipboardList} title="仲未有課題" hint="課題資料載入後會喺度顯示。" />
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="已排期課題" value={scheduledCount} unit={`/ ${topics.length}`} icon={CalendarClock} />
        <StatCard label="計劃總節數" value={totalPeriods} unit="節" icon={Gauge} />
        <StatCard
          label="落後課題"
          value={behindCount}
          unit="個"
          icon={Hourglass}
          highlight={behindCount > 0}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-400 dark:text-slate-500">進度狀態</span>
          <SegmentedControl<'all' | PaceState>
            size="sm"
            value={paceFilter}
            onChange={setPaceFilter}
            options={[
              { id: 'all', label: '全部' },
              { id: 'behind', label: '落後' },
              { id: 'due_soon', label: '臨近' },
              { id: 'ahead', label: '超前' },
              { id: 'none', label: '未排期' },
            ]}
          />
        </div>
        <Button variant="secondary" size="sm" icon={Download} onClick={exportCsv}>
          匯出 CSV
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={CalendarClock} title="冇符合嘅課題" hint="試吓切換上面嘅進度狀態篩選。" />
      ) : (
        <Table>
          <Thead>
            <Tr>
              <Th align="center">週</Th>
              <Th>課題</Th>
              <Th align="center">節數</Th>
              <Th align="center">目標日</Th>
              <Th align="center">進度</Th>
            </Tr>
          </Thead>
          <Tbody>
            {filtered.map((r) => {
              const cfg = STATUS_META[r.status]
              const paceCfg = PACE_META[r.pace]
              return (
                <Tr key={r.topic.id}>
                  <Td align="center">
                    {r.plan?.plannedWeek != null ? (
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent-soft text-xs font-bold tabular-nums text-accent-strong dark:bg-accent/15 dark:text-accent">
                        {r.plan.plannedWeek}
                      </span>
                    ) : (
                      <span className="text-slate-300 dark:text-slate-600">—</span>
                    )}
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <span className={cx('h-2 w-2 shrink-0 rounded-full', cfg.dot)} />
                      <div className="min-w-0">
                        <div className="truncate font-medium text-slate-700 dark:text-slate-200">
                          {r.topic.topic}
                        </div>
                        <div className="truncate text-xs text-slate-400 dark:text-slate-500">
                          {r.topic.area}
                        </div>
                      </div>
                    </div>
                  </Td>
                  <Td numeric>{r.plan?.periods ?? '—'}</Td>
                  <Td align="center">
                    {r.plan?.targetDate ? (
                      <span className="tabular-nums text-slate-600 dark:text-slate-300">
                        {fmtDate(r.plan.targetDate)}
                      </span>
                    ) : (
                      <span className="text-slate-300 dark:text-slate-600">—</span>
                    )}
                  </Td>
                  <Td align="center">
                    <Badge tone={paceCfg.tone}>
                      {r.status === 'done' ? '完成' : paceCfg.label}
                    </Badge>
                  </Td>
                </Tr>
              )
            })}
          </Tbody>
        </Table>
      )}
      <p className="text-xs text-slate-400 dark:text-slate-500">
        想排期？喺「進度清單」每個課題撳 <CalendarClock size={12} className="inline" /> 設定教學週、節數同目標完成日。
      </p>
    </div>
  )
}

// ════════════════════════════════════════════════════════════
//  全校對照（課題 × 班別 覆蓋矩陣 heatmap）
// ════════════════════════════════════════════════════════════
function MatrixView({
  classes,
  topics,
}: {
  classes: { id: string; name: string }[]
  topics: Topic[]
}) {
  const toast = useToast()
  const progress = useCollection(progressCol)
  const grouped = useMemo(() => groupTopics(topics), [topics])

  const cellMeta = (status: ProgressStatus) => {
    if (status === 'done')
      return { cls: 'bg-emerald-500 text-white', label: '完成', mark: '✓' }
    if (status === 'in_progress')
      return {
        cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
        label: '進行中',
        mark: '◐',
      }
    return {
      cls: 'bg-slate-50 text-slate-300 dark:bg-slate-800/60 dark:text-slate-600',
      label: '未開始',
      mark: '·',
    }
  }

  // 每班完成度（用嚟做表尾）
  const classPct = (cid: string) =>
    countStatuses(progress, cid, topics.map((t) => t.id)).pct

  const exportCsv = () => {
    const head = ['範疇', '課題', ...classes.map((c) => c.name)]
    const out: (string | number)[][] = [head]
    for (const t of [...topics].sort((a, b) => a.order - b.order)) {
      out.push([
        t.area,
        t.topic,
        ...classes.map((c) => STATUS_META[statusOf(progress, c.id, t.id)].label),
      ])
    }
    downloadCsv('全校課程對照.csv', out)
    toast.success('已匯出全校對照 CSV')
  }

  if (topics.length === 0) {
    return <EmptyState icon={Columns3} title="仲未有課題" hint="課題資料載入後會喺度顯示。" />
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm bg-emerald-500" /> 完成
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm bg-amber-100 dark:bg-amber-500/20" /> 進行中
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm bg-slate-100 dark:bg-slate-800" /> 未開始
          </span>
        </div>
        <Button variant="secondary" size="sm" icon={Download} onClick={exportCsv}>
          匯出 CSV
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700/60">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50/80 dark:bg-slate-800/60">
              <th className="sticky left-0 z-10 bg-slate-50/80 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 backdrop-blur dark:bg-slate-800/90 dark:text-slate-400">
                課題
              </th>
              {classes.map((c) => (
                <th
                  key={c.id}
                  className="px-2 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                >
                  {c.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grouped.map((part) =>
              part.areas.map((area, ai) => (
                <RowGroup
                  key={`${part.part}-${area.area}`}
                  showPart={ai === 0 ? part.part : undefined}
                  area={area.area}
                  items={area.items}
                  classes={classes}
                  cellMeta={cellMeta}
                  statusFor={(cid, tid) => statusOf(progress, cid, tid)}
                />
              )),
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">
              <td className="sticky left-0 z-10 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                完成度
              </td>
              {classes.map((c) => {
                const pct = classPct(c.id)
                return (
                  <td key={c.id} className="px-2 py-2 text-center">
                    <span
                      className={cx(
                        'text-xs font-bold tabular-nums',
                        pct >= 75
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : pct >= 40
                            ? 'text-accent'
                            : 'text-slate-500 dark:text-slate-400',
                      )}
                    >
                      {pct}%
                    </span>
                  </td>
                )
              })}
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-xs text-slate-400 dark:text-slate-500">
        一眼睇晒所有班別嘅課程覆蓋差異 — 邊班落後、邊個課題未開，立即見到。
      </p>
    </div>
  )
}

// matrix 一個範疇嘅 rows（含 area 標頭列）
function RowGroup({
  showPart,
  area,
  items,
  classes,
  cellMeta,
  statusFor,
}: {
  showPart?: string
  area: string
  items: Topic[]
  classes: { id: string; name: string }[]
  cellMeta: (s: ProgressStatus) => { cls: string; label: string; mark: string }
  statusFor: (classId: string, topicId: string) => ProgressStatus
}) {
  return (
    <>
      {showPart && (
        <tr className="bg-slate-100/60 dark:bg-slate-800/40">
          <td
            colSpan={classes.length + 1}
            className="sticky left-0 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500"
          >
            {showPart}
          </td>
        </tr>
      )}
      <tr className="border-t border-slate-100 dark:border-slate-800">
        <td
          colSpan={classes.length + 1}
          className="sticky left-0 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300"
        >
          {area}
        </td>
      </tr>
      {items.map((t) => (
        <tr key={t.id} className="border-t border-slate-100 dark:border-slate-800">
          <td className="sticky left-0 z-10 bg-white px-3 py-2 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            <span className="block max-w-[200px] truncate">{t.topic}</span>
          </td>
          {classes.map((c) => {
            const m = cellMeta(statusFor(c.id, t.id))
            return (
              <td key={c.id} className="px-1.5 py-1.5 text-center">
                <Tooltip label={`${c.name} · ${m.label}`}>
                  <span
                    className={cx(
                      'inline-flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold',
                      m.cls,
                    )}
                  >
                    {m.mark}
                  </span>
                </Tooltip>
              </td>
            )
          })}
        </tr>
      ))}
    </>
  )
}

// ════════════════════════════════════════════════════════════
//  分析（自製 SVG 圖表：donut / pacing 折線 / 範疇橫條）
// ════════════════════════════════════════════════════════════
function AnalysisView({
  classId,
  className,
  topics,
}: {
  classId: string
  className: string
  topics: Topic[]
}) {
  const progress = useCollection(progressCol)
  const plans = useCollection(planCol)
  const today = todayKey()

  const overall = useMemo(
    () => countStatuses(progress, classId, topics.map((t) => t.id)),
    [progress, classId, topics],
  )

  // 各範疇完成度（由弱到強）
  const areaRows = useMemo(() => {
    const grouped = groupTopics(topics)
    const rows: { label: string; pct: number; done: number; total: number }[] = []
    for (const part of grouped)
      for (const area of part.areas) {
        const c = countStatuses(progress, classId, area.items.map((t) => t.id))
        rows.push({ label: area.area, pct: c.pct, done: c.done, total: c.total })
      }
    return rows.sort((a, b) => a.pct - b.pct)
  }, [topics, progress, classId])

  // 計劃 vs 實際累積（按月 bucket）
  const pacing = useMemo<PacingPoint[]>(() => {
    // 收集所有目標月 + 完成月
    const monthKey = (iso: string) => iso.slice(0, 7) // YYYY-MM
    const planned: string[] = []
    const done: string[] = []
    for (const t of topics) {
      const p = planOf(plans, classId, t.id)
      if (p?.targetDate) planned.push(monthKey(p.targetDate))
      const rec = recordOf(progress, classId, t.id)
      if (rec?.status === 'done' && rec.dateDone) done.push(monthKey(rec.dateDone))
    }
    if (planned.length === 0 && done.length === 0) return []

    const months = Array.from(new Set([...planned, ...done])).sort()
    const nowMonth = today.slice(0, 7)
    if (!months.includes(nowMonth)) {
      months.push(nowMonth)
      months.sort()
    }

    let cumPlan = 0
    let cumDone = 0
    return months.map((m) => {
      cumPlan += planned.filter((x) => x === m).length
      cumDone += done.filter((x) => x === m).length
      const [, mm] = m.split('-')
      return {
        label: `${Number(mm)}月`,
        planned: cumPlan,
        actual: m <= nowMonth ? cumDone : null,
      }
    })
  }, [topics, plans, progress, classId, today])

  // 落後 / 臨近課題 list
  const attention = useMemo(() => {
    return topics
      .map((t) => {
        const st = statusOf(progress, classId, t.id)
        const p = planOf(plans, classId, t.id)
        return { topic: t, pace: paceOf(st, p?.targetDate, today), target: p?.targetDate }
      })
      .filter((x) => x.pace === 'behind' || x.pace === 'due_soon')
      .sort((a, b) => (a.target ?? '').localeCompare(b.target ?? ''))
  }, [topics, progress, plans, classId, today])

  if (topics.length === 0) {
    return <EmptyState icon={TrendingUp} title="仲未有課題" hint="課題資料載入後會喺度顯示。" />
  }

  const donutSegments = [
    { value: overall.done, color: 'green' as const, label: '完成' },
    { value: overall.inProgress, color: 'amber' as const, label: '進行中' },
    { value: overall.notStarted, color: 'slate' as const, label: '未開始' },
  ]

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        {/* 完成度 donut */}
        <Card className="p-4">
          <SectionTitle icon={Target}>整體完成度</SectionTitle>
          <DonutWithLegend
            segments={donutSegments}
            centerLabel={`${overall.pct}%`}
            centerSub={`${overall.done}/${overall.total} 課題`}
          />
        </Card>

        {/* 範疇橫條 */}
        <Card className="p-4">
          <SectionTitle icon={LayoutList}>各範疇完成度（由弱到強）</SectionTitle>
          {areaRows.length === 0 ? (
            <p className="text-sm text-slate-400">未有資料。</p>
          ) : (
            <AreaBars rows={areaRows} />
          )}
        </Card>
      </div>

      {/* 計劃 vs 實際 折線圖 */}
      <Card className="p-4">
        <SectionTitle
          icon={TrendingUp}
          right={
            <span className="flex items-center gap-3 text-[11px] text-slate-400 dark:text-slate-500">
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-0.5 w-4 border-t-2 border-dashed border-slate-400" /> 計劃
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-0.5 w-4 bg-emerald-500" /> 實際
              </span>
            </span>
          }
        >
          {className} 教學進度（累積完成）
        </SectionTitle>
        {pacing.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">
            喺「進度清單」為課題設定目標完成日，呢度就會畫出計劃對實際嘅進度線。
          </p>
        ) : (
          <PacingChart points={pacing} total={overall.total} />
        )}
      </Card>

      {/* 需關注課題 */}
      <Card className="p-4">
        <SectionTitle icon={CalendarClock}>需關注課題（落後 / 臨近死線）</SectionTitle>
        {attention.length === 0 ? (
          <p className="flex items-center gap-1.5 text-sm text-slate-400">
            <Check size={15} className="text-emerald-500" /> 暫時冇落後或臨近死線嘅課題。
          </p>
        ) : (
          <ul className="space-y-2">
            {attention.map((a) => {
              const cfg = PACE_META[a.pace]
              return (
                <li
                  key={a.topic.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2 dark:border-slate-700/60"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm text-slate-700 dark:text-slate-200">
                      {a.topic.topic}
                    </div>
                    <div className="truncate text-xs text-slate-400 dark:text-slate-500">
                      {a.topic.area}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {a.target && (
                      <span className="tabular-nums text-xs text-slate-400">{fmtDate(a.target)}</span>
                    )}
                    <Badge tone={cfg.tone} icon={a.pace === 'behind' ? X : Hourglass}>
                      {cfg.label}
                    </Badge>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </div>
  )
}
