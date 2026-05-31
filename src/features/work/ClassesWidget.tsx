import { useMemo, useState } from 'react'
import {
  ArrowLeft,
  ClipboardList,
  Download,
  GraduationCap,
  LayoutGrid,
  ListChecks,
  Pencil,
  Plus,
  Search,
  Settings2,
  School,
  Trash2,
  Upload,
  UserPlus,
  Users,
} from 'lucide-react'
import { useCollection } from '../../lib/store'
import { classesCol, studentsCol } from '../../data/collections'
import type { Klass, Student } from '../../data/types'
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
  PageHeader,
  Pills,
  Select,
  StatCard,
  Table,
  Tabs,
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
  classMetaFor,
  classSizes,
  completenessOf,
  demographicsOf,
  downloadCsv,
  initials,
  metaFor,
  parseBulk,
  sortStudents,
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

  return (
    <div className="space-y-5">
      <PageHeader
        title="班別管理"
        description="你任教嘅班別同學生名冊 — 班情、座位、檔案一覽。"
        icon={School}
        actions={
          <Button icon={Plus} onClick={() => setShowAddClass(true)}>
            新增班別
          </Button>
        }
      />

      <Tabs
        tabs={[
          { id: 'overview', label: '總覽' },
          { id: 'classes', label: '班別' },
        ]}
        active={view}
        onChange={setView}
        icons={{ overview: LayoutGrid, classes: Users }}
      />

      {view === 'overview' ? (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="班別總數"
              value={classes.length}
              unit="班"
              icon={School}
              highlight
            />
            <StatCard
              label="學生總數"
              value={students.length}
              unit="位"
              icon={Users}
            />
            <StatCard
              label="在學學生"
              value={activeCount}
              unit="位"
              icon={GraduationCap}
              hint={
                students.length
                  ? `${students.length - activeCount} 位已轉班／離校`
                  : undefined
              }
            />
            <StatCard
              label="平均班額"
              value={
                classes.length
                  ? Math.round(students.length / classes.length)
                  : 0
              }
              unit="人"
              icon={ListChecks}
            />
          </div>

          {classes.length === 0 ? (
            <EmptyState
              icon={School}
              title="仲未有班別"
              hint="新增第一個班別，成績、出席、進度等功能都會用到同一批班別。"
              action={
                <Button icon={Plus} onClick={() => setShowAddClass(true)}>
                  新增班別
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card padded>
                <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  <Users size={14} />
                  各班人數
                </div>
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
                <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  <GraduationCap size={14} />
                  全校學生概況
                </div>
                {students.length === 0 ? (
                  <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">
                    仲未有學生資料
                  </p>
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
                          名冊完整度
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
        icon={School}
        title="仲未有班別"
        hint="新增一個班別開始建立名冊。"
        action={
          <Button icon={Plus} onClick={onAdd}>
            新增班別
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
          <Card key={c.id} hover padded className="group" onClick={() => onOpen(c.id)}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span
                  className={cx(
                    'h-9 w-1.5 rounded-full',
                    TONE_BG[cm.color],
                  )}
                />
                <div>
                  <p className="text-lg font-bold leading-tight text-slate-800 dark:text-slate-100">
                    {c.name}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {c.subject}
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
                      label: '開啟名冊',
                      icon: Users,
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

            {cm.formTeacher || cm.room || cm.term ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {cm.formTeacher && <Badge tone="slate">班主任 {cm.formTeacher}</Badge>}
                {cm.room && <Badge tone="slate">{cm.room}</Badge>}
                {cm.term && <Badge tone="slate">{cm.term}</Badge>}
              </div>
            ) : null}

            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                {roster.length}
                <span className="ml-1 text-xs font-normal text-slate-400">
                  位學生
                </span>
              </span>
              <span className="text-xs tabular-nums text-slate-400">
                男 {d.gender.M} · 女 {d.gender.F}
              </span>
            </div>
            <div className="mt-2">
              <GenderStrip m={d.gender.M} f={d.gender.F} x={d.gender.X + d.genderUnknown} />
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500">
              <span>資料完整度</span>
              <span className="tabular-nums">{comp.pct}%</span>
            </div>
          </Card>
        )
      })}
    </div>
  )
}

const TONE_BG: Record<ClassTone, string> = {
  accent: 'bg-accent',
  blue: 'bg-blue-500',
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
  slate: 'bg-slate-400',
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
      <PageHeader
        title={klass.name}
        description={klass.subject}
        icon={School}
        breadcrumb={
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-1 rounded"
          >
            <ArrowLeft size={13} /> 全部班別
          </button>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" icon={Pencil} onClick={() => setShowEdit(true)}>
              班別設定
            </Button>
          </div>
        }
      />

      {(cm.formTeacher || cm.room || cm.term) && (
        <div className="flex flex-wrap gap-2">
          {cm.formTeacher && <Badge tone="accent">班主任 {cm.formTeacher}</Badge>}
          {cm.room && <Badge tone="slate">課室 {cm.room}</Badge>}
          {cm.term && <Badge tone="slate">學年 {cm.term}</Badge>}
          <Badge tone={cm.color} dot>
            {CLASS_TONES.find((t) => t.id === cm.color)?.label ?? cm.color}
          </Badge>
        </div>
      )}

      <Tabs
        tabs={[
          { id: 'roster', label: '名冊' },
          { id: 'seating', label: '座位 / 工具' },
          { id: 'analytics', label: '班情分析' },
        ]}
        active={tab}
        onChange={setTab}
        icons={{ roster: Users, seating: LayoutGrid, analytics: ClipboardList }}
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
      {tab === 'analytics' && <Analytics roster={roster} metas={studentMetas} />}

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
    downloadCsv(`${klass.name}_名冊.csv`, rows)
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
          icon={Users}
          title="班入面仲未有學生"
          hint="逐個加，或者用「批量貼上」一次過貼一整班名單。"
          action={
            <div className="flex gap-2">
              <Button icon={UserPlus} onClick={() => setShowAdd(true)}>
                加學生
              </Button>
              <Button variant="secondary" icon={Upload} onClick={() => setShowBulk(true)}>
                批量貼上
              </Button>
            </div>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Search} title="冇符合條件嘅學生" hint="試下清除搜尋或篩選。" />
      ) : (
        <Table>
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
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent-strong dark:bg-accent/15 dark:text-accent">
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
          <div className="flex gap-2">
            {(['M', 'F', 'X'] as Gender[]).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGender(gender === g ? '' : g)}
                className={cx(
                  'flex-1 rounded-lg border px-3 py-1.5 text-sm font-medium transition',
                  gender === g
                    ? 'border-accent bg-accent text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
                )}
              >
                {GENDER_META[g].label}
              </button>
            ))}
          </div>
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
}: {
  roster: Student[]
  metas: StudentMeta[]
}) {
  const demo = useMemo(() => demographicsOf(roster, metas), [roster, metas])
  const comp = useMemo(() => completenessOf(roster, metas), [roster, metas])

  if (roster.length === 0)
    return (
      <EmptyState
        icon={ClipboardList}
        title="未有學生資料"
        hint="加入學生並填寫性別 / 班社後，呢度會即時生成班情圖表。"
      />
    )

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card padded>
        <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          性別分布
        </div>
        <Donut
          segments={genderSegments(demo)}
          centerValue={String(roster.length)}
          centerLabel="位學生"
        />
      </Card>

      <Card padded>
        <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          就讀狀態
        </div>
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
        <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          班社 / House 分布
        </div>
        <BarList
          items={demo.house.map((h) => ({ label: h.name, value: h.count }))}
          emptyHint="仲未有學生填寫班社"
        />
      </Card>

      <Card padded>
        <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          名冊資料完整度
        </div>
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
                placeholder="BAFS（商業管理）"
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
        <Field label="班別顏色" hint="用喺名冊色標、各班人數圖。">
          <div className="flex flex-wrap gap-2">
            {CLASS_TONES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setColor(t.id)}
                className={cx(
                  'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition',
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
