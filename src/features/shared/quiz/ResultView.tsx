import { useMemo } from 'react'
import { useCollection } from '../../../lib/store'
import { quizAttemptsCol, topicsCol, questionsCol } from '../../../data/collections'
import {
  ArrowLeft,
  Clock3,
  Flag,
  Gauge,
  HelpCircle,
  ListChecks,
  PartyPopper,
  RefreshCw,
  RotateCcw,
  Sparkles,
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

  // 成績色調 → 揭曉卡光暈 / 章框（戲劇感，全部跟 scoreTone）
  const tone = scoreTone(p)
  const REVEAL: Record<typeof tone, { glow: string; medal: string; ring: string }> = {
    green: {
      glow: 'from-emerald-100/80 dark:from-emerald-500/15',
      medal:
        'border-emerald-300 bg-emerald-50 dark:border-emerald-400/50 dark:bg-emerald-500/15',
      ring: 'ring-emerald-200/70 dark:ring-emerald-500/25',
    },
    amber: {
      glow: 'from-amber-100/80 dark:from-amber-500/15',
      medal: 'border-amber-300 bg-amber-50 dark:border-amber-400/50 dark:bg-amber-500/15',
      ring: 'ring-amber-200/70 dark:ring-amber-500/25',
    },
    rose: {
      glow: 'from-rose-100/80 dark:from-rose-500/15',
      medal: 'border-rose-300 bg-rose-50 dark:border-rose-400/50 dark:bg-rose-500/15',
      ring: 'ring-rose-200/70 dark:ring-rose-500/25',
    },
  }
  const rv = REVEAL[tone]

  return (
    <div className="animate-fade-in space-y-5">
      <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={onBackToSetup}>
        返回
      </Button>

      {/* ── 成績揭曉（戲劇高潮：頂光暈 + serif 大字 + 等第章 + 逐段入場）── */}
      <Card className={cx('overflow-hidden ring-1', rv.ring)}>
        <div
          className={cx(
            'relative flex flex-col items-center gap-3 px-6 py-7 text-center',
            'bg-gradient-to-b to-transparent',
            rv.glow,
          )}
        >
          {/* 柔光斑（純裝飾） */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -top-12 left-1/2 h-32 w-44 -translate-x-1/2 rounded-full bg-white/50 blur-3xl dark:bg-white/5"
          />
          <p className="animate-fade-in-up text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
            成績揭曉
          </p>

          {/* 等第章（serif 大字，輕微脈動光環暗示「叮叮」） */}
          <div
            className="animate-scale-in relative grid place-items-center"
            style={{ animationDelay: '60ms' }}
          >
            <span
              aria-hidden="true"
              className={cx('absolute h-24 w-24 rounded-full ring-8', rv.ring)}
            />
            <span
              className={cx(
                'relative grid h-20 w-20 place-items-center rounded-full border-2 shadow-sm',
                rv.medal,
              )}
            >
              <span className={cx('font-serif text-4xl font-black tabular-nums leading-none', scoreColor(p))}>
                {grade(p)}
              </span>
            </span>
          </div>

          {/* 命中率（serif 巨字，全頁最大的數字） */}
          <p
            className="animate-fade-in-up mt-0.5 flex items-baseline justify-center gap-1"
            style={{ animationDelay: '140ms' }}
          >
            <span className={cx('font-serif text-6xl font-bold tabular-nums slashed-zero leading-none', scoreColor(p))}>
              {p}
            </span>
            <span className={cx('text-2xl font-semibold', scoreColor(p))}>%</span>
          </p>
          <p
            className="animate-fade-in-up text-sm text-slate-600 dark:text-slate-300"
            style={{ animationDelay: '180ms' }}
          >
            答啱 <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">{attempt.correctCount}</span> / {attempt.total} 題
          </p>

          {/* 評語橫幅 */}
          <p
            className="animate-fade-in-up inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3.5 py-1.5 text-sm font-medium text-slate-700 shadow-xs ring-1 ring-slate-900/5 dark:bg-slate-900/40 dark:text-slate-200 dark:ring-white/10"
            style={{ animationDelay: '240ms' }}
          >
            <Sparkles size={14} className="shrink-0 text-accent" />
            {verdict(p)}
          </p>

          <div className="animate-fade-in-up mt-1 w-full max-w-xs" style={{ animationDelay: '300ms' }}>
            <ProgressBar value={p} tone={tone} />
          </div>
          <p className="mt-0.5 max-w-md truncate text-[11px] text-slate-400 dark:text-slate-500">
            {attempt.title}
          </p>
        </div>

        {/* 小統計列（圖示帶領，三格節奏） */}
        <div className="grid grid-cols-3 divide-x divide-slate-100 border-t border-slate-100 dark:divide-slate-700/60 dark:border-slate-700/60">
          <RevealStat icon={Clock3} value={fmtDuration(attempt.durationSec)} label="總用時" />
          <RevealStat icon={Gauge} value={`${avgSec.toFixed(1)}s`} label="每題平均" />
          <RevealStat
            icon={Flag}
            value={wrongIds.length}
            label="入錯題本"
            tone={wrongIds.length > 0 ? 'rose' : undefined}
          />
        </div>
      </Card>

      {/* 弱項分析 */}
      <section>
        <SectionTitle icon={Gauge}>弱項分析</SectionTitle>
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
        <SectionTitle
          icon={ListChecks}
          right={<span className="text-xs normal-case text-slate-400">共 {attempt.items.length} 題</span>}
        >
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
                  {short ? (
                    // 短答：itemFromFrozen 對唔啱（無論有冇輸入）一律 selectedIndex=null，
                    // 故唔可靠 selectedIndex 判「未作答」，直接以 correct 區分答啱／答錯。
                    it.correct ? (
                      <Badge tone="green">答啱</Badge>
                    ) : (
                      <Badge tone="rose">答錯</Badge>
                    )
                  ) : it.selectedIndex === null && !it.correct ? (
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
      {allCorrect ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-center dark:border-emerald-500/30 dark:bg-emerald-500/10 sm:flex-row sm:items-center sm:text-left">
          <span className="mx-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-sm sm:mx-0">
            <PartyPopper size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">全部答啱，零失誤！</p>
            <p className="mt-0.5 text-xs text-emerald-600/80 dark:text-emerald-300/70">呢份冇錯題，換個範圍再挑戰下？</p>
          </div>
          <Button
            variant="secondary"
            icon={RefreshCw}
            disabled={sameIds.length === 0}
            onClick={() => onRetrySame(sameIds)}
            className="shrink-0"
          >
            重做呢份
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            className="flex-1"
            icon={RotateCcw}
            disabled={wrongIds.length === 0}
            onClick={() => onRetryWrong(wrongIds)}
          >
            <span className="tabular-nums">重做錯題（{wrongIds.length}）</span>
          </Button>
          <Button variant="secondary" icon={RefreshCw} disabled={sameIds.length === 0} onClick={() => onRetrySame(sameIds)}>
            重做呢份
          </Button>
          <Button variant="ghost" onClick={onBackToSetup}>
            返回
          </Button>
        </div>
      )}
    </div>
  )
}

// ── 揭曉卡底部統計格（圖示帶領） ──
function RevealStat({
  icon: Icon,
  value,
  label,
  tone,
}: {
  icon: typeof Clock3
  value: React.ReactNode
  label: string
  tone?: 'rose'
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-2 py-3.5">
      <Icon size={15} className={tone === 'rose' ? 'text-rose-400' : 'text-slate-400'} />
      <p
        className={cx(
          'text-lg font-bold tabular-nums',
          tone === 'rose' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-slate-100',
        )}
      >
        {value}
      </p>
      <p className="text-[11px] text-slate-400 dark:text-slate-500">{label}</p>
    </div>
  )
}
