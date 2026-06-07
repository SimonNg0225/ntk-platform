import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useCollection } from '../../lib/store'
import {
  questionsCol,
  resourcesCol,
  lessonPlansCol,
  meetingNotesCol,
  classesCol,
  studentsCol,
  tasksCol,
  goalsCol,
  eventsCol,
  countdownsCol,
  transactionsCol,
  txCategoriesCol,
  decksCol,
  cardsCol,
  topicsCol,
  inboxCol,
} from '../../data/collections'
// 深化功能嘅真資料喺各自 feature-local collection（唔係 legacy core col）
import { richNotesCol, type RichNote } from '../learning/notes/store'
import { journalDocsCol } from '../learning/journal/store'
import type { JournalDoc } from '../learning/journal/util'
import { booksCol, STATUS_LABEL, type Book } from '../learning/reading/types'
import type {
  Question,
  Resource,
  LessonPlan,
  MeetingNote,
  Klass,
  Student,
  Task,
  Goal,
  CalendarEvent,
  Countdown,
  Transaction,
  Deck,
  Card,
  Topic,
} from '../../data/types'
import { useNav } from '../../context/NavContext'
import { useMode } from '../../context/ModeContext'
import { useToast } from '../../context/ToastContext'
import { uid } from '../../lib/store'
import {
  Card as UICard,
  Badge,
  EmptyState,
  SegmentedControl,
  Pills,
  Kbd,
  IconButton,
  Button,
  Separator,
  Tooltip,
  cx,
} from '../../ui'
import {
  Search,
  FileText,
  HelpCircle,
  FolderOpen,
  ClipboardList,
  Users2,
  GraduationCap,
  CheckSquare,
  Target,
  CalendarDays,
  Timer,
  Wallet,
  Layers,
  BookOpen,
  NotebookPen,
  ListTree,
  ArrowRight,
  CornerDownLeft,
  Clock,
  Star,
  X,
  Inbox as InboxIcon,
  Copy,
  PlusCircle,
  Hash,
  Radar,
  SlidersHorizontal,
  Command,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  fuzzyMatch,
  highlightSegments,
  snippetAround,
  parseQuery,
  applyOperators,
  hasOperators,
  typeSuggestions,
  RECENT_DAYS,
  pushRecent,
  clearRecents,
  removeRecent,
  togglePin,
  isPinned,
  relativeTime,
  recentsCol,
  pinsCol,
} from './globalSearch/util'

// ============================================================
//  全域搜尋 — Spotlight / Raycast 級
//  ------------------------------------------------------------
//  • 跨 18 個資料源即時模糊搜尋（子序列比對 + 評分 + 高亮）
//  • 鍵盤全操控：↑↓ 揀、↵ 開、⌘↵ 主動作、Tab 切類別、Esc 清空
//  • 分類群組 / 統一排序兩種視圖、類別過濾、type: 運算子
//  • 桌面右側即時預覽面板（全文 + 中繼資料 + 動作）
//  • 最近搜尋（持久化）+ 釘選常用搜尋
//  • Raycast 風快速動作：開啟功能、複製、轉存待辦 / 筆記 / Inbox
// ============================================================

// ───────── 結果命中 ─────────
interface Hit {
  id: string // 全域唯一（kindId + ':' + entityId）
  kindId: string
  kindLabel: string
  featureId: string
  icon: LucideIcon
  badgeTone: 'slate' | 'accent' | 'green' | 'amber' | 'rose' | 'blue'
  title: string // 主標題（高亮命中欄位）
  matchedField: string // 命中文字（用嚟高亮 + snippet）
  indices: number[] // 命中 index（喺 matchedField 上）
  score: number
  subtitle?: string // 次要資訊（日期、分類…）
  body?: string // 預覽全文
  meta: { label: string; value: string }[] // 預覽中繼資料
  ts?: number // 可排序時間戳（ms epoch；in:recent / sort:recent 用）
  pinned?: boolean // 底層實體係咪釘選（is:pinned 用）
}

// 資料源描述（一個 kind = 一類資料）
interface SourceKind {
  id: string
  label: string
  featureId: string
  icon: LucideIcon
  tone: Hit['badgeTone']
  modes: ('learning' | 'work')[]
}

const KIND_META: Record<string, Omit<SourceKind, 'id'>> = {
  note: { label: '個人筆記', featureId: 'learning-notes', icon: FileText, tone: 'accent', modes: ['learning'] },
  journal: { label: '個人日誌', featureId: 'learning-journal', icon: NotebookPen, tone: 'accent', modes: ['learning'] },
  goal: { label: '個人目標', featureId: 'learning-goals', icon: Target, tone: 'green', modes: ['learning'] },
  reading: { label: '閱讀清單', featureId: 'learning-reading', icon: BookOpen, tone: 'blue', modes: ['learning'] },
  deck: { label: '知識卡牌組', featureId: 'learning-flashcards', icon: Layers, tone: 'accent', modes: ['learning'] },
  card: { label: '知識卡', featureId: 'learning-flashcards', icon: Layers, tone: 'accent', modes: ['learning'] },
  question: { label: '題庫', featureId: 'work-questions', icon: HelpCircle, tone: 'amber', modes: ['work'] },
  resource: { label: '教學資源', featureId: 'work-resources', icon: FolderOpen, tone: 'blue', modes: ['work'] },
  lesson: { label: '備課教案', featureId: 'work-lesson-plan', icon: ClipboardList, tone: 'accent', modes: ['work'] },
  meeting: { label: '會議筆記', featureId: 'work-meeting-notes', icon: ListTree, tone: 'slate', modes: ['work'] },
  klass: { label: '班別', featureId: 'work-classes', icon: GraduationCap, tone: 'blue', modes: ['work'] },
  student: { label: '學生', featureId: 'work-gradebook', icon: Users2, tone: 'blue', modes: ['work'] },
  task: { label: '待辦事項', featureId: 'work-tasks', icon: CheckSquare, tone: 'amber', modes: ['work'] },
  topic: { label: '課程課題', featureId: 'work-curriculum', icon: Hash, tone: 'slate', modes: ['work'] },
  tx: { label: '收支記帳', featureId: 'work-budget', icon: Wallet, tone: 'green', modes: ['work'] },
  event: { label: '行事曆', featureId: 'calendar', icon: CalendarDays, tone: 'accent', modes: ['learning', 'work'] },
  countdown: { label: '重要日子', featureId: 'countdown', icon: Timer, tone: 'rose', modes: ['learning', 'work'] },
  inbox: { label: '快速擷取', featureId: 'inbox', icon: InboxIcon, tone: 'slate', modes: ['learning', 'work'] },
}

