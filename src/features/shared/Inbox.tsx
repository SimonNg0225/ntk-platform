import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  Inbox as InboxIcon,
  Plus,
  Search,
  Pin,
  PinOff,
  Trash2,
  Archive,
  ArchiveRestore,
  Hash,
  Sparkles,
  Loader2,
  BarChart3,
  ArrowRight,
  CheckSquare,
  X,
  Layers,
  Lightbulb,
  AlertTriangle,
  ChevronDown,
} from 'lucide-react'
import { useCollection } from '../../lib/store'
import {
  inboxCol,
  tasksCol,
  notesCol,
  eventsCol,
  questionsCol,
  countdownsCol,
  topicsCol,
} from '../../data/collections'
import type { CountdownCategory } from '../../data/types'
import {
  Button,
  Input,
  Textarea,
  Card,
  Badge,
  EmptyState,
  SectionTitle,
  StatCard,
  Tabs,
  Pills,
  Menu,
  IconButton,
  Tooltip,
  Kbd,
  Separator,
  Field,
  Modal,
  cx,
} from '../../ui'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import { useMode } from '../../context/ModeContext'
import { useNav } from '../../context/NavContext'
import { useAuth } from '../../context/AuthContext'
import { isAIConfigured } from '../../lib/aiClient'
import {
  inboxMetaCol,
  setKind,
  togglePinned,
  archive,
  restore,
  dropMeta,
  setAiSuggestion,
} from './inbox/store'
import {
  KINDS,
  KIND_ICON,
  KIND_TONE,
  kindLabel,
  kindDef,
  parseTags,
  stripTags,
  relativeTime,
  fullTime,
  dayKey,
  dayGroupLabel,
  buildRow,
  sortRows,
  computeStats,
  allTags,
  guessKind,
  type InboxRow,
} from './inbox/util'
import type { InboxKind } from './inbox/types'
import { aiTriage } from './inbox/ai'
import { CaptureTrend, KindBars } from './inbox/Charts'

// ============================================================
//  快速擷取 Inbox（GTD triage）— Things 3 / Todoist Inbox 級
//  ------------------------------------------------------------
//  擷取 → 整理（triage）→ 一鍵轉待辦 / 筆記 / 行事曆 / 題庫 / 倒數。
//  鍵盤驅動（j/k 導航、1-6 分類、e 歸檔…）、批量、搜尋、標籤、
//  離線啟發式 + AI 分類建議、統計圖表、軟歸檔可還原。
//  只讀寫共用 col（公開 API）；GTD meta 存自家 inbox_meta_v2。
// ============================================================

const FILTER_TABS = [
  { id: 'inbox' as const, label: '待處理' },
  { id: 'archived' as const, label: '已歸檔' },
]
type FilterTab = (typeof FILTER_TABS)[number]['id']

const COUNTDOWN_CAT: Record<InboxKind, CountdownCategory> = {
  task: 'other',
  note: 'other',
  event: 'event',
  question: 'other',
  countdown: 'deadline',
  reference: 'other',
}

