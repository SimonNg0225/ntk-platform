import { useMemo, useState } from 'react'
import { createCollection, uid, useCollection } from '../../lib/store'
import { parentCommsCol, classesCol, studentsCol } from '../../data/collections'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  IconButton,
  Input,
  Menu,
  SectionTitle,
  SegmentedControl,
  Select,
  StatCard,
  Table,
  Tabs,
  Tbody,
  Td,
  Th,
  Thead,
  Tooltip,
  Tr,
  cx,
} from '../../ui'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  Bell,
  BookText,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  Clock,
  Contact,
  Download,
  FileText,
  Filter,
  Handshake,
  Hourglass,
  LayoutList,
  Mail,
  MessageCircle,
  MessageSquare,
  Pencil,
  Phone,
  Plus,
  Search,
  Smartphone,
  Trash2,
  TrendingUp,
  Users,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import CommEditor, { type SaveResult } from './parentComms/CommEditor'
import TemplateManager from './parentComms/TemplateManager'
import {
  ChannelDonut,
  CategoryBars,
  MonthlyTrendChart,
  OutcomeBars,
  TopStudentsBars,
} from './parentComms/Charts'
import {
  BUCKET_LABEL,
  BUCKET_TONE,
  BUILTIN_TEMPLATES,
  CATEGORY_LABEL,
  CATEGORY_STYLE,
  DIRECTION_LABEL,
  OUTCOME_LABEL,
  OUTCOME_STYLE,
  buildOverview,
  countByCategory,
  countByChannel,
  countByOutcome,
  downloadCsv,
  followUpBucket,
  longDateLabel,
  monthlyTrend,
  relativeDayLabel,
  shortDateLabel,
  sortRows,
  summarizeByStudent,
  todayKey,
  type Category,
  type CommMeta,
  type CommRow,
  type CommTemplate,
  type FollowUpBucket,
  type SortDir,
  type SortKey,
} from './parentComms/util'

// ============================================================
//  家長 / 學生溝通記錄 — 老師專用「溝通 CRM」
//  ------------------------------------------------------------
//  參考真實 CRM 嘅活動時間線 + 跟進管道（HubSpot / Salesforce），
//  改造成老師對家長 / 學生嘅情境：
//   · 多視圖：時間線 / 表格（批量）/ 學生名冊 / 統計分析
//   · 跟進管道：到期日、逾期偵測、今日 / 本週 / 逾期分桶、一鍵完成
//   · 訊息範本、進階篩選 + 全文搜尋、自製 SVG 圖表、CSV 匯出
//
//  共用 parentCommsCol 維持原欄位（向後相容）；進階 metadata 同範本
//  放喺本功能自己嘅本地集合，完全唔改 data/collections.ts。
// ============================================================

// 本功能專屬本地集合（一對一掛鈎 ParentComm + 範本）
const metaCol = createCollection<CommMeta>('parent_comm_meta', [])
const templatesCol = createCollection<CommTemplate>(
  'parent_comm_templates',
  BUILTIN_TEMPLATES.map((t) => ({
    ...t,
    id: uid(),
    createdAt: new Date().toISOString(),
  })),
)

const CHANNEL_ICON: Record<string, LucideIcon> = {
  電話: Phone,
  電郵: Mail,
  面談: Handshake,
  手冊: BookText,
  訊息: Smartphone,
}

type ViewTab = 'timeline' | 'table' | 'students' | 'analytics'
const TABS: { id: ViewTab; label: string }[] = [
  { id: 'timeline', label: '時間線' },
  { id: 'table', label: '表格' },
  { id: 'students', label: '學生' },
  { id: 'analytics', label: '統計' },
]
const TAB_ICONS: Record<ViewTab, LucideIcon> = {
  timeline: LayoutList,
  table: LayoutList,
  students: Contact,
  analytics: BarChart3,
}

type FollowFilter = 'all' | 'open' | 'overdue' | 'done'

