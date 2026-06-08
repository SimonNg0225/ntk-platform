import { useState } from 'react'
import { Loader2, Sparkles, Check, ArrowRight } from 'lucide-react'
import { Badge, Button, Field, Modal, SegmentedControl, Select, cx } from '../../../ui'
import { useToast } from '../../../context/ToastContext'
import { useNav } from '../../../context/NavContext'
import { useCollection } from '../../../lib/store'
import { questionsCol, topicsCol } from '../../../data/collections'
import type { Difficulty } from '../../../data/types'
import { generate, type GenDraft, type GenKind } from '../../work/materialGen/engine'

// ============================================================
//  由筆記出練習 — reuse materialGen generate()，存入題庫，可即去自測
// ============================================================

const KIND_OPTS: { id: GenKind; label: string }[] = [
  { id: 'mc', label: 'MC' },
  { id: 'short', label: '短答' },
  { id: 'long', label: '長題' },
  { id: 'case', label: '個案' },
]
const DIFF_OPTS: { id: Difficulty; label: string }[] = [
  { id: 'easy', label: '淺' },
  { id: 'medium', label: '中' },
  { id: 'hard', label: '深' },
]
const NEW_TOPIC = '__new__'

export default function PracticeGenModal({
  note,
  onClose,
}: {
  note: { title: string; content: string }
  onClose: () => void
}) {
  const toast = useToast()
  const nav = useNav()
  const topics = useCollection(topicsCol)

  const [kind, setKind] = useState<GenKind>('mc')
  const [count, setCount] = useState(5)
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [topicChoice, setTopicChoice] = useState<string>(NEW_TOPIC)
  const [busy, setBusy] = useState(false)
  const [drafts, setDrafts] = useState<GenDraft[] | null>(null)
  const [saved, setSaved] = useState(false)

  const noteTitle = note.title.trim() || '未命名筆記'

  async function gen() {
    if (busy) return
    setBusy(true)
    setSaved(false)
    try {
      const out = await generate(kind, {
        topicName: noteTitle,
        difficulty,
        count,
        extra: `根據以下筆記內容出題，要緊扣內容、唔好離題：\n\n${note.content}`,
      })
      if (out.length === 0) throw new Error('生成唔到題目，試吓換題型或補多啲筆記內容。')
      setDrafts(out)
    } catch (e) {
      toast.error((e as Error).message || '生成失敗，請再試。')
    } finally {
      setBusy(false)
    }
  }

  function save() {
    if (!drafts || drafts.length === 0) return
    let topicId = topicChoice
    if (topicChoice === NEW_TOPIC) {
      const t = topicsCol.add({
        part: '自訂',
        area: '筆記練習',
        topic: noteTitle,
        order: 9000,
      })
      topicId = t.id
    }
    const now = new Date().toISOString()
    for (const d of drafts) {
      questionsCol.add({
        topicId,
        type: d.type,
        difficulty,
        stem: d.stem,
        options: d.options,
        answerIndex: d.answerIndex,
        answer: d.answer,
        marks: d.marks,
        source: `筆記：${noteTitle}`,
        tags: ['來自筆記'],
        createdAt: now,
      })
    }
    setSaved(true)
    toast.success(`已存入題庫 ${drafts.length} 題`)
  }

  return (
    <Modal open onClose={onClose} title="由筆記出練習" size="lg">
      <div className="space-y-4">
        {/* 設定 */}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="題型">
            <SegmentedControl options={KIND_OPTS} value={kind} onChange={setKind} />
          </Field>
          <Field label="難度">
            <SegmentedControl options={DIFF_OPTS} value={difficulty} onChange={setDifficulty} />
          </Field>
          <Field label="數量">
            <Select value={String(count)} onChange={(e) => setCount(Number(e.target.value))}>
              {[3, 5, 8, 10].map((n) => (
                <option key={n} value={n}>
                  {n} 題
                </option>
              ))}
            </Select>
          </Field>
          <Field label="存入題庫">
            <Select value={topicChoice} onChange={(e) => setTopicChoice(e.target.value)}>
              <option value={NEW_TOPIC}>＋ 新題庫（{noteTitle}）</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.topic}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Button icon={Sparkles} onClick={gen} loading={busy} fullWidth>
          {busy ? '生成緊…' : drafts ? '重新生成' : '生成題目'}
        </Button>

        {busy && (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-slate-400">
            <Loader2 size={16} className="animate-spin text-accent" /> 由筆記出緊題…
          </div>
        )}

        {/* 預覽 */}
        {drafts && drafts.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500">
              預覽（{drafts.length} 題）
            </p>
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {drafts.map((d, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-black/[0.06] bg-slate-50/60 p-3 dark:border-white/[0.08] dark:bg-slate-800/40"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-xs font-semibold tabular-nums text-slate-400">{i + 1}</span>
                    <p className="min-w-0 flex-1 text-sm text-slate-700 dark:text-slate-200">{d.stem}</p>
                  </div>
                  {d.type === 'mc' && d.options && (
                    <ul className="mt-1.5 space-y-0.5 pl-6">
                      {d.options.map((o, oi) => (
                        <li
                          key={oi}
                          className={cx(
                            'text-xs',
                            oi === d.answerIndex
                              ? 'font-medium text-emerald-600 dark:text-emerald-400'
                              : 'text-slate-500 dark:text-slate-400',
                          )}
                        >
                          {String.fromCharCode(65 + oi)}. {o}
                          {oi === d.answerIndex && ' ✓'}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>

            {/* 行動 */}
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-black/[0.06] pt-3 dark:border-white/[0.08]">
              {saved ? (
                <>
                  <span className="mr-auto inline-flex items-center gap-1 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                    <Check size={15} /> 已存入題庫
                  </span>
                  <Button
                    variant="secondary"
                    iconRight={ArrowRight}
                    onClick={() => {
                      nav.open('quiz')
                      onClose()
                    }}
                  >
                    即去自我測驗
                  </Button>
                </>
              ) : (
                <Button onClick={save}>存入題庫</Button>
              )}
            </div>
          </div>
        )}

        <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
          <Badge tone="slate">來自筆記</Badge> 存入後可去「自我測驗」自測，或喺題庫出卷畀學生。
        </p>
      </div>
    </Modal>
  )
}
