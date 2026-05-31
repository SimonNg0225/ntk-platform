import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Archive,
  BarChart3,
  BookMarked,
  CheckSquare,
  ExternalLink,
  FolderPlus,
  Inbox,
  LayoutGrid,
  Link2Off,
  List as ListIcon,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Sparkles,
  SquareKanban,
  Star,
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
  Card,
  EmptyState,
  Field,
  IconButton,
  Input,
  Menu,
  Modal,
  Select,
  SegmentedControl,
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
import {
  DEFAULT_FILTER,
  FOLDER_COLORS,
  FOLDER_COLOR_KEYS,
  SORT_LABEL,
  TYPE_LABEL,
  TYPE_ORDER,
  applyFilter,
  folderColor,
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
  { id: 'unsorted', label: '未分類', icon: Inbox },
  { id: 'broken', label: '失效連結', icon: Link2Off },
  { id: 'archived', label: '封存', icon: Archive },
]

export default function ResourceLibrary() {
  const resources = useCollection(resourcesCol)
  const topics = useCollection(topicsCol)
  const metas = useCollection(resourceMetaCol)
  const folders = useCollection(resourceFoldersCol)
  const openLog = useCollection(resourceOpenLogCol)
  const toast = useToast()
  const confirm = useConfirm()

  const [view, setView] = useState<TopView>('grid')
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
    <div className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            教學資源庫
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            收藏夾整理講義、簡報、試題、連結同筆記，追蹤使用情況，快速搵返常用教材。
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Tooltip label="管理收藏夾">
            <Button
              variant="secondary"
              icon={FolderPlus}
              onClick={() => setShowFolderMgr(true)}
            >
              收藏夾
            </Button>
          </Tooltip>
          <Button icon={Plus} onClick={() => setShowAdd(true)}>
            新增資源
          </Button>
        </div>
      </header>

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
                placeholder="搜尋標題 / 備註 / 網域 / 標籤…  （按 / ）"
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-8 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-accent focus:ring-2 focus:ring-accent/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
              {filter.search && (
                <button
                  onClick={() => patch({ search: '' })}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600"
                  aria-label="清除搜尋"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <Select
              value={filter.type}
              onChange={(e) =>
                patch({ type: e.target.value as ResourceType | 'all' })
              }
              className="w-auto"
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
              className="hidden w-auto sm:block"
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
              className="w-auto"
              aria-label="排序"
            >
              {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
                <option key={k} value={k}>
                  {SORT_LABEL[k]}
                </option>
              ))}
            </Select>

            <SegmentedControl<TopView>
              value={view}
              onChange={setView}
              options={[
                { id: 'grid', label: '', icon: LayoutGrid },
                { id: 'list', label: '', icon: ListIcon },
                { id: 'board', label: '', icon: SquareKanban },
                { id: 'insights', label: '', icon: BarChart3 },
              ]}
            />
          </div>

          {/* 已選標籤 / 清除篩選 */}
          {(filter.tags.length > 0 || activeFilterCount > 0) &&
            view !== 'insights' && (
              <div className="flex flex-wrap items-center gap-1.5">
                {filter.tags.map((t) => (
                  <button
                    key={t}
                    onClick={() => toggleTag(t)}
                    className="inline-flex items-center gap-1 rounded-md bg-accent px-2 py-0.5 text-[11px] font-medium text-white"
                  >
                    #{t}
                    <X size={11} />
                  </button>
                ))}
                <button
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

          {/* 主內容 */}
          {view === 'insights' ? (
            <Insights
              rows={allRows.filter((r) => !r.meta.archived)}
              folders={folders}
              openLog={openLog}
              topicName={topicName}
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={BookMarked}
              title="未有符合嘅資源"
              hint="撳「新增資源」開始建立你嘅教材庫，或者調整篩選條件。"
              action={
                <Button icon={Plus} onClick={() => setShowAdd(true)}>
                  新增資源
                </Button>
              }
            />
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
    <aside className="shrink-0 space-y-4 lg:w-56">
      {/* 智能視圖 */}
      <nav className="flex gap-1.5 overflow-x-auto lg:flex-col lg:gap-0.5 lg:overflow-visible">
        {SMART_VIEWS.map((v) => {
          const on = filter.smart === v.id && filter.folderId === 'all'
          const count = smartCounts[v.id]
          return (
            <button
              key={v.id}
              onClick={() => patch({ smart: v.id, folderId: 'all' })}
              className={cx(
                'inline-flex shrink-0 items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-medium transition lg:w-full',
                on
                  ? 'bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
              )}
            >
              <v.icon size={16} strokeWidth={1.9} />
              <span className="flex-1 text-left">{v.label}</span>
              <span
                className={cx(
                  'tabular-nums text-xs',
                  on ? 'text-accent-strong/70 dark:text-accent/70' : 'text-slate-400',
                )}
              >
                {count}
              </span>
            </button>
          )
        })}
      </nav>

      {/* 收藏夾 */}
      <div className="hidden lg:block">
        <div className="mb-1.5 flex items-center justify-between px-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            收藏夾
          </span>
          <button
            onClick={onManageFolders}
            className="rounded p-0.5 text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-300"
            aria-label="管理收藏夾"
          >
            <FolderPlus size={14} />
          </button>
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
      onClick={onClick}
      className={cx(
        'flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition',
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
            onClick={() => onToggle(t.tag)}
            className={cx(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition',
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
      {rows.map(({ res, meta, domain }) => {
        const isSel = selected.has(res.id)
        return (
          <Card
            key={res.id}
            className={cx(
              'group relative flex flex-col p-4 transition',
              isSel
                ? 'ring-2 ring-accent ring-offset-1 ring-offset-white dark:ring-offset-slate-900'
                : 'hover:-translate-y-0.5 hover:shadow-md',
              meta.broken && 'opacity-80',
            )}
          >
            {/* 選取角 */}
            <button
              onClick={() => onToggleSelect(res.id)}
              className={cx(
                'absolute left-3 top-3 z-10 rounded-md transition',
                isSel
                  ? 'text-accent opacity-100'
                  : 'text-slate-300 opacity-0 hover:text-slate-500 group-hover:opacity-100 dark:text-slate-600',
              )}
              aria-label="選取"
            >
              <CheckSquare size={18} className={cx(isSel && 'fill-accent/15')} />
            </button>

            <div className="flex items-start justify-between pl-7">
              <TypeIconBox type={res.type} />
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
              onClick={() => onDetail(res.id)}
              className="mt-3 text-left text-sm font-semibold text-slate-800 hover:text-accent dark:text-slate-100 dark:hover:text-accent"
            >
              {res.title}
            </button>

            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Badge tone="slate">{TYPE_LABEL[res.type]}</Badge>
              {res.topicId && (
                <span className="text-[11px] text-slate-400 dark:text-slate-500">
                  {topicName(res.topicId)}
                </span>
              )}
              {meta.broken && <Badge tone="rose">失效</Badge>}
            </div>

            {(meta.rating ?? 0) > 0 && (
              <div className="mt-2">
                <StarRating value={meta.rating ?? 0} />
              </div>
            )}

            {res.notes && (
              <p className="mt-2 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                {res.notes}
              </p>
            )}

            {res.tags && res.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {res.tags.slice(0, 3).map((t) => (
                  <span
                    key={t}
                    className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                  >
                    #{t}
                  </span>
                ))}
                {res.tags.length > 3 && (
                  <span className="text-[10px] text-slate-400">+{res.tags.length - 3}</span>
                )}
              </div>
            )}

            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 dark:border-slate-700/60">
              <FaviconChip domain={domain} />
              {res.url ? (
                <button
                  onClick={() => onOpen(res)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
                >
                  開啟
                  <ExternalLink size={12} />
                </button>
              ) : (
                <span className="text-[11px] text-slate-400">
                  {meta.opens > 0 ? `開過 ${meta.opens} 次` : '無連結'}
                </span>
              )}
            </div>
          </Card>
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
              onClick={() => onToggleAll(!allSelected)}
              className={cx(
                'inline-flex',
                allSelected ? 'text-accent' : 'text-slate-300 dark:text-slate-600',
              )}
              aria-label="全選"
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
                  onClick={() => onToggleSelect(res.id)}
                  className={cx(
                    'inline-flex',
                    isSel ? 'text-accent' : 'text-slate-300 dark:text-slate-600',
                  )}
                  aria-label="選取"
                >
                  <CheckSquare size={16} className={cx(isSel && 'fill-accent/15')} />
                </button>
              </Td>
              <Td>
                <div className="flex items-center gap-2.5">
                  <TypeIconBox type={res.type} size="sm" />
                  <div className="min-w-0">
                    <button
                      onClick={() => onDetail(res.id)}
                      className="block max-w-[14rem] truncate text-left font-medium text-slate-800 hover:text-accent dark:text-slate-100"
                    >
                      {res.title}
                      {meta.favorite && (
                        <Star
                          size={12}
                          className="ml-1 inline fill-amber-400 text-amber-400"
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
                <Badge tone="slate">{TYPE_LABEL[res.type]}</Badge>
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
            className="flex w-72 shrink-0 flex-col rounded-xl border border-slate-200 bg-slate-50/60 dark:border-slate-700/60 dark:bg-slate-800/40"
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-2 dark:border-slate-700/60">
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
                <span className={cx('h-2.5 w-2.5 rounded-full', folderColor(col.color).dot)} />
                {col.name}
              </span>
              <span className="tabular-nums text-xs text-slate-400">{items.length}</span>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-2" style={{ maxHeight: '60vh' }}>
              {items.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-400 dark:text-slate-500">
                  空
                </p>
              ) : (
                items.map(({ res, meta, domain }) => (
                  <div
                    key={res.id}
                    className="group rounded-lg border border-slate-200 bg-white p-2.5 shadow-xs transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600"
                  >
                    <div className="flex items-start gap-2">
                      <TypeIconBox type={res.type} size="sm" />
                      <div className="min-w-0 flex-1">
                        <button
                          onClick={() => onDetail(res.id)}
                          className="block w-full truncate text-left text-xs font-semibold text-slate-800 hover:text-accent dark:text-slate-100"
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
                          onClick={() => onOpen(res)}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-accent hover:underline"
                        >
                          開啟 <ExternalLink size={10} />
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-400">無連結</span>
                      )}
                      <Menu
                        align="end"
                        trigger={
                          <span className="rounded p-0.5 text-slate-400 opacity-0 transition hover:text-slate-600 group-hover:opacity-100">
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
    <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-overlay dark:border-slate-700 dark:bg-slate-800">
        <span className="px-1 text-sm font-medium text-slate-700 dark:text-slate-200">
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
        <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
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
          <div className="mt-2 flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400">顏色</span>
            {FOLDER_COLOR_KEYS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={cx(
                  'h-5 w-5 rounded-full ring-2 ring-offset-1 transition dark:ring-offset-slate-800',
                  FOLDER_COLORS[c].dot,
                  color === c
                    ? 'ring-slate-400 dark:ring-slate-300'
                    : 'ring-transparent hover:ring-slate-200',
                )}
                aria-label={`顏色 ${c}`}
              />
            ))}
          </div>
        </div>

        {/* 列表 */}
        {ordered.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-400">仲未有收藏夾</p>
        ) : (
          <ul className="space-y-1.5">
            {ordered.map((f) => (
              <li
                key={f.id}
                className="flex items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-2 dark:border-slate-700"
              >
                <Menu
                  align="start"
                  trigger={
                    <span
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
                    className="flex-1 rounded-md border border-accent bg-white px-2 py-1 text-sm outline-none dark:bg-slate-800 dark:text-slate-100"
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
