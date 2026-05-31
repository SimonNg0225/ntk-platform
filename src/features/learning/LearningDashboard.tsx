import { useEffect, useMemo, useState } from 'react'
import { useCollection } from '../../lib/store'
import {
  cardsCol,
  goalsCol,
  eventsCol,
  calendarsCol,
  countdownsCol,
  quizAttemptsCol,
} from '../../data/collections'
import { booksCol } from './reading/types'
import { focusLogsCol, focusProjectsCol, focusSettingsCol, getSettings } from './focus/store'
import { habitV2Col, habitLogV2Col, migrateLegacyHabits } from './habits/types'
import { goalMetaCol, milestonesCol } from './goals/types'
import { richNotesCol } from './notes/store'
import { journalDocsCol } from './journal/store'
import type { CalendarEvent, CalendarCategory, Countdown, QuizAttempt } from '../../data/types'
import type { KpiData, DaySignal, ActivityItem } from './dashboard/util'
import { useNav } from '../../context/NavContext'
import { useSettings } from '../../context/SettingsContext'
import { useToast } from '../../context/ToastContext'
import {
  Brain,
  Flame,
  Timer,
  BookText,
  Target,
  Sliders,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  Check,
  ChevronRight,
  RotateCcw,
  Sparkles,
  BookOpen,
  ListChecks,
  Activity as ActivityIcon,
  Zap,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  Card,
  StatCard,
  SectionTitle,
  Button,
  Modal,
  IconButton,
  Tooltip,
  SegmentedControl,
  Badge,
  cx,
} from '../../ui'
import { ActivityArea, MiniRing } from './dashboard/charts'
import {
  RingsWidget,
  FlashcardsWidget,
  AgendaWidget,
  GoalsWidget,
  HabitsTodayWidget,
  ReadingWidget,
  MoodWidget,
  QuizWidget,
  ActivityWidget,
} from './dashboard/widgets'
import {
  greeting,
  longToday,
  todayKey,
  buildDaySignals,
  computeKpis,
  buildActivity,
  trendOf,
  fmtMin,
  dashPrefsCol,
  readPrefs,
  visibleWidgets,
  WIDGET_DEFS,
  KPI_DEFS,
  DEFAULT_PREFS,
  type DashInput,
  type DashPrefs,
  type WidgetId,
  type KpiId,
} from './dashboard/util'

// ============================================================
//  學習儀表板（Notion Home / Apple 摘要 級）
//  ------------------------------------------------------------
//  · 可配置 widget（顯示 / 隱藏 / 排序）+ KPI 揀選
//  · KPI 卡含本週 vs 上週趨勢箭咀
//  · 今日聚焦三環、活動走勢面積圖、跨功能 roll-up
//  · 全部資料由各功能「真實」資料層彙整（rich notes / books /
//    focus logs / habits v2 / goals + milestones / journal docs /
//    cards / quiz attempts / calendar）
// ============================================================

const RANGE_OPTS: { id: string; label: string }[] = [
  { id: '14', label: '14 日' },
  { id: '30', label: '30 日' },
  { id: '90', label: '90 日' },
]

