import { useMemo, useState } from 'react'
import { useCollection } from '../../lib/store'
import { decksCol, cardsCol } from '../../data/collections'
import { isDue, schedule, RATING_LABEL, todayStr, type Rating } from '../../lib/srs'
import type { Card } from '../../data/types'
import {
  Button,
  Input,
  Textarea,
  Card as UICard,
  Badge,
  EmptyState,
  ProgressBar,
  StatCard,
  Modal,
  IconButton,
} from '../../ui'

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

  const totalDue = cards.filter(isDue).length

  const add = () => {
    if (!name.trim()) return
    decksCol.add({ name: name.trim(), createdAt: new Date().toISOString() })
    setName('')
  }

  return (
    <div className="space-y-4">
      {/* 總覽 StatCard */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="牌組" value={decks.length} unit="組" icon="📚" />
        <StatCard
          label="今日要複習"
          value={totalDue}
          unit="張"
          icon="🔥"
          highlight
        />
        <StatCard label="總卡數" value={cards.length} unit="張" icon="🗂️" />
      </div>

      <div className="flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="新牌組名稱（例如 會計概念）"
          className="flex-1"
        />
        <Button onClick={add}>＋ 牌組</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {decks.map((d) => {
          const deckCards = cards.filter((c) => c.deckId === d.id)
          const due = deckCards.filter(isDue).length
          return (
            <UICard key={d.id} className="group p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-base font-semibold text-slate-800">
                  {d.name}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (!confirm(`刪除牌組「${d.name}」？卡片亦會一併刪除。`))
                      return
                    decksCol.remove(d.id)
                    deckCards.forEach((c) => cardsCol.remove(c.id))
                  }}
                  className="text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-rose-500"
                >
                  刪除
                </Button>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                {deckCards.length} 張卡 · 今日到期{' '}
                <span className="font-semibold text-accent">{due}</span>
              </p>
              <div className="mt-3 flex gap-2">
                <Button
                  onClick={() => onReview(d.id)}
                  disabled={due === 0}
                  size="sm"
                  className="flex-1"
                >
                  複習 {due > 0 && `(${due})`}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onOpen(d.id)}
                >
                  管理
                </Button>
              </div>
            </UICard>
          )
        })}
        {decks.length === 0 && (
          <div className="sm:col-span-2">
            <EmptyState
              icon="🗂️"
              title="仲未有牌組"
              hint="上面建立一個，開始整知識卡同間隔重複溫習。"
            />
          </div>
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
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameValue, setRenameValue] = useState('')

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
    // 連續輸入：清空 + focus 返 front，方便連續加多張
    setFront('')
    setBack('')
    document.getElementById('card-front')?.focus()
  }

  const saveRename = () => {
    const v = renameValue.trim()
    if (!v) return
    decksCol.update(deckId, { name: v })
    setRenameOpen(false)
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack}>
        ← 返回所有牌組
      </Button>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <h3 className="text-lg font-bold text-slate-800">{deck?.name}</h3>
          <IconButton
            label="改名"
            onClick={() => {
              setRenameValue(deck?.name ?? '')
              setRenameOpen(true)
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M4 20h4l10-10-4-4L4 16v4zM14 6l4 4"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </IconButton>
        </div>
        <Button onClick={onReview} disabled={due === 0} size="sm">
          開始複習 {due > 0 && `(${due})`}
        </Button>
      </div>

      {/* 新增卡（支援連續輸入） */}
      <div className="space-y-2 rounded-2xl border border-accent/30 bg-accent-soft/40 p-4">
        <Input
          id="card-front"
          value={front}
          onChange={(e) => setFront(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') document.getElementById('card-back')?.focus()
          }}
          placeholder="正面（問題）"
        />
        <Textarea
          id="card-back"
          value={back}
          onChange={(e) => setBack(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) add()
          }}
          placeholder="背面（答案）"
          rows={2}
        />
        <Button onClick={add} className="w-full">
          加入卡片（可連續加）
        </Button>
      </div>

      <ul className="space-y-2">
        {cards.map((c) => (
          <li key={c.id} className="group">
            <UICard className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-800">
                    {c.front}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">{c.back}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => cardsCol.remove(c.id)}
                  className="text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-rose-500"
                >
                  刪除
                </Button>
              </div>
              <div className="mt-2">
                {isDue(c) ? (
                  <Badge tone="accent">今日到期</Badge>
                ) : (
                  <Badge tone="slate">下次 {c.dueDate}</Badge>
                )}
              </div>
            </UICard>
          </li>
        ))}
        {cards.length === 0 && (
          <li>
            <EmptyState icon="📝" title="仲未有卡片" hint="上面加第一張卡。" />
          </li>
        )}
      </ul>

      {/* 改名 Modal */}
      <Modal
        open={renameOpen}
        onClose={() => setRenameOpen(false)}
        title="牌組改名"
      >
        <div className="space-y-3">
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && saveRename()}
            placeholder="牌組名稱"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRenameOpen(false)}>
              取消
            </Button>
            <Button onClick={saveRename}>儲存</Button>
          </div>
        </div>
      </Modal>
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
  // 開場張數（用嚟計進度）
  const total = useMemo(
    () =>
      allCards.filter((c) => c.deckId === deckId && isDue(c)).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const currentId = queue[0]
  const card: Card | undefined = allCards.find((c) => c.id === currentId)

  if (!card) {
    return (
      <UICard className="space-y-4 p-8 text-center">
        <p className="text-4xl">🎉</p>
        <p className="text-lg font-semibold text-slate-800">複習完成！</p>
        <p className="text-sm text-slate-500">
          今次複習咗 <span className="font-semibold text-accent">{done}</span>{' '}
          張卡。
        </p>
        <Button onClick={onDone} size="lg">
          返回牌組
        </Button>
      </UICard>
    )
  }

  const remaining = queue.length
  // 進度以「未剩低 / 總數」估算
  const progress = total > 0 ? ((total - remaining) / total) * 100 : 0

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
        <Button variant="ghost" size="sm" onClick={onDone}>
          ← 結束複習
        </Button>
        <span>
          已複習 {done} · 剩 <span className="font-semibold">{remaining}</span> 張
        </span>
      </div>

      <ProgressBar value={progress} />

      <UICard
        onClick={() => setFlipped((f) => !f)}
        className="flex min-h-[200px] flex-col items-center justify-center p-6 text-center"
      >
        <p className="text-xs uppercase tracking-wider text-slate-300">
          {flipped ? '答案' : '問題'}（撳一下翻面）
        </p>
        <p className="mt-3 text-lg font-medium text-slate-800">
          {flipped ? card.back : card.front}
        </p>
      </UICard>

      {flipped ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(['again', 'hard', 'good', 'easy'] as Rating[]).map((r) => (
            <Button
              key={r}
              variant="secondary"
              onClick={() => rate(r)}
              className="hover:border-accent hover:bg-accent-soft"
            >
              {RATING_LABEL[r]}
            </Button>
          ))}
        </div>
      ) : (
        <Button onClick={() => setFlipped(true)} size="lg" className="w-full">
          顯示答案
        </Button>
      )}
    </div>
  )
}
