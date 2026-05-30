import { useMemo, useState } from 'react'
import { useCollection } from '../../lib/store'
import { questionsCol, topicsCol } from '../../data/collections'
import type { Difficulty, QuestionType } from '../../data/types'

const TYPE_LABEL: Record<QuestionType, string> = {
  mc: '選擇題',
  short: '短答題',
  long: '長題目',
  case: '個案',
}
const DIFF_LABEL: Record<Difficulty, string> = {
  easy: '易',
  medium: '中',
  hard: '難',
}
const DIFF_CLS: Record<Difficulty, string> = {
  easy: 'bg-emerald-100 text-emerald-700',
  medium: 'bg-amber-100 text-amber-700',
  hard: 'bg-rose-100 text-rose-700',
}

export default function QuestionBank() {
  const questions = useCollection(questionsCol)
  const topics = useCollection(topicsCol)

  const [showForm, setShowForm] = useState(false)
  const [fTopic, setFTopic] = useState('')
  const [fType, setFType] = useState('')
  const [fDiff, setFDiff] = useState('')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  const topicName = (id: string) =>
    topics.find((t) => t.id === id)?.topic ?? '未分類'

  const filtered = useMemo(() => {
    return questions
      .filter((q) => (fTopic ? q.topicId === fTopic : true))
      .filter((q) => (fType ? q.type === fType : true))
      .filter((q) => (fDiff ? q.difficulty === fDiff : true))
      .filter((q) =>
        search ? q.stem.toLowerCase().includes(search.toLowerCase()) : true,
      )
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  }, [questions, fTopic, fType, fDiff, search])

  return (
    <div className="space-y-4">
      {/* 工具列 */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜尋題目…"
          className="min-w-[140px] flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
        />
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-strong"
        >
          {showForm ? '收起' : '＋ 新增題目'}
        </button>
      </div>

      {/* 篩選 */}
      <div className="flex flex-wrap gap-2">
        <Select value={fTopic} onChange={setFTopic} placeholder="全部課題">
          {topics.map((t) => (
            <option key={t.id} value={t.id}>
              {t.topic}
            </option>
          ))}
        </Select>
        <Select value={fType} onChange={setFType} placeholder="全部題型">
          {(Object.keys(TYPE_LABEL) as QuestionType[]).map((k) => (
            <option key={k} value={k}>
              {TYPE_LABEL[k]}
            </option>
          ))}
        </Select>
        <Select value={fDiff} onChange={setFDiff} placeholder="全部難度">
          {(Object.keys(DIFF_LABEL) as Difficulty[]).map((k) => (
            <option key={k} value={k}>
              {DIFF_LABEL[k]}
            </option>
          ))}
        </Select>
      </div>

      {showForm && <AddForm onDone={() => setShowForm(false)} />}

      {/* 題目列表 */}
      <p className="text-xs text-slate-400">共 {filtered.length} 條題目</p>
      <ul className="space-y-2">
        {filtered.map((q) => (
          <li
            key={q.id}
            className="rounded-2xl border border-slate-200 bg-white p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <button
                onClick={() => setExpanded(expanded === q.id ? null : q.id)}
                className="flex-1 text-left text-sm text-slate-800"
              >
                {q.stem}
              </button>
              <button
                onClick={() => questionsCol.remove(q.id)}
                className="shrink-0 text-xs text-slate-300 hover:text-red-500"
              >
                刪除
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Chip>{topicName(q.topicId)}</Chip>
              <Chip>{TYPE_LABEL[q.type]}</Chip>
              <span
                className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${DIFF_CLS[q.difficulty]}`}
              >
                {DIFF_LABEL[q.difficulty]}
              </span>
              {q.marks ? <Chip>{q.marks} 分</Chip> : null}
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
                            ? 'font-semibold text-accent-strong'
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
              </div>
            )}
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="rounded-xl bg-slate-50 px-4 py-10 text-center text-sm text-slate-400">
            未有符合條件嘅題目。撳「＋ 新增題目」開始建立題庫。
          </li>
        )}
      </ul>
    </div>
  )
}

// ───── 新增題目表單 ─────
function AddForm({ onDone }: { onDone: () => void }) {
  const topics = useCollection(topicsCol)
  const [topicId, setTopicId] = useState(topics[0]?.id ?? '')
  const [type, setType] = useState<QuestionType>('mc')
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [stem, setStem] = useState('')
  const [options, setOptions] = useState(['', '', '', ''])
  const [answerIndex, setAnswerIndex] = useState(0)
  const [answer, setAnswer] = useState('')
  const [marks, setMarks] = useState('')

  const save = () => {
    if (!stem.trim() || !topicId) return
    questionsCol.add({
      topicId,
      type,
      difficulty,
      stem: stem.trim(),
      options: type === 'mc' ? options.filter((o) => o.trim()) : undefined,
      answerIndex: type === 'mc' ? answerIndex : undefined,
      answer: type !== 'mc' ? answer.trim() : undefined,
      marks: marks ? Number(marks) : undefined,
      createdAt: new Date().toISOString(),
    })
    onDone()
  }

  return (
    <div className="space-y-3 rounded-2xl border border-accent/30 bg-accent-soft/40 p-4">
      <div className="flex flex-wrap gap-2">
        <Select value={topicId} onChange={setTopicId} placeholder="揀課題">
          {topics.map((t) => (
            <option key={t.id} value={t.id}>
              {t.topic}
            </option>
          ))}
        </Select>
        <Select
          value={type}
          onChange={(v) => setType(v as QuestionType)}
          placeholder="題型"
        >
          {(Object.keys(TYPE_LABEL) as QuestionType[]).map((k) => (
            <option key={k} value={k}>
              {TYPE_LABEL[k]}
            </option>
          ))}
        </Select>
        <Select
          value={difficulty}
          onChange={(v) => setDifficulty(v as Difficulty)}
          placeholder="難度"
        >
          {(Object.keys(DIFF_LABEL) as Difficulty[]).map((k) => (
            <option key={k} value={k}>
              {DIFF_LABEL[k]}
            </option>
          ))}
        </Select>
      </div>

      <textarea
        value={stem}
        onChange={(e) => setStem(e.target.value)}
        placeholder="題目內容…"
        rows={2}
        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
      />

      {type === 'mc' ? (
        <div className="space-y-2">
          {options.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="radio"
                name="correct"
                checked={answerIndex === i}
                onChange={() => setAnswerIndex(i)}
                className="h-4 w-4 accent-[color:var(--accent)]"
              />
              <input
                value={o}
                onChange={(e) =>
                  setOptions(options.map((x, k) => (k === i ? e.target.value : x)))
                }
                placeholder={`選項 ${String.fromCharCode(65 + i)}`}
                className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-accent"
              />
            </div>
          ))}
          <p className="text-xs text-slate-400">揀返左邊個圈做正確答案</p>
        </div>
      ) : (
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="參考答案…"
          rows={2}
          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
        />
      )}

      <div className="flex items-center gap-2">
        <input
          value={marks}
          onChange={(e) => setMarks(e.target.value.replace(/\D/g, ''))}
          placeholder="分數"
          className="w-24 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <button
          onClick={save}
          className="ml-auto rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-strong"
        >
          儲存題目
        </button>
      </div>
    </div>
  )
}

// ───── 細元件 ─────
function Select({
  value,
  onChange,
  placeholder,
  children,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  children: React.ReactNode
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-accent"
    >
      <option value="">{placeholder}</option>
      {children}
    </select>
  )
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
      {children}
    </span>
  )
}