export default function ParentComms() {
  const comms = useCollection(parentCommsCol)
  const metas = useCollection(metaCol)
  const templates = useCollection(templatesCol)
  const classes = useCollection(classesCol)
  const students = useCollection(studentsCol)
  const toast = useToast()
  const confirm = useConfirm()

  const [tab, setTab] = useState<ViewTab>('timeline')

  // 編輯器
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<CommRow | null>(null)
  const [templatesOpen, setTemplatesOpen] = useState(false)

  // 篩選 / 搜尋
  const [query, setQuery] = useState('')
  const [filterClassId, setFilterClassId] = useState('')
  const [filterStudentId, setFilterStudentId] = useState('')
  const [filterChannel, setFilterChannel] = useState('')
  const [filterCategory, setFilterCategory] = useState<Category | ''>('')
  const [followFilter, setFollowFilter] = useState<FollowFilter>('all')
  const [showFilters, setShowFilters] = useState(false)

  // 表格排序 + 批量
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const today = todayKey()

  const classMap = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes])
  const studentMap = useMemo(() => new Map(students.map((s) => [s.id, s])), [students])
  const metaByComm = useMemo(() => {
    const m = new Map<string, CommMeta>()
    for (const meta of metas) m.set(meta.commId, meta)
    return m
  }, [metas])

  // 全部 row（comm + meta）
  const allRows: CommRow[] = useMemo(
    () => comms.map((comm) => ({ comm, meta: metaByComm.get(comm.id) })),
    [comms, metaByComm],
  )

  const nameOf = (r: CommRow) => {
    const cls = classMap.get(r.comm.classId)?.name ?? '未知班別'
    const stu = r.comm.studentId ? studentMap.get(r.comm.studentId)?.name : undefined
    return stu ? `${cls}・${stu}` : cls
  }

  const filterStudents = useMemo(
    () => (filterClassId ? students.filter((s) => s.classId === filterClassId) : []),
    [students, filterClassId],
  )

  // 套用搜尋 + 篩選
  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return allRows.filter(({ comm, meta }) => {
      if (filterClassId && comm.classId !== filterClassId) return false
      if (filterStudentId && comm.studentId !== filterStudentId) return false
      if (filterChannel && comm.channel !== filterChannel) return false
      if (filterCategory && meta?.category !== filterCategory) return false
      if (followFilter === 'open' && !comm.followUp) return false
      if (followFilter === 'done' && comm.followUp) return false
      if (followFilter === 'overdue') {
        if (!comm.followUp || followUpBucket(meta?.followUpDate, today) !== 'overdue')
          return false
      }
      if (q) {
        const hay = [
          comm.summary,
          comm.channel,
          meta?.contactName ?? '',
          meta?.followUpNote ?? '',
          classMap.get(comm.classId)?.name ?? '',
          comm.studentId ? studentMap.get(comm.studentId)?.name ?? '' : '',
          meta?.category ? CATEGORY_LABEL[meta.category] : '',
        ]
          .join(' ')
          .toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [
    allRows,
    query,
    filterClassId,
    filterStudentId,
    filterChannel,
    filterCategory,
    followFilter,
    today,
    classMap,
    studentMap,
  ])

  const overview = useMemo(() => buildOverview(allRows, today), [allRows, today])

  // 跟進管道（未完成）分桶
  const followUps = useMemo(() => {
    const open = allRows.filter((r) => r.comm.followUp)
    const buckets: Record<FollowUpBucket, CommRow[]> = {
      overdue: [],
      today: [],
      soon: [],
      later: [],
      nodate: [],
    }
    for (const r of open) buckets[followUpBucket(r.meta?.followUpDate, today)].push(r)
    const byDate = (a: CommRow, b: CommRow) =>
      (a.meta?.followUpDate ?? 'zzzz').localeCompare(b.meta?.followUpDate ?? 'zzzz')
    for (const k of Object.keys(buckets) as FollowUpBucket[]) buckets[k].sort(byDate)
    return buckets
  }, [allRows, today])

  const activeFilterCount =
    (filterClassId ? 1 : 0) +
    (filterStudentId ? 1 : 0) +
    (filterChannel ? 1 : 0) +
    (filterCategory ? 1 : 0) +
    (followFilter !== 'all' ? 1 : 0)

  // ───────── 寫入：新增 / 更新 ─────────
  const handleSave = (result: SaveResult, editingId: string | null) => {
    if (editingId) {
      parentCommsCol.update(editingId, result.comm)
      writeMeta(editingId, result.meta)
      toast.success('已更新溝通記錄')
    } else {
      const created = parentCommsCol.add(result.comm)
      writeMeta(created.id, result.meta)
      toast.success('已新增溝通記錄')
    }
    setEditorOpen(false)
    setEditing(null)
  }

  const writeMeta = (
    commId: string,
    patch: Omit<CommMeta, 'id' | 'commId' | 'updatedAt'>,
  ) => {
    const existing = metaCol.get().find((m) => m.commId === commId)
    const updatedAt = new Date().toISOString()
    if (existing) metaCol.update(existing.id, { ...patch, updatedAt })
    else metaCol.add({ commId, ...patch, updatedAt })
  }

  const openNew = () => {
    setEditing(null)
    setEditorOpen(true)
  }
  const openEdit = (r: CommRow) => {
    setEditing(r)
    setEditorOpen(true)
  }

  const removeComm = async (r: CommRow) => {
    const ok = await confirm({
      title: '刪除溝通記錄？',
      message: `${nameOf(r)}（${r.comm.date}）嘅記錄將會永久刪除，無法復原。`,
      confirmText: '刪除',
      tone: 'danger',
    })
    if (!ok) return
    parentCommsCol.remove(r.comm.id)
    if (r.meta) metaCol.remove(r.meta.id)
    setSelected((prev) => {
      const next = new Set(prev)
      next.delete(r.comm.id)
      return next
    })
    toast.success('已刪除溝通記錄')
  }

  const toggleFollowUp = (r: CommRow) => {
    const next = !r.comm.followUp
    parentCommsCol.update(r.comm.id, { followUp: next })
    if (next) toast.info('已重新標記為待跟進')
    else toast.success('已標記為已完成')
  }

  // ───────── 範本 ─────────
  const addTemplate = (draft: Omit<CommTemplate, 'id' | 'createdAt' | 'builtIn'>) => {
    templatesCol.add({ ...draft, createdAt: new Date().toISOString() })
    toast.success('已新增範本')
  }
  const updateTemplate = (
    id: string,
    draft: Omit<CommTemplate, 'id' | 'createdAt' | 'builtIn'>,
  ) => {
    templatesCol.update(id, draft)
    toast.success('已更新範本')
  }
  const removeTemplate = async (t: CommTemplate) => {
    const ok = await confirm({
      title: '刪除範本？',
      message: `「${t.title}」會被刪除。`,
      confirmText: '刪除',
      tone: 'danger',
    })
    if (!ok) return
    templatesCol.remove(t.id)
    toast.success('已刪除範本')
  }

  // ───────── 批量（表格） ─────────
  const visibleIds = filteredRows.map((r) => r.comm.id)
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id))
  const toggleSelectAll = () => {
    setSelected((prev) => {
      if (allSelected) {
        const next = new Set(prev)
        visibleIds.forEach((id) => next.delete(id))
        return next
      }
      return new Set([...prev, ...visibleIds])
    })
  }
  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const selectedRows = filteredRows.filter((r) => selected.has(r.comm.id))

  const batchMarkDone = () => {
    let n = 0
    for (const r of selectedRows)
      if (r.comm.followUp) {
        parentCommsCol.update(r.comm.id, { followUp: false })
        n += 1
      }
    setSelected(new Set())
    toast.success(n > 0 ? `已完成 ${n} 項跟進` : '所選記錄冇待跟進')
  }
  const batchDelete = async () => {
    const ok = await confirm({
      title: `刪除 ${selectedRows.length} 條記錄？`,
      message: '呢個動作無法復原。',
      confirmText: '刪除',
      tone: 'danger',
    })
    if (!ok) return
    for (const r of selectedRows) {
      parentCommsCol.remove(r.comm.id)
      if (r.meta) metaCol.remove(r.meta.id)
    }
    setSelected(new Set())
    toast.success('已刪除所選記錄')
  }

  // ───────── CSV 匯出 ─────────
  const exportCsv = (rows: CommRow[]) => {
    if (rows.length === 0) {
      toast.error('冇可匯出嘅記錄')
      return
    }
    const header = [
      '日期',
      '班別',
      '學生',
      '方向',
      '聯絡方式',
      '主題',
      '觀感',
      '聯絡人',
      '內容摘要',
      '需跟進',
      '跟進到期',
      '跟進待辦',
    ]
    const body = sortRows(rows, 'date', 'desc', nameOf).map(({ comm, meta }) => [
      comm.date,
      classMap.get(comm.classId)?.name ?? '',
      comm.studentId ? studentMap.get(comm.studentId)?.name ?? '' : '',
      meta?.direction ? DIRECTION_LABEL[meta.direction] : '主動聯絡',
      comm.channel,
      meta?.category ? CATEGORY_LABEL[meta.category] : '',
      meta?.outcome ? OUTCOME_LABEL[meta.outcome] : '',
      meta?.contactName ?? '',
      comm.summary,
      comm.followUp ? '是' : '否',
      meta?.followUpDate ?? '',
      meta?.followUpNote ?? '',
    ])
    downloadCsv(`家長溝通記錄_${today}.csv`, [header, ...body])
    toast.success(`已匯出 ${rows.length} 條記錄`)
  }

  const clearFilters = () => {
    setFilterClassId('')
    setFilterStudentId('')
    setFilterChannel('')
    setFilterCategory('')
    setFollowFilter('all')
    setQuery('')
  }

  const monthTrendUp =
    overview.lastMonth === 0
      ? overview.thisMonth > 0
      : overview.thisMonth >= overview.lastMonth

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
      {/* 標題 */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 sm:text-2xl">
            家長 / 學生溝通
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            記錄每次聯絡、追蹤跟進事項，掌握每位學生嘅溝通脈絡。
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Menu
            align="end"
            trigger={
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
                更多
                <ChevronDown size={15} />
              </span>
            }
            items={[
              {
                id: 'templates',
                label: '訊息範本',
                icon: FileText,
                onSelect: () => setTemplatesOpen(true),
              },
              {
                id: 'export-filtered',
                label: '匯出目前列表（CSV）',
                icon: Download,
                onSelect: () => exportCsv(filteredRows),
              },
              {
                id: 'export-all',
                label: '匯出全部（CSV）',
                icon: Download,
                onSelect: () => exportCsv(allRows),
              },
            ]}
          />
          <Button onClick={openNew} icon={Plus}>
            新增記錄
          </Button>
        </div>
      </header>

      {/* 統計卡 */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="總記錄" value={overview.total} unit="條" icon={MessageSquare} />
        <StatCard
          label="本月溝通"
          value={overview.thisMonth}
          unit="條"
          icon={TrendingUp}
          trend={{
            value: `上月 ${overview.lastMonth}`,
            dir: monthTrendUp ? 'up' : overview.thisMonth < overview.lastMonth ? 'down' : 'flat',
          }}
        />
        <StatCard
          label="待跟進"
          value={overview.openFollowUps}
          unit="項"
          icon={Hourglass}
          highlight={overview.openFollowUps > 0}
          hint={overview.overdue > 0 ? `${overview.overdue} 項逾期` : '無逾期'}
        />
        <StatCard
          label="正面比例"
          value={overview.positiveRate == null ? '—' : `${overview.positiveRate}%`}
          icon={CheckCheck}
          hint={`已聯絡 ${overview.contactedStudents} 名學生`}
        />
      </section>

      {/* 跟進管道（有未完成先顯示） */}
      {overview.openFollowUps > 0 && <FollowUpPanel
        buckets={followUps}
        nameOf={nameOf}
        today={today}
        onToggle={toggleFollowUp}
        onEdit={openEdit}
      />}

      {/* 視圖切換 */}
      <Tabs tabs={TABS} active={tab} onChange={setTab} icons={TAB_ICONS} />

      {/* 搜尋 + 篩選列（時間線 / 表格 / 學生 共用） */}
      {tab !== 'analytics' && (
        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex-1">
              <Input
                icon={Search}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜尋內容、學生、聯絡人…"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              className={cx(
                'inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
                showFilters || activeFilterCount > 0
                  ? 'border-accent/40 bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
              )}
            >
              <Filter size={15} />
              篩選
              {activeFilterCount > 0 && (
                <span className="ml-0.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold tabular-nums text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {showFilters && (
            <Card className="space-y-3 p-3 sm:p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <LabeledSelect
                  label="班別"
                  value={filterClassId}
                  onChange={(v) => {
                    setFilterClassId(v)
                    setFilterStudentId('')
                  }}
                >
                  <option value="">全部班別</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </LabeledSelect>
                <LabeledSelect
                  label="學生"
                  value={filterStudentId}
                  disabled={!filterClassId}
                  onChange={setFilterStudentId}
                >
                  <option value="">{filterClassId ? '全部學生' : '先揀班別'}</option>
                  {filterStudents.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </LabeledSelect>
                <LabeledSelect
                  label="聯絡方式"
                  value={filterChannel}
                  onChange={setFilterChannel}
                >
                  <option value="">全部方式</option>
                  {Object.keys(CHANNEL_ICON).map((ch) => (
                    <option key={ch} value={ch}>
                      {ch}
                    </option>
                  ))}
                </LabeledSelect>
                <LabeledSelect
                  label="主題"
                  value={filterCategory}
                  onChange={(v) => setFilterCategory(v as Category | '')}
                >
                  <option value="">全部主題</option>
                  {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABEL[c]}
                    </option>
                  ))}
                </LabeledSelect>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    跟進
                  </span>
                  <SegmentedControl<FollowFilter>
                    size="sm"
                    value={followFilter}
                    onChange={setFollowFilter}
                    options={[
                      { id: 'all', label: '全部' },
                      { id: 'open', label: '待跟進' },
                      { id: 'overdue', label: '逾期' },
                      { id: 'done', label: '已完成' },
                    ]}
                  />
                </div>
                {(activeFilterCount > 0 || query) && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="inline-flex items-center gap-1 self-start text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                  >
                    <X size={13} />
                    清除全部篩選
                  </button>
                )}
              </div>
            </Card>
          )}

          <p className="text-xs text-slate-400 dark:text-slate-500">
            顯示 <span className="tabular-nums">{filteredRows.length}</span> / {allRows.length} 條記錄
          </p>
        </div>
      )}

      {/* ───────── 視圖內容 ───────── */}
      {tab === 'timeline' && (
        <TimelineView
          rows={filteredRows}
          totalAll={allRows.length}
          nameOf={nameOf}
          studentMap={studentMap}
          today={today}
          onEdit={openEdit}
          onRemove={removeComm}
          onToggle={toggleFollowUp}
          onNew={openNew}
        />
      )}

      {tab === 'table' && (
        <TableView
          rows={sortRows(filteredRows, sortKey, sortDir, nameOf)}
          nameOf={nameOf}
          today={today}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={(k) => {
            if (k === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
            else {
              setSortKey(k)
              setSortDir(k === 'date' ? 'desc' : 'asc')
            }
          }}
          selected={selected}
          allSelected={allSelected}
          onToggleAll={toggleSelectAll}
          onToggleOne={toggleSelect}
          selectedCount={selectedRows.length}
          onBatchDone={batchMarkDone}
          onBatchDelete={batchDelete}
          onBatchExport={() => exportCsv(selectedRows)}
          onClearSelection={() => setSelected(new Set())}
          onEdit={openEdit}
        />
      )}

      {tab === 'students' && (
        <StudentsView
          rows={filteredRows}
          classMap={classMap}
          studentMap={studentMap}
          today={today}
          onFilterStudent={(classId, studentId) => {
            setFilterClassId(classId)
            setFilterStudentId(studentId)
            setShowFilters(true)
            setTab('timeline')
          }}
        />
      )}

      {tab === 'analytics' && <AnalyticsView rows={allRows} studentMap={studentMap} />}

      {/* 編輯器 + 範本管理 */}
      <CommEditor
        open={editorOpen}
        editing={editing}
        classes={classes}
        students={students}
        templates={templates}
        onClose={() => {
          setEditorOpen(false)
          setEditing(null)
        }}
        onSave={handleSave}
      />
      <TemplateManager
        open={templatesOpen}
        templates={templates}
        onClose={() => setTemplatesOpen(false)}
        onAdd={addTemplate}
        onUpdate={updateTemplate}
        onRemove={removeTemplate}
      />
    </div>
  )
}

