import { useMemo, useRef, useState } from 'react'
import { useCollection } from '../../lib/store'
import { useMode } from '../../context/ModeContext'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import { questionsCol, topicsCol, quizAttemptsCol } from '../../data/collections'
import type { Difficulty, Question, QuizAttempt, QuizAttemptItem } from '../../data/types'
import {
  ArrowLeft,
  ArrowRight,
  BookMarked,
  Check,
  FolderOpen,
  HelpCircle,
  PartyPopper,
  Target,
  Timer,
  X,
} from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Pills,
  ProgressBar,
  Select,
  SectionTitle,
  StatCard,
  cx,
} from '../../ui'

// ============================================================
//  自我測驗（QuizMode）— 題庫做題 + 即時批改 + 成績存檔
//  learning + work 共用。由 BAFS 題庫抽合資格 MC 即時做題。
//  唔涉及 AI，零新依賴；弱項分析用純 div + ProgressBar 砌。
// ============================================================

// ───── 標籤 / 樣式對照（本地定義，跟 QuestionBank 同一慣例）─────
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

// 範圍難度（含『不限』）
type DiffFilter = Difficulty | 'all'
const DIFF_FILTER_LABEL: Record<DiffFilter, string> = {
  all: '不限',
  easy: '易',
  medium: '中',
  hard: '難',
}

// 出題模式
type GradeMode = 'instant' | 'end'

// 題數選項（Pills 要 string id；'all' = 全部）
type CountId = '5' | '10' | '15' | '20' | 'all'
const COUNT_OPTIONS: { id: CountId; label: string }[] = [
  { id: '5', label: '5 題' },
  { id: '10', label: '10 題' },
  { id: '15', label: '15 題' },
  { id: '20', label: '20 題' },
  { id: 'all', label: '全部' },
]

// ───── 設定（由 setup 帶去 quiz / result，用嚟『再做一份』『重做錯題』）─────
interface QuizSettings {
  topicId: string // '' = 全部課題
  difficulty: DiffFilter
  count: CountId
  gradeMode: GradeMode
}

const DEFAULT_SETTINGS: QuizSettings = {
  topicId: '',
  difficulty: 'all',
  count: '10',
  gradeMode: 'instant',
}

// ───── View 狀態機（學 Flashcards.tsx）─────
type View =
  | { name: 'setup' }
  | { name: 'quiz'; questionIds: string[]; settings: QuizSettings }
  | { name: 'result'; attemptId: string; settings: QuizSettings }

// ============================================================
//  共用 helper（檔內，唔 import 外部 library）
// ============================================================

// 合資格 MC：有選項（>=2）+ 有效正確答案 index
function isQuizable(q: Question): boolean {
  return (
    q.type === 'mc' &&
    Array.isArray(q.options) &&
    q.options.length >= 2 &&
    typeof q.answerIndex === 'number' &&
    q.answerIndex >= 0 &&
    q.answerIndex < q.options.length
  )
}

// Fisher–Yates 洗牌（回傳新陣列）
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const pad2 = (n: number) => String(n).padStart(2, '0')

