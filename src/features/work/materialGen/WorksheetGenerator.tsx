import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
import CreditMeter from '../../../components/CreditMeter'
import { uid } from '../../../lib/store'
import { useToast } from '../../../context/ToastContext'
import { useAuth } from '../../../context/AuthContext'
import { useSettings } from '../../../context/SettingsContext'
import { isAIConfigured } from '../../../lib/aiClient'
import { classifyAIError } from '../../../lib/aiError'
import { questionsCol } from '../../../data/collections'
import { getSubjectPack } from '../../../data/subjects'
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
  initialExtra?: string
  initialTitle?: string
  onClose: () => void
  /** 成功存入題庫後回呼（傳新增條數），畀 hub 更新計數 / toast */
  onSaved?: (count: number) => void
}

// 練習草稿：保留來源題型 + 揀選 / 編輯狀態
type Draft = GenDraft & { _key: string; _selected: boolean }

// 差異化：每個程度各自一套結果 + 狀態（idle / loading / done / error）
type DiffResult = {
  status: 'idle' | 'loading' | 'done' | 'error'
  drafts: Draft[]
  error?: string
}
const emptyDiffMap = (): Record<Difficulty, DiffResult> => ({
  easy: { status: 'idle', drafts: [] },
  medium: { status: 'idle', drafts: [] },
  hard: { status: 'idle', drafts: [] },
})

// 題數預設選項
const TOTAL_OPTIONS = [4, 6, 8, 10, 12]

