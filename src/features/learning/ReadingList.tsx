import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ArrowDownUp,
  BarChart3,
  BookMarked,
  BookOpen,
  Bookmark,
  CheckSquare,
  Download,
  Flame,
  Library,
  LayoutGrid,
  Rows3,
  Plus,
  Search,
  Star,
  Target,
  Trash2,
  TrendingUp,
  Upload,
} from 'lucide-react'
import { useCollection } from '../../lib/store'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import { readingCol } from '../../data/collections'
import {
  Badge,
  Button,
  EmptyState,
  FeatureGuide,
  Field,
  IconButton,
  Input,
  Menu,
  Modal,
  PageHero,
  Pills,
  SegmentedControl,
  Select,
  cx,
} from '../../ui'
import {
  booksCol,
  challengeCol,
  FORMAT_LABEL,
  STATUS_LABEL,
  STATUS_ORDER,
  STATUS_TONE,
  type Book,
  type BookStatus,
} from './reading/types'
import {
  activityHeatmap,
  computeStats,
  download,
  exportJson,
  finishedInYear,
  monthlyFinished,
  parseImport,
  progressPct,
  readingPace,
  relativeLabel,
  thisYear,
  todayKey,
} from './reading/util'
import { BarChart, DonutChart, Heatmap, RatingBars, type DonutSlice } from './reading/Charts'
import { StarRating } from './reading/StarRating'
import BookModal from './reading/BookModal'

// ============================================================
//  閱讀庫（Goodreads / StoryGraph 級）
//  視圖：書庫(grid) / 清單(table) / 統計(dashboard)
// ============================================================

type MainView = 'library' | 'list' | 'stats'
type StatusFilter = 'all' | BookStatus
type SortKey = 'added' | 'title' | 'author' | 'rating' | 'progress'

const STATUS_DOT: Record<BookStatus, string> = {
  to_read: 'bg-slate-400',
  reading: 'bg-accent',
  done: 'bg-emerald-500',
  dnf: 'bg-amber-500',
}

