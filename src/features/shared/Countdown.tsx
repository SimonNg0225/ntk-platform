import { useMemo, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  AlarmClock,
  BarChart3,
  CalendarDays,
  CalendarHeart,
  Clock,
  Hourglass,
  NotebookPen,
  PartyPopper,
  PenLine,
  PlaneLanding,
  PlaneTakeoff,
  Pin,
  Plus,
  Smartphone,
  Tag,
  Ticket,
  Trash2,
  X,
} from 'lucide-react'
import { useCollection } from '../../lib/store'
import { countdownsCol } from '../../data/collections'
import type { Countdown as CountdownItem, CountdownCategory } from '../../data/types'
import {
  groupByTime,
  filterByCategory,
  categoryCounts,
  type CategoryFilter,
} from './countdown/grouping'
import { useMode } from '../../context/ModeContext'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import {
  Button,
  EmptyState,
  Field,
  IconButton,
  Input,
  Modal,
  Tabs,
  Textarea,
  cx,
} from '../../ui'
import CalendarSubscribe from './calendar/CalendarSubscribe'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'] as const

type Tone = 'rose' | 'amber' | 'green' | 'slate'

/** 緊急度 tone（今日 / <=3 日 rose、<=14 日 amber、其餘 green、已過去 slate）。 */
export function toneOf(days: number): Tone {
  if (days < 0) return 'slate'
  if (days <= 3) return 'rose'
  if (days <= 14) return 'amber'
  return 'green'
}

/**
 * 緊急度 → 登機牌狀態配色（airport departure-board 語彙）。
 *  · status：候機顯示牌上嗰句狀態字（boarding / final call …）
 *  · dot：狀態燈顏色
 *  · bar：逼近進度條
 *  · stub：登機牌右半「存根」嘅底色（呼應緊急度，帶 dark:）
 *  · ring：hover 時卡片邊框點亮
 * 大數字（split-flap）一律深色板 + 白字，靠狀態燈同存根帶緊急度，唔靠數字變色。
 */
const URGENCY: Record<
  Tone,
  { status: string; dot: string; bar: string; stub: string; ring: string }
> = {
  rose: {
    status: '最後召集',
    dot: 'bg-rose-500',
    bar: 'bg-rose-500',
    stub: 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300',
    ring: 'group-hover:border-rose-300/70 dark:group-hover:border-rose-500/40',
  },
  amber: {
    status: '準備登機',
    dot: 'bg-amber-500',
    bar: 'bg-amber-500',
    stub: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300',
    ring: 'group-hover:border-amber-300/70 dark:group-hover:border-amber-500/40',
  },
  green: {
    status: '準時候機',
    dot: 'bg-emerald-500',
    bar: 'bg-emerald-500',
    stub: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
    ring: 'group-hover:border-emerald-300/70 dark:group-hover:border-emerald-500/40',
  },
  slate: {
    status: '已抵達',
    dot: 'bg-slate-400 dark:bg-slate-500',
    bar: 'bg-slate-300 dark:bg-slate-600',
    stub: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300',
    ring: 'group-hover:border-slate-300 dark:group-hover:border-slate-600',
  },
}

// ───────── Split-flap 顯示牌（機場離境牌數字感）─────────
// 深色板條 + 中央橫縫（::after hairline）+ 等寬數字。純表現，唔影響任何邏輯。
// size: 'lg' 用喺登機牌大數字、'sm' 用喺頂部 hero 狀態牌。

/** 單一翻牌槽：一個字元（數字 / 「今日」字 / 「—」）。 */
function FlapSlot({
  char,
  size = 'lg',
}: {
  char: string
  size?: 'sm' | 'lg'
}) {
  const dim =
    size === 'lg'
      ? 'h-14 w-10 text-4xl sm:h-16 sm:w-12 sm:text-5xl'
      : 'h-9 w-7 text-2xl sm:h-10 sm:w-8 sm:text-3xl'
  return (
    <span
      className={cx(
        'relative inline-flex items-center justify-center rounded-md bg-slate-900 font-mono font-bold leading-none tabular-nums slashed-zero text-slate-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_1px_2px_rgba(15,23,42,0.4)] ring-1 ring-inset ring-white/5 dark:bg-slate-950',
        // 中央翻牌縫（一條穿過中線嘅暗痕）
        'after:pointer-events-none after:absolute after:inset-x-0 after:top-1/2 after:h-px after:-translate-y-1/2 after:bg-black/45',
        dim,
      )}
    >
      {char}
    </span>
  )
}

