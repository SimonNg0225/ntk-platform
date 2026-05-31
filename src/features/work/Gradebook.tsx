import { useMemo, useState } from 'react'
import { useCollection } from '../../lib/store'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import {
  classesCol,
  studentsCol,
  assessmentsCol,
  scoresCol,
  topicsCol,
} from '../../data/collections'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  IconButton,
  Input,
  Pills,
  Select,
  StatCard,
  Tabs,
} from '../../ui'
import {
  BarChart3,
  Download,
  FolderOpen,
  GraduationCap,
  NotebookPen,
  School,
  Target,
  TrendingDown,
  Trash2,
  Trophy,
} from 'lucide-react'

type Tab = 'grid' | 'students' | 'assessments' | 'analysis'

const TABS: { id: Tab; label: string }[] = [
  { id: 'grid', label: '成績表' },
  { id: 'students', label: '學生' },
  { id: 'assessments', label: '評估' },
  { id: 'analysis', label: '分析' },
]

// ───── 等級（按百分比）─────
function gradeOf(
  pct: number,
): { label: string; tone: 'green' | 'accent' | 'amber' | 'rose' } {
  if (pct >= 75) return { label: '優', tone: 'green' }
  if (pct >= 60) return { label: '良', tone: 'accent' }
  if (pct >= 50) return { label: '及格', tone: 'amber' }
  return { label: '待改進', tone: 'rose' }
}

function pctTone(pct: number): 'rose' | 'amber' | 'accent' {
  if (pct < 50) return 'rose'
  if (pct < 70) return 'amber'
  return 'accent'
}

const BAR_FILL: Record<'rose' | 'amber' | 'accent', string> = {
  rose: 'bg-rose-400',
  amber: 'bg-amber-400',
  accent: 'bg-accent',
}

