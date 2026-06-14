import { useMemo, useState } from 'react'
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  Lock,
  Printer,
  RotateCcw,
  Save,
  Sparkles,
  Wand2,
} from 'lucide-react'
import { useCollection } from '../../../lib/store'
import { useToast } from '../../../context/ToastContext'
import { useAuth } from '../../../context/AuthContext'
import { useSettings } from '../../../context/SettingsContext'
import { isAIConfigured } from '../../../lib/aiClient'
import { questionsCol, papersCol } from '../../../data/collections'
import { getSubjectPack } from '../../../data/subjects'
import type { Difficulty, Question, QuestionType } from '../../../data/types'
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
  SegmentedControl,
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
  TYPE_ORDER,
  type PaperMeta,
} from '../questionbank/util'
import { generate } from './engine'

// ============================================================
//  PaperGenerator — 試卷生成（Phase B）
//  ------------------------------------------------------------
//  流程：表單（試卷名 / 課題範圍 / 各題型題數 / 難度 / 補充指示）
//    → 組卷：每個題型先由題庫（questionsCol）抽現有符合題
//      （topicId 喺範圍 + type + 難度），唔夠先用 engine.generate()
//      生成補足，並把新題 questionsCol.add（連 topicId/type/
//      difficulty/marks），收集全部 question id。
//    → 建立 papersCol.add（同 QuestionBank 嘅 SavedPaper 同 storage
//      key 完全一致，組卷工作室可載入；createAt = ISO runtime 時間）。
//    → 預覽逐題（題幹 / 分數）＋「列印」（重用 util.buildPrintHtml）。
//
//  · 純抽題唔需要 AI；只有「唔夠要生成」嗰刻先用 complete()，
//    所以 AI gate 只係喺需要生成時阻擋；冇 AI 都可以淨抽題組卷。
//  · mode 色用 --accent（工作模式 = teal），深色 / 375px OK。
// ============================================================

// SavedPaper / papersCol 由 data/collections 共用 export（同題庫組卷工作室
// 同一 instance）→ 喺度存卷，組卷工作室會實時更新，唔使 reload。
type TopicLite = { id: string; topic: string }

export interface PaperGeneratorProps {
  topics: TopicLite[]
  onClose: () => void
  /** 成功存卷後回呼（傳新卷標題 + 題數），畀 hub 更新 / toast */
  onSaved?: (info: { title: string; count: number }) => void
}

// 各題型題數（字串態，方便 input；組卷時 parse）
type CountMap = Record<QuestionType, string>
const emptyCounts = (): CountMap => ({ mc: '5', short: '3', long: '0', case: '0' })

// 逐型難度（「逐型」模式用）
type DiffMap = Record<QuestionType, Difficulty>
const defaultDiffs = (): DiffMap => ({
  mc: 'easy',
  short: 'medium',
  long: 'hard',
  case: 'hard',
})

const COUNT_PRESETS = ['0', '1', '2', '3', '4', '5', '6', '8', '10']

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// 組卷結果（畀預覽用）
interface BuildOutcome {
  questionIds: string[]
  pulled: number // 由題庫抽到嘅數
  generated: number // 新生成入庫嘅數
  shortfall: number // 仍欠（生成失敗 / 無 AI）嘅數
}