/** 一組翻牌：將一個（已絕對值）數字逐位拆成翻牌槽；非數字內容當單槽顯示。 */
function FlapDisplay({
  value,
  size = 'lg',
  ariaLabel,
}: {
  value: number | string
  size?: 'sm' | 'lg'
  ariaLabel?: string
}) {
  const text = String(value)
  const chars = /^\d+$/.test(text) ? text.split('') : [text]
  const gap = size === 'lg' ? 'gap-1.5' : 'gap-1'
  return (
    <span
      className={cx('inline-flex items-stretch', gap)}
      role="img"
      aria-label={ariaLabel ?? text}
    >
      {chars.map((c, i) => (
        <FlapSlot key={i} char={c} size={size} />
      ))}
    </span>
  )
}

const CATEGORY_META: Record<
  CountdownCategory,
  { icon: LucideIcon; label: string; chip: string }
> = {
  exam: {
    icon: NotebookPen,
    label: '考試',
    chip: 'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300',
  },
  deadline: {
    icon: AlarmClock,
    label: '死線',
    chip: 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300',
  },
  assessment: {
    icon: BarChart3,
    label: '評估',
    chip: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300',
  },
  event: {
    icon: PartyPopper,
    label: '活動',
    chip: 'bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300',
  },
  other: {
    icon: Pin,
    label: '其他',
    chip: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300',
  },
}

const CATEGORY_OPTIONS: CountdownCategory[] = [
  'exam',
  'deadline',
  'assessment',
  'event',
  'other',
]

