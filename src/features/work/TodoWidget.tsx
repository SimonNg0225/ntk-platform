import { useState } from 'react'
import { useLocalStorage } from '../../hooks/useLocalStorage'

// 待辦 / 批改清單 — BAFS 教師日常工作示範
interface Task {
  id: number
  text: string
  done: boolean
}

const SEED: Task[] = [
  { id: 1, text: '批改 5A 班會計練習', done: false },
  { id: 2, text: '預備下星期成本會計課堂', done: false },
  { id: 3, text: '上載功課到學校平台', done: true },
]

export default function TodoWidget() {
  const [tasks, setTasks] = useLocalStorage<Task[]>('ntk.work.tasks', SEED)
  const [draft, setDraft] = useState('')

  const add = () => {
    const text = draft.trim()
    if (!text) return
    setTasks([{ id: Date.now(), text, done: false }, ...tasks])
    setDraft('')
  }
  const toggle = (id: number) =>
    setTasks(tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)))
  const remove = (id: number) => setTasks(tasks.filter((t) => t.id !== id))

  const remaining = tasks.filter((t) => !t.done).length

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="新增一項待辦（批改 / 備課 / 行政…）"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
        />
        <button
          onClick={add}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-strong"
        >
          加入
        </button>
      </div>

      <p className="text-xs text-slate-400">仲有 {remaining} 項未完成</p>

      <ul className="space-y-2">
        {tasks.map((t) => (
          <li
            key={t.id}
            className="group flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3"
          >
            <input
              type="checkbox"
              checked={t.done}
              onChange={() => toggle(t.id)}
              className="h-4 w-4 accent-[color:var(--accent)]"
            />
            <span
              className={
                t.done
                  ? 'flex-1 text-sm text-slate-400 line-through'
                  : 'flex-1 text-sm text-slate-800'
              }
            >
              {t.text}
            </span>
            <button
              onClick={() => remove(t.id)}
              className="text-xs text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-red-500"
            >
              刪除
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
