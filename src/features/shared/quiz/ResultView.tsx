import { useMemo } from 'react'
import { useCollection } from '../../../lib/store'
import { quizAttemptsCol, topicsCol, questionsCol } from '../../../data/collections'
import {
  ArrowLeft,
  Flag,
  HelpCircle,
  PartyPopper,
  RefreshCw,
  RotateCcw,
} from 'lucide-react'
import { Badge, Button, Card, ProgressBar, SectionTitle, cx } from '../../../ui'
import {
  DIFF_LABEL,
  DIFF_ORDER,
  DIFF_TONE,
  fmtDuration,
  grade,
  pct,
  scoreColor,
  scoreTone,
  verdict,
} from './util'
import { OptionRow } from './parts'

// ============================================================
//  ResultView — 成績 + 等第 + 弱項分析 + 逐題對答案（含短答）
// ============================================================

export function ResultView({
  attemptId,
  onBackToSetup,
  onRetryWrong,
  onRetrySame,
}: {
  attemptId: string
  onBackToSetup: () => void
  onRetryWrong: (questionIds: string[]) => void
  onRetrySame: (questionIds: string[]) => void
}) {
  const attempts = useCollection(quizAttemptsCol)
  const topics = useCollection(topicsCol)
  const questions = useCollection(questionsCol)

  const attempt = attempts.find((a) => a.id === attemptId)
  const topicName = (id: string) => topics.find((t) => t.id === id)?.topic ?? '未分類'

  const byTopic = useMemo(() => {
    const map = new Map<string, { correct: number; total: number }>()
    for (const it of attempt?.items ?? []) {
      const g = map.get(it.topicId) ?? { correct: 0, total: 0 }
      g.total++
      if (it.correct) g.correct++
      map.set(it.topicId, g)
    }
    return [...map.entries()].sort((a, b) => pct(a[1].correct, a[1].total) - pct(b[1].correct, b[1].total))
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
        <HelpCircle size={32} strokeWidth={1.75} className="mx-auto text-slate-300 dark:text-slate-600" />
        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">搵唔到呢份成績紀錄。</p>
        <Button onClick={onBackToSetup}>返回</Button>
      </Card>
    )
  }

  const p = pct(attempt.correctCount, attempt.total)
  const existingIds = new Set(questions.map((q) => q.id))
  const wrongIds = attempt.items
    .filter((i) => !i.correct)
    .map((i) => i.questionId)
    .filter((id) => existingIds.has(id))
  const sameIds = attempt.items.map((i) => i.questionId).filter((id) => existingIds.has(id))
  const allCorrect = attempt.items.every((i) => i.correct)
  const avgSec = attempt.total > 0 ? attempt.durationSec / attempt.total : 0

  // 短答題：display helper（options 為空陣列）
  const isShort = (it: { options: string[] }) => it.options.length === 0

  return (
    <div className="animate-fade-in space-y-5">
      <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={onBackToSetup}>
        返回
      </Button>

      {/* 大字成績卡 + 等第章 */}
      <Card className="overflow-hidden">
        <div className="flex flex-col items-center gap-3 p-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            {attempt.title}
          </p>
          <div className="flex items-center gap-4">
            <div
              className={cx(
                'flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-2xl border-2',
                scoreTone(p) === 'green'
                  ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-500/40 dark:bg-emerald-500/10'
                  : scoreTone(p) === 'amber'
                    ? 'border-amber-300 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-500/10'
                    : 'border-rose-300 bg-rose-50 dark:border-rose-500/40 dark:bg-rose-500/10',
              )}
            >
              <span className={cx('text-3xl font-black tabular-nums', scoreColor(p))}>{grade(p)}</span>
            </div>
            <div className="text-left">
              <p className={cx('text-4xl font-bold tabular-nums', scoreColor(p))}>{p}%</p>
              <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
                <span className="tabular-nums">
                  {attempt.correctCount} / {attempt.total}
                </span>{' '}
                答啱
              </p>
            </div>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">{verdict(p)}</p>
          <ProgressBar value={p} tone={scoreTone(p)} />
        </div>
        {/* 小統計列 */}
        <div className="grid grid-cols-3 divide-x divide-slate-100 border-t border-slate-100 dark:divide-slate-700 dark:border-slate-700">
          <div className="p-3 text-center">
            <p className="text-lg font-bold tabular-nums text-slate-800 dark:text-slate-100">
              {fmtDuration(attempt.durationSec)}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500">總用時</p>
          </div>
          <div className="p-3 text-center">
            <p className="text-lg font-bold tabular-nums text-slate-800 dark:text-slate-100">
              {avgSec.toFixed(1)}s
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500">每題平均</p>
          </div>
          <div className="p-3 text-center">
            <p className="text-lg font-bold tabular-nums text-rose-600 dark:text-rose-400">
              {wrongIds.length}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500">入錯題本</p>
          </div>
        </div>
      </Card>

      {/* 弱項分析 */}
      <section>
        <SectionTitle>弱項分析</SectionTitle>
        <Card className="space-y-4 p-4">
          <div className="space-y-3">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">按課題</p>
            {byTopic.map(([topicId, g]) => {
              const gp = pct(g.correct, g.total)
              return (
                <div key={topicId} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex min-w-0 items-center gap-1.5 text-slate-700 dark:text-slate-200">
                      <span className="truncate">{topicName(topicId)}</span>
                      {gp < 60 && <Badge tone="rose">待加強</Badge>}
                    </span>
                    <span className={cx('shrink-0 font-medium tabular-nums', scoreColor(gp))}>
                      {g.correct}/{g.total} · {gp}%
                    </span>
                  </div>
                  <ProgressBar value={gp} tone={scoreTone(gp)} />
                </div>
              )
            })}
          </div>

          <div className="space-y-3 border-t border-slate-100 pt-4 dark:border-slate-700">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">按難度</p>
            {byDiff.map((r) => {
              const gp = pct(r.correct, r.total)
              return (
                <div key={r.diff} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
                      <Badge tone={DIFF_TONE[r.diff]}>{DIFF_LABEL[r.diff]}</Badge>
                      {gp < 60 && <Badge tone="amber">待加強</Badge>}
                    </span>
                    <span className={cx('shrink-0 font-medium tabular-nums', scoreColor(gp))}>
                      {r.correct}/{r.total} · {gp}%
                    </span>
                  </div>
                  <ProgressBar value={gp} tone={scoreTone(gp)} />
                </div>
              )
            })}
          </div>
        </Card>
      </section>

      {/* 逐題檢視 */}
      <section>
        <SectionTitle right={<span className="text-xs normal-case text-slate-400">共 {attempt.items.length} 題</span>}>
          逐題檢視
        </SectionTitle>
        <ul className="space-y-3">
          {attempt.items.map((it, idx) => {
            const short = isShort(it)
            return (
              <Card key={idx} className="space-y-3 p-4">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-semibold tabular-nums text-slate-500 dark:text-slate-400">
                    第 {idx + 1} 題
                  </span>
                  <Badge tone="accent">{topicName(it.topicId)}</Badge>
                  <Badge tone={DIFF_TONE[it.difficulty]}>{DIFF_LABEL[it.difficulty]}</Badge>
                  {short && <Badge tone="slate">短答</Badge>}
                  {it.selectedIndex === null && !it.correct ? (
                    <Badge tone="slate">未作答</Badge>
                  ) : it.correct ? (
                    <Badge tone="green">答啱</Badge>
                  ) : (
                    <Badge tone="rose">答錯</Badge>
                  )}
                  {!existingIds.has(it.questionId) && (
                    <Badge tone="slate" icon={Flag}>已從題庫移除</Badge>
                  )}
                </div>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100 break-words [overflow-wrap:anywhere]">{it.stem}</p>
                {short ? (
                  <div
                    className={cx(
                      'rounded-xl border p-3 text-sm',
                      it.correct
                        ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-500/30 dark:bg-emerald-500/10'
                        : 'border-rose-200 bg-rose-50/60 dark:border-rose-500/30 dark:bg-rose-500/10',
                    )}
                  >
                    <span className="font-semibold text-slate-600 dark:text-slate-300">參考答案：</span>
                    <span className="text-slate-700 dark:text-slate-200 break-words [overflow-wrap:anywhere]">
                      {it.options[0] ?? '（無）'}
                    </span>
                  </div>
                ) : (
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
                )}
              </Card>
            )
          })}
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
            icon={RotateCcw}
            disabled={wrongIds.length === 0}
            onClick={() => onRetryWrong(wrongIds)}
          >
            <span className="tabular-nums">重做錯題（{wrongIds.length}）</span>
          </Button>
        )}
        <Button variant="secondary" icon={RefreshCw} disabled={sameIds.length === 0} onClick={() => onRetrySame(sameIds)}>
          重做呢份
        </Button>
        <Button variant="ghost" onClick={onBackToSetup}>
          返回
        </Button>
      </div>
    </div>
  )
}