/** 將 Date 轉成本地時區嘅 YYYY-MM-DD（避免 toISOString 時差問題）。 */
export function toKey(d: Date): string {
  const y = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${mm}-${dd}`
}

/** 由 YYYY-MM-DD 砌返一個本地 Date（中午，避開時區邊界）。畸形 key 回傳 Invalid Date。 */
export function fromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return new Date(NaN)
  return new Date(y, m - 1, d, 12, 0, 0, 0)
}

/** 仲有幾多日：同一日 = 0、明日 = 1、琴日 = -1。today 同 target 同基準（當地中午）。 */
export function daysUntil(dateKey: string, todayKey: string): number {
  const target = fromKey(dateKey)
  const today = fromKey(todayKey)
  return Math.round((target.getTime() - today.getTime()) / 864e5)
}

/** 格式化：M月D日（星期X），可加時間。 */
export function formatDate(dateKey: string, time?: string): string {
  const d = fromKey(dateKey)
  const base = `${d.getMonth() + 1}月${d.getDate()}日（星期${WEEKDAYS[d.getDay()]}）`
  return time ? `${base} ${time}` : base
}

/** 親切嘅一句註腳，按緊急度變語氣（登機口廣播口吻，但保持溫暖）。 */
function urgencyHint(days: number): string {
  if (days === 0) return '今日起飛，加油！'
  if (days === 1) return '聽日就到閘口喇'
  if (days <= 3) return '即將登機，做最後衝刺'
  if (days <= 7) return '一星期內，記得 check-in'
  if (days <= 14) return '兩星期內，慢慢執行李'
  if (days <= 30) return '一個月內，可以開始計劃'
  return '航班排好咗，放鬆啲'
}

type TabId = 'upcoming' | 'past'

/** 頂部分類篩選用嘅 pill（航廈「閘口」選擇器；樣式對齊 Modal 入面嘅分類掣）。 */
function FilterPill({
  label,
  count,
  active,
  onClick,
  icon: Icon,
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
  icon?: LucideIcon
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
        active
          ? 'border-accent bg-accent text-white shadow-sm'
          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
      )}
    >
      {Icon && <Icon size={14} />}
      {label}
      <span
        className={cx(
          'rounded px-1 font-mono text-[11px] tabular-nums',
          active
            ? 'bg-white/20 text-white'
            : 'bg-slate-100 text-slate-500 dark:bg-slate-700/70 dark:text-slate-400',
        )}
      >
        {count}
      </span>
    </button>
  )
}

export default function Countdown() {
  const items = useCollection(countdownsCol)
  const { mode } = useMode()
  const toast = useToast()
  const confirm = useConfirm()

  const todayKey = useMemo(() => toKey(new Date()), [])

  const [tab, setTab] = useState<TabId>('upcoming')
  // 分類篩選（'all' = 唔篩）；只作用喺「即將到嚟」一頁。
  const [catFilter, setCatFilter] = useState<CategoryFilter>('all')

  // 新增 Modal 狀態
  const [modalOpen, setModalOpen] = useState(false)
  // 訂閱到手機日曆 Modal
  const [subscribeOpen, setSubscribeOpen] = useState(false)
  const [fTitle, setFTitle] = useState('')
  const [fDate, setFDate] = useState(todayKey)
  const [fTime, setFTime] = useState('')
  const [fCategory, setFCategory] = useState<CountdownCategory | ''>('')
  const [fNotes, setFNotes] = useState('')

  // 按目前模式過濾（mode 為 'both'、等於目前模式、或無 mode 視為共用）。
  const visible = useMemo(
    () =>
      items.filter((c) => c.mode === 'both' || c.mode === mode || !c.mode),
    [items, mode],
  )

  // 即將到嚟（今日及未來）：升序，最近喺前。
  const upcoming = useMemo(
    () =>
      visible
        .filter((c) => daysUntil(c.date, todayKey) >= 0)
        .slice()
        .sort((a, b) => a.date.localeCompare(b.date)),
    [visible, todayKey],
  )

  // 已過去：降序，最近過去喺前。
  const past = useMemo(
    () =>
      visible
        .filter((c) => daysUntil(c.date, todayKey) < 0)
        .slice()
        .sort((a, b) => b.date.localeCompare(a.date)),
    [visible, todayKey],
  )

  // 頂部統計：最近一項（最快到嚟嘅未過事件 N 日）。用全部 upcoming（唔受篩選影響）。
  const nearestDays = upcoming.length > 0 ? daysUntil(upcoming[0].date, todayKey) : null

  // 分類 pill 計數（用全部 upcoming，篩走邊個都仍見到總量）。
  const counts = useMemo(() => categoryCounts(upcoming), [upcoming])

  // 套用分類篩選後嘅 upcoming（已排序，filterByCategory 保次序）。
  const filteredUpcoming = useMemo(
    () => filterByCategory(upcoming, catFilter),
    [upcoming, catFilter],
  )

  // 即將到嚟：按曆法分成 本週內 / 本月內 / 更遠 三段（只回有內容嘅段）。
  const groups = useMemo(
    () => groupByTime(filteredUpcoming, todayKey),
    [filteredUpcoming, todayKey],
  )

  const list = tab === 'upcoming' ? filteredUpcoming : past

  function openAddModal() {
    setFTitle('')
    setFDate(todayKey)
    setFTime('')
    setFCategory('')
    setFNotes('')
    setModalOpen(true)
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = fTitle.trim()
    if (!trimmed) return
    const payload: Omit<CountdownItem, 'id'> = {
      title: trimmed,
      date: fDate,
      mode: 'both',
      createdAt: new Date().toISOString(),
    }
    if (fTime) payload.time = fTime
    if (fCategory) payload.category = fCategory
    const trimmedNotes = fNotes.trim()
    if (trimmedNotes) payload.notes = trimmedNotes
    countdownsCol.add(payload)
    setModalOpen(false)
    toast.success('已新增倒數')
  }

  async function handleRemove(c: CountdownItem) {
    const ok = await confirm({
      title: '刪除倒數？',
      message: `確定要刪除「${c.title}」？此動作無法復原。`,
      confirmText: '刪除',
      tone: 'danger',
    })
    if (!ok) return
    countdownsCol.remove(c.id)
    toast.success('已刪除倒數')
  }

  // 單張倒數卡 = 一張登機牌（同 upcoming 分段同 past flat list 共用，外觀一致）。
  // 左半「主聯」：閘口 chip + 航班名（標題）+ 離境日期 + split-flap 大數字；
  // 右半「存根」：狀態燈 + 緊急度狀態字 + 逼近進度（過去航班顯示「已抵達」）。
  // 兩聯之間一條虛線打孔縫（手機上下疊、sm 以上左右並排）。
  function renderCard(c: CountdownItem, index = 0) {
    const days = daysUntil(c.date, todayKey)
    const tone = toneOf(days)
    const u = URGENCY[tone]
    const meta = c.category ? CATEGORY_META[c.category] : null
    const CatIcon = meta ? meta.icon : Ticket
    const isToday = days === 0
    const isPast = days < 0
    // 閘口代碼：分類首兩個英文 + 緊急度（純裝飾，似登機牌嘅 gate）
    const gateCode = (c.category ? c.category.slice(0, 2) : 'NT').toUpperCase()
    // 30 日內畫一條「逼近」進度條（越近越滿）；其餘 / 已過去唔畫。
    const progress = !isPast && days <= 30 ? Math.round((1 - days / 30) * 100) : null

    return (
      <article
        key={c.id}
        className={cx(
          'group relative flex animate-fade-in-up flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xs transition duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-700/60 dark:bg-slate-800 dark:shadow-none sm:flex-row',
          u.ring,
        )}
        style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
      >
        {/* 主聯 */}
        <div className="relative flex flex-1 flex-col p-5">
          {/* 第一行：閘口 chip + 航班名 + 刪除 */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span
                className={cx(
                  'relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition duration-200 group-hover:scale-105',
                  meta ? meta.chip : 'bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent',
                )}
              >
                <CatIcon size={21} strokeWidth={2} />
              </span>
              <div className="min-w-0">
                <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-slate-400 dark:text-slate-500">
                  {meta ? meta.label : '行程'} · 閘口 {gateCode}
                </p>
                <h3 className="truncate text-base font-semibold text-slate-800 dark:text-slate-100">
                  {c.title}
                </h3>
                <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-slate-500 dark:text-slate-400">
                  {isPast ? (
                    <PlaneLanding size={13} className="shrink-0 text-slate-400" />
                  ) : (
                    <PlaneTakeoff size={13} className="shrink-0 text-accent" />
                  )}
                  {formatDate(c.date, c.time)}
                </p>
              </div>
            </div>
            <IconButton
              label={`刪除「${c.title}」`}
              tone="danger"
              onClick={() => handleRemove(c)}
              className="shrink-0 opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100"
            >
              <Trash2 size={17} />
            </IconButton>
          </div>

          {/* split-flap 大數字區 */}
          <div className="mt-5 flex flex-1 items-end">
            {isToday ? (
              <div className="flex items-baseline gap-2">
                <FlapDisplay value="今" ariaLabel="今日出發" />
                <FlapDisplay value="日" />
                <span className="ml-1 self-end pb-1 text-sm font-semibold text-rose-600 dark:text-rose-400">
                  出發
                </span>
              </div>
            ) : (
              <p className="flex items-baseline gap-2.5">
                <FlapDisplay
                  value={Math.abs(days)}
                  ariaLabel={`${Math.abs(days)} 日${days > 0 ? '後' : '前'}`}
                />
                <span className="self-end pb-1 text-sm font-medium text-slate-400 dark:text-slate-500">
                  {days > 0 ? '日後起飛' : '日前已飛'}
                </span>
              </p>
            )}
          </div>

          {c.notes && (
            <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              {c.notes}
            </p>
          )}
        </div>

        {/* 打孔縫：手機橫向、sm 以上直向；兩端各一個半圓凹位（登機牌撕口） */}
        <div className="relative shrink-0 sm:w-px">
          {/* 半圓凹位 */}
          <span
            aria-hidden="true"
            className="absolute left-0 top-0 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-50 dark:bg-slate-900 sm:left-1/2"
          />
          <span
            aria-hidden="true"
            className="absolute bottom-0 right-0 h-3 w-3 translate-x-1/2 translate-y-1/2 rounded-full bg-slate-50 dark:bg-slate-900 sm:left-1/2 sm:right-auto sm:translate-x-[-50%]"
          />
          {/* 虛線本體 */}
          <span
            aria-hidden="true"
            className="block h-px w-full border-t border-dashed border-slate-300/80 dark:border-slate-600/70 sm:h-full sm:w-px sm:border-l sm:border-t-0"
          />
        </div>

        {/* 存根（boarding-pass stub）：狀態 + 逼近進度 */}
        <div className="relative flex shrink-0 flex-col justify-between gap-3 p-5 sm:w-44">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-slate-400 dark:text-slate-500">
              狀態 · Status
            </p>
            <p className="mt-1.5 flex items-center gap-2">
              <span className={cx('relative flex h-2 w-2', isPast && 'opacity-60')}>
                {!isPast && (
                  <span
                    className={cx(
                      'absolute inline-flex h-full w-full animate-ping rounded-full opacity-60',
                      u.dot,
                    )}
                  />
                )}
                <span className={cx('relative inline-flex h-2 w-2 rounded-full', u.dot)} />
              </span>
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                {u.status}
              </span>
            </p>
          </div>

          {/* 緊急度存根標籤 + 逼近進度 */}
          <div className="space-y-2">
            <span
              className={cx(
                'inline-flex items-center rounded-md px-2 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wider',
                u.stub,
              )}
            >
              {days > 0 ? `T-${days}` : isToday ? 'DEP TODAY' : `+${-days}d`}
            </span>
            {progress !== null && (
              <div
                className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700/60"
                role="img"
                aria-label={`距離出發 ${days} 日`}
              >
                <div
                  className={cx('h-full rounded-full transition-all duration-700', u.bar)}
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
          </div>
        </div>
      </article>
    )
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-6">
      {/* Hero — 機場離境牌：深色顯示板 + 翻牌大數字（跟模式主色作頂帶） */}
      <header className="relative overflow-hidden rounded-3xl bg-slate-900 text-white shadow-lg shadow-slate-900/30 ring-1 ring-white/5 dark:bg-slate-950 dark:shadow-black/40">
        {/* 頂部色帶（destination strip，跟模式主色） */}
        <div className="hero-gradient flex items-center justify-between gap-3 px-5 py-2.5 sm:px-7">
          <span className="inline-flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.3em] text-white">
            <PlaneTakeoff size={14} /> Departures · 重要日子
          </span>
          <span className="hidden font-mono text-[11px] uppercase tracking-[0.3em] text-white/70 sm:inline">
            NTK Terminal
          </span>
        </div>

        {/* 微弱掃描線質感（純裝飾） */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_3px,rgba(255,255,255,0.02)_3px,rgba(255,255,255,0.02)_4px)]"
        />

        <div className="relative px-5 py-6 sm:px-7 sm:py-7">
          {/* 頁面身份：kicker + serif 功能名（離境時刻表概念，功能名做主標題） */}
          <div className="flex flex-wrap items-start justify-between gap-x-5 gap-y-4">
            <div className="min-w-0">
              <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.3em] text-slate-400">
                <PlaneTakeoff size={13} className="shrink-0" /> Departures · 離境時刻表
              </p>
              <h1 className="mt-1.5 font-serif text-[28px] font-semibold leading-none tracking-tight text-white sm:text-[34px]">
                重要日子倒數
              </h1>

              {/* 最近一班「航班」：翻牌大數字（live 狀態，承接功能名做副資訊） */}
              <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.25em] text-slate-400">
                {nearestDays === null
                  ? 'No scheduled departures'
                  : nearestDays === 0
                    ? 'Now boarding'
                    : 'Next departure in'}
              </p>
              <div className="mt-3 flex items-end gap-3">
                {nearestDays === null ? (
                  <FlapDisplay value="—" ariaLabel="未有倒數" />
                ) : nearestDays === 0 ? (
                  <div className="flex items-baseline gap-2">
                    <FlapDisplay value="今" ariaLabel="今日出發" />
                    <FlapDisplay value="日" />
                  </div>
                ) : (
                  <>
                    <FlapDisplay value={nearestDays} ariaLabel={`最近一項仲有 ${nearestDays} 日`} />
                    <span className="pb-1 font-mono text-sm uppercase tracking-widest text-slate-400">
                      日後
                    </span>
                  </>
                )}
              </div>
              <p className="mt-3 max-w-sm text-sm text-slate-300">
                {nearestDays === null
                  ? '考試、死線、評估同活動，登記咗就一眼睇到仲爭幾耐起飛。'
                  : nearestDays === 0
                    ? '今日就係大日子，準備好出發喇！'
                    : `${upcoming.length} 班「航班」候機中 · ${urgencyHint(nearestDays)}`}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
              <Button
                variant="secondary"
                icon={Plus}
                onClick={openAddModal}
                className="border-white/15 bg-white/10 text-white backdrop-blur hover:bg-white/20 dark:border-white/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
              >
                登記新航班
              </Button>
              <button
                type="button"
                onClick={() => setSubscribeOpen(true)}
                className="inline-flex items-center justify-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-slate-300 backdrop-blur transition hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              >
                <Smartphone size={13} /> 訂閱到手機日曆
              </button>
            </div>
          </div>

          {/* 板底指標列（即將 / 最近 / 已抵達）— 翻牌字 + 標籤，取代三張一式 StatCard */}
          <div className="mt-6 grid grid-cols-3 divide-x divide-white/10 rounded-2xl bg-white/[0.04] ring-1 ring-white/10">
            {[
              { label: '候機中', sub: 'BOARDING', value: upcoming.length, icon: PlaneTakeoff },
              {
                label: '最近一項',
                sub: 'NEXT',
                value: nearestDays === null ? '—' : `${nearestDays}日`,
                icon: Hourglass,
              },
              { label: '已抵達', sub: 'ARRIVED', value: past.length, icon: PlaneLanding },
            ].map((s) => {
              const I = s.icon
              return (
                <div key={s.sub} className="px-3 py-3 text-center sm:px-4">
                  <p className="flex items-center justify-center gap-1 font-mono text-[10px] uppercase tracking-[0.2em] text-slate-400">
                    <I size={11} /> {s.sub}
                  </p>
                  <p className="mt-1 font-mono text-2xl font-bold tabular-nums slashed-zero text-white sm:text-3xl">
                    {s.value}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-400">{s.label}</p>
                </div>
              )
            })}
          </div>
        </div>
      </header>

      {/* 分頁（離境 / 抵達） */}
      <Tabs<TabId>
        tabs={[
          { id: 'upcoming', label: '候機中' },
          { id: 'past', label: '已抵達' },
        ]}
        active={tab}
        onChange={setTab}
        icons={{ upcoming: PlaneTakeoff, past: PlaneLanding }}
      />

      {/* 分類篩選 pill（只喺「即將到嚟」一頁；有兩個或以上分類先值得顯示） */}
      {tab === 'upcoming' && upcoming.length > 0 && (
        <div className="-mt-1 flex flex-wrap gap-2">
          <FilterPill
            label="全部"
            count={counts.all}
            active={catFilter === 'all'}
            onClick={() => setCatFilter('all')}
          />
          {CATEGORY_OPTIONS.filter((c) => counts[c] > 0).map((c) => {
            const m = CATEGORY_META[c]
            return (
              <FilterPill
                key={c}
                label={m.label}
                icon={m.icon}
                count={counts[c]}
                active={catFilter === c}
                onClick={() => setCatFilter(c)}
              />
            )
          })}
        </div>
      )}

      {/* 倒數列表 */}
      <section className="space-y-6">
        {list.length === 0 ? (
          tab === 'upcoming' ? (
            catFilter !== 'all' ? (
              <EmptyState
                icon={CalendarHeart}
                title="呢個閘口暫時冇航班"
                hint="揀返「全部」，或者撳上面其他閘口睇下。"
                action={
                  <Button variant="ghost" onClick={() => setCatFilter('all')}>
                    睇全部
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={PlaneTakeoff}
                art="empty-countdown"
                title="班次表仲係空白，登記第一班航班"
                hint="考試、交功課、生日、旅行⋯⋯登記個日子入離境牌，之後就一眼睇到仲爭幾耐起飛。"
                action={
                  <Button icon={Plus} onClick={openAddModal}>
                    登記第一班航班
                  </Button>
                }
              />
            )
          ) : (
            <EmptyState
              icon={PlaneLanding}
              title="暫時未有航班抵達"
              hint="日子過咗之後會搬嚟「已抵達」，等你回望飛過嘅里程碑。"
            />
          )
        ) : tab === 'upcoming' ? (
          // 即將到嚟：按 本週內 / 本月內 / 更遠 分段（似離境牌嘅時段分區）。
          groups.map((g) => (
            <div key={g.bucket} className="space-y-3">
              <div className="flex items-center gap-3 px-0.5">
                <h2 className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  {g.label}
                </h2>
                <span className="h-px flex-1 bg-gradient-to-r from-slate-200 to-transparent dark:from-slate-700/70" />
                <span className="font-mono text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
                  {g.items.length} 班 · {g.hint}
                </span>
              </div>
              <div className="space-y-4">{g.items.map(renderCard)}</div>
            </div>
          ))
        ) : (
          // 已過去：維持一條 flat list。
          <div className="space-y-4">{list.map(renderCard)}</div>
        )}
      </section>

      {/* 新增 Modal（登機 check-in 牌）— 內容自帶離境牌語彙：深色頭聯 + 翻牌預覽存根 */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} size="md">
        {(() => {
          // 純表現用：由表單日期即時推算倒數，餵返同卡片一致嘅翻牌預覽。
          // 唔加 state / handler，只係讀現有 state + 共用 helper（toneOf / URGENCY / FlapDisplay）。
          const draftDays = fDate ? daysUntil(fDate, todayKey) : null
          const draftTone = draftDays === null ? 'slate' : toneOf(draftDays)
          const draftU = URGENCY[draftTone]
          const draftGate = (fCategory ? fCategory.slice(0, 2) : 'NT').toUpperCase()
          return (
            <form onSubmit={handleAdd}>
              {/* 頭聯：深色離境牌標頭（呼應 hero 顯示板）+ 自設關閉掣 */}
              <div className="relative -m-5 mb-5 overflow-hidden rounded-t-2xl bg-slate-900 text-white ring-1 ring-white/5 dark:bg-slate-950 sm:-m-6 sm:mb-6 sm:rounded-t-2xl">
                <div className="relative z-10 hero-gradient flex items-center justify-between gap-3 px-5 py-2 sm:px-6">
                  <span className="inline-flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.3em] text-white">
                    <Ticket size={13} /> Boarding Pass
                  </span>
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    aria-label="關閉"
                    className="rounded-lg p-1 text-white/70 transition hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_3px,rgba(255,255,255,0.02)_3px,rgba(255,255,255,0.02)_4px)]"
                />
                <div className="relative flex items-end justify-between gap-4 px-5 py-4 sm:px-6">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.3em] text-slate-400">
                      <PlaneTakeoff size={13} className="shrink-0" /> Check-in · 登記航班
                    </p>
                    <h3
                      id="countdown-modal-title"
                      className="mt-1 font-serif text-2xl font-semibold leading-none tracking-tight text-white"
                    >
                      登記新航班
                    </h3>
                  </div>
                  {/* 翻牌預覽存根：跟日期即時更新（似填飛時嗰張小副聯） */}
                  <div className="shrink-0 text-right">
                    <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-slate-400">
                      {draftDays === null
                        ? 'No date'
                        : draftDays === 0
                          ? 'Departs today'
                          : draftDays > 0
                            ? `T-${draftDays}`
                            : `+${-draftDays}d`}
                    </p>
                    <div className="mt-1.5 flex items-end justify-end gap-1.5">
                      {draftDays === null ? (
                        <FlapDisplay value="—" size="sm" ariaLabel="未揀日期" />
                      ) : draftDays === 0 ? (
                        <div className="flex items-baseline gap-1">
                          <FlapDisplay value="今" size="sm" ariaLabel="今日出發" />
                          <FlapDisplay value="日" size="sm" />
                        </div>
                      ) : (
                        <FlapDisplay
                          value={Math.abs(draftDays)}
                          size="sm"
                          ariaLabel={`${Math.abs(draftDays)} 日${draftDays > 0 ? '後' : '前'}`}
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* 主聯：表單欄位，分區排版（航班 → 班次 → 閘口 → 備註） */}
              <div className="space-y-5">
                <Field label="航班名稱（想倒數啲咩？）">
                  <Input
                    type="text"
                    icon={PenLine}
                    value={fTitle}
                    onChange={(e) => setFTitle(e.target.value)}
                    placeholder="例如：期末考試、交報告、去旅行"
                    autoFocus
                  />
                </Field>

                {/* 班次：日期 + 時間（一組「departure」資料） */}
                <div className="space-y-3">
                  <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.25em] text-slate-400 dark:text-slate-500">
                    <CalendarDays size={12} /> Departure · 起飛班次
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="離境日期">
                      <Input
                        type="date"
                        icon={CalendarDays}
                        value={fDate}
                        onChange={(e) => setFDate(e.target.value)}
                      />
                    </Field>
                    <Field label="時間（選填）">
                      <Input
                        type="time"
                        icon={Clock}
                        value={fTime}
                        onChange={(e) => setFTime(e.target.value)}
                      />
                    </Field>
                  </div>
                </div>

                {/* 閘口：分類選擇（選中嗰個喺存根顯示閘口代碼） */}
                <div className="space-y-2.5">
                  <p className="flex items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-slate-400 dark:text-slate-500">
                    <span className="inline-flex items-center gap-1.5">
                      <Tag size={12} /> Gate · 閘口分類（選填）
                    </span>
                    <span className="tabular-nums text-slate-400 dark:text-slate-500">
                      {draftGate}
                    </span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORY_OPTIONS.map((c) => {
                      const m = CATEGORY_META[c]
                      const Icon = m.icon
                      const on = fCategory === c
                      return (
                        <button
                          key={c}
                          type="button"
                          aria-pressed={on}
                          onClick={() => setFCategory(on ? '' : c)}
                          className={cx(
                            'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
                            on
                              ? 'border-accent bg-accent text-white shadow-sm'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
                          )}
                        >
                          <Icon size={14} />
                          {m.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <Field label="備註（選填）">
                  <Textarea
                    value={fNotes}
                    onChange={(e) => setFNotes(e.target.value)}
                    rows={2}
                    placeholder="想記低嘅細節，例如地點、範圍⋯⋯"
                  />
                </Field>
              </div>

              {/* 撕口：一條虛線打孔縫分隔主聯同操作（呼應卡片撕口） */}
              <div className="relative mt-6">
                <span
                  aria-hidden="true"
                  className="absolute left-0 top-1/2 h-3 w-3 -translate-x-[7px] -translate-y-1/2 rounded-full bg-slate-100 dark:bg-slate-900"
                />
                <span
                  aria-hidden="true"
                  className="absolute right-0 top-1/2 h-3 w-3 translate-x-[7px] -translate-y-1/2 rounded-full bg-slate-100 dark:bg-slate-900"
                />
                <span
                  aria-hidden="true"
                  className="block h-px w-full border-t border-dashed border-slate-300/80 dark:border-slate-600/70"
                />
              </div>

              {/* 操作列：登記提示語（跟存根狀態色）+ 主／次按鈕 */}
              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  <span className={cx('h-1.5 w-1.5 rounded-full', draftU.dot)} />
                  {draftDays === null
                    ? '揀返日期'
                    : draftDays === 0
                      ? 'Now boarding'
                      : draftU.status}
                </span>
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
                    取消
                  </Button>
                  <Button type="submit" icon={Plus} disabled={!fTitle.trim()}>
                    登記航班
                  </Button>
                </div>
              </div>
            </form>
          )
        })()}
      </Modal>

      {/* 訂閱到手機日曆（webcal feed） */}
      {subscribeOpen && (
        <CalendarSubscribe onClose={() => setSubscribeOpen(false)} />
      )}
    </div>
  )
}
