import { useMemo, useState } from 'react'
import { useCollection } from '../../lib/store'
import {
  classesCol,
  studentsCol,
  assessmentsCol,
  scoresCol,
  topicsCol,
} from '../../data/collections'

type Tab = 'grid' | 'students' | 'assessments' | 'analysis'

const TABS: { id: Tab; label: string }[] = [
  { id: 'grid', label: '成績表' },
  { id: 'students', label: '學生' },
  { id: 'assessments', label: '評估' },
  { id: 'analysis', label: '分析' },
]

export default function Gradebook() {
  const classes = useCollection(classesCol)
  const [classId, setClassId] = useState(classes[0]?.id ?? '')
  const [tab, setTab] = useState<Tab>('grid')

  const activeClass = classes.find((c) => c.id === classId) ?? classes[0]

  if (classes.length === 0) {
    return (
      <p className="rounded-xl bg-slate-50 px-4 py-10 text-center text-sm text-slate-400">
        仲未有班別。先去「班別管理」新增班別。
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {classes.map((c) => (
          <button
            key={c.id}
            onClick={() => setClassId(c.id)}
            className={
              c.id === activeClass?.id
                ? 'rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-white'
                : 'rounded-full bg-slate-100 px-4 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-200'
            }
          >
            {c.name}
          </button>
        ))}
      </div>

      <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={
              tab === t.id
                ? 'flex-1 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 shadow-sm'
                : 'flex-1 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500'
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeClass && tab === 'grid' && <ScoreGrid classId={activeClass.id} />}
      {activeClass && tab === 'students' && (
        <StudentsTab classId={activeClass.id} />
      )}
      {activeClass && tab === 'assessments' && (
        <AssessmentsTab classId={activeClass.id} />
      )}
      {activeClass && tab === 'analysis' && (
        <AnalysisTab classId={activeClass.id} />
      )}
    </div>
  )
}

// ───── 成績表（學生 × 評估）─────
function ScoreGrid({ classId }: { classId: string }) {
  const students = useCollection(studentsCol).filter((s) => s.classId === classId)
  const assessments = useCollection(assessmentsCol).filter(
    (a) => a.classId === classId,
  )
  const scores = useCollection(scoresCol)

  const getScore = (aId: string, sId: string) =>
    scores.find((x) => x.assessmentId === aId && x.studentId === sId)

  const setScore = (aId: string, sId: string, raw: string, max: number) => {
    const val = raw === '' ? null : Math.max(0, Math.min(max, Number(raw)))
    const rec = getScore(aId, sId)
    if (rec) scoresCol.update(rec.id, { score: val })
    else scoresCol.add({ assessmentId: aId, studentId: sId, score: val })
  }

  const studentAvg = (sId: string) => {
    const ps = assessments
      .map((a) => {
        const sc = getScore(a.id, sId)?.score
        return sc != null ? sc / a.maxScore : null
      })
      .filter((x): x is number => x != null)
    if (ps.length === 0) return null
    return Math.round((ps.reduce((s, x) => s + x, 0) / ps.length) * 100)
  }

  if (students.length === 0 || assessments.length === 0) {
    return (
      <p className="rounded-xl bg-slate-50 px-4 py-10 text-center text-sm text-slate-400">
        請先喺「學生」同「評估」分頁加入資料，先可以填成績。
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="bg-slate-50">
            <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2 text-left font-semibold text-slate-600">
              學生
            </th>
            {assessments.map((a) => (
              <th
                key={a.id}
                className="whitespace-nowrap px-3 py-2 text-center font-semibold text-slate-600"
              >
                {a.name}
                <span className="block text-[10px] font-normal text-slate-400">
                  /{a.maxScore}
                </span>
              </th>
            ))}
            <th className="px-3 py-2 text-center font-semibold text-slate-600">
              平均
            </th>
          </tr>
        </thead>
        <tbody>
          {students.map((s) => {
            const avg = studentAvg(s.id)
            return (
              <tr key={s.id} className="border-t border-slate-100">
                <td className="sticky left-0 z-10 bg-white px-3 py-2 font-medium text-slate-700">
                  {s.name}
                </td>
                {assessments.map((a) => (
                  <td key={a.id} className="px-2 py-1.5 text-center">
                    <input
                      type="number"
                      value={getScore(a.id, s.id)?.score ?? ''}
                      onChange={(e) =>
                        setScore(a.id, s.id, e.target.value, a.maxScore)
                      }
                      className="w-14 rounded-lg border border-slate-200 px-1.5 py-1 text-center outline-none focus:border-accent"
                    />
                  </td>
                ))}
                <td
                  className={`px-3 py-2 text-center font-semibold ${
                    avg == null
                      ? 'text-slate-300'
                      : avg < 50
                        ? 'text-rose-600'
                        : 'text-accent'
                  }`}
                >
                  {avg == null ? '—' : `${avg}%`}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ───── 學生分頁 ─────
function StudentsTab({ classId }: { classId: string }) {
  const students = useCollection(studentsCol).filter((s) => s.classId === classId)
  const [name, setName] = useState('')
  const [no, setNo] = useState('')

  const add = () => {
    if (!name.trim()) return
    studentsCol.add({ classId, name: name.trim(), studentNo: no.trim() || undefined })
    setName('')
    setNo('')
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <input
          value={no}
          onChange={(e) => setNo(e.target.value)}
          placeholder="學號"
          className="w-24 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="學生姓名"
          className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <button
          onClick={add}
          className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-strong"
        >
          加入
        </button>
      </div>
      <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
        {students.map((s) => (
          <li key={s.id} className="group flex items-center gap-3 px-4 py-2.5">
            {s.studentNo && (
              <span className="text-xs text-slate-400">{s.studentNo}</span>
            )}
            <span className="flex-1 text-sm text-slate-700">{s.name}</span>
            <button
              onClick={() => studentsCol.remove(s.id)}
              className="text-xs text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-red-500"
            >
              刪除
            </button>
          </li>
        ))}
        {students.length === 0 && (
          <li className="px-4 py-8 text-center text-sm text-slate-400">
            仲未有學生
          </li>
        )}
      </ul>
    </div>
  )
}

// ───── 評估分頁 ─────
function AssessmentsTab({ classId }: { classId: string }) {
  const assessments = useCollection(assessmentsCol).filter(
    (a) => a.classId === classId,
  )
  const topics = useCollection(topicsCol)
  const [name, setName] = useState('')
  const [type, setType] = useState('測驗')
  const [maxScore, setMaxScore] = useState('100')
  const [topicId, setTopicId] = useState('')

  const add = () => {
    if (!name.trim()) return
    assessmentsCol.add({
      classId,
      name: name.trim(),
      type,
      maxScore: Number(maxScore) || 100,
      topicId: topicId || undefined,
      createdAt: new Date().toISOString(),
    })
    setName('')
    setMaxScore('100')
    setTopicId('')
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2 rounded-2xl border border-accent/30 bg-accent-soft/40 p-4">
        <div className="flex flex-wrap gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="評估名稱（例如 第一次測驗）"
            className="min-w-[160px] flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-accent"
          >
            {['測驗', '考試', '功課', '專題'].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <input
            value={maxScore}
            onChange={(e) => setMaxScore(e.target.value.replace(/\D/g, ''))}
            placeholder="滿分"
            className="w-20 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={topicId}
            onChange={(e) => setTopicId(e.target.value)}
            className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-accent"
          >
            <option value="">（選填）連住課題 — 之後可分析弱項</option>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.topic}
              </option>
            ))}
          </select>
          <button
            onClick={add}
            className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-strong"
          >
            新增
          </button>
        </div>
      </div>
      <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
        {assessments.map((a) => (
          <li key={a.id} className="group flex items-center gap-3 px-4 py-2.5">
            <span className="flex-1 text-sm text-slate-700">
              {a.name}
              <span className="ml-2 text-xs text-slate-400">
                {a.type} · 滿分 {a.maxScore}
              </span>
            </span>
            <button
              onClick={() => assessmentsCol.remove(a.id)}
              className="text-xs text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-red-500"
            >
              刪除
            </button>
          </li>
        ))}
        {assessments.length === 0 && (
          <li className="px-4 py-8 text-center text-sm text-slate-400">
            仲未有評估
          </li>
        )}
      </ul>
    </div>
  )
}

// ───── 分析分頁 ─────
function AnalysisTab({ classId }: { classId: string }) {
  const students = useCollection(studentsCol).filter((s) => s.classId === classId)
  const assessments = useCollection(assessmentsCol).filter(
    (a) => a.classId === classId,
  )
  const scores = useCollection(scoresCol)
  const topics = useCollection(topicsCol)

  const pctOf = (aId: string, sId: string, max: number) => {
    const sc = scores.find((x) => x.assessmentId === aId && x.studentId === sId)
      ?.score
    return sc != null ? sc / max : null
  }

  const stats = useMemo(() => {
    // 班平均
    const all: number[] = []
    students.forEach((s) =>
      assessments.forEach((a) => {
        const p = pctOf(a.id, s.id, a.maxScore)
        if (p != null) all.push(p)
      }),
    )
    const classAvg = all.length
      ? Math.round((all.reduce((x, y) => x + y, 0) / all.length) * 100)
      : null

    // 按課題分析
    const byTopic = new Map<string, number[]>()
    assessments.forEach((a) => {
      if (!a.topicId) return
      students.forEach((s) => {
        const p = pctOf(a.id, s.id, a.maxScore)
        if (p != null) {
          const arr = byTopic.get(a.topicId!) ?? []
          arr.push(p)
          byTopic.set(a.topicId!, arr)
        }
      })
    })
    const topicStats = [...byTopic.entries()]
      .map(([tid, arr]) => ({
        topic: topics.find((t) => t.id === tid)?.topic ?? '未分類',
        avg: Math.round((arr.reduce((x, y) => x + y, 0) / arr.length) * 100),
      }))
      .sort((a, b) => a.avg - b.avg)

    // 需關注學生（平均 < 50%）
    const weakStudents = students
      .map((s) => {
        const ps = assessments
          .map((a) => pctOf(a.id, s.id, a.maxScore))
          .filter((x): x is number => x != null)
        const avg = ps.length
          ? Math.round((ps.reduce((x, y) => x + y, 0) / ps.length) * 100)
          : null
        return { name: s.name, avg }
      })
      .filter((x) => x.avg != null && x.avg < 50)

    return { classAvg, topicStats, weakStudents }
  }, [students, assessments, scores, topics])

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm text-slate-500">班級平均</p>
        <p className="mt-1 text-3xl font-bold text-accent">
          {stats.classAvg == null ? '—' : `${stats.classAvg}%`}
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="mb-2 text-sm font-semibold text-slate-700">
          各課題表現（由弱到強）
        </p>
        {stats.topicStats.length === 0 ? (
          <p className="text-sm text-slate-400">
            將評估連住課題，就會喺度睇到弱項分析。
          </p>
        ) : (
          <ul className="space-y-2">
            {stats.topicStats.map((t) => (
              <li key={t.topic}>
                <div className="flex justify-between text-xs text-slate-500">
                  <span>{t.topic}</span>
                  <span>{t.avg}%</span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${t.avg < 50 ? 'bg-rose-400' : t.avg < 70 ? 'bg-amber-400' : 'bg-accent'}`}
                    style={{ width: `${t.avg}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="mb-2 text-sm font-semibold text-slate-700">
          需關注學生（平均低於 50%）
        </p>
        {stats.weakStudents.length === 0 ? (
          <p className="text-sm text-slate-400">暫時冇（或者未夠資料）。</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {stats.weakStudents.map((s) => (
              <span
                key={s.name}
                className="rounded-full bg-rose-100 px-3 py-1 text-xs font-medium text-rose-700"
              >
                {s.name} · {s.avg}%
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