const ALL_KIND_IDS = Object.keys(KIND_META)

// 給某 kind 整一條 Hit（先做 fuzzy；唔匹配回 null）
function buildHit(
  kindId: string,
  entityId: string,
  fields: { title: string; body?: string; extra?: string }[],
  subtitle: string | undefined,
  meta: { label: string; value: string }[],
  query: string,
  opts?: { ts?: number; pinned?: boolean },
): Hit | null {
  const m = KIND_META[kindId]
  // 對每個欄位做 fuzzy，攞最高分嗰個做命中欄位
  let best: { field: string; score: number; indices: number[] } | null = null
  let titleField = fields[0]?.title ?? ''
  for (const f of fields) {
    for (const candidate of [f.title, f.body, f.extra]) {
      if (!candidate) continue
      const r = fuzzyMatch(candidate, query)
      if (r && (!best || r.score > best.score)) {
        best = { field: candidate, score: r.score, indices: r.indices }
      }
    }
  }
  if (query && !best) return null
  if (!titleField) titleField = best?.field ?? ''

  // matchedField = 評分最高嗰個欄位；indices 永遠對應 matchedField
  // （標題高亮喺 ResultRow 內自行 fuzzyMatch，避免 index 錯位）
  const matchedField = best?.field ?? titleField
  return {
    id: `${kindId}:${entityId}`,
    kindId,
    kindLabel: m.label,
    featureId: m.featureId,
    icon: m.icon,
    badgeTone: m.tone,
    title: titleField || '（未命名）',
    matchedField,
    indices: best?.indices ?? [],
    score: best?.score ?? 0,
    subtitle,
    body: fields.find((f) => f.body)?.body,
    meta,
    ts: opts?.ts,
    pinned: opts?.pinned,
  }
}

// ISO / 日期字串 → ms epoch（畀 in:recent / sort:recent 排序用）；無效回 undefined
function toMs(s?: string): number | undefined {
  if (!s) return undefined
  const t = Date.parse(s)
  return Number.isNaN(t) ? undefined : t
}

// 視圖模式（grouped 分類 / ranked 最相關 / recent 最近——按 hit 既有 ts 排）
type ViewMode = 'grouped' | 'ranked' | 'recent'