// ISO → `YYYY-MM-DD HH:mm`（純 Date，唔 import date library）
function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(
    d.getHours(),
  )}:${pad2(d.getMinutes())}`
}

// 秒 → `mm:ss`
function fmtDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec))
  return `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`
}

// 命中率 → 文字色（>=80 emerald / 50-79 amber / <50 rose），帶 dark:
function scoreColor(pct: number): string {
  if (pct >= 80) return 'text-emerald-600 dark:text-emerald-400'
  if (pct >= 50) return 'text-amber-600 dark:text-amber-400'
  return 'text-rose-600 dark:text-rose-400'
}

const pct = (correct: number, total: number) =>
  total > 0 ? Math.round((correct / total) * 100) : 0

// 由歷史 attempt 還原一份設定（重溫後若按「重做錯題」會沿用）
function settingsFromAttempt(a: QuizAttempt): QuizSettings {
  const COUNTS: CountId[] = ['5', '10', '15', '20']
  const asCount = String(a.total) as CountId
  return {
    topicId: a.topicIds[0] ?? '',
    difficulty: a.difficulty,
    count: COUNTS.includes(asCount) ? asCount : 'all',
    gradeMode: 'instant',
  }
}

// ============================================================
//  根元件
// ============================================================
export default function QuizMode() {
  const [view, setView] = useState<View>({ name: 'setup' })

  if (view.name === 'quiz')
    return (
      <QuizRunner
        key={view.questionIds.join('|')}
        questionIds={view.questionIds}
        settings={view.settings}
        onAbort={() => setView({ name: 'setup' })}
        onFinish={(attemptId) =>
          setView({ name: 'result', attemptId, settings: view.settings })
        }
      />
    )

  if (view.name === 'result')
    return (
      <ResultView
        attemptId={view.attemptId}
        onBackToSetup={() => setView({ name: 'setup' })}
        onRetryWrong={(questionIds) =>
          setView({ name: 'quiz', questionIds, settings: view.settings })
        }
      />
    )

  return (
    <SetupView
      onStart={(questionIds, settings) =>
        setView({ name: 'quiz', questionIds, settings })
      }
      onReview={(attemptId, settings) =>
        setView({ name: 'result', attemptId, settings })
      }
    />
  )
}

// ============================================================
//  A) SetupView — 設定 + 歷史紀錄（預設畫面）
// ============================================================
function SetupView({
  onStart,
  onReview,
}: {
  onStart: (questionIds: string[], settings: QuizSettings) => void
  onReview: (attemptId: string, settings: QuizSettings) => void
}) {
  const questions = useCollection(questionsCol)
  const topics = useCollection(topicsCol)
  const attempts = useCollection(quizAttemptsCol)
  const toast = useToast()
  const confirm = useConfirm()

  const [settings, setSettings] = useState<QuizSettings>(DEFAULT_SETTINGS)
  const set = <K extends keyof QuizSettings>(k: K, v: QuizSettings[K]) =>
    setSettings((s) => ({ ...s, [k]: v }))

  const topicName = (id: string) =>
    topics.find((t) => t.id === id)?.topic ?? '未分類'

  // 全部合資格 MC
  const quizablePool = useMemo(() => questions.filter(isQuizable), [questions])

  // 按範圍 + 難度過濾後嘅可用題目
  const matched = useMemo(
    () =>
      quizablePool
        .filter((q) => (settings.topicId ? q.topicId === settings.topicId : true))
        .filter((q) =>
          settings.difficulty === 'all'
            ? true
            : q.difficulty === settings.difficulty,
        ),
    [quizablePool, settings.topicId, settings.difficulty],
  )

  // 揀嘅題數 vs 實際可取（取 min）
  const wantCount =
    settings.count === 'all' ? matched.length : Number(settings.count)
  const takeCount = Math.min(wantCount, matched.length)
  const cappedByPool = settings.count !== 'all' && wantCount > matched.length

  // 歷史統計
  const historyDesc = useMemo(
    () => [...attempts].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [attempts],
  )
  const avgPct = useMemo(() => {
    if (attempts.length === 0) return null
    const sum = attempts.reduce((acc, a) => acc + pct(a.correctCount, a.total), 0)
    return Math.round(sum / attempts.length)
  }, [attempts])

  // 範圍標題（存落 attempt.title）
  const scopeLabel = settings.topicId ? topicName(settings.topicId) : '全部課題'

  const start = () => {
    if (takeCount === 0) return
    const picked = shuffle(matched).slice(0, takeCount)
    onStart(
      picked.map((q) => q.id),
      settings,
    )
  }

  const removeAttempt = async (a: QuizAttempt) => {
    const ok = await confirm({
      title: '刪除測驗紀錄？',
      message: `「${a.title}」嘅成績會被永久刪除，無法復原。`,
      confirmText: '刪除',
      tone: 'danger',
    })
    if (!ok) return
    quizAttemptsCol.remove(a.id)
    toast.success('已刪除測驗紀錄')
  }

  return (
    <div className="animate-fade-in space-y-5">
      {/* 總覽 StatCard */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label="可測題數"
          value={quizablePool.length}
          unit="題"
          icon={BookMarked}
          highlight
        />
        <StatCard
          label="測驗次數"
          value={attempts.length}
          unit="次"
          icon={FolderOpen}
        />
        <StatCard
          label="平均分"
          value={avgPct == null ? '—' : `${avgPct}%`}
          icon={Target}
        />
      </div>

      {quizablePool.length === 0 ? (
        <EmptyState
          icon={BookMarked}
          title="題庫未有選擇題"
          hint="先去『BAFS 題庫』新增有選項同正確答案嘅 MC 題目，再返嚟自測。"
        />
      ) : (
        <section>
          <SectionTitle>開始測驗</SectionTitle>
          <Card className="space-y-4 p-4">
            {/* 課題範圍（單選 Select + 全部） */}
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                課題範圍
              </span>
              <Select
                value={settings.topicId}
                onChange={(e) => set('topicId', e.target.value)}
              >
                <option value="">全部課題</option>
                {topics.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.topic}
                  </option>
                ))}
              </Select>
            </label>

            {/* 難度 */}
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                難度
              </span>
              <Pills
                options={[
                  { id: 'all', label: DIFF_FILTER_LABEL.all },
                  ...DIFF_ORDER.map((d) => ({ id: d, label: DIFF_LABEL[d] })),
                ]}
                active={settings.difficulty}
                onChange={(v) => set('difficulty', v as DiffFilter)}
              />
              <p className="text-xs text-slate-400 dark:text-slate-500">
                符合條件題目：
                <span className="font-semibold text-accent">{matched.length}</span>{' '}
                題
              </p>
            </div>

            {/* 題數 */}
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                題數
              </span>
              <Pills
                options={COUNT_OPTIONS}
                active={settings.count}
                onChange={(v) => set('count', v as CountId)}
              />
              {cappedByPool && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  可用題目唔夠，實際出 {takeCount} 題。
                </p>
              )}
            </div>

            {/* 出題模式 */}
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                出題模式
              </span>
              <Pills
                options={[
                  { id: 'instant', label: '逐題即時對答案' },
                  { id: 'end', label: '最後一次過批改' },
                ]}
                active={settings.gradeMode}
                onChange={(v) => set('gradeMode', v as GradeMode)}
              />
            </div>

            <Button
              size="lg"
              className="w-full"
              disabled={takeCount === 0}
              onClick={start}
            >
              {takeCount === 0
                ? '無符合條件題目'
                : `開始測驗（${takeCount} 題） · ${scopeLabel} · ${DIFF_FILTER_LABEL[settings.difficulty]}`}
            </Button>
          </Card>
        </section>
      )}

      {/* 歷史紀錄 */}
      <section>
        <SectionTitle>歷史紀錄</SectionTitle>
        {historyDesc.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title="仲未有測驗紀錄"
            hint="完成第一次自測之後，成績會喺呢度睇返、重溫同重做錯題。"
          />
        ) : (
          <ul className="space-y-2">
            {historyDesc.map((a) => {
              const p = pct(a.correctCount, a.total)
              return (
                <Card key={a.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {a.title}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                        {formatDateTime(a.createdAt)}
                      </p>
                    </div>
                    <div
                      className={cx(
                        'shrink-0 text-2xl font-bold tabular-nums',
                        scoreColor(p),
                      )}
                    >
                      {p}%
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge tone="slate">
                      <span className="tabular-nums">
                        {a.correctCount}/{a.total}
                      </span>{' '}
                      題
                    </Badge>
                    <Badge tone="slate" icon={Timer}>
                      <span className="tabular-nums">
                        {fmtDuration(a.durationSec)}
                      </span>
                    </Badge>
                    <Badge tone={a.mode === 'work' ? 'blue' : 'accent'}>
                      {a.mode === 'work' ? '工作' : '學習'}
                    </Badge>
                  </div>

                  <div className="mt-3 flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onReview(a.id, settingsFromAttempt(a))}
                    >
                      重溫
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeAttempt(a)}
                      className="hover:text-rose-500"
                    >
                      刪除
                    </Button>
                  </div>
                </Card>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}

// ============================================================
//  選項列（做題 + 結果頁共用）
// ============================================================
function OptionRow({
  index,
  text,
  selected,
  graded,
  isAnswer,
  disabled,
  onClick,
}: {
  index: number
  text: string
  selected: boolean
  graded: boolean // 已批改（顯示對錯著色）
  isAnswer: boolean // 係正確答案
  disabled?: boolean
  onClick?: () => void
}) {
  const wrongPick = graded && selected && !isAnswer

  let tone: string
  if (graded) {
    if (isAnswer)
      tone =
        'border-emerald-400 bg-emerald-50 text-emerald-700 dark:border-emerald-500/50 dark:bg-emerald-500/15 dark:text-emerald-300'
    else if (wrongPick)
      tone =
        'border-rose-400 bg-rose-50 text-rose-700 dark:border-rose-500/50 dark:bg-rose-500/15 dark:text-rose-300'
    else
      tone =
        'border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
  } else if (selected) {
    tone =
      'border-accent bg-accent-soft text-accent-strong dark:border-accent/60 dark:bg-accent/15 dark:text-accent'
  } else {
    tone =
      'border-slate-200 bg-white text-slate-700 hover:border-accent/50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cx(
        'flex w-full items-start gap-2 rounded-xl border p-3 text-left text-sm transition disabled:cursor-default',
        tone,
      )}
    >
      <span className="font-semibold">{String.fromCharCode(65 + index)}.</span>
      <span className="flex-1">{text}</span>
      {graded && isAnswer && (
        <Check
          size={16}
          strokeWidth={2.5}
          className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400"
        />
      )}
      {wrongPick && (
        <X
          size={16}
          strokeWidth={2.5}
          className="mt-0.5 shrink-0 text-rose-600 dark:text-rose-400"
        />
      )}
    </button>
  )
}

// ============================================================
//  B) QuizRunner — 做題
// ============================================================
// 開場一次性快照題目（凍結 stem/options/answerIndex），之後唔再依賴 collection。
interface FrozenQuestion {
  questionId: string
  topicId: string
  difficulty: Difficulty
  stem: string
  options: string[]
  answerIndex: number
  explanation: string // 來自 Question.answer（MC 通常為空）
}

function QuizRunner({
  questionIds,
  settings,
  onAbort,
  onFinish,
}: {
  questionIds: string[]
  settings: QuizSettings
  onAbort: () => void
  onFinish: (attemptId: string) => void
}) {
  const { mode } = useMode()
  const toast = useToast()
  const confirm = useConfirm()
  const topics = useCollection(topicsCol)

  const topicName = (id: string) =>
    topics.find((t) => t.id === id)?.topic ?? '未分類'

  // 鎖定題目快照（只喺開場一次）
  const [quizItems] = useState<FrozenQuestion[]>(() => {
    const all = questionsCol.get()
    const out: FrozenQuestion[] = []
    for (const id of questionIds) {
      const q = all.find((x) => x.id === id)
      if (q && isQuizable(q)) {
        out.push({
          questionId: q.id,
          topicId: q.topicId,
          difficulty: q.difficulty,
          stem: q.stem,
          options: q.options!,
          answerIndex: q.answerIndex!,
          explanation: q.answer?.trim() ?? '',
        })
      }
    }
    return out
  })

  const startedAt = useRef(Date.now())
  const [answers, setAnswers] = useState<Record<string, number | null>>({})
  const [currentIdx, setCurrentIdx] = useState(0)

  const total = quizItems.length
  const answeredCount = useMemo(
    () =>
      quizItems.filter((q) => {
        const v = answers[q.questionId]
        return v !== undefined && v !== null
      }).length,
    [quizItems, answers],
  )

  // 防呆：快照後一條都唔合資格（題庫剛好清空 + 重做）
  if (total === 0) {
    return (
      <Card className="space-y-4 p-8 text-center">
        <BookMarked
          size={32}
          strokeWidth={1.75}
          className="mx-auto text-slate-300 dark:text-slate-600"
        />
        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
          呢批題目已經唔喺題庫，無法做題。
        </p>
        <Button onClick={onAbort}>返回設定</Button>
      </Card>
    )
  }

  const current = quizItems[currentIdx]
  const selected = answers[current.questionId]
  const isAnswered = selected !== undefined && selected !== null
  // instant 模式：揀完即時鎖定 + 著色
  const graded = settings.gradeMode === 'instant' && isAnswered
  const isLast = currentIdx === total - 1

  const choose = (optIdx: number) => {
    // instant 模式揀完即鎖（唔可以改）
    if (settings.gradeMode === 'instant' && isAnswered) return
    setAnswers((a) => ({ ...a, [current.questionId]: optIdx }))
  }

  const skip = () => {
    setAnswers((a) => ({ ...a, [current.questionId]: null }))
    if (!isLast) setCurrentIdx((i) => i + 1)
  }

  const goPrev = () => setCurrentIdx((i) => Math.max(0, i - 1))
  const goNext = () => setCurrentIdx((i) => Math.min(total - 1, i + 1))

  const abort = async () => {
    const ok = await confirm({
      title: '結束測驗？',
      message: '結束會放棄今次測驗，未存檔。確定？',
      confirmText: '結束',
      tone: 'danger',
    })
    if (ok) onAbort()
  }

  const submit = async () => {
    const unanswered = quizItems.filter((q) => {
      const v = answers[q.questionId]
      return v === undefined || v === null
    }).length
    if (unanswered > 0) {
      const ok = await confirm({
        title: '提早交卷？',
        message: `仲有 ${unanswered} 題未答，當錯計，確定交卷？`,
        confirmText: '交卷',
      })
      if (!ok) return
    }

    const items: QuizAttemptItem[] = quizItems.map((q) => {
      const sel = answers[q.questionId]
      const selectedIndex = sel === undefined ? null : sel
      const correct = selectedIndex !== null && selectedIndex === q.answerIndex
      return {
        questionId: q.questionId,
        topicId: q.topicId,
        difficulty: q.difficulty,
        stem: q.stem,
        options: q.options,
        answerIndex: q.answerIndex,
        selectedIndex,
        correct,
      }
    })
    const correctCount = items.filter((i) => i.correct).length
    const durationSec = Math.round((Date.now() - startedAt.current) / 1000)
    const scopeLabel = settings.topicId
      ? topicName(settings.topicId)
      : '全部課題'
    const title = `${scopeLabel} · ${DIFF_FILTER_LABEL[settings.difficulty]} · ${total} 題`

    const created = quizAttemptsCol.add({
      createdAt: new Date().toISOString(),
      mode,
      title,
      topicIds: settings.topicId ? [settings.topicId] : [],
      difficulty: settings.difficulty,
      total,
      correctCount,
      durationSec,
      items,
    })
    toast.success(`完成！${correctCount}/${total} 答啱`)
    onFinish(created.id)
  }

  return (
    <div className="animate-fade-in space-y-4">
      {/* 頂部列 */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={abort}>
          結束測驗
        </Button>
        <span className="text-xs font-medium tabular-nums text-slate-500 dark:text-slate-400">
          第 {currentIdx + 1} / {total} 題
        </span>
      </div>

      <ProgressBar value={(answeredCount / total) * 100} />

      {/* 題目卡（用 currentIdx 做 key 令切題有過場） */}
      <Card key={current.questionId} className="animate-fade-in space-y-4 p-5">
        <div className="flex flex-wrap gap-1.5">
          <Badge tone="accent">{topicName(current.topicId)}</Badge>
          <Badge tone={DIFF_TONE[current.difficulty]}>
            {DIFF_LABEL[current.difficulty]}
          </Badge>
        </div>

        <p className="text-base font-medium text-slate-800 dark:text-slate-100">
          {current.stem}
        </p>

        <div className="space-y-2">
          {current.options.map((opt, i) => (
            <OptionRow
              key={i}
              index={i}
              text={opt}
              selected={selected === i}
              graded={graded}
              isAnswer={i === current.answerIndex}
              disabled={graded}
              onClick={() => choose(i)}
            />
          ))}
        </div>

        {/* instant 模式批改後顯示解釋（如有） */}
        {graded && current.explanation && (
          <div className="mt-3 border-t border-slate-100 pt-3 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              解釋：
            </span>
            {current.explanation}
          </div>
        )}
      </Card>

      {/* 底部導航 */}
      {settings.gradeMode === 'instant' ? (
        <div className="grid grid-cols-2 gap-2">
          {!isAnswered ? (
            <Button variant="ghost" onClick={skip}>
              跳過
            </Button>
          ) : (
            <div />
          )}
          {isLast ? (
            <Button iconRight={Check} onClick={submit}>
              交卷
            </Button>
          ) : (
            <Button iconRight={ArrowRight} onClick={goNext} disabled={!isAnswered}>
              下一題
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            icon={ArrowLeft}
            onClick={goPrev}
            disabled={currentIdx === 0}
            className="flex-1"
          >
            上一題
          </Button>
          <Button
            variant="secondary"
            iconRight={ArrowRight}
            onClick={goNext}
            disabled={isLast}
            className="flex-1"
          >
            下一題
          </Button>
          <Button onClick={submit} className="w-full sm:w-auto">
            交卷
          </Button>
        </div>
      )}
    </div>
  )
}

// ============================================================
//  C) ResultView — 成績 + 弱項分析 + 逐題對答案
// ============================================================
function ResultView({
  attemptId,
  onBackToSetup,
  onRetryWrong,
}: {
  attemptId: string
  onBackToSetup: () => void
  onRetryWrong: (questionIds: string[]) => void
}) {
  const attempts = useCollection(quizAttemptsCol)
  const topics = useCollection(topicsCol)
  const questions = useCollection(questionsCol)

  const attempt = attempts.find((a) => a.id === attemptId)

  const topicName = (id: string) =>
    topics.find((t) => t.id === id)?.topic ?? '未分類'

  // 按課題 / 難度分組統計（hooks 一定要喺 early-return 之前）
  const byTopic = useMemo(() => {
    const map = new Map<string, { correct: number; total: number }>()
    for (const it of attempt?.items ?? []) {
      const g = map.get(it.topicId) ?? { correct: 0, total: 0 }
      g.total++
      if (it.correct) g.correct++
      map.set(it.topicId, g)
    }
    return [...map.entries()]
  }, [attempt])

  const byDiff = useMemo(() => {
    return DIFF_ORDER.map((d) => {
      const items = (attempt?.items ?? []).filter((i) => i.difficulty === d)
      const correct = items.filter((i) => i.correct).length
      return { diff: d, correct, total: items.length }
    }).filter((r) => r.total > 0)
  }, [attempt])

  if (!attempt) {
    return (
      <Card className="space-y-4 p-8 text-center">
        <HelpCircle
          size={32}
          strokeWidth={1.75}
          className="mx-auto text-slate-300 dark:text-slate-600"
        />
        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
          搵唔到呢份成績紀錄。
        </p>
        <Button onClick={onBackToSetup}>返回</Button>
      </Card>
    )
  }

  const p = pct(attempt.correctCount, attempt.total)

  // 重做錯題：只抽答錯且仍存在於題庫嘅 id
  const existingIds = new Set(questions.map((q) => q.id))
  const wrongIds = attempt.items
    .filter((i) => !i.correct)
    .map((i) => i.questionId)
    .filter((id) => existingIds.has(id))
  const allCorrect = attempt.items.every((i) => i.correct)

  return (
    <div className="animate-fade-in space-y-5">
      <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={onBackToSetup}>
        返回
      </Button>

      {/* 大字成績卡 */}
      <Card className="space-y-3 p-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          {attempt.title}
        </p>
        <p className={cx('text-4xl font-bold tabular-nums', scoreColor(p))}>
          {p}%
        </p>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          <span className="tabular-nums">
            {attempt.correctCount} / {attempt.total}
          </span>{' '}
          答啱 · 用時{' '}
          <span className="tabular-nums">{fmtDuration(attempt.durationSec)}</span>
        </p>
        <ProgressBar value={p} />
      </Card>

      {/* 弱項分析 */}
      <section>
        <SectionTitle>弱項分析</SectionTitle>
        <Card className="space-y-4 p-4">
          <div className="space-y-3">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              按課題
            </p>
            {byTopic.map(([topicId, g]) => {
              const gp = pct(g.correct, g.total)
              return (
                <div key={topicId} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex min-w-0 items-center gap-1.5 text-slate-700 dark:text-slate-200">
                      <span className="truncate">{topicName(topicId)}</span>
                      {gp < 60 && <Badge tone="rose">待加強</Badge>}
                    </span>
                    <span
                      className={cx(
                        'shrink-0 font-medium tabular-nums',
                        scoreColor(gp),
                      )}
                    >
                      {g.correct}/{g.total} · {gp}%
                    </span>
                  </div>
                  <ProgressBar value={gp} />
                </div>
              )
            })}
          </div>

          <div className="space-y-3 border-t border-slate-100 pt-4 dark:border-slate-700">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              按難度
            </p>
            {byDiff.map((r) => {
              const gp = pct(r.correct, r.total)
              return (
                <div key={r.diff} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
                      <Badge tone={DIFF_TONE[r.diff]}>{DIFF_LABEL[r.diff]}</Badge>
                      {gp < 60 && <Badge tone="amber">待加強</Badge>}
                    </span>
                    <span
                      className={cx(
                        'shrink-0 font-medium tabular-nums',
                        scoreColor(gp),
                      )}
                    >
                      {r.correct}/{r.total} · {gp}%
                    </span>
                  </div>
                  <ProgressBar value={gp} />
                </div>
              )
            })}
          </div>
        </Card>
      </section>

      {/* 逐題檢視 */}
      <section>
        <SectionTitle>逐題檢視</SectionTitle>
        <ul className="space-y-3">
          {attempt.items.map((it, idx) => (
            <Card key={idx} className="space-y-3 p-4">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-sm font-semibold tabular-nums text-slate-500 dark:text-slate-400">
                  第 {idx + 1} 題
                </span>
                <Badge tone="accent">{topicName(it.topicId)}</Badge>
                <Badge tone={DIFF_TONE[it.difficulty]}>
                  {DIFF_LABEL[it.difficulty]}
                </Badge>
                {it.selectedIndex === null ? (
                  <Badge tone="slate">未作答</Badge>
                ) : it.correct ? (
                  <Badge tone="green">答啱</Badge>
                ) : (
                  <Badge tone="rose">答錯</Badge>
                )}
              </div>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                {it.stem}
              </p>
              <div className="space-y-2">
                {it.options.map((opt, i) => (
                  <OptionRow
                    key={i}
                    index={i}
                    text={opt}
                    selected={it.selectedIndex === i}
                    graded
                    isAnswer={i === it.answerIndex}
                    disabled
                  />
                ))}
              </div>
            </Card>
          ))}
        </ul>
      </section>

      {/* 底部行動 */}
      <div className="flex flex-wrap gap-2">
        {allCorrect ? (
          <Button disabled icon={PartyPopper} className="flex-1">
            全部答啱
          </Button>
        ) : (
          <Button
            className="flex-1"
            disabled={wrongIds.length === 0}
            onClick={() => onRetryWrong(wrongIds)}
          >
            <span className="tabular-nums">重做錯題（{wrongIds.length}）</span>
          </Button>
        )}
        <Button variant="secondary" onClick={onBackToSetup}>
          再做一份
        </Button>
      </div>
    </div>
  )
}
