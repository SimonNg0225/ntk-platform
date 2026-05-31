import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useCollection } from '../../../lib/store'
import { cardsCol } from '../../../data/collections'
import { useToast } from '../../../context/ToastContext'
import { schedule, type Rating } from '../../../lib/srs'
import type { Card } from '../../../data/types'
import {
  Badge,
  Button,
  Card as UICard,
  IconButton,
  Input,
  Kbd,
  ProgressBar,
  cx,
} from '../../../ui'
import {
  ArrowLeft,
  Ban,
  Check,
  Flag,
  PartyPopper,
  RotateCcw,
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
  { label: string; cls: string; key: string }
> = {
  again: {
    label: '唔記得',
    key: '1',
    cls: 'border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-400 dark:hover:bg-rose-500/10',
  },
  hard: {
    label: '有啲難',
    key: '2',
    cls: 'border-amber-200 text-amber-600 hover:bg-amber-50 dark:border-amber-500/30 dark:text-amber-400 dark:hover:bg-amber-500/10',
  },
  good: {
    label: '記得',
    key: '3',
    cls: 'border-accent/40 text-accent-strong hover:bg-accent-soft dark:text-accent dark:hover:bg-accent/10',
  },
  easy: {
    label: '好易',
    key: '4',
    cls: 'border-emerald-200 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-500/30 dark:text-emerald-400 dark:hover:bg-emerald-500/10',
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
    return (
      <UICard className="space-y-5 p-8 text-center">
        <PartyPopper size={40} strokeWidth={1.5} className="mx-auto text-accent" />
        <div>
          <p className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            {isCram ? '衝刺完成！' : '複習完成！'}
          </p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            今次過咗 <span className="font-semibold tabular-nums text-accent">{done}</span> 張
            {sessionRatings.length > 0 && (
              <>
                {' '}· 答對率{' '}
                <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {acc}%
                </span>
              </>
            )}
          </p>
        </div>
        {sessionRatings.length > 0 && (
          <div className="mx-auto max-w-xs text-left">
            <AnswerBars data={breakdown} />
          </div>
        )}
        <Button onClick={onDone} size="lg">
          返回
        </Button>
      </UICard>
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
    <div className="space-y-4">
      {/* 頂列 */}
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={onDone}>
          結束
        </Button>
        <div className="flex items-center gap-2">
          {isCram && <Badge tone="amber">衝刺模式</Badge>}
          {mode === 'typed' && <Badge tone="blue">打字作答</Badge>}
          {mode === 'starred' && <Badge tone="rose">已標記</Badge>}
          <span className="text-xs text-slate-400 dark:text-slate-500">
            剩 <span className="font-semibold tabular-nums">{remaining}</span> 張
          </span>
        </div>
      </div>

      <ProgressBar value={progress} />

      {/* 卡片 */}
      <UICard className="relative min-h-[240px] overflow-hidden">
        {/* 角落：標記 / 暫停 / 撤銷 */}
        <div className="absolute right-2 top-2 z-10 flex gap-0.5">
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
          className={cx(
            'flex min-h-[240px] w-full flex-col items-center justify-center gap-3 p-6 text-center',
            !flipped && 'cursor-pointer',
          )}
        >
          {meta && meta.tags.length > 0 && (
            <div className="flex flex-wrap justify-center gap-1">
              {meta.tags.map((t) => (
                <span
                  key={t}
                  className="rounded bg-slate-100 px-1.5 py-px text-[10px] text-slate-400 dark:bg-slate-700 dark:text-slate-400"
                >
                  #{t}
                </span>
              ))}
            </div>
          )}
          <p className="text-[11px] uppercase tracking-wider text-slate-300 dark:text-slate-500">
            問題
          </p>
          <p className="text-xl font-medium text-slate-800 dark:text-slate-100">
            {card.front}
          </p>

          {flipped && (
            <>
              <div className="my-1 h-px w-16 bg-slate-200 dark:bg-slate-700" />
              <p className="text-[11px] uppercase tracking-wider text-slate-300 dark:text-slate-500">
                答案
              </p>
              <p className="text-lg text-slate-700 dark:text-slate-200">{card.back}</p>
              {meta?.note && (
                <p className="mt-1 text-xs italic text-slate-400 dark:text-slate-500">
                  💡 {meta.note}
                </p>
              )}
            </>
          )}
        </button>
      </UICard>

      {/* typed 模式：作答框 */}
      {mode === 'typed' && !flipped && (
        <div className="flex gap-2">
          <Input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && setFlipped(true)}
            placeholder="打你嘅答案，Enter 對答案"
            autoFocus
          />
          <Button onClick={() => setFlipped(true)}>對答案</Button>
        </div>
      )}

      {/* typed 結果 */}
      {typedCorrect !== null && (
        <div
          className={cx(
            'flex items-center gap-2 rounded-lg px-3 py-2 text-sm',
            typedCorrect
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
              : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300',
          )}
        >
          {typedCorrect ? <Check size={16} /> : <X size={16} />}
          {typedCorrect ? '答啱！' : `你答：${typed.trim() || '（空白）'}`}
        </div>
      )}

      {/* 操作區 */}
      {flipped ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {RATING_ORDER.map((r) => {
            const ui = RATING_UI[r]
            return (
              <button
                key={r}
                onClick={() => rate(r)}
                className={cx(
                  'flex flex-col items-center gap-1 rounded-xl border bg-white py-2.5 transition active:scale-[0.98] dark:bg-slate-800',
                  ui.cls,
                )}
              >
                <span className="flex items-center gap-1.5 text-sm font-semibold">
                  <Kbd>{ui.key}</Kbd>
                  {ui.label}
                </span>
                {!isCram && intervals && (
                  <span className="text-[10px] tabular-nums opacity-70">
                    {intervals[r]}
                  </span>
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
      <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-slate-400 dark:text-slate-500">
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
          <button onClick={undo} className="inline-flex items-center gap-1 text-accent hover:underline">
            <RotateCcw size={11} /> 撤銷
          </button>
        )}
      </p>
    </div>
  )
}
