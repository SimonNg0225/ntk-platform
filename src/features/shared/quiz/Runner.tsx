import { useEffect, useMemo, useRef, useState } from 'react'
import { useCollection } from '../../../lib/store'
import { useMode } from '../../../context/ModeContext'
import { useToast } from '../../../context/ToastContext'
import { useConfirm } from '../../../context/ConfirmContext'
import { questionsCol, topicsCol, quizAttemptsCol } from '../../../data/collections'
import type { QuizAttemptItem } from '../../../data/types'
import {
  ArrowLeft,
  ArrowRight,
  BookMarked,
  Check,
  CornerDownLeft,
  Flag,
  LayoutGrid,
  SkipForward,
  Trophy,
  Zap,
} from 'lucide-react'
import { Badge, Button, Card, Input, ProgressBar, cx } from '../../../ui'
import {
  BASE_POINTS,
  DIFF_FILTER_LABEL,
  DIFF_LABEL,
  DIFF_TONE,
  SPEED_BONUS,
  isQuizable,
  itemFromFrozen,
  shortMatches,
  shuffle,
  syncMistakesFromAttempt,
  type FrozenQuestion,
  type QuizSettings,
} from './util'
import { CountdownRing, OptionRow } from './parts'

// ============================================================
//  QuizRunner — 做題（MC + 短答 / 計時搶分 / 導航格 / 鍵盤）
// ============================================================

