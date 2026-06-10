import { useMemo, useState } from 'react'
import {
  ArrowLeft,
  Bot,
  Check,
  ClipboardList,
  Lock,
  Plus,
  Printer,
  RotateCcw,
  Save,
  Sparkles,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { uid } from '../../../lib/store'
import { useToast } from '../../../context/ToastContext'
import { useAuth } from '../../../context/AuthContext'
import { isAIConfigured } from '../../../lib/aiClient'
import { questionsCol } from '../../../data/collections'
import type { Difficulty, Question } from '../../../data/types'
import {
  Badge,
  Button,
  Card,
  cx,
  EmptyState,
  Field,
  Input,
  Modal,
  Pills,
  Select,
  Textarea,
} from '../../../ui'
import {
  buildPrintHtml,
  compactMcOptions,
  DIFF_LABEL,
  DIFF_ORDER,
  DIFF_TONE,
  openPrintWindow,
  TYPE_LABEL,
  type PaperMeta,
} from '../questionbank/util'
import { generate, type GenDraft } from './engine'

// ============================================================
//  WorksheetGenerator — 教學練習生成（Phase C）
//  ------------------------------------------------------------
//  流程：表單（課題 / 程度 / 難度 / MC＋短答混合比例 / 補充）
//    → 用共用引擎 generate() 各跑一次（mc、short），合併成一份練習。
//    → 預覽逐題（可編輯題幹 / 揀要邊條）。
//    → 「存入題庫」：把已選嘅逐條 questionsCol.add（type 各自 mc / short，
//       連 topicId / difficulty / marks / source）。
//    → 可選「列印」：重用 util.buildPrintHtml（學校練習格式，留白作答區）。
//
//  · 同 QuestionGeneratorModal / PaperGenerator 共用 engine.ts，行為一致。
//  · AI gate（isAIConfigured + 登入）同題庫 AI 出題一致：未接友善降級。
//  · mode 色用 --accent（工作模式 = teal），深色 / 375px OK。
// ============================================================

type TopicLite = { id: string; topic: string }

export interface WorksheetGeneratorProps {
  topics: TopicLite[]
  onClose: () => void
  /** 成功存入題庫後回呼（傳新增條數），畀 hub 更新計數 / toast */
  onSaved?: (count: number) => void
}

// 練習草稿：保留來源題型 + 揀選 / 編輯狀態
type Draft = GenDraft & { _key: string; _selected: boolean }

// 題數預設選項
const TOTAL_OPTIONS = [4, 6, 8, 10, 12]

// MC 佔比（其餘為短答）—— 用比例 chip，避免兩個數字輸入
const MC_RATIOS: { id: string; labelKey: string; labelDefault: string; mc: number }[] = [
  { id: 'mc-heavy', labelKey: 'mat.wsMcHeavy', labelDefault: 'MC 為主', mc: 0.75 },
  { id: 'balanced', labelKey: 'mat.wsBalanced', labelDefault: '均衡', mc: 0.5 },
  { id: 'short-heavy', labelKey: 'mat.wsShortHeavy', labelDefault: '短答為主', mc: 0.25 },
  { id: 'mc-only', labelKey: 'mat.wsMcOnly', labelDefault: '只 MC', mc: 1 },
  { id: 'short-only', labelKey: 'mat.wsShortOnly', labelDefault: '只短答', mc: 0 },
]

const PROMPT_EXAMPLES = [
  '貼香港中小企情境',
  '由淺入深排列',
  '加入計算題',
  '連埋常見錯誤提示',
]

// 由總題數 + MC 佔比 → 各題型題數（至少湊夠總數；只 MC / 只短答時其一為 0）
function splitCounts(total: number, mcRatio: number): { mc: number; short: number } {
  const mc = Math.round(total * mcRatio)
  return { mc, short: Math.max(0, total - mc) }
}

export function WorksheetGenerator({
  topics,
  onClose,
  onSaved,
}: WorksheetGeneratorProps) {
  const { t } = useTranslation()
  const toast = useToast()
  const { user } = useAuth()

  // ── 表單狀態 ──
  const [title, setTitle] = useState('')
  const [topicId, setTopicId] = useState(topics[0]?.id ?? '')
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [total, setTotal] = useState(8)
  const [ratioId, setRatioId] = useState('balanced')
  const [extra, setExtra] = useState('')

  // ── 流程狀態 ──
  const [step, setStep] = useState<'setup' | 'preview'>('setup')
  const [busy, setBusy] = useState(false)
  const [drafts, setDrafts] = useState<Draft[]>([])

  const topicName = topics.find((t) => t.id === topicId)?.topic ?? ''
  const ratio = MC_RATIOS.find((r) => r.id === ratioId) ?? MC_RATIOS[1]
  const split = useMemo(
    () => splitCounts(total, ratio.mc),
    [total, ratio.mc],
  )

  const selectedDrafts = drafts.filter((d) => d._selected && d.stem.trim())
  const selectedCount = selectedDrafts.length
  const selectedMarks = selectedDrafts.reduce((s, d) => s + (d.marks ?? 0), 0)

  // 預覽 / 列印用：把已選草稿轉成 Question-like（id 用 _key，純螢幕 / 列印）
  const previewQuestions = useMemo<Question[]>(
    () =>
      selectedDrafts.map((d) => ({
        id: d._key,
        topicId,
        type: d.type,
        difficulty,
        stem: d.stem.trim(),
        options: d.options,
        answerIndex: d.answerIndex,
        answer: d.type !== 'mc' ? d.answer : undefined,
        marks: d.marks,
        createdAt: new Date().toISOString(),
      })),
    [selectedDrafts, topicId, difficulty],
  )

  // ── 生成（mc / short 各跑一次共用引擎，合併）──
  const run = async () => {
    if (!topicId || busy) return
    if (split.mc === 0 && split.short === 0) {
      toast.error(t('mat.wsToastNoCount', { defaultValue: '請設定題數' }))
      return
    }
    setBusy(true)
    try {
      // 各題型 prompt shape 唔同，分開 generate；但兩個請求並行（Promise.all）
      // → 總延遲 = max(mc, short) 而非相加，慳時間又唔使改共用引擎 / 撈一個混合 prompt。
      const [mcRes, shRes] = await Promise.all([
        split.mc > 0
          ? generate('mc', { topicName, difficulty, count: split.mc, extra: extra.trim() })
          : Promise.resolve([] as GenDraft[]),
        split.short > 0
          ? generate('short', { topicName, difficulty, count: split.short, extra: extra.trim() })
          : Promise.resolve([] as GenDraft[]),
      ])
      const collected: GenDraft[] = [...mcRes, ...shRes]
      if (collected.length === 0) {
        toast.error(t('mat.wsToastBadFormat', { defaultValue: 'AI 出嘅練習格式唔啱，請再試一次。' }))
        return
      }
      // MC 行先、短答行後（練習常見排序）
      const ordered = [
        ...collected.filter((d) => d.type === 'mc'),
        ...collected.filter((d) => d.type !== 'mc'),
      ]
      setDrafts(
        ordered.map((d) => ({ ...d, _key: uid(), _selected: true })),
      )
      setStep('preview')
    } catch (e) {
      toast.error((e as Error).message || t('mat.wsToastFailed', { defaultValue: 'AI 出練習失敗，請再試一次。' }))
    } finally {
      setBusy(false)
    }
  }

  const toggleDraft = (key: string) =>
    setDrafts((prev) =>
      prev.map((d) => (d._key === key ? { ...d, _selected: !d._selected } : d)),
    )
  const editStem = (key: string, stem: string) =>
    setDrafts((prev) => prev.map((d) => (d._key === key ? { ...d, stem } : d)))
  const setAll = (value: boolean) =>
    setDrafts((prev) => prev.map((d) => ({ ...d, _selected: value })))

  // ── 存入題庫（逐條 add；MC 壓縮選項對齊答案）──
  const commit = () => {
    if (selectedDrafts.length === 0) {
      toast.error(t('mat.wsToastNoSelect', { defaultValue: '請最少揀一條題目' }))
      return
    }
    for (const d of selectedDrafts) {
      const mc =
        d.type === 'mc'
          ? compactMcOptions(d.options ?? [], d.answerIndex ?? 0)
          : null
      questionsCol.add({
        topicId,
        type: d.type,
        difficulty,
        stem: d.stem.trim(),
        options: mc ? mc.options : undefined,
        answerIndex: mc ? mc.answerIndex : undefined,
        answer: d.type !== 'mc' ? d.answer?.trim() : undefined,
        marks: d.marks ?? undefined,
        source: 'AI 生成（練習）',
        createdAt: new Date().toISOString(),
      })
    }
    toast.success(t('mat.wsToastAdded', { defaultValue: `已加入 ${selectedDrafts.length} 條題目到題庫`, count: selectedDrafts.length }))
    onSaved?.(selectedDrafts.length)
    onClose()
  }

  // ── 列印（開新視窗；重用題庫列印格式，留白作答區）──
  const print = (withAnswers: boolean) => {
    if (previewQuestions.length === 0) {
      toast.error(t('mat.wsToastNoPrint', { defaultValue: '未有題目可列印' }))
      return
    }
    const meta: PaperMeta = {
      title: title.trim() || `${topicName} 練習`,
      className: '',
      durationMin: '',
      totalMarks: selectedMarks,
    }
    const html = buildPrintHtml(meta, previewQuestions, () => topicName, withAnswers)
    const ok = openPrintWindow(html)
    if (!ok) toast.error(t('mat.wsToastPopupBlocked', { defaultValue: '瀏覽器擋咗彈出視窗，請允許後再試。' }))
  }

  // ── AI gate（同題庫 AI 出題一致）──
  if (!isAIConfigured || !user) {
    return (
      <Modal open onClose={onClose} title={t('mat.wsModalTitle', { defaultValue: '生成教學練習' })}>
        <div className="space-y-4">
          {!isAIConfigured ? (
            <EmptyState
              icon={Bot}
              title={t('mat.wsAiDisabledTitle', { defaultValue: 'AI 助手未啟用' })}
              hint={t('mat.wsAiDisabledHint', { defaultValue: '要設定好 Supabase 並部署 gemini Edge Function 先用到。步驟見 docs/SETUP.md。' })}
            />
          ) : (
            <EmptyState
              icon={Lock}
              title={t('mat.wsLoginTitle', { defaultValue: '請先登入先可以用 AI 生成練習' })}
              hint={t('mat.wsLoginHint', { defaultValue: '喺左下角用 Google 登入後就用得。' })}
            />
          )}
          <div className="flex justify-end">
            <Button variant="secondary" onClick={onClose}>
              {t('mat.wsCloseBtn', { defaultValue: '關閉' })}
            </Button>
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <Modal open onClose={onClose} title={t('mat.wsModalTitle', { defaultValue: '生成教學練習' })} size="lg">
      {step === 'setup' ? (
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-2xl border border-accent/20 bg-accent-soft/50 p-3.5 dark:border-accent/25 dark:bg-accent/10">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent text-white">
              <ClipboardList size={16} />
            </span>
            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              {t('mat.wsSetupHint', { defaultValue: '揀好課題、難度同' })}
              <span className="font-semibold text-accent-strong dark:text-accent">
                {t('mat.wsSetupHintStrong', { defaultValue: 'MC ＋ 短答混合比例' })}
              </span>
              {t('mat.wsSetupHintEnd', { defaultValue: '，AI 會草擬一份貼香港 BAFS 課程嘅練習。生成後可逐條揀／改，再存入題庫或列印。' })}
            </p>
          </div>

          <section className="space-y-3 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 dark:border-slate-700/60 dark:bg-slate-900/40">
            <Field label={t('mat.wsFieldTitle', { defaultValue: '練習名稱（可留空）' })}>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('mat.wsTitlePlaceholder', { defaultValue: '例如：市場營銷 課堂練習' })}
                disabled={busy}
              />
            </Field>
            <Field label={t('mat.wsFieldTopic', { defaultValue: '課題' })}>
              <Select value={topicId} onChange={(e) => setTopicId(e.target.value)}>
                {topics.map((tp) => (
                  <option key={tp.id} value={tp.id}>
                    {tp.topic}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <Field label={t('mat.wsFieldDifficulty', { defaultValue: '難度' })}>
                <Pills
                  options={DIFF_ORDER.map((d) => ({ id: d, label: DIFF_LABEL[d] }))}
                  active={difficulty}
                  onChange={setDifficulty}
                />
              </Field>
              <Field label={t('mat.wsFieldTotal', { defaultValue: '總題數' })}>
                <Select
                  value={String(total)}
                  onChange={(e) => setTotal(Number(e.target.value))}
                  className="w-28"
                >
                  {TOTAL_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n} {t('mat.paperCountUnit', { defaultValue: '題' })}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </section>

          {/* 混合比例 */}
          <section className="space-y-2.5">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
              {t('mat.wsRatioLabel', { defaultValue: '題型比例' })}
            </span>
            <Pills
              options={MC_RATIOS.map((r) => ({ id: r.id, label: t(r.labelKey, { defaultValue: r.labelDefault }) }))}
              active={ratioId}
              onChange={setRatioId}
            />
            <p className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
              {t('mat.wsPreviewPre', { defaultValue: '預計：' })}
              {split.mc > 0 && (
                <Badge tone="blue">
                  {t('mat.wsMcBadgePre', { defaultValue: '選擇題' })} <span className="nums ml-0.5">{split.mc}</span>
                </Badge>
              )}
              {split.short > 0 && (
                <Badge tone="accent">
                  {t('mat.wsShortBadgePre', { defaultValue: '短答題' })} <span className="nums ml-0.5">{split.short}</span>
                </Badge>
              )}
              <span className="text-slate-400 dark:text-slate-500">
                · {t('mat.wsPreviewTotalPre', { defaultValue: '合共' })} <span className="nums font-semibold">{split.mc + split.short}</span> {t('mat.paperCountUnit', { defaultValue: '題' })}
              </span>
            </p>
          </section>

          <Field label={t('mat.wsFieldExtra', { defaultValue: '補充指示（可留空）' })}>
            <Textarea
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              placeholder={t('mat.wsExtraPlaceholder', { defaultValue: '例如：由淺入深、題目要貼香港情境…' })}
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
                {t('mat.wsBusyMsg', { defaultValue: 'AI 諗緊練習，請等一等…' })}
              </p>
              <div className="h-2.5 w-full animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
              <div className="h-2.5 w-4/5 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
              <div className="h-2.5 w-3/5 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-700/60">
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              {t('mat.wsCancelBtn', { defaultValue: '取消' })}
            </Button>
            <Button
              icon={Sparkles}
              loading={busy}
              onClick={run}
              disabled={busy || !topicId || split.mc + split.short === 0}
            >
              {busy ? t('mat.wsGenerateBtnBusy', { defaultValue: '生成中…' }) : t('mat.wsGenerateBtn', { defaultValue: '生成練習' })}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* 概要 + 全選 */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone="accent">{topicName}</Badge>
              <Badge tone={DIFF_TONE[difficulty]} dot>
                {DIFF_LABEL[difficulty]}
              </Badge>
              <span className="text-xs text-slate-400 dark:text-slate-500">
                {t('mat.wsReviewSelectedPre', { defaultValue: '已選' })} <span className="nums">{selectedCount}／{drafts.length}</span> · {t('mat.wsReviewMarksPre', { defaultValue: '共' })}{' '}
                <span className="nums">{selectedMarks}</span> {t('mat.wsReviewMarksPost', { defaultValue: '分' })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setAll(true)}>
                {t('mat.wsSelectAll', { defaultValue: '全選' })}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setAll(false)}>
                {t('mat.wsDeselectAll', { defaultValue: '取消全選' })}
              </Button>
            </div>
          </div>

          <ol className="space-y-2">
            {drafts.map((d, i) => (
              <Card
                key={d._key}
                className={cx(
                  'p-3 transition',
                  !d._selected && 'opacity-55',
                )}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={d._selected}
                    onChange={() => toggleDraft(d._key)}
                    className="mt-1 h-4 w-4 shrink-0 accent-[color:var(--accent)]"
                    aria-label={t('mat.wsCheckboxLabel', { defaultValue: '加入題庫' })}
                  />
                  <span className="nums mt-0.5 shrink-0 text-sm font-bold text-slate-400 dark:text-slate-500">
                    {i + 1}.
                  </span>
                  <div className="flex-1 space-y-1.5">
                    <Textarea
                      value={d.stem}
                      onChange={(e) => editStem(d._key, e.target.value)}
                      rows={2}
                      className="whitespace-pre-wrap text-sm"
                    />
                    {d.type === 'mc' && d.options && (
                      <ul className="space-y-0.5 pl-1 text-sm">
                        {d.options.map((o, oi) => (
                          <li
                            key={oi}
                            className={
                              oi === d.answerIndex
                                ? 'flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400'
                                : 'text-slate-600 dark:text-slate-300'
                            }
                          >
                            <span>
                              {String.fromCharCode(65 + oi)}. {o}
                            </span>
                            {oi === d.answerIndex && (
                              <Check size={14} className="shrink-0" aria-label={t('mat.wsCorrectAnswerLabel', { defaultValue: '正確答案' })} />
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                    {d.type !== 'mc' && d.answer && (
                      <p className="whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">
                        <span className="font-semibold text-slate-700 dark:text-slate-200">
                          {t('mat.wsRefAnswer', { defaultValue: '參考答案：' })}
                        </span>
                        {d.answer}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      <Badge tone={d.type === 'mc' ? 'blue' : 'accent'}>
                        {TYPE_LABEL[d.type]}
                      </Badge>
                      {d.marks ? (
                        <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium tabular-nums text-slate-500 dark:bg-slate-700/60 dark:text-slate-400">
                          {d.marks} {t('mat.wsMarkUnit', { defaultValue: '分' })}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </ol>

          {/* 動作 */}
          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-700/60">
            <Button variant="ghost" icon={ArrowLeft} onClick={() => setStep('setup')} disabled={busy}>
              {t('mat.wsBackBtn', { defaultValue: '重新設定' })}
            </Button>
            <Button variant="secondary" icon={RotateCcw} loading={busy} onClick={run} disabled={busy}>
              {busy ? t('mat.wsRegenBtnBusy', { defaultValue: '生成中…' }) : t('mat.wsRegenBtn', { defaultValue: '再生成' })}
            </Button>
            <Button variant="secondary" icon={Printer} onClick={() => print(false)} disabled={busy || selectedCount === 0}>
              {t('mat.wsPrintStudent', { defaultValue: '列印（學生）' })}
            </Button>
            <Button variant="secondary" icon={Printer} onClick={() => print(true)} disabled={busy || selectedCount === 0}>
              {t('mat.wsPrintAnswers', { defaultValue: '列印（含答案）' })}
            </Button>
            <Button icon={Save} onClick={commit} disabled={busy || selectedCount === 0}>
              {t('mat.wsSaveBtnPre', { defaultValue: '存入題庫（' })}<span className="nums">{selectedCount}</span>{t('mat.wsSaveBtnPost', { defaultValue: '）' })}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

export default WorksheetGenerator
