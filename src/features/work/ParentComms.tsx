import { useMemo, useState } from 'react'
import { useCollection } from '../../lib/store'
import { parentCommsCol, classesCol, studentsCol } from '../../data/collections'
import type { ParentComm } from '../../data/types'

const CHANNELS = ['電話', '電郵', '面談', '手冊'] as const
type Channel = (typeof CHANNELS)[number]

const today = () => new Date().toISOString().slice(0, 10)

export default function ParentComms() {
  const comms = useCollection(parentCommsCol)
  const classes = useCollection(classesCol)
  const students = useCollection(studentsCol)

  // 新增表單狀態
  const [classId, setClassId] = useState('')
  const [studentId, setStudentId] = useState('')
  const [date, setDate] = useState(today())
  const [channel, setChannel] = useState<Channel>('電話')
  const [summary, setSummary] = useState('')
  const [followUp, setFollowUp] = useState(false)

  // 篩選狀態
  const [filterClassId, setFilterClassId] = useState('')
  const [onlyFollowUp, setOnlyFollowUp] = useState(false)

  const classMap = useMemo(
    () => new Map(classes.map((c) => [c.id, c])),
    [classes],
  )
  const studentMap = useMemo(
    () => new Map(students.map((s) => [s.id, s])),
    [students],
  )

  // 新增表單可揀學生（按所揀班別 filter）
  const formStudents = useMemo(
    () => (classId ? students.filter((s) => s.classId === classId) : []),
    [students, classId],
  )

  const visibleComms = useMemo(() => {
    return comms
      .filter((c) => (filterClassId ? c.classId === filterClassId : true))
      .filter((c) => (onlyFollowUp ? c.followUp === true : true))
      .slice()
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  }, [comms, filterClassId, onlyFollowUp])

  const canSubmit = classId !== '' && summary.trim() !== ''

  const resetForm = () => {
    setStudentId('')
    setDate(today())
    setChannel('電話')
    setSummary('')
    setFollowUp(false)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    parentCommsCol.add({
      classId,
      studentId: studentId || undefined,
      date,
      channel,
      summary: summary.trim(),
      followUp,
      createdAt: new Date().toISOString(),
    })
    resetForm()
  }

  const describeTarget = (c: ParentComm) => {
    const cls = classMap.get(c.classId)
    const stu = c.studentId ? studentMap.get(c.studentId) : undefined
    const clsName = cls?.name ?? '未知班別'
    return stu ? `${clsName}・${stu.name}` : clsName
  }

  const inputClass =
    'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-accent focus:ring-2 focus:ring-accent/30'
  const labelClass = 'mb-1 block text-sm font-medium text-slate-700'

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <header>
        <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">
          家長 / 學生溝通記錄
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          記錄與家長或學生的聯絡內容，並標示需要跟進的事項。
        </p>
      </header>

      {/* 新增記錄 */}
      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
      >
        <h2 className="text-base font-semibold text-slate-900">新增記錄</h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="pc-class">
              班別
            </label>
            <select
              id="pc-class"
              className={inputClass}
              value={classId}
              onChange={(e) => {
                setClassId(e.target.value)
                setStudentId('')
              }}
            >
              <option value="">請選擇班別</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.subject ? `（${c.subject}）` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass} htmlFor="pc-student">
              學生（選填）
            </label>
            <select
              id="pc-student"
              className={inputClass}
              value={studentId}
              disabled={!classId}
              onChange={(e) => setStudentId(e.target.value)}
            >
              <option value="">
                {classId ? '全班 / 不指定' : '請先選擇班別'}
              </option>
              {formStudents.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.studentNo ? `（${s.studentNo}）` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass} htmlFor="pc-date">
              日期
            </label>
            <input
              id="pc-date"
              type="date"
              className={inputClass}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="pc-channel">
              聯絡方式
            </label>
            <select
              id="pc-channel"
              className={inputClass}
              value={channel}
              onChange={(e) => setChannel(e.target.value as Channel)}
            >
              {CHANNELS.map((ch) => (
                <option key={ch} value={ch}>
                  {ch}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={labelClass} htmlFor="pc-summary">
            內容摘要
          </label>
          <textarea
            id="pc-summary"
            className={`${inputClass} min-h-[96px] resize-y`}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="記錄溝通的重點內容…"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-accent focus:ring-accent/30"
            checked={followUp}
            onChange={(e) => setFollowUp(e.target.checked)}
          />
          需要跟進
        </label>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-strong focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            新增記錄
          </button>
        </div>
      </form>

      {/* 篩選 */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="text-sm font-medium text-slate-700" htmlFor="pc-filter-class">
            按班別篩選
          </label>
          <select
            id="pc-filter-class"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
            value={filterClassId}
            onChange={(e) => setFilterClassId(e.target.value)}
          >
            <option value="">全部班別</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-accent focus:ring-accent/30"
            checked={onlyFollowUp}
            onChange={(e) => setOnlyFollowUp(e.target.checked)}
          />
          只睇需要跟進
        </label>
      </div>

      {/* 記錄列表 */}
      <section className="space-y-3">
        {visibleComms.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
            暫無溝通記錄。
          </p>
        ) : (
          visibleComms.map((c) => (
            <article
              key={c.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-slate-900">
                  {c.date}
                </span>
                <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent-strong">
                  {c.channel}
                </span>
                {c.followUp && (
                  <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                    待跟進
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => parentCommsCol.remove(c.id)}
                  className="ml-auto rounded-lg px-2 py-1 text-xs font-medium text-slate-400 transition hover:bg-slate-100 hover:text-red-600"
                >
                  刪除
                </button>
              </div>
              <p className="mt-1 text-sm text-slate-600">{describeTarget(c)}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">
                {c.summary}
              </p>
            </article>
          ))
        )}
      </section>
    </div>
  )
}
