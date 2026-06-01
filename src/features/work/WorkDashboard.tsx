import { useEffect, useMemo, useState } from 'react'
import { useCollection } from '../../lib/store'
import {
  tasksCol,
  timetableCol,
  cycleCalendarCol,
  classesCol,
  eventsCol,
  calendarsCol,
  parentCommsCol,
  progressCol,
  topicsCol,
  attendanceCol,
  scoresCol,
  assessmentsCol,
  countdownsCol,
  inboxCol,
} from '../../data/collections'
import { taskMetaCol } from './todo/store'
import { cycleDayForDate } from './timetable/util'
import { useNav } from '../../context/NavContext'
import { useToast } from '../../context/ToastContext'
import {
  Button,
  Card,
  Badge,
  SectionTitle,
  EmptyState,
  ProgressBar,
  IconButton,
  Input,
  SegmentedControl,
  Tooltip,
  Kbd,
  Menu,
  cx,
} from '../../ui'
import {
  NotebookPen,
  BookMarked,
  Phone,
  Calendar,
  CalendarDays,
  CheckSquare,
  Palmtree,
  PartyPopper,
  School,
  LayoutGrid,
  Settings2,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  RotateCcw,
  Send,
  Inbox as InboxIcon,
  Clock,
  GraduationCap,
  TrendingUp,
  Users,
  Flame,
  Check,
  ChevronRight,
  Sparkles,
  ClipboardList,
  Pencil,
  Zap,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  WEEKDAY_LABELS,
  localKey,
  addKey,
  greeting,
  mergeTasks,
  buildTaskTrend,
  buildHeat,
  completionStreak,
  completedInRange,
  buildAgenda,
  buildClassProgress,
  overallProgressPercent,
  buildAttendance,
  buildGradeSummary,
  buildWeekLoad,
  buildFollowUps,
  buildCountdowns,
  COUNTDOWN_META,
} from './dashboard/util'
import {
  TaskTrendChart,
  HeatStrip,
  Donut,
  GradeHistogram,
  WeekLoadBars,
  MiniRing,
} from './dashboard/Charts'
import {
  dashboardLayoutCol,
  readLayout,
  toggleWidget,
  moveWidget,
  setRange,
  setGreetingName,
  resetLayout,
} from './dashboard/store'
import type { AgendaItem, Kpi, WidgetId } from './dashboard/types'

// ─────────────────────────────────────────────
//  Widget 中繼資料（標題 / 圖示 / 編輯模式標籤）
// ─────────────────────────────────────────────
const WIDGET_META: Record<WidgetId, { label: string; icon: LucideIcon }> = {
  kpi: { label: '關鍵指標', icon: TrendingUp },
  focus: { label: '今日聚焦', icon: Sparkles },
  agenda: { label: '今日議程', icon: Clock },
  taskTrend: { label: '待辦完成趨勢', icon: CheckSquare },
  curriculum: { label: '各班課程進度', icon: School },
  attendance: { label: '出席率', icon: Users },
  grades: { label: '成績分布', icon: GraduationCap },
  parentFollowUp: { label: '待跟進家長', icon: Phone },
  countdown: { label: '重要日子倒數', icon: Clock },
  classLoad: { label: '本週課擔', icon: BookMarked },
  quickActions: { label: '快速動作', icon: LayoutGrid },
}

const KPI_ICON: Record<Kpi['icon'], LucideIcon> = {
  tasks: NotebookPen,
  class: BookMarked,
  parent: Phone,
  event: Calendar,
}

