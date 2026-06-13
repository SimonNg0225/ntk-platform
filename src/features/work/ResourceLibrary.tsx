import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Archive,
  BarChart3,
  BookMarked,
  CalendarClock,
  CheckSquare,
  ExternalLink,
  FolderPlus,
  HardDrive,
  Inbox,
  Layers,
  LayoutGrid,
  Library,
  Link2Off,
  List as ListIcon,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Sparkles,
  SquareKanban,
  Star,
  TrendingUp,
  Trash2,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useCollection } from '../../lib/store'
import { resourcesCol, topicsCol } from '../../data/collections'
import type { Resource, ResourceType } from '../../data/types'
import {
  Badge,
  Button,
  EmptyState,
  Field,
  IconButton,
  Input,
  Kbd,
  Menu,
  Modal,
  Select,
  Separator,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tooltip,
  Tr,
  cx,
} from '../../ui'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import DriveView from './resourceLibrary/drive/DriveView'
import {
  DEFAULT_FILTER,
  FOLDER_COLORS,
  FOLDER_COLOR_KEYS,
  SORT_LABEL,
  TYPE_COLOR,
  TYPE_LABEL,
  TYPE_ORDER,
  applyFilter,
  folderColor,
  isStale,
  joinMeta,
  logOpen,
  pruneOrphans,
  relativeDate,
  resourceFoldersCol,
  resourceMetaCol,
  resourceOpenLogCol,
  tagFrequency,
  upsertMeta,
} from './resourceLibrary/util'
import type {
  FilterState,
  ResourceFolder,
  ResourceRow,
  SmartView,
  SortKey,
} from './resourceLibrary/util'
import { FaviconChip, StarRating, TypeIconBox } from './resourceLibrary/parts'
import { AddResourceModal, DetailModal } from './resourceLibrary/DetailModal'
import { Insights } from './resourceLibrary/Insights'

// ============================================================
//  教學資源庫（Raindrop.io 級書籤 / 教材管理）
//  ------------------------------------------------------------
//  視圖：卡片 / 清單 / 看板（按收藏夾）/ 洞察
//  功能：收藏夾、收藏星、封存、評分、標籤多選、智能篩選、排序、
//        使用分析（開啟次數 + 歷史）、批量操作、URL 智能新增。
//  共用 resourcesCol / Resource 不可改；豐富屬性存自家擴充表。
// ============================================================

type TopView = 'grid' | 'list' | 'board' | 'insights'

const SMART_VIEWS: { id: SmartView; label: string; icon: LucideIcon }[] = [
  { id: 'all', label: '全部資源', icon: BookMarked },
  { id: 'favorites', label: '收藏', icon: Star },
  { id: 'recent_opened', label: '最近開啟', icon: ExternalLink },
  { id: 'stale', label: '需要整理', icon: CalendarClock },
  { id: 'unsorted', label: '未分類', icon: Inbox },
  { id: 'broken', label: '失效連結', icon: Link2Off },
  { id: 'archived', label: '封存', icon: Archive },
]

const VIEW_OPTIONS: { id: TopView; label: string; icon: LucideIcon }[] = [
  { id: 'grid', label: '卡片視圖', icon: LayoutGrid },
  { id: 'list', label: '清單視圖', icon: ListIcon },
  { id: 'board', label: '看板視圖', icon: SquareKanban },
  { id: 'insights', label: '洞察統計', icon: BarChart3 },
]

// 類型 tone chip（每種資源類型一隻色 + 圓點，對齊統計圖表語言，一眼分到類型）
function TypeChip({ type }: { type: ResourceType }) {
  const c = TYPE_COLOR[type]
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium',
        c.chipBg,
        c.chipText,
      )}
    >
      <span className={cx('h-1.5 w-1.5 rounded-full', c.dot)} />
      {TYPE_LABEL[type]}
    </span>
  )
}