// MC 佔比（其餘為短答）—— 用比例 chip，避免兩個數字輸入
const MC_RATIOS: { id: string; label: string; mc: number }[] = [
  { id: 'mc-heavy', label: 'MC 為主', mc: 0.75 },
  { id: 'balanced', label: '均衡', mc: 0.5 },
  { id: 'short-heavy', label: '短答為主', mc: 0.25 },
  { id: 'mc-only', label: '只 MC', mc: 1 },
  { id: 'short-only', label: '只短答', mc: 0 },
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
  initialExtra = '',
  initialTitle = '',
  onClose,
  onSaved,
}: WorksheetGeneratorProps) {
  const toast = useToast()
  const { user } = useAuth()
  const { t } = useTranslation()

  // ── 表單狀態 ──
  const [title, setTitle] = useState(initialTitle)
  const [topicId, setTopicId] = useState(topics[0]?.id ?? '')
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [total, setTotal] = useState(8)
  const [ratioId, setRatioId] = useState('balanced')
  const [extra, setExtra] = useState(initialExtra)

  // ── 流程狀態 ──
  const [step, setStep] = useState<'setup' | 'preview'>('setup')
  const [busy, setBusy] = useState(false)
  const [drafts, setDrafts] = useState<Draft[]>([])

  // ── 差異化（淺／中／深）—— opt-in，獨立 state，唔污染單一流程 ──
  const [differentiated, setDifferentiated] = useState(false)
  const [diffResults, setDiffResults] =
    useState<Record<Difficulty, DiffResult>>(emptyDiffMap)
  const [activeTab, setActiveTab] = useState<Difficulty>('easy')

  const topicName = topics.find((t) => t.id === topicId)?.topic ?? ''
  const { subjectPackId } = useSettings()
  const subjectName = getSubjectPack(subjectPackId)?.name
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
      toast.error('請設定題數')
      return
    }
    setBusy(true)
    try {
      // 各題型 prompt shape 唔同，分開 generate；但兩個請求並行（Promise.all）
      // → 總延遲 = max(mc, short) 而非相加，慳時間又唔使改共用引擎 / 撈一個混合 prompt。
      const [mcRes, shRes] = await Promise.all([
        split.mc > 0
          ? generate('mc', { topicName, difficulty, count: split.mc, extra: extra.trim(), subject: subjectName })
          : Promise.resolve([] as GenDraft[]),
        split.short > 0
          ? generate('short', { topicName, difficulty, count: split.short, extra: extra.trim(), subject: subjectName })
          : Promise.resolve([] as GenDraft[]),
      ])
      const collected: GenDraft[] = [...mcRes, ...shRes]
      if (collected.length === 0) {
        toast.error('AI 出嘅練習格式唔啱，請再試一次。')
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
      toast.error(classifyAIError(e).message, { label: '重試', onClick: run })
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
      toast.error('請最少揀一條題目')
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
    toast.success(`已加入 ${selectedDrafts.length} 條題目到題庫`)
    onSaved?.(selectedDrafts.length)
    onClose()
  }

  // ── 列印（開新視窗；重用題庫列印格式，留白作答區）──
  const print = (withAnswers: boolean) => {
    if (previewQuestions.length === 0) {
      toast.error('未有題目可列印')
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
    if (!ok) toast.error('瀏覽器擋咗彈出視窗，請允許後再試。')
  }

  // ── 差異化：單一程度生成（各自獨立 try；可供整體 orchestration / 單獨重試用）──
  const generateDiff = async (diff: Difficulty) => {
    setDiffResults((prev) => ({ ...prev, [diff]: { status: 'loading', drafts: [] } }))
    try {
      const [mcRes, shRes] = await Promise.all([
        split.mc > 0
          ? generate('mc', { topicName, difficulty: diff, count: split.mc, extra: extra.trim(), subject: subjectName })
          : Promise.resolve([] as GenDraft[]),
        split.short > 0
          ? generate('short', { topicName, difficulty: diff, count: split.short, extra: extra.trim(), subject: subjectName })
          : Promise.resolve([] as GenDraft[]),
      ])
      const collected: GenDraft[] = [...mcRes, ...shRes]
      if (collected.length === 0) {
        setDiffResults((prev) => ({
          ...prev,
          [diff]: {
            status: 'error',
            drafts: [],
            error: t('worksheet.badFormat', { defaultValue: 'AI 出嘅練習格式唔啱，請再試。' }),
          },
        }))
        return
      }
      const ordered = [
        ...collected.filter((d) => d.type === 'mc'),
        ...collected.filter((d) => d.type !== 'mc'),
      ]
      setDiffResults((prev) => ({
        ...prev,
        [diff]: {
          status: 'done',
          drafts: ordered.map((d) => ({ ...d, _key: uid(), _selected: true })),
        },
      }))
    } catch (e) {
      const info = classifyAIError(e)
      setDiffResults((prev) => ({
        ...prev,
        [diff]: { status: 'error', drafts: [], error: info.message },
      }))
    }
  }

  // ── 差異化 orchestration：序列跑三程度，每程度各自獨立 try（一個失敗唔影響其餘）──
  const runDifferentiated = async () => {
    if (!topicId || busy) return
    if (split.mc === 0 && split.short === 0) {
      toast.error(t('worksheet.noCount', { defaultValue: '請設定題數' }))
      return
    }
    setBusy(true)
    setDiffResults(emptyDiffMap())
    setStep('preview')
    setActiveTab('easy')
    try {
      // 序列（for await）而非並行：每程度可獨立失敗 + 顯示進度，亦避免一次過 6 個請求撞額度。
      for (const diff of DIFF_ORDER) {
        await generateDiff(diff)
      }
    } finally {
      setBusy(false)
    }
  }

  // ── 單一程度重試（只重跑該程度，唔影響其餘）──
  const retryDiff = async (diff: Difficulty) => {
    if (busy) return
    setBusy(true)
    try {
      await generateDiff(diff)
    } finally {
      setBusy(false)
    }
  }

  // ── 差異化：每 tab 各自列印 / 匯出（重用 buildPrintHtml；difficulty 用該 tab 嘅 diff 令列印 tag 正確）──
  const printDiff = (diff: Difficulty, withAnswers: boolean) => {
    const res = diffResults[diff]
    if (res.status !== 'done' || res.drafts.length === 0) {
      toast.error(t('worksheet.noPrint', { defaultValue: '未有題目可列印' }))
      return
    }
    const qs: Question[] = res.drafts
      .filter((d) => d.stem.trim())
      .map((d) => ({
        id: d._key,
        topicId,
        type: d.type,
        difficulty: diff,
        stem: d.stem.trim(),
        options: d.options,
        answerIndex: d.answerIndex,
        answer: d.type !== 'mc' ? d.answer : undefined,
        marks: d.marks,
        createdAt: new Date().toISOString(),
      }))
    const totalMarks = qs.reduce((s, q) => s + (q.marks ?? 0), 0)
    const meta: PaperMeta = {
      title: `${title.trim() || `${topicName} 練習`}（${DIFF_LABEL[diff]}）`,
      className: '',
      durationMin: '',
      totalMarks,
    }
    const html = buildPrintHtml(meta, qs, () => topicName, withAnswers)
    if (!openPrintWindow(html)) {
      toast.error(
        t('worksheet.popupBlocked', { defaultValue: '瀏覽器擋咗彈出視窗，請允許後再試。' }),
      )
    }
  }

  // ── AI gate（同題庫 AI 出題一致）──
  if (!isAIConfigured || !user) {
    return (
      <Modal open onClose={onClose} title="生成教學練習">
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
              title="請先登入先可以用 AI 生成練習"
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
    <Modal open onClose={onClose} title="生成教學練習" size="lg">
      {step === 'setup' ? (
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-2xl border border-accent/20 bg-accent-soft/50 p-3.5 dark:border-accent/25 dark:bg-accent/10">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent text-white">
              <ClipboardList size={16} />
            </span>
            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              揀好課題、難度同
              <span className="font-semibold text-accent-strong dark:text-accent">
                MC ＋ 短答混合比例
              </span>
              ，AI 會草擬一份貼香港{subjectName ?? '中學'}課程嘅練習。生成後可逐條揀／改，再存入題庫或列印。
            </p>
          </div>

          <section className="space-y-3 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 dark:border-slate-700/60 dark:bg-slate-900/40">
            <Field label="練習名稱（可留空）">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例如：市場營銷 課堂練習"
                disabled={busy}
              />
            </Field>
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
              {!differentiated && (
                <Field label="難度">
                  <Pills
                    options={DIFF_ORDER.map((d) => ({ id: d, label: DIFF_LABEL[d] }))}
                    active={difficulty}
                    onChange={setDifficulty}
                  />
                </Field>
              )}
              <Field label="總題數">
                <Select
                  value={String(total)}
                  onChange={(e) => setTotal(Number(e.target.value))}
                  className="w-28"
                >
                  {TOTAL_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n} 題
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </section>

          {/* 混合比例 */}
          <section className="space-y-2.5">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
              題型比例
            </span>
            <Pills
              options={MC_RATIOS.map((r) => ({ id: r.id, label: r.label }))}
              active={ratioId}
              onChange={setRatioId}
            />
            <p className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
              預計：
              {split.mc > 0 && (
                <Badge tone="blue">
                  選擇題 <span className="nums ml-0.5">{split.mc}</span>
                </Badge>
              )}
              {split.short > 0 && (
                <Badge tone="accent">
                  短答題 <span className="nums ml-0.5">{split.short}</span>
                </Badge>
              )}
              <span className="text-slate-400 dark:text-slate-500">
                · 合共 <span className="nums font-semibold">{split.mc + split.short}</span> 題
              </span>
            </p>
          </section>

          {/* 差異化（淺／中／深）opt-in */}
          <section className="space-y-2 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 dark:border-slate-700/60 dark:bg-slate-900/40">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={differentiated}
                onChange={(e) => setDifferentiated(e.target.checked)}
                disabled={busy}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[color:var(--accent)]"
              />
              <span className="space-y-0.5">
                <span className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {t('worksheet.diffMode.title', { defaultValue: '差異化教材（易／中／難）' })}
                </span>
                <span className="block text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  {t('worksheet.diffMode.hint', {
                    defaultValue:
                      '開咗之後一鍵就同一課題分別出「易／中／難」三套獨立工作紙，畀唔同程度學生。',
                  })}
                </span>
              </span>
            </label>
          </section>

          <Field label="補充指示（可留空）">
            <Textarea
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              placeholder="例如：由淺入深、題目要貼香港情境…"
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
                AI 諗緊練習，請等一等…
              </p>
              <div className="h-2.5 w-full animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
              <div className="h-2.5 w-4/5 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
              <div className="h-2.5 w-3/5 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-700/60">
            <CreditMeter source="material-gen" className="mr-auto" />
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              取消
            </Button>
            <Button
              icon={Sparkles}
              loading={busy}
              onClick={differentiated ? runDifferentiated : run}
              disabled={busy || !topicId || split.mc + split.short === 0}
            >
              {busy
                ? '生成中…'
                : differentiated
                  ? t('worksheet.genDiff', { defaultValue: '生成三套練習' })
                  : '生成練習'}
            </Button>
          </div>
        </div>
      ) : differentiated ? (
        <DifferentiatedPreview
          topicName={topicName}
          diffResults={diffResults}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          busy={busy}
          onBack={() => setStep('setup')}
          onRegenerate={runDifferentiated}
          onRetry={retryDiff}
          onPrint={printDiff}
        />
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
                已選 <span className="nums">{selectedCount}／{drafts.length}</span> · 共{' '}
                <span className="nums">{selectedMarks}</span> 分
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setAll(true)}>
                全選
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setAll(false)}>
                取消全選
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
                  <label className="inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl transition-colors hover:bg-slate-100 focus-within:ring-2 focus-within:ring-accent/40 dark:hover:bg-slate-800">
                    <input
                      type="checkbox"
                      checked={d._selected}
                      onChange={() => toggleDraft(d._key)}
                      className="h-5 w-5 accent-[color:var(--accent)]"
                      aria-label="加入題庫"
                    />
                  </label>
                  <span className="nums mt-0.5 shrink-0 text-sm font-semibold text-slate-400 dark:text-slate-500">
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
                              <Check size={14} className="shrink-0" aria-label="正確答案" />
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                    {d.type !== 'mc' && d.answer && (
                      <p className="whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">
                        <span className="font-semibold text-slate-700 dark:text-slate-200">
                          參考答案：
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
                          {d.marks} 分
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
              重新設定
            </Button>
            <Button variant="secondary" icon={RotateCcw} loading={busy} onClick={run} disabled={busy}>
              {busy ? '生成中…' : '再生成'}
            </Button>
            <Button variant="secondary" icon={Printer} onClick={() => print(false)} disabled={busy || selectedCount === 0}>
              列印（學生）
            </Button>
            <Button variant="secondary" icon={Printer} onClick={() => print(true)} disabled={busy || selectedCount === 0}>
              列印（含答案）
            </Button>
            <Button icon={Save} onClick={commit} disabled={busy || selectedCount === 0}>
              存入題庫（<span className="nums">{selectedCount}</span>）
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

// ============================================================
//  DifferentiatedPreview — 差異化三 tab 預覽（淺／中／深）
//  每 tab 一張完整工作紙（唯讀整張派發，唔做逐題揀選 / 編輯 / 入題庫）。
//  每 tab header 顯示自己 status（loading / done 題數 / error），各自獨立。
// ============================================================
function DifferentiatedPreview({
  topicName,
  diffResults,
  activeTab,
  setActiveTab,
  busy,
  onBack,
  onRegenerate,
  onRetry,
  onPrint,
}: {
  topicName: string
  diffResults: Record<Difficulty, DiffResult>
  activeTab: Difficulty
  setActiveTab: (d: Difficulty) => void
  busy: boolean
  onBack: () => void
  onRegenerate: () => void
  onRetry: (d: Difficulty) => void
  onPrint: (d: Difficulty, withAnswers: boolean) => void
}) {
  const { t } = useTranslation()
  const cur = diffResults[activeTab]
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone="accent">{topicName}</Badge>
        <span className="text-xs text-slate-400 dark:text-slate-500">
          {t('worksheet.diffMode.subtitle', {
            defaultValue: '三套獨立工作紙，分別畀唔同程度學生',
          })}
        </span>
      </div>

      {/* Tab bar：三程度，各帶狀態小標 */}
      <div role="tablist" className="flex flex-wrap gap-1.5">
        {DIFF_ORDER.map((diff) => {
          const r = diffResults[diff]
          const isActive = diff === activeTab
          const label = DIFF_LABEL[diff]
          const statusLabel =
            r.status === 'loading'
              ? t('worksheet.diffMode.tabLoading', { defaultValue: '生成中', label })
              : r.status === 'done'
                ? t('worksheet.diffMode.tabDone', {
                    defaultValue: `${r.drafts.length} 題`,
                    count: r.drafts.length,
                  })
                : r.status === 'error'
                  ? t('worksheet.diffMode.tabError', { defaultValue: '出錯' })
                  : t('worksheet.diffMode.tabIdle', { defaultValue: '未開始' })
          return (
            <button
              key={diff}
              type="button"
              role="tab"
              id={`diff-tab-${diff}`}
              aria-selected={isActive}
              aria-controls={`diff-panel-${diff}`}
              aria-label={`${label}：${statusLabel}`}
              onClick={() => setActiveTab(diff)}
              className={cx(
                'inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-medium transition',
                isActive
                  ? 'border-accent bg-accent-soft text-accent-strong dark:border-accent/50 dark:bg-accent/15 dark:text-accent'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-accent/40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
              )}
            >
              <span>{label}</span>
              {r.status === 'loading' && (
                <Sparkles size={13} className="animate-pulse text-accent" aria-hidden="true" />
              )}
              {r.status === 'done' && (
                <span
                  aria-hidden="true"
                  className="nums rounded-md bg-slate-100 px-1.5 text-[11px] font-semibold text-slate-500 dark:bg-slate-700/60 dark:text-slate-400"
                >
                  {r.drafts.length}
                </span>
              )}
              {r.status === 'error' && (
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-rose-500" />
              )}
            </button>
          )
        })}
      </div>

      {/* 當前 tab body */}
      <div role="tabpanel" id={`diff-panel-${activeTab}`} aria-labelledby={`diff-tab-${activeTab}`}>
      {cur.status === 'idle' ? (
        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 dark:border-slate-700/80 dark:bg-slate-900/40">
          <p className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <Sparkles size={15} className="text-slate-400 dark:text-slate-500" aria-hidden="true" />
            {t('worksheet.diffMode.queued', {
              defaultValue: '排緊隊，會接住生成…',
            })}
          </p>
        </div>
      ) : cur.status === 'loading' ? (
        <div
          className="space-y-2 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 dark:border-slate-700/80 dark:bg-slate-900/40"
          aria-live="polite"
        >
          <p className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <Sparkles size={15} className="animate-pulse text-accent" aria-hidden="true" />
            {t('worksheet.diffMode.loading', {
              defaultValue: 'AI 諗緊呢個程度嘅練習，請等一等…',
            })}
          </p>
          <div className="h-2.5 w-full animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
          <div className="h-2.5 w-4/5 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
          <div className="h-2.5 w-3/5 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
        </div>
      ) : cur.status === 'error' ? (
        <div className="space-y-3 rounded-2xl border border-rose-200/70 bg-rose-50/50 p-4 dark:border-rose-500/25 dark:bg-rose-500/10">
          <EmptyState
            icon={Bot}
            title={t('worksheet.diffMode.failed', { defaultValue: '呢個程度生成唔到' })}
            hint={cur.error}
          />
          <div className="flex justify-center">
            <Button
              variant="secondary"
              icon={RotateCcw}
              loading={busy}
              onClick={() => onRetry(activeTab)}
              disabled={busy}
            >
              {t('worksheet.diffMode.retry', { defaultValue: '重試呢個程度' })}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <ol className="space-y-2">
            {cur.drafts.map((d, i) => (
              <Card key={d._key} className="p-3">
                <div className="flex items-start gap-3">
                  <span className="nums mt-0.5 shrink-0 text-sm font-semibold text-slate-400 dark:text-slate-500">
                    {i + 1}.
                  </span>
                  <div className="flex-1 space-y-1.5">
                    <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">
                      {d.stem}
                    </p>
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
                              <Check size={14} className="shrink-0" aria-label="正確答案" />
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                    {d.type !== 'mc' && d.answer && (
                      <p className="whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">
                        <span className="font-semibold text-slate-700 dark:text-slate-200">
                          參考答案：
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
                          {d.marks} 分
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </ol>
          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <Button
              variant="secondary"
              icon={Printer}
              onClick={() => onPrint(activeTab, false)}
              disabled={busy || cur.status !== 'done'}
            >
              {t('worksheet.diffMode.printStudent', { defaultValue: '列印（學生）' })}
            </Button>
            <Button
              variant="secondary"
              icon={Printer}
              onClick={() => onPrint(activeTab, true)}
              disabled={busy || cur.status !== 'done'}
            >
              {t('worksheet.diffMode.printAnswers', { defaultValue: '列印（含答案）' })}
            </Button>
          </div>
        </>
      )}
      </div>

      {/* 全域動作 */}
      <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-700/60">
        <Button variant="ghost" icon={ArrowLeft} onClick={onBack} disabled={busy}>
          {t('worksheet.diffMode.back', { defaultValue: '重新設定' })}
        </Button>
        <Button
          variant="secondary"
          icon={RotateCcw}
          loading={busy}
          onClick={onRegenerate}
          disabled={busy}
        >
          {busy
            ? t('worksheet.diffMode.generating', { defaultValue: '生成中…' })
            : t('worksheet.diffMode.regenAll', { defaultValue: '再生成三套' })}
        </Button>
      </div>
    </div>
  )
}

export default WorksheetGenerator
