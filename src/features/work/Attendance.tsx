import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
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
  CHRONIC_ABSENCE_PCT,
  classifyAttendance,
  countDay,
  downloadCsv,
  fromKey,
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
  BookCheck,
  CalendarCheck,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Copy,
  Download,
  GraduationCap,
  LineChart,
  NotebookPen,
  Pencil,
  Printer,
  RotateCcw,
  School,
  Stamp,
  TriangleAlert,
  Users,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

// 本功能專屬：出席細項（病假 / 事假 / 遲到分鐘 / 早退 / 原因）
// 共用 attendanceCol 維持三態，呢度疊加 metadata，唔改 data/collections。
const notesCol = createCollection<AttendanceNote>('attendance_notes', [])

type Tab = 'rollcall' | 'register' | 'analytics'
const TABS: { id: Tab; label: string }[] = [
  { id: 'rollcall', label: '今日點名' },
  { id: 'register', label: '點名冊' },
  { id: 'analytics', label: '統計分析' },
]
const TAB_ICONS = {
  rollcall: Stamp,
  register: NotebookPen,
  analytics: LineChart,
} as const

function metaKey(classId: string, studentId: string, date: string): string {
  return `${classId}|${studentId}|${date}`
}

const WEEKDAY_FULL = ['日', '一', '二', '三', '四', '五', '六'] as const

// ════════════════════════════════════════════════════════════
//  出席簿語言（bespoke）：蓋章感、簿冊封面、橫間紙紋
//  ------------------------------------------------------------
//  「點名 / 出席」重塑成老師日常嘅出席簿——揭日、逐個蓋「到 / 遲 / 缺」章。
//  純表現層；所有資料流、collection、handler、export 簽名一概不動。
// ════════════════════════════════════════════════════════════

// 三態蓋章嘅墨色（淺底深字 + ring，似印章圈；全部帶 dark:）
const STAMP_TONE: Record<
  AttendanceStatus,
  { ring: string; soft: string; ink: string; dot: string }
> = {
  present: {
    ring: 'ring-accent/35 dark:ring-accent/40',
    soft: 'bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent',
    ink: 'text-accent-strong dark:text-accent',
    dot: 'bg-accent',
  },
  late: {
    ring: 'ring-amber-400/40 dark:ring-amber-400/40',
    soft: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    ink: 'text-amber-600 dark:text-amber-300',
    dot: 'bg-amber-500',
  },
  absent: {
    ring: 'ring-rose-400/40 dark:ring-rose-400/40',
    soft: 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
    ink: 'text-rose-600 dark:text-rose-300',
    dot: 'bg-rose-500',
  },
}

// 蓋章字符牌：橡皮印章感——圓圈內一個狀態字符，active 帶輕微傾側「按落去」。
function StampMark({
  status,
  stamped,
  className,
}: {
  status: AttendanceStatus
  stamped?: boolean
  className?: string
}) {
  const t = STAMP_TONE[status]
  return (
    <span
      aria-hidden
      className={cx(
        'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-serif text-[13px] font-bold leading-none ring-1 ring-inset transition-transform duration-200',
        t.soft,
        t.ring,
        stamped && '-rotate-6',
        className,
      )}
    >
      {STATUS_GLYPH[status]}
    </span>
  )
}

// 區段小帽：uppercase kicker + icon（統一頁內節奏，對齊工作模式其他 bespoke 頁）
function SectionCap({
  icon: Icon,
  children,
  right,
}: {
  icon: LucideIcon
  children: ReactNode
  right?: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-2 px-0.5">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
        <Icon size={13} className="shrink-0" />
        {children}
      </p>
      {right}
    </div>
  )
}

