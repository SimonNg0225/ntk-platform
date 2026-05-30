import { useState } from 'react'
import { useCollection } from '../../lib/store'
import { decksCol, cardsCol } from '../../data/collections'
import { isDue, schedule, RATING_LABEL, todayStr, type Rating } from '../../lib/srs'
import type { Card } from '../../data/types'

type View =
  | { name: 'decks' }
  | { name: 'detail'; deckId: string }
  | { name: 'review'; deckId: string }

export default function Flashcards() {
  const [view, setView] = useState<View>({ name: 'decks' })

  if (view.name === 'detail')
    return (
      <DeckDetail
        deckId={view.deckId}
        onBack={() => setView({ name: 'decks' })}
        onReview={() => setView({ name: 'review', deckId: view.deckId })}
      />
    )
  if (view.name === 'review')
    return (
      <ReviewSession
        deckId={view.deckId}
        onDone={() => setView({ name: 'detail', deckId: view.deckId })}
      />
    )
  return (
    <DeckList
      onOpen={(id) => setView({ name: 'detail', deckId: id })}
      onReview={(id) => setView({ name: 'review', deckId: id })}
    />
  )
}

// ───── 牌組列表 ─────
function DeckList({
  onOpen,
  onReview,
}: {
  onOpen: (id: string) => void
  onReview: (id: string) => void
}) {
  const decks = useCollection(decksCol)
  const cards = useCollection(cardsCol)
  const [name, setName] = useState('')

  const add = () => {
    if (!name.trim()) return
    decksCol.add({ name: name.trim(), createdAt: new Date().toISOString() })
    setName('')
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="新牌組名稱（例如 會計概念）"
          className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
        />
        <button
          onClick={add}
          className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-strong"
        >
          ＋ 牌組
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {decks.map((d) => {
          const deckCards = cards.filter((c) => c.deckId === d.id)
          const due = deckCards.filter(isDue).length
          return (
            <div
              key={d.id}
              className="group rounded-2xl border border-slate-200 bg-white p-4"
            >
              <div className="flex items-start justify-between">
                <p className="text-base font-semibold text-slate-800">
                  {d.name}
                </p>
                <button
                  onClick={() => {
                    decksCol.remove(d.id)
                    deckCards.forEach((c) => cardsCol.remove(c.id))
                  }}
                  className="text-xs text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-red-500"
                >
                  刪除
                </button>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                {deckCards.length} 張卡 · 今日到期{' '}
                <span className="font-semibold text-accent">{due}</span>
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => onReview(d.id)}
                  disabled={due === 0}
                  className="flex-1 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                >
                  複習 {due > 0 && `(${due})`}
                </button>
                <button
                  onClick={() => onOpen(d.id)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  管理
                </button>
              </div>
            </div>
          )
        })}
        {decks.length === 0 && (
          <p className="rounded-xl bg-slate-50 px-4 py-10 text-center text-sm text-slate-400 sm:col-span-2">
            仲未有牌組。上面建立一個，開始整知識卡。
          </p>
        )}
      </div>
    </div>
  )
}