export default function Gradebook() {
  const classes = useCollection(classesCol)
  const [classId, setClassId] = useState(classes[0]?.id ?? '')
  const [tab, setTab] = useState<Tab>('grid')

  const activeClass = classes.find((c) => c.id === classId) ?? classes[0]

  if (classes.length === 0) {
    return (
      <EmptyState
        icon={School}
        title="仲未有班別"
        hint="請先去「班別管理」新增班別，先可以記錄成績。"
      />
    )
  }

  return (
    <div className="space-y-4">
      <Pills
        options={classes.map((c) => ({ id: c.id, label: c.name }))}
        active={activeClass?.id ?? ''}
        onChange={setClassId}
      />

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {activeClass && tab === 'grid' && (
        <ScoreGrid classId={activeClass.id} className={activeClass.name} />
      )}
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
function ScoreGrid({
  classId,
  className,
}: {
  classId: string
  className: string
}) {
  const toast = useToast()
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

  // 全班各評估平均（百分比）
  const assessmentAvg = (aId: string, max: number) => {
    const ps = students
      .map((s) => {
        const sc = getScore(aId, s.id)?.score
        return sc != null ? sc / max : null
      })
      .filter((x): x is number => x != null)
    if (ps.length === 0) return null
    return Math.round((ps.reduce((s, x) => s + x, 0) / ps.length) * 100)
  }

  const exportCsv = () => {
    const esc = (v: string | number) => {
      const s = String(v)
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const header = [
      '學號',
      '學生',
      ...assessments.map((a) => `${a.name}（滿分${a.maxScore}）`),
      '平均(%)',
    ]
    const rows = students.map((s) => {
      const cells: (string | number)[] = [s.studentNo ?? '', s.name]
      assessments.forEach((a) => {
        const sc = getScore(a.id, s.id)?.score
        cells.push(sc == null ? '' : sc)
      })
      const avg = studentAvg(s.id)
      cells.push(avg == null ? '' : avg)
      return cells
    })
    const csv = [header, ...rows].map((r) => r.map(esc).join(',')).join('\r\n')
    const blob = new Blob([`﻿${csv}`], {
      type: 'text/csv;charset=utf-8;',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${className}_成績.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`已匯出 ${className} 成績 CSV`)
  }

  if (students.length === 0 || assessments.length === 0) {
    return (
      <EmptyState
        icon={NotebookPen}
        title="未夠資料填成績"
        hint="請先喺「學生」同「評估」分頁加入資料，先可以填成績。"
      />
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="secondary" size="sm" icon={Download} onClick={exportCsv}>
          匯出 CSV
        </Button>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="bg-slate-50 dark:bg-slate-800/50">
            <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2 text-left font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              學生
            </th>
            {assessments.map((a) => (
              <th
                key={a.id}
                className="whitespace-nowrap px-3 py-2 text-center font-semibold text-slate-600 dark:text-slate-300"
              >
                {a.name}
                <span className="mt-0.5 block text-[10px] font-normal text-slate-400">
                  {a.type} · 滿分 {a.maxScore}
                </span>
              </th>
            ))}
            <th className="px-3 py-2 text-center font-semibold text-slate-600 dark:text-slate-300">
              平均
            </th>
          </tr>
        </thead>
        <tbody>
          {students.map((s) => {
            const avg = studentAvg(s.id)
            return (
              <tr
                key={s.id}
                className="border-t border-slate-100 dark:border-slate-700"
              >
                <td className="sticky left-0 z-10 bg-white px-3 py-2 font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  {s.studentNo && (
                    <span className="mr-1.5 text-xs text-slate-400">
                      {s.studentNo}
                    </span>
                  )}
                  {s.name}
                </td>
                {assessments.map((a) => {
                  const sc = getScore(a.id, s.id)?.score
                  const low = sc != null && sc / a.maxScore < 0.5
                  return (
                    <td key={a.id} className="px-2 py-1.5 text-center">
                      <input
                        type="number"
                        value={sc ?? ''}
                        onChange={(e) =>
                          setScore(a.id, s.id, e.target.value, a.maxScore)
                        }
                        className={`w-14 rounded-lg border px-1.5 py-1 text-center font-medium tabular-nums outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25 ${
                          low
                            ? 'border-rose-300 bg-rose-50 text-rose-600 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
                            : 'border-slate-200 text-slate-800 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100'
                        }`}
                      />
                    </td>
                  )
                })}
                <td className="px-3 py-2 text-center">
                  {avg == null ? (
                    <span className="text-slate-300">—</span>
                  ) : (
                    <div className="flex items-center justify-center gap-1.5">
                      <span
                        className={`font-semibold tabular-nums ${
                          avg < 50
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-accent'
                        }`}
                      >
                        {avg}%
                      </span>
                      <Badge tone={gradeOf(avg).tone}>
                        {gradeOf(avg).label}
                      </Badge>
                    </div>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">
            <td className="sticky left-0 z-10 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              全班平均
            </td>
            {assessments.map((a) => {
              const av = assessmentAvg(a.id, a.maxScore)
              return (
                <td
                  key={a.id}
                  className={`px-3 py-2 text-center text-xs font-semibold tabular-nums ${
                    av == null
                      ? 'text-slate-300'
                      : av < 50
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {av == null ? '—' : `${av}%`}
                </td>
              )
            })}
            <td className="px-3 py-2" />
          </tr>
        </tfoot>
      </table>
      </div>
    </div>
  )
}

// ───── 學生分頁 ─────
function StudentsTab({ classId }: { classId: string }) {
  const toast = useToast()
  const confirm = useConfirm()
  const students = useCollection(studentsCol).filter((s) => s.classId === classId)
  const [name, setName] = useState('')
  const [no, setNo] = useState('')

  const add = () => {
    if (!name.trim()) return
    studentsCol.add({ classId, name: name.trim(), studentNo: no.trim() || undefined })
    toast.success(`已新增學生「${name.trim()}」`)
    setName('')
    setNo('')
  }

  const remove = async (id: string, sName: string) => {
    const ok = await confirm({
      title: '刪除學生？',
      message: `將會移除「${sName}」及其所有成績記錄，此操作無法復原。`,
      confirmText: '刪除',
      tone: 'danger',
    })
    if (!ok) return
    studentsCol.remove(id)
    toast.success('已刪除學生')
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-24">
          <Field label="學號">
            <Input value={no} onChange={(e) => setNo(e.target.value)} placeholder="選填" />
          </Field>
        </div>
        <div className="min-w-[160px] flex-1">
          <Field label="學生姓名">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()}
              placeholder="輸入姓名"
            />
          </Field>
        </div>
        <Button onClick={add}>加入</Button>
      </div>
      {students.length === 0 ? (
        <EmptyState icon={GraduationCap} title="仲未有學生" hint="喺上面輸入姓名加入第一位學生。" />
      ) : (
        <Card>
          <ul className="divide-y divide-slate-100 dark:divide-slate-700">
            {students.map((s) => (
              <li key={s.id} className="group flex items-center gap-3 px-4 py-2.5">
                {s.studentNo && (
                  <Badge tone="slate">{s.studentNo}</Badge>
                )}
                <span className="flex-1 text-sm text-slate-700 dark:text-slate-200">
                  {s.name}
                </span>
                <IconButton
                  label="刪除學生"
                  onClick={() => remove(s.id, s.name)}
                  className="opacity-0 transition group-hover:opacity-100 hover:text-rose-500"
                >
                  <Trash2 size={16} strokeWidth={1.8} />
                </IconButton>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

// ───── 評估分頁 ─────
function AssessmentsTab({ classId }: { classId: string }) {
  const toast = useToast()
  const confirm = useConfirm()
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
    toast.success(`已新增評估「${name.trim()}」`)
    setName('')
    setMaxScore('100')
    setTopicId('')
  }

  const remove = async (id: string, aName: string) => {
    const ok = await confirm({
      title: '刪除評估？',
      message: `將會移除「${aName}」及其所有成績記錄，此操作無法復原。`,
      confirmText: '刪除',
      tone: 'danger',
    })
    if (!ok) return
    assessmentsCol.remove(id)
    toast.success('已刪除評估')
  }

  return (
    <div className="space-y-3">
      <Card className="space-y-3 border-accent/30 bg-accent-soft/40 p-4">
        <div className="flex flex-wrap gap-2">
          <div className="min-w-[160px] flex-1">
            <Field label="評估名稱">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如 第一次測驗"
              />
            </Field>
          </div>
          <div className="w-28">
            <Field label="類型">
              <Select value={type} onChange={(e) => setType(e.target.value)}>
                {['測驗', '考試', '功課', '專題'].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="w-20">
            <Field label="滿分">
              <Input
                value={maxScore}
                onChange={(e) => setMaxScore(e.target.value.replace(/\D/g, ''))}
                placeholder="100"
              />
            </Field>
          </div>
        </div>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Field label="課題（選填）" hint="連住課題之後可分析弱項">
              <Select value={topicId} onChange={(e) => setTopicId(e.target.value)}>
                <option value="">— 唔連課題 —</option>
                {topics.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.topic}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Button onClick={add}>新增</Button>
        </div>
      </Card>
      {assessments.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="仲未有評估"
          hint="喺上面新增測驗、考試或功課，先可以入分。"
        />
      ) : (
        <Card>
          <ul className="divide-y divide-slate-100 dark:divide-slate-700">
            {assessments.map((a) => {
              const topic = a.topicId
                ? topics.find((t) => t.id === a.topicId)?.topic
                : null
              return (
                <li key={a.id} className="group flex items-center gap-3 px-4 py-2.5">
                  <span className="flex-1 text-sm text-slate-700 dark:text-slate-200">
                    {a.name}
                    <span className="ml-2 inline-flex flex-wrap items-center gap-1.5 align-middle">
                      <Badge tone="slate">{a.type}</Badge>
                      <Badge tone="accent">滿分 {a.maxScore}</Badge>
                      {topic && <Badge tone="blue">{topic}</Badge>}
                    </span>
                  </span>
                  <IconButton
                    label="刪除評估"
                    onClick={() => remove(a.id, a.name)}
                    className="opacity-0 transition group-hover:opacity-100 hover:text-rose-500"
                  >
                    <Trash2 size={16} strokeWidth={1.8} />
                  </IconButton>
                </li>
              )
            })}
          </ul>
        </Card>
      )}
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

    // 各學生平均
    const studentAvgs = students
      .map((s) => {
        const ps = assessments
          .map((a) => pctOf(a.id, s.id, a.maxScore))
          .filter((x): x is number => x != null)
        const avg = ps.length
          ? Math.round((ps.reduce((x, y) => x + y, 0) / ps.length) * 100)
          : null
        return { name: s.name, avg }
      })
      .filter((x): x is { name: string; avg: number } => x.avg != null)

    const sorted = [...studentAvgs].sort((a, b) => b.avg - a.avg)
    const top = sorted[0] ?? null
    const bottom = sorted.length ? sorted[sorted.length - 1] : null

    // 已評估數（最少有一個分數嘅評估）
    const gradedCount = assessments.filter((a) =>
      students.some((s) => pctOf(a.id, s.id, a.maxScore) != null),
    ).length

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
    const weakStudents = studentAvgs.filter((x) => x.avg < 50)

    return { classAvg, top, bottom, gradedCount, topicStats, weakStudents }
  }, [students, assessments, scores, topics])

  if (students.length === 0 || assessments.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="未夠資料分析"
        hint="加入學生同評估、入埋分數後，呢度會自動整理班級表現。"
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="班級平均"
          value={stats.classAvg == null ? '—' : stats.classAvg}
          unit={stats.classAvg == null ? undefined : '%'}
          icon={Target}
          highlight
        />
        <StatCard
          label="最高分學生"
          value={stats.top ? stats.top.name : '—'}
          unit={stats.top ? `${stats.top.avg}%` : undefined}
          icon={Trophy}
        />
        <StatCard
          label="最低分學生"
          value={stats.bottom ? stats.bottom.name : '—'}
          unit={stats.bottom ? `${stats.bottom.avg}%` : undefined}
          icon={TrendingDown}
        />
        <StatCard
          label="已評估數"
          value={stats.gradedCount}
          unit={`/ ${assessments.length}`}
          icon={FolderOpen}
        />
      </div>

      <Card className="p-4">
        <p className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
          各課題表現（由弱到強）
        </p>
        {stats.topicStats.length === 0 ? (
          <p className="text-sm text-slate-400">
            將評估連住課題，就會喺度睇到弱項分析。
          </p>
        ) : (
          <ul className="space-y-3">
            {stats.topicStats.map((t) => {
              const tone = pctTone(t.avg)
              return (
                <li key={t.topic}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-slate-600 dark:text-slate-300">
                      {t.topic}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                        {t.avg}%
                      </span>
                      <Badge tone={gradeOf(t.avg).tone}>
                        {gradeOf(t.avg).label}
                      </Badge>
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                    <div
                      className={`h-full rounded-full transition-all ${BAR_FILL[tone]}`}
                      style={{ width: `${t.avg}%` }}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <Card className="p-4">
        <p className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
          需關注學生（平均低於 50%）
        </p>
        {stats.weakStudents.length === 0 ? (
          <p className="text-sm text-slate-400">暫時冇（或者未夠資料）。</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {stats.weakStudents.map((s) => (
              <Badge key={s.name} tone="rose" className="tabular-nums">
                {s.name} · {s.avg}%
              </Badge>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
