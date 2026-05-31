import { useMemo, useRef, useState } from 'react'
import {
  ArrowDownWideNarrow,
  ArrowUpWideNarrow,
  BarChart3,
  BookText,
  CalendarDays,
  CalendarHeart,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  Download,
  Flame,
  History,
  ListFilter,
  NotebookPen,
  PenLine,
  Pencil,
  Plus,
  Rows3,
  Search,
  Sparkles,
  Star,
  Trash2,
  X,
} from 'lucide-react'
import { useCollection } from '../../lib/store'
import { journalCol } from '../../data/collections'
import { journalDocsCol } from './journal/store'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  IconButton,
  Input,
  Menu,
  SectionTitle,
  SegmentedControl,
  StatCard,
  Tooltip,
  cx,
} from '../../ui'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import {
  MoodDistributionChart,
  MonthlyBars,
  MoodTrendChart,
  WeekdayBars,
  YearHeatmap,
} from './journal/Charts'
import { EntryEditor, type EntryDraft } from './journal/EntryEditor'
import {
  MOODS,
  allTagsOf,
  buildHeatGrid,
  countWords,
  currentStreak,
  excerpt,
  longDate,
  longestStreak,
  mediumDate,
  monthlyCounts,
  moodDef,
  moodDistribution,
  moodTrend,
  parseTags,
  relativeTime,
  toMarkdown,
  todayKey,
  weekdayCounts,
  downloadText,
  type JournalDoc,
} from './journal/util'

// ============================================================
//  學習日誌（參考 Day One）
//  ------------------------------------------------------------
//  Power features：
//   · 豐富條目（標題 / 心情 / 天氣 / 感恩 / 精選 / #標籤）
//   · 三視圖：時間軸 / 年度熱力圖（活動格）/ 統計（自製 SVG 圖表）
//   · 搜尋 + 心情篩選 + 標籤篩選 + 排序（新/舊/字數）
//   · 連續寫作天數、字數、活躍日統計
//   · 「歷年今日」回顧
//   · 匯出 Markdown / JSON、複製單篇
//  資料：journal/store 嘅 journalDocsCol（'journal_v2'）；首次由舊 journal 遷移
// ============================================================

// journalDocsCol 嘅 canonical instance 喺 ./journal/store（同學習儀表板共用同一個）。

// 由舊 JournalEntry 結構安全遷移（只做一次）
const MIGRATION_FLAG = 'ntk.journal_v2_migrated'
function migrateLegacy() {
  try {
    if (localStorage.getItem(MIGRATION_FLAG)) return
    const legacy = journalCol.get()
    const existing = journalDocsCol.get()
    if (existing.length === 0 && legacy.length > 0) {
      const now = new Date().toISOString()
      const seeded = legacy.map((e) => ({
        id: e.id,
        date: e.date,
        content: e.content,
        mood: e.mood,
        title: '',
        weather: '',
        gratitude: '',
        favorite: false,
        createdAt: now,
        updatedAt: now,
      })) as JournalDoc[]
      journalDocsCol.set(seeded)
    }
    localStorage.setItem(MIGRATION_FLAG, '1')
  } catch {
    /* ignore */
  }
}

type ViewId = 'timeline' | 'heatmap' | 'stats'
type SortId = 'new' | 'old' | 'words'

const SORTS: { id: SortId; label: string }[] = [
  { id: 'new', label: '最新' },
  { id: 'old', label: '最舊' },
  { id: 'words', label: '字數' },
]

