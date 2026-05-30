import { useCollection } from '../../lib/store'
import {
  cardsCol,
  goalsCol,
  notesCol,
  focusCol,
  journalCol,
} from '../../data/collections'
import { isDue } from '../../lib/srs'
import { useNav } from '../../context/NavContext'

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

export default function LearningDashboard() {
  const cards = useCollection(cardsCol)
  const goals = useCollection(goalsCol)
  const notes = useCollection(notesCol)
  const focus = useCollection(focusCol)
  const journal = useCollection(journalCol)
  const { open } = useNav()

  const dueCount = cards.filter(isDue).length

  // 活躍日期（複習 / 專注 / 日誌）→ streak
  const activeDates = new Set<string>()
  cards.forEach((c) => c.lastReviewed && activeDates.add(c.lastReviewed.slice(0, 10)))
  focus.forEach((f) => activeDates.add(f.startedAt.slice(0, 10)))
  journal.forEach((j) => activeDates.add(j.date))
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

  const goalAvg = goals.length
    ? Math.round(goals.reduce((s, g) => s + g.progress, 0) / goals.length)
    : 0

  const recentNotes = [...notes]
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 3)

  return (
    <div className="space-y-5">
      {/* 統計卡 */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="今日要複習" value={`${dueCount}`} unit="張" highlight />
        <Stat label="連續學習" value={`${streak}`} unit="日 🔥" />
        <Stat label="本週複習" value={`${reviewedThisWeek}`} unit="張" />
        <Stat label="本週專注" value={`${focusMinThisWeek}`} unit="分鐘" />
      </div>

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
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-700">學習目標</p>
          <button
            onClick={() => open('learning-goals')}
            className="text-xs text-accent hover:underline"
          >
            管理 →
          </button>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${goalAvg}%` }}
            />
          </div>
          <span className="text-sm font-bold text-accent">{goalAvg}%</span>
        </div>
      </div>

      {/* 最近筆記 */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-700">最近筆記</p>
          <button
            onClick={() => open('learning-notes')}
            className="text-xs text-accent hover:underline"
          >
            全部 →
          </button>
        </div>
        {recentNotes.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">仲未有筆記。</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {recentNotes.map((n) => (
              <li key={n.id} className="truncate text-sm text-slate-600">
                · {n.content}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  unit,
  highlight,
}: {
  label: string
  value: string
  unit: string
  highlight?: boolean
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        highlight
          ? 'border-accent/30 bg-accent-soft'
          : 'border-slate-200 bg-white'
      }`}
    >
      <p className="text-xs text-slate-500">{label}</p>
      <p
        className={`mt-1 text-2xl font-bold ${highlight ? 'text-accent-strong' : 'text-slate-800'}`}
      >
        {value}
        <span className="ml-1 text-sm font-normal text-slate-400">{unit}</span>
      </p>
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
