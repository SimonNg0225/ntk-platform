import { useEffect, useMemo, useState } from 'react'
import { useCollection } from '../../lib/store'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import {
  PageHeader,
  Button,
  Card,
  Tabs,
  Input,
  Select,
  EmptyState,
  SegmentedControl,
  IconButton,
  cx,
} from '../../ui'
import {
  Target,
  Plus,
  Search,
  Flame,
  Sparkles,
  Sprout,
  Archive,
  ArchiveRestore,
  Trash2,
  PartyPopper,
  ListChecks,
  BarChart3,
  CalendarDays,
} from 'lucide-react'
import {
  habitV2Col,
  habitLogV2Col,
  migrateLegacyHabits,
  colorOf,
  freqLabel,
  type Habit,
} from './habits/types'
import {
  logsByHabit,
  overallStats,
  currentStreak,
  todayKey,
} from './habits/util'
import HabitRow from './habits/HabitRow'
import HabitEditor from './habits/HabitEditor'
import HabitDetail from './habits/HabitDetail'
import StatsView from './habits/StatsView'

// ============================================================
//  習慣追蹤（Streaks / Habitify 級）
//  ------------------------------------------------------------
//  視圖：今日打卡 · 全部習慣 · 統計分析
//  深度：頻率目標、連續/最長 streak、年度 heatmap、完成趨勢圖、
//        星期分佈、每週統計、分類篩選、搜尋、排序、封存、目標里程碑。
// ============================================================

type View = 'today' | 'all' | 'stats'
type SortKey = 'order' | 'streak' | 'name'

