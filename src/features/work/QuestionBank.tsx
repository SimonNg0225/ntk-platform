import { useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  ArrowLeft,
  BarChart3,
  BookMarked,
  Bot,
  Check,
  CheckCheck,
  CheckSquare,
  ChevronRight,
  ClipboardList,
  Copy,
  Download,
  FileText,
  FolderOpen,
  Layers,
  Pencil,
  PenLine,
  Plus,
  Printer,
  Save,
  Scale,
  ScrollText,
  Search,
  Sparkles,
  Square,
  Target,
  Trash2,
  Upload,
  Wand2,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useCollection } from '../../lib/store'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import { useNav } from '../../context/NavContext'
import { questionsCol, topicsCol, papersCol, type SavedPaper } from '../../data/collections'
import type { Difficulty, Question, QuestionType } from '../../data/types'
import {
  Badge,
  Button,
  Card,
  cx,
  EmptyState,
  Field,
  IconButton,
  Input,
  Modal,
  Pills,
  SegmentedControl,
  Select,
  Textarea,
} from '../../ui'
import {
  assemblePaper,
  buildPrintHtml,
  buildTopicRows,
  compactMcOptions,
  computeStats,
  coverageGaps,
  csvTemplate,
  difficultyIndexLabel,
  DIFF_LABEL,
  DIFF_ORDER,
  DIFF_TONE,
  downloadText,
  emptyBlueprint,
  findDuplicates,
  openPrintWindow,
  parseCsv,
  questionsToCsv,
  rowsToQuestions,
  sortQuestions,
  SORT_OPTIONS,
  TYPE_LABEL,
  TYPE_ORDER,
  type Blueprint,
  type DupGroup,
  type SortKey,
} from './questionbank/util'
import { CoverageMatrix, DifficultyBars, TypeDonut } from './questionbank/Charts'

// ───────── 表單狀態 ─────────
type FormState = {
  topicId: string
  type: QuestionType
  difficulty: Difficulty
  stem: string
  options: string[]
  answerIndex: number
  answer: string
  marks: string
}

const emptyForm = (topicId: string): FormState => ({
  topicId,
  type: 'mc',
  difficulty: 'medium',
  stem: '',
  options: ['', '', '', ''],
  answerIndex: 0,
  answer: '',
  marks: '',
})

const formFromQuestion = (q: Question): FormState => ({
  topicId: q.topicId,
  type: q.type,
  difficulty: q.difficulty,
  stem: q.stem,
  options:
    q.type === 'mc'
      ? [...(q.options ?? []), '', '', '', ''].slice(
          0,
          Math.max(4, q.options?.length ?? 0),
        )
      : ['', '', '', ''],
  answerIndex: q.answerIndex ?? 0,
  answer: q.answer ?? '',
  marks: q.marks != null ? String(q.marks) : '',
})

type ViewId = 'bank' | 'analytics' | 'paper'

// 題型 tone chip：每種題型一隻色（對齊統計圖表語言），淺底深字 + 深色 /15。
// ⚠️ 寫足整串 class（Tailwind 靠掃字面值）。
const TYPE_CHIP: Record<QuestionType, string> = {
  mc: 'bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300',
  short: 'bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent',
  long: 'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300',
  case: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-300',
}
const TYPE_DOT: Record<QuestionType, string> = {
  mc: 'bg-blue-500',
  short: 'bg-accent',
  long: 'bg-violet-500',
  case: 'bg-cyan-500',
}

// 小型題型膠囊（pill）——比通用 Badge 多隻分類色，令列表一眼分到題型。
function TypeChip({ type }: { type: QuestionType }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium',
        TYPE_CHIP[type],
      )}
    >
      <span className={cx('h-1.5 w-1.5 rounded-full', TYPE_DOT[type])} />
      {TYPE_LABEL[type]}
    </span>
  )
}

// ───────── 分數印章（marking-scheme 右欄語氣：[ N 分 ]）─────────
//  考評檔案概念：分數似改卷員喺題旁打嘅 marks 章。無分（唔計分）時退成低調灰章。
function MarksStamp({ marks }: { marks?: number }) {
  if (marks)
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-dashed border-amber-300/80 bg-amber-50/70 px-2 py-0.5 font-serif text-[11px] font-semibold tabular-nums text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
        <Scale size={11} className="opacity-70" />
        {marks} 分
      </span>
    )
  return (
    <span className="inline-flex items-center rounded-md border border-dashed border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-400 dark:border-slate-700 dark:text-slate-500">
      未配分
    </span>
  )
}

// ───────── 卷面題號牌（serif Q01）──────────
//  畀每條題目一個「卷面編號感」——細牌、serif、tabular，題型色做底光。
function QuestionPlate({
  index,
  type,
  className,
}: {
  index: number
  type: QuestionType
  className?: string
}) {
  return (
    <span
      className={cx(
        'inline-flex shrink-0 flex-col items-center justify-center rounded-lg px-2 py-1 leading-none',
        TYPE_CHIP[type],
        className,
      )}
      aria-hidden
    >
      <span className="text-[8px] font-semibold uppercase tracking-[0.15em] opacity-60">
        Q
      </span>
      <span className="font-serif text-[15px] font-semibold tabular-nums slashed-zero">
        {String(index).padStart(2, '0')}
      </span>
    </span>
  )
}

