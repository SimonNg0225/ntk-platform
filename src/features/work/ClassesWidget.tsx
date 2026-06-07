import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import './classes/i18n'
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BookUser,
  CalendarCheck,
  ChevronRight,
  ClipboardList,
  DoorOpen,
  Download,
  GraduationCap,
  Home,
  LayoutGrid,
  ListChecks,
  Pencil,
  PieChart,
  Plus,
  Search,
  Settings2,
  School,
  Trash2,
  Upload,
  UserPlus,
  Users,
  UserRound,
  type LucideIcon,
} from 'lucide-react'
import { useCollection } from '../../lib/store'
import {
  assessmentsCol,
  attendanceCol,
  classesCol,
  scoresCol,
  studentsCol,
} from '../../data/collections'
import type {
  Assessment,
  AttendanceRecord,
  Klass,
  Score,
  Student,
} from '../../data/types'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  IconButton,
  Input,
  Menu,
  Modal,
  OptionButtons,
  Pills,
  ProgressBar,
  SegmentedControl,
  Select,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  Textarea,
  cx,
} from '../../ui'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import {
  CLASS_TONES,
  GENDER_META,
  STATUS_META,
  classMetaCol,
  studentMetaCol,
  type ClassMeta,
  type ClassTone,
  type Gender,
  type StudentMeta,
  type StudentStatus,
} from './classes/types'
import {
  classAcademicSummary,
  classMetaFor,
  classSizes,
  completenessOf,
  demographicsOf,
  downloadCsv,
  initials,
  metaFor,
  parseBulk,
  pctTone,
  sortStudents,
  type ClassAcademicSummary,
} from './classes/util'
import {
  BarList,
  ClassSizeChart,
  Donut,
  GenderStrip,
  ProgressRing,
  type DonutSeg,
} from './classes/charts'
import SeatingChart, { seatLabel } from './classes/SeatingChart'
import StudentProfile from './classes/StudentProfile'

// ============================================================
//  班別管理（班級花名冊 / SIS）
//  ------------------------------------------------------------
//  Canonical 參考：PowerSchool / SEEMIS / Google Classroom 花名冊。
//  共用 classesCol / studentsCol（唔改），擴充屬性放自家
//  studentMetaCol / classMetaCol。深度功能：
//   · 總覽儀表（班級規模圖 + 全校統計）
//   · 班別卡（色標、班主任、課室、性別比例條、名冊完整度）
//   · 班別詳情多分頁：名冊（搜尋/篩選/排序/批量貼上/CSV）、
//     座位表 + 隨機分組 + 抽點名、班情分析（性別/班社/狀態圖表）
//   · 學生檔案抽屜：完整 metadata + 跨功能 360° 概覽（唯讀）
// ============================================================

type View = 'overview' | 'classes'