// 點名簿封面戳印帶嘅統計格（hairline grid · serif 大數字；達標 hot 高亮）
function RegisterTally({
  label,
  value,
  unit,
  hint,
  icon: Icon,
  tone = 'slate',
}: {
  label: string
  value: number | string
  unit?: string
  hint?: string
  icon: LucideIcon
  tone?: 'slate' | 'present' | 'late' | 'absent'
}) {
  const ink =
    tone === 'present'
      ? 'text-accent-strong dark:text-accent'
      : tone === 'late'
        ? 'text-amber-600 dark:text-amber-300'
        : tone === 'absent'
          ? 'text-rose-600 dark:text-rose-300'
          : 'text-slate-800 dark:text-slate-100'
  const labelInk =
    tone === 'present'
      ? 'text-accent/80 dark:text-accent/80'
      : tone === 'late'
        ? 'text-amber-600/80 dark:text-amber-400/80'
        : tone === 'absent'
          ? 'text-rose-500/80 dark:text-rose-400/80'
          : 'text-slate-400 dark:text-slate-500'
  return (
    <div className="bg-white px-3.5 py-3.5 transition-colors dark:bg-slate-800 sm:px-4">
      <p
        className={cx(
          'flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide',
          labelInk,
        )}
      >
        <Icon size={12} className="shrink-0" />
        <span className="truncate">{label}</span>
      </p>
      <p
        className={cx(
          'mt-1 font-serif text-[26px] font-semibold leading-none tabular-nums slashed-zero',
          ink,
        )}
      >
        {value}
        {unit && (
          <span className="ml-1 font-sans text-sm font-normal text-slate-400">
            {unit}
          </span>
        )}
      </p>
      {hint && (
        <p className="mt-1 truncate text-[11px] text-slate-400 dark:text-slate-500">
          {hint}
        </p>
      )}
    </div>
  )
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
      <div className="space-y-5">
        <Masthead />
        <EmptyState
          icon={School}
          title="由第一班開始"
          hint="先去「班別管理」開好班別，呢度就可以逐日揭簿點名、逐個蓋章記出席。"
        />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <Masthead
        subtitle={
          activeClass
            ? activeClass.subject
              ? `${activeClass.name}・${activeClass.subject}`
              : activeClass.name
            : undefined
        }
      />

      {/* 簿冊封面：揀班（書脊標籤）+ 三本分頁（點名 / 簿 / 統計） */}
      <div className="space-y-3 rounded-3xl border border-slate-200/80 bg-white p-3 shadow-xs dark:border-slate-700/60 dark:bg-slate-800 dark:shadow-none sm:p-3.5">
        <div className="flex items-center gap-2">
          <span className="hidden shrink-0 items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 sm:inline-flex">
            <BookCheck size={13} /> 班別
          </span>
          <div className="min-w-0 flex-1">
            <Pills
              options={classes.map((c) => ({
                id: c.id,
                label: c.subject ? `${c.name}・${c.subject}` : c.name,
              }))}
              active={activeClassId}
              onChange={setClassId}
            />
          </div>
        </div>
        <div className="border-t border-dashed border-slate-200/80 pt-3 dark:border-slate-700/60">
          <Tabs tabs={TABS} active={tab} onChange={setTab} icons={TAB_ICONS} />
        </div>
      </div>

      <div className="animate-fade-in">
        {activeClass && tab === 'rollcall' && <RollCall classId={activeClass.id} />}
        {activeClass && tab === 'register' && (
          <Register classId={activeClass.id} className={activeClass.name} />
        )}
        {activeClass && tab === 'analytics' && (
          <Analytics classId={activeClass.id} className={activeClass.name} />
        )}
      </div>
    </div>
  )
}

