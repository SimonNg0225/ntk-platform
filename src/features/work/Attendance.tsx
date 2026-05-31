import { useMemo, useState } from 'react'
import { useCollection } from '../../lib/store'
import { attendanceCol, classesCol, studentsCol } from '../../data/collections'
import type { AttendanceRecord, AttendanceStatus } from '../../data/types'
import { Button, Card, EmptyState, Pills, SectionTitle, StatCard } from '../../ui'
import { useToast } from '../../context/ToastContext'
import {
  AlarmClock,
  Ban,
  CheckSquare,
  GraduationCap,
  School,
} from 'lucide-react'

const STATUS_OPTIONS: { value: AttendanceStatus; label: string }[] = [
  { value: 'present', label: '出席' },
  { value: 'late', label: '遲到' },
  { value: 'absent', label: '缺席' },
]

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  present: '出席',
  late: '遲到',
  absent: '缺席',
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function Attendance() {
  const classes = useCollection(classesCol)
  const students = useCollection(studentsCol)
  const attendance = useCollection(attendanceCol)
  const toast = useToast()

  const [classId, setClassId] = useState<string>('')
  const [date, setDate] = useState<string>(todayStr())

  // 確保有選中的班別（預設第一個）
  const activeClassId = useMemo(() => {
    if (classId && classes.some((c) => c.id === classId)) return classId
    return classes[0]?.id ?? ''
  }, [classId, classes])

  const classStudents = useMemo(
    () => students.filter((s) => s.classId === activeClassId),
    [students, activeClassId],
  )

  // 當日該班的記錄索引：studentId -> record
  const recordByStudent = useMemo(() => {
    const map = new Map<string, AttendanceRecord>()
    for (const r of attendance) {
      if (r.classId === activeClassId && r.date === date) {
        map.set(r.studentId, r)
      }
    }
    return map
  }, [attendance, activeClassId, date])

  const stats = useMemo(() => {
    let present = 0
    let late = 0
    let absent = 0
    for (const s of classStudents) {
      const status = recordByStudent.get(s.id)?.status
      if (status === 'present') present += 1
      else if (status === 'late') late += 1
      else if (status === 'absent') absent += 1
    }
    return { present, late, absent }
  }, [classStudents, recordByStudent])

  function mark(studentId: string, status: AttendanceStatus) {
    const existing = recordByStudent.get(studentId)
    if (existing) {
      if (existing.status === status) {
        // 再撳同一個狀態 = 取消標記
        attendanceCol.remove(existing.id)
      } else {
        attendanceCol.update(existing.id, { status })
      }
    } else {
      attendanceCol.add({ classId: activeClassId, studentId, date, status })
    }
  }

  function markAllPresent() {
    if (classStudents.length === 0) return
    for (const s of classStudents) {
      const existing = recordByStudent.get(s.id)
      if (existing) {
        if (existing.status !== 'present') {
          attendanceCol.update(existing.id, { status: 'present' })
        }
      } else {
        attendanceCol.add({
          classId: activeClassId,
          studentId: s.id,
          date,
          status: 'present',
        })
      }
    }
    toast.success('已將全班標記為出席')
  }

  function statusButtonClass(status: AttendanceStatus, active: boolean): string {
    const base =
      'rounded-xl px-3 py-1.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2'
    if (status === 'present') {
      return active
        ? `${base} bg-accent text-white hover:bg-accent-strong focus-visible:ring-accent/40`
        : `${base} bg-accent-soft text-accent-strong hover:bg-accent hover:text-white focus-visible:ring-accent/40`
    }
    if (status === 'late') {
      return active
        ? `${base} bg-amber-500 text-white hover:bg-amber-600 focus-visible:ring-amber-500/40`
        : `${base} bg-amber-50 text-amber-700 hover:bg-amber-500 hover:text-white focus-visible:ring-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500 dark:hover:text-white`
    }
    return active
      ? `${base} bg-rose-500 text-white hover:bg-rose-600 focus-visible:ring-rose-500/40`
      : `${base} bg-rose-50 text-rose-700 hover:bg-rose-500 hover:text-white focus-visible:ring-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500 dark:hover:text-white`
  }

  const pillOptions = classes.map((c) => ({
    id: c.id,
    label: c.subject ? `${c.name}・${c.subject}` : c.name,
  }))

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 sm:text-2xl">
          點名 / 出席
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          揀班別同日期，為學生標記出席狀態。
        </p>
      </header>

      {classes.length === 0 ? (
        <EmptyState
          icon={School}
          title="未有班別"
          hint="請先去「班別管理」新增班別，先可以點名。"
        />
      ) : (
        <>
          {/* 班別 + 日期 */}
          <section className="space-y-3">
            <SectionTitle>班別</SectionTitle>
            <Pills
              options={pillOptions}
              active={activeClassId}
              onChange={setClassId}
            />
            <div className="flex flex-col gap-1 pt-1 sm:max-w-xs">
              <label
                htmlFor="attendance-date"
                className="text-xs font-medium text-slate-600 dark:text-slate-300"
              >
                日期
              </label>
              <input
                id="attendance-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
          </section>

          {/* 統計 */}
          {classStudents.length > 0 && (
            <section className="grid grid-cols-3 gap-3">
              <StatCard
                label="出席"
                value={stats.present}
                unit="人"
                icon={CheckSquare}
                highlight
              />
              <StatCard label="遲到" value={stats.late} unit="人" icon={AlarmClock} />
              <StatCard label="缺席" value={stats.absent} unit="人" icon={Ban} />
            </section>
          )}

          {/* 學生名單 */}
          <section className="space-y-3">
            <SectionTitle
              right={
                classStudents.length > 0 ? (
                  <Button size="sm" variant="secondary" onClick={markAllPresent}>
                    全部標出席
                  </Button>
                ) : undefined
              }
            >
              學生名單
            </SectionTitle>

            {classStudents.length === 0 ? (
              <EmptyState
                icon={GraduationCap}
                title="此班別未有學生"
                hint="請去「班別管理 / 成績管理」加入學生。"
              />
            ) : (
              <ul className="space-y-2">
                {classStudents.map((s) => {
                  const current = recordByStudent.get(s.id)?.status
                  return (
                    <Card key={s.id} className="p-3">
                      <li className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="truncate font-medium text-slate-900 dark:text-slate-100">
                            {s.name}
                          </div>
                          <div className="text-xs text-slate-400 dark:text-slate-500">
                            {s.studentNo ? `學號 ${s.studentNo}` : '未有學號'}
                            {current ? ` · ${STATUS_LABEL[current]}` : ' · 未標記'}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {STATUS_OPTIONS.map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => mark(s.id, opt.value)}
                              className={statusButtonClass(
                                opt.value,
                                current === opt.value,
                              )}
                              aria-pressed={current === opt.value}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </li>
                    </Card>
                  )
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}
