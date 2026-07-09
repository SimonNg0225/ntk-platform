import { useState } from 'react'
import {
  ArrowLeft,
  Bot,
  Brain,
  Check,
  Lock,
  Plus,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Target,
} from 'lucide-react'
import CreditMeter from '../../../components/CreditMeter'
import { uid } from '../../../lib/store'
import { useToast } from '../../../context/ToastContext'
import { useAuth } from '../../../context/AuthContext'
import { useSettings } from '../../../context/SettingsContext'
import { isAIConfigured } from '../../../lib/aiClient'
import { classifyAIError } from '../../../lib/aiError'
import { questionsCol } from '../../../data/collections'
import { getSubjectPack } from '../../../data/subjects'
import type { Difficulty } from '../../../data/types'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Modal,
  Pills,
  Select,
  Textarea,
} from '../../../ui'
import {
  compactMcOptions,
  DIFF_LABEL,
  DIFF_ORDER,
  DIFF_TONE,
  TYPE_LABEL,
} from '../questionbank/util'
import { generate, type GenDraft, type GenKind } from './engine'
import { examSpecForSubject } from './examSpecs'

// ============================================================
//  QuestionGeneratorModal — 可重用的 AI 教材生成 modal
//  ------------------------------------------------------------
//  鎖定單一題型（kind），跑共用引擎 generate() → 預覽逐條選擇／改 →
//  存入題庫（questionsCol）。同 QuestionBank 的 AIGenerateModal 共用
//  engine.ts，但本元件完全獨立（直接 import 引擎 + collections），
//  給 Phase C「教材生成」hub 重用而不會牽動題庫。
//
//  · 行為 / gate / 文案對齊題庫的 AI 出題流程。
//  · mode 色用 --accent（工作模式 = teal），深色 / 375px OK。
// ============================================================

const COUNT_OPTIONS = [3, 5, 8, 10]

const PROMPT_EXAMPLES = [
  '貼香港中小企情境',
  '集中考定義同例子',
  '加入計算題',
  '連埋常見錯誤分析',
]

const MC_PROMPT_EXAMPLES = [
  '每題要有商業情境',
  '干擾選項要似學生常犯錯',
  '加入 DSE 風格判斷題',
  '每個選項都要解釋',
]

type Draft = GenDraft & { _key: string; _selected: boolean }

export interface QuestionGeneratorModalProps {
  /** 鎖定生成題型（hub 每張卡對應一種） */
  kind: GenKind
  topics: { id: string; topic: string }[]
  initialExtra?: string
  onClose: () => void
  /** 成功存入題庫後回呼（傳新增條數），給 hub 更新計數 / toast */
  onSaved?: (count: number) => void
}

const KIND_TITLE: Record<GenKind, string> = {
  mc: 'AI 生成選擇題',
  short: 'AI 生成短答題',
  long: 'AI 生成結構式長題',
  case: 'AI 生成教學個案',
}

function letter(i: number): string {
  return String.fromCharCode(65 + i)
}

function formatMcAnswerGuide(d: GenDraft): string | undefined {
  if (!d.options?.length) return undefined
  const lines: string[] = []
  if (typeof d.answerIndex === 'number') {
    lines.push(`正確答案：${letter(d.answerIndex)}`)
  }
  if (d.testedConcept) lines.push(`考核概念：${d.testedConcept}`)
  if (d.examSkill) lines.push(`能力要求：${d.examSkill}`)
  if (d.trap) lines.push(`常見錯因：${d.trap}`)
  if (d.rationales?.length) {
    lines.push('選項解釋：')
    d.options.forEach((option, i) => {
      const rationale = d.rationales?.[i]
      lines.push(`${letter(i)}. ${option}${rationale ? ` — ${rationale}` : ''}`)
    })
  }
  if (d.followUp) lines.push(`跟進建議：${d.followUp}`)
  return lines.length > 0 ? lines.join('\n') : undefined
}

