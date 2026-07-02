import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { LucideIcon } from 'lucide-react'
import {
  AlarmClock,
  BarChart3,
  CalendarClock,
  CalendarDays,
  CalendarHeart,
  CheckCircle2,
  Clock,
  Hourglass,
  NotebookPen,
  PartyPopper,
  PenLine,
  Pin,
  Plus,
  Smartphone,
  Tag,
  Trash2,
  Undo2,
} from 'lucide-react'
import { useCollection } from '../../lib/store'
import { countdownsCol, eventsCol } from '../../data/collections'
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
  FeatureGuide,
  Field,
  IconButton,
  Input,
  Modal,
  PageHero,
  SectionTitle,
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

// ───────── 設計系統語意色（對齊 WorkDashboard 的 TONE map）─────────
// chip = icon 章底+字色、val = 大數字字色、dot = 狀態點、bar = 進度條填充。
type SemTone = 'accent' | 'amber' | 'emerald' | 'sky' | 'violet' | 'rose' | 'slate'
const SEM_TONE: Record<SemTone, { chip: string; val: string; dot: string; bar: string }> = {
  accent: {
    chip: 'bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent',
    val: 'text-accent',
    dot: 'bg-accent',
    bar: 'bg-accent',
  },
  amber: {
    chip: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300',
    val: 'text-amber-500',
    dot: 'bg-amber-500',
    bar: 'bg-amber-500',
  },
  emerald: {
    chip: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
    val: 'text-emerald-500',
    dot: 'bg-emerald-500',
    bar: 'bg-emerald-500',
  },
  sky: {
    chip: 'bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300',
    val: 'text-sky-500',
    dot: 'bg-sky-500',
    bar: 'bg-sky-500',
  },
  violet: {
    chip: 'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300',
    val: 'text-violet-500',
    dot: 'bg-violet-500',
    bar: 'bg-violet-500',
  },
  rose: {
    chip: 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300',
    val: 'text-rose-500',
    dot: 'bg-rose-500',
    bar: 'bg-rose-500',
  },
  slate: {
    chip: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300',
    val: 'text-slate-500 dark:text-slate-400',
    dot: 'bg-slate-400 dark:bg-slate-500',
    bar: 'bg-slate-300 dark:bg-slate-600',
  },
}

