import { useMemo, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  AlarmClock,
  BarChart3,
  CalendarHeart,
  CheckSquare,
  ClipboardList,
  Hourglass,
  NotebookPen,
  PartyPopper,
  Pin,
  Plus,
  Sparkles,
  Trash2,
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
  Badge,
  Button,
  EmptyState,
  Field,
  IconButton,
  Input,
  Modal,
  StatCard,
  Tabs,
  Textarea,
  cx,
} from '../../ui'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'] as const

type Tone = 'rose' | 'amber' | 'green' | 'slate'

/** 緊急度 → Badge tone（今日 / <=3 日 rose、<=14 日 amber、其餘 green、已過去 slate）。 */
export function toneOf(days: number): Tone {
  if (days < 0) return 'slate'
  if (days <= 3) return 'rose'
  if (days <= 14) return 'amber'
  return 'green'
}

/** 緊急度配色：大數字色 + 卡片頂部柔光 + 進度條，全部帶 dark: 變體。 */
const URGENCY: Record<Tone, { num: string; glow: string; bar: string; ring: string }> = {
  rose: {
    num: 'text-rose-600 dark:text-rose-400',
    glow: 'from-rose-100/80 dark:from-rose-500/15',
    bar: 'bg-rose-500',
    ring: 'group-hover:border-rose-300/70 dark:group-hover:border-rose-500/40',
  },
  amber: {
    num: 'text-amber-600 dark:text-amber-400',
    glow: 'from-amber-100/80 dark:from-amber-500/15',
    bar: 'bg-amber-500',
    ring: 'group-hover:border-amber-300/70 dark:group-hover:border-amber-500/40',
  },
  green: {
    num: 'text-emerald-600 dark:text-emerald-400',
    glow: 'from-emerald-100/70 dark:from-emerald-500/12',
    bar: 'bg-emerald-500',
    ring: 'group-hover:border-emerald-300/70 dark:group-hover:border-emerald-500/40',
  },
  slate: {
    num: 'text-slate-400 dark:text-slate-500',
    glow: 'from-slate-100/70 dark:from-slate-700/30',
    bar: 'bg-slate-300 dark:bg-slate-600',
    ring: 'group-hover:border-slate-300 dark:group-hover:border-slate-600',
  },
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
  if (days === 0) return '就喺今日，加油！'
  if (days === 1) return '聽日就到喇'
  if (days <= 3) return '快到喇，做最後衝刺'
  if (days <= 7) return '一星期內，記得預備'
  if (days <= 14) return '兩星期內，開始計劃'
  if (days <= 30) return '一個月內，慢慢嚟'
  return '時間充裕，放鬆啲'
}

type TabId = 'upcoming' | 'past'