// ============================================================
//  小工具 / 共用片段
// ============================================================

function LabeledSelect({
  label,
  value,
  onChange,
  disabled,
  children,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>
      <Select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
        {children}
      </Select>
    </label>
  )
}

function DirectionIcon({ meta }: { meta?: CommMeta }) {
  if (meta?.direction === 'incoming')
    return (
      <Tooltip label="家長來訊">
        <ArrowDownLeft size={14} className="text-blue-500 dark:text-blue-400" />
      </Tooltip>
    )
  return (
    <Tooltip label="主動聯絡">
      <ArrowUpRight size={14} className="text-accent" />
    </Tooltip>
  )
}

function MetaBadges({ meta }: { meta?: CommMeta }) {
  if (!meta) return null
  return (
    <>
      {meta.category && (
        <Badge tone={CATEGORY_STYLE[meta.category].badge}>{CATEGORY_LABEL[meta.category]}</Badge>
      )}
      {meta.outcome && (
        <Badge tone={OUTCOME_STYLE[meta.outcome].badge} dot>
          {OUTCOME_LABEL[meta.outcome]}
        </Badge>
      )}
    </>
  )
}

function FollowUpChip({ meta, today }: { meta?: CommMeta; today: string }) {
  const bucket = followUpBucket(meta?.followUpDate, today)
  const tone = BUCKET_TONE[bucket]
  return (
    <Badge tone={tone} icon={bucket === 'overdue' ? AlertTriangle : Hourglass}>
      {meta?.followUpDate
        ? `${BUCKET_LABEL[bucket]}・${shortDateLabel(meta.followUpDate)}`
        : '待跟進'}
    </Badge>
  )
}