export default function LearningDashboard() {
  // 首次載入：遷移舊習慣 → v2（等儀表板見到資料）
  useEffect(() => {
    migrateLegacyHabits()
  }, [])

  // ── 真實資料來源 ──
  const cards = useCollection(cardsCol)
  const goals = useCollection(goalsCol)
  const goalMeta = useCollection(goalMetaCol)
  const milestones = useCollection(milestonesCol)
  const books = useCollection(booksCol)
  const focusLogs = useCollection(focusLogsCol)
  const focusProjects = useCollection(focusProjectsCol)
  const focusSettings = useCollection(focusSettingsCol)
  const habits = useCollection(habitV2Col)
  const habitLogs = useCollection(habitLogV2Col)
  const journalDocs = useCollection(journalDocsCol)
  const notes = useCollection(richNotesCol)
  const quizAttempts = useCollection(quizAttemptsCol)
  const events = useCollection(eventsCol)
  const calendars = useCollection(calendarsCol)
  const countdowns = useCollection(countdownsCol)

  const { open } = useNav()
  const { displayName } = useSettings()
  const toast = useToast()

  // ── 偏好（自家持久化）──
  const prefsAll = useCollection(dashPrefsCol)
  const prefs = useMemo(() => readPrefs(prefsAll), [prefsAll])
  const [customizing, setCustomizing] = useState(false)

  function patchPrefs(patch: Partial<DashPrefs>) {
    dashPrefsCol.update(prefs.id, patch)
  }

  // ── 彙整輸入 ──
  const input: DashInput = useMemo(
    () => ({
      cards,
      goals,
      goalMeta,
      milestones,
      books,
      focusLogs,
      focusProjects,
      habits,
      habitLogs,
      journal: journalDocs,
    }),
    [cards, goals, goalMeta, milestones, books, focusLogs, focusProjects, habits, habitLogs, journalDocs],
  )

  const kpis = useMemo(() => computeKpis(input), [input])
  const signals = useMemo(() => buildDaySignals(input, prefs.range), [input, prefs.range])

  // 筆記活動（用 updatedAt；最近建立 / 編輯）
  const noteEvents = useMemo(
    () =>
      notes
        .filter((n) => !n.trashed)
        .map((n) => ({
          id: n.id,
          text: `筆記：${(n.title || n.content || '無題').replace(/\s+/g, ' ').trim().slice(0, 24)}`,
          at: n.updatedAt || n.createdAt,
        })),
    [notes],
  )
  const activity = useMemo(() => buildActivity(input, noteEvents, 8), [input, noteEvents])

  const focusGoalMin = useMemo(() => {
    const s = getSettings(focusSettings)
    return Math.max(25, (s.dailyGoal || 8) * (s.focusMin || 25))
  }, [focusSettings])

  // ── 今日任務（行動清單）──
  const today = todayKey()
  const journaledToday = journalDocs.some((j) => j.date === today)
  const tasks: TaskItem[] = [
    {
      label: kpis.dueCards > 0 ? `溫習 ${kpis.dueCards} 張到期知識卡` : '知識卡已清晒',
      done: kpis.dueCards === 0 && cards.length > 0,
      target: 'learning-flashcards',
      icon: Brain,
    },
    {
      label:
        kpis.habitDueToday > 0
          ? `完成今日習慣 ${kpis.habitDoneToday}/${kpis.habitDueToday}`
          : '設定每日習慣',
      done: kpis.habitDueToday > 0 && kpis.habitDoneToday === kpis.habitDueToday,
      target: 'learning-habits',
      icon: Flame,
    },
    {
      label: kpis.focusMinWeek > 0 || focusLogs.length > 0 ? '開始一節專注' : '試做番茄鐘專注',
      done: signals.length > 0 && (signals[signals.length - 1]?.focusMin ?? 0) >= focusGoalMin,
      target: 'learning-focus',
      icon: Timer,
    },
    {
      label: journaledToday ? '今日已寫日誌' : '寫今日學習日誌',
      done: journaledToday,
      target: 'learning-journal',
      icon: BookText,
    },
  ]
  const tasksDone = tasks.filter((t) => t.done).length

  // ── 習慣打卡（直接喺儀表板完成）──
  function toggleHabit(habitId: string, done: boolean) {
    const existing = habitLogs.find((l) => l.habitId === habitId && l.date === today)
    if (done && !existing) {
      habitLogV2Col.add({ habitId, date: today })
      toast.success('打卡成功 🔥')
    } else if (!done && existing) {
      habitLogV2Col.remove(existing.id)
    }
  }

  // ── KPI 卡資料 ──
  const kpiCards = useMemo(() => buildKpiCards(prefs.kpis, kpis), [prefs.kpis, kpis])

  // ── 可見 widget ──
  const visible = visibleWidgets(prefs)
  const compact = prefs.density === 'compact'

  return (
    <div className="space-y-5">
      {/* 問候 + 工具 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">
            {greeting()}
            {displayName ? `，${displayName}` : ''}，今日學啲乜？
          </h1>
          <p className="mt-0.5 flex items-center gap-2 text-sm text-slate-400">
            <span>{longToday()}</span>
            {kpis.streak > 0 && (
              <Badge tone="amber" icon={Flame}>
                連續 {kpis.streak} 日
              </Badge>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={Zap}
            onClick={() => open('learning-ai')}
            className="hidden sm:inline-flex"
          >
            問 AI
          </Button>
          <Button variant="secondary" size="sm" icon={Sliders} onClick={() => setCustomizing(true)}>
            自訂
          </Button>
        </div>
      </div>

      {/* KPI 卡（含趨勢） */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpiCards.map((k) => (
          <StatCard
            key={k.id}
            label={k.label}
            value={k.value}
            unit={k.unit}
            icon={k.icon}
            highlight={k.highlight}
            trend={k.trend}
            hint={k.hint}
            onClick={() => open(k.target)}
          />
        ))}
      </div>

      {/* 活動走勢（面積圖）+ 今日任務 */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Card className="p-4 lg:col-span-2">
          <SectionTitle
            icon={ActivityIcon}
            right={
              <SegmentedControl
                size="sm"
                options={RANGE_OPTS}
                value={String(prefs.range)}
                onChange={(v) => patchPrefs({ range: Number(v) })}
              />
            }
          >
            學習活動走勢
          </SectionTitle>
          <ActivityArea signals={signals} height={96} />
          <div
            className="mt-3 flex items-center gap-3 border-t border-slate-100 pt-3 dark:border-slate-800"
            aria-live="polite"
          >
            <div className="flex items-center gap-2.5">
              <MiniRing value={kpis.habitRate} size={46} stroke={5} tone={kpis.habitRate >= 100 ? 'green' : 'accent'}>
                <span className="text-[10px] font-bold tabular-nums text-slate-600 dark:text-slate-300">
                  {kpis.habitRate}%
                </span>
              </MiniRing>
              <div className="leading-tight">
                <p className="text-xs font-medium text-slate-600 dark:text-slate-300">今日達成</p>
                <p className="text-[11px] text-slate-400">習慣完成率</p>
              </div>
            </div>
            <div className="ml-auto grid grid-cols-3 gap-3 text-center">
              <MiniStat label="本週專注" value={fmtMin(kpis.focusMinWeek)} />
              <MiniStat label="本週複習" value={`${kpis.reviewsWeek}張`} />
              <MiniStat label="最長連續" value={`${kpis.longestStreak}日`} />
            </div>
          </div>
        </Card>

        {/* 今日任務 */}
        <Card className="p-4">
          <SectionTitle
            icon={Check}
            right={
              <span
                className="text-xs font-medium tabular-nums text-slate-400"
                aria-live="polite"
                aria-label={`今日任務完成 ${tasksDone} / ${tasks.length}`}
              >
                {tasksDone}/{tasks.length}
              </span>
            }
          >
            今日任務
          </SectionTitle>
          <ul className="space-y-1">
            {tasks.map((t) => (
              <li key={t.label}>
                <button
                  onClick={() => !t.done && open(t.target)}
                  disabled={t.done}
                  className={cx(
                    'flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left text-sm transition',
                    t.done
                      ? 'cursor-default text-slate-400'
                      : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800/50',
                  )}
                >
                  <span
                    className={cx(
                      'flex h-5 w-5 flex-none items-center justify-center rounded-full border',
                      t.done
                        ? 'border-emerald-400 bg-emerald-400 text-white'
                        : 'border-slate-300 dark:border-slate-600',
                    )}
                  >
                    {t.done && <Check size={12} strokeWidth={3} />}
                  </span>
                  <t.icon size={15} className={t.done ? 'text-slate-300 dark:text-slate-600' : 'text-slate-400'} />
                  <span className={cx('truncate', t.done && 'line-through')}>{t.label}</span>
                  {!t.done && (
                    <ChevronRight size={14} className="ml-auto flex-none text-accent" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* 可配置 widget grid */}
      {visible.length === 0 ? (
        <Card className="p-4">
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800">
              <Sliders size={22} />
            </span>
            <p className="text-sm text-slate-500 dark:text-slate-400">所有面板都收埋咗</p>
            <Button size="sm" variant="secondary" onClick={() => setCustomizing(true)}>
              開返面板
            </Button>
          </div>
        </Card>
      ) : (
        <div className={cx('grid grid-cols-1 gap-3', compact ? 'lg:grid-cols-3' : 'lg:grid-cols-2')}>
          {visible.map((id) => (
            <WidgetSlot
              key={id}
              id={id}
              input={input}
              kpis={kpis}
              signals={signals}
              focusGoalMin={focusGoalMin}
              events={events}
              calendars={calendars}
              countdowns={countdowns}
              quizAttempts={quizAttempts}
              activity={activity}
              onToggleHabit={toggleHabit}
              open={open}
            />
          ))}
        </div>
      )}

      <CustomizeModal
        open={customizing}
        onClose={() => setCustomizing(false)}
        prefs={prefs}
        patch={patchPrefs}
        onReset={() => {
          dashPrefsCol.update(prefs.id, { ...DEFAULT_PREFS })
          toast.info('已還原預設版面')
        }}
      />
    </div>
  )
}

// ───────── widget 派遣 ─────────
function WidgetSlot({
  id,
  input,
  kpis,
  signals,
  focusGoalMin,
  events,
  calendars,
  countdowns,
  quizAttempts,
  activity,
  onToggleHabit,
  open,
}: {
  id: WidgetId
  input: DashInput
  kpis: KpiData
  signals: DaySignal[]
  focusGoalMin: number
  events: CalendarEvent[]
  calendars: CalendarCategory[]
  countdowns: Countdown[]
  quizAttempts: QuizAttempt[]
  activity: ActivityItem[]
  onToggleHabit: (id: string, done: boolean) => void
  open: (id: string) => void
}) {
  switch (id) {
    case 'rings':
      return <RingsWidget kpis={kpis} signals={signals} focusGoalMin={focusGoalMin} open={open} />
    case 'agenda':
      return <AgendaWidget events={events} calendars={calendars} countdowns={countdowns} open={open} />
    case 'flashcards':
      return <FlashcardsWidget input={input} kpis={kpis} open={open} />
    case 'goals':
      return (
        <GoalsWidget goals={input.goals} goalMeta={input.goalMeta} milestones={input.milestones} open={open} />
      )
    case 'habits':
      return (
        <HabitsTodayWidget habits={input.habits} habitLogs={input.habitLogs} onToggle={onToggleHabit} open={open} />
      )
    case 'reading':
      return <ReadingWidget input={input} kpis={kpis} open={open} />
    case 'mood':
      return <MoodWidget input={input} open={open} />
    case 'quiz':
      return <QuizWidget attempts={quizAttempts} open={open} />
    case 'activity':
      return <ActivityWidget items={activity} open={open} />
    default:
      return null
  }
}

// ───────── 小型統計（活動圖下方）─────────
function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <p className="text-base font-bold tabular-nums text-slate-800 dark:text-slate-100">{value}</p>
      <p className="text-[11px] text-slate-400">{label}</p>
    </div>
  )
}

// ───────── 自訂面板 Modal ─────────
function CustomizeModal({
  open,
  onClose,
  prefs,
  patch,
  onReset,
}: {
  open: boolean
  onClose: () => void
  prefs: DashPrefs
  patch: (p: Partial<DashPrefs>) => void
  onReset: () => void
}) {
  const hidden = new Set(prefs.hiddenWidgets)
  const order = prefs.widgetOrder

  function toggleWidget(id: WidgetId) {
    const next = new Set(hidden)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    patch({ hiddenWidgets: [...next] })
  }
  function move(id: WidgetId, dir: -1 | 1) {
    const idx = order.indexOf(id)
    const j = idx + dir
    if (idx < 0 || j < 0 || j >= order.length) return
    const next = [...order]
    ;[next[idx], next[j]] = [next[j], next[idx]]
    patch({ widgetOrder: next })
  }
  function toggleKpi(id: KpiId) {
    const has = prefs.kpis.includes(id)
    if (has) {
      if (prefs.kpis.length <= 1) return // 至少留一個
      patch({ kpis: prefs.kpis.filter((k) => k !== id) })
    } else {
      if (prefs.kpis.length >= 4) {
        // 滿 4 個：踢走最舊一個
        patch({ kpis: [...prefs.kpis.slice(1), id] })
      } else {
        patch({ kpis: [...prefs.kpis, id] })
      }
    }
  }

  const defByOrder = order
    .map((id) => WIDGET_DEFS.find((w) => w.id === id))
    .filter((w): w is (typeof WIDGET_DEFS)[number] => !!w)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="自訂儀表板"
      size="lg"
      footer={
        <>
          <Button variant="ghost" size="sm" icon={RotateCcw} onClick={onReset}>
            還原預設
          </Button>
          <Button size="sm" onClick={onClose}>
            完成
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* KPI 揀選 */}
        <section>
          <SectionTitle description="揀最多 4 個喺頂部顯示（含趨勢）">概覽指標</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {KPI_DEFS.map((k) => {
              const on = prefs.kpis.includes(k.id)
              return (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => toggleKpi(k.id)}
                  aria-pressed={on}
                  className={cx(
                    'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition',
                    on
                      ? 'bg-accent text-white shadow-sm dark:shadow-none'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
                  )}
                >
                  {on && <Check size={14} />}
                  {k.label}
                </button>
              )
            })}
          </div>
          <p className="mt-1.5 text-[11px] tabular-nums text-slate-400" aria-live="polite">
            已選 {prefs.kpis.length}/4
          </p>
        </section>

        {/* 密度 */}
        <section>
          <SectionTitle description="緊湊：每行 3 欄；舒適：每行 2 欄">版面密度</SectionTitle>
          <SegmentedControl
            options={[
              { id: 'comfortable', label: '舒適' },
              { id: 'compact', label: '緊湊' },
            ]}
            value={prefs.density}
            onChange={(v) => patch({ density: v })}
          />
        </section>

        {/* widget 顯示 / 排序 */}
        <section>
          <SectionTitle description="撳眼睛收起，上下箭咀調次序">面板（卡片）</SectionTitle>
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
            {defByOrder.map((w, i) => {
              const off = hidden.has(w.id)
              return (
                <li
                  key={w.id}
                  className={cx(
                    'flex items-center gap-3 px-3 py-2.5 transition',
                    off ? 'bg-slate-50/60 dark:bg-slate-800/30' : 'bg-white dark:bg-slate-800',
                  )}
                >
                  <div className="flex flex-col">
                    <IconButton label="上移" size="sm" onClick={() => move(w.id, -1)} disabled={i === 0}>
                      <ArrowUp size={14} />
                    </IconButton>
                    <IconButton
                      label="下移"
                      size="sm"
                      onClick={() => move(w.id, 1)}
                      disabled={i === defByOrder.length - 1}
                    >
                      <ArrowDown size={14} />
                    </IconButton>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={cx('text-sm font-medium', off ? 'text-slate-400' : 'text-slate-700 dark:text-slate-200')}>
                      {w.label}
                    </p>
                    <p className="truncate text-[11px] text-slate-400">{w.desc}</p>
                  </div>
                  <Tooltip label={off ? '顯示' : '收起'}>
                    <IconButton label={off ? '顯示' : '收起'} onClick={() => toggleWidget(w.id)} active={!off}>
                      {off ? <EyeOff size={16} /> : <Eye size={16} />}
                    </IconButton>
                  </Tooltip>
                </li>
              )
            })}
          </ul>
        </section>
      </div>
    </Modal>
  )
}

// ============================================================
//  型別 / 小工具
// ============================================================
interface TaskItem {
  label: string
  done: boolean
  target: string
  icon: LucideIcon
}

interface KpiCard {
  id: KpiId
  label: string
  value: number | string
  unit?: string
  icon: LucideIcon
  highlight?: boolean
  trend?: { value: string; dir: 'up' | 'down' | 'flat' }
  hint?: string
  target: string
}

function buildKpiCards(ids: KpiId[], k: ReturnType<typeof computeKpis>): KpiCard[] {
  const all: Record<KpiId, KpiCard> = {
    due: {
      id: 'due',
      label: '今日要複習',
      value: k.dueCards,
      unit: '張',
      icon: Brain,
      highlight: k.dueCards > 0,
      target: 'learning-flashcards',
      hint: k.dueCards === 0 ? '已清晒 🎉' : undefined,
    },
    streak: {
      id: 'streak',
      label: '連續學習',
      value: k.streak,
      unit: '日',
      icon: Flame,
      target: 'learning-journal',
      hint: k.longestStreak > k.streak ? `最長 ${k.longestStreak} 日` : undefined,
    },
    focusWeek: {
      id: 'focusWeek',
      label: '本週專注',
      value: Math.round(k.focusMinWeek),
      unit: '分鐘',
      icon: Timer,
      trend: trendOf(k.focusMinWeek, k.focusMinPrevWeek),
      target: 'learning-focus',
    },
    reviewsWeek: {
      id: 'reviewsWeek',
      label: '本週複習',
      value: k.reviewsWeek,
      unit: '張',
      icon: Sparkles,
      trend: trendOf(k.reviewsWeek, k.reviewsPrevWeek),
      target: 'learning-flashcards',
    },
    habitRate: {
      id: 'habitRate',
      label: '今日習慣',
      value: k.habitRate,
      unit: '%',
      icon: Flame,
      target: 'learning-habits',
      hint: k.habitDueToday > 0 ? `${k.habitDoneToday}/${k.habitDueToday} 完成` : '未設習慣',
    },
    goalsProgress: {
      id: 'goalsProgress',
      label: '目標進度',
      value: k.goalsAvgProgress,
      unit: '%',
      icon: Target,
      target: 'learning-goals',
      hint: `${k.goalsActive} 個進行中`,
    },
    pagesWeek: {
      id: 'pagesWeek',
      label: '本週閱讀',
      value: k.pagesWeek,
      unit: '頁',
      icon: BookOpen,
      target: 'learning-reading',
      hint: k.booksReading > 0 ? `${k.booksReading} 本在讀` : undefined,
    },
    journalWeek: {
      id: 'journalWeek',
      label: '本週日誌',
      value: k.journalWeek,
      unit: '篇',
      icon: ListChecks,
      target: 'learning-journal',
      hint: k.moodAvg != null ? `心情 ${k.moodAvg}/5` : undefined,
    },
  }
  return ids.map((id) => all[id]).filter(Boolean)
}
