import { useEffect, useMemo, useState } from 'react'
import { useCollection } from '../../lib/store'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import { decksCol, cardsCol } from '../../data/collections'
import { isDue, todayStr } from '../../lib/srs'
import {
  Button,
  Input,
  Textarea,
  Card as UICard,
  Badge,
  EmptyState,
  ProgressBar,
  Modal,
  IconButton,
  Menu,
  Tabs,
  SegmentedControl,
  Kbd,
  cx,
} from '../../ui'
import {
  ArrowLeft,
  BarChart3,
  BookMarked,
  Ban,
  Flame,
  FolderOpen,
  Layers,
  ListChecks,
  MoreVertical,
  NotebookPen,
  Pencil,
  Play,
  Plus,
  Settings2,
  Sparkles,
  Trash2,
  Upload,
  Zap,
} from 'lucide-react'
import BrowseView from './flashcards/BrowseView'
import StatsView from './flashcards/StatsView'
import ReviewScreen from './flashcards/ReviewScreen'
import ImportExport from './flashcards/ImportExport'
import {
  cardMetaCol,
  deckPrefCol,
  reviewLogCol,
  pruneMeta,
  upsertMeta,
  upsertPref,
} from './flashcards/store'
import {
  cardState,
  fmtInterval,
  isLeech,
  prefOf,
  STATE_LABEL,
  STATE_TONE,
} from './flashcards/srs'
import type { CardMeta, StudyMode, TopView } from './flashcards/types'
import type { Card } from '../../data/types'

// ============================================================
//  知識卡 + 間隔重複（深化至 Anki 級）
//  ------------------------------------------------------------
//  三大區：牌組（study）/ 瀏覽器（browse）/ 統計（stats）
//  共用 decksCol / cardsCol 不變；標籤、暫停、複習歷史等
//  全部喺 features/learning/flashcards/ 自家 collection。
//  零新 npm，圖表全 SVG/div 自製。
// ============================================================

// metaById.get() 揾唔到時嘅 fallback，shape 同 metaOf() 內部 fallback 一致
const EMPTY_META: CardMeta = {
  id: '',
  tags: [],
  suspended: false,
  flagged: false,
  lapses: 0,
  updatedAt: '',
}

type Screen =
  | { name: 'home' }
  | { name: 'detail'; deckId: string }
  | { name: 'review'; deckId: string; mode: StudyMode }

export default function Flashcards() {
  const [screen, setScreen] = useState<Screen>({ name: 'home' })
  const [topView, setTopView] = useState<TopView>('decks')

  // 清理孤兒中繼（卡刪咗）
  const allCards = useCollection(cardsCol)
  useEffect(() => {
    pruneMeta(new Set(allCards.map((c) => c.id)))
    // 只喺卡集合變動時跑
  }, [allCards])

  if (screen.name === 'detail')
    return (
      <DeckDetail
        deckId={screen.deckId}
        onBack={() => setScreen({ name: 'home' })}
        onReview={(mode) => setScreen({ name: 'review', deckId: screen.deckId, mode })}
      />
    )

  if (screen.name === 'review')
    return (
      <ReviewScreen
        deckId={screen.deckId}
        mode={screen.mode}
        onDone={() => setScreen({ name: 'detail', deckId: screen.deckId })}
      />
    )

  return (
    <div className="space-y-5">
      {/* ───────── 卡盒檔案 masthead：頁面身份（kicker + serif 功能名 + 索引卡紅margin線）───────── */}
      <header className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white px-5 py-5 shadow-xs dark:border-slate-700/60 dark:bg-slate-800 dark:shadow-none sm:px-7 sm:py-6">
        {/* 索引卡紅margin線（呼應全頁卡盒概念） */}
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-rose-300/80 via-rose-400/70 to-rose-300/40 dark:from-rose-500/40 dark:via-rose-500/50 dark:to-rose-500/20"
        />
        {/* 封面右上「卡盒戳印」裝飾（純裝飾，唔搶主次） */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-5 top-3 hidden -rotate-6 select-none rounded-xl border-2 border-dashed border-accent/20 px-4 py-2 font-serif text-xs font-semibold uppercase tracking-[0.25em] text-accent/25 dark:border-accent/25 dark:text-accent/25 sm:block"
        >
          SRS · 間隔重複
        </span>
        <div className="pl-2">
          <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.3em] text-accent/70">
            <BookMarked size={13} />
            知識卡盒 · Flashcards
          </p>
          <h1 className="mt-1.5 font-serif text-[28px] font-semibold leading-none tracking-tight text-slate-800 dark:text-slate-100 sm:text-[34px]">
            知識卡 + 複習
          </h1>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            一張張寫，間隔重複幫你記得牢；到期先彈出嚟溫故知新。
          </p>
        </div>
      </header>

      <Tabs<TopView>
        tabs={[
          { id: 'decks', label: '牌組' },
          { id: 'browse', label: '瀏覽器' },
          { id: 'stats', label: '統計' },
        ]}
        icons={{ decks: Layers, browse: ListChecks, stats: BarChart3 }}
        active={topView}
        onChange={setTopView}
      />
      {topView === 'decks' && (
        <DeckHome
          onOpen={(id) => setScreen({ name: 'detail', deckId: id })}
          onReview={(id, mode) => setScreen({ name: 'review', deckId: id, mode })}
        />
      )}
      {topView === 'browse' && <BrowseView />}
      {topView === 'stats' && <StatsView />}
    </div>
  )
}

