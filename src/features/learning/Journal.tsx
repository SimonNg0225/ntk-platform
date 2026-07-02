import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  Tag,
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
  FeatureGuide,
  type FeatureGuideStep,
  IconButton,
  Input,
  Menu,
  PageHero,
  SectionTitle,
  SegmentedControl,
  Tooltip,
  cx,
} from '../../ui'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import {
  MoodCalendar,
  MoodDistributionChart,
  MonthlyBars,
  MoodTrendChart,
  WeekdayBars,
  YearHeatmap,
} from './journal/Charts'
import { EntryEditor, type EntryDraft } from './journal/EntryEditor'
import {
  MONTHS_SHORT,
  MOODS,
  allTagsOf,
  anniversaryEntries,
  buildHeatGrid,
  buildMoodMonth,
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
  promptOfDay,
  relativeTime,
  stripUndefined,
  tagInsights,
  toMarkdown,
  todayKey,
  weekdayCounts,
  downloadText,
  type JournalDoc,
  type TagInsight,
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

// 安全拆日期（避免 new Date('YYYY-MM-DD') 嘅 UTC 偏移）→ 日／星期，timeline 用
const WD_SHORT = ['日', '一', '二', '三', '四', '五', '六']
function dayParts(dateKey: string): { day: string; weekday: string } {
  const [y, m, d] = dateKey.split('-').map(Number)
  const dow = new Date(y, (m || 1) - 1, d || 1).getDay()
  return { day: String(d ?? '').padStart(2, '0'), weekday: WD_SHORT[dow] ?? '' }
}

const SORTS: { id: SortId; label: string }[] = [
  { id: 'new', label: '最新' },
  { id: 'old', label: '最舊' },
  { id: 'words', label: '字數' },
]

// 教學引導：教用家「點用」個人日誌（3 步）
const GUIDE_STEPS: FeatureGuideStep[] = [
  {
    title: '寫低今日一筆',
    desc: '撳右上「寫日誌」，記低反思；可加標題、心情、天氣同 #標籤。',
  },
  {
    title: '切換三種視圖',
    desc: '時間軸睇逐篇、熱力圖睇成年寫作節奏、統計睇心情趨勢同字數。',
  },
  {
    title: '搜尋・篩選・回顧',
    desc: '用關鍵字或心情、標籤快速搵返；「歷年今日」帶你重溫舊文。',
  },
]

export default function Journal() {
  const { t } = useTranslation()
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

  // 「歷年今日」：同月同日（唔同年），最近喺上（純函式聚合）
  const onThisDay = useMemo(() => anniversaryEntries(docs, today), [docs, today])

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
      // 編輯器係改「成篇」：整篇取代而非 merge patch。清空咗嘅 optional 欄位
      // 要真正消失 —— update 嘅 {...i,...patch} 唔識刪 key，patch undefined 只
      // 會喺 in-memory 留低顯式 undefined（persist 後又 drop，前後唔一致）。
      const next = stripUndefined<JournalDoc>({
        ...editing,
        date: d.date,
        title: d.title || undefined,
        content: d.content,
        mood: d.mood || undefined,
        weather: d.weather || undefined,
        gratitude: d.gratitude || undefined,
        favorite: d.favorite,
        updatedAt: now,
      })
      journalDocsCol.set(journalDocsCol.get().map((doc) => (doc.id === editing.id ? next : doc)))
      toast.success('已更新日誌')
    } else {
      journalDocsCol.add(
        stripUndefined({
          date: d.date,
          title: d.title || undefined,
          content: d.content,
          mood: d.mood || undefined,
          weather: d.weather || undefined,
          gratitude: d.gratitude || undefined,
          favorite: d.favorite,
          createdAt: now,
          updatedAt: now,
        }),
      )
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
    downloadText(`個人日誌_${today}.md`, toMarkdown(docs), 'text/markdown')
    toast.success(`已匯出 ${docs.length} 篇（Markdown）`)
  }
  const exportJson = () => {
    if (docs.length === 0) return toast.error('未有日誌可匯出')
    downloadText(`個人日誌_${today}.json`, JSON.stringify(docs, null, 2), 'application/json')
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
      {/* ───────── 頁面頂部：共用 PageHero（accent hero）─────────
           host 已收起標題（selfManagedHeader），呢個係呢頁唯一頂部標題。 */}
      <PageHero
        guideKey="journal"
        icon={BookText}
        kicker={t('journal.kicker', { defaultValue: '學習成長 · 每日反思' })}
        title={t('journal.title', { defaultValue: '個人日誌' })}
        description={[
          longDate(today),
          t('journal.totalN', { n: stats.total, defaultValue: `共 ${stats.total} 篇反思` }),
          stats.streak > 0
            ? t('journal.streakN', { n: stats.streak, defaultValue: `連續 ${stats.streak} 日` })
            : null,
        ]
          .filter(Boolean)
          .join(' · ')}
        actions={
          <>
            <Menu
              align="end"
              trigger={
                <span className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-white/15 px-3 text-sm font-medium backdrop-blur-sm transition hover:bg-white/25">
                  <Download size={15} />
                  {t('journal.export', { defaultValue: '匯出' })}
                </span>
              }
              items={[
                { id: 'md', label: t('journal.exportMd', { defaultValue: '匯出 Markdown' }), icon: Download, onSelect: exportMd },
                { id: 'json', label: t('journal.exportJson', { defaultValue: '匯出 JSON（備份）' }), icon: Download, onSelect: exportJson },
              ]}
            />
            <button
              type="button"
              onClick={() => openNew()}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-white/15 px-3 text-sm font-medium backdrop-blur-sm transition hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              <PenLine size={15} />
              {t('journal.write', { defaultValue: '寫日誌' })}
            </button>
          </>
        }
      />

      {/* ───────── 教學引導：點用呢個功能 ───────── */}
      <FeatureGuide
        storageKey="journal"
        title={t('journal.guideTitle', { defaultValue: '個人日誌點用？' })}
        steps={GUIDE_STEPS}
      />

      {/* ───────── 統計帶：四張統計磚（同 dashboard StatTile 一致） ───────── */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <JournalStat
          label={t('journal.statStreak', { defaultValue: '連續天數' })}
          value={stats.streak}
          unit={t('journal.unitDay', { defaultValue: '日' })}
          hint={stats.streak > 0 ? t('journal.statStreakHotHint', { defaultValue: '今日記得寫低！' }) : t('journal.statStreakHint', { defaultValue: '由今日開始' })}
          icon={Flame}
          tone={stats.streak > 0 ? 'amber' : 'slate'}
        />
        <JournalStat
          label={t('journal.statTotal', { defaultValue: '日誌總數' })}
          value={stats.total}
          unit={t('journal.unitEntry', { defaultValue: '篇' })}
          hint={t('journal.statActiveN', { n: stats.activeDays, defaultValue: `活躍 ${stats.activeDays} 日` })}
          icon={BookText}
          tone="accent"
        />
        <JournalStat
          label={t('journal.statWords', { defaultValue: '累積字數' })}
          value={stats.totalWords.toLocaleString()}
          hint={t('journal.statAvgWords', { n: stats.avgWords, defaultValue: `平均 ${stats.avgWords} 字／篇` })}
          icon={Sparkles}
          tone="sky"
        />
        <JournalStat
          label={t('journal.statLongest', { defaultValue: '最長連續' })}
          value={stats.longest}
          unit={t('journal.unitDay', { defaultValue: '日' })}
          hint={t('journal.statFavN', { n: stats.favorites, defaultValue: `精選 ${stats.favorites} 篇` })}
          icon={History}
          tone="violet"
        />
      </section>

      {/* ───────── 視圖切換 ───────── */}
      <SegmentedControl<ViewId>
        value={view}
        onChange={setView}
        options={[
          { id: 'timeline', label: '時間軸', icon: Rows3 },
          { id: 'heatmap', label: '熱力圖', icon: CalendarDays },
          { id: 'stats', label: '統計', icon: BarChart3 },
        ]}
      />

      {/* ───────── 歷年今日 ───────── */}
      {onThisDay.length > 0 && view === 'timeline' && (
        <Card className="rounded-2xl border-accent/30 bg-accent-soft/40 p-4 dark:bg-accent/10">
          <SectionTitle icon={CalendarHeart}>歷年今日 · {mediumDate(today)}</SectionTitle>
          <div className="space-y-2">
            {onThisDay.map(({ doc: d, yearsAgo }) => (
              <button
                key={d.id}
                onClick={() => openEdit(d)}
                aria-label={`${yearsAgo} 年前嘅今日：${d.title?.trim() || excerpt(d.content, 40)}`}
                className="flex w-full items-center gap-3 rounded-xl bg-white/70 p-2.5 text-left transition hover:bg-white active:scale-[0.98] dark:bg-slate-800/60 dark:hover:bg-slate-800"
              >
                {d.mood ? (
                  <span aria-hidden="true" className="shrink-0 text-lg leading-none">{d.mood}</span>
                ) : (
                  <span aria-hidden="true" className="shrink-0 text-accent/70">
                    <History size={18} />
                  </span>
                )}
                <div className="min-w-0">
                  <p className="flex items-baseline gap-1.5 text-accent-strong dark:text-accent">
                    <span className="text-sm font-semibold tabular-nums">{d.date.slice(0, 4)}</span>
                    <span className="text-[11px] font-medium text-accent/80 dark:text-accent/80">· {yearsAgo} 年前嘅今日</span>
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

      {/* ───────── 今日提示（未寫今日時，溫和邀請；CTA 虛邊磚） ───────── */}
      {view === 'timeline' && docs.length > 0 && !existingDates.has(today) && (
        <button
          type="button"
          onClick={() => openNew()}
          aria-label={t('journal.todayNudgeAria', { defaultValue: '今日仲未寫日誌，去寫一篇' })}
          className="group flex w-full items-center gap-3 rounded-2xl border border-dashed border-accent/40 bg-accent-soft/50 p-4 text-left transition duration-200 hover:border-accent hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.98] dark:border-accent/40 dark:bg-accent/10"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-white">
            <PenLine size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-accent-strong dark:text-accent">
              {t('journal.todayNudgeTitle', { defaultValue: '今日仲未寫，記低一筆？' })}
            </p>
            <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
              {promptOfDay(today)}
            </p>
          </div>
          <ChevronRight size={16} className="shrink-0 text-accent transition group-hover:translate-x-0.5" />
        </button>
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
              type="button"
              onClick={() => setFavOnly((v) => !v)}
              aria-pressed={favOnly}
              className={cx(
                'inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.98]',
                favOnly
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700',
              )}
            >
              <Star size={12} className={favOnly ? 'fill-amber-400 text-amber-400' : ''} />
              {t('journal.favorite', { defaultValue: '精選' })}
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
                    'rounded-lg px-2 py-1 text-base leading-none transition active:scale-[0.98]',
                    on
                      ? 'bg-white shadow-xs ring-1 ring-accent/40 dark:bg-slate-700'
                      : 'opacity-60 hover:bg-slate-100 hover:opacity-100 dark:hover:bg-slate-800',
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
                    type="button"
                    onClick={() => setTagFilter(on ? null : tag)}
                    aria-pressed={on}
                    aria-label={`標籤 ${tag}，${count} 篇`}
                    className={cx(
                      'inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.98]',
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
                className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 font-medium text-slate-500 transition hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.98] dark:text-slate-400 dark:hover:text-slate-200"
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
              art="empty-journal"
              title="仲未有日誌"
              hint="每日寫低一啲反思，慢慢就會儲落一本屬於你嘅個人日記。"
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
            <div className="space-y-6">
              {grouped.map((g) => (
                <div key={g.ym}>
                  {/* 月份分隔 */}
                  <div className="mb-3 flex items-baseline gap-3">
                    <h3 className="text-sm font-semibold tracking-tight text-slate-700 dark:text-slate-200">
                      {g.label}
                    </h3>
                    <span className="h-px flex-1 bg-gradient-to-r from-slate-200 to-transparent dark:from-slate-700/70" />
                    <span className="text-xs tabular-nums text-slate-400">{g.items.length} 篇</span>
                  </div>
                  {/* 日記書脊：連續細線 + 逐篇心情色節點 */}
                  <div className="relative">
                    <span
                      aria-hidden="true"
                      className="absolute bottom-2 left-[6px] top-2 w-px bg-gradient-to-b from-slate-200 via-slate-200 to-transparent dark:from-slate-700/80 dark:via-slate-700/80"
                    />
                    <div className="space-y-3">
                      {g.items.map((d) => {
                        const nodeColor = moodDef(d.mood)?.hex
                        return (
                          <div key={d.id} className="relative flex gap-3 sm:gap-4">
                            {/* 書脊節點欄 */}
                            <div className="relative w-3 shrink-0">
                              <span
                                aria-hidden="true"
                                className="absolute left-1/2 top-5 h-3 w-3 -translate-x-1/2 rounded-full ring-2 ring-white transition-transform dark:ring-slate-900"
                                style={{ background: nodeColor ?? 'var(--accent)' }}
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <EntryCard
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
                            </div>
                          </div>
                        )
                      })}
                    </div>
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
//  統計磚（同 WorkDashboard StatTile 一致：tone chip + 大數字）
// ============================================================
type StatTone = 'accent' | 'amber' | 'emerald' | 'violet' | 'sky' | 'rose' | 'slate'
const STAT_TONE: Record<StatTone, { chip: string; val: string }> = {
  accent: { chip: 'bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent', val: 'text-accent' },
  amber: { chip: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300', val: 'text-amber-500' },
  emerald: { chip: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300', val: 'text-emerald-500' },
  violet: { chip: 'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300', val: 'text-violet-500' },
  sky: { chip: 'bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300', val: 'text-sky-500' },
  rose: { chip: 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300', val: 'text-rose-500' },
  slate: { chip: 'bg-slate-100 text-slate-500 dark:bg-slate-700/60 dark:text-slate-300', val: 'text-slate-700 dark:text-slate-200' },
}

function JournalStat({
  label,
  value,
  unit,
  hint,
  icon: Icon,
  tone,
}: {
  label: string
  value: string | number
  unit?: string
  hint?: string
  icon: typeof BookText
  tone: StatTone
}) {
  const tc = STAT_TONE[tone]
  return (
    <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-700/60 dark:bg-slate-800">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-xs font-medium text-slate-400 dark:text-slate-500">{label}</p>
        <span className={cx('flex h-8 w-8 shrink-0 items-center justify-center rounded-xl', tc.chip)}>
          <Icon size={16} />
        </span>
      </div>
      <div className="mt-3 flex items-baseline gap-1">
        <span className={cx('text-3xl font-semibold tabular-nums slashed-zero', tc.val)}>{value}</span>
        {unit && <span className="text-sm font-medium text-slate-400">{unit}</span>}
      </div>
      {hint && <p className="mt-0.5 truncate text-[11px] text-slate-400 dark:text-slate-500">{hint}</p>}
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
  const dp = dayParts(doc.date)
  const isLong = doc.content.length > TRUNCATE
  const shown = isLong && !expanded ? doc.content.slice(0, TRUNCATE).trimEnd() + '…' : doc.content

  return (
    <Card
      hover
      className={cx(
        'group rounded-2xl p-4',
        isToday && 'border-accent/40 ring-1 ring-accent/30',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {/* 日期塊（書脊節點已帶心情色，呢度主打「邊一日」） */}
          <div className="flex w-10 shrink-0 flex-col items-center pt-0.5">
            <span className="text-2xl font-semibold leading-none tabular-nums slashed-zero text-slate-700 dark:text-slate-200">
              {dp.day}
            </span>
            <span className="mt-1 text-[10px] font-medium text-slate-400 dark:text-slate-500">
              週{dp.weekday}
            </span>
          </div>
          <span aria-hidden="true" className="mt-0.5 h-10 w-px shrink-0 bg-slate-100 dark:bg-slate-700/60" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              {doc.title?.trim() && (
                <span className="truncate text-[17px] font-semibold leading-snug text-slate-800 dark:text-slate-100">
                  {doc.title}
                </span>
              )}
              {isToday && <Badge tone="accent">今日</Badge>}
              {doc.favorite && (
                <Star size={13} className="fill-amber-400 text-amber-400" />
              )}
            </div>
            {(doc.mood || doc.weather) && (
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400">
                {doc.mood && (
                  <Tooltip label={md?.label ?? '心情'}>
                    <span role="img" aria-label={md?.label ?? '心情'} className="text-sm leading-none">
                      {doc.mood}
                    </span>
                  </Tooltip>
                )}
                {md?.label && <span>{md.label}</span>}
                {doc.weather && (
                  <span aria-hidden="true" className="text-sm leading-none">{doc.weather}</span>
                )}
              </p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5 opacity-100 transition [&_button]:p-2 sm:opacity-0 sm:[&_button]:p-1 sm:group-hover:opacity-100 group-focus-within:opacity-100">
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

      <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700 dark:text-slate-200">
        {shown}
      </p>
      {isLong && (
        <button
          onClick={onToggleExpand}
          className="mt-1 text-xs font-medium text-accent transition hover:text-accent-strong active:scale-[0.98]"
        >
          {expanded ? '收起' : '展開全文'}
        </button>
      )}

      {doc.gratitude?.trim() && (
        <p className="mt-2.5 flex items-start gap-1.5 rounded-xl bg-emerald-50/70 px-3 py-2 text-xs leading-relaxed text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
          <span aria-hidden="true" className="shrink-0">🙏</span>
          <span>{doc.gratitude}</span>
        </p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {tags.map((tag) => {
          const on = activeTag?.toLowerCase() === tag.toLowerCase()
          return (
            <button
              key={tag}
              type="button"
              onClick={() => onPickTag(tag)}
              aria-pressed={on}
              aria-label={`以標籤 ${tag} 篩選`}
              className={cx(
                'rounded-lg px-1.5 py-0.5 text-[11px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.98]',
                on
                  ? 'bg-accent text-white'
                  : 'bg-accent-soft text-accent-strong hover:brightness-95 dark:bg-accent/15 dark:text-accent',
              )}
            >
              #{tag}
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
//  熱力圖視圖（年度活動格 + 換年）+ 心情月曆（按月睇心情分佈）
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
      <Card className="rounded-2xl p-4">
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

      <MoodCalendarCard docs={docs} onPickDate={onPickDate} />
    </div>
  )
}

// ───────── 心情月曆卡（月度心情分佈 heatmap）─────────
function MoodCalendarCard({
  docs,
  onPickDate,
}: {
  docs: JournalDoc[]
  onPickDate: (key: string) => void
}) {
  const now = new Date()
  const [ym, setYm] = useState<{ y: number; m: number }>({ y: now.getFullYear(), m: now.getMonth() })
  const month = useMemo(() => buildMoodMonth(docs, ym.y, ym.m), [docs, ym])

  const step = (delta: number) =>
    setYm(({ y, m }) => {
      const d = new Date(y, m + delta, 1)
      return { y: d.getFullYear(), m: d.getMonth() }
    })

  // 唔行去未來月份
  const isThisMonth = ym.y === now.getFullYear() && ym.m === now.getMonth()

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <SectionTitle
          icon={CalendarHeart}
          right={
            month.avgScore !== null ? (
              <Badge tone="accent">
                平均心情 <span className="tabular-nums">{month.avgScore.toFixed(1)}</span> / 5
              </Badge>
            ) : undefined
          }
        >
          心情月曆
        </SectionTitle>
        <div className="flex items-center gap-1">
          <IconButton label="上一個月" size="sm" onClick={() => step(-1)}>
            <ChevronLeft size={16} />
          </IconButton>
          <span className="w-24 text-center text-sm font-semibold tabular-nums text-slate-700 dark:text-slate-200">
            {ym.y} 年 {MONTHS_SHORT[ym.m]}
          </span>
          <IconButton label="下一個月" size="sm" disabled={isThisMonth} onClick={() => step(1)}>
            <ChevronRight size={16} />
          </IconButton>
        </div>
      </div>

      <MoodCalendar month={month} onPick={onPickDate} />

      {/* 圖例 + 摘要 */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          {MOODS.map((m) => (
            <span key={m.emoji} className="inline-flex items-center gap-0.5">
              <span aria-hidden="true" className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: m.hex }} />
              <span aria-hidden="true">{m.emoji}</span>
            </span>
          ))}
        </span>
        <span>
          有心情 <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">{month.moodDays}</span> 日
          {month.activeDays > month.moodDays && (
            <span className="text-slate-400">（活躍 {month.activeDays} 日）</span>
          )}
        </span>
      </div>
    </Card>
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
  const tagRows = useMemo(() => tagInsights(docs, 8), [docs])

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
      <Card className="rounded-2xl p-4">
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
        <Card className="rounded-2xl p-4">
          <SectionTitle icon={PenLine}>心情分佈</SectionTitle>
          <MoodDistributionChart data={dist} />
        </Card>

        <Card className="rounded-2xl p-4">
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

      {tagRows.length > 0 && (
        <Card className="rounded-2xl p-4">
          <SectionTitle
            icon={Tag}
            right={<Badge tone="slate">{tagRows.length} 個標籤</Badge>}
          >
            標籤洞察
          </SectionTitle>
          <TagInsightsList rows={tagRows} />
        </Card>
      )}

      <Card className="rounded-2xl p-4">
        <SectionTitle icon={BarChart3}>近 12 個月日誌數</SectionTitle>
        <MonthlyBars data={monthly} />
      </Card>
    </div>
  )
}

// ───────── 標籤洞察列表（最常用標籤：篇數 / 累積字數 / 平均心情）─────────
function TagInsightsList({ rows }: { rows: TagInsight[] }) {
  const maxCount = Math.max(1, ...rows.map((r) => r.count))
  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <div key={r.tag} className="flex items-center gap-2.5">
          <span className="w-24 shrink-0 truncate text-xs font-medium text-accent-strong dark:text-accent">
            #{r.tag}
          </span>
          <div
            className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
            role="img"
            aria-label={`${r.count} 篇`}
          >
            <div
              className="h-full rounded-full bg-accent transition-all duration-500"
              style={{ width: `${(r.count / maxCount) * 100}%` }}
            />
          </div>
          <span className="flex shrink-0 items-center justify-end gap-2.5 text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
            <Tooltip label={`${r.count} 篇日誌`}>
              <span className="inline-flex w-9 items-center justify-end gap-0.5">
                <BookText size={11} />
                {r.count}
              </span>
            </Tooltip>
            <Tooltip label={`累積 ${r.words.toLocaleString()} 字 · 平均 ${r.avgWords} 字／篇`}>
              <span className="inline-flex w-14 items-center justify-end gap-0.5">
                <Sparkles size={11} />
                {r.words.toLocaleString()}
              </span>
            </Tooltip>
            {r.avgMood !== null && r.moodDef ? (
              <Tooltip label={`平均心情 ${r.avgMood.toFixed(1)} / 5（${r.moodDef.label}）`}>
                <span className="inline-flex w-12 items-center justify-end gap-0.5">
                  <span aria-hidden="true" className="text-sm leading-none">{r.moodDef.emoji}</span>
                  <span style={{ color: r.moodDef.hex }}>{r.avgMood.toFixed(1)}</span>
                </span>
              </Tooltip>
            ) : (
              <Tooltip label="呢個標籤未標過心情">
                <span className="inline-flex w-12 items-center justify-end text-slate-300 dark:text-slate-600">
                  —
                </span>
              </Tooltip>
            )}
          </span>
        </div>
      ))}
    </div>
  )
}
