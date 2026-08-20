import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useCollection } from '../../lib/store'
import { meetingNotesCol } from '../../data/collections'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  FeatureGuide,
  IconButton,
  Input,
  Menu,
  Modal,
  PageHero,
  Pills,
  SectionTitle,
  SegmentedControl,
  Select,
  Tooltip,
  cx,
} from '../../ui'
import {
  AlarmClock,
  CalendarClock,
  CalendarDays,
  CheckSquare,
  ClipboardList,
  Copy,
  CornerDownRight,
  FileText,
  Gavel,
  ListChecks,
  MapPin,
  MoreVertical,
  NotebookPen,
  PieChart,
  Pin,
  PinOff,
  Plus,
  Printer,
  Search,
  Square,
  Trash2,
  UserRound,
  Users,
  UserX,
  type LucideIcon,
} from 'lucide-react'
// 設計語言跟「工作儀表板」：accent hero masthead + StatTile bento + 半透明邊框卡，
// 字體統一 font-semibold（去走舊版 serif 速記簿母題）；數字 tabular-nums slashed-zero。
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import NoteEditor, {
  emptyDraft,
  toDraft,
  type EditorDraft,
} from './meetingNotes/NoteEditor'
import { CompletionRing, MonthlyBars, TypeDonut } from './meetingNotes/Charts'
import {
  MEETING_TYPE_META,
  MEETING_TYPE_ORDER,
  actionStats,
  actionsByOwner,
  collectActions,
  fromKey,
  keyOf,
  mergeNotes,
  monthlyMeetingBars,
  noteMetaCol,
  noteTemplatesCol,
  noteToPlainText,
  parseContent,
  printNote,
  pruneMeta,
  renderSegments,
  todayKey,
  typeDistribution,
  upsertMeta,
  type MeetingType,
  type MergedNote,
  type NoteMeta,
  type OpenAction,
  type OwnerGroup,
} from './meetingNotes/util'
import {
  clearComposerHandoff,
  readComposerHandoff,
} from '../shared/composerHandoff'

// ============================================================
//  會議 / 行政筆記 — 媲美 Notion / Fellow.app 的會議工作枱
//  ------------------------------------------------------------
//  · 三視圖：筆記 / 行動中心 / 統計分析
//  · 結構化會議：類型、出席者、時間地點、議決、行動項目（負責人+到期）
//  · 議程範本 · 由內容自動抽取行動 / 決議 · 置頂 · 列印 · 複製
//  · 跨會議「行動中心」追蹤所有跟進事項（逾期 / 即將到期 / 篩選 / 勾選）
//  · 自製 SVG 圖表（月度會議數、類型分布、完成率環）
//  · 共用 MeetingNote 不改；擴充欄位存自家 meeting_note_meta
// ============================================================

type View = 'notes' | 'actions' | 'stats'
type SortKey = 'date_desc' | 'date_asc' | 'title' | 'updated' | 'actions'
type ActionFilter = 'open' | 'overdue' | 'soon' | 'done' | 'all'

const SORT_LABEL: Record<SortKey, string> = {
  date_desc: '日期（新→舊）',
  date_asc: '日期（舊→新）',
  title: '標題',
  updated: '最近更新',
  actions: '未完成行動',
}

// hero 內視圖切換（取代舊 Tabs；圖示 + 標籤）
const VIEW_TABS: Record<View, { label: string; icon: LucideIcon }> = {
  notes: { label: '筆記', icon: NotebookPen },
  actions: { label: '行動中心', icon: ListChecks },
  stats: { label: '統計分析', icon: PieChart },
}

