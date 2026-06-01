import { useEffect, useMemo, useState } from 'react'
import { createCollection, useCollection } from '../../lib/store'
import { attendanceCol, classesCol, studentsCol } from '../../data/collections'
import type { AttendanceRecord, AttendanceStatus } from '../../data/types'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  IconButton,
  Input,
  Modal,
  Pills,
  ProgressBar,
  SectionTitle,
  Select,
  StatCard,
  Tabs,
  Textarea,
  cx,
} from '../../ui'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import {
  ABSENCE_KIND_LABEL,
  ABSENCE_KIND_OPTIONS,
  STATUS_GLYPH,
  STATUS_LABEL,
  STATUS_ORDER,
  STATUS_STYLE,
  type AttendanceNote,
  type StudentTally,
  countDay,
  downloadCsv,
  isExcused,
  lastPresentKey,
  longDateLabel,
  longestAbsentStreak,
  monthDays,
  monthLabel,
  rateBarTone,
  rateTone,
  recentDayKeys,
  shiftKey,
  shortDateLabel,
  summarizeNotes,
  tallyByStudent,
  todayKey,
} from './attendance/util'
import RegisterGrid from './attendance/RegisterGrid'
import TrendChart, { type TrendPoint } from './attendance/TrendChart'
import {
  AlarmClock,
  Ban,
  CalendarCheck,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Copy,
  Download,
  GraduationCap,
  LineChart,
  Pencil,
  Printer,
  RotateCcw,
  School,
  TriangleAlert,
  Users,
} from 'lucide-react'

// 本功能專屬：出席細項（病假 / 事假 / 遲到分鐘 / 早退 / 原因）
// 共用 attendanceCol 維持三態，呢度疊加 metadata，唔改 data/collections。
const notesCol = createCollection<AttendanceNote>('attendance_notes', [])

type Tab = 'rollcall' | 'register' | 'analytics'
const TABS: { id: Tab; label: string }[] = [
  { id: 'rollcall', label: '點名' },
  { id: 'register', label: '點名冊' },
  { id: 'analytics', label: '統計分析' },
]
const TAB_ICONS = {
  rollcall: ClipboardList,
  register: CalendarDays,
  analytics: LineChart,
} as const

function metaKey(classId: string, studentId: string, date: string): string {
  return `${classId}|${studentId}|${date}`
}

export default function Attendance() {
  const classes = useCollection(classesCol)
  const [classId, setClassId] = useState<string>('')
  const [tab, setTab] = useState<Tab>('rollcall')

  const activeClassId = useMemo(() => {
    if (classId && classes.some((c) => c.id === classId)) return classId
    return classes[0]?.id ?? ''
  }, [classId, classes])
  const activeClass = classes.find((c) => c.id === activeClassId)

  if (classes.length === 0) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
        <Header />
        <EmptyState
          icon={School}
          title="由第一班開始"
          hint="先去「班別管理」開好班別，呢度就可以逐日點名同睇出席趨勢。"
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
      <Header />

      <div className="space-y-3 rounded-3xl border border-slate-200/80 bg-white p-3 shadow-xs dark:border-slate-700/60 dark:bg-slate-800 dark:shadow-none">
        <Pills
          options={classes.map((c) => ({
            id: c.id,
            label: c.subject ? `${c.name}・${c.subject}` : c.name,
          }))}
          active={activeClassId}
          onChange={setClassId}
        />
        <Tabs tabs={TABS} active={tab} onChange={setTab} icons={TAB_ICONS} />
      </div>

      {activeClass && tab === 'rollcall' && <RollCall classId={activeClass.id} />}
      {activeClass && tab === 'register' && (
        <Register classId={activeClass.id} className={activeClass.name} />
      )}
      {activeClass && tab === 'analytics' && (
        <Analytics classId={activeClass.id} className={activeClass.name} />
      )}
    </div>
  )
}

function Header() {
  return (
    <header className="flex items-start gap-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
        <CalendarCheck size={22} />
      </span>
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-800 dark:text-slate-100 sm:text-2xl">
          點名 / 出席
        </h1>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          逐日點名、月度點名冊、出席率趨勢同連續缺席提示——對齊學校考勤系統。
        </p>
      </div>
    </header>
  )
}

