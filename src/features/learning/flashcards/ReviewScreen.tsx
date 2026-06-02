import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useCollection } from '../../../lib/store'
import { cardsCol } from '../../../data/collections'
import { useToast } from '../../../context/ToastContext'
import { schedule, type Rating } from '../../../lib/srs'
import type { Card } from '../../../data/types'
import {
  Badge,
  Button,
  IconButton,
  Input,
  Kbd,
  cx,
} from '../../../ui'
import {
  ArrowLeft,
  Ban,
  Check,
  Flag,
  PartyPopper,
  RotateCcw,
  Sparkles,
  Undo2,
  X,
} from 'lucide-react'
import { cardMetaCol, reviewLogCol, upsertMeta } from './store'
import {
  buildQueue,
  metaOf,
  previewIntervals,
  prefOf,
} from './srs'
import { AnswerBars } from './charts'
import { deckPrefCol } from './store'
import type { StudyMode } from './types'

// ============================================================
//  複習螢幕（Anki Reviewer 級）
//  - 多模式（srs / cram / typed / starred）
//  - 鍵盤捷徑（Space 翻面、1-4 評分、F 標記、S 暫停、Z 撤銷）
//  - 撤銷上一答（還原排程 + 刪 log）
//  - 答題即時寫 ReviewLog（heatmap / 留存率靠佢）
//  - typed 模式自動對比答案
//  - session 完結統計（答對率 + 答題分布）
// ============================================================

const RATING_KEY: Record<string, Rating> = {
  '1': 'again',
  '2': 'hard',
  '3': 'good',
  '4': 'easy',
}
const RATING_ORDER: Rating[] = ['again', 'hard', 'good', 'easy']
const RATING_UI: Record<
  Rating,
  { label: string; cls: string; dot: string; key: string }
> = {
  again: {
    label: '唔記得',
    key: '1',
    dot: 'bg-rose-500',
    cls: 'border-rose-200 bg-rose-50/40 text-rose-600 hover:border-rose-300 hover:bg-rose-50 dark:border-rose-500/30 dark:bg-rose-500/5 dark:text-rose-400 dark:hover:bg-rose-500/10',
  },
  hard: {
    label: '有啲難',
    key: '2',
    dot: 'bg-amber-500',
    cls: 'border-amber-200 bg-amber-50/40 text-amber-600 hover:border-amber-300 hover:bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/5 dark:text-amber-400 dark:hover:bg-amber-500/10',
  },
  good: {
    label: '記得',
    key: '3',
    dot: 'bg-accent',
    cls: 'border-accent/40 bg-accent-soft/50 text-accent-strong hover:border-accent/60 hover:bg-accent-soft dark:text-accent dark:bg-accent/5 dark:hover:bg-accent/10',
  },
  easy: {
    label: '好易',
    key: '4',
    dot: 'bg-emerald-500',
    cls: 'border-emerald-200 bg-emerald-50/40 text-emerald-600 hover:border-emerald-300 hover:bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/5 dark:text-emerald-400 dark:hover:bg-emerald-500/10',
  },
}

interface UndoSnapshot {
  cardId: string
  prev: Partial<Card>
  prevLapses: number
  logId: string
}

