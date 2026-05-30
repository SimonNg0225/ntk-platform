import { useState } from 'react'
import { useCollection } from '../../lib/store'
import { notesCol } from '../../data/collections'

// 學習筆記
export default function NotesWidget() {
  const notes = useCollection(notesCol)
  const [draft, setDraft] = useState('')

  const add = () => {
    const text = draft.trim()
    if (!text) return
    notesCol.add({ content: text, createdAt: new Date().toISOString() })
    setDraft('')
  }

  const sorted = [...notes].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="記低一個學到嘅重點…"
          className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
        />
        <button
          onClick={add}
          className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-strong"
        >
          加入
        </button>
      </div>

      {sorted.length === 0 ? (
        <p className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
          仲未有筆記，喺上面打低你嘅第一個學習重點啦 ✍️
        </p>
      ) : (
        <ul className="space-y-2">
          {sorted.map((n) => (
            <li
              key={n.id}
              className="group flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3"
            >
              <div>
                <p className="text-sm text-slate-800">{n.content}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {new Date(n.createdAt).toLocaleString('zh-HK')}
                </p>
              </div>
              <button
                onClick={() => notesCol.remove(n.id)}
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