export default function GlobalSearch() {
  const { open } = useNav()
  const { mode } = useMode()
  const toast = useToast()

  const [raw, setRaw] = useState('')
  const [view, setView] = useState<ViewMode>('grouped')
  const [scopeMode, setScopeMode] = useState(true) // true = 只搜目前模式
  const [kindFilter, setKindFilter] = useState<string>('all')
  const [activeIdx, setActiveIdx] = useState(0)
  const searchBoxRef = useRef<HTMLDivElement>(null)
  const focusInput = useCallback(() => {
    searchBoxRef.current?.querySelector('input')?.focus()
  }, [])
  const rowRefs = useRef<Map<string, HTMLButtonElement>>(new Map())

  // 訂閱所有資料源
  const notes = useCollection(richNotesCol)
  const questions = useCollection(questionsCol)
  const resources = useCollection(resourcesCol)
  const lessonPlans = useCollection(lessonPlansCol)
  const meetingNotes = useCollection(meetingNotesCol)
  const reading = useCollection(booksCol)
  const journal = useCollection(journalDocsCol)
  const classes = useCollection(classesCol)
  const students = useCollection(studentsCol)
  const tasks = useCollection(tasksCol)
  const goals = useCollection(goalsCol)
  const events = useCollection(eventsCol)
  const countdowns = useCollection(countdownsCol)
  const transactions = useCollection(transactionsCol)
  const txCategories = useCollection(txCategoriesCol)
  const decks = useCollection(decksCol)
  const cards = useCollection(cardsCol)
  const topics = useCollection(topicsCol)
  const inbox = useCollection(inboxCol)
  const recents = useCollection(recentsCol)
  const pins = useCollection(pinsCol)

  const parsed = useMemo(() => parseQuery(raw.trim(), ALL_KIND_IDS), [raw])
  const query = parsed.text
  // type: 自動完成建議（睇原始 raw，唔 trim——尾隨空格代表 token 已完成）。
  // 只喺目前模式 scope 下提示相關 kind，貼合使用者實際睇到嘅結果。
  const typeSugs = useMemo(() => {
    const valid = scopeMode ? ALL_KIND_IDS.filter((k) => KIND_META[k].modes.includes(mode)) : ALL_KIND_IDS
    return typeSuggestions(raw, valid, (id) => KIND_META[id]?.label ?? id)
  }, [raw, scopeMode, mode])
  // 效能：每個 keystroke 都會令 allHits（18 個資料源全量建 Hit + 評分）重算，
  // 大資料下打字會卡。用 useDeferredValue 把「評分／過濾／結果渲染」降為低優先，
  // 輸入框即時更新、重運算延後一拍跟上。輸入鍵盤 chrome 仍用即時 query。
  const deferredQuery = useDeferredValue(query)

  // 班別 / 課題 對照（畀題目、學生、教案做副標）
  const classById = useMemo(() => new Map(classes.map((c) => [c.id, c.name])), [classes])
  const topicById = useMemo(() => new Map(topics.map((t) => [t.id, t.topic])), [topics])
  const catById = useMemo(() => new Map(txCategories.map((c) => [c.id, c])), [txCategories])
  const deckById = useMemo(() => new Map(decks.map((d) => [d.id, d.name])), [decks])

  // 把所有實體整成 Hit 候選（未過濾 query）
  const allHits = useMemo<Hit[]>(() => {
    const out: Hit[] = []
    const push = (h: Hit | null) => h && out.push(h)
    const q = deferredQuery

    notes
      .filter((n: RichNote) => !n.trashed)
      .forEach((n: RichNote) =>
        push(buildHit('note', n.id, [{ title: n.title || firstLine(n.content), body: n.content }], relativeTime(n.updatedAt) ?? undefined, [
          { label: '更新', value: fmtDate(n.updatedAt) },
          { label: '字數', value: String(n.content.length) },
        ], q, { ts: toMs(n.updatedAt), pinned: n.pinned })),
      )
    journal.forEach((j: JournalDoc) =>
      push(buildHit('journal', j.id, [{ title: (j.title || j.date) + (j.mood ? ` · ${j.mood}` : ''), body: [j.content, j.gratitude].filter(Boolean).join('\n') }], j.date, [
        { label: '日期', value: j.date },
        ...(j.mood ? [{ label: '心情', value: j.mood }] : []),
      ], q, { ts: toMs(j.updatedAt) ?? toMs(j.date) })),
    )
    goals.forEach((g: Goal) =>
      push(buildHit('goal', g.id, [{ title: g.title }], `進度 ${g.progress}%`, [
        { label: '進度', value: `${g.progress}%` },
        { label: '建立', value: fmtDate(g.createdAt) },
      ], q, { ts: toMs(g.createdAt) })),
    )
    reading.forEach((b: Book) =>
      push(buildHit('reading', b.id, [{ title: b.title, body: [b.notes, b.review].filter(Boolean).join('\n') }, { title: '', extra: [b.author, ...(b.shelves ?? [])].filter(Boolean).join(' ') }], b.author ? `作者：${b.author}` : STATUS_LABEL[b.status], [
        { label: '狀態', value: STATUS_LABEL[b.status] },
        ...(b.author ? [{ label: '作者', value: b.author }] : []),
      ], q, { ts: toMs(b.createdAt) })),
    )
    decks.forEach((d: Deck) =>
      push(buildHit('deck', d.id, [{ title: d.name, body: d.description }], d.description, [
        { label: '建立', value: fmtDate(d.createdAt) },
        { label: '卡數', value: String(cards.filter((c) => c.deckId === d.id).length) },
      ], q, { ts: toMs(d.createdAt) })),
    )
    cards.forEach((c: Card) =>
      push(buildHit('card', c.id, [{ title: c.front, body: c.back }], deckById.get(c.deckId), [
        { label: '牌組', value: deckById.get(c.deckId) ?? '—' },
        { label: '答案', value: c.back.slice(0, 80) },
      ], q, { ts: toMs(c.createdAt) })),
    )
    questions.forEach((qn: Question) =>
      push(buildHit('question', qn.id, [{ title: qn.stem, body: qn.answer ?? (qn.options ?? []).join(' / ') }, { title: '', extra: (qn.tags ?? []).join(' ') }], `${QTYPE[qn.type]} · ${DIFF[qn.difficulty]}`, [
        { label: '題型', value: QTYPE[qn.type] },
        { label: '難度', value: DIFF[qn.difficulty] },
        { label: '課題', value: topicById.get(qn.topicId) ?? '—' },
        ...(qn.marks ? [{ label: '分數', value: String(qn.marks) }] : []),
      ], q, { ts: toMs(qn.createdAt) })),
    )
    resources.forEach((r: Resource) =>
      push(buildHit('resource', r.id, [{ title: r.title, body: r.notes }, { title: '', extra: (r.tags ?? []).join(' ') }], RES_TYPE[r.type] ?? r.type, [
        { label: '類型', value: RES_TYPE[r.type] ?? r.type },
        ...(r.url ? [{ label: '連結', value: r.url }] : []),
        ...(r.tags?.length ? [{ label: '標籤', value: r.tags.join('、') }] : []),
      ], q, { ts: toMs(r.createdAt) })),
    )
    lessonPlans.forEach((l: LessonPlan) =>
      push(buildHit('lesson', l.id, [{ title: l.title, body: [l.objectives, l.activities].filter(Boolean).join('\n\n') }], l.classId ? classById.get(l.classId) : l.date, [
        ...(l.date ? [{ label: '日期', value: l.date }] : []),
        ...(l.classId ? [{ label: '班別', value: classById.get(l.classId) ?? '—' }] : []),
        ...(l.topicId ? [{ label: '課題', value: topicById.get(l.topicId) ?? '—' }] : []),
      ], q, { ts: toMs(l.createdAt) ?? toMs(l.date) })),
    )
    meetingNotes.forEach((mn: MeetingNote) =>
      push(buildHit('meeting', mn.id, [{ title: mn.title, body: mn.content }, { title: '', extra: (mn.tags ?? []).join(' ') }], mn.date, [
        { label: '日期', value: mn.date },
        ...(mn.tags?.length ? [{ label: '標籤', value: mn.tags.join('、') }] : []),
      ], q, { ts: toMs(mn.createdAt) ?? toMs(mn.date) })),
    )
    classes.forEach((c: Klass) =>
      push(buildHit('klass', c.id, [{ title: c.name, extra: c.subject }], c.subject, [
        { label: '科目', value: c.subject },
        { label: '人數', value: String(students.filter((s) => s.classId === c.id).length) },
      ], q)),
    )
    students.forEach((s: Student) =>
      push(buildHit('student', s.id, [{ title: s.name, extra: s.studentNo }], classById.get(s.classId), [
        { label: '班別', value: classById.get(s.classId) ?? '—' },
        ...(s.studentNo ? [{ label: '學號', value: s.studentNo }] : []),
      ], q)),
    )
    tasks.forEach((t: Task) =>
      push(buildHit('task', t.id, [{ title: t.text }], t.done ? '已完成' : '待辦', [
        { label: '狀態', value: t.done ? '已完成' : '待辦' },
        { label: '建立', value: fmtDate(t.createdAt) },
      ], q, { ts: toMs(t.createdAt) })),
    )
    topics.forEach((t: Topic) =>
      push(buildHit('topic', t.id, [{ title: t.topic, extra: `${t.part} · ${t.area}` }], `${t.part} · ${t.area}`, [
        { label: '部分', value: t.part },
        { label: '範疇', value: t.area },
      ], q)),
    )
    transactions.forEach((t: Transaction) => {
      const cat = catById.get(t.categoryId)
      push(buildHit('tx', t.id, [{ title: t.note || (cat?.name ?? '未分類'), extra: cat?.name }], `${t.kind === 'income' ? '+' : '−'}$${t.amount} · ${t.date}`, [
        { label: '類型', value: t.kind === 'income' ? '收入' : '支出' },
        { label: '金額', value: `$${t.amount}` },
        { label: '分類', value: cat?.name ?? '未分類' },
        { label: '日期', value: t.date },
      ], q, { ts: toMs(t.createdAt) ?? toMs(t.date) }))
    })
    events.forEach((e: CalendarEvent) =>
      push(buildHit('event', e.id, [{ title: e.title, body: e.notes }, { title: '', extra: e.location }], `${e.date}${e.time ? ' ' + e.time : ''}`, [
        { label: '日期', value: e.date },
        ...(e.time ? [{ label: '時間', value: e.time }] : []),
        ...(e.location ? [{ label: '地點', value: e.location }] : []),
      ], q, { ts: toMs(`${e.date}${e.time ? 'T' + e.time : ''}`) })),
    )
    countdowns.forEach((c: Countdown) =>
      push(buildHit('countdown', c.id, [{ title: c.title, body: c.notes }], `${c.date}${daysToLabel(c.date)}`, [
        { label: '目標日', value: c.date },
        { label: '倒數', value: daysToLabel(c.date).trim() || '—' },
      ], q, { ts: toMs(c.createdAt) ?? toMs(c.date) })),
    )
    inbox.forEach((it) =>
      push(buildHit('inbox', it.id, [{ title: it.text }], relativeTime(it.createdAt) ?? undefined, [
        { label: '擷取', value: fmtDate(it.createdAt) },
      ], q, { ts: toMs(it.createdAt) })),
    )
    return out
  }, [
    deferredQuery, notes, journal, goals, reading, decks, cards, questions, resources,
    lessonPlans, meetingNotes, classes, students, tasks, topics, transactions,
    events, countdowns, inbox, classById, topicById, catById, deckById,
  ])

  // 「最近」排序生效條件：view='recent' 視圖 或 sort:recent 運算子（兩者共用同一
  // applyOperators 路徑，避免重複實作排序）。grouped 視圖唔受影響（仍按類別分組）。
  const sortRecent = parsed.sortRecent || view === 'recent'

  // 過濾：mode scope + type 運算子 + 類別 pill；is:pinned / in:recent 過濾；
  // 排序：最近（view/運算子）→ 依時間戳；否則 query → score，無 query → 類別 + 標題
  const filtered = useMemo(() => {
    let list = allHits
    if (scopeMode) list = list.filter((h) => KIND_META[h.kindId].modes.includes(mode))
    if (parsed.typeFilter) list = list.filter((h) => h.kindId === parsed.typeFilter)
    if (kindFilter !== 'all') list = list.filter((h) => h.kindId === kindFilter)
    // is:pinned / in:recent 過濾 + 最近排序（純函式，唔 mutate）
    list = applyOperators(list, { ...parsed, sortRecent }, Date.now())
    // 最近排序已喺 applyOperators 內排好；否則按既有規則排
    if (!sortRecent) {
      if (deferredQuery) list = list.slice().sort((a, b) => b.score - a.score)
      else
        list = list
          .slice()
          .sort((a, b) => a.kindLabel.localeCompare(b.kindLabel) || a.title.localeCompare(b.title))
    }
    return list
  }, [
    allHits, scopeMode, mode, parsed.typeFilter, parsed.pinnedOnly, parsed.recentOnly,
    sortRecent, kindFilter, deferredQuery,
  ])

  // 統計：每類命中數（畀 Pills 顯示）。要計埋 is:pinned / in:recent 運算子過濾
  // （但唔計 type: / kindFilter 本身），令 pill 數同實際結果一致。
  const kindCounts = useMemo(() => {
    let base = scopeMode
      ? allHits.filter((h) => KIND_META[h.kindId].modes.includes(mode))
      : allHits
    base = applyOperators(base, parsed, Date.now())
    const c: Record<string, number> = { all: base.length }
    for (const h of base) c[h.kindId] = (c[h.kindId] ?? 0) + 1
    return c
  }, [allHits, scopeMode, mode, parsed.pinnedOnly, parsed.recentOnly, parsed.sortRecent])

  // 群組視圖：分類分組（保留類別順序）
  const grouped = useMemo(() => {
    const map = new Map<string, Hit[]>()
    for (const h of filtered) {
      const arr = map.get(h.kindId)
      if (arr) arr.push(h)
      else map.set(h.kindId, [h])
    }
    return Array.from(map.entries()).map(([kindId, hits]) => ({
      kindId,
      label: KIND_META[kindId].label,
      icon: KIND_META[kindId].icon,
      hits,
    }))
  }, [filtered])

  // 鍵盤導航用嘅「扁平可見序」（三種視圖都要一致 index）
  // ranked / recent 同樣係扁平清單；grouped 先按類別分組
  const flatVisible = useMemo(() => {
    if (view !== 'grouped') return filtered
    return grouped.flatMap((g) => g.hits)
  }, [view, filtered, grouped])

  // active index 邊界 + query 變就重置
  useEffect(() => {
    setActiveIdx(0)
  }, [deferredQuery, kindFilter, scopeMode, view, mode])
  useEffect(() => {
    if (activeIdx > flatVisible.length - 1) setActiveIdx(Math.max(0, flatVisible.length - 1))
  }, [flatVisible.length, activeIdx])

  const activeHit = flatVisible[activeIdx]

  // 滾動把 active row 帶入視窗
  useEffect(() => {
    if (!activeHit) return
    const el = rowRefs.current.get(activeHit.id)
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeHit])

  const commitRecent = useCallback(() => {
    if (query.length >= 2) pushRecent(query)
  }, [query])

  const copyText = useCallback(
    (text: string) => {
      try {
        const p = navigator.clipboard?.writeText(text)
        // writeText 回 Promise；async 失敗（權限／非安全內容）唔會行 sync catch，
        // 要顯式接住 rejection，先唔會誤報「已複製」+ 避免 unhandled rejection
        if (p) {
          p.then(
            () => toast.success('已複製到剪貼簿'),
            () => toast.error('複製失敗'),
          )
        } else {
          toast.error('複製失敗')
        }
      } catch {
        toast.error('複製失敗')
      }
    },
    [toast],
  )

  const goFeature = useCallback(
    (h: Hit) => {
      commitRecent()
      open(h.featureId)
    },
    [open, commitRecent],
  )

  // 次動作（⌘↵）：複製命中標題（Raycast secondary action 風）
  const secondaryAction = useCallback(
    (h: Hit) => copyText(h.title),
    [copyText],
  )

  // 類別過濾循環（Tab）
  const pillOrder = useMemo(() => {
    const ids = ['all', ...ALL_KIND_IDS.filter((k) => (kindCounts[k] ?? 0) > 0)]
    return ids
  }, [kindCounts])

  const cycleKind = useCallback(
    (dir: number) => {
      const i = pillOrder.indexOf(kindFilter)
      const next = (i + dir + pillOrder.length) % pillOrder.length
      setKindFilter(pillOrder[next])
    },
    [pillOrder, kindFilter],
  )

  // 鍵盤主處理
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIdx((a) => Math.min(a + 1, flatVisible.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIdx((a) => Math.max(a - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (activeHit) {
          if (e.metaKey || e.ctrlKey) secondaryAction(activeHit)
          else goFeature(activeHit)
        }
      } else if (e.key === 'Tab') {
        e.preventDefault()
        cycleKind(e.shiftKey ? -1 : 1)
      } else if (e.key === 'Escape') {
        if (raw) {
          e.preventDefault()
          setRaw('')
          setKindFilter('all')
        }
      } else if ((e.metaKey || e.ctrlKey) && /^[1-9]$/.test(e.key)) {
        e.preventDefault()
        const idx = Number(e.key) - 1
        if (flatVisible[idx]) {
          setActiveIdx(idx)
          goFeature(flatVisible[idx])
        }
      }
    },
    [flatVisible, activeHit, raw, goFeature, secondaryAction, cycleKind],
  )

  // Raycast 風快速動作：用搜尋字直接建立
  const createFromQuery = useCallback(
    (target: 'inbox' | 'note' | 'task') => {
      const text = query.trim()
      if (!text) return
      const now = new Date().toISOString()
      if (target === 'inbox') {
        inboxCol.add({ id: uid(), text, mode, createdAt: now })
        toast.success('已加入快速擷取')
      } else if (target === 'note') {
        richNotesCol.add({
          id: uid(),
          title: '',
          content: text,
          notebookId: null,
          pinned: false,
          favorite: false,
          archived: false,
          trashed: false,
          color: 'none',
          createdAt: now,
          updatedAt: now,
        })
        toast.success('已建立個人筆記')
      } else {
        tasksCol.add({ id: uid(), text, done: false, createdAt: now })
        toast.success('已建立待辦')
      }
      pushRecent(text)
    },
    [query, mode, toast],
  )

  const hasQuery = query.length > 0 || hasOperators(parsed)
  const total = filtered.length

  return (
    <div className="space-y-4">
      {/* ───────── 指揮中心 masthead：搜尋框即係主角（自管 header；功能名「全域搜尋」做身份） ─────────
          探照燈隱喻：聚焦時打開 accent 光暈，輸入框升高、邊框點亮。 */}
      <section className="group/cmd relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xs transition-colors duration-300 focus-within:border-accent/40 dark:border-slate-700/60 dark:bg-slate-800 dark:shadow-none dark:focus-within:border-accent/40">
        {/* 探照燈光暈（靜態，reduced-motion 無礙）：右上柔光 + 聚焦時加亮 */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-accent/10 opacity-60 blur-3xl transition-opacity duration-500 group-focus-within/cmd:opacity-100 dark:bg-accent/20"
        />
        <div className="relative p-4 sm:p-5">
          {/* 身份條：kicker + 功能名（取代 host 預設 header） */}
          <div className="mb-3 flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-white shadow-sm shadow-accent/30">
              <Radar size={18} />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-accent/70">
                指揮中心 · COMMAND
              </p>
              <h1 className="-mt-0.5 font-serif text-[22px] font-semibold leading-tight tracking-tight text-slate-800 dark:text-slate-100">
                全域搜尋
              </h1>
            </div>
            <Kbd className="ml-auto hidden shrink-0 items-center gap-1 sm:inline-flex">
              <Command size={11} /> K
            </Kbd>
          </div>

          {/* 探照燈輸入框 — 大、圓潤、聚焦點亮 */}
          <div
            ref={searchBoxRef}
            onKeyDown={onKeyDown}
            className="group/cmd flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3.5 transition duration-200 focus-within:-translate-y-0.5 focus-within:border-accent focus-within:bg-white focus-within:shadow-md focus-within:shadow-accent/10 focus-within:ring-2 focus-within:ring-accent/25 dark:border-slate-700 dark:bg-slate-900/40 dark:focus-within:bg-slate-800"
          >
            <Search
              size={20}
              className="shrink-0 text-slate-400 transition-colors group-focus-within/cmd:text-accent"
            />
            <input
              id="global-search"
              autoFocus
              type="text"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder="搵筆記、題庫、資源、班別、學生、行事曆…"
              aria-label="全域搜尋"
              className="min-w-0 flex-1 bg-transparent text-base text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500 sm:text-[15px]"
            />
            {raw ? (
              <button
                type="button"
                onClick={() => {
                  setRaw('')
                  setKindFilter('all')
                  focusInput()
                }}
                aria-label="清除搜尋"
                className="shrink-0 rounded-full p-1 text-slate-400 transition hover:bg-slate-200/70 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-200"
              >
                <X size={16} />
              </button>
            ) : (
              <Kbd className="hidden shrink-0 sm:inline-flex">type:note</Kbd>
            )}
          </div>

        {/* type: 自動完成 — 打緊 type: 即喺輸入框下彈輕量建議列，撳即補全 */}
        {typeSugs.length > 0 && (
          <div
            className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800"
            role="listbox"
            aria-label="type 運算子建議"
          >
            <div className="flex items-center gap-1.5 border-b border-slate-100 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:border-slate-700/60 dark:text-slate-500">
              <Hash size={12} />
              限定類別
            </div>
            <div className="max-h-56 overflow-y-auto p-1">
              {typeSugs.map((s) => {
                const SIcon = KIND_META[s.id].icon
                return (
                  <button
                    key={s.id}
                    type="button"
                    role="option"
                    aria-selected={parsed.typeFilter === s.id}
                    onClick={() => {
                      setRaw(s.fill)
                      focusInput()
                    }}
                    className="group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/40"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-400 transition-colors group-hover:bg-accent group-hover:text-white dark:bg-slate-700 dark:text-slate-400">
                      <SIcon size={13} />
                    </span>
                    <span className="truncate text-sm text-slate-700 dark:text-slate-200">{s.label}</span>
                    <span className="ml-auto shrink-0 font-mono text-xs text-slate-400 dark:text-slate-500">
                      type:{s.id}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

          {/* 控制台工具列：視圖切換 / 模式範圍 / 即時命中數（細線分隔，似儀錶帶） */}
          <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-700/60">
            <SlidersHorizontal size={14} className="hidden text-slate-300 dark:text-slate-600 sm:block" />
            <SegmentedControl
              size="sm"
              options={[
                { id: 'grouped' as const, label: '分類' },
                { id: 'ranked' as const, label: '最相關' },
                { id: 'recent' as const, label: '最近' },
              ]}
              value={view}
              onChange={setView}
            />
            <button
              type="button"
              onClick={() => setScopeMode((v) => !v)}
              aria-pressed={scopeMode}
              className={cx(
                'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition',
                scopeMode
                  ? 'border-accent/30 bg-accent-soft text-accent-strong dark:border-accent/40 dark:bg-accent/15 dark:text-accent'
                  : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700',
              )}
            >
              {scopeMode ? `只搜${mode === 'learning' ? '個人' : '工作'}模式` : '搜全部模式'}
            </button>
            <div className="flex-1" />
            {hasQuery && (
              <span
                className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400"
                aria-live="polite"
                aria-atomic="true"
              >
                <span className="tabular-nums text-base font-semibold text-accent-strong dark:text-accent">
                  {total}
                </span>
                項命中
                {raw.trim() && (
                  <Tooltip label={isPinned(query || raw, pins) ? '取消釘選' : '釘選此搜尋'}>
                    <button
                      type="button"
                      onClick={() => togglePin(query || raw)}
                      aria-label={isPinned(query || raw, pins) ? '取消釘選此搜尋' : '釘選此搜尋'}
                      aria-pressed={isPinned(query || raw, pins)}
                      className={cx(
                        'rounded-md p-1 transition',
                        isPinned(query || raw, pins)
                          ? 'text-amber-500'
                          : 'text-slate-300 hover:text-amber-500 dark:text-slate-600',
                      )}
                    >
                      <Star size={14} className={isPinned(query || raw, pins) ? 'fill-amber-400' : ''} />
                    </button>
                  </Tooltip>
                )}
              </span>
            )}
          </div>

          {/* 類別過濾 pills（有命中先顯示） */}
          {hasQuery && pillOrder.length > 1 && (
            <div className="mt-3">
              <Pills
                size="sm"
                options={pillOrder.map((id) => ({
                  id,
                  label: id === 'all' ? '全部' : KIND_META[id].label,
                }))}
                counts={kindCounts}
                active={kindFilter}
                onChange={setKindFilter}
              />
            </div>
          )}
        </div>
      </section>

      {/* 主體：未輸入 → 最近 / 釘選；有輸入 → 結果 + 預覽 */}
      {!hasQuery ? (
        <StartScreen
          recents={recents}
          pins={pins}
          onPick={(q) => {
            setRaw(q)
            focusInput()
          }}
          onRemoveRecent={removeRecent}
          onClearRecents={clearRecents}
          onUnpin={(q) => togglePin(q)}
        />
      ) : total === 0 ? (
        <EmptyState
          icon={Radar}
          title={`掃唔到「${query || raw}」`}
          hint={
            scopeMode
              ? '換個關鍵字、清除類別過濾，或者撳「搜全部模式」擴大探照範圍。又或者就用呢句字，即刻開一筆：'
              : '換個關鍵字、清除類別過濾。又或者就用呢句字，即刻開一筆：'
          }
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button variant="secondary" size="sm" icon={InboxIcon} onClick={() => createFromQuery('inbox')}>
                加入擷取
              </Button>
              <Button variant="secondary" size="sm" icon={FileText} onClick={() => createFromQuery('note')}>
                建立筆記
              </Button>
              <Button variant="secondary" size="sm" icon={CheckSquare} onClick={() => createFromQuery('task')}>
                建立待辦
              </Button>
              {scopeMode && (
                <Button variant="ghost" size="sm" icon={PlusCircle} onClick={() => setScopeMode(false)}>
                  搜全部模式
                </Button>
              )}
            </div>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
          {/* 結果清單 */}
          <div className="space-y-3">
            {view !== 'grouped' ? (
              <UICard clip className="p-1.5">
                {filtered.map((h, i) => (
                  <ResultRow
                    key={h.id}
                    hit={h}
                    query={deferredQuery}
                    active={i === activeIdx}
                    index={i}
                    onHover={() => setActiveIdx(i)}
                    onOpen={() => goFeature(h)}
                    rowRef={(el) => registerRow(rowRefs, h.id, el)}
                  />
                ))}
              </UICard>
            ) : (
              // flatVisible 就係 grouped 順序 flatMap，故各組起始 index = 前面各組 hits 長度之和；
              // 用 running offset O(1) 累加，等價於原本逐組 findIndex（避免 O(組數 × 結果數) 掃描）。
              (() => {
                let startIdx = 0
                return grouped.map((g) => {
                  const groupStart = startIdx
                  startIdx += g.hits.length
                  const GIcon = g.icon
                  const gTone = KIND_META[g.kindId].tone
                  return (
                    <UICard key={g.kindId} clip>
                      <div className="flex items-center gap-2.5 border-b border-slate-100 bg-slate-50/50 px-3 py-2.5 dark:border-slate-700/60 dark:bg-slate-900/30">
                        <span className={cx('flex h-6 w-6 shrink-0 items-center justify-center rounded-lg', TONE_CHIP[gTone])}>
                          <GIcon size={14} />
                        </span>
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                          {g.label}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium tabular-nums text-slate-400 dark:bg-slate-700/60 dark:text-slate-500">
                          {g.hits.length}
                        </span>
                      </div>
                      <div className="p-1.5">
                        {g.hits.map((h, j) => {
                          const flatIdx = groupStart + j
                          return (
                            <ResultRow
                              key={h.id}
                              hit={h}
                              query={deferredQuery}
                              active={flatIdx === activeIdx}
                              index={flatIdx}
                              onHover={() => setActiveIdx(flatIdx)}
                              onOpen={() => goFeature(h)}
                              rowRef={(el) => registerRow(rowRefs, h.id, el)}
                            />
                          )
                        })}
                      </div>
                    </UICard>
                  )
                })
              })()
            )}
          </div>

          {/* 預覽面板（桌面） */}
          <div className="hidden lg:block">
            <div className="sticky top-2">
              {activeHit ? (
                <PreviewPanel
                  hit={activeHit}
                  query={deferredQuery}
                  onOpen={() => goFeature(activeHit)}
                  onCopy={() => copyText(activeHit.body || activeHit.title)}
                  onPushInbox={() => {
                    inboxCol.add({ id: uid(), text: activeHit.title, mode, createdAt: new Date().toISOString() })
                    toast.success('已加入快速擷取')
                  }}
                />
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* 鍵盤提示腳註 */}
      {hasQuery && total > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1 text-[11px] text-slate-400 dark:text-slate-500">
          <span className="flex items-center gap-1">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> 選擇
          </span>
          <span className="flex items-center gap-1">
            <Kbd>↵</Kbd> 開啟
          </span>
          <span className="flex items-center gap-1">
            <Kbd>⌘</Kbd>
            <Kbd>1–9</Kbd> 快速跳
          </span>
          <span className="flex items-center gap-1">
            <Kbd>Tab</Kbd> 切類別
          </span>
          <span className="flex items-center gap-1">
            <Kbd>esc</Kbd> 清空
          </span>
        </div>
      )}
    </div>
  )
}

// ───────── 子元件：結果一行 ─────────
function ResultRow({
  hit,
  query,
  active,
  index,
  onHover,
  onOpen,
  rowRef,
}: {
  hit: Hit
  query: string
  active: boolean
  index: number
  onHover: () => void
  onOpen: () => void
  rowRef: (el: HTMLButtonElement | null) => void
}) {
  const Icon = hit.icon
  // 標題高亮：獨立 fuzzyMatch（index 永遠對應標題本身，唔會錯位）
  const titleHit = query ? fuzzyMatch(hit.title, query) : null
  const titleSegs = highlightSegments(hit.title, titleHit?.indices ?? [])
  // 命中欄位同標題唔同（例如命中內文）→ 額外顯示 snippet
  const showSnippet = Boolean(query) && hit.matchedField !== hit.title && hit.indices.length > 0
  const snip = showSnippet ? snippetAround(hit.matchedField, hit.indices) : null
  const snipSegs = snip
    ? highlightSegments(
        snip.text,
        hit.indices.map((i) => i - snip.offset).filter((i) => i >= 0 && i < snip.text.length),
      )
    : null

  return (
    <button
      ref={rowRef}
      type="button"
      aria-current={active ? 'true' : undefined}
      onMouseEnter={onHover}
      onClick={onOpen}
      className={cx(
        'group relative flex w-full items-start gap-3 rounded-lg py-2 pl-3 pr-2.5 text-left transition-colors',
        active
          ? 'bg-accent-soft dark:bg-accent/15'
          : 'hover:bg-slate-50 dark:hover:bg-slate-700/40',
      )}
    >
      {/* 聚焦光束：active 時左側 accent 軌條 */}
      <span
        aria-hidden="true"
        className={cx(
          'absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-accent transition-opacity',
          active ? 'opacity-100' : 'opacity-0',
        )}
      />
      <span
        className={cx(
          'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors',
          active
            ? 'bg-accent text-white shadow-sm shadow-accent/30'
            : 'bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-400',
        )}
      >
        <Icon size={15} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span
            className={cx(
              'truncate text-sm font-medium',
              active ? 'text-accent-strong dark:text-accent' : 'text-slate-700 dark:text-slate-200',
            )}
          >
            {titleSegs.map((s, i) =>
              s.hit ? (
                <mark key={i} className="rounded-sm bg-amber-200/70 px-0.5 text-inherit dark:bg-amber-400/30">
                  {s.text}
                </mark>
              ) : (
                <span key={i}>{s.text}</span>
              ),
            )}
          </span>
          {index < 9 && (
            <Kbd
              className={cx(
                'ml-auto hidden shrink-0 transition-opacity sm:inline-flex',
                active ? 'opacity-100' : 'opacity-40 group-hover:opacity-100',
              )}
            >
              ⌘{index + 1}
            </Kbd>
          )}
        </span>
        {snipSegs && (
          <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">
            {snipSegs.map((s, i) =>
              s.hit ? (
                <mark key={i} className="rounded-sm bg-amber-200/70 px-0.5 text-inherit dark:bg-amber-400/30">
                  {s.text}
                </mark>
              ) : (
                <span key={i}>{s.text}</span>
              ),
            )}
          </span>
        )}
        {hit.subtitle && !snipSegs && (
          <span className="mt-0.5 block truncate text-xs text-slate-400 dark:text-slate-500">
            {hit.subtitle}
          </span>
        )}
      </span>
      <Badge tone={hit.badgeTone} className="mt-0.5 hidden shrink-0 sm:inline-flex">
        {hit.kindLabel}
      </Badge>
      <ArrowRight
        size={15}
        className={cx(
          'mt-1.5 shrink-0 transition',
          active ? 'text-accent opacity-100' : 'text-slate-300 opacity-0 group-hover:opacity-100 dark:text-slate-600',
        )}
      />
    </button>
  )
}

// ───────── 子元件：預覽面板 ─────────
function PreviewPanel({
  hit,
  query,
  onOpen,
  onCopy,
  onPushInbox,
}: {
  hit: Hit
  query: string
  onOpen: () => void
  onCopy: () => void
  onPushInbox: () => void
}) {
  const Icon = hit.icon
  const bodySegs = hit.body
    ? highlightSegments(hit.body.slice(0, 600), query ? (fuzzyMatch(hit.body.slice(0, 600), query)?.indices ?? []) : [])
    : null
  return (
    <UICard clip>
      <div className="border-b border-slate-100 bg-slate-50/40 p-4 dark:border-slate-700/60 dark:bg-slate-900/30">
        <p className="mb-2 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
          <Radar size={11} className="text-accent/70" />
          鎖定 · PREVIEW
        </p>
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
            <Icon size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <Badge tone={hit.badgeTone}>{hit.kindLabel}</Badge>
            <h3 className="mt-1.5 break-words text-sm font-semibold text-slate-800 dark:text-slate-100">
              {hit.title}
            </h3>
          </div>
        </div>
      </div>

      <div className="space-y-3 p-4">
        {bodySegs && (
          <p className="max-h-48 overflow-y-auto whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {bodySegs.map((s, i) =>
              s.hit ? (
                <mark key={i} className="rounded-sm bg-amber-200/70 px-0.5 dark:bg-amber-400/30">
                  {s.text}
                </mark>
              ) : (
                <span key={i}>{s.text}</span>
              ),
            )}
          </p>
        )}
        {hit.meta.length > 0 && (
          <>
            <Separator />
            <dl className="grid grid-cols-1 gap-y-2 text-xs">
              {hit.meta.map((m, i) => (
                <div key={i} className="flex items-start justify-between gap-3">
                  <dt className="shrink-0 text-slate-400 dark:text-slate-500">{m.label}</dt>
                  <dd className="break-words text-right font-medium tabular-nums text-slate-600 dark:text-slate-300">
                    {m.value || '—'}
                  </dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-slate-100 p-3 dark:border-slate-700/60">
        <Button size="sm" icon={CornerDownLeft} onClick={onOpen} className="flex-1">
          開啟
        </Button>
        <Tooltip label="複製內容">
          <IconButton label="複製內容" size="sm" onClick={onCopy}>
            <Copy size={16} />
          </IconButton>
        </Tooltip>
        <Tooltip label="加入快速擷取">
          <IconButton label="加入快速擷取" size="sm" onClick={onPushInbox}>
            <InboxIcon size={16} />
          </IconButton>
        </Tooltip>
      </div>
    </UICard>
  )
}

// ───────── 子元件：起始畫面（最近 / 釘選 / 範圍提示）─────────
function StartScreen({
  recents,
  pins,
  onPick,
  onRemoveRecent,
  onClearRecents,
  onUnpin,
}: {
  recents: { id: string; q: string; at: number }[]
  pins: { id: string; q: string; createdAt: number }[]
  onPick: (q: string) => void
  onRemoveRecent: (id: string) => void
  onClearRecents: () => void
  onUnpin: (q: string) => void
}) {
  const examples = ['市場營銷', '5A', '會議', '死線', '目標']
  const isFresh = pins.length === 0 && recents.length === 0
  return (
    <div className="space-y-4">
      {/* 首次／空白：command-center 歡迎面板（暖文案 + 例子做明確下一步） */}
      {isFresh && (
        <UICard clip className="relative p-6 text-center sm:p-8">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-0 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/10 blur-3xl dark:bg-accent/15"
          />
          <span className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
            <Radar size={26} />
          </span>
          <h2 className="relative mt-4 font-serif text-xl font-semibold tracking-tight text-slate-800 dark:text-slate-100">
            一格搜尋，掃晒成個平台
          </h2>
          <p className="relative mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            筆記、題庫、資源、教案、會議、班別、學生、行事曆、待辦、記帳…
            即時模糊比對，鍵盤一路操控。打幾個字就見到。
          </p>
          <div className="relative mt-5 flex flex-wrap items-center justify-center gap-2">
            {examples.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => onPick(ex)}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-xs transition hover:border-accent/40 hover:bg-accent-soft hover:text-accent-strong dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-accent/40 dark:hover:bg-accent/15 dark:hover:text-accent"
              >
                <Search size={13} className="opacity-60" />
                {ex}
              </button>
            ))}
          </div>
        </UICard>
      )}

      {pins.length > 0 && (
        <UICard className="p-4">
          <div className="mb-2.5 flex items-center gap-1.5">
            <Star size={14} className="fill-amber-400 text-amber-500" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              釘選搜尋
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {pins.map((p) => (
              <span key={p.id} className="inline-flex items-center overflow-hidden rounded-full border border-amber-200 bg-amber-50 text-xs dark:border-amber-500/20 dark:bg-amber-500/10">
                <button
                  type="button"
                  onClick={() => onPick(p.q)}
                  className="py-1 pl-3 pr-1.5 font-medium text-amber-700 transition hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-500/15"
                >
                  {p.q}
                </button>
                <button
                  type="button"
                  onClick={() => onUnpin(p.q)}
                  aria-label="取消釘選"
                  className="px-1.5 py-1 text-amber-400 transition hover:text-amber-600 dark:hover:text-amber-200"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        </UICard>
      )}

      {recents.length > 0 && (
        <UICard className="p-4">
          <div className="mb-1 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Clock size={14} className="text-slate-400" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                最近搜尋
              </h2>
            </div>
            <button
              type="button"
              onClick={onClearRecents}
              className="text-xs text-slate-400 transition hover:text-rose-500"
            >
              清除
            </button>
          </div>
          <ul className="-mx-1 divide-y divide-slate-100 dark:divide-slate-700/60">
            {recents.map((r) => (
              <li key={r.id} className="group flex items-center">
                <button
                  type="button"
                  onClick={() => onPick(r.q)}
                  className="flex flex-1 items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm text-slate-600 transition hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700/40"
                >
                  <Search size={14} className="shrink-0 text-slate-300 dark:text-slate-600" />
                  <span className="truncate">{r.q}</span>
                  <span className="ml-auto shrink-0 text-[11px] text-slate-300 dark:text-slate-600">
                    {relativeTime(new Date(r.at).toISOString())}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onRemoveRecent(r.id)}
                  aria-label="移除"
                  className="mr-1 rounded-md p-2 text-slate-300 opacity-0 transition hover:text-rose-500 focus-visible:opacity-100 group-hover:opacity-100 max-sm:opacity-100 dark:text-slate-600"
                >
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
        </UICard>
      )}

      {/* 試下搵（fresh 時 hero 已示範，呢度只喺有歷史時補充） */}
      {!isFresh && (
        <div className="flex flex-wrap items-center gap-2 px-1 text-xs text-slate-400 dark:text-slate-500">
          <span>試下搵：</span>
          {examples.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => onPick(ex)}
              className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-500 transition hover:bg-accent hover:text-white dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-accent dark:hover:text-white"
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      {/* 運算子（Raycast 風 power-user 提示）— 撳一下即套入搜尋框 */}
      <div className="flex flex-wrap items-center gap-2 px-1 text-xs text-slate-400 dark:text-slate-500">
        <span>運算子：</span>
        {OPERATOR_HINTS.map((op) => (
          <Tooltip key={op.token} label={op.desc}>
            <button
              type="button"
              onClick={() => onPick(op.fill)}
              className="rounded-full border border-slate-200 bg-white px-2.5 py-1 font-mono font-medium text-slate-500 transition hover:border-accent hover:text-accent dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-accent dark:hover:text-accent"
            >
              {op.token}
            </button>
          </Tooltip>
        ))}
      </div>
    </div>
  )
}

// 運算子提示（StartScreen 顯示；token = 標籤，fill = 撳落去套入搜尋框嘅字）
const OPERATOR_HINTS: { token: string; fill: string; desc: string }[] = [
  { token: 'type:note', fill: 'type:note ', desc: '限定某類資料（例如 type:note 淨係筆記）' },
  { token: 'is:pinned', fill: 'is:pinned ', desc: '淨係顯示已釘選嘅項目' },
  { token: 'in:recent', fill: 'in:recent ', desc: `淨係喺最近 ${RECENT_DAYS} 日更新／建立嘅嘢搵` },
  { token: 'sort:recent', fill: 'sort:recent ', desc: '改用「最近」排序而唔係相關度' },
]

// 分組標頭嘅 icon chip 軟色（沿用既有 6 個 tone，畀每個類別一個鮮明身份，
// 避免「一排一模一樣 slate chip」嘅 spreadsheet 感）。
const TONE_CHIP: Record<Hit['badgeTone'], string> = {
  slate: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300',
  accent: 'bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent',
  green: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300',
  rose: 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300',
  blue: 'bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300',
}

// ───────── 小工具 ─────────
function registerRow(
  refs: React.MutableRefObject<Map<string, HTMLButtonElement>>,
  id: string,
  el: HTMLButtonElement | null,
) {
  if (el) refs.current.set(id, el)
  else refs.current.delete(id)
}

function firstLine(text: string): string {
  const line = text.split('\n').find((l) => l.trim()) ?? text
  return line.trim().slice(0, 100)
}

function fmtDate(iso?: string): string {
  if (!iso) return '—'
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return iso
  const d = new Date(t)
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
}

function daysToLabel(dateStr: string): string {
  const target = Date.parse(dateStr + 'T00:00:00')
  if (Number.isNaN(target)) return ''
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const days = Math.round((target - today.getTime()) / 864e5)
  if (days === 0) return ' · 今日'
  if (days > 0) return ` · 仲有 ${days} 日`
  return ` · 過咗 ${-days} 日`
}

const QTYPE: Record<string, string> = { mc: '選擇題', short: '短答', long: '長答', case: '個案' }
const DIFF: Record<string, string> = { easy: '易', medium: '中', hard: '難' }
const RES_TYPE: Record<string, string> = {
  handout: '講義',
  slides: '簡報',
  paper: '試題',
  link: '連結',
  video: '影片',
  note: '筆記',
}