export default function ReviewScreen({
  deckId,
  mode,
  onDone,
}: {
  deckId: string
  mode: StudyMode
  onDone: () => void
}) {
  const allCards = useCollection(cardsCol)
  const metas = useCollection(cardMetaCol)
  const toast = useToast()

  // 開場一次性鎖定隊列（避免答完即時消失打亂順序）
  const [queue, setQueue] = useState<string[]>(() =>
    buildQueue({
      deckId,
      cards: cardsCol.get(),
      metas: cardMetaCol.get(),
      pref: prefOf(deckPrefCol.get(), deckId),
      mode,
    }),
  )
  const totalRef = useRef(queue.length)
  const [flipped, setFlipped] = useState(false)
  const [done, setDone] = useState(0)
  const [sessionRatings, setSessionRatings] = useState<Rating[]>([])
  const [undoStack, setUndoStack] = useState<UndoSnapshot[]>([])
  const [typed, setTyped] = useState('')
  const flipTime = useRef<number>(Date.now())

  const currentId = queue[0]
  const card = useMemo(
    () => allCards.find((c) => c.id === currentId),
    [allCards, currentId],
  )
  const meta = currentId ? metaOf(metas, currentId) : undefined

  // 進入新卡時重設計時 / 翻面 / 打字
  useEffect(() => {
    setFlipped(false)
    setTyped('')
    flipTime.current = Date.now()
  }, [currentId])

  const intervals = useMemo(
    () => (card ? previewIntervals(card) : null),
    [card],
  )

  const isCram = mode === 'cram'

  // ── 評分 ──────────────────────────────────────
  const rate = useCallback(
    (rating: Rating) => {
      if (!card) return
      const elapsedMs = Date.now() - flipTime.current
      const prevSnapshot: Partial<Card> = {
        ease: card.ease,
        intervalDays: card.intervalDays,
        repetitions: card.repetitions,
        dueDate: card.dueDate,
        lastReviewed: card.lastReviewed,
      }
      const prevLapses = metaOf(cardMetaCol.get(), card.id).lapses

      let logId = ''
      if (!isCram) {
        // 標準：更新排程 + 寫 log + 累計 lapses
        const patch = schedule(card, rating)
        cardsCol.update(card.id, patch)
        if (rating === 'again') {
          upsertMeta(card.id, { lapses: prevLapses + 1 })
        }
        const log = reviewLogCol.add({
          cardId: card.id,
          deckId: card.deckId,
          ts: new Date().toISOString(),
          rating,
          prevInterval: card.intervalDays,
          newInterval: patch.intervalDays ?? 0,
          elapsedMs,
          mode,
        })
        logId = log.id
      }

      setDone((d) => d + 1)
      setSessionRatings((rs) => [...rs, rating])
      if (!isCram) {
        setUndoStack((st) => [
          ...st,
          { cardId: card.id, prev: prevSnapshot, prevLapses, logId },
        ])
      }

      setQueue((q) => {
        const [, ...rest] = q
        // again（或 cram）→ 排返隊尾今次再睇
        const next = rating === 'again' ? [...rest, card.id] : rest
        return next
      })
    },
    [card, isCram, mode],
  )

  // ── 撤銷 ──────────────────────────────────────
  const undo = useCallback(() => {
    const last = undoStack[undoStack.length - 1]
    if (!last) return
    cardsCol.update(last.cardId, last.prev)
    upsertMeta(last.cardId, { lapses: last.prevLapses })
    if (last.logId) reviewLogCol.remove(last.logId)
    setUndoStack((st) => st.slice(0, -1))
    setDone((d) => Math.max(0, d - 1))
    setSessionRatings((rs) => rs.slice(0, -1))
    // 將卡放返隊頭
    setQueue((q) => [last.cardId, ...q.filter((id) => id !== last.cardId)])
    toast.info('已撤銷上一答')
  }, [undoStack, toast])

  // ── 複習中暫停 / 標記 ─────────────────────────
  const suspendCurrent = useCallback(() => {
    if (!card) return
    upsertMeta(card.id, { suspended: true })
    toast.info('已暫停呢張，唔再出現')
    setQueue((q) => q.slice(1))
  }, [card, toast])

  const flagCurrent = useCallback(() => {
    if (!card) return
    const cur = metaOf(cardMetaCol.get(), card.id).flagged
    upsertMeta(card.id, { flagged: !cur })
    toast.info(cur ? '已取消標記' : '已標記')
  }, [card, toast])

  // ── 鍵盤捷徑 ──────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // typed 模式喺輸入框打字時，唔搶數字鍵
      const inInput =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      if (e.key === ' ' && !inInput) {
        e.preventDefault()
        if (!flipped) setFlipped(true)
        return
      }
      if (e.key === 'Enter' && mode === 'typed' && !flipped) {
        setFlipped(true)
        return
      }
      if (flipped && RATING_KEY[e.key]) {
        e.preventDefault()
        rate(RATING_KEY[e.key])
        return
      }
      if (inInput) return
      if (e.key === 'z' || e.key === 'Z') undo()
      if (e.key === 'f' || e.key === 'F') flagCurrent()
      if (e.key === 's' || e.key === 'S') suspendCurrent()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [flipped, rate, undo, flagCurrent, suspendCurrent, mode])

  // ── session 完結 ──────────────────────────────
  if (!card) {
    const breakdown = sessionRatings.reduce(
      (acc, r) => {
        acc[r] += 1
        return acc
      },
      { again: 0, hard: 0, good: 0, easy: 0 } as Record<Rating, number>,
    )
    const correct = sessionRatings.filter((r) => r !== 'again').length
    const acc =
      sessionRatings.length > 0
        ? Math.round((correct / sessionRatings.length) * 100)
        : 0
    const cheer =
      acc >= 90 ? '記得好穩，繼續保持 ✨' : acc >= 70 ? '進步緊，明天再溫鞏固記憶。' : '記憶要時間，慢慢嚟一定得。'
    return (
      <div className="mx-auto max-w-md animate-fade-in-up">
        <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-700/60 dark:bg-slate-800 dark:shadow-none">
          <div className="hero-gradient relative flex flex-col items-center gap-3 px-6 py-8 text-center text-white">
            <div className="pointer-events-none absolute -right-6 -top-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
            <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
              <PartyPopper size={28} strokeWidth={1.75} />
            </span>
            <div className="relative">
              <p className="text-xl font-bold tracking-tight">
                {isCram ? '衝刺完成！' : '複習完成！'}
              </p>
              <p className="mt-1 text-sm text-white/80">{cheer}</p>
            </div>
          </div>
          <div className="space-y-5 p-6">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-slate-50 p-4 text-center dark:bg-slate-800/60">
                <p className="text-3xl font-bold tabular-nums text-accent">{done}</p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">今次過卡</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 text-center dark:bg-slate-800/60">
                <p className="text-3xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {sessionRatings.length > 0 ? `${acc}%` : '—'}
                </p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">答對率</p>
              </div>
            </div>
            {sessionRatings.length > 0 && (
              <div className="text-left">
                <p className="mb-2 text-xs font-medium text-slate-400 dark:text-slate-500">
                  今次評分分布
                </p>
                <AnswerBars data={breakdown} />
              </div>
            )}
            <Button onClick={onDone} size="lg" fullWidth icon={ArrowLeft}>
              返回牌組
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const remaining = queue.length
  const total = totalRef.current
  const progress = total > 0 ? ((total - remaining) / total) * 100 : 0
  const typedCorrect =
    mode === 'typed' && flipped
      ? typed.trim().toLowerCase() === card.back.trim().toLowerCase()
      : null

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {/* 頂列 */}
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={onDone}>
          結束
        </Button>
        <div className="flex items-center gap-2">
          {isCram && <Badge tone="amber">衝刺模式</Badge>}
          {mode === 'typed' && <Badge tone="blue">打字作答</Badge>}
          {mode === 'starred' && <Badge tone="rose">已標記</Badge>}
          <span className="text-xs text-slate-500 dark:text-slate-400" aria-live="polite">
            剩 <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">{remaining}</span> 張
          </span>
        </div>
      </div>

      {/* 進度（柔和、accent） */}
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
        role="progressbar"
        aria-valuenow={Math.round(progress)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-accent transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* 卡片（centrepiece：實體索引卡 — 背後卡疊呈隊列深度、翻面有觸感） */}
      <div className="relative">
        {/* 背後卡疊：剩越多、疊越厚（最多 2 層），呈現「有序隊列」嘅實體感 */}
        {remaining > 2 && (
          <div
            aria-hidden="true"
            className="absolute inset-x-4 -bottom-2.5 top-2.5 rounded-3xl border border-slate-200/70 bg-white dark:border-slate-700/50 dark:bg-slate-800/80"
          />
        )}
        {remaining > 1 && (
          <div
            aria-hidden="true"
            className="absolute inset-x-2 -bottom-1.5 top-1.5 rounded-3xl border border-slate-200/80 bg-white dark:border-slate-700/60 dark:bg-slate-800/90"
          />
        )}

        {/* 角落：標記 / 暫停 / 撤銷 */}
        <div className="absolute right-2.5 top-2.5 z-10 flex gap-0.5">
          <IconButton
            label="撤銷上一答 (Z)"
            size="sm"
            onClick={undo}
            disabled={undoStack.length === 0}
          >
            <Undo2 size={15} />
          </IconButton>
          <IconButton
            label="標記 (F)"
            size="sm"
            active={meta?.flagged}
            onClick={flagCurrent}
          >
            <Flag size={15} className={meta?.flagged ? 'fill-current' : ''} />
          </IconButton>
          <IconButton label="暫停呢張 (S)" size="sm" onClick={suspendCurrent}>
            <Ban size={15} />
          </IconButton>
        </div>

        <button
          type="button"
          onClick={() => !flipped && setFlipped(true)}
          aria-label={flipped ? '已翻面' : '撳一下翻面睇答案'}
          className={cx(
            'group relative flex min-h-[300px] w-full flex-col items-center justify-center gap-4 overflow-hidden rounded-3xl border bg-white px-8 pb-12 pt-9 text-center transition duration-200 dark:bg-slate-800',
            flipped
              ? 'border-accent/30 shadow-lg shadow-accent/10 dark:border-accent/30'
              : 'cursor-pointer border-slate-200/80 shadow-sm hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md dark:border-slate-700/60 dark:shadow-none dark:hover:border-slate-600',
          )}
        >
          {/* 索引卡頂margin線 */}
          <span
            aria-hidden="true"
            className={cx(
              'absolute inset-x-0 top-0 h-1',
              flipped ? 'bg-accent' : 'bg-rose-200/70 dark:bg-rose-500/25',
            )}
          />
          {meta && meta.tags.length > 0 && (
            <div className="flex flex-wrap justify-center gap-1">
              {meta.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-700/70 dark:text-slate-300"
                >
                  #{t}
                </span>
              ))}
            </div>
          )}
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:bg-slate-700/60 dark:text-slate-400">
            問題
          </span>
          <p className="max-w-full break-words text-2xl font-semibold leading-snug text-slate-800 dark:text-slate-100">
            {card.front}
          </p>

          {flipped ? (
            <div className="flex w-full animate-fade-in-up flex-col items-center gap-3">
              <div className="my-1 h-px w-12 bg-slate-200 dark:bg-slate-700" />
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent-strong dark:bg-accent/15 dark:text-accent">
                <Sparkles size={11} /> 答案
              </span>
              <p className="max-w-full break-words text-lg leading-relaxed text-slate-700 dark:text-slate-200">
                {card.back}
              </p>
              {meta?.note && (
                <p className="mt-0.5 flex items-start gap-1.5 rounded-xl bg-amber-50/70 px-3 py-1.5 text-xs italic text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                  💡 {meta.note}
                </p>
              )}
            </div>
          ) : (
            // 翻面 affordance：貼底細提示，撳卡任何位都翻得
            <span className="pointer-events-none absolute inset-x-0 bottom-3.5 flex items-center justify-center gap-1.5 text-[11px] font-medium text-slate-400 transition group-hover:text-accent dark:text-slate-500">
              <RotateCcw size={12} />
              撳一下翻開背面
            </span>
          )}
        </button>
      </div>

      {/* typed 模式：作答框 */}
      {mode === 'typed' && !flipped && (
        <div className="flex gap-2">
          <Input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && setFlipped(true)}
            placeholder="打你嘅答案，Enter 對答案"
            autoFocus
            className="flex-1"
          />
          <Button onClick={() => setFlipped(true)}>對答案</Button>
        </div>
      )}

      {/* typed 結果 */}
      {typedCorrect !== null && (
        <div
          role="status"
          aria-live="polite"
          className={cx(
            'flex animate-fade-in items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium',
            typedCorrect
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
              : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300',
          )}
        >
          <span
            className={cx(
              'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white',
              typedCorrect ? 'bg-emerald-500' : 'bg-rose-500',
            )}
          >
            {typedCorrect ? <Check size={13} strokeWidth={3} /> : <X size={13} strokeWidth={3} />}
          </span>
          {typedCorrect ? '答啱！記憶穩固。' : `你答：${typed.trim() || '（空白）'}`}
        </div>
      )}

      {/* 操作區 */}
      {flipped ? (
        <div className="grid animate-fade-in grid-cols-2 gap-2 sm:grid-cols-4">
          {RATING_ORDER.map((r) => {
            const ui = RATING_UI[r]
            return (
              <button
                key={r}
                onClick={() => rate(r)}
                className={cx(
                  'group flex flex-col items-center gap-1.5 rounded-2xl border py-3 transition duration-150 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900',
                  ui.cls,
                )}
              >
                <span className="flex items-center gap-1.5 text-sm font-semibold">
                  <span className={cx('h-1.5 w-1.5 rounded-full', ui.dot)} />
                  {ui.label}
                </span>
                {!isCram && intervals ? (
                  <span className="text-[11px] font-medium tabular-nums opacity-70">
                    {intervals[r]}
                  </span>
                ) : (
                  <Kbd className="opacity-70">{ui.key}</Kbd>
                )}
              </button>
            )
          })}
        </div>
      ) : (
        mode !== 'typed' && (
          <Button onClick={() => setFlipped(true)} size="lg" fullWidth>
            <span className="flex items-center gap-2">
              顯示答案 <Kbd className="border-white/30 bg-white/10 text-white">Space</Kbd>
            </span>
          </Button>
        )
      )}

      {/* 捷徑提示 */}
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-[11px] text-slate-400 dark:text-slate-500">
        <span className="inline-flex items-center gap-1">
          <Kbd>Space</Kbd> 翻面
        </span>
        <span className="inline-flex items-center gap-1">
          <Kbd>1</Kbd>–<Kbd>4</Kbd> 評分
        </span>
        <span className="inline-flex items-center gap-1">
          <Kbd>Z</Kbd> 撤銷
        </span>
        <span className="inline-flex items-center gap-1">
          <Kbd>F</Kbd> 標記
        </span>
        <span className="inline-flex items-center gap-1">
          <Kbd>S</Kbd> 暫停
        </span>
        {undoStack.length > 0 && (
          <button onClick={undo} className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
            <RotateCcw size={11} /> 撤銷上一答
          </button>
        )}
      </div>
    </div>
  )
}
