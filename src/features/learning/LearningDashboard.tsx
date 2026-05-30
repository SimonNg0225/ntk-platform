import { useCollection } from '../../lib/store'
import {
  cardsCol,
  goalsCol,
  notesCol,
  focusCol,
  journalCol,
  habitsCol,
  habitLogsCol,
  readingCol,
} from '../../data/collections'
import { isDue } from '../../lib/srs'
import { useNav } from '../../context/NavContext'
import {
  Card,
  Badge,
  SectionTitle,
  EmptyState,
  StatCard,
  ProgressBar,
} from '../../ui'

function fmt(d: Date) {
  return d.toISOString().slice(0, 10)
}

function computeStreak(dates: Set<string>): number {
  let streak = 0
  const d = new Date()
  if (!dates.has(fmt(d))) d.setDate(d.getDate() - 1)
  while (dates.has(fmt(d))) {
    streak++
    d.setDate(d.getDate() - 1)
  }
  return streak
}

function greeting(): string {
  const h = new Date().getHours()
  if (h < 6) return '夜深啦'
  if (h < 12) return '早晨'
  if (h < 18) return '午安'
  return '晚安'
}

function todayLabel(): string {
  const d = new Date()
  const week = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()]
  return `${d.getMonth() + 1}月${d.getDate()}日 · 星期${week}`
}

