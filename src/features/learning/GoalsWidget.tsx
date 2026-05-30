import { useState } from 'react'
import { useLocalStorage } from '../../hooks/useLocalStorage'

// 學習目標 + 進度追蹤 — 示範進度條互動
interface Goal {
  id: number
  title: string
  progress: number // 0 - 100
}

const SEED: Goal[] = [
  { id: 1, title: '溫習 BAFS 課程內容（會計部分）', progress: 60 },
  { id: 2, title: '睇完一本管理學書', progress: 25 },
]

export default function GoalsWidget() {
  const [goals, setGoals] = useLocalStorage<Goal[]>('ntk.learning.goals', SEED)
  const [draft, setDraft] = useState('')

  const add = () => {
    const title = draft.trim()
    if (!title) return
    setGoals([...goals, { id: Date.now(), title, progress: 0 }])
    setDraft('')
  }

  const bump = (id: number, delta: number) =>
    setGoals(
      goals.map((g) =>
        g.id === id
          ? { ...g, progress: Math.max(0, Math.min(100, g.progress + delta)) }
          : g,
      ),
    )

  const remove = (id: number) => setGoals(goals.filter((g) => g.id !== id))

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="新增一個學習目標…"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
        />
        <button
          onClick={add}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-strong"
        >
          新增目標
        </button>
      </div>

      <ul className="space-y-3">
        {goals.map((g) => (
          <li
            key={g.id}
            className="rounded-lg border border-slate-200 bg-white px-4 py-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-slate-800">
                {g.title}
              </span>
              <span className="text-xs font-semibold text-accent">
                {g.progress}%
              </span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-accent transition-all"
                style={{ width: `${g.progress}%` }}
              />
            </div>
            <div className="mt-2 flex items-center gap-2">
              <button
                onClick={() => bump(g.id, -10)}
                className="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-500 hover:bg-slate-50"
              >
                -10%
              </button>
              <button
                onClick={() => bump(g.id, +10)}
                className="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-500 hover:bg-slate-50"
              >
                +10%
              </button>
              <button
                onClick={() => remove(g.id)}
                className="ml-auto text-xs text-slate-300 hover:text-red-500"
              >
                刪除
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
