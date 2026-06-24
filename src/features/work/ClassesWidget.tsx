import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  FileSpreadsheet,
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
  FeatureGuide,
  Field,
  IconButton,
  Input,
  Menu,
  Modal,
  OptionButtons,
  PageHero,
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
import type { FeatureGuideStep } from '../../ui'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import { useSubjectLabel } from '../../context/SettingsContext'
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
import StudentImport from './classes/StudentImport'
import SeatingChart, { seatLabel } from './classes/SeatingChart'
import StudentProfile from './classes/StudentProfile'

// ============================================================
//  班別管理（班級學生名單 / SIS）
//  ------------------------------------------------------------
//  Canonical 參考：PowerSchool / SEEMIS / Google Classroom 學生名單。
//  共用 classesCol / studentsCol（唔改），擴充屬性放自家
//  studentMetaCol / classMetaCol。深度功能：
//   · 總覽儀表（班級規模圖 + 全校統計）
//   · 班別卡（色標、班主任、課室、性別比例條、名單完整度）
//   · 班別詳情多分頁：名單（搜尋/篩選/排序/批量貼上/CSV）、
//     座位表 + 隨機分組 + 抽點名、班情分析（性別/班社/狀態圖表）
//   · 學生檔案抽屜：完整 metadata + 跨功能 360° 概覽（唯讀）
// ============================================================

type View = 'overview' | 'classes'

// 功能教學引導步驟（defaultValue 廣東話，唔改 i18n 檔）
const CLASSES_GUIDE: FeatureGuideStep[] = [
  {
    title: '開立班別',
    desc: '撳「新增班別」，填班名、科目同班主任；呢批班別會畀成績、出席、進度等功能共用。',
  },
  {
    title: '加入學生',
    desc: '翻開班別嘅「學生名單」，逐位加，或者用「批量貼上」一次過貼成班名單入冊。',
  },
  {
    title: '排座位 / 抽點名',
    desc: '喺「座位 / 工具」拖位、隨機分組或抽人答問，課室即用。',
  },
  {
    title: '睇班情分析',
    desc: '「班情分析」自動彙整性別、班社同成績／出席，一眼睇晒成班狀況。',
  },
]