export default function ClassesWidget() {
  const classes = useCollection(classesCol)
  const students = useCollection(studentsCol)
  const studentMetas = useCollection(studentMetaCol)
  const classMetas = useCollection(classMetaCol)
  const toast = useToast()
  const confirm = useConfirm()
  const { t } = useTranslation()

  const [view, setView] = useState<View>('overview')
  const [openClassId, setOpenClassId] = useState<string | null>(null)
  const [showAddClass, setShowAddClass] = useState(false)

  const openClass = classes.find((c) => c.id === openClassId) ?? null

  // ── 全校統計 ──
  const sizes = useMemo(
    () => classSizes(classes, students),
    [classes, students],
  )
  const activeCount = useMemo(
    () =>
      students.filter((s) => metaFor(s.id, studentMetas).status === 'active')
        .length,
    [students, studentMetas],
  )
  const overallCompleteness = useMemo(
    () => completenessOf(students, studentMetas),
    [students, studentMetas],
  )
  const demo = useMemo(
    () => demographicsOf(students, studentMetas),
    [students, studentMetas],
  )

  const removeClass = async (k: Klass) => {
    const count = students.filter((s) => s.classId === k.id).length
    const ok = await confirm({
      title: t('classes.confirmDeleteTitle', { defaultValue: '刪除班別？' }),
      message:
        count > 0
          ? t('classes.confirmDeleteWithStudents', {
              name: k.name,
              count,
              defaultValue: `「${k.name}」連同名下 ${count} 位學生將會一併刪除，呢個動作無法復原。`,
            })
          : t('classes.confirmDeleteEmpty', {
              name: k.name,
              defaultValue: `「${k.name}」將會被永久刪除。`,
            }),
      confirmText: t('classes.confirmDeleteBtn', { defaultValue: '刪除' }),
      tone: 'danger',
    })
    if (!ok) return
    classesCol.remove(k.id)
    students
      .filter((s) => s.classId === k.id)
      .forEach((s) => {
        const m = studentMetas.find((x) => x.studentId === s.id)
        if (m) studentMetaCol.remove(m.id)
        studentsCol.remove(s.id)
      })
    const cm = classMetas.find((x) => x.classId === k.id)
    if (cm) classMetaCol.remove(cm.id)
    if (openClassId === k.id) setOpenClassId(null)
    toast.success(t('classes.classDeleted', { defaultValue: '已刪除班別' }))
  }

  // ── 班別詳情 ──
  if (openClass) {
    return (
      <ClassDetail
        klass={openClass}
        onBack={() => setOpenClassId(null)}
        onDelete={() => removeClass(openClass)}
      />
    )
  }

  const termLabel = classMetas.find((m) => m.term)?.term ?? defaultTerm()
  const avgClassSize = classes.length
    ? Math.round(students.length / classes.length)
    : 0

  return (
    <div className="space-y-5">
      {/* ───────── 班務冊 masthead：點名冊封面（kicker + serif 冊名 + 簽到行）───────── */}
      <header className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white px-5 py-5 shadow-xs dark:border-slate-700/60 dark:bg-slate-800 dark:shadow-none sm:px-7 sm:py-6">
        {/* 封面右上「班務處戳印」（純裝飾，唔搶主次）*/}
        <span
          aria-hidden
          className="pointer-events-none absolute -right-7 top-3 hidden -rotate-6 select-none rounded-xl border-2 border-dashed border-accent/20 px-4 py-2 font-serif text-xs font-semibold uppercase tracking-[0.25em] text-accent/25 dark:border-accent/25 dark:text-accent/25 sm:block"
        >
          點名冊 · {t('classes.rollCall', { defaultValue: 'Roll Call' })}
        </span>
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.3em] text-accent/70">
              <BookUser size={13} />
              班務冊 · {t('classes.register', { defaultValue: 'Class Register' })}
            </p>
            <h1 className="mt-1.5 font-serif text-[28px] font-semibold leading-none tracking-tight text-slate-800 dark:text-slate-100 sm:text-[34px]">
              {t('classes.title', { defaultValue: '班別管理' })}
            </h1>
            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
              <span className="tabular-nums">
                {t('classes.summary', {
                  classes: classes.length,
                  students: students.length,
                  defaultValue: `掌管 ${classes.length} 班 · 點名 ${students.length} 位學生`,
                })}
              </span>
              <span aria-hidden className="text-slate-300 dark:text-slate-600">·</span>
              <span className="inline-flex items-center gap-1 font-medium text-accent-strong dark:text-accent">
                <CalendarCheck size={12} />{' '}
                {t('classes.academicYear', {
                  term: termLabel,
                  defaultValue: `${termLabel} 學年`,
                })}
              </span>
            </p>
          </div>
          {/* 視圖切換 + 主行動：似冊面的索引標 */}
          <div className="flex shrink-0 items-center gap-2">
            <SegmentedControl<View>
              value={view}
              onChange={setView}
              options={[
                { id: 'overview', label: t('classes.tabOverview', { defaultValue: '總覽' }), icon: LayoutGrid },
                { id: 'classes', label: t('classes.tabClasses', { defaultValue: '班別' }), icon: Users },
              ]}
            />
            <Button icon={Plus} onClick={() => setShowAddClass(true)}>
              {t('classes.addClass', { defaultValue: '新增班別' })}
            </Button>
          </div>
        </div>
        {/* 冊面雙線（封面分隔感）*/}
        <div className="mt-5 space-y-1" aria-hidden>
          <span className="block h-px bg-slate-200/90 dark:bg-slate-700/70" />
          <span className="block h-px bg-slate-200/60 dark:bg-slate-700/40" />
        </div>
      </header>

      {/* ───────── 點名冊清點帶：hairline grid · serif 大數字 ───────── */}
      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-slate-200/70 ring-1 ring-slate-200/80 dark:bg-slate-700/50 dark:ring-slate-700/60 sm:grid-cols-4">
        <RegisterStat
          label={t('classes.statClassesLabel', { defaultValue: '在冊班別' })}
          value={classes.length}
          unit={t('classes.statClassesUnit', { defaultValue: '班' })}
          icon={School}
          hot={classes.length > 0}
          hint={t('classes.statClassesHint', { defaultValue: '任教班級' })}
        />
        <RegisterStat
          label={t('classes.statStudentsLabel', { defaultValue: '學生人數' })}
          value={students.length}
          unit={t('classes.statStudentsUnit', { defaultValue: '位' })}
          icon={Users}
          hint={t('classes.statStudentsHint', { defaultValue: '全部名冊合計' })}
        />
        <RegisterStat
          label={t('classes.statActiveLabel', { defaultValue: '在學人數' })}
          value={activeCount}
          unit={t('classes.statActiveUnit', { defaultValue: '位' })}
          icon={GraduationCap}
          hint={
            students.length
              ? t('classes.statActiveHint', {
                  count: students.length - activeCount,
                  defaultValue: `${students.length - activeCount} 位已轉班／離校`,
                })
              : t('classes.statActiveHintNone', { defaultValue: '尚無學生' })
          }
        />
        <RegisterStat
          label={t('classes.statAvgLabel', { defaultValue: '平均班額' })}
          value={avgClassSize}
          unit={t('classes.statAvgUnit', { defaultValue: '人' })}
          icon={ListChecks}
          hint={t('classes.statAvgHint', { defaultValue: '每班學生數' })}
        />
      </section>

      {view === 'overview' ? (
        <div className="space-y-5">
          {classes.length === 0 ? (
            <EmptyState
              icon={BookUser}
              art="empty-classes"
              title={t('classes.emptyTitle', { defaultValue: '班務冊仲係空白一頁' })}
              hint={t('classes.emptyHint', { defaultValue: '開立第一班，成績、出席、進度等功能就會共用呢批班別名冊。' })}
              action={
                <Button icon={Plus} onClick={() => setShowAddClass(true)}>
                  {t('classes.openFirst', { defaultValue: '開立第一班' })}
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card padded>
                <ChartHead icon={Users}>{t('classes.chartClassSizes', { defaultValue: '各班點名人數' })}</ChartHead>
                <ClassSizeChart
                  data={sizes.map(({ klass, count }) => ({
                    id: klass.id,
                    label: klass.name,
                    count,
                    tone: classMetaFor(klass.id, classMetas).color,
                  }))}
                  onPick={setOpenClassId}
                />
              </Card>

              <Card padded>
                <ChartHead icon={GraduationCap}>{t('classes.chartSchoolOverview', { defaultValue: '全校學生概況' })}</ChartHead>
                {students.length === 0 ? (
                  <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">
                    {t('classes.noStudentData', { defaultValue: '仲未有學生資料' })}
                  </p>
                ) : (
                  <div className="flex flex-wrap items-center gap-5">
                    <Donut
                      segments={genderSegments(demo, t)}
                      centerValue={String(students.length)}
                      centerLabel={t('classes.students', { defaultValue: '位學生' })}
                    />
                    <div className="flex items-center gap-3">
                      <ProgressRing
                        pct={overallCompleteness.pct}
                        tone="accent"
                        label={t('classes.completeness', { defaultValue: '完整度' })}
                      />
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        <p className="font-medium text-slate-600 dark:text-slate-300">
                          {t('classes.rosterCompleteness', { defaultValue: '名冊完整度' })}
                        </p>
                        <p className="mt-0.5 tabular-nums">
                          {t('classes.missingStudentNo', {
                            count: overallCompleteness.missing.studentNo,
                            defaultValue: `缺學號 ${overallCompleteness.missing.studentNo}`,
                          })}
                        </p>
                        <p className="tabular-nums">
                          {t('classes.missingGender', {
                            count: overallCompleteness.missing.gender,
                            defaultValue: `缺性別 ${overallCompleteness.missing.gender}`,
                          })}
                        </p>
                        <p className="tabular-nums">
                          {t('classes.missingGuardian', {
                            count: overallCompleteness.missing.guardian,
                            defaultValue: `缺聯絡 ${overallCompleteness.missing.guardian}`,
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          )}
        </div>
      ) : (
        <ClassGrid
          classes={classes}
          students={students}
          studentMetas={studentMetas}
          classMetas={classMetas}
          onOpen={setOpenClassId}
          onDelete={removeClass}
          onAdd={() => setShowAddClass(true)}
        />
      )}

      {showAddClass && (
        <ClassEditor
          onClose={() => setShowAddClass(false)}
          onSaved={(id) => {
            setShowAddClass(false)
            setOpenClassId(id)
            setView('classes')
          }}
        />
      )}
    </div>
  )
}

// ───────── 點名冊清點格（hairline grid · serif 大數字；在冊 hot 高亮）─────────
function RegisterStat({
  label,
  value,
  unit,
  hint,
  icon: Icon,
  hot,
}: {
  label: string
  value: number | string
  unit?: string
  hint?: string
  icon: LucideIcon
  hot?: boolean
}) {
  return (
    <div
      className={cx(
        'px-3.5 py-3.5 transition-colors sm:px-4',
        hot ? 'bg-accent-soft dark:bg-accent/15' : 'bg-white dark:bg-slate-800',
      )}
    >
      <p
        className={cx(
          'flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide',
          hot ? 'text-accent/80 dark:text-accent/80' : 'text-slate-400 dark:text-slate-500',
        )}
      >
        <Icon size={12} className="shrink-0" />
        <span className="truncate">{label}</span>
      </p>
      <p
        className={cx(
          'mt-1 font-serif text-[26px] font-semibold leading-none tabular-nums slashed-zero',
          hot ? 'text-accent-strong dark:text-accent' : 'text-slate-800 dark:text-slate-100',
        )}
      >
        {value}
        {unit && (
          <span className="ml-1 font-sans text-sm font-normal text-slate-400">{unit}</span>
        )}
      </p>
      {hint && (
        <p className="mt-1 truncate text-[11px] text-slate-400 dark:text-slate-500">{hint}</p>
      )}
    </div>
  )
}

// ───────── 性別環形 segments ─────────
function genderSegments(
  demo: {
    gender: Record<Gender, number>
    genderUnknown: number
  },
  t: TFunction,
): DonutSeg[] {
  const segs: DonutSeg[] = [
    { value: demo.gender.M, tone: 'blue', label: t('classes.genderM', { defaultValue: '男' }) },
    { value: demo.gender.F, tone: 'rose', label: t('classes.genderF', { defaultValue: '女' }) },
  ]
  if (demo.gender.X > 0)
    segs.push({ value: demo.gender.X, tone: 'slate', label: t('classes.genderOther', { defaultValue: '其他' }) })
  if (demo.genderUnknown > 0)
    segs.push({ value: demo.genderUnknown, tone: 'slate', label: t('classes.genderUnknown', { defaultValue: '未填' }) })
  return segs
}

// ============================================================
//  班別卡列表
// ============================================================
function ClassGrid({
  classes,
  students,
  studentMetas,
  classMetas,
  onOpen,
  onDelete,
  onAdd,
}: {
  classes: Klass[]
  students: Student[]
  studentMetas: StudentMeta[]
  classMetas: ClassMeta[]
  onOpen: (id: string) => void
  onDelete: (k: Klass) => void
  onAdd: () => void
}) {
  const { t } = useTranslation()
  if (classes.length === 0)
    return (
      <EmptyState
        icon={BookUser}
        art="empty-classes"
        title={t('classes.emptyTitle', { defaultValue: '班務冊仲係空白一頁' })}
        hint={t('classes.emptyGridHint', { defaultValue: '開立一班，就可以喺度建立佢嘅花名冊、座位表同班情分析。' })}
        action={
          <Button icon={Plus} onClick={onAdd}>
            {t('classes.openFirst', { defaultValue: '開立第一班' })}
          </Button>
        }
      />
    )

  return (
    <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
      {classes.map((c) => {
        const roster = students.filter((s) => s.classId === c.id)
        const cm = classMetaFor(c.id, classMetas)
        const d = demographicsOf(roster, studentMetas)
        const comp = completenessOf(roster, studentMetas)
        return (
          <Card
            key={c.id}
            hover
            className="group relative flex overflow-hidden rounded-3xl p-0"
            onClick={() => onOpen(c.id)}
          >
            {/* 班別色：左側裝訂書脊（班牌色帶）*/}
            <span
              className={cx('w-1.5 shrink-0 transition-all duration-200 group-hover:w-2', TONE_BAR[cm.color])}
              aria-hidden
            />
            <div className="min-w-0 flex-1 p-5">
              {/* 班牌頭：色標 chip + serif 班名 + 科目 */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={cx(
                      'flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-2xl leading-none transition duration-200',
                      TONE_CHIP[cm.color],
                    )}
                    aria-hidden
                  >
                    <span className="text-[8px] font-semibold uppercase tracking-[0.15em] opacity-60">
                      Class
                    </span>
                    <span className="font-serif text-base font-bold leading-none">
                      {classBadge(c.name)}
                    </span>
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-serif text-xl font-bold leading-tight text-slate-800 dark:text-slate-100">
                      {c.name}
                    </p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {c.subject}
                    </p>
                  </div>
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  <Menu
                    align="end"
                    trigger={
                      <IconButton label={t('classes.classOptions', { defaultValue: '班別選項' })} size="sm">
                        <Settings2 size={16} />
                      </IconButton>
                    }
                    items={[
                      {
                        id: 'open',
                        label: t('classes.openRoster', { defaultValue: '翻開名冊' }),
                        icon: BookUser,
                        onSelect: () => onOpen(c.id),
                      },
                      {
                        id: 'del',
                        label: t('classes.deleteClass', { defaultValue: '刪除班別' }),
                        icon: Trash2,
                        tone: 'danger',
                        onSelect: () => onDelete(c),
                      },
                    ]}
                  />
                </div>
              </div>

              {cm.formTeacher || cm.room ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {cm.formTeacher && (
                    <Badge tone="slate" icon={UserRound}>
                      {cm.formTeacher}
                    </Badge>
                  )}
                  {cm.room && (
                    <Badge tone="slate" icon={DoorOpen}>
                      {cm.room}
                    </Badge>
                  )}
                </div>
              ) : null}

              {/* 點名人數：serif 大數字（班牌主數字）*/}
              <div className="mt-4 flex items-end justify-between">
                <span className="flex items-baseline gap-1.5">
                  <span className="font-serif text-3xl font-bold tabular-nums slashed-zero text-slate-800 dark:text-slate-100">
                    {roster.length}
                  </span>
                  <span className="text-xs font-normal text-slate-400">{t('classes.studentsSuffix', { defaultValue: '位學生' })}</span>
                </span>
                {roster.length > 0 && (
                  <span className="text-[11px] tabular-nums text-slate-400">
                    {t('classes.genderTallyMF', {
                      m: d.gender.M,
                      f: d.gender.F,
                      defaultValue: `男 ${d.gender.M} · 女 ${d.gender.F}`,
                    })}
                    {d.gender.X + d.genderUnknown > 0 &&
                      t('classes.genderTallyOther', {
                        count: d.gender.X + d.genderUnknown,
                        defaultValue: ` · 其他 ${d.gender.X + d.genderUnknown}`,
                      })}
                  </span>
                )}
              </div>
              <div className="mt-2">
                <GenderStrip m={d.gender.M} f={d.gender.F} x={d.gender.X + d.genderUnknown} />
              </div>

              {/* 冊頁底線 + 翻開提示 */}
              <div className="mt-3.5 flex items-center justify-between border-t border-dashed border-slate-200/80 pt-3 text-[11px] dark:border-slate-700/60">
                <span className="inline-flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
                  <ListChecks size={12} />
                  {t('classes.rosterCompleteness', { defaultValue: '名冊完整度' })}
                  <span className={cx('font-semibold tabular-nums', compTextTone(comp.pct))}>
                    {comp.pct}%
                  </span>
                </span>
                <span className="inline-flex items-center gap-0.5 font-medium text-slate-400 transition-colors group-hover:text-accent dark:text-slate-500">
                  {t('classes.flipOpen', { defaultValue: '翻開名冊' })}
                  <ChevronRight
                    size={13}
                    className="transition-transform duration-200 group-hover:translate-x-0.5"
                  />
                </span>
              </div>
            </div>
          </Card>
        )
      })}
    </div>
  )
}

// 班牌書脊色帶（左側裝訂條）
const TONE_BAR: Record<ClassTone, string> = {
  accent: 'bg-accent',
  blue: 'bg-blue-500',
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
  slate: 'bg-slate-400',
}

// 班別色 班牌 chip（淺底深字，深色 /15）
const TONE_CHIP: Record<ClassTone, string> = {
  accent: 'bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent',
  blue: 'bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300',
  green: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300',
  rose: 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300',
  slate: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
}

// 班牌 chip 內嘅短代號（取班名首 1–2 個字母/數字，例如「5A」「中」）
function classBadge(name: string): string {
  const t = name.trim()
  if (!t) return '—'
  const m = t.match(/^[A-Za-z0-9]{1,3}/)
  if (m) return m[0].toUpperCase()
  return t.slice(0, 2)
}

// 完整度文字色（沿用 pctTone 語意，但取文字版）
function compTextTone(pct: number): string {
  if (pct >= 80) return 'text-emerald-600 dark:text-emerald-400'
  if (pct >= 50) return 'text-accent-strong dark:text-accent'
  if (pct >= 25) return 'text-amber-600 dark:text-amber-400'
  return 'text-rose-600 dark:text-rose-400'
}

// ============================================================
//  班別詳情（多分頁）
// ============================================================
type DetailTab = 'roster' | 'seating' | 'analytics'

function ClassDetail({
  klass,
  onBack,
  onDelete,
}: {
  klass: Klass
  onBack: () => void
  onDelete: () => void
}) {
  const allStudents = useCollection(studentsCol)
  const studentMetas = useCollection(studentMetaCol)
  const classMetas = useCollection(classMetaCol)
  const scores = useCollection(scoresCol)
  const assessments = useCollection(assessmentsCol)
  const attendance = useCollection(attendanceCol)
  const [tab, setTab] = useState<DetailTab>('roster')
  const [showEdit, setShowEdit] = useState(false)
  const { t } = useTranslation()

  const cm = classMetaFor(klass.id, classMetas)
  const roster = useMemo(
    () => allStudents.filter((s) => s.classId === klass.id),
    [allStudents, klass.id],
  )

  const setSeatCols = (n: number) => {
    if (cm.id) classMetaCol.update(cm.id, { seatCols: n, updatedAt: new Date().toISOString() })
    else
      classMetaCol.add({
        classId: klass.id,
        color: cm.color,
        seatCols: n,
        updatedAt: new Date().toISOString(),
      })
  }

  return (
    <div className="space-y-5">
      {/* ───────── 班牌 masthead：翻開咗嘅點名冊頁面（色脊 + serif 班名 + 卷務行）───────── */}
      <header className="relative flex overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xs dark:border-slate-700/60 dark:bg-slate-800 dark:shadow-none">
        {/* 班別色脊（同班牌卡呼應）*/}
        <span className={cx('w-1.5 shrink-0', TONE_BAR[cm.color])} aria-hidden />
        <div className="min-w-0 flex-1 px-5 py-5 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
            <div className="min-w-0">
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-1 rounded text-xs font-medium text-slate-400 transition hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-1 dark:text-slate-500"
              >
                <ArrowLeft size={13} /> {t('classes.backToAll', { defaultValue: '班務冊 · 全部班別' })}
              </button>
              <div className="mt-1.5 flex items-center gap-3">
                <span
                  className={cx(
                    'flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-2xl leading-none',
                    TONE_CHIP[cm.color],
                  )}
                  aria-hidden
                >
                  <span className="text-[8px] font-semibold uppercase tracking-[0.15em] opacity-60">
                    Class
                  </span>
                  <span className="font-serif text-base font-bold leading-none">
                    {classBadge(klass.name)}
                  </span>
                </span>
                <div className="min-w-0">
                  <h1 className="truncate font-serif text-[26px] font-semibold leading-none tracking-tight text-slate-800 dark:text-slate-100 sm:text-[30px]">
                    {klass.name}
                  </h1>
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                    <span className="truncate">{klass.subject}</span>
                    <span aria-hidden className="text-slate-300 dark:text-slate-600">·</span>
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <Users size={12} />{' '}
                      {t('classes.summary_students', {
                        count: roster.length,
                        defaultValue: `${roster.length} 位學生`,
                      })}
                    </span>
                  </p>
                </div>
              </div>
            </div>
            <Button variant="secondary" icon={Pencil} onClick={() => setShowEdit(true)}>
              {t('classes.classSettings', { defaultValue: '班別設定' })}
            </Button>
          </div>

          {(cm.formTeacher || cm.room || cm.term) && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {cm.formTeacher && (
                <Badge tone="accent" icon={UserRound}>
                  {t('classes.formTeacherBadge', {
                    name: cm.formTeacher,
                    defaultValue: `班主任 ${cm.formTeacher}`,
                  })}
                </Badge>
              )}
              {cm.room && (
                <Badge tone="slate" icon={DoorOpen}>
                  {t('classes.roomBadge', {
                    room: cm.room,
                    defaultValue: `課室 ${cm.room}`,
                  })}
                </Badge>
              )}
              {cm.term && (
                <Badge tone="slate" icon={CalendarCheck}>
                  {t('classes.academicYear', {
                    term: cm.term,
                    defaultValue: `${cm.term} 學年`,
                  })}
                </Badge>
              )}
              <Badge tone={cm.color} dot>
                {t('classes.toneBadge', {
                  tone: CLASS_TONES.find((ct) => ct.id === cm.color)?.label ?? cm.color,
                  defaultValue: `${CLASS_TONES.find((ct) => ct.id === cm.color)?.label ?? cm.color}牌`,
                })}
              </Badge>
            </div>
          )}
        </div>
      </header>

      <SegmentedControl<DetailTab>
        value={tab}
        onChange={setTab}
        options={[
          { id: 'roster', label: t('classes.tabRoster', { defaultValue: '花名冊' }), icon: BookUser },
          { id: 'seating', label: t('classes.tabSeating', { defaultValue: '座位 / 工具' }), icon: LayoutGrid },
          { id: 'analytics', label: t('classes.tabAnalytics', { defaultValue: '班情分析' }), icon: ClipboardList },
        ]}
      />

      {tab === 'roster' && <Roster klass={klass} roster={roster} metas={studentMetas} />}
      {tab === 'seating' && (
        <SeatingChart
          students={sortStudents(roster)}
          metas={studentMetas}
          cols={cm.seatCols}
          onColsChange={setSeatCols}
        />
      )}
      {tab === 'analytics' && (
        <Analytics
          roster={roster}
          metas={studentMetas}
          scores={scores}
          assessments={assessments}
          attendance={attendance}
        />
      )}

      {showEdit && (
        <ClassEditor
          klass={klass}
          onClose={() => setShowEdit(false)}
          onSaved={() => setShowEdit(false)}
          onDelete={() => {
            setShowEdit(false)
            onDelete()
          }}
        />
      )}
    </div>
  )
}

// ───────── 名冊（搜尋 / 篩選 / 排序 / 批量 / CSV）─────────
type StatusFilter = StudentStatus | 'all'

function Roster({
  klass,
  roster,
  metas,
}: {
  klass: Klass
  roster: Student[]
  metas: StudentMeta[]
}) {
  const toast = useToast()
  const { t } = useTranslation()
  const [q, setQ] = useState('')
  const [statusF, setStatusF] = useState<StatusFilter>('all')
  const [showAdd, setShowAdd] = useState(false)
  const [showBulk, setShowBulk] = useState(false)
  const [profileId, setProfileId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const sorted = sortStudents(roster)
    const ql = q.trim().toLowerCase()
    return sorted.filter((s) => {
      const m = metaFor(s.id, metas)
      if (statusF !== 'all' && m.status !== statusF) return false
      if (!ql) return true
      return (
        s.name.toLowerCase().includes(ql) ||
        (s.studentNo ?? '').toLowerCase().includes(ql) ||
        (m.house ?? '').toLowerCase().includes(ql) ||
        (m.tags ?? []).some((t) => t.toLowerCase().includes(ql))
      )
    })
  }, [roster, metas, q, statusF])

  const statusCounts = useMemo(() => {
    const c: Record<StatusFilter, number> = {
      all: roster.length,
      active: 0,
      transferred: 0,
      withdrawn: 0,
    }
    roster.forEach((s) => c[metaFor(s.id, metas).status]++)
    return c
  }, [roster, metas])

  const exportCsv = () => {
    const rows: (string | number)[][] = [
      [
        t('classes.csvNo', { defaultValue: '學號' }),
        t('classes.csvName', { defaultValue: '姓名' }),
        t('classes.csvGender', { defaultValue: '性別' }),
        t('classes.csvHouse', { defaultValue: '班社' }),
        t('classes.csvRole', { defaultValue: '職務' }),
        t('classes.csvGuardian', { defaultValue: '監護人' }),
        t('classes.csvPhone', { defaultValue: '電話' }),
        t('classes.csvEmail', { defaultValue: '電郵' }),
        t('classes.csvStatus', { defaultValue: '狀態' }),
        t('classes.csvSeat', { defaultValue: '座位' }),
        t('classes.csvTags', { defaultValue: '標籤' }),
      ],
    ]
    for (const s of sortStudents(roster)) {
      const m = metaFor(s.id, metas)
      rows.push([
        s.studentNo ?? '',
        s.name,
        m.gender ? GENDER_META[m.gender].label : '',
        m.house ?? '',
        m.role ?? '',
        m.guardianName ?? '',
        m.guardianPhone ?? '',
        m.email ?? '',
        STATUS_META[m.status].label,
        seatLabel(metas, s.id),
        (m.tags ?? []).join(' / '),
      ])
    }
    downloadCsv(
      t('classes.csvFilename', {
        name: klass.name,
        defaultValue: `${klass.name}_名冊.csv`,
      }),
      rows,
    )
    toast.success(t('classes.csvExported', { defaultValue: '已匯出 CSV' }))
  }

  const profileStudent = roster.find((s) => s.id === profileId) ?? null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          icon={Search}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('classes.searchPlaceholder', { defaultValue: '搜尋姓名 / 學號 / 班社 / 標籤' })}
          className="min-w-[12rem] flex-1"
        />
        <Button icon={UserPlus} onClick={() => setShowAdd(true)}>
          {t('classes.addStudent', { defaultValue: '加學生' })}
        </Button>
        <Menu
          align="end"
          trigger={
            <Button variant="secondary" icon={Settings2}>
              {t('classes.more', { defaultValue: '更多' })}
            </Button>
          }
          items={[
            {
              id: 'bulk',
              label: t('classes.bulkPaste', { defaultValue: '批量貼上加入' }),
              icon: Upload,
              onSelect: () => setShowBulk(true),
            },
            {
              id: 'csv',
              label: t('classes.exportCsv', { defaultValue: '匯出 CSV' }),
              icon: Download,
              onSelect: exportCsv,
              disabled: roster.length === 0,
            },
          ]}
        />
      </div>

      <Pills
        options={[
          { id: 'all', label: t('classes.filterAll', { defaultValue: '全部' }) },
          { id: 'active', label: t('classes.filterActive', { defaultValue: '在學' }) },
          { id: 'transferred', label: t('classes.filterTransferred', { defaultValue: '已轉班' }) },
          { id: 'withdrawn', label: t('classes.filterWithdrawn', { defaultValue: '已離校' }) },
        ]}
        active={statusF}
        onChange={(id) => setStatusF(id as StatusFilter)}
        size="sm"
        counts={statusCounts}
      />

      {roster.length === 0 ? (
        <EmptyState
          icon={BookUser}
          title={t('classes.rosterEmptyTitle', { defaultValue: '花名冊仲係吉嘅' })}
          hint={t('classes.rosterEmptyHint', { defaultValue: '逐位點名加入，或者用「批量貼上」一次過貼一整班名單入冊。' })}
          action={
            <div className="flex gap-2">
              <Button icon={UserPlus} onClick={() => setShowAdd(true)}>
                {t('classes.addStudent', { defaultValue: '加學生' })}
              </Button>
              <Button variant="secondary" icon={Upload} onClick={() => setShowBulk(true)}>
                {t('classes.bulkPasteShort', { defaultValue: '批量貼上' })}
              </Button>
            </div>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title={t('classes.rosterNoMatchTitle', { defaultValue: '花名冊搵唔到呢位' })}
          hint={t('classes.rosterNoMatchHint', { defaultValue: '試下清除搜尋或篩選，再翻查名冊。' })}
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-700/60">
          {/* 花名冊冊頁標頭 */}
          <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 bg-slate-50/80 px-3.5 py-2 dark:border-slate-700/60 dark:bg-slate-800/60">
            <span className="inline-flex items-center gap-1.5 font-serif text-sm font-semibold text-slate-700 dark:text-slate-200">
              <BookUser size={14} className="text-accent" />
              花名冊 · {t('classes.rosterHeader', { defaultValue: 'Roster' })}
            </span>
            <span className="text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
              {t('classes.tapRowHint', { defaultValue: '撳一行睇學生檔案' })}
            </span>
          </div>
          <Table className="rounded-none border-0">
          <Thead>
            <Tr>
              <Th className="w-16">{t('classes.colStudentNo', { defaultValue: '學號' })}</Th>
              <Th>{t('classes.colName', { defaultValue: '姓名' })}</Th>
              <Th>{t('classes.colHouseRole', { defaultValue: '班社 / 職務' })}</Th>
              <Th align="center">{t('classes.colGender', { defaultValue: '性別' })}</Th>
              <Th align="center">{t('classes.colSeat', { defaultValue: '座位' })}</Th>
              <Th align="center">{t('classes.colStatus', { defaultValue: '狀態' })}</Th>
            </Tr>
          </Thead>
          <Tbody>
            {filtered.map((s) => {
              const m = metaFor(s.id, metas)
              return (
                <Tr key={s.id} onClick={() => setProfileId(s.id)}>
                  <Td numeric className="font-serif text-slate-400">
                    {s.studentNo || '—'}
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft font-serif text-sm font-bold text-accent-strong dark:bg-accent/15 dark:text-accent">
                        {initials(s.name)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-800 dark:text-slate-100">
                          {s.name}
                        </p>
                        {(m.tags?.length ?? 0) > 0 && (
                          <div className="mt-0.5 flex flex-wrap gap-1">
                            {m.tags!.slice(0, 2).map((t) => (
                              <span
                                key={t}
                                className="rounded bg-slate-100 px-1.5 text-[10px] text-slate-500 dark:bg-slate-700/60 dark:text-slate-400"
                              >
                                {t}
                              </span>
                            ))}
                            {m.tags!.length > 2 && (
                              <span className="text-[10px] text-slate-400">
                                +{m.tags!.length - 2}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </Td>
                  <Td className="text-sm text-slate-500 dark:text-slate-400">
                    <div className="flex flex-wrap items-center gap-1">
                      {m.house && <Badge tone="slate">{m.house}</Badge>}
                      {m.role && <Badge tone="accent">{m.role}</Badge>}
                      {!m.house && !m.role && '—'}
                    </div>
                  </Td>
                  <Td align="center">
                    {m.gender ? (
                      <Badge tone={GENDER_META[m.gender].tone}>
                        {GENDER_META[m.gender].label}
                      </Badge>
                    ) : (
                      <span className="text-slate-400 dark:text-slate-500">—</span>
                    )}
                  </Td>
                  <Td align="center" className="tabular-nums text-slate-500">
                    {seatLabel(metas, s.id)}
                  </Td>
                  <Td align="center">
                    <Badge tone={STATUS_META[m.status].tone} dot>
                      {STATUS_META[m.status].label}
                    </Badge>
                  </Td>
                </Tr>
              )
            })}
          </Tbody>
        </Table>
        </div>
      )}

      {filtered.length > 0 && (
        <p
          className="text-right text-xs tabular-nums text-slate-400 dark:text-slate-500"
          aria-live="polite"
        >
          {t('classes.showingCount', {
            shown: filtered.length,
            total: roster.length,
            defaultValue: `顯示 ${filtered.length} / ${roster.length} 位`,
          })}
        </p>
      )}

      {showAdd && (
        <AddStudent
          classId={klass.id}
          onClose={() => setShowAdd(false)}
        />
      )}
      {showBulk && (
        <BulkAdd classId={klass.id} onClose={() => setShowBulk(false)} />
      )}
      {profileStudent && (
        <StudentProfile
          student={profileStudent}
          className={klass.name}
          onClose={() => setProfileId(null)}
        />
      )}
    </div>
  )
}

// ───────── 加單個學生 ─────────
function AddStudent({
  classId,
  onClose,
}: {
  classId: string
  onClose: () => void
}) {
  const toast = useToast()
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [no, setNo] = useState('')
  const [gender, setGender] = useState<Gender | ''>('')
  const [keepOpen, setKeepOpen] = useState(true)

  const save = () => {
    if (!name.trim()) {
      toast.error(t('classes.errNameRequired', { defaultValue: '請輸入姓名' }))
      return
    }
    const stu = studentsCol.add({
      classId,
      name: name.trim(),
      studentNo: no.trim() || undefined,
    })
    if (gender)
      studentMetaCol.add({
        studentId: stu.id,
        gender,
        status: 'active',
        seat: -1,
        updatedAt: new Date().toISOString(),
      })
    toast.success(t('classes.studentAdded', { defaultValue: '已加入學生' }))
    setName('')
    setNo('')
    setGender('')
    if (!keepOpen) onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t('classes.addStudentTitle', { defaultValue: '加入學生' })}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('classes.done', { defaultValue: '完成' })}
          </Button>
          <Button icon={Plus} onClick={save}>
            {t('classes.add', { defaultValue: '加入' })}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label={t('classes.fieldStudentNo', { defaultValue: '學號' })}>
            <Input
              value={no}
              onChange={(e) => setNo(e.target.value)}
              className="tabular-nums"
              placeholder="12"
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label={t('classes.fieldName', { defaultValue: '姓名' })} required>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && save()}
                placeholder={t('classes.namePlaceholder', { defaultValue: '陳大文' })}
              />
            </Field>
          </div>
        </div>
        <Field label={t('classes.fieldGender', { defaultValue: '性別' })}>
          <OptionButtons
            options={(['M', 'F', 'X'] as Gender[]).map((g) => ({
              id: g,
              label: GENDER_META[g].label,
            }))}
            value={gender}
            onChange={setGender}
            clearable
          />
        </Field>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <input
            type="checkbox"
            checked={keepOpen}
            onChange={(e) => setKeepOpen(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-slate-300 text-accent focus:ring-accent/40 dark:border-slate-600 dark:bg-slate-700"
          />
          {t('classes.keepAdding', { defaultValue: '加入後繼續輸入下一位（連續加入）' })}
        </label>
      </div>
    </Modal>
  )
}

// ───────── 批量貼上 ─────────
function BulkAdd({
  classId,
  onClose,
}: {
  classId: string
  onClose: () => void
}) {
  const toast = useToast()
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const parsed = useMemo(() => parseBulk(text), [text])

  const importAll = () => {
    if (parsed.length === 0) {
      toast.error(t('classes.errNoImport', { defaultValue: '未有可匯入嘅資料' }))
      return
    }
    parsed.forEach((r) =>
      studentsCol.add({
        classId,
        name: r.name,
        studentNo: r.studentNo,
      }),
    )
    toast.success(
      t('classes.bulkImported', {
        count: parsed.length,
        defaultValue: `已加入 ${parsed.length} 位學生`,
      }),
    )
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t('classes.bulkTitle', { defaultValue: '批量貼上加入' })}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('classes.cancel', { defaultValue: '取消' })}
          </Button>
          <Button icon={Upload} onClick={importAll} disabled={parsed.length === 0}>
            {t('classes.importN', {
              count: parsed.length,
              defaultValue: `匯入 ${parsed.length} 位`,
            })}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field
          label={t('classes.bulkLabel', { defaultValue: '貼上名單' })}
          hint={t('classes.bulkHint', { defaultValue: '每行一位。支援「學號 姓名」或淨係姓名；用 Tab / 逗號 / 空格分隔。' })}
        >
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="min-h-[140px] font-mono text-xs"
            placeholder={'1\t陳大文\n2\t李小明\n黃美思'}
          />
        </Field>
        {parsed.length > 0 && (
          <div className="rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="border-b border-slate-100 px-3 py-2 text-xs font-medium text-slate-500 dark:border-slate-700 dark:text-slate-400">
              {t('classes.previewN', {
                count: parsed.length,
                defaultValue: `預覽（${parsed.length} 位）`,
              })}
            </div>
            <div className="max-h-48 overflow-y-auto divide-y divide-slate-50 dark:divide-slate-800">
              {parsed.map((r, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 px-3 py-1.5 text-sm"
                >
                  <span className="w-10 shrink-0 tabular-nums text-slate-400">
                    {r.studentNo || '—'}
                  </span>
                  <span className="text-slate-700 dark:text-slate-200">
                    {r.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

// ───────── 班情分析 ─────────
function Analytics({
  roster,
  metas,
  scores,
  assessments,
  attendance,
}: {
  roster: Student[]
  metas: StudentMeta[]
  scores: Score[]
  assessments: Assessment[]
  attendance: AttendanceRecord[]
}) {
  const { t } = useTranslation()
  const demo = useMemo(() => demographicsOf(roster, metas), [roster, metas])
  const comp = useMemo(() => completenessOf(roster, metas), [roster, metas])
  const health = useMemo(
    () => classAcademicSummary(roster, scores, assessments, attendance),
    [roster, scores, assessments, attendance],
  )

  if (roster.length === 0)
    return (
      <EmptyState
        icon={ClipboardList}
        title={t('classes.analyticsEmptyTitle', { defaultValue: '未有學生，畫唔到班情' })}
        hint={t('classes.analyticsEmptyHint', { defaultValue: '喺花名冊加入學生並填寫性別 / 班社後，呢度會即時生成班情圖表。' })}
      />
    )

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ClassHealthCard health={health} />

      <Card padded>
        <ChartHead icon={PieChart}>{t('classes.genderDistribution', { defaultValue: '性別分布' })}</ChartHead>
        <Donut
          segments={genderSegments(demo, t)}
          centerValue={String(roster.length)}
          centerLabel={t('classes.students', { defaultValue: '位學生' })}
        />
      </Card>

      <Card padded>
        <ChartHead icon={Activity}>{t('classes.enrolmentStatus', { defaultValue: '就讀狀態' })}</ChartHead>
        <Donut
          segments={[
            { value: demo.status.active, tone: 'green', label: t('classes.statusActive', { defaultValue: '在學' }) },
            { value: demo.status.transferred, tone: 'amber', label: t('classes.statusTransferred', { defaultValue: '已轉班' }) },
            { value: demo.status.withdrawn, tone: 'slate', label: t('classes.statusWithdrawn', { defaultValue: '已離校' }) },
          ]}
          centerValue={String(demo.status.active)}
          centerLabel={t('classes.statusActive', { defaultValue: '在學' })}
        />
      </Card>

      <Card padded>
        <ChartHead icon={Home}>{t('classes.houseDistribution', { defaultValue: '班社 / House 分布' })}</ChartHead>
        <BarList
          items={demo.house.map((h) => ({ label: h.name, value: h.count }))}
          emptyHint={t('classes.houseEmptyHint', { defaultValue: '仲未有學生填寫班社' })}
        />
      </Card>

      <Card padded>
        <ChartHead icon={ListChecks}>{t('classes.dataCompleteness', { defaultValue: '名冊資料完整度' })}</ChartHead>
        <div className="flex items-center gap-5">
          <ProgressRing pct={comp.pct} tone="accent" label={t('classes.overall', { defaultValue: '整體' })} />
          <BarList
            items={[
              {
                label: t('classes.hasStudentNo', { defaultValue: '有學號' }),
                value: comp.total - comp.missing.studentNo,
                tone: 'accent',
              },
              {
                label: t('classes.hasGender', { defaultValue: '有性別' }),
                value: comp.total - comp.missing.gender,
                tone: 'blue',
              },
              {
                label: t('classes.hasGuardian', { defaultValue: '有聯絡' }),
                value: comp.total - comp.missing.guardian,
                tone: 'green',
              },
            ]}
          />
        </div>
      </Card>
    </div>
  )
}

// 圖表卡標題：小 accent icon chip + 標籤（暖化、統一層次）
function ChartHead({
  icon: I,
  children,
}: {
  icon: LucideIcon
  children: React.ReactNode
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
        <I size={13} />
      </span>
      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {children}
      </span>
    </div>
  )
}

// ───────── 班情健康摘要卡（跨功能：成績 + 出席 + 需關注）─────────
function ClassHealthCard({ health }: { health: ClassAcademicSummary }) {
  const { t } = useTranslation()
  const noData =
    health.avgGradePct == null &&
    health.attendanceRate == null &&
    health.atRiskCount === 0
  const attTone =
    health.attendanceRate == null
      ? 'accent'
      : health.attendanceRate >= 90
        ? 'green'
        : health.attendanceRate >= 80
          ? 'accent'
          : 'rose'

  return (
    <Card padded className="lg:col-span-2">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
          <GraduationCap size={13} />
        </span>
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {t('classes.classHealth', { defaultValue: '班情健康' })}
        </span>
        <span className="ml-auto text-[10px] font-normal normal-case tracking-normal text-slate-400 dark:text-slate-500">
          {t('classes.healthReadonly', { defaultValue: '綜合成績 / 出席（唯讀）' })}
        </span>
      </div>

      {noData ? (
        <p className="py-4 text-center text-sm text-slate-400 dark:text-slate-500">
          {t('classes.healthEmpty', { defaultValue: '仲未有成績或出席紀錄。喺「成績」同「點名」功能輸入後，呢度會自動彙整班情。' })}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          {/* 班平均分 */}
          <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <GraduationCap size={13} className="text-slate-400" />
              {t('classes.avgGrade', { defaultValue: '班平均分' })}
            </div>
            <p className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold tabular-nums text-slate-800 dark:text-slate-100">
                {health.avgGradePct == null ? '—' : `${health.avgGradePct}%`}
              </span>
              {health.avgGradePct != null && (
                <Badge tone={pctTone(health.avgGradePct)} dot>
                  {gradeBandLabel(health.avgGradePct, t)}
                </Badge>
              )}
            </p>
            <p className="mt-0.5 text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
              {t('classes.gradedCount', {
                graded: health.gradedStudents,
                total: health.total,
                defaultValue: `${health.gradedStudents}/${health.total} 位已有成績`,
              })}
            </p>
          </div>

          {/* 班出席率 */}
          <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <CalendarCheck size={13} className="text-slate-400" />
              {t('classes.attendanceRate', { defaultValue: '班出席率' })}
            </div>
            <p className="mt-1 text-2xl font-bold tabular-nums text-slate-800 dark:text-slate-100">
              {health.attendanceRate == null ? '—' : `${health.attendanceRate}%`}
            </p>
            {health.attendanceRate != null ? (
              <div className="mt-1.5">
                <ProgressBar value={health.attendanceRate} tone={attTone} size="sm" />
              </div>
            ) : (
              <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
                {t('classes.noAttendance', { defaultValue: '未有點名紀錄' })}
              </p>
            )}
          </div>

          {/* 需關注 */}
          <div
            className={cx(
              'rounded-xl border p-3',
              health.atRiskCount > 0
                ? 'border-amber-300/70 bg-amber-50/60 dark:border-amber-500/40 dark:bg-amber-500/10'
                : 'border-slate-200 dark:border-slate-700',
            )}
          >
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <AlertTriangle
                size={13}
                className={health.atRiskCount > 0 ? 'text-amber-500' : 'text-slate-400'}
              />
              {t('classes.atRisk', { defaultValue: '需關注' })}
            </div>
            <p className="mt-1 text-2xl font-bold tabular-nums text-slate-800 dark:text-slate-100">
              {health.atRiskCount}
              <span className="ml-1 text-xs font-normal text-slate-400">{t('classes.atRiskUnit', { defaultValue: '位' })}</span>
            </p>
            <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
              {t('classes.atRiskHint', { defaultValue: '成績 <50% 或出席 <80%' })}
            </p>
          </div>
        </div>
      )}
    </Card>
  )
}

function gradeBandLabel(pct: number, t: TFunction): string {
  if (pct >= 80) return t('classes.bandExcellent', { defaultValue: '優' })
  if (pct >= 65) return t('classes.bandGood', { defaultValue: '良' })
  if (pct >= 50) return t('classes.bandPass', { defaultValue: '及格' })
  return t('classes.bandWeak', { defaultValue: '待加強' })
}

// ============================================================
//  班別新增 / 編輯（名稱、科目、班主任、課室、學年、色）
// ============================================================
function ClassEditor({
  klass,
  onClose,
  onSaved,
  onDelete,
}: {
  klass?: Klass
  onClose: () => void
  onSaved: (id: string) => void
  onDelete?: () => void
}) {
  const toast = useToast()
  const { t } = useTranslation()
  const classMetas = useCollection(classMetaCol)
  const existing = klass ? classMetaFor(klass.id, classMetas) : null

  const [name, setName] = useState(klass?.name ?? '')
  const [subject, setSubject] = useState(klass?.subject ?? '')
  const [formTeacher, setFormTeacher] = useState(existing?.formTeacher ?? '')
  const [room, setRoom] = useState(existing?.room ?? '')
  const [term, setTerm] = useState(existing?.term ?? defaultTerm())
  const [color, setColor] = useState<ClassTone>(existing?.color ?? 'accent')

  const save = () => {
    if (!name.trim()) {
      toast.error(t('classes.errClassNameRequired', { defaultValue: '請輸入班別名稱' }))
      return
    }
    let id = klass?.id
    if (klass) {
      classesCol.update(klass.id, {
        name: name.trim(),
        subject: subject.trim() || klass.subject,
      })
    } else {
      const created = classesCol.add({
        name: name.trim(),
        subject: subject.trim() || 'BAFS（商業管理）',
      })
      id = created.id
    }
    if (!id) return
    const patch: Omit<ClassMeta, 'id'> = {
      classId: id,
      formTeacher: formTeacher.trim() || undefined,
      room: room.trim() || undefined,
      term: term.trim() || undefined,
      color,
      seatCols: existing?.seatCols ?? 6,
      updatedAt: new Date().toISOString(),
    }
    const cm = classMetas.find((x) => x.classId === id)
    if (cm) classMetaCol.update(cm.id, patch)
    else classMetaCol.add(patch)
    toast.success(
      klass
        ? t('classes.classUpdated', { defaultValue: '已更新班別' })
        : t('classes.classCreated', { defaultValue: '已新增班別' }),
    )
    onSaved(id)
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={klass ? t('classes.editorEditTitle', { defaultValue: '班別設定' }) : t('classes.editorAddTitle', { defaultValue: '新增班別' })}
      footer={
        <>
          {klass && onDelete && (
            <Button variant="danger" icon={Trash2} onClick={onDelete}>
              {t('classes.delete', { defaultValue: '刪除' })}
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="secondary" onClick={onClose}>
            {t('classes.cancel', { defaultValue: '取消' })}
          </Button>
          <Button icon={Plus} onClick={save}>
            {klass ? t('classes.save', { defaultValue: '儲存' }) : t('classes.create', { defaultValue: '新增' })}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label={t('classes.fieldClass', { defaultValue: '班別' })} required hint={t('classes.fieldClassHint', { defaultValue: '例如 5A' })}>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="5A"
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label={t('classes.fieldSubject', { defaultValue: '科目 / 組別' })}>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="BAFS（商業管理）"
              />
            </Field>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('classes.fieldFormTeacher', { defaultValue: '班主任' })}>
            <Input value={formTeacher} onChange={(e) => setFormTeacher(e.target.value)} />
          </Field>
          <Field label={t('classes.fieldRoom', { defaultValue: '課室' })}>
            <Input value={room} onChange={(e) => setRoom(e.target.value)} placeholder={t('classes.roomPlaceholder', { defaultValue: '例如 301' })} />
          </Field>
        </div>
        <Field label={t('classes.fieldYear', { defaultValue: '學年' })}>
          <Select value={term} onChange={(e) => setTerm(e.target.value)}>
            {termOptions().map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('classes.fieldColor', { defaultValue: '班別顏色' })} hint={t('classes.fieldColorHint', { defaultValue: '用喺名冊色標、各班人數圖。' })}>
          <div className="flex flex-wrap gap-2">
            {CLASS_TONES.map((tone) => (
              <button
                key={tone.id}
                type="button"
                onClick={() => setColor(tone.id)}
                className={cx(
                  'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition',
                  color === tone.id
                    ? 'border-accent bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
                )}
              >
                <span className={cx('h-3 w-3 rounded-full', tone.dot)} />
                {tone.label}
              </button>
            ))}
          </div>
        </Field>
      </div>
    </Modal>
  )
}

// 學年選項（當前 ± 1 年）
function defaultTerm(): string {
  const now = new Date()
  const y = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1
  return `${y}–${String((y + 1) % 100).padStart(2, '0')}`
}
function termOptions(): string[] {
  const now = new Date()
  const base = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1
  return [base - 1, base, base + 1].map(
    (y) => `${y}–${String((y + 1) % 100).padStart(2, '0')}`,
  )
}
