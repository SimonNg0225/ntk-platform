import { useMemo, useState } from 'react'
import {
  ArrowLeft,
  BookMarked,
  Bot,
  Check,
  FolderOpen,
  Lock,
  NotebookPen,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { uid, useCollection } from '../../lib/store'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import { useAuth } from '../../context/AuthContext'
import { complete, isAIConfigured, type AIModel } from '../../lib/aiClient'
import { extractJsonArray } from '../../lib/aiJson'
import { questionsCol, topicsCol } from '../../data/collections'
import type { Difficulty, Question, QuestionType } from '../../data/types'
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
  Select,
  StatCard,
  Textarea,
} from '../../ui'

// ───── 標籤 / 樣式對照 ─────
const TYPE_LABEL: Record<QuestionType, string> = {
  mc: '選擇題',
  short: '短答題',
  long: '長題目',
  case: '個案',
}
const TYPE_ORDER: QuestionType[] = ['mc', 'short', 'long', 'case']

const DIFF_LABEL: Record<Difficulty, string> = {
  easy: '易',
  medium: '中',
  hard: '難',
}
const DIFF_ORDER: Difficulty[] = ['easy', 'medium', 'hard']
const DIFF_TONE: Record<Difficulty, 'green' | 'amber' | 'rose'> = {
  easy: 'green',
  medium: 'amber',
  hard: 'rose',
}

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