/** 頂部分類篩選用嘅 pill（樣式對齊 Modal 入面嘅分類掣）。 */
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
          'tabular-nums',
          active ? 'text-white/80' : 'text-slate-400 dark:text-slate-500',
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

  // 單張倒數卡（同 upcoming 分段同 past flat list 共用，確保外觀一致）。
  function renderCard(c: CountdownItem) {
    const days = daysUntil(c.date, todayKey)
    const tone = toneOf(days)
    const u = URGENCY[tone]
    const meta = c.category ? CATEGORY_META[c.category] : null
    const CatIcon = meta ? meta.icon : Hourglass
    const isToday = days === 0
    const isPast = days < 0
    const badgeLabel = days > 0 ? `仲有 ${days} 日` : isToday ? '今日' : `已過 ${-days} 日`
    // 30 日內畫一條「逼近」進度條（越近越滿）；其餘 / 已過去唔畫。
    const progress = !isPast && days <= 30 ? Math.round((1 - days / 30) * 100) : null

    return (
      <article
        key={c.id}
        className={cx(
          'group relative flex flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xs transition duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-700/60 dark:bg-slate-800 dark:shadow-none',
          u.ring,
        )}
      >
        {/* 頂部柔光（按緊急度） */}
        <div
          className={cx(
            'pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b to-transparent',
            u.glow,
          )}
        />

        <div className="relative flex flex-1 flex-col p-5">
          {/* 第一行：分類圖示 chip + 標題 + 刪除 */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span
                className={cx(
                  'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition duration-200 group-hover:scale-105',
                  meta ? meta.chip : 'bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent',
                )}
              >
                <CatIcon size={21} strokeWidth={2} />
              </span>
              <div className="min-w-0">
                <h3 className="truncate text-base font-semibold text-slate-800 dark:text-slate-100">
                  {c.title}
                </h3>
                <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
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

          {/* 大數字區 */}
          <div className="mt-4 flex flex-1 items-end">
            {isToday ? (
              <p className={cx('text-3xl font-bold tracking-tight sm:text-4xl', u.num)}>
                就係今日
              </p>
            ) : (
              <p className="flex items-baseline gap-2">
                <span
                  className={cx(
                    'text-5xl font-bold leading-none tabular-nums slashed-zero sm:text-6xl',
                    u.num,
                  )}
                >
                  {Math.abs(days)}
                </span>
                <span className="text-sm font-medium text-slate-400 dark:text-slate-500">
                  {days > 0 ? '日後' : '日前'}
                </span>
              </p>
            )}
          </div>

          {/* 逼近進度條（30 日內） */}
          {progress !== null && (
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700/60">
              <div
                className={cx('h-full rounded-full transition-all duration-700', u.bar)}
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          {/* 底部 meta */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge tone={tone}>{badgeLabel}</Badge>
            {meta && <Badge tone="slate">{meta.label}</Badge>}
          </div>

          {c.notes && (
            <p className="mt-2.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              {c.notes}
            </p>
          )}
        </div>
      </article>
    )
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-6">
      {/* Hero — 漸變主視覺，跟模式主色 */}
      <header className="hero-gradient relative overflow-hidden rounded-3xl px-6 py-7 text-white shadow-lg shadow-accent/25 sm:px-8 sm:py-8">
        <div className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-14 right-24 h-36 w-36 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur">
              <CalendarHeart size={14} /> 重要日子倒數
            </span>
            <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
              {nearestDays === null
                ? '未有倒數，定個目標先'
                : nearestDays === 0
                  ? '今日就係大日子'
                  : `最近一項仲有 ${nearestDays} 日`}
            </h1>
            <p className="mt-1.5 text-sm text-white/80">
              {upcoming.length > 0
                ? `${upcoming.length} 件事即將到嚟 · 一眼睇清仲有幾多日。`
                : '考試、死線、評估同活動，一眼睇清仲有幾多日。'}
            </p>
          </div>
          <Button
            variant="secondary"
            icon={Plus}
            onClick={openAddModal}
            className="shrink-0 border-white/30 bg-white/15 text-white backdrop-blur hover:bg-white/25 dark:border-white/30 dark:bg-white/15 dark:text-white dark:hover:bg-white/25"
          >
            新增倒數
          </Button>
        </div>
      </header>

      {/* 頂部統計 */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="即將到嚟" value={upcoming.length} unit="個" icon={ClipboardList} />
        <StatCard
          label="最近一項"
          value={nearestDays === null ? '—' : nearestDays}
          unit={nearestDays === null ? undefined : '日'}
          icon={Hourglass}
          highlight={nearestDays !== null && nearestDays <= 3}
          hint={nearestDays !== null ? urgencyHint(nearestDays) : undefined}
        />
        <StatCard label="已過去" value={past.length} unit="個" icon={CheckSquare} />
      </section>

      {/* 分頁 */}
      <Tabs<TabId>
        tabs={[
          { id: 'upcoming', label: '即將到嚟' },
          { id: 'past', label: '已過去' },
        ]}
        active={tab}
        onChange={setTab}
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
                title="呢個分類暫時冇倒數"
                hint="揀返「全部」，或者撳上面其他分類睇下。"
                action={
                  <Button variant="ghost" onClick={() => setCatFilter('all')}>
                    睇全部
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={CalendarHeart}
                art="empty-countdown"
                title="未有倒數，由一個大日子開始"
                hint="考試、交功課、生日、旅行⋯⋯掉個日子入嚟，之後就一眼睇到仲爭幾耐。"
                action={
                  <Button icon={Plus} onClick={openAddModal}>
                    新增第一個倒數
                  </Button>
                }
              />
            )
          ) : (
            <EmptyState
              icon={Sparkles}
              title="暫時未有過去嘅日子"
              hint="日子過咗之後會搬嚟呢度，等你回望走過嘅里程碑。"
            />
          )
        ) : tab === 'upcoming' ? (
          // 即將到嚟：按 本週內 / 本月內 / 更遠 分段，每段一個小標題。
          groups.map((g) => (
            <div key={g.bucket} className="space-y-3">
              <div className="flex items-baseline gap-2 px-0.5">
                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {g.label}
                </h2>
                <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                  {g.items.length} 個 · {g.hint}
                </span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">{g.items.map(renderCard)}</div>
            </div>
          ))
        ) : (
          // 已過去：維持一條 flat list。
          <div className="grid gap-4 sm:grid-cols-2">{list.map(renderCard)}</div>
        )}
      </section>

      {/* 新增 Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="新增倒數">
        <form onSubmit={handleAdd} className="space-y-4">
          <Field label="想倒數啲咩？">
            <Input
              type="text"
              value={fTitle}
              onChange={(e) => setFTitle(e.target.value)}
              placeholder="例如：BAFS 卷一、交 IES、去日本"
              autoFocus
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="日期">
              <Input type="date" value={fDate} onChange={(e) => setFDate(e.target.value)} />
            </Field>
            <Field label="時間（選填）">
              <Input type="time" value={fTime} onChange={(e) => setFTime(e.target.value)} />
            </Field>
          </div>
          <Field label="分類（選填）">
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
          </Field>
          <Field label="備註（選填）">
            <Textarea
              value={fNotes}
              onChange={(e) => setFNotes(e.target.value)}
              rows={2}
              placeholder="想記低嘅細節，例如地點、範圍⋯⋯"
            />
          </Field>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
              取消
            </Button>
            <Button type="submit" icon={Plus} disabled={!fTitle.trim()}>
              加入倒數
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