// ════════════════════════════════════════════════════════════
//  分頁一：每日點名
// ════════════════════════════════════════════════════════════
function RollCall({ classId }: { classId: string }) {
  const toast = useToast()
  const confirm = useConfirm()
  const students = useCollection(studentsCol)
  const attendance = useCollection(attendanceCol)
  const notes = useCollection(notesCol)

  const [date, setDate] = useState<string>(todayKey())

  const classStudents = useMemo(
    () => students.filter((s) => s.classId === classId),
    [students, classId],
  )

  // studentId -> AttendanceRecord（當日該班）
  const recordByStudent = useMemo(() => {
    const map = new Map<string, AttendanceRecord>()
    for (const r of attendance) {
      if (r.classId === classId && r.date === date) map.set(r.studentId, r)
    }
    return map
  }, [attendance, classId, date])

  // metaKey -> AttendanceNote
  const noteByKey = useMemo(() => {
    const map = new Map<string, AttendanceNote>()
    for (const n of notes) {
      if (n.classId === classId && n.date === date) {
        map.set(metaKey(n.classId, n.studentId, n.date), n)
      }
    }
    return map
  }, [notes, classId, date])

  const statusMap = useMemo(() => {
    const m = new Map<string, AttendanceStatus>()
    for (const [sid, r] of recordByStudent) m.set(sid, r.status)
    return m
  }, [recordByStudent])

  const day = countDay(statusMap, classStudents.length)
  const markedCount = day.present + day.late + day.absent

  // ── 標記操作 ──
  function mark(studentId: string, status: AttendanceStatus) {
    const existing = recordByStudent.get(studentId)
    if (existing) {
      if (existing.status === status) {
        attendanceCol.remove(existing.id)
        // 同步清走 note
        const n = noteByKey.get(metaKey(classId, studentId, date))
        if (n) notesCol.remove(n.id)
      } else {
        attendanceCol.update(existing.id, { status })
      }
    } else {
      attendanceCol.add({ classId, studentId, date, status })
    }
  }

  function markAll(status: AttendanceStatus) {
    if (classStudents.length === 0) return
    for (const s of classStudents) {
      const existing = recordByStudent.get(s.id)
      if (existing) {
        if (existing.status !== status) attendanceCol.update(existing.id, { status })
      } else {
        attendanceCol.add({ classId, studentId: s.id, date, status })
      }
    }
    toast.success(`已將全班標記為${STATUS_LABEL[status]}`)
  }

  // 將未標記嘅學生補做出席
  function fillUnmarkedPresent() {
    let n = 0
    for (const s of classStudents) {
      if (!recordByStudent.has(s.id)) {
        attendanceCol.add({ classId, studentId: s.id, date, status: 'present' })
        n += 1
      }
    }
    if (n > 0) toast.success(`已將 ${n} 位未點名學生補為出席`)
    else toast.info('全部學生都已點名')
  }

  async function clearDay() {
    if (markedCount === 0) return
    const ok = await confirm({
      title: '清除當日點名？',
      message: `將會移除 ${longDateLabel(date)} 全班 ${markedCount} 筆記錄。`,
      confirmText: '清除',
      tone: 'danger',
    })
    if (!ok) return
    for (const r of recordByStudent.values()) attendanceCol.remove(r.id)
    for (const n of noteByKey.values()) notesCol.remove(n.id)
    toast.success('已清除當日點名')
  }

  // 複製對上一個有點名嘅日子
  function copyPrevious() {
    // 由 date 往前搵最近一個該班有記錄嘅日子（最多搵 30 日）
    let src = ''
    for (let i = 1; i <= 30; i++) {
      const k = shiftKey(date, -i)
      if (attendance.some((r) => r.classId === classId && r.date === k)) {
        src = k
        break
      }
    }
    if (!src) {
      toast.error('過去 30 日內冇可複製嘅點名記錄')
      return
    }
    const srcMap = new Map<string, AttendanceStatus>()
    for (const r of attendance) {
      if (r.classId === classId && r.date === src) srcMap.set(r.studentId, r.status)
    }
    let n = 0
    for (const s of classStudents) {
      const st = srcMap.get(s.id)
      if (!st) continue
      const existing = recordByStudent.get(s.id)
      if (existing) attendanceCol.update(existing.id, { status: st })
      else attendanceCol.add({ classId, studentId: s.id, date, status: st })
      n += 1
    }
    toast.success(`已由 ${src} 複製 ${n} 筆點名`)
  }

  // ── 細項 modal ──
  const [editing, setEditing] = useState<string | null>(null) // studentId
  const editingStudent = classStudents.find((s) => s.id === editing)
  const editingStatus = editing ? recordByStudent.get(editing)?.status : undefined
  const editingNote = editing
    ? noteByKey.get(metaKey(classId, editing, date))
    : undefined

  function saveNote(patch: Partial<AttendanceNote>) {
    if (!editing) return
    const key = metaKey(classId, editing, date)
    const existing = noteByKey.get(key)
    if (existing) {
      notesCol.update(existing.id, { ...patch, updatedAt: new Date().toISOString() })
    } else {
      notesCol.add({
        classId,
        studentId: editing,
        date,
        updatedAt: new Date().toISOString(),
        ...patch,
      })
    }
  }

  if (classStudents.length === 0) {
    return (
      <>
        <DateNav date={date} setDate={setDate} />
        <EmptyState
          icon={GraduationCap}
          title="呢班仲未有學生"
          hint="去「班別管理 / 成績管理」加入名單，返嚟就可以開始點名。"
        />
      </>
    )
  }

  return (
    <div className="space-y-4">
      <DateNav date={date} setDate={setDate} />

      {/* 統計 + 進度 */}
      <section className="space-y-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label="出席"
            value={day.present}
            unit="人"
            icon={CalendarCheck}
            highlight
          />
          <StatCard label="遲到" value={day.late} unit="人" icon={AlarmClock} />
          <StatCard label="缺席" value={day.absent} unit="人" icon={Ban} />
          <StatCard
            label="出席率"
            value={day.rate == null ? '—' : day.rate}
            unit={day.rate == null ? undefined : '%'}
            icon={Users}
            hint={`已點 ${markedCount}/${classStudents.length}`}
          />
        </div>
        <Card className="rounded-2xl p-3.5">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="font-medium text-slate-600 dark:text-slate-300">
              點名進度
            </span>
            <span className="tabular-nums text-slate-400" aria-live="polite">
              {markedCount}/{classStudents.length}
            </span>
          </div>
          <ProgressBar
            value={
              classStudents.length === 0
                ? 0
                : (markedCount / classStudents.length) * 100
            }
            tone={markedCount === classStudents.length ? 'green' : 'accent'}
          />
        </Card>
      </section>

      {/* 批量操作 */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" icon={CalendarCheck} onClick={() => markAll('present')}>
          全部出席
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={fillUnmarkedPresent}
          disabled={markedCount === classStudents.length}
        >
          未點名者補出席
        </Button>
        <Button size="sm" variant="secondary" icon={Copy} onClick={copyPrevious}>
          複製上次點名
        </Button>
        <Button
          size="sm"
          variant="ghost"
          icon={RotateCcw}
          onClick={clearDay}
          disabled={markedCount === 0}
        >
          清除當日
        </Button>
      </div>

      {/* 學生名單 */}
      <section className="space-y-2">
        <SectionTitle icon={Users}>學生名單</SectionTitle>
        <ul className="space-y-2">
          {classStudents.map((s) => {
            const current = recordByStudent.get(s.id)?.status
            const note = noteByKey.get(metaKey(classId, s.id, date))
            const hasDetail = !!(
              note &&
              (note.absenceKind ||
                note.lateMinutes ||
                note.earlyLeave ||
                note.reason?.trim())
            )
            return (
              <Card key={s.id} hover className="rounded-2xl p-3.5">
                <li className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-slate-900 dark:text-slate-100">
                        {s.name}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400 dark:text-slate-500">
                        <span>{s.studentNo ? `學號 ${s.studentNo}` : '未有學號'}</span>
                        {hasDetail && note && (
                          <span className="inline-flex flex-wrap items-center gap-1">
                            {note.absenceKind && current === 'absent' && (
                              <Badge tone={isExcused(note.absenceKind) ? 'blue' : 'rose'}>
                                {ABSENCE_KIND_LABEL[note.absenceKind]}
                              </Badge>
                            )}
                            {note.lateMinutes && current === 'late' ? (
                              <Badge tone="amber" className="tabular-nums">
                                遲 {note.lateMinutes} 分
                              </Badge>
                            ) : null}
                            {note.earlyLeave && <Badge tone="slate">早退</Badge>}
                            {note.reason && note.reason.trim() && (
                              <span className="max-w-[12rem] truncate italic">
                                「{note.reason.trim()}」
                              </span>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div
                    className="flex flex-wrap items-center gap-2"
                    role="group"
                    aria-label={`${s.name} 出席狀態`}
                  >
                    {STATUS_ORDER.map((st) => {
                      const active = current === st
                      const style = STATUS_STYLE[st]
                      return (
                        <button
                          key={st}
                          type="button"
                          onClick={() => mark(s.id, st)}
                          aria-pressed={active}
                          aria-label={`標記${s.name}為${STATUS_LABEL[st]}`}
                          className={cx(
                            'rounded-xl px-3 py-1.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2',
                            active ? style.solid : style.soft,
                          )}
                        >
                          {STATUS_LABEL[st]}
                        </button>
                      )
                    })}
                    <IconButton
                      label="出席細項"
                      onClick={() => setEditing(s.id)}
                      active={hasDetail}
                      disabled={!current}
                    >
                      <Pencil size={16} strokeWidth={1.8} />
                    </IconButton>
                  </div>
                </li>
              </Card>
            )
          })}
        </ul>
      </section>

      {/* 細項 modal */}
      <DetailModal
        open={!!editing}
        onClose={() => setEditing(null)}
        studentName={editingStudent?.name ?? ''}
        status={editingStatus}
        note={editingNote}
        onSave={saveNote}
      />
    </div>
  )
}

function DateNav({
  date,
  setDate,
}: {
  date: string
  setDate: (k: string) => void
}) {
  const isToday = date === todayKey()
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex items-center gap-1 rounded-2xl border border-slate-200/80 bg-white p-1 shadow-xs dark:border-slate-700/60 dark:bg-slate-800 dark:shadow-none">
        <IconButton label="前一日" onClick={() => setDate(shiftKey(date, -1))}>
          <ChevronLeft size={18} />
        </IconButton>
        <span className="min-w-[8.5rem] px-1 text-center text-sm font-medium tabular-nums text-slate-700 dark:text-slate-200">
          {longDateLabel(date)}
        </span>
        <IconButton label="後一日" onClick={() => setDate(shiftKey(date, 1))}>
          <ChevronRight size={18} />
        </IconButton>
      </div>
      <input
        type="date"
        value={date}
        onChange={(e) => e.target.value && setDate(e.target.value)}
        aria-label="選擇點名日期"
        className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
      />
      {!isToday && (
        <Button size="sm" variant="ghost" onClick={() => setDate(todayKey())}>
          今日
        </Button>
      )}
    </div>
  )
}

function DetailModal({
  open,
  onClose,
  studentName,
  status,
  note,
  onSave,
}: {
  open: boolean
  onClose: () => void
  studentName: string
  status: AttendanceStatus | undefined
  note: AttendanceNote | undefined
  onSave: (patch: Partial<AttendanceNote>) => void
}) {
  const [absenceKind, setAbsenceKind] = useState<AttendanceNote['absenceKind']>(undefined)
  const [lateMinutes, setLateMinutes] = useState('')
  const [earlyLeave, setEarlyLeave] = useState(false)
  const [reason, setReason] = useState('')

  // 開 modal 時載入現值
  useEffect(() => {
    if (!open) return
    setAbsenceKind(note?.absenceKind)
    setLateMinutes(note?.lateMinutes ? String(note.lateMinutes) : '')
    setEarlyLeave(note?.earlyLeave ?? false)
    setReason(note?.reason ?? '')
  }, [open, note])

  function handleSave() {
    onSave({
      absenceKind: status === 'absent' ? absenceKind : undefined,
      lateMinutes:
        status === 'late' && lateMinutes ? Math.max(0, Number(lateMinutes)) : undefined,
      earlyLeave,
      reason: reason.trim() || undefined,
    })
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`出席細項 — ${studentName}`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button onClick={handleSave}>儲存</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-500 dark:text-slate-400">目前狀態</span>
          {status ? (
            <Badge
              tone={
                status === 'present' ? 'accent' : status === 'late' ? 'amber' : 'rose'
              }
            >
              {STATUS_LABEL[status]}
            </Badge>
          ) : (
            <Badge tone="slate">未標記</Badge>
          )}
        </div>

        {status === 'absent' && (
          <Field label="缺席類別" hint="病假 / 事假 / 公假視為准假，唔計入無故缺席">
            <Select
              value={absenceKind ?? ''}
              onChange={(e) =>
                setAbsenceKind((e.target.value || undefined) as AttendanceNote['absenceKind'])
              }
            >
              <option value="">— 未分類 —</option>
              {ABSENCE_KIND_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
        )}

        {status === 'late' && (
          <Field label="遲到分鐘" hint="選填，用嚟統計遲到嚴重程度">
            <Input
              type="number"
              min={0}
              value={lateMinutes}
              onChange={(e) => setLateMinutes(e.target.value.replace(/\D/g, ''))}
              placeholder="例如 10"
            />
          </Field>
        )}

        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
          <input
            type="checkbox"
            checked={earlyLeave}
            onChange={(e) => setEarlyLeave(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-accent focus:ring-accent/40 dark:border-slate-600 dark:bg-slate-700"
          />
          當日提早離校（早退）
        </label>

        <Field label="備註 / 原因">
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="例如：家長已致電請假、覆診、遲交假紙…"
          />
        </Field>
      </div>
    </Modal>
  )
}

// ════════════════════════════════════════════════════════════
//  分頁二：月度點名冊
// ════════════════════════════════════════════════════════════
function Register({ classId, className }: { classId: string; className: string }) {
  const toast = useToast()
  const students = useCollection(studentsCol)
  const attendance = useCollection(attendanceCol)

  const now = new Date()
  const [ym, setYm] = useState<{ y: number; m: number }>({
    y: now.getFullYear(),
    m: now.getMonth(),
  })

  const classStudents = useMemo(
    () => students.filter((s) => s.classId === classId),
    [students, classId],
  )
  const dayKeys = useMemo(() => monthDays(ym.y, ym.m), [ym])

  const monthRecords = useMemo(() => {
    const prefix = `${ym.y}-${String(ym.m + 1).padStart(2, '0')}`
    return attendance.filter((r) => r.classId === classId && r.date.startsWith(prefix))
  }, [attendance, classId, ym])

  function shiftMonth(delta: number) {
    setYm((cur) => {
      const d = new Date(cur.y, cur.m + delta, 1)
      return { y: d.getFullYear(), m: d.getMonth() }
    })
  }

  function onCycle(studentId: string, date: string, next: AttendanceStatus | null) {
    const existing = monthRecords.find(
      (r) => r.studentId === studentId && r.date === date,
    )
    if (next === null) {
      if (existing) attendanceCol.remove(existing.id)
    } else if (existing) {
      attendanceCol.update(existing.id, { status: next })
    } else {
      attendanceCol.add({ classId, studentId, date, status: next })
    }
  }

  function exportMonthCsv() {
    const header = ['學號', '學生', ...dayKeys.map((k) => k.slice(8, 10)), '出席率(%)']
    const tallies = tallyByStudent(
      monthRecords,
      classStudents.map((s) => s.id),
      dayKeys,
    )
    const glyph: Record<AttendanceStatus, string> = {
      present: 'P',
      late: 'L',
      absent: 'A',
    }
    const idx = new Map<string, Map<string, AttendanceStatus>>()
    for (const r of monthRecords) {
      let inner = idx.get(r.studentId)
      if (!inner) {
        inner = new Map()
        idx.set(r.studentId, inner)
      }
      inner.set(r.date, r.status)
    }
    const rows = classStudents.map((s) => {
      const inner = idx.get(s.id)
      const cells: (string | number)[] = [s.studentNo ?? '', s.name]
      for (const k of dayKeys) cells.push(inner?.get(k) ? glyph[inner.get(k)!] : '')
      const t = tallies.get(s.id)
      cells.push(t && t.marked > 0 ? (t.rate ?? '') : '')
      return cells
    })
    downloadCsv(`${className}_${monthLabel(ym.y, ym.m)}_點名冊.csv`, [header, ...rows])
    toast.success('已匯出月度點名冊 CSV（P=出席 L=遲到 A=缺席）')
  }

  if (classStudents.length === 0) {
    return (
      <EmptyState
        icon={GraduationCap}
        title="呢班仲未有學生"
        hint="去「班別管理 / 成績管理」加入名單，呢度就會郁起嚟。"
      />
    )
  }

  const isThisMonth = ym.y === now.getFullYear() && ym.m === now.getMonth()

  return (
    <div className="space-y-4">
      {/* 月份導航 + 操作 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1 rounded-2xl border border-slate-200/80 bg-white p-1 shadow-xs dark:border-slate-700/60 dark:bg-slate-800 dark:shadow-none">
          <IconButton label="上個月" onClick={() => shiftMonth(-1)}>
            <ChevronLeft size={18} />
          </IconButton>
          <span className="min-w-[6.5rem] px-1 text-center text-sm font-medium tabular-nums text-slate-700 dark:text-slate-200">
            {monthLabel(ym.y, ym.m)}
          </span>
          <IconButton label="下個月" onClick={() => shiftMonth(1)}>
            <ChevronRight size={18} />
          </IconButton>
          {!isThisMonth && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setYm({ y: now.getFullYear(), m: now.getMonth() })}
            >
              本月
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            icon={Printer}
            onClick={() => window.print()}
          >
            列印
          </Button>
          <Button
            size="sm"
            variant="secondary"
            icon={Download}
            onClick={exportMonthCsv}
          >
            匯出 CSV
          </Button>
        </div>
      </div>

      {/* 圖例 */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 dark:bg-slate-800/60">
          <span className={cx('flex h-5 w-5 items-center justify-center rounded-md text-[11px] font-semibold', STATUS_STYLE.present.cell)}>
            {STATUS_GLYPH.present}
          </span>
          出席
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 dark:bg-slate-800/60">
          <span className={cx('flex h-5 w-5 items-center justify-center rounded-md text-[11px] font-semibold', STATUS_STYLE.late.cell)}>
            {STATUS_GLYPH.late}
          </span>
          遲到
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 dark:bg-slate-800/60">
          <span className={cx('flex h-5 w-5 items-center justify-center rounded-md text-[11px] font-semibold', STATUS_STYLE.absent.cell)}>
            {STATUS_GLYPH.absent}
          </span>
          缺席
        </span>
        <span className="text-slate-400 dark:text-slate-500">· 撳格循環切換狀態</span>
      </div>

      <RegisterGrid
        students={classStudents}
        records={monthRecords}
        dayKeys={dayKeys}
        onCycle={onCycle}
      />
    </div>
  )
}

// ════════════════════════════════════════════════════════════
//  分頁三：統計分析
// ════════════════════════════════════════════════════════════
type Range = 14 | 30 | 90
const RANGE_OPTS: { id: string; label: string }[] = [
  { id: '14', label: '近 14 日' },
  { id: '30', label: '近 30 日' },
  { id: '90', label: '近 90 日' },
]

function Analytics({ classId, className }: { classId: string; className: string }) {
  const toast = useToast()
  const students = useCollection(studentsCol)
  const attendance = useCollection(attendanceCol)
  const notes = useCollection(notesCol)
  const [range, setRange] = useState<Range>(30)
  const [focusId, setFocusId] = useState<string | null>(null) // 個別學生摘要

  const classStudents = useMemo(
    () => students.filter((s) => s.classId === classId),
    [students, classId],
  )

  const dayKeys = useMemo(() => recentDayKeys(range), [range])
  const dayKeySet = useMemo(() => new Set(dayKeys), [dayKeys])

  const rangeRecords = useMemo(
    () => attendance.filter((r) => r.classId === classId && dayKeySet.has(r.date)),
    [attendance, classId, dayKeySet],
  )

  // 每日趨勢點
  const trend: TrendPoint[] = useMemo(() => {
    const byDate = new Map<string, AttendanceStatus[]>()
    for (const r of rangeRecords) {
      const arr = byDate.get(r.date) ?? []
      arr.push(r.status)
      byDate.set(r.date, arr)
    }
    return dayKeys.map((k) => {
      const arr = byDate.get(k) ?? []
      let present = 0
      let late = 0
      let absent = 0
      for (const st of arr) {
        if (st === 'present') present += 1
        else if (st === 'late') late += 1
        else if (st === 'absent') absent += 1
      }
      const marked = present + late + absent
      const rate = marked === 0 ? null : Math.round(((present + late) / marked) * 100)
      return { dateKey: k, rate, present, late, absent }
    })
  }, [rangeRecords, dayKeys])

  // 學生彙總（排行 / 連續缺席）
  const tallies = useMemo(
    () => tallyByStudent(rangeRecords, classStudents.map((s) => s.id), dayKeys),
    [rangeRecords, classStudents, dayKeys],
  )

  const ranked = useMemo(() => {
    return classStudents
      .map((s) => ({ student: s, t: tallies.get(s.id)! }))
      .filter((x) => x.t.marked > 0)
      .sort((a, b) => (b.t.rate ?? 0) - (a.t.rate ?? 0))
  }, [classStudents, tallies])

  // 整體出席率（全班、全期）
  const overall = useMemo(() => {
    let present = 0
    let late = 0
    let absent = 0
    for (const r of rangeRecords) {
      if (r.status === 'present') present += 1
      else if (r.status === 'late') late += 1
      else if (r.status === 'absent') absent += 1
    }
    const marked = present + late + absent
    const rate = marked === 0 ? null : Math.round(((present + late) / marked) * 100)
    // 有點名嘅上堂日數
    const sessionDays = new Set(rangeRecords.map((r) => r.date)).size
    return { present, late, absent, marked, rate, sessionDays }
  }, [rangeRecords])

  // 連續缺席 ≥ 2 嘅學生（chronic absence 預警）
  const alerts = useMemo(() => {
    return classStudents
      .map((s) => ({ student: s, t: tallies.get(s.id)! }))
      .filter((x) => x.t.currentAbsentStreak >= 2 || (x.t.rate != null && x.t.rate < 80))
      .sort((a, b) => b.t.currentAbsentStreak - a.t.currentAbsentStreak)
  }, [classStudents, tallies])

  // ── 個別學生摘要（drill-down）所需資料 ──
  const focusStudent = focusId ? classStudents.find((s) => s.id === focusId) : undefined
  const focusData = useMemo(() => {
    if (!focusId) return null
    const tally = tallies.get(focusId) ?? null
    const noteList = notes.filter(
      (n) => n.classId === classId && n.studentId === focusId && dayKeySet.has(n.date),
    )
    return {
      tally,
      longestStreak: longestAbsentStreak(rangeRecords, focusId, dayKeys),
      lastPresent: lastPresentKey(rangeRecords, focusId, dayKeys),
      noteSummary: summarizeNotes(noteList),
      // 逐日時間軸（只列有點名嘅日；由舊到新）
      timeline: dayKeys
        .map((k) => {
          const r = rangeRecords.find(
            (x) => x.studentId === focusId && x.date === k,
          )
          return r ? { dateKey: k, status: r.status } : null
        })
        .filter((x): x is { dateKey: string; status: AttendanceStatus } => x != null),
    }
  }, [focusId, tallies, notes, classId, dayKeySet, rangeRecords, dayKeys])

  function exportSummaryCsv() {
    const header = ['學號', '學生', '出席', '遲到', '缺席', '已點日數', '出席率(%)', '連續缺席']
    const rows = ranked.map(({ student, t }) => [
      student.studentNo ?? '',
      student.name,
      t.present,
      t.late,
      t.absent,
      t.marked,
      t.rate ?? '',
      t.currentAbsentStreak,
    ])
    downloadCsv(`${className}_出席統計_近${range}日.csv`, [header, ...rows])
    toast.success('已匯出出席統計 CSV')
  }

  if (classStudents.length === 0) {
    return (
      <EmptyState
        icon={GraduationCap}
        title="呢班仲未有學生"
        hint="去「班別管理 / 成績管理」加入名單，呢度就會郁起嚟。"
      />
    )
  }

  const hasData = overall.marked > 0

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Pills
          options={RANGE_OPTS}
          active={String(range)}
          onChange={(v) => setRange(Number(v) as Range)}
          size="sm"
        />
        <Button
          size="sm"
          variant="secondary"
          icon={Download}
          onClick={exportSummaryCsv}
          disabled={!hasData}
        >
          匯出統計
        </Button>
      </div>

      {!hasData ? (
        <EmptyState
          art="empty-attendance"
          icon={LineChart}
          title="呢排未有點名記錄"
          hint="去「點名」分頁開始點名，呢度就會自動畫出出席率趨勢、預警同排行。"
        />
      ) : (
        <>
          {/* 概覽 */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label="整體出席率"
              value={overall.rate ?? '—'}
              unit={overall.rate == null ? undefined : '%'}
              icon={Users}
              highlight
              hint={`${overall.sessionDays} 個上堂日`}
            />
            <StatCard
              label="出席次數"
              value={overall.present}
              unit="次"
              icon={CalendarCheck}
            />
            <StatCard label="遲到次數" value={overall.late} unit="次" icon={AlarmClock} />
            <StatCard label="缺席次數" value={overall.absent} unit="次" icon={Ban} />
          </div>

          {/* 趨勢圖 */}
          <Card className="rounded-3xl p-5">
            <SectionTitle icon={LineChart}>每日出席率趨勢</SectionTitle>
            <TrendChart points={trend} />
          </Card>

          {/* 預警 */}
          <Card className="rounded-3xl p-5">
            <SectionTitle icon={TriangleAlert} description="連續缺席 ≥ 2 次或出席率 < 80%">
              需要關注
            </SectionTitle>
            {alerts.length === 0 ? (
              <div className="flex items-center gap-2 rounded-2xl bg-emerald-50/60 px-3 py-2.5 text-sm text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                <CalendarCheck size={16} />
                暫時冇人觸發關注條件，全班出席企穩。
              </div>
            ) : (
              <ul className="space-y-2">
                {alerts.map(({ student, t }) => (
                  <li
                    key={student.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-rose-200/60 bg-rose-50/50 px-3 py-2 dark:border-rose-500/20 dark:bg-rose-500/5"
                  >
                    <div className="min-w-0">
                      <span className="font-medium text-slate-800 dark:text-slate-100">
                        {student.name}
                      </span>
                      {student.studentNo && (
                        <span className="ml-1.5 text-xs text-slate-400">
                          {student.studentNo}
                        </span>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                      {t.currentAbsentStreak >= 2 && (
                        <Badge tone="rose" icon={Ban} className="tabular-nums">
                          連續缺席 {t.currentAbsentStreak} 日
                        </Badge>
                      )}
                      <Badge tone={rateTone(t.rate)} className="tabular-nums">
                        出席率 {t.rate}%
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* 個人排行（撳一行睇個別摘要） */}
          <Card className="rounded-3xl p-5">
            <SectionTitle
              icon={Users}
              description="按出席率排序；撳一行睇個別學生摘要"
            >
              學生出席率排行
            </SectionTitle>
            <ul className="space-y-1">
              {ranked.map(({ student, t }, i) => (
                <li key={student.id}>
                  <button
                    type="button"
                    onClick={() => setFocusId(student.id)}
                    aria-label={`查看 ${student.name} 出席摘要`}
                    className="group w-full rounded-lg px-2 py-1.5 text-left transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:hover:bg-slate-700/40"
                  >
                    <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className={cx(
                            'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums',
                            i === 0
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
                              : i === 1
                                ? 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                                : i === 2
                                  ? 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300'
                                  : 'text-slate-400',
                          )}
                        >
                          {i + 1}
                        </span>
                        <span className="truncate font-medium text-slate-700 group-hover:text-slate-900 dark:text-slate-200 dark:group-hover:text-slate-50">
                          {student.name}
                        </span>
                        {t.late > 0 && (
                          <span className="shrink-0 text-[11px] tabular-nums text-amber-600 dark:text-amber-300">
                            遲{t.late}
                          </span>
                        )}
                        {t.absent > 0 && (
                          <span className="shrink-0 text-[11px] tabular-nums text-rose-600 dark:text-rose-300">
                            缺{t.absent}
                          </span>
                        )}
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        <span
                          className={cx(
                            'font-semibold tabular-nums',
                            STATUS_STYLE.present.text,
                            t.rate != null &&
                              t.rate < 80 &&
                              'text-rose-600 dark:text-rose-300',
                          )}
                        >
                          {t.rate}%
                        </span>
                        <ChevronRight
                          size={15}
                          className="text-slate-300 transition group-hover:text-slate-400 dark:text-slate-600 dark:group-hover:text-slate-500"
                        />
                      </span>
                    </div>
                    <ProgressBar value={t.rate ?? 0} tone={rateBarTone(t.rate)} size="sm" />
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          {/* 星期分佈 */}
          <WeekdayBreakdown records={rangeRecords} />
        </>
      )}

      <StudentSummaryModal
        open={!!focusId}
        onClose={() => setFocusId(null)}
        studentName={focusStudent?.name ?? ''}
        studentNo={focusStudent?.studentNo}
        rangeDays={range}
        data={focusData}
      />
    </div>
  )
}

// 個別學生出席摘要（drill-down modal）
// 聚合班級分析未顯示嘅 per-student 維度：最長連續缺席、最後出席日、
// 缺席原因分類、遲到分鐘、早退，加逐堂時間軸。
function StudentSummaryModal({
  open,
  onClose,
  studentName,
  studentNo,
  rangeDays,
  data,
}: {
  open: boolean
  onClose: () => void
  studentName: string
  studentNo?: string
  rangeDays: number
  data: {
    tally: StudentTally | null
    longestStreak: number
    lastPresent: string | null
    noteSummary: ReturnType<typeof summarizeNotes>
    timeline: { dateKey: string; status: AttendanceStatus }[]
  } | null
}) {
  const t = data?.tally
  const ns = data?.noteSummary
  const hasMarks = !!t && t.marked > 0
  const kindRows = ns
    ? ABSENCE_KIND_OPTIONS.filter((o) => ns.byKind[o.value] > 0)
    : []

  return (
    <Modal open={open} onClose={onClose} title={`出席摘要 — ${studentName}`} size="md">
      {!hasMarks || !t || !ns || !data ? (
        <p className="py-4 text-center text-sm text-slate-400 dark:text-slate-500">
          呢位學生喺近 {rangeDays} 日內未有點名記錄。
        </p>
      ) : (
        <div className="space-y-5">
          {/* 概要 */}
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {studentNo && (
              <span className="text-xs text-slate-400">學號 {studentNo}</span>
            )}
            <Badge tone={rateTone(t.rate)} className="tabular-nums">
              出席率 {t.rate}%
            </Badge>
            <span className="text-xs text-slate-400">
              近 {rangeDays} 日 · 已點 {t.marked} 堂
            </span>
          </div>

          {/* 三態 + 出席率進度 */}
          <div>
            <div className="grid grid-cols-3 gap-2">
              <MiniStat label="出席" value={t.present} tone="present" />
              <MiniStat label="遲到" value={t.late} tone="late" />
              <MiniStat label="缺席" value={t.absent} tone="absent" />
            </div>
            <div className="mt-2">
              <ProgressBar value={t.rate ?? 0} tone={rateBarTone(t.rate)} size="sm" />
            </div>
          </div>

          {/* 關鍵指標 */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <FactCell
              label="目前連續缺席"
              value={t.currentAbsentStreak > 0 ? `${t.currentAbsentStreak} 日` : '—'}
              tone={t.currentAbsentStreak >= 2 ? 'rose' : 'slate'}
            />
            <FactCell
              label="期內最長連續缺席"
              value={data.longestStreak > 0 ? `${data.longestStreak} 日` : '—'}
              tone={data.longestStreak >= 3 ? 'rose' : 'slate'}
            />
            <FactCell
              label="最後一次出席"
              value={data.lastPresent ? shortDateLabel(data.lastPresent) : '從未'}
              tone={data.lastPresent ? 'slate' : 'rose'}
            />
          </div>

          {/* 細項聚合（病假類別 / 遲到分鐘 / 早退） */}
          {(kindRows.length > 0 ||
            ns.lateLoggedCount > 0 ||
            ns.earlyLeaveCount > 0) && (
            <div>
              <SectionTitle icon={ClipboardList}>細項統計</SectionTitle>
              <div className="space-y-2 text-sm">
                {kindRows.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-slate-400">缺席原因</span>
                    {kindRows.map((o) => (
                      <Badge
                        key={o.value}
                        tone={isExcused(o.value) ? 'blue' : 'rose'}
                        className="tabular-nums"
                      >
                        {ABSENCE_KIND_LABEL[o.value]} {ns.byKind[o.value]}
                      </Badge>
                    ))}
                    {ns.unexcusedCount > 0 && (
                      <span className="text-[11px] text-rose-500 dark:text-rose-400">
                        無故 {ns.unexcusedCount} 次
                      </span>
                    )}
                  </div>
                )}
                {ns.lateLoggedCount > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-slate-400">遲到分鐘</span>
                    <Badge tone="amber" className="tabular-nums">
                      共 {ns.lateMinutesTotal} 分（{ns.lateLoggedCount} 次）
                    </Badge>
                    {ns.lateMinutesAvg != null && (
                      <span className="text-[11px] tabular-nums text-slate-400">
                        平均 {ns.lateMinutesAvg} 分 / 次
                      </span>
                    )}
                  </div>
                )}
                {ns.earlyLeaveCount > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-slate-400">早退</span>
                    <Badge tone="slate" className="tabular-nums">
                      {ns.earlyLeaveCount} 次
                    </Badge>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 逐堂時間軸 */}
          <div>
            <SectionTitle icon={CalendarDays} description="由舊到新，逐個有點名日">
              出席時間軸
            </SectionTitle>
            <div className="flex flex-wrap gap-1">
              {data.timeline.map((d) => (
                <span
                  key={d.dateKey}
                  title={`${longDateLabel(d.dateKey)}：${STATUS_LABEL[d.status]}`}
                  className={cx(
                    'flex h-7 w-7 items-center justify-center rounded-md text-[11px] font-semibold',
                    STATUS_STYLE[d.status].cell,
                  )}
                >
                  {STATUS_GLYPH[d.status]}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: AttendanceStatus
}) {
  return (
    <div
      className={cx(
        'rounded-lg px-3 py-2 text-center',
        STATUS_STYLE[tone].cell,
      )}
    >
      <div className="text-lg font-bold tabular-nums">{value}</div>
      <div className="text-[11px] font-medium opacity-80">{label}</div>
    </div>
  )
}

function FactCell({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'slate' | 'rose'
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
      <div className="text-[11px] text-slate-400">{label}</div>
      <div
        className={cx(
          'mt-0.5 text-sm font-semibold tabular-nums',
          tone === 'rose'
            ? 'text-rose-600 dark:text-rose-300'
            : 'text-slate-700 dark:text-slate-200',
        )}
      >
        {value}
      </div>
    </div>
  )
}

// 按星期統計缺席分佈（睇邊日最多人唔嚟）
function WeekdayBreakdown({ records }: { records: AttendanceRecord[] }) {
  const data = useMemo(() => {
    const idxByWd = Array.from({ length: 7 }, () => ({
      present: 0,
      late: 0,
      absent: 0,
      total: 0,
    }))
    for (const r of records) {
      const d = new Date(
        Number(r.date.slice(0, 4)),
        Number(r.date.slice(5, 7)) - 1,
        Number(r.date.slice(8, 10)),
      ).getDay()
      const bucket = idxByWd[d]
      if (r.status === 'present') bucket.present += 1
      else if (r.status === 'late') bucket.late += 1
      else if (r.status === 'absent') bucket.absent += 1
      bucket.total += 1
    }
    return idxByWd
  }, [records])

  const labels = ['日', '一', '二', '三', '四', '五', '六']
  // 只顯示有上堂嘅星期（多數係一至五 / 六）
  const visible = data
    .map((d, i) => ({ ...d, i }))
    .filter((d) => d.total > 0)
  const maxTotal = Math.max(1, ...visible.map((d) => d.total))

  if (visible.length === 0) return null

  return (
    <Card className="rounded-3xl p-5">
      <SectionTitle icon={CalendarDays} description="睇吓邊日最多遲到 / 缺席">
        星期分佈
      </SectionTitle>
      <div className="flex items-end justify-around gap-2 pt-2">
        {visible.map((d) => {
          const h = (d.total / maxTotal) * 96 // px
          const segs: { n: number; cls: string }[] = [
            { n: d.present, cls: STATUS_STYLE.present.bar },
            { n: d.late, cls: STATUS_STYLE.late.bar },
            { n: d.absent, cls: STATUS_STYLE.absent.bar },
          ]
          const rate =
            d.total === 0
              ? null
              : Math.round(((d.present + d.late) / d.total) * 100)
          return (
            <div key={d.i} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="flex w-full max-w-[2.5rem] flex-col-reverse overflow-hidden rounded-md"
                style={{ height: Math.max(8, h) }}
                title={`星期${labels[d.i]}：出 ${d.present} / 遲 ${d.late} / 缺 ${d.absent}`}
              >
                {segs.map((s, si) =>
                  s.n === 0 ? null : (
                    <div
                      key={si}
                      className={s.cls}
                      style={{ height: `${(s.n / d.total) * 100}%` }}
                    />
                  ),
                )}
              </div>
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {labels[d.i]}
              </span>
              <span className="text-[10px] tabular-nums text-slate-400">
                {rate == null ? '—' : `${rate}%`}
              </span>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