export function QuizRunner({
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
  const topicName = (id: string) => topics.find((t) => t.id === id)?.topic ?? '未分類'

  // 鎖定題目快照（只喺開場一次）— 連洗牌都凍結
  const [quizItems] = useState<FrozenQuestion[]>(() => {
    const all = questionsCol.get()
    const out: FrozenQuestion[] = []
    for (const id of questionIds) {
      const q = all.find((x) => x.id === id)
      if (!q || !isQuizable(q, settings.includeShort)) continue
      const isMc =
        q.type === 'mc' && Array.isArray(q.options) && typeof q.answerIndex === 'number'
      if (isMc) {
        const opts = q.options as string[]
        const ans = q.answerIndex as number
        if (settings.shuffleOptions) {
          const idx = opts.map((_, i) => i)
          const order = shuffle(idx)
          out.push({
            questionId: q.id,
            kind: 'mc',
            topicId: q.topicId,
            difficulty: q.difficulty,
            stem: q.stem,
            options: order.map((i) => opts[i]),
            answerIndex: order.indexOf(ans),
            explanation: q.answer?.trim() ?? '',
          })
        } else {
          out.push({
            questionId: q.id,
            kind: 'mc',
            topicId: q.topicId,
            difficulty: q.difficulty,
            stem: q.stem,
            options: opts,
            answerIndex: ans,
            explanation: q.answer?.trim() ?? '',
          })
        }
      } else {
        out.push({
          questionId: q.id,
          kind: 'short',
          topicId: q.topicId,
          difficulty: q.difficulty,
          stem: q.stem,
          options: [],
          answerIndex: 0,
          explanation: (q.answer ?? '').trim(),
        })
      }
    }
    return out
  })

  const isTimed = settings.mode === 'timed'
  const isInstant = settings.mode === 'practice' || isTimed

  const startedAt = useRef(Date.now())
  const [answers, setAnswers] = useState<Record<string, number | null>>({})
  const [shortInputs, setShortInputs] = useState<Record<string, string>>({})
  const [revealed, setRevealed] = useState<Record<string, boolean>>({}) // 短答 / timed 已揭曉
  const [flags, setFlags] = useState<Record<string, boolean>>({})
  const [points, setPoints] = useState<Record<string, number>>({})
  const [remaining, setRemaining] = useState<number>(settings.timeLimit)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [showNav, setShowNav] = useState(false)

  const total = quizItems.length

  // 防呆：快照後一條都唔合資格
  if (total === 0) {
    return (
      <Card className="space-y-4 p-8 text-center">
        <BookMarked size={32} strokeWidth={1.75} className="mx-auto text-slate-300 dark:text-slate-600" />
        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
          呢批題目已經唔喺題庫，無法做題。
        </p>
        <Button onClick={onAbort}>返回設定</Button>
      </Card>
    )
  }

  const current = quizItems[currentIdx]
  const selected = answers[current.questionId]
  const shortVal = shortInputs[current.questionId] ?? ''
  const isMc = current.kind === 'mc'
  const isAnswered = isMc
    ? selected !== undefined && selected !== null
    : !!revealed[current.questionId]
  const graded = isInstant && isAnswered
  const isLast = currentIdx === total - 1
  const answeredCount = useMemo(
    () =>
      quizItems.filter((q) =>
        q.kind === 'mc'
          ? answers[q.questionId] !== undefined && answers[q.questionId] !== null
          : revealed[q.questionId],
      ).length,
    [quizItems, answers, revealed],
  )
  const earned = useMemo(
    () => Object.values(points).reduce((s, v) => s + v, 0),
    [points],
  )

  // timed 超時：當未答（MC null / short 空），鎖定並揭曉（已答嘅就唔郁，保住分數）
  const timeUp = () => {
    const q = quizItems[currentIdx]
    if (q.kind === 'mc') {
      setAnswers((a) =>
        a[q.questionId] !== undefined ? a : { ...a, [q.questionId]: null },
      )
    } else {
      setRevealed((r) => (r[q.questionId] ? r : { ...r, [q.questionId]: true }))
    }
    setPoints((p) => (q.questionId in p ? p : { ...p, [q.questionId]: 0 }))
  }

  // ── 計時器（timed 模式，逐題倒數；答咗即停，唔會覆寫分數）──
  useEffect(() => {
    if (!isTimed || isAnswered) return
    setRemaining(settings.timeLimit)
    const startedTick = Date.now()
    const tid = window.setInterval(() => {
      const left = settings.timeLimit - (Date.now() - startedTick) / 1000
      if (left <= 0) {
        window.clearInterval(tid)
        setRemaining(0)
        timeUp()
      } else {
        setRemaining(left)
      }
    }, 250)
    return () => window.clearInterval(tid)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIdx, isTimed, isAnswered])

  // ── 選 MC ──
  const choose = (optIdx: number) => {
    if (isInstant && isAnswered) return
    setAnswers((a) => ({ ...a, [current.questionId]: optIdx }))
    if (isTimed) {
      const correct = optIdx === current.answerIndex
      const ratio = settings.timeLimit > 0 ? remaining / settings.timeLimit : 0
      setPoints((p) => ({
        ...p,
        [current.questionId]: correct ? Math.round(BASE_POINTS + ratio * SPEED_BONUS) : 0,
      }))
    }
  }

  // ── 短答提交 ──
  const submitShort = () => {
    if (isAnswered) return
    setRevealed((r) => ({ ...r, [current.questionId]: true }))
    if (isTimed) {
      const correct = shortMatches(shortVal, current.explanation)
      const ratio = settings.timeLimit > 0 ? remaining / settings.timeLimit : 0
      setPoints((p) => ({
        ...p,
        [current.questionId]: correct ? Math.round(BASE_POINTS + ratio * SPEED_BONUS) : 0,
      }))
    }
  }

  const skip = () => {
    if (current.kind === 'mc') {
      setAnswers((a) => ({ ...a, [current.questionId]: null }))
    } else {
      setRevealed((r) => ({ ...r, [current.questionId]: true }))
    }
    if (!isLast) setCurrentIdx((i) => i + 1)
  }

  const goPrev = () => setCurrentIdx((i) => Math.max(0, i - 1))
  const goNext = () => setCurrentIdx((i) => Math.min(total - 1, i + 1))
  const toggleFlag = () =>
    setFlags((f) => ({ ...f, [current.questionId]: !f[current.questionId] }))

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
    const unanswered = quizItems.filter((q) =>
      q.kind === 'mc'
        ? answers[q.questionId] === undefined || answers[q.questionId] === null
        : !revealed[q.questionId],
    ).length
    if (unanswered > 0 && !isTimed) {
      const ok = await confirm({
        title: '提早交卷？',
        message: `仲有 ${unanswered} 題未答，當錯計，確定交卷？`,
        confirmText: '交卷',
      })
      if (!ok) return
    }

    const items: QuizAttemptItem[] = quizItems.map((q) =>
      itemFromFrozen(
        q,
        q.kind === 'mc' ? (answers[q.questionId] ?? null) : null,
        q.kind === 'mc' ? undefined : (shortInputs[q.questionId] ?? ''),
      ),
    )
    const correctCount = items.filter((i) => i.correct).length
    const durationSec = Math.round((Date.now() - startedAt.current) / 1000)
    const scopeLabel = settings.topicId ? topicName(settings.topicId) : '全部課題'
    const modeTag = isTimed ? '搶分' : settings.mode === 'practice' ? '練習' : '測驗'
    const title = `${scopeLabel} · ${DIFF_FILTER_LABEL[settings.difficulty]} · ${total} 題 · ${modeTag}`

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
    // 更新跨次錯題本
    syncMistakesFromAttempt(created)
    toast.success(`完成！${correctCount}/${total} 答啱`)
    onFinish(created.id)
  }

  // ── 鍵盤導航（Quizlet / Kahoot 風）──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      const typingShort = current.kind === 'short' && (tag === 'INPUT' || tag === 'TEXTAREA')
      // 短答輸入中：只攔 Enter（提交）
      if (typingShort) {
        if (e.key === 'Enter' && !isAnswered) {
          e.preventDefault()
          submitShort()
        }
        return
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        goPrev()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        goNext()
      } else if (e.key.toLowerCase() === 'f') {
        e.preventDefault()
        toggleFlag()
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (isLast) void submit()
        else if (!isInstant || isAnswered) goNext()
      } else if (isMc && !graded) {
        // A-D / 1-9 揀選項
        const up = e.key.toUpperCase()
        let idx = -1
        if (up >= 'A' && up <= 'Z') idx = up.charCodeAt(0) - 65
        else if (e.key >= '1' && e.key <= '9') idx = Number(e.key) - 1
        if (idx >= 0 && idx < current.options.length) {
          e.preventDefault()
          choose(idx)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIdx, isAnswered, graded, isMc, shortVal, remaining])

  const shortCorrect = current.kind === 'short' && shortMatches(shortVal, current.explanation)

  return (
    <div className="animate-fade-in space-y-4">
      {/* 頂部列 */}
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={abort}>
          結束
        </Button>
        <div className="flex items-center gap-2">
          {isTimed && (
            <Badge tone="accent" icon={Trophy} className="tabular-nums">
              {earned} 分
            </Badge>
          )}
          <span className="text-xs font-medium tabular-nums text-slate-500 dark:text-slate-400">
            {currentIdx + 1} / {total}
          </span>
          <Button
            variant="ghost"
            size="sm"
            icon={LayoutGrid}
            onClick={() => setShowNav((v) => !v)}
            className={cx(showNav && 'bg-slate-100 dark:bg-slate-800')}
          >
            導航
          </Button>
        </div>
      </div>

      <ProgressBar value={(answeredCount / total) * 100} />

      {/* 題目導航格（Kahoot / 試卷風） */}
      {showNav && (
        <Card className="animate-scale-in p-3">
          <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-10">
            {quizItems.map((q, i) => {
              const done = q.kind === 'mc'
                ? answers[q.questionId] !== undefined && answers[q.questionId] !== null
                : revealed[q.questionId]
              const flagged = flags[q.questionId]
              return (
                <button
                  key={q.questionId}
                  onClick={() => {
                    setCurrentIdx(i)
                    setShowNav(false)
                  }}
                  className={cx(
                    'relative flex h-9 items-center justify-center rounded-lg text-xs font-semibold tabular-nums transition',
                    i === currentIdx
                      ? 'bg-accent text-white ring-2 ring-accent/40'
                      : done
                        ? 'bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700',
                  )}
                >
                  {i + 1}
                  {flagged && (
                    <Flag size={9} className="absolute -right-0.5 -top-0.5 fill-amber-400 text-amber-500" />
                  )}
                </button>
              )
            })}
          </div>
        </Card>
      )}

      {/* 題目卡 */}
      <Card key={current.questionId} className="animate-fade-in space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone="accent">{topicName(current.topicId)}</Badge>
          <Badge tone={DIFF_TONE[current.difficulty]}>{DIFF_LABEL[current.difficulty]}</Badge>
          <Badge tone={current.kind === 'mc' ? 'blue' : 'slate'}>
            {current.kind === 'mc' ? '選擇題' : '短答題'}
          </Badge>
          <div className="ml-auto flex items-center gap-1.5">
            {isTimed && !isAnswered && (
              <CountdownRing remaining={remaining} total={settings.timeLimit} />
            )}
            <button
              type="button"
              onClick={toggleFlag}
              className={cx(
                'rounded-lg p-1.5 transition',
                flags[current.questionId]
                  ? 'bg-amber-50 text-amber-500 dark:bg-amber-500/10'
                  : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700',
              )}
              aria-label="標記呢題"
              title="標記（F）"
            >
              <Flag size={16} className={cx(flags[current.questionId] && 'fill-current')} />
            </button>
          </div>
        </div>

        <p className="text-base font-medium leading-relaxed text-slate-800 dark:text-slate-100">
          {current.stem}
        </p>

        {/* MC：選項 */}
        {current.kind === 'mc' ? (
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
        ) : (
          /* 短答：文字輸入 + 自評 */
          <div className="space-y-3">
            <Input
              autoFocus={!isAnswered}
              value={shortVal}
              disabled={isAnswered}
              placeholder="輸入你嘅答案，按 Enter 提交…"
              onChange={(e) =>
                setShortInputs((s) => ({ ...s, [current.questionId]: e.target.value }))
              }
            />
            {!isAnswered && (
              <Button size="sm" iconRight={CornerDownLeft} onClick={submitShort} disabled={!shortVal.trim()}>
                提交答案
              </Button>
            )}
            {graded && (
              <div
                className={cx(
                  'rounded-xl border p-3 text-sm',
                  shortCorrect
                    ? 'border-emerald-400 bg-emerald-50 text-emerald-700 dark:border-emerald-500/50 dark:bg-emerald-500/15 dark:text-emerald-300'
                    : 'border-rose-400 bg-rose-50 text-rose-700 dark:border-rose-500/50 dark:bg-rose-500/15 dark:text-rose-300',
                )}
              >
                <p className="flex items-center gap-1.5 font-semibold">
                  {shortCorrect ? <Check size={15} /> : null}
                  {shortCorrect ? '答啱（自動比對）' : '參考答案'}
                </p>
                <p className="mt-1 text-slate-700 dark:text-slate-200">{current.explanation}</p>
                {!shortCorrect && (
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    你答：{shortVal.trim() || '（空白）'}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* instant：批改後解釋（MC，如有） */}
        {graded && isMc && current.explanation && (
          <div className="border-t border-slate-100 pt-3 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
            <span className="font-semibold text-slate-700 dark:text-slate-200">解釋：</span>
            {current.explanation}
          </div>
        )}

        {/* timed：呢題得分回饋 */}
        {isTimed && isAnswered && (
          <div className="flex items-center gap-1.5 border-t border-slate-100 pt-3 text-sm dark:border-slate-700">
            <Zap size={15} className="text-accent" />
            <span className="text-slate-600 dark:text-slate-300">本題得分</span>
            <span className="ml-auto text-lg font-bold tabular-nums text-accent-strong dark:text-accent">
              +{points[current.questionId] ?? 0}
            </span>
          </div>
        )}
      </Card>

      {/* 底部導航 */}
      {isInstant ? (
        <div className="grid grid-cols-2 gap-2">
          {!isAnswered ? (
            <Button variant="ghost" icon={SkipForward} onClick={skip}>
              跳過
            </Button>
          ) : (
            <div />
          )}
          {isLast ? (
            <Button iconRight={Check} onClick={submit} disabled={!isAnswered && !isTimed}>
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
          <Button variant="secondary" icon={ArrowLeft} onClick={goPrev} disabled={currentIdx === 0} className="flex-1">
            上一題
          </Button>
          <Button variant="secondary" iconRight={ArrowRight} onClick={goNext} disabled={isLast} className="flex-1">
            下一題
          </Button>
          <Button onClick={submit} className="w-full sm:w-auto">
            交卷
          </Button>
        </div>
      )}

      {/* 鍵盤提示 */}
      <p className="hidden text-center text-[11px] text-slate-400 dark:text-slate-500 sm:block">
        鍵盤：{isMc ? 'A–D / 1–9 揀答案 · ' : ''}← → 切題 · F 標記 · Enter {isLast ? '交卷' : '下一題'}
      </p>
    </div>
  )
}
