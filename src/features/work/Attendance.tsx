import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import './attendance/i18n'
import { createCollection, useCollection } from '../../lib/store'
import { attendanceCol, classesCol, studentsCol } from '../../data/collections'
import type { AttendanceRecord, AttendanceStatus } from '../../data/types'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  FeatureGuide,
  type FeatureGuideStep,
  Field,
  IconButton,
  Input,
  Modal,
  PageHero,
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
  ArrowRight,
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
const TAB_ICONS = {
  rollcall: Stamp,
  register: NotebookPen,
  analytics: LineChart,
} as const

function metaKey(classId: string, studentId: string, date: string): string {
  return `${classId}|${studentId}|${date}`
}

const WEEKDAY_FULL = ['日', '一', '二', '三', '四', '五', '六'] as const

// ───────── 點名教學引導（FeatureGuide：3 步「點用」）─────────
const ATTENDANCE_GUIDE: FeatureGuideStep[] = [
  {
    title: '揀班別',
    desc: '喺上方書籤揀返要點名嘅班，每班獨立一本出席簿。',
  },
  {
    title: '逐個標記',
    desc: '喺「今日點名」撳「到 / 遲 / 缺」標記每位同學，或用「全班標記到」「複製上次」一鍵省時。',
  },
  {
    title: '睇冊同統計',
    desc: '「點名冊」睇月結格、匯出 CSV；「統計分析」即時睇出席率趨勢、預警同排行。',
  },
]

// ── i18n helpers（display only；STATUS_LABEL 等 util 常數維持原文做 defaultValue）──
const STATUS_T_KEY: Record<AttendanceStatus, string> = {
  present: 'attend.statusPresent',
  late: 'attend.statusLate',
  absent: 'attend.statusAbsent',
}
const ABSENCE_KIND_T_KEY: Record<string, string> = {
  sick: 'attend.kindSick',
  personal: 'attend.kindPersonal',
  official: 'attend.kindOfficial',
  unexcused: 'attend.kindUnexcused',
}

function statusLabel(t: TFunction, st: AttendanceStatus): string {
  return t(STATUS_T_KEY[st], { defaultValue: STATUS_LABEL[st] })
}
function absenceKindLabel(t: TFunction, kind: keyof typeof ABSENCE_KIND_LABEL): string {
  return t(ABSENCE_KIND_T_KEY[kind], { defaultValue: ABSENCE_KIND_LABEL[kind] })
}

// ════════════════════════════════════════════════════════════
//  出席三態語意色（present / late / absent）
//  ------------------------------------------------------------
//  跟 dashboard 設計系統：純表現層，所有資料流 / collection / handler /
//  export 簽名一概不動。
// ════════════════════════════════════════════════════════════

// 三態狀態章墨色（淺底深字 + ring，似印章圈；全部帶 dark:）
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
        'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold leading-none ring-1 ring-inset transition-transform duration-200',
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

// 區段小帽：卡內小標頭（跟 dashboard：text-xs font-semibold slate；純中文唔 uppercase）
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
      <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-300">
        <Icon size={13} className="shrink-0" />
        {children}
      </p>
      {right}
    </div>
  )
}