export function QuestionGeneratorModal({
  kind,
  topics,
  initialExtra = '',
  onClose,
  onSaved,
}: QuestionGeneratorModalProps) {
  const toast = useToast()
  const { user } = useAuth()
  const { subjectPackId } = useSettings()
  const subjectName = getSubjectPack(subjectPackId)?.name
  const examSpec = examSpecForSubject(subjectName)

  const [topicId, setTopicId] = useState(topics[0]?.id ?? '')
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [count, setCount] = useState(5)
  const [extra, setExtra] = useState(initialExtra)

  const [step, setStep] = useState<'setup' | 'review'>('setup')
  const [busy, setBusy] = useState(false)
  const [drafts, setDrafts] = useState<Draft[]>([])

  const title = KIND_TITLE[kind]
  const topicName = topics.find((t) => t.id === topicId)?.topic ?? ''
  const selectedCount = drafts.filter((d) => d._selected).length
  const isLongForm = kind === 'long' || kind === 'case'
  const promptExamples = kind === 'mc' ? MC_PROMPT_EXAMPLES : PROMPT_EXAMPLES

  const run = async () => {
    if (!topicId || busy) return
    setBusy(true)
    try {
      const out = await generate(kind, { topicName, difficulty, count, extra, subject: getSubjectPack(subjectPackId)?.name })
      const parsed: Draft[] = out.map((d) => ({
        ...d,
        _key: uid(),
        _selected: true,
      }))
      if (parsed.length === 0) {
        toast.error('AI 出的題目格式不正確，請再試一次。')
        return
      }
      setDrafts(parsed)
      setStep('review')
    } catch (e) {
      toast.error(classifyAIError(e).message, { label: '重試', onClick: run })
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
      const mc =
        kind === 'mc'
          ? compactMcOptions(d.options ?? [], d.answerIndex ?? 0)
          : null
      questionsCol.add({
        topicId,
        type: kind,
        difficulty,
        stem: d.stem.trim(),
        options: mc ? mc.options : undefined,
        answerIndex: mc ? mc.answerIndex : undefined,
        answer:
          kind === 'mc'
            ? formatMcAnswerGuide({
                ...d,
                options: mc?.options ?? d.options,
                answerIndex: mc?.answerIndex ?? d.answerIndex,
              })
            : d.answer?.trim(),
        marks: d.marks ?? undefined,
        source: kind === 'mc' ? `AI 生成 · ${examSpec.shortLabel}` : 'AI 生成',
        createdAt: new Date().toISOString(),
      })
    }
    toast.success(`已加入 ${chosen.length} 條題目到題庫`)
    onSaved?.(chosen.length)
    onClose()
  }

  if (!isAIConfigured || !user) {
    return (
      <Modal open onClose={onClose} title={title}>
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
              title="請先登入以使用 AI 出題"
              hint="在左下角使用 Google 登入後即可使用。"
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
    <Modal open onClose={onClose} title={title}>
      {step === 'setup' ? (
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-2xl border border-accent/20 bg-accent-soft/50 p-3.5 dark:border-accent/25 dark:bg-accent/10">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent text-white">
              <Sparkles size={16} />
            </span>
            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              選擇好課題同難度，AI 會幫你草擬一批貼合香港{subjectName ?? '中學'}課程的
              {TYPE_LABEL[kind]}。生成後可以逐條重新選擇要邊條先加入題庫。
            </p>
          </div>

          {kind === 'mc' && (
            <section className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-700/60 dark:bg-slate-900/40">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
                      <ShieldCheck size={16} />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {examSpec.label}已啟用
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        生成前先做出題藍圖，生成後附考核點、陷阱和選項解釋。
                      </p>
                    </div>
                  </div>
                </div>
                <Badge tone={examSpec.id === 'bafs-dse' ? 'accent' : 'blue'}>
                  {examSpec.shortLabel}
                </Badge>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {[
                  ['出題藍圖', '先定考核概念與能力層次'],
                  ['合理干擾項', '每個錯項都有常見錯因'],
                  ['教師審核', '逐項解釋，方便快速修題'],
                ].map(([title, desc]) => (
                  <div
                    key={title}
                    className="rounded-xl border border-slate-200/70 bg-slate-50/70 px-3 py-2 dark:border-slate-700/70 dark:bg-slate-800/60"
                  >
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                      {title}
                    </p>
                    <p className="mt-0.5 text-[11px] leading-4 text-slate-500 dark:text-slate-400">
                      {desc}
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                {examSpec.teacherReviewHint}
              </p>
            </section>
          )}

          <section className="space-y-3 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 dark:border-slate-700/60 dark:bg-slate-900/40">
            <Field label="課題">
              <Select value={topicId} onChange={(e) => setTopicId(e.target.value)}>
                {topics.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.topic}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
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
            </div>
          </section>

          <Field label="補充指示（可留空）">
            <Textarea
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              placeholder="例如：集中考定義同例子、題目要貼香港情境…"
              rows={2}
              disabled={busy}
            />
          </Field>
          <div className="-mt-2.5 flex flex-wrap gap-1.5">
            {promptExamples.map((ex) => (
              <button
                key={ex}
                type="button"
                disabled={busy}
                onClick={() => setExtra((prev) => (prev.trim() ? `${prev}；${ex}` : ex))}
                className="inline-flex min-h-11 items-center gap-1 rounded-full border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 transition hover:border-accent/40 hover:bg-accent-soft hover:text-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.98] disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-accent/40 dark:hover:bg-accent/10 dark:hover:text-accent"
              >
                <Plus size={12} />
                {ex}
              </button>
            ))}
          </div>

          {busy && (
            <div
              className="space-y-2 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 dark:border-slate-700/80 dark:bg-slate-900/40"
              aria-live="polite"
            >
              <p className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <Sparkles size={15} className="animate-pulse text-accent" />
                AI 想緊題目，請等一等…
              </p>
              <div className="h-2.5 w-full animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
              <div className="h-2.5 w-4/5 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
              <div className="h-2.5 w-3/5 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-700/60">
            <CreditMeter source="material-gen" className="mr-auto" />
            <Button variant="secondary" onClick={onClose}>
              取消
            </Button>
            <Button icon={Sparkles} loading={busy} onClick={run} disabled={busy || !topicId}>
              {busy ? '生成中…' : '生成'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Badge tone="accent">
              {topicName} · {TYPE_LABEL[kind]} · {DIFF_LABEL[difficulty]} · 共{' '}
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
                  <label className="inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl transition-colors hover:bg-slate-100 focus-within:ring-2 focus-within:ring-accent/40 dark:hover:bg-slate-800">
                    <input
                      type="checkbox"
                      checked={d._selected}
                      onChange={() => toggleDraft(idx)}
                      className="h-5 w-5 accent-[color:var(--accent)]"
                      aria-label="加入題庫"
                    />
                  </label>
                  <div className="flex-1 space-y-1.5">
                    <Textarea
                      value={d.stem}
                      onChange={(e) => editStem(idx, e.target.value)}
                      rows={isLongForm ? 5 : 2}
                      className="whitespace-pre-wrap text-sm"
                    />
                    {kind === 'mc' && d.options && (
                      <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
                        {d.options.map((o, i) => (
                          <li
                            key={i}
                            className={
                              i === d.answerIndex
                                ? 'flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 font-semibold text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300'
                                : 'flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300'
                            }
                          >
                            <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-white text-[11px] font-bold text-slate-500 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:ring-slate-700">
                              {letter(i)}
                            </span>
                            <span className="leading-5">{o}</span>
                            {i === d.answerIndex && (
                              <Check size={14} className="mt-0.5 shrink-0" aria-label="正確答案" />
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                    {kind === 'mc' && (
                      <div className="space-y-2 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3 dark:border-slate-700/70 dark:bg-slate-800/45">
                        <div className="flex flex-wrap gap-1.5">
                          {d.examSkill && (
                            <Badge tone="blue" icon={Brain}>
                              {d.examSkill}
                            </Badge>
                          )}
                          {d.testedConcept && (
                            <Badge tone="accent" icon={Target}>
                              {d.testedConcept}
                            </Badge>
                          )}
                          {d.trap && <Badge tone="amber">陷阱：{d.trap}</Badge>}
                        </div>
                        {d.rationales?.length ? (
                          <div className="grid gap-1.5 text-xs text-slate-600 dark:text-slate-300 sm:grid-cols-2">
                            {d.options?.map((option, i) => {
                              const rationale = d.rationales?.[i]
                              if (!rationale) return null
                              return (
                                <p key={`${option}-${i}`} className="leading-5">
                                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                                    {letter(i)}.
                                  </span>{' '}
                                  {rationale}
                                </p>
                              )
                            })}
                          </div>
                        ) : null}
                        {d.followUp && (
                          <p className="border-t border-slate-200 pt-2 text-xs leading-5 text-slate-500 dark:border-slate-700 dark:text-slate-400">
                            <span className="font-semibold text-slate-700 dark:text-slate-200">
                              跟進：
                            </span>
                            {d.followUp}
                          </p>
                        )}
                      </div>
                    )}
                    {kind !== 'mc' && d.answer && (
                      <p className="whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">
                        <span className="font-semibold text-slate-700 dark:text-slate-200">
                          {kind === 'short' ? '參考答案：' : '評分準則：'}
                        </span>
                        {d.answer}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      <Badge tone={DIFF_TONE[difficulty]} dot>
                        {DIFF_LABEL[difficulty]}
                      </Badge>
                      <Badge tone="accent">{topicName}</Badge>
                      {d.marks ? (
                        <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium tabular-nums text-slate-500 dark:bg-slate-700/60 dark:text-slate-400">
                          {d.marks} 分
                        </span>
                      ) : null}
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
            <Button variant="secondary" icon={RotateCcw} loading={busy} onClick={run} disabled={busy}>
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