// ───────── 出席簿封面 masthead（自管頁面身份：kicker + serif 標題 + 簿務行）─────────
//  右上「點名戳印」純裝飾；底部雙線似簿冊封面分隔。功能名「點名 / 出席」做頁面身份。
function Masthead({ subtitle }: { subtitle?: string }) {
  return (
    <header className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white px-5 py-5 shadow-xs dark:border-slate-700/60 dark:bg-slate-800 dark:shadow-none sm:px-7 sm:py-6">
      {/* 封面右上「出席到」戳印（純裝飾，唔搶主次） */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-5 top-4 hidden -rotate-[10deg] select-none items-center gap-1.5 rounded-xl border-2 border-dashed border-accent/20 px-4 py-2 font-serif text-xs font-semibold uppercase tracking-[0.22em] text-accent/25 dark:border-accent/25 dark:text-accent/25 sm:inline-flex"
      >
        <Check size={13} strokeWidth={3} />
        出席 · Present
      </span>
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.3em] text-accent/70">
          <Stamp size={13} />
          出席簿 · Attendance Register
        </p>
        <h1 className="mt-1.5 font-serif text-[28px] font-semibold leading-none tracking-tight text-slate-800 dark:text-slate-100 sm:text-[34px]">
          點名 / 出席
        </h1>
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
          <span>逐日揭簿、逐個蓋章，月結點名冊同出席率趨勢一手掌握。</span>
          {subtitle && (
            <>
              <span aria-hidden className="text-slate-300 dark:text-slate-600">
                ·
              </span>
              <span className="inline-flex items-center gap-1 font-medium text-accent-strong dark:text-accent">
                <BookCheck size={12} /> {subtitle}
              </span>
            </>
          )}
        </p>
      </div>
      {/* 簿冊雙線（封面分隔感） */}
      <div className="mt-5 space-y-1" aria-hidden>
        <span className="block h-px bg-slate-200/90 dark:bg-slate-700/70" />
        <span className="block h-px bg-slate-200/60 dark:bg-slate-700/40" />
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
      <div className="space-y-4">
        <DateNav date={date} setDate={setDate} />
        <EmptyState
          icon={GraduationCap}
          title="呢本簿仲未有名單"
          hint="去「班別管理 / 成績管理」加入學生，返嚟就可以逐個蓋章點名。"
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <DateNav date={date} setDate={setDate} />

      {/* 今日結算戳印帶：hairline grid · serif 大數字 */}
      <section className="space-y-3">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-slate-200/70 ring-1 ring-slate-200/80 dark:bg-slate-700/50 dark:ring-slate-700/60 sm:grid-cols-4">
          <RegisterTally
            label="到"
            value={day.present}
            unit="人"
            icon={CalendarCheck}
            tone="present"
          />
          <RegisterTally label="遲" value={day.late} unit="人" icon={AlarmClock} tone="late" />
          <RegisterTally label="缺" value={day.absent} unit="人" icon={Ban} tone="absent" />
          <RegisterTally
            label="出席率"
            value={day.rate == null ? '—' : day.rate}
            unit={day.rate == null ? undefined : '%'}
            icon={Users}
            hint={`已點 ${markedCount}／${classStudents.length}`}
          />
        </div>
        {/* 點名進度條（封面薄帶感） */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-xs dark:border-slate-700/60 dark:bg-slate-800 dark:shadow-none">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="inline-flex items-center gap-1.5 font-medium text-slate-600 dark:text-slate-300">
              <Stamp size={13} className="text-slate-400" />
              點名進度
            </span>
            <span className="tabular-nums text-slate-400" aria-live="polite">
              已蓋 {markedCount}／{classStudents.length}
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
        </div>
      </section>

      {/* 快手操作（似簿頂嘅一排快捷蓋章） */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" icon={Stamp} onClick={() => markAll('present')}>
          全班蓋「到」
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={fillUnmarkedPresent}
          disabled={markedCount === classStudents.length}
        >
          未點者補「到」
        </Button>
        <Button size="sm" variant="secondary" icon={Copy} onClick={copyPrevious}>
          複製上次
        </Button>
        <Button
          size="sm"
          variant="ghost"
          icon={RotateCcw}
          onClick={clearDay}
          disabled={markedCount === 0}
        >
          清空今頁
        </Button>
      </div>

      {/* 點名簿頁：橫間紙紋 · 逐行蓋章 */}
      <section className="space-y-2.5">
        <SectionCap
          icon={NotebookPen}
          right={
            <span className="text-xs tabular-nums text-slate-400 dark:text-slate-500">
              全班 {classStudents.length} 人
            </span>
          }
        >
          點名簿頁
        </SectionCap>
        <ul className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs dark:border-slate-700/60 dark:bg-slate-800 dark:shadow-none">
          {classStudents.map((s, idx) => {
            const current = recordByStudent.get(s.id)?.status
            const note = noteByKey.get(metaKey(classId, s.id, date))
            const hasDetail = !!(
              note &&
              (note.absenceKind ||
                note.lateMinutes ||
                note.earlyLeave ||
                note.reason?.trim())
            )
            const tone = current ? STAMP_TONE[current] : null
            return (
              <li
                key={s.id}
                className={cx(
                  'group relative flex flex-col gap-3 px-3 py-3 transition-colors sm:flex-row sm:items-center sm:justify-between sm:px-4',
                  idx !== 0 && 'border-t border-slate-100 dark:border-slate-700/50',
                  current
                    ? 'bg-slate-50/40 dark:bg-slate-800/40'
                    : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/60',
                )}
              >
                {/* 左側狀態色軌（蓋咗章先見） */}
                <span
                  aria-hidden
                  className={cx(
                    'absolute inset-y-0 left-0 w-1 transition-colors',
                    tone ? tone.dot : 'bg-transparent',
                  )}
                />
                <div className="flex min-w-0 items-center gap-3 pl-1.5">
                  {/* 行號（簿冊座號感，serif tabular） */}
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 font-serif text-xs font-bold tabular-nums text-slate-400 dark:bg-slate-700/60 dark:text-slate-500">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate font-medium text-slate-900 dark:text-slate-100">
                        {s.name}
                      </span>
                      {current && <StampMark status={current} stamped />}
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
                  className="flex flex-wrap items-center gap-1.5 pl-1.5 sm:pl-0"
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
                        aria-label={`為${s.name}蓋「${STATUS_LABEL[st]}」章`}
                        className={cx(
                          'inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-sm font-medium transition active:scale-95 focus:outline-none focus-visible:ring-2',
                          active ? cx(style.solid, 'shadow-sm') : style.soft,
                        )}
                      >
                        {active && <Check size={13} strokeWidth={3} className="shrink-0" />}
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

// 簿冊揭頁：日期做主角嘅「翻頁」標籤——大日字（serif）+ 星期，左右似揭簿。
function DateNav({
  date,
  setDate,
}: {
  date: string
  setDate: (k: string) => void
}) {
  const isToday = date === todayKey()
  const d = fromKey(date)
  const dayNum = d.getDate()
  const wd = WEEKDAY_FULL[d.getDay()]
  const monthTxt = `${d.getFullYear()}年${d.getMonth() + 1}月`
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <div className="inline-flex items-center gap-1 rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-xs dark:border-slate-700/60 dark:bg-slate-800 dark:shadow-none">
        <IconButton label="揭去前一日" onClick={() => setDate(shiftKey(date, -1))}>
          <ChevronLeft size={18} />
        </IconButton>
        {/* 簿頁日期牌：serif 日字 + 月／星期 */}
        <div className="flex min-w-[9.5rem] items-center justify-center gap-2.5 px-2">
          <span className="font-serif text-[28px] font-semibold leading-none tabular-nums slashed-zero text-slate-800 dark:text-slate-100">
            {dayNum}
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-xs font-medium tabular-nums text-slate-500 dark:text-slate-400">
              {monthTxt}
            </span>
            <span
              className={cx(
                'text-[11px] font-medium',
                isToday
                  ? 'text-accent-strong dark:text-accent'
                  : 'text-slate-400 dark:text-slate-500',
              )}
            >
              星期{wd}
              {isToday && ' · 今日'}
            </span>
          </span>
        </div>
        <IconButton label="揭去後一日" onClick={() => setDate(shiftKey(date, 1))}>
          <ChevronRight size={18} />
        </IconButton>
      </div>
      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-500 transition hover:border-accent/50 hover:text-accent-strong focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:text-accent">
        <CalendarDays size={15} className="shrink-0" />
        <input
          type="date"
          value={date}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          aria-label="跳去指定日期"
          className="bg-transparent text-base outline-none sm:text-sm"
        />
      </label>
      {!isToday && (
        <Button size="sm" variant="ghost" icon={CalendarCheck} onClick={() => setDate(todayKey())}>
          返今日
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

  const tone = status ? STAMP_TONE[status] : null
  // 缺席 / 遲到先有對應細項可填；其餘只得早退 + 備註。
  const hasStatusField = status === 'absent' || status === 'late'

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button icon={Stamp} onClick={handleSave}>
            記入簿
          </Button>
        </>
      }
    >
      {/* 出席登記卡（簿冊封套語言）：kicker + serif 姓名 + 蓋章狀態，右上斜貼裝飾章 */}
      <header className="relative -mx-5 -mt-5 mb-4 overflow-hidden border-b border-slate-200/80 px-5 pb-4 pt-5 dark:border-slate-700/60 sm:-mx-6 sm:-mt-6 sm:px-6">
        {/* 右上斜貼狀態章（純裝飾，呼應 masthead 戳印；手機收起） */}
        {status && tone && (
          <span
            aria-hidden
            className={cx(
              'pointer-events-none absolute right-12 top-4 hidden -rotate-[8deg] select-none items-center gap-1 rounded-lg border-2 border-dashed px-2.5 py-1 font-serif text-[11px] font-bold uppercase tracking-[0.18em] ring-inset sm:inline-flex',
              tone.soft,
              tone.ring,
            )}
          >
            <Check size={11} strokeWidth={3} />
            {STATUS_LABEL[status]}
          </span>
        )}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.28em] text-accent/70">
              <ClipboardList size={12} />
              出席登記卡 · Entry
            </p>
            <h3 className="mt-1 truncate font-serif text-[22px] font-semibold leading-tight tracking-tight text-slate-800 dark:text-slate-100">
              {studentName || '出席細項'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="關閉"
            className="-mr-1.5 -mt-1 shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:hover:bg-slate-700"
          >
            <X size={18} />
          </button>
        </div>
        {/* 今日蓋章狀態（與簿頁同一套 StampMark） */}
        <p className="mt-2 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span className="uppercase tracking-wide">今日蓋章</span>
          {status ? (
            <span className="inline-flex items-center gap-1.5">
              <StampMark status={status} />
              <span className={cx('font-semibold', tone?.ink)}>
                {STATUS_LABEL[status]}
              </span>
            </span>
          ) : (
            <Badge tone="slate">未標記</Badge>
          )}
        </p>
      </header>

      <div className="space-y-4">
        {status === 'absent' && (
          <section className="space-y-2">
            <SectionCap icon={Ban}>缺席登記</SectionCap>
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
          </section>
        )}

        {status === 'late' && (
          <section className="space-y-2">
            <SectionCap icon={AlarmClock}>遲到登記</SectionCap>
            <Field label="遲到分鐘" hint="選填，用嚟統計遲到嚴重程度">
              <Input
                type="number"
                min={0}
                value={lateMinutes}
                onChange={(e) => setLateMinutes(e.target.value.replace(/\D/g, ''))}
                placeholder="例如 10"
                className="tabular-nums"
              />
            </Field>
          </section>
        )}

        {/* 通用細項：早退 + 備註，用虛線同上面狀態分區隔開（簿冊分隔感） */}
        <section
          className={cx(
            'space-y-3',
            hasStatusField &&
              'border-t border-dashed border-slate-200/80 pt-4 dark:border-slate-700/60',
          )}
        >
          <SectionCap icon={NotebookPen}>簿記備註</SectionCap>
          <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200/80 bg-slate-50/60 px-3 py-2.5 text-sm text-slate-700 transition hover:border-slate-300 dark:border-slate-700/60 dark:bg-slate-900/30 dark:text-slate-200 dark:hover:border-slate-600">
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
        </section>
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
        title="呢本簿仲未有名單"
        hint="去「班別管理 / 成績管理」加入學生，月結點名冊就會填滿。"
      />
    )
  }

  const isThisMonth = ym.y === now.getFullYear() && ym.m === now.getMonth()

  return (
    <div className="space-y-4">
      {/* 月份導航 + 簿務操作 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1 rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-xs dark:border-slate-700/60 dark:bg-slate-800 dark:shadow-none">
          <IconButton label="揭去上個月" onClick={() => shiftMonth(-1)}>
            <ChevronLeft size={18} />
          </IconButton>
          <span className="min-w-[6.5rem] px-1 text-center font-serif text-base font-semibold tabular-nums text-slate-800 dark:text-slate-100">
            {monthLabel(ym.y, ym.m)}
          </span>
          <IconButton label="揭去下個月" onClick={() => shiftMonth(1)}>
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

      {/* 簿冊圖例（三態蓋章對照） */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-slate-500 dark:text-slate-400">
        {STATUS_ORDER.map((st) => (
          <span
            key={st}
            className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 dark:bg-slate-800/60"
          >
            <StampMark status={st} className="h-5 w-5 text-[11px]" />
            {STATUS_LABEL[st]}
          </span>
        ))}
        <span className="inline-flex items-center gap-1 text-slate-400 dark:text-slate-500">
          <Stamp size={12} /> 撳格循環蓋章
        </span>
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

  // 關注名單分類器：以窗口缺席率分流「需關注 / 全勤」（純函式，零新資料）
  const classification = useMemo(() => classifyAttendance(tallies), [tallies])
  const nameOf = useMemo(() => {
    const m = new Map(classStudents.map((s) => [s.id, s]))
    return (id: string) => m.get(id)
  }, [classStudents])

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
        title="呢本簿仲未有名單"
        hint="去「班別管理 / 成績管理」加入學生，統計同趨勢就會出現。"
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
          title="呢排本簿仲係白頁"
          hint="去「今日點名」分頁開始蓋章，呢度就會自動畫出出席率趨勢、預警同排行。"
        />
      ) : (
        <>
          {/* 期內結算戳印帶：hairline grid · serif 大數字 */}
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-slate-200/70 ring-1 ring-slate-200/80 dark:bg-slate-700/50 dark:ring-slate-700/60 sm:grid-cols-4">
            <RegisterTally
              label="整體出席率"
              value={overall.rate ?? '—'}
              unit={overall.rate == null ? undefined : '%'}
              icon={Users}
              tone="present"
              hint={`${overall.sessionDays} 個上堂日`}
            />
            <RegisterTally
              label="到"
              value={overall.present}
              unit="次"
              icon={CalendarCheck}
            />
            <RegisterTally label="遲" value={overall.late} unit="次" icon={AlarmClock} tone="late" />
            <RegisterTally label="缺" value={overall.absent} unit="次" icon={Ban} tone="absent" />
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

          {/* 關注名單分類（缺席率窗口分流：需關注 / 全勤） */}
          {(classification.chronic.length > 0 || classification.perfect.length > 0) && (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="rounded-3xl p-5">
                <SectionTitle
                  icon={TriangleAlert}
                  description={`窗口內缺席率 ≥ ${CHRONIC_ABSENCE_PCT}%`}
                >
                  長期缺席關注
                </SectionTitle>
                {classification.chronic.length === 0 ? (
                  <p className="rounded-2xl bg-slate-50 px-3 py-2.5 text-sm text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                    暫時冇人達到長期缺席門檻。
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {classification.chronic.map((c) => {
                      const s = nameOf(c.studentId)
                      if (!s) return null
                      return (
                        <li
                          key={c.studentId}
                          className="flex items-center justify-between gap-3 rounded-lg border border-rose-200/60 bg-rose-50/50 px-3 py-2 dark:border-rose-500/20 dark:bg-rose-500/5"
                        >
                          <span className="min-w-0 truncate font-medium text-slate-800 dark:text-slate-100">
                            {s.name}
                            <span className="ml-1.5 text-xs font-normal tabular-nums text-slate-400">
                              缺 {c.absent}/{c.marked}
                            </span>
                          </span>
                          <span className="flex shrink-0 items-center gap-1.5">
                            {c.streak >= 2 && (
                              <Badge tone="rose" icon={Ban} className="tabular-nums">
                                連續 {c.streak} 日
                              </Badge>
                            )}
                            <Badge tone="rose" className="tabular-nums">
                              缺席率 {c.rate}%
                            </Badge>
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </Card>

              <Card className="rounded-3xl p-5">
                <SectionTitle icon={GraduationCap} description="窗口內有記錄且零缺席">
                  全勤名單
                </SectionTitle>
                {classification.perfect.length === 0 ? (
                  <p className="rounded-2xl bg-slate-50 px-3 py-2.5 text-sm text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                    窗口內暫時未有零缺席學生。
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {classification.perfect.map((p) => {
                      const s = nameOf(p.studentId)
                      if (!s) return null
                      return (
                        <li
                          key={p.studentId}
                          className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200/60 bg-emerald-50/50 px-3 py-2 dark:border-emerald-500/20 dark:bg-emerald-500/5"
                        >
                          <span className="min-w-0 truncate font-medium text-slate-800 dark:text-slate-100">
                            {s.name}
                          </span>
                          <Badge tone="green" icon={CalendarCheck} className="tabular-nums">
                            全勤 {p.marked} 堂
                          </Badge>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </Card>
            </div>
          )}

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
    <Modal open={open} onClose={onClose} size="md">
      {/* 學生簿頁封面：kicker + serif 姓名 + 出席率印章；右上斜貼裝飾戳 */}
      <header className="relative -mx-5 -mt-5 mb-5 overflow-hidden border-b border-slate-200/80 px-5 pb-4 pt-5 dark:border-slate-700/60 sm:-mx-6 sm:-mt-6 sm:px-6">
        {/* 右上「個人簿頁」斜戳（純裝飾，呼應 masthead；手機收起） */}
        <span
          aria-hidden
          className="pointer-events-none absolute right-12 top-4 hidden -rotate-[8deg] select-none items-center gap-1 rounded-lg border-2 border-dashed border-accent/20 px-2.5 py-1 font-serif text-[11px] font-bold uppercase tracking-[0.18em] text-accent/25 dark:border-accent/25 dark:text-accent/25 sm:inline-flex"
        >
          <Stamp size={11} />
          簿頁
        </span>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.28em] text-accent/70">
              <NotebookPen size={12} />
              出席摘要 · Summary
            </p>
            <h3 className="mt-1 truncate font-serif text-[22px] font-semibold leading-tight tracking-tight text-slate-800 dark:text-slate-100">
              {studentName || '出席摘要'}
            </h3>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400 dark:text-slate-500">
              {studentNo && <span>學號 {studentNo}</span>}
              {hasMarks && t && (
                <>
                  {studentNo && (
                    <span aria-hidden className="text-slate-300 dark:text-slate-600">
                      ·
                    </span>
                  )}
                  <Badge tone={rateTone(t.rate)} className="tabular-nums">
                    出席率 {t.rate}%
                  </Badge>
                  <span className="tabular-nums">
                    近 {rangeDays} 日 · 已點 {t.marked} 堂
                  </span>
                </>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="關閉"
            className="-mr-1.5 -mt-1 shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:hover:bg-slate-700"
          >
            <X size={18} />
          </button>
        </div>
      </header>

      {!hasMarks || !t || !ns || !data ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-700/60 dark:text-slate-500">
            <NotebookPen size={20} strokeWidth={1.75} />
          </span>
          <p className="text-sm text-slate-400 dark:text-slate-500">
            呢位學生喺近 {rangeDays} 日內未有點名記錄。
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* 三態結算（hairline grid · serif 大數字，呼應簿冊封面）+ 出席率進度 */}
          <div>
            <div className="grid grid-cols-3 gap-px overflow-hidden rounded-2xl bg-slate-200/70 ring-1 ring-slate-200/80 dark:bg-slate-700/50 dark:ring-slate-700/60">
              <MiniStat label="出席" value={t.present} tone="present" />
              <MiniStat label="遲到" value={t.late} tone="late" />
              <MiniStat label="缺席" value={t.absent} tone="absent" />
            </div>
            <div className="mt-2.5">
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

          {/* 逐堂時間軸（點名簿橫條：逐格蓋章 glyph，serif 對齊簿冊語言） */}
          <div>
            <SectionTitle icon={CalendarDays} description="由舊到新，逐個有點名日">
              出席時間軸
            </SectionTitle>
            <div className="flex flex-wrap gap-1 rounded-2xl border border-slate-200/80 bg-slate-50/50 p-2.5 dark:border-slate-700/60 dark:bg-slate-900/30">
              {data.timeline.map((d) => (
                <span
                  key={d.dateKey}
                  title={`${longDateLabel(d.dateKey)}：${STATUS_LABEL[d.status]}`}
                  className={cx(
                    'flex h-7 w-7 items-center justify-center rounded-md font-serif text-[13px] font-bold leading-none',
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
  // 蓋章戳印格：扁平填色填滿 hairline 格縫，serif 大數字呼應點名簿封面結算帶。
  return (
    <div className={cx('px-3 py-2.5 text-center', STATUS_STYLE[tone].cell)}>
      <div className="inline-flex items-center justify-center gap-1.5">
        <StampMark status={tone} className="h-5 w-5 text-[11px]" />
        <span className="font-serif text-[22px] font-semibold leading-none tabular-nums slashed-zero">
          {value}
        </span>
      </div>
      <div className="mt-1 text-[11px] font-medium opacity-80">{label}</div>
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
  // 簿記摘要格：uppercase kicker 標籤 + serif 數值；rose 時左脊提色（呼應簿頁狀態軌）。
  return (
    <div
      className={cx(
        'relative overflow-hidden rounded-xl border bg-white px-3 py-2.5 dark:bg-slate-800',
        tone === 'rose'
          ? 'border-rose-200/70 dark:border-rose-500/25'
          : 'border-slate-200/80 dark:border-slate-700/60',
      )}
    >
      {tone === 'rose' && (
        <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-rose-400/80 dark:bg-rose-500/60" />
      )}
      <div className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
        {label}
      </div>
      <div
        className={cx(
          'mt-0.5 font-serif text-base font-semibold tabular-nums slashed-zero',
          tone === 'rose'
            ? 'text-rose-600 dark:text-rose-300'
            : 'text-slate-800 dark:text-slate-100',
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
