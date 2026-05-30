import { useState } from 'react'
import { useLocalStorage } from '../../hooks/useLocalStorage'

// 學習筆記 — 示範一個「會記住資料」嘅互動功能
interface Note {
  id: number
  text: string
  created: string
}

export default function NotesWidget() {
  const [notes, setNotes] = useLocalStorage<Note[]>('ntk.learning.notes', [])
  const [draft, setDraft] = useState('')

  const add = () => {
    const text = draft.trim()
    if (!text) return
    setNotes([
      { id: Date.now(), text, created: new Date().toLocaleString('zh-HK') },
      ...notes,
    ])
    setDraft('')
  }

  const remove = (id: number) => setNotes(notes.filter((n) => n.id !== id))

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="記低一個學到嘅重點…"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
        />
        <button
          onClick={add}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-strong"
        >
          加入
        </button>
      </div>

      {notes.length === 0 ? (
        <p className="rounded-lg bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
          仲未有筆記，喺上面打低你嘅第一個學習重點啦 ✍️
        </p>
      ) : (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li
              key={n.id}
              className="group flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3"
            >
              <div>
                <p className="text-sm text-slate-800">{n.text}</p>
                <p className="mt-1 text-xs text-slate-400">{n.created}</p>
              </div>
              <button
                onClick={() => remove(n.id)}
                className="text-xs text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-red-500"
              >
                刪除
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
