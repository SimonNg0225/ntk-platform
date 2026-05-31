import { useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  BarChart3,
  BookMarked,
  Bot,
  Check,
  CheckSquare,
  Copy,
  Download,
  FileText,
  FolderOpen,
  Layers,
  Lock,
  NotebookPen,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
  Save,
  Search,
  Sparkles,
  Square,
  Trash2,
  Upload,
  Wand2,
  X,
} from 'lucide-react'
import { createCollection, uid, useCollection } from '../../lib/store'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import { useAuth } from '../../context/AuthContext'
import { complete, isAIConfigured, type AIModel } from '../../lib/aiClient'
import { extractJsonArray } from '../../lib/aiJson'
import { questionsCol, topicsCol } from '../../data/collections'
import type { Difficulty, Question, QuestionType } from '../../data/types'
import type { Entity } from '../../lib/store'
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
  SegmentedControl,
  Select,
  StatCard,
  Tabs,
  Textarea,
} from '../../ui'
import {
  assemblePaper,
  buildPrintHtml,
  buildTopicRows,
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

// ───────── 已儲存試卷（本檔自管 collection；唔掂 data/collections）─────────
interface SavedPaper extends Entity {
  title: string
  className: string
  durationMin: string
  questionIds: string[]
  createdAt: string
}
const papersCol = createCollection<SavedPaper>('questionbank.papers', [])

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

export default function QuestionBank() {
  const toast = useToast()
  const confirm = useConfirm()
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
  const [showAI, setShowAI] = useState(false)
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
    <div className="space-y-4">
      {/* 視圖切換 */}
      <Tabs<ViewId>
        tabs={[
          { id: 'bank', label: '題庫' },
          { id: 'analytics', label: '統計分析' },
          { id: 'paper', label: '組卷工作室' },
        ]}
        active={view}
        onChange={setView}
        icons={{ bank: BookMarked, analytics: BarChart3, paper: FileText }}
      />

      {/* 統計卡（全視圖共用） */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="題目總數" value={stats.total} icon={BookMarked} highlight />
        <StatCard
          label="可即用"
          value={stats.withAnswer}
          unit="題"
          hint="有答案 / 完整選項"
        />
        <StatCard label="總分值" value={stats.totalMarks} unit="分" />
        <StatCard
          label="課題覆蓋"
          value={`${stats.topicsCovered}/${topics.length}`}
          hint="有題目嘅課題"
        />
        <StatCard
          label="難度指數"
          value={stats.difficultyIndex}
          hint={difficultyIndexLabel(stats.difficultyIndex)}
        />
      </div>

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
          onShowAI={() => setShowAI(true)}
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
      {showAI && (
        <AIGenerateModal topics={topics} onClose={() => setShowAI(false)} />
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
      {/* 工具列 */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜尋題幹／選項／答案…"
          icon={Search}
          className="min-w-[160px] flex-1"
        />
        <Button
          variant={selectMode ? 'secondary' : 'ghost'}
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
          icon={Copy}
          onClick={onShowDup}
          className="relative"
        >
          查重
          {dupCount > 0 && (
            <span className="ml-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
              {dupCount}
            </span>
          )}
        </Button>
        <Button variant="ghost" icon={Upload} onClick={onShowImport}>
          匯入
        </Button>
        <Button variant="ghost" icon={Download} onClick={exportSelected}>
          匯出
        </Button>
        <Button variant="secondary" icon={Sparkles} onClick={onShowAI}>
          AI 出題
        </Button>
        <Button icon={Plus} onClick={openAdd}>
          新增題目
        </Button>
      </div>

      {/* 篩選 + 排序 */}
      <Card className="space-y-2.5 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={fTopic}
            onChange={(e) => setFTopic(e.target.value)}
            className="max-w-[200px] flex-1"
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
        <Pills
          options={[
            { id: '', label: '全部題型' },
            ...TYPE_ORDER.map((t) => ({ id: t, label: TYPE_LABEL[t] })),
          ]}
          active={fType}
          onChange={(v) => setFType(v as '' | QuestionType)}
          counts={{ '': stats.total, ...stats.byType }}
          size="sm"
        />
        <Pills
          options={[
            { id: '', label: '全部難度' },
            ...DIFF_ORDER.map((d) => ({ id: d, label: DIFF_LABEL[d] })),
          ]}
          active={fDiff}
          onChange={(v) => setFDiff(v as '' | Difficulty)}
          counts={{ '': stats.total, ...stats.byDiff }}
          size="sm"
        />
      </Card>

      {/* 批量操作列 */}
      {selectMode && (
        <Card className="flex flex-wrap items-center gap-2 border-accent/30 bg-accent-soft/50 p-3">
          <button
            onClick={selectAllFiltered}
            aria-pressed={allFilteredSelected}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-accent-strong dark:text-accent"
          >
            {allFilteredSelected ? <CheckSquare size={16} /> : <Square size={16} />}
            全選（{filtered.length}）
          </button>
          <span className="text-sm text-slate-600 dark:text-slate-300">
            已選 <span className="nums font-bold text-accent-strong">{selected.size}</span> 條 · {selectedMarks} 分
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

      {/* 列表 */}
      <p
        className="text-xs text-slate-400 dark:text-slate-500"
        aria-live="polite"
      >
        顯示 <span className="nums">{filtered.length}</span> 條題目
      </p>
      <ul className="space-y-2">
        {filtered.map((q) => (
          <Card key={q.id} className="p-4">
            <div className="flex items-start gap-3">
              {selectMode && (
                <input
                  type="checkbox"
                  checked={selected.has(q.id)}
                  onChange={() => toggleSelect(q.id)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[color:var(--accent)]"
                  aria-label="選取題目"
                />
              )}
              <button
                onClick={() => setExpanded(expanded === q.id ? null : q.id)}
                aria-expanded={expanded === q.id}
                className="flex-1 min-w-0 break-words text-left text-sm text-slate-800 dark:text-slate-100"
              >
                {q.stem}
              </button>
              <div className="flex shrink-0 items-center gap-0.5">
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
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge tone="blue">{TYPE_LABEL[q.type]}</Badge>
              <Badge tone={DIFF_TONE[q.difficulty]}>{DIFF_LABEL[q.difficulty]}</Badge>
              <Badge tone="accent">{topicName(q.topicId)}</Badge>
              {q.marks ? <Badge className="nums">{q.marks} 分</Badge> : null}
              {q.source?.includes('AI') && (
                <Badge tone="slate" icon={Bot}>
                  AI
                </Badge>
              )}
            </div>
            {expanded === q.id && (
              <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 text-sm dark:border-slate-700">
                {q.type === 'mc' && q.options && (
                  <ul className="space-y-1">
                    {q.options.map((o, i) => (
                      <li
                        key={i}
                        className={
                          i === q.answerIndex
                            ? 'flex min-w-0 items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400'
                            : 'min-w-0 text-slate-600 dark:text-slate-300'
                        }
                      >
                        <span className="min-w-0 break-words">
                          {String.fromCharCode(65 + i)}. {o}
                        </span>
                        {i === q.answerIndex && (
                          <Check size={14} className="shrink-0" aria-label="正確答案" />
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {q.type !== 'mc' && q.answer && (
                  <p className="break-words text-slate-600 dark:text-slate-300">
                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                      參考答案：
                    </span>
                    {q.answer}
                  </p>
                )}
                {q.type !== 'mc' && !q.answer && (
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    未有參考答案
                  </p>
                )}
              </div>
            )}
          </Card>
        ))}
      </ul>
      {filtered.length === 0 && (
        <EmptyState
          icon={NotebookPen}
          title={filterActive ? '未有符合條件嘅題目' : '題庫仲未有題目'}
          hint={
            filterActive
              ? '試吓清除篩選，或者用 AI 出題 / 匯入 CSV 補充。'
              : '撳「新增題目」、用「AI 出題」或者「匯入」CSV 開始建立你嘅 BAFS 題庫。'
          }
          action={
            <div className="flex gap-2">
              <Button icon={Plus} onClick={openAdd}>
                新增題目
              </Button>
              <Button variant="secondary" icon={Sparkles} onClick={onShowAI}>
                AI 出題
              </Button>
            </div>
          }
        />
      )}
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
        title="未有資料可分析"
        hint="加入題目後，呢度會顯示題型佔比、難度分佈同課題覆蓋熱圖。"
      />
    )

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
            題型佔比
          </h3>
          <TypeDonut byType={stats.byType} />
        </Card>
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
            難度分佈
          </h3>
          <DifficultyBars byDiff={stats.byDiff} />
          <div className="mt-4 rounded-lg bg-slate-50 p-3 dark:bg-slate-900/40">
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

      <Card className="p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
          課題覆蓋矩陣
        </h3>
        <CoverageMatrix rows={rows} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
            題目最多嘅課題
          </h3>
          {topTopics.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-400 dark:text-slate-500">
              未有資料
            </p>
          ) : (
            <ul className="space-y-2">
              {topTopics.map((r, i) => {
                const max = topTopics[0].total || 1
                return (
                  <li key={r.topicId} className="flex items-center gap-2">
                    <span className="w-5 shrink-0 text-center text-xs font-bold tabular-nums text-slate-400">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="mb-0.5 flex items-center justify-between gap-2">
                        <span className="truncate text-xs text-slate-600 dark:text-slate-300">
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

        <Card className="p-4">
          <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
            覆蓋缺口
            {gaps.length > 0 && (
              <Badge tone="rose">{gaps.length}</Badge>
            )}
          </h3>
          {gaps.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <Check size={28} className="text-emerald-500" />
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                所有課題都有題目，覆蓋完整！
              </p>
            </div>
          ) : (
            <>
              <p className="mb-2 text-xs text-slate-400 dark:text-slate-500">
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
          <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-slate-900/40">
            <p className="text-xs text-slate-500 dark:text-slate-400">
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
                      className={
                        on
                          ? 'rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-white'
                          : 'rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                      }
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
            <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
              題池
            </h3>
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
                    className="flex items-start gap-2 rounded-lg border border-slate-100 p-2 dark:border-slate-700/60"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-xs text-slate-700 dark:text-slate-200">
                        {q.stem}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <Badge tone="blue">{TYPE_LABEL[q.type]}</Badge>
                        <Badge tone={DIFF_TONE[q.difficulty]}>
                          {DIFF_LABEL[q.difficulty]}
                        </Badge>
                        {q.marks ? (
                          <Badge className="nums">{q.marks} 分</Badge>
                        ) : null}
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

        {/* 右：試卷內容 */}
        <Card className={mode === 'manual' ? 'p-4' : 'p-4 lg:col-span-2'}>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              試卷內容
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              <span className="nums font-semibold">{pickedQuestions.length}</span> 題 ·{' '}
              <span className="nums font-semibold">{totalMarks}</span> 分
            </span>
          </div>

          {pickedQuestions.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="試卷仲未有題目"
              hint={
                mode === 'manual'
                  ? '由左邊題池揀題加入，或切去「藍圖自動組卷」。'
                  : '設定藍圖後撳「自動組卷」。'
              }
            />
          ) : (
            <ol className="space-y-2">
              {pickedQuestions.map((q, idx) => (
                <li
                  key={q.id}
                  className="flex items-start gap-2 rounded-lg border border-slate-100 p-2.5 dark:border-slate-700/60"
                >
                  <span className="mt-0.5 w-5 shrink-0 text-center text-xs font-bold tabular-nums text-slate-400">
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-slate-700 dark:text-slate-200">
                      {q.stem}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Badge tone="accent">{topicName(q.topicId)}</Badge>
                      <Badge tone={DIFF_TONE[q.difficulty]}>
                        {DIFF_LABEL[q.difficulty]}
                      </Badge>
                      {q.marks ? <Badge className="nums">{q.marks} 分</Badge> : null}
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
                  className="flex items-center gap-2 rounded-lg border border-slate-100 p-2.5 dark:border-slate-700/60"
                >
                  <FileText size={16} className="shrink-0 text-accent" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">
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
    const payload = {
      topicId: form.topicId,
      type: form.type,
      difficulty: form.difficulty,
      stem: form.stem.trim(),
      options:
        form.type === 'mc' ? form.options.filter((o) => o.trim()) : undefined,
      answerIndex: form.type === 'mc' ? form.answerIndex : undefined,
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
    <Modal open onClose={onClose} title={editing ? '編輯題目' : '新增題目'}>
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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

        <Field label="題目內容">
          <Textarea
            value={form.stem}
            onChange={(e) => set('stem', e.target.value)}
            placeholder="題目內容…"
            rows={3}
          />
        </Field>

        {form.type === 'mc' ? (
          <Field label="選項（揀返左邊個圈做正確答案）">
            <div className="space-y-2">
              {form.options.map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="correct"
                    checked={form.answerIndex === i}
                    onChange={() => set('answerIndex', i)}
                    className="h-4 w-4 accent-[color:var(--accent)]"
                  />
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
                </div>
              ))}
            </div>
          </Field>
        ) : (
          <Field label="參考答案">
            <Textarea
              value={form.answer}
              onChange={(e) => set('answer', e.target.value)}
              placeholder="參考答案…"
              rows={3}
            />
          </Field>
        )}

        <Field label="分數">
          <Input
            value={form.marks}
            onChange={(e) => set('marks', e.target.value.replace(/\D/g, ''))}
            placeholder="分數（可留空）"
            className="w-28"
            inputMode="numeric"
          />
        </Field>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button onClick={save} disabled={!form.stem.trim() || !form.topicId}>
            {editing ? '儲存修改' : '新增題目'}
          </Button>
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
      <div className="space-y-3">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          支援 CSV：欄位為 課題、題型、難度、題幹、選項 A–D、答案、分數。題型 / 難度可用中英；MC
          答案用 A/B/C/D。課題名稱會自動對應到最相近嘅課題。
        </p>

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
          <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-slate-900/40">
            <div
              className="mb-2 flex items-center gap-2 text-xs"
              aria-live="polite"
            >
              <Badge tone="green">可匯入 {preview.parsed.length}</Badge>
              {preview.skipped > 0 && (
                <Badge tone="amber">略過 {preview.skipped}</Badge>
              )}
            </div>
            <ul className="max-h-44 space-y-1 overflow-y-auto">
              {preview.parsed.slice(0, 8).map((r, i) => (
                <li
                  key={i}
                  className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300"
                >
                  <Badge tone="blue">{TYPE_LABEL[r.type]}</Badge>
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

// ═══════════════════════════════════════════════════════════
//  AI 出題 Modal（保留原有流程）
// ═══════════════════════════════════════════════════════════
type AIType = 'mc' | 'short'
const AI_TYPE_OPTIONS: { id: AIType; label: string }[] = [
  { id: 'mc', label: TYPE_LABEL.mc },
  { id: 'short', label: TYPE_LABEL.short },
]
const COUNT_OPTIONS = [3, 5, 8, 10]
const AI_MODEL: AIModel = 'gemini-2.5-flash'

type Draft = {
  _key: string
  stem: string
  options?: string[]
  answerIndex?: number
  answer?: string
  marks?: number
  _selected: boolean
}

function toDraft(raw: unknown, type: AIType): Draft | null {
  if (typeof raw !== 'object' || raw === null) return null
  const o = raw as Record<string, unknown>
  const stem = typeof o.stem === 'string' ? o.stem.trim() : ''
  if (!stem) return null

  const marks = typeof o.marks === 'number' && o.marks > 0 ? o.marks : undefined

  if (type === 'mc') {
    if (!Array.isArray(o.options)) return null
    const options = o.options
      .filter((x): x is string => typeof x === 'string')
      .map((x) => x.trim())
      .filter(Boolean)
    if (options.length < 2) return null
    const idx = typeof o.answerIndex === 'number' ? o.answerIndex : 0
    const answerIndex = idx >= 0 && idx < options.length ? idx : 0
    return { _key: uid(), stem, options, answerIndex, marks, _selected: true }
  }

  const answer = typeof o.answer === 'string' ? o.answer.trim() : ''
  if (!answer) return null
  return { _key: uid(), stem, answer, marks, _selected: true }
}

function buildPrompt(
  topicName: string,
  type: AIType,
  difficulty: Difficulty,
  count: number,
  extra: string,
): string {
  const diffWord = DIFF_LABEL[difficulty]
  const shape =
    type === 'mc'
      ? '{ "stem": "題幹", "options": ["選項A", "選項B", "選項C", "選項D"], "answerIndex": 0, "marks": 1 }（answerIndex 由 0 起，指向正確選項；至少 3 個選項）'
      : '{ "stem": "題幹", "answer": "參考答案", "marks": 3 }'
  return [
    `你係香港高中 BAFS（企業、會計與財務概論）科老師。請就課題「${topicName}」出 ${count} 條${TYPE_LABEL[type]}，難度為「${diffWord}」。`,
    '內容要貼合香港高中 BAFS 課程，用繁體中文。',
    extra.trim() ? `額外要求：${extra.trim()}` : '',
    '',
    `只回一個 JSON 陣列（唔好有任何解釋文字、唔好 markdown），每個元素格式：${shape}`,
    '陣列以外唔好有任何文字。',
  ]
    .filter(Boolean)
    .join('\n')
}

function AIGenerateModal({
  topics,
  onClose,
}: {
  topics: { id: string; topic: string }[]
  onClose: () => void
}) {
  const toast = useToast()
  const { user } = useAuth()

  const [topicId, setTopicId] = useState(topics[0]?.id ?? '')
  const [type, setType] = useState<AIType>('mc')
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [count, setCount] = useState(5)
  const [extra, setExtra] = useState('')

  const [step, setStep] = useState<'setup' | 'review'>('setup')
  const [busy, setBusy] = useState(false)
  const [drafts, setDrafts] = useState<Draft[]>([])

  const topicName = topics.find((t) => t.id === topicId)?.topic ?? ''
  const selectedCount = drafts.filter((d) => d._selected).length

  const generate = async () => {
    if (!topicId || busy) return
    setBusy(true)
    try {
      const out = await complete({
        model: AI_MODEL,
        messages: [
          {
            role: 'user',
            content: buildPrompt(topicName, type, difficulty, count, extra),
          },
        ],
      })
      const rows = extractJsonArray<unknown>(out)
      const parsed = rows
        .map((r) => toDraft(r, type))
        .filter((d): d is Draft => d !== null)
      if (parsed.length === 0) {
        toast.error('AI 出嘅題目格式唔啱，請再試一次。')
        return
      }
      setDrafts(parsed)
      setStep('review')
    } catch (e) {
      toast.error((e as Error).message || 'AI 出題失敗，請再試一次。')
    } finally {
      setBusy(false)
    }
  }

  const toggleDraft = (idx: number) =>
    setDrafts((prev) =>
      prev.map((d, i) => (i === idx ? { ...d, _selected: !d._selected } : d)),
    )

  const editStem = (idx: number, stem: string) =>
    setDrafts((prev) => prev.map((d, i) => (i === idx ? { ...d, stem } : d)))

  const setAll = (value: boolean) =>
    setDrafts((prev) => prev.map((d) => ({ ...d, _selected: value })))

  const commit = () => {
    const chosen = drafts.filter((d) => d._selected && d.stem.trim())
    if (chosen.length === 0) return
    for (const d of chosen) {
      questionsCol.add({
        topicId,
        type,
        difficulty,
        stem: d.stem.trim(),
        options: type === 'mc' ? d.options?.filter((o) => o.trim()) : undefined,
        answerIndex: type === 'mc' ? d.answerIndex : undefined,
        answer: type !== 'mc' ? d.answer?.trim() : undefined,
        marks: d.marks ?? undefined,
        source: 'AI 生成',
        createdAt: new Date().toISOString(),
      })
    }
    toast.success(`已加入 ${chosen.length} 條題目到題庫`)
    onClose()
  }

  if (!isAIConfigured || !user) {
    return (
      <Modal open onClose={onClose} title="AI 出題">
        <div className="space-y-4">
          {!isAIConfigured ? (
            <EmptyState
              icon={Bot}
              title="AI 助手未啟用"
              hint="要設定好 Supabase 並部署 gemini Edge Function 先用到。步驟見 docs/SETUP.md。"
            />
          ) : (
            <EmptyState
              icon={Lock}
              title="請先登入先可以用 AI 出題"
              hint="喺左下角用 Google 登入後就用得。"
            />
          )}
          <div className="flex justify-end">
            <Button variant="secondary" onClick={onClose}>
              關閉
            </Button>
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <Modal open onClose={onClose} title="AI 出題">
      {step === 'setup' ? (
        <div className="space-y-3">
          <Field label="課題">
            <Select value={topicId} onChange={(e) => setTopicId(e.target.value)}>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.topic}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="題型">
            <Pills options={AI_TYPE_OPTIONS} active={type} onChange={setType} />
          </Field>

          <Field label="難度">
            <Pills
              options={DIFF_ORDER.map((d) => ({ id: d, label: DIFF_LABEL[d] }))}
              active={difficulty}
              onChange={setDifficulty}
            />
          </Field>

          <Field label="條數">
            <Select
              value={String(count)}
              onChange={(e) => setCount(Number(e.target.value))}
              className="w-28"
            >
              {COUNT_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n} 條
                </option>
              ))}
            </Select>
          </Field>

          <Field label="補充指示（可留空）">
            <Textarea
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              placeholder="例如：集中考定義同例子、題目要貼香港情境…"
              rows={2}
              disabled={busy}
            />
          </Field>

          {busy && (
            <div
              className="space-y-2 rounded-xl border border-slate-200/80 bg-slate-50/60 p-3 dark:border-slate-700/80 dark:bg-slate-900/40"
              aria-live="polite"
            >
              <p className="text-sm text-slate-500 dark:text-slate-400">
                AI 諗緊題目，請等一等…
              </p>
              <div className="h-2 w-full animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
              <div className="h-2 w-3/4 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={onClose}>
              取消
            </Button>
            <Button
              icon={Sparkles}
              loading={busy}
              onClick={generate}
              disabled={busy || !topicId}
            >
              {busy ? '生成中…' : '生成'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Badge tone="accent">
              {topicName} · {TYPE_LABEL[type]} · {DIFF_LABEL[difficulty]} · 共{' '}
              <span className="nums">{drafts.length}</span> 條
            </Badge>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 dark:text-slate-500">
                已選 <span className="nums">{selectedCount}／{drafts.length}</span>
              </span>
              <Button variant="ghost" size="sm" onClick={() => setAll(true)}>
                全選
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setAll(false)}>
                取消全選
              </Button>
            </div>
          </div>

          <ul className="space-y-2">
            {drafts.map((d, idx) => (
              <Card key={d._key} className="p-3">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={d._selected}
                    onChange={() => toggleDraft(idx)}
                    className="mt-1 h-4 w-4 shrink-0 accent-[color:var(--accent)]"
                    aria-label="加入題庫"
                  />
                  <div className="flex-1 space-y-1.5">
                    <Textarea
                      value={d.stem}
                      onChange={(e) => editStem(idx, e.target.value)}
                      rows={2}
                      className="text-sm"
                    />
                    {type === 'mc' && d.options && (
                      <ul className="space-y-0.5 pl-1 text-sm">
                        {d.options.map((o, i) => (
                          <li
                            key={i}
                            className={
                              i === d.answerIndex
                                ? 'flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400'
                                : 'text-slate-600 dark:text-slate-300'
                            }
                          >
                            <span>
                              {String.fromCharCode(65 + i)}. {o}
                            </span>
                            {i === d.answerIndex && (
                              <Check size={14} className="shrink-0" aria-label="正確答案" />
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                    {type === 'short' && d.answer && (
                      <p className="text-sm text-slate-600 dark:text-slate-300">
                        <span className="font-semibold text-slate-700 dark:text-slate-200">
                          參考答案：
                        </span>
                        {d.answer}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      <Badge tone="blue">{TYPE_LABEL[type]}</Badge>
                      <Badge tone={DIFF_TONE[difficulty]}>
                        {DIFF_LABEL[difficulty]}
                      </Badge>
                      <Badge tone="accent">{topicName}</Badge>
                      {d.marks ? <Badge className="nums">{d.marks} 分</Badge> : null}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </ul>

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <Button variant="ghost" icon={ArrowLeft} onClick={() => setStep('setup')}>
              重新設定
            </Button>
            <Button
              variant="secondary"
              icon={RotateCcw}
              loading={busy}
              onClick={generate}
              disabled={busy}
            >
              {busy ? '生成中…' : '再生成'}
            </Button>
            <Button onClick={commit} disabled={selectedCount === 0}>
              加入題庫（<span className="nums">{selectedCount}</span>）
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
