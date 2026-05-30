import { useState } from 'react'
import { useCollection } from '../../lib/store'
import { classesCol, studentsCol } from '../../data/collections'

// 班別管理 — 用共用 store，課程進度 / 成績管理都會用到同一批班別
export default function ClassesWidget() {
  const classes = useCollection(classesCol)
  const students = useCollection(studentsCol)
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')

  const add = () => {
    if (!name.trim()) return
    classesCol.add({
      name: name.trim(),
      subject: subject.trim() || 'BAFS（商業管理）',
    })
    setName('')
    setSubject('')
  }

  const remove = (id: string) => {
    classesCol.remove(id)
    // 連帶清走該班學生
    students.filter((s) => s.classId === id).forEach((s) => studentsCol.remove(s.id))
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="班別（例如 5A）"
          className="w-32 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
        />
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="科目 / 組別"
          className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
        />
        <button
          onClick={add}
          className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-strong"
        >
          新增班別
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {classes.map((c) => {
          const count = students.filter((s) => s.classId === c.id).length
          return (
            <div
              key={c.id}
              className="group rounded-2xl border border-slate-200 bg-white p-4"
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
              <p className="mt-3 text-xs text-slate-400">👥 {count} 位學生</p>
            </div>
          )
        })}
        {classes.length === 0 && (
          <p className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-400 sm:col-span-2">
            仲未有班別，喺上面新增一個啦
          </p>
        )}
      </div>
    </div>
  )
}