// 統計磚語意 tone（嚴格照 dashboard TONE：chip 底+icon / 數字字 兩組）
type TileTone = 'accent' | 'amber' | 'emerald' | 'violet' | 'sky' | 'rose'
const TILE_TONE: Record<TileTone, { chip: string; val: string }> = {
  accent: { chip: 'bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent', val: 'text-accent' },
  amber: { chip: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300', val: 'text-amber-500' },
  emerald: { chip: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300', val: 'text-emerald-500' },
  violet: { chip: 'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300', val: 'text-violet-500' },
  sky: { chip: 'bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300', val: 'text-sky-500' },
  rose: { chip: 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300', val: 'text-rose-500' },
}

// 純展示統計磚（跟 dashboard StatTile 結構：label + icon chip + 大數字；非互動，去 hover/active）
function RegisterTally({
  label,
  value,
  unit,
  hint,
  icon: Icon,
  tone = 'accent',
}: {
  label: string
  value: number | string
  unit?: string
  hint?: string
  icon: LucideIcon
  tone?: TileTone
}) {
  const tn = TILE_TONE[tone]
  return (
    <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-700/60 dark:bg-slate-800">
      <div className="flex items-center justify-between">
        <span className="truncate text-xs font-medium text-slate-400 dark:text-slate-500">
          {label}
        </span>
        <span className={cx('flex h-8 w-8 shrink-0 items-center justify-center rounded-xl', tn.chip)}>
          <Icon size={16} />
        </span>
      </div>
      <div className="mt-3">
        <p className="flex items-baseline gap-1">
          <span className={cx('text-3xl font-semibold tabular-nums slashed-zero', tn.val)}>
            {value}
          </span>
          {unit && <span className="text-sm font-medium text-slate-400">{unit}</span>}
        </p>
        {hint && (
          <p className="mt-0.5 truncate text-[11px] text-slate-400">{hint}</p>
        )}
      </div>
    </div>
  )
}

export default function Attendance() {
  const { t } = useTranslation()
  const classes = useCollection(classesCol)
  const [classId, setClassId] = useState<string>('')
  const [tab, setTab] = useState<Tab>('rollcall')

  const tabs = useMemo(
    () => [
      { id: 'rollcall' as Tab, label: t('attend.tabRollcall', { defaultValue: '今日點名' }) },
      { id: 'register' as Tab, label: t('attend.tabRegister', { defaultValue: '點名冊' }) },
      { id: 'analytics' as Tab, label: t('attend.tabAnalytics', { defaultValue: '統計分析' }) },
    ],
    [t],
  )

  const activeClassId = useMemo(() => {
    if (classId && classes.some((c) => c.id === classId)) return classId
    return classes[0]?.id ?? ''
  }, [classId, classes])
  const activeClass = classes.find((c) => c.id === activeClassId)

  if (classes.length === 0) {
    return (
      <div className="space-y-5">
        <Masthead />
        <FeatureGuide
          storageKey="attendance"
          title={t('attend.guideTitle', { defaultValue: '點名點用？' })}
          steps={ATTENDANCE_GUIDE}
        />
        <EmptyState
          icon={School}
          title={t('attend.emptyNoClassTitle', { defaultValue: '由第一班開始' })}
          hint={t('attend.emptyNoClassHint', {
            defaultValue:
              '先去「班別管理」開好班別，呢度就可以逐日點名、記出席同睇趨勢。',
          })}
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

      <FeatureGuide
        storageKey="attendance"
        title={t('attend.guideTitle', { defaultValue: '點名點用？' })}
        steps={ATTENDANCE_GUIDE}
      />

      {/* 班別書籤 + 分頁標籤（點名 / 冊 / 統計） */}
      <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-white p-3 dark:border-slate-700/60 dark:bg-slate-800">
        <div className="flex items-center gap-2 px-0.5">
          <span className="hidden shrink-0 items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 sm:inline-flex">
            <BookCheck size={13} className="shrink-0" />
            {t('attend.classLabel', { defaultValue: '班別' })}
          </span>
          <span className="hidden h-4 w-px bg-slate-200 dark:bg-slate-700/60 sm:block" />
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
        <div className="border-t border-slate-200 pt-3 dark:border-slate-700">
          <Tabs tabs={tabs} active={tab} onChange={setTab} icons={TAB_ICONS} />
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

// ───────── 頁首 hero（統一共用 PageHero：accent 大色塊）─────────
function Masthead({ subtitle }: { subtitle?: string }) {
  const { t } = useTranslation()
  const tagline = t('attend.tagline', {
    defaultValue: '逐日點名、月結出席冊，出席率趨勢同預警一手掌握。',
  })
  return (
    <PageHero
      guideKey="attendance"
      icon={Stamp}
      kicker={t('attend.kicker', { defaultValue: 'Attendance' })}
      title={t('attend.title', { defaultValue: '點名 / 出席' })}
      description={subtitle ? `${tagline} · ${subtitle}` : tagline}
    />
  )
}

// ════════════════════════════════════════════════════════════
//  分頁一：每日點名
// ════════════════════════════════════════════════════════════
function RollCall({ classId }: { classId: string }) {
  const { t } = useTranslation()
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
    toast.success(
      t('attend.toastMarkedAll', {
        status: statusLabel(t, status),
        defaultValue: `已將全班標記為${STATUS_LABEL[status]}`,
      }),
    )
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
    if (n > 0)
      toast.success(
        t('attend.toastFilledPresent', {
          count: n,
          defaultValue: `已將 ${n} 位未點名學生補為出席`,
        }),
      )
    else toast.info(t('attend.toastAllMarked', { defaultValue: '全部學生都已點名' }))
  }

  async function clearDay() {
    if (markedCount === 0) return
    const ok = await confirm({
      title: t('attend.clearConfirmTitle', { defaultValue: '清除當日點名？' }),
      message: t('attend.clearConfirmMessage', {
        date: longDateLabel(date),
        count: markedCount,
        defaultValue: `將會移除 ${longDateLabel(date)} 全班 ${markedCount} 筆記錄。`,
      }),
      confirmText: t('attend.clearConfirmBtn', { defaultValue: '清除' }),
      tone: 'danger',
    })
    if (!ok) return
    for (const r of recordByStudent.values()) attendanceCol.remove(r.id)
    for (const n of noteByKey.values()) notesCol.remove(n.id)
    toast.success(t('attend.toastClearedDay', { defaultValue: '已清除當日點名' }))
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
      toast.error(
        t('attend.toastNoCopySource', {
          defaultValue: '過去 30 日內冇可複製嘅點名記錄',
        }),
      )
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
    toast.success(
      t('attend.toastCopied', {
        date: src,
        count: n,
        defaultValue: `已由 ${src} 複製 ${n} 筆點名`,
      }),
    )
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
          title={t('attend.emptyNoRosterTitle', { defaultValue: '呢班仲未有學生名單' })}
          hint={t('attend.emptyNoRosterHintRoll', {
            defaultValue: '先去「班別管理 / 成績管理」加入學生，返嚟就可以逐個點名。',
          })}
          action={
            <Button size="sm" variant="secondary" icon={ArrowRight}>
              {t('attend.emptyNoRosterCta', { defaultValue: '去加入學生' })}
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <DateNav date={date} setDate={setDate} />

      {/* 今日結算：四張 tone-coded 統計磚 */}
      <section className="space-y-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <RegisterTally
            label={t('attend.tallyPresent', { defaultValue: '到' })}
            value={day.present}
            unit={t('attend.unitPeople', { defaultValue: '人' })}
            icon={CalendarCheck}
            tone="emerald"
          />
          <RegisterTally
            label={t('attend.tallyLate', { defaultValue: '遲到' })}
            value={day.late}
            unit={t('attend.unitPeople', { defaultValue: '人' })}
            icon={AlarmClock}
            tone="amber"
          />
          <RegisterTally
            label={t('attend.tallyAbsent', { defaultValue: '缺席' })}
            value={day.absent}
            unit={t('attend.unitPeople', { defaultValue: '人' })}
            icon={Ban}
            tone="rose"
          />
          <RegisterTally
            label={t('attend.tallyRate', { defaultValue: '出席率' })}
            value={day.rate == null ? '—' : day.rate}
            unit={day.rate == null ? undefined : '%'}
            icon={Users}
            tone="accent"
            hint={t('attend.tallyMarkedHint', {
              marked: markedCount,
              total: classStudents.length,
              defaultValue: `已點 ${markedCount}／${classStudents.length}`,
            })}
          />
        </div>
        {/* 點名進度（純展示卡） */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-700/60 dark:bg-slate-800">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="inline-flex items-center gap-1.5 font-semibold text-slate-500 dark:text-slate-300">
              <Stamp size={13} className="shrink-0 text-slate-400" />
              {t('attend.progressLabel', { defaultValue: '點名進度' })}
            </span>
            <span className="tabular-nums slashed-zero text-slate-400" aria-live="polite">
              {t('attend.progressMarked', {
                marked: markedCount,
                total: classStudents.length,
                defaultValue: `已點 ${markedCount}／${classStudents.length}`,
              })}
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

      {/* 快手操作 */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" icon={Stamp} onClick={() => markAll('present')}>
          {t('attend.markAllPresent', { defaultValue: '全班標記到' })}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={fillUnmarkedPresent}
          disabled={markedCount === classStudents.length}
        >
          {t('attend.fillUnmarked', { defaultValue: '未點者補「到」' })}
        </Button>
        <Button size="sm" variant="secondary" icon={Copy} onClick={copyPrevious}>
          {t('attend.copyPrevious', { defaultValue: '複製上次' })}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          icon={RotateCcw}
          onClick={clearDay}
          disabled={markedCount === 0}
        >
          {t('attend.clearDay', { defaultValue: '清空當日' })}
        </Button>
      </div>

      {/* 點名名單：逐行標記 */}
      <section className="space-y-2.5">
        <SectionCap
          icon={NotebookPen}
          right={
            <span className="text-xs tabular-nums text-slate-400 dark:text-slate-500">
              {t('attend.classCount', {
                count: classStudents.length,
                defaultValue: `全班 ${classStudents.length} 人`,
              })}
            </span>
          }
        >
          {t('attend.registerPage', { defaultValue: '點名名單' })}
        </SectionCap>
        <ul className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-slate-700/60 dark:bg-slate-800">
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
                  idx !== 0 && 'border-t border-slate-200/70 dark:border-slate-700/60',
                  current
                    ? 'bg-slate-50/60 dark:bg-slate-800/40'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/60',
                )}
              >
                {/* 左側狀態色軌（標記咗先見） */}
                <span
                  aria-hidden
                  className={cx(
                    'absolute inset-y-0 left-0 w-1 transition-colors',
                    tone ? tone.dot : 'bg-transparent',
                  )}
                />
                <div className="flex min-w-0 items-center gap-3 pl-1.5">
                  {/* 座號 */}
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-semibold tabular-nums slashed-zero text-slate-400 dark:bg-slate-700/60 dark:text-slate-500">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate font-medium text-slate-800 dark:text-slate-100">
                        {s.name}
                      </span>
                      {current && <StampMark status={current} stamped />}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400 dark:text-slate-500">
                      <span>
                        {s.studentNo
                          ? t('attend.studentNo', {
                              no: s.studentNo,
                              defaultValue: `學號 ${s.studentNo}`,
                            })
                          : t('attend.noStudentNo', { defaultValue: '未有學號' })}
                      </span>
                      {hasDetail && note && (
                        <span className="inline-flex flex-wrap items-center gap-1">
                          {note.absenceKind && current === 'absent' && (
                            <Badge tone={isExcused(note.absenceKind) ? 'blue' : 'rose'}>
                              {absenceKindLabel(t, note.absenceKind)}
                            </Badge>
                          )}
                          {note.lateMinutes && current === 'late' ? (
                            <Badge tone="amber" className="tabular-nums">
                              {t('attend.lateMinutesBadge', {
                                minutes: note.lateMinutes,
                                defaultValue: `遲 ${note.lateMinutes} 分`,
                              })}
                            </Badge>
                          ) : null}
                          {note.earlyLeave && (
                            <Badge tone="slate">
                              {t('attend.earlyLeave', { defaultValue: '早退' })}
                            </Badge>
                          )}
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
                  aria-label={t('attend.attendanceStatusOf', {
                    name: s.name,
                    defaultValue: `${s.name} 出席狀態`,
                  })}
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
                        aria-label={t('attend.markStatusFor', {
                          name: s.name,
                          status: statusLabel(t, st),
                          defaultValue: `將${s.name}標記為「${STATUS_LABEL[st]}」`,
                        })}
                        className={cx(
                          'inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-sm font-medium transition active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
                          active ? cx(style.solid, 'shadow-sm') : style.soft,
                        )}
                      >
                        {active && <Check size={13} strokeWidth={3} className="shrink-0" />}
                        {statusLabel(t, st)}
                      </button>
                    )
                  })}
                  <IconButton
                    label={t('attend.attendanceDetail', { defaultValue: '出席細項' })}
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
  const { t } = useTranslation()
  const isToday = date === todayKey()
  const d = fromKey(date)
  const dayNum = d.getDate()
  const wd = WEEKDAY_FULL[d.getDay()]
  const wdEn = t('attend.weekday', { defaultValue: '' }).split('_')[d.getDay()] || ''
  const monthTxt = t('attend.monthYear', {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    defaultValue: `${d.getFullYear()}年${d.getMonth() + 1}月`,
  })
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <div className="inline-flex items-center gap-1 rounded-2xl border border-slate-200/80 bg-white p-1.5 dark:border-slate-700/60 dark:bg-slate-800">
        <IconButton
          label={t('attend.prevDay', { defaultValue: '前一日' })}
          onClick={() => setDate(shiftKey(date, -1))}
        >
          <ChevronLeft size={18} />
        </IconButton>
        {/* 日期牌：大日字 + 月／星期 */}
        <div className="flex min-w-[9.5rem] items-center justify-center gap-2.5 px-2">
          <span className="text-[28px] font-semibold leading-none tabular-nums slashed-zero text-slate-800 dark:text-slate-100">
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
              {t('attend.weekdayDisplay', {
                wd,
                wdEn,
                defaultValue: `星期${wd}`,
              })}
              {isToday && t('attend.todaySuffix', { defaultValue: ' · 今日' })}
            </span>
          </span>
        </div>
        <IconButton
          label={t('attend.nextDay', { defaultValue: '後一日' })}
          onClick={() => setDate(shiftKey(date, 1))}
        >
          <ChevronRight size={18} />
        </IconButton>
      </div>
      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-500 transition hover:border-accent/50 hover:text-accent-strong focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:text-accent">
        <CalendarDays size={15} className="shrink-0" />
        <input
          type="date"
          value={date}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          aria-label={t('attend.jumpToDate', { defaultValue: '跳去指定日期' })}
          className="bg-transparent text-base outline-none sm:text-sm"
        />
      </label>
      {!isToday && (
        <Button size="sm" variant="ghost" icon={CalendarCheck} onClick={() => setDate(todayKey())}>
          {t('attend.backToToday', { defaultValue: '返今日' })}
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
  const { t } = useTranslation()
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
            {t('attend.cancel', { defaultValue: '取消' })}
          </Button>
          <Button onClick={handleSave}>
            {t('attend.save', { defaultValue: '儲存' })}
          </Button>
        </>
      }
    >
      {/* 出席細項：icon chip + 姓名 + 今日狀態 */}
      <header className="-mx-5 -mt-5 mb-4 border-b border-slate-200 px-5 pb-4 pt-5 dark:border-slate-700 sm:-mx-6 sm:-mt-6 sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
              <ClipboardList size={18} />
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-[17px] font-semibold tracking-tight text-slate-800 dark:text-slate-100">
                {studentName || t('attend.detailFallbackTitle', { defaultValue: '出席細項' })}
              </h3>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <span>{t('attend.todayStatus', { defaultValue: '今日狀態' })}</span>
                {status ? (
                  <span className="inline-flex items-center gap-1.5">
                    <StampMark status={status} />
                    <span className={cx('font-semibold', tone?.ink)}>
                      {statusLabel(t, status)}
                    </span>
                  </span>
                ) : (
                  <Badge tone="slate">{t('attend.unmarked', { defaultValue: '未標記' })}</Badge>
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('attend.close', { defaultValue: '關閉' })}
            className="-mr-1.5 -mt-1 shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:hover:bg-slate-700"
          >
            <X size={18} />
          </button>
        </div>
      </header>

      <div className="space-y-4">
        {status === 'absent' && (
          <section className="space-y-2">
            <SectionCap icon={Ban}>
              {t('attend.absenceSection', { defaultValue: '缺席登記' })}
            </SectionCap>
            <Field
              label={t('attend.absenceKindLabel', { defaultValue: '缺席類別' })}
              hint={t('attend.absenceKindHint', {
                defaultValue: '病假 / 事假 / 公假視為准假，唔計入無故缺席',
              })}
            >
              <Select
                value={absenceKind ?? ''}
                onChange={(e) =>
                  setAbsenceKind((e.target.value || undefined) as AttendanceNote['absenceKind'])
                }
              >
                <option value="">{t('attend.uncategorised', { defaultValue: '— 未分類 —' })}</option>
                {ABSENCE_KIND_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {t(ABSENCE_KIND_T_KEY[o.value], { defaultValue: o.label })}
                  </option>
                ))}
              </Select>
            </Field>
          </section>
        )}

        {status === 'late' && (
          <section className="space-y-2">
            <SectionCap icon={AlarmClock}>
              {t('attend.lateSection', { defaultValue: '遲到登記' })}
            </SectionCap>
            <Field
              label={t('attend.lateMinutesLabel', { defaultValue: '遲到分鐘' })}
              hint={t('attend.lateMinutesHint', {
                defaultValue: '選填，用嚟統計遲到嚴重程度',
              })}
            >
              <Input
                type="number"
                min={0}
                value={lateMinutes}
                onChange={(e) => setLateMinutes(e.target.value.replace(/\D/g, ''))}
                placeholder={t('attend.lateMinutesPlaceholder', { defaultValue: '例如 10' })}
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
          <SectionCap icon={NotebookPen}>
            {t('attend.noteSection', { defaultValue: '簿記備註' })}
          </SectionCap>
          <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200/80 bg-slate-50/60 px-3 py-2.5 text-sm text-slate-700 transition hover:border-slate-300 dark:border-slate-700/60 dark:bg-slate-900/30 dark:text-slate-200 dark:hover:border-slate-600">
            <input
              type="checkbox"
              checked={earlyLeave}
              onChange={(e) => setEarlyLeave(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-accent focus:ring-accent/40 dark:border-slate-600 dark:bg-slate-700"
            />
            {t('attend.earlyLeaveCheckbox', { defaultValue: '當日提早離校（早退）' })}
          </label>

          <Field label={t('attend.reasonLabel', { defaultValue: '備註 / 原因' })}>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('attend.reasonPlaceholder', {
                defaultValue: '例如：家長已致電請假、覆診、遲交假紙…',
              })}
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
  const { t } = useTranslation()
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
    const header = [
      t('attend.csvNo', { defaultValue: '學號' }),
      t('attend.csvStudent', { defaultValue: '學生' }),
      ...dayKeys.map((k) => k.slice(8, 10)),
      t('attend.csvRate', { defaultValue: '出席率(%)' }),
    ]
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
    downloadCsv(
      `${t('attend.csvRegisterFile', {
        className,
        month: monthLabel(ym.y, ym.m),
        defaultValue: `${className}_${monthLabel(ym.y, ym.m)}_點名冊`,
      })}.csv`,
      [header, ...rows],
    )
    toast.success(
      t('attend.toastExportRegister', {
        defaultValue: '已匯出月度點名冊 CSV（P=出席 L=遲到 A=缺席）',
      }),
    )
  }

  if (classStudents.length === 0) {
    return (
      <EmptyState
        icon={GraduationCap}
        title={t('attend.emptyNoRosterTitle', { defaultValue: '呢班仲未有學生名單' })}
        hint={t('attend.emptyNoRosterHintRegister', {
          defaultValue: '去「班別管理 / 成績管理」加入學生，月結出席冊就會填滿。',
        })}
        action={
          <Button size="sm" variant="secondary" icon={ArrowRight}>
            {t('attend.emptyNoRosterCta', { defaultValue: '去加入學生' })}
          </Button>
        }
      />
    )
  }

  const isThisMonth = ym.y === now.getFullYear() && ym.m === now.getMonth()

  return (
    <div className="space-y-4">
      {/* 月份導航 + 操作 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1 rounded-2xl border border-slate-200/80 bg-white p-1.5 dark:border-slate-700/60 dark:bg-slate-800">
          <IconButton
            label={t('attend.prevMonth', { defaultValue: '上個月' })}
            onClick={() => shiftMonth(-1)}
          >
            <ChevronLeft size={18} />
          </IconButton>
          <span className="min-w-[6.5rem] px-1 text-center text-base font-semibold tabular-nums slashed-zero text-slate-800 dark:text-slate-100">
            {t('attend.monthYear', {
              year: ym.y,
              month: ym.m + 1,
              defaultValue: monthLabel(ym.y, ym.m),
            })}
          </span>
          <IconButton
            label={t('attend.nextMonth', { defaultValue: '下個月' })}
            onClick={() => shiftMonth(1)}
          >
            <ChevronRight size={18} />
          </IconButton>
          {!isThisMonth && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setYm({ y: now.getFullYear(), m: now.getMonth() })}
            >
              {t('attend.thisMonth', { defaultValue: '本月' })}
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
            {t('attend.print', { defaultValue: '列印' })}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            icon={Download}
            onClick={exportMonthCsv}
          >
            {t('attend.exportCsv', { defaultValue: '匯出 CSV' })}
          </Button>
        </div>
      </div>

      {/* 三態圖例 */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-slate-500 dark:text-slate-400">
        {STATUS_ORDER.map((st) => (
          <span
            key={st}
            className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 dark:bg-slate-800/60"
          >
            <StampMark status={st} className="h-5 w-5 text-[11px]" />
            {statusLabel(t, st)}
          </span>
        ))}
        <span className="inline-flex items-center gap-1 text-slate-400 dark:text-slate-500">
          <Stamp size={12} className="shrink-0" /> {t('attend.cycleHint', { defaultValue: '撳格切換狀態' })}
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

function Analytics({ classId, className }: { classId: string; className: string }) {
  const { t } = useTranslation()
  const toast = useToast()
  const students = useCollection(studentsCol)
  const attendance = useCollection(attendanceCol)
  const notes = useCollection(notesCol)
  const [range, setRange] = useState<Range>(30)

  const rangeOpts = useMemo(
    () => [
      { id: '14', label: t('attend.range14', { defaultValue: '近 14 日' }) },
      { id: '30', label: t('attend.range30', { defaultValue: '近 30 日' }) },
      { id: '90', label: t('attend.range90', { defaultValue: '近 90 日' }) },
    ],
    [t],
  )
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
    const header = [
      t('attend.csvNo', { defaultValue: '學號' }),
      t('attend.csvStudent', { defaultValue: '學生' }),
      t('attend.csvPresent', { defaultValue: '出席' }),
      t('attend.csvLate', { defaultValue: '遲到' }),
      t('attend.csvAbsent', { defaultValue: '缺席' }),
      t('attend.csvMarkedDays', { defaultValue: '已點日數' }),
      t('attend.csvRate', { defaultValue: '出席率(%)' }),
      t('attend.csvStreak', { defaultValue: '連續缺席' }),
    ]
    const rows = ranked.map(({ student, t: tally }) => [
      student.studentNo ?? '',
      student.name,
      tally.present,
      tally.late,
      tally.absent,
      tally.marked,
      tally.rate ?? '',
      tally.currentAbsentStreak,
    ])
    downloadCsv(
      `${t('attend.csvStatsFile', {
        className,
        range,
        defaultValue: `${className}_出席統計_近${range}日`,
      })}.csv`,
      [header, ...rows],
    )
    toast.success(t('attend.toastExportStats', { defaultValue: '已匯出出席統計 CSV' }))
  }

  if (classStudents.length === 0) {
    return (
      <EmptyState
        icon={GraduationCap}
        title={t('attend.emptyNoRosterTitle', { defaultValue: '呢班仲未有學生名單' })}
        hint={t('attend.emptyNoRosterHintAnalytics', {
          defaultValue: '去「班別管理 / 成績管理」加入學生，統計同趨勢就會出現。',
        })}
        action={
          <Button size="sm" variant="secondary" icon={ArrowRight}>
            {t('attend.emptyNoRosterCta', { defaultValue: '去加入學生' })}
          </Button>
        }
      />
    )
  }

  const hasData = overall.marked > 0

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Pills
          options={rangeOpts}
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
          {t('attend.exportStats', { defaultValue: '匯出統計' })}
        </Button>
      </div>

      {!hasData ? (
        <EmptyState
          art="empty-attendance"
          icon={LineChart}
          title={t('attend.emptyNoDataTitle', { defaultValue: '呢排仲未有點名記錄' })}
          hint={t('attend.emptyNoDataHint', {
            defaultValue:
              '去「今日點名」分頁開始點名，呢度就會自動畫出出席率趨勢、預警同排行。',
          })}
          action={
            <Button size="sm" variant="secondary" icon={Stamp}>
              {t('attend.emptyNoDataCta', { defaultValue: '去今日點名' })}
            </Button>
          }
        />
      ) : (
        <>
          {/* 期內結算：四張 tone-coded 統計磚 */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <RegisterTally
              label={t('attend.overallRate', { defaultValue: '整體出席率' })}
              value={overall.rate ?? '—'}
              unit={overall.rate == null ? undefined : '%'}
              icon={Users}
              tone="accent"
              hint={t('attend.sessionDays', {
                count: overall.sessionDays,
                defaultValue: `${overall.sessionDays} 個上堂日`,
              })}
            />
            <RegisterTally
              label={t('attend.tallyPresent', { defaultValue: '到' })}
              value={overall.present}
              unit={t('attend.unitTimes', { defaultValue: '次' })}
              icon={CalendarCheck}
              tone="emerald"
            />
            <RegisterTally
              label={t('attend.tallyLate', { defaultValue: '遲到' })}
              value={overall.late}
              unit={t('attend.unitTimes', { defaultValue: '次' })}
              icon={AlarmClock}
              tone="amber"
            />
            <RegisterTally
              label={t('attend.tallyAbsent', { defaultValue: '缺席' })}
              value={overall.absent}
              unit={t('attend.unitTimes', { defaultValue: '次' })}
              icon={Ban}
              tone="rose"
            />
          </div>

          {/* 趨勢圖 */}
          <Card className="rounded-2xl p-4 sm:p-5">
            <SectionTitle icon={LineChart}>
              {t('attend.trendTitle', { defaultValue: '每日出席率趨勢' })}
            </SectionTitle>
            <TrendChart points={trend} />
          </Card>

          {/* 預警 */}
          <Card className="rounded-2xl p-4 sm:p-5">
            <SectionTitle
              icon={TriangleAlert}
              description={t('attend.needAttentionDesc', {
                defaultValue: '連續缺席 ≥ 2 次或出席率 < 80%',
              })}
            >
              {t('attend.needAttention', { defaultValue: '需要關注' })}
            </SectionTitle>
            {alerts.length === 0 ? (
              <div className="flex items-center gap-2 rounded-2xl bg-emerald-50/60 px-3 py-2.5 text-sm text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                <CalendarCheck size={16} />
                {t('attend.noAlerts', {
                  defaultValue: '暫時冇人觸發關注條件，全班出席企穩。',
                })}
              </div>
            ) : (
              <ul className="space-y-2">
                {alerts.map(({ student, t: tally }) => (
                  <li
                    key={student.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-rose-200/60 bg-rose-50/50 px-3 py-2 dark:border-rose-500/20 dark:bg-rose-500/5"
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
                      {tally.currentAbsentStreak >= 2 && (
                        <Badge tone="rose" icon={Ban} className="tabular-nums">
                          {t('attend.consecutiveAbsentDays', {
                            count: tally.currentAbsentStreak,
                            defaultValue: `連續缺席 ${tally.currentAbsentStreak} 日`,
                          })}
                        </Badge>
                      )}
                      <Badge tone={rateTone(tally.rate)} className="tabular-nums">
                        {t('attend.rateBadge', {
                          rate: tally.rate,
                          defaultValue: `出席率 ${tally.rate}%`,
                        })}
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
              <Card className="rounded-2xl p-4 sm:p-5">
                <SectionTitle
                  icon={TriangleAlert}
                  description={t('attend.chronicDesc', {
                    pct: CHRONIC_ABSENCE_PCT,
                    defaultValue: `窗口內缺席率 ≥ ${CHRONIC_ABSENCE_PCT}%`,
                  })}
                >
                  {t('attend.chronicTitle', { defaultValue: '長期缺席關注' })}
                </SectionTitle>
                {classification.chronic.length === 0 ? (
                  <p className="rounded-2xl bg-slate-50 px-3 py-2.5 text-sm text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                    {t('attend.chronicNone', { defaultValue: '暫時冇人達到長期缺席門檻。' })}
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {classification.chronic.map((c) => {
                      const s = nameOf(c.studentId)
                      if (!s) return null
                      return (
                        <li
                          key={c.studentId}
                          className="flex items-center justify-between gap-3 rounded-xl border border-rose-200/60 bg-rose-50/50 px-3 py-2 dark:border-rose-500/20 dark:bg-rose-500/5"
                        >
                          <span className="min-w-0 truncate font-medium text-slate-800 dark:text-slate-100">
                            {s.name}
                            <span className="ml-1.5 text-xs font-normal tabular-nums text-slate-400">
                              {t('attend.absentOfMarked', {
                                absent: c.absent,
                                marked: c.marked,
                                defaultValue: `缺 ${c.absent}/${c.marked}`,
                              })}
                            </span>
                          </span>
                          <span className="flex shrink-0 items-center gap-1.5">
                            {c.streak >= 2 && (
                              <Badge tone="rose" icon={Ban} className="tabular-nums">
                                {t('attend.consecutiveDays', {
                                  count: c.streak,
                                  defaultValue: `連續 ${c.streak} 日`,
                                })}
                              </Badge>
                            )}
                            <Badge tone="rose" className="tabular-nums">
                              {t('attend.absenceRateBadge', {
                                rate: c.rate,
                                defaultValue: `缺席率 ${c.rate}%`,
                              })}
                            </Badge>
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </Card>

              <Card className="rounded-2xl p-4 sm:p-5">
                <SectionTitle
                  icon={GraduationCap}
                  description={t('attend.perfectDesc', { defaultValue: '窗口內有記錄且零缺席' })}
                >
                  {t('attend.perfectTitle', { defaultValue: '全勤名單' })}
                </SectionTitle>
                {classification.perfect.length === 0 ? (
                  <p className="rounded-2xl bg-slate-50 px-3 py-2.5 text-sm text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                    {t('attend.perfectNone', { defaultValue: '窗口內暫時未有零缺席學生。' })}
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {classification.perfect.map((p) => {
                      const s = nameOf(p.studentId)
                      if (!s) return null
                      return (
                        <li
                          key={p.studentId}
                          className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200/60 bg-emerald-50/50 px-3 py-2 dark:border-emerald-500/20 dark:bg-emerald-500/5"
                        >
                          <span className="min-w-0 truncate font-medium text-slate-800 dark:text-slate-100">
                            {s.name}
                          </span>
                          <Badge tone="green" icon={CalendarCheck} className="tabular-nums">
                            {t('attend.perfectBadge', {
                              count: p.marked,
                              defaultValue: `全勤 ${p.marked} 堂`,
                            })}
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
          <Card className="rounded-2xl p-4 sm:p-5">
            <SectionTitle
              icon={Users}
              description={t('attend.rankingDesc', {
                defaultValue: '按出席率排序；撳一行睇個別學生摘要',
              })}
            >
              {t('attend.rankingTitle', { defaultValue: '學生出席率排行' })}
            </SectionTitle>
            <ul className="space-y-1">
              {ranked.map(({ student, t: tally }, i) => (
                <li key={student.id}>
                  <button
                    type="button"
                    onClick={() => setFocusId(student.id)}
                    aria-label={t('attend.viewSummaryOf', {
                      name: student.name,
                      defaultValue: `查看 ${student.name} 出席摘要`,
                    })}
                    className="group w-full rounded-xl px-2 py-1.5 text-left transition hover:bg-slate-50 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:hover:bg-slate-700/40"
                  >
                    <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className={cx(
                            'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums',
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
                        {tally.late > 0 && (
                          <span className="shrink-0 text-[11px] tabular-nums text-amber-600 dark:text-amber-300">
                            {t('attend.lateShort', {
                              count: tally.late,
                              defaultValue: `遲${tally.late}`,
                            })}
                          </span>
                        )}
                        {tally.absent > 0 && (
                          <span className="shrink-0 text-[11px] tabular-nums text-rose-600 dark:text-rose-300">
                            {t('attend.absentShort', {
                              count: tally.absent,
                              defaultValue: `缺${tally.absent}`,
                            })}
                          </span>
                        )}
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        <span
                          className={cx(
                            'font-semibold tabular-nums',
                            STATUS_STYLE.present.text,
                            tally.rate != null &&
                              tally.rate < 80 &&
                              'text-rose-600 dark:text-rose-300',
                          )}
                        >
                          {tally.rate}%
                        </span>
                        <ChevronRight
                          size={15}
                          className="text-slate-300 transition group-hover:text-slate-400 dark:text-slate-600 dark:group-hover:text-slate-500"
                        />
                      </span>
                    </div>
                    <ProgressBar value={tally.rate ?? 0} tone={rateBarTone(tally.rate)} size="sm" />
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
  const { t } = useTranslation()
  const tally = data?.tally
  const ns = data?.noteSummary
  const hasMarks = !!tally && tally.marked > 0
  const kindRows = ns
    ? ABSENCE_KIND_OPTIONS.filter((o) => ns.byKind[o.value] > 0)
    : []

  return (
    <Modal open={open} onClose={onClose} size="md">
      {/* 學生出席摘要：icon chip + 姓名 + 學號／出席率 */}
      <header className="-mx-5 -mt-5 mb-5 border-b border-slate-200 px-5 pb-4 pt-5 dark:border-slate-700 sm:-mx-6 sm:-mt-6 sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
              <NotebookPen size={18} />
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-[17px] font-semibold tracking-tight text-slate-800 dark:text-slate-100">
                {studentName || t('attend.summaryFallbackTitle', { defaultValue: '出席摘要' })}
              </h3>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400 dark:text-slate-500">
              {studentNo && (
                <span>
                  {t('attend.studentNo', {
                    no: studentNo,
                    defaultValue: `學號 ${studentNo}`,
                  })}
                </span>
              )}
              {hasMarks && tally && (
                <>
                  {studentNo && (
                    <span aria-hidden className="text-slate-300 dark:text-slate-600">
                      ·
                    </span>
                  )}
                  <Badge tone={rateTone(tally.rate)} className="tabular-nums">
                    {t('attend.rateBadge', {
                      rate: tally.rate,
                      defaultValue: `出席率 ${tally.rate}%`,
                    })}
                  </Badge>
                  <span className="tabular-nums">
                    {t('attend.summaryMarkedHint', {
                      days: rangeDays,
                      marked: tally.marked,
                      defaultValue: `近 ${rangeDays} 日 · 已點 ${tally.marked} 堂`,
                    })}
                  </span>
                </>
              )}
            </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('attend.close', { defaultValue: '關閉' })}
            className="-mr-1.5 -mt-1 shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:hover:bg-slate-700"
          >
            <X size={18} />
          </button>
        </div>
      </header>

      {!hasMarks || !tally || !ns || !data ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-700/60 dark:text-slate-500">
            <NotebookPen size={20} strokeWidth={1.75} />
          </span>
          <p className="text-sm text-slate-400 dark:text-slate-500">
            {t('attend.noRecordInRange', {
              days: rangeDays,
              defaultValue: `呢位學生喺近 ${rangeDays} 日內未有點名記錄。`,
            })}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* 三態結算 + 出席率進度 */}
          <div>
            <div className="grid grid-cols-3 gap-2">
              <MiniStat
                label={t('attend.miniPresent', { defaultValue: '出席' })}
                value={tally.present}
                tone="present"
              />
              <MiniStat
                label={t('attend.miniLate', { defaultValue: '遲到' })}
                value={tally.late}
                tone="late"
              />
              <MiniStat
                label={t('attend.miniAbsent', { defaultValue: '缺席' })}
                value={tally.absent}
                tone="absent"
              />
            </div>
            <div className="mt-2.5">
              <ProgressBar value={tally.rate ?? 0} tone={rateBarTone(tally.rate)} size="sm" />
            </div>
          </div>

          {/* 關鍵指標 */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <FactCell
              label={t('attend.currentStreak', { defaultValue: '目前連續缺席' })}
              value={
                tally.currentAbsentStreak > 0
                  ? t('attend.daysUnit', {
                      count: tally.currentAbsentStreak,
                      defaultValue: `${tally.currentAbsentStreak} 日`,
                    })
                  : '—'
              }
              tone={tally.currentAbsentStreak >= 2 ? 'rose' : 'slate'}
            />
            <FactCell
              label={t('attend.longestStreak', { defaultValue: '期內最長連續缺席' })}
              value={
                data.longestStreak > 0
                  ? t('attend.daysUnit', {
                      count: data.longestStreak,
                      defaultValue: `${data.longestStreak} 日`,
                    })
                  : '—'
              }
              tone={data.longestStreak >= 3 ? 'rose' : 'slate'}
            />
            <FactCell
              label={t('attend.lastPresent', { defaultValue: '最後一次出席' })}
              value={
                data.lastPresent
                  ? shortDateLabel(data.lastPresent)
                  : t('attend.neverPresent', { defaultValue: '從未' })
              }
              tone={data.lastPresent ? 'slate' : 'rose'}
            />
          </div>

          {/* 細項聚合（病假類別 / 遲到分鐘 / 早退） */}
          {(kindRows.length > 0 ||
            ns.lateLoggedCount > 0 ||
            ns.earlyLeaveCount > 0) && (
            <div>
              <SectionTitle icon={ClipboardList}>
                {t('attend.detailStats', { defaultValue: '細項統計' })}
              </SectionTitle>
              <div className="space-y-2 text-sm">
                {kindRows.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-slate-400">
                      {t('attend.absenceReason', { defaultValue: '缺席原因' })}
                    </span>
                    {kindRows.map((o) => (
                      <Badge
                        key={o.value}
                        tone={isExcused(o.value) ? 'blue' : 'rose'}
                        className="tabular-nums"
                      >
                        {t('attend.kindCount', {
                          label: absenceKindLabel(t, o.value),
                          count: ns.byKind[o.value],
                          defaultValue: `${ABSENCE_KIND_LABEL[o.value]} ${ns.byKind[o.value]}`,
                        })}
                      </Badge>
                    ))}
                    {ns.unexcusedCount > 0 && (
                      <span className="text-[11px] text-rose-500 dark:text-rose-400">
                        {t('attend.unexcusedCount', {
                          count: ns.unexcusedCount,
                          defaultValue: `無故 ${ns.unexcusedCount} 次`,
                        })}
                      </span>
                    )}
                  </div>
                )}
                {ns.lateLoggedCount > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-slate-400">
                      {t('attend.lateMinutes', { defaultValue: '遲到分鐘' })}
                    </span>
                    <Badge tone="amber" className="tabular-nums">
                      {t('attend.lateMinutesTotal', {
                        total: ns.lateMinutesTotal,
                        count: ns.lateLoggedCount,
                        defaultValue: `共 ${ns.lateMinutesTotal} 分（${ns.lateLoggedCount} 次）`,
                      })}
                    </Badge>
                    {ns.lateMinutesAvg != null && (
                      <span className="text-[11px] tabular-nums text-slate-400">
                        {t('attend.lateMinutesAvg', {
                          avg: ns.lateMinutesAvg,
                          defaultValue: `平均 ${ns.lateMinutesAvg} 分 / 次`,
                        })}
                      </span>
                    )}
                  </div>
                )}
                {ns.earlyLeaveCount > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-slate-400">
                      {t('attend.earlyLeaveStat', { defaultValue: '早退' })}
                    </span>
                    <Badge tone="slate" className="tabular-nums">
                      {t('attend.earlyLeaveTimes', {
                        count: ns.earlyLeaveCount,
                        defaultValue: `${ns.earlyLeaveCount} 次`,
                      })}
                    </Badge>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 逐堂時間軸（逐格狀態 glyph，由舊到新） */}
          <div>
            <SectionTitle
              icon={CalendarDays}
              description={t('attend.timelineDesc', { defaultValue: '由舊到新，逐個有點名日' })}
            >
              {t('attend.timelineTitle', { defaultValue: '出席時間軸' })}
            </SectionTitle>
            <div className="flex flex-wrap gap-1 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-2.5 dark:border-slate-700/60 dark:bg-slate-800/40">
              {data.timeline.map((d) => (
                <span
                  key={d.dateKey}
                  title={t('attend.timelineTooltip', {
                    date: longDateLabel(d.dateKey),
                    status: statusLabel(t, d.status),
                    defaultValue: `${longDateLabel(d.dateKey)}：${STATUS_LABEL[d.status]}`,
                  })}
                  className={cx(
                    'flex h-7 w-7 items-center justify-center rounded-lg text-[13px] font-semibold leading-none',
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
  // 三態填色格：rounded-xl 填色磚，大數字 + 狀態章。
  return (
    <div className={cx('rounded-xl px-3 py-2.5 text-center', STATUS_STYLE[tone].cell)}>
      <div className="inline-flex items-center justify-center gap-1.5">
        <StampMark status={tone} className="h-5 w-5 text-[11px]" />
        <span className="text-2xl font-semibold leading-none tabular-nums slashed-zero">
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
  // 摘要格：細標籤 + 數值；rose 時左脊提色（警示）。
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
      <div className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
        {label}
      </div>
      <div
        className={cx(
          'mt-0.5 text-base font-semibold tabular-nums slashed-zero',
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
  const { t } = useTranslation()
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
  const labelsEn = t('attend.weekdayLabels', { defaultValue: '' }).split('_')
  const wdLabel = (i: number) =>
    t('attend.weekdayShort', { wd: labels[i], wdEn: labelsEn[i] ?? '', defaultValue: labels[i] })
  // 只顯示有上堂嘅星期（多數係一至五 / 六）
  const visible = data
    .map((d, i) => ({ ...d, i }))
    .filter((d) => d.total > 0)
  const maxTotal = Math.max(1, ...visible.map((d) => d.total))

  if (visible.length === 0) return null

  return (
    <Card className="rounded-2xl p-4 sm:p-5">
      <SectionTitle
        icon={CalendarDays}
        description={t('attend.weekdayDesc', { defaultValue: '睇吓邊日最多遲到 / 缺席' })}
      >
        {t('attend.weekdayTitle', { defaultValue: '星期分佈' })}
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
                className="flex w-full max-w-[2.5rem] flex-col-reverse overflow-hidden rounded-lg"
                style={{ height: Math.max(8, h) }}
                title={t('attend.weekdayBarTooltip', {
                  weekday: wdLabel(d.i),
                  present: d.present,
                  late: d.late,
                  absent: d.absent,
                  defaultValue: `星期${labels[d.i]}：出 ${d.present} / 遲 ${d.late} / 缺 ${d.absent}`,
                })}
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
                {wdLabel(d.i)}
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
