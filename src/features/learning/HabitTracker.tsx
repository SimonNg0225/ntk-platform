import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useCollection } from '../../lib/store'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import {
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
  AlertTriangle,
  CalendarCheck,
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
  streakAtRisk,
  todayKey,
  recentDays,
  weekdayOf,
  type AtRiskHabit,
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
  // 用 activeHabits（而非 visible），令「今日」分頁唔受「全部」分頁殘留嘅
  // 分類/搜尋篩選影響——今日分頁本身冇任何篩選 UI，否則用家會見到今日進度
  // 莫名其妙縮細／部分習慣消失。
  // 斷 streak 警報：今日應做、今日未打、目前仲有連勝（一打就保、唔打清零）。
  const atRisk = useMemo(
    () => streakAtRisk(activeHabits, byHabit),
    [activeHabits, byHabit],
  )

  const todayBuckets = useMemo(() => {
    const wd = new Date().getDay()
    const atRiskIds = new Set(atRisk.map((a) => a.id))
    const due: Habit[] = []
    const notDue: Habit[] = []
    for (const h of activeHabits) {
      const sched =
        h.frequency.kind !== 'weekdays' || h.frequency.days.includes(wd)
      if (sched) due.push(h)
      else notDue.push(h)
    }
    // 排序優先級：at-risk 未完成（0）→ 其餘未完成（1）→ 今日已完成（2）。
    // 同組內維持原 order（穩定排序）。
    const rank = (h: Habit) => {
      if ((byHabit.get(h.id) ?? new Set()).has(today)) return 2
      return atRiskIds.has(h.id) ? 0 : 1
    }
    due.sort((a, b) => rank(a) - rank(b))
    return { due, notDue }
  }, [activeHabits, byHabit, today, atRisk])

  // 頂部統計磚每個分頁都顯示，定位係全域 dashboard，故同樣用 activeHabits，
  // 避免被「全部」分頁嘅篩選靜默縮細。
  const stats = useMemo(
    () => overallStats(activeHabits, byHabit),
    [activeHabits, byHabit],
  )
  const allDone = stats.dueToday > 0 && stats.doneToday === stats.dueToday

  // 近 14 日整體節奏（鏈條 hero 用）：每日 = 當日全部排程習慣嘅完成比例（0-1）。
  // 由舊到新，最後一格 = 今日。純衍生自 activeHabits + byHabit。
  const rhythm14 = useMemo(() => {
    return recentDays(14).map((k) => {
      const wd = weekdayOf(k)
      let due = 0
      let done = 0
      for (const h of activeHabits) {
        if (h.frequency.kind === 'weekdays' && !h.frequency.days.includes(wd)) continue
        due += 1
        if ((byHabit.get(h.id) ?? new Set()).has(k)) done += 1
      }
      return { key: k, ratio: due > 0 ? done / due : 0, due }
    })
  }, [activeHabits, byHabit])

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
    <div className="w-full space-y-5 p-4">
      {/* ───────── 老黃曆 masthead：功能名做頁面身份（kicker 老黃曆 + serif「習慣追蹤」+ 今日曆書行） ───────── */}
      <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.3em] text-accent/70">
            <CalendarDays size={13} className="shrink-0" />
            老黃曆 · Daily Almanac
          </p>
          <h1 className="mt-1 text-2xl font-semibold leading-tight tracking-tight text-slate-800 dark:text-slate-100 sm:text-[28px]">
            習慣追蹤
          </h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
            <span className="tabular-nums">{longTodayLabel(today)}</span>
            <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">·</span>
            <span className="tabular-nums">在養成 {activeHabits.length} 個習慣</span>
            {stats.bestCurrentStreak > 0 && (
              <>
                <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">·</span>
                <span className="inline-flex items-center gap-1 font-medium text-amber-600 dark:text-amber-400">
                  <Flame size={12} /> 最旺 {stats.bestCurrentStreak} 日連續
                </span>
              </>
            )}
          </p>
        </div>
        <Button icon={Plus} onClick={openCreate}>
          新增習慣
        </Button>
      </header>

      {/* ───────── 曆書帶：細口統計（hairline grid · serif 大數字） ───────── */}
      <section className="grid grid-cols-3 gap-px overflow-hidden rounded-2xl bg-slate-200/70 ring-1 ring-slate-200/80 dark:bg-slate-700/50 dark:ring-slate-700/60">
        <AlmanacStat
          label="今日完成"
          value={`${stats.doneToday}/${stats.dueToday}`}
          icon={ListChecks}
          hint={`完成率 ${stats.todayRate}%`}
          hot={allDone}
        />
        <AlmanacStat
          label="最長連續"
          value={stats.bestCurrentStreak}
          unit="日"
          icon={Flame}
          hint={stats.bestCurrentStreak > 0 ? '保持落去！' : '由今日開始'}
        />
        <AlmanacStat
          label="近 7 日完美"
          value={stats.perfectDays7}
          unit="日"
          icon={Sparkles}
          hint="全部達標"
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
                rhythm={rhythm14}
              />

              {atRisk.length > 0 && (
                <AtRiskBanner items={atRisk} onPick={setDetailId} />
              )}

              {todayBuckets.due.length > 0 && (
                <div className="space-y-2">
                  <SectionLabel icon={CalendarCheck}>
                    今日排程 · {todayBuckets.due.length}
                  </SectionLabel>
                  {todayBuckets.due.map((h, i) => (
                    <div
                      key={h.id}
                      className="animate-fade-in-up"
                      style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}
                    >
                      <Card
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
                    </div>
                  ))}
                </div>
              )}

              {todayBuckets.notDue.length > 0 && (
                <div className="space-y-2">
                  <SectionLabel icon={Sprout}>今日休息日</SectionLabel>
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
                className="flex w-full items-center gap-2 px-1 py-2 text-xs font-medium uppercase tracking-wide text-slate-400 transition active:scale-[0.98] hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
              >
                <Archive size={14} />
                已封存（{archivedHabits.length}）
                <span className="ml-auto normal-case">{showArchived ? '收起' : '展開'}</span>
              </button>
              {showArchived && (
                <Card className="mt-1 rounded-2xl divide-y divide-slate-100 dark:divide-slate-700/60">
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
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 py-3 text-sm font-medium text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
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

// ───────── 老黃曆日期（serif masthead 用：YYYY年M月D日 星期X）─────────
const WD_FULL = ['日', '一', '二', '三', '四', '五', '六']
function longTodayLabel(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  const dow = new Date(y, (m || 1) - 1, d || 1).getDay()
  return `${y}年${m}月${d}日 · 星期${WD_FULL[dow] ?? ''}`
}

// ───────── 區段標籤（小帽 + icon；取代散落嘅 <p>，統一節奏）─────────
function SectionLabel({
  icon: Icon,
  children,
}: {
  icon: typeof Flame
  children: ReactNode
}) {
  return (
    <p className="flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
      <Icon size={13} className="shrink-0" />
      {children}
    </p>
  )
}

// ───────── 曆書帶統計格（hairline grid · serif 大數字；達標時 hot 高亮）─────────
function AlmanacStat({
  label,
  value,
  unit,
  hint,
  icon: Icon,
  hot,
}: {
  label: string
  value: number | string
  unit?: string
  hint?: string
  icon: typeof Flame
  hot?: boolean
}) {
  return (
    <div
      className={cx(
        'px-3.5 py-3.5 transition-colors sm:px-4',
        hot
          ? 'bg-emerald-50 dark:bg-emerald-500/10'
          : 'bg-white dark:bg-slate-800',
      )}
    >
      <p
        className={cx(
          'flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide',
          hot ? 'text-emerald-600/80 dark:text-emerald-400/80' : 'text-slate-400 dark:text-slate-500',
        )}
      >
        <Icon size={12} className="shrink-0" />
        <span className="truncate">{label}</span>
      </p>
      <p
        className={cx(
          'mt-1 text-[26px] font-semibold leading-none tabular-nums slashed-zero',
          hot ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-800 dark:text-slate-100',
        )}
      >
        {value}
        {unit && <span className="ml-1 font-sans text-sm font-normal text-slate-400">{unit}</span>}
      </p>
      {hint && <p className="mt-1 truncate text-[11px] text-slate-400 dark:text-slate-500">{hint}</p>}
    </div>
  )
}

// ───────── 斷 streak 警報 banner（今日未保住嘅連勝）─────────
//  rose/amber 暖警示色，跟 HabitDetail 既有 ring/solid 風格。
//  撳任一 chip 直接開該習慣詳情（去打卡）。最多列 4 個，其餘收成 +N。
function AtRiskBanner({
  items,
  onPick,
}: {
  items: AtRiskHabit[]
  onPick: (id: string) => void
}) {
  const shown = items.slice(0, 4)
  const rest = items.length - shown.length
  return (
    <Card className="border-rose-200/80 bg-rose-50/70 p-3.5 dark:border-rose-500/25 dark:bg-rose-500/10">
      <div className="flex items-start gap-2.5" role="region" aria-label="斷連勝警報">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-300">
          <AlertTriangle size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">
            {items.length} 個連勝今日未保住
          </p>
          <p className="mt-0.5 text-xs text-rose-600/80 dark:text-rose-300/70">
            再唔打卡今日就會清零，撳一下即去保住。
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {shown.map((it) => (
              <button
                key={it.id}
                type="button"
                onClick={() => onPick(it.id)}
                className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-1 text-xs font-medium text-rose-700 shadow-xs ring-1 ring-inset ring-rose-200 transition active:scale-[0.98] hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50 dark:bg-rose-500/15 dark:text-rose-200 dark:ring-rose-500/30 dark:hover:bg-rose-500/25"
              >
                <span className="max-w-[7rem] truncate">{it.name}</span>
                <span className="inline-flex items-center gap-0.5 tabular-nums text-rose-500 dark:text-rose-300/90">
                  <Flame size={11} />
                  {it.streak}
                </span>
              </button>
            ))}
            {rest > 0 && (
              <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium text-rose-500/80 dark:text-rose-300/70">
                +{rest}
              </span>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}

// ───────── 今日完成環（自製 SVG 圓環）+ 近 14 日節奏鏈條 ─────────
type RhythmDay = { key: string; ratio: number; due: number }
function TodayRing({
  done,
  total,
  rate,
  allDone,
  rhythm,
}: {
  done: number
  total: number
  rate: number
  allDone: boolean
  rhythm: RhythmDay[]
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
              'text-3xl font-semibold tabular-nums',
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
      <div className="relative min-w-0 flex-1">
        <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">
          {allDone ? '今日全部完成 🎉' : '今日進度'}
        </h3>
        <p className="mt-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          {allDone
            ? '全部排程習慣都打咗卡，好嘢！'
            : total - done > 0
              ? `仲差 ${total - done} 個就完成今日全部排程習慣。`
              : '今日冇排程習慣，放鬆下。'}
        </p>
        <RhythmChain rhythm={rhythm} allDone={allDone} />
      </div>
    </Card>
  )
}

// ───────── 近 14 日節奏鏈條（hero 內；整體完成密度 → 鏈節深淺）─────────
//  每節 = 一日；色深 = 當日完成比例（0-1）。連續兩日都「全達標」先以連桿駁起，
//  令一段全達標期讀成一條完整嘅鏈，呼應「連續鏈條」主題。今日節加外框。
function RhythmChain({ rhythm, allDone }: { rhythm: RhythmDay[]; allDone: boolean }) {
  if (rhythm.length === 0) return null
  const tone = allDone ? 'emerald' : 'accent'
  // 比例 → 不透明度 class（0 用淡底；愈高愈實）。
  const fillClass = (r: number) => {
    if (r <= 0) return 'bg-slate-200/80 dark:bg-slate-600/50'
    if (tone === 'emerald') {
      if (r >= 1) return 'bg-emerald-500'
      if (r >= 0.5) return 'bg-emerald-500/60'
      return 'bg-emerald-500/30'
    }
    if (r >= 1) return 'bg-accent'
    if (r >= 0.5) return 'bg-accent/60'
    return 'bg-accent/30'
  }
  const linkClass = tone === 'emerald' ? 'bg-emerald-500' : 'bg-accent'
  return (
    <div className="mt-3.5">
      <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
        近 14 日節奏
      </p>
      <div className="flex items-center gap-0">
        {rhythm.map((d, i) => {
          const isToday = i === rhythm.length - 1
          const linked = i > 0 && d.ratio >= 1 && rhythm[i - 1].ratio >= 1
          return (
            <div key={d.key} className="flex items-center">
              {i > 0 && (
                <span
                  aria-hidden="true"
                  className={cx('h-[3px] w-1.5 shrink-0 transition-colors', linked ? linkClass : 'bg-transparent')}
                />
              )}
              <span
                title={`${d.key.slice(5)}：${d.due > 0 ? `${Math.round(d.ratio * 100)}% 完成` : '冇排程'}`}
                className={cx(
                  'h-2.5 w-2.5 shrink-0 rounded-full transition-colors',
                  fillClass(d.ratio),
                  isToday && 'ring-2 ring-offset-1 ring-offset-white ring-slate-300 dark:ring-offset-slate-800 dark:ring-slate-500',
                )}
              />
            </div>
          )
        })}
      </div>
    </div>
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
        className="fixed bottom-6 left-1/2 z-[60] inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-lg transition active:scale-[0.98] hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 sm:left-auto sm:right-8 sm:translate-x-0"
      >
        <Archive size={16} />
        封存呢個習慣
      </button>
    </>
  )
}
