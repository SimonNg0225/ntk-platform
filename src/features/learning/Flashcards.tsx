import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  PageHeader,
  PageHero,
  SectionTitle,
  FeatureGuide,
  cx,
} from '../../ui'
import type { FeatureGuideStep } from '../../ui'
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
  const { t } = useTranslation()
  const [screen, setScreen] = useState<Screen>({ name: 'home' })
  const [topView, setTopView] = useState<TopView>('decks')

  // 教學引導步驟（inline t；唔改共用 i18n 檔）
  const FLASHCARDS_GUIDE: FeatureGuideStep[] = [
    {
      title: t('flashcards.guideStep1Title', { defaultValue: '開個牌組' }),
      desc: t('flashcards.guideStep1Desc', {
        defaultValue: '喺「牌組」頁打個科目／主題名，就建立得一疊卡。',
      }),
    },
    {
      title: t('flashcards.guideStep2Title', { defaultValue: '寫卡：正面問、背面答' }),
      desc: t('flashcards.guideStep2Desc', {
        defaultValue: '入牌組逐張加，或用「匯入」一次過貼一批 CSV / JSON。',
      }),
    },
    {
      title: t('flashcards.guideStep3Title', { defaultValue: '每日複習到期卡' }),
      desc: t('flashcards.guideStep3Desc', {
        defaultValue: '撳「複習」逐張翻開，按記得幾熟評分，系統自動排下次。',
      }),
    },
    {
      title: t('flashcards.guideStep4Title', { defaultValue: '睇統計追進度' }),
      desc: t('flashcards.guideStep4Desc', {
        defaultValue: '「統計」頁有熱力圖、留存率同到期預測，掌握溫習節奏。',
      }),
    },
  ]

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
      {/* ───────── Hero：統一共用 PageHero（accent hero）───────── */}
      <PageHero
        guideKey="flashcards"
        icon={BookMarked}
        kicker={t('flashcards.kicker', { defaultValue: 'Spaced Repetition' })}
        title={t('flashcards.pageTitle', { defaultValue: '知識卡 + 複習' })}
        description={t('flashcards.pageDesc', {
          defaultValue: '一張張寫低重點，間隔重複幫你記得牢；到期先彈出嚟溫故知新。',
        })}
      />

      {/* ───────── 教學引導：點用呢個功能 ───────── */}
      <FeatureGuide
        storageKey="flashcards"
        title={t('flashcards.guideTitle', { defaultValue: '知識卡點用？' })}
        steps={FLASHCARDS_GUIDE}
      />

      <Tabs<TopView>
        tabs={[
          { id: 'decks', label: t('flashcards.tabDecks', { defaultValue: '牌組' }) },
          { id: 'browse', label: t('flashcards.tabBrowse', { defaultValue: '瀏覽器' }) },
          { id: 'stats', label: t('flashcards.tabStats', { defaultValue: '統計' }) },
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
  const { t } = useTranslation()
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
    toast.success(t('flashcards.deckCreated', { defaultValue: '已新增牌組' }))
  }

  // 今日複習進度：已複習 / (已複習 + 仲到期)，畀 hero 進度條用
  const todayTotal = reviewedToday + totalDue
  const todayPct = todayTotal > 0 ? Math.round((reviewedToday / todayTotal) * 100) : 0

  return (
    <div className="space-y-5">
      {/* ───────── 今日複習 hero（跟 dashboard Bento hero：實色 accent 底 + 進度條） ───────── */}
      <section className="relative flex flex-col gap-4 overflow-hidden rounded-2xl bg-accent p-5 text-white shadow-sm sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium text-white/70">
            {t('flashcards.todayReview', { defaultValue: '今日複習' })}
          </p>
          <p className="mt-2 flex items-baseline gap-2">
            <span className="text-4xl font-semibold tabular-nums slashed-zero">
              {totalDue}
            </span>
            <span className="text-sm font-medium text-white/70">
              {t('flashcards.cardsDue', { defaultValue: '張卡到期' })}
            </span>
          </p>
          <p className="mt-3 max-w-md text-sm text-white/80" aria-live="polite">
            {totalDue > 0
              ? t('flashcards.heroDue', { defaultValue: '揀一疊，逐張翻開，溫故知新。' })
              : reviewedToday > 0
                ? t('flashcards.heroCleared', { defaultValue: '今日已清晒到期卡，做得好 ✨' })
                : t('flashcards.heroIdle', {
                    defaultValue: '暫時無到期卡，可以衝刺或者開新牌組。',
                  })}
          </p>
        </div>
        <div className="w-full sm:max-w-[200px]">
          <p className="text-xs text-white/70">
            {t('flashcards.todayProgress', { defaultValue: '今日進度' })}
          </p>
          <p className="mt-0.5 text-3xl font-semibold tabular-nums">
            {reviewedToday}
            <span className="ml-1.5 text-sm font-medium text-white/60">
              {t('flashcards.ofTotalCards', {
                n: todayTotal,
                defaultValue: `/ ${todayTotal} 張`,
              })}
            </span>
          </p>
          <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-white/20">
            <div
              className="h-full rounded-full bg-white transition-all duration-700"
              style={{ width: `${todayPct}%` }}
            />
          </div>
        </div>
      </section>

      {/* ───────── 三個概覽統計磚（跟 dashboard StatTile） ───────── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            label: t('flashcards.statDecks', { defaultValue: '牌組' }),
            value: decks.length,
            unit: t('flashcards.unitDecks', { defaultValue: '組' }),
            icon: BookMarked,
            chip: 'bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent',
            val: 'text-accent',
          },
          {
            label: t('flashcards.statReviewedToday', { defaultValue: '今日已複習' }),
            value: reviewedToday,
            unit: t('flashcards.unitTimes', { defaultValue: '次' }),
            icon: Zap,
            chip: 'bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300',
            val: 'text-sky-500',
          },
          {
            label: t('flashcards.statTotalCards', { defaultValue: '總卡數' }),
            value: cards.length,
            unit: t('flashcards.unitCards', { defaultValue: '張' }),
            icon: FolderOpen,
            chip: 'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300',
            val: 'text-violet-500',
          },
        ].map((s) => {
          const I = s.icon
          return (
            <div
              key={s.label}
              className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-700/60 dark:bg-slate-800"
            >
              <div className="flex items-center justify-between">
                <span className="truncate text-xs font-medium text-slate-400 dark:text-slate-500">
                  {s.label}
                </span>
                <span
                  className={cx(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl',
                    s.chip,
                  )}
                >
                  <I size={16} />
                </span>
              </div>
              <p className="flex items-baseline gap-1">
                <span
                  className={cx('text-3xl font-semibold tabular-nums slashed-zero', s.val)}
                >
                  {s.value}
                </span>
                <span className="text-sm font-medium text-slate-400">{s.unit}</span>
              </p>
            </div>
          )
        })}
      </div>

      {/* 新增 + 匯入匯出 */}
      <div className="rounded-2xl border border-dashed border-slate-300/80 bg-slate-50/60 p-3 dark:border-slate-700/70 dark:bg-slate-800/40">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder={t('flashcards.newDeckPlaceholder', {
              defaultValue: '開個新牌組⋯⋯（例如 英文生字）',
            })}
            className="min-w-[180px] flex-1 bg-white dark:bg-slate-800"
          />
          <Button onClick={add} icon={Plus} disabled={!name.trim()}>
            {t('flashcards.createDeck', { defaultValue: '建立牌組' })}
          </Button>
          <Button variant="secondary" icon={Upload} onClick={() => setIoOpen(true)}>
            {t('flashcards.importExport', { defaultValue: '匯入 / 匯出' })}
          </Button>
        </div>
      </div>

      {/* 牌組卡 */}
      {decks.length > 0 && (
        <SectionTitle icon={Layers}>
          {t('flashcards.yourDecks', { defaultValue: '你的牌組' })}
        </SectionTitle>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
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

          return (
            <div
              key={d.id}
              className={cx(
                'group flex flex-col rounded-2xl border bg-white p-4 transition duration-200 hover:shadow-md dark:bg-slate-800 dark:shadow-none',
                due > 0
                  ? 'border-accent/30 hover:border-accent/50 dark:border-accent/30 dark:hover:border-accent/50'
                  : 'border-slate-200/80 hover:border-slate-300 dark:border-slate-700/60 dark:hover:border-slate-600',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <button
                  onClick={() => onOpen(d.id)}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.98]"
                >
                  <span
                    className={cx(
                      'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
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
                      <span className="tabular-nums">{deckCards.length}</span>{' '}
                      {t('flashcards.unitCards', { defaultValue: '張' })}
                      {t('flashcards.cardsSuffix', { defaultValue: '卡' })}
                    </p>
                  </span>
                </button>
                <Menu
                  align="end"
                  trigger={
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:hover:bg-slate-700">
                      <MoreVertical size={16} />
                      <span className="sr-only">
                        {t('flashcards.deckMoreActions', {
                          name: d.name,
                          defaultValue: `${d.name} 更多操作`,
                        })}
                      </span>
                    </span>
                  }
                  items={[
                    {
                      id: 'manage',
                      label: t('flashcards.manageCards', { defaultValue: '管理卡片' }),
                      icon: Pencil,
                      onSelect: () => onOpen(d.id),
                    },
                    {
                      id: 'cram',
                      label: t('flashcards.cramAll', { defaultValue: '衝刺（全部卡）' }),
                      icon: Zap,
                      onSelect: () => onReview(d.id, 'cram'),
                      disabled: deckCards.length === 0,
                    },
                    {
                      id: 'del',
                      label: t('flashcards.deleteDeck', { defaultValue: '刪除牌組' }),
                      icon: Trash2,
                      tone: 'danger',
                      onSelect: async () => {
                        if (
                          !(await confirm({
                            title: t('flashcards.deleteDeckTitle', {
                              defaultValue: '刪除牌組？',
                            }),
                            message: t('flashcards.deleteDeckMsg', {
                              name: d.name,
                              n: deckCards.length,
                              defaultValue: `「${d.name}」連同 ${deckCards.length} 張卡會一併刪除，無法復原。`,
                            }),
                            confirmText: t('flashcards.delete', { defaultValue: '刪除' }),
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
                        toast.success(
                          t('flashcards.deckDeleted', { defaultValue: '已刪除牌組' }),
                        )
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
                      {t('flashcards.dueN', { n: due, defaultValue: `到期 ${due}` })}
                    </Badge>
                  )}
                  {newToday > 0 && (
                    <Badge tone="blue" dot>
                      {t('flashcards.newN', { n: newToday, defaultValue: `新卡 ${newToday}` })}
                    </Badge>
                  )}
                </div>
              )}

              {/* 熟悉度進度 */}
              <div className="mt-3 flex-1">
                <div className="mb-1 flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500">
                  <span>{t('flashcards.familiarity', { defaultValue: '熟悉度' })}</span>
                  <span className="tabular-nums">{Math.round(matPct)}%</span>
                </div>
                <ProgressBar value={matPct} tone="green" size="sm" />
              </div>

              {/* 操作 */}
              <div className="mt-4 flex gap-2">
                <Button
                  onClick={() => (due > 0 ? onReview(d.id, 'srs') : setStudyFor(d.id))}
                  disabled={deckCards.length === 0}
                  size="sm"
                  icon={Play}
                  className="flex-1"
                >
                  {due > 0
                    ? t('flashcards.reviewN', { n: due, defaultValue: `複習 (${due})` })
                    : t('flashcards.startLearning', { defaultValue: '開始學習' })}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={Layers}
                  onClick={() => setStudyFor(d.id)}
                >
                  {t('flashcards.mode', { defaultValue: '模式' })}
                </Button>
              </div>
            </div>
          )
        })}

        {decks.length === 0 && (
          <div className="sm:col-span-2">
            <EmptyState
              icon={Layers}
              title={t('flashcards.emptyDecksTitle', {
                defaultValue: '開個牌組，由第一張卡開始',
              })}
              hint={t('flashcards.emptyDecksHint', {
                defaultValue:
                  '上面打個名就建立得；或者用「匯入」貼一批 CSV / JSON，一次過入晒。',
              })}
              action={
                <Button variant="secondary" icon={Upload} onClick={() => setIoOpen(true)}>
                  {t('flashcards.importExisting', { defaultValue: '匯入現有卡片' })}
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
  const { t } = useTranslation()
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
      title: t('flashcards.modeSrs', { defaultValue: '間隔重複' }),
      desc: t('flashcards.modeSrsDesc', { defaultValue: '標準複習，會更新排程' }),
      count: due,
      unit: t('flashcards.unitDue', { defaultValue: '張到期' }),
      recommended: due > 0,
    },
    {
      mode: 'typed',
      icon: NotebookPen,
      title: t('flashcards.modeTyped', { defaultValue: '打字作答' }),
      desc: t('flashcards.modeTypedDesc', { defaultValue: '打出答案，自動對比' }),
      count: due,
      unit: t('flashcards.unitDue', { defaultValue: '張到期' }),
    },
    {
      mode: 'cram',
      icon: Zap,
      title: t('flashcards.modeCram', { defaultValue: '衝刺' }),
      desc: t('flashcards.modeCramDesc', { defaultValue: '全部卡，唔影響排程' }),
      count: cards.length,
      unit: t('flashcards.unitAll', { defaultValue: '張全部' }),
    },
    {
      mode: 'starred',
      icon: Flame,
      title: t('flashcards.modeStarred', { defaultValue: '只溫已標記' }),
      desc: t('flashcards.modeStarredDesc', { defaultValue: '集中攻克紅旗卡' }),
      count: flagged,
      unit: t('flashcards.unitFlagged', { defaultValue: '張紅旗' }),
      disabled: flagged === 0,
    },
  ]

  return (
    <Modal
      open
      onClose={onClose}
      title={t('flashcards.pickModeTitle', { defaultValue: '揀練習模式' })}
      size="sm"
    >
      <p className="-mt-1 mb-3 text-xs text-slate-500 dark:text-slate-400">
        {t('flashcards.pickModeHint', {
          defaultValue: '想點樣翻呢疊卡？揀一個模式就開始。',
        })}
      </p>
      <div className="grid gap-2">
        {modes.map((m) => (
          <button
            key={m.mode}
            disabled={m.disabled}
            onClick={() => onPick(m.mode)}
            className={cx(
              'group flex items-center gap-3 rounded-xl border p-3 text-left transition hover:-translate-y-0.5 hover:border-accent hover:shadow-sm active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-none dark:hover:bg-accent/10',
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
                {m.recommended && (
                  <Badge tone="accent">
                    {t('flashcards.recommended', { defaultValue: '建議' })}
                  </Badge>
                )}
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
  const { t } = useTranslation()
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
    toast.success(t('flashcards.cardAdded', { defaultValue: '已加入卡片' }))
  }

  const saveRename = () => {
    const v = renameValue.trim()
    if (!v) return
    decksCol.update(deckId, { name: v })
    setRenameOpen(false)
    toast.success(t('flashcards.deckRenamed', { defaultValue: '已更新牌組名稱' }))
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={onBack}>
        {t('flashcards.backToDecks', { defaultValue: '返回所有牌組' })}
      </Button>

      <PageHeader
        icon={Layers}
        title={deck?.name ?? ''}
        description={
          due > 0
            ? t('flashcards.deckDescDue', {
                n: cards.length,
                d: due,
                defaultValue: `${cards.length} 張卡 · ${due} 張到期`,
              })
            : t('flashcards.deckDescTotal', {
                n: cards.length,
                defaultValue: `${cards.length} 張卡`,
              })
        }
        actions={
          <>
            <IconButton
              label={t('flashcards.rename', { defaultValue: '改名' })}
              onClick={() => {
                setRenameValue(deck?.name ?? '')
                setRenameOpen(true)
              }}
            >
              <Pencil size={16} />
            </IconButton>
            <IconButton
              label={t('flashcards.deckSettings', { defaultValue: '牌組設定' })}
              onClick={() => setSettingsOpen(true)}
            >
              <Settings2 size={16} />
            </IconButton>
            <Button
              variant="secondary"
              size="sm"
              icon={Zap}
              onClick={() => onReview('cram')}
              disabled={cards.length === 0}
            >
              {t('flashcards.cram', { defaultValue: '衝刺' })}
            </Button>
            <Button
              size="sm"
              icon={Play}
              onClick={() => onReview('srs')}
              disabled={due === 0}
            >
              {due > 0
                ? t('flashcards.reviewN', { n: due, defaultValue: `複習 (${due})` })
                : t('flashcards.review', { defaultValue: '複習' })}
            </Button>
          </>
        }
      />

      {/* 新增卡：accent-soft CTA 區（支援連續輸入；Q→A→⌘↵） */}
      <div className="space-y-2 rounded-2xl border border-accent/30 bg-accent-soft/40 p-4 dark:border-accent/40 dark:bg-accent/10">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-accent-strong dark:text-accent">
          <Plus size={14} /> {t('flashcards.writeNewCard', { defaultValue: '寫一張新卡' })}
        </div>
        <Input
          id="card-front"
          value={front}
          onChange={(e) => setFront(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') document.getElementById('card-back')?.focus()
          }}
          placeholder={t('flashcards.frontPlaceholder', { defaultValue: '正面（問題）' })}
          className="bg-white dark:bg-slate-800"
        />
        <Textarea
          id="card-back"
          value={back}
          onChange={(e) => setBack(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) add()
          }}
          placeholder={t('flashcards.backPlaceholder', { defaultValue: '背面（答案）' })}
          rows={2}
          className="bg-white dark:bg-slate-800"
        />
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500">
            <Kbd>⌘</Kbd>
            <Kbd>↵</Kbd> {t('flashcards.quickAdd', { defaultValue: '快速加' })}
          </span>
          <Button onClick={add} icon={Plus} size="sm">
            {t('flashcards.addCard', { defaultValue: '加入卡片' })}
          </Button>
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
                      <span className="mt-px shrink-0 text-[10px] font-semibold uppercase tracking-wide text-slate-300 dark:text-slate-600">
                        Q
                      </span>
                      {c.front}
                    </p>
                    <p className="mt-1 flex items-start gap-1.5 break-words text-sm text-slate-500 dark:text-slate-400">
                      <span className="mt-px shrink-0 text-[10px] font-semibold uppercase tracking-wide text-slate-300 dark:text-slate-600">
                        A
                      </span>
                      {c.back}
                    </p>
                    {meta.tags.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1 pl-4">
                        {meta.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded bg-slate-100 px-1.5 py-px text-[10px] text-slate-500 dark:bg-slate-700 dark:text-slate-300"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <IconButton
                      label={
                        meta.suspended
                          ? t('flashcards.unsuspend', { defaultValue: '解除暫停' })
                          : t('flashcards.suspend', { defaultValue: '暫停' })
                      }
                      size="sm"
                      active={meta.suspended}
                      onClick={() => upsertMeta(c.id, { suspended: !meta.suspended })}
                    >
                      <Ban size={14} />
                    </IconButton>
                    <IconButton
                      label={t('flashcards.delete', { defaultValue: '刪除' })}
                      size="sm"
                      tone="danger"
                      onClick={async () => {
                        if (
                          !(await confirm({
                            title: t('flashcards.deleteCardTitle', {
                              defaultValue: '刪除卡片？',
                            }),
                            message: t('flashcards.deleteCardMsg', {
                              defaultValue: '此卡片會被永久刪除，無法復原。',
                            }),
                            confirmText: t('flashcards.delete', { defaultValue: '刪除' }),
                            tone: 'danger',
                          }))
                        )
                          return
                        cardsCol.remove(c.id)
                        cardMetaCol.remove(c.id)
                        toast.success(
                          t('flashcards.cardDeleted', { defaultValue: '已刪除卡片' }),
                        )
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
                      {t('flashcards.nextLabel', { defaultValue: '下次' })}{' '}
                      {isDue(c)
                        ? t('flashcards.today', { defaultValue: '今日' })
                        : fmtInterval(c.intervalDays)}
                    </span>
                  )}
                  {leech && (
                    <Badge tone="rose">
                      {t('flashcards.leechBadge', {
                        n: meta.lapses,
                        defaultValue: `Leech · 答錯 ${meta.lapses} 次`,
                      })}
                    </Badge>
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
              title={t('flashcards.emptyCardsTitle', { defaultValue: '呢疊卡仲係空白' })}
              hint={t('flashcards.emptyCardsHint', {
                defaultValue:
                  '喺上面寫低正面同背面，撳「加入卡片」就有第一張。可以連續加，唔使逐張開。',
              })}
            />
          </li>
        )}
      </ul>

      {/* 改名 Modal */}
      <Modal
        open={renameOpen}
        onClose={() => setRenameOpen(false)}
        title={t('flashcards.renameDeckTitle', { defaultValue: '牌組改名' })}
        size="sm"
      >
        <div className="space-y-3">
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && saveRename()}
            placeholder={t('flashcards.deckNamePlaceholder', { defaultValue: '牌組名稱' })}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRenameOpen(false)}>
              {t('flashcards.cancel', { defaultValue: '取消' })}
            </Button>
            <Button onClick={saveRename}>
              {t('flashcards.save', { defaultValue: '儲存' })}
            </Button>
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
  const { t } = useTranslation()
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
    toast.success(t('flashcards.deckSettingsSaved', { defaultValue: '已更新牌組設定' }))
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('flashcards.deckSettings', { defaultValue: '牌組設定' })}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('flashcards.cancel', { defaultValue: '取消' })}
          </Button>
          <Button onClick={save}>{t('flashcards.save', { defaultValue: '儲存' })}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
            {t('flashcards.newPerDay', { defaultValue: '每日新卡上限' })}
          </label>
          <Input
            type="number"
            min={0}
            max={999}
            value={newPerDay}
            onChange={(e) => setNewPerDay(e.target.value)}
            aria-label={t('flashcards.newPerDay', { defaultValue: '每日新卡上限' })}
          />
          <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
            {t('flashcards.newPerDayHint', {
              defaultValue: '每次複習最多引入幾多張未學過嘅新卡（避免一下子太多）。',
            })}
          </p>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
            {t('flashcards.reviewOrder', { defaultValue: '複習順序' })}
          </label>
          <SegmentedControl
            value={order}
            onChange={setOrder}
            options={[
              { id: 'due', label: t('flashcards.orderDue', { defaultValue: '到期優先' }) },
              { id: 'added', label: t('flashcards.orderAdded', { defaultValue: '加入次序' }) },
              { id: 'random', label: t('flashcards.orderRandom', { defaultValue: '隨機' }) },
            ]}
          />
        </div>
      </div>
    </Modal>
  )
}
