import { useMemo, useState } from 'react'
import { useCollection } from '../../lib/store'
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

  return (
    <div className="space-y-4">
      {/* 統計 */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="題目總數" value={stats.total} icon="📚" highlight />
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
          onClick={() => {
            setPaperMode((v) => !v)
            if (paperMode) setSelected(new Set())
          }}
        >
          {paperMode ? '退出組卷' : '🗂 組卷'}
        </Button>
        <Button onClick={openAdd}>＋ 新增題目</Button>
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
          <p className="text-sm text-slate-700">
            已選 <span className="font-bold text-accent-strong">
              {selectedQuestions.length}
            </span>{' '}
            條題目 · 總分{' '}
            <span className="font-bold text-accent-strong">{selectedMarks}</span>{' '}
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
              onClick={() => setShowPaper(true)}
            >
              預覽試卷
            </Button>
          </div>
        </Card>
      )}

      {/* 題目列表 */}
      <p className="text-xs text-slate-400">共 {filtered.length} 條題目</p>
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
                className="flex-1 text-left text-sm text-slate-800"
              >
                {q.stem}
              </button>
              <div className="flex shrink-0 items-center gap-0.5">
                <IconButton label="編輯題目" onClick={() => openEdit(q)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M4 20h4l10-10-4-4L4 16v4zM14 6l4 4"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </IconButton>
                <IconButton
                  label="刪除題目"
                  onClick={() => questionsCol.remove(q.id)}
                  className="hover:text-rose-500"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M5 7h14M9 7V5h6v2M7 7l1 13h8l1-13"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </IconButton>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge tone="blue">{TYPE_LABEL[q.type]}</Badge>
              <Badge tone={DIFF_TONE[q.difficulty]}>
                {DIFF_LABEL[q.difficulty]}
              </Badge>
              <Badge tone="accent">{topicName(q.topicId)}</Badge>
              {q.marks ? <Badge>{q.marks} 分</Badge> : null}
            </div>
            {expanded === q.id && (
              <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 text-sm">
                {q.type === 'mc' && q.options && (
                  <ul className="space-y-1">
                    {q.options.map((o, i) => (
                      <li
                        key={i}
                        className={
                          i === q.answerIndex
                            ? 'font-semibold text-emerald-700'
                            : 'text-slate-600'
                        }
                      >
                        {String.fromCharCode(65 + i)}. {o}
                        {i === q.answerIndex && ' ✓'}
                      </li>
                    ))}
                  </ul>
                )}
                {q.type !== 'mc' && q.answer && (
                  <p className="text-slate-600">
                    <span className="font-semibold text-slate-700">
                      參考答案：
                    </span>
                    {q.answer}
                  </p>
                )}
                {q.type !== 'mc' && !q.answer && (
                  <p className="text-xs text-slate-400">未有參考答案</p>
                )}
              </div>
            )}
          </Card>
        ))}
      </ul>
      {filtered.length === 0 && (
        <EmptyState
          icon="📝"
          title="未有符合條件嘅題目"
          hint="撳「＋ 新增題目」開始建立你嘅 BAFS 題庫。"
          action={<Button onClick={openAdd}>＋ 新增題目</Button>}
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
    } else {
      questionsCol.add({ ...payload, createdAt: new Date().toISOString() })
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
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <p className="text-sm font-semibold text-slate-800">
              BAFS 自擬試卷
            </p>
            <p className="text-xs text-slate-500">
              共 {questions.length} 題 · 總分 {totalMarks} 分
            </p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => window.print()}>
            🖨 列印
          </Button>
        </div>

        <ol className="space-y-4">
          {questions.map((q, idx) => (
            <li key={q.id} className="space-y-1.5">
              <div className="flex items-start gap-2">
                <span className="text-sm font-semibold text-slate-700">
                  {idx + 1}.
                </span>
                <div className="flex-1 space-y-1.5">
                  <p className="text-sm text-slate-800">
                    {q.stem}
                    {q.marks ? (
                      <span className="ml-1 text-xs text-slate-400">
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
                    <ul className="space-y-0.5 pl-1 text-sm text-slate-600">
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
          <p className="py-6 text-center text-sm text-slate-400">
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
