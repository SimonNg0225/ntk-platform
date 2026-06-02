import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  Archive,
  BarChart3,
  Bookmark,
  BookmarkPlus,
  CheckSquare,
  ChevronLeft,
  Columns3,
  Download,
  FileText,
  Folder,
  FolderPlus,
  Inbox,
  LayoutGrid,
  ListChecks,
  Notebook as NotebookIcon,
  Pencil,
  PenLine,
  Pin,
  Plus,
  Rows3,
  Search,
  SortDesc,
  Sparkles,
  Star,
  Tag as TagIcon,
  Trash2,
  TrendingDown,
  TrendingUp,
  Upload,
  X,
} from 'lucide-react'
import { useCollection } from '../../lib/store'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  IconButton,
  Input,
  Menu,
  Modal,
  Pills,
  Select,
  SegmentedControl,
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
  FOLDER_COLOR_KEYS,
  folderColorOf,
  noteColorOf,
  notebooksCol,
  richNotesCol,
  savedFiltersCol,
  type FolderColor,
  type Notebook,
  type RichNote,
  type SavedFilter,
} from './notes/store'
import {
  checklistStat,
  compareNotes,
  computeStats,
  deriveTitle,
  download,
  exportNotesJson,
  notesToMarkdown,
  parseNotesImport,
  parseTags,
  relativeTime,
  resolveNoteByTitle,
  snippet,
  tagCounts,
  wordCount,
  type SortKey,
} from './notes/util'
import { ActivityChart, DonutChart, TagBars, type DonutSlice } from './notes/Charts'
import Editor from './notes/Editor'
import { NOTE_TEMPLATES } from './notes/templates'

// ============================================================
//  學習筆記（Apple Notes / Notion 級）
//  - 雙欄 master-detail（手機自動堆疊）
//  - 資料夾（筆記本）+ 智能篩選（全部/釘選/星標/封存/垃圾桶）
//  - 三視圖：列表 / 卡片 / 表格；搜尋 + 標籤 + 排序
//  - 批量選取（移動 / 封存 / 刪 / 匯出）
//  - 統計視圖：自製 SVG 圖表（活躍折線 / 標籤長條 / 環圈）
//  - 完整編輯器（標籤 / 待辦 / 色標 / 範本 / 匯出）見 notes/Editor
// ============================================================

type Scope =
  | { kind: 'all' }
  | { kind: 'pinned' }
  | { kind: 'favorite' }
  | { kind: 'archived' }
  | { kind: 'trash' }
  | { kind: 'notebook'; id: string }

type ViewMode = 'list' | 'grid' | 'table' | 'board'

const FOLDER_COLOR_LABELS: { id: FolderColor; label: string }[] =
  FOLDER_COLOR_KEYS.map((k) => ({ id: k, label: folderColorOf(k).label }))