// 視圖切換（icon-only；每粒有 aria-label + aria-current，鍵盤 / 螢幕閱讀器友好）
function ViewSwitcher({
  value,
  onChange,
}: {
  value: TopView
  onChange: (v: TopView) => void
}) {
  return (
    <div
      role="group"
      aria-label="切換視圖"
      className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-800/60"
    >
      {VIEW_OPTIONS.map((o) => {
        const on = value === o.id
        return (
          <Tooltip key={o.id} label={o.label}>
            <button
              type="button"
              onClick={() => onChange(o.id)}
              aria-label={o.label}
              aria-current={on ? 'true' : undefined}
              className={cx(
                'inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-sm font-medium transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
                on
                  ? 'bg-white text-accent-strong shadow-xs dark:bg-slate-700 dark:text-accent'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200',
              )}
            >
              <o.icon size={16} strokeWidth={2} />
            </button>
          </Tooltip>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────
//  生動 overview（參考工作儀表板）：accent hero banner + 彩色可撳統計磚。
//  icon chip + 大 tabular 數字 + hover 升起 + tone 配色（accent/amber/…）。
// ─────────────────────────────────────────────
type Tone = 'accent' | 'amber' | 'emerald' | 'violet' | 'sky' | 'rose'
const TONE: Record<Tone, { chip: string; val: string }> = {
  accent: { chip: 'bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent', val: 'text-accent' },
  amber: { chip: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300', val: 'text-amber-500' },
  emerald: { chip: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300', val: 'text-emerald-500' },
  violet: { chip: 'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300', val: 'text-violet-500' },
  sky: { chip: 'bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300', val: 'text-sky-500' },
  rose: { chip: 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300', val: 'text-rose-500' },
}

// 可撳統計磚（撳一下即跳對應智能視圖；hover icon chip 放大 + 卡片升起）
function StatTile({
  label, value, unit, hint, icon: Icon, tone, active, onClick,
}: {
  label: string
  value: number | string
  unit?: string
  hint?: string
  icon: LucideIcon
  tone: Tone
  active?: boolean
  onClick: () => void
}) {
  const t = TONE[tone]
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        'group flex cursor-pointer flex-col justify-between gap-3 rounded-2xl border bg-white p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.98] dark:bg-slate-800',
        active
          ? 'border-accent/50 ring-1 ring-accent/30 dark:border-accent/50'
          : 'border-slate-200/80 hover:border-slate-300 dark:border-slate-700/60 dark:hover:border-slate-600',
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-400 dark:text-slate-500">{label}</span>
        <span className={cx('flex h-8 w-8 items-center justify-center rounded-xl transition duration-200 group-hover:scale-110', t.chip)}>
          <Icon size={16} />
        </span>
      </div>
      <div>
        <p className="flex items-baseline gap-1">
          <span className={cx('text-2xl font-semibold tabular-nums slashed-zero sm:text-3xl', t.val)}>{value}</span>
          {unit && <span className="text-sm font-medium text-slate-400">{unit}</span>}
        </p>
        {hint && <p className="mt-0.5 truncate text-[11px] text-slate-400">{hint}</p>}
      </div>
    </button>
  )
}

// accent hero banner：館名牌 kicker + serif 標題 + 動態語 + 主動作 + 館藏大數字 + 類型分佈條
function LibraryHero({
  source, total, opens, folders, typeDist, line, onAdd, onFolders,
}: {
  source: 'lib' | 'drive'
  total: number
  opens: number
  folders: number
  typeDist: { type: ResourceType; count: number }[]
  line: string
  onAdd: () => void
  onFolders: () => void
}) {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-accent p-5 text-white shadow-sm sm:p-6">
      {/* 柔光裝飾（生動感，純裝飾） */}
      <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-14 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-20 right-28 h-40 w-40 rounded-full bg-white/5 blur-2xl" />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.3em] text-white/70">
            <Library size={13} strokeWidth={2} /> 典藏目錄 · Archive
          </p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight sm:text-[28px]">教學資源庫</h1>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-white/85" aria-live="polite">{line}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onAdd}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-sm font-semibold text-accent-strong shadow-sm transition hover:bg-white/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <Plus size={16} /> 新增資源
            </button>
            <button
              type="button"
              onClick={onFolders}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-3.5 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/25 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <FolderPlus size={16} /> 收藏夾
            </button>
          </div>
        </div>

        {source === 'lib' && (
          <div className="shrink-0 rounded-2xl bg-white/10 p-4 backdrop-blur sm:w-72">
            <p className="flex items-center gap-1 text-xs text-white/70">
              <Layers size={12} /> 館藏總數
            </p>
            <p className="mt-0.5 text-4xl font-semibold tabular-nums slashed-zero">
              {total}
              <span className="ml-1 text-sm font-medium text-white/60">項</span>
            </p>
            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-white/70">
              <TrendingUp size={11} /> 累計借閱 {opens} 次 · {folders} 個收藏夾
            </p>
            {total > 0 && typeDist.length > 0 && (
              <>
                <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-white/20">
                  {typeDist.map((d) => (
                    <span
                      key={d.type}
                      className={cx('h-full', TYPE_COLOR[d.type].dot)}
                      style={{ width: `${(d.count / total) * 100}%` }}
                    />
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-2.5 gap-y-1">
                  {typeDist.map((d) => (
                    <span key={d.type} className="inline-flex items-center gap-1 text-[10px] text-white/85">
                      <span className={cx('h-1.5 w-1.5 rounded-full', TYPE_COLOR[d.type].dot)} />
                      {TYPE_LABEL[d.type]} {d.count}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

// 彩色可撳統計磚一行（每粒對應一個智能視圖，撳一下即跳）
function StatTilesRow({
  census, smartCounts, activeSmart, jump,
}: {
  census: { total: number; opens: number; favorites: number; withLink: number; broken: number }
  smartCounts: Record<SmartView, number>
  activeSmart: SmartView | null
  jump: (s: SmartView) => void
}) {
  return (
    <section aria-label="快速統計" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <StatTile
        label="收藏" value={census.favorites} unit="項" icon={Star} tone="amber"
        hint={census.favorites > 0 ? '加星嘅常用教材' : '撳星收藏常用'}
        active={activeSmart === 'favorites'} onClick={() => jump('favorites')}
      />
      <StatTile
        label="最近開啟" value={smartCounts.recent_opened} unit="項" icon={ExternalLink} tone="sky"
        hint={`累計借閱 ${census.opens} 次`}
        active={activeSmart === 'recent_opened'} onClick={() => jump('recent_opened')}
      />
      <StatTile
        label="需要整理" value={smartCounts.stale} unit="項" icon={CalendarClock} tone="violet"
        hint={smartCounts.stale > 0 ? '好耐冇用過' : '全部貼貼服服'}
        active={activeSmart === 'stale'} onClick={() => jump('stale')}
      />
      <StatTile
        label="未分類" value={smartCounts.unsorted} unit="項" icon={Inbox} tone="emerald"
        hint={smartCounts.unsorted > 0 ? '未入收藏夾' : '全部歸咗檔'}
        active={activeSmart === 'unsorted'} onClick={() => jump('unsorted')}
      />
      <StatTile
        label="連結健康" value={census.broken > 0 ? census.broken : '良好'} unit={census.broken > 0 ? '失效' : undefined}
        icon={Link2Off} tone={census.broken > 0 ? 'rose' : 'emerald'}
        hint={census.broken > 0 ? '撳入去整理' : '未見失效連結'}
        active={activeSmart === 'broken'} onClick={() => jump('broken')}
      />
    </section>
  )
}

export default function ResourceLibrary() {
  const resources = useCollection(resourcesCol)
  const topics = useCollection(topicsCol)
  const metas = useCollection(resourceMetaCol)
  const folders = useCollection(resourceFoldersCol)
  const openLog = useCollection(resourceOpenLogCol)
  const toast = useToast()
  const confirm = useConfirm()

  const [view, setView] = useState<TopView>('grid')
  const [source, setSource] = useState<'lib' | 'drive'>('lib')
  const [filter, setFilter] = useState<FilterState>(DEFAULT_FILTER)
  const [showAdd, setShowAdd] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showFolderMgr, setShowFolderMgr] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const topicName = (id?: string) =>
    id ? (topics.find((t) => t.id === id)?.topic ?? '') : ''

  // 清孤兒 meta（資源刪咗）
  useEffect(() => {
    pruneOrphans(new Set(resources.map((r) => r.id)))
  }, [resources])

  // 全部資源 join meta
  const allRows = useMemo(() => joinMeta(resources, metas), [resources, metas])
  const filtered = useMemo(() => applyFilter(allRows, filter), [allRows, filter])
  const allTags = useMemo(() => tagFrequency(resources), [resources])

  // 智能視圖計數（封存除外，計於非封存集）
  const smartCounts = useMemo(() => {
    const live = allRows.filter((r) => !r.meta.archived)
    return {
      all: live.length,
      favorites: live.filter((r) => r.meta.favorite).length,
      recent_opened: live.filter((r) => r.meta.lastOpened).length,
      stale: live.filter((r) => isStale(r)).length,
      unsorted: live.filter((r) => !r.meta.folderId).length,
      broken: live.filter((r) => r.meta.broken).length,
      archived: allRows.filter((r) => r.meta.archived).length,
    } as Record<SmartView, number>
  }, [allRows])

  // 各收藏夾資源數（非封存）
  const folderCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of allRows)
      if (!r.meta.archived && r.meta.folderId)
        m.set(r.meta.folderId, (m.get(r.meta.folderId) ?? 0) + 1)
    return m
  }, [allRows])

  // 典藏總覽（masthead census 帶）：館藏總數、累計借閱（開啟）、收藏、連結健康度
  const census = useMemo(() => {
    const live = allRows.filter((r) => !r.meta.archived)
    const opens = live.reduce((s, r) => s + r.meta.opens, 0)
    const withLink = live.filter((r) => !!r.res.url).length
    const broken = live.filter((r) => r.meta.broken).length
    return {
      total: live.length,
      opens,
      favorites: live.filter((r) => r.meta.favorite).length,
      withLink,
      broken,
    }
  }, [allRows])

  // 類型分佈（非封存）：畀 hero 彩色分佈條用
  const typeDist = useMemo(
    () =>
      TYPE_ORDER.map((tp) => ({
        type: tp,
        count: allRows.filter((r) => !r.meta.archived && r.res.type === tp).length,
      })).filter((d) => d.count > 0),
    [allRows],
  )

  // hero 動態語：按來源 / 庫狀態揀最該講嗰句（生動 + 有指引）
  const heroLine =
    source === 'drive'
      ? '正瀏覽 Google Drive（live 唯讀）。想永久收藏、評分或歸類，切返「我的庫」。'
      : census.total === 0
        ? '由第一條連結或一份講義開始 —— 貼上就自動幫你猜類型、建檔歸類。'
        : census.broken > 0
          ? `有 ${census.broken} 條失效連結，撳下面「連結健康」清理返。`
          : smartCounts.stale > 0
            ? `${smartCounts.stale} 項好耐冇用過，得閒整理下保持貼服。`
            : `館藏 ${census.total} 項、累計借閱 ${census.opens} 次 —— 幾時想用，一搜即返。`

  // 目前生效嘅智能視圖（folderId 為 all 先當 smart 生效）→ 畀統計磚高亮
  const activeSmart: SmartView | null = filter.folderId === 'all' ? filter.smart : null

  // 鍵盤：/ 聚焦搜尋、n 新增
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      const typing =
        t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable
      if (typing) return
      if (e.key === '/') {
        e.preventDefault()
        searchRef.current?.focus()
      } else if (e.key === 'n') {
        e.preventDefault()
        setShowAdd(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const patch = (p: Partial<FilterState>) => setFilter((f) => ({ ...f, ...p }))
  const toggleTag = (tag: string) =>
    setFilter((f) => ({
      ...f,
      tags: f.tags.includes(tag)
        ? f.tags.filter((t) => t !== tag)
        : [...f.tags, tag],
    }))
  const activeFilterCount =
    (filter.type !== 'all' ? 1 : 0) +
    (filter.topicId ? 1 : 0) +
    (filter.tags.length ? 1 : 0) +
    (filter.folderId !== 'all' ? 1 : 0)

  // ── 選取（批量）──
  const toggleSelect = (id: string) =>
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const clearSelect = () => setSelected(new Set())
  const selectAllFiltered = () =>
    setSelected(new Set(filtered.map((r) => r.res.id)))

  const open = (r: Resource) => {
    if (!r.url) {
      setDetailId(r.id)
      return
    }
    logOpen(r.id)
    window.open(r.url, '_blank', 'noopener,noreferrer')
  }

  const removeOne = async (id: string, title: string) => {
    const ok = await confirm({
      title: '刪除資源？',
      message: `「${title}」將會被永久刪除，呢個動作無法復原。`,
      confirmText: '刪除',
      tone: 'danger',
    })
    if (!ok) return
    resourcesCol.remove(id)
    resourceMetaCol.remove(id)
    setDetailId(null)
    setSelected((s) => {
      const n = new Set(s)
      n.delete(id)
      return n
    })
    toast.success('已刪除資源')
  }

  // ── 批量操作 ──
  const bulkFavorite = () => {
    selected.forEach((id) => upsertMeta(id, { favorite: true }))
    toast.success(`已收藏 ${selected.size} 項`)
    clearSelect()
  }
  const bulkArchive = () => {
    selected.forEach((id) => upsertMeta(id, { archived: true }))
    toast.success(`已封存 ${selected.size} 項`)
    clearSelect()
  }
  const bulkMove = (folderId: string | undefined) => {
    selected.forEach((id) => upsertMeta(id, { folderId }))
    toast.success(`已移動 ${selected.size} 項`)
    clearSelect()
  }
  const bulkDelete = async () => {
    const ok = await confirm({
      title: `刪除 ${selected.size} 項資源？`,
      message: '呢個動作無法復原。',
      confirmText: '刪除',
      tone: 'danger',
    })
    if (!ok) return
    selected.forEach((id) => {
      resourcesCol.remove(id)
      resourceMetaCol.remove(id)
    })
    toast.success(`已刪除 ${selected.size} 項`)
    clearSelect()
  }

  const detailRow = detailId
    ? allRows.find((r) => r.res.id === detailId)
    : undefined

  return (
    <div className="space-y-5">
      {/* ───────── 生動 hero：accent 館名牌 + 動態語 + 主動作 + 館藏大數字 + 類型分佈 ───────── */}
      <LibraryHero
        source={source}
        total={census.total}
        opens={census.opens}
        folders={folders.length}
        typeDist={typeDist}
        line={heroLine}
        onAdd={() => setShowAdd(true)}
        onFolders={() => setShowFolderMgr(true)}
      />

      {/* ───────── 來源切換：我的庫（本機收藏）↔ Google Drive（live 唯讀） ───────── */}
      <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-800/60">
        {([
          { id: 'lib', label: '我的庫', icon: Library },
          { id: 'drive', label: 'Google Drive', icon: HardDrive },
        ] as const).map((o) => {
          const on = source === o.id
          const I = o.icon
          return (
            <button
              key={o.id}
              type="button"
              aria-pressed={on}
              onClick={() => setSource(o.id)}
              className={cx(
                'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition active:scale-[0.98]',
                on
                  ? 'bg-white text-slate-800 shadow-xs dark:bg-slate-700 dark:text-slate-100'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200',
              )}
            >
              <I size={15} />
              {o.label}
            </button>
          )
        })}
      </div>

      {source === 'drive' ? (
        <DriveView />
      ) : (
      <>
      {/* ───────── 彩色可撳統計磚（撳一下即跳對應智能視圖） ───────── */}
      <StatTilesRow
        census={census}
        smartCounts={smartCounts}
        activeSmart={activeSmart}
        jump={(s) => patch({ smart: s, folderId: 'all' })}
      />

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* ─── 側欄：智能視圖 + 收藏夾 ─── */}
        <Sidebar
          filter={filter}
          patch={patch}
          smartCounts={smartCounts}
          folders={folders}
          folderCounts={folderCounts}
          onManageFolders={() => setShowFolderMgr(true)}
        />

        {/* ─── 主區 ─── */}
        <div className="min-w-0 flex-1 space-y-3">
          {/* 工具列 */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[160px] flex-1">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                ref={searchRef}
                value={filter.search}
                onChange={(e) => patch({ search: e.target.value })}
                placeholder="搜尋標題 / 備註 / 網域 / 標籤…"
                className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-16 text-base sm:text-sm text-slate-800 shadow-xs outline-none transition placeholder:text-slate-400 focus:border-accent focus:ring-2 focus:ring-accent/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:shadow-none"
              />
              {filter.search ? (
                <button
                  type="button"
                  onClick={() => patch({ search: '' })}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 active:scale-[0.98] dark:hover:bg-slate-700"
                  aria-label="清除搜尋"
                >
                  <X size={14} />
                </button>
              ) : (
                <Kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2">
                  /
                </Kbd>
              )}
            </div>

            <Select
              value={filter.type}
              onChange={(e) =>
                patch({ type: e.target.value as ResourceType | 'all' })
              }
              className="w-auto rounded-xl"
              aria-label="類型篩選"
            >
              <option value="all">全部類型</option>
              {TYPE_ORDER.map((k) => (
                <option key={k} value={k}>
                  {TYPE_LABEL[k]}
                </option>
              ))}
            </Select>

            <Select
              value={filter.topicId}
              onChange={(e) => patch({ topicId: e.target.value })}
              className="hidden w-auto rounded-xl sm:block"
              aria-label="課題篩選"
            >
              <option value="">全部課題</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.topic}
                </option>
              ))}
            </Select>

            <Select
              value={filter.sort}
              onChange={(e) => patch({ sort: e.target.value as SortKey })}
              className="w-auto rounded-xl"
              aria-label="排序"
            >
              {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
                <option key={k} value={k}>
                  {SORT_LABEL[k]}
                </option>
              ))}
            </Select>

            <ViewSwitcher value={view} onChange={setView} />
          </div>

          {/* 已選標籤 / 清除篩選 */}
          {(filter.tags.length > 0 || activeFilterCount > 0) &&
            view !== 'insights' && (
              <div className="flex flex-wrap items-center gap-1.5">
                {filter.tags.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleTag(t)}
                    aria-label={`移除標籤篩選 #${t}`}
                    className="inline-flex items-center gap-1 rounded-md bg-accent px-2 py-0.5 text-[11px] font-medium text-white transition active:scale-[0.98]"
                  >
                    #{t}
                    <X size={11} aria-hidden="true" />
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setFilter((f) => ({
                      ...DEFAULT_FILTER,
                      smart: f.smart,
                      search: f.search,
                      sort: f.sort,
                    }))
                  }
                  className="text-[11px] text-slate-400 underline-offset-2 hover:text-slate-600 hover:underline dark:text-slate-500"
                >
                  清除篩選
                </button>
              </div>
            )}

          {/* 標籤雲（grid / list 視圖頂部快速過濾） */}
          {allTags.length > 0 && view !== 'insights' && (
            <TagFilterBar
              tags={allTags.slice(0, 14)}
              active={filter.tags}
              onToggle={toggleTag}
            />
          )}

          {/* 搜尋 / 篩選結果數（螢幕閱讀器即時播報） */}
          {view !== 'insights' && (
            <p className="sr-only" role="status" aria-live="polite">
              {`${filtered.length} 項資源`}
            </p>
          )}

          {/* 主內容 */}
          {view === 'insights' ? (
            <Insights
              rows={allRows.filter((r) => !r.meta.archived)}
              folders={folders}
              openLog={openLog}
              topicName={topicName}
            />
          ) : filtered.length === 0 ? (
            filter.smart === 'stale' && activeFilterCount === 0 && !filter.search ? (
              <EmptyState
                icon={CalendarClock}
                title="資源庫好乾淨 ✨"
                hint="冇久未開啟或者從未用過嘅資源，全部都整理得貼貼服服。"
              />
            ) : (
              <EmptyState
                icon={BookMarked}
                art="empty-resources"
                title="呢格抽屜暫時係空嘅"
                hint="撳「新增資源」開始建檔，貼條連結就會自動幫你猜類型歸類；又或者調整下篩選，睇返其他抽屜。"
                action={
                  <Button icon={Plus} onClick={() => setShowAdd(true)}>
                    新增資源
                  </Button>
                }
              />
            )
          ) : view === 'grid' ? (
            <GridView
              rows={filtered}
              selected={selected}
              topicName={topicName}
              onOpen={open}
              onDetail={setDetailId}
              onToggleSelect={toggleSelect}
              onToggleFav={(id, v) => upsertMeta(id, { favorite: v })}
            />
          ) : view === 'list' ? (
            <ListView
              rows={filtered}
              selected={selected}
              topicName={topicName}
              folders={folders}
              allSelected={
                filtered.length > 0 && selected.size >= filtered.length
              }
              onOpen={open}
              onDetail={setDetailId}
              onToggleSelect={toggleSelect}
              onToggleAll={(on) => (on ? selectAllFiltered() : clearSelect())}
              onToggleFav={(id, v) => upsertMeta(id, { favorite: v })}
            />
          ) : (
            <BoardView
              rows={filtered}
              folders={folders}
              onOpen={open}
              onDetail={setDetailId}
              onMove={(id, folderId) => upsertMeta(id, { folderId })}
            />
          )}
        </div>
      </div>
      </>
      )}

      {/* 批量操作條 */}
      {selected.size > 0 && (
        <BulkBar
          count={selected.size}
          folders={folders}
          onClear={clearSelect}
          onFavorite={bulkFavorite}
          onArchive={bulkArchive}
          onMove={bulkMove}
          onDelete={bulkDelete}
        />
      )}

      {/* Modals */}
      <AddResourceModal open={showAdd} onClose={() => setShowAdd(false)} />
      {detailRow && (
        <DetailModal
          resourceId={detailRow.res.id}
          meta={detailRow.meta}
          onClose={() => setDetailId(null)}
          onDeleted={removeOne}
        />
      )}
      <FolderManager
        open={showFolderMgr}
        onClose={() => setShowFolderMgr(false)}
        folders={folders}
        counts={folderCounts}
      />
    </div>
  )
}

// ============================================================
//  側欄
// ============================================================
function Sidebar({
  filter,
  patch,
  smartCounts,
  folders,
  folderCounts,
  onManageFolders,
}: {
  filter: FilterState
  patch: (p: Partial<FilterState>) => void
  smartCounts: Record<SmartView, number>
  folders: ResourceFolder[]
  folderCounts: Map<string, number>
  onManageFolders: () => void
}) {
  const ordered = [...folders].sort((a, b) => a.order - b.order)
  return (
    <aside className="shrink-0 space-y-5 lg:w-56">
      {/* 快速抽屜（智能視圖） */}
      <div>
        <p className="mb-1.5 hidden items-center gap-1.5 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 lg:flex">
          <Inbox size={12} />
          快速抽屜
        </p>
        <nav
          aria-label="智能視圖"
          className="flex gap-1.5 overflow-x-auto pb-0.5 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:pb-0"
        >
          {SMART_VIEWS.map((v) => {
            const on = filter.smart === v.id && filter.folderId === 'all'
            const count = smartCounts[v.id]
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => patch({ smart: v.id, folderId: 'all' })}
                aria-current={on ? 'page' : undefined}
                className={cx(
                  'group inline-flex shrink-0 items-center gap-2 rounded-xl px-2.5 py-2 text-sm font-medium transition active:scale-[0.98] lg:w-full lg:border-l-2 lg:pl-3',
                  on
                    ? 'bg-accent-soft text-accent-strong shadow-xs dark:bg-accent/15 dark:text-accent dark:shadow-none lg:border-accent'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 lg:border-transparent',
                )}
              >
                <v.icon size={16} strokeWidth={1.9} className="shrink-0" />
                <span className="flex-1 text-left">{v.label}</span>
                <span
                  className={cx(
                    'tabular-nums text-xs',
                    on
                      ? 'text-accent-strong/70 dark:text-accent/70'
                      : 'text-slate-400',
                  )}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </nav>
      </div>

      {/* 收藏抽屜（folders） */}
      <div className="hidden lg:block">
        <div className="mb-1.5 flex items-center justify-between px-2.5">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            <BookMarked size={12} />
            收藏抽屜
          </span>
          <Tooltip label="管理收藏夾" side="left">
            <button
              type="button"
              onClick={onManageFolders}
              className="rounded p-0.5 text-slate-400 transition hover:text-slate-600 active:scale-[0.98] dark:hover:text-slate-300"
              aria-label="管理收藏夾"
            >
              <FolderPlus size={14} />
            </button>
          </Tooltip>
        </div>
        <div className="space-y-0.5">
          <FolderRow
            label="全部收藏夾"
            color="slate"
            count={[...folderCounts.values()].reduce((s, n) => s + n, 0)}
            active={filter.folderId === 'all' && filter.smart === 'all'}
            onClick={() => patch({ folderId: 'all', smart: 'all' })}
            dotless
          />
          {ordered.map((f) => (
            <FolderRow
              key={f.id}
              label={f.name}
              color={f.color}
              count={folderCounts.get(f.id) ?? 0}
              active={filter.folderId === f.id}
              onClick={() => patch({ folderId: f.id, smart: 'all' })}
            />
          ))}
        </div>
      </div>
    </aside>
  )
}

function FolderRow({
  label,
  color,
  count,
  active,
  onClick,
  dotless,
}: {
  label: string
  color: string
  count: number
  active: boolean
  onClick: () => void
  dotless?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'true' : undefined}
      className={cx(
        'flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-sm transition active:scale-[0.98]',
        active
          ? 'bg-slate-100 font-medium text-slate-800 dark:bg-slate-800 dark:text-slate-100'
          : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/60',
      )}
    >
      {dotless ? (
        <BookMarked size={14} className="text-slate-400" />
      ) : (
        <span className={cx('h-2.5 w-2.5 shrink-0 rounded-full', folderColor(color).dot)} />
      )}
      <span className="flex-1 truncate text-left">{label}</span>
      <span className="tabular-nums text-xs text-slate-400">{count}</span>
    </button>
  )
}

// ============================================================
//  標籤過濾條
// ============================================================
function TagFilterBar({
  tags,
  active,
  onToggle,
}: {
  tags: { tag: string; count: number }[]
  active: string[]
  onToggle: (t: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((t) => {
        const on = active.includes(t.tag)
        return (
          <button
            key={t.tag}
            type="button"
            onClick={() => onToggle(t.tag)}
            aria-pressed={on}
            aria-label={`標籤篩選 #${t.tag}（${t.count}）`}
            className={cx(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition active:scale-[0.98]',
              on
                ? 'bg-accent text-white'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700',
            )}
          >
            #{t.tag}
            <span className={cx('tabular-nums', on ? 'text-white/70' : 'text-slate-400')}>
              {t.count}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ============================================================
//  卡片視圖
// ============================================================
function GridView({
  rows,
  selected,
  topicName,
  onOpen,
  onDetail,
  onToggleSelect,
  onToggleFav,
}: {
  rows: ResourceRow[]
  selected: Set<string>
  topicName: (id?: string) => string
  onOpen: (r: Resource) => void
  onDetail: (id: string) => void
  onToggleSelect: (id: string) => void
  onToggleFav: (id: string, v: boolean) => void
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map(({ res, meta, domain }, i) => {
        const isSel = selected.has(res.id)
        const tc = TYPE_COLOR[res.type]
        return (
          <article
            key={res.id}
            className={cx(
              'group relative flex animate-fade-in-up flex-col overflow-hidden rounded-3xl border bg-white shadow-xs transition duration-200 dark:bg-slate-800 dark:shadow-none',
              isSel
                ? 'border-accent/50 ring-2 ring-accent ring-offset-1 ring-offset-white dark:ring-offset-slate-900'
                : 'border-slate-200/80 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md dark:border-slate-700/60 dark:hover:border-slate-600',
              meta.broken && 'opacity-80',
            )}
            style={{ animationDelay: `${Math.min(i, 11) * 35}ms` }}
          >
            {/* 類型書脊（左緣彩條，一眼分到館藏類別） */}
            <span
              aria-hidden="true"
              className={cx('absolute inset-y-0 left-0 w-1', tc.dot)}
            />

            <div className="flex flex-1 flex-col p-4 pl-5">
              {/* 選取角 */}
              <button
                type="button"
                onClick={() => onToggleSelect(res.id)}
                className={cx(
                  'absolute left-3 top-3 z-10 rounded-md transition active:scale-[0.98] focus-visible:opacity-100',
                  isSel
                    ? 'text-accent opacity-100'
                    : 'text-slate-300 opacity-0 hover:text-slate-500 group-hover:opacity-100 dark:text-slate-600',
                )}
                aria-pressed={isSel}
                aria-label={isSel ? `取消選取「${res.title}」` : `選取「${res.title}」`}
              >
                <CheckSquare size={18} className={cx(isSel && 'fill-accent/15')} />
              </button>

              <div className="flex items-start justify-between pl-7">
                <span className="transition duration-200 group-hover:scale-105">
                  <TypeIconBox type={res.type} />
                </span>
                <div className="flex items-center gap-0.5">
                  <Tooltip label={meta.favorite ? '取消收藏' : '收藏'}>
                    <IconButton
                      label="收藏"
                      size="sm"
                      active={meta.favorite}
                      onClick={() => onToggleFav(res.id, !meta.favorite)}
                    >
                      <Star
                        size={15}
                        className={cx(meta.favorite && 'fill-amber-400 text-amber-400')}
                      />
                    </IconButton>
                  </Tooltip>
                  <Tooltip label="詳情">
                    <IconButton label="詳情" size="sm" onClick={() => onDetail(res.id)}>
                      <MoreVertical size={15} />
                    </IconButton>
                  </Tooltip>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onDetail(res.id)}
                className="mt-3 w-full break-words rounded text-left text-[15px] font-semibold leading-snug text-slate-800 transition hover:text-accent active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:text-slate-100 dark:hover:text-accent"
              >
                {res.title}
              </button>

              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <TypeChip type={res.type} />
                {res.topicId && (
                  <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500 dark:bg-slate-700/60 dark:text-slate-400">
                    {topicName(res.topicId)}
                  </span>
                )}
                {meta.broken && (
                  <Badge tone="rose" icon={Link2Off}>
                    失效
                  </Badge>
                )}
              </div>

              {(meta.rating ?? 0) > 0 && (
                <div className="mt-2">
                  <StarRating value={meta.rating ?? 0} />
                </div>
              )}

              {res.notes && (
                <p className="mt-2 line-clamp-2 break-words text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  {res.notes}
                </p>
              )}

              {res.tags && res.tags.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1">
                  {res.tags.slice(0, 3).map((t) => (
                    <span
                      key={t}
                      className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                    >
                      #{t}
                    </span>
                  ))}
                  {res.tags.length > 3 && (
                    <span className="self-center text-[10px] text-slate-400">
                      +{res.tags.length - 3}
                    </span>
                  )}
                </div>
              )}

              {/* 借閱卡 footer：貼底對齊，網域 + 借閱次數做檔案註腳 */}
              <div className="mt-auto flex items-center justify-between gap-2 border-t border-dashed border-slate-200/90 pt-3 dark:border-slate-700/60">
                <FaviconChip domain={domain} />
                {res.url ? (
                  <button
                    type="button"
                    onClick={() => onOpen(res)}
                    aria-label={`開啟「${res.title}」（新分頁）`}
                    className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent-strong transition hover:bg-accent hover:text-white active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:bg-accent/15 dark:text-accent dark:hover:bg-accent dark:hover:text-white"
                  >
                    開啟
                    <ExternalLink size={12} aria-hidden="true" />
                  </button>
                ) : (
                  <span className="shrink-0 text-[11px] text-slate-400">
                    {meta.opens > 0 ? `借閱 ${meta.opens} 次` : '純筆記'}
                  </span>
                )}
              </div>
            </div>
          </article>
        )
      })}
    </div>
  )
}

// ============================================================
//  清單視圖（可排序表）
// ============================================================
function ListView({
  rows,
  selected,
  topicName,
  folders,
  allSelected,
  onOpen,
  onDetail,
  onToggleSelect,
  onToggleAll,
  onToggleFav,
}: {
  rows: ResourceRow[]
  selected: Set<string>
  topicName: (id?: string) => string
  folders: ResourceFolder[]
  allSelected: boolean
  onOpen: (r: Resource) => void
  onDetail: (id: string) => void
  onToggleSelect: (id: string) => void
  onToggleAll: (on: boolean) => void
  onToggleFav: (id: string, v: boolean) => void
}) {
  const folderById = new Map(folders.map((f) => [f.id, f]))
  return (
    <Table>
      <Thead>
        <Tr>
          <Th className="w-10">
            <button
              type="button"
              onClick={() => onToggleAll(!allSelected)}
              className={cx(
                'inline-flex rounded transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
                allSelected ? 'text-accent' : 'text-slate-300 dark:text-slate-600',
              )}
              aria-pressed={allSelected}
              aria-label={allSelected ? '取消全選' : '全選'}
            >
              <CheckSquare size={16} className={cx(allSelected && 'fill-accent/15')} />
            </button>
          </Th>
          <Th>標題</Th>
          <Th className="hidden sm:table-cell">類型</Th>
          <Th className="hidden md:table-cell">收藏夾</Th>
          <Th align="right" className="hidden sm:table-cell">開啟</Th>
          <Th className="hidden lg:table-cell">最後開啟</Th>
          <Th align="right">動作</Th>
        </Tr>
      </Thead>
      <Tbody>
        {rows.map(({ res, meta, domain }) => {
          const folder = meta.folderId ? folderById.get(meta.folderId) : undefined
          const isSel = selected.has(res.id)
          return (
            <Tr key={res.id}>
              <Td>
                <button
                  type="button"
                  onClick={() => onToggleSelect(res.id)}
                  className={cx(
                    'inline-flex rounded transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
                    isSel ? 'text-accent' : 'text-slate-300 dark:text-slate-600',
                  )}
                  aria-pressed={isSel}
                  aria-label={isSel ? `取消選取「${res.title}」` : `選取「${res.title}」`}
                >
                  <CheckSquare size={16} className={cx(isSel && 'fill-accent/15')} />
                </button>
              </Td>
              <Td>
                <div className="flex items-center gap-2.5">
                  <TypeIconBox type={res.type} size="sm" />
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => onDetail(res.id)}
                      className="block max-w-[14rem] truncate rounded text-left font-medium text-slate-800 transition hover:text-accent active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:text-slate-100"
                    >
                      {res.title}
                      {meta.favorite && (
                        <Star
                          size={12}
                          className="ml-1 inline fill-amber-400 text-amber-400"
                          aria-hidden="true"
                        />
                      )}
                    </button>
                    <div className="flex items-center gap-2">
                      {domain && (
                        <span className="max-w-[12rem] truncate text-[11px] text-slate-400">
                          {domain}
                        </span>
                      )}
                      {res.topicId && (
                        <span className="hidden text-[11px] text-slate-400 sm:inline">
                          · {topicName(res.topicId)}
                        </span>
                      )}
                      {meta.broken && <Badge tone="rose">失效</Badge>}
                    </div>
                  </div>
                </div>
              </Td>
              <Td className="hidden sm:table-cell">
                <TypeChip type={res.type} />
              </Td>
              <Td className="hidden md:table-cell">
                {folder ? (
                  <span className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
                    <span className={cx('h-2 w-2 rounded-full', folderColor(folder.color).dot)} />
                    {folder.name}
                  </span>
                ) : (
                  <span className="text-xs text-slate-400">—</span>
                )}
              </Td>
              <Td numeric className="hidden sm:table-cell">
                {meta.opens || '—'}
              </Td>
              <Td className="hidden lg:table-cell">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {relativeDate(meta.lastOpened)}
                </span>
              </Td>
              <Td align="right">
                <div className="inline-flex items-center gap-0.5">
                  <IconButton
                    label="收藏"
                    size="sm"
                    active={meta.favorite}
                    onClick={() => onToggleFav(res.id, !meta.favorite)}
                  >
                    <Star
                      size={14}
                      className={cx(meta.favorite && 'fill-amber-400 text-amber-400')}
                    />
                  </IconButton>
                  {res.url && (
                    <IconButton label="開啟" size="sm" onClick={() => onOpen(res)}>
                      <ExternalLink size={14} />
                    </IconButton>
                  )}
                  <IconButton label="詳情" size="sm" onClick={() => onDetail(res.id)}>
                    <MoreVertical size={14} />
                  </IconButton>
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
//  看板視圖（按收藏夾分欄）
// ============================================================
function BoardView({
  rows,
  folders,
  onOpen,
  onDetail,
  onMove,
}: {
  rows: ResourceRow[]
  folders: ResourceFolder[]
  onOpen: (r: Resource) => void
  onDetail: (id: string) => void
  onMove: (id: string, folderId: string | undefined) => void
}) {
  const ordered = [...folders].sort((a, b) => a.order - b.order)
  const columns: { id: string; name: string; color: string }[] = [
    ...ordered.map((f) => ({ id: f.id, name: f.name, color: f.color })),
    { id: '__none', name: '未分類', color: 'slate' },
  ]
  const byCol = new Map<string, ResourceRow[]>()
  for (const col of columns) byCol.set(col.id, [])
  for (const r of rows) {
    const key = r.meta.folderId ?? '__none'
    if (byCol.has(key)) byCol.get(key)!.push(r)
    else byCol.get('__none')!.push(r)
  }

  // 為某張卡產生「移到其他收藏夾」選單項
  const moveTargets = (resId: string, currentCol: string) =>
    columns
      .filter((c) => c.id !== currentCol)
      .map((c) => ({
        id: c.id,
        label: c.id === '__none' ? '移出收藏夾' : `移到「${c.name}」`,
        icon: SquareKanban as typeof SquareKanban,
        onSelect: () => onMove(resId, c.id === '__none' ? undefined : c.id),
      }))

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {columns.map((col) => {
        const items = byCol.get(col.id) ?? []
        return (
          <div
            key={col.id}
            className="flex w-72 shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-50/60 dark:border-slate-700/60 dark:bg-slate-800/40"
          >
            {/* 抽屜頂緣：收藏夾色條 + 名牌 */}
            <span
              aria-hidden="true"
              className={cx('h-1 w-full', folderColor(col.color).dot)}
            />
            <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 px-3 py-2.5 dark:border-slate-700/60">
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
                <span className={cx('h-2.5 w-2.5 rounded-full', folderColor(col.color).dot)} />
                {col.name}
              </span>
              <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-slate-200/70 px-1.5 text-[11px] font-medium tabular-nums text-slate-500 dark:bg-slate-700/60 dark:text-slate-400">
                {items.length}
              </span>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-2" style={{ maxHeight: '60vh' }}>
              {items.length === 0 ? (
                <p className="px-3 py-8 text-center text-xs leading-relaxed text-slate-400 dark:text-slate-500">
                  呢個抽屜仲空，喺其他卡片嘅選單揀「移到呢度」歸檔。
                </p>
              ) : (
                items.map(({ res, meta, domain }) => (
                  <div
                    key={res.id}
                    className="group rounded-xl border border-slate-200/80 bg-white p-2.5 shadow-xs transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-800 dark:shadow-none dark:hover:border-slate-600"
                  >
                    <div className="flex items-start gap-2">
                      <TypeIconBox type={res.type} size="sm" />
                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => onDetail(res.id)}
                          className="block w-full truncate rounded text-left text-xs font-semibold text-slate-800 transition hover:text-accent active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:text-slate-100"
                        >
                          {res.title}
                        </button>
                        {domain && (
                          <span className="block max-w-full truncate text-[10px] text-slate-400">
                            {domain}
                          </span>
                        )}
                      </div>
                      {meta.favorite && (
                        <Star size={12} className="shrink-0 fill-amber-400 text-amber-400" />
                      )}
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      {res.url ? (
                        <button
                          type="button"
                          onClick={() => onOpen(res)}
                          aria-label={`開啟「${res.title}」（新分頁）`}
                          className="inline-flex items-center gap-1 rounded text-[11px] font-medium text-accent transition hover:underline active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                        >
                          開啟 <ExternalLink size={10} aria-hidden="true" />
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-400">無連結</span>
                      )}
                      <Menu
                        align="end"
                        trigger={
                          <span
                            aria-label={`「${res.title}」更多操作`}
                            className="rounded p-0.5 text-slate-400 opacity-0 transition hover:text-slate-600 group-hover:opacity-100"
                          >
                            <MoreVertical size={14} />
                          </span>
                        }
                        items={[
                          {
                            id: 'detail',
                            label: '詳情',
                            icon: MoreVertical,
                            onSelect: () => onDetail(res.id),
                          },
                          ...moveTargets(res.id, col.id),
                        ]}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ============================================================
//  批量操作浮動條
// ============================================================
function BulkBar({
  count,
  folders,
  onClear,
  onFavorite,
  onArchive,
  onMove,
  onDelete,
}: {
  count: number
  folders: ResourceFolder[]
  onClear: () => void
  onFavorite: () => void
  onArchive: () => void
  onMove: (folderId: string | undefined) => void
  onDelete: () => void
}) {
  return (
    <div className="fixed inset-x-0 bottom-4 z-40 flex animate-fade-in-up justify-center px-4">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-overlay dark:border-slate-700 dark:bg-slate-800">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-sm font-medium text-accent-strong dark:bg-accent/15 dark:text-accent">
          已選 <span className="tabular-nums">{count}</span> 項
        </span>
        <Separator orientation="vertical" className="h-5" />
        <Button variant="secondary" size="sm" icon={Star} onClick={onFavorite}>
          收藏
        </Button>
        <Menu
          align="start"
          trigger={
            <Button variant="secondary" size="sm" icon={SquareKanban}>
              移到收藏夾
            </Button>
          }
          items={[
            {
              id: 'none',
              label: '移出收藏夾',
              icon: Inbox,
              onSelect: () => onMove(undefined),
            },
            ...[...folders]
              .sort((a, b) => a.order - b.order)
              .map((f) => ({
                id: f.id,
                label: f.name,
                icon: BookMarked,
                onSelect: () => onMove(f.id),
              })),
          ]}
        />
        <Button variant="secondary" size="sm" icon={Archive} onClick={onArchive}>
          封存
        </Button>
        <Button variant="danger" size="sm" icon={Trash2} onClick={onDelete}>
          刪除
        </Button>
        <IconButton label="取消選取" size="sm" onClick={onClear}>
          <X size={16} />
        </IconButton>
      </div>
    </div>
  )
}

// ============================================================
//  收藏夾管理
// ============================================================
function FolderManager({
  open,
  onClose,
  folders,
  counts,
}: {
  open: boolean
  onClose: () => void
  folders: ResourceFolder[]
  counts: Map<string, number>
}) {
  const toast = useToast()
  const confirm = useConfirm()
  const [name, setName] = useState('')
  const [color, setColor] = useState<string>('accent')
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  const ordered = [...folders].sort((a, b) => a.order - b.order)

  const add = () => {
    if (!name.trim()) {
      toast.error('請輸入收藏夾名稱')
      return
    }
    const maxOrder = folders.reduce((m, f) => Math.max(m, f.order), -1)
    resourceFoldersCol.add({
      name: name.trim(),
      color,
      order: maxOrder + 1,
      createdAt: new Date().toISOString(),
    })
    setName('')
    setColor('accent')
    toast.success('已新增收藏夾')
  }

  const saveEdit = (id: string) => {
    if (!editName.trim()) return
    resourceFoldersCol.update(id, { name: editName.trim() })
    setEditId(null)
    toast.success('已更新')
  }

  const remove = async (f: ResourceFolder) => {
    const n = counts.get(f.id) ?? 0
    const ok = await confirm({
      title: `刪除收藏夾「${f.name}」？`,
      message:
        n > 0
          ? `入面 ${n} 項資源唔會被刪，只會變返「未分類」。`
          : '此收藏夾沒有資源。',
      confirmText: '刪除',
      tone: 'danger',
    })
    if (!ok) return
    // 把該夾下嘅資源 meta 解除歸屬
    for (const m of resourceMetaCol.get())
      if (m.folderId === f.id) upsertMeta(m.id, { folderId: undefined })
    resourceFoldersCol.remove(f.id)
    toast.success('已刪除收藏夾')
  }

  const recolor = (id: string, c: string) =>
    resourceFoldersCol.update(id, { color: c })

  return (
    <Modal open={open} onClose={onClose} title="管理收藏夾" size="md">
      <div className="space-y-4">
        {/* 新增 */}
        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-3.5 dark:border-slate-700/60 dark:bg-slate-800/40">
          <Field label="新收藏夾名稱">
            <div className="flex gap-2">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && add()}
                placeholder="例如：DSE 操卷"
              />
              <Button icon={Plus} onClick={add}>
                新增
              </Button>
            </div>
          </Field>
          <div className="mt-2.5 flex items-center gap-1.5">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">顏色</span>
            {FOLDER_COLOR_KEYS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={cx(
                  'h-5 w-5 rounded-full ring-2 ring-offset-1 transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-accent dark:ring-offset-slate-800',
                  FOLDER_COLORS[c].dot,
                  color === c
                    ? 'ring-slate-400 dark:ring-slate-300'
                    : 'ring-transparent hover:ring-slate-200',
                )}
                aria-label={`顏色 ${c}`}
                aria-pressed={color === c}
              />
            ))}
          </div>
        </div>

        {/* 列表 */}
        {ordered.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">
            仲未有收藏抽屜，喺上面開一個開始歸類。
          </p>
        ) : (
          <ul className="space-y-1.5">
            {ordered.map((f) => (
              <li
                key={f.id}
                className="flex items-center gap-2 rounded-xl border border-slate-200/80 px-2.5 py-2 transition hover:border-slate-300 dark:border-slate-700/60 dark:hover:border-slate-600"
              >
                <Menu
                  align="start"
                  trigger={
                    <span
                      aria-label={`更改「${f.name}」顏色`}
                      className={cx(
                        'h-4 w-4 cursor-pointer rounded-full ring-2 ring-offset-1 ring-transparent transition hover:ring-slate-200 dark:ring-offset-slate-800',
                        folderColor(f.color).dot,
                      )}
                    />
                  }
                  items={FOLDER_COLOR_KEYS.map((c) => ({
                    id: c,
                    label: c,
                    onSelect: () => recolor(f.id, c),
                  }))}
                />
                {editId === f.id ? (
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEdit(f.id)
                      if (e.key === 'Escape') setEditId(null)
                    }}
                    onBlur={() => saveEdit(f.id)}
                    autoFocus
                    className="flex-1 rounded-md border border-accent bg-white px-2 py-1 text-base sm:text-sm outline-none dark:bg-slate-800 dark:text-slate-100"
                  />
                ) : (
                  <span className="flex-1 text-sm text-slate-700 dark:text-slate-200">
                    {f.name}
                  </span>
                )}
                <span className="tabular-nums text-xs text-slate-400">
                  {counts.get(f.id) ?? 0}
                </span>
                <IconButton
                  label="重新命名"
                  size="sm"
                  onClick={() => {
                    setEditId(f.id)
                    setEditName(f.name)
                  }}
                >
                  <Pencil size={14} />
                </IconButton>
                <IconButton
                  label="刪除"
                  size="sm"
                  tone="danger"
                  onClick={() => remove(f)}
                >
                  <Trash2 size={14} />
                </IconButton>
              </li>
            ))}
          </ul>
        )}

        <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
          <Sparkles size={12} />
          提示：喺看板視圖可以用卡片選單把資源移到收藏夾。
        </p>
      </div>
    </Modal>
  )
}