export default function HabitTracker() {
  const toast = useToast()
  const confirm = useConfirm()

  // 首次：由舊 collection 遷移
  useEffect(() => {
    migrateLegacyHabits()
  }, [])

  const habits = useCollection<Habit>(habitV2Col)
  const logs = useCollection(habitLogV2Col)

  const [view, setView] = useState<View>('today')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string>('all')
  const [sort, setSort] = useState<SortKey>('order')
  const [showArchived, setShowArchived] = useState(false)

  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<Habit | undefined>(undefined)
  const [detailId, setDetailId] = useState<string | null>(null)

  const today = todayKey()

  // logs → habitId → Set<dateKey>
  const byHabit = useMemo(() => logsByHabit(logs), [logs])

  // 啟用中（未封存）
  const activeHabits = useMemo(() => habits.filter((h) => !h.archived), [habits])
  const archivedHabits = useMemo(() => habits.filter((h) => h.archived), [habits])

  // 分類選項
  const categories = useMemo(() => {
    const set = new Set<string>()
    for (const h of activeHabits) if (h.category) set.add(h.category)
    return Array.from(set).sort()
  }, [activeHabits])

  // 篩選 + 搜尋 + 排序
  const visible = useMemo(() => {
    let list = activeHabits
    if (category !== 'all') list = list.filter((h) => h.category === category)
    const q = query.trim().toLowerCase()
    if (q)
      list = list.filter(
        (h) =>
          h.name.toLowerCase().includes(q) ||
          (h.category ?? '').toLowerCase().includes(q),
      )
    const arr = [...list]
    arr.sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name)
      if (sort === 'streak') {
        const sa = currentStreak(byHabit.get(a.id) ?? new Set(), a.frequency)
        const sb = currentStreak(byHabit.get(b.id) ?? new Set(), b.frequency)
        return sb - sa
      }
      return a.order - b.order
    })
    return arr
  }, [activeHabits, category, query, sort, byHabit])

  // 今日待辦：依「應做」分拆
  const todayBuckets = useMemo(() => {
    const wd = new Date().getDay()
    const due: Habit[] = []
    const notDue: Habit[] = []
    for (const h of visible) {
      const sched =
        h.frequency.kind !== 'weekdays' || h.frequency.days.includes(wd)
      if (sched) due.push(h)
      else notDue.push(h)
    }
    // 今日已完成排後
    due.sort((a, b) => {
      const da = (byHabit.get(a.id) ?? new Set()).has(today) ? 1 : 0
      const db = (byHabit.get(b.id) ?? new Set()).has(today) ? 1 : 0
      return da - db
    })
    return { due, notDue }
  }, [visible, byHabit, today])

  const stats = useMemo(() => overallStats(visible, byHabit), [visible, byHabit])
  const allDone = stats.dueToday > 0 && stats.doneToday === stats.dueToday

  const detailHabit = detailId ? habits.find((h) => h.id === detailId) ?? null : null

  // ───────── 動作 ─────────
  function toggleLog(habitId: string, date: string) {
    const existing = logs.find((l) => l.habitId === habitId && l.date === date)
    if (existing) habitLogV2Col.remove(existing.id)
    else habitLogV2Col.add({ habitId, date })
  }

  function openCreate() {
    setEditing(undefined)
    setEditorOpen(true)
  }

  function openEdit(h: Habit) {
    setEditing(h)
    setEditorOpen(true)
    setDetailId(null)
  }

  function handleSave(
    data: Omit<Habit, 'id' | 'order' | 'createdAt' | 'archived'>,
  ) {
    if (editing) {
      habitV2Col.update(editing.id, data)
      toast.success('已更新習慣')
    } else {
      const maxOrder = habits.reduce((m, h) => Math.max(m, h.order), -1)
      habitV2Col.add({
        ...data,
        order: maxOrder + 1,
        archived: false,
        createdAt: new Date().toISOString(),
      })
      toast.success('已新增習慣')
    }
    setEditorOpen(false)
    setEditing(undefined)
  }

  async function handleDeleteFromEditor() {
    if (!editing) return
    const ok = await confirm({
      title: '刪除習慣？',
      message: `「${editing.name}」連同所有打卡記錄會一併刪除，無法復原。`,
      confirmText: '刪除',
      tone: 'danger',
    })
    if (!ok) return
    deleteHabit(editing.id)
    setEditorOpen(false)
    setEditing(undefined)
  }

  function deleteHabit(id: string) {
    for (const l of logs.filter((l) => l.habitId === id)) {
      habitLogV2Col.remove(l.id)
    }
    habitV2Col.remove(id)
    toast.success('已刪除習慣')
  }

  function toggleArchive(h: Habit) {
    habitV2Col.update(h.id, { archived: !h.archived })
    toast.info(h.archived ? '已還原習慣' : '已封存習慣')
  }

  async function confirmDeleteArchived(h: Habit) {
    const ok = await confirm({
      title: '永久刪除？',
      message: `「${h.name}」連同所有打卡記錄會被刪除。`,
      confirmText: '刪除',
      tone: 'danger',
    })
    if (ok) deleteHabit(h.id)
  }

  const tabs: { id: View; label: string }[] = [
    { id: 'today', label: '今日' },
    { id: 'all', label: '全部' },
    { id: 'stats', label: '統計' },
  ]

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 p-4">
      <PageHeader
        title="習慣追蹤"
        description="養成每日習慣，保持連續記錄，用數據睇住自己進步。"
        icon={Target}
        actions={
          <Button icon={Plus} onClick={openCreate}>
            新增習慣
          </Button>
        }
      />

      {/* 頂部統計 */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <MiniStat
          label="今日完成"
          value={`${stats.doneToday}/${stats.dueToday}`}
          hint={`完成率 ${stats.todayRate}%`}
          icon={ListChecks}
          tone="accent"
          highlight={allDone}
        />
        <MiniStat
          label="最長連續"
          value={stats.bestCurrentStreak}
          unit="日"
          icon={Flame}
          tone="amber"
        />
        <MiniStat
          label="近 7 日完美"
          value={stats.perfectDays7}
          unit="日"
          hint="全部達標"
          icon={Sparkles}
          tone="emerald"
          className="col-span-2 sm:col-span-1"
        />
      </section>

      <Tabs<View>
        tabs={tabs}
        active={view}
        onChange={setView}
        icons={{ today: ListChecks, all: CalendarDays, stats: BarChart3 }}
      />

      {/* ───────── 今日 ───────── */}
      {view === 'today' && (
        <div className="space-y-5">
          {activeHabits.length === 0 ? (
            <EmptyState
              icon={Sprout}
              art="empty-habits"
              title="仲未有習慣"
              hint="撳「新增習慣」開始，揀 emoji、顏色同頻率，每日打卡保持連續。"
              action={
                <Button icon={Plus} onClick={openCreate}>
                  新增第一個習慣
                </Button>
              }
            />
          ) : (
            <>
              <TodayRing
                done={stats.doneToday}
                total={stats.dueToday}
                rate={stats.todayRate}
                allDone={allDone}
              />

              {todayBuckets.due.length > 0 && (
                <div className="space-y-2">
                  <p className="px-1 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    今日排程 · {todayBuckets.due.length}
                  </p>
                  {todayBuckets.due.map((h) => (
                    <Card
                      key={h.id}
                      hover
                      className="rounded-2xl border-slate-200/80 dark:border-slate-700/60"
                    >
                      <HabitRow
                        habit={h}
                        done={byHabit.get(h.id) ?? new Set()}
                        onToggle={toggleLog}
                        onOpen={(hh) => setDetailId(hh.id)}
                      />
                    </Card>
                  ))}
                </div>
              )}

              {todayBuckets.notDue.length > 0 && (
                <div className="space-y-2">
                  <p className="px-1 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    今日休息日
                  </p>
                  {todayBuckets.notDue.map((h) => (
                    <Card
                      key={h.id}
                      className="rounded-2xl border-slate-200/70 opacity-70 dark:border-slate-700/50"
                    >
                      <HabitRow
                        habit={h}
                        done={byHabit.get(h.id) ?? new Set()}
                        onToggle={toggleLog}
                        onOpen={(hh) => setDetailId(hh.id)}
                      />
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ───────── 全部 ───────── */}
      {view === 'all' && (
        <div className="space-y-4">
          {/* 工具列：搜尋 + 分類 + 排序 */}
          <Card className="space-y-3 p-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                icon={Search}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜尋習慣 / 分類…"
                className="flex-1"
              />
              <div className="flex gap-2">
                <Select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="flex-1 sm:w-36"
                >
                  <option value="all">全部分類</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2">
              <SegmentedControl<SortKey>
                size="sm"
                value={sort}
                onChange={setSort}
                options={[
                  { id: 'order', label: '預設' },
                  { id: 'streak', label: '連續' },
                  { id: 'name', label: '名稱' },
                ]}
              />
              <span
                aria-live="polite"
                className="text-xs tabular-nums text-slate-400 dark:text-slate-500"
              >
                {visible.length} 個習慣
              </span>
            </div>
          </Card>

          {visible.length === 0 ? (
            <EmptyState
              icon={Search}
              title="搵唔到習慣"
              hint="試下換個關鍵字或分類，或者新增一個習慣。"
            />
          ) : (
            <div className="space-y-2">
              {visible.map((h) => (
                <Card
                  key={h.id}
                  hover
                  className="rounded-2xl border-slate-200/80 dark:border-slate-700/60"
                >
                  <HabitRow
                    habit={h}
                    done={byHabit.get(h.id) ?? new Set()}
                    onToggle={toggleLog}
                    onOpen={(hh) => setDetailId(hh.id)}
                  />
                </Card>
              ))}
            </div>
          )}

          {/* 封存區 */}
          {archivedHabits.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowArchived((v) => !v)}
                className="flex w-full items-center gap-2 px-1 py-2 text-xs font-medium uppercase tracking-wide text-slate-400 transition hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
              >
                <Archive size={14} />
                已封存（{archivedHabits.length}）
                <span className="ml-auto normal-case">{showArchived ? '收起' : '展開'}</span>
              </button>
              {showArchived && (
                <Card className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {archivedHabits.map((h) => {
                    const spec = colorOf(h.color)
                    return (
                      <div key={h.id} className="flex items-center gap-3 p-3">
                        <span className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base', spec.soft)}>
                          {h.icon ?? '⭐'}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-600 dark:text-slate-300">
                            {h.name}
                          </p>
                          <p className="text-xs text-slate-400 dark:text-slate-500">
                            {freqLabel(h.frequency)} · 累計 {(byHabit.get(h.id)?.size ?? 0)} 次
                          </p>
                        </div>
                        <IconButton label="還原" onClick={() => toggleArchive(h)}>
                          <ArchiveRestore size={17} />
                        </IconButton>
                        <IconButton label="永久刪除" tone="danger" onClick={() => confirmDeleteArchived(h)}>
                          <Trash2 size={17} />
                        </IconButton>
                      </div>
                    )
                  })}
                </Card>
              )}
            </div>
          )}

          {/* 啟用中習慣的封存入口（在詳情外快速封存） */}
          {visible.length > 0 && (
            <p className="px-1 text-center text-xs text-slate-400 dark:text-slate-500">
              想暫停某個習慣？喺習慣詳情可封存而唔刪除記錄。
            </p>
          )}
        </div>
      )}

      {/* ───────── 統計 ───────── */}
      {view === 'stats' && <StatsView habits={activeHabits} byHabit={byHabit} />}

      {/* 全部達標慶祝（今日視圖外也提示一次） */}
      <div aria-live="polite">
        {view === 'today' && allDone && (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 py-3 text-sm font-medium text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
            <PartyPopper size={18} />
            今日全部習慣完成，keep it up！
          </div>
        )}
      </div>

      {/* 編輯器 */}
      <HabitEditor
        open={editorOpen}
        habit={editing}
        onClose={() => {
          setEditorOpen(false)
          setEditing(undefined)
        }}
        onSave={handleSave}
        onDelete={editing ? handleDeleteFromEditor : undefined}
      />

      {/* 詳情 */}
      <HabitDetailWithArchive
        habit={detailHabit}
        done={detailHabit ? byHabit.get(detailHabit.id) ?? new Set() : new Set()}
        onClose={() => setDetailId(null)}
        onToggle={toggleLog}
        onEdit={openEdit}
        onArchive={(h) => {
          toggleArchive(h)
          setDetailId(null)
        }}
      />
    </div>
  )
}

// ───────── 小統計磚（頂部三格；溫暖 chip + 大數字）─────────
type StatTone = 'accent' | 'amber' | 'emerald'
const STAT_TONE: Record<StatTone, { chip: string; val: string }> = {
  accent: { chip: 'bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent', val: 'text-accent-strong dark:text-accent' },
  amber: { chip: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300', val: 'text-amber-600 dark:text-amber-400' },
  emerald: { chip: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300', val: 'text-emerald-600 dark:text-emerald-400' },
}

function MiniStat({
  label,
  value,
  unit,
  hint,
  icon: Icon,
  tone,
  highlight,
  className,
}: {
  label: string
  value: number | string
  unit?: string
  hint?: string
  icon: typeof Flame
  tone: StatTone
  highlight?: boolean
  className?: string
}) {
  const t = STAT_TONE[tone]
  return (
    <div
      className={cx(
        'flex flex-col justify-between gap-3 rounded-3xl border p-4 transition duration-200',
        highlight
          ? 'border-emerald-300/60 bg-emerald-50/70 dark:border-emerald-500/30 dark:bg-emerald-500/10'
          : 'border-slate-200/80 bg-white dark:border-slate-700/60 dark:bg-slate-800',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-400 dark:text-slate-500">{label}</span>
        <span className={cx('flex h-8 w-8 items-center justify-center rounded-xl', highlight ? STAT_TONE.emerald.chip : t.chip)}>
          <Icon size={16} />
        </span>
      </div>
      <div>
        <p className="flex items-baseline gap-1">
          <span className={cx('text-2xl font-bold tabular-nums', highlight ? STAT_TONE.emerald.val : t.val)}>{value}</span>
          {unit && <span className="text-sm font-medium text-slate-400">{unit}</span>}
        </p>
        {hint && <p className="mt-0.5 truncate text-[11px] text-slate-400 dark:text-slate-500">{hint}</p>}
      </div>
    </div>
  )
}

// ───────── 今日完成環（自製 SVG 圓環）─────────
function TodayRing({
  done,
  total,
  rate,
  allDone,
}: {
  done: number
  total: number
  rate: number
  allDone: boolean
}) {
  const R = 52
  const C = 2 * Math.PI * R
  const dash = (rate / 100) * C
  return (
    <Card
      className={cx(
        'relative flex items-center gap-5 overflow-hidden p-5',
        allDone &&
          'border-emerald-300/60 bg-gradient-to-br from-emerald-50/80 to-white dark:border-emerald-500/30 dark:from-emerald-500/10 dark:to-slate-800',
      )}
    >
      {allDone && (
        <div className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-emerald-400/10 blur-2xl" />
      )}
      <div className="relative h-32 w-32 shrink-0">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden="true">
          <circle
            cx="60"
            cy="60"
            r={R}
            fill="none"
            strokeWidth="12"
            className="stroke-slate-100 dark:stroke-slate-700/70"
          />
          <circle
            cx="60"
            cy="60"
            r={R}
            fill="none"
            strokeWidth="12"
            strokeLinecap="round"
            stroke={allDone ? 'rgb(16 185 129)' : 'var(--accent)'}
            strokeDasharray={`${dash} ${C}`}
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={cx(
              'text-3xl font-bold tabular-nums',
              allDone ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-800 dark:text-slate-100',
            )}
          >
            {rate}%
          </span>
          <span className="text-xs tabular-nums text-slate-400 dark:text-slate-500">
            {done}/{total}
          </span>
        </div>
      </div>
      <div className="relative min-w-0">
        <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
          {allDone ? '今日全部完成 🎉' : '今日進度'}
        </h3>
        <p className="mt-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          {allDone
            ? '全部排程習慣都打咗卡，好嘢！'
            : total - done > 0
              ? `仲差 ${total - done} 個就完成今日全部排程習慣。`
              : '今日冇排程習慣，放鬆下。'}
        </p>
      </div>
    </Card>
  )
}

// ───────── 詳情包一層：加封存按鈕 footer（透過自家 wrapper 避免改 HabitDetail 簽名）─────────
function HabitDetailWithArchive({
  habit,
  done,
  onClose,
  onToggle,
  onEdit,
  onArchive,
}: {
  habit: Habit | null
  done: Set<string>
  onClose: () => void
  onToggle: (habitId: string, dateKey: string) => void
  onEdit: (habit: Habit) => void
  onArchive: (habit: Habit) => void
}) {
  if (!habit) return null
  return (
    <>
      <HabitDetail
        habit={habit}
        done={done}
        onClose={onClose}
        onToggle={onToggle}
        onEdit={onEdit}
      />
      {/* 浮動封存鈕（左下，避免改 HabitDetail footer） */}
      <button
        type="button"
        onClick={() => onArchive(habit)}
        className="fixed bottom-6 left-1/2 z-[60] inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-lg transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 sm:left-auto sm:right-8 sm:translate-x-0"
      >
        <Archive size={16} />
        封存呢個習慣
      </button>
    </>
  )
}