/** 緊急度 Tone → 設計系統語意色（rose=緊急 / amber=接近 / emerald=尚遠 / slate=已過）。 */
function semOf(tone: Tone): SemTone {
  if (tone === 'rose') return 'rose'
  if (tone === 'amber') return 'amber'
  if (tone === 'green') return 'emerald'
  return 'slate'
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

/** 親切嘅一句註腳，按緊急度變語氣。 */
function urgencyHint(days: number): string {
  if (days === 0) return '就係今日，加油！'
  if (days === 1) return '聽日就到喇'
  if (days <= 3) return '只剩幾日，做最後衝刺'
  if (days <= 7) return '一星期內，記得預備'
  if (days <= 14) return '兩星期內，可以開始準備'
  if (days <= 30) return '一個月內，慢慢計劃'
  return '時間充裕，放鬆啲'
}

type TabId = 'upcoming' | 'past'

/** 頂部分類篩選 pill（SegmentedControl 風格嘅輕量分類掣）。 */
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
        'inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
        active
          ? 'border-accent bg-accent text-white shadow-sm'
          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
      )}
    >
      {Icon && <Icon size={14} />}
      {label}
      <span
        className={cx(
          'rounded-md px-1 text-[11px] font-semibold tabular-nums',
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
  const { t } = useTranslation()
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

  // 即將到嚟（未到達 且 今日／未來）：升序，最近喺前。已標記到達嘅唔再算。
  const upcoming = useMemo(
    () =>
      visible
        .filter((c) => !c.arrivedAt && daysUntil(c.date, todayKey) >= 0)
        .slice()
        .sort((a, b) => a.date.localeCompare(b.date)),
    [visible, todayKey],
  )

  // 已過去 / 已完成（已標記到達，或已過 date）：降序，最近喺前。
  const past = useMemo(
    () =>
      visible
        .filter((c) => !!c.arrivedAt || daysUntil(c.date, todayKey) < 0)
        .slice()
        .sort((a, b) => b.date.localeCompare(a.date)),
    [visible, todayKey],
  )

  // 頂部統計：最近一項（最快到嚟嘅未過事件 N 日）。用全部 upcoming（唔受篩選影響）。
  const nearestDays = upcoming.length > 0 ? daysUntil(upcoming[0].date, todayKey) : null
  const nearest = upcoming.length > 0 ? upcoming[0] : null

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
    const created = countdownsCol.add(payload)
    // 同步去「行事曆」：建立一個全日活動，id = cd-<countdownId> 連住個倒數，
    // 之後刪倒數時一齊清走，避免行事曆殘留孤兒事件。
    eventsCol.add({
      id: `cd-${created.id}`,
      title: trimmed,
      date: fDate,
      allDay: !fTime,
      time: fTime || undefined,
      mode: 'both',
      calendarId:
        mode === 'work' ? 'cal-work' : mode === 'learning' ? 'cal-study' : 'cal-personal',
      type: 'countdown',
      notes: trimmedNotes || undefined,
    })
    setModalOpen(false)
    toast.success(t('countdown.toast.added', { defaultValue: '已新增倒數，並同步到行事曆' }))
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
    eventsCol.remove(`cd-${c.id}`) // 同步清走行事曆嗰個連結事件
    toast.success('已刪除倒數')
  }

  // 標記「完成」。早於 date 當日 = 提前完成。
  function markArrived(c: CountdownItem) {
    countdownsCol.update(c.id, { arrivedAt: new Date().toISOString() })
    const early = todayKey < c.date
    toast.success(
      early
        ? t('countdown.toast.early', { defaultValue: '已記錄：提前完成' })
        : t('countdown.toast.arrived', { defaultValue: '已記錄：完成' }),
    )
  }

  // 取消完成（撳錯／要重開倒數）。
  function undoArrived(c: CountdownItem) {
    countdownsCol.update(c.id, { arrivedAt: undefined })
  }

  // 單張倒數卡：純展示卡（rounded-2xl）。左邊分類 icon 章 + 標題 + 日期；
  // 中間大數字（剩餘日數，tone 著色）；底部進度條（30 日內）+ 狀態 + 操作。
  function renderCard(c: CountdownItem) {
    const days = daysUntil(c.date, todayKey)
    // 完成狀態：arrived = 已標記；arrivedEarly = 完成日早過 deadline；
    // overdue = 未完成且已過 deadline。
    const arrived = !!c.arrivedAt
    const arrivedEarly = arrived && (c.arrivedAt as string).slice(0, 10) < c.date
    const overdue = !arrived && days < 0
    const tone: Tone = arrived ? (arrivedEarly ? 'green' : 'slate') : overdue ? 'rose' : toneOf(days)
    const sem = SEM_TONE[semOf(tone)]
    const meta = c.category ? CATEGORY_META[c.category] : null
    const CatIcon = meta ? meta.icon : CalendarClock
    const isToday = !arrived && days === 0
    const isPast = days < 0
    // 30 日內畫一條「逼近」進度條（越近越滿）；已完成 / 已過去唔畫。
    const progress = !isPast && !arrived && days <= 30 ? Math.round((1 - days / 30) * 100) : null

    const statusText = arrived
      ? arrivedEarly
        ? t('countdown.status.early', { defaultValue: '提前完成' })
        : t('countdown.status.arrived', { defaultValue: '已完成' })
      : overdue
        ? t('countdown.status.overdue', { defaultValue: `逾期 ${Math.abs(days)} 日` })
        : isToday
          ? t('countdown.status.today', { defaultValue: '就在今日' })
          : t('countdown.status.left', { defaultValue: `尚餘 ${days} 日` })

    return (
      <article
        className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-700/60 dark:bg-slate-800"
      >
        {/* 頂列：分類 icon 章 + 標題 + 日期 + 刪除 */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className={cx(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                meta ? meta.chip : 'bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent',
              )}
            >
              <CatIcon size={18} />
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-slate-700 dark:text-slate-200">
                {c.title}
              </h3>
              <p className="mt-0.5 truncate text-xs text-slate-400 dark:text-slate-500">
                {meta ? `${meta.label} · ` : ''}
                {formatDate(c.date, c.time)}
              </p>
            </div>
          </div>
          <IconButton
            label={`刪除「${c.title}」`}
            tone="danger"
            onClick={() => handleRemove(c)}
            className="shrink-0"
          >
            <Trash2 size={16} />
          </IconButton>
        </div>

        {/* 大數字 / 狀態 */}
        <div className="mt-3">
          {arrived || overdue ? (
            <p className="flex items-center gap-1.5">
              <span className={cx('flex h-2 w-2 shrink-0 rounded-full', sem.dot)} />
              <span className={cx('text-lg font-semibold', sem.val)}>{statusText}</span>
            </p>
          ) : isToday ? (
            <p className="flex items-baseline gap-1.5">
              <span className={cx('text-3xl font-semibold tabular-nums slashed-zero', sem.val)}>
                {t('countdown.todayBig', { defaultValue: '今日' })}
              </span>
            </p>
          ) : (
            <p className="flex items-baseline gap-1.5">
              <span className={cx('text-3xl font-semibold tabular-nums slashed-zero', sem.val)}>
                {days}
              </span>
              <span className="text-sm font-medium text-slate-400 dark:text-slate-500">
                {t('countdown.daysLeft', { defaultValue: '日後' })}
              </span>
            </p>
          )}
        </div>

        {/* 逼近進度條（30 日內、未完成、未過去先畫） */}
        {progress !== null && (
          <div
            className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700/60"
            role="img"
            aria-label={`距離 ${days} 日`}
          >
            <div
              className={cx('h-full rounded-full transition-all duration-500 ease-out', sem.bar)}
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {c.notes && (
          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            {c.notes}
          </p>
        )}

        {/* 操作：未完成 → 標記完成；已完成 → 取消 */}
        <div className="mt-3 flex items-center justify-end border-t border-slate-200 pt-3 dark:border-slate-700">
          {!arrived ? (
            <button
              type="button"
              onClick={() => markArrived(c)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-emerald-600 transition hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 active:scale-[0.98] dark:text-emerald-300 dark:hover:bg-emerald-500/15"
            >
              <CheckCircle2 size={14} />
              {overdue
                ? t('countdown.action.markLate', { defaultValue: '補記完成' })
                : t('countdown.action.markArrived', { defaultValue: '標記完成' })}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => undoArrived(c)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-slate-400 transition hover:bg-slate-50 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.98] dark:text-slate-500 dark:hover:bg-slate-800/60 dark:hover:text-slate-200"
            >
              <Undo2 size={14} />
              {t('countdown.action.undo', { defaultValue: '取消完成' })}
            </button>
          )}
        </div>
      </article>
    )
  }

  // hero 副題：跟最近一項倒數動態變（無 → 引導句；今日 → 就係今日；其餘 → 仲有 N 日）。
  const heroDescription =
    nearestDays === null
      ? t('countdown.subtitleEmpty', { defaultValue: '記低考試、死線、評估同活動，一眼睇到仲爭幾耐。' })
      : nearestDays === 0
        ? t('countdown.subtitleToday', {
            title: nearest?.title ?? '',
            defaultValue: `「${nearest?.title ?? ''}」就係今日 · ${urgencyHint(0)}`,
          })
        : t('countdown.subtitleNext', {
            n: nearestDays,
            title: nearest?.title ?? '',
            defaultValue: `下一個「${nearest?.title ?? ''}」仲有 ${nearestDays} 日 · ${urgencyHint(nearestDays)}`,
          })

  return (
    <div className="w-full space-y-6 p-4 sm:p-6">
      {/* ───────── 頁頂 accent hero（共用 PageHero）───────── */}
      <PageHero
        guideKey="countdown"
        icon={CalendarClock}
        kicker={t('countdown.kicker', { defaultValue: '重要日子' })}
        title={t('countdown.title', { defaultValue: '重要日子倒數' })}
        description={heroDescription}
        actions={
          <>
            <button
              type="button"
              onClick={() => setSubscribeOpen(true)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-white/15 px-3 text-sm font-medium backdrop-blur-sm transition hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              <Smartphone size={15} /> {t('cal.subscribeMobile', { defaultValue: '訂閱到手機' })}
            </button>
            <button
              type="button"
              onClick={openAddModal}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-white/15 px-3 text-sm font-medium backdrop-blur-sm transition hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              <Plus size={15} /> {t('countdown.add', { defaultValue: '新增倒數' })}
            </button>
          </>
        }
      />

      {/* ───────── 教學引導：教用家點用倒數（可摺疊 + 可永久收起）───────── */}
      <FeatureGuide
        storageKey="countdown"
        title={t('countdown.guideTitle', { defaultValue: '重要日子倒數點用？' })}
        steps={[
          {
            title: t('countdown.guideStep1Title', { defaultValue: '新增重要日子' }),
            desc: t('countdown.guideStep1Desc', { defaultValue: '撳「新增倒數」，填返名同日期；可選分類（考試／死線／活動）同時間。' }),
          },
          {
            title: t('countdown.guideStep2Title', { defaultValue: '一眼睇剩幾多日' }),
            desc: t('countdown.guideStep2Desc', { defaultValue: '每張卡顯示尚餘日數，越接近顏色越緊張；上面數字話你知最近一個幾時到。' }),
          },
          {
            title: t('countdown.guideStep3Title', { defaultValue: '完成就標記低' }),
            desc: t('countdown.guideStep3Desc', { defaultValue: '搞掂咗撳「標記完成」，佢會搬去「已完成」一頁；撳錯可隨時取消。' }),
          },
          {
            title: t('countdown.guideStep4Title', { defaultValue: '同步入手機日曆' }),
            desc: t('countdown.guideStep4Desc', { defaultValue: '新增嘅倒數會自動入行事曆；撳「訂閱到手機」可一拉同步入電話。' }),
          },
        ]}
      />

      {/* ───────── KPI：三項統計（即將到嚟 / 最近一項 / 已完成）───────── */}
      <section aria-label={t('countdown.statsLabel', { defaultValue: '倒數統計' })}>
        <SectionTitle icon={Hourglass}>
          {t('countdown.statsTitle', { defaultValue: '概覽' })}
        </SectionTitle>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            {
              key: 'upcoming',
              label: t('countdown.statUpcoming', { defaultValue: '即將到嚟' }),
              value: upcoming.length,
              unit: t('countdown.unitItems', { defaultValue: '項' }),
              hint: t('countdown.statUpcomingHint', { defaultValue: '尚未到嘅日子' }),
              icon: CalendarDays,
              tone: 'accent' as SemTone,
            },
            {
              key: 'nearest',
              label: t('countdown.statNearest', { defaultValue: '最近一項' }),
              value: nearestDays === null ? '—' : nearestDays === 0 ? t('countdown.todayBig', { defaultValue: '今日' }) : nearestDays,
              unit: nearestDays && nearestDays > 0 ? t('countdown.daysLeft', { defaultValue: '日後' }) : undefined,
              hint: nearest?.title ?? t('countdown.statNearestEmpty', { defaultValue: '未有倒數' }),
              icon: Hourglass,
              tone: 'amber' as SemTone,
            },
            {
              key: 'done',
              label: t('countdown.statDone', { defaultValue: '已完成' }),
              value: past.length,
              unit: t('countdown.unitItems', { defaultValue: '項' }),
              hint: t('countdown.statDoneHint', { defaultValue: '過去 / 已搞掂' }),
              icon: CheckCircle2,
              tone: 'emerald' as SemTone,
            },
          ].map((s) => {
            const sem = SEM_TONE[s.tone]
            const Icon = s.icon
            return (
              <div
                key={s.key}
                className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-700/60 dark:bg-slate-800"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                    {s.label}
                  </span>
                  <span className={cx('flex h-8 w-8 items-center justify-center rounded-xl', sem.chip)}>
                    <Icon size={16} />
                  </span>
                </div>
                <div className="mt-3">
                  <p className="flex items-baseline gap-1">
                    <span className={cx('text-3xl font-semibold tabular-nums slashed-zero', sem.val)}>
                      {s.value}
                    </span>
                    {s.unit && (
                      <span className="text-sm font-medium text-slate-400">{s.unit}</span>
                    )}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-slate-400">{s.hint}</p>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* 分頁（即將到嚟 / 已完成） */}
      <Tabs<TabId>
        tabs={[
          { id: 'upcoming', label: t('countdown.tabUpcoming', { defaultValue: '即將到嚟' }) },
          { id: 'past', label: t('countdown.tabPast', { defaultValue: '已完成' }) },
        ]}
        active={tab}
        onChange={setTab}
        icons={{ upcoming: CalendarDays, past: CheckCircle2 }}
      />

      {/* 分類篩選 pill（只喺「即將到嚟」一頁；有兩個或以上分類先值得顯示） */}
      {tab === 'upcoming' && upcoming.length > 0 && (
        <div className="-mt-1 flex flex-wrap gap-2">
          <FilterPill
            label={t('countdown.filterAll', { defaultValue: '全部' })}
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
                title={t('countdown.emptyFilterTitle', { defaultValue: '呢個分類暫時冇倒數' })}
                hint={t('countdown.emptyFilterHint', { defaultValue: '揀返「全部」，或者撳上面其他分類睇下。' })}
                action={
                  <Button size="sm" variant="secondary" onClick={() => setCatFilter('all')}>
                    {t('countdown.seeAll', { defaultValue: '睇全部' })}
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={CalendarClock}
                art="empty-countdown"
                title={t('countdown.emptyTitle', { defaultValue: '仲未有倒數，加返第一個' })}
                hint={t('countdown.emptyHint', { defaultValue: '考試、交功課、生日、旅行⋯⋯記低個日子，之後就一眼睇到仲爭幾耐。' })}
                action={
                  <Button size="sm" icon={Plus} onClick={openAddModal}>
                    {t('countdown.emptyCta', { defaultValue: '新增第一個倒數' })}
                  </Button>
                }
              />
            )
          ) : (
            <EmptyState
              icon={CheckCircle2}
              title={t('countdown.emptyPastTitle', { defaultValue: '暫時未有已完成嘅倒數' })}
              hint={t('countdown.emptyPastHint', { defaultValue: '日子過咗或者標記完成之後，會搬嚟呢度等你回望。' })}
            />
          )
        ) : tab === 'upcoming' ? (
          // 即將到嚟：按 本週內 / 本月內 / 更遠 分段。
          groups.map((g) => (
            <div key={g.bucket} className="space-y-3">
              <SectionTitle
                right={
                  <span className="text-xs font-medium tabular-nums text-slate-400 dark:text-slate-500">
                    {t('countdown.groupCount', { n: g.items.length, defaultValue: `${g.items.length} 項` })}
                  </span>
                }
              >
                {g.label}
              </SectionTitle>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {g.items.map((c) => (
                  <div key={c.id}>{renderCard(c)}</div>
                ))}
              </div>
            </div>
          ))
        ) : (
          // 已過去：維持一條 grid。
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((c) => (
              <div key={c.id}>{renderCard(c)}</div>
            ))}
          </div>
        )}
      </section>

      {/* 新增 Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} size="md">
        {(() => {
          // 純表現用：由表單日期即時推算倒數，餵返同卡片一致嘅預覽。
          const draftDays = fDate ? daysUntil(fDate, todayKey) : null
          const draftSem = SEM_TONE[draftDays === null ? 'slate' : semOf(toneOf(draftDays))]
          return (
            <form onSubmit={handleAdd}>
              <h3
                id="countdown-modal-title"
                className="text-[17px] font-semibold tracking-tight text-slate-800 dark:text-slate-100"
              >
                {t('countdown.modalTitle', { defaultValue: '新增倒數' })}
              </h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {t('countdown.modalDesc', { defaultValue: '填返想倒數嘅日子，之後會自動同步入行事曆。' })}
              </p>

              <div className="mt-5 space-y-5">
                <Field label={t('countdown.fieldTitle', { defaultValue: '名稱（想倒數啲咩？）' })}>
                  <Input
                    type="text"
                    icon={PenLine}
                    value={fTitle}
                    onChange={(e) => setFTitle(e.target.value)}
                    placeholder={t('countdown.fieldTitlePh', { defaultValue: '例如：期末考試、交報告、去旅行' })}
                    autoFocus
                  />
                </Field>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label={t('countdown.fieldDate', { defaultValue: '日期' })}>
                    <Input
                      type="date"
                      icon={CalendarDays}
                      value={fDate}
                      onChange={(e) => setFDate(e.target.value)}
                    />
                  </Field>
                  <Field label={t('countdown.fieldTime', { defaultValue: '時間（選填）' })}>
                    <Input
                      type="time"
                      icon={Clock}
                      value={fTime}
                      onChange={(e) => setFTime(e.target.value)}
                    />
                  </Field>
                </div>

                {/* 分類選擇 */}
                <div className="space-y-2.5">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-slate-400 dark:text-slate-500">
                    <Tag size={13} /> {t('countdown.fieldCategory', { defaultValue: '分類（選填）' })}
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
                            'inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
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

                <Field label={t('countdown.fieldNotes', { defaultValue: '備註（選填）' })}>
                  <Textarea
                    value={fNotes}
                    onChange={(e) => setFNotes(e.target.value)}
                    rows={2}
                    placeholder={t('countdown.fieldNotesPh', { defaultValue: '想記低嘅細節，例如地點、範圍⋯⋯' })}
                  />
                </Field>
              </div>

              {/* 操作列：剩餘日數預覽 + 主／次按鈕 */}
              <div className="mt-6 flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 dark:text-slate-500">
                  <span className={cx('h-1.5 w-1.5 rounded-full', draftSem.dot)} />
                  {draftDays === null
                    ? t('countdown.previewNoDate', { defaultValue: '揀返日期' })
                    : draftDays === 0
                      ? t('countdown.previewToday', { defaultValue: '就在今日' })
                      : draftDays > 0
                        ? t('countdown.previewLeft', { n: draftDays, defaultValue: `尚餘 ${draftDays} 日` })
                        : t('countdown.previewPast', { n: -draftDays, defaultValue: `已過 ${-draftDays} 日` })}
                </span>
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
                    {t('countdown.cancel', { defaultValue: '取消' })}
                  </Button>
                  <Button type="submit" icon={Plus} disabled={!fTitle.trim()}>
                    {t('countdown.addConfirm', { defaultValue: '新增' })}
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