// ═══════════ 牌組首頁 ═══════════
function DeckHome({
  onOpen,
  onReview,
}: {
  onOpen: (id: string) => void
  onReview: (id: string, mode: StudyMode) => void
}) {
  const decks = useCollection(decksCol)
  const cards = useCollection(cardsCol)
  const metas = useCollection(cardMetaCol)
  const logs = useCollection(reviewLogCol)
  const prefs = useCollection(deckPrefCol)
  const toast = useToast()
  const confirm = useConfirm()
  const [name, setName] = useState('')
  const [ioOpen, setIoOpen] = useState(false)
  const [studyFor, setStudyFor] = useState<string | null>(null)

  const metaById = useMemo(() => new Map(metas.map((m) => [m.id, m])), [metas])

  // 卡按牌組分組一次（避免每個牌組各掃一次全部卡：O(decks × cards) → O(cards)）
  const cardsByDeck = useMemo(() => {
    const m = new Map<string, Card[]>()
    for (const c of cards) {
      const a = m.get(c.deckId)
      if (a) a.push(c)
      else m.set(c.deckId, [c])
    }
    return m
  }, [cards])

  // 全域 KPI
  const activeCards = useMemo(
    () => cards.filter((c) => !metaById.get(c.id)?.suspended),
    [cards, metaById],
  )
  const totalDue = activeCards.filter(isDue).length
  const reviewedToday = useMemo(() => {
    const t = todayStr()
    return logs.filter((l) => l.ts.slice(0, 10) === t).length
  }, [logs])

  const add = () => {
    if (!name.trim()) return
    decksCol.add({ name: name.trim(), createdAt: new Date().toISOString() })
    setName('')
    toast.success('已新增牌組')
  }

  return (
    <div className="space-y-5">
      {/* ───────── 卡盒封面：今日複習做主角（serif 大數字 + 細口統計帶） ───────── */}
      <header className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xs dark:border-slate-700/60 dark:bg-slate-800 dark:shadow-none">
        {/* 索引卡紅margin線 */}
        <div className="h-1 w-full bg-gradient-to-r from-rose-300/80 via-rose-400/70 to-rose-300/40 dark:from-rose-500/40 dark:via-rose-500/50 dark:to-rose-500/20" />
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 px-5 pb-4 pt-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-accent/70">
              今日複習
            </p>
            <p className="mt-1.5 flex items-baseline gap-2">
              <span className="font-serif text-[40px] font-semibold leading-none tabular-nums slashed-zero text-slate-800 dark:text-slate-100 sm:text-[44px]">
                {totalDue}
              </span>
              <span className="text-sm font-normal text-slate-400 dark:text-slate-500">
                張卡到期
              </span>
            </p>
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
              {totalDue > 0
                ? '揀一疊，逐張翻開，溫故知新。'
                : reviewedToday > 0
                  ? '今日已清晒到期卡，做得好 ✨'
                  : '暫時無到期卡，可以衝刺或者開新牌組。'}
            </p>
          </div>
          <span
            aria-hidden="true"
            className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent sm:flex"
          >
            <Layers size={26} strokeWidth={1.75} />
          </span>
        </div>
        {/* 細口統計帶（hairline grid） */}
        <div className="grid grid-cols-3 gap-px border-t border-slate-200/70 bg-slate-200/60 dark:border-slate-700/60 dark:bg-slate-700/40">
          {[
            { label: '牌組', value: decks.length, unit: '組', icon: BookMarked },
            { label: '今日已複習', value: reviewedToday, unit: '次', icon: Zap },
            { label: '總卡數', value: cards.length, unit: '張', icon: FolderOpen },
          ].map((s) => {
            const I = s.icon
            return (
              <div key={s.label} className="bg-white px-4 py-3 dark:bg-slate-800">
                <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  <I size={12} />
                  {s.label}
                </p>
                <p className="mt-1 font-serif text-xl font-semibold leading-none tabular-nums slashed-zero text-slate-800 dark:text-slate-100">
                  {s.value}
                  <span className="ml-1 font-sans text-xs font-normal text-slate-400">
                    {s.unit}
                  </span>
                </p>
              </div>
            )
          })}
        </div>
      </header>

      {/* 新增 + 匯入匯出 */}
      <div className="rounded-2xl border border-dashed border-slate-300/80 bg-slate-50/60 p-3 dark:border-slate-700/70 dark:bg-slate-800/40">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="開個新牌組⋯⋯（例如 會計概念）"
            className="min-w-[180px] flex-1 bg-white dark:bg-slate-800"
          />
          <Button onClick={add} icon={Plus} disabled={!name.trim()}>
            建立牌組
          </Button>
          <Button variant="secondary" icon={Upload} onClick={() => setIoOpen(true)}>
            匯入 / 匯出
          </Button>
        </div>
      </div>

      {/* 牌組卡 */}
      <div className="grid gap-4 sm:grid-cols-2">
        {decks.map((d) => {
          const deckCards = cardsByDeck.get(d.id) ?? []
          const active = deckCards.filter((c) => !metaById.get(c.id)?.suspended)
          const due = active.filter(isDue).length
          const newCount = active.filter((c) => c.repetitions === 0).length
          const matureCount = active.filter((c) => c.intervalDays >= 21).length
          const matPct =
            deckCards.length > 0 ? (matureCount / deckCards.length) * 100 : 0
          const pref = prefOf(prefs, d.id)
          const newToday = Math.min(newCount, pref.newPerDay)
          // 卡疊厚度：卡越多，背後紙邊越多（最多 2 層），呈現實體牌組層次
          const stackDepth = deckCards.length >= 12 ? 2 : deckCards.length >= 3 ? 1 : 0

          return (
            <div key={d.id} className="group relative">
              {/* 背後紙疊邊（實體層次；DOM 在主卡之前 → 主卡自然蓋過，唔使 z-index） */}
              {stackDepth >= 2 && (
                <div
                  aria-hidden="true"
                  className="absolute inset-x-2.5 -bottom-2 top-2 rounded-3xl border border-slate-200/70 bg-white dark:border-slate-700/50 dark:bg-slate-800/80"
                />
              )}
              {stackDepth >= 1 && (
                <div
                  aria-hidden="true"
                  className="absolute inset-x-1.5 -bottom-1 top-1 rounded-3xl border border-slate-200/80 bg-white dark:border-slate-700/60 dark:bg-slate-800/90"
                />
              )}

              <div
                className={cx(
                  'relative flex flex-col overflow-hidden rounded-3xl border bg-white shadow-xs transition duration-200 hover:-translate-y-0.5 hover:shadow-md dark:bg-slate-800 dark:shadow-none',
                  due > 0
                    ? 'border-accent/30 hover:border-accent/50 dark:border-accent/30 dark:hover:border-accent/50'
                    : 'border-slate-200/80 hover:border-slate-300 dark:border-slate-700/60 dark:hover:border-slate-600',
                )}
              >
                {/* 索引卡紅margin線（到期＝accent 醒目，否則淡rose） */}
                <span
                  aria-hidden="true"
                  className={cx(
                    'h-1 w-full',
                    due > 0
                      ? 'bg-accent'
                      : 'bg-rose-200/70 dark:bg-rose-500/25',
                  )}
                />
                <div className="flex flex-col p-4">
                  <div className="flex items-start justify-between gap-2">
                    <button
                      onClick={() => onOpen(d.id)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <span
                        className={cx(
                          'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition group-hover:scale-105',
                          due > 0
                            ? 'bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent'
                            : 'bg-slate-100 text-slate-400 dark:bg-slate-700/60 dark:text-slate-400',
                        )}
                      >
                        <Layers size={20} />
                      </span>
                      <span className="min-w-0">
                        <p className="truncate text-base font-semibold text-slate-800 group-hover:text-accent dark:text-slate-100">
                          {d.name}
                        </p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">
                          <span className="tabular-nums">{deckCards.length}</span> 張卡
                        </p>
                      </span>
                    </button>
                    <Menu
                      align="end"
                      trigger={
                        <span className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-500 dark:hover:bg-slate-700">
                          <MoreVertical size={16} />
                          <span className="sr-only">{d.name} 更多操作</span>
                        </span>
                      }
                      items={[
                        { id: 'manage', label: '管理卡片', icon: Pencil, onSelect: () => onOpen(d.id) },
                        {
                          id: 'cram',
                          label: '衝刺（全部卡）',
                          icon: Zap,
                          onSelect: () => onReview(d.id, 'cram'),
                          disabled: deckCards.length === 0,
                        },
                        {
                          id: 'del',
                          label: '刪除牌組',
                          icon: Trash2,
                          tone: 'danger',
                          onSelect: async () => {
                            if (
                              !(await confirm({
                                title: '刪除牌組？',
                                message: `「${d.name}」連同 ${deckCards.length} 張卡會一併刪除，無法復原。`,
                                confirmText: '刪除',
                                tone: 'danger',
                              }))
                            )
                              return
                            decksCol.remove(d.id)
                            deckCards.forEach((c) => {
                              cardsCol.remove(c.id)
                              cardMetaCol.remove(c.id)
                            })
                            deckPrefCol.remove(d.id)
                            toast.success('已刪除牌組')
                          },
                        },
                      ]}
                    />
                  </div>

                  {/* 狀態小計 */}
                  {(due > 0 || newToday > 0) && (
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs">
                      {due > 0 && (
                        <Badge tone="accent" dot>
                          到期 {due}
                        </Badge>
                      )}
                      {newToday > 0 && (
                        <Badge tone="blue" dot>
                          新卡 {newToday}
                        </Badge>
                      )}
                    </div>
                  )}

                  {/* 熟悉度進度 */}
                  <div className="mt-3 flex-1">
                    <div className="mb-1 flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500">
                      <span>熟悉度</span>
                      <span className="tabular-nums">{Math.round(matPct)}%</span>
                    </div>
                    <ProgressBar value={matPct} tone="green" size="sm" />
                  </div>

                  {/* 操作 */}
                  <div className="mt-4 flex gap-2">
                    <Button
                      onClick={() =>
                        due > 0 ? onReview(d.id, 'srs') : setStudyFor(d.id)
                      }
                      disabled={deckCards.length === 0}
                      size="sm"
                      icon={Play}
                      className="flex-1"
                    >
                      {due > 0 ? `複習 (${due})` : '開始學習'}
                    </Button>
                    <Button variant="secondary" size="sm" icon={Layers} onClick={() => setStudyFor(d.id)}>
                      模式
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )
        })}

        {decks.length === 0 && (
          <div className="sm:col-span-2">
            <EmptyState
              icon={Layers}
              title="開個牌組，由第一張卡開始"
              hint="上面打個名就建立得；或者用「匯入」貼一批 CSV / JSON，一次過入晒。"
              action={
                <Button variant="secondary" icon={Upload} onClick={() => setIoOpen(true)}>
                  匯入現有卡片
                </Button>
              }
            />
          </div>
        )}
      </div>

      {/* 匯入匯出 Modal */}
      <ImportExport decks={decks} open={ioOpen} onClose={() => setIoOpen(false)} />

      {/* 揀學習模式 Modal */}
      {studyFor && (
        <StudyModeModal
          deckId={studyFor}
          onClose={() => setStudyFor(null)}
          onPick={(mode) => {
            setStudyFor(null)
            onReview(studyFor, mode)
          }}
        />
      )}
    </div>
  )
}

// ───────── 學習模式選擇 ─────────
function StudyModeModal({
  deckId,
  onClose,
  onPick,
}: {
  deckId: string
  onClose: () => void
  onPick: (mode: StudyMode) => void
}) {
  const cards = useCollection(cardsCol).filter((c) => c.deckId === deckId)
  const metas = useCollection(cardMetaCol)
  const metaById = useMemo(() => new Map(metas.map((m) => [m.id, m])), [metas])
  const due = cards.filter((c) => !metaById.get(c.id)?.suspended && isDue(c)).length
  const flagged = cards.filter((c) => metaById.get(c.id)?.flagged).length

  const modes: {
    mode: StudyMode
    icon: typeof Play
    title: string
    desc: string
    count?: number
    unit?: string
    disabled?: boolean
    recommended?: boolean
  }[] = [
    {
      mode: 'srs',
      icon: Play,
      title: '間隔重複',
      desc: '標準複習，會更新排程',
      count: due,
      unit: '張到期',
      recommended: due > 0,
    },
    {
      mode: 'typed',
      icon: NotebookPen,
      title: '打字作答',
      desc: '打出答案，自動對比',
      count: due,
      unit: '張到期',
    },
    {
      mode: 'cram',
      icon: Zap,
      title: '衝刺',
      desc: '全部卡，唔影響排程',
      count: cards.length,
      unit: '張全部',
    },
    {
      mode: 'starred',
      icon: Flame,
      title: '只溫已標記',
      desc: '集中攻克紅旗卡',
      count: flagged,
      unit: '張紅旗',
      disabled: flagged === 0,
    },
  ]

  return (
    <Modal open onClose={onClose} title="揀練習模式" size="sm">
      <p className="-mt-1 mb-3 text-xs text-slate-500 dark:text-slate-400">
        想點樣翻呢疊卡？揀一個模式就開始。
      </p>
      <div className="grid gap-2">
        {modes.map((m) => (
          <button
            key={m.mode}
            disabled={m.disabled}
            onClick={() => onPick(m.mode)}
            className={cx(
              'group flex items-center gap-3 rounded-xl border p-3 text-left transition hover:-translate-y-0.5 hover:border-accent hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-none dark:hover:bg-accent/10',
              m.recommended
                ? 'border-accent/40 bg-accent-soft/50 dark:border-accent/40 dark:bg-accent/10'
                : 'border-slate-200 dark:border-slate-700',
            )}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-strong transition group-hover:scale-105 dark:bg-accent/15 dark:text-accent">
              <m.icon size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
                {m.title}
                {m.recommended && <Badge tone="accent">建議</Badge>}
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500">{m.desc}</p>
            </div>
            {typeof m.count === 'number' && (
              <span className="flex shrink-0 flex-col items-end leading-none">
                <span className="text-base font-semibold tabular-nums text-accent">
                  {m.count}
                </span>
                <span className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-500">
                  {m.unit}
                </span>
              </span>
            )}
          </button>
        ))}
      </div>
    </Modal>
  )
}

// ═══════════ 牌組詳情（管理卡）═══════════
function DeckDetail({
  deckId,
  onBack,
  onReview,
}: {
  deckId: string
  onBack: () => void
  onReview: (mode: StudyMode) => void
}) {
  const decks = useCollection(decksCol)
  const allCards = useCollection(cardsCol)
  const metas = useCollection(cardMetaCol)
  const prefs = useCollection(deckPrefCol)
  const deck = decks.find((d) => d.id === deckId)
  const toast = useToast()
  const confirm = useConfirm()
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)

  const cards = useMemo(
    () => allCards.filter((c) => c.deckId === deckId),
    [allCards, deckId],
  )
  const metaById = useMemo(() => new Map(metas.map((m) => [m.id, m])), [metas])
  const due = cards.filter((c) => !metaById.get(c.id)?.suspended && isDue(c)).length
  const pref = prefOf(prefs, deckId)

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
    document.getElementById('card-front')?.focus()
    toast.success('已加入卡片')
  }

  const saveRename = () => {
    const v = renameValue.trim()
    if (!v) return
    decksCol.update(deckId, { name: v })
    setRenameOpen(false)
    toast.success('已更新牌組名稱')
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={onBack}>
        返回所有牌組
      </Button>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <h3 className="truncate font-serif text-2xl font-semibold tracking-tight text-slate-800 dark:text-slate-100">
            {deck?.name}
          </h3>
          <IconButton
            label="改名"
            onClick={() => {
              setRenameValue(deck?.name ?? '')
              setRenameOpen(true)
            }}
          >
            <Pencil size={16} />
          </IconButton>
          <IconButton label="牌組設定" onClick={() => setSettingsOpen(true)}>
            <Settings2 size={16} />
          </IconButton>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={Zap}
            onClick={() => onReview('cram')}
            disabled={cards.length === 0}
          >
            衝刺
          </Button>
          <Button
            size="sm"
            icon={Play}
            onClick={() => onReview('srs')}
            disabled={due === 0}
          >
            複習 {due > 0 && `(${due})`}
          </Button>
        </div>
      </div>
      <p className="-mt-2 text-xs text-slate-400 dark:text-slate-500">
        <span className="tabular-nums">{cards.length}</span> 張卡
        {due > 0 && (
          <>
            {' · '}
            <span className="font-medium text-accent-strong dark:text-accent">
              {due} 張到期
            </span>
          </>
        )}
      </p>

      {/* 新增卡：一張等住寫嘅空白索引卡（支援連續輸入） */}
      <div className="overflow-hidden rounded-2xl border border-accent/30 bg-white shadow-xs dark:border-accent/40 dark:bg-slate-800 dark:shadow-none">
        <span aria-hidden="true" className="block h-1 w-full bg-rose-300/70 dark:bg-rose-500/30" />
        <div className="space-y-2 bg-accent-soft/40 p-4 dark:bg-accent/10">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-accent-strong dark:text-accent">
            <Plus size={14} /> 寫一張新卡
          </div>
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
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500">
              <Kbd>⌘</Kbd>
              <Kbd>↵</Kbd> 快速加
            </span>
            <Button onClick={add} icon={Plus} size="sm">
              加入卡片
            </Button>
          </div>
        </div>
      </div>

      {/* 卡片清單 */}
      <ul className="space-y-2">
        {cards.map((c) => {
          const meta = metaById.get(c.id) ?? EMPTY_META
          const st = cardState(c, meta)
          const leech = isLeech(meta)
          return (
            <li key={c.id} className="group">
              <UICard
                hover
                className={cx(
                  'overflow-hidden rounded-2xl p-0',
                  meta.suspended && 'opacity-60',
                )}
              >
                <div className="flex items-stretch">
                  {/* 卡spine：跟狀態色，呈現卡片身份 */}
                  <span
                    aria-hidden="true"
                    className={cx(
                      'w-1 shrink-0',
                      st === 'mature'
                        ? 'bg-emerald-400 dark:bg-emerald-500/60'
                        : st === 'young'
                          ? 'bg-accent/70'
                          : st === 'learning'
                            ? 'bg-amber-400 dark:bg-amber-500/60'
                            : st === 'suspended'
                              ? 'bg-slate-300 dark:bg-slate-600'
                              : 'bg-blue-400 dark:bg-blue-500/60',
                    )}
                  />
                  <div className="min-w-0 flex-1 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-start gap-1.5 break-words font-medium text-slate-800 dark:text-slate-100">
                      <span className="mt-px shrink-0 text-[10px] font-bold uppercase tracking-wide text-slate-300 dark:text-slate-600">
                        Q
                      </span>
                      {c.front}
                    </p>
                    <p className="mt-1 flex items-start gap-1.5 break-words text-sm text-slate-500 dark:text-slate-400">
                      <span className="mt-px shrink-0 text-[10px] font-bold uppercase tracking-wide text-slate-300 dark:text-slate-600">
                        A
                      </span>
                      {c.back}
                    </p>
                    {meta.tags.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1 pl-4">
                        {meta.tags.map((t) => (
                          <span
                            key={t}
                            className="rounded bg-slate-100 px-1.5 py-px text-[10px] text-slate-500 dark:bg-slate-700 dark:text-slate-300"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <IconButton
                      label={meta.suspended ? '解除暫停' : '暫停'}
                      size="sm"
                      active={meta.suspended}
                      onClick={() => upsertMeta(c.id, { suspended: !meta.suspended })}
                    >
                      <Ban size={14} />
                    </IconButton>
                    <IconButton
                      label="刪除"
                      size="sm"
                      tone="danger"
                      onClick={async () => {
                        if (
                          !(await confirm({
                            title: '刪除卡片？',
                            message: '此卡片會被永久刪除，無法復原。',
                            confirmText: '刪除',
                            tone: 'danger',
                          }))
                        )
                          return
                        cardsCol.remove(c.id)
                        cardMetaCol.remove(c.id)
                        toast.success('已刪除卡片')
                      }}
                    >
                      <Trash2 size={14} />
                    </IconButton>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-4">
                  <Badge tone={STATE_TONE[st]}>{STATE_LABEL[st]}</Badge>
                  {c.repetitions > 0 && st !== 'suspended' && (
                    <span className="text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
                      下次 {isDue(c) ? '今日' : fmtInterval(c.intervalDays)}
                    </span>
                  )}
                  {leech && (
                    <Badge tone="rose">Leech · 答錯 {meta.lapses} 次</Badge>
                  )}
                </div>
                  </div>
                </div>
              </UICard>
            </li>
          )
        })}
        {cards.length === 0 && (
          <li>
            <EmptyState
              icon={Sparkles}
              title="呢疊卡仲係空白"
              hint="喺上面寫低正面同背面，撳「加入卡片」就有第一張。可以連續加，唔使逐張開。"
            />
          </li>
        )}
      </ul>

      {/* 改名 Modal */}
      <Modal open={renameOpen} onClose={() => setRenameOpen(false)} title="牌組改名" size="sm">
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

      {/* 牌組設定 Modal */}
      <DeckSettingsModal
        open={settingsOpen}
        deckId={deckId}
        pref={pref}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  )
}

// ───────── 牌組設定（每日上限 + 隊列排序）─────────
function DeckSettingsModal({
  open,
  deckId,
  pref,
  onClose,
}: {
  open: boolean
  deckId: string
  pref: ReturnType<typeof prefOf>
  onClose: () => void
}) {
  const toast = useToast()
  const [newPerDay, setNewPerDay] = useState(String(pref.newPerDay))
  const [order, setOrder] = useState(pref.order)

  // pref 變（換牌組）時同步
  useEffect(() => {
    setNewPerDay(String(pref.newPerDay))
    setOrder(pref.order)
  }, [pref.newPerDay, pref.order])

  const save = () => {
    const n = Math.max(0, Math.min(999, parseInt(newPerDay, 10) || 0))
    upsertPref(deckId, { newPerDay: n, order })
    toast.success('已更新牌組設定')
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="牌組設定"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button onClick={save}>儲存</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
            每日新卡上限
          </label>
          <Input
            type="number"
            min={0}
            max={999}
            value={newPerDay}
            onChange={(e) => setNewPerDay(e.target.value)}
            aria-label="每日新卡上限"
          />
          <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
            每次複習最多引入幾多張未學過嘅新卡（避免一下子太多）。
          </p>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
            複習順序
          </label>
          <SegmentedControl
            value={order}
            onChange={setOrder}
            options={[
              { id: 'due', label: '到期優先' },
              { id: 'added', label: '加入次序' },
              { id: 'random', label: '隨機' },
            ]}
          />
        </div>
      </div>
    </Modal>
  )
}