// ───── 牌組詳情（管理卡）─────
function DeckDetail({
  deckId,
  onBack,
  onReview,
}: {
  deckId: string
  onBack: () => void
  onReview: () => void
}) {
  const decks = useCollection(decksCol)
  const cards = useCollection(cardsCol).filter((c) => c.deckId === deckId)
  const deck = decks.find((d) => d.id === deckId)
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')

  const due = cards.filter(isDue).length

  const add = () => {
    if (!front.trim() || !back.trim()) return
    cardsCol.add({
      deckId,
      front: front.trim(),
      back: back.trim(),
      ease: 2.5,
      intervalDays: 0,
      repetitions: 0,
      dueDate: todayStr(),
      createdAt: new Date().toISOString(),
    })
    setFront('')
    setBack('')
  }

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="text-sm text-slate-400 hover:text-accent"
      >
        ← 返回所有牌組
      </button>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-800">{deck?.name}</h3>
        <button
          onClick={onReview}
          disabled={due === 0}
          className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-strong disabled:bg-slate-200 disabled:text-slate-400"
        >
          開始複習 {due > 0 && `(${due})`}
        </button>
      </div>

      <div className="space-y-2 rounded-2xl border border-accent/30 bg-accent-soft/40 p-4">
        <input
          value={front}
          onChange={(e) => setFront(e.target.value)}
          placeholder="正面（問題）"
          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <textarea
          value={back}
          onChange={(e) => setBack(e.target.value)}
          placeholder="背面（答案）"
          rows={2}
          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <button
          onClick={add}
          className="w-full rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-strong"
        >
          加入卡片
        </button>
      </div>

      <ul className="space-y-2">
        {cards.map((c) => (
          <li
            key={c.id}
            className="group rounded-2xl border border-slate-200 bg-white p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-800">{c.front}</p>
                <p className="mt-1 text-sm text-slate-500">{c.back}</p>
              </div>
              <button
                onClick={() => cardsCol.remove(c.id)}
                className="text-xs text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-red-500"
              >
                刪除
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-slate-300">
              {isDue(c) ? '今日到期' : `下次複習：${c.dueDate}`}
            </p>
          </li>
        ))}
        {cards.length === 0 && (
          <li className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
            仲未有卡片
          </li>
        )}
      </ul>
    </div>
  )
}

// ───── 複習模式 ─────
function ReviewSession({
  deckId,
  onDone,
}: {
  deckId: string
  onDone: () => void
}) {
  const allCards = useCollection(cardsCol)
  // 開場時鎖定到期隊列（用 id）
  const [queue, setQueue] = useState<string[]>(() =>
    allCards.filter((c) => c.deckId === deckId && isDue(c)).map((c) => c.id),
  )
  const [flipped, setFlipped] = useState(false)
  const [done, setDone] = useState(0)

  const currentId = queue[0]
  const card: Card | undefined = allCards.find((c) => c.id === currentId)

  if (!card) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-4xl">🎉</p>
        <p className="text-lg font-semibold text-slate-800">複習完成！</p>
        <p className="text-sm text-slate-500">今次複習咗 {done} 次。</p>
        <button
          onClick={onDone}
          className="rounded-xl bg-accent px-5 py-2 text-sm font-medium text-white hover:bg-accent-strong"
        >
          返回牌組
        </button>
      </div>
    )
  }

  const rate = (rating: Rating) => {
    cardsCol.update(card.id, schedule(card, rating))
    setDone((d) => d + 1)
    setFlipped(false)
    setQueue((q) => {
      const [, ...rest] = q
      // 唔記得 → 排返去隊尾，今次再出
      return rating === 'again' ? [...rest, card.id] : rest
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs text-slate-400">
        <button onClick={onDone} className="hover:text-accent">
          ← 結束複習
        </button>
        <span>
          進度 {done} · 剩 {queue.length}
        </span>
      </div>

      <div
        onClick={() => setFlipped((f) => !f)}
        className="flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm"
      >
        <p className="text-xs uppercase tracking-wider text-slate-300">
          {flipped ? '答案' : '問題'}（撳一下翻面）
        </p>
        <p className="mt-3 text-lg font-medium text-slate-800">
          {flipped ? card.back : card.front}
        </p>
      </div>

      {flipped ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(['again', 'hard', 'good', 'easy'] as Rating[]).map((r) => (
            <button
              key={r}
              onClick={() => rate(r)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:border-accent hover:bg-accent-soft"
            >
              {RATING_LABEL[r]}
            </button>
          ))}
        </div>
      ) : (
        <button
          onClick={() => setFlipped(true)}
          className="w-full rounded-xl bg-accent px-4 py-3 text-sm font-medium text-white hover:bg-accent-strong"
        >
          顯示答案
        </button>
      )}
    </div>
  )
}
