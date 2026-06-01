import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDownUp,
  BarChart3,
  BookMarked,
  BookOpen,
  CheckSquare,
  Download,
  Flame,
  LayoutGrid,
  List,
  Plus,
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
  Card,
  EmptyState,
  Field,
  IconButton,
  Input,
  Menu,
  Modal,
  Pills,
  ProgressBar,
  SectionTitle,
  SegmentedControl,
  Select,
  StatCard,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
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

const SORT_OPTS: { value: SortKey; label: string }[] = [
  { value: 'added', label: '加入時間' },
  { value: 'title', label: '書名' },
  { value: 'author', label: '作者' },
  { value: 'rating', label: '評分' },
  { value: 'progress', label: '進度' },
]

export default function ReadingList() {
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
      message: '選取嘅書連同評分、筆記、閱讀記錄會被永久刪除。',
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
        toast.error('檔案格式唔啱')
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
      {/* ── 頂部統計 ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="總藏書" value={stats.total} unit="本" icon={BookMarked} highlight />
        <StatCard
          label="在讀"
          value={stats.byStatus.reading}
          unit="本"
          icon={BookOpen}
          hint={stats.byStatus.to_read ? `${stats.byStatus.to_read} 本待讀` : undefined}
        />
        <StatCard
          label="今年讀完"
          value={finishedThisYearCount}
          unit="本"
          icon={CheckSquare}
        />
        <StatCard
          label="平均評分"
          value={stats.avgRating ? stats.avgRating.toFixed(1) : '—'}
          icon={Star}
          hint={stats.rated ? `${stats.rated} 本已評` : undefined}
        />
      </div>

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
            { id: 'library', label: '書庫', icon: LayoutGrid },
            { id: 'list', label: '清單', icon: List },
            { id: 'stats', label: '統計', icon: BarChart3 },
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
                {selectMode ? '取消選取' : '選取'}
              </Button>
              <Menu
                align="end"
                trigger={
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
                    <Download size={15} /> 匯出入
                  </span>
                }
                items={[
                  { id: 'export', label: '匯出 JSON', icon: Download, onSelect: doExport },
                  { id: 'import', label: '匯入 JSON', icon: Upload, onSelect: () => fileRef.current?.click() },
                ]}
              />
            </>
          )}
          <Button size="sm" icon={Plus} onClick={() => setAddOpen(true)}>
            加書
          </Button>
        </div>
        <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={onPickFile} />
      </div>

      {/* ── 批量操作條 ── */}
      {selectMode && view !== 'stats' && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-accent/30 bg-accent-soft px-3 py-2 dark:border-accent/40 dark:bg-accent/15">
          <span className="text-sm font-medium text-accent-strong dark:text-accent">
            已選 <span className="tabular-nums">{selected.size}</span> 本
          </span>
          <div className="ml-auto flex flex-wrap gap-1.5">
            <Button size="sm" variant="secondary" onClick={() => bulkStatus('reading')}>
              標在讀
            </Button>
            <Button size="sm" variant="secondary" onClick={() => bulkStatus('done')}>
              標讀完
            </Button>
            <Button size="sm" variant="secondary" onClick={bulkShelf}>
              加標籤
            </Button>
            <Button size="sm" variant="danger" icon={Trash2} onClick={bulkDelete} disabled={selected.size === 0}>
              刪除
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
                { id: 'all', label: '全部' },
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
                <span className="text-xs text-slate-400">書架</span>
                <button
                  type="button"
                  onClick={() => setShelfFilter(null)}
                  aria-pressed={!shelfFilter}
                  className={cx(
                    'rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
                    !shelfFilter
                      ? 'bg-accent text-white'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400',
                  )}
                >
                  全部
                </button>
                {allShelves.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setShelfFilter(shelfFilter === s ? null : s)}
                    aria-pressed={shelfFilter === s}
                    className={cx(
                      'rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
                      shelfFilter === s
                        ? 'bg-accent text-white'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400',
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜尋書名、作者、書架…"
                className="min-w-[12rem] flex-1"
              />
              <Select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} className="w-auto">
                {SORT_OPTS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
              <IconButton
                label={sortAsc ? '切換為降序' : '切換為升序'}
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
              ? `${filtered.length} 本符合篩選`
              : `共 ${filtered.length} 本`}
          </p>

          {/* 清單 / 書庫 */}
          {filtered.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title={query.trim() || shelfFilter ? '搵唔到符合嘅書' : '書庫仲未有書'}
              hint={
                query.trim() || shelfFilter
                  ? '試吓換個關鍵字或清除篩選。'
                  : '撳「加書」開始建立你嘅閱讀庫。'
              }
              action={
                !query.trim() && !shelfFilter ? (
                  <Button size="sm" icon={Plus} onClick={() => setAddOpen(true)}>
                    加第一本書
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
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(target || 12))
  const pct = target > 0 ? Math.min(100, Math.round((done / target) * 100)) : 0

  if (target <= 0 && !editing) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-accent/30 bg-accent-soft/50 p-4 dark:border-accent/30 dark:bg-accent/10">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent text-white shadow-sm dark:shadow-none">
          <Target size={19} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">定個 {year} 年閱讀挑戰</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">立個小目標，睇住自己今年讀完幾多本。</p>
        </div>
        <Button size="sm" onClick={() => setEditing(true)}>
          設定目標
        </Button>
      </div>
    )
  }

  const R = 26
  const C = 2 * Math.PI * R
  const reached = done >= target

  return (
    <div className="flex items-center gap-4 rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-700/60 dark:bg-slate-800 dark:shadow-none sm:p-5">
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
        <div className={cx('absolute inset-0 flex items-center justify-center text-sm font-bold tabular-nums', reached ? 'text-emerald-500' : 'text-accent')}>
          {pct}%
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
          <Target size={15} className="text-accent" /> {year} 年閱讀挑戰
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
            <span className="text-xs text-slate-400">本</span>
            <Button
              size="sm"
              onClick={() => {
                onSet(Math.max(1, Math.round(Number(draft) || 1)))
                setEditing(false)
              }}
            >
              儲存
            </Button>
          </div>
        ) : (
          <>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              已讀 <span className="tabular-nums font-semibold text-slate-700 dark:text-slate-200">{done}</span> / {target} 本
              {done >= target ? (
                <span className="ml-1.5 font-medium text-emerald-500">已達標 🎉</span>
              ) : (
                <span className="ml-1.5">仲差 {target - done} 本</span>
              )}
            </p>
            <button
              type="button"
              onClick={() => {
                setDraft(String(target))
                setEditing(true)
              }}
              className="mt-0.5 text-xs text-accent hover:text-accent-strong"
            >
              調整目標
            </button>
          </>
        )}
      </div>
    </div>
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
  const pct = progressPct(b)
  const pace = readingPace(b)
  const sel = selected.has(b.id)
  return (
    <button
      type="button"
      onClick={() => (selectMode ? onToggleSelect(b.id) : onOpen(b.id))}
      className={cx(
        'group flex flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white text-left shadow-xs transition duration-200 hover:-translate-y-1 hover:border-slate-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:border-slate-700/60 dark:bg-slate-800 dark:shadow-none dark:hover:border-slate-600',
        sel && 'ring-2 ring-accent',
      )}
    >
      {/* 封面 */}
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
        {/* 狀態圓點 */}
        <span
          className={cx(
            'absolute left-2 top-2 h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-slate-900',
            STATUS_DOT[b.status],
          )}
          title={STATUS_LABEL[b.status]}
        />
        {b.favorite && (
          <span className="absolute right-2 top-2 text-amber-400 drop-shadow">
            <Star size={15} fill="currentColor" />
          </span>
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
        {/* 在讀進度條 */}
        {b.status === 'reading' && pct > 0 && (
          <div className="absolute inset-x-0 bottom-0">
            <ProgressBar value={pct} size="sm" className="rounded-none" />
          </div>
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
            <span className="text-[11px] font-medium tabular-nums text-accent">已讀 {pct}%</span>
          ) : (
            <span className="text-[11px] text-slate-400 dark:text-slate-500">未評分</span>
          )}
        </div>

        {/* hover 顯示閱讀步速 + 預計讀完（只在「在讀」且資料齊全時） */}
        {!selectMode && pace && (
          <p className="mt-1.5 hidden items-center gap-1 text-[10px] leading-tight text-slate-500 group-hover:flex dark:text-slate-400">
            <TrendingUp size={11} className="shrink-0 text-accent" />
            <span className="truncate">
              每日 {Math.round(pace.pagesPerDay)} 頁 · {relativeLabel(pace.etaKey)}讀完
            </span>
          </p>
        )}

        {/* hover 快速切換（非選取模式） */}
        {!selectMode && (
          <div className="mt-2 hidden grid-cols-2 gap-1.5 group-hover:grid">
            {b.status !== 'reading' && (
              <span
                role="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.stopPropagation()
                  onQuickStatus(b, 'reading')
                }}
                className="rounded-lg bg-accent-soft px-1.5 py-1 text-center text-[11px] font-medium text-accent-strong transition-colors hover:bg-accent hover:text-white dark:bg-accent/15 dark:text-accent"
              >
                在讀
              </span>
            )}
            {b.status !== 'done' && (
              <span
                role="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.stopPropagation()
                  onQuickStatus(b, 'done')
                }}
                className="rounded-lg bg-emerald-50 px-1.5 py-1 text-center text-[11px] font-medium text-emerald-700 transition-colors hover:bg-emerald-500 hover:text-white dark:bg-emerald-500/10 dark:text-emerald-300"
              >
                讀完
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
//  清單視圖（table）
// ============================================================
function ListView({
  books,
  selectMode,
  selected,
  onToggleSelect,
  onOpen,
}: {
  books: Book[]
  selectMode: boolean
  selected: Set<string>
  onToggleSelect: (id: string) => void
  onOpen: (id: string) => void
}) {
  return (
    <Table>
      <Thead>
        <Tr>
          {selectMode && <Th className="w-10" />}
          <Th>書名 / 作者</Th>
          <Th>狀態</Th>
          <Th align="center">評分</Th>
          <Th align="right">進度</Th>
          <Th>書架</Th>
        </Tr>
      </Thead>
      <Tbody>
        {books.map((b) => {
          const pct = progressPct(b)
          const sel = selected.has(b.id)
          return (
            <Tr key={b.id} onClick={() => (selectMode ? onToggleSelect(b.id) : onOpen(b.id))}>
              {selectMode && (
                <Td>
                  <span
                    className={cx(
                      'flex h-5 w-5 items-center justify-center rounded-md border-2 transition-colors',
                      sel ? 'border-accent bg-accent text-white' : 'border-slate-300 text-transparent dark:border-slate-600',
                    )}
                  >
                    <CheckSquare size={12} />
                  </span>
                </Td>
              )}
              <Td>
                <div className="flex items-center gap-2">
                  <span className={cx('h-2 w-2 shrink-0 rounded-full', STATUS_DOT[b.status])} />
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 truncate font-medium text-slate-800 dark:text-slate-100">
                      {b.favorite && <Star size={12} className="shrink-0 text-amber-400" fill="currentColor" />}
                      {b.title}
                    </p>
                    {b.author && <p className="truncate text-xs text-slate-400">{b.author}</p>}
                  </div>
                </div>
              </Td>
              <Td>
                <Badge tone={STATUS_TONE[b.status]}>{STATUS_LABEL[b.status]}</Badge>
              </Td>
              <Td align="center">
                {b.rating ? (
                  <span className="inline-flex items-center gap-0.5 tabular-nums text-amber-500">
                    {b.rating.toFixed(1)} <Star size={12} fill="currentColor" />
                  </span>
                ) : (
                  <span className="text-slate-300 dark:text-slate-600">—</span>
                )}
              </Td>
              <Td numeric>
                {b.totalPages || b.status !== 'to_read' ? (
                  <div className="flex items-center justify-end gap-2">
                    <span className="text-xs tabular-nums text-slate-500">{pct}%</span>
                    <div className="w-16">
                      <ProgressBar value={pct} size="sm" tone={b.status === 'done' ? 'green' : 'accent'} />
                    </div>
                  </div>
                ) : (
                  <span className="text-slate-300 dark:text-slate-600">—</span>
                )}
              </Td>
              <Td>
                <div className="flex flex-wrap gap-1">
                  {b.shelves.slice(0, 2).map((s) => (
                    <span
                      key={s}
                      className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                    >
                      {s}
                    </span>
                  ))}
                  {b.shelves.length > 2 && (
                    <span className="text-[10px] text-slate-400">+{b.shelves.length - 2}</span>
                  )}
                </div>
              </Td>
            </Tr>
          )
        })}
      </Tbody>
    </Table>
  )
}

// ============================================================
//  統計儀表板（自製圖表）
// ============================================================
function StatsView({ books, stats }: { books: Book[]; stats: ReturnType<typeof computeStats> }) {
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
        title="未有統計資料"
        hint="加幾本書、記錄閱讀，就會見到圖表同趨勢。"
      />
    )
  }

  return (
    <div className="space-y-4">
      {/* KPI 列 */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="累計頁數" value={stats.totalPagesAll.toLocaleString()} unit="頁" icon={BookOpen} highlight />
        <StatCard label="閱讀時數" value={totalHours} unit="小時" icon={BarChart3} hint={`${stats.totalMinutes} 分鐘`} />
        <StatCard
          label="最長連續"
          value={stats.longestStreak}
          unit="日"
          icon={Flame}
          hint={stats.currentStreak ? `目前 ${stats.currentStreak} 日` : undefined}
        />
        <StatCard label="完成率" value={stats.total ? Math.round((stats.byStatus.done / stats.total) * 100) : 0} unit="%" icon={CheckSquare} />
      </div>

      {/* 每月讀完 */}
      <Card className="p-4 sm:p-5">
        <SectionTitle icon={BarChart3} description="過去 12 個月讀完本數（hover 睇頁數）">
          每月完成
        </SectionTitle>
        <BarChart data={monthly} />
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* 狀態佔比 */}
        <Card className="p-4 sm:p-5">
          <SectionTitle>狀態分佈</SectionTitle>
          <DonutChart
            slices={statusSlices}
            centerTop={String(stats.total)}
            centerBottom="本"
          />
        </Card>

        {/* 評分分佈 */}
        <Card className="p-4 sm:p-5">
          <SectionTitle
            right={
              <span className="text-xs tabular-nums text-slate-400">
                平均 <span className="font-semibold text-amber-500">{stats.avgRating.toFixed(1)}</span>
              </span>
            }
          >
            評分分佈
          </SectionTitle>
          {stats.rated > 0 ? (
            <RatingBars dist={stats.ratingDist} />
          ) : (
            <p className="py-6 text-center text-sm text-slate-400">仲未有評分</p>
          )}
        </Card>

        {/* 格式佔比 */}
        <Card className="p-4 sm:p-5">
          <SectionTitle>閱讀格式</SectionTitle>
          {formatSlices.some((s) => s.value > 0) ? (
            <DonutChart
              slices={formatSlices}
              centerTop={String(stats.byFormat.reduce((s, f) => s + f.count, 0))}
              centerBottom="本"
            />
          ) : (
            <p className="py-6 text-center text-sm text-slate-400">仲未標格式</p>
          )}
        </Card>

        {/* 熱門書架 */}
        <Card className="p-4 sm:p-5">
          <SectionTitle>熱門書架</SectionTitle>
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
            <p className="py-6 text-center text-sm text-slate-400">仲未有書架標籤</p>
          )}
        </Card>
      </div>

      {/* 活動熱圖 */}
      <Card className="p-4 sm:p-5">
        <SectionTitle icon={Flame} description="每日閱讀活動（過去約 4 個月）">
          閱讀活動
        </SectionTitle>
        <Heatmap cols={heat} />
      </Card>
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
  const toast = useToast()
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [totalPages, setTotalPages] = useState('')
  const [status, setStatus] = useState<BookStatus>('to_read')

  function submit() {
    const t = title.trim()
    if (!t) return
    const created = booksCol.add({
      title: t,
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
    toast.success('已加入書庫')
    onAdded(created.id)
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="加入新書"
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button onClick={submit} disabled={!title.trim()} icon={Plus}>
            加入
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="書名" required>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例如：原則 Principles"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="作者">
            <Input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Ray Dalio" />
          </Field>
          <Field label="總頁數">
            <Input
              type="number"
              value={totalPages}
              onChange={(e) => setTotalPages(e.target.value)}
              placeholder="例如：592"
              className="tabular-nums"
            />
          </Field>
        </div>
        <Field label="狀態">
          <div className="flex flex-wrap gap-1.5">
            {(['to_read', 'reading', 'done'] as BookStatus[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={cx(
                  'rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
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
        <p className="text-xs text-slate-400">
          加入後可以喺詳情頁設定封面、評分、書架、記錄閱讀進度。
        </p>
      </div>
    </Modal>
  )
}
