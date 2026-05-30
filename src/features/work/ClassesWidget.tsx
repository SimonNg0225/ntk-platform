import { useState } from 'react'
import { useLocalStorage } from '../../hooks/useLocalStorage'

// 班別管理 — 記低你任教嘅班同人數
interface Klass {
  id: number
  name: string
  subject: string
  students: number
}

const SEED: Klass[] = [
  { id: 1, name: '5A', subject: 'BAFS（會計）', students: 28 },
  { id: 2, name: '6B', subject: 'BAFS（商業管理）', students: 25 },
]

export default function ClassesWidget() {
  const [classes, setClasses] = useLocalStorage<Klass[]>(
    'ntk.work.classes',
    SEED,
  )
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')

  const add = () => {
    if (!name.trim()) return
    setClasses([
      ...classes,
      {
        id: Date.now(),
        name: name.trim(),
        subject: subject.trim() || 'BAFS',
        students: 0,
      },
    ])
    setName('')
    setSubject('')
  }
  const remove = (id: number) =>
    setClasses(classes.filter((c) => c.id !== id))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="班別（例如 5A）"
          className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
        />
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="科目 / 組別"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
        />
        <button
          onClick={add}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-strong"
        >
          新增班別
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {classes.map((c) => (
          <div
            key={c.id}
            className="group rounded-xl border border-slate-200 bg-white p-4"
          >
            <div className="flex items-start justify-between">
              <span className="text-lg font-bold text-slate-800">
                {c.name}
              </span>
              <button
                onClick={() => remove(c.id)}
                className="text-xs text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-red-500"
              >
                刪除
              </button>
            </div>
            <p className="mt-1 text-sm text-slate-500">{c.subject}</p>
            <p className="mt-3 text-xs text-slate-400">
              👥 {c.students} 位學生
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
