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
  Sliders,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  RotateCcw,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  Card,
  SectionTitle,
  Button,
  Modal,
  IconButton,
  Tooltip,
  SegmentedControl,
  cx,
} from '../../ui'
import BentoOverview from './dashboard/BentoOverview'
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
  HealthWidget,
} from './dashboard/widgets'
import {
  todayKey,
  buildDaySignals,
  computeKpis,
  buildActivity,
  dashPrefsCol,
  readPrefs,
  visibleWidgets,
  WIDGET_DEFS,
  DEFAULT_PREFS,
  type DashInput,
  type DashPrefs,
  type WidgetId,
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
      label: journaledToday ? '今日已寫日誌' : '寫今日日誌',
      done: journaledToday,
      target: 'learning-journal',
      icon: BookText,
    },
  ]
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

  // ── 可見 widget ──
  const visible = visibleWidgets(prefs)
  const compact = prefs.density === 'compact'

  return (
    <div className="space-y-5">
      {/* 工具列 */}
      <div className="flex justify-end">
        <Button variant="secondary" size="sm" icon={Sliders} onClick={() => setCustomizing(true)}>
          自訂
        </Button>
      </div>

      {/* 重型 Bento overview（不規則磚 + 真實統計，全部由真實資料層彙整） */}
      <BentoOverview
        name={displayName}
        kpis={kpis}
        signals={signals}
        focusGoalMin={focusGoalMin}
        range={prefs.range}
        onRange={(n) => patchPrefs({ range: n })}
        tasks={tasks}
        open={open}
      />

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
    case 'health':
      return <HealthWidget open={open} />
    default:
      return null
  }
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

