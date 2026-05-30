import { useState } from 'react'
import { useCollection } from '../../lib/store'
import { tasksCol } from '../../data/collections'

// 待辦 / 批改清單
export default function TodoWidget() {
  const tasks = useCollection(tasksCol)
  const [draft, setDraft] = useState('')

  const add = () => {
    const text = draft.trim()
    if (!text) return
    tasksCol.add({ text, done: false, createdAt: new Date().toISOString() })
    setDraft('')
  }
  const toggle = (id: string) => {
    const t = tasks.find((x) => x.id === id)
    if (t) tasksCol.update(id, { done: !t.done })
  }

  const sorted = [...tasks].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  const remaining = tasks.filter((t) => !t.done).length

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="新增一項待辦（批改 / 備課 / 行政…）"
          className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
        />
        <button
          onClick={add}
          className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-strong"
        >
          加入
        </button>
      </div>

      <p className="text-xs text-slate-400">仲有 {remaining} 項未完成</p>

      <ul className="space-y-2">
        {sorted.map((t) => (
          <li
            key={t.id}
            className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3"
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
              onClick={() => tasksCol.remove(t.id)}
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