export default function Journal() {
  const docs = useCollection(journalDocsCol)
  const toast = useToast()
  const confirm = useConfirm()

  // 首次遷移
  const migratedRef = useRef(false)
  if (!migratedRef.current) {
    migrateLegacy()
    migratedRef.current = true
  }

  const [view, setView] = useState<ViewId>('timeline')
  const [query, setQuery] = useState('')
  const [moodFilter, setMoodFilter] = useState<string | null>(null)
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [favOnly, setFavOnly] = useState(false)
  const [sort, setSort] = useState<SortId>('new')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<JournalDoc | undefined>(undefined)
  const [presetDate, setPresetDate] = useState<string>(todayKey())

  const today = todayKey()
  const existingDates = useMemo(() => new Set(docs.map((d) => d.date)), [docs])

  // ───────── 統計 ─────────
  const stats = useMemo(() => {
    const dateSet = new Set(docs.map((d) => d.date))
    const totalWords = docs.reduce((s, d) => s + countWords(d.content), 0)
    return {
      total: docs.length,
      activeDays: dateSet.size,
      streak: currentStreak(dateSet),
      longest: longestStreak(dateSet),
      totalWords,
      avgWords: docs.length ? Math.round(totalWords / docs.length) : 0,
      favorites: docs.filter((d) => d.favorite).length,
    }
  }, [docs])

  // 全部標籤（合併欄位 + 內文，附用量，按用量排序）
  const allTags = useMemo(() => {
    const counts = new Map<string, { tag: string; count: number }>()
    for (const d of docs) {
      for (const t of allTagsOf(d)) {
        const k = t.toLowerCase()
        const e = counts.get(k)
        if (e) e.count += 1
        else counts.set(k, { tag: t, count: 1 })
      }
    }
    return [...counts.values()].sort((a, b) => b.count - a.count)
  }, [docs])

  // 篩選 + 排序
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = docs.filter((d) => {
      if (favOnly && !d.favorite) return false
      if (moodFilter && d.mood !== moodFilter) return false
      if (
        tagFilter &&
        !allTagsOf(d).some((t) => t.toLowerCase() === tagFilter.toLowerCase())
      )
        return false
      if (q) {
        const hay = `${d.title ?? ''} ${d.content} ${d.gratitude ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
    list.sort((a, b) => {
      if (sort === 'words') return countWords(b.content) - countWords(a.content)
      if (sort === 'old') return a.date < b.date ? -1 : a.date > b.date ? 1 : a.createdAt < b.createdAt ? -1 : 1
      return a.date > b.date ? -1 : a.date < b.date ? 1 : a.createdAt > b.createdAt ? -1 : 1
    })
    return list
  }, [docs, query, moodFilter, tagFilter, favOnly, sort])

  // 按月分組（時間軸用；保持 visible 排序）
  const grouped = useMemo(() => {
    const groups: { ym: string; label: string; items: JournalDoc[] }[] = []
    const idx = new Map<string, number>()
    for (const d of visible) {
      const ym = d.date.slice(0, 7)
      let i = idx.get(ym)
      if (i === undefined) {
        i = groups.length
        idx.set(ym, i)
        const [y, m] = ym.split('-')
        groups.push({ ym, label: `${y}年${Number(m)}月`, items: [] })
      }
      groups[i].items.push(d)
    }
    return groups
  }, [visible])

  // 「歷年今日」：同月同日（唔同年），最近喺上
  const onThisDay = useMemo(() => {
    const mmdd = today.slice(5)
    return docs
      .filter((d) => d.date.slice(5) === mmdd && d.date !== today)
      .sort((a, b) => (a.date > b.date ? -1 : 1))
  }, [docs, today])

  const hasFilter = Boolean(query.trim() || moodFilter || tagFilter || favOnly)
  const clearFilters = () => {
    setQuery('')
    setMoodFilter(null)
    setTagFilter(null)
    setFavOnly(false)
  }

  // ───────── 動作 ─────────
  const openNew = (date?: string) => {
    setEditing(undefined)
    setPresetDate(date ?? today)
    setEditorOpen(true)
  }
  const openEdit = (doc: JournalDoc) => {
    setEditing(doc)
    setEditorOpen(true)
  }
  const handleSave = (d: EntryDraft) => {
    const now = new Date().toISOString()
    if (editing) {
      journalDocsCol.update(editing.id, {
        date: d.date,
        title: d.title || undefined,
        content: d.content,
        mood: d.mood || undefined,
        weather: d.weather || undefined,
        gratitude: d.gratitude || undefined,
        favorite: d.favorite,
        updatedAt: now,
      })
      toast.success('已更新日誌')
    } else {
      journalDocsCol.add({
        date: d.date,
        title: d.title || undefined,
        content: d.content,
        mood: d.mood || undefined,
        weather: d.weather || undefined,
        gratitude: d.gratitude || undefined,
        favorite: d.favorite,
        createdAt: now,
        updatedAt: now,
      })
      toast.success('已儲存日誌')
    }
    setEditorOpen(false)
    setEditing(undefined)
  }

  const toggleFav = (doc: JournalDoc) => {
    journalDocsCol.update(doc.id, { favorite: !doc.favorite, updatedAt: new Date().toISOString() })
  }

  const remove = async (doc: JournalDoc) => {
    const ok = await confirm({
      title: '刪除日誌？',
      message: `確定要刪除 ${mediumDate(doc.date)} 嘅日誌？呢個動作無法復原。`,
      confirmText: '刪除',
      tone: 'danger',
    })
    if (!ok) return
    journalDocsCol.remove(doc.id)
    toast.success('已刪除日誌')
  }

  const copyOne = async (doc: JournalDoc) => {
    const text = toMarkdown([doc])
    try {
      await navigator.clipboard.writeText(text)
      toast.success('已複製為 Markdown')
    } catch {
      toast.error('複製失敗，瀏覽器唔支援')
    }
  }

  const exportMd = () => {
    if (docs.length === 0) return toast.error('未有日誌可匯出')
    downloadText(`學習日誌_${today}.md`, toMarkdown(docs), 'text/markdown')
    toast.success(`已匯出 ${docs.length} 篇（Markdown）`)
  }
  const exportJson = () => {
    if (docs.length === 0) return toast.error('未有日誌可匯出')
    downloadText(`學習日誌_${today}.json`, JSON.stringify(docs, null, 2), 'application/json')
    toast.success(`已匯出 ${docs.length} 篇（JSON）`)
  }

  const toggleExpand = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <div className="space-y-5">
      {/* ───────── 頂部：操作列 ───────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SegmentedControl<ViewId>
          value={view}
          onChange={setView}
          options={[
            { id: 'timeline', label: '時間軸', icon: Rows3 },
            { id: 'heatmap', label: '熱力圖', icon: CalendarDays },
            { id: 'stats', label: '統計', icon: BarChart3 },
          ]}
        />
        <div className="flex items-center gap-2">
          <Menu
            align="end"
            trigger={
              <span className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700">
                <Download size={15} />
                匯出
              </span>
            }
            items={[
              { id: 'md', label: '匯出 Markdown', icon: Download, onSelect: exportMd },
              { id: 'json', label: '匯出 JSON（備份）', icon: Download, onSelect: exportJson },
            ]}
          />
          <Button icon={Plus} onClick={() => openNew()}>
            寫日誌
          </Button>
        </div>
      </div>

      {/* ───────── 統計卡 ───────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="連續天數"
          value={stats.streak}
          unit="日"
          icon={Flame}
          highlight={stats.streak > 0}
          hint={stats.streak > 0 ? '今日記得寫低！' : '由今日開始'}
        />
        <StatCard label="日誌總數" value={stats.total} unit="篇" icon={BookText} hint={`活躍 ${stats.activeDays} 日`} />
        <StatCard
          label="累積字數"
          value={stats.totalWords.toLocaleString()}
          icon={Sparkles}
          hint={`平均 ${stats.avgWords} 字／篇`}
        />
        <StatCard label="最長連續" value={stats.longest} unit="日" icon={History} hint={`精選 ${stats.favorites} 篇`} />
      </div>

      {/* ───────── 歷年今日 ───────── */}
      {onThisDay.length > 0 && view === 'timeline' && (
        <Card className="border-accent/30 bg-accent-soft/40 p-4 dark:bg-accent/10">
          <SectionTitle icon={CalendarHeart}>歷年今日 · {mediumDate(today)}</SectionTitle>
          <div className="space-y-2">
            {onThisDay.map((d) => (
              <button
                key={d.id}
                onClick={() => openEdit(d)}
                className="flex w-full items-start gap-3 rounded-lg bg-white/70 p-2.5 text-left transition hover:bg-white dark:bg-slate-800/60 dark:hover:bg-slate-800"
              >
                <span aria-hidden="true" className="shrink-0 text-lg">{d.mood || '📝'}</span>
                <div className="min-w-0">
                  <p className="text-xs font-medium tabular-nums text-accent-strong dark:text-accent">
                    {d.date.slice(0, 4)} 年 · {today.slice(0, 4) === d.date.slice(0, 4) ? '' : `${Number(today.slice(0, 4)) - Number(d.date.slice(0, 4))} 年前`}
                  </p>
                  <p className="truncate text-sm text-slate-600 dark:text-slate-300">
                    {d.title?.trim() || excerpt(d.content, 60)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* ───────── 視圖內容 ───────── */}
      {view === 'stats' ? (
        <StatsView docs={docs} />
      ) : view === 'heatmap' ? (
        <HeatmapView
          docs={docs}
          onPickDate={(key) => {
            const found = docs.filter((d) => d.date === key)
            if (found.length === 1) openEdit(found[0])
            else openNew(key)
          }}
        />
      ) : (
        // ───────── 時間軸 ─────────
        <div className="space-y-4">
          {/* 搜尋 + 排序 */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex-1">
              <Input
                icon={Search}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜尋標題、內文、感恩…"
                aria-label="搜尋日誌"
              />
            </div>
            <SegmentedControl<SortId>
              size="sm"
              value={sort}
              onChange={setSort}
              options={SORTS.map((s) => ({
                id: s.id,
                label: s.label,
                icon: s.id === 'old' ? ArrowUpWideNarrow : s.id === 'words' ? ListFilter : ArrowDownWideNarrow,
              }))}
            />
          </div>

          {/* 心情 + 精選快篩 */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setFavOnly((v) => !v)}
              aria-pressed={favOnly}
              className={cx(
                'inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition',
                favOnly
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700',
              )}
            >
              <Star size={12} className={favOnly ? 'fill-amber-400 text-amber-400' : ''} />
              精選
            </button>
            <span className="mx-0.5 h-4 w-px bg-slate-200 dark:bg-slate-700" />
            {MOODS.map((m) => {
              const on = moodFilter === m.emoji
              return (
                <button
                  key={m.emoji}
                  title={m.label}
                  aria-label={`篩選心情：${m.label}`}
                  aria-pressed={on}
                  onClick={() => setMoodFilter(on ? null : m.emoji)}
                  className={cx(
                    'rounded-md px-2 py-1 text-sm transition',
                    on ? 'bg-accent-soft ring-1 ring-accent/30 dark:bg-accent/15' : 'opacity-50 hover:opacity-100',
                  )}
                >
                  <span aria-hidden="true">{m.emoji}</span>
                </button>
              )
            })}
          </div>

          {/* 標籤列 */}
          {allTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {allTags.slice(0, 16).map(({ tag, count }) => {
                const on = tagFilter?.toLowerCase() === tag.toLowerCase()
                return (
                  <button
                    key={tag}
                    onClick={() => setTagFilter(on ? null : tag)}
                    aria-pressed={on}
                    aria-label={`標籤 ${tag}，${count} 篇`}
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
            </div>
          )}

          {/* 篩選狀態 */}
          {hasFilter && (
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="tabular-nums" aria-live="polite">
                搵到 {visible.length} 篇
              </span>
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-1 font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                <X size={12} />
                清除篩選
              </button>
            </div>
          )}

          {/* 列表 */}
          {docs.length === 0 ? (
            <EmptyState
              icon={NotebookPen}
              title="仲未有日誌"
              hint="每日寫低一啲反思，慢慢就會儲落一本屬於你嘅學習日記。"
              action={
                <Button icon={Plus} onClick={() => openNew()}>
                  寫第一篇
                </Button>
              }
            />
          ) : visible.length === 0 ? (
            <EmptyState
              icon={Search}
              title="搵唔到相符嘅日誌"
              hint="試下改吓關鍵字，或者清除篩選。"
              action={
                <Button variant="secondary" onClick={clearFilters}>
                  清除篩選
                </Button>
              }
            />
          ) : (
            <div className="space-y-5">
              {grouped.map((g) => (
                <div key={g.ym}>
                  <div className="mb-2 flex items-center gap-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">{g.label}</h3>
                    <span className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
                    <span className="text-xs tabular-nums text-slate-400">{g.items.length} 篇</span>
                  </div>
                  <div className="space-y-2">
                    {g.items.map((d) => (
                      <EntryCard
                        key={d.id}
                        doc={d}
                        isToday={d.date === today}
                        expanded={expanded.has(d.id)}
                        activeTag={tagFilter}
                        onToggleExpand={() => toggleExpand(d.id)}
                        onEdit={() => openEdit(d)}
                        onRemove={() => remove(d)}
                        onToggleFav={() => toggleFav(d)}
                        onCopy={() => copyOne(d)}
                        onPickTag={(t) => setTagFilter(t)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <EntryEditor
        open={editorOpen}
        initial={editing}
        initialDate={presetDate}
        existingDates={existingDates}
        onClose={() => {
          setEditorOpen(false)
          setEditing(undefined)
        }}
        onSave={handleSave}
      />
    </div>
  )
}

// ============================================================
//  單篇日誌卡
// ============================================================
const TRUNCATE = 240

function EntryCard({
  doc,
  isToday,
  expanded,
  activeTag,
  onToggleExpand,
  onEdit,
  onRemove,
  onToggleFav,
  onCopy,
  onPickTag,
}: {
  doc: JournalDoc
  isToday: boolean
  expanded: boolean
  activeTag: string | null
  onToggleExpand: () => void
  onEdit: () => void
  onRemove: () => void
  onToggleFav: () => void
  onCopy: () => void
  onPickTag: (tag: string) => void
}) {
  const tags = useMemo(() => parseTags(doc.content), [doc.content])
  const words = useMemo(() => countWords(doc.content), [doc.content])
  const md = moodDef(doc.mood)
  const isLong = doc.content.length > TRUNCATE
  const shown = isLong && !expanded ? doc.content.slice(0, TRUNCATE).trimEnd() + '…' : doc.content

  return (
    <Card className={cx('group p-4', isToday && 'ring-1 ring-accent/30')}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {doc.mood ? (
            <Tooltip label={md?.label ?? '心情'}>
              <span className="text-xl leading-none" role="img" aria-label={md?.label ?? '心情'}>
                {doc.mood}
              </span>
            </Tooltip>
          ) : (
            <span aria-hidden="true" className="text-xl leading-none text-slate-300 dark:text-slate-600">
              📝
            </span>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              {doc.title?.trim() && (
                <span className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {doc.title}
                </span>
              )}
              {isToday && <Badge tone="accent">今日</Badge>}
              {doc.favorite && (
                <Star size={13} className="fill-amber-400 text-amber-400" />
              )}
            </div>
            <p className="flex items-center gap-1.5 text-xs text-slate-400">
              <span className="tabular-nums">{longDate(doc.date)}</span>
              {doc.weather && <span>{doc.weather}</span>}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
          <Tooltip label={doc.favorite ? '取消精選' : '設為精選'}>
            <IconButton label="精選" size="sm" active={doc.favorite} onClick={onToggleFav}>
              <Star size={14} className={doc.favorite ? 'fill-amber-400 text-amber-400' : ''} />
            </IconButton>
          </Tooltip>
          <Tooltip label="複製 Markdown">
            <IconButton label="複製" size="sm" onClick={onCopy}>
              <Copy size={14} />
            </IconButton>
          </Tooltip>
          <Tooltip label="編輯">
            <IconButton label="編輯日誌" size="sm" onClick={onEdit}>
              <Pencil size={14} />
            </IconButton>
          </Tooltip>
          <Tooltip label="刪除">
            <IconButton label="刪除日誌" size="sm" tone="danger" onClick={onRemove}>
              <Trash2 size={14} />
            </IconButton>
          </Tooltip>
        </div>
      </div>

      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700 dark:text-slate-200">
        {shown}
      </p>
      {isLong && (
        <button
          onClick={onToggleExpand}
          className="mt-1 text-xs font-medium text-accent hover:text-accent-strong"
        >
          {expanded ? '收起' : '展開全文'}
        </button>
      )}

      {doc.gratitude?.trim() && (
        <p className="mt-2 rounded-lg bg-emerald-50/70 px-3 py-1.5 text-xs text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
          🙏 {doc.gratitude}
        </p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {tags.map((t) => {
          const on = activeTag?.toLowerCase() === t.toLowerCase()
          return (
            <button
              key={t}
              onClick={() => onPickTag(t)}
              aria-pressed={on}
              aria-label={`以標籤 ${t} 篩選`}
              className={cx(
                'rounded-md px-1.5 py-0.5 text-[11px] font-medium transition',
                on
                  ? 'bg-accent text-white'
                  : 'bg-accent-soft text-accent-strong hover:brightness-95 dark:bg-accent/15 dark:text-accent',
              )}
            >
              #{t}
            </button>
          )
        })}
        <span className="ml-auto inline-flex items-center gap-2 text-[11px] text-slate-400">
          <span className="inline-flex items-center gap-0.5 tabular-nums">
            <Sparkles size={11} />
            {words} 字
          </span>
          <Tooltip label={`最後修改 ${relativeTime(doc.updatedAt)}`} side="left">
            <span className="inline-flex items-center gap-0.5">
              <Clock3 size={11} />
              {relativeTime(doc.updatedAt)}
            </span>
          </Tooltip>
        </span>
      </div>
    </Card>
  )
}

// ============================================================
//  熱力圖視圖（年度活動格 + 換年）
// ============================================================
function HeatmapView({
  docs,
  onPickDate,
}: {
  docs: JournalDoc[]
  onPickDate: (key: string) => void
}) {
  const thisYear = new Date().getFullYear()
  const [year, setYear] = useState(thisYear)
  const grid = useMemo(() => buildHeatGrid(docs, year), [docs, year])
  const years = useMemo(() => {
    const set = new Set<number>(docs.map((d) => Number(d.date.slice(0, 4))))
    set.add(thisYear)
    return [...set].sort((a, b) => b - a)
  }, [docs, thisYear])

  const canPrev = year > Math.min(...years)
  const canNext = year < thisYear

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <SectionTitle icon={CalendarDays}>
            {year} 年寫作活動
          </SectionTitle>
          <div className="flex items-center gap-1">
            <IconButton label="上一年" size="sm" disabled={!canPrev} onClick={() => setYear((y) => y - 1)}>
              <ChevronLeft size={16} />
            </IconButton>
            <span className="w-14 text-center text-sm font-semibold tabular-nums text-slate-700 dark:text-slate-200">
              {year}
            </span>
            <IconButton label="下一年" size="sm" disabled={!canNext} onClick={() => setYear((y) => y + 1)}>
              <ChevronRight size={16} />
            </IconButton>
          </div>
        </div>
        <YearHeatmap grid={grid} onPick={onPickDate} />
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
          <span>
            全年 <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">{grid.total}</span> 篇
          </span>
          <span>
            活躍 <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">{grid.activeDays}</span> 日
          </span>
          <span className="text-slate-400">撳格仔可寫 / 開該日日誌</span>
        </div>
      </Card>
    </div>
  )
}

// ============================================================
//  統計視圖（自製 SVG 圖表）
// ============================================================
function StatsView({ docs }: { docs: JournalDoc[] }) {
  const trend = useMemo(() => moodTrend(docs, 30), [docs])
  const dist = useMemo(() => moodDistribution(docs), [docs])
  const monthly = useMemo(() => monthlyCounts(docs, 12), [docs])
  const weekday = useMemo(() => weekdayCounts(docs), [docs])

  const avgMood = useMemo(() => {
    const scored = docs.map((d) => moodDef(d.mood)?.score).filter((s): s is number => s !== undefined)
    if (!scored.length) return null
    return scored.reduce((a, b) => a + b, 0) / scored.length
  }, [docs])

  const bestWeekday = useMemo(() => {
    let bi = 0
    weekday.forEach((c, i) => {
      if (c > weekday[bi]) bi = i
    })
    return weekday[bi] > 0 ? bi : null
  }, [weekday])

  const WD = ['日', '一', '二', '三', '四', '五', '六']

  if (docs.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="未有資料可分析"
        hint="寫多幾篇日誌、標記心情，呢度就會出現你嘅心情趨勢同寫作統計。"
      />
    )
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <SectionTitle
          icon={Sparkles}
          right={
            avgMood !== null ? (
              <Badge tone="accent">
                平均心情 <span className="tabular-nums">{avgMood.toFixed(1)}</span> / 5
              </Badge>
            ) : undefined
          }
        >
          近 30 日心情趨勢
        </SectionTitle>
        <MoodTrendChart points={trend} />
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <SectionTitle icon={PenLine}>心情分佈</SectionTitle>
          <MoodDistributionChart data={dist} />
        </Card>

        <Card className="p-4">
          <SectionTitle
            icon={CalendarDays}
            right={
              bestWeekday !== null ? (
                <Badge tone="slate">最常寫：星期{WD[bestWeekday]}</Badge>
              ) : undefined
            }
          >
            星期分佈
          </SectionTitle>
          <WeekdayBars counts={weekday} />
        </Card>
      </div>

      <Card className="p-4">
        <SectionTitle icon={BarChart3}>近 12 個月日誌數</SectionTitle>
        <MonthlyBars data={monthly} />
      </Card>
    </div>
  )
}