// ============================================================
//  跟進管道 panel
// ============================================================
function FollowUpPanel({
  buckets,
  nameOf,
  today,
  onToggle,
  onEdit,
}: {
  buckets: Record<FollowUpBucket, CommRow[]>
  nameOf: (r: CommRow) => string
  today: string
  onToggle: (r: CommRow) => void
  onEdit: (r: CommRow) => void
}) {
  const [collapsed, setCollapsed] = useState(false)
  const order: FollowUpBucket[] = ['overdue', 'today', 'soon', 'later', 'nodate']
  const total = order.reduce((s, k) => s + buckets[k].length, 0)

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/50"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
            <Bell size={15} />
          </span>
          跟進管道
          <span className="tabular-nums text-slate-400">（{total}）</span>
          {buckets.overdue.length > 0 && (
            <Badge tone="rose" icon={AlertTriangle}>
              {buckets.overdue.length} 逾期
            </Badge>
          )}
        </span>
        {collapsed ? (
          <ChevronDown size={18} className="text-slate-400" />
        ) : (
          <ChevronUp size={18} className="text-slate-400" />
        )}
      </button>
      {!collapsed && (
        <div className="space-y-3 border-t border-slate-100 px-4 py-3 dark:border-slate-700/60">
          {order
            .filter((k) => buckets[k].length > 0)
            .map((k) => (
              <div key={k}>
                <div className="mb-1.5 flex items-center gap-2">
                  <Badge tone={BUCKET_TONE[k]} dot>
                    {BUCKET_LABEL[k]}
                  </Badge>
                  <span className="text-xs tabular-nums text-slate-400">
                    {buckets[k].length}
                  </span>
                </div>
                <ul className="space-y-1.5">
                  {buckets[k].map((r) => (
                    <li
                      key={r.comm.id}
                      className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/60 px-2.5 py-1.5 dark:border-slate-700/50 dark:bg-slate-800/40"
                    >
                      <Tooltip label="標記為已完成">
                        <IconButton label="完成跟進" size="sm" onClick={() => onToggle(r)}>
                          <Check size={15} />
                        </IconButton>
                      </Tooltip>
                      <button
                        type="button"
                        onClick={() => onEdit(r)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <span className="block truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                          {nameOf(r)}
                        </span>
                        <span className="block truncate text-xs text-slate-400 dark:text-slate-500">
                          {r.meta?.followUpNote || r.comm.summary}
                        </span>
                      </button>
                      {r.meta?.remindMinutes != null && (
                        <Tooltip label="已設提醒">
                          <Bell size={13} className="shrink-0 text-amber-500" />
                        </Tooltip>
                      )}
                      <span className="shrink-0 text-right text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
                        {r.meta?.followUpDate ? relativeDayLabel(r.meta.followUpDate, today) : '無日期'}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
        </div>
      )}
    </Card>
  )
}

// ============================================================
//  視圖 1：時間線（按日期分組）
// ============================================================
function TimelineView({
  rows,
  totalAll,
  nameOf,
  studentMap,
  today,
  onEdit,
  onRemove,
  onToggle,
  onNew,
}: {
  rows: CommRow[]
  totalAll: number
  nameOf: (r: CommRow) => string
  studentMap: Map<string, { id: string; name: string }>
  today: string
  onEdit: (r: CommRow) => void
  onRemove: (r: CommRow) => void
  onToggle: (r: CommRow) => void
  onNew: () => void
}) {
  const groups = useMemo(() => {
    const sorted = sortRows(rows, 'date', 'desc', nameOf)
    const map = new Map<string, CommRow[]>()
    for (const r of sorted) {
      const list = map.get(r.comm.date)
      if (list) list.push(r)
      else map.set(r.comm.date, [r])
    }
    return [...map.entries()]
  }, [rows, nameOf])

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={MessageCircle}
        title={totalAll === 0 ? '暫無溝通記錄' : '無符合條件嘅記錄'}
        hint={
          totalAll === 0
            ? '撳「新增記錄」開始記低同家長或學生嘅聯絡。'
            : '試吓調整搜尋或篩選條件。'
        }
        action={totalAll === 0 ? <Button icon={Plus} onClick={onNew}>新增記錄</Button> : undefined}
      />
    )
  }

  return (
    <div className="space-y-5">
      {groups.map(([date, list]) => (
        <div key={date}>
          <div className="mb-2 flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              {longDateLabel(date)}
            </h3>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] tabular-nums text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              {list.length}
            </span>
            {date === today && <Badge tone="accent">今日</Badge>}
          </div>
          <div className="space-y-2.5">
            {list.map((r) => (
              <TimelineCard
                key={r.comm.id}
                row={r}
                name={nameOf(r)}
                hasStudent={!!(r.comm.studentId && studentMap.get(r.comm.studentId))}
                today={today}
                onEdit={() => onEdit(r)}
                onRemove={() => onRemove(r)}
                onToggle={() => onToggle(r)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function TimelineCard({
  row,
  name,
  hasStudent,
  today,
  onEdit,
  onRemove,
  onToggle,
}: {
  row: CommRow
  name: string
  hasStudent: boolean
  today: string
  onEdit: () => void
  onRemove: () => void
  onToggle: () => void
}) {
  const { comm, meta } = row
  const ChannelIco = CHANNEL_ICON[comm.channel] ?? MessageSquare
  return (
    <Card hover className="p-4">
      <div className="flex items-start gap-3">
        <span
          className={cx(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
            meta?.direction === 'incoming'
              ? 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300'
              : 'bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent',
          )}
        >
          <ChannelIco size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <DirectionIcon meta={meta} />
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {hasStudent ? name : <span className="text-slate-700 dark:text-slate-200">{name}</span>}
            </span>
            {meta?.contactName && (
              <span className="text-xs text-slate-400 dark:text-slate-500">· {meta.contactName}</span>
            )}
            <Badge tone="slate" icon={ChannelIco}>
              {comm.channel}
            </Badge>
            <MetaBadges meta={meta} />
          </div>
          <p className="mt-1.5 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">
            {comm.summary}
          </p>
          {comm.followUp && (
            <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-amber-50/60 px-2.5 py-1.5 dark:bg-amber-500/10">
              <FollowUpChip meta={meta} today={today} />
              {meta?.followUpNote && (
                <span className="text-xs text-amber-700 dark:text-amber-300">
                  {meta.followUpNote}
                </span>
              )}
              {meta?.remindMinutes != null && <Bell size={13} className="text-amber-500" />}
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <div className="flex gap-0.5">
            <Tooltip label={comm.followUp ? '標記為已完成' : '重新標記待跟進'}>
              <IconButton
                label="切換跟進狀態"
                size="sm"
                active={comm.followUp}
                onClick={onToggle}
              >
                {comm.followUp ? <Check size={15} /> : <Hourglass size={15} />}
              </IconButton>
            </Tooltip>
            <IconButton label="編輯記錄" size="sm" onClick={onEdit}>
              <Pencil size={15} />
            </IconButton>
            <IconButton label="刪除記錄" size="sm" tone="danger" onClick={onRemove}>
              <Trash2 size={15} />
            </IconButton>
          </div>
        </div>
      </div>
    </Card>
  )
}

// ============================================================
//  視圖 2：表格（排序 + 批量）
// ============================================================
function TableView({
  rows,
  nameOf,
  today,
  sortKey,
  sortDir,
  onSort,
  selected,
  allSelected,
  onToggleAll,
  onToggleOne,
  selectedCount,
  onBatchDone,
  onBatchDelete,
  onBatchExport,
  onClearSelection,
  onEdit,
}: {
  rows: CommRow[]
  nameOf: (r: CommRow) => string
  today: string
  sortKey: SortKey
  sortDir: SortDir
  onSort: (k: SortKey) => void
  selected: Set<string>
  allSelected: boolean
  onToggleAll: () => void
  onToggleOne: (id: string) => void
  selectedCount: number
  onBatchDone: () => void
  onBatchDelete: () => void
  onBatchExport: () => void
  onClearSelection: () => void
  onEdit: (r: CommRow) => void
}) {
  if (rows.length === 0) {
    return <EmptyState icon={LayoutList} title="無記錄" hint="調整篩選或新增記錄。" />
  }

  const SortHead = ({ k, label, align }: { k: SortKey; label: string; align?: 'left' | 'center' }) => (
    <Th align={align}>
      <button
        type="button"
        onClick={() => onSort(k)}
        className={cx(
          'inline-flex items-center gap-1 transition hover:text-slate-700 dark:hover:text-slate-200',
          sortKey === k && 'text-accent-strong dark:text-accent',
        )}
      >
        {label}
        {sortKey === k &&
          (sortDir === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />)}
      </button>
    </Th>
  )

  return (
    <div className="space-y-3">
      {selectedCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-accent/30 bg-accent-soft px-3 py-2 text-sm dark:border-accent/40 dark:bg-accent/15">
          <span className="font-medium text-accent-strong dark:text-accent">
            已選 <span className="tabular-nums">{selectedCount}</span> 項
          </span>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" icon={CheckCheck} onClick={onBatchDone}>
              完成跟進
            </Button>
            <Button size="sm" variant="secondary" icon={Download} onClick={onBatchExport}>
              匯出
            </Button>
            <Button size="sm" variant="danger" icon={Trash2} onClick={onBatchDelete}>
              刪除
            </Button>
            <Button size="sm" variant="ghost" onClick={onClearSelection}>
              取消
            </Button>
          </div>
        </div>
      )}

      <Table>
        <Thead>
          <Tr>
            <Th>
              <input
                type="checkbox"
                aria-label="全選"
                className="h-4 w-4 rounded border-slate-300 text-accent focus:ring-accent/30 dark:border-slate-700"
                checked={allSelected}
                onChange={onToggleAll}
              />
            </Th>
            <SortHead k="date" label="日期" />
            <Th>對象</Th>
            <SortHead k="channel" label="方式" align="center" />
            <SortHead k="category" label="主題" align="center" />
            <Th>摘要</Th>
            <SortHead k="followUp" label="跟進" align="center" />
            <Th align="center">操作</Th>
          </Tr>
        </Thead>
        <Tbody>
          {rows.map((r) => {
            const { comm, meta } = r
            const ChannelIco = CHANNEL_ICON[comm.channel] ?? MessageSquare
            return (
              <Tr key={comm.id}>
                <Td>
                  <input
                    type="checkbox"
                    aria-label="選取"
                    className="h-4 w-4 rounded border-slate-300 text-accent focus:ring-accent/30 dark:border-slate-700"
                    checked={selected.has(comm.id)}
                    onChange={() => onToggleOne(comm.id)}
                  />
                </Td>
                <Td numeric className="whitespace-nowrap">
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    {shortDateLabel(comm.date)}
                  </span>
                </Td>
                <Td>
                  <span className="flex items-center gap-1.5">
                    <DirectionIcon meta={meta} />
                    <span className="truncate text-slate-700 dark:text-slate-200">{nameOf(r)}</span>
                  </span>
                </Td>
                <Td align="center">
                  <Tooltip label={comm.channel}>
                    <span className="inline-flex text-slate-500 dark:text-slate-400">
                      <ChannelIco size={16} />
                    </span>
                  </Tooltip>
                </Td>
                <Td align="center">
                  {meta?.category ? (
                    <Badge tone={CATEGORY_STYLE[meta.category].badge}>
                      {CATEGORY_LABEL[meta.category]}
                    </Badge>
                  ) : (
                    <span className="text-slate-300 dark:text-slate-600">—</span>
                  )}
                </Td>
                <Td>
                  <span className="line-clamp-1 max-w-xs text-slate-600 dark:text-slate-300">
                    {comm.summary}
                  </span>
                </Td>
                <Td align="center">
                  {comm.followUp ? (
                    <FollowUpChip meta={meta} today={today} />
                  ) : (
                    <Badge tone="green" icon={Check}>
                      完成
                    </Badge>
                  )}
                </Td>
                <Td align="center">
                  <IconButton label="編輯" size="sm" onClick={() => onEdit(r)}>
                    <Pencil size={15} />
                  </IconButton>
                </Td>
              </Tr>
            )
          })}
        </Tbody>
      </Table>
    </div>
  )
}

// ============================================================
//  視圖 3：學生名冊（CRM 聯絡卡）
// ============================================================
function StudentsView({
  rows,
  classMap,
  studentMap,
  today,
  onFilterStudent,
}: {
  rows: CommRow[]
  classMap: Map<string, { id: string; name: string }>
  studentMap: Map<string, { id: string; name: string; classId: string }>
  today: string
  onFilterStudent: (classId: string, studentId: string) => void
}) {
  const summaries = useMemo(() => summarizeByStudent(rows), [rows])
  const list = useMemo(() => {
    return [...summaries.values()]
      .map((s) => {
        const stu = studentMap.get(s.studentId)
        return { ...s, name: stu?.name ?? '（已移除學生）', classId: stu?.classId ?? '' }
      })
      .sort((a, b) => {
        // 有逾期 / 待跟進排先；然後按最近溝通
        if (a.openFollowUps !== b.openFollowUps) return b.openFollowUps - a.openFollowUps
        return (b.lastDate ?? '').localeCompare(a.lastDate ?? '')
      })
  }, [summaries, studentMap])

  if (list.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="未有指定學生嘅記錄"
        hint="喺新增記錄時揀埋學生，就會喺呢度睇到每位學生嘅溝通脈絡。"
      />
    )
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {list.map((s) => {
        const sentimentTotal = s.positive + s.neutral + s.concern
        return (
          <Card key={s.studentId} hover className="p-4" onClick={() => s.classId && onFilterStudent(s.classId, s.studentId)}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {s.name}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  {classMap.get(s.classId)?.name ?? '—'} · {s.count} 次溝通
                </p>
              </div>
              {s.openFollowUps > 0 ? (
                <Badge
                  tone={s.nextFollowUp && followUpBucket(s.nextFollowUp, today) === 'overdue' ? 'rose' : 'amber'}
                  icon={Hourglass}
                >
                  {s.openFollowUps} 待跟進
                </Badge>
              ) : (
                <Badge tone="green" icon={Check}>
                  無待辦
                </Badge>
              )}
            </div>

            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400">
                最近：
                <span className="ml-1 font-medium text-slate-700 dark:text-slate-200">
                  {s.lastDate ? relativeDayLabel(s.lastDate, today) : '—'}
                </span>
              </span>
              {s.nextFollowUp && (
                <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                  <Clock size={12} />
                  跟進 {shortDateLabel(s.nextFollowUp)}
                </span>
              )}
            </div>

            {/* 觀感迷你條 */}
            {sentimentTotal > 0 && (
              <div className="mt-2.5">
                <div className="flex h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  {s.positive > 0 && (
                    <div className="bg-emerald-500" style={{ width: `${(s.positive / sentimentTotal) * 100}%` }} />
                  )}
                  {s.neutral > 0 && (
                    <div className="bg-slate-400" style={{ width: `${(s.neutral / sentimentTotal) * 100}%` }} />
                  )}
                  {s.concern > 0 && (
                    <div className="bg-rose-500" style={{ width: `${(s.concern / sentimentTotal) * 100}%` }} />
                  )}
                </div>
                <div className="mt-1 flex gap-3 text-[10px] text-slate-400 dark:text-slate-500">
                  {s.positive > 0 && <span className="tabular-nums">正面 {s.positive}</span>}
                  {s.neutral > 0 && <span className="tabular-nums">中性 {s.neutral}</span>}
                  {s.concern > 0 && (
                    <span className="tabular-nums text-rose-500 dark:text-rose-400">需關注 {s.concern}</span>
                  )}
                </div>
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}

// ============================================================
//  視圖 4：統計分析（自製 SVG / div 圖表）
// ============================================================
function AnalyticsView({
  rows,
  studentMap,
}: {
  rows: CommRow[]
  studentMap: Map<string, { id: string; name: string }>
}) {
  const [months, setMonths] = useState(6)

  const channels = useMemo(() => countByChannel(rows), [rows])
  const categories = useMemo(() => countByCategory(rows), [rows])
  const outcomes = useMemo(() => countByOutcome(rows), [rows])
  const trend = useMemo(() => monthlyTrend(rows, months), [rows, months])

  const topStudents = useMemo(() => {
    const map = new Map<string, number>()
    for (const { comm } of rows)
      if (comm.studentId) map.set(comm.studentId, (map.get(comm.studentId) ?? 0) + 1)
    return [...map.entries()]
      .map(([id, count]) => ({ id, name: studentMap.get(id)?.name ?? '（已移除）', count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
  }, [rows, studentMap])

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="未有足夠資料"
        hint="新增溝通記錄後，呢度會自動產生圖表分析。"
      />
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card className="p-4 lg:col-span-2">
        <SectionTitle
          icon={TrendingUp}
          right={
            <SegmentedControl<string>
              size="sm"
              value={String(months)}
              onChange={(v) => setMonths(Number(v))}
              options={[
                { id: '6', label: '6 個月' },
                { id: '12', label: '12 個月' },
              ]}
            />
          }
        >
          每月溝通量
        </SectionTitle>
        <MonthlyTrendChart points={trend} />
      </Card>

      <Card className="p-4">
        <SectionTitle icon={MessageSquare}>聯絡方式占比</SectionTitle>
        <ChannelDonut slices={channels} />
      </Card>

      <Card className="p-4">
        <SectionTitle icon={FileText}>主題分類分布</SectionTitle>
        <CategoryBars data={categories} />
      </Card>

      <Card className="p-4">
        <SectionTitle icon={CheckCheck}>溝通結果觀感</SectionTitle>
        <OutcomeBars data={outcomes} />
      </Card>

      <Card className="p-4">
        <SectionTitle icon={Users}>最常聯絡學生</SectionTitle>
        <TopStudentsBars data={topStudents} />
      </Card>
    </div>
  )
}