export default function QuestionBank() {
  const toast = useToast()
  const confirm = useConfirm()
  const questions = useCollection(questionsCol)
  const topics = useCollection(topicsCol)

  // 篩選 / 搜尋
  const [fTopic, setFTopic] = useState('')
  const [fType, setFType] = useState<'' | QuestionType>('')
  const [fDiff, setFDiff] = useState<'' | Difficulty>('')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  // 新增 / 編輯 Modal
  const [editing, setEditing] = useState<Question | null>(null)
  const [showForm, setShowForm] = useState(false)

  // AI 出題 Modal
  const [showAI, setShowAI] = useState(false)

  // 組卷
  const [paperMode, setPaperMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showPaper, setShowPaper] = useState(false)

  const topicName = (id: string) =>
    topics.find((t) => t.id === id)?.topic ?? '未分類'

  // ───── 統計 ─────
  const stats = useMemo(() => {
    const byType: Record<QuestionType, number> = {
      mc: 0,
      short: 0,
      long: 0,
      case: 0,
    }
    for (const q of questions) byType[q.type]++
    return { total: questions.length, byType }
  }, [questions])

  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase()
    return questions
      .filter((q) => (fTopic ? q.topicId === fTopic : true))
      .filter((q) => (fType ? q.type === fType : true))
      .filter((q) => (fDiff ? q.difficulty === fDiff : true))
      .filter((q) => (kw ? q.stem.toLowerCase().includes(kw) : true))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  }, [questions, fTopic, fType, fDiff, search])

  // ───── 組卷選取 ─────
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

  const openPaper = () => {
    setShowPaper(true)
    toast.success(`已選 ${selectedQuestions.length} 條題目 · 共 ${selectedMarks} 分`)
  }

  return (
    <div className="space-y-4">
      {/* 統計 */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="題目總數" value={stats.total} icon={BookMarked} highlight />
        {TYPE_ORDER.map((t) => (
          <StatCard
            key={t}
            label={TYPE_LABEL[t]}
            value={stats.byType[t]}
            unit="題"
          />
        ))}
      </div>

      {/* 工具列 */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜尋題目…"
          className="min-w-[140px] flex-1"
        />
        <Button
          variant={paperMode ? 'secondary' : 'ghost'}
          icon={FolderOpen}
          onClick={() => {
            setPaperMode((v) => !v)
            if (paperMode) setSelected(new Set())
          }}
        >
          {paperMode ? '退出組卷' : '組卷'}
        </Button>
        <Button variant="secondary" icon={Sparkles} onClick={() => setShowAI(true)}>
          AI 出題
        </Button>
        <Button icon={Plus} onClick={openAdd}>
          新增題目
        </Button>
      </div>

      {/* 篩選 */}
      <div className="space-y-2">
        <Select
          value={fTopic}
          onChange={(e) => setFTopic(e.target.value)}
          className="max-w-xs"
        >
          <option value="">全部課題</option>
          {topics.map((t) => (
            <option key={t.id} value={t.id}>
              {t.topic}
            </option>
          ))}
        </Select>
        <Pills
          options={[
            { id: '', label: '全部題型' },
            ...TYPE_ORDER.map((t) => ({ id: t, label: TYPE_LABEL[t] })),
          ]}
          active={fType}
          onChange={(v) => setFType(v as '' | QuestionType)}
        />
        <Pills
          options={[
            { id: '', label: '全部難度' },
            ...DIFF_ORDER.map((d) => ({ id: d, label: DIFF_LABEL[d] })),
          ]}
          active={fDiff}
          onChange={(v) => setFDiff(v as '' | Difficulty)}
        />
      </div>

      {/* 組卷狀態列 */}
      {paperMode && (
        <Card className="flex flex-wrap items-center justify-between gap-2 border-accent/30 bg-accent-soft/50 p-3">
          <p className="text-sm text-slate-700 dark:text-slate-200">
            已選 <span className="nums font-bold text-accent-strong">
              {selectedQuestions.length}
            </span>{' '}
            條題目 · 總分{' '}
            <span className="nums font-bold text-accent-strong">{selectedMarks}</span>{' '}
            分
          </p>
          <div className="flex gap-2">
            {selected.size > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelected(new Set())}
              >
                清除
              </Button>
            )}
            <Button
              size="sm"
              disabled={selectedQuestions.length === 0}
              onClick={openPaper}
            >
              預覽試卷
            </Button>
          </div>
        </Card>
      )}

      {/* 題目列表 */}
      <p className="text-xs text-slate-400 dark:text-slate-500">
        共 <span className="nums">{filtered.length}</span> 條題目
      </p>
      <ul className="space-y-2">
        {filtered.map((q) => (
          <Card key={q.id} className="p-4">
            <div className="flex items-start gap-3">
              {paperMode && (
                <input
                  type="checkbox"
                  checked={selected.has(q.id)}
                  onChange={() => toggleSelect(q.id)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[color:var(--accent)]"
                  aria-label="加入試卷"
                />
              )}
              <button
                onClick={() => setExpanded(expanded === q.id ? null : q.id)}
                className="flex-1 text-left text-sm text-slate-800 dark:text-slate-100"
              >
                {q.stem}
              </button>
              <div className="flex shrink-0 items-center gap-0.5">
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
              <Badge tone={DIFF_TONE[q.difficulty]}>
                {DIFF_LABEL[q.difficulty]}
              </Badge>
              <Badge tone="accent">{topicName(q.topicId)}</Badge>
              {q.marks ? <Badge className="nums">{q.marks} 分</Badge> : null}
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
                            ? 'flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400'
                            : 'text-slate-600 dark:text-slate-300'
                        }
                      >
                        <span>
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
                  <p className="text-slate-600 dark:text-slate-300">
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
          title="未有符合條件嘅題目"
          hint="撳「新增題目」開始建立你嘅 BAFS 題庫。"
          action={
            <Button icon={Plus} onClick={openAdd}>
              新增題目
            </Button>
          }
        />
      )}

      {/* 新增 / 編輯 Modal */}
      {showForm && (
        <QuestionFormModal
          key={editing ? `edit-${editing.id}` : 'add'}
          editing={editing}
          topics={topics}
          onClose={() => setShowForm(false)}
        />
      )}

      {/* AI 出題 Modal */}
      {showAI && (
        <AIGenerateModal topics={topics} onClose={() => setShowAI(false)} />
      )}

      {/* 預覽試卷 Modal */}
      <PaperPreviewModal
        open={showPaper}
        onClose={() => setShowPaper(false)}
        questions={selectedQuestions}
        totalMarks={selectedMarks}
        topicName={topicName}
      />
    </div>
  )
}

