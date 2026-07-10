import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
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
  FeatureGuide,
  type FeatureGuideStep,
  PageHero,
  cx,
} from '../../ui'
import type { LucideIcon } from 'lucide-react'
import {
  Plus,
  Search,
  Flame,
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

// 教學引導步驟（3 步：建立 → 每日打卡 → 查看連續/統計）
const GUIDE_STEPS: FeatureGuideStep[] = [
  {
    title: '新增習慣',
    desc: '按右上「新增習慣」，選擇 emoji、顏色同頻率（每日／指定星期）。',
  },
  {
    title: '每日打卡',
    desc: '在「今日」分頁逐個勾選已完成的習慣，保持連續紀錄。',
  },
  {
    title: '查看連續同統計',
    desc: '頂部查看今日完成同最長連續；「統計」分頁有 heatmap 同趨勢。',
  },
]

export default function HabitTracker() {
  const { t } = useTranslation()
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

  // 「全部」分頁係咪有篩選緊（決定空狀態係「無習慣」定「篩不到」）
  const filtersActive = query.trim() !== '' || category !== 'all'
  function clearFilters() {
    setQuery('')
    setCategory('all')
  }

  // 今日待辦：依「應做」分拆
  // 用 activeHabits（而非 visible），令「今日」分頁不受「全部」分頁殘留的
  // 分類/搜尋篩選影響——今日分頁本身沒有任何篩選 UI，否則用家會見到今日進度
  // 莫名其妙縮細／部分習慣消失。
  // 斷 streak 警報：今日應做、今日未打、目前還有連勝（一打就保、不打清零）。
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
  // 避免被「全部」分頁的篩選靜默縮細。
  const stats = useMemo(
    () => overallStats(activeHabits, byHabit),
    [activeHabits, byHabit],
  )
  const allDone = stats.dueToday > 0 && stats.doneToday === stats.dueToday

  // 近 14 日整體節奏（鏈條 hero 用）：每日 = 當日全部排程習慣的完成比例（0-1）。
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
      {/* ───────── PageHero：統一 accent hero（icon chip + 標題 + 今日狀態副題） ───────── */}
      <PageHero
        guideKey="habits"
        icon={CalendarCheck}
        kicker={t('habits.kicker', { defaultValue: '學習成長 · 每日養成' })}
        title={t('habits.title', { defaultValue: '習慣追蹤' })}
        description={t('habits.heroSubtitle', {
          date: longTodayLabel(today),
          n: activeHabits.length,
          defaultValue: `${longTodayLabel(today)} · 在養成 ${activeHabits.length} 個習慣`,
        })}
        actions={
          <Button
            icon={Plus}
            variant="secondary"
            onClick={openCreate}
            className="border-white/25 bg-white/15 text-white hover:bg-white/25 dark:border-white/25 dark:bg-white/15 dark:hover:bg-white/25"
          >
            {t('habits.addHabit', { defaultValue: '新增習慣' })}
          </Button>
        }
      />

      {/* ───────── 教學引導：如何使用此功能 ───────── */}
      <FeatureGuide
        storageKey="habits"
        title={t('habits.guideTitle', { defaultValue: '習慣追蹤使用說明' })}
        steps={GUIDE_STEPS}
      />

      {/* ───────── 統計帶：三張統計磚（同 dashboard StatTile 一致） ───────── */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <HabitStat
          label={t('habits.statDoneToday', { defaultValue: '今日完成' })}
          value={`${stats.doneToday}/${stats.dueToday}`}
          icon={ListChecks}
          tone={allDone ? 'emerald' : 'accent'}
          hint={t('habits.statRate', {
            r: stats.todayRate,
            defaultValue: `完成率 ${stats.todayRate}%`,
          })}
        />
        <HabitStat
          label={t('habits.statBestStreak', { defaultValue: '最長連續' })}
          value={stats.bestCurrentStreak}
          unit={t('habits.unitDay', { defaultValue: '日' })}
          icon={Flame}
          tone="amber"
          hint={
            stats.bestCurrentStreak > 0
              ? t('habits.statKeepGoing', { defaultValue: '保持落去！' })
              : t('habits.statStartToday', { defaultValue: '由今日開始' })
          }
        />
        <HabitStat
          label={t('habits.statPerfect7', { defaultValue: '近 7 日完美' })}
          value={stats.perfectDays7}
          unit={t('habits.unitDay', { defaultValue: '日' })}
          icon={Flame}
          tone="violet"
          hint={t('habits.statAllHit', { defaultValue: '全部達標' })}
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
              title={t('habits.emptyTitle', { defaultValue: '尚未有習慣' })}
              hint={t('habits.emptyHint', {
                defaultValue: '按「新增習慣」開始，選擇 emoji、顏色同頻率，每日打卡保持連續。',
              })}
              action={
                <Button icon={Plus} onClick={openCreate}>
                  {t('habits.emptyCta', { defaultValue: '新增第一個習慣' })}
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
                    {t('habits.todayDue', {
                      n: todayBuckets.due.length,
                      defaultValue: `今日排程 · ${todayBuckets.due.length}`,
                    })}
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
                  <SectionLabel icon={Sprout}>
                    {t('habits.restDay', { defaultValue: '今日休息日' })}
                  </SectionLabel>
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
                placeholder={t('habits.searchPlaceholder', { defaultValue: '搜尋習慣 / 分類…' })}
                className="flex-1"
              />
              <div className="flex gap-2">
                <Select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="flex-1 sm:w-36"
                >
                  <option value="all">{t('habits.allCategories', { defaultValue: '全部分類' })}</option>
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
                  { id: 'order', label: t('habits.sortDefault', { defaultValue: '預設' }) },
                  { id: 'streak', label: t('habits.sortStreak', { defaultValue: '連續' }) },
                  { id: 'name', label: t('habits.sortName', { defaultValue: '名稱' }) },
                ]}
              />
              <span
                aria-live="polite"
                className="text-xs tabular-nums text-slate-400 dark:text-slate-500"
              >
                {t('habits.countN', { n: visible.length, defaultValue: `${visible.length} 個習慣` })}
              </span>
            </div>
          </Card>

          {visible.length === 0 ? (
            filtersActive ? (
              <EmptyState
                icon={Search}
                title={t('habits.noMatchTitle', { defaultValue: '搜尋不到習慣' })}
                hint={t('habits.noMatchHint', { defaultValue: '嘗試換個關鍵字或分類。' })}
                action={
                  <Button size="sm" variant="secondary" onClick={clearFilters}>
                    {t('habits.clearFilters', { defaultValue: '清除篩選' })}
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={Sprout}
                art="empty-habits"
                title={t('habits.emptyTitle', { defaultValue: '尚未有習慣' })}
                hint={t('habits.emptyHintAll', {
                  defaultValue: '建立第一個習慣，之後在「今日」分頁逐日打卡。',
                })}
                action={
                  <Button icon={Plus} onClick={openCreate}>
                    {t('habits.emptyCta', { defaultValue: '新增第一個習慣' })}
                  </Button>
                }
              />
            )
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
                className="flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-xs font-medium text-slate-400 transition active:scale-[0.98] hover:bg-slate-50 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:text-slate-500 dark:hover:bg-slate-800/60 dark:hover:text-slate-300"
                aria-expanded={showArchived}
              >
                <Archive size={14} />
                {t('habits.archivedN', {
                  n: archivedHabits.length,
                  defaultValue: `已封存（${archivedHabits.length}）`,
                })}
                <span className="ml-auto">
                  {showArchived
                    ? t('habits.collapse', { defaultValue: '收起' })
                    : t('habits.expand', { defaultValue: '展開' })}
                </span>
              </button>
              {showArchived && (
                <Card className="mt-1 rounded-2xl divide-y divide-slate-100 dark:divide-slate-700/60">
                  {archivedHabits.map((h) => {
                    const spec = colorOf(h.color)
                    return (
                      <div key={h.id} className="flex min-h-14 items-center gap-3 p-3">
                        <span className={cx('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-base', spec.soft)}>
                          {h.icon ?? '⭐'}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-600 dark:text-slate-300">
                            {h.name}
                          </p>
                          <p className="text-xs text-slate-400 dark:text-slate-500">
                            {t('habits.archivedMeta', {
                              freq: freqLabel(h.frequency),
                              n: byHabit.get(h.id)?.size ?? 0,
                              defaultValue: `${freqLabel(h.frequency)} · 累計 ${byHabit.get(h.id)?.size ?? 0} 次`,
                            })}
                          </p>
                        </div>
                        <IconButton label={t('habits.restore', { defaultValue: '還原' })} onClick={() => toggleArchive(h)}>
                          <ArchiveRestore size={17} />
                        </IconButton>
                        <IconButton label={t('habits.deleteForever', { defaultValue: '永久刪除' })} tone="danger" onClick={() => confirmDeleteArchived(h)}>
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
              {t('habits.archiveTip', {
                defaultValue: '想暫停某個習慣？在習慣詳情可封存而不刪除記錄。',
              })}
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
            {t('habits.allDoneCelebrate', { defaultValue: '今日全部習慣完成，keep it up！' })}
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

// ───────── 區段標籤（小帽 + icon；統一節奏）─────────
//  純中文標籤，故不落 uppercase/tracking（doNots：CJK uppercase 無效＋字距散）。
function SectionLabel({
  icon: Icon,
  children,
}: {
  icon: typeof Flame
  children: ReactNode
}) {
  return (
    <p className="flex items-center gap-1.5 px-1 text-xs font-semibold text-slate-500 dark:text-slate-300">
      <Icon size={13} className="shrink-0" />
      {children}
    </p>
  )
}

// ───────── 統計磚（同 WorkDashboard StatTile 一致：tone chip + 大數字）─────────
type Tone = 'accent' | 'amber' | 'emerald' | 'violet' | 'sky' | 'rose'
const TONE: Record<Tone, { chip: string; val: string }> = {
  accent: { chip: 'bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent', val: 'text-accent' },
  amber: { chip: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300', val: 'text-amber-500' },
  emerald: { chip: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300', val: 'text-emerald-500' },
  violet: { chip: 'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300', val: 'text-violet-500' },
  sky: { chip: 'bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300', val: 'text-sky-500' },
  rose: { chip: 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300', val: 'text-rose-500' },
}

function HabitStat({
  label,
  value,
  unit,
  hint,
  icon: Icon,
  tone,
}: {
  label: string
  value: number | string
  unit?: string
  hint?: string
  icon: LucideIcon
  tone: Tone
}) {
  const tn = TONE[tone]
  return (
    <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-700/60 dark:bg-slate-800">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-400 dark:text-slate-500">{label}</span>
        <span className={cx('flex h-11 w-11 items-center justify-center rounded-xl', tn.chip)}>
          <Icon size={18} />
        </span>
      </div>
      <div className="mt-3">
        <p className="flex items-baseline gap-1">
          <span className={cx('text-3xl font-semibold tabular-nums slashed-zero', tn.val)}>{value}</span>
          {unit && <span className="text-sm font-medium text-slate-400">{unit}</span>}
        </p>
        {hint && <p className="mt-0.5 truncate text-[11px] text-slate-400">{hint}</p>}
      </div>
    </div>
  )
}

// ───────── 斷 streak 警報 banner（今日未保住的連勝）─────────
//  rose/amber 暖警示色，跟 HabitDetail 既有 ring/solid 風格。
//  按任一 chip 直接開該習慣詳情（去打卡）。最多列 4 個，其餘收成 +N。
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
            再不打卡今日就會清零，按一下即去保住。
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {shown.map((it) => (
              <button
                key={it.id}
                type="button"
                onClick={() => onPick(it.id)}
                className="inline-flex min-h-11 items-center gap-1 rounded-full bg-white/80 px-2.5 text-xs font-medium text-rose-700 shadow-xs ring-1 ring-inset ring-rose-200 transition active:scale-[0.98] hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50 dark:bg-rose-500/15 dark:text-rose-200 dark:ring-rose-500/30 dark:hover:bg-rose-500/25"
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
            ? '全部排程習慣都已打卡，很好！'
            : total - done > 0
              ? `還差 ${total - done} 個就完成今日全部排程習慣。`
              : '今日沒有排程習慣，放鬆下。'}
        </p>
        <RhythmChain rhythm={rhythm} allDone={allDone} />
      </div>
    </Card>
  )
}

// ───────── 近 14 日節奏鏈條（hero 內；整體完成密度 → 鏈節深淺）─────────
//  每節 = 一日；色深 = 當日完成比例（0-1）。連續兩日都「全達標」先以連桿駁起，
//  令一段全達標期讀成一條完整的鏈，呼應「連續鏈條」主題。今日節加外框。
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
                title={`${d.key.slice(5)}：${d.due > 0 ? `${Math.round(d.ratio * 100)}% 完成` : '沒有排程'}`}
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
        className="fixed bottom-6 left-1/2 z-[60] inline-flex min-h-11 -translate-x-1/2 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 shadow-lg transition active:scale-[0.98] hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 sm:left-auto sm:right-8 sm:translate-x-0"
      >
        <Archive size={16} />
        封存這個習慣
      </button>
    </>
  )
}
