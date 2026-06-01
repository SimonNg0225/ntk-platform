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
  StatCard,
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
  metaOf,
  prefOf,
  STATE_LABEL,
  STATE_TONE,
} from './flashcards/srs'
import type { StudyMode, TopView } from './flashcards/types'

// ============================================================
//  知識卡 + 間隔重複（深化至 Anki 級）
//  ------------------------------------------------------------
//  三大區：牌組（study）/ 瀏覽器（browse）/ 統計（stats）
//  共用 decksCol / cardsCol 不變；標籤、暫停、複習歷史等
//  全部喺 features/learning/flashcards/ 自家 collection。
//  零新 npm，圖表全 SVG/div 自製。
// ============================================================

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
    <div className="space-y-4">
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
    <div className="space-y-4">
      {/* 總覽 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="牌組" value={decks.length} unit="組" icon={BookMarked} />
        <StatCard label="今日到期" value={totalDue} unit="張" icon={Flame} highlight />
        <StatCard label="今日已複習" value={reviewedToday} unit="次" icon={Zap} />
        <StatCard label="總卡數" value={cards.length} unit="張" icon={FolderOpen} />
      </div>

      {/* 新增 + 匯入匯出 */}
      <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-3 dark:border-slate-700/60 dark:bg-slate-800/40">
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
      <div className="grid gap-3 sm:grid-cols-2">
        {decks.map((d) => {
          const deckCards = cards.filter((c) => c.deckId === d.id)
          const active = deckCards.filter((c) => !metaById.get(c.id)?.suspended)
          const due = active.filter(isDue).length
          const newCount = active.filter((c) => c.repetitions === 0).length
          const matureCount = active.filter((c) => c.intervalDays >= 21).length
          const matPct =
            deckCards.length > 0 ? (matureCount / deckCards.length) * 100 : 0
          const pref = prefOf(prefs, d.id)
          const newToday = Math.min(newCount, pref.newPerDay)

          return (
            <div
              key={d.id}
              className="group flex flex-col rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md dark:border-slate-700/60 dark:bg-slate-800 dark:shadow-none dark:hover:border-slate-600"
            >
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
              <div className="mt-3 flex gap-2">
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
    disabled?: boolean
  }[] = [
    {
      mode: 'srs',
      icon: Play,
      title: '間隔重複',
      desc: '標準複習，會更新排程',
      count: due,
    },
    {
      mode: 'typed',
      icon: NotebookPen,
      title: '打字作答',
      desc: '打出答案，自動對比',
      count: due,
    },
    {
      mode: 'cram',
      icon: Zap,
      title: '衝刺',
      desc: '全部卡，唔影響排程',
      count: cards.length,
    },
    {
      mode: 'starred',
      icon: Flame,
      title: '只溫已標記',
      desc: '集中攻克紅旗卡',
      count: flagged,
      disabled: flagged === 0,
    },
  ]

  return (
    <Modal open onClose={onClose} title="揀練習模式" size="sm">
      <div className="grid gap-2">
        {modes.map((m) => (
          <button
            key={m.mode}
            disabled={m.disabled}
            onClick={() => onPick(m.mode)}
            className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-left transition hover:border-accent hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:hover:bg-accent/10"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
              <m.icon size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {m.title}
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500">{m.desc}</p>
            </div>
            {typeof m.count === 'number' && (
              <span className="shrink-0 text-sm font-semibold tabular-nums text-accent">
                {m.count}
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
        <div className="flex items-center gap-1.5">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
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

      {/* 新增卡（支援連續輸入） */}
      <div className="space-y-2 rounded-2xl border border-accent/30 bg-accent-soft/40 p-4 dark:border-accent/40 dark:bg-accent/10">
        <div className="flex items-center gap-1.5 text-xs font-medium text-accent-strong dark:text-accent">
          <Plus size={14} /> 加新卡
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

      {/* 卡片清單 */}
      <ul className="space-y-2">
        {cards.map((c) => {
          const meta = metaOf(metas, c.id)
          const st = cardState(c, meta)
          const leech = isLeech(meta)
          return (
            <li key={c.id} className="group">
              <UICard
                className={cx(
                  'p-3',
                  meta.suspended && 'opacity-60',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="break-words font-medium text-slate-800 dark:text-slate-100">
                      {c.front}
                    </p>
                    <p className="mt-0.5 break-words text-sm text-slate-500 dark:text-slate-400">
                      {c.back}
                    </p>
                    {meta.tags.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
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
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
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
              </UICard>
            </li>
          )
        })}
        {cards.length === 0 && (
          <li>
            <EmptyState
              icon={Sparkles}
              title="呢個牌組仲未有卡"
              hint="上面加你第一張卡，或者試下「AI 生成知識卡」幫你自動整一批。"
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
