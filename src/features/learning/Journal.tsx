import { useState } from 'react'
import { useCollection } from '../../lib/store'
import { journalCol } from '../../data/collections'

const MOODS = ['😀', '🙂', '😐', '😓', '😣']
const PROMPTS = [
  '今日學咗啲咩？',
  '有咩心得 / 突破？',
  '邊度仲未明，聽日想點跟進？',
]

export default function Journal() {
  const entries = useCollection(journalCol)
  const today = new Date().toISOString().slice(0, 10)
  const todayEntry = entries.find((e) => e.date === today)

  const [content, setContent] = useState(todayEntry?.content ?? '')
  const [mood, setMood] = useState(todayEntry?.mood ?? '')
  const [saved, setSaved] = useState(false)

  const save = () => {
    if (!content.trim()) return
    if (todayEntry) {
      journalCol.update(todayEntry.id, { content: content.trim(), mood })
    } else {
      journalCol.add({ date: today, content: content.trim(), mood })
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  const past = [...entries]
    .filter((e) => e.date !== today)
    .sort((a, b) => (a.date < b.date ? 1 : -1))

  return (
    <div className="space-y-5">
      {/* 今日 */}
      <div className="space-y-3 rounded-2xl border border-accent/30 bg-accent-soft/40 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-700">
            今日反思 · {today}
          </p>
          <div className="flex gap-1">
            {MOODS.map((m) => (
              <button
                key={m}
                onClick={() => setMood(m)}
                className={`text-lg transition ${mood === m ? 'scale-125' : 'opacity-40 hover:opacity-100'}`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-slate-400">{PROMPTS.join('　')}</p>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={5}
          placeholder="寫低今日嘅學習反思…"
          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
        />
        <button
          onClick={save}
          className="w-full rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-strong"
        >
          {saved ? '已儲存 ✓' : todayEntry ? '更新今日日誌' : '儲存今日日誌'}
        </button>
      </div>

      {/* 過往 */}
      {past.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
            過往日誌
          </h3>
          <ul className="space-y-2">
            {past.map((e) => (
              <li
                key={e.id}
                className="group rounded-2xl border border-slate-200 bg-white p-4"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">
                    {e.mood} {e.date}
                  </span>
                  <button
                    onClick={() => journalCol.remove(e.id)}
                    className="text-xs text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-red-500"
                  >
                    刪除
                  </button>
                </div>
                <p className="mt-1.5 whitespace-pre-wrap text-sm text-slate-700">
                  {e.content}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