export function PaperGenerator({ topics, onClose, onSaved }: PaperGeneratorProps) {
  const toast = useToast()
  const { user } = useAuth()
  const papers = useCollection(papersCol)
  const allQuestions = useCollection(questionsCol)

  // ── 表單狀態 ──
  const [title, setTitle] = useState('')
  const [className, setClassName] = useState('')
  const [durationMin, setDurationMin] = useState('')
  const [scope, setScope] = useState<string[]>([]) // 課題 id；空 = 全部課題
  const [counts, setCounts] = useState<CountMap>(emptyCounts)
  const [diffMode, setDiffMode] = useState<'overall' | 'perType'>('overall')
  const [overallDiff, setOverallDiff] = useState<Difficulty>('medium')
  const [perTypeDiff, setPerTypeDiff] = useState<DiffMap>(defaultDiffs)
  const [extra, setExtra] = useState('')

  // ── 流程狀態 ──
  const [step, setStep] = useState<'setup' | 'preview'>('setup')
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState<BuildOutcome | null>(null)

  const subjectName = getSubjectPack(useSettings().subjectPackId)?.name
  const topicName = useMemo(() => {
    const map = new Map(topics.map((t) => [t.id, t.topic]))
    return (id: string) => map.get(id) ?? '未分類'
  }, [topics])

  // 預覽題目（按 outcome.questionIds 由最新題庫解析，保留次序）
  const previewQuestions = useMemo<Question[]>(() => {
    if (!outcome) return []
    const byId = new Map(allQuestions.map((q) => [q.id, q]))
    return outcome.questionIds
      .map((id) => byId.get(id))
      .filter((q): q is Question => !!q)
  }, [outcome, allQuestions])

  const previewMarks = previewQuestions.reduce((s, q) => s + (q.marks ?? 0), 0)

  const diffOf = (type: QuestionType): Difficulty =>
    diffMode === 'overall' ? overallDiff : perTypeDiff[type]

  const setCount = (type: QuestionType, v: string) =>
    setCounts((prev) => ({ ...prev, [type]: v.replace(/\D/g, '') }))
  const setPerDiff = (type: QuestionType, d: Difficulty) =>
    setPerTypeDiff((prev) => ({ ...prev, [type]: d }))
  const toggleScope = (id: string) =>
    setScope((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )

  // 每個有要求嘅題型，需要幾條
  const plan = useMemo(
    () =>
      TYPE_ORDER.map((type) => ({
        type,
        n: Math.max(0, Number(counts[type] || 0)),
      })).filter((p) => p.n > 0),
    [counts],
  )
  const totalNeeded = plan.reduce((s, p) => s + p.n, 0)

  // 需唔需要 AI（若題庫現有題已夠晒，就唔使）
  const needsAI = useMemo(() => {
    if (plan.length === 0) return false
    const scopeSet = new Set(scope)
    return plan.some(({ type, n }) => {
      const have = allQuestions.filter(
        (q) =>
          q.type === type &&
          q.difficulty === diffOf(type) &&
          (scope.length === 0 || scopeSet.has(q.topicId)),
      ).length
      return have < n
    })
  }, [plan, scope, allQuestions, diffMode, overallDiff, perTypeDiff])

  // 由題庫抽某題型符合範圍嘅題（已洗牌）
  const pullFromBank = (type: QuestionType, diff: Difficulty): Question[] => {
    const scopeSet = new Set(scope)
    return shuffle(
      allQuestions.filter(
        (q) =>
          q.type === type &&
          q.difficulty === diff &&
          (scope.length === 0 || scopeSet.has(q.topicId)),
      ),
    )
  }

  // 揀生成用嘅 topic 池（範圍內；空範圍 = 全部課題）
  const genTopicPool = (): TopicLite[] =>
    scope.length === 0 ? topics : topics.filter((t) => scope.includes(t.id))

  const build = async () => {
    if (busy) return
    if (plan.length === 0) {
      toast.error('請最少為一個題型設定題數')
      return
    }
    // 若要生成但未接 AI / 未登入 → 友善阻擋（純抽題唔會行到呢度）
    if (needsAI && (!isAIConfigured || !user)) {
      toast.error(
        !isAIConfigured
          ? '題庫現有題目唔夠，需要 AI 補足，但 AI 未啟用（見 docs/SETUP.md）。可減少題數或先補題。'
          : '題庫現有題目唔夠，需要 AI 補足，請先登入。',
      )
      return
    }

    setBusy(true)
    try {
      const pickedIds: string[] = []
      let pulled = 0
      let generated = 0
      let shortfall = 0
      const pool = genTopicPool()
      let rr = 0 // round-robin 指標（生成時輪流分配 topic）

      for (const { type, n } of plan) {
        const diff = diffOf(type)

        // 1) 先由題庫抽現有符合題
        const existing = pullFromBank(type, diff).slice(0, n)
        existing.forEach((q) => pickedIds.push(q.id))
        pulled += existing.length

        // 2) 唔夠 → 用引擎生成補足，逐條入題庫
        let gap = n - existing.length
        if (gap > 0 && isAIConfigured && user && pool.length > 0) {
          try {
            const drafts = await generate(type, {
              topicName: pool[rr % pool.length].topic,
              difficulty: diff,
              count: gap,
              extra: extra.trim(),
              subject: subjectName,
            })
            for (const d of drafts) {
              if (gap <= 0) break
              if (!d.stem.trim()) continue
              const topic = pool[rr % pool.length]
              rr++
              const mc =
                type === 'mc'
                  ? compactMcOptions(d.options ?? [], d.answerIndex ?? 0)
                  : null
              const added = questionsCol.add({
                topicId: topic.id,
                type,
                difficulty: diff,
                stem: d.stem.trim(),
                options: mc ? mc.options : undefined,
                answerIndex: mc ? mc.answerIndex : undefined,
                answer: type !== 'mc' ? d.answer?.trim() : undefined,
                marks: d.marks ?? undefined,
                source: 'AI 生成（試卷）',
                createdAt: new Date().toISOString(),
              })
              pickedIds.push(added.id)
              generated++
              gap--
            }
          } catch (e) {
            toast.error(
              `${TYPE_LABEL[type]}生成失敗：${(e as Error).message || '請再試一次'}`,
            )
          }
        }
        shortfall += Math.max(0, gap)
      }

      if (pickedIds.length === 0) {
        toast.error('組唔到題目，請調整範圍 / 題數，或先補題。')
        return
      }

      setOutcome({ questionIds: pickedIds, pulled, generated, shortfall })
      setStep('preview')

      if (shortfall > 0) {
        toast.error(
          `已組 ${pickedIds.length} 題（抽 ${pulled} · 生成 ${generated}），仍欠 ${shortfall} 題。`,
        )
      } else {
        toast.success(
          `已組成 ${pickedIds.length} 題（抽 ${pulled} · 生成 ${generated}）`,
        )
      }
    } catch (e) {
      toast.error((e as Error).message || '組卷失敗，請再試一次。')
    } finally {
      setBusy(false)
    }
  }

  const savePaper = () => {
    if (!outcome || outcome.questionIds.length === 0) {
      toast.error('未有題目，組卷後先可儲存')
      return
    }
    const paper = papersCol.add({
      title: title.trim() || 'BAFS 自擬試卷',
      className: className.trim(),
      durationMin: durationMin.trim(),
      questionIds: outcome.questionIds,
      createdAt: new Date().toISOString(), // runtime ISO 時間，永不留空
    })
    toast.success('已儲存試卷（可喺組卷工作室載入）')
    onSaved?.({ title: paper.title, count: outcome.questionIds.length })
  }

  const print = (withAnswers: boolean) => {
    if (previewQuestions.length === 0) {
      toast.error('未有題目可列印')
      return
    }
    const meta: PaperMeta = {
      title: title.trim(),
      className: className.trim(),
      durationMin: durationMin.trim(),
      totalMarks: previewMarks,
    }
    const html = buildPrintHtml(meta, previewQuestions, topicName, withAnswers)
    const ok = openPrintWindow(html)
    if (!ok) toast.error('瀏覽器擋咗彈出視窗，請允許後再試。')
  }

  const reset = () => {
    setOutcome(null)
    setStep('setup')
  }

  // ───────── render ─────────
  return (
    <Modal open onClose={onClose} title="生成試卷" size="lg">
      {step === 'setup' ? (
        <SetupView
          topics={topics}
          title={title}
          setTitle={setTitle}
          className={className}
          setClassName={setClassName}
          durationMin={durationMin}
          setDurationMin={setDurationMin}
          scope={scope}
          toggleScope={toggleScope}
          counts={counts}
          setCount={setCount}
          diffMode={diffMode}
          setDiffMode={setDiffMode}
          overallDiff={overallDiff}
          setOverallDiff={setOverallDiff}
          perTypeDiff={perTypeDiff}
          setPerDiff={setPerDiff}
          extra={extra}
          setExtra={setExtra}
          totalNeeded={totalNeeded}
          needsAI={needsAI}
          aiReady={isAIConfigured && !!user}
          busy={busy}
          onBuild={build}
          onClose={onClose}
        />
      ) : (
        <PreviewView
          outcome={outcome}
          questions={previewQuestions}
          totalMarks={previewMarks}
          topicName={topicName}
          savedCount={papers.length}
          busy={busy}
          onBack={reset}
          onRebuild={build}
          onSave={savePaper}
          onPrint={print}
        />
      )}
    </Modal>
  )
}

// ═══════════════════════════════════════════════════════════
//  Setup view（表單）
// ═══════════════════════════════════════════════════════════
function SetupView(props: {
  topics: TopicLite[]
  title: string
  setTitle: (v: string) => void
  className: string
  setClassName: (v: string) => void
  durationMin: string
  setDurationMin: (v: string) => void
  scope: string[]
  toggleScope: (id: string) => void
  counts: CountMap
  setCount: (type: QuestionType, v: string) => void
  diffMode: 'overall' | 'perType'
  setDiffMode: (m: 'overall' | 'perType') => void
  overallDiff: Difficulty
  setOverallDiff: (d: Difficulty) => void
  perTypeDiff: DiffMap
  setPerDiff: (type: QuestionType, d: Difficulty) => void
  extra: string
  setExtra: (v: string) => void
  totalNeeded: number
  needsAI: boolean
  aiReady: boolean
  busy: boolean
  onBuild: () => void
  onClose: () => void
}) {
  const {
    topics,
    title,
    setTitle,
    className,
    setClassName,
    durationMin,
    setDurationMin,
    scope,
    toggleScope,
    counts,
    diffMode,
    setDiffMode,
    overallDiff,
    setOverallDiff,
    perTypeDiff,
    setPerDiff,
    extra,
    setExtra,
    totalNeeded,
    needsAI,
    aiReady,
    busy,
  } = props

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-2xl border border-accent/20 bg-accent-soft/50 p-3.5 dark:border-accent/25 dark:bg-accent/10">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent text-white">
          <FileText size={16} />
        </span>
        <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
          設定課題範圍同各題型題數，系統會
          <span className="font-semibold text-accent-strong dark:text-accent">
            先由題庫抽現有題
          </span>
          ，唔夠先用 AI 生成補足（生成嘅題會一齊入庫）。組好可預覽同列印。
        </p>
      </div>

      {/* 試卷基本 */}
      <section className="space-y-3 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 dark:border-slate-700/60 dark:bg-slate-900/40">
        <Field label="試卷名稱">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例如：BAFS 第一次測驗"
            disabled={busy}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="班別（可留空）">
            <Input
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              placeholder="例如 5A"
              disabled={busy}
            />
          </Field>
          <Field label="時限（分鐘，可留空）">
            <Input
              value={durationMin}
              onChange={(e) => setDurationMin(e.target.value.replace(/\D/g, ''))}
              placeholder="例如 60"
              inputMode="numeric"
              disabled={busy}
            />
          </Field>
        </div>
      </section>

      {/* 課題範圍 */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
            課題範圍
          </span>
          <span className="text-xs text-slate-400 dark:text-slate-500">
            {scope.length === 0 ? '全部課題' : `已揀 ${scope.length} 個`}
          </span>
        </div>
        <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto rounded-2xl border border-slate-200/80 bg-white p-3 dark:border-slate-700/60 dark:bg-slate-800/40">
          {topics.map((t) => {
            const on = scope.includes(t.id)
            return (
              <button
                key={t.id}
                type="button"
                disabled={busy}
                onClick={() => toggleScope(t.id)}
                className={cx(
                  'rounded-full px-3 py-1 text-xs font-medium transition disabled:opacity-50',
                  on
                    ? 'bg-accent text-white shadow-sm dark:shadow-none'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
                )}
              >
                {t.topic}
              </button>
            )
          })}
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500">
          唔揀 = 全部課題。
        </p>
      </section>

      {/* 難度 */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
            難度
          </span>
          <SegmentedControl<'overall' | 'perType'>
            size="sm"
            value={diffMode}
            onChange={setDiffMode}
            options={[
              { id: 'overall', label: '整體' },
              { id: 'perType', label: '逐型' },
            ]}
          />
        </div>
        {diffMode === 'overall' ? (
          <Pills
            options={DIFF_ORDER.map((d) => ({ id: d, label: DIFF_LABEL[d] }))}
            active={overallDiff}
            onChange={setOverallDiff}
          />
        ) : null}
      </section>

      {/* 各題型題數（＋逐型難度） */}
      <section className="space-y-2.5">
        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
          各題型題數
        </span>
        <div className="space-y-2.5">
          {TYPE_ORDER.map((type) => (
            <div
              key={type}
              className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 dark:border-slate-700/60 dark:bg-slate-800/40"
            >
              <Badge tone="slate" className="shrink-0">
                {TYPE_LABEL[type]}
              </Badge>
              <div className="flex items-center gap-1.5">
                <Input
                  value={counts[type]}
                  onChange={(e) => props.setCount(type, e.target.value)}
                  inputMode="numeric"
                  list="paper-count-presets"
                  disabled={busy}
                  className="w-20 text-center"
                  aria-label={`${TYPE_LABEL[type]}題數`}
                />
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  題
                </span>
              </div>
              {diffMode === 'perType' && Number(counts[type] || 0) > 0 ? (
                <div className="ml-auto">
                  <Pills
                    size="sm"
                    options={DIFF_ORDER.map((d) => ({
                      id: d,
                      label: DIFF_LABEL[d],
                    }))}
                    active={perTypeDiff[type]}
                    onChange={(d) => setPerDiff(type, d)}
                  />
                </div>
              ) : null}
            </div>
          ))}
        </div>
        <datalist id="paper-count-presets">
          {COUNT_PRESETS.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
        <p className="text-xs text-slate-400 dark:text-slate-500">
          合共 <span className="nums font-semibold">{totalNeeded}</span> 題
        </p>
      </section>

      {/* 補充指示 */}
      <Field label="補充指示（生成補足時用，可留空）">
        <Textarea
          value={extra}
          onChange={(e) => setExtra(e.target.value)}
          placeholder="例如：題目貼香港中小企情境、計算題寫清步驟…"
          rows={2}
          disabled={busy}
        />
      </Field>

      {/* AI 提示 */}
      {needsAI ? (
        aiReady ? (
          <p className="flex items-start gap-2 rounded-xl border border-accent/20 bg-accent-soft/40 px-3 py-2 text-xs text-slate-600 dark:border-accent/25 dark:bg-accent/10 dark:text-slate-300">
            <Sparkles size={14} className="mt-0.5 shrink-0 text-accent" />
            題庫現有題目唔夠，組卷時會用 AI 自動生成補足並一齊入庫。
          </p>
        ) : (
          <p className="flex items-start gap-2 rounded-xl border border-amber-300/50 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300">
            <Lock size={14} className="mt-0.5 shrink-0" />
            題庫現有題目唔夠，需要 AI 補足，但 AI 未啟用 / 未登入。可減少題數，或先到題庫補題後再組卷。
          </p>
        )
      ) : totalNeeded > 0 ? (
        <p className="flex items-start gap-2 rounded-xl border border-emerald-300/50 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300">
          <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
          題庫現有題目已足夠，直接抽題組卷（唔需要 AI）。
        </p>
      ) : null}

      {busy && (
        <div
          className="space-y-2 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 dark:border-slate-700/80 dark:bg-slate-900/40"
          aria-live="polite"
        >
          <p className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <Wand2 size={15} className="animate-pulse text-accent" />
            組卷中（抽題 / 生成補足），請等一等…
          </p>
          <div className="h-2.5 w-full animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
          <div className="h-2.5 w-3/5 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
        </div>
      )}

      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-700/60">
        <Button variant="secondary" onClick={props.onClose} disabled={busy}>
          取消
        </Button>
        <Button
          icon={Wand2}
          loading={busy}
          onClick={props.onBuild}
          disabled={busy || totalNeeded === 0}
        >
          {busy ? '組卷中…' : '組卷'}
        </Button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
//  Preview view（預覽 + 存 + 列印）
// ═══════════════════════════════════════════════════════════
function PreviewView({
  outcome,
  questions,
  totalMarks,
  topicName,
  savedCount,
  busy,
  onBack,
  onRebuild,
  onSave,
  onPrint,
}: {
  outcome: BuildOutcome | null
  questions: Question[]
  totalMarks: number
  topicName: (id: string) => string
  savedCount: number
  busy: boolean
  onBack: () => void
  onRebuild: () => void
  onSave: () => void
  onPrint: (withAnswers: boolean) => void
}) {
  if (!outcome || questions.length === 0) {
    return (
      <div className="space-y-4">
        <EmptyState
          icon={FileText}
          title="未有組好嘅題目"
          hint="返回設定，揀課題範圍同題數再組卷。"
        />
        <div className="flex justify-end">
          <Button variant="secondary" icon={ArrowLeft} onClick={onBack}>
            返回設定
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* 概要 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone="accent">
            共 <span className="nums">{questions.length}</span> 題
          </Badge>
          <Badge tone="slate">
            總分 <span className="nums">{totalMarks}</span> 分
          </Badge>
          <span className="text-xs text-slate-400 dark:text-slate-500">
            抽題 <span className="nums">{outcome.pulled}</span> · 生成{' '}
            <span className="nums">{outcome.generated}</span>
            {outcome.shortfall > 0 ? (
              <>
                {' '}
                · 仍欠 <span className="nums">{outcome.shortfall}</span>
              </>
            ) : null}
          </span>
        </div>
        <span className="text-xs text-slate-400 dark:text-slate-500">
          已儲存 <span className="nums">{savedCount}</span> 份
        </span>
      </div>

      {outcome.shortfall > 0 && (
        <p className="rounded-xl border border-amber-300/50 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300">
          題庫加生成仍欠 {outcome.shortfall} 題（題池不足或部分生成失敗）。可「再組卷」或返回減少題數。
        </p>
      )}

      {/* 逐題預覽（含列印用 print 區，但 util 列印係開新視窗，呢度只係螢幕預覽） */}
      <ol className="space-y-2">
        {questions.map((q, i) => (
          <Card key={q.id} className="p-3">
            <div className="flex items-start gap-3">
              <span className="nums mt-0.5 shrink-0 text-sm font-semibold text-slate-400 dark:text-slate-500">
                {i + 1}.
              </span>
              <div className="flex-1 space-y-1.5">
                <p className="whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-100">
                  {q.stem}
                  {q.marks ? (
                    <span className="ml-1.5 text-xs text-slate-400 dark:text-slate-500">
                      （{q.marks} 分）
                    </span>
                  ) : null}
                </p>
                {q.type === 'mc' && q.options ? (
                  <ul className="space-y-0.5 pl-1 text-sm">
                    {q.options.map((o, oi) => (
                      <li
                        key={oi}
                        className={
                          oi === q.answerIndex
                            ? 'font-semibold text-emerald-700 dark:text-emerald-400'
                            : 'text-slate-600 dark:text-slate-300'
                        }
                      >
                        {String.fromCharCode(65 + oi)}. {o}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <Badge tone="accent">{topicName(q.topicId)}</Badge>
                  <Badge tone="slate">{TYPE_LABEL[q.type]}</Badge>
                  <Badge tone={DIFF_TONE[q.difficulty]} dot>
                    {DIFF_LABEL[q.difficulty]}
                  </Badge>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </ol>

      {/* 動作 */}
      <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-700/60">
        <Button variant="ghost" icon={ArrowLeft} onClick={onBack} disabled={busy}>
          返回設定
        </Button>
        <Button
          variant="secondary"
          icon={RotateCcw}
          loading={busy}
          onClick={onRebuild}
          disabled={busy}
        >
          {busy ? '組卷中…' : '再組卷'}
        </Button>
        <Button variant="secondary" icon={Printer} onClick={() => onPrint(false)} disabled={busy}>
          列印（學生）
        </Button>
        <Button variant="secondary" icon={Printer} onClick={() => onPrint(true)} disabled={busy}>
          列印（含答案）
        </Button>
        <Button icon={Save} onClick={onSave} disabled={busy}>
          儲存試卷
        </Button>
      </div>
    </div>
  )
}