export default function NotesWidget() {
  const notes = useCollection(richNotesCol)
  const notebooks = useCollection(notebooksCol)
  const savedFilters = useCollection(savedFiltersCol)
  const toast = useToast()
  const confirm = useConfirm()

  const [scope, setScope] = useState<Scope>({ kind: 'all' })
  const [view, setView] = useState<ViewMode>('list')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortKey>('updated')
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showStats, setShowStats] = useState(false)
  const [selectMode, setSelectMode] = useState(false)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [nbModal, setNbModal] = useState(false)
  const [mobilePane, setMobilePane] = useState<'list' | 'detail'>('list')
  const fileRef = useRef<HTMLInputElement>(null)

  // 各 scope 計數（側欄徽章）
  const active = useMemo(
    () => notes.filter((n) => !n.archived && !n.trashed),
    [notes],
  )
  const counts = useMemo(
    () => ({
      all: active.length,
      pinned: active.filter((n) => n.pinned).length,
      favorite: active.filter((n) => n.favorite).length,
      archived: notes.filter((n) => n.archived && !n.trashed).length,
      trash: notes.filter((n) => n.trashed).length,
    }),
    [notes, active],
  )
  const notebookCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const n of active) if (n.notebookId) m.set(n.notebookId, (m.get(n.notebookId) ?? 0) + 1)
    return m
  }, [active])

  // 依 scope 取基礎集合
  const scoped = useMemo(() => {
    switch (scope.kind) {
      case 'pinned':
        return active.filter((n) => n.pinned)
      case 'favorite':
        return active.filter((n) => n.favorite)
      case 'archived':
        return notes.filter((n) => n.archived && !n.trashed)
      case 'trash':
        return notes.filter((n) => n.trashed)
      case 'notebook':
        return active.filter((n) => n.notebookId === scope.id)
      case 'all':
      default:
        return active
    }
  }, [scope, active, notes])

  // 該範圍嘅標籤（供標籤列）
  const scopeTags = useMemo(() => tagCounts(scoped), [scoped])

  // 搜尋 + 標籤 + 排序
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return scoped
      .filter((n) => {
        if (q) {
          const hay = (n.title + '\n' + n.content).toLowerCase()
          if (!hay.includes(q)) return false
        }
        if (
          activeTag &&
          !parseTags(n.content).some((t) => t.toLowerCase() === activeTag.toLowerCase())
        )
          return false
        return true
      })
      .sort((a, b) => compareNotes(a, b, sort))
  }, [scoped, query, activeTag, sort])

  // 維持 selectedId 有效；無就揀第一個
  useEffect(() => {
    if (selectedId && visible.some((n) => n.id === selectedId)) return
    setSelectedId(visible[0]?.id ?? null)
  }, [visible, selectedId])

  const selected = useMemo(
    () => notes.find((n) => n.id === selectedId) ?? null,
    [notes, selectedId],
  )

  const stats = useMemo(() => computeStats(active, notes), [active, notes])
  const hasFilter = Boolean(query.trim() || activeTag)

  // ───────── 操作 ─────────
  function createNote(body = '') {
    const now = new Date().toISOString()
    const nb =
      scope.kind === 'notebook' ? scope.id : null
    const created = richNotesCol.add({
      title: '',
      content: body,
      notebookId: nb,
      pinned: false,
      favorite: false,
      archived: false,
      trashed: false,
      color: 'none',
      createdAt: now,
      updatedAt: now,
    })
    if (scope.kind === 'archived' || scope.kind === 'trash') setScope({ kind: 'all' })
    setActiveTag(null)
    setQuery('')
    setSelectedId(created.id)
    setMobilePane('detail')
    if (body) toast.info('已用範本開新一頁')
  }

  function openNote(id: string) {
    setSelectedId(id)
    setMobilePane('detail')
  }

  // 跳去任何一則筆記（自動切到能見到佢嘅範圍 + 清走篩選），反向連結用
  function revealNote(id: string) {
    const n = notes.find((x) => x.id === id)
    if (!n) return
    setActiveTag(null)
    setQuery('')
    setScope(n.trashed ? { kind: 'trash' } : n.archived ? { kind: 'archived' } : { kind: 'all' })
    setSelectedId(id)
    setMobilePane('detail')
  }

  // 撳 [[標題]]：解析現有（非垃圾桶）筆記就跳去；冇就以該標題建立並連結
  function openLink(title: string) {
    const found = resolveNoteByTitle(notes.filter((n) => !n.trashed), title)
    if (found) {
      revealNote(found.id)
      return
    }
    const now = new Date().toISOString()
    const created = richNotesCol.add({
      title,
      content: '',
      notebookId: scope.kind === 'notebook' ? scope.id : null,
      pinned: false,
      favorite: false,
      archived: false,
      trashed: false,
      color: 'none',
      createdAt: now,
      updatedAt: now,
    })
    setActiveTag(null)
    setQuery('')
    setScope((s) => (s.kind === 'notebook' ? s : { kind: 'all' }))
    setSelectedId(created.id)
    setMobilePane('detail')
    toast.success(`已建立並連結「${title}」`)
  }

  // ───────── 儲存篩選（智能檢視）─────────
  function saveCurrentFilter() {
    const q = query.trim()
    const tag = activeTag
    if (!q && !tag) return
    if (savedFiltersCol.get().some((f) => f.tag === tag && f.query === q)) {
      toast.info('已經儲存過呢個篩選')
      return
    }
    const name = tag ? (q ? `#${tag} · ${q}` : `#${tag}`) : `「${q}」`
    savedFiltersCol.add({ name, query: q, tag, createdAt: new Date().toISOString() })
    toast.success('已儲存篩選')
  }

  function applySavedFilter(f: SavedFilter) {
    setScope({ kind: 'all' })
    setQuery(f.query)
    setActiveTag(f.tag)
    setMobilePane('list')
    exitSelect()
  }

  function toggleCheck(id: string) {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function exitSelect() {
    setSelectMode(false)
    setChecked(new Set())
  }

  const checkedNotes = useMemo(
    () => visible.filter((n) => checked.has(n.id)),
    [visible, checked],
  )

  function bulkPatch(p: Partial<RichNote>, msg: string) {
    const now = new Date().toISOString()
    checkedNotes.forEach((n) => richNotesCol.update(n.id, { ...p, updatedAt: now }))
    toast.success(msg)
    exitSelect()
  }

  async function bulkDelete() {
    const inTrash = scope.kind === 'trash'
    const ok = await confirm({
      title: inTrash ? '永久刪除？' : '移到垃圾桶？',
      message: inTrash
        ? `${checkedNotes.length} 則筆記會被永久刪除。`
        : `${checkedNotes.length} 則筆記會移到垃圾桶（可還原）。`,
      confirmText: inTrash ? '永久刪除' : '移到垃圾桶',
      tone: 'danger',
    })
    if (!ok) return
    if (inTrash) {
      checkedNotes.forEach((n) => richNotesCol.remove(n.id))
    } else {
      const now = new Date().toISOString()
      checkedNotes.forEach((n) =>
        richNotesCol.update(n.id, { trashed: true, pinned: false, updatedAt: now }),
      )
    }
    toast.success('已處理')
    exitSelect()
  }

  function bulkExport() {
    download(`筆記匯出-${checkedNotes.length}則.md`, notesToMarkdown(checkedNotes), 'text/markdown')
    toast.success('已匯出 Markdown')
    exitSelect()
  }

  // 全量 JSON 備份（含筆記本／釘選／色標／時間，可完整還原）
  function exportJson() {
    const today = new Date().toISOString().slice(0, 10)
    download(`筆記備份-${today}.json`, exportNotesJson(notes, notebooks), 'application/json')
    toast.success('已匯出 JSON 備份')
  }

  // 揀檔匯入：按 id 去重略過已有（筆記 + 筆記本各自去重後合併）
  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const parsed = parseNotesImport(String(reader.result))
      if (!parsed) {
        toast.error('檔案格式唔啱')
        return
      }
      const noteIds = new Set(richNotesCol.get().map((n) => n.id))
      const freshNotes = parsed.notes.filter((n) => !noteIds.has(n.id))
      const nbIds = new Set(notebooksCol.get().map((nb) => nb.id))
      const freshNbs = parsed.notebooks.filter((nb) => !nbIds.has(nb.id))
      if (freshNotes.length) richNotesCol.set([...richNotesCol.get(), ...freshNotes])
      if (freshNbs.length) notebooksCol.set([...notebooksCol.get(), ...freshNbs])
      const skipped =
        parsed.notes.length - freshNotes.length + (parsed.notebooks.length - freshNbs.length)
      toast.success(
        `已匯入 ${freshNotes.length} 則筆記 · ${freshNbs.length} 個筆記本（略過 ${skipped} 個重複）`,
      )
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  async function emptyTrash() {
    const trashed = notes.filter((n) => n.trashed)
    if (!trashed.length) return
    const ok = await confirm({
      title: '清空垃圾桶？',
      message: `${trashed.length} 則筆記會被永久刪除，無法復原。`,
      confirmText: '清空',
      tone: 'danger',
    })
    if (!ok) return
    trashed.forEach((n) => richNotesCol.remove(n.id))
    toast.success('垃圾桶已清空')
  }

  // ───────── 側欄項目 ─────────
  const sidebarItems: {
    key: string
    label: string
    icon: typeof FileText
    count: number
    scope: Scope
  }[] = [
    { key: 'all', label: '全部筆記', icon: FileText, count: counts.all, scope: { kind: 'all' } },
    { key: 'pinned', label: '已釘選', icon: Pin, count: counts.pinned, scope: { kind: 'pinned' } },
    { key: 'favorite', label: '星標', icon: Star, count: counts.favorite, scope: { kind: 'favorite' } },
    { key: 'archived', label: '封存', icon: Archive, count: counts.archived, scope: { kind: 'archived' } },
    { key: 'trash', label: '垃圾桶', icon: Trash2, count: counts.trash, scope: { kind: 'trash' } },
  ]

  function isActiveScope(s: Scope) {
    if (s.kind === 'notebook' && scope.kind === 'notebook') return s.id === scope.id
    return s.kind === scope.kind
  }

  const scopeTitle =
    scope.kind === 'notebook'
      ? notebooks.find((n) => n.id === scope.id)?.name ?? '筆記本'
      : sidebarItems.find((i) => i.scope.kind === scope.kind)?.label ?? '筆記'

  return (
    <div className="space-y-5">
      {/* ───────── 手稿封面 masthead：稿紙橫線 + serif 題名 + 版權頁式統計 ───────── */}
      <header className="relative overflow-hidden rounded-3xl border border-amber-200/70 bg-gradient-to-br from-amber-50/80 via-white to-white px-5 py-5 dark:border-amber-500/20 dark:from-amber-500/[0.07] dark:via-slate-800 dark:to-slate-800 sm:px-6 sm:py-6">
        {/* 稿紙橫線（極淡，純裝飾） */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.5] dark:opacity-[0.35]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(to bottom, transparent 0, transparent 33px, rgb(180 150 100 / 0.18) 33px, rgb(180 150 100 / 0.18) 34px)',
          }}
        />
        {/* 左側裝訂紅線（手稿頁邊欄） */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-9 hidden w-px bg-rose-300/50 dark:bg-rose-400/25 sm:block"
        />
        <div className="relative flex flex-wrap items-end justify-between gap-x-4 gap-y-4">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.3em] text-accent/80 dark:text-accent">
              <NotebookIcon size={12} />
              手稿 · Manuscript
            </p>
            <h1 className="mt-1.5 font-serif text-[30px] font-semibold leading-none tracking-tight text-slate-800 dark:text-slate-100 sm:text-4xl">
              個人筆記
            </h1>
            {/* 版權頁式 colophon */}
            <p className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-serif text-sm italic text-slate-500 dark:text-slate-400">
              <span className="tabular-nums">{counts.all} 則手記</span>
              <span aria-hidden="true" className="not-italic text-amber-400/70 dark:text-amber-500/50">·</span>
              <span className="tabular-nums">親手寫落 {stats.totalWords.toLocaleString()} 字</span>
              {counts.pinned > 0 && (
                <>
                  <span aria-hidden="true" className="not-italic text-amber-400/70 dark:text-amber-500/50">·</span>
                  <span className="inline-flex items-center gap-1 not-italic font-sans text-xs font-medium text-accent-strong dark:text-accent">
                    <Pin size={11} className="fill-current" /> {counts.pinned} 則釘住
                  </span>
                </>
              )}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <Menu
              align="end"
              label="備份"
              trigger={
                <span className="inline-flex h-9 items-center gap-1.5 rounded-full border border-amber-200/80 bg-white/70 px-3 text-sm font-medium text-slate-600 backdrop-blur transition hover:bg-white dark:border-amber-500/20 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:bg-slate-800">
                  <Archive size={15} />
                  <span className="hidden sm:inline">備份</span>
                </span>
              }
              items={[
                { id: 'export', label: '匯出 JSON 備份', icon: Download, onSelect: exportJson },
                { id: 'import', label: '匯入 JSON 備份', icon: Upload, onSelect: () => fileRef.current?.click() },
              ]}
            />
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={onPickFile}
            />
            <Menu
              align="end"
              label="用範本開新筆記"
              trigger={
                <span className="inline-flex h-9 items-center gap-1.5 rounded-full border border-amber-200/80 bg-white/70 px-3 text-sm font-medium text-slate-600 backdrop-blur transition hover:bg-white dark:border-amber-500/20 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:bg-slate-800">
                  <FileText size={15} />
                  <span className="hidden sm:inline">範本</span>
                </span>
              }
              items={NOTE_TEMPLATES.map((t) => ({
                id: t.id,
                label: t.label,
                onSelect: () => createNote(t.body),
              }))}
            />
            <Button
              size="sm"
              variant={showStats ? 'primary' : 'secondary'}
              icon={BarChart3}
              onClick={() => setShowStats((v) => !v)}
              className="h-9 rounded-full"
            >
              <span className="hidden sm:inline">統計</span>
            </Button>
            <Button
              size="sm"
              icon={Plus}
              onClick={() => createNote()}
              className="h-9 rounded-full shadow-sm shadow-accent/25"
            >
              寫一頁
            </Button>
          </div>
        </div>
      </header>

      {showStats && <StatsPanel stats={stats} notebooks={notebooks} onPickTag={(t) => {
        setShowStats(false)
        setScope({ kind: 'all' })
        setActiveTag(t)
      }} />}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[200px_minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* ───────── 索引欄（目錄頁式：標籤分隔 + 章節列） ───────── */}
        <aside
          className={cx(
            'space-y-4 lg:block',
            mobilePane === 'detail' ? 'hidden' : 'block',
          )}
        >
          {/* 速覽 / scopes */}
          <div>
            <IndexLabel>速覽</IndexLabel>
            <nav className="space-y-0.5">
              {sidebarItems.map((it) => {
                const on = isActiveScope(it.scope)
                return (
                  <button
                    key={it.key}
                    onClick={() => {
                      setScope(it.scope)
                      setActiveTag(null)
                      setMobilePane('list')
                      exitSelect()
                    }}
                    aria-current={on ? 'page' : undefined}
                    className={cx(
                      'group flex w-full items-center gap-2.5 rounded-xl py-1.5 pl-3 pr-2.5 text-sm transition',
                      on
                        ? 'bg-accent-soft font-medium text-accent-strong shadow-xs dark:bg-accent/15 dark:text-accent'
                        : 'text-slate-600 hover:bg-amber-50/70 dark:text-slate-300 dark:hover:bg-slate-700/50',
                    )}
                  >
                    {/* 章節記號（活躍時實心 accent 條） */}
                    <span
                      aria-hidden="true"
                      className={cx(
                        'h-4 w-[3px] shrink-0 rounded-full transition',
                        on ? 'bg-accent' : 'bg-transparent group-hover:bg-amber-300/70',
                      )}
                    />
                    <it.icon size={15} className="shrink-0" />
                    <span className="flex-1 text-left">{it.label}</span>
                    {it.count > 0 && (
                      <span className="font-serif text-xs tabular-nums text-slate-400 dark:text-slate-500">
                        {it.count}
                      </span>
                    )}
                  </button>
                )
              })}
            </nav>
          </div>

          {/* 智能檢視（儲存篩選） */}
          {savedFilters.length > 0 && (
            <div>
              <IndexLabel>智能檢視</IndexLabel>
              <nav className="space-y-0.5">
                {savedFilters.map((f) => (
                  <div key={f.id} className="group/sf flex items-center">
                    <button
                      onClick={() => applySavedFilter(f)}
                      className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl py-1.5 pl-3 pr-2 text-sm text-slate-600 transition hover:bg-amber-50/70 dark:text-slate-300 dark:hover:bg-slate-700/50"
                    >
                      <Bookmark size={14} className="shrink-0 text-accent/70" />
                      <span className="flex-1 truncate text-left">{f.name}</span>
                    </button>
                    <button
                      onClick={() => savedFiltersCol.remove(f.id)}
                      aria-label={`刪除智能檢視「${f.name}」`}
                      className="ml-0.5 hidden shrink-0 rounded p-1 text-slate-300 transition hover:text-rose-500 group-hover/sf:block dark:text-slate-600"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </nav>
            </div>
          )}

          {/* 筆記本（卷冊） */}
          <div>
            <div className="flex items-center justify-between">
              <IndexLabel>卷冊</IndexLabel>
              <IconButton label="管理筆記本" size="sm" onClick={() => setNbModal(true)}>
                <FolderPlus size={15} />
              </IconButton>
            </div>
            <nav className="space-y-0.5">
              {notebooks.length === 0 && (
                <p className="px-3 py-1.5 font-serif text-xs italic text-slate-400 dark:text-slate-500">
                  撳上面 ＋，開一卷收納相關手記。
                </p>
              )}
              {notebooks.map((nb) => {
                const c = folderColorOf(nb.color)
                const on = scope.kind === 'notebook' && scope.id === nb.id
                return (
                  <button
                    key={nb.id}
                    onClick={() => {
                      setScope({ kind: 'notebook', id: nb.id })
                      setActiveTag(null)
                      setMobilePane('list')
                      exitSelect()
                    }}
                    aria-current={on ? 'page' : undefined}
                    className={cx(
                      'group flex w-full items-center gap-2.5 rounded-xl py-1.5 pl-3 pr-2.5 text-sm transition',
                      on
                        ? 'bg-amber-100/60 font-medium text-slate-800 shadow-xs dark:bg-slate-700/60 dark:text-slate-100'
                        : 'text-slate-600 hover:bg-amber-50/70 dark:text-slate-300 dark:hover:bg-slate-700/50',
                    )}
                  >
                    <span className={cx('h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white dark:ring-slate-800', c.dot)} />
                    <span className="flex-1 truncate text-left">{nb.name}</span>
                    <span className="font-serif text-xs tabular-nums text-slate-400 dark:text-slate-500">
                      {notebookCounts.get(nb.id) ?? 0}
                    </span>
                  </button>
                )
              })}
            </nav>
          </div>
        </aside>

        {/* ───────── 列表欄 ───────── */}
        <section
          className={cx(
            'min-w-0 space-y-3 lg:block',
            mobilePane === 'detail' ? 'hidden' : 'block',
          )}
        >
          {/* 列表工具列 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Input
                icon={Search}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`搜尋「${scopeTitle}」…`}
                className="flex-1"
              />
              <SegmentedControl<ViewMode>
                size="sm"
                value={view}
                onChange={setView}
                options={[
                  { id: 'list', label: '', icon: Rows3 },
                  { id: 'grid', label: '', icon: LayoutGrid },
                  { id: 'board', label: '', icon: Columns3 },
                  { id: 'table', label: '', icon: ListChecks },
                ]}
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <SortDesc size={14} className="text-slate-400" />
                <Select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  className="h-8 w-auto py-1 text-xs"
                >
                  <option value="updated">最近修改</option>
                  <option value="created">建立時間</option>
                  <option value="title">標題 A→Z</option>
                  <option value="words">字數最多</option>
                </Select>
              </div>
              <div className="flex items-center gap-1.5">
                {scope.kind === 'trash' && counts.trash > 0 && !selectMode && (
                  <Button size="sm" variant="ghost" icon={Trash2} onClick={emptyTrash}>
                    清空
                  </Button>
                )}
                {hasFilter && !selectMode && (
                  <Button size="sm" variant="ghost" icon={BookmarkPlus} onClick={saveCurrentFilter}>
                    儲存
                  </Button>
                )}
                <Button
                  size="sm"
                  variant={selectMode ? 'primary' : 'ghost'}
                  icon={CheckSquare}
                  onClick={() => (selectMode ? exitSelect() : setSelectMode(true))}
                >
                  {selectMode ? '完成' : '選取'}
                </Button>
              </div>
            </div>

            {/* 標籤列 */}
            {scopeTags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <TagIcon size={13} className="text-slate-400" />
                {scopeTags.slice(0, 12).map(({ tag, count }) => {
                  const on = activeTag?.toLowerCase() === tag.toLowerCase()
                  return (
                    <button
                      key={tag}
                      onClick={() => setActiveTag(on ? null : tag)}
                      aria-pressed={on}
                      aria-label={`標籤 ${tag}（${count}）${on ? '，已篩選' : ''}`}
                      className={cx(
                        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium transition',
                        on
                          ? 'bg-accent text-white'
                          : 'bg-accent-soft text-accent-strong hover:brightness-95 dark:bg-accent/15 dark:text-accent',
                      )}
                    >
                      #{tag}
                      <span className="tabular-nums opacity-60">{count}</span>
                    </button>
                  )
                })}
                {hasFilter && (
                  <button
                    onClick={() => {
                      setQuery('')
                      setActiveTag(null)
                    }}
                    className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <X size={12} /> 清除
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 批量操作條 */}
          {selectMode && (
            <Card className="flex flex-wrap items-center gap-2 rounded-2xl p-2">
              <span
                aria-live="polite"
                className="px-1 text-xs font-medium text-slate-500 dark:text-slate-400"
              >
                已選 <span className="tabular-nums">{checked.size}</span> /{' '}
                <span className="tabular-nums">{visible.length}</span>
              </span>
              <button
                onClick={() =>
                  setChecked(
                    checked.size === visible.length
                      ? new Set()
                      : new Set(visible.map((n) => n.id)),
                  )
                }
                className="text-xs font-medium text-accent hover:text-accent-strong"
              >
                {checked.size === visible.length && visible.length > 0
                  ? '取消全選'
                  : '全選'}
              </button>
              <div className="ml-auto flex flex-wrap items-center gap-1">
                <BulkBtn icon={Pin} label="釘選" disabled={!checked.size} onClick={() => bulkPatch({ pinned: true }, '已釘選')} />
                <BulkBtn icon={Star} label="星標" disabled={!checked.size} onClick={() => bulkPatch({ favorite: true }, '已加星標')} />
                {scope.kind !== 'archived' && scope.kind !== 'trash' && (
                  <BulkBtn icon={Archive} label="封存" disabled={!checked.size} onClick={() => bulkPatch({ archived: true, pinned: false }, '已封存')} />
                )}
                {(scope.kind === 'archived' || scope.kind === 'trash') && (
                  <BulkBtn icon={Inbox} label="還原" disabled={!checked.size} onClick={() => bulkPatch({ archived: false, trashed: false }, '已還原')} />
                )}
                <BulkBtn icon={Download} label="匯出" disabled={!checked.size} onClick={bulkExport} />
                <BulkBtn icon={Trash2} label="刪除" tone="danger" disabled={!checked.size} onClick={bulkDelete} />
              </div>
            </Card>
          )}

          {/* 列表本體 */}
          {visible.length === 0 ? (
            <EmptyState
              icon={scope.kind === 'trash' ? Trash2 : hasFilter ? Search : FileText}
              art={
                !hasFilter && (scope.kind === 'all' || scope.kind === 'notebook')
                  ? 'empty-notes'
                  : undefined
              }
              title={
                hasFilter
                  ? '揭唔到相符嘅一頁'
                  : scope.kind === 'trash'
                    ? '廢紙簍乾乾淨淨'
                    : scope.kind === 'archived'
                      ? '未有收起嘅手記'
                      : '由空白一頁開始'
              }
              hint={
                hasFilter
                  ? '試下換個關鍵字，或者清除標籤篩選。'
                  : scope.kind === 'all' || scope.kind === 'notebook'
                    ? '記低靈感、課堂重點或者待辦——用 #標籤 歸類、- [ ] 整待辦，一頁一頁儲成你自己嘅手稿。'
                    : undefined
              }
              action={
                !hasFilter && (scope.kind === 'all' || scope.kind === 'notebook') ? (
                  <Button size="sm" icon={Pencil} onClick={() => createNote()}>
                    落筆寫第一頁
                  </Button>
                ) : undefined
              }
            />
          ) : view === 'board' ? (
            <NoteBoard
              notes={visible}
              notebooks={notebooks}
              selectedId={selectedId}
              onOpen={openNote}
            />
          ) : view === 'table' ? (
            <NoteTable
              notes={visible}
              notebooks={notebooks}
              selectedId={selectedId}
              onOpen={openNote}
            />
          ) : (
            <div
              className={cx(
                view === 'grid'
                  ? 'grid grid-cols-1 gap-2 sm:grid-cols-2'
                  : 'space-y-2',
              )}
            >
              {visible.map((n, i) => (
                <div
                  key={n.id}
                  className="animate-fade-in-up"
                  style={{ animationDelay: `${Math.min(i, 10) * 35}ms` }}
                >
                  <NoteRow
                    note={n}
                    grid={view === 'grid'}
                    active={n.id === selectedId && !selectMode}
                    selectMode={selectMode}
                    checked={checked.has(n.id)}
                    onToggleCheck={() => toggleCheck(n.id)}
                    onOpen={() => openNote(n.id)}
                  />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ───────── 編輯欄 ───────── */}
        <section
          className={cx(
            'min-w-0 lg:block',
            mobilePane === 'detail' ? 'block' : 'hidden',
          )}
        >
          {selected ? (
            <Card className="flex h-full min-h-[28rem] flex-col rounded-3xl border-amber-200/60 p-3 dark:border-amber-500/15 sm:p-4">
              <button
                onClick={() => setMobilePane('list')}
                className="mb-2 inline-flex items-center gap-1 self-start text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 lg:hidden"
              >
                <ChevronLeft size={14} /> 返回目錄
              </button>
              <Editor
                note={selected}
                notebooks={notebooks}
                allNotes={notes}
                onOpenLink={openLink}
                onOpenNote={revealNote}
                onClose={() => setMobilePane('list')}
              />
            </Card>
          ) : (
            <div className="relative hidden h-full min-h-[28rem] items-center justify-center overflow-hidden rounded-3xl border border-amber-200/60 bg-gradient-to-br from-amber-50/60 via-white to-white p-6 dark:border-amber-500/15 dark:from-amber-500/[0.05] dark:via-slate-800 dark:to-slate-800 lg:flex">
              {/* 稿紙橫線（極淡） */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 opacity-[0.45] dark:opacity-30"
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(to bottom, transparent 0, transparent 33px, rgb(180 150 100 / 0.16) 33px, rgb(180 150 100 / 0.16) 34px)',
                }}
              />
              <div className="relative max-w-xs text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent-strong shadow-sm dark:bg-accent/15 dark:text-accent">
                  <PenLine size={24} />
                </span>
                <p className="mt-4 font-serif text-lg font-semibold text-slate-700 dark:text-slate-200">
                  攤開一頁，由呢度書寫
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  揀左邊任何一頁手記翻開，或者開一張全新稿紙。
                </p>
                <div className="mt-4">
                  <Button size="sm" icon={Pencil} onClick={() => createNote()}>
                    寫一頁
                  </Button>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      {nbModal && (
        <NotebookManager notebooks={notebooks} onClose={() => setNbModal(false)} />
      )}
    </div>
  )
}

// ───────── 索引欄章節標題（目錄頁式：小帽 + 漸隱橫線） ─────────
function IndexLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mb-1.5 flex items-center gap-2 px-1">
      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
        {children}
      </span>
      <span
        aria-hidden="true"
        className="h-px flex-1 bg-gradient-to-r from-amber-300/50 to-transparent dark:from-amber-500/25"
      />
    </div>
  )
}

// ───────── 批量操作小按鈕 ─────────
function BulkBtn({
  icon: I,
  label,
  onClick,
  disabled,
  tone = 'default',
}: {
  icon: typeof Pin
  label: string
  onClick: () => void
  disabled?: boolean
  tone?: 'default' | 'danger'
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cx(
        'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40',
        tone === 'danger'
          ? 'text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10'
          : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700',
      )}
    >
      <I size={14} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}

// ───────── 筆記列 / 卡 ─────────
function NoteRow({
  note,
  grid,
  active,
  selectMode,
  checked,
  onToggleCheck,
  onOpen,
}: {
  note: RichNote
  grid: boolean
  active: boolean
  selectMode: boolean
  checked: boolean
  onToggleCheck: () => void
  onOpen: () => void
}) {
  const tags = parseTags(note.content)
  const check = checklistStat(note.content)
  const color = noteColorOf(note.color)
  const title = deriveTitle(note)
  const sn = snippet(note.content)

  return (
    <button
      onClick={selectMode ? onToggleCheck : onOpen}
      aria-pressed={selectMode ? checked : undefined}
      aria-current={!selectMode && active ? 'true' : undefined}
      className={cx(
        'group relative block w-full overflow-hidden rounded-2xl border pl-5 pr-4 py-3.5 text-left transition duration-200',
        color.card ||
          'border-slate-200/80 bg-white dark:border-slate-700/60 dark:bg-slate-800',
        active
          ? 'border-accent/50 shadow-sm ring-1 ring-accent/40 dark:border-accent/50'
          : 'hover:-translate-y-0.5 hover:border-amber-300/70 hover:shadow-md dark:hover:border-slate-600',
        grid && 'h-full',
      )}
    >
      {/* 手稿頁邊裝訂線（活躍 = accent，平時淡琥珀） */}
      <span
        aria-hidden="true"
        className={cx(
          'pointer-events-none absolute inset-y-3 left-2 w-px transition-colors',
          active
            ? 'bg-accent/50'
            : 'bg-amber-300/40 group-hover:bg-amber-400/60 dark:bg-amber-500/25',
        )}
      />
      <div className="flex items-start gap-2.5">
        {selectMode && (
          <span
            aria-hidden="true"
            className={cx(
              'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-md border text-[10px] transition',
              checked
                ? 'border-accent bg-accent text-white'
                : 'border-slate-300 dark:border-slate-600',
            )}
          >
            {checked && '✓'}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {note.pinned && (
              <Pin size={12} className="shrink-0 fill-current text-accent" />
            )}
            {note.favorite && (
              <Star size={12} className="shrink-0 fill-current text-amber-500" />
            )}
            <span className="truncate font-serif text-[16px] font-semibold leading-snug text-slate-800 dark:text-slate-100">
              {title}
            </span>
          </div>
          {sn && (
            <p
              className={cx(
                'mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400',
                grid ? 'line-clamp-3' : 'line-clamp-2',
              )}
            >
              {sn}
            </p>
          )}
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {check.total > 0 && (
          <Badge tone={check.done === check.total ? 'green' : 'slate'}>
            <ListChecks size={11} />
            <span className="tabular-nums">
              {check.done}/{check.total}
            </span>
          </Badge>
        )}
        {tags.slice(0, grid ? 4 : 2).map((t) => (
          <span
            key={t}
            className="rounded-md bg-accent-soft px-1.5 py-0.5 text-[10px] font-medium text-accent-strong dark:bg-accent/15 dark:text-accent"
          >
            #{t}
          </span>
        ))}
        {tags.length > (grid ? 4 : 2) && (
          <span className="text-[10px] text-slate-400">+{tags.length - (grid ? 4 : 2)}</span>
        )}
        <span className="ml-auto font-serif text-[11px] italic tabular-nums text-slate-400 dark:text-slate-500">
          {relativeTime(note.updatedAt)}
        </span>
      </div>
    </button>
  )
}

// ───────── 表格視圖 ─────────
function NoteTable({
  notes,
  notebooks,
  selectedId,
  onOpen,
}: {
  notes: RichNote[]
  notebooks: Notebook[]
  selectedId: string | null
  onOpen: (id: string) => void
}) {
  const nbName = (id: string | null) =>
    id ? (notebooks.find((n) => n.id === id)?.name ?? '未分類') : '未分類'
  return (
    <Table>
      <Thead>
        <Tr>
          <Th>標題</Th>
          <Th>筆記本</Th>
          <Th align="center">待辦</Th>
          <Th align="right">字數</Th>
          <Th align="right">修改</Th>
        </Tr>
      </Thead>
      <Tbody>
        {notes.map((n) => {
          const check = checklistStat(n.content)
          return (
            <Tr key={n.id} onClick={() => onOpen(n.id)}>
              <Td>
                <button
                  type="button"
                  onClick={() => onOpen(n.id)}
                  aria-current={n.id === selectedId ? 'true' : undefined}
                  className="flex items-center gap-1.5 text-left"
                >
                  {n.pinned && <Pin size={12} className="fill-current text-accent" />}
                  {n.favorite && (
                    <Star size={12} className="fill-current text-amber-500" />
                  )}
                  <span
                    className={cx(
                      'truncate font-medium',
                      n.id === selectedId && 'text-accent-strong dark:text-accent',
                    )}
                  >
                    {deriveTitle(n)}
                  </span>
                </button>
              </Td>
              <Td>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {nbName(n.notebookId)}
                </span>
              </Td>
              <Td align="center">
                {check.total > 0 ? (
                  <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
                    {check.done}/{check.total}
                  </span>
                ) : (
                  <span className="text-slate-300 dark:text-slate-600">—</span>
                )}
              </Td>
              <Td numeric>{wordCount(n.content)}</Td>
              <Td numeric>
                <span className="text-xs text-slate-400">{relativeTime(n.updatedAt)}</span>
              </Td>
            </Tr>
          )
        })}
      </Tbody>
    </Table>
  )
}

// ───────── 看板視圖（按卷冊分欄）─────────
function NoteBoard({
  notes,
  notebooks,
  selectedId,
  onOpen,
}: {
  notes: RichNote[]
  notebooks: Notebook[]
  selectedId: string | null
  onOpen: (id: string) => void
}) {
  const columns: { id: string | null; name: string; color: string }[] = [
    { id: null, name: '未分類', color: 'slate' },
    ...notebooks.map((nb) => ({ id: nb.id as string | null, name: nb.name, color: nb.color })),
  ]
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {columns.map((col) => {
        const items = notes.filter((n) => (n.notebookId ?? null) === col.id)
        const c = folderColorOf(col.color)
        return (
          <div
            key={col.id ?? '__none'}
            className="flex w-64 shrink-0 flex-col rounded-2xl border border-slate-200/70 bg-slate-50/60 p-2 dark:border-slate-700/60 dark:bg-slate-900/30"
          >
            <div className="mb-2 flex items-center gap-2 px-1.5 py-1">
              <span className={cx('h-2.5 w-2.5 shrink-0 rounded-full', c.dot)} />
              <span className="flex-1 truncate text-sm font-semibold text-slate-700 dark:text-slate-200">
                {col.name}
              </span>
              <span className="font-serif text-xs tabular-nums text-slate-400 dark:text-slate-500">
                {items.length}
              </span>
            </div>
            <div className="space-y-2">
              {items.map((n) => (
                <NoteRow
                  key={n.id}
                  note={n}
                  grid
                  active={n.id === selectedId}
                  selectMode={false}
                  checked={false}
                  onToggleCheck={() => {}}
                  onOpen={() => onOpen(n.id)}
                />
              ))}
              {items.length === 0 && (
                <p className="px-2 py-4 text-center text-xs italic text-slate-400 dark:text-slate-500">
                  （空）
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ───────── 統計面板 ─────────
function StatsPanel({
  stats,
  notebooks,
  onPickTag,
}: {
  stats: ReturnType<typeof computeStats>
  notebooks: Notebook[]
  onPickTag: (tag: string) => void
}) {
  const trendDir: 'up' | 'down' | 'flat' =
    stats.last7 > stats.prev7 ? 'up' : stats.last7 < stats.prev7 ? 'down' : 'flat'
  const trendVal =
    stats.prev7 === 0
      ? stats.last7 > 0
        ? '新增'
        : '持平'
      : `${stats.last7 - stats.prev7 >= 0 ? '+' : ''}${stats.last7 - stats.prev7}`

  const donut: DonutSlice[] = useMemo(() => {
    const slices: DonutSlice[] = stats.notebookDist
      .map((d) => {
        const nb = notebooks.find((n) => n.id === d.id)
        return {
          label: nb?.name ?? '未分類',
          value: d.count,
          color: nb?.color ?? 'slate',
        }
      })
      .sort((a, b) => b.value - a.value)
    return slices
  }, [stats.notebookDist, notebooks])

  const todoPct = stats.todoTotal
    ? Math.round((stats.todoDone / stats.todoTotal) * 100)
    : 0

  return (
    <Card className="space-y-5 rounded-3xl border-amber-200/60 p-3 dark:border-amber-500/15 sm:p-4">
      {/* KPI */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard
          label="筆記總數"
          value={stats.total}
          icon={FileText}
          trend={{ value: trendVal, dir: trendDir }}
          hint={`過去 7 日 +${stats.last7}`}
        />
        <StatCard
          label="總字數"
          value={stats.totalWords.toLocaleString()}
          icon={Sparkles}
          hint={`平均 ${stats.avgWords} 字/則`}
        />
        <StatCard
          label="待辦完成"
          value={stats.todoTotal ? `${todoPct}%` : '—'}
          icon={ListChecks}
          highlight={stats.todoTotal > 0 && todoPct === 100}
          hint={`${stats.todoDone}/${stats.todoTotal} 項`}
        />
        <StatCard
          label="活躍日數"
          value={stats.activeDays}
          unit="/ 30"
          icon={trendDir === 'down' ? TrendingDown : TrendingUp}
          hint={`${stats.tagCount} 個標籤`}
        />
      </div>

      {/* 活躍折線圖 */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <StatsHeading>過去 30 日新增</StatsHeading>
          <Badge tone="slate">
            共 <span className="tabular-nums">{stats.daily.reduce((s, d) => s + d.count, 0)}</span> 則
          </Badge>
        </div>
        <ActivityChart daily={stats.daily} />
      </div>

      {/* 標籤 + 筆記本分佈 */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <StatsHeading className="mb-2">熱門標籤</StatsHeading>
          <TagBars tags={stats.topTags} onPick={onPickTag} />
        </div>
        <div>
          <StatsHeading className="mb-2">卷冊分佈</StatsHeading>
          <DonutChart slices={donut} />
        </div>
      </div>
    </Card>
  )
}

// ───────── 統計小標（稿紙風：serif + 短紅尺） ─────────
function StatsHeading({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cx(
        'flex items-center gap-2 font-serif text-sm font-semibold text-slate-700 dark:text-slate-200',
        className,
      )}
    >
      <span aria-hidden="true" className="h-3.5 w-[3px] rounded-full bg-accent/60" />
      {children}
    </span>
  )
}

// ───────── 筆記本管理 Modal ─────────
function NotebookManager({
  notebooks,
  onClose,
}: {
  notebooks: Notebook[]
  onClose: () => void
}) {
  const toast = useToast()
  const confirm = useConfirm()
  const [name, setName] = useState('')
  const [color, setColor] = useState<FolderColor>('accent')

  function add() {
    const n = name.trim()
    if (!n) return
    notebooksCol.add({ name: n, color, createdAt: new Date().toISOString() })
    setName('')
    toast.success('已新增筆記本')
  }

  async function del(nb: Notebook) {
    const ok = await confirm({
      title: '刪除筆記本？',
      message: `「${nb.name}」會被刪除，入面嘅筆記會變成未分類（仍保留）。`,
      confirmText: '刪除',
      tone: 'danger',
    })
    if (!ok) return
    // 把該筆記本嘅筆記設為未分類
    const now = new Date().toISOString()
    richNotesCol
      .get()
      .filter((x) => x.notebookId === nb.id)
      .forEach((x) => richNotesCol.update(x.id, { notebookId: null, updatedAt: now }))
    notebooksCol.remove(nb.id)
    toast.success('已刪除筆記本')
  }

  return (
    <Modal open onClose={onClose} title="管理筆記本" size="md">
      <div className="space-y-2">
        {notebooks.map((nb) => (
          <div
            key={nb.id}
            className="rounded-xl border border-slate-200 p-2.5 dark:border-slate-700"
          >
            <div className="flex items-center gap-2">
              <span className={cx('h-3.5 w-3.5 shrink-0 rounded-full', folderColorOf(nb.color).dot)} />
              <Input
                value={nb.name}
                onChange={(e) => notebooksCol.update(nb.id, { name: e.target.value })}
                className="flex-1"
              />
              <IconButton label="刪除筆記本" tone="danger" onClick={() => del(nb)}>
                <Trash2 size={18} />
              </IconButton>
            </div>
            <div className="mt-2 pl-0.5">
              <Pills<FolderColor>
                size="sm"
                options={FOLDER_COLOR_LABELS}
                active={nb.color as FolderColor}
                onChange={(c) => notebooksCol.update(nb.id, { color: c })}
              />
            </div>
          </div>
        ))}

        {/* 新增 */}
        <div className="rounded-xl border border-dashed border-slate-300 p-2.5 dark:border-slate-600">
          <div className="flex items-center gap-2">
            <span className={cx('h-3.5 w-3.5 shrink-0 rounded-full', folderColorOf(color).dot)} />
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()}
              placeholder="新筆記本名稱"
              className="flex-1"
            />
            <Button size="sm" icon={Folder} onClick={add} disabled={!name.trim()}>
              新增
            </Button>
          </div>
          <div className="mt-2 pl-0.5">
            <Pills<FolderColor>
              size="sm"
              options={FOLDER_COLOR_LABELS}
              active={color}
              onChange={setColor}
            />
          </div>
        </div>
      </div>
    </Modal>
  )
}