// ─────────────────────────────────────────────
//  Bento 共用：分類色調 + 1×1 統計磚（同個人儀表板一致；
//  accent 自動跟模式＝青藍，唔硬寫 hex）
// ─────────────────────────────────────────────
type Tone = 'accent' | 'amber' | 'emerald' | 'violet' | 'sky' | 'rose'
const TONE: Record<Tone, { chip: string; val: string }> = {
  accent: { chip: 'bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent', val: 'text-accent' },
  amber: { chip: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300', val: 'text-amber-500' },
  emerald: { chip: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300', val: 'text-emerald-500' },
  violet: { chip: 'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300', val: 'text-violet-500' },
  sky: { chip: 'bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300', val: 'text-sky-500' },
  rose: { chip: 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300', val: 'text-rose-500' },
}

// 1×1 統計磚（圖示 chip + tabular-nums + 可選週對比箭咀）
function StatTile({
  label, value, unit, hint, icon: Icon, tone, delta, onClick, span,
}: {
  label: string
  value: number | string
  unit?: string
  hint?: string
  icon: LucideIcon
  tone: Tone
  delta?: { dir: 'up' | 'down' | 'flat'; text: string }
  onClick: () => void
  span?: string
}) {
  const t = TONE[tone]
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'group flex cursor-pointer flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:border-slate-700/60 dark:bg-slate-800 dark:hover:border-slate-600',
        span,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-400 dark:text-slate-500">{label}</span>
        <span className={cx('flex h-8 w-8 items-center justify-center rounded-xl transition group-hover:scale-105', t.chip)}>
          <Icon size={16} />
        </span>
      </div>
      <div>
        <p className="flex items-baseline gap-1">
          <span className={cx('text-3xl font-bold tabular-nums slashed-zero', t.val)}>{value}</span>
          {unit && <span className="text-sm font-medium text-slate-400">{unit}</span>}
          {delta && delta.dir !== 'flat' && (
            <span
              className={cx(
                'ml-auto text-xs font-semibold tabular-nums',
                delta.dir === 'up' ? 'text-emerald-500' : 'text-rose-500',
              )}
            >
              {delta.dir === 'up' ? '↑' : '↓'} {delta.text}
            </span>
          )}
        </p>
        {hint && <p className="mt-0.5 truncate text-[11px] text-slate-400">{hint}</p>}
      </div>
    </button>
  )
}

// 跳功能用嘅鍵盤捷徑（1–6）
const SHORTCUTS: { key: string; nav: string; label: string }[] = [
  { key: '1', nav: 'work-tasks', label: '待辦' },
  { key: '2', nav: 'work-timetable', label: '時間表' },
  { key: '3', nav: 'work-attendance', label: '點名' },
  { key: '4', nav: 'work-gradebook', label: '成績' },
  { key: '5', nav: 'calendar', label: '行事曆' },
  { key: '6', nav: 'work-ai', label: 'AI' },
]

export default function WorkDashboard() {
  const { open } = useNav()
  const toast = useToast()

  // ── 共用資料（跨功能彙整來源）──
  const tasks = useCollection(tasksCol)
  const taskMetas = useCollection(taskMetaCol)
  const timetable = useCollection(timetableCol)
  const classes = useCollection(classesCol)
  const events = useCollection(eventsCol)
  const calendars = useCollection(calendarsCol)
  const parentComms = useCollection(parentCommsCol)
  const progress = useCollection(progressCol)
  const topics = useCollection(topicsCol)
  const attendance = useCollection(attendanceCol)
  const scores = useCollection(scoresCol)
  const assessments = useCollection(assessmentsCol)
  const countdowns = useCollection(countdownsCol)

  // ── 版面設定（自己嘅 collection）──
  useCollection(dashboardLayoutCol) // 訂閱：設定一變即 re-render
  const layout = readLayout()

  const [editMode, setEditMode] = useState(false)
  const [nameDraft, setNameDraft] = useState(layout.greetingName)
  const [capture, setCapture] = useState('')

  const cycleCalendar = useCollection(cycleCalendarCol)
  const now = useMemo(() => new Date(), [])
  const todayKey = localKey(now)
  const jsDay = now.getDay()
  // cycle 模式（校曆有 seed 即啟用）：今日(日期)→ 校曆 → cycle day(1..6) 用嚟篩今日堂；
  // 唔喺校曆（週末/假期/考試/未排）→ 0 = 今日無堂。否則退回星期制。
  const isCycle = cycleCalendar.length > 0
  const ttDay = isCycle ? cycleDayForDate(todayKey, cycleCalendar) ?? 0 : jsDay
  const dateLabel = `${now.getMonth() + 1}月${now.getDate()}日 星期${WEEKDAY_LABELS[jsDay]}`
  const hello = greeting(now.getHours())
  const who = layout.greetingName.trim() || '老師'

  const classNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const k of classes) map.set(k.id, k.name)
    return map
  }, [classes])

  const merged = useMemo(() => mergeTasks(tasks, taskMetas), [tasks, taskMetas])

  // ── 鍵盤捷徑（數字跳功能；E 切換編輯；忽略輸入框）──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable))
        return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'e' || e.key === 'E') {
        setEditMode((v) => !v)
        return
      }
      const sc = SHORTCUTS.find((s) => s.key === e.key)
      if (sc) {
        e.preventDefault()
        open(sc.nav)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  // ───────── 彙整 view models ─────────
  const trend = useMemo(
    () => buildTaskTrend(merged, layout.rangeDays),
    [merged, layout.rangeDays],
  )
  const heat = useMemo(
    () => buildHeat(merged, Math.max(layout.rangeDays, 28)),
    [merged, layout.rangeDays],
  )
  const streak = useMemo(() => completionStreak(heat), [heat])

  const openTasks = useMemo(() => merged.filter((t) => !t.done), [merged])
  const overdueTasks = useMemo(
    () => openTasks.filter((t) => t.due && t.due < todayKey).length,
    [openTasks, todayKey],
  )

  const agenda = useMemo<AgendaItem[]>(
    () =>
      buildAgenda({
        timetable,
        classNameById,
        events,
        calendars,
        tasks: merged,
        countdowns,
        todayKey,
        jsDay,
        slotDay: ttDay,
      }),
    [timetable, classNameById, events, calendars, merged, countdowns, todayKey, jsDay, ttDay],
  )

  const classProgress = useMemo(
    () => buildClassProgress(classes, progress, topics.length),
    [classes, progress, topics],
  )
  const overallProgress = overallProgressPercent(classProgress)

  const attSummary = useMemo(
    () => buildAttendance(attendance, addKey(todayKey, -30)),
    [attendance, todayKey],
  )
  const gradeSummary = useMemo(
    () => buildGradeSummary(assessments, scores),
    [assessments, scores],
  )
  const weekLoad = useMemo(() => buildWeekLoad(timetable, jsDay), [timetable, jsDay])
  const followUps = useMemo(
    () => buildFollowUps(parentComms, classNameById),
    [parentComms, classNameById],
  )
  const upcomingCountdowns = useMemo(
    () => buildCountdowns(countdowns, todayKey),
    [countdowns, todayKey],
  )

  // ── KPI（含本週 vs 上週對比）──
  const kpis = useMemo<Kpi[]>(() => {
    const todaySlotCount = timetable.filter((s) => s.day === ttDay).length
    // 本週（近 7 日）vs 上週（前 7 日）完成待辦
    const thisWeek = completedInRange(merged, addKey(todayKey, -6), todayKey)
    const lastWeek = completedInRange(merged, addKey(todayKey, -13), addKey(todayKey, -7))
    const diff = thisWeek - lastWeek
    const delta: Kpi['delta'] =
      lastWeek === 0 && thisWeek === 0
        ? { dir: 'flat', text: '—' }
        : diff > 0
          ? { dir: 'up', text: `+${diff}` }
          : diff < 0
            ? { dir: 'down', text: `${diff}` }
            : { dir: 'flat', text: '0' }

    const followUpCount = parentComms.filter((c) => c.followUp === true).length
    const end7 = addKey(todayKey, 7)
    const upcoming7 = events.filter((e) => e.date >= todayKey && e.date <= end7).length

    return [
      {
        key: 'tasks',
        label: '未完成待辦',
        value: openTasks.length,
        icon: 'tasks',
        navTo: 'work-tasks',
        highlight: overdueTasks > 0,
        delta:
          overdueTasks > 0
            ? { dir: 'down', text: `${overdueTasks} 逾期` }
            : undefined,
      },
      {
        key: 'done',
        label: '本週完成',
        value: thisWeek,
        unit: '件',
        icon: 'class',
        navTo: 'work-tasks',
        delta,
      },
      {
        key: 'class',
        label: '今日課堂',
        value: todaySlotCount,
        unit: '節',
        icon: 'event',
        navTo: 'work-timetable',
      },
      {
        key: 'follow',
        label: '待跟進家長',
        value: followUpCount,
        icon: 'parent',
        navTo: 'work-parent-comms',
        highlight: followUpCount > 0,
        delta:
          upcoming7 > 0 ? { dir: 'flat', text: `未來 7 日 ${upcoming7} 事件` } : undefined,
      },
    ]
  }, [timetable, jsDay, merged, todayKey, parentComms, events, openTasks, overdueTasks])

  // ── 快速擷取（掉入 Inbox）──
  function submitCapture() {
    const text = capture.trim()
    if (!text) return
    inboxCol.add({ text, mode: 'work', createdAt: new Date().toISOString() })
    setCapture('')
    toast.success('已掉入快速擷取')
  }

  // ── 完成待辦 ──
  function completeTask(id: string) {
    tasksCol.update(id, { done: true })
    // 同步寫 completedAt 入 todo meta（趨勢圖會即時反映）
    const existing = taskMetaCol.get().find((m) => m.id === id)
    const stamp = new Date().toISOString()
    if (existing) taskMetaCol.update(id, { completedAt: stamp })
    else
      taskMetaCol.add({
        id,
        priority: 4,
        tags: [],
        order: Date.now(),
        completedAt: stamp,
        updatedAt: stamp,
      })
    toast.success('已完成待辦')
  }

  // 顯示緊嘅 widget（依次序、去除收起）
  const visibleWidgets = layout.order.filter((w) => !layout.hidden.includes(w))

  return (
    <div className="space-y-5">
      {/* ───────── 操作列（範圍 + 自訂；問候搬入 Bento hero） ───────── */}
      <div className="flex items-center justify-end gap-2">
        <SegmentedControl<string>
          size="sm"
          value={String(layout.rangeDays)}
          onChange={(v) => setRange(Number(v))}
          options={[
            { id: '7', label: '7 日' },
            { id: '14', label: '14 日' },
            { id: '30', label: '30 日' },
          ]}
        />
        <Tooltip label="自訂版面 (E)">
          <Button
            size="sm"
            variant={editMode ? 'primary' : 'secondary'}
            icon={Settings2}
            onClick={() => setEditMode((v) => !v)}
          >
            {editMode ? '完成' : '自訂'}
          </Button>
        </Tooltip>
      </div>

      {/* ───────── 重型 Bento overview（不規則磚 + 真實彙整統計） ───────── */}
      <WorkBento
        hello={hello}
        who={who}
        dateLabel={dateLabel}
        streak={streak}
        agenda={agenda}
        kpis={kpis}
        openTasks={openTasks.length}
        overdueTasks={overdueTasks}
        overallProgress={overallProgress}
        classProgress={classProgress}
        attSummary={attSummary}
        gradeSummary={gradeSummary}
        weekLoad={weekLoad}
        followUps={followUps}
        upcomingCountdowns={upcomingCountdowns}
        nowMinutes={now.getHours() * 60 + now.getMinutes()}
        completeTask={completeTask}
        open={open}
      />

      {/* ───────── 快速擷取列 ───────── */}
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <Input
            icon={InboxIcon}
            value={capture}
            placeholder="快速記低一個諗法 / 待辦…（Enter 掉入收件匣）"
            onChange={(e) => setCapture(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitCapture()
            }}
          />
        </div>
        <Button
          variant="secondary"
          icon={Send}
          onClick={submitCapture}
          disabled={!capture.trim()}
        >
          擷取
        </Button>
      </div>

      {/* ───────── 編輯模式：版面設定面板 ───────── */}
      {editMode && (
        <LayoutEditor order={layout.order} hidden={layout.hidden} name={nameDraft} setName={setNameDraft} />
      )}

      {/* ───────── Widget 渲染 ───────── */}
      {visibleWidgets.length === 0 ? (
        <EmptyState
          icon={LayoutGrid}
          title="未有顯示任何區塊"
          hint="喺「自訂」面板開返你想睇嘅儀表板區塊。"
          action={
            <Button size="sm" variant="secondary" onClick={() => setEditMode(true)}>
              開啟自訂
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          {visibleWidgets.map((id) => (
            <WidgetFrame key={id} id={id} editMode={editMode} order={layout.order} hidden={layout.hidden}>
              {renderWidget(id, {
                kpis,
                agenda,
                jsDay,
                openTasks: openTasks.length,
                trend,
                heat,
                streak,
                classProgress,
                overallProgress,
                attSummary,
                gradeSummary,
                weekLoad,
                followUps,
                upcomingCountdowns,
                rangeDays: layout.rangeDays,
                completeTask,
                open,
              })}
            </WidgetFrame>
          ))}
        </div>
      )}

      {/* ───────── 鍵盤捷徑提示 ───────── */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-slate-200 pt-4 text-xs text-slate-400 dark:border-slate-700 dark:text-slate-500">
        <span className="font-medium">捷徑</span>
        {SHORTCUTS.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1">
            <Kbd>{s.key}</Kbd>
            {s.label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1">
          <Kbd>E</Kbd>
          自訂版面
        </span>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════
//  重型 Bento overview（不規則大小磚 + 真實彙整）
//  ---------------------------------------------
//  hero 2×2、今日議程 / 今日待辦 2 格闊，其餘 1×1 統計磚。
//  全部數字由跨功能彙整而嚟；accent 跟模式自動＝青藍。
// ═════════════════════════════════════════════
function WorkBento({
  hello,
  who,
  dateLabel,
  streak,
  agenda,
  kpis,
  openTasks,
  overdueTasks,
  overallProgress,
  classProgress,
  attSummary,
  gradeSummary,
  weekLoad,
  followUps,
  upcomingCountdowns,
  nowMinutes,
  completeTask,
  open,
}: {
  hello: string
  who: string
  dateLabel: string
  streak: number
  agenda: AgendaItem[]
  kpis: Kpi[]
  openTasks: number
  overdueTasks: number
  overallProgress: number
  classProgress: ReturnType<typeof buildClassProgress>
  attSummary: ReturnType<typeof buildAttendance>
  gradeSummary: ReturnType<typeof buildGradeSummary>
  weekLoad: ReturnType<typeof buildWeekLoad>
  followUps: ReturnType<typeof buildFollowUps>
  upcomingCountdowns: ReturnType<typeof buildCountdowns>
  nowMinutes: number
  completeTask: (id: string) => void
  open: (id: string) => void
}) {
  // 今日課堂（時間軸）：已過 vs 全部 → hero 進度
  const classItems = agenda.filter((a) => a.kind === 'class')
  const todayClassCount = classItems.length
  const classesPassed = classItems.filter((a) => a.sortKey >= 0 && a.sortKey + 60 <= nowMinutes).length
  const classPct =
    todayClassCount > 0 ? Math.round((classesPassed / todayClassCount) * 100) : 0

  // 今日待辦（到期 / 逾期，由議程抽出）
  const taskItems = agenda.filter((a) => a.kind === 'task')
  const overdueToday = taskItems.filter((a) => a.overdue).length

  // 本週課擔總節數
  const weekPeriods = weekLoad.reduce((s, d) => s + d.periods, 0)
  // 最近一個倒數
  const nextCd = upcomingCountdowns[0]

  // KPI 取本週完成 delta（hero 旁統計磚共用）
  const doneKpi = kpis.find((k) => k.key === 'done')

  // hero 一句話：按今日最重要嗰樣
  let heroLine = '今日未有課堂安排，把握時間備課或抖一抖。'
  if (overdueToday > 0) heroLine = `有 ${overdueToday} 件待辦逾期，建議優先清理。`
  else if (todayClassCount > 0 && taskItems.length > 0)
    heroLine = `今日 ${todayClassCount} 堂課、${taskItems.length} 件待辦到期，逐樣搞掂。`
  else if (todayClassCount > 0) heroLine = `今日有 ${todayClassCount} 堂課，記得預備教材。`
  else if (taskItems.length > 0) heroLine = `今日有 ${taskItems.length} 件待辦到期，趁早完成。`

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:auto-rows-[132px] lg:grid-cols-4">
      {/* ── HERO 2×2 ── */}
      <section className="hero-gradient relative flex flex-col justify-between overflow-hidden rounded-3xl p-5 text-white shadow-lg shadow-accent/25 sm:col-span-2 lg:row-span-2">
        <div className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="relative">
          <p className="text-xs font-medium text-white/70">{dateLabel}</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">
            {hello}，{who}
          </h1>
          {streak >= 2 && (
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur">
              <Flame size={13} /> 待辦連續 {streak} 日
            </span>
          )}
          <p className="mt-3 max-w-md text-sm text-white/80" aria-live="polite">{heroLine}</p>
        </div>
        <div className="relative">
          <p className="text-xs text-white/70">今日課堂進度</p>
          <p className="mt-0.5 text-4xl font-bold tabular-nums">
            {classesPassed}
            <span className="ml-2 text-sm font-medium text-white/60">/ {todayClassCount} 堂</span>
          </p>
          <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-white/20">
            <div className="h-full rounded-full bg-white transition-all duration-700" style={{ width: `${classPct}%` }} />
          </div>
        </div>
      </section>

      {/* ── 未完成待辦 1×1 ── */}
      <StatTile
        label="未完成待辦" value={openTasks} unit="件" icon={NotebookPen}
        tone={overdueTasks > 0 ? 'rose' : 'accent'}
        hint={overdueTasks > 0 ? `${overdueTasks} 件逾期` : openTasks === 0 ? '全部搞掂 🎉' : '保持清爽'}
        delta={overdueTasks > 0 ? { dir: 'down', text: `${overdueTasks} 逾期` } : undefined}
        onClick={() => open('work-tasks')}
      />

      {/* ── 課程進度環 1×1 ── */}
      <button
        type="button"
        onClick={() => open('work-curriculum')}
        className="group flex cursor-pointer items-center gap-3 rounded-3xl border border-slate-200/80 bg-white p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:border-slate-700/60 dark:bg-slate-800 dark:hover:border-slate-600"
      >
        <MiniRing value={overallProgress} size={56} stroke={6} tone={overallProgress >= 80 ? 'green' : 'accent'}>
          <span className="text-[11px] font-bold tabular-nums text-slate-700 dark:text-slate-200">{overallProgress}%</span>
        </MiniRing>
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-400 dark:text-slate-500">課程進度</p>
          <p className="mt-0.5 text-lg font-bold tabular-nums text-slate-800 dark:text-slate-100">
            {classProgress.length}<span className="text-sm text-slate-400"> 班</span>
          </p>
          <p className="truncate text-[11px] text-slate-400">{classProgress.length > 0 ? '整體完成度' : '未有班別'}</p>
        </div>
      </button>

      {/* ── 本週完成 1×1 ── */}
      <StatTile
        label="本週完成" value={doneKpi?.value ?? 0} unit="件" icon={CheckSquare} tone="sky"
        delta={doneKpi?.delta}
        hint="近 7 日待辦"
        onClick={() => open('work-tasks')}
      />
      {/* ── 待跟進家長 1×1 ── */}
      <StatTile
        label="待跟進家長" value={followUps.length} unit="位" icon={Phone}
        tone={followUps.length > 0 ? 'rose' : 'emerald'}
        hint={followUps.length > 0 ? '記得覆返家長' : '全部跟進完'}
        onClick={() => open('work-parent-comms')}
      />

      {/* ── 今日議程 2×1 ── */}
      <section className="flex min-h-0 flex-col rounded-3xl border border-slate-200/80 bg-white p-4 dark:border-slate-700/60 dark:bg-slate-800 sm:col-span-2">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-300">
            <Clock size={13} /> 今日議程
          </span>
          <button
            type="button"
            onClick={() => open('calendar')}
            className="inline-flex items-center gap-0.5 text-xs font-medium text-accent transition hover:text-accent-strong"
          >
            行事曆 <ChevronRight size={13} />
          </button>
        </div>
        {agenda.length === 0 ? (
          <div className="flex flex-1 items-center gap-2.5 text-sm text-slate-400">
            <Palmtree size={16} className="text-emerald-400" />
            今日一片清靜，未有課堂、到期待辦或行程。
          </div>
        ) : (
          <ul className="min-h-0 flex-1 space-y-0.5 overflow-hidden">
            {agenda.slice(0, 4).map((it) => (
              <li key={it.id} className="flex items-center gap-2.5 rounded-xl px-1.5 py-1.5">
                <span className="w-10 shrink-0 text-right text-[11px] font-semibold tabular-nums text-slate-500 dark:text-slate-400">
                  {it.time ?? (it.badge === '全日' ? '全日' : '—')}
                </span>
                <span className={cx('h-2 w-2 shrink-0 rounded-full', it.colorClass)} />
                <button
                  type="button"
                  onClick={() => (it.kind === 'task' && it.taskId ? completeTask(it.taskId) : open(it.navTo ?? 'calendar'))}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className={cx('block truncate text-sm', it.overdue ? 'font-medium text-rose-500' : 'text-slate-700 dark:text-slate-200')}>
                    {it.title}
                  </span>
                </button>
                {it.kind === 'task' && it.taskId ? (
                  <span className="text-[11px] font-medium text-accent">完成</span>
                ) : it.badge && it.badge !== '全日' ? (
                  <span className="truncate text-[11px] text-slate-400">{it.badge}</span>
                ) : null}
              </li>
            ))}
            {agenda.length > 4 && (
              <li className="px-1.5 pt-0.5 text-[11px] text-slate-400">仲有 {agenda.length - 4} 項…</li>
            )}
          </ul>
        )}
      </section>

      {/* ── 今日課堂 1×1 ── */}
      <StatTile
        label="今日課堂" value={todayClassCount} unit="節" icon={BookMarked} tone="violet"
        hint={todayClassCount > 0 ? `已上 ${classesPassed} 節` : '今日無課'}
        onClick={() => open('work-timetable')}
      />
      {/* ── 出席率 1×1 ── */}
      <StatTile
        label="出席率" value={attSummary.total > 0 ? attSummary.rate : '—'} unit={attSummary.total > 0 ? '%' : undefined}
        icon={Users} tone="emerald" hint={attSummary.total > 0 ? `近 30 日 · ${attSummary.total} 次` : '未有點名'}
        onClick={() => open('work-attendance')}
      />

      {/* ── 今日待辦 2×2 ── */}
      <section className="flex flex-col rounded-3xl border border-slate-200/80 bg-white p-4 dark:border-slate-700/60 dark:bg-slate-800 sm:col-span-2 lg:row-span-2">
        <div className="mb-2 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <CheckSquare size={15} /> 今日待辦
          </span>
          {overdueToday > 0 ? (
            <Badge tone="rose" dot>{overdueToday} 逾期</Badge>
          ) : (
            <span className="text-xs font-medium tabular-nums text-slate-400">{taskItems.length} 件</span>
          )}
        </div>
        {taskItems.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-500 dark:bg-emerald-500/15">
              <PartyPopper size={22} />
            </span>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">今日無到期待辦</p>
            <button
              type="button"
              onClick={() => open('work-tasks')}
              className="text-xs font-medium text-accent transition hover:text-accent-strong"
            >
              去待辦規劃 →
            </button>
          </div>
        ) : (
          <ul className="flex-1 space-y-1">
            {taskItems.slice(0, 6).map((it) => (
              <li key={it.id}>
                <div className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-sm transition hover:bg-slate-50 dark:hover:bg-slate-800/60">
                  <button
                    type="button"
                    onClick={() => it.taskId && completeTask(it.taskId)}
                    aria-label="完成待辦"
                    className="flex h-5 w-5 flex-none items-center justify-center rounded-full border border-slate-300 text-transparent transition hover:border-emerald-400 hover:bg-emerald-400 hover:text-white dark:border-slate-600"
                  >
                    <Check size={12} strokeWidth={3} />
                  </button>
                  <button
                    type="button"
                    onClick={() => open(it.navTo ?? 'work-tasks')}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="block truncate text-slate-700 dark:text-slate-200">{it.title}</span>
                    {it.subtitle && (
                      <span className={cx('block truncate text-[11px]', it.overdue ? 'text-rose-500' : 'text-slate-400')}>
                        {it.subtitle}
                      </span>
                    )}
                  </button>
                </div>
              </li>
            ))}
            {taskItems.length > 6 && (
              <li className="px-2 pt-0.5 text-[11px] text-slate-400">仲有 {taskItems.length - 6} 件…</li>
            )}
          </ul>
        )}
      </section>

      {/* ── 本週課擔 1×1 ── */}
      <StatTile
        label="本週課擔" value={weekPeriods} unit="節" icon={CalendarDays} tone="amber"
        hint="一至六總節數"
        onClick={() => open('work-timetable')}
      />
      {/* ── 重要倒數 1×1 ── */}
      <StatTile
        label="最近倒數" value={nextCd ? nextCd.daysLeft : '—'} unit={nextCd ? '日' : undefined}
        icon={Clock} tone="rose"
        hint={nextCd ? nextCd.cd.title : '未有倒數'}
        onClick={() => open('countdown')}
      />
      {/* ── 成績平均 1×1 ── */}
      <StatTile
        label="最近平均" value={gradeSummary.graded > 0 ? gradeSummary.average : '—'} unit={gradeSummary.graded > 0 ? '%' : undefined}
        icon={GraduationCap} tone="sky"
        hint={gradeSummary.graded > 0 ? `${gradeSummary.graded} 人評分` : '未有評分'}
        onClick={() => open('work-gradebook')}
      />
      {/* ── 問 AI CTA 1×1 ── */}
      <button
        type="button"
        onClick={() => open('work-ai')}
        className="group flex cursor-pointer flex-col justify-between rounded-3xl border border-dashed border-accent/40 bg-accent-soft/50 p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-accent hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:bg-accent/10"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent text-white transition group-hover:scale-105">
          <Zap size={16} />
        </span>
        <div>
          <p className="text-sm font-semibold text-accent-strong dark:text-accent">問教學 AI</p>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">備課 · 出題 · 批改</p>
        </div>
      </button>
    </div>
  )
}

// ═════════════════════════════════════════════
//  版面編輯面板
// ═════════════════════════════════════════════
function LayoutEditor({
  order,
  hidden,
  name,
  setName,
}: {
  order: WidgetId[]
  hidden: WidgetId[]
  name: string
  setName: (v: string) => void
}) {
  return (
    <Card className="space-y-4 border-accent/30 bg-accent-soft/40 p-4 dark:border-accent/30 dark:bg-accent/10">
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-white">
          <Settings2 size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">自訂儀表板</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            開關區塊、調整次序，或設定你想被點名嘅稱呼。
          </p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          icon={RotateCcw}
          onClick={() => {
            resetLayout()
          }}
        >
          重設
        </Button>
      </div>

      {/* 稱呼設定 */}
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
          <Pencil size={13} />
          稱呼
        </span>
        <Input
          value={name}
          placeholder="例如：陳 sir / Miss Wong"
          onChange={(e) => setName(e.target.value)}
          onBlur={() => setGreetingName(name)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          }}
          className="max-w-[16rem]"
        />
      </div>

      {/* 區塊開關 + 排序 */}
      <ul className="divide-y divide-slate-200/70 overflow-hidden rounded-lg border border-slate-200 bg-white dark:divide-slate-700/60 dark:border-slate-700 dark:bg-slate-800">
        {order.map((id, i) => {
          const meta = WIDGET_META[id]
          const isHidden = hidden.includes(id)
          const Icon = meta.icon
          return (
            <li
              key={id}
              className={cx(
                'flex items-center gap-3 px-3 py-2',
                isHidden && 'opacity-50',
              )}
            >
              <Icon size={16} className="shrink-0 text-slate-400" />
              <span className="flex-1 truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                {meta.label}
              </span>
              <div className="flex items-center gap-0.5">
                <IconButton
                  label="上移"
                  size="sm"
                  disabled={i === 0}
                  onClick={() => moveWidget(id, -1)}
                >
                  <ArrowUp size={15} />
                </IconButton>
                <IconButton
                  label="下移"
                  size="sm"
                  disabled={i === order.length - 1}
                  onClick={() => moveWidget(id, 1)}
                >
                  <ArrowDown size={15} />
                </IconButton>
                <IconButton
                  label={isHidden ? '顯示' : '隱藏'}
                  size="sm"
                  active={!isHidden}
                  onClick={() => toggleWidget(id)}
                >
                  {isHidden ? <EyeOff size={15} /> : <Eye size={15} />}
                </IconButton>
              </div>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

// ═════════════════════════════════════════════
//  Widget 外框（編輯模式畀快速操作）
// ═════════════════════════════════════════════
function WidgetFrame({
  id,
  editMode,
  order,
  hidden,
  children,
}: {
  id: WidgetId
  editMode: boolean
  order: WidgetId[]
  hidden: WidgetId[]
  children: React.ReactNode
}) {
  if (!editMode) return <section>{children}</section>
  const i = order.indexOf(id)
  const meta = WIDGET_META[id]
  return (
    <section className="relative rounded-xl border border-dashed border-accent/40 p-2">
      <div className="mb-1.5 flex items-center justify-between px-1">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-accent-strong dark:text-accent">
          <meta.icon size={13} />
          {meta.label}
        </span>
        <Menu
          align="end"
          trigger={
            <span className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700">
              <Settings2 size={15} />
              <span className="sr-only">{meta.label} 區塊設定</span>
            </span>
          }
          items={[
            { id: 'up', label: '上移', icon: ArrowUp, onSelect: () => moveWidget(id, -1), disabled: i === 0 },
            {
              id: 'down',
              label: '下移',
              icon: ArrowDown,
              onSelect: () => moveWidget(id, 1),
              disabled: i === order.length - 1,
            },
            {
              id: 'hide',
              label: hidden.includes(id) ? '顯示' : '隱藏',
              icon: hidden.includes(id) ? Eye : EyeOff,
              onSelect: () => toggleWidget(id),
            },
          ]}
        />
      </div>
      <div className="pointer-events-none select-none opacity-95">{children}</div>
    </section>
  )
}

// ═════════════════════════════════════════════
//  Widget 內容 dispatcher
// ═════════════════════════════════════════════
interface WidgetCtx {
  kpis: Kpi[]
  agenda: AgendaItem[]
  jsDay: number
  openTasks: number
  trend: ReturnType<typeof buildTaskTrend>
  heat: ReturnType<typeof buildHeat>
  streak: number
  classProgress: ReturnType<typeof buildClassProgress>
  overallProgress: number
  attSummary: ReturnType<typeof buildAttendance>
  gradeSummary: ReturnType<typeof buildGradeSummary>
  weekLoad: ReturnType<typeof buildWeekLoad>
  followUps: ReturnType<typeof buildFollowUps>
  upcomingCountdowns: ReturnType<typeof buildCountdowns>
  rangeDays: number
  completeTask: (id: string) => void
  open: (id: string) => void
}

function renderWidget(id: WidgetId, ctx: WidgetCtx) {
  switch (id) {
    case 'kpi':
      return <KpiWidget kpis={ctx.kpis} open={ctx.open} />
    case 'focus':
      return <FocusWidget ctx={ctx} />
    case 'agenda':
      return <AgendaWidget items={ctx.agenda} jsDay={ctx.jsDay} completeTask={ctx.completeTask} open={ctx.open} />
    case 'taskTrend':
      return <TaskTrendWidget ctx={ctx} />
    case 'curriculum':
      return <CurriculumWidget rows={ctx.classProgress} overall={ctx.overallProgress} open={ctx.open} />
    case 'attendance':
      return <AttendanceWidget s={ctx.attSummary} open={ctx.open} />
    case 'grades':
      return <GradesWidget s={ctx.gradeSummary} open={ctx.open} />
    case 'parentFollowUp':
      return <FollowUpWidget rows={ctx.followUps} open={ctx.open} />
    case 'countdown':
      return <CountdownWidget rows={ctx.upcomingCountdowns} open={ctx.open} />
    case 'classLoad':
      return <ClassLoadWidget data={ctx.weekLoad} />
    case 'quickActions':
      return <QuickActionsWidget open={ctx.open} />
  }
}

// ───────── KPI ─────────
const KPI_TONE: Record<Kpi['icon'], Tone> = {
  tasks: 'accent',
  class: 'sky',
  parent: 'rose',
  event: 'violet',
}

function KpiWidget({ kpis, open }: { kpis: Kpi[]; open: (id: string) => void }) {
  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {kpis.map((k) => {
        const Icon = KPI_ICON[k.icon]
        const t = TONE[k.highlight ? 'rose' : KPI_TONE[k.icon]]
        return (
          <button
            key={k.key}
            type="button"
            onClick={() => open(k.navTo)}
            aria-label={`${k.label}：${k.value}${k.unit ?? ''}${k.delta ? `，${k.delta.text}` : ''}`}
            className="group flex cursor-pointer flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-slate-700/60 dark:bg-slate-800 dark:hover:border-slate-600 dark:focus-visible:ring-offset-slate-900"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400 dark:text-slate-500">{k.label}</span>
              <span className={cx('flex h-8 w-8 items-center justify-center rounded-xl transition group-hover:scale-105', t.chip)}>
                <Icon size={16} strokeWidth={2} />
              </span>
            </div>
            <div className="mt-3">
              <p className="flex items-baseline gap-1">
                <span className={cx('text-3xl font-bold tabular-nums slashed-zero', t.val)}>{k.value}</span>
                {k.unit && <span className="text-sm font-medium text-slate-400">{k.unit}</span>}
              </p>
              {k.delta && (
                <span
                  className={cx(
                    'mt-0.5 inline-flex items-center gap-0.5 text-[11px] font-semibold tabular-nums',
                    k.delta.dir === 'up'
                      ? 'text-emerald-500'
                      : k.delta.dir === 'down'
                        ? 'text-rose-500'
                        : 'text-slate-400',
                  )}
                >
                  {k.delta.dir === 'up' ? '↑' : k.delta.dir === 'down' ? '↓' : ''}
                  {k.delta.text}
                </span>
              )}
            </div>
          </button>
        )
      })}
    </section>
  )
}

// ───────── 今日聚焦 ─────────
function FocusWidget({ ctx }: { ctx: WidgetCtx }) {
  const classCount = ctx.agenda.filter((a) => a.kind === 'class').length
  const dueCount = ctx.agenda.filter((a) => a.kind === 'task').length
  const eventCount = ctx.agenda.filter((a) => a.kind === 'event').length
  const overdue = ctx.agenda.filter((a) => a.kind === 'task' && a.overdue).length

  // 一句話聚焦語（按情況選最重要嗰樣）
  let line = '今日無特別安排，把握時間備課或抖一抖。'
  if (overdue > 0) line = `有 ${overdue} 件待辦逾期，建議優先清理。`
  else if (classCount > 0 && dueCount > 0)
    line = `今日 ${classCount} 堂課、${dueCount} 件待辦到期，逐樣搞掂。`
  else if (classCount > 0) line = `今日有 ${classCount} 堂課，記得預備教材。`
  else if (dueCount > 0) line = `今日有 ${dueCount} 件待辦到期，趁早完成。`
  else if (eventCount > 0) line = `今日有 ${eventCount} 個行程，留意時間。`

  const chips = [
    { label: '課堂', value: classCount, icon: BookMarked, tone: 'accent' as const },
    { label: '到期待辦', value: dueCount, icon: CheckSquare, tone: overdue > 0 ? ('rose' as const) : ('amber' as const) },
    { label: '行程', value: eventCount, icon: Calendar, tone: 'blue' as const },
  ]

  return (
    <Card className="overflow-hidden p-0">
      <div className="bg-gradient-to-br from-accent to-accent-strong px-5 py-4 text-white">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-white/80">
          <Sparkles size={14} />
          今日聚焦
        </div>
        <p className="mt-1.5 text-base font-semibold leading-snug" aria-live="polite">{line}</p>
      </div>
      <div className="grid grid-cols-3 divide-x divide-slate-200/80 dark:divide-slate-700/60">
        {chips.map((c) => (
          <div key={c.label} className="px-3 py-3 text-center">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{c.label}</p>
            <p className="mt-0.5 text-xl font-bold tabular-nums text-slate-800 dark:text-slate-100">
              {c.value}
            </p>
          </div>
        ))}
      </div>
    </Card>
  )
}

// ───────── 今日議程 ─────────
const AGENDA_KIND_LABEL: Record<AgendaItem['kind'], string> = {
  class: '課堂',
  event: '行程',
  task: '待辦',
  countdown: '日子',
}

function AgendaWidget({
  items,
  jsDay,
  completeTask,
  open,
}: {
  items: AgendaItem[]
  jsDay: number
  completeTask: (id: string) => void
  open: (id: string) => void
}) {
  return (
    <section>
      <SectionTitle
        icon={Clock}
        right={
          <Button size="sm" variant="ghost" iconRight={ChevronRight} onClick={() => open('calendar')}>
            行事曆
          </Button>
        }
      >
        今日議程
      </SectionTitle>
      {items.length === 0 ? (
        jsDay === 0 ? (
          <EmptyState icon={Palmtree} title="星期日休息" hint="今日無課堂亦無到期事項，好好抖一抖。" />
        ) : (
          <EmptyState icon={PartyPopper} title="今日一片清靜" hint="未有課堂、到期待辦或行程。" />
        )
      ) : (
        <Card className="divide-y divide-slate-100 p-0 dark:divide-slate-800">
          {items.map((it) => (
            <div key={it.id} className="flex items-center gap-3 px-3 py-2.5">
              {/* 時間欄 */}
              <div className="w-12 shrink-0 text-right">
                {it.time ? (
                  <span className="text-xs font-semibold tabular-nums text-slate-600 dark:text-slate-300">
                    {it.time}
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400">{it.badge === '全日' ? '全日' : '—'}</span>
                )}
              </div>
              {/* 色點 */}
              <span className={cx('h-2 w-2 shrink-0 rounded-full', it.colorClass)} />
              {/* 內容 */}
              <button
                onClick={() => open(it.navTo ?? 'calendar')}
                className="min-w-0 flex-1 text-left"
              >
                <p
                  className={cx(
                    'truncate text-sm font-medium text-slate-800 dark:text-slate-100',
                    it.done && 'line-through opacity-50',
                  )}
                >
                  {it.title}
                </p>
                {it.subtitle && (
                  <p
                    className={cx(
                      'truncate text-xs',
                      it.overdue ? 'text-rose-500' : 'text-slate-500 dark:text-slate-400',
                    )}
                  >
                    {it.subtitle}
                  </p>
                )}
              </button>
              {/* 右側：類別 / 課室 / 完成掣 */}
              {it.kind === 'task' && it.taskId ? (
                <IconButton
                  label="完成待辦"
                  size="sm"
                  className="min-h-[40px] min-w-[40px]"
                  onClick={() => completeTask(it.taskId!)}
                >
                  <Check size={16} />
                </IconButton>
              ) : it.badge && it.badge !== '全日' ? (
                <Badge tone="slate">{it.badge}</Badge>
              ) : (
                <Badge tone={it.kind === 'class' ? 'accent' : it.kind === 'countdown' ? 'rose' : 'blue'}>
                  {AGENDA_KIND_LABEL[it.kind]}
                </Badge>
              )}
            </div>
          ))}
        </Card>
      )}
    </section>
  )
}

// ───────── 待辦完成趨勢 ─────────
function TaskTrendWidget({ ctx }: { ctx: WidgetCtx }) {
  const totalDone = ctx.trend.reduce((s, d) => s + d.completed, 0)
  const totalNew = ctx.trend.reduce((s, d) => s + d.created, 0)
  return (
    <section>
      <SectionTitle
        icon={CheckSquare}
        right={
          <Badge tone={ctx.streak >= 2 ? 'amber' : 'slate'} icon={ctx.streak >= 2 ? Flame : undefined}>
            連續 {ctx.streak} 日
          </Badge>
        }
      >
        待辦完成趨勢
      </SectionTitle>
      <Card className="space-y-4 p-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat label="期內完成" value={totalDone} tone="accent" />
          <Stat label="期內新增" value={totalNew} tone="slate" />
          <Stat label="未完成" value={ctx.openTasks} tone={ctx.openTasks > 0 ? 'amber' : 'slate'} />
        </div>
        <TaskTrendChart data={ctx.trend} />
        <div>
          <p className="mb-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">近 {ctx.heat.length} 日完成熱力</p>
          <HeatStrip cells={ctx.heat} />
        </div>
      </Card>
    </section>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'accent' | 'amber' | 'slate'
}) {
  return (
    <div className="rounded-lg bg-slate-50 py-2 dark:bg-slate-800/60">
      <p
        className={cx(
          'text-xl font-bold tabular-nums',
          tone === 'accent'
            ? 'text-accent-strong dark:text-accent'
            : tone === 'amber'
              ? 'text-amber-600 dark:text-amber-400'
              : 'text-slate-700 dark:text-slate-200',
        )}
      >
        {value}
      </p>
      <p className="text-[11px] text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  )
}

// ───────── 各班課程進度 ─────────
function CurriculumWidget({
  rows,
  overall,
  open,
}: {
  rows: ReturnType<typeof buildClassProgress>
  overall: number
  open: (id: string) => void
}) {
  return (
    <section>
      <SectionTitle
        icon={School}
        right={
          <Button size="sm" variant="ghost" iconRight={ChevronRight} onClick={() => open('work-curriculum')}>
            詳情
          </Button>
        }
      >
        各班課程進度
      </SectionTitle>
      {rows.length === 0 ? (
        <EmptyState icon={School} title="未有班別資料" hint="加入班別後即可追蹤進度。" />
      ) : (
        <Card className="space-y-4 p-4">
          <div className="flex items-center justify-between rounded-lg bg-accent-soft px-3 py-2 dark:bg-accent/10">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">整體完成度</span>
            <span className="text-lg font-bold tabular-nums text-accent-strong dark:text-accent">{overall}%</span>
          </div>
          {rows.map((cp) => (
            <div key={cp.id}>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="font-medium text-slate-800 dark:text-slate-100">{cp.name}</span>
                <span className="flex items-center gap-2 tabular-nums text-slate-500 dark:text-slate-400">
                  {cp.inProgress > 0 && (
                    <span className="text-[11px] text-amber-600 dark:text-amber-400">{cp.inProgress} 進行中</span>
                  )}
                  {cp.done}/{cp.total}（{cp.percent}%）
                </span>
              </div>
              <ProgressBar value={cp.percent} tone={cp.percent >= 80 ? 'green' : cp.percent >= 40 ? 'accent' : 'amber'} />
            </div>
          ))}
        </Card>
      )}
    </section>
  )
}

// ───────── 出席率 ─────────
function AttendanceWidget({
  s,
  open,
}: {
  s: ReturnType<typeof buildAttendance>
  open: (id: string) => void
}) {
  return (
    <section>
      <SectionTitle
        icon={Users}
        right={
          <Button size="sm" variant="ghost" iconRight={ChevronRight} onClick={() => open('work-attendance')}>
            點名
          </Button>
        }
        description="近 30 日整體"
      >
        出席率
      </SectionTitle>
      {s.total === 0 ? (
        <EmptyState icon={Users} title="未有點名紀錄" hint="去點名／出席記錄學生出席狀況。" />
      ) : (
        <Card className="p-4">
          <Donut
            centerValue={`${s.rate}%`}
            centerLabel="出席率"
            segments={[
              { label: '出席', value: s.present, color: '#34d399' },
              { label: '遲到', value: s.late, color: '#fbbf24' },
              { label: '缺席', value: s.absent, color: '#fb7185' },
            ]}
          />
          <p className="mt-3 text-center text-xs tabular-nums text-slate-400 dark:text-slate-500">
            共 {s.total} 次記錄
          </p>
        </Card>
      )}
    </section>
  )
}

// ───────── 成績分布 ─────────
function GradesWidget({
  s,
  open,
}: {
  s: ReturnType<typeof buildGradeSummary>
  open: (id: string) => void
}) {
  return (
    <section>
      <SectionTitle
        icon={GraduationCap}
        right={
          <Button size="sm" variant="ghost" iconRight={ChevronRight} onClick={() => open('work-gradebook')}>
            成績冊
          </Button>
        }
      >
        成績分布
      </SectionTitle>
      {s.graded === 0 ? (
        <EmptyState icon={GraduationCap} title="未有評分紀錄" hint="喺成績管理輸入分數後即見分布。" />
      ) : (
        <Card className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                {s.assessment?.name ?? '最近評估'}
              </p>
              <p className="text-xs text-slate-400">
                {s.graded} 人 · 滿分 {s.max}
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold tabular-nums text-accent-strong dark:text-accent">{s.average}%</p>
              <p className="text-[11px] text-slate-400">平均</p>
            </div>
          </div>
          <GradeHistogram bins={s.bins} />
        </Card>
      )}
    </section>
  )
}

// ───────── 待跟進家長 ─────────
function FollowUpWidget({
  rows,
  open,
}: {
  rows: ReturnType<typeof buildFollowUps>
  open: (id: string) => void
}) {
  return (
    <section>
      <SectionTitle
        icon={Phone}
        right={
          <Button size="sm" variant="ghost" iconRight={ChevronRight} onClick={() => open('work-parent-comms')}>
            家長溝通
          </Button>
        }
      >
        待跟進家長
      </SectionTitle>
      {rows.length === 0 ? (
        <EmptyState icon={PartyPopper} title="無待跟進事項" hint="所有家長聯絡都跟進完了。" />
      ) : (
        <Card className="divide-y divide-slate-100 p-0 dark:divide-slate-800">
          {rows.slice(0, 5).map(({ comm, className }) => (
            <button
              key={comm.id}
              onClick={() => open('work-parent-comms')}
              className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/50"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-500 dark:bg-rose-500/10">
                <Phone size={15} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{comm.summary}</p>
                <p className="text-xs text-slate-400">
                  {className} · {comm.channel} · {comm.date}
                </p>
              </div>
              <Badge tone="rose" dot>
                待跟進
              </Badge>
            </button>
          ))}
          {rows.length > 5 && (
            <div className="px-3 py-2 text-center text-xs text-slate-400">仲有 {rows.length - 5} 項…</div>
          )}
        </Card>
      )}
    </section>
  )
}

// ───────── 重要日子倒數 ─────────
function CountdownWidget({
  rows,
  open,
}: {
  rows: ReturnType<typeof buildCountdowns>
  open: (id: string) => void
}) {
  return (
    <section>
      <SectionTitle
        icon={Clock}
        right={
          <Button size="sm" variant="ghost" iconRight={ChevronRight} onClick={() => open('countdown')}>
            全部
          </Button>
        }
      >
        重要日子倒數
      </SectionTitle>
      {rows.length === 0 ? (
        <EmptyState icon={Clock} title="未有倒數" hint="加入考試、死線、評估等重要日子。" />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {rows.slice(0, 4).map(({ cd, daysLeft }) => {
            const meta = COUNTDOWN_META[cd.category ?? 'other'] ?? COUNTDOWN_META.other
            const urgent = daysLeft <= 3
            return (
              <button
                key={cd.id}
                onClick={() => open('countdown')}
                className={cx(
                  'flex items-center justify-between gap-3 rounded-xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md',
                  urgent
                    ? 'border-rose-200 bg-rose-50/60 dark:border-rose-500/30 dark:bg-rose-500/10'
                    : 'border-slate-200 bg-white shadow-xs dark:border-slate-700 dark:bg-slate-800 dark:shadow-none',
                )}
              >
                <div className="min-w-0">
                  <Badge tone={meta.tone}>{meta.label}</Badge>
                  <p className="mt-1.5 truncate text-sm font-medium text-slate-800 dark:text-slate-100">{cd.title}</p>
                  <p className="text-xs text-slate-400">{cd.date}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p
                    className={cx(
                      'text-3xl font-bold tabular-nums leading-none',
                      urgent ? 'text-rose-500' : 'text-accent-strong dark:text-accent',
                    )}
                  >
                    {daysLeft}
                  </p>
                  <p className="text-[11px] text-slate-400">{daysLeft === 0 ? '今日' : '日後'}</p>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}

// ───────── 本週課擔 ─────────
function ClassLoadWidget({ data }: { data: ReturnType<typeof buildWeekLoad> }) {
  return (
    <section>
      <SectionTitle icon={BookMarked} description="每日上課節數">
        本週課擔
      </SectionTitle>
      <Card className="p-4">
        <WeekLoadBars data={data} />
      </Card>
    </section>
  )
}

// ───────── 快速動作 ─────────
const QUICK_ACTIONS: { key: string; label: string; icon: LucideIcon }[] = [
  { key: 'work-tasks', label: '待辦事項', icon: NotebookPen },
  { key: 'work-attendance', label: '點名考勤', icon: CheckSquare },
  { key: 'work-gradebook', label: '成績管理', icon: GraduationCap },
  { key: 'work-lesson-plan', label: '備課教案', icon: ClipboardList },
  { key: 'work-timetable', label: '時間表', icon: CalendarDays },
  { key: 'calendar', label: '行事曆', icon: Calendar },
  { key: 'work-ai', label: '教學 AI', icon: Sparkles },
  { key: 'work-parent-comms', label: '家長溝通', icon: Phone },
]

function QuickActionsWidget({ open }: { open: (id: string) => void }) {
  return (
    <section>
      <SectionTitle icon={LayoutGrid}>快速動作</SectionTitle>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {QUICK_ACTIONS.map((a) => (
          <Card key={a.key} hover onClick={() => open(a.key)} className="flex flex-col items-center gap-2 p-4 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
              <a.icon size={20} strokeWidth={2} />
            </span>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{a.label}</span>
          </Card>
        ))}
      </div>
    </section>
  )
}