function longDateLabel(key: string): string {
  if (!key) return ''
  const d = fromKey(key)
  const w = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()]
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 · 週${w}`
}

function dueBadgeTone(due: string | undefined, done: boolean) {
  if (done || !due) return null
  const today = todayKey()
  const soon = keyOf(new Date(Date.now() + 7 * 864e5))
  if (due < today) return { tone: 'rose' as const, label: '逾期' }
  if (due <= soon) return { tone: 'amber' as const, label: '快到期' }
  return { tone: 'slate' as const, label: '' }
}

// 筆記卡左側類型色脊（對應 MEETING_TYPE_META 的 BadgeTone）
const TYPE_RAIL: Record<string, string> = {
  accent: 'bg-accent',
  blue: 'bg-sky-500',
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
  slate: 'bg-slate-300 dark:bg-slate-600',
}

// 條目號牌底色（淺底 + 深字 + 深色 /15，對齊類型 tone，跟 dashboard chip 規範）。
const ITEM_PLATE: Record<string, string> = {
  accent: 'bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent',
  blue: 'bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300',
  green: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300',
  rose: 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300',
  slate: 'bg-slate-100 text-slate-500 dark:bg-slate-700/60 dark:text-slate-300',
}

// ───────── 條目號牌（類型色 chip + 編號）─────────
//  每場會議當一條議程項，左側貼一個編號 chip（類型色底光），跟 dashboard 字重規範。
function AgendaPlate({
  index,
  tone,
  pinned,
  className,
}: {
  index: number
  tone: string
  pinned?: boolean
  className?: string
}) {
  return (
    <span
      className={cx(
        'relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-semibold tabular-nums slashed-zero leading-none',
        ITEM_PLATE[tone] ?? ITEM_PLATE.slate,
        className,
      )}
      aria-hidden
    >
      {String(index).padStart(2, '0')}
      {pinned && (
        <Pin
          size={11}
          className="absolute -right-1 -top-1 rotate-12 text-accent"
          fill="currentColor"
        />
      )}
    </span>
  )
}

// 六種語意 tone（嚴格照 WorkDashboard：chip 底+icon 字 / 數字字 兩組）
type Tone = 'accent' | 'amber' | 'emerald' | 'violet' | 'sky' | 'rose'
const TONE: Record<Tone, { chip: string; val: string }> = {
  accent: { chip: 'bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent', val: 'text-accent' },
  amber: { chip: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300', val: 'text-amber-500' },
  emerald: { chip: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300', val: 'text-emerald-500' },
  violet: { chip: 'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300', val: 'text-violet-500' },
  sky: { chip: 'bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300', val: 'text-sky-500' },
  rose: { chip: 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300', val: 'text-rose-500' },
}

// ───────── 統計磚（dashboard StatTile：圖示 chip + tabular 大數字）─────────
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
  icon: LucideIcon
  tone: Tone
  onClick?: () => void
}) {
  const t = TONE[tone]
  const body = (
    <>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-400 dark:text-slate-500">{label}</span>
        <span className={cx('flex h-8 w-8 items-center justify-center rounded-xl', t.chip)}>
          <Icon size={16} />
        </span>
      </div>
      <div>
        <p className="flex items-baseline gap-1">
          <span className={cx('text-3xl font-semibold tabular-nums slashed-zero', t.val)}>{value}</span>
          {unit && <span className="text-sm font-medium text-slate-400">{unit}</span>}
        </p>
        {hint && <p className="mt-0.5 truncate text-[11px] text-slate-400">{hint}</p>}
      </div>
    </>
  )
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="group flex cursor-pointer flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-4 text-left transition duration-200 hover:border-slate-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.98] dark:border-slate-700/60 dark:bg-slate-800 dark:hover:border-slate-600"
      >
        {body}
      </button>
    )
  }
  return (
    <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-700/60 dark:bg-slate-800">
      {body}
    </div>
  )
}

export default function MeetingNotes() {
  const location = useLocation()
  const { t } = useTranslation()
  const notes = useCollection(meetingNotesCol)
  const metas = useCollection(noteMetaCol)
  const templates = useCollection(noteTemplatesCol)
  const toast = useToast()
  const confirm = useConfirm()
  const composerHandoff = useMemo(() => readComposerHandoff('work-meeting-notes'), [])

  const [view, setView] = useState<View>('notes')

  // 篩選 / 搜尋 / 排序
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<MeetingType | 'all'>('all')
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('date_desc')

  // 行動中心篩選 + 分組方式（清單 / 按負責人）
  const [actionFilter, setActionFilter] = useState<ActionFilter>('open')
  const [actionGroupBy, setActionGroupBy] = useState<'list' | 'owner'>('list')

  // 編輯器
  const [editorOpen, setEditorOpen] = useState(() => Boolean(composerHandoff))
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create')
  const [editorInitial, setEditorInitial] = useState<EditorDraft>(() => {
    const draft = emptyDraft()
    if (composerHandoff?.text) draft.title = composerHandoff.text
    return draft
  })
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    if (composerHandoff) clearComposerHandoff('work-meeting-notes')
  }, [composerHandoff])

  // 詳情
  const [detailId, setDetailId] = useState<string | null>(null)
  const resumeRef = useRef('')

  // ───────── 合併資料 ─────────
  const merged = useMemo(() => mergeNotes(notes, metas), [notes, metas])

  // 常用出席者：彙總過往記事的出席者，按出現次數排（給編輯器快速一按加）。
  const suggestedAttendees = useMemo(() => {
    const freq = new Map<string, number>()
    for (const m of metas) {
      for (const a of m.attendees) {
        const name = a.trim()
        if (name) freq.set(name, (freq.get(name) ?? 0) + 1)
      }
    }
    return [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name)
  }, [metas])
  const mergedById = useMemo(
    () => new Map(merged.map((m) => [m.note.id, m])),
    [merged],
  )

  useEffect(() => {
    const item = new URLSearchParams(location.search).get('item')
    if (!item || resumeRef.current === item) return
    if (!notes.some((note) => note.id === item)) return
    resumeRef.current = item
    setView('notes')
    setDetailId(item)
  }, [location.search, notes])

  const allTags = useMemo(() => {
    const set = new Set<string>()
    notes.forEach((n) => n.tags?.forEach((t) => set.add(t)))
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [notes])

  const allActions = useMemo(() => collectActions(merged), [merged])
  const stats = useMemo(() => actionStats(allActions), [allActions])

  // 各類型數量（給 Pills 顯示）
  const typeCounts = useMemo(() => {
    const c: Partial<Record<MeetingType | 'all', number>> = { all: merged.length }
    for (const { meta } of merged) c[meta.type] = (c[meta.type] ?? 0) + 1
    return c
  }, [merged])

  // ───────── 篩選 + 排序後的筆記 ─────────
  const openCountOf = (m: MergedNote) =>
    m.meta.actions.filter((a) => !a.done).length

  const visibleNotes = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    const filtered = merged.filter(({ note, meta }) => {
      const matchKeyword =
        keyword.length === 0 ||
        note.title.toLowerCase().includes(keyword) ||
        note.content.toLowerCase().includes(keyword) ||
        meta.attendees.some((a) => a.toLowerCase().includes(keyword)) ||
        meta.decisions.some((d) => d.toLowerCase().includes(keyword)) ||
        meta.actions.some((a) => a.text.toLowerCase().includes(keyword))
      const matchType = typeFilter === 'all' || meta.type === typeFilter
      const matchTag =
        activeTag === null || (note.tags?.includes(activeTag) ?? false)
      return matchKeyword && matchType && matchTag
    })
    const cmp: Record<SortKey, (a: MergedNote, b: MergedNote) => number> = {
      date_desc: (a, b) => b.note.date.localeCompare(a.note.date),
      date_asc: (a, b) => a.note.date.localeCompare(b.note.date),
      title: (a, b) => a.note.title.localeCompare(b.note.title),
      updated: (a, b) => (b.meta.updatedAt ?? '').localeCompare(a.meta.updatedAt ?? ''),
      actions: (a, b) => openCountOf(b) - openCountOf(a),
    }
    return filtered.slice().sort(cmp[sortKey])
  }, [merged, search, typeFilter, activeTag, sortKey])

  // 置頂 / 一般分組（只在預設日期排序時拆置頂，避免同其他排序打架）
  const pinned = useMemo(
    () => visibleNotes.filter((m) => m.meta.pinned),
    [visibleNotes],
  )
  const unpinned = useMemo(
    () => visibleNotes.filter((m) => !m.meta.pinned),
    [visibleNotes],
  )

  // ───────── 行動中心：扁平化 + 篩選 + 分組 ─────────
  const filteredActions = useMemo(() => {
    const today = todayKey()
    const soon = keyOf(new Date(Date.now() + 7 * 864e5))
    return allActions
      .filter((a) => {
        switch (actionFilter) {
          case 'open':
            return !a.done
          case 'done':
            return a.done
          case 'overdue':
            return !a.done && a.due && a.due < today
          case 'soon':
            return !a.done && a.due && a.due >= today && a.due <= soon
          default:
            return true
        }
      })
      .sort((a, b) => {
        // 未完成優先；有到期先排，逾期最前
        if (a.done !== b.done) return a.done ? 1 : -1
        const ad = a.due ?? '9999-12-31'
        const bd = b.due ?? '9999-12-31'
        if (ad !== bd) return ad.localeCompare(bd)
        return b.noteDate.localeCompare(a.noteDate)
      })
  }, [allActions, actionFilter])

  // ───────── 行動中心：按負責人問責分組（只計未完成）─────────
  // 「按負責人」本身就係篩選維度，固定查看全部未完成項目，不受上方 segment 影響。
  const ownerGroups = useMemo(
    () => actionsByOwner(allActions).filter((g) => g.open > 0),
    [allActions],
  )

  // ───────── 圖表資料 ─────────
  const monthBars = useMemo(() => monthlyMeetingBars(merged, 6), [merged])
  const typeSlices = useMemo(() => typeDistribution(merged), [merged])

  // ============================================================
  //  動作
  // ============================================================
  function openAdd() {
    setEditorMode('create')
    setEditingId(null)
    const d = emptyDraft()
    if (typeFilter !== 'all') d.type = typeFilter
    setEditorInitial(d)
    setEditorOpen(true)
  }

  function openEdit(id: string) {
    const m = mergedById.get(id)
    if (!m) return
    setEditorMode('edit')
    setEditingId(id)
    setEditorInitial(toDraft(m.note, m.meta))
    setEditorOpen(true)
  }

  function handleSave(draft: EditorDraft) {
    const tags = draft.tagsInput
      .split(/[,\s]+/)
      .map((t) => t.trim())
      .filter(Boolean)
    const notePayload = {
      title: draft.title.trim(),
      date: draft.date || todayKey(),
      content: draft.content.trim(),
      tags: tags.length > 0 ? tags : undefined,
    }
    const metaPatch: Partial<Omit<NoteMeta, 'id'>> = {
      type: draft.type,
      time: draft.time || undefined,
      durationMin: draft.durationMin ? Number(draft.durationMin) : undefined,
      location: draft.location.trim() || undefined,
      attendees: draft.attendees,
      decisions: draft.decisions,
      actions: draft.actions,
    }

    if (editorMode === 'edit' && editingId) {
      meetingNotesCol.update(editingId, notePayload)
      upsertMeta(editingId, metaPatch)
      toast.success('已儲存筆記')
    } else {
      const created = meetingNotesCol.add({
        ...notePayload,
        createdAt: new Date().toISOString(),
      })
      upsertMeta(created.id, { ...metaPatch, pinned: false })
      toast.success('已新增筆記')
    }
    setEditorOpen(false)
    setEditingId(null)
  }

  function togglePin(id: string) {
    const m = mergedById.get(id)
    if (!m) return
    upsertMeta(id, { pinned: !m.meta.pinned })
  }

  function duplicateNote(id: string) {
    const m = mergedById.get(id)
    if (!m) return
    const created = meetingNotesCol.add({
      title: `${m.note.title}（副本）`,
      date: todayKey(),
      content: m.note.content,
      tags: m.note.tags,
      createdAt: new Date().toISOString(),
    })
    upsertMeta(created.id, {
      type: m.meta.type,
      location: m.meta.location,
      attendees: [...m.meta.attendees],
      decisions: [...m.meta.decisions],
      // 行動項目重設為未完成（新會議重新跟進）
      actions: m.meta.actions.map((a) => ({
        ...a,
        id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        done: false,
      })),
      pinned: false,
    })
    toast.success('已複製筆記')
  }

  async function removeNote(id: string) {
    const m = mergedById.get(id)
    if (!m) return
    const ok = await confirm({
      title: '刪除筆記？',
      message: `「${m.note.title}」連同跟進項目將會永久刪除，無法復原。`,
      confirmText: '刪除',
      tone: 'danger',
    })
    if (!ok) return
    meetingNotesCol.remove(id)
    noteMetaCol.remove(id)
    // 順手清孤兒 meta
    pruneMeta(new Set(meetingNotesCol.get().map((n) => n.id)))
    if (detailId === id) setDetailId(null)
    toast.success('已刪除筆記')
  }

  function handlePrint(id: string) {
    const m = mergedById.get(id)
    if (!m) return
    const ok = printNote({ note: m.note, meta: m.meta })
    if (!ok) toast.error('無法開啟列印視窗，請檢查瀏覽器彈窗設定')
  }

  async function handleCopy(id: string) {
    const m = mergedById.get(id)
    if (!m) return
    const text = noteToPlainText(m.note, m.meta)
    try {
      await navigator.clipboard.writeText(text)
      toast.success('已複製到剪貼簿')
    } catch {
      toast.error('複製失敗')
    }
  }

  // 在行動中心 / 詳情勾選行動項目（直接寫回 meta）
  function toggleAction(noteId: string, actionId: string) {
    const m = mergedById.get(noteId)
    if (!m) return
    upsertMeta(noteId, {
      actions: m.meta.actions.map((a) =>
        a.id === actionId ? { ...a, done: !a.done } : a,
      ),
    })
  }

  const detail = detailId ? mergedById.get(detailId) : undefined

  // ============================================================
  //  Render
  // ============================================================
  // 行動中心提示：按統計磚跳去對應篩選
  function openActions(filter: ActionFilter) {
    setActionGroupBy('list')
    setActionFilter(filter)
    setView('actions')
  }

  return (
    <div className="w-full space-y-5 p-4 sm:p-6">
      {/* ───────── 共用 PageHero（accent hero）+ hero 內視圖切換 ───────── */}
      <PageHero
        guideKey="meetingNotes"
        icon={NotebookPen}
        kicker={t('meetingNotes.kicker', { defaultValue: '會議筆記' })}
        title={t('meetingNotes.title', { defaultValue: '記低每場會議，跟進不甩' })}
        description={
          stats.open > 0
            ? t('meetingNotes.heroOpen', {
                n: stats.open,
                defaultValue: `還有 ${stats.open} 項跟進等緊你處理。`,
              })
            : stats.total > 0
              ? t('meetingNotes.heroClear', { defaultValue: '所有跟進都完成全部，乾淨企理。' })
              : t('meetingNotes.heroEmpty', { defaultValue: '由第一場會議開始，建立你的會議紀錄。' })
        }
        actions={
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-white/15 px-3 text-sm font-medium backdrop-blur-sm transition hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            <Plus size={15} />
            {t('meetingNotes.newNote', { defaultValue: '新增筆記' })}
          </button>
        }
        tabs={(['notes', 'actions', 'stats'] as View[]).map((id) => {
          const meta = VIEW_TABS[id]
          const on = view === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
              aria-pressed={on}
              className={cx(
                'inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 active:scale-[0.98]',
                on
                  ? 'bg-white font-semibold text-accent-strong'
                  : 'bg-white/15 font-medium text-white hover:bg-white/25',
              )}
            >
              <meta.icon size={13} />
              {meta.label}
            </button>
          )
        })}
      />

      {/* ───────── 統計磚（StatTile）───────── */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* 會議記事 */}
        <StatTile
          label={t('meetingNotes.statNotes', { defaultValue: '會議記事' })}
          value={notes.length}
          unit={t('meetingNotes.unitNotes', { defaultValue: '則' })}
          icon={NotebookPen}
          tone="accent"
          hint={t('meetingNotes.statNotesHint', { defaultValue: '累積會議紀錄' })}
          onClick={() => setView('notes')}
        />

        {/* 待跟進 */}
        <StatTile
          label={t('meetingNotes.statOpen', { defaultValue: '待跟進' })}
          value={stats.open}
          unit={t('meetingNotes.unitItems', { defaultValue: '項' })}
          icon={ListChecks}
          tone={stats.open > 0 ? 'accent' : 'emerald'}
          hint={
            stats.open > 0
              ? t('meetingNotes.statOpenHint', {
                  total: stats.total,
                  defaultValue: `共 ${stats.total} 項待跟進`,
                })
              : t('meetingNotes.allDone', { defaultValue: '全部完成' })
          }
          onClick={() => openActions('open')}
        />

        {/* 逾期 */}
        <StatTile
          label={t('meetingNotes.statOverdue', { defaultValue: '逾期' })}
          value={stats.overdue}
          unit={t('meetingNotes.unitItems', { defaultValue: '項' })}
          icon={AlarmClock}
          tone={stats.overdue > 0 ? 'rose' : 'emerald'}
          hint={
            stats.overdue > 0
              ? t('meetingNotes.statOverdueHint', { defaultValue: '需即時處理' })
              : t('meetingNotes.statNoOverdue', { defaultValue: '一切順利' })
          }
          onClick={() => openActions('overdue')}
        />

        {/* 7 日內到期 */}
        <StatTile
          label={t('meetingNotes.statSoon', { defaultValue: '7 日內到期' })}
          value={stats.dueSoon}
          unit={t('meetingNotes.unitItems', { defaultValue: '項' })}
          icon={CalendarClock}
          tone={stats.dueSoon > 0 ? 'amber' : 'sky'}
          hint={
            stats.dueSoon > 0
              ? t('meetingNotes.statSoonHint', { defaultValue: '排定時間跟進' })
              : t('meetingNotes.statNoSoon', { defaultValue: '近期無到期' })
          }
          onClick={() => openActions('soon')}
        />
      </section>

      {/* ───────── 教學引導：如何使用會議筆記 ───────── */}
      <FeatureGuide
        storageKey="meetingNotes"
        title={t('meetingNotes.guideTitle', { defaultValue: '會議筆記使用說明' })}
        steps={[
          {
            title: t('meetingNotes.guideStep1Title', { defaultValue: '新增會議' }),
            desc: t('meetingNotes.guideStep1Desc', {
              defaultValue: '按「新增筆記」記低會議類型、時間、出席者；可套用議程範本快速開始。',
            }),
          },
          {
            title: t('meetingNotes.guideStep2Title', { defaultValue: '記低決議同行動' }),
            desc: t('meetingNotes.guideStep2Desc', {
              defaultValue: '逐項加入跟進行動，填上負責人同到期日，方便日後追蹤。',
            }),
          },
          {
            title: t('meetingNotes.guideStep3Title', { defaultValue: '跨會議追跟進' }),
            desc: t('meetingNotes.guideStep3Desc', {
              defaultValue: '去「行動中心」一覽所有跟進，按逾期 / 負責人分類，剔了即更新。',
            }),
          },
        ]}
      />

      {/* ═══════════ 筆記視圖 ═══════════ */}
      {view === 'notes' && (
        <div className="space-y-4">
          {/* 搜尋 + 排序 */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex-1">
              <Input
                icon={Search}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜尋標題、內容、出席者、決議、行動…"
              />
            </div>
            <Select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="sm:w-44"
            >
              {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
                <option key={k} value={k}>
                  {SORT_LABEL[k]}
                </option>
              ))}
            </Select>
          </div>

          {/* 類型 Pills */}
          <Pills<MeetingType | 'all'>
            size="sm"
            active={typeFilter}
            onChange={setTypeFilter}
            options={[
              { id: 'all', label: '全部' },
              ...MEETING_TYPE_ORDER.filter(
                (t) => (typeCounts[t] ?? 0) > 0 || t === 'other',
              ).map((t) => ({ id: t, label: MEETING_TYPE_META[t].short })),
            ]}
            counts={typeCounts}
          />

          {/* 標籤篩選 */}
          {allTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-slate-400 dark:text-slate-500">標籤：</span>
              <button
                type="button"
                onClick={() => setActiveTag(null)}
                aria-pressed={activeTag === null}
                className="inline-flex min-h-11 items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.98]"
              >
                <Badge tone={activeTag === null ? 'accent' : 'slate'}>全部</Badge>
              </button>
              {allTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setActiveTag((c) => (c === tag ? null : tag))}
                  aria-pressed={activeTag === tag}
                  aria-label={`篩選標籤 ${tag}`}
                  className="inline-flex min-h-11 items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.98]"
                >
                  <Badge tone={activeTag === tag ? 'accent' : 'slate'}>#{tag}</Badge>
                </button>
              ))}
            </div>
          )}

          {/* 篩選結果數（螢幕閱讀器即時播報） */}
          <p role="status" aria-live="polite" className="sr-only">
            {search.trim() || typeFilter !== 'all' || activeTag !== null
              ? `${visibleNotes.length} 則符合篩選`
              : `共 ${visibleNotes.length} 則筆記`}
          </p>

          {/* 列表 */}
          {visibleNotes.length === 0 ? (
            <EmptyState
              icon={NotebookPen}
              art={notes.length === 0 ? 'empty-meeting' : undefined}
              title={notes.length === 0 ? '記事簿仍是新的一頁' : '揭不到相符的記事'}
              hint={
                notes.length === 0
                  ? '由第一條議程開始——按「新增筆記」記低今場會議，或先套用一個議程範本。'
                  : '嘗試清除搜尋字眼、類型或標籤篩選，再揭一次。'
              }
              action={
                notes.length === 0 ? (
                  <Button onClick={openAdd} icon={Plus}>
                    記低第一場會議
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="space-y-4">
              {pinned.length > 0 && (
                <div className="space-y-2.5">
                  <SectionTitle icon={Pin}>置頂議程</SectionTitle>
                  {pinned.map((m, i) => (
                    <NoteRow
                      key={m.note.id}
                      m={m}
                      index={i + 1}
                      onOpen={() => setDetailId(m.note.id)}
                      onEdit={() => openEdit(m.note.id)}
                      onPin={() => togglePin(m.note.id)}
                      onDuplicate={() => duplicateNote(m.note.id)}
                      onPrint={() => handlePrint(m.note.id)}
                      onCopy={() => handleCopy(m.note.id)}
                      onDelete={() => removeNote(m.note.id)}
                      onTag={(t) => {
                        setActiveTag((c) => (c === t ? null : t))
                      }}
                      activeTag={activeTag}
                    />
                  ))}
                </div>
              )}
              <div className="space-y-2.5">
                {pinned.length > 0 && unpinned.length > 0 && (
                  <SectionTitle icon={NotebookPen}>所有記事</SectionTitle>
                )}
                {unpinned.map((m, i) => (
                  <NoteRow
                    key={m.note.id}
                    m={m}
                    index={pinned.length + i + 1}
                    onOpen={() => setDetailId(m.note.id)}
                    onEdit={() => openEdit(m.note.id)}
                    onPin={() => togglePin(m.note.id)}
                    onDuplicate={() => duplicateNote(m.note.id)}
                    onPrint={() => handlePrint(m.note.id)}
                    onCopy={() => handleCopy(m.note.id)}
                    onDelete={() => removeNote(m.note.id)}
                    onTag={(t) => setActiveTag((c) => (c === t ? null : t))}
                    activeTag={activeTag}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════ 行動中心 ═══════════ */}
      {view === 'actions' && (
        <div className="space-y-4">
          {/* 分組方式：清單 / 按負責人（問責視圖）*/}
          <div className="flex justify-end">
            <SegmentedControl<'list' | 'owner'>
              size="sm"
              value={actionGroupBy}
              onChange={setActionGroupBy}
              options={[
                { id: 'list', label: '清單' },
                { id: 'owner', label: '按負責人' },
              ]}
            />
          </div>

          {actionGroupBy === 'list' ? (
            <>
              <SegmentedControl<ActionFilter>
                value={actionFilter}
                onChange={setActionFilter}
                options={[
                  { id: 'open', label: `待跟進 (${stats.open})` },
                  { id: 'overdue', label: `逾期 (${stats.overdue})` },
                  { id: 'soon', label: `快到期 (${stats.dueSoon})` },
                  { id: 'done', label: `已完成 (${stats.done})` },
                  { id: 'all', label: `全部 (${stats.total})` },
                ]}
              />

              {filteredActions.length === 0 ? (
                <EmptyState
                  icon={ListChecks}
                  title={
                    stats.total === 0
                      ? '行動清單仍是空白'
                      : actionFilter === 'open'
                        ? '所有跟進都剔全部，乾淨企理！'
                        : '沒有符合條件的項目'
                  }
                  hint={
                    stats.total === 0
                      ? '在記事內容用 - [ ] 記錄行動項目，或者在編輯器逐項加入，這裡就會幫你追住。'
                      : undefined
                  }
                />
              ) : (
                <div className="space-y-2">
                  {filteredActions.map((a) => (
                    <ActionRow
                      key={`${a.noteId}-${a.id}`}
                      action={a}
                      onToggle={() => toggleAction(a.noteId, a.id)}
                      onOpenNote={() => {
                        setView('notes')
                        setDetailId(a.noteId)
                      }}
                    />
                  ))}
                </div>
              )}
            </>
          ) : ownerGroups.length === 0 ? (
            <EmptyState
              icon={UserRound}
              title="人人都清了待辦，good job！"
              hint="所有行動都跟進完成，或者尚未分派任何跟進事項。"
            />
          ) : (
            <div className="space-y-3">
              <p role="status" aria-live="polite" className="sr-only">
                {`${ownerGroups.length} 位負責人有待跟進項目`}
              </p>
              {ownerGroups.map((g) => (
                <OwnerGroupCard
                  key={g.owner}
                  group={g}
                  onToggle={(noteId, actionId) => toggleAction(noteId, actionId)}
                  onOpenNote={(noteId) => {
                    setView('notes')
                    setDetailId(noteId)
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════ 統計分析 ═══════════ */}
      {view === 'stats' && (
        <div className="space-y-4">
          {notes.length === 0 ? (
            <EmptyState
              icon={PieChart}
              title="統計頁尚未開簿"
              hint="記低幾場會議之後，這裡會慢慢長出趨勢同分布圖表。"
            />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card padded>
                  <SectionTitle icon={CalendarDays}>近 6 個月會議數</SectionTitle>
                  <MonthlyBars bars={monthBars} />
                </Card>
                <Card padded>
                  <SectionTitle icon={PieChart}>會議類型分布</SectionTitle>
                  <TypeDonut slices={typeSlices} />
                </Card>
              </div>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card padded>
                  <SectionTitle icon={ListChecks}>行動項目完成率</SectionTitle>
                  <CompletionRing done={stats.done} total={stats.total} />
                  {(stats.overdue > 0 || stats.dueSoon > 0) && (
                    <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3 dark:border-slate-700/60">
                      {stats.overdue > 0 && (
                        <Badge tone="rose" dot>
                          逾期 {stats.overdue}
                        </Badge>
                      )}
                      {stats.dueSoon > 0 && (
                        <Badge tone="amber" dot>
                          7 日內 {stats.dueSoon}
                        </Badge>
                      )}
                    </div>
                  )}
                </Card>
                <Card padded>
                  <SectionTitle icon={Users}>常見出席者</SectionTitle>
                  <TopAttendees merged={merged} />
                </Card>
              </div>
            </>
          )}
        </div>
      )}

      {/* 編輯器 */}
      <NoteEditor
        open={editorOpen}
        mode={editorMode}
        initial={editorInitial}
        templates={templates}
        suggestedAttendees={suggestedAttendees}
        onClose={() => setEditorOpen(false)}
        onSave={handleSave}
      />

      {/* 詳情 Modal */}
      <Modal
        open={!!detail}
        onClose={() => setDetailId(null)}
        size="xl"
        title={detail?.note.title}
      >
        {detail && (
          <NoteDetail
            m={detail}
            onToggleAction={(actionId) => toggleAction(detail.note.id, actionId)}
            onEdit={() => {
              setDetailId(null)
              openEdit(detail.note.id)
            }}
            onPrint={() => handlePrint(detail.note.id)}
            onCopy={() => handleCopy(detail.note.id)}
          />
        )}
      </Modal>
    </div>
  )
}

// ============================================================
//  筆記卡（列表行）
// ============================================================
function NoteRow({
  m,
  index,
  onOpen,
  onEdit,
  onPin,
  onDuplicate,
  onPrint,
  onCopy,
  onDelete,
  onTag,
  activeTag,
}: {
  m: MergedNote
  index: number
  onOpen: () => void
  onEdit: () => void
  onPin: () => void
  onDuplicate: () => void
  onPrint: () => void
  onCopy: () => void
  onDelete: () => void
  onTag: (t: string) => void
  activeTag: string | null
}) {
  const { note, meta } = m
  const tm = MEETING_TYPE_META[meta.type]
  const openActions = meta.actions.filter((a) => !a.done).length
  const overdue = meta.actions.filter(
    (a) => !a.done && a.due && a.due < todayKey(),
  ).length
  // 內容摘要（去走 markdown 符號，取頭 2 行非空）
  const preview = useMemoPreview(note.content)
  // 左側類型色脊（柔和呼應會議類型 tone）
  const railCls = TYPE_RAIL[tm.tone] ?? TYPE_RAIL.slate

  return (
    <Card hover clip className="group/note relative p-4 sm:p-5">
      <span aria-hidden="true" className={cx('absolute inset-y-0 left-0 w-1', railCls)} />
      <div className="flex items-start gap-3 sm:gap-3.5">
        {/* 議程條目號牌（serif Item NN，類型色底光） */}
        <AgendaPlate
          index={index}
          tone={tm.tone}
          pinned={meta.pinned}
          className="mt-0.5"
        />
        <div
          className="min-w-0 flex-1 cursor-pointer rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          role="button"
          tabIndex={0}
          aria-label={`開啟筆記：${note.title}`}
          onClick={onOpen}
          onKeyDown={(e) => {
            // 只當焦點在這個容器本身先觸發（避免內嵌標籤按鈕的 Enter/Space 冒泡）
            if (e.target !== e.currentTarget) return
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onOpen()
            }
          }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">
              {note.title}
            </h3>
            <Badge tone={tm.tone}>{tm.short}</Badge>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 dark:text-slate-500">
            <span className="inline-flex items-center gap-1">
              <CalendarDays size={12} />
              <span className="tabular-nums">{note.date}</span>
              {meta.time && <span className="tabular-nums">{meta.time}</span>}
            </span>
            {meta.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin size={12} />
                {meta.location}
              </span>
            )}
            {meta.attendees.length > 0 && (
              <span className="inline-flex items-center gap-1">
                <Users size={12} />
                <span className="tabular-nums">{meta.attendees.length}</span> 人
              </span>
            )}
          </div>

          {preview && (
            <p className="mt-1.5 line-clamp-2 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">
              {preview}
            </p>
          )}

          {/* 摘要徽章：決議 / 行動 */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {meta.decisions.length > 0 && (
              <Badge tone="accent" icon={Gavel}>
                決議 {meta.decisions.length}
              </Badge>
            )}
            {meta.actions.length > 0 && (
              <Badge tone={overdue > 0 ? 'rose' : openActions > 0 ? 'amber' : 'green'}>
                <ListChecks size={11} className="mr-0.5" />
                {openActions > 0
                  ? `${openActions} 待跟進`
                  : `${meta.actions.length} 全部完成`}
                {overdue > 0 && ` · ${overdue} 逾期`}
              </Badge>
            )}
            {note.tags?.map((t) => (
              <button
                key={t}
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onTag(t)
                }}
                aria-pressed={activeTag === t}
                aria-label={`篩選標籤 ${t}`}
                className="inline-flex min-h-11 items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.98]"
              >
                <Badge tone={activeTag === t ? 'accent' : 'slate'}>#{t}</Badge>
              </button>
            ))}
          </div>
        </div>

        {/* 動作 */}
        <div className="flex shrink-0 items-center gap-0.5">
          <Tooltip label={meta.pinned ? '取消置頂' : '置頂'}>
            <IconButton
              label={meta.pinned ? '取消置頂' : '置頂'}
              active={meta.pinned}
              onClick={onPin}
            >
              {meta.pinned ? <PinOff size={15} /> : <Pin size={15} />}
            </IconButton>
          </Tooltip>
          <Menu
            align="end"
            label={`${note.title} 更多操作`}
            trigger={
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300">
                <MoreVertical size={16} />
                <span className="sr-only">{note.title} 更多操作</span>
              </span>
            }
            items={[
              { id: 'edit', label: '編輯', icon: NotebookPen, onSelect: onEdit },
              { id: 'dup', label: '複製為新筆記', icon: Copy, onSelect: onDuplicate },
              { id: 'copy', label: '複製文字', icon: ClipboardList, onSelect: onCopy },
              { id: 'print', label: '列印 / PDF', icon: Printer, onSelect: onPrint },
              {
                id: 'del',
                label: '刪除',
                icon: Trash2,
                tone: 'danger',
                onSelect: onDelete,
              },
            ]}
          />
        </div>
      </div>
    </Card>
  )
}

// 內容預覽：移除 markdown 記號，取首段
function useMemoPreview(content: string): string {
  return useMemo(() => {
    const lines = content
      .split('\n')
      .map((l) => l.replace(/^\s*[-*]\s*\[( |x|X)\]\s*/, '').replace(/^\s*>\s*/, '').trim())
      .filter((l) => l.length > 0 && !/^【.+】$/.test(l))
    return lines.slice(0, 2).join('\n')
  }, [content])
}

// ============================================================
//  行動中心：單行
// ============================================================
function ActionRow({
  action,
  onToggle,
  onOpenNote,
}: {
  action: OpenAction
  onToggle: () => void
  onOpenNote: () => void
}) {
  const dueInfo = dueBadgeTone(action.due, action.done)
  return (
    <div
      className={cx(
        'flex items-start gap-3 rounded-xl border p-3 transition',
        action.done
          ? 'border-slate-100 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/30'
          : 'border-slate-200 bg-white shadow-xs hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:shadow-none',
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className={cx(
          '-ml-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition hover:bg-slate-50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:hover:bg-slate-700/50',
          action.done
            ? 'text-emerald-500'
            : 'text-slate-300 hover:text-accent dark:text-slate-600',
        )}
        aria-label={action.done ? '標記未完成' : '標記完成'}
      >
        {action.done ? <CheckSquare size={20} /> : <Square size={20} />}
      </button>
      <div className="min-w-0 flex-1">
        <p
          className={cx(
            'text-sm',
            action.done
              ? 'text-slate-400 line-through dark:text-slate-500'
              : 'text-slate-800 dark:text-slate-100',
          )}
        >
          {action.text}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 dark:text-slate-500">
          {action.owner && (
            <span className="inline-flex items-center gap-1 font-medium text-accent-strong dark:text-accent">
              @{action.owner}
            </span>
          )}
          {action.due && (
            <span className="inline-flex items-center gap-1">
              <CalendarClock size={12} />
              <span className="tabular-nums">{action.due}</span>
            </span>
          )}
          <button
            type="button"
            onClick={onOpenNote}
            className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 transition hover:bg-accent-soft hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.98] dark:hover:bg-accent/15"
          >
            <CornerDownRight size={12} />
            {action.noteTitle}
          </button>
        </div>
      </div>
      {dueInfo && dueInfo.label && (
        <Badge tone={dueInfo.tone} dot>
          {dueInfo.label}
        </Badge>
      )}
    </div>
  )
}

// ============================================================
//  行動中心 · 按負責人分組卡（問責視圖：誰負責什麼跟進）
// ============================================================
function OwnerGroupCard({
  group,
  onToggle,
  onOpenNote,
}: {
  group: OwnerGroup
  onToggle: (noteId: string, actionId: string) => void
  onOpenNote: (noteId: string) => void
}) {
  const name = group.unassigned ? '未指派' : group.owner
  return (
    <Card clip className="p-0">
      {/* 負責人標頭 */}
      <div className="flex items-center gap-2.5 border-b border-slate-100 bg-slate-50/60 px-4 py-2.5 dark:border-slate-700/60 dark:bg-slate-800/40">
        <span
          className={cx(
            'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
            group.unassigned
              ? 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
              : 'bg-accent-soft text-accent-strong dark:bg-accent/20 dark:text-accent',
          )}
          aria-hidden="true"
        >
          {group.unassigned ? <UserX size={15} /> : <UserRound size={15} />}
        </span>
        <span
          className={cx(
            'min-w-0 flex-1 truncate text-sm font-semibold',
            group.unassigned
              ? 'text-slate-500 dark:text-slate-400'
              : 'text-slate-800 dark:text-slate-100',
          )}
        >
          {group.unassigned ? '未指派' : `@${name}`}
        </span>
        <div className="flex shrink-0 items-center gap-1.5">
          {group.overdue > 0 && (
            <Badge tone="rose" dot>
              逾期 {group.overdue}
            </Badge>
          )}
          <Badge tone="amber">{group.open} 待跟進</Badge>
        </div>
      </div>
      {/* 該負責人的未完成項目 */}
      <div className="space-y-2 p-3">
        {group.items.map((a) => (
          <ActionRow
            key={`${a.noteId}-${a.id}`}
            action={a}
            onToggle={() => onToggle(a.noteId, a.id)}
            onOpenNote={() => onOpenNote(a.noteId)}
          />
        ))}
      </div>
    </Card>
  )
}

// ============================================================
//  詳情：Markdown-ish 渲染 + 結構化區段
// ============================================================
function NoteDetail({
  m,
  onToggleAction,
  onEdit,
  onPrint,
  onCopy,
}: {
  m: MergedNote
  onToggleAction: (actionId: string) => void
  onEdit: () => void
  onPrint: () => void
  onCopy: () => void
}) {
  const { note, meta } = m
  const tm = MEETING_TYPE_META[meta.type]
  const segments = useMemo(() => renderSegments(note.content), [note.content])
  // 內容內嵌行動 / 詳情面板下方結構化行動：若 meta.actions 空但內容有，仍用解析顯示
  const inlineParsed = useMemo(() => parseContent(note.content), [note.content])
  const hasStructuredActions = meta.actions.length > 0
  const hasStructuredDecisions = meta.decisions.length > 0

  return (
    <div className="space-y-4">
      {/* meta 列 */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500 dark:text-slate-400">
        <Badge tone={tm.tone}>{tm.label}</Badge>
        <span className="inline-flex items-center gap-1">
          <CalendarDays size={13} />
          {longDateLabel(note.date)}
          {meta.time && <span className="tabular-nums">· {meta.time}</span>}
          {meta.durationMin ? (
            <span className="tabular-nums">· {meta.durationMin} 分鐘</span>
          ) : null}
        </span>
        {meta.location && (
          <span className="inline-flex items-center gap-1">
            <MapPin size={13} />
            {meta.location}
          </span>
        )}
      </div>

      {/* 出席者 */}
      {meta.attendees.length > 0 && (
        <div>
          <SectionTitle icon={Users}>出席者（{meta.attendees.length}）</SectionTitle>
          <div className="flex flex-wrap gap-1.5">
            {meta.attendees.map((a) => (
              <Badge key={a} tone="slate">
                {a}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* 內容（Markdown-ish 渲染）——柔底卡 + 左側淡色起始線 */}
      <div>
        <SectionTitle icon={FileText}>記事內容</SectionTitle>
        <div className="relative space-y-1 overflow-hidden rounded-xl border border-slate-200/80 bg-slate-50/60 py-3.5 pl-5 pr-3.5 dark:border-slate-700/60 dark:bg-slate-800/40">
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-2 left-2.5 w-px bg-slate-200 dark:bg-slate-700"
          />
          {segments.map((s, i) => {
            switch (s.kind) {
              case 'heading':
                return (
                  <p
                    key={i}
                    className="pt-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200"
                  >
                    {s.text}
                  </p>
                )
              case 'decision':
                return (
                  <p
                    key={i}
                    className="flex items-start gap-1.5 text-sm font-medium text-accent-strong dark:text-accent"
                  >
                    <CornerDownRight size={14} className="mt-0.5 shrink-0" />
                    {s.text}
                  </p>
                )
              case 'action':
                return (
                  <p
                    key={i}
                    className="flex items-start gap-1.5 text-sm text-slate-600 dark:text-slate-300"
                  >
                    {s.done ? (
                      <CheckSquare size={14} className="mt-0.5 shrink-0 text-emerald-500" />
                    ) : (
                      <Square size={14} className="mt-0.5 shrink-0 text-slate-400" />
                    )}
                    <span className={cx(s.done && 'text-slate-400 line-through')}>
                      {s.text}
                      {s.owner && (
                        <span className="ml-1 font-medium text-accent-strong dark:text-accent">
                          @{s.owner}
                        </span>
                      )}
                      {s.due && (
                        <span className="ml-1 tabular-nums text-amber-600 dark:text-amber-400">
                          {s.due}
                        </span>
                      )}
                    </span>
                  </p>
                )
              case 'bullet':
                return (
                  <p
                    key={i}
                    className="flex items-start gap-1.5 pl-1 text-sm text-slate-600 dark:text-slate-300"
                  >
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
                    {s.text}
                  </p>
                )
              default:
                return (
                  <p
                    key={i}
                    className="whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300"
                  >
                    {s.text}
                  </p>
                )
            }
          })}
        </div>
      </div>

      {/* 議決事項（議程編號：serif R-NN 決議章） */}
      {hasStructuredDecisions && (
        <div>
          <SectionTitle icon={Gavel}>議決事項（{meta.decisions.length}）</SectionTitle>
          <ol className="space-y-1.5">
            {meta.decisions.map((d, i) => (
              <li
                key={i}
                className="flex items-start gap-2.5 rounded-lg bg-accent-soft/50 px-3 py-2 text-sm text-slate-700 dark:bg-accent/10 dark:text-slate-200"
              >
                <span className="mt-px shrink-0 text-[13px] font-semibold tabular-nums slashed-zero text-accent-strong dark:text-accent">
                  R{String(i + 1).padStart(2, '0')}
                </span>
                <span className="min-w-0">{d}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* 跟進行動（可即場勾選） */}
      {hasStructuredActions && (
        <div>
          <SectionTitle icon={ListChecks}>
            跟進行動（
            {meta.actions.filter((a) => a.done).length}/{meta.actions.length}）
          </SectionTitle>
          <div className="space-y-1.5">
            {meta.actions.map((a) => {
              const dueInfo = dueBadgeTone(a.due, a.done)
              return (
                <div
                  key={a.id}
                  className="flex items-start gap-2.5 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700"
                >
                  <button
                    type="button"
                    onClick={() => onToggleAction(a.id)}
                    className={cx(
                      '-ml-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition hover:bg-slate-50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:hover:bg-slate-700/50',
                      a.done
                        ? 'text-emerald-500'
                        : 'text-slate-300 hover:text-accent dark:text-slate-600',
                    )}
                    aria-label={a.done ? '標記未完成' : '標記完成'}
                  >
                    {a.done ? <CheckSquare size={18} /> : <Square size={18} />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <span
                      className={cx(
                        'text-sm',
                        a.done
                          ? 'text-slate-400 line-through dark:text-slate-500'
                          : 'text-slate-800 dark:text-slate-100',
                      )}
                    >
                      {a.text}
                    </span>
                    {(a.owner || a.due) && (
                      <span className="ml-2 inline-flex items-center gap-2 text-xs text-slate-400">
                        {a.owner && (
                          <span className="font-medium text-accent-strong dark:text-accent">
                            @{a.owner}
                          </span>
                        )}
                        {a.due && <span className="tabular-nums">{a.due}</span>}
                      </span>
                    )}
                  </div>
                  {dueInfo && dueInfo.label && (
                    <Badge tone={dueInfo.tone} dot>
                      {dueInfo.label}
                    </Badge>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 若未結構化但內容有，提示 */}
      {!hasStructuredActions && inlineParsed.actions.length > 0 && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
          內容偵測到 {inlineParsed.actions.length} 個行動項目。編輯時按「抽取」可轉成可勾選清單，並進入行動中心追蹤。
        </p>
      )}

      {/* 標籤 */}
      {note.tags && note.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {note.tags.map((t) => (
            <Badge key={t} tone="slate">
              #{t}
            </Badge>
          ))}
        </div>
      )}

      {/* 動作列 */}
      <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-3 dark:border-slate-700">
        <Button variant="secondary" size="sm" icon={ClipboardList} onClick={onCopy}>
          複製文字
        </Button>
        <Button variant="secondary" size="sm" icon={Printer} onClick={onPrint}>
          列印 / PDF
        </Button>
        <Button size="sm" icon={NotebookPen} onClick={onEdit}>
          編輯
        </Button>
      </div>
    </div>
  )
}

// ============================================================
//  統計：常見出席者（橫向條）
// ============================================================
function TopAttendees({ merged }: { merged: MergedNote[] }) {
  const rows = useMemo(() => {
    const counts = new Map<string, number>()
    for (const { meta } of merged) {
      for (const a of meta.attendees) counts.set(a, (counts.get(a) ?? 0) + 1)
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
  }, [merged])

  if (rows.length === 0)
    return (
      <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">
        筆記未有記錄出席者
      </p>
    )

  const max = Math.max(1, ...rows.map((r) => r[1]))
  return (
    <div className="space-y-2">
      {rows.map(([name, count]) => (
        <div key={name} className="flex items-center gap-2">
          <span className="w-20 shrink-0 truncate text-xs text-slate-600 dark:text-slate-300">
            {name}
          </span>
          <div className="h-4 flex-1 overflow-hidden rounded-md bg-slate-100 dark:bg-slate-800">
            <div
              className="flex h-full items-center justify-end rounded-md bg-accent px-1.5 transition-all duration-500"
              style={{ width: `${Math.max((count / max) * 100, 12)}%` }}
            >
              <span className="text-[10px] font-semibold tabular-nums text-white">
                {count}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