export default function ClassesWidget() {
  const { t } = useTranslation()
  const classes = useCollection(classesCol)
  const students = useCollection(studentsCol)
  const studentMetas = useCollection(studentMetaCol)
  const classMetas = useCollection(classMetaCol)
  const toast = useToast()
  const confirm = useConfirm()

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
      title: '刪除班別？',
      message:
        count > 0
          ? `「${k.name}」連同名下 ${count} 位學生將會一併刪除，呢個動作無法復原。`
          : `「${k.name}」將會被永久刪除。`,
      confirmText: '刪除',
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
    toast.success('已刪除班別')
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
      {/* ───────── 頁首：共用 PageHero（accent hero）───────── */}
      <PageHero
        guideKey="classes"
        icon={BookUser}
        kicker={t('classes.kicker', { defaultValue: 'Classes' })}
        title={t('classes.title', { defaultValue: '班別管理' })}
        description={t('classes.subtitle', {
          defaultValue: `掌管 ${classes.length} 班 · 點名 ${students.length} 位學生 · ${termLabel}`,
        })}
        actions={
          <button
            type="button"
            onClick={() => setShowAddClass(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-1.5 text-sm font-medium backdrop-blur-sm transition hover:bg-white/25"
          >
            <Plus size={15} /> {t('classes.add', { defaultValue: '新增班別' })}
          </button>
        }
        tabs={
          <>
            <button
              type="button"
              onClick={() => setView('overview')}
              className={cx(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition',
                view === 'overview'
                  ? 'bg-white text-accent-strong'
                  : 'bg-white/15 font-medium text-white hover:bg-white/25',
              )}
            >
              <LayoutGrid size={13} /> {t('classes.tab.overview', { defaultValue: '總覽' })}
            </button>
            <button
              type="button"
              onClick={() => setView('classes')}
              className={cx(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition',
                view === 'classes'
                  ? 'bg-white text-accent-strong'
                  : 'bg-white/15 font-medium text-white hover:bg-white/25',
              )}
            >
              <Users size={13} /> {t('classes.tab.classes', { defaultValue: '班別' })}
            </button>
          </>
        }
      />

      {/* 功能教學引導（可摺疊 + 可永久收起） */}
      <FeatureGuide
        storageKey="classes"
        title={t('classes.guide.title', { defaultValue: '班別管理點用？' })}
        steps={CLASSES_GUIDE}
      />

      {/* ───────── KPI 統計帶：標準 Bento 磚 ───────── */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="在冊班別" value={classes.length} unit="班" icon={School} tone="accent" hint="任教班級" />
        <StatTile label="學生人數" value={students.length} unit="位" icon={Users} tone="sky" hint="全部名單合計" />
        <StatTile
          label="在學人數"
          value={activeCount}
          unit="位"
          icon={GraduationCap}
          tone="emerald"
          hint={students.length ? `${students.length - activeCount} 位已轉班／離校` : '尚無學生'}
        />
        <StatTile label="平均班額" value={avgClassSize} unit="人" icon={ListChecks} tone="violet" hint="每班學生數" />
      </section>

      {view === 'overview' ? (
        <div className="space-y-5">
          {classes.length === 0 ? (
            <EmptyState
              icon={BookUser}
              art="empty-classes"
              title="班務冊仲係空白一頁"
              hint="開立第一班，成績、出席、進度等功能就會共用呢批班別名單。"
              action={
                <Button icon={Plus} onClick={() => setShowAddClass(true)}>
                  開立第一班
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card padded>
                <ChartHead icon={Users}>各班點名人數</ChartHead>
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
                <ChartHead icon={GraduationCap}>全校學生概況</ChartHead>
                {students.length === 0 ? (
                  <div className="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
                      <UserPlus size={22} />
                    </span>
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                      {t('classes.overview.noStudents', { defaultValue: '仲未有學生資料' })}
                    </p>
                    <p className="max-w-xs text-xs text-slate-400 dark:text-slate-500">
                      {t('classes.overview.noStudentsHint', {
                        defaultValue: '翻開一班、加入學生後，呢度就會即時顯示性別比例同名單完整度。',
                      })}
                    </p>
                    <button
                      type="button"
                      onClick={() => setView('classes')}
                      className="text-xs font-medium text-accent transition hover:text-accent-strong active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                    >
                      {t('classes.overview.goClasses', { defaultValue: '去班別加學生 →' })}
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-5">
                    <Donut
                      segments={genderSegments(demo)}
                      centerValue={String(students.length)}
                      centerLabel="位學生"
                    />
                    <div className="flex items-center gap-3">
                      <ProgressRing
                        pct={overallCompleteness.pct}
                        tone="accent"
                        label="完整度"
                      />
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        <p className="font-medium text-slate-600 dark:text-slate-300">
                          名單完整度
                        </p>
                        <p className="mt-0.5 tabular-nums">
                          缺學號 {overallCompleteness.missing.studentNo}
                        </p>
                        <p className="tabular-nums">
                          缺性別 {overallCompleteness.missing.gender}
                        </p>
                        <p className="tabular-nums">
                          缺聯絡 {overallCompleteness.missing.guardian}
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

// ───────── 統計磚（標準 dashboard StatTile：純展示，唔可點）─────────
type StatTone = 'accent' | 'sky' | 'emerald' | 'violet' | 'amber' | 'rose'

const STAT_TONE: Record<StatTone, { chip: string; val: string }> = {
  accent: { chip: 'bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent', val: 'text-accent' },
  sky: { chip: 'bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300', val: 'text-sky-500' },
  emerald: { chip: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300', val: 'text-emerald-500' },
  violet: { chip: 'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300', val: 'text-violet-500' },
  amber: { chip: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300', val: 'text-amber-500' },
  rose: { chip: 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300', val: 'text-rose-500' },
}

function StatTile({
  label,
  value,
  unit,
  hint,
  icon: Icon,
  tone,
}: {
  label: string
  value: number | string
  unit?: string
  hint?: string
  icon: LucideIcon
  tone: StatTone
}) {
  const tn = STAT_TONE[tone]
  return (
    <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-700/60 dark:bg-slate-800">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-slate-400 dark:text-slate-500">{label}</span>
        <span className={cx('flex h-8 w-8 shrink-0 items-center justify-center rounded-xl', tn.chip)}>
          <Icon size={16} />
        </span>
      </div>
      <div className="mt-3">
        <p className="flex items-baseline gap-1">
          <span className={cx('text-3xl font-semibold tabular-nums slashed-zero', tn.val)}>{value}</span>
          {unit && <span className="text-sm font-medium text-slate-400">{unit}</span>}
        </p>
        {hint && (
          <p className="mt-0.5 truncate text-[11px] text-slate-400 dark:text-slate-500">{hint}</p>
        )}
      </div>
    </div>
  )
}

// ───────── 性別環形 segments ─────────
function genderSegments(demo: {
  gender: Record<Gender, number>
  genderUnknown: number
}): DonutSeg[] {
  const segs: DonutSeg[] = [
    { value: demo.gender.M, tone: 'blue', label: '男' },
    { value: demo.gender.F, tone: 'rose', label: '女' },
  ]
  if (demo.gender.X > 0) segs.push({ value: demo.gender.X, tone: 'slate', label: '其他' })
  if (demo.genderUnknown > 0)
    segs.push({ value: demo.genderUnknown, tone: 'slate', label: '未填' })
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
  if (classes.length === 0)
    return (
      <EmptyState
        icon={BookUser}
        art="empty-classes"
        title="班務冊仲係空白一頁"
        hint="開立一班，就可以喺度建立佢嘅學生名單、座位表同班情分析。"
        action={
          <Button icon={Plus} onClick={onAdd}>
            開立第一班
          </Button>
        }
      />
    )

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {classes.map((c) => {
        const roster = students.filter((s) => s.classId === c.id)
        const cm = classMetaFor(c.id, classMetas)
        const d = demographicsOf(roster, studentMetas)
        const comp = completenessOf(roster, studentMetas)
        return (
          <Card
            key={c.id}
            hover
            className="group relative flex overflow-hidden rounded-2xl p-0"
            onClick={() => onOpen(c.id)}
          >
            {/* 班別色：左側色帶（對應各班人數圖、名單色標）*/}
            <span
              className={cx('w-1.5 shrink-0', TONE_BAR[cm.color])}
              aria-hidden
            />
            <div className="min-w-0 flex-1 p-4">
              {/* 班牌頭：色標 chip + 班名 + 科目 */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={cx(
                      'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-base font-semibold leading-none',
                      TONE_CHIP[cm.color],
                    )}
                    aria-hidden
                  >
                    {classBadge(c.name)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold leading-tight text-slate-800 dark:text-slate-100">
                      {c.name}
                    </p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {c.subject || '未填科目'}
                    </p>
                  </div>
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  <Menu
                    align="end"
                    trigger={
                      <IconButton label="班別選項" size="sm">
                        <Settings2 size={16} />
                      </IconButton>
                    }
                    items={[
                      {
                        id: 'open',
                        label: '翻開名單',
                        icon: BookUser,
                        onSelect: () => onOpen(c.id),
                      },
                      {
                        id: 'del',
                        label: '刪除班別',
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

              {/* 點名人數：主數字 */}
              <div className="mt-4 flex items-end justify-between">
                <span className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-semibold tabular-nums slashed-zero text-slate-800 dark:text-slate-100">
                    {roster.length}
                  </span>
                  <span className="text-sm font-medium text-slate-400">位學生</span>
                </span>
                {roster.length > 0 && (
                  <span className="text-[11px] tabular-nums text-slate-400">
                    男 {d.gender.M} · 女 {d.gender.F}
                    {d.gender.X + d.genderUnknown > 0 && ` · 其他 ${d.gender.X + d.genderUnknown}`}
                  </span>
                )}
              </div>
              <div className="mt-2">
                <GenderStrip m={d.gender.M} f={d.gender.F} x={d.gender.X + d.genderUnknown} />
              </div>

              {/* 底線 + 翻開提示 */}
              <div className="mt-3.5 flex items-center justify-between border-t border-slate-200/80 pt-3 text-[11px] dark:border-slate-700/60">
                <span className="inline-flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
                  <ListChecks size={12} />
                  名單完整度
                  <span className={cx('font-semibold tabular-nums', compTextTone(comp.pct))}>
                    {comp.pct}%
                  </span>
                </span>
                <span className="inline-flex items-center gap-0.5 font-medium text-slate-400 transition-colors group-hover:text-accent dark:text-slate-500">
                  翻開名單
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
      {/* ───────── 班別詳情 masthead（色帶 + 班名 + 卷務行，統一 rounded-2xl）───────── */}
      <header className="relative flex overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-slate-700/60 dark:bg-slate-800">
        {/* 班別色帶（同班牌卡呼應）*/}
        <span className={cx('w-1.5 shrink-0', TONE_BAR[cm.color])} aria-hidden />
        <div className="min-w-0 flex-1 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
            <div className="min-w-0">
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-1 rounded text-xs font-medium text-slate-400 transition active:scale-[0.98] hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-1 dark:text-slate-500"
              >
                <ArrowLeft size={13} /> 全部班別
              </button>
              <div className="mt-1.5 flex items-center gap-3">
                <span
                  className={cx(
                    'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-base font-semibold leading-none',
                    TONE_CHIP[cm.color],
                  )}
                  aria-hidden
                >
                  {classBadge(klass.name)}
                </span>
                <div className="min-w-0">
                  <h1 className="truncate text-2xl font-semibold tracking-tight text-slate-800 dark:text-slate-100">
                    {klass.name}
                  </h1>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-slate-500 dark:text-slate-400">
                    <span className="truncate">{klass.subject || '未填科目'}</span>
                    <span aria-hidden className="text-slate-300 dark:text-slate-600">·</span>
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <Users size={12} /> {roster.length} 位學生
                    </span>
                  </p>
                </div>
              </div>
            </div>
            <Button variant="secondary" icon={Pencil} onClick={() => setShowEdit(true)}>
              班別設定
            </Button>
          </div>

          {(cm.formTeacher || cm.room || cm.term) && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {cm.formTeacher && (
                <Badge tone="accent" icon={UserRound}>
                  班主任 {cm.formTeacher}
                </Badge>
              )}
              {cm.room && (
                <Badge tone="slate" icon={DoorOpen}>
                  課室 {cm.room}
                </Badge>
              )}
              {cm.term && (
                <Badge tone="slate" icon={CalendarCheck}>
                  {cm.term} 學年
                </Badge>
              )}
              <Badge tone={cm.color} dot>
                {CLASS_TONES.find((t) => t.id === cm.color)?.label ?? cm.color}牌
              </Badge>
            </div>
          )}
        </div>
      </header>

      <SegmentedControl<DetailTab>
        value={tab}
        onChange={setTab}
        options={[
          { id: 'roster', label: '學生名單', icon: BookUser },
          { id: 'seating', label: '座位 / 工具', icon: LayoutGrid },
          { id: 'analytics', label: '班情分析', icon: ClipboardList },
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

// ───────── 名單（搜尋 / 篩選 / 排序 / 批量 / CSV）─────────
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
  const [q, setQ] = useState('')
  const [statusF, setStatusF] = useState<StatusFilter>('all')
  const [showAdd, setShowAdd] = useState(false)
  const [showBulk, setShowBulk] = useState(false)
  const [showExcel, setShowExcel] = useState(false)
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
      ['學號', '姓名', '性別', '班社', '職務', '監護人', '電話', '電郵', '狀態', '座位', '標籤'],
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
    downloadCsv(`${klass.name}_名單.csv`, rows)
    toast.success('已匯出 CSV')
  }

  const profileStudent = roster.find((s) => s.id === profileId) ?? null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          icon={Search}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜尋姓名 / 學號 / 班社 / 標籤"
          className="min-w-[12rem] flex-1"
        />
        <Button icon={UserPlus} onClick={() => setShowAdd(true)}>
          加學生
        </Button>
        <Menu
          align="end"
          trigger={
            <Button variant="secondary" icon={Settings2}>
              更多
            </Button>
          }
          items={[
            {
              id: 'bulk',
              label: '批量貼上加入',
              icon: Upload,
              onSelect: () => setShowBulk(true),
            },
            {
              id: 'excel',
              label: 'Excel 範本 / 匯入',
              icon: FileSpreadsheet,
              onSelect: () => setShowExcel(true),
            },
            {
              id: 'csv',
              label: '匯出 CSV',
              icon: Download,
              onSelect: exportCsv,
              disabled: roster.length === 0,
            },
          ]}
        />
      </div>

      <Pills
        options={[
          { id: 'all', label: '全部' },
          { id: 'active', label: '在學' },
          { id: 'transferred', label: '已轉班' },
          { id: 'withdrawn', label: '已離校' },
        ]}
        active={statusF}
        onChange={(id) => setStatusF(id as StatusFilter)}
        size="sm"
        counts={statusCounts}
      />

      {roster.length === 0 ? (
        <EmptyState
          icon={BookUser}
          title="學生名單仲係吉嘅"
          hint="逐位點名加入，或者用「批量貼上」一次過貼一整班名單入冊。"
          action={
            <div className="flex gap-2">
              <Button icon={UserPlus} onClick={() => setShowAdd(true)}>
                加學生
              </Button>
              <Button variant="secondary" icon={Upload} onClick={() => setShowBulk(true)}>
                批量貼上
              </Button>
              <Button variant="secondary" icon={FileSpreadsheet} onClick={() => setShowExcel(true)}>
                Excel 匯入
              </Button>
            </div>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Search} title="學生名單搵唔到呢位" hint="試下清除搜尋或篩選，再翻查名單。" />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-700/60">
          {/* 學生名單冊頁標頭 */}
          <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 bg-slate-50/80 px-3.5 py-2 dark:border-slate-700/60 dark:bg-slate-800/60">
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
              <BookUser size={14} className="text-accent" />
              學生名單 · Roster
            </span>
            <span className="text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
              撳一行睇學生檔案
            </span>
          </div>
          <Table className="rounded-none border-0">
          <Thead>
            <Tr>
              <Th className="w-16">學號</Th>
              <Th>姓名</Th>
              <Th>班社 / 職務</Th>
              <Th align="center">性別</Th>
              <Th align="center">座位</Th>
              <Th align="center">狀態</Th>
            </Tr>
          </Thead>
          <Tbody>
            {filtered.map((s) => {
              const m = metaFor(s.id, metas)
              return (
                <Tr key={s.id} onClick={() => setProfileId(s.id)}>
                  <Td numeric className="text-slate-400">
                    {s.studentNo || '—'}
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent-strong dark:bg-accent/15 dark:text-accent">
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
          顯示 {filtered.length} / {roster.length} 位
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
      {showExcel && (
        <StudentImport
          classId={klass.id}
          className={klass.name}
          onClose={() => setShowExcel(false)}
        />
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
  const [name, setName] = useState('')
  const [no, setNo] = useState('')
  const [gender, setGender] = useState<Gender | ''>('')
  const [keepOpen, setKeepOpen] = useState(true)

  const save = () => {
    if (!name.trim()) {
      toast.error('請輸入姓名')
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
    toast.success('已加入學生')
    setName('')
    setNo('')
    setGender('')
    if (!keepOpen) onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="加入學生"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            完成
          </Button>
          <Button icon={Plus} onClick={save}>
            加入
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="學號">
            <Input
              value={no}
              onChange={(e) => setNo(e.target.value)}
              className="tabular-nums"
              placeholder="12"
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="姓名" required>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && save()}
                placeholder="陳大文"
              />
            </Field>
          </div>
        </div>
        <Field label="性別">
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
          加入後繼續輸入下一位（連續加入）
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
  const [text, setText] = useState('')
  const parsed = useMemo(() => parseBulk(text), [text])

  const importAll = () => {
    if (parsed.length === 0) {
      toast.error('未有可匯入嘅資料')
      return
    }
    parsed.forEach((r) =>
      studentsCol.add({
        classId,
        name: r.name,
        studentNo: r.studentNo,
      }),
    )
    toast.success(`已加入 ${parsed.length} 位學生`)
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="批量貼上加入"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button icon={Upload} onClick={importAll} disabled={parsed.length === 0}>
            匯入 {parsed.length} 位
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field
          label="貼上名單"
          hint="每行一位。支援「學號 姓名」或淨係姓名；用 Tab / 逗號 / 空格分隔。"
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
              預覽（{parsed.length} 位）
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
        title="未有學生，畫唔到班情"
        hint="喺學生名單加入學生並填寫性別 / 班社後，呢度會即時生成班情圖表。"
      />
    )

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ClassHealthCard health={health} />

      <Card padded>
        <ChartHead icon={PieChart}>性別分布</ChartHead>
        <Donut
          segments={genderSegments(demo)}
          centerValue={String(roster.length)}
          centerLabel="位學生"
        />
      </Card>

      <Card padded>
        <ChartHead icon={Activity}>就讀狀態</ChartHead>
        <Donut
          segments={[
            { value: demo.status.active, tone: 'green', label: '在學' },
            { value: demo.status.transferred, tone: 'amber', label: '已轉班' },
            { value: demo.status.withdrawn, tone: 'slate', label: '已離校' },
          ]}
          centerValue={String(demo.status.active)}
          centerLabel="在學"
        />
      </Card>

      <Card padded>
        <ChartHead icon={Home}>班社 / House 分布</ChartHead>
        <BarList
          items={demo.house.map((h) => ({ label: h.name, value: h.count }))}
          emptyHint="仲未有學生填寫班社"
        />
      </Card>

      <Card padded>
        <ChartHead icon={ListChecks}>名單資料完整度</ChartHead>
        <div className="flex items-center gap-5">
          <ProgressRing pct={comp.pct} tone="accent" label="整體" />
          <BarList
            items={[
              {
                label: '有學號',
                value: comp.total - comp.missing.studentNo,
                tone: 'accent',
              },
              {
                label: '有性別',
                value: comp.total - comp.missing.gender,
                tone: 'blue',
              },
              {
                label: '有聯絡',
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
      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
        {children}
      </span>
    </div>
  )
}

// ───────── 班情健康摘要卡（跨功能：成績 + 出席 + 需關注）─────────
function ClassHealthCard({ health }: { health: ClassAcademicSummary }) {
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
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          班情健康
        </span>
        <span className="ml-auto text-[10px] font-normal text-slate-400 dark:text-slate-500">
          綜合成績 / 出席（唯讀）
        </span>
      </div>

      {noData ? (
        <p className="py-4 text-center text-sm text-slate-400 dark:text-slate-500">
          仲未有成績或出席紀錄。喺「成績」同「點名」功能輸入後，呢度會自動彙整班情。
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          {/* 班平均分 */}
          <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <GraduationCap size={13} className="text-slate-400" />
              班平均分
            </div>
            <p className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                {health.avgGradePct == null ? '—' : `${health.avgGradePct}%`}
              </span>
              {health.avgGradePct != null && (
                <Badge tone={pctTone(health.avgGradePct)} dot>
                  {gradeBandLabel(health.avgGradePct)}
                </Badge>
              )}
            </p>
            <p className="mt-0.5 text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
              {health.gradedStudents}/{health.total} 位已有成績
            </p>
          </div>

          {/* 班出席率 */}
          <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <CalendarCheck size={13} className="text-slate-400" />
              班出席率
            </div>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-800 dark:text-slate-100">
              {health.attendanceRate == null ? '—' : `${health.attendanceRate}%`}
            </p>
            {health.attendanceRate != null ? (
              <div className="mt-1.5">
                <ProgressBar value={health.attendanceRate} tone={attTone} size="sm" />
              </div>
            ) : (
              <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
                未有點名紀錄
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
              需關注
            </div>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-800 dark:text-slate-100">
              {health.atRiskCount}
              <span className="ml-1 text-xs font-normal text-slate-400">位</span>
            </p>
            <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
              成績 &lt;50% 或出席 &lt;80%
            </p>
          </div>
        </div>
      )}
    </Card>
  )
}

function gradeBandLabel(pct: number): string {
  if (pct >= 80) return '優'
  if (pct >= 65) return '良'
  if (pct >= 50) return '及格'
  return '待加強'
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
  const classMetas = useCollection(classMetaCol)
  const existing = klass ? classMetaFor(klass.id, classMetas) : null

  const [name, setName] = useState(klass?.name ?? '')
  const [subject, setSubject] = useState(klass?.subject ?? '')
  const subj = useSubjectLabel()
  const [formTeacher, setFormTeacher] = useState(existing?.formTeacher ?? '')
  const [room, setRoom] = useState(existing?.room ?? '')
  const [term, setTerm] = useState(existing?.term ?? defaultTerm())
  const [color, setColor] = useState<ClassTone>(existing?.color ?? 'accent')

  const save = () => {
    if (!name.trim()) {
      toast.error('請輸入班別名稱')
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
        subject: subject.trim() || (subj.chosen ? subj.name : ''),
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
    toast.success(klass ? '已更新班別' : '已新增班別')
    onSaved(id)
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={klass ? '班別設定' : '新增班別'}
      footer={
        <>
          {klass && onDelete && (
            <Button variant="danger" icon={Trash2} onClick={onDelete}>
              刪除
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button icon={Plus} onClick={save}>
            {klass ? '儲存' : '新增'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="班別" required hint="例如 5A">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="5A"
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="科目 / 組別">
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={subj.chosen ? subj.name : '科目 / 組別（選填）'}
              />
            </Field>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="班主任">
            <Input value={formTeacher} onChange={(e) => setFormTeacher(e.target.value)} />
          </Field>
          <Field label="課室">
            <Input value={room} onChange={(e) => setRoom(e.target.value)} placeholder="例如 301" />
          </Field>
        </div>
        <Field label="學年">
          <Select value={term} onChange={(e) => setTerm(e.target.value)}>
            {termOptions().map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="班別顏色" hint="用喺名單色標、各班人數圖。">
          <div className="flex flex-wrap gap-2">
            {CLASS_TONES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setColor(t.id)}
                className={cx(
                  'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition active:scale-[0.98]',
                  color === t.id
                    ? 'border-accent bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
                )}
              >
                <span className={cx('h-3 w-3 rounded-full', t.dot)} />
                {t.label}
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