export default function LearningDashboard() {
  const cards = useCollection(cardsCol)
  const goals = useCollection(goalsCol)
  const notes = useCollection(notesCol)
  const focus = useCollection(focusCol)
  const journal = useCollection(journalCol)
  const habits = useCollection(habitsCol)
  const habitLogs = useCollection(habitLogsCol)
  const reading = useCollection(readingCol)
  const { open } = useNav()

  const today = fmt(new Date())
  const dueCount = cards.filter(isDue).length

  // 活躍日期（複習 / 專注 / 日誌 / 習慣）→ streak
  const activeDates = new Set<string>()
  cards.forEach((c) => c.lastReviewed && activeDates.add(c.lastReviewed.slice(0, 10)))
  focus.forEach((f) => activeDates.add(f.startedAt.slice(0, 10)))
  journal.forEach((j) => activeDates.add(j.date))
  habitLogs.forEach((l) => activeDates.add(l.date))
  const streak = computeStreak(activeDates)

  // 本週
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  const reviewedThisWeek = cards.filter(
    (c) => c.lastReviewed && new Date(c.lastReviewed) >= weekAgo,
  ).length
  const focusMinThisWeek = focus
    .filter((f) => new Date(f.startedAt) >= weekAgo)
    .reduce((s, f) => s + f.durationMin, 0)

  // 今日任務
  const habitsDoneToday = habits.filter((h) =>
    habitLogs.some((l) => l.habitId === h.id && l.date === today),
  ).length
  const journaledToday = journal.some((j) => j.date === today)

  const tasks = [
    {
      label: dueCount > 0 ? `溫習 ${dueCount} 張閃卡` : '閃卡已清',
      done: dueCount === 0,
      target: 'learning-flashcards',
    },
    {
      label:
        habits.length > 0
          ? `完成習慣 ${habitsDoneToday}/${habits.length}`
          : '仲未設定習慣',
      done: habits.length > 0 && habitsDoneToday === habits.length,
      target: 'learning-habits',
    },
    {
      label: journaledToday ? '今日已寫日誌' : '寫今日日誌',
      done: journaledToday,
      target: 'learning-journal',
    },
  ]

  const topGoals = [...goals]
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 3)

  const readingNow = reading.filter((r) => r.status === 'reading').slice(0, 3)

  const recentNotes = [...notes]
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 3)

  return (
    <div className="space-y-5">
      {/* 問候 */}
      <div>
        <h1 className="text-xl font-bold text-slate-800">
          {greeting()}，今日學啲乜？
        </h1>
        <p className="mt-0.5 text-sm text-slate-400">{todayLabel()}</p>
      </div>

      {/* 統計卡（可撳） */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="今日要複習"
          value={dueCount}
          unit="張"
          icon="🧠"
          highlight
          onClick={() => open('learning-flashcards')}
        />
        <StatCard
          label="連續學習"
          value={streak}
          unit="日 🔥"
          icon="🔥"
          onClick={() => open('learning-journal')}
        />
        <StatCard
          label="本週複習"
          value={reviewedThisWeek}
          unit="張"
          icon="📚"
          onClick={() => open('learning-flashcards')}
        />
        <StatCard
          label="本週專注"
          value={focusMinThisWeek}
          unit="分鐘"
          icon="⏱️"
          onClick={() => open('learning-focus')}
        />
      </div>

      {/* 今日任務 */}
      <Card className="p-4">
        <SectionTitle>今日任務</SectionTitle>
        <ul className="space-y-2">
          {tasks.map((t) => (
            <li key={t.label}>
              <button
                onClick={() => !t.done && open(t.target)}
                disabled={t.done}
                className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-sm transition ${
                  t.done
                    ? 'cursor-default text-slate-400'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span
                  className={`flex h-5 w-5 flex-none items-center justify-center rounded-full border text-[11px] ${
                    t.done
                      ? 'border-emerald-400 bg-emerald-400 text-white'
                      : 'border-slate-300'
                  }`}
                >
                  {t.done ? '✓' : ''}
                </span>
                <span className={t.done ? 'line-through' : ''}>{t.label}</span>
                {!t.done && (
                  <span className="ml-auto text-xs text-accent">去做 →</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </Card>

      {/* 快速動作 */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Action
          icon="🧠"
          title="開始複習"
          desc={dueCount > 0 ? `${dueCount} 張到期` : '今日已清'}
          onClick={() => open('learning-flashcards')}
        />
        <Action
          icon="⏱️"
          title="開始專注"
          desc="番茄鐘計時"
          onClick={() => open('learning-focus')}
        />
        <Action
          icon="📓"
          title="寫日誌"
          desc="記低今日反思"
          onClick={() => open('learning-journal')}
        />
      </div>

      {/* 目標進度 */}
      <Card className="p-4">
        <SectionTitle
          right={
            <button
              onClick={() => open('learning-goals')}
              className="text-xs text-accent hover:underline"
            >
              管理 →
            </button>
          }
        >
          學習目標
        </SectionTitle>
        {topGoals.length === 0 ? (
          <EmptyState
            icon="🎯"
            title="仲未有目標"
            hint="設定學習目標，追蹤每一步進度。"
          />
        ) : (
          <ul className="space-y-3">
            {topGoals.map((g) => (
              <li key={g.id}>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="truncate text-sm text-slate-700">
                    {g.title}
                  </span>
                  <span className="flex-none text-xs font-bold text-accent">
                    {g.progress}%
                  </span>
                </div>
                <ProgressBar value={g.progress} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* 在讀書籍 */}
      <Card className="p-4">
        <SectionTitle
          right={
            <button
              onClick={() => open('learning-reading')}
              className="text-xs text-accent hover:underline"
            >
              書架 →
            </button>
          }
        >
          在讀書籍
        </SectionTitle>
        {readingNow.length === 0 ? (
          <EmptyState
            icon="📖"
            title="而家無喺度讀緊嘅書"
            hint="加本書入閱讀清單，開始閱讀之旅。"
          />
        ) : (
          <ul className="space-y-2">
            {readingNow.map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-2 text-sm text-slate-700"
              >
                <span className="text-base">📖</span>
                <span className="truncate">{r.title}</span>
                {r.author && (
                  <Badge tone="slate" className="ml-auto flex-none">
                    {r.author}
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* 最近筆記 */}
      <Card className="p-4">
        <SectionTitle
          right={
            <button
              onClick={() => open('learning-notes')}
              className="text-xs text-accent hover:underline"
            >
              全部 →
            </button>
          }
        >
          最近筆記
        </SectionTitle>
        {recentNotes.length === 0 ? (
          <EmptyState
            icon="📝"
            title="仲未有筆記"
            hint="隨手記低諗法同重點。"
          />
        ) : (
          <ul className="space-y-1.5">
            {recentNotes.map((n) => (
              <li key={n.id} className="truncate text-sm text-slate-600">
                · {n.content}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

function Action({
  icon,
  title,
  desc,
  onClick,
}: {
  icon: string
  title: string
  desc: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-lg">
        {icon}
      </span>
      <div>
        <p className="text-sm font-semibold text-slate-800">{title}</p>
        <p className="text-xs text-slate-400">{desc}</p>
      </div>
    </button>
  )
}