// ── 跟 WorkDashboard 的語意 tone map（chip 底+icon / 數字字）──
type Tone = 'accent' | 'amber' | 'emerald' | 'violet' | 'sky' | 'rose'
const TONE: Record<Tone, { chip: string; val: string }> = {
  accent: { chip: 'bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent', val: 'text-accent' },
  amber: { chip: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300', val: 'text-amber-500' },
  emerald: { chip: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300', val: 'text-emerald-500' },
  violet: { chip: 'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300', val: 'text-violet-500' },
  sky: { chip: 'bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300', val: 'text-sky-500' },
  rose: { chip: 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300', val: 'text-rose-500' },
}

// 1×1 統計磚（跟 dashboard StatTile：圖示 chip + tabular-nums）。
// onClick 選填：可點先做 button，否則純展示卡（去 cursor/hover/active）。
function StatTile({
  label,
  value,
  unit,
  hint,
  icon: Icon,
  tone,
  onClick,
}: {
  label: string
  value: number | string
  unit?: string
  hint?: string
  icon: import('lucide-react').LucideIcon
  tone: Tone
  onClick?: () => void
}) {
  const tn = TONE[tone]
  const inner = (
    <>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-400 dark:text-slate-500">{label}</span>
        <span className={cx('flex h-11 w-11 items-center justify-center rounded-xl', tn.chip)}>
          <Icon size={18} />
        </span>
      </div>
      <div>
        <p className="flex items-baseline gap-1">
          <span className={cx('text-3xl font-semibold tabular-nums slashed-zero', tn.val)}>{value}</span>
          {unit && <span className="text-sm font-medium text-slate-400">{unit}</span>}
        </p>
        {hint && <p className="mt-0.5 truncate text-[11px] text-slate-400">{hint}</p>}
      </div>
    </>
  )
  if (!onClick) {
    return (
      <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-700/60 dark:bg-slate-800">
        {inner}
      </div>
    )
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex cursor-pointer flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-4 text-left transition duration-200 hover:border-slate-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.98] dark:border-slate-700/60 dark:bg-slate-800 dark:hover:border-slate-600"
    >
      {inner}
    </button>
  )
}

const SORT_OPTS: { value: SortKey; label: string }[] = [
  { value: 'added', label: '加入時間' },
  { value: 'title', label: '書名' },
  { value: 'author', label: '作者' },
  { value: 'rating', label: '評分' },
  { value: 'progress', label: '進度' },
]

export default function ReadingList() {
  const { t } = useTranslation()
  const books = useCollection(booksCol)
  const challenges = useCollection(challengeCol)
  const toast = useToast()
  const confirm = useConfirm()

  // ── 一次性：把舊 reading_items 遷移入新書庫 ──
  const migrated = useRef(false)
  useEffect(() => {
    if (migrated.current) return
    migrated.current = true
    const legacy = readingCol.get()
    if (booksCol.get().length === 0 && legacy.length > 0) {
      booksCol.set(
        legacy.map((l) => ({
          id: l.id,
          title: l.title,
          author: l.author,
          url: l.url,
          status: l.status as BookStatus,
          notes: l.notes,
          shelves: [],
          sessions: [],
          favorite: false,
          createdAt: l.createdAt,
        })),
      )
      toast.success(`已匯入 ${legacy.length} 本舊閱讀項目`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── 檢視狀態 ──
  const [view, setView] = useState<MainView>('library')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [shelfFilter, setShelfFilter] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('added')
  const [sortAsc, setSortAsc] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)

  // ── 批量選取 ──
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // ── 新增 modal ──
  const [addOpen, setAddOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const year = thisYear()
  const challenge = challenges.find((c) => c.year === year)
  const stats = useMemo(() => computeStats(books), [books])
  const finishedThisYearCount = useMemo(() => finishedInYear(books, year), [books, year])

  const allShelves = useMemo(() => {
    const set = new Set<string>()
    for (const b of books) for (const s of b.shelves) set.add(s)
    return [...set].sort()
  }, [books])

  const counts: Record<StatusFilter, number> = {
    all: books.length,
    to_read: stats.byStatus.to_read,
    reading: stats.byStatus.reading,
    done: stats.byStatus.done,
    dnf: stats.byStatus.dnf,
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const arr = books.filter((b) => {
      if (statusFilter !== 'all' && b.status !== statusFilter) return false
      if (shelfFilter && !b.shelves.includes(shelfFilter)) return false
      if (q) {
        const hay = `${b.title} ${b.author ?? ''} ${b.shelves.join(' ')}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
    const dir = sortAsc ? 1 : -1
    arr.sort((a, b) => {
      let r = 0
      switch (sortKey) {
        case 'title':
          r = a.title.localeCompare(b.title)
          break
        case 'author':
          r = (a.author ?? '').localeCompare(b.author ?? '')
          break
        case 'rating':
          r = (a.rating ?? 0) - (b.rating ?? 0)
          break
        case 'progress':
          r = progressPct(a) - progressPct(b)
          break
        default:
          r = a.createdAt.localeCompare(b.createdAt)
      }
      if (r === 0) r = a.createdAt.localeCompare(b.createdAt)
      return r * dir
    })
    return arr
  }, [books, statusFilter, shelfFilter, query, sortKey, sortAsc])

  const openBook = books.find((b) => b.id === openId) ?? null

  // ── 操作 ──
  function quickStatus(book: Book, status: BookStatus) {
    const p: Partial<Book> = { status }
    if (status === 'reading' && !book.startedOn) p.startedOn = todayKey()
    if (status === 'done') {
      p.finishedOn = book.finishedOn ?? todayKey()
      if (book.totalPages) p.currentPage = book.totalPages
    }
    booksCol.update(book.id, p)
  }

  function setChallenge(target: number) {
    if (challenge) challengeCol.update(challenge.id, { target })
    else challengeCol.add({ year, target })
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function exitSelect() {
    setSelectMode(false)
    setSelected(new Set())
  }

  async function bulkDelete() {
    if (selected.size === 0) return
    const ok = await confirm({
      title: `刪除 ${selected.size} 本書？`,
      message: '選取的書連同評分、筆記、閱讀記錄會被永久刪除。',
      confirmText: '刪除',
      tone: 'danger',
    })
    if (!ok) return
    booksCol.set(booksCol.get().filter((b) => !selected.has(b.id)))
    toast.success(`已刪除 ${selected.size} 本`)
    exitSelect()
  }

  function bulkStatus(status: BookStatus) {
    if (selected.size === 0) return
    booksCol.set(
      booksCol.get().map((b) => {
        if (!selected.has(b.id)) return b
        const p: Partial<Book> = { status }
        if (status === 'done') {
          p.finishedOn = b.finishedOn ?? todayKey()
          if (b.totalPages) p.currentPage = b.totalPages
        }
        if (status === 'reading' && !b.startedOn) p.startedOn = todayKey()
        return { ...b, ...p }
      }),
    )
    toast.success(`已標記 ${selected.size} 本為「${STATUS_LABEL[status]}」`)
    exitSelect()
  }

  function bulkShelf() {
    const name = window.prompt('加上書架 / 標籤名稱：')?.trim()
    if (!name) return
    booksCol.set(
      booksCol.get().map((b) =>
        selected.has(b.id) && !b.shelves.includes(name)
          ? { ...b, shelves: [...b.shelves, name] }
          : b,
      ),
    )
    toast.success(`已加標籤「${name}」`)
    exitSelect()
  }

  function doExport() {
    download(`reading-${todayKey()}.json`, exportJson(books))
    toast.success('已匯出 JSON')
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const parsed = parseImport(String(reader.result))
      if (!parsed) {
        toast.error('檔案格式不正確')
        return
      }
      const existing = new Set(booksCol.get().map((b) => b.id))
      const fresh = parsed.filter((b) => !existing.has(b.id))
      booksCol.set([...booksCol.get(), ...fresh])
      toast.success(`已匯入 ${fresh.length} 本（略過 ${parsed.length - fresh.length} 本重複）`)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div className="space-y-5">
      {/* ── Hero：統一共用 PageHero（accent hero） ── */}
      <PageHero
        guideKey="reading-list"
        icon={Library}
        kicker={t('reading.kicker', { defaultValue: 'Reading Log' })}
        title={t('reading.title', { defaultValue: '閱讀清單' })}
        description={
          stats.total > 0
            ? t('reading.subtitleHas', {
                n: stats.total,
                r: stats.byStatus.reading,
                defaultValue:
                  stats.byStatus.reading > 0
                    ? `書架上共 ${stats.total} 本 · 正在讀 ${stats.byStatus.reading} 本`
                    : `書架上共 ${stats.total} 本`,
              })
            : t('reading.subtitleEmpty', { defaultValue: '由第一本書開始，砌一個屬於你的書架。' })
        }
        actions={
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-white/15 px-3 text-sm font-medium backdrop-blur-sm transition hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            <Plus size={15} /> {t('reading.addBook', { defaultValue: '加書' })}
          </button>
        }
      />

      {/* ── 教學引導：教用家如何使用此功能（可摺疊 + 「知道了」永久收起） ── */}
      <FeatureGuide
        storageKey="reading-list"
        title={t('reading.guideTitle', { defaultValue: '閱讀清單使用說明' })}
        steps={[
          {
            title: t('reading.guideStep1Title', { defaultValue: '加入書本' }),
            desc: t('reading.guideStep1Desc', { defaultValue: '按右上角「加書」，填書名（作者、頁數選填）就上架。' }),
          },
          {
            title: t('reading.guideStep2Title', { defaultValue: '追蹤進度' }),
            desc: t('reading.guideStep2Desc', { defaultValue: '按開一本書，標「在讀／讀完」、評分、記低每次讀到第幾頁。' }),
          },
          {
            title: t('reading.guideStep3Title', { defaultValue: '定年度挑戰' }),
            desc: t('reading.guideStep3Desc', { defaultValue: '設定今年想讀幾多本，進度環會幫你查看住達標進度。' }),
          },
          {
            title: t('reading.guideStep4Title', { defaultValue: '查看統計' }),
            desc: t('reading.guideStep4Desc', { defaultValue: '切去「統計」分頁，查看每月完成、評分分佈同閱讀活動。' }),
          },
        ]}
      />

      {/* ── 四格藏書統計（跟 dashboard StatTile：tone chip + tabular-nums） ── */}
      <section>
        {/* 純中文 section 標題：跟 spec 不落 uppercase/tracking（避免字距散） */}
        <h2 className="mb-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
          {t('reading.overview', { defaultValue: '藏書概覽' })}
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            label={t('reading.statTotal', { defaultValue: '總藏書' })}
            value={stats.total}
            unit={t('reading.unitBooks', { defaultValue: '本' })}
            hint={t('reading.statTotalHint', { defaultValue: '書架上全部' })}
            icon={BookMarked}
            tone="accent"
          />
          <StatTile
            label={t('reading.statReading', { defaultValue: '在讀' })}
            value={stats.byStatus.reading}
            unit={t('reading.unitBooks', { defaultValue: '本' })}
            hint={
              stats.byStatus.to_read
                ? t('reading.statReadingHint', { n: stats.byStatus.to_read, defaultValue: `${stats.byStatus.to_read} 本排隊等讀` })
                : t('reading.statReadingHintEmpty', { defaultValue: '選擇本書翻開吧' })
            }
            icon={BookOpen}
            tone="violet"
          />
          <StatTile
            label={t('reading.statDoneYear', { y: year, defaultValue: `${year} 讀完` })}
            value={finishedThisYearCount}
            unit={t('reading.unitBooks', { defaultValue: '本' })}
            hint={t('reading.statDoneYearHint', { defaultValue: '今年完成' })}
            icon={CheckSquare}
            tone="emerald"
          />
          <StatTile
            label={t('reading.statAvgRating', { defaultValue: '平均評分' })}
            value={stats.avgRating ? stats.avgRating.toFixed(1) : '—'}
            hint={
              stats.rated
                ? t('reading.statAvgRatingHint', { n: stats.rated, defaultValue: `${stats.rated} 本已評` })
                : t('reading.statAvgRatingHintEmpty', { defaultValue: '未評分' })
            }
            icon={Star}
            tone="amber"
          />
        </div>
      </section>

      {/* ── 閱讀挑戰 ── */}
      <ReadingChallenge
        year={year}
        target={challenge?.target ?? 0}
        done={finishedThisYearCount}
        onSet={setChallenge}
      />

      {/* ── 工具列 ── */}
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedControl<MainView>
          options={[
            { id: 'library', label: t('reading.viewCover', { defaultValue: '封面' }), icon: LayoutGrid },
            { id: 'list', label: t('reading.viewList', { defaultValue: '清單' }), icon: Rows3 },
            { id: 'stats', label: t('reading.viewStats', { defaultValue: '統計' }), icon: BarChart3 },
          ]}
          value={view}
          onChange={setView}
        />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {view !== 'stats' && (
            <>
              <Button
                size="sm"
                variant={selectMode ? 'primary' : 'secondary'}
                icon={CheckSquare}
                onClick={() => (selectMode ? exitSelect() : setSelectMode(true))}
              >
                {selectMode ? t('reading.cancelSelect', { defaultValue: '取消選取' }) : t('reading.select', { defaultValue: '選取' })}
              </Button>
              <Menu
                align="end"
                trigger={
                  <span className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition hover:bg-slate-50 active:scale-[0.98] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
                    <Download size={15} /> {t('reading.importExport', { defaultValue: '匯出入' })}
                  </span>
                }
                items={[
                  { id: 'export', label: t('reading.exportJson', { defaultValue: '匯出 JSON' }), icon: Download, onSelect: doExport },
                  { id: 'import', label: t('reading.importJson', { defaultValue: '匯入 JSON' }), icon: Upload, onSelect: () => fileRef.current?.click() },
                ]}
              />
            </>
          )}
        </div>
        <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={onPickFile} />
      </div>

      {/* ── 批量操作條 ── */}
      {selectMode && view !== 'stats' && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-accent/30 bg-accent-soft px-3 py-2 dark:border-accent/40 dark:bg-accent/15">
          <span className="text-sm font-medium text-accent-strong dark:text-accent">
            {t('reading.selectedN', { n: selected.size, defaultValue: `已選 ${selected.size} 本` })}
          </span>
          <div className="ml-auto flex flex-wrap gap-1.5">
            <Button size="sm" variant="secondary" onClick={() => bulkStatus('reading')}>
              {t('reading.markReading', { defaultValue: '標在讀' })}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => bulkStatus('done')}>
              {t('reading.markDone', { defaultValue: '標讀完' })}
            </Button>
            <Button size="sm" variant="secondary" onClick={bulkShelf}>
              {t('reading.addTag', { defaultValue: '加標籤' })}
            </Button>
            <Button size="sm" variant="danger" icon={Trash2} onClick={bulkDelete} disabled={selected.size === 0}>
              {t('reading.delete', { defaultValue: '刪除' })}
            </Button>
          </div>
        </div>
      )}

      {/* ── 統計視圖 ── */}
      {view === 'stats' ? (
        <StatsView books={books} stats={stats} />
      ) : (
        <>
          {/* 篩選 + 搜尋 + 排序 */}
          <div className="space-y-3">
            <Pills<StatusFilter>
              options={[
                { id: 'all', label: t('reading.filterAll', { defaultValue: '全部' }) },
                { id: 'to_read', label: STATUS_LABEL.to_read },
                { id: 'reading', label: STATUS_LABEL.reading },
                { id: 'done', label: STATUS_LABEL.done },
                { id: 'dnf', label: STATUS_LABEL.dnf },
              ]}
              active={statusFilter}
              onChange={setStatusFilter}
              counts={counts}
            />

            {allShelves.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                  {t('reading.shelfLabel', { defaultValue: '書架' })}
                </span>
                <button
                  type="button"
                  onClick={() => setShelfFilter(null)}
                  aria-pressed={!shelfFilter}
                  className={cx(
                    'inline-flex min-h-11 items-center rounded-full px-3 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.98]',
                    !shelfFilter
                      ? 'bg-accent text-white'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700',
                  )}
                >
                  {t('reading.filterAll', { defaultValue: '全部' })}
                </button>
                {allShelves.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setShelfFilter(shelfFilter === s ? null : s)}
                    aria-pressed={shelfFilter === s}
                    className={cx(
                      'inline-flex min-h-11 items-center rounded-full px-3 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.98]',
                      shelfFilter === s
                        ? 'bg-accent text-white'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700',
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Input
                icon={Search}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('reading.searchPlaceholder', { defaultValue: '搜尋書名、作者、書架…' })}
                className="min-w-[12rem] flex-1"
                aria-label={t('reading.searchAria', { defaultValue: '搜尋書本' })}
              />
              <Select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} className="w-auto">
                {SORT_OPTS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
              <IconButton
                label={sortAsc ? t('reading.sortDesc', { defaultValue: '切換為降序' }) : t('reading.sortAsc', { defaultValue: '切換為升序' })}
                onClick={() => setSortAsc((v) => !v)}
                active={sortAsc}
              >
                <ArrowDownUp size={18} />
              </IconButton>
            </div>
          </div>

          {/* 篩選結果數（螢幕閱讀器即時播報） */}
          <p role="status" aria-live="polite" className="sr-only">
            {query.trim() || shelfFilter || statusFilter !== 'all'
              ? t('reading.matchN', { n: filtered.length, defaultValue: `${filtered.length} 本符合篩選` })
              : t('reading.totalN', { n: filtered.length, defaultValue: `共 ${filtered.length} 本` })}
          </p>

          {/* 清單 / 書庫 */}
          {filtered.length === 0 ? (
            <EmptyState
              icon={query.trim() || shelfFilter ? Search : BookMarked}
              title={
                query.trim() || shelfFilter
                  ? t('reading.emptyFilterTitle', { defaultValue: '搜尋不到符合的書' })
                  : t('reading.emptyTitle', { defaultValue: '書架尚未有書' })
              }
              hint={
                query.trim() || shelfFilter
                  ? t('reading.emptyFilterHint', { defaultValue: '換個關鍵字，或者清除篩選再查看查看。' })
                  : t('reading.emptyHint', { defaultValue: '加入第一本書，開始追蹤閱讀進度。' })
              }
              action={
                !query.trim() && !shelfFilter ? (
                  <Button size="sm" icon={Plus} onClick={() => setAddOpen(true)}>
                    {t('reading.addFirstBook', { defaultValue: '加入第一本書' })}
                  </Button>
                ) : undefined
              }
            />
          ) : view === 'library' ? (
            <LibraryGrid
              books={filtered}
              selectMode={selectMode}
              selected={selected}
              onToggleSelect={toggleSelect}
              onOpen={(id) => setOpenId(id)}
              onQuickStatus={quickStatus}
              grouped={statusFilter === 'all' && !shelfFilter && !query.trim() && sortKey === 'added'}
            />
          ) : (
            <ListView
              books={filtered}
              selectMode={selectMode}
              selected={selected}
              onToggleSelect={toggleSelect}
              onOpen={(id) => setOpenId(id)}
              grouped={statusFilter === 'all' && !shelfFilter && !query.trim()}
            />
          )}
        </>
      )}

      {/* ── Modals ── */}
      {addOpen && (
        <AddBookModal
          onClose={() => setAddOpen(false)}
          onAdded={(id) => {
            setAddOpen(false)
            setOpenId(id)
          }}
        />
      )}
      {openBook && (
        <BookModal book={openBook} allShelves={allShelves} onClose={() => setOpenId(null)} />
      )}
    </div>
  )
}

// ============================================================
//  閱讀挑戰（年度目標 + 進度環）
// ============================================================
function ReadingChallenge({
  year,
  target,
  done,
  onSet,
}: {
  year: number
  target: number
  done: number
  onSet: (n: number) => void
}) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(target || 12))
  const pct = target > 0 ? Math.min(100, Math.round((done / target) * 100)) : 0

  // 未設目標：CTA 磚（跟 dashboard 虛邊 accent CTA 規律）
  if (target <= 0 && !editing) {
    return (
      <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-accent/40 bg-accent-soft/50 p-4 dark:border-accent/40 dark:bg-accent/10">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-white">
          <Target size={19} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-accent-strong dark:text-accent">
            {t('reading.challengeSetTitle', { y: year, defaultValue: `定個 ${year} 年閱讀挑戰` })}
          </p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {t('reading.challengeSetHint', { defaultValue: '立個小目標，查看住自己今年讀完幾多本。' })}
          </p>
        </div>
        <Button size="sm" onClick={() => setEditing(true)}>
          {t('reading.challengeSetCta', { defaultValue: '設定目標' })}
        </Button>
      </section>
    )
  }

  const R = 26
  const C = 2 * Math.PI * R
  const reached = done >= target

  return (
    <section className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-700/60 dark:bg-slate-800 sm:p-5">
      <div className="relative h-[68px] w-[68px] shrink-0">
        <svg viewBox="0 0 68 68" className="-rotate-90">
          <circle cx="34" cy="34" r={R} fill="none" strokeWidth="7" className="stroke-slate-100 dark:stroke-slate-700/60" />
          <circle
            cx="34"
            cy="34"
            r={R}
            fill="none"
            strokeWidth="7"
            strokeLinecap="round"
            className={cx('transition-all duration-700', reached ? 'stroke-emerald-500' : 'stroke-accent')}
            strokeDasharray={C}
            strokeDashoffset={C * (1 - pct / 100)}
          />
        </svg>
        <div className={cx('absolute inset-0 flex items-center justify-center text-sm font-semibold tabular-nums', reached ? 'text-emerald-500' : 'text-accent')}>
          {pct}%
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
          <Target size={15} className="text-accent" /> {t('reading.challengeTitle', { y: year, defaultValue: `${year} 年閱讀挑戰` })}
        </p>
        {editing ? (
          <div className="mt-1.5 flex items-center gap-2">
            <Input
              type="number"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="w-20 tabular-nums"
              autoFocus
            />
            <span className="text-xs text-slate-400">{t('reading.unitBooks', { defaultValue: '本' })}</span>
            <Button
              size="sm"
              onClick={() => {
                onSet(Math.max(1, Math.round(Number(draft) || 1)))
                setEditing(false)
              }}
            >
              {t('reading.save', { defaultValue: '儲存' })}
            </Button>
          </div>
        ) : (
          <>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {t('reading.challengeDone', { d: done, n: target, defaultValue: `已讀 ${done} / ${target} 本` })}
              {done >= target ? (
                <span className="ml-1.5 font-medium text-emerald-500">{t('reading.challengeReached', { defaultValue: '已達標 🎉' })}</span>
              ) : (
                <span className="ml-1.5">{t('reading.challengeRemain', { n: target - done, defaultValue: `還差 ${target - done} 本` })}</span>
              )}
            </p>
            <button
              type="button"
              onClick={() => {
                setDraft(String(target))
                setEditing(true)
              }}
              className="mt-0.5 rounded-lg text-xs font-medium text-accent transition hover:text-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.98]"
            >
              {t('reading.challengeAdjust', { defaultValue: '調整目標' })}
            </button>
          </>
        )}
      </div>
    </section>
  )
}

// ============================================================
//  書庫（封面 grid）
// ============================================================
function BookCoverCard({
  b,
  selectMode,
  selected,
  onToggleSelect,
  onOpen,
  onQuickStatus,
}: {
  b: Book
  selectMode: boolean
  selected: Set<string>
  onToggleSelect: (id: string) => void
  onOpen: (id: string) => void
  onQuickStatus: (book: Book, status: BookStatus) => void
}) {
  const { t } = useTranslation()
  const pct = progressPct(b)
  const pace = readingPace(b)
  const sel = selected.has(b.id)
  return (
    <button
      type="button"
      onClick={() => (selectMode ? onToggleSelect(b.id) : onOpen(b.id))}
      className={cx(
        'group flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white text-left transition duration-200 hover:border-slate-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.98] dark:border-slate-700/60 dark:bg-slate-800 dark:hover:border-slate-600',
        sel && 'ring-2 ring-accent',
      )}
    >
      {/* 封面（書脊邊 + 在讀書籤緞帶） */}
      <div className="relative aspect-[2/3] overflow-hidden bg-gradient-to-br from-accent-soft to-slate-100 dark:from-accent/15 dark:to-slate-800">
        {b.cover ? (
          <img src={b.cover} alt={b.title} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center p-3 text-center">
            <BookOpen size={28} className="text-accent/70" />
            <span className="mt-2 line-clamp-4 text-xs font-semibold text-slate-600 dark:text-slate-300">
              {b.title}
            </span>
          </div>
        )}
        {/* 左側書脊高光：營造立體書本邊 */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-2 bg-gradient-to-r from-black/15 via-black/5 to-transparent dark:from-black/35"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-1.5 w-px bg-white/30 dark:bg-white/10"
        />
        {/* 狀態圓點 */}
        <span
          className={cx(
            'absolute left-3 top-2 h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-slate-900',
            STATUS_DOT[b.status],
          )}
          title={STATUS_LABEL[b.status]}
        />
        {b.favorite && (
          <span className="absolute right-2 top-2 text-amber-400 drop-shadow">
            <Star size={15} fill="currentColor" />
          </span>
        )}
        {/* 在讀書籤緞帶：由頂部垂落，長度＝進度（書脊式語彙的核心） */}
        {b.status === 'reading' && pct > 0 && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-0 right-3 w-2.5 bg-accent shadow-sm transition-[height] duration-500 ease-out after:absolute after:inset-x-0 after:top-full after:border-x-[5px] after:border-t-[5px] after:border-x-transparent after:border-t-accent"
            style={{ height: `${20 + pct * 0.5}%` }}
          />
        )}
        {selectMode && (
          <span
            className={cx(
              'absolute right-2 bottom-2 flex h-5 w-5 items-center justify-center rounded-md border-2 transition-colors',
              sel
                ? 'border-accent bg-accent text-white'
                : 'border-white bg-black/20 text-transparent',
            )}
          >
            <CheckSquare size={12} />
          </span>
        )}
        {/* 已讀完角標：絲帶角 */}
        {b.status === 'done' && (
          <span
            aria-hidden="true"
            title={STATUS_LABEL.done}
            className="absolute -right-px -top-px h-0 w-0 border-b-[24px] border-l-[24px] border-b-emerald-500 border-l-transparent drop-shadow-sm"
          />
        )}
      </div>

      {/* 資料 */}
      <div className="flex flex-1 flex-col p-3">
        <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{b.title}</p>
        {b.author && (
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">{b.author}</p>
        )}
        <div className="mt-1.5 flex items-center justify-between">
          {b.rating ? (
            <StarRating value={b.rating} size={13} readOnly />
          ) : b.status === 'reading' && pct > 0 ? (
            <span className="text-[11px] font-medium tabular-nums text-accent">{t('reading.readPct', { p: pct, defaultValue: `已讀 ${pct}%` })}</span>
          ) : (
            <span className="text-[11px] text-slate-400 dark:text-slate-500">{t('reading.unrated', { defaultValue: '未評分' })}</span>
          )}
        </div>

        {/* hover 顯示閱讀步速 + 預計讀完（只在「在讀」且資料齊全時） */}
        {!selectMode && pace && (
          <p className="mt-1.5 hidden items-center gap-1 text-[10px] leading-tight text-slate-500 group-hover:flex dark:text-slate-400">
            <TrendingUp size={11} className="shrink-0 text-accent" />
            <span className="truncate">
              {t('reading.pace', {
                p: Math.round(pace.pagesPerDay),
                eta: relativeLabel(pace.etaKey),
                defaultValue: `每日 ${Math.round(pace.pagesPerDay)} 頁 · ${relativeLabel(pace.etaKey)}讀完`,
              })}
            </span>
          </p>
        )}

        {/* hover 快速切換（非選取模式） */}
        {!selectMode && (
          <div className="mt-2 hidden grid-cols-2 gap-1.5 group-hover:grid">
            {b.status !== 'reading' && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation()
                  onQuickStatus(b, 'reading')
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    e.stopPropagation()
                    onQuickStatus(b, 'reading')
                  }
                }}
                className="flex min-h-11 items-center justify-center rounded-lg bg-accent-soft px-2 text-center text-[11px] font-medium text-accent-strong transition-colors hover:bg-accent hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.98] dark:bg-accent/15 dark:text-accent"
              >
                {t('reading.quickReading', { defaultValue: '在讀' })}
              </span>
            )}
            {b.status !== 'done' && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation()
                  onQuickStatus(b, 'done')
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    e.stopPropagation()
                    onQuickStatus(b, 'done')
                  }
                }}
                className="flex min-h-11 items-center justify-center rounded-lg bg-emerald-50 px-2 text-center text-[11px] font-medium text-emerald-700 transition-colors hover:bg-emerald-500 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 active:scale-[0.98] dark:bg-emerald-500/10 dark:text-emerald-300"
              >
                {t('reading.quickDone', { defaultValue: '讀完' })}
              </span>
            )}
          </div>
        )}
      </div>
    </button>
  )
}

function LibraryGrid({
  books,
  selectMode,
  selected,
  onToggleSelect,
  onOpen,
  onQuickStatus,
  grouped,
}: {
  books: Book[]
  selectMode: boolean
  selected: Set<string>
  onToggleSelect: (id: string) => void
  onOpen: (id: string) => void
  onQuickStatus: (book: Book, status: BookStatus) => void
  grouped: boolean
}) {
  const cardProps = { selectMode, selected, onToggleSelect, onOpen, onQuickStatus }
  const gridCls = 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'

  // 篩選 / 排序時退為單一網格；預設按狀態分組（想讀 → 在讀 → 讀完 → 棄讀），每組一個色調標頭。
  if (!grouped) {
    return (
      <div className={gridCls}>
        {books.map((b) => (
          <BookCoverCard key={b.id} b={b} {...cardProps} />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {STATUS_ORDER.map((st) => {
        const group = books.filter((b) => b.status === st)
        if (group.length === 0) return null
        return (
          <section key={st}>
            <div className="mb-3 flex items-center gap-2">
              <Badge tone={STATUS_TONE[st]} dot>
                {STATUS_LABEL[st]}
              </Badge>
              <span className="text-xs font-medium tabular-nums text-slate-400">{group.length}</span>
            </div>
            <div className={gridCls}>
              {group.map((b) => (
                <BookCoverCard key={b.id} b={b} {...cardProps} />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

// ============================================================
//  清單視圖（list rows）—— 跟 dashboard 列項規律
//  ------------------------------------------------------------
//  · 每本書一行：狀態色點 + 書名/作者 + 評分或進度
//  · 按一行＝開書 / 選取模式下＝選取（功能同原本一致）
//  · 純資料行，刪走立體書脊／木架等花巧裝飾，查看得更清楚
// ============================================================

function BookRow({
  b,
  selectMode,
  selected,
  onToggleSelect,
  onOpen,
}: {
  b: Book
  selectMode: boolean
  selected: Set<string>
  onToggleSelect: (id: string) => void
  onOpen: (id: string) => void
}) {
  const { t } = useTranslation()
  const pct = progressPct(b)
  const sel = selected.has(b.id)
  return (
    <button
      type="button"
      onClick={() => (selectMode ? onToggleSelect(b.id) : onOpen(b.id))}
      aria-label={b.title}
      className={cx(
        'group flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.99] dark:hover:bg-slate-800/60',
        sel && 'bg-accent-soft dark:bg-accent/15',
      )}
    >
      {/* 選取勾 / 狀態色點 */}
      {selectMode ? (
        <span
          className={cx(
            'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
            sel ? 'border-accent bg-accent text-white' : 'border-slate-300 text-transparent dark:border-slate-600',
          )}
        >
          <CheckSquare size={10} />
        </span>
      ) : (
        <span className={cx('h-2 w-2 shrink-0 rounded-full', STATUS_DOT[b.status])} title={STATUS_LABEL[b.status]} />
      )}

      {/* 書名 + 作者 */}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          {b.favorite && <Star size={12} className="shrink-0 text-amber-400" fill="currentColor" />}
          <span className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">{b.title}</span>
        </span>
        {b.author && (
          <span className="block truncate text-[11px] text-slate-400 dark:text-slate-500">{b.author}</span>
        )}
      </span>

      {/* 評分 / 進度 */}
      <span className="shrink-0 text-right">
        {b.rating ? (
          <span className="inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums text-amber-500">
            {b.rating.toFixed(1)}
            <Star size={11} fill="currentColor" />
          </span>
        ) : b.status === 'reading' && pct > 0 ? (
          <span className="text-xs font-medium tabular-nums text-accent">{t('reading.readPct', { p: pct, defaultValue: `已讀 ${pct}%` })}</span>
        ) : null}
      </span>
    </button>
  )
}

function ListView({
  books,
  selectMode,
  selected,
  onToggleSelect,
  onOpen,
  grouped,
}: {
  books: Book[]
  selectMode: boolean
  selected: Set<string>
  onToggleSelect: (id: string) => void
  onOpen: (id: string) => void
  grouped: boolean
}) {
  const { t } = useTranslation()
  const rowProps = { selectMode, selected, onToggleSelect, onOpen }

  // 純展示卡（不可點），列項用 divide 分隔
  if (!grouped) {
    return (
      <div className="rounded-2xl border border-slate-200/80 bg-white p-2 dark:border-slate-700/60 dark:bg-slate-800">
        <div className="divide-y divide-slate-200/70 dark:divide-slate-700/60">
          {books.map((b) => (
            <BookRow key={b.id} b={b} {...rowProps} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 rounded-2xl border border-slate-200/80 bg-white p-3 dark:border-slate-700/60 dark:bg-slate-800 sm:p-4">
      {STATUS_ORDER.map((st) => {
        const group = books.filter((b) => b.status === st)
        if (group.length === 0) return null
        return (
          <section key={st}>
            <div className="mb-1.5 flex items-center gap-2 px-1">
              <Badge tone={STATUS_TONE[st]} dot>
                {STATUS_LABEL[st]}
              </Badge>
              <span className="text-xs font-medium tabular-nums text-slate-400">
                {t('reading.countBooks', { n: group.length, defaultValue: `${group.length} 本` })}
              </span>
            </div>
            <div className="divide-y divide-slate-200/70 dark:divide-slate-700/60">
              {group.map((b) => (
                <BookRow key={b.id} b={b} {...rowProps} />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

// ============================================================
//  統計儀表板（自製圖表）—— 跟 dashboard 純展示卡
// ============================================================

// 純展示卡：rounded-2xl 半透明邊框，標頭跟卡內小標頭規律（icon + slate-500 標題）
function CatalogueCard({
  title,
  icon: I,
  description,
  right,
  children,
}: {
  title: string
  icon?: import('lucide-react').LucideIcon
  description?: string
  right?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-700/60 dark:bg-slate-800 sm:p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
            {I && <I size={14} className="text-accent" />}
            {title}
          </h3>
          {description && (
            <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{description}</p>
          )}
        </div>
        {right}
      </div>
      {children}
    </div>
  )
}

function StatsView({ books, stats }: { books: Book[]; stats: ReturnType<typeof computeStats> }) {
  const { t } = useTranslation()
  const monthly = useMemo(() => monthlyFinished(books, 12), [books])
  const heat = useMemo(() => activityHeatmap(books, 18), [books])

  const statusSlices: DonutSlice[] = [
    { label: STATUS_LABEL.to_read, value: stats.byStatus.to_read, className: 'text-slate-400' },
    { label: STATUS_LABEL.reading, value: stats.byStatus.reading, className: 'text-accent' },
    { label: STATUS_LABEL.done, value: stats.byStatus.done, className: 'text-emerald-500' },
    { label: STATUS_LABEL.dnf, value: stats.byStatus.dnf, className: 'text-amber-500' },
  ]

  const formatSlices: DonutSlice[] = stats.byFormat.map((f, i) => ({
    label: FORMAT_LABEL[f.format],
    value: f.count,
    className: ['text-accent', 'text-violet-500', 'text-cyan-500'][i] ?? 'text-slate-400',
  }))

  const totalHours = Math.round(stats.totalMinutes / 60)

  if (books.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title={t('reading.statsEmptyTitle', { defaultValue: '尚未有閱讀紀錄' })}
        hint={t('reading.statsEmptyHint', { defaultValue: '加幾本書、記低閱讀時段，這裡就會長出你的閱讀軌跡同趨勢。' })}
      />
    )
  }

  const completionRate = stats.total ? Math.round((stats.byStatus.done / stats.total) * 100) : 0

  return (
    <div className="space-y-4">
      {/* KPI 列：跟 dashboard StatTile 純展示磚 */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label={t('reading.kpiPages', { defaultValue: '累計頁數' })}
          value={stats.totalPagesAll.toLocaleString()}
          unit={t('reading.unitPages', { defaultValue: '頁' })}
          hint={t('reading.kpiPagesHint', { defaultValue: '讀過的總頁數' })}
          icon={BookOpen}
          tone="accent"
        />
        <StatTile
          label={t('reading.kpiHours', { defaultValue: '閱讀時數' })}
          value={totalHours}
          unit={t('reading.unitHours', { defaultValue: '小時' })}
          hint={t('reading.kpiHoursHint', { n: stats.totalMinutes, defaultValue: `${stats.totalMinutes} 分鐘` })}
          icon={BarChart3}
          tone="sky"
        />
        <StatTile
          label={t('reading.kpiStreak', { defaultValue: '最長連續' })}
          value={stats.longestStreak}
          unit={t('reading.unitDays', { defaultValue: '日' })}
          hint={stats.currentStreak ? t('reading.kpiStreakHint', { n: stats.currentStreak, defaultValue: `目前 ${stats.currentStreak} 日` }) : t('reading.kpiStreakHintEmpty', { defaultValue: '未連續' })}
          icon={Flame}
          tone="amber"
        />
        <StatTile
          label={t('reading.kpiCompletion', { defaultValue: '完成率' })}
          value={completionRate}
          unit="%"
          hint={t('reading.kpiCompletionHint', { n: stats.byStatus.done, defaultValue: `讀完 ${stats.byStatus.done} 本` })}
          icon={CheckSquare}
          tone="emerald"
        />
      </div>

      {/* 每月讀完 */}
      <CatalogueCard
        title={t('reading.chartMonthly', { defaultValue: '每月完成' })}
        icon={BarChart3}
        description={t('reading.chartMonthlyDesc', { defaultValue: '過去 12 個月讀完本數（hover 查看頁數）' })}
      >
        <BarChart data={monthly} />
      </CatalogueCard>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* 狀態佔比 */}
        <CatalogueCard title={t('reading.chartStatus', { defaultValue: '狀態分佈' })} icon={Library}>
          <DonutChart slices={statusSlices} centerTop={String(stats.total)} centerBottom={t('reading.unitBooks', { defaultValue: '本' })} />
        </CatalogueCard>

        {/* 評分分佈 */}
        <CatalogueCard
          title={t('reading.chartRating', { defaultValue: '評分分佈' })}
          icon={Star}
          right={
            <span className="text-xs tabular-nums text-slate-400">
              {t('reading.avgLabel', { defaultValue: '平均' })} <span className="font-semibold text-amber-500">{stats.avgRating.toFixed(1)}</span>
            </span>
          }
        >
          {stats.rated > 0 ? (
            <RatingBars dist={stats.ratingDist} />
          ) : (
            <p className="py-6 text-center text-sm text-slate-400">{t('reading.noRatingYet', { defaultValue: '尚未有評分' })}</p>
          )}
        </CatalogueCard>

        {/* 格式佔比 */}
        <CatalogueCard title={t('reading.chartFormat', { defaultValue: '閱讀格式' })} icon={BookOpen}>
          {formatSlices.some((s) => s.value > 0) ? (
            <DonutChart
              slices={formatSlices}
              centerTop={String(stats.byFormat.reduce((s, f) => s + f.count, 0))}
              centerBottom={t('reading.unitBooks', { defaultValue: '本' })}
            />
          ) : (
            <p className="py-6 text-center text-sm text-slate-400">{t('reading.noFormatYet', { defaultValue: '尚未標格式' })}</p>
          )}
        </CatalogueCard>

        {/* 熱門書架 */}
        <CatalogueCard title={t('reading.chartShelves', { defaultValue: '熱門書架' })} icon={Bookmark}>
          {stats.topShelves.length > 0 ? (
            <div className="space-y-2">
              {stats.topShelves.map((s) => {
                const max = stats.topShelves[0].count || 1
                return (
                  <div key={s.name} className="flex items-center gap-2 text-xs">
                    <span className="w-20 truncate text-slate-600 dark:text-slate-300">{s.name}</span>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700/60">
                      <div
                        className="h-full rounded-full bg-accent transition-all duration-500"
                        style={{ width: `${(s.count / max) * 100}%` }}
                      />
                    </div>
                    <span className="w-6 text-right tabular-nums text-slate-500">{s.count}</span>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-slate-400">{t('reading.noShelfYet', { defaultValue: '尚未有書架標籤' })}</p>
          )}
        </CatalogueCard>
      </div>

      {/* 活動熱圖 */}
      <CatalogueCard
        title={t('reading.chartActivity', { defaultValue: '閱讀活動' })}
        icon={Flame}
        description={t('reading.chartActivityDesc', { defaultValue: '每日閱讀活動（過去約 4 個月）' })}
      >
        <Heatmap cols={heat} />
      </CatalogueCard>
    </div>
  )
}

// ============================================================
//  新增書本 modal
// ============================================================
function AddBookModal({
  onClose,
  onAdded,
}: {
  onClose: () => void
  onAdded: (id: string) => void
}) {
  const { t } = useTranslation()
  const toast = useToast()
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [totalPages, setTotalPages] = useState('')
  const [status, setStatus] = useState<BookStatus>('to_read')

  function submit() {
    const trimmed = title.trim()
    if (!trimmed) return
    const created = booksCol.add({
      title: trimmed,
      author: author.trim() || undefined,
      status,
      totalPages: totalPages ? Math.max(0, Math.round(Number(totalPages))) : undefined,
      shelves: [],
      sessions: [],
      favorite: false,
      startedOn: status === 'reading' ? todayKey() : undefined,
      finishedOn: status === 'done' ? todayKey() : undefined,
      createdAt: new Date().toISOString(),
    })
    toast.success(t('reading.addedToast', { defaultValue: '已加入書架' }))
    onAdded(created.id)
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t('reading.addModalTitle', { defaultValue: '加入一本書' })}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('reading.cancel', { defaultValue: '取消' })}
          </Button>
          <Button onClick={submit} disabled={!title.trim()} icon={Plus}>
            {t('reading.add', { defaultValue: '加入' })}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label={t('reading.fieldTitle', { defaultValue: '書名' })} required>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('reading.fieldTitlePlaceholder', { defaultValue: '例如：原則 Principles' })}
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('reading.fieldAuthor', { defaultValue: '作者' })}>
            <Input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Ray Dalio" />
          </Field>
          <Field label={t('reading.fieldPages', { defaultValue: '總頁數' })}>
            <Input
              type="number"
              value={totalPages}
              onChange={(e) => setTotalPages(e.target.value)}
              placeholder={t('reading.fieldPagesPlaceholder', { defaultValue: '例如：592' })}
              className="tabular-nums"
            />
          </Field>
        </div>
        <Field label={t('reading.fieldStatus', { defaultValue: '狀態' })}>
          <div className="flex flex-wrap gap-1.5">
            {(['to_read', 'reading', 'done'] as BookStatus[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={cx(
                  'inline-flex min-h-11 items-center rounded-lg border px-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.98]',
                  status === s
                    ? 'border-accent bg-accent text-white'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800',
                )}
              >
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        </Field>
        <p className="text-xs text-slate-400 dark:text-slate-500">
          {t('reading.addModalHint', { defaultValue: '加入後可以在詳情頁加封面、評分、書架標籤，還可以記低每次閱讀進度。' })}
        </p>
      </div>
    </Modal>
  )
}