// ───────── 區段小帽（uppercase + icon；統一頁內節奏）─────────
function SectionLabel({
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

// ───────── 清點帶統計格（hairline grid · serif 大數字；達標 hot 高亮）─────────
function TallyStat({
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
        hot ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'bg-white dark:bg-slate-800',
      )}
    >
      <p
        className={cx(
          'flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide',
          hot
            ? 'text-emerald-600/80 dark:text-emerald-400/80'
            : 'text-slate-400 dark:text-slate-500',
        )}
      >
        <Icon size={12} className="shrink-0" />
        <span className="truncate">{label}</span>
      </p>
      <p
        className={cx(
          'mt-1 font-serif text-[26px] font-semibold leading-none tabular-nums slashed-zero',
          hot
            ? 'text-emerald-600 dark:text-emerald-400'
            : 'text-slate-800 dark:text-slate-100',
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

export default function QuestionBank() {
  const toast = useToast()
  const confirm = useConfirm()
  const nav = useNav()
  const questions = useCollection(questionsCol)
  const topics = useCollection(topicsCol)

  const [view, setView] = useState<ViewId>('bank')

  // 篩選 / 搜尋 / 排序
  const [fTopic, setFTopic] = useState('')
  const [fType, setFType] = useState<'' | QuestionType>('')
  const [fDiff, setFDiff] = useState<'' | Difficulty>('')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortKey>('new')
  const [expanded, setExpanded] = useState<string | null>(null)

  // 新增 / 編輯 / AI / 匯入 / 重複
  const [editing, setEditing] = useState<Question | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showDup, setShowDup] = useState(false)

  // 多選（批量 / 組卷共用）
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const topicName = (id: string) =>
    topics.find((t) => t.id === id)?.topic ?? '未分類'

  const stats = useMemo(
    () => computeStats(questions, topics.length),
    [questions, topics.length],
  )

  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase()
    const base = questions
      .filter((q) => (fTopic ? q.topicId === fTopic : true))
      .filter((q) => (fType ? q.type === fType : true))
      .filter((q) => (fDiff ? q.difficulty === fDiff : true))
      .filter((q) =>
        kw
          ? q.stem.toLowerCase().includes(kw) ||
            (q.options ?? []).some((o) => o.toLowerCase().includes(kw)) ||
            (q.answer ?? '').toLowerCase().includes(kw)
          : true,
      )
    return sortQuestions(base, sort)
  }, [questions, fTopic, fType, fDiff, search, sort])

  const dupGroups = useMemo(() => findDuplicates(questions), [questions])
  const dupCount = dupGroups.reduce((s, g) => s + g.questions.length, 0)

  const filterActive = !!(fTopic || fType || fDiff || search.trim())
  const clearFilters = () => {
    setFTopic('')
    setFType('')
    setFDiff('')
    setSearch('')
  }

  // ───── 多選 ─────
  const selectedQuestions = useMemo(
    () => questions.filter((q) => selected.has(q.id)),
    [questions, selected],
  )
  const selectedMarks = selectedQuestions.reduce(
    (sum, q) => sum + (q.marks ?? 0),
    0,
  )
  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const selectAllFiltered = () =>
    setSelected((prev) => {
      const next = new Set(prev)
      const allOn = filtered.every((q) => next.has(q.id))
      if (allOn) filtered.forEach((q) => next.delete(q.id))
      else filtered.forEach((q) => next.add(q.id))
      return next
    })
  const clearSelection = () => setSelected(new Set())

  const openAdd = () => {
    setEditing(null)
    setShowForm(true)
  }
  const openEdit = (q: Question) => {
    setEditing(q)
    setShowForm(true)
  }

  const removeQuestion = async (q: Question) => {
    const ok = await confirm({
      title: '刪除題目？',
      message: '此題目將會由題庫永久移除，無法復原。',
      confirmText: '刪除',
      tone: 'danger',
    })
    if (!ok) return
    questionsCol.remove(q.id)
    setSelected((prev) => {
      if (!prev.has(q.id)) return prev
      const next = new Set(prev)
      next.delete(q.id)
      return next
    })
    toast.success('已刪除題目')
  }

  const bulkDelete = async () => {
    if (selected.size === 0) return
    const ok = await confirm({
      title: `刪除 ${selected.size} 條題目？`,
      message: '已選題目將會永久移除，無法復原。',
      confirmText: '全部刪除',
      tone: 'danger',
    })
    if (!ok) return
    selected.forEach((id) => questionsCol.remove(id))
    toast.success(`已刪除 ${selected.size} 條題目`)
    clearSelection()
  }

  const bulkMoveTopic = (topicId: string) => {
    if (!topicId || selected.size === 0) return
    selected.forEach((id) => questionsCol.update(id, { topicId }))
    toast.success(`已將 ${selected.size} 條題目改到「${topicName(topicId)}」`)
  }
  const bulkSetDifficulty = (difficulty: Difficulty) => {
    if (selected.size === 0) return
    selected.forEach((id) => questionsCol.update(id, { difficulty }))
    toast.success(`已將 ${selected.size} 條題目改為「${DIFF_LABEL[difficulty]}」`)
  }

  const duplicateQuestion = (q: Question) => {
    const { id: _omit, createdAt: _omit2, ...rest } = q
    void _omit
    void _omit2
    questionsCol.add({
      ...rest,
      stem: `${q.stem}（複本）`,
      createdAt: new Date().toISOString(),
    })
    toast.success('已複製題目')
  }

  const exportSelected = () => {
    const list = selected.size > 0 ? selectedQuestions : filtered
    if (list.length === 0) {
      toast.error('未有題目可匯出')
      return
    }
    downloadText(
      `bafs-題庫-${new Date().toISOString().slice(0, 10)}.csv`,
      questionsToCsv(list, topicName),
    )
    toast.success(`已匯出 ${list.length} 條題目（CSV）`)
  }

  return (
    <div className="space-y-5">
      {/* ───────── 考評檔案 masthead：卷面封面感（kicker + serif 標題 + 卷務行）───────── */}
      <header className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white px-5 py-5 shadow-xs dark:border-slate-700/60 dark:bg-slate-800 dark:shadow-none sm:px-7 sm:py-6">
        {/* 封面右上「卷務戳印」裝飾（純裝飾，唔搶主次） */}
        <span
          aria-hidden
          className="pointer-events-none absolute -right-6 top-3 hidden -rotate-6 select-none rounded-xl border-2 border-dashed border-accent/20 px-4 py-2 font-serif text-xs font-semibold uppercase tracking-[0.25em] text-accent/25 dark:border-accent/25 dark:text-accent/25 sm:block"
        >
          BAFS · 校本評核
        </span>
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.3em] text-accent/70">
              <ScrollText size={13} />
              考評檔案 · Assessment Bank
            </p>
            <h1 className="mt-1.5 font-serif text-[28px] font-semibold leading-none tracking-tight text-slate-800 dark:text-slate-100 sm:text-[34px]">
              BAFS 題庫
            </h1>
            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
              <span className="tabular-nums">
                存題 {stats.total} 條 · 覆蓋 {stats.topicsCovered}/{topics.length} 個課題
              </span>
              {stats.total > 0 && (
                <>
                  <span aria-hidden className="text-slate-300 dark:text-slate-600">·</span>
                  <span className="inline-flex items-center gap-1 font-medium text-accent-strong dark:text-accent">
                    <Scale size={12} /> 卷面難度 {difficultyIndexLabel(stats.difficultyIndex)}
                  </span>
                </>
              )}
            </p>
          </div>
          {/* 視圖切換：似試卷檔案的分頁標籤 */}
          <div className="shrink-0">
            <SegmentedControl<ViewId>
              value={view}
              onChange={setView}
              options={[
                { id: 'bank', label: '題庫', icon: BookMarked },
                { id: 'analytics', label: '統計', icon: BarChart3 },
                { id: 'paper', label: '組卷', icon: FileText },
              ]}
            />
          </div>
        </div>
        {/* 卷面雙線（封面分隔感） */}
        <div className="mt-5 space-y-1" aria-hidden>
          <span className="block h-px bg-slate-200/90 dark:bg-slate-700/70" />
          <span className="block h-px bg-slate-200/60 dark:bg-slate-700/40" />
        </div>
      </header>

      {/* ───────── 改卷員清點帶：hairline grid · serif 大數字 ───────── */}
      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-slate-200/70 ring-1 ring-slate-200/80 dark:bg-slate-700/50 dark:ring-slate-700/60 sm:grid-cols-4">
        <TallyStat
          label="題目總數"
          value={stats.total}
          unit="條"
          icon={BookMarked}
          hint="入卷的題庫存量"
        />
        <TallyStat
          label="即用題"
          value={stats.withAnswer}
          unit="條"
          icon={CheckCheck}
          hint="已附答案／完整選項"
          hot={stats.total > 0 && stats.withAnswer === stats.total}
        />
        <TallyStat
          label="總分值"
          value={stats.totalMarks}
          unit="分"
          icon={Scale}
          hint="全題庫合計分數"
        />
        <TallyStat
          label="難度指數"
          value={stats.difficultyIndex}
          icon={Target}
          hint={difficultyIndexLabel(stats.difficultyIndex)}
        />
      </section>

      {view === 'bank' && (
        <BankView
          questions={questions}
          filtered={filtered}
          topics={topics}
          topicName={topicName}
          search={search}
          setSearch={setSearch}
          fTopic={fTopic}
          setFTopic={setFTopic}
          fType={fType}
          setFType={setFType}
          fDiff={fDiff}
          setFDiff={setFDiff}
          sort={sort}
          setSort={setSort}
          filterActive={filterActive}
          clearFilters={clearFilters}
          stats={stats}
          expanded={expanded}
          setExpanded={setExpanded}
          selectMode={selectMode}
          setSelectMode={setSelectMode}
          selected={selected}
          toggleSelect={toggleSelect}
          selectAllFiltered={selectAllFiltered}
          clearSelection={clearSelection}
          selectedQuestions={selectedQuestions}
          selectedMarks={selectedMarks}
          bulkDelete={bulkDelete}
          bulkMoveTopic={bulkMoveTopic}
          bulkSetDifficulty={bulkSetDifficulty}
          duplicateQuestion={duplicateQuestion}
          openAdd={openAdd}
          openEdit={openEdit}
          removeQuestion={removeQuestion}
          onShowAI={() => nav.open('work-generate')}
          onShowImport={() => setShowImport(true)}
          onShowDup={() => setShowDup(true)}
          dupCount={dupCount}
          exportSelected={exportSelected}
        />
      )}

      {view === 'analytics' && (
        <AnalyticsView questions={questions} topics={topics} stats={stats} />
      )}

      {view === 'paper' && (
        <PaperStudio
          questions={questions}
          topics={topics}
          topicName={topicName}
        />
      )}

      {/* Modals */}
      {showForm && (
        <QuestionFormModal
          key={editing ? `edit-${editing.id}` : 'add'}
          editing={editing}
          topics={topics}
          onClose={() => setShowForm(false)}
        />
      )}
      {showImport && (
        <ImportModal topics={topics} onClose={() => setShowImport(false)} />
      )}
      {showDup && (
        <DuplicatesModal
          groups={dupGroups}
          topicName={topicName}
          onClose={() => setShowDup(false)}
        />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
//  題庫視圖（列表 + 篩選 + 批量）
// ═══════════════════════════════════════════════════════════
function BankView(props: {
  questions: Question[]
  filtered: Question[]
  topics: { id: string; topic: string }[]
  topicName: (id: string) => string
  search: string
  setSearch: (v: string) => void
  fTopic: string
  setFTopic: (v: string) => void
  fType: '' | QuestionType
  setFType: (v: '' | QuestionType) => void
  fDiff: '' | Difficulty
  setFDiff: (v: '' | Difficulty) => void
  sort: SortKey
  setSort: (v: SortKey) => void
  filterActive: boolean
  clearFilters: () => void
  stats: ReturnType<typeof computeStats>
  expanded: string | null
  setExpanded: (v: string | null) => void
  selectMode: boolean
  setSelectMode: (v: boolean) => void
  selected: Set<string>
  toggleSelect: (id: string) => void
  selectAllFiltered: () => void
  clearSelection: () => void
  selectedQuestions: Question[]
  selectedMarks: number
  bulkDelete: () => void
  bulkMoveTopic: (id: string) => void
  bulkSetDifficulty: (d: Difficulty) => void
  duplicateQuestion: (q: Question) => void
  openAdd: () => void
  openEdit: (q: Question) => void
  removeQuestion: (q: Question) => void
  onShowAI: () => void
  onShowImport: () => void
  onShowDup: () => void
  dupCount: number
  exportSelected: () => void
}) {
  const {
    filtered,
    topics,
    topicName,
    search,
    setSearch,
    fTopic,
    setFTopic,
    fType,
    setFType,
    fDiff,
    setFDiff,
    sort,
    setSort,
    filterActive,
    clearFilters,
    stats,
    expanded,
    setExpanded,
    selectMode,
    setSelectMode,
    selected,
    toggleSelect,
    selectAllFiltered,
    clearSelection,
    selectedMarks,
    bulkDelete,
    bulkMoveTopic,
    bulkSetDifficulty,
    duplicateQuestion,
    openAdd,
    openEdit,
    removeQuestion,
    onShowAI,
    onShowImport,
    onShowDup,
    dupCount,
    exportSelected,
  } = props

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((q) => selected.has(q.id))

  return (
    <div className="space-y-4">
      {/* 工具列 — 搜尋為主、輔助操作成組、主行動（新增）最突出 */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜尋題幹／選項／答案…"
          icon={Search}
          className="min-w-[160px] flex-1"
        />
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            variant={selectMode ? 'secondary' : 'ghost'}
            size="sm"
            icon={CheckSquare}
            onClick={() => {
              setSelectMode(!selectMode)
              if (selectMode) clearSelection()
            }}
          >
            {selectMode ? '退出選取' : '選取'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={Copy}
            onClick={onShowDup}
            className="relative"
          >
            查重
            {dupCount > 0 && (
              <span className="ml-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold tabular-nums text-white">
                {dupCount}
              </span>
            )}
          </Button>
          <Button variant="ghost" size="sm" icon={Upload} onClick={onShowImport}>
            匯入
          </Button>
          <Button variant="ghost" size="sm" icon={Download} onClick={exportSelected}>
            匯出
          </Button>
          <span className="mx-0.5 hidden h-5 w-px bg-slate-200 dark:bg-slate-700/60 sm:block" />
          <Button variant="secondary" size="sm" icon={Sparkles} onClick={onShowAI}>
            AI 出題
          </Button>
          <Button size="sm" icon={Plus} onClick={openAdd}>
            新增題目
          </Button>
        </div>
      </div>

      {/* 篩選 + 排序 — 分層：課題/排序揀單 + 題型/難度 pill 各自一行 */}
      <Card className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={fTopic}
            onChange={(e) => setFTopic(e.target.value)}
            className="max-w-[220px] flex-1"
          >
            <option value="">全部課題</option>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.topic}
              </option>
            ))}
          </Select>
          <Select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="w-36"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </Select>
          {filterActive && (
            <Button variant="ghost" size="sm" icon={X} onClick={clearFilters}>
              清除篩選
            </Button>
          )}
        </div>
        <div className="flex flex-col gap-2.5 border-t border-slate-100 pt-3 dark:border-slate-700/60">
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-9 shrink-0 text-xs font-medium text-slate-400 dark:text-slate-500">
              題型
            </span>
            <Pills
              options={[
                { id: '', label: '全部' },
                ...TYPE_ORDER.map((t) => ({ id: t, label: TYPE_LABEL[t] })),
              ]}
              active={fType}
              onChange={(v) => setFType(v as '' | QuestionType)}
              counts={{ '': stats.total, ...stats.byType }}
              size="sm"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-9 shrink-0 text-xs font-medium text-slate-400 dark:text-slate-500">
              難度
            </span>
            <Pills
              options={[
                { id: '', label: '全部' },
                ...DIFF_ORDER.map((d) => ({ id: d, label: DIFF_LABEL[d] })),
              ]}
              active={fDiff}
              onChange={(v) => setFDiff(v as '' | Difficulty)}
              counts={{ '': stats.total, ...stats.byDiff }}
              size="sm"
            />
          </div>
        </div>
      </Card>

      {/* 批量操作列 */}
      {selectMode && (
        <Card className="flex flex-wrap items-center gap-x-3 gap-y-2 border-accent/30 bg-accent-soft/50 p-3 dark:bg-accent/10">
          <button
            onClick={selectAllFiltered}
            aria-pressed={allFilteredSelected}
            className="inline-flex items-center gap-1.5 rounded-xl px-2 py-1 text-sm font-medium text-accent-strong transition hover:bg-accent/10 active:scale-[0.98] dark:text-accent"
          >
            {allFilteredSelected ? <CheckSquare size={16} /> : <Square size={16} />}
            全選（<span className="tabular-nums">{filtered.length}</span>）
          </button>
          <span className="text-sm text-slate-600 dark:text-slate-300">
            已選 <span className="nums font-semibold text-accent-strong dark:text-accent">{selected.size}</span> 條 · <span className="nums">{selectedMarks}</span> 分
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Select
              value=""
              onChange={(e) => {
                bulkMoveTopic(e.target.value)
                e.target.value = ''
              }}
              className="w-32 text-xs"
              disabled={selected.size === 0}
            >
              <option value="">改課題…</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.topic}
                </option>
              ))}
            </Select>
            <Select
              value=""
              onChange={(e) => {
                if (e.target.value) bulkSetDifficulty(e.target.value as Difficulty)
                e.target.value = ''
              }}
              className="w-24 text-xs"
              disabled={selected.size === 0}
            >
              <option value="">改難度…</option>
              {DIFF_ORDER.map((d) => (
                <option key={d} value={d}>
                  {DIFF_LABEL[d]}
                </option>
              ))}
            </Select>
            <Button
              variant="danger"
              size="sm"
              icon={Trash2}
              onClick={bulkDelete}
              disabled={selected.size === 0}
            >
              刪除
            </Button>
          </div>
        </Card>
      )}

      {/* 卷面題目列表 — 改卷卡：serif 題號牌 + marks 印章 + marking-scheme 展開 */}
      <SectionLabel
        icon={ClipboardList}
        right={
          <span
            className="text-xs tabular-nums text-slate-400 dark:text-slate-500"
            aria-live="polite"
          >
            共 {filtered.length} 條
          </span>
        }
      >
        卷面題目
      </SectionLabel>
      <ul className="space-y-2.5">
        {filtered.map((q, idx) => {
          const isOpen = expanded === q.id
          return (
          <Card
            key={q.id}
            className={cx(
              'group/q overflow-hidden p-0 transition duration-200 hover:border-slate-300 hover:shadow-md dark:hover:border-slate-600',
              isOpen && 'border-accent/40 shadow-md ring-1 ring-accent/15 dark:border-accent/40',
            )}
          >
            <div className="flex items-stretch">
              {/* 題型色軌 — 一眼分到題型 */}
              <span className={cx('w-1 shrink-0', TYPE_DOT[q.type])} aria-hidden />
              <div className="min-w-0 flex-1 p-4">
                <div className="flex items-start gap-3">
                  {selectMode && (
                    <input
                      type="checkbox"
                      checked={selected.has(q.id)}
                      onChange={() => toggleSelect(q.id)}
                      className="mt-1 h-4 w-4 shrink-0 accent-[color:var(--accent)]"
                      aria-label="選取題目"
                    />
                  )}
                  {/* 卷面題號牌 */}
                  <QuestionPlate index={idx + 1} type={q.type} className="mt-0.5" />
                  <button
                    onClick={() => setExpanded(isOpen ? null : q.id)}
                    aria-expanded={isOpen}
                    className="flex min-w-0 flex-1 items-start gap-2 break-words text-left text-[15px] font-medium leading-relaxed text-slate-800 dark:text-slate-100"
                  >
                    <span className="min-w-0">{q.stem}</span>
                    <ChevronRight
                      size={16}
                      className={cx(
                        'mt-1 shrink-0 text-slate-300 transition-transform duration-200 group-hover/q:text-slate-400 dark:text-slate-600',
                        isOpen && 'rotate-90 text-accent dark:text-accent',
                      )}
                    />
                  </button>
                  <div className="flex shrink-0 items-center gap-0.5 opacity-100 transition sm:opacity-60 sm:group-hover/q:opacity-100">
                    <IconButton label="複製題目" onClick={() => duplicateQuestion(q)}>
                      <Copy size={16} />
                    </IconButton>
                    <IconButton label="編輯題目" onClick={() => openEdit(q)}>
                      <Pencil size={16} />
                    </IconButton>
                    <IconButton
                      label="刪除題目"
                      tone="danger"
                      onClick={() => removeQuestion(q)}
                    >
                      <Trash2 size={16} />
                    </IconButton>
                  </div>
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5 pl-[3.25rem]">
                  <TypeChip type={q.type} />
                  <Badge tone={DIFF_TONE[q.difficulty]} dot>{DIFF_LABEL[q.difficulty]}</Badge>
                  <Badge tone="accent">{topicName(q.topicId)}</Badge>
                  <MarksStamp marks={q.marks} />
                  {q.source?.includes('AI') && (
                    <Badge tone="slate" icon={Bot}>
                      AI
                    </Badge>
                  )}
                </div>
            {isOpen && (
              <div className="ml-[3.25rem] mt-3.5 rounded-2xl border border-slate-200/70 bg-slate-50/70 p-3.5 text-sm dark:border-slate-700/50 dark:bg-slate-900/30">
                <p className="mb-2.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                  <Check size={12} className="text-emerald-500" />
                  評卷參考 · Marking Scheme
                </p>
                {q.type === 'mc' && q.options && (
                  <ul className="space-y-1">
                    {q.options.map((o, i) => {
                      const correct = i === q.answerIndex
                      return (
                        <li
                          key={i}
                          className={cx(
                            'flex min-w-0 items-center gap-2',
                            correct
                              ? 'font-semibold text-emerald-700 dark:text-emerald-400'
                              : 'text-slate-600 dark:text-slate-300',
                          )}
                        >
                          <span
                            className={cx(
                              'flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-serif text-[11px] font-semibold',
                              correct
                                ? 'bg-emerald-500 text-white'
                                : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400',
                            )}
                          >
                            {String.fromCharCode(65 + i)}
                          </span>
                          <span className="min-w-0 break-words">{o}</span>
                          {correct && (
                            <Check size={14} className="shrink-0" aria-label="正確答案" />
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
                {q.type !== 'mc' && q.answer && (
                  <p className="break-words leading-relaxed text-slate-600 dark:text-slate-300">
                    {q.answer}
                  </p>
                )}
                {q.type !== 'mc' && !q.answer && (
                  <p className="flex items-center gap-1.5 text-xs italic text-slate-400 dark:text-slate-500">
                    <PenLine size={13} />
                    仲未擬好評卷參考——撳編輯補上。
                  </p>
                )}
              </div>
            )}
              </div>
            </div>
          </Card>
          )
        })}
      </ul>
      {filtered.length === 0 && (
        <EmptyState
          icon={filterActive ? Search : ScrollText}
          title={filterActive ? '篩唔到相符嘅題目' : '題庫仲係一張白卷'}
          hint={
            filterActive
              ? '試吓放寬篩選條件，或者用 AI 出題 / 匯入 CSV 補充題量。'
              : '由零開始入第一條題：手動擬卷、叫 AI 幫你草擬，或者匯入現成 CSV。'
          }
          action={
            <div className="flex flex-wrap justify-center gap-2">
              {filterActive ? (
                <Button variant="secondary" icon={X} onClick={clearFilters}>
                  清除篩選
                </Button>
              ) : (
                <>
                  <Button icon={Plus} onClick={openAdd}>
                    擬第一條題
                  </Button>
                  <Button variant="secondary" icon={Sparkles} onClick={onShowAI}>
                    AI 出題
                  </Button>
                </>
              )}
            </div>
          }
        />
      )}
    </div>
  )
}

// 分析卡標題（小色塊 icon + 標題 + 可選右側）——統一統計頁節奏。
const CHART_HEAD_TONE: Record<
  'accent' | 'blue' | 'amber' | 'violet' | 'rose',
  string
> = {
  accent: 'bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent',
  blue: 'bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300',
  violet: 'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300',
  rose: 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300',
}
function ChartHead({
  icon: Icon,
  tone,
  right,
  children,
}: {
  icon: LucideIcon
  tone: keyof typeof CHART_HEAD_TONE
  right?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="mb-3.5 flex items-center justify-between gap-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
        <span
          className={cx(
            'flex h-7 w-7 items-center justify-center rounded-lg',
            CHART_HEAD_TONE[tone],
          )}
        >
          <Icon size={15} />
        </span>
        {children}
      </h3>
      {right}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
//  統計分析視圖（自製圖表）
// ═══════════════════════════════════════════════════════════
function AnalyticsView({
  questions,
  topics,
  stats,
}: {
  questions: Question[]
  topics: { id: string; topic: string; area?: string }[]
  stats: ReturnType<typeof computeStats>
}) {
  const rows = useMemo(
    () => buildTopicRows(questions, topics),
    [questions, topics],
  )
  const gaps = useMemo(() => coverageGaps(rows), [rows])
  const topTopics = useMemo(
    () => [...rows].filter((r) => r.total > 0).sort((a, b) => b.total - a.total).slice(0, 5),
    [rows],
  )

  if (stats.total === 0)
    return (
      <EmptyState
        icon={BarChart3}
        title="未有題目，畫唔到卷面分析"
        hint="入幾條題之後，呢度會出現題型佔比、難度分佈同課題覆蓋熱圖，幫你睇住份卷夠唔夠均衡。"
      />
    )

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4 sm:p-5">
          <ChartHead icon={Layers} tone="blue">題型佔比</ChartHead>
          <TypeDonut byType={stats.byType} />
        </Card>
        <Card className="p-4 sm:p-5">
          <ChartHead icon={BarChart3} tone="amber">難度分佈</ChartHead>
          <DifficultyBars byDiff={stats.byDiff} />
          <div className="mt-4 rounded-xl bg-slate-50 p-3 dark:bg-slate-900/40">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400">卷面難度指數</span>
              <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                {stats.difficultyIndex} · {difficultyIndexLabel(stats.difficultyIndex)}
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-gradient-to-r from-emerald-400 via-amber-400 to-rose-400">
              <div
                className="h-full w-1 -translate-x-1/2 rounded-full bg-slate-900 shadow ring-2 ring-white dark:bg-white dark:ring-slate-900"
                style={{ marginLeft: `${stats.difficultyIndex}%` }}
              />
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-4 sm:p-5">
        <ChartHead icon={BookMarked} tone="accent">課題覆蓋矩陣</ChartHead>
        <CoverageMatrix rows={rows} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4 sm:p-5">
          <ChartHead icon={Sparkles} tone="violet">題目最多嘅課題</ChartHead>
          {topTopics.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-400 dark:text-slate-500">
              未有資料
            </p>
          ) : (
            <ul className="space-y-2.5">
              {topTopics.map((r, i) => {
                const max = topTopics[0].total || 1
                return (
                  <li key={r.topicId} className="flex items-center gap-2.5">
                    <span
                      className={cx(
                        'flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-semibold tabular-nums',
                        i === 0
                          ? 'bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent'
                          : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500',
                      )}
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-medium text-slate-600 dark:text-slate-300">
                          {r.topic}
                        </span>
                        <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-500 dark:text-slate-400">
                          {r.total}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div
                          className="h-full rounded-full bg-accent transition-all duration-500"
                          style={{ width: `${(r.total / max) * 100}%` }}
                        />
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        <Card className="p-4 sm:p-5">
          <ChartHead
            icon={Target}
            tone="rose"
            right={gaps.length > 0 ? <Badge tone="rose">{gaps.length}</Badge> : undefined}
          >
            覆蓋缺口
          </ChartHead>
          {gaps.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-500 dark:bg-emerald-500/15 dark:text-emerald-400">
                <Check size={26} />
              </span>
              <p className="mt-3 text-sm font-medium text-slate-600 dark:text-slate-300">
                所有課題都有題目，覆蓋完整！
              </p>
            </div>
          ) : (
            <>
              <p className="mb-2.5 text-xs text-slate-400 dark:text-slate-500">
                以下課題仲未有任何題目，建議補題：
              </p>
              <ul className="flex flex-wrap gap-1.5">
                {gaps.map((g) => (
                  <Badge key={g.topicId} tone="slate">
                    {g.topic}
                  </Badge>
                ))}
              </ul>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
//  組卷工作室（手動 + 藍圖自動 + 已儲存試卷 + 列印）
// ═══════════════════════════════════════════════════════════
function PaperStudio({
  questions,
  topics,
  topicName,
}: {
  questions: Question[]
  topics: { id: string; topic: string }[]
  topicName: (id: string) => string
}) {
  const toast = useToast()
  const confirm = useConfirm()
  const papers = useCollection(papersCol)

  const [mode, setMode] = useState<'manual' | 'auto'>('manual')
  const [picked, setPicked] = useState<string[]>([]) // 有序題目 id
  const [meta, setMeta] = useState({ title: '', className: '', durationMin: '' })

  // 手動加題篩選
  const [mTopic, setMTopic] = useState('')
  const [mType, setMType] = useState<'' | QuestionType>('')
  const [mDiff, setMDiff] = useState<'' | Difficulty>('')
  const [mSearch, setMSearch] = useState('')

  // 藍圖
  const [bp, setBp] = useState<Blueprint>(emptyBlueprint)

  const pickedSet = useMemo(() => new Set(picked), [picked])
  const pickedQuestions = useMemo(
    () =>
      picked
        .map((id) => questions.find((q) => q.id === id))
        .filter((q): q is Question => !!q),
    [picked, questions],
  )
  const totalMarks = pickedQuestions.reduce((s, q) => s + (q.marks ?? 0), 0)

  const candidatePool = useMemo(() => {
    const kw = mSearch.trim().toLowerCase()
    return questions
      .filter((q) => (mTopic ? q.topicId === mTopic : true))
      .filter((q) => (mType ? q.type === mType : true))
      .filter((q) => (mDiff ? q.difficulty === mDiff : true))
      .filter((q) => (kw ? q.stem.toLowerCase().includes(kw) : true))
  }, [questions, mTopic, mType, mDiff, mSearch])

  const addToPaper = (id: string) =>
    setPicked((prev) => (prev.includes(id) ? prev : [...prev, id]))
  const removeFromPaper = (id: string) =>
    setPicked((prev) => prev.filter((x) => x !== id))
  const moveQuestion = (idx: number, dir: -1 | 1) =>
    setPicked((prev) => {
      const next = [...prev]
      const j = idx + dir
      if (j < 0 || j >= next.length) return prev
      ;[next[idx], next[j]] = [next[j], next[idx]]
      return next
    })

  const runAuto = () => {
    const { picked: chosen, shortfall } = assemblePaper(questions, bp)
    if (chosen.length === 0) {
      toast.error('題池唔夠，抽唔到題目。試吓放寬範圍或補題。')
      return
    }
    setPicked(chosen.map((q) => q.id))
    setMode('manual')
    const miss = DIFF_ORDER.filter((d) => shortfall[d] > 0)
    if (miss.length > 0) {
      toast.error(
        `已抽 ${chosen.length} 題，但${miss
          .map((d) => `${DIFF_LABEL[d]}欠 ${shortfall[d]}`)
          .join('、')}（題池不足）`,
      )
    } else {
      toast.success(`已自動組成 ${chosen.length} 題試卷`)
    }
  }

  const savePaper = () => {
    if (picked.length === 0) {
      toast.error('未有題目，組卷後先可儲存')
      return
    }
    papersCol.add({
      title: meta.title.trim() || 'BAFS 自擬試卷',
      className: meta.className.trim(),
      durationMin: meta.durationMin.trim(),
      questionIds: picked,
      createdAt: new Date().toISOString(),
    })
    toast.success('已儲存試卷')
  }

  const loadPaper = (p: SavedPaper) => {
    setPicked(p.questionIds.filter((id) => questions.some((q) => q.id === id)))
    setMeta({ title: p.title, className: p.className, durationMin: p.durationMin })
    setMode('manual')
    toast.success(`已載入「${p.title}」`)
  }

  const deletePaper = async (p: SavedPaper) => {
    const ok = await confirm({
      title: '刪除試卷？',
      message: `將會刪除「${p.title}」（唔影響題庫題目）。`,
      confirmText: '刪除',
      tone: 'danger',
    })
    if (!ok) return
    papersCol.remove(p.id)
    toast.success('已刪除試卷')
  }

  const print = (withAnswers: boolean) => {
    if (pickedQuestions.length === 0) {
      toast.error('未有題目可列印')
      return
    }
    const html = buildPrintHtml(
      { ...meta, totalMarks },
      pickedQuestions,
      topicName,
      withAnswers,
    )
    const ok = openPrintWindow(html)
    if (!ok) toast.error('瀏覽器擋咗彈出視窗，請允許後再試。')
  }

  const setCount = (d: Difficulty, v: string) =>
    setBp((prev) => ({
      ...prev,
      counts: { ...prev.counts, [d]: Math.max(0, Number(v.replace(/\D/g, '')) || 0) },
    }))
  const toggleBpTopic = (id: string) =>
    setBp((prev) => ({
      ...prev,
      topicIds: prev.topicIds.includes(id)
        ? prev.topicIds.filter((x) => x !== id)
        : [...prev.topicIds, id],
    }))
  const bpTotal = DIFF_ORDER.reduce((s, d) => s + bp.counts[d], 0)

  return (
    <div className="space-y-4">
      {/* 試卷設定 */}
      <Card className="space-y-3 p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="試卷標題">
            <Input
              value={meta.title}
              onChange={(e) => setMeta((m) => ({ ...m, title: e.target.value }))}
              placeholder="BAFS 自擬試卷"
            />
          </Field>
          <Field label="班別">
            <Input
              value={meta.className}
              onChange={(e) =>
                setMeta((m) => ({ ...m, className: e.target.value }))
              }
              placeholder="例如 5A"
            />
          </Field>
          <Field label="時限（分鐘）">
            <Input
              value={meta.durationMin}
              onChange={(e) =>
                setMeta((m) => ({
                  ...m,
                  durationMin: e.target.value.replace(/\D/g, ''),
                }))
              }
              placeholder="例如 60"
              inputMode="numeric"
              className="w-28"
            />
          </Field>
        </div>

        <SegmentedControl<'manual' | 'auto'>
          options={[
            { id: 'manual', label: '手動揀題', icon: FolderOpen },
            { id: 'auto', label: '藍圖自動組卷', icon: Wand2 },
          ]}
          value={mode}
          onChange={setMode}
        />

        {mode === 'auto' && (
          <div className="space-y-3.5 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 dark:border-slate-700/60 dark:bg-slate-900/40">
            <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              設定每個難度想出幾題，系統會喺範圍內隨機抽題並盡量平均覆蓋課題。
            </p>
            <div className="grid grid-cols-3 gap-2">
              {DIFF_ORDER.map((d) => (
                <Field key={d} label={`${DIFF_LABEL[d]}（題）`}>
                  <Input
                    value={String(bp.counts[d])}
                    onChange={(e) => setCount(d, e.target.value)}
                    inputMode="numeric"
                  />
                </Field>
              ))}
            </div>
            <Field label="限定題型（可不限）">
              <Pills
                options={[
                  { id: '', label: '不限' },
                  ...TYPE_ORDER.map((t) => ({ id: t, label: TYPE_LABEL[t] })),
                ]}
                active={bp.type}
                onChange={(v) => setBp((p) => ({ ...p, type: v as '' | QuestionType }))}
                size="sm"
              />
            </Field>
            <div>
              <p className="mb-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                限定課題（唔揀 = 全部 {topics.length} 個）
              </p>
              <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
                {topics.map((t) => {
                  const on = bp.topicIds.includes(t.id)
                  return (
                    <button
                      key={t.id}
                      onClick={() => toggleBpTopic(t.id)}
                      aria-pressed={on}
                      className={cx(
                        'rounded-full border px-2.5 py-1 text-xs font-medium transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
                        on
                          ? 'border-accent bg-accent text-white shadow-sm dark:shadow-none'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
                      )}
                    >
                      {t.topic}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                合共抽 <span className="nums font-semibold">{bpTotal}</span> 題
              </span>
              <Button icon={Wand2} onClick={runAuto} disabled={bpTotal === 0}>
                自動組卷
              </Button>
            </div>
          </div>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* 左：題池（手動加題） */}
        {mode === 'manual' && (
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
                <FolderOpen size={15} className="text-slate-400" />
                題池
              </h3>
              <span className="text-xs tabular-nums text-slate-400 dark:text-slate-500">
                {candidatePool.length} 條可揀
              </span>
            </div>
            <div className="space-y-2">
              <Input
                value={mSearch}
                onChange={(e) => setMSearch(e.target.value)}
                placeholder="搜尋題幹…"
                icon={Search}
              />
              <div className="flex gap-2">
                <Select
                  value={mTopic}
                  onChange={(e) => setMTopic(e.target.value)}
                  className="flex-1 text-xs"
                >
                  <option value="">全部課題</option>
                  {topics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.topic}
                    </option>
                  ))}
                </Select>
                <Select
                  value={mType}
                  onChange={(e) => setMType(e.target.value as '' | QuestionType)}
                  className="w-24 text-xs"
                >
                  <option value="">題型</option>
                  {TYPE_ORDER.map((t) => (
                    <option key={t} value={t}>
                      {TYPE_LABEL[t]}
                    </option>
                  ))}
                </Select>
                <Select
                  value={mDiff}
                  onChange={(e) => setMDiff(e.target.value as '' | Difficulty)}
                  className="w-20 text-xs"
                >
                  <option value="">難度</option>
                  {DIFF_ORDER.map((d) => (
                    <option key={d} value={d}>
                      {DIFF_LABEL[d]}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <ul className="mt-3 max-h-[420px] space-y-1.5 overflow-y-auto pr-1">
              {candidatePool.map((q) => {
                const on = pickedSet.has(q.id)
                return (
                  <li
                    key={q.id}
                    className={cx(
                      'flex items-start gap-2 rounded-xl border p-2.5 transition',
                      on
                        ? 'border-accent/30 bg-accent-soft/40 dark:border-accent/30 dark:bg-accent/10'
                        : 'border-slate-200/80 hover:border-slate-300 dark:border-slate-700/60 dark:hover:border-slate-600',
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-xs leading-relaxed text-slate-700 dark:text-slate-200">
                        {q.stem}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1">
                        <TypeChip type={q.type} />
                        <Badge tone={DIFF_TONE[q.difficulty]} dot>
                          {DIFF_LABEL[q.difficulty]}
                        </Badge>
                        <MarksStamp marks={q.marks} />
                      </div>
                    </div>
                    <IconButton
                      label={on ? '已加入' : '加入試卷'}
                      onClick={() => (on ? removeFromPaper(q.id) : addToPaper(q.id))}
                      active={on}
                    >
                      {on ? <Check size={16} /> : <Plus size={16} />}
                    </IconButton>
                  </li>
                )
              })}
              {candidatePool.length === 0 && (
                <li className="py-6 text-center text-xs text-slate-400 dark:text-slate-500">
                  未有符合條件嘅題目
                </li>
              )}
            </ul>
          </Card>
        )}

        {/* 右：試卷內容（卷面預覽感） */}
        <Card className={mode === 'manual' ? 'p-4' : 'p-4 lg:col-span-2'}>
          <div className="mb-3 flex items-center justify-between gap-2 border-b border-dashed border-slate-200 pb-3 dark:border-slate-700/60">
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-accent/70">
                卷面預覽
              </p>
              <h3 className="truncate font-serif text-base font-semibold text-slate-800 dark:text-slate-100">
                {meta.title.trim() || 'BAFS 自擬試卷'}
              </h3>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              <span className="nums font-semibold text-slate-700 dark:text-slate-200">{pickedQuestions.length}</span> 題 ·{' '}
              <span className="nums font-semibold text-slate-700 dark:text-slate-200">{totalMarks}</span> 分
            </span>
          </div>

          {pickedQuestions.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="試卷仲係空白卷"
              hint={
                mode === 'manual'
                  ? '由左邊題池揀題入卷，或者切去「藍圖自動組卷」一鍵抽題。'
                  : '設定每個難度想出幾題，撳「自動組卷」就幫你抽好。'
              }
            />
          ) : (
            <ol className="space-y-2">
              {pickedQuestions.map((q, idx) => (
                <li
                  key={q.id}
                  className="flex items-start gap-2.5 rounded-xl border border-slate-200/80 p-2.5 transition hover:border-slate-300 dark:border-slate-700/60 dark:hover:border-slate-600"
                >
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-soft font-serif text-sm font-semibold tabular-nums slashed-zero text-accent-strong dark:bg-accent/15 dark:text-accent">
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-200">
                      {q.stem}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1">
                      <Badge tone="accent">{topicName(q.topicId)}</Badge>
                      <Badge tone={DIFF_TONE[q.difficulty]} dot>
                        {DIFF_LABEL[q.difficulty]}
                      </Badge>
                      <MarksStamp marks={q.marks} />
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col">
                    <IconButton
                      label="上移"
                      size="sm"
                      onClick={() => moveQuestion(idx, -1)}
                      disabled={idx === 0}
                    >
                      <ArrowLeft size={14} className="rotate-90" />
                    </IconButton>
                    <IconButton
                      label="下移"
                      size="sm"
                      onClick={() => moveQuestion(idx, 1)}
                      disabled={idx === pickedQuestions.length - 1}
                    >
                      <ArrowLeft size={14} className="-rotate-90" />
                    </IconButton>
                  </div>
                  <IconButton
                    label="移除"
                    tone="danger"
                    onClick={() => removeFromPaper(q.id)}
                  >
                    <X size={16} />
                  </IconButton>
                </li>
              ))}
            </ol>
          )}

          {pickedQuestions.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4 dark:border-slate-700">
              <Button variant="secondary" icon={Printer} onClick={() => print(false)}>
                列印試卷
              </Button>
              <Button variant="secondary" icon={Printer} onClick={() => print(true)}>
                列印（連答案）
              </Button>
              <Button icon={Save} onClick={savePaper}>
                儲存試卷
              </Button>
              <Button variant="ghost" icon={X} onClick={() => setPicked([])}>
                清空
              </Button>
            </div>
          )}
        </Card>
      </div>

      {/* 已儲存試卷 */}
      {papers.length > 0 && (
        <Card className="p-4">
          <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <Layers size={15} />
            已儲存試卷
            <Badge tone="slate">{papers.length}</Badge>
          </h3>
          <ul className="space-y-2">
            {[...papers]
              .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
              .map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-3 rounded-xl border border-slate-200/80 p-2.5 transition hover:border-slate-300 hover:shadow-xs dark:border-slate-700/60 dark:hover:border-slate-600"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
                    <FileText size={17} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                      {p.title}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      {p.className ? `${p.className} · ` : ''}
                      <span className="nums">{p.questionIds.length}</span> 題 ·{' '}
                      {new Date(p.createdAt).toLocaleDateString('zh-HK')}
                    </p>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => loadPaper(p)}>
                    載入
                  </Button>
                  <IconButton
                    label="刪除試卷"
                    tone="danger"
                    onClick={() => deletePaper(p)}
                  >
                    <Trash2 size={16} />
                  </IconButton>
                </li>
              ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
//  新增 / 編輯題目 Modal
// ═══════════════════════════════════════════════════════════
function QuestionFormModal({
  editing,
  topics,
  onClose,
}: {
  editing: Question | null
  topics: { id: string; topic: string }[]
  onClose: () => void
}) {
  const toast = useToast()
  const [form, setForm] = useState<FormState>(() =>
    editing ? formFromQuestion(editing) : emptyForm(topics[0]?.id ?? ''),
  )
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  const save = () => {
    if (!form.stem.trim() || !form.topicId) return
    // MC：去除空白選項後要重新對應 answerIndex，否則中間留空會令正確答案錯位／出界
    const mc =
      form.type === 'mc'
        ? compactMcOptions(form.options, form.answerIndex)
        : null
    const payload = {
      topicId: form.topicId,
      type: form.type,
      difficulty: form.difficulty,
      stem: form.stem.trim(),
      options: mc ? mc.options : undefined,
      answerIndex: mc ? mc.answerIndex : undefined,
      answer: form.type !== 'mc' ? form.answer.trim() : undefined,
      marks: form.marks ? Number(form.marks) : undefined,
    }
    if (editing) {
      questionsCol.update(editing.id, payload)
      toast.success('已儲存題目修改')
    } else {
      questionsCol.add({ ...payload, createdAt: new Date().toISOString() })
      toast.success('已新增題目')
    }
    onClose()
  }

  return (
    <Modal open onClose={onClose} size="lg">
      {/* ───────── 試卷封面：kicker + serif 標題 + 擬題戳（呼應主畫面 masthead）───────── */}
      <header className="relative -mx-5 -mt-5 overflow-hidden px-5 pb-4 pt-5 sm:-mx-6 sm:-mt-6 sm:px-6 sm:pt-6">
        {/* 右上擬題戳裝飾（純裝飾，唔搶主次；手機收起） */}
        <span
          aria-hidden
          className="pointer-events-none absolute -right-5 top-3 hidden -rotate-6 select-none flex-col items-center rounded-xl border-2 border-dashed border-accent/20 px-4 py-2 font-serif text-[9px] font-semibold uppercase tracking-[0.28em] text-accent/25 dark:border-accent/25 dark:text-accent/25 sm:flex"
        >
          <PenLine size={13} className="mb-0.5" />
          {editing ? '修題' : '擬題'}
        </span>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.3em] text-accent/70">
              <ScrollText size={12} />
              考評檔案 · Item
            </p>
            <h2 className="mt-1.5 font-serif text-[24px] font-semibold leading-none tracking-tight text-slate-800 dark:text-slate-100 sm:text-[26px]">
              {editing ? '修訂題目' : '擬定新題'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="關閉"
            className="-mr-1.5 -mt-1 shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:hover:bg-slate-700"
          >
            <X size={18} />
          </button>
        </div>
        {/* 卷面雙線（封面分隔感） */}
        <div className="mt-4 space-y-1" aria-hidden>
          <span className="block h-px bg-slate-200/90 dark:bg-slate-700/70" />
          <span className="block h-px bg-slate-200/60 dark:bg-slate-700/40" />
        </div>
      </header>

      <div className="space-y-5">
        {/* 試題檔頭 — 課題／題型／難度，收喺柔和子面板（同題幹分區） */}
        <section className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 dark:border-slate-700/60 dark:bg-slate-900/40">
          <SectionLabel icon={Layers}>試題檔頭 · Classification</SectionLabel>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="課題">
              <Select
                value={form.topicId}
                onChange={(e) => set('topicId', e.target.value)}
              >
                {topics.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.topic}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="題型">
              <Select
                value={form.type}
                onChange={(e) => set('type', e.target.value as QuestionType)}
              >
                {TYPE_ORDER.map((k) => (
                  <option key={k} value={k}>
                    {TYPE_LABEL[k]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="難度">
              <Select
                value={form.difficulty}
                onChange={(e) => set('difficulty', e.target.value as Difficulty)}
              >
                {DIFF_ORDER.map((k) => (
                  <option key={k} value={k}>
                    {DIFF_LABEL[k]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          {/* 卷面標籤即時預覽 — 同列表卡一模一樣嘅題型膠囊／難度／分章語言 */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-dashed border-slate-200/80 pt-3 dark:border-slate-700/50">
            <TypeChip type={form.type} />
            <Badge tone={DIFF_TONE[form.difficulty]} dot>
              {DIFF_LABEL[form.difficulty]}
            </Badge>
            {topics.find((t) => t.id === form.topicId) && (
              <Badge tone="accent">
                {topics.find((t) => t.id === form.topicId)?.topic}
              </Badge>
            )}
            <MarksStamp marks={form.marks ? Number(form.marks) : undefined} />
          </div>
        </section>

        <Field label="題幹 · Stem" required>
          <Textarea
            value={form.stem}
            onChange={(e) => set('stem', e.target.value)}
            placeholder="輸入題幹內容…"
            rows={3}
          />
        </Field>

        {form.type === 'mc' ? (
          <Field
            label="選項與正確答案 · Options"
            hint="撳左邊 serif 字母圈，揀邊個係正確答案。"
          >
            <div className="space-y-2">
              {form.options.map((o, i) => {
                const on = form.answerIndex === i
                return (
                  <label
                    key={i}
                    className={cx(
                      'flex items-center gap-2.5 rounded-xl border p-1.5 pr-2 transition',
                      on
                        ? 'border-emerald-300 bg-emerald-50/60 dark:border-emerald-500/40 dark:bg-emerald-500/10'
                        : 'border-transparent',
                    )}
                  >
                    <span className="relative flex shrink-0 items-center">
                      <input
                        type="radio"
                        name="correct"
                        checked={on}
                        onChange={() => set('answerIndex', i)}
                        className="peer sr-only"
                      />
                      {/* serif 答案圈 — 對齊評卷參考嘅卷面字母牌 */}
                      <span
                        className={cx(
                          'flex h-7 w-7 cursor-pointer items-center justify-center rounded-full font-serif text-[13px] font-semibold transition peer-focus-visible:ring-2 peer-focus-visible:ring-accent/40',
                          on
                            ? 'bg-emerald-500 text-white shadow-sm'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600',
                        )}
                      >
                        {String.fromCharCode(65 + i)}
                      </span>
                    </span>
                    <Input
                      value={o}
                      onChange={(e) =>
                        set(
                          'options',
                          form.options.map((x, k) => (k === i ? e.target.value : x)),
                        )
                      }
                      placeholder={`選項 ${String.fromCharCode(65 + i)}`}
                    />
                    {/* 正確答案戳（呼應評卷參考綠章；常駐佔位免跳位） */}
                    <span
                      className={cx(
                        'inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition',
                        on
                          ? 'text-emerald-600 opacity-100 dark:text-emerald-400'
                          : 'opacity-0',
                      )}
                      aria-hidden={!on}
                    >
                      <Check size={12} />
                      正確
                    </span>
                  </label>
                )
              })}
            </div>
          </Field>
        ) : (
          <Field
            label="評卷參考 · Marking Scheme"
            hint="改卷員對照嘅標準答案／給分要點。"
          >
            <Textarea
              value={form.answer}
              onChange={(e) => set('answer', e.target.value)}
              placeholder="輸入評卷參考…"
              rows={3}
            />
          </Field>
        )}

        {/* 配分 — 對齊卷面「分章」語言（Scale icon · serif tabular） */}
        <Field label="配分 · Marks" hint="留空 = 此題唔計分。">
          <div className="relative w-28">
            <Scale
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-amber-500/70 dark:text-amber-400/70"
              aria-hidden
            />
            <Input
              value={form.marks}
              onChange={(e) => set('marks', e.target.value.replace(/\D/g, ''))}
              placeholder="5"
              className="pl-8 font-serif tabular-nums slashed-zero"
              inputMode="numeric"
            />
          </div>
        </Field>

        {/* 卷務頁腳 — 雙線收束（呼應封面），primary action 帶印章感 */}
        <div className="-mx-5 mt-1 border-t border-slate-200 px-5 pt-4 dark:border-slate-700 sm:-mx-6 sm:px-6">
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              取消
            </Button>
            <Button
              icon={editing ? Save : Plus}
              onClick={save}
              disabled={!form.stem.trim() || !form.topicId}
            >
              {editing ? '存檔修訂' : '入卷存題'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

// ═══════════════════════════════════════════════════════════
//  CSV 匯入 Modal
// ═══════════════════════════════════════════════════════════
function ImportModal({
  topics,
  onClose,
}: {
  topics: { id: string; topic: string }[]
  onClose: () => void
}) {
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [text, setText] = useState('')

  const preview = useMemo(() => {
    if (!text.trim()) return { parsed: [], skipped: 0 }
    return rowsToQuestions(parseCsv(text), topics)
  }, [text, topics])

  const onFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => setText(String(reader.result ?? ''))
    reader.readAsText(file)
  }

  const commit = () => {
    if (preview.parsed.length === 0) {
      toast.error('未有可匯入嘅題目')
      return
    }
    for (const r of preview.parsed) {
      questionsCol.add({
        topicId: r.topicId,
        type: r.type,
        difficulty: r.difficulty,
        stem: r.stem,
        options: r.options,
        answerIndex: r.answerIndex,
        answer: r.answer,
        marks: r.marks,
        source: 'CSV 匯入',
        createdAt: new Date().toISOString(),
      })
    }
    toast.success(`已匯入 ${preview.parsed.length} 條題目`)
    onClose()
  }

  return (
    <Modal open onClose={onClose} title="匯入題目（CSV）" size="lg">
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-2xl border border-accent/20 bg-accent-soft/50 p-3.5 dark:border-accent/25 dark:bg-accent/10">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent text-white">
            <Upload size={16} />
          </span>
          <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            CSV 欄位：課題、題型、難度、題幹、選項 A–D、答案、分數。題型 / 難度可用中英；MC
            答案用 A/B/C/D；課題名稱會自動對應到最相近嘅課題。第一次用建議先下載範本。
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv,text/plain"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onFile(f)
            }}
          />
          <Button
            variant="secondary"
            icon={Upload}
            onClick={() => fileRef.current?.click()}
          >
            選擇 CSV 檔
          </Button>
          <Button
            variant="ghost"
            icon={Download}
            onClick={() => downloadText('bafs-題庫範本.csv', csvTemplate())}
          >
            下載範本
          </Button>
        </div>

        <Field label="或直接貼上 CSV 內容">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="topic,type,difficulty,stem,optionA,optionB,optionC,optionD,answer,marks…"
            rows={6}
            className="font-mono text-xs"
          />
        </Field>

        {text.trim() && (
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-3.5 dark:border-slate-700/60 dark:bg-slate-900/40">
            <div
              className="mb-2.5 flex items-center gap-2 text-xs"
              aria-live="polite"
            >
              <Badge tone="green" dot>可匯入 {preview.parsed.length}</Badge>
              {preview.skipped > 0 && (
                <Badge tone="amber" dot>略過 {preview.skipped}</Badge>
              )}
            </div>
            <ul className="max-h-44 space-y-1.5 overflow-y-auto">
              {preview.parsed.slice(0, 8).map((r, i) => (
                <li
                  key={i}
                  className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300"
                >
                  <TypeChip type={r.type} />
                  <Badge tone={DIFF_TONE[r.difficulty]}>
                    {DIFF_LABEL[r.difficulty]}
                  </Badge>
                  <span className="truncate">{r.stem}</span>
                </li>
              ))}
              {preview.parsed.length > 8 && (
                <li className="text-xs text-slate-400 dark:text-slate-500">
                  …仲有 {preview.parsed.length - 8} 條
                </li>
              )}
            </ul>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button onClick={commit} disabled={preview.parsed.length === 0}>
            匯入（{preview.parsed.length}）
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ═══════════════════════════════════════════════════════════
//  查重 Modal
// ═══════════════════════════════════════════════════════════
function DuplicatesModal({
  groups,
  topicName,
  onClose,
}: {
  groups: DupGroup[]
  topicName: (id: string) => string
  onClose: () => void
}) {
  const toast = useToast()
  const confirm = useConfirm()

  // 每組保留邊條（id）；預設保留第一條
  const [keep, setKeep] = useState<Record<number, string>>(() => {
    const init: Record<number, string> = {}
    groups.forEach((g, i) => (init[i] = g.questions[0].id))
    return init
  })

  const resolveGroup = async (gi: number) => {
    const g = groups[gi]
    if (!g) return
    // 保留 id 必須屬於本組；若 state 落後（組別重算後 index 偏移）就 fallback
    // 保留第一條，避免「揀嘅 id 唔喺組入面」而刪走成組（連應保留嗰條）。
    const keepId = g.questions.some((q) => q.id === keep[gi])
      ? keep[gi]
      : g.questions[0].id
    const toRemove = g.questions.filter((q) => q.id !== keepId)
    if (toRemove.length === 0) return
    const ok = await confirm({
      title: '合併重複題？',
      message: `將會刪除 ${toRemove.length} 條重複題，只保留你揀嘅一條。`,
      confirmText: '合併',
      tone: 'danger',
    })
    if (!ok) return
    toRemove.forEach((q) => questionsCol.remove(q.id))
    toast.success(`已移除 ${toRemove.length} 條重複題`)
  }

  return (
    <Modal open onClose={onClose} title="重複題偵測" size="lg">
      <div className="space-y-3">
        {groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Check size={32} className="text-emerald-500" />
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              冇發現重複或高度相似嘅題目！
            </p>
          </div>
        ) : (
          <>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              發現 {groups.length} 組可能重複嘅題目。每組揀返一條保留，其餘可一鍵移除。
            </p>
            {groups.map((g, gi) => (
              <Card key={gi} className="p-3">
                <div className="mb-2 flex items-center justify-between">
                  <Badge tone={g.reason === 'exact' ? 'rose' : 'amber'}>
                    {g.reason === 'exact'
                      ? '完全相同'
                      : `相似 ${Math.round(g.score * 100)}%`}
                    （{g.questions.length} 條）
                  </Badge>
                  <Button
                    size="sm"
                    variant="danger"
                    icon={Trash2}
                    onClick={() => resolveGroup(gi)}
                  >
                    合併
                  </Button>
                </div>
                <ul className="space-y-1.5">
                  {g.questions.map((q) => (
                    <li key={q.id} className="flex items-start gap-2">
                      <input
                        type="radio"
                        name={`keep-${gi}`}
                        checked={keep[gi] === q.id}
                        onChange={() =>
                          setKeep((prev) => ({ ...prev, [gi]: q.id }))
                        }
                        className="mt-1 h-4 w-4 shrink-0 accent-[color:var(--accent)]"
                        aria-label="保留呢條"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-slate-700 dark:text-slate-200">
                          {q.stem}
                        </p>
                        <div className="mt-0.5 flex flex-wrap gap-1">
                          <Badge tone="accent">{topicName(q.topicId)}</Badge>
                          <Badge tone={DIFF_TONE[q.difficulty]}>
                            {DIFF_LABEL[q.difficulty]}
                          </Badge>
                          {q.marks ? (
                            <Badge className="nums">{q.marks} 分</Badge>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </>
        )}
        <div className="flex justify-end pt-2">
          <Button variant="secondary" onClick={onClose}>
            關閉
          </Button>
        </div>
      </div>
    </Modal>
  )
}