// ───────── 新增 / 編輯題目 Modal ─────────
// 由呼叫端用 key 重建，所以初始值只需喺 useState 初始化一次。
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
    <Modal
      open
      onClose={onClose}
      title={editing ? '編輯題目' : '新增題目'}
    >
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
                      form.options.map((x, k) =>
                        k === i ? e.target.value : x,
                      ),
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
          onChange={(e) =>
            set('marks', e.target.value.replace(/\D/g, ''))
          }
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

// ───────── 預覽試卷 Modal ─────────
function PaperPreviewModal({
  open,
  onClose,
  questions,
  totalMarks,
  topicName,
}: {
  open: boolean
  onClose: () => void
  questions: Question[]
  totalMarks: number
  topicName: (id: string) => string
}) {
  return (
    <Modal open={open} onClose={onClose} title="預覽試卷">
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-700">
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              BAFS 自擬試卷
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              共 <span className="nums">{questions.length}</span> 題 · 總分{' '}
              <span className="nums">{totalMarks}</span> 分
            </p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            icon={Printer}
            onClick={() => window.print()}
          >
            列印
          </Button>
        </div>

        <ol className="space-y-4">
          {questions.map((q, idx) => (
            <li key={q.id} className="space-y-1.5">
              <div className="flex items-start gap-2">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {idx + 1}.
                </span>
                <div className="flex-1 space-y-1.5">
                  <p className="text-sm text-slate-800 dark:text-slate-100">
                    {q.stem}
                    {q.marks ? (
                      <span className="nums ml-1 text-xs text-slate-400 dark:text-slate-500">
                        （{q.marks} 分）
                      </span>
                    ) : null}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge tone="blue">{TYPE_LABEL[q.type]}</Badge>
                    <Badge tone={DIFF_TONE[q.difficulty]}>
                      {DIFF_LABEL[q.difficulty]}
                    </Badge>
                    <Badge tone="accent">{topicName(q.topicId)}</Badge>
                  </div>
                  {q.type === 'mc' && q.options && (
                    <ul className="space-y-0.5 pl-1 text-sm text-slate-600 dark:text-slate-300">
                      {q.options.map((o, i) => (
                        <li key={i}>
                          {String.fromCharCode(65 + i)}. {o}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>

        {questions.length === 0 && (
          <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">
            未揀任何題目。
          </p>
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

// ───────── AI 出題 Modal ─────────
// 老師揀課題／題型（mc／short）／難度／條數 → 叫 Gemini 出題 →
// AI 回 JSON → 逐條 parse 成草稿 → 預覽剔選 → 逐條 questionsCol.add()。
// 入庫後完美重用現有篩選／組卷／列印流程，毋須任何後續改動。

// AI 出題刻意只支援 mc / short（long / case 太開放、難 auto-parse）
type AIType = 'mc' | 'short'
const AI_TYPE_OPTIONS: { id: AIType; label: string }[] = [
  { id: 'mc', label: TYPE_LABEL.mc },
  { id: 'short', label: TYPE_LABEL.short },
]
const COUNT_OPTIONS = [3, 5, 8, 10]
const AI_MODEL: AIModel = 'gemini-2.5-flash'

// AI 回嘅一條題目草稿（純前端暫存，唔 export、唔入 types.ts、唔落 collection）
// _key：建立時用 uid() 派一個穩定 key，等內聯編輯題幹時 <Textarea> 唔會
//       因為 re-render 重新 mount 而失焦。
type Draft = {
  _key: string
  stem: string
  options?: string[]
  answerIndex?: number
  answer?: string
  marks?: number
  _selected: boolean
}

// 將 AI 回嘅一條 unknown 安全收窄成 Draft（唔合格回 null）
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

  // short：要有參考答案
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

  // ── 守門：未啟用 / 未登入 ──────────────────────────────────
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
            <Select
              value={topicId}
              onChange={(e) => setTopicId(e.target.value)}
            >
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
            <div className="space-y-2 rounded-xl border border-slate-200/80 bg-slate-50/60 p-3 dark:border-slate-700/80 dark:bg-slate-900/40">
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
