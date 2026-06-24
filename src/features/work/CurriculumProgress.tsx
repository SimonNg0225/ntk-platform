import { useMemo, useState } from 'react'
import {
  CalendarClock,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CircleCheckBig,
  CircleDashed,
  ClipboardList,
  Columns3,
  Download,
  Flag,
  Gauge,
  LayoutList,
  ListChecks,
  Printer,
  Route,
  School,
  Search,
  SlidersHorizontal,
  TrendingUp,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useCollection, createCollection, uid } from '../../lib/store'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import { useSubjectLabel } from '../../context/SettingsContext'
import { useNav } from '../../context/NavContext'
import { classesCol, topicsCol, progressCol } from '../../data/collections'
import type { ProgressStatus, Topic } from '../../data/types'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  FeatureGuide,
  Field,
  IconButton,
  Input,
  Modal,
  PageHero,
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
import type { FeatureGuideStep } from '../../ui'
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
  toKey,
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

// ───────── tone map（跟 WorkDashboard：chip 底 + 數字字）─────────
type Tone = 'accent' | 'amber' | 'emerald' | 'violet' | 'sky' | 'rose'
const TONE: Record<Tone, { chip: string; val: string }> = {
  accent: { chip: 'bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent', val: 'text-accent' },
  amber: { chip: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300', val: 'text-amber-500' },
  emerald: { chip: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300', val: 'text-emerald-500' },
  violet: { chip: 'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300', val: 'text-violet-500' },
  sky: { chip: 'bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300', val: 'text-sky-500' },
  rose: { chip: 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300', val: 'text-rose-500' },
}

// 1×1 統計磚（chip icon + tabular-nums；純展示，唔可點）
function StatTile({
  label,
  value,
  unit,
  hint,
  icon: Icon,
  tone,
}: {
  label: string
  value: number | string
  unit?: string
  hint?: string
  icon: LucideIcon
  tone: Tone
}) {
  const t = TONE[tone]
  return (
    <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-700/60 dark:bg-slate-800">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-400 dark:text-slate-500">{label}</span>
        <span className={cx('flex h-8 w-8 items-center justify-center rounded-xl', t.chip)}>
          <Icon size={16} />
        </span>
      </div>
      <div className="mt-3">
        <p className="flex items-baseline gap-1">
          <span className={cx('text-3xl font-semibold tabular-nums slashed-zero', t.val)}>{value}</span>
          {unit && <span className="text-sm font-medium text-slate-400">{unit}</span>}
        </p>
        {hint && <p className="mt-0.5 truncate text-[11px] text-slate-400">{hint}</p>}
      </div>
    </div>
  )
}

// 功能教學引導步驟（defaultValue 廣東話，唔改 i18n 檔）
const PROGRESS_GUIDE: FeatureGuideStep[] = [
  { title: '揀班別', desc: '喺上方揀返要追進度嘅班，下面就會載入該班嘅課程大綱。' },
  { title: '標記進度', desc: '逐個課題撳一下，喺未開始 / 進行中 / 完成之間切換；可整個範疇一鍵標完成。' },
  { title: '排期睇進度', desc: '撳課題旁嘅排期掣設目標完成日，「教學進度表」同「分析」就會睇到落後 / 超前。' },
]

export default function CurriculumProgress() {
  const classes = useCollection(classesCol)
  const topics = useCollection(topicsCol)
  const progress = useCollection(progressCol)
  const subj = useSubjectLabel()
  const { open } = useNav()
  const [classId, setClassId] = useState<string>(classes[0]?.id ?? '')
  const [view, setView] = useState<ViewTab>('list')

  const activeClass = classes.find((c) => c.id === classId) ?? classes[0]

  // 當前班別整體完成度（masthead 進度條用）。
  const journey = useMemo(
    () =>
      activeClass
        ? countStatuses(progress, activeClass.id, topics.map((t) => t.id))
        : { done: 0, inProgress: 0, notStarted: 0, total: 0, pct: 0 },
    [progress, activeClass, topics],
  )

  if (classes.length === 0) {
    return (
      <div className="space-y-5">
        <PageHero
          guideKey="curriculumProgress"
          icon={Route}
          kicker="Curriculum Progress"
          title="課程進度"
          description={`沿住${subj.name}課程大綱追蹤每班教到邊。`}
        />
        <EmptyState
          icon={School}
          title="仲未有班別"
          hint={`先去「班別管理」開一班，就可以喺呢度追蹤${subj.name}課程進度。`}
          action={
            <Button size="sm" variant="secondary" icon={ChevronRight} onClick={() => open('work-classes')}>
              去班別管理
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHero
        icon={Route}
        kicker="Curriculum Progress"
        title="課程進度"
        description={`沿住${subj.name}課程大綱追蹤每班教到邊。`}
      />

      <FeatureGuide storageKey="curriculumProgress" title="課程進度點用？" steps={PROGRESS_GUIDE} />

      {/* 班別選擇（純展示卡） */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-700/60 dark:bg-slate-800">
        <div className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-300">
          <School size={13} /> 班別
        </div>
        <Pills
          size="sm"
          options={classes.map((c) => ({ id: c.id, label: c.name }))}
          active={activeClass?.id ?? ''}
          onChange={setClassId}
        />
        {activeClass && journey.total > 0 && (
          <div className="mt-3.5 border-t border-slate-200 pt-3 dark:border-slate-700">
            <div className="flex items-end justify-between gap-3">
              <span className="text-xs text-slate-400 dark:text-slate-500">
                {activeClass.name} · 已完成 {journey.done} / {journey.total} 個課題
              </span>
              <span className="text-2xl font-semibold leading-none text-accent tabular-nums slashed-zero">
                {journey.pct}%
              </span>
            </div>
            <ProgressBar value={journey.pct} className="mt-2" />
          </div>
        )}
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
  const subj = useSubjectLabel()
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
      {/* 進度統計磚 */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="課題總數" value={topics.length} unit="個" icon={ListChecks} tone="accent" />
        <StatTile
          label="已完成"
          value={overall.done}
          unit="個"
          icon={CircleCheckBig}
          tone="emerald"
          hint={`完成度 ${overall.pct}%`}
        />
        <StatTile label="進行中" value={overall.inProgress} unit="個" icon={CircleDashed} tone="amber" />
        <StatTile
          label="落後"
          value={behindCount}
          unit="個"
          icon={CalendarClock}
          tone={behindCount > 0 ? 'rose' : 'sky'}
          hint={behindCount > 0 ? '已過目標完成日' : '全部準時'}
        />
      </section>

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
              type="button"
              onClick={toggleAll}
              className="ml-auto text-xs font-medium text-accent-strong hover:underline dark:text-accent"
            >
              {allCollapsed ? '全部展開' : '全部收起'}
            </button>
          )}
        </div>
      </Card>

      {/* 課題清單：部分 → 範疇 → 課題 */}
      <div aria-live="polite">
      {grouped.length === 0 ? (
        (query || statusFilter !== 'all' || partFilter !== 'all') ? (
          <EmptyState
            icon={Search}
            title="冇符合嘅課題"
            hint="清除搜尋或篩選，就會見返所有課題。"
            action={
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setQuery('')
                  setStatusFilter('all')
                  setPartFilter('all')
                }}
              >
                清除篩選
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={Route}
            title="仲未有課題"
            hint={`${subj.name}課程大綱載入後，課題會喺度逐個列出，到時就可以開始標記進度。`}
          />
        )
      ) : (
        <div className="space-y-4">
          {grouped.map((part, pi) => {
            const isCollapsed = !!collapsed[part.part]
            const c = countStatuses(progress, classId, part.items.map((t) => t.id))
            const cleared = c.total > 0 && c.done === c.total
            return (
              <section key={part.part}>
                <button
                  type="button"
                  onClick={() =>
                    setCollapsed((prev) => ({ ...prev, [part.part]: !prev[part.part] }))
                  }
                  aria-expanded={!isCollapsed}
                  className="group flex w-full items-center justify-between gap-2 rounded-xl py-1 text-left transition active:scale-[0.98]"
                >
                  <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    {/* 序號 chip */}
                    <span
                      aria-hidden="true"
                      className={cx(
                        'flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-semibold tabular-nums',
                        cleared
                          ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300'
                          : 'bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent',
                      )}
                    >
                      {cleared ? <Check size={13} strokeWidth={3} /> : pi + 1}
                    </span>
                    <span className="text-base font-semibold tracking-tight text-slate-700 dark:text-slate-200">
                      {part.part}
                    </span>
                    <Badge tone={cleared ? 'green' : 'slate'} className="tabular-nums">
                      {c.done}/{c.total}
                    </Badge>
                  </span>
                  <ChevronDown
                    size={16}
                    className={cx(
                      'shrink-0 text-slate-400 transition-transform group-hover:text-slate-600 dark:group-hover:text-slate-300',
                      isCollapsed ? '' : 'rotate-180',
                    )}
                  />
                </button>

                {!isCollapsed && (
                  <div className="mt-2 space-y-3">
                    {part.areas.map((area) => {
                      const ac = countStatuses(progress, classId, area.items.map((t) => t.id))
                      const areaCleared = ac.total > 0 && ac.done === ac.total
                      return (
                        <Card key={area.area} clip className="rounded-2xl">
                          <div
                            className={cx(
                              'flex items-center justify-between gap-3 px-4 py-2.5',
                              areaCleared
                                ? 'bg-emerald-50/70 dark:bg-emerald-500/10'
                                : 'bg-slate-50 dark:bg-slate-800/50',
                            )}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-3">
                                <span className="truncate text-sm font-semibold text-slate-700 dark:text-slate-200">
                                  {area.area}
                                </span>
                                <span
                                  className={cx(
                                    'shrink-0 text-xs font-medium tabular-nums',
                                    areaCleared
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : 'text-slate-400 dark:text-slate-500',
                                  )}
                                >
                                  {ac.done}/{ac.total}
                                </span>
                              </div>
                              <ProgressBar
                                value={ac.pct}
                                tone={areaCleared ? 'green' : 'accent'}
                                className="mt-2 h-1.5"
                              />
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
                          <ul>
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
              </section>
            )
          })}
        </div>
      )}
      </div>

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

// ───── 單一課題列：狀態色點 + 課題名 + 排期資訊 + 狀態切換 ─────
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
  const done = status === 'done'
  const inProgress = status === 'in_progress'

  return (
    <li className="group relative flex items-center gap-2.5 px-4 py-2.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60">
      {/* 狀態色點 */}
      <span
        aria-hidden="true"
        className={cx(
          'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full transition-colors',
          done
            ? 'bg-emerald-500'
            : inProgress
              ? 'bg-amber-400'
              : 'border-2 border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800',
        )}
      >
        {done && <Check size={9} strokeWidth={4} className="text-white" />}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className={cx(
              'truncate text-sm',
              done
                ? 'text-slate-500 dark:text-slate-400'
                : 'text-slate-700 dark:text-slate-200',
            )}
          >
            {topic.topic}
          </span>
          {done && dateDone && (
            <span className="inline-flex shrink-0 items-center gap-0.5 text-xs text-slate-400 dark:text-slate-500">
              <Flag size={11} className="text-emerald-500" />
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
        className="opacity-100 sm:opacity-0 sm:transition sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
      >
        <CalendarClock size={15} />
      </IconButton>

      {/* 狀態快速切換（segmented 點 + 撳 badge 循環） */}
      <div className="hidden shrink-0 items-center gap-1 sm:flex">
        {(['not_started', 'in_progress', 'done'] as ProgressStatus[]).map((s) => (
          <Tooltip key={s} label={STATUS_META[s].label}>
            <button
              type="button"
              onClick={() => onSetStatus(s)}
              aria-label={`設為${STATUS_META[s].label}`}
              aria-pressed={status === s}
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
        type="button"
        onClick={onCycle}
        className="shrink-0 transition active:scale-[0.98] sm:hidden"
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
    return <EmptyState icon={ClipboardList} title="仲未有課題" hint="課程大綱載入後，呢度會按教學週列出每個課題嘅進度表。" />
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="已排期" value={scheduledCount} unit={`/ ${topics.length}`} icon={CalendarClock} />
        <StatCard label="總節數" value={totalPeriods} unit="節" icon={Gauge} />
        <StatCard
          label="落後課題"
          value={behindCount}
          unit="個"
          icon={CalendarClock}
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
        <EmptyState
          icon={CalendarClock}
          title="冇符合嘅課題"
          hint="試吓切換上面嘅進度狀態篩選。"
          action={
            <Button size="sm" variant="secondary" onClick={() => setPaceFilter('all')}>
              睇全部
            </Button>
          }
        />
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
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold tabular-nums text-accent-strong dark:bg-accent/15 dark:text-accent">
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
            <span className="h-3 w-3 rounded bg-emerald-500" /> 完成
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-amber-100 dark:bg-amber-500/20" /> 進行中
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-slate-100 dark:bg-slate-800" /> 未開始
          </span>
        </div>
        <Button variant="secondary" size="sm" icon={Download} onClick={exportCsv}>
          匯出 CSV
        </Button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-slate-700/60">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50/80 dark:bg-slate-800/60">
              <th className="sticky left-0 z-10 bg-slate-50/80 px-3 py-2.5 text-left text-xs font-semibold text-slate-500 backdrop-blur dark:bg-slate-800/90 dark:text-slate-400">
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
                        'text-xs font-semibold tabular-nums',
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
        一眼比較所有班別嘅課程覆蓋 — 邊班落後、邊個課題未開始，即刻見到。
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
            className="sticky left-0 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500"
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
                      'inline-flex h-7 w-7 items-center justify-center rounded-lg text-xs font-semibold',
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
    // targetDate 係純日期（YYYY-MM-DD）；dateDone 係完整 ISO（toISOString，UTC）。
    // 完整 ISO 要先轉本地日期，先同 targetDate / nowMonth（皆本地）一致，
    // 否則 UTC 以東時區（如香港 +8）月底完成會被算入下一個月。
    const monthKey = (iso: string) =>
      (iso.includes('T') ? toKey(new Date(iso)) : iso).slice(0, 7) // YYYY-MM
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
          <SectionTitle icon={Route}>整體完成度</SectionTitle>
          <DonutWithLegend
            segments={donutSegments}
            centerLabel={`${overall.pct}%`}
            centerSub={`${overall.done}/${overall.total} 個課題`}
          />
        </Card>

        {/* 範疇橫條 */}
        <Card className="p-4">
          <SectionTitle icon={LayoutList}>各範疇完成度（由低到高）</SectionTitle>
          {areaRows.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">未有資料。</p>
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
          {className} 累積完成進度
        </SectionTitle>
        {pacing.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
              <CalendarClock size={22} />
            </span>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">仲未有排期資料</p>
            <p className="max-w-xs text-xs text-slate-400">
              喺「進度清單」為課題設定目標完成日，呢度就會畫出計劃對實際嘅完成曲線。
            </p>
          </div>
        ) : (
          <PacingChart points={pacing} total={overall.total} />
        )}
      </Card>

      {/* 需關注課題 */}
      <Card className="p-4">
        <SectionTitle icon={CalendarClock}>需要關注嘅課題（落後 / 臨近死線）</SectionTitle>
        {attention.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-500 dark:bg-emerald-500/15">
              <CircleCheckBig size={22} />
            </span>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">進度準時</p>
            <p className="max-w-xs text-xs text-slate-400">暫時冇落後或臨近死線嘅課題。</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {attention.map((a) => {
              const cfg = PACE_META[a.pace]
              return (
                <li
                  key={a.topic.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-slate-200/80 px-3 py-2 dark:border-slate-700/60"
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
                    <Badge tone={cfg.tone} icon={a.pace === 'behind' ? X : CalendarClock}>
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
