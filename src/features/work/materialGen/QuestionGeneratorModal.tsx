import { useState } from 'react'
import { ArrowLeft, Bot, Check, Lock, Plus, RotateCcw, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { uid } from '../../../lib/store'
import { useToast } from '../../../context/ToastContext'
import { useAuth } from '../../../context/AuthContext'
import { isAIConfigured } from '../../../lib/aiClient'
import { questionsCol } from '../../../data/collections'
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

// ============================================================
//  QuestionGeneratorModal — 可重用嘅 AI 教材生成 modal
//  ------------------------------------------------------------
//  鎖定單一題型（kind），跑共用引擎 generate() → 預覽逐條揀／改 →
//  存入題庫（questionsCol）。同 QuestionBank 嘅 AIGenerateModal 共用
//  engine.ts，但本元件完全獨立（直接 import 引擎 + collections），
//  畀 Phase C「教材生成」hub 重用而唔會牽動題庫。
//
//  · 行為 / gate / 文案對齊題庫嘅 AI 出題流程。
//  · mode 色用 --accent（工作模式 = teal），深色 / 375px OK。
// ============================================================

const COUNT_OPTIONS = [3, 5, 8, 10]

const PROMPT_EXAMPLES = [
  '貼香港中小企情境',
  '集中考定義同例子',
  '加入計算題',
  '連埋常見錯誤分析',
]

type Draft = GenDraft & { _key: string; _selected: boolean }

export interface QuestionGeneratorModalProps {
  /** 鎖定生成題型（hub 每張卡對應一種） */
  kind: GenKind
  topics: { id: string; topic: string }[]
  onClose: () => void
  /** 成功存入題庫後回呼（傳新增條數），畀 hub 更新計數 / toast */
  onSaved?: (count: number) => void
}

const KIND_TITLE_KEY: Record<GenKind, { key: string; defaultValue: string }> = {
  mc: { key: 'mat.qgenMcTitle', defaultValue: 'AI 生成選擇題' },
  short: { key: 'mat.qgenShortTitle', defaultValue: 'AI 生成短答題' },
  long: { key: 'mat.qgenLongTitle', defaultValue: 'AI 生成結構式長題' },
  case: { key: 'mat.qgenCaseTitle', defaultValue: 'AI 生成教學個案' },
}

export function QuestionGeneratorModal({
  kind,
  topics,
  onClose,
  onSaved,
}: QuestionGeneratorModalProps) {
  const { t } = useTranslation()
  const toast = useToast()
  const { user } = useAuth()

  const [topicId, setTopicId] = useState(topics[0]?.id ?? '')
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [count, setCount] = useState(5)
  const [extra, setExtra] = useState('')

  const [step, setStep] = useState<'setup' | 'review'>('setup')
  const [busy, setBusy] = useState(false)
  const [drafts, setDrafts] = useState<Draft[]>([])

  const kindTitleEntry = KIND_TITLE_KEY[kind]
  const title = t(kindTitleEntry.key, { defaultValue: kindTitleEntry.defaultValue })
  const topicName = topics.find((t) => t.id === topicId)?.topic ?? ''
  const selectedCount = drafts.filter((d) => d._selected).length
  const isLongForm = kind === 'long' || kind === 'case'

  const run = async () => {
    if (!topicId || busy) return
    setBusy(true)
    try {
      const out = await generate(kind, { topicName, difficulty, count, extra })
      const parsed: Draft[] = out.map((d) => ({
        ...d,
        _key: uid(),
        _selected: true,
      }))
      if (parsed.length === 0) {
        toast.error(t('mat.qgenToastBadFormat', { defaultValue: 'AI 出嘅題目格式唔啱，請再試一次。' }))
        return
      }
      setDrafts(parsed)
      setStep('review')
    } catch (e) {
      toast.error((e as Error).message || t('mat.qgenToastFailed', { defaultValue: 'AI 出題失敗，請再試一次。' }))
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
        answer: kind !== 'mc' ? d.answer?.trim() : undefined,
        marks: d.marks ?? undefined,
        source: 'AI 生成',
        createdAt: new Date().toISOString(),
      })
    }
    toast.success(t('mat.qgenToastAdded', { defaultValue: `已加入 ${chosen.length} 條題目到題庫`, count: chosen.length }))
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
              title={t('mat.qgenAiDisabledTitle', { defaultValue: 'AI 助手未啟用' })}
              hint={t('mat.qgenAiDisabledHint', { defaultValue: '要設定好 Supabase 並部署 gemini Edge Function 先用到。步驟見 docs/SETUP.md。' })}
            />
          ) : (
            <EmptyState
              icon={Lock}
              title={t('mat.qgenLoginTitle', { defaultValue: '請先登入先可以用 AI 出題' })}
              hint={t('mat.qgenLoginHint', { defaultValue: '喺左下角用 Google 登入後就用得。' })}
            />
          )}
          <div className="flex justify-end">
            <Button variant="secondary" onClick={onClose}>
              {t('mat.qgenCloseBtn', { defaultValue: '關閉' })}
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
              {t('mat.qgenSetupHintPre', { defaultValue: '揀好課題同難度，AI 會幫你草擬一批貼合香港 BAFS 課程嘅' })}
              {TYPE_LABEL[kind]}
              {t('mat.qgenSetupHintPost', { defaultValue: '。生成後可以逐條揀返要邊條先加入題庫。' })}
            </p>
          </div>

          <section className="space-y-3 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 dark:border-slate-700/60 dark:bg-slate-900/40">
            <Field label={t('mat.qgenFieldTopic', { defaultValue: '課題' })}>
              <Select value={topicId} onChange={(e) => setTopicId(e.target.value)}>
                {topics.map((tp) => (
                  <option key={tp.id} value={tp.id}>
                    {tp.topic}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <Field label={t('mat.qgenFieldDifficulty', { defaultValue: '難度' })}>
                <Pills
                  options={DIFF_ORDER.map((d) => ({ id: d, label: DIFF_LABEL[d] }))}
                  active={difficulty}
                  onChange={setDifficulty}
                />
              </Field>
              <Field label={t('mat.qgenFieldCount', { defaultValue: '條數' })}>
                <Select
                  value={String(count)}
                  onChange={(e) => setCount(Number(e.target.value))}
                  className="w-28"
                >
                  {COUNT_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n} {t('mat.qgenCountUnit', { defaultValue: '條' })}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </section>

          <Field label={t('mat.qgenFieldExtra', { defaultValue: '補充指示（可留空）' })}>
            <Textarea
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              placeholder={t('mat.qgenExtraPlaceholder', { defaultValue: '例如：集中考定義同例子、題目要貼香港情境…' })}
              rows={2}
              disabled={busy}
            />
          </Field>
          <div className="-mt-2.5 flex flex-wrap gap-1.5">
            {PROMPT_EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                disabled={busy}
                onClick={() => setExtra((prev) => (prev.trim() ? `${prev}；${ex}` : ex))}
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:border-accent/40 hover:bg-accent-soft hover:text-accent-strong disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-accent/40 dark:hover:bg-accent/10 dark:hover:text-accent"
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
                {t('mat.qgenBusyMsg', { defaultValue: 'AI 諗緊題目，請等一等…' })}
              </p>
              <div className="h-2.5 w-full animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
              <div className="h-2.5 w-4/5 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
              <div className="h-2.5 w-3/5 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-700/60">
            <Button variant="secondary" onClick={onClose}>
              {t('mat.qgenCancelBtn', { defaultValue: '取消' })}
            </Button>
            <Button icon={Sparkles} loading={busy} onClick={run} disabled={busy || !topicId}>
              {busy ? t('mat.qgenGenerateBtnBusy', { defaultValue: '生成中…' }) : t('mat.qgenGenerateBtn', { defaultValue: '生成' })}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Badge tone="accent">
              {topicName} · {TYPE_LABEL[kind]} · {DIFF_LABEL[difficulty]} · {t('mat.qgenReviewBadgePre', { defaultValue: '共' })}{' '}
              <span className="nums">{drafts.length}</span> {t('mat.qgenCountUnit', { defaultValue: '條' })}
            </Badge>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 dark:text-slate-500">
                {t('mat.qgenSelectedPre', { defaultValue: '已選' })} <span className="nums">{selectedCount}／{drafts.length}</span>
              </span>
              <Button variant="ghost" size="sm" onClick={() => setAll(true)}>
                {t('mat.qgenSelectAll', { defaultValue: '全選' })}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setAll(false)}>
                {t('mat.qgenDeselectAll', { defaultValue: '取消全選' })}
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
                    aria-label={t('mat.qgenCheckboxLabel', { defaultValue: '加入題庫' })}
                  />
                  <div className="flex-1 space-y-1.5">
                    <Textarea
                      value={d.stem}
                      onChange={(e) => editStem(idx, e.target.value)}
                      rows={isLongForm ? 5 : 2}
                      className="whitespace-pre-wrap text-sm"
                    />
                    {kind === 'mc' && d.options && (
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
                              <Check size={14} className="shrink-0" aria-label={t('mat.qgenCorrectAnswerLabel', { defaultValue: '正確答案' })} />
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                    {kind !== 'mc' && d.answer && (
                      <p className="whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">
                        <span className="font-semibold text-slate-700 dark:text-slate-200">
                          {kind === 'short' ? t('mat.qgenRefAnswer', { defaultValue: '參考答案：' }) : t('mat.qgenMarkingCriteria', { defaultValue: '評分準則：' })}
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
                          {d.marks} {t('mat.qgenMarkUnit', { defaultValue: '分' })}
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
              {t('mat.qgenBackBtn', { defaultValue: '重新設定' })}
            </Button>
            <Button variant="secondary" icon={RotateCcw} loading={busy} onClick={run} disabled={busy}>
              {busy ? t('mat.qgenRegenerateBtnBusy', { defaultValue: '生成中…' }) : t('mat.qgenRegenerateBtn', { defaultValue: '再生成' })}
            </Button>
            <Button onClick={commit} disabled={selectedCount === 0}>
              {t('mat.qgenAddToBankPre', { defaultValue: '加入題庫（' })}<span className="nums">{selectedCount}</span>{t('mat.qgenAddToBankPost', { defaultValue: '）' })}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