export default function Inbox() {
  const items = useCollection(inboxCol)
  const metas = useCollection(inboxMetaCol)
  const toast = useToast()
  const confirm = useConfirm()
  const { mode } = useMode()
  const nav = useNav()
  const { user } = useAuth()

  const [text, setText] = useState('')
  const [tab, setTab] = useState<FilterTab>('inbox')
  const [search, setSearch] = useState('')
  const [kindFilter, setKindFilter] = useState<InboxKind | 'all'>('all')
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [cursor, setCursor] = useState(0) // 鍵盤聚焦索引
  const [showStats, setShowStats] = useState(false)
  const [aiBusy, setAiBusy] = useState(false)
  const [eventDraft, setEventDraft] = useState<{ row: InboxRow } | null>(null)

  const captureRef = useRef<HTMLTextAreaElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const focusSearch = useCallback(() => {
    document.getElementById('inbox-search')?.focus()
  }, [])

  // ── 合併 item + meta，建 row ──────────────────────────────
  const metaById = useMemo(() => {
    const m = new Map(metas.map((x) => [x.id, x]))
    return m
  }, [metas])

  const allRows = useMemo(
    () => items.map((it) => buildRow(it, metaById.get(it.id))),
    [items, metaById],
  )

  const tagOptions = useMemo(() => allTags(allRows), [allRows])
  const stats = useMemo(() => computeStats(allRows), [allRows])

  // ── 過濾（tab / kind / tag / 文字）+ 排序 ─────────────────
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return allRows
      .filter((r) => (tab === 'archived' ? r.archived : !r.archived))
      .filter((r) => kindFilter === 'all' || r.kind === kindFilter)
      .filter((r) => !tagFilter || r.tags.includes(tagFilter))
      .filter(
        (r) =>
          !q ||
          r.item.text.toLowerCase().includes(q) ||
          r.tags.some((t) => t.includes(q)),
      )
      .sort(sortRows)
  }, [allRows, tab, kindFilter, tagFilter, search])

  // 分組（按日）
  const groups = useMemo(() => {
    const out: { key: string; label: string; rows: InboxRow[] }[] = []
    for (const r of visible) {
      const k = dayKey(r.item.createdAt)
      let g = out.find((x) => x.key === k)
      if (!g) {
        g = { key: k, label: dayGroupLabel(k), rows: [] }
        out.push(g)
      }
      g.rows.push(r)
    }
    return out
  }, [visible])

  // 扁平次序（畀鍵盤導航）
  const flat = useMemo(() => visible, [visible])

  // cursor 越界修正
  useEffect(() => {
    if (cursor >= flat.length) setCursor(Math.max(0, flat.length - 1))
  }, [flat.length, cursor])

  // ── 擷取 ─────────────────────────────────────────────────
  const livePreviewTags = useMemo(() => parseTags(text), [text])
  const livePreviewKind = useMemo(
    () => (text.trim() ? guessKind(text) : null),
    [text],
  )

  const capture = useCallback(() => {
    const value = text.trim()
    if (!value) return
    inboxCol.add({ text: value, mode, createdAt: new Date().toISOString() })
    setText('')
    setTab('inbox')
    captureRef.current?.focus()
  }, [text, mode])

  // ── 轉換邏輯 ─────────────────────────────────────────────
  function convert(row: InboxRow, kind: InboxKind) {
    const clean = stripTags(row.item.text) || row.item.text
    const tagSuffix = row.tags.length ? ` ${row.tags.map((t) => '#' + t).join(' ')}` : ''
    const iso = new Date().toISOString()

    if (kind === 'task') {
      tasksCol.add({ text: clean + tagSuffix, done: false, createdAt: iso })
    } else if (kind === 'note') {
      notesCol.add({ content: row.item.text, createdAt: iso })
    } else if (kind === 'question') {
      const firstTopic = topicsCol.get()[0]
      questionsCol.add({
        topicId: firstTopic?.id ?? '',
        type: 'short',
        difficulty: 'medium',
        stem: clean,
        tags: row.tags,
        createdAt: iso,
      })
    } else if (kind === 'event') {
      // 行事曆需要日期 → 開抽屜畀用家揀（見 eventDraft）
      setEventDraft({ row })
      return
    } else if (kind === 'countdown') {
      countdownsCol.add({
        title: clean,
        date: dayKey(new Date(Date.now() + 7 * 864e5).toISOString()),
        category: COUNTDOWN_CAT[kind],
        mode: 'both',
        createdAt: iso,
      })
    }
    // reference 或其餘：純歸檔
    archive(row.item.id, kind)
    const def = kindDef(kind)
    toast.success(
      kind === 'reference' ? '已歸檔為參考' : `已${def.short}`,
    )
    setSelected((s) => {
      const n = new Set(s)
      n.delete(row.item.id)
      return n
    })
  }

  // 行事曆抽屜：填好日期 / 時間先建立
  function confirmEvent(date: string, time: string, allDay: boolean) {
    if (!eventDraft) return
    const row = eventDraft.row
    const clean = stripTags(row.item.text) || row.item.text
    eventsCol.add({
      title: clean,
      date,
      time: allDay ? undefined : time || undefined,
      allDay,
      mode: 'both',
      notes: row.tags.length ? row.tags.map((t) => '#' + t).join(' ') : undefined,
    })
    archive(row.item.id, 'event')
    toast.success('已加入行事曆')
    setEventDraft(null)
    setSelected((s) => {
      const n = new Set(s)
      n.delete(row.item.id)
      return n
    })
  }

  // ── 單項操作 ─────────────────────────────────────────────
  const remove = useCallback(
    async (id: string) => {
      const ok = await confirm({
        title: '永久刪除？',
        message: '此項目會直接刪走，無法復原。如果只係想清走 inbox，建議用「歸檔」。',
        confirmText: '刪除',
        tone: 'danger',
      })
      if (!ok) return
      inboxCol.remove(id)
      dropMeta(id)
      setSelected((s) => {
        const n = new Set(s)
        n.delete(id)
        return n
      })
      toast.success('已刪除')
    },
    [confirm, toast],
  )

  function toggleSelect(id: string) {
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  // ── 批量操作 ─────────────────────────────────────────────
  const selectedRows = useMemo(
    () => visible.filter((r) => selected.has(r.item.id)),
    [visible, selected],
  )

  function bulkConvert(kind: InboxKind) {
    if (kind === 'event') {
      toast.info('行事曆需要逐項填日期，請喺項目度逐個轉。')
      return
    }
    const rows = selectedRows
    rows.forEach((r) => convert(r, kind))
    if (rows.length)
      toast.success(`已將 ${rows.length} 項${kindDef(kind).short}`)
    setSelected(new Set())
    setSelectMode(false)
  }

  function bulkArchive() {
    selectedRows.forEach((r) => archive(r.item.id))
    toast.success(`已歸檔 ${selectedRows.length} 項`)
    setSelected(new Set())
    setSelectMode(false)
  }

  async function bulkDelete() {
    const n = selectedRows.length
    if (!n) return
    const ok = await confirm({
      title: `永久刪除 ${n} 項？`,
      message: '此動作無法復原。',
      confirmText: '刪除',
      tone: 'danger',
    })
    if (!ok) return
    selectedRows.forEach((r) => {
      inboxCol.remove(r.item.id)
      dropMeta(r.item.id)
    })
    toast.success(`已刪除 ${n} 項`)
    setSelected(new Set())
    setSelectMode(false)
  }

  function selectAllVisible() {
    setSelected(new Set(visible.map((r) => r.item.id)))
  }

  // ── AI 批量分類建議 ──────────────────────────────────────
  async function runAiTriage() {
    const pending = allRows.filter((r) => !r.archived).slice(0, 40)
    if (!pending.length) {
      toast.info('冇待處理項目可以分類。')
      return
    }
    setAiBusy(true)
    try {
      const result = await aiTriage(pending.map((r) => r.item.text))
      let n = 0
      result.forEach((v, i) => {
        const row = pending[i]
        if (row) {
          setAiSuggestion(row.item.id, v.kind, v.why)
          n++
        }
      })
      toast.success(n ? `AI 已為 ${n} 項建議分類` : 'AI 未能分類，請再試。')
    } catch (e) {
      toast.error((e as Error).message || 'AI 分類失敗')
    } finally {
      setAiBusy(false)
    }
  }

  // 接納某項 AI 建議
  function acceptAi(row: InboxRow) {
    if (row.meta?.aiKind) setKind(row.item.id, row.meta.aiKind)
  }
  function acceptAllAi() {
    let n = 0
    for (const r of visible) {
      if (!r.archived && r.meta?.aiKind && r.guessed) {
        setKind(r.item.id, r.meta.aiKind)
        n++
      }
    }
    toast.success(n ? `已套用 ${n} 項 AI 建議` : '冇可套用嘅建議')
  }

  // ── 全域鍵盤導航 ────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName
      const typing = tag === 'INPUT' || tag === 'TEXTAREA'
      // '/' 聚焦搜尋（非輸入中）
      if (e.key === '/' && !typing) {
        e.preventDefault()
        focusSearch()
        return
      }
      // 'c' 聚焦擷取框
      if (e.key === 'c' && !typing && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        captureRef.current?.focus()
        return
      }
      if (typing) return
      if (!flat.length) return
      const row = flat[Math.min(cursor, flat.length - 1)]

      // 導航
      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault()
        setCursor((c) => Math.min(c + 1, flat.length - 1))
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault()
        setCursor((c) => Math.max(c - 1, 0))
      } else if (e.key >= '1' && e.key <= '6' && row && !row.archived) {
        // 1-6 → 分類並轉換
        e.preventDefault()
        const kind = KINDS[Number(e.key) - 1]?.id
        if (kind) convert(row, kind)
      } else if ((e.key === 'e' || e.key === 'Backspace') && row && !row.archived) {
        e.preventDefault()
        archive(row.item.id)
        toast.success('已歸檔')
      } else if (e.key === 'p' && row) {
        e.preventDefault()
        togglePinned(row.item.id, row.pinned)
      } else if (e.key === 'x' && row) {
        e.preventDefault()
        if (!selectMode) setSelectMode(true)
        toggleSelect(row.item.id)
      } else if (e.key === 'u' && row && row.archived) {
        e.preventDefault()
        restore(row.item.id)
        toast.success('已還原')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flat, cursor, selectMode])

  // cursor 行捲入畫面
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-row-idx="${cursor}"]`,
    )
    el?.scrollIntoView({ block: 'nearest' })
  }, [cursor])

  const aiSuggestable = useMemo(
    () => visible.some((r) => !r.archived && r.meta?.aiKind && r.guessed),
    [visible],
  )

  // ──────────────────────────────────────────────────────────
  return (
    <div className="mx-auto w-full max-w-3xl p-4 sm:p-6">
      {/* 標題 */}
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
            <InboxIcon size={18} />
          </span>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-slate-800 dark:text-slate-100">
              快速擷取 Inbox
            </h1>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              一秒掉低諗法，之後逐項整理（triage）成行動。
            </p>
          </div>
        </div>
        <Tooltip label={showStats ? '收起統計' : '展開統計'}>
          <IconButton
            label="統計"
            active={showStats}
            onClick={() => setShowStats((v) => !v)}
          >
            <BarChart3 size={18} />
          </IconButton>
        </Tooltip>
      </header>

      {/* 擷取框 */}
      <Card className="p-3 sm:p-4">
        <Textarea
          ref={captureRef}
          value={text}
          autoFocus
          rows={2}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              capture()
            }
          }}
          placeholder="掉低一個諗法⋯⋯（可用 #標籤；⌘/Ctrl + Enter 擷取）"
          className="min-h-0 resize-none border-0 bg-transparent px-0 shadow-none focus:ring-0 dark:bg-transparent"
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {livePreviewKind && (
              <Badge tone={KIND_TONE[livePreviewKind]} icon={KIND_ICON[livePreviewKind]}>
                {kindLabel(livePreviewKind)}
              </Badge>
            )}
            {livePreviewTags.map((t) => (
              <Badge key={t} tone="slate" icon={Hash}>
                {t}
              </Badge>
            ))}
            {!text.trim() && (
              <span className="text-xs text-slate-400 dark:text-slate-500">
                按 <Kbd>c</Kbd> 快速擷取 · <Kbd>/</Kbd> 搜尋
              </span>
            )}
          </div>
          <Button
            type="button"
            size="sm"
            icon={Plus}
            onClick={capture}
            disabled={!text.trim()}
            className="shrink-0"
          >
            擷取
          </Button>
        </div>
      </Card>

      {/* 統計面板 */}
      {showStats && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="待處理" value={stats.inboxCount} icon={InboxIcon} highlight />
          <StatCard label="今日擷取" value={stats.todayCaptured} icon={Plus} />
          <StatCard label="近 7 日" value={stats.weekCaptured} icon={BarChart3} />
          <StatCard label="已歸檔" value={stats.archivedCount} icon={Archive} />
        </div>
      )}
      {showStats && (
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <Card className="p-4">
            <SectionTitle icon={BarChart3}>擷取趨勢</SectionTitle>
            <CaptureTrend data={stats.perDay} />
          </Card>
          <Card className="p-4">
            <SectionTitle icon={Layers}>分類分布</SectionTitle>
            <KindBars
              byKind={stats.byKind}
              onPick={(k) => {
                setKindFilter(k)
                setTab('inbox')
              }}
            />
          </Card>
        </div>
      )}
      {showStats && stats.oldestInboxIso && stats.inboxCount > 0 && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
          <AlertTriangle size={14} className="shrink-0" />
          <span>
            最舊一項已喺 inbox 放咗{' '}
            <span className="font-semibold tabular-nums">
              {relativeTime(stats.oldestInboxIso)}
            </span>
            ，記得抽時間清空 inbox。
          </span>
        </div>
      )}

      {/* 工具列：tabs + 搜尋 + AI */}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="sm:w-48">
          <Tabs tabs={FILTER_TABS} active={tab} onChange={setTab} size="sm" />
        </div>
        <div className="flex-1">
          <Input
            id="inbox-search"
            icon={Search}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜尋擷取內容或 #標籤…"
          />
        </div>
        {isAIConfigured && user && tab === 'inbox' && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            icon={aiBusy ? Loader2 : Sparkles}
            onClick={runAiTriage}
            disabled={aiBusy}
            className="shrink-0"
          >
            {aiBusy ? 'AI 分類中' : 'AI 建議分類'}
          </Button>
        )}
      </div>

      {/* 過濾 chips（kind + tag） */}
      {(tagOptions.length > 0 || kindFilter !== 'all' || tagFilter) && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Pills
            options={[
              { id: 'all', label: '全部' },
              ...KINDS.map((k) => ({ id: k.id, label: kindLabel(k.id) })),
            ]}
            active={kindFilter}
            onChange={(id) => setKindFilter(id as InboxKind | 'all')}
            size="sm"
            counts={{
              all: tab === 'inbox' ? stats.inboxCount : stats.archivedCount,
              ...stats.byKind,
            }}
          />
          {tagOptions.length > 0 && (
            <Menu
              align="start"
              trigger={
                <span
                  className={cx(
                    'inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition',
                    tagFilter
                      ? 'bg-accent text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
                  )}
                >
                  <Hash size={12} />
                  {tagFilter ?? '標籤'}
                  {tagFilter && (
                    <X
                      size={12}
                      onClick={(e) => {
                        e.stopPropagation()
                        setTagFilter(null)
                      }}
                    />
                  )}
                </span>
              }
              items={tagOptions.map((t) => ({
                id: t,
                label: '#' + t,
                icon: Hash,
                onSelect: () => setTagFilter(t),
              }))}
            />
          )}
        </div>
      )}

      {/* AI「全部套用」橫幅 */}
      {aiSuggestable && (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-accent/20 bg-accent-soft px-3 py-2 dark:border-accent/25 dark:bg-accent/10">
          <span className="flex items-center gap-1.5 text-xs text-accent-strong dark:text-accent">
            <Lightbulb size={14} className="shrink-0" />
            AI 已為部分項目建議分類，可逐項接納或一次過套用。
          </span>
          <Button type="button" size="sm" onClick={acceptAllAi} className="shrink-0">
            全部套用
          </Button>
        </div>
      )}

      {/* 批量工具列 */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge tone="accent">
            {tab === 'inbox' ? '待處理' : '已歸檔'} {visible.length} 項
          </Badge>
          {selectMode && selected.size > 0 && (
            <Badge tone="blue">已選 {selected.size}</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {selectMode ? (
            <>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={selectAllVisible}
              >
                全選
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setSelectMode(false)
                  setSelected(new Set())
                }}
              >
                取消
              </Button>
            </>
          ) : (
            visible.length > 0 && (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                icon={CheckSquare}
                onClick={() => setSelectMode(true)}
              >
                批量
              </Button>
            )
          )}
        </div>
      </div>

      {/* 批量動作條（有選擇時） */}
      {selectMode && selected.size > 0 && (
        <Card className="mt-2 flex flex-wrap items-center gap-2 p-2.5">
          <span className="px-1 text-xs text-slate-500 dark:text-slate-400">
            轉做：
          </span>
          {KINDS.filter((k) => k.id !== 'event').map((k) => {
            const Icon = KIND_ICON[k.id]
            return (
              <Button
                key={k.id}
                type="button"
                size="sm"
                variant="secondary"
                icon={Icon}
                onClick={() => bulkConvert(k.id)}
              >
                {kindLabel(k.id)}
              </Button>
            )
          })}
          <Separator orientation="vertical" className="mx-1 h-6" />
          {tab === 'inbox' && (
            <Button type="button" size="sm" variant="secondary" icon={Archive} onClick={bulkArchive}>
              歸檔
            </Button>
          )}
          <Button type="button" size="sm" variant="danger" icon={Trash2} onClick={bulkDelete}>
            刪除
          </Button>
        </Card>
      )}

      {/* 列表 */}
      {visible.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            icon={InboxIcon}
            title={
              tab === 'archived'
                ? '未有歸檔項目'
                : search || kindFilter !== 'all' || tagFilter
                  ? '冇符合條件嘅項目'
                  : 'Inbox 清空喇 🎉'
            }
            hint={
              tab === 'archived'
                ? '處理過嘅項目會歸檔喺呢度，可隨時還原。'
                : search || kindFilter !== 'all' || tagFilter
                  ? '試下清除搜尋或過濾條件。'
                  : '有諗法就即刻掉低，唔使諗點分類。'
            }
          />
        </div>
      ) : (
        <div ref={listRef} className="mt-3 space-y-4">
          {groups.map((g) => (
            <div key={g.key}>
              <div className="mb-1.5 flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  {g.label}
                </span>
                <span className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
                <span className="text-xs tabular-nums text-slate-300 dark:text-slate-600">
                  {g.rows.length}
                </span>
              </div>
              <div className="space-y-2">
                {g.rows.map((row) => {
                  const idx = flat.indexOf(row)
                  return (
                    <div key={row.item.id} data-row-idx={idx}>
                    <InboxRowCard
                      row={row}
                      focused={idx === cursor}
                      selectMode={selectMode}
                      selected={selected.has(row.item.id)}
                      onFocus={() => setCursor(idx)}
                      onToggleSelect={() => toggleSelect(row.item.id)}
                      onSetKind={(k) => setKind(row.item.id, k)}
                      onConvert={(k) => convert(row, k)}
                      onPin={() => togglePinned(row.item.id, row.pinned)}
                      onArchive={() => {
                        archive(row.item.id)
                        toast.success('已歸檔')
                      }}
                      onRestore={() => {
                        restore(row.item.id)
                        toast.success('已還原')
                      }}
                      onDelete={() => remove(row.item.id)}
                      onAcceptAi={() => acceptAi(row)}
                      onOpenFeature={(f) => nav.open(f)}
                    />
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 鍵盤提示 */}
      {visible.length > 0 && tab === 'inbox' && (
        <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-slate-400 dark:text-slate-500">
          <span className="flex items-center gap-1">
            <Kbd>j</Kbd>
            <Kbd>k</Kbd> 導航
          </span>
          <span className="flex items-center gap-1">
            <Kbd>1</Kbd>–<Kbd>6</Kbd> 分類並轉換
          </span>
          <span className="flex items-center gap-1">
            <Kbd>e</Kbd> 歸檔
          </span>
          <span className="flex items-center gap-1">
            <Kbd>p</Kbd> 置頂
          </span>
          <span className="flex items-center gap-1">
            <Kbd>x</Kbd> 多選
          </span>
        </div>
      )}

      {/* 行事曆轉換抽屜 */}
      <EventDraftModal
        draft={eventDraft}
        onClose={() => setEventDraft(null)}
        onConfirm={confirmEvent}
      />
    </div>
  )
}

// ============================================================
//  單行卡片
// ============================================================
function InboxRowCard({
  row,
  focused,
  selectMode,
  selected,
  onFocus,
  onToggleSelect,
  onSetKind,
  onConvert,
  onPin,
  onArchive,
  onRestore,
  onDelete,
  onAcceptAi,
  onOpenFeature,
}: {
  row: InboxRow
  focused: boolean
  selectMode: boolean
  selected: boolean
  onFocus: () => void
  onToggleSelect: () => void
  onSetKind: (k: InboxKind) => void
  onConvert: (k: InboxKind) => void
  onPin: () => void
  onArchive: () => void
  onRestore: () => void
  onDelete: () => void
  onAcceptAi: () => void
  onOpenFeature: (f: string) => void
}) {
  const KindIcon = row.kind ? KIND_ICON[row.kind] : InboxIcon
  const aiKind = row.meta?.aiKind
  const showAi = !row.archived && row.guessed && aiKind && aiKind !== row.kind

  return (
    <Card
      onClick={selectMode ? onToggleSelect : onFocus}
      className={cx(
        'group p-3 transition',
        focused && !selectMode && 'ring-2 ring-accent/40',
        selected && 'ring-2 ring-accent',
        row.pinned && 'border-accent/30 dark:border-accent/30',
        'cursor-pointer',
      )}
    >
      <div className="flex items-start gap-2.5">
        {/* 選擇框 / 分類點 */}
        {selectMode ? (
          <span
            className={cx(
              'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition',
              selected
                ? 'border-accent bg-accent text-white'
                : 'border-slate-300 dark:border-slate-600',
            )}
          >
            {selected && <CheckSquare size={13} />}
          </span>
        ) : (
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-50 dark:bg-slate-900/50">
            <KindIcon
              size={15}
              className={cx(
                row.kind === 'task'
                  ? 'text-blue-500'
                  : row.kind === 'note'
                    ? 'text-accent'
                    : row.kind === 'event'
                      ? 'text-emerald-500'
                      : row.kind === 'question'
                        ? 'text-amber-500'
                        : row.kind === 'countdown'
                          ? 'text-rose-500'
                          : 'text-slate-400',
              )}
            />
          </span>
        )}

        <div className="min-w-0 flex-1">
          <p className="whitespace-pre-wrap break-words text-sm text-slate-800 dark:text-slate-100">
            {row.item.text}
          </p>

          {/* meta 行 */}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {row.pinned && (
              <Badge tone="accent" icon={Pin}>
                置頂
              </Badge>
            )}
            {row.kind && (
              <Badge
                tone={row.guessed ? 'slate' : KIND_TONE[row.kind]}
                icon={KIND_ICON[row.kind]}
              >
                {kindLabel(row.kind)}
                {row.guessed && '（估）'}
              </Badge>
            )}
            {row.tags.map((t) => (
              <Badge key={t} tone="slate" icon={Hash}>
                {t}
              </Badge>
            ))}
            {row.archived && row.meta?.convertedTo && (
              <Badge tone="green">
                已轉做{kindLabel(row.meta.convertedTo)}
              </Badge>
            )}
            <Tooltip label={fullTime(row.item.createdAt)}>
              <span className="tabular-nums text-[11px] text-slate-400 dark:text-slate-500">
                {relativeTime(row.item.createdAt)}
              </span>
            </Tooltip>
          </div>

          {/* AI 建議橫條 */}
          {showAi && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onAcceptAi()
              }}
              className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-accent-soft px-2 py-1 text-[11px] font-medium text-accent-strong transition hover:bg-accent/20 dark:bg-accent/10 dark:text-accent"
            >
              <Sparkles size={12} />
              AI 建議：{kindLabel(aiKind!)}
              {row.meta?.aiReason ? `（${row.meta.aiReason}）` : ''}
              <ArrowRight size={12} />
            </button>
          )}
        </div>

        {/* 右側動作（hover 顯示） */}
        {!selectMode && (
          <div className="flex shrink-0 items-center gap-0.5 opacity-60 transition group-hover:opacity-100">
            <Tooltip label={row.pinned ? '取消置頂' : '置頂'}>
              <IconButton
                label="置頂"
                size="sm"
                active={row.pinned}
                onClick={() => onPin()}
              >
                {row.pinned ? <PinOff size={15} /> : <Pin size={15} />}
              </IconButton>
            </Tooltip>
            {row.archived ? (
              <Tooltip label="還原">
                <IconButton label="還原" size="sm" onClick={() => onRestore()}>
                  <ArchiveRestore size={15} />
                </IconButton>
              </Tooltip>
            ) : (
              <Tooltip label="歸檔">
                <IconButton label="歸檔" size="sm" onClick={() => onArchive()}>
                  <Archive size={15} />
                </IconButton>
              </Tooltip>
            )}
            <Menu
              align="end"
              trigger={
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800">
                  <ChevronDownIcon />
                </span>
              }
              items={[
                ...KINDS.map((k) => ({
                  id: 'conv-' + k.id,
                  label: k.short,
                  icon: KIND_ICON[k.id],
                  onSelect: () => onConvert(k.id),
                })),
                ...(row.meta?.convertedTo && kindDef(row.meta.convertedTo).feature
                  ? [
                      {
                        id: 'open',
                        label: `開啟${kindLabel(row.meta.convertedTo)}功能`,
                        icon: ArrowRight,
                        onSelect: () =>
                          onOpenFeature(kindDef(row.meta!.convertedTo!).feature!),
                      },
                    ]
                  : []),
                {
                  id: 'del',
                  label: '永久刪除',
                  icon: Trash2,
                  tone: 'danger' as const,
                  onSelect: () => onDelete(),
                },
              ]}
            />
          </div>
        )}
      </div>

      {/* 分類選擇器（focused 且待處理時展開，快速 triage） */}
      {focused && !selectMode && !row.archived && (
        <div
          className="mt-2.5 flex flex-wrap gap-1.5 border-t border-slate-100 pt-2.5 dark:border-slate-800"
          onClick={(e) => e.stopPropagation()}
        >
          {KINDS.map((k, i) => {
            const Icon = KIND_ICON[k.id]
            const on = row.kind === k.id && !row.guessed
            return (
              <Tooltip key={k.id} label={`${k.short}（按 ${i + 1}）`}>
                <button
                  type="button"
                  onClick={() => {
                    onSetKind(k.id)
                    onConvert(k.id)
                  }}
                  className={cx(
                    'inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
                    on
                      ? 'bg-accent text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
                  )}
                >
                  <Icon size={13} />
                  {kindLabel(k.id)}
                  <span
                    className={cx(
                      'ml-0.5 tabular-nums',
                      on ? 'text-white/70' : 'text-slate-400',
                    )}
                  >
                    {i + 1}
                  </span>
                </button>
              </Tooltip>
            )
          })}
        </div>
      )}
    </Card>
  )
}

// 小 chevron（避免再 import 一個 icon 名衝突）
function ChevronDownIcon() {
  return <ChevronDown size={16} />
}

// ============================================================
//  行事曆轉換抽屜
// ============================================================
function EventDraftModal({
  draft,
  onClose,
  onConfirm,
}: {
  draft: { row: InboxRow } | null
  onClose: () => void
  onConfirm: (date: string, time: string, allDay: boolean) => void
}) {
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [allDay, setAllDay] = useState(false)

  useEffect(() => {
    if (draft) {
      setDate(dayKey(new Date().toISOString()))
      setTime('')
      setAllDay(false)
    }
  }, [draft])

  if (!draft) return null
  const title = stripTags(draft.row.item.text) || draft.row.item.text

  return (
    <Modal
      open={!!draft}
      onClose={onClose}
      title="加入行事曆"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button
            icon={CheckSquare}
            disabled={!date}
            onClick={() => onConfirm(date, time, allDay)}
          >
            加入
          </Button>
        </>
      }
    >
      <p className="mb-3 truncate rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:bg-slate-900/50 dark:text-slate-200">
        {title}
      </p>
      <div className="space-y-3">
        <Field label="日期" required>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            checked={allDay}
            onChange={(e) => setAllDay(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-accent focus:ring-accent/40"
          />
          全日事件
        </label>
        {!allDay && (
          <Field label="時間">
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
        )}
      </div>
    </Modal>
  )
}
