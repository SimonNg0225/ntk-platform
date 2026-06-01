import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  Layers,
  Pause,
  Pencil,
  PieChart,
  Play,
  Plus,
  Receipt,
  Repeat,
  Search,
  Sparkles,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useCollection } from '../../lib/store'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import { transactionsCol, txCategoriesCol } from '../../data/collections'
import type { Transaction, TxCategory, TxKind } from '../../data/types'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  IconButton,
  Input,
  Modal,
  Pills,
  ProgressBar,
  SectionTitle,
  SegmentedControl,
  Select,
  Separator,
  Tabs,
  cx,
} from '../../ui'
import {
  CashflowBars,
  CategoryDonut,
  BalanceTrend,
  BudgetRing,
  DailySpendChart,
  SLICE_HEX,
  SpendingHeatmap,
} from './budget/Charts'
import {
  CYCLE_LABEL,
  EMPTY_FILTERS,
  applyFilters,
  budgetRows,
  budgetSummary,
  budgetsCol,
  byCategory,
  computeMonthStats,
  dailyBreakdown,
  daysBetween,
  downloadCsv,
  dueRecurring,
  filtersActive,
  fmtDate,
  fmtMoney,
  inMonth,
  monthKey,
  monthLabel,
  monthlyTrend,
  pruneBudgets,
  recurringCol,
  shiftMonth,
  sortTxDesc,
  todayIso,
  txToCsvRows,
  upcomingDue,
  upsertBudget,
  type BudgetRow,
  type Filters,
  type RecurrenceCycle,
  type RecurringTx,
} from './budget/util'

// ============================================================
//  收支記帳 — MoneyLover / Money Manager 級個人理財
//  ------------------------------------------------------------
//  純前端、localStorage + Supabase 自動同步、手寫 SVG/div 圖表，零 chart lib。
//  深度：六視圖（總覽 / 記錄 / 預算 / 分析 / 定期 / 分類）、分類預算信封、
//  定期收支自動到期入帳、搜尋 + 進階篩選、批量刪除、CSV 匯出、
//  儲蓄率 / 日均 / 月底預測 / 月對月升跌等統計。
//  共用 transactionsCol / txCategoriesCol（讀寫公開 API），新型別 + 預算 /
//  定期持久化全部喺 ./budget/* 自家檔，唔掂 data/collections.ts。
// ============================================================

type TopTab = 'overview' | 'list' | 'budgets' | 'analysis' | 'recurring' | 'categories'

const KIND_PILLS: { id: TxKind; label: string }[] = [
  { id: 'expense', label: '支出' },
  { id: 'income', label: '收入' },
]

const EMOJI_CHOICES = ['🏷️', '💼', '🍜', '🚇', '🛍️', '🧾', '🎮', '🏠', '💊', '✈️', '📚', '🎁', '☕', '⛽', '🏥']

// ───────── 頂層元件 ─────────
export default function BudgetTracker() {
  const txs = useCollection(transactionsCol)
  const cats = useCollection(txCategoriesCol)
  const envelopes = useCollection(budgetsCol)
  const recurring = useCollection(recurringCol)
  const toast = useToast()

  const [month, setMonth] = useState(() => monthKey(new Date()))
  const [tab, setTab] = useState<TopTab>('overview')

  // 新增 / 編輯 Modal
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [presetKind, setPresetKind] = useState<TxKind>('expense')
  const [showForm, setShowForm] = useState(false)

  // 開機清掉孤兒預算（分類已刪）
  useEffect(() => {
    pruneBudgets(new Set(cats.map((c) => c.id)))
  }, [cats])

  const catOf = (id: string) => cats.find((c) => c.id === id)
  const catName = (id: string) => catOf(id)?.name ?? '未分類'

  // ───── 本月過濾 + 統計 ─────
  const monthTxs = useMemo(
    () => txs.filter((t) => inMonth(t, month)).sort(sortTxDesc),
    [txs, month],
  )
  const stats = useMemo(() => computeMonthStats(monthTxs, month), [monthTxs, month])
  const prevStats = useMemo(() => {
    const pk = shiftMonth(month, -1)
    return computeMonthStats(txs.filter((t) => inMonth(t, pk)), pk)
  }, [txs, month])

  const expenseCats = useMemo(() => byCategory(monthTxs, 'expense'), [monthTxs])

  // ───── 預算 ─────
  const bRows = useMemo(() => budgetRows(envelopes, monthTxs), [envelopes, monthTxs])
  const bSummary = useMemo(() => budgetSummary(bRows), [bRows])

  // ───── 定期到期 ─────
  const due = useMemo(() => dueRecurring(recurring), [recurring])

  const openAdd = (kind: TxKind = 'expense') => {
    setEditing(null)
    setPresetKind(kind)
    setShowForm(true)
  }
  const openEdit = (t: Transaction) => {
    setEditing(t)
    setShowForm(true)
  }

  // 月對月升跌（畀 StatCard trend）
  const expenseTrend = useMemo(() => {
    if (prevStats.expense <= 0) return undefined
    const diff = ((stats.expense - prevStats.expense) / prevStats.expense) * 100
    return {
      value: `${Math.abs(Math.round(diff))}%`,
      dir: (diff > 1 ? 'up' : diff < -1 ? 'down' : 'flat') as 'up' | 'down' | 'flat',
    }
  }, [stats.expense, prevStats.expense])

  return (
    <div className="space-y-4">
      {/* 月份選擇 + 記一筆 */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-full border border-slate-200/80 bg-white p-1 shadow-xs dark:border-slate-700/60 dark:bg-slate-800 dark:shadow-none">
          <IconButton label="上個月" onClick={() => setMonth((m) => shiftMonth(m, -1))}>
            <ChevronLeft size={18} />
          </IconButton>
          <button
            onClick={() => setMonth(monthKey(new Date()))}
            className="min-w-[7rem] rounded-full px-3 py-1 text-center text-sm font-semibold tabular-nums text-slate-800 transition hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-700"
            title="返回本月"
          >
            {monthLabel(month)}
          </button>
          <IconButton label="下個月" onClick={() => setMonth((m) => shiftMonth(m, 1))}>
            <ChevronRight size={18} />
          </IconButton>
        </div>
        {due.length > 0 && tab !== 'recurring' && (
          <button
            onClick={() => setTab('recurring')}
            className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200 transition hover:bg-amber-100 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20"
          >
            <CalendarClock size={14} />
            {due.length} 筆定期待入帳
          </button>
        )}
        <Button className="ml-auto" icon={Plus} onClick={() => openAdd('expense')}>
          記一筆
        </Button>
      </div>

      {/* 結餘 hero + 收支 / 儲蓄率支援磚 */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {/* 結餘 hero（主視覺，跨 2 格）*/}
        <section className="hero-gradient relative col-span-2 flex flex-col justify-between overflow-hidden rounded-3xl p-5 text-white shadow-lg shadow-accent/25">
          <div className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-white/10 blur-2xl" />
          <div className="relative flex items-center justify-between">
            <span className="text-xs font-medium text-white/80">{monthLabel(month)} · 本月結餘</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
              <Wallet size={16} />
            </span>
          </div>
          <div className="relative mt-3">
            <p className="text-3xl font-bold tabular-nums sm:text-4xl">{fmtMoney(stats.balance)}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/80">
              <span className="inline-flex items-center gap-1 tabular-nums">
                <ArrowUpRight size={13} /> 收入 {fmtMoney(stats.income)}
              </span>
              <span className="inline-flex items-center gap-1 tabular-nums">
                <ArrowDownRight size={13} /> 支出 {fmtMoney(stats.expense)}
              </span>
            </div>
          </div>
        </section>

        <BudgetStatTile
          icon={TrendingDown}
          tone="rose"
          label="支出"
          value={fmtMoney(stats.expense)}
          trend={expenseTrend}
          hint={stats.count > 0 ? `共 ${stats.count} 筆` : undefined}
        />
        <BudgetStatTile
          icon={Sparkles}
          tone="emerald"
          label="儲蓄率"
          value={stats.savingsRate == null ? '—' : String(stats.savingsRate)}
          unit={stats.savingsRate == null ? undefined : '%'}
          hint={stats.savingsRate == null ? '記低收支即計' : '收入用剩比率'}
        />
      </div>

      {/* Tabs */}
      <Tabs
        tabs={[
          { id: 'overview', label: '總覽' },
          { id: 'list', label: '記錄' },
          { id: 'budgets', label: '預算' },
          { id: 'analysis', label: '分析' },
          { id: 'recurring', label: '定期' },
          { id: 'categories', label: '分類' },
        ]}
        active={tab}
        onChange={setTab}
        size="sm"
        icons={{
          overview: PieChart,
          list: Receipt,
          budgets: Target,
          analysis: TrendingUp,
          recurring: Repeat,
          categories: Layers,
        }}
      />

      {tab === 'overview' && (
        <OverviewTab
          month={month}
          monthTxs={monthTxs}
          stats={stats}
          prevExpense={prevStats.expense}
          expenseCats={expenseCats}
          bRows={bRows}
          bSummary={bSummary}
          due={due}
          catOf={catOf}
          onGoBudgets={() => setTab('budgets')}
          onGoRecurring={() => setTab('recurring')}
          onAdd={openAdd}
        />
      )}

      {tab === 'list' && (
        <RecordsTab
          monthTxs={monthTxs}
          cats={cats}
          catOf={catOf}
          catName={catName}
          onEdit={openEdit}
          onAdd={() => openAdd('expense')}
        />
      )}

      {tab === 'budgets' && (
        <BudgetsTab
          month={month}
          cats={cats}
          bRows={bRows}
          bSummary={bSummary}
          catOf={catOf}
        />
      )}

      {tab === 'analysis' && (
        <AnalysisTab month={month} txs={txs} monthTxs={monthTxs} stats={stats} catOf={catOf} />
      )}

      {tab === 'recurring' && (
        <RecurringTab recurring={recurring} cats={cats} catOf={catOf} catName={catName} />
      )}

      {tab === 'categories' && (
        <div className="animate-fade-in">
          <CategoryManager txs={txs} cats={cats} envelopes={envelopes} />
        </div>
      )}

      {/* 新增 / 編輯 Modal */}
      {showForm && (
        <TxFormModal
          key={editing ? `edit-${editing.id}` : `add-${presetKind}`}
          editing={editing}
          presetKind={presetKind}
          cats={cats}
          defaultDate={month === monthKey(new Date()) ? todayIso() : `${month}-01`}
          onClose={() => setShowForm(false)}
          onSaved={(m) => toast.success(m)}
        />
      )}
    </div>
  )
}

// ───────── 支援統計磚（bento 風：tone icon chip + 數字 + 趨勢）─────────
type TileTone = 'rose' | 'emerald' | 'accent' | 'amber'
const TILE_CHIP: Record<TileTone, string> = {
  rose: 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300',
  emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
  accent: 'bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300',
}
function BudgetStatTile({
  icon: Icon,
  tone,
  label,
  value,
  unit,
  hint,
  trend,
}: {
  icon: LucideIcon
  tone: TileTone
  label: string
  value: string
  unit?: string
  hint?: string
  trend?: { value: string; dir: 'up' | 'down' | 'flat' }
}) {
  return (
    <div className="flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs transition duration-200 hover:border-slate-300 hover:shadow-md dark:border-slate-700/60 dark:bg-slate-800 dark:shadow-none dark:hover:border-slate-600">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-400 dark:text-slate-500">{label}</span>
        <span className={cx('flex h-8 w-8 items-center justify-center rounded-xl', TILE_CHIP[tone])}>
          <Icon size={16} aria-hidden="true" />
        </span>
      </div>
      <div className="mt-2">
        <p className="flex items-baseline gap-1">
          <span className="text-2xl font-bold tabular-nums text-slate-800 dark:text-slate-100">
            {value}
          </span>
          {unit && <span className="text-sm font-medium text-slate-400">{unit}</span>}
          {trend && trend.dir !== 'flat' && (
            <span
              className={cx(
                'ml-auto inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums',
                trend.dir === 'up' ? 'text-rose-500' : 'text-emerald-500',
              )}
            >
              {trend.dir === 'up' ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
              {trend.value}
            </span>
          )}
        </p>
        {hint && <p className="mt-1 truncate text-[11px] text-slate-400 dark:text-slate-500">{hint}</p>}
      </div>
    </div>
  )
}

// ============================================================
//  總覽 Tab
// ============================================================
function OverviewTab({
  month,
  monthTxs,
  stats,
  prevExpense,
  expenseCats,
  bRows,
  bSummary,
  due,
  catOf,
  onGoBudgets,
  onGoRecurring,
  onAdd,
}: {
  month: string
  monthTxs: Transaction[]
  stats: ReturnType<typeof computeMonthStats>
  prevExpense: number
  expenseCats: ReturnType<typeof byCategory>
  bRows: BudgetRow[]
  bSummary: ReturnType<typeof budgetSummary>
  due: ReturnType<typeof dueRecurring>
  catOf: (id: string) => TxCategory | undefined
  onGoBudgets: () => void
  onGoRecurring: () => void
  onAdd: (k: TxKind) => void
}) {
  const cells = useMemo(() => dailyBreakdown(monthTxs, month), [monthTxs, month])
  const todayDay =
    month === monthKey(new Date()) ? Number(todayIso().slice(8, 10)) : null

  const donutSegs = expenseCats.slice(0, 7).map((row, i) => ({
    label: catOf(row.categoryId)?.name ?? '未分類',
    value: row.amount,
    color: SLICE_HEX[i % SLICE_HEX.length],
  }))

  const recent = monthTxs.slice(0, 5)

  if (stats.count === 0)
    return (
      <div className="animate-fade-in">
        <EmptyState
          icon={Receipt}
          title="呢個月暫時冇記錄"
          hint="撳「記一筆」開始記低你嘅收支，總覽會即時計出分類佔比、預算同每日走勢。"
          action={
            <div className="flex gap-2">
              <Button icon={Plus} onClick={() => onAdd('expense')}>
                記支出
              </Button>
              <Button variant="secondary" icon={Plus} onClick={() => onAdd('income')}>
                記收入
              </Button>
            </div>
          }
        />
      </div>
    )

  return (
    <div className="space-y-4 animate-fade-in">
      {due.length > 0 && (
        <Card className="flex items-center gap-3 border-amber-200 bg-amber-50/70 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
          <CalendarClock size={18} className="shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="flex-1 text-sm text-amber-800 dark:text-amber-200">
            有 <span className="font-semibold tabular-nums">{due.length}</span> 筆定期收支到期未入帳
          </p>
          <Button size="sm" variant="secondary" onClick={onGoRecurring}>
            前往處理
          </Button>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* 分類佔比 */}
        <Card className="rounded-2xl p-4">
          <SectionTitle icon={PieChart}>本月支出分類</SectionTitle>
          {donutSegs.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
              今個月仲未有支出記錄。
            </p>
          ) : (
            <CategoryDonut
              segments={donutSegs}
              centerValue={fmtMoney(stats.expense).replace('HK$', '')}
              centerLabel="本月支出"
            />
          )}
        </Card>

        {/* 預算速覽 */}
        <Card className="rounded-2xl p-4">
          <SectionTitle
            icon={Target}
            right={
              <button
                onClick={onGoBudgets}
                className="text-xs font-medium text-accent hover:underline dark:text-accent"
              >
                管理
              </button>
            }
          >
            預算狀況
          </SectionTitle>
          {bRows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400">仲未為分類設預算。</p>
              <Button size="sm" variant="secondary" icon={Target} onClick={onGoBudgets}>
                設定分類預算
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600 dark:text-slate-300">
                  總預算用咗{' '}
                  <span className="font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                    {bSummary.pct}%
                  </span>
                </span>
                <span className="text-xs tabular-nums text-slate-400">
                  {fmtMoney(bSummary.totalSpent)} / {fmtMoney(bSummary.totalLimit)}
                </span>
              </div>
              <ProgressBar
                value={bSummary.pct}
                tone={bSummary.overCount > 0 ? 'rose' : bSummary.pct >= 80 ? 'amber' : 'accent'}
              />
              <ul className="space-y-2 pt-1">
                {bRows.slice(0, 3).map((r) => {
                  const cat = catOf(r.categoryId)
                  return (
                    <li key={r.categoryId} className="flex items-center gap-2.5">
                      <BudgetRing pct={r.pct} over={r.status === 'over'} size={34} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="truncate text-slate-600 dark:text-slate-300">
                            {cat?.icon ?? '🏷️'} {cat?.name ?? '未分類'}
                          </span>
                          <span
                            className={cx(
                              'shrink-0 font-semibold tabular-nums',
                              r.status === 'over'
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-slate-500 dark:text-slate-400',
                            )}
                          >
                            {r.pct}%
                          </span>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </Card>
      </div>

      {/* 本月每日支出走勢 */}
      <Card className="rounded-2xl p-4">
        <SectionTitle
          icon={TrendingDown}
          right={
            <span className="text-xs tabular-nums text-slate-400">
              日均 {fmtMoney(stats.dailyAvg)}
            </span>
          }
        >
          本月每日支出
        </SectionTitle>
        <DailySpendChart cells={cells} todayDay={todayDay} />
        {todayDay != null && stats.projectedExpense > stats.expense && (
          <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
            <Sparkles size={13} className="text-accent" />
            按目前速度，本月底支出預計約{' '}
            <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">
              {fmtMoney(stats.projectedExpense)}
            </span>
            {prevExpense > 0 && (
              <span className="tabular-nums">
                （上月 {fmtMoney(prevExpense)}）
              </span>
            )}
          </p>
        )}
      </Card>

      {/* 最近交易 */}
      <Card className="rounded-2xl p-4">
        <SectionTitle icon={Receipt}>最近交易</SectionTitle>
        <ul className="space-y-0.5">
          {recent.map((t) => {
            const cat = catOf(t.categoryId)
            const income = t.kind === 'income'
            return (
              <li
                key={t.id}
                className="flex items-center gap-3 rounded-xl px-2 py-2 text-sm transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-base dark:bg-slate-700/60">
                  {cat?.icon ?? '🏷️'}
                </span>
                <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-200">
                  {cat?.name ?? '未分類'}
                  {t.note && <span className="ml-1.5 text-xs text-slate-400">· {t.note}</span>}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-slate-400">
                  {fmtDate(t.date)}
                </span>
                <span
                  className={cx(
                    'shrink-0 font-semibold tabular-nums',
                    income
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400',
                  )}
                >
                  {income ? '+' : '−'}
                  {fmtMoney(t.amount)}
                </span>
              </li>
            )
          })}
        </ul>
      </Card>
    </div>
  )
}

// ============================================================
//  記錄 Tab（搜尋 + 進階篩選 + 批量）
// ============================================================
function RecordsTab({
  monthTxs,
  cats,
  catOf,
  catName,
  onEdit,
  onAdd,
}: {
  monthTxs: Transaction[]
  cats: TxCategory[]
  catOf: (id: string) => TxCategory | undefined
  catName: (id: string) => string
  onEdit: (t: Transaction) => void
  onAdd: () => void
}) {
  const toast = useToast()
  const confirm = useConfirm()
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [showFilter, setShowFilter] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const visible = useMemo(
    () => applyFilters(monthTxs, filters, catName),
    [monthTxs, filters, catName],
  )

  // 月份 / 篩選變化時清走唔再見嘅選取
  useEffect(() => {
    setSelected((prev) => {
      const valid = new Set(visible.map((t) => t.id))
      const next = new Set([...prev].filter((id) => valid.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [visible])

  const totalShown = useMemo(() => {
    let inc = 0
    let exp = 0
    for (const t of visible) {
      if (t.kind === 'income') inc += t.amount
      else exp += t.amount
    }
    return { inc, exp }
  }, [visible])

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const allSelected = visible.length > 0 && selected.size === visible.length
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(visible.map((t) => t.id)))

  const bulkDelete = async () => {
    const ok = await confirm({
      title: `刪除 ${selected.size} 筆記錄？`,
      message: '揀咗嘅收支記錄會永久移除，無法復原。',
      confirmText: '刪除',
      tone: 'danger',
    })
    if (!ok) return
    for (const id of selected) transactionsCol.remove(id)
    toast.success(`已刪除 ${selected.size} 筆記錄`)
    setSelected(new Set())
  }

  const removeOne = async (t: Transaction) => {
    const ok = await confirm({
      title: '刪除記錄？',
      message: '此筆收支記錄將永久移除，無法復原。',
      confirmText: '刪除',
      tone: 'danger',
    })
    if (!ok) return
    transactionsCol.remove(t.id)
    toast.success('已刪除記錄')
  }

  const exportCsv = () => {
    if (visible.length === 0) return
    downloadCsv(`收支_${monthTxs[0]?.date.slice(0, 7) ?? 'export'}.csv`, txToCsvRows(visible, cats))
    toast.success('已匯出 CSV')
  }

  const active = filtersActive(filters)

  return (
    <div className="space-y-3 animate-fade-in">
      {/* 搜尋列 */}
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <Input
            icon={Search}
            value={filters.text}
            onChange={(e) => setFilters((f) => ({ ...f, text: e.target.value }))}
            placeholder="搜尋備註 / 分類…"
          />
        </div>
        <IconButton
          label="進階篩選"
          active={showFilter || active}
          onClick={() => setShowFilter((v) => !v)}
        >
          <Filter size={18} />
        </IconButton>
        <IconButton label="匯出 CSV" onClick={exportCsv} disabled={visible.length === 0}>
          <Download size={18} />
        </IconButton>
      </div>

      {/* 快速 kind pills */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Pills
          options={[
            { id: 'all', label: '全部' },
            { id: 'income', label: '收入' },
            { id: 'expense', label: '支出' },
          ]}
          active={filters.kind}
          onChange={(v) => setFilters((f) => ({ ...f, kind: v as 'all' | TxKind }))}
          size="sm"
        />
        {active && (
          <button
            onClick={() => setFilters(EMPTY_FILTERS)}
            className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-rose-500"
          >
            <X size={12} /> 清除篩選
          </button>
        )}
      </div>

      {/* 進階篩選展開 */}
      {showFilter && (
        <Card className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3 animate-fade-in">
          <Field label="分類">
            <Select
              value={filters.categoryId}
              onChange={(e) => setFilters((f) => ({ ...f, categoryId: e.target.value }))}
            >
              <option value="">全部分類</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon ? `${c.icon} ` : ''}
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="最低金額">
            <Input
              inputMode="decimal"
              value={filters.min ?? ''}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  min: e.target.value === '' ? null : Number(e.target.value.replace(/[^0-9.]/g, '')),
                }))
              }
              placeholder="不限"
            />
          </Field>
          <Field label="最高金額">
            <Input
              inputMode="decimal"
              value={filters.max ?? ''}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  max: e.target.value === '' ? null : Number(e.target.value.replace(/[^0-9.]/g, '')),
                }))
              }
              placeholder="不限"
            />
          </Field>
        </Card>
      )}

      {/* 結果摘要 + 全選 */}
      {visible.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs">
          <label className="flex cursor-pointer items-center gap-2 text-slate-500 dark:text-slate-400">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="h-3.5 w-3.5 cursor-pointer rounded border-slate-300 text-accent focus:ring-accent/40 dark:border-slate-600 dark:bg-slate-700"
            />
            {selected.size > 0 ? `已揀 ${selected.size} 筆` : `全選（${visible.length}）`}
          </label>
          <span
            className="flex items-center gap-3 tabular-nums text-slate-400"
            aria-live="polite"
          >
            {totalShown.inc > 0 && (
              <span className="text-emerald-600 dark:text-emerald-400">+{fmtMoney(totalShown.inc)}</span>
            )}
            {totalShown.exp > 0 && (
              <span className="text-rose-600 dark:text-rose-400">−{fmtMoney(totalShown.exp)}</span>
            )}
          </span>
        </div>
      )}

      {/* 批量操作條 */}
      {selected.size > 0 && (
        <div className="sticky top-2 z-10 flex items-center gap-2 rounded-lg border border-accent/30 bg-accent-soft px-3 py-2 shadow-sm dark:border-accent/40 dark:bg-accent/15 animate-fade-in">
          <span className="text-sm font-medium text-accent-strong dark:text-accent">
            已揀 {selected.size} 筆
          </span>
          <Button size="sm" variant="danger" icon={Trash2} onClick={bulkDelete} className="ml-auto">
            刪除
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            取消
          </Button>
        </div>
      )}

      {/* 列表 */}
      {visible.length === 0 ? (
        active ? (
          <EmptyState icon={Search} title="冇符合篩選嘅記錄" hint="試吓放寬條件或清除篩選。" />
        ) : (
          <EmptyState
            icon={Receipt}
            title="呢個月暫時冇記錄"
            hint="撳「記一筆」開始記低你嘅收支。"
            action={<Button icon={Plus} onClick={onAdd}>記一筆</Button>}
          />
        )
      ) : (
        <ul className="space-y-2">
          {visible.map((t) => {
            const cat = catOf(t.categoryId)
            const income = t.kind === 'income'
            const checked = selected.has(t.id)
            return (
              <Card
                key={t.id}
                className={cx(
                  'group rounded-2xl p-3 transition duration-200 hover:border-slate-300 hover:shadow-md dark:hover:border-slate-600',
                  checked && 'ring-2 ring-accent/40',
                )}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(t.id)}
                    className="h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 text-accent focus:ring-accent/40 dark:border-slate-600 dark:bg-slate-700"
                    aria-label="揀選記錄"
                  />
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-lg dark:bg-slate-700/60">
                    {cat?.icon ?? '🏷️'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
                        {cat?.name ?? '未分類'}
                      </span>
                      {!cat && <Badge tone="slate">未分類</Badge>}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs">
                      {t.note && (
                        <span className="truncate text-slate-500 dark:text-slate-400">{t.note}</span>
                      )}
                      <span className="tabular-nums text-slate-400">{fmtDate(t.date)}</span>
                    </div>
                  </div>
                  <span
                    className={cx(
                      'ml-auto shrink-0 text-sm font-semibold tabular-nums',
                      income
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400',
                    )}
                  >
                    {income ? '+' : '−'}
                    {fmtMoney(t.amount)}
                  </span>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <IconButton label="編輯記錄" onClick={() => onEdit(t)}>
                      <Pencil size={16} />
                    </IconButton>
                    <IconButton
                      label="刪除記錄"
                      tone="danger"
                      onClick={() => removeOne(t)}
                      className="sm:opacity-0 sm:transition sm:group-hover:opacity-100"
                    >
                      <Trash2 size={16} />
                    </IconButton>
                  </div>
                </div>
              </Card>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// ============================================================
//  預算 Tab（信封式）
// ============================================================
function BudgetsTab({
  month,
  cats,
  bRows,
  bSummary,
  catOf,
}: {
  month: string
  cats: TxCategory[]
  bRows: BudgetRow[]
  bSummary: ReturnType<typeof budgetSummary>
  catOf: (id: string) => TxCategory | undefined
}) {
  const toast = useToast()
  const expenseCats = cats.filter((c) => c.kind === 'expense')
  const budgeted = new Set(bRows.map((r) => r.categoryId))
  const unbudgeted = expenseCats.filter((c) => !budgeted.has(c.id))

  const [editCat, setEditCat] = useState<TxCategory | null>(null)

  const isCurrent = month === monthKey(new Date())

  return (
    <div className="space-y-4 animate-fade-in">
      {/* 總預算卡 */}
      {bRows.length > 0 && (
        <Card className="rounded-2xl p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
                <Target size={17} aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">本月總預算</p>
                <p className="mt-0.5 text-2xl font-bold tabular-nums text-slate-800 dark:text-slate-100">
                  {fmtMoney(bSummary.totalSpent)}
                  <span className="ml-1 text-sm font-normal text-slate-400">
                    / {fmtMoney(bSummary.totalLimit)}
                  </span>
                </p>
              </div>
            </div>
            <div className="text-right">
              <p
                className={cx(
                  'text-lg font-bold tabular-nums',
                  bSummary.remaining < 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-emerald-600 dark:text-emerald-400',
                )}
              >
                {bSummary.remaining < 0 ? '超支 ' : '剩 '}
                {fmtMoney(Math.abs(bSummary.remaining))}
              </p>
              {bSummary.overCount > 0 && (
                <Badge tone="rose" className="mt-1">
                  {bSummary.overCount} 個分類超支
                </Badge>
              )}
            </div>
          </div>
          <div className="mt-3">
            <ProgressBar
              value={bSummary.pct}
              tone={bSummary.overCount > 0 ? 'rose' : bSummary.pct >= 80 ? 'amber' : 'accent'}
              showValue
            />
          </div>
          {!isCurrent && (
            <p className="mt-2 text-xs text-slate-400">
              註：預算上限為固定設定，呢度顯示 {monthLabel(month)} 嘅實際使用情況。
            </p>
          )}
        </Card>
      )}

      {/* 已設預算 */}
      {bRows.length === 0 ? (
        <EmptyState
          icon={Target}
          title="仲未設分類預算"
          hint="為支出分類設定每月上限，就可以追蹤超支同剩餘。揀下面任何一個分類開始。"
        />
      ) : (
        <div className="space-y-2">
          <SectionTitle>分類預算</SectionTitle>
          {bRows.map((r) => {
            const cat = catOf(r.categoryId)
            return (
              <Card key={r.categoryId} hover className="p-3.5">
                <button
                  type="button"
                  onClick={() => cat && setEditCat(cat)}
                  aria-label={`編輯 ${cat?.name ?? '未分類'} 預算`}
                  className="flex w-full items-center gap-3 rounded-lg text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                >
                  <BudgetRing pct={r.pct} over={r.status === 'over'} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-sm font-medium text-slate-800 dark:text-slate-100">
                        <span>{cat?.icon ?? '🏷️'}</span>
                        {cat?.name ?? '未分類'}
                        {r.rollover && (
                          <Badge tone="slate" className="ml-1">
                            結轉
                          </Badge>
                        )}
                      </span>
                      <span
                        className={cx(
                          'shrink-0 text-sm font-semibold tabular-nums',
                          r.status === 'over'
                            ? 'text-rose-600 dark:text-rose-400'
                            : r.status === 'warn'
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-slate-700 dark:text-slate-200',
                        )}
                      >
                        {fmtMoney(r.spent)} / {fmtMoney(r.limit)}
                      </span>
                    </div>
                    <div className="mt-1.5">
                      <ProgressBar
                        value={Math.min(100, r.pct)}
                        tone={r.status === 'over' ? 'rose' : r.status === 'warn' ? 'amber' : 'accent'}
                        size="sm"
                      />
                    </div>
                    <div className="mt-1 flex items-center justify-between text-xs">
                      <span className="tabular-nums text-slate-400">{r.pct}% 已用</span>
                      <span
                        className={cx(
                          'tabular-nums',
                          r.remaining < 0
                            ? 'text-rose-500'
                            : 'text-slate-400',
                        )}
                      >
                        {r.remaining < 0
                          ? `超 ${fmtMoney(-r.remaining)}`
                          : `剩 ${fmtMoney(r.remaining)}`}
                      </span>
                    </div>
                  </div>
                </button>
              </Card>
            )
          })}
        </div>
      )}

      {/* 未設預算嘅分類 */}
      {unbudgeted.length > 0 && (
        <div className="space-y-2">
          <SectionTitle>未設預算</SectionTitle>
          <Card>
            <ul className="divide-y divide-slate-100 dark:divide-slate-700">
              {unbudgeted.map((c) => (
                <li key={c.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="text-lg">{c.icon ?? '🏷️'}</span>
                  <span className="flex-1 text-sm text-slate-700 dark:text-slate-200">{c.name}</span>
                  <Button size="sm" variant="secondary" icon={Plus} onClick={() => setEditCat(c)}>
                    設預算
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {editCat && (
        <BudgetEditModal
          key={editCat.id}
          cat={editCat}
          existing={bRows.find((r) => r.categoryId === editCat.id) ?? null}
          onClose={() => setEditCat(null)}
          onSaved={(m) => toast.success(m)}
        />
      )}
    </div>
  )
}

function BudgetEditModal({
  cat,
  existing,
  onClose,
  onSaved,
}: {
  cat: TxCategory
  existing: BudgetRow | null
  onClose: () => void
  onSaved: (msg: string) => void
}) {
  const [limit, setLimit] = useState(existing ? String(existing.limit) : '')
  const [rollover, setRollover] = useState(existing?.rollover ?? false)
  const num = Number(limit)
  const valid = limit !== '' && num > 0

  const save = () => {
    if (!valid) return
    upsertBudget(cat.id, num, rollover)
    onSaved(existing ? '已更新預算' : '已設定預算')
    onClose()
  }
  const clear = () => {
    upsertBudget(cat.id, 0, false)
    onSaved('已移除預算')
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`${cat.icon ?? ''} ${cat.name} 預算`}
      size="sm"
      footer={
        <>
          {existing && (
            <Button variant="ghost" onClick={clear} className="mr-auto text-rose-600">
              移除預算
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button onClick={save} disabled={!valid}>
            儲存
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="每月上限（HK$）">
          <Input
            value={limit}
            onChange={(e) =>
              setLimit(e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1'))
            }
            placeholder="例如：3000"
            inputMode="decimal"
            autoFocus
          />
        </Field>
        <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
          <input
            type="checkbox"
            checked={rollover}
            onChange={(e) => setRollover(e.target.checked)}
            className="mt-0.5 h-4 w-4 cursor-pointer rounded border-slate-300 text-accent focus:ring-accent/40 dark:border-slate-600 dark:bg-slate-700"
          />
          <span>
            <span className="block text-sm font-medium text-slate-700 dark:text-slate-200">
              結轉至下月
            </span>
            <span className="block text-xs text-slate-400">
              用剩 / 超支會喺概念上帶落下個月（標示用）。
            </span>
          </span>
        </label>
      </div>
    </Modal>
  )
}

// ============================================================
//  分析 Tab
// ============================================================
function AnalysisTab({
  month,
  txs,
  monthTxs,
  stats,
  catOf,
}: {
  month: string
  txs: Transaction[]
  monthTxs: Transaction[]
  stats: ReturnType<typeof computeMonthStats>
  catOf: (id: string) => TxCategory | undefined
}) {
  const [range, setRange] = useState<6 | 12>(6)
  const [kind, setKind] = useState<TxKind>('expense')

  const trend = useMemo(() => monthlyTrend(txs, range, month), [txs, range, month])

  const catStats = useMemo(() => byCategory(monthTxs, kind), [monthTxs, kind])
  const total = kind === 'expense' ? stats.expense : stats.income

  return (
    <div className="space-y-4 animate-fade-in">
      {/* 收支趨勢 */}
      <Card className="rounded-2xl p-4">
        <SectionTitle
          icon={TrendingUp}
          right={
            <SegmentedControl
              size="sm"
              value={String(range) as '6' | '12'}
              onChange={(v) => setRange(Number(v) as 6 | 12)}
              options={[
                { id: '6', label: '6 個月' },
                { id: '12', label: '12 個月' },
              ]}
            />
          }
        >
          收支趨勢
        </SectionTitle>
        <CashflowBars rows={trend} />
      </Card>

      {/* 淨結餘走勢 */}
      <Card className="rounded-2xl p-4">
        <SectionTitle icon={Wallet}>每月淨結餘</SectionTitle>
        <BalanceTrend rows={trend} />
      </Card>

      {/* 分類佔比（可切收 / 支）+ heatmap */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl p-4">
          <SectionTitle
            icon={PieChart}
            right={
              <SegmentedControl
                size="sm"
                value={kind}
                onChange={setKind}
                options={[
                  { id: 'expense', label: '支出' },
                  { id: 'income', label: '收入' },
                ]}
              />
            }
          >
            本月{kind === 'expense' ? '支出' : '收入'}分類
          </SectionTitle>
          {catStats.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
              今個月仲未有{kind === 'expense' ? '支出' : '收入'}記錄。
            </p>
          ) : (
            <ul className="space-y-3">
              {catStats.map((row, i) => {
                const cat = catOf(row.categoryId)
                return (
                  <li key={row.categoryId}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                        <span>{cat?.icon ?? '🏷️'}</span>
                        {cat?.name ?? '未分類'}
                        <span className="text-slate-400">· {row.count} 筆</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                          {fmtMoney(row.amount)}
                        </span>
                        <span className="w-8 text-right tabular-nums text-slate-400">{row.pct}%</span>
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${total > 0 ? (row.amount / total) * 100 : 0}%`,
                          background: SLICE_HEX[i % SLICE_HEX.length],
                        }}
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        <Card className="rounded-2xl p-4">
          <SectionTitle icon={TrendingDown}>本月消費熱力</SectionTitle>
          <SpendingHeatmap cells={dailyBreakdown(monthTxs, month)} />
        </Card>
      </div>

      {/* 統計摘要 */}
      <Card className="rounded-2xl p-4">
        <SectionTitle icon={Sparkles}>本月數據</SectionTitle>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          <Stat label="日均支出" value={fmtMoney(stats.dailyAvg)} />
          <Stat label="最大單筆" value={fmtMoney(stats.topExpense)} />
          <Stat
            label="月底預測"
            value={fmtMoney(stats.projectedExpense)}
            hint={month === monthKey(new Date()) ? '按目前速度' : '實際'}
          />
          <Stat
            label="儲蓄率"
            value={stats.savingsRate == null ? '—' : `${stats.savingsRate}%`}
          />
        </div>
      </Card>
    </div>
  )
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-0.5 text-lg font-bold tabular-nums text-slate-800 dark:text-slate-100">
        {value}
      </p>
      {hint && <p className="text-[10px] text-slate-400">{hint}</p>}
    </div>
  )
}

// ============================================================
//  定期收支 Tab
// ============================================================
function RecurringTab({
  recurring,
  cats,
  catOf,
  catName,
}: {
  recurring: RecurringTx[]
  cats: TxCategory[]
  catOf: (id: string) => TxCategory | undefined
  catName: (id: string) => string
}) {
  const toast = useToast()
  const confirm = useConfirm()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<RecurringTx | null>(null)

  const due = useMemo(() => dueRecurring(recurring), [recurring])
  const dueIds = new Set(due.map((d) => d.recurring.id))

  const sorted = useMemo(
    () => [...recurring].sort((a, b) => (a.active === b.active ? 0 : a.active ? -1 : 1)),
    [recurring],
  )

  // 入帳：產生一筆 transaction，更新 lastPosted
  const post = (info: (typeof due)[number]) => {
    const r = info.recurring
    transactionsCol.add({
      kind: r.kind,
      amount: r.amount,
      categoryId: r.categoryId,
      date: info.dueDate,
      note: r.note,
      createdAt: new Date().toISOString(),
    })
    recurringCol.update(r.id, { lastPosted: info.dueDate })
    toast.success(`已入帳：${catName(r.categoryId)} ${fmtMoney(r.amount)}`)
  }

  const postAll = () => {
    for (const info of due) {
      const r = info.recurring
      transactionsCol.add({
        kind: r.kind,
        amount: r.amount,
        categoryId: r.categoryId,
        date: info.dueDate,
        note: r.note,
        createdAt: new Date().toISOString(),
      })
      recurringCol.update(r.id, { lastPosted: info.dueDate })
    }
    toast.success(`已入帳 ${due.length} 筆定期收支`)
  }

  const toggleActive = (r: RecurringTx) =>
    recurringCol.update(r.id, { active: !r.active })

  const remove = async (r: RecurringTx) => {
    const ok = await confirm({
      title: '刪除定期項目？',
      message: '只會刪除呢個範本，已入帳嘅記錄唔受影響。',
      confirmText: '刪除',
      tone: 'danger',
    })
    if (!ok) return
    recurringCol.remove(r.id)
    toast.success('已刪除定期項目')
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* 到期待入帳 */}
      {due.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/60 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
          <div className="mb-3 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-sm font-semibold text-amber-800 dark:text-amber-200">
              <CalendarClock size={16} />
              待入帳（{due.length}）
            </span>
            <Button size="sm" icon={CheckCircle2} onClick={postAll}>
              全部入帳
            </Button>
          </div>
          <ul className="space-y-2">
            {due.map((info) => {
              const r = info.recurring
              const cat = catOf(r.categoryId)
              return (
                <li
                  key={r.id}
                  className="flex items-center gap-3 rounded-lg bg-white/70 p-2.5 dark:bg-slate-800/50"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-base dark:bg-slate-700">
                    {cat?.icon ?? '🏷️'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                      {cat?.name ?? '未分類'}
                      {r.note && <span className="ml-1 text-xs text-slate-400">· {r.note}</span>}
                    </p>
                    <p className="text-xs tabular-nums text-slate-400">
                      應於 {fmtDate(info.dueDate)}
                      {info.overdueDays > 0 && (
                        <span className="ml-1 text-amber-600 dark:text-amber-400">
                          （遲咗 {info.overdueDays} 日）
                        </span>
                      )}
                    </p>
                  </div>
                  <span
                    className={cx(
                      'shrink-0 text-sm font-semibold tabular-nums',
                      r.kind === 'income'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400',
                    )}
                  >
                    {r.kind === 'income' ? '+' : '−'}
                    {fmtMoney(r.amount)}
                  </span>
                  <Button size="sm" variant="secondary" onClick={() => post(info)}>
                    入帳
                  </Button>
                </li>
              )
            })}
          </ul>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <SectionTitle>所有定期項目</SectionTitle>
        <Button
          size="sm"
          icon={Plus}
          onClick={() => {
            setEditing(null)
            setShowForm(true)
          }}
        >
          新增定期
        </Button>
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          icon={Repeat}
          title="仲未有定期收支"
          hint="設定薪金、訂閱、租金等定期收支，到期就可以一鍵入帳，唔使每次手動記。"
          action={
            <Button
              icon={Plus}
              onClick={() => {
                setEditing(null)
                setShowForm(true)
              }}
            >
              新增定期
            </Button>
          }
        />
      ) : (
        <ul className="space-y-2">
          {sorted.map((r) => {
            const cat = catOf(r.categoryId)
            const next = upcomingDue(r)
            const isDue = dueIds.has(r.id)
            return (
              <Card key={r.id} className={cx('group p-3', !r.active && 'opacity-60')}>
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-lg dark:bg-slate-700">
                    {cat?.icon ?? '🏷️'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
                        {cat?.name ?? '未分類'}
                      </span>
                      <Badge tone="blue">{CYCLE_LABEL[r.cycle]}</Badge>
                      {!r.active && <Badge tone="slate">已暫停</Badge>}
                      {isDue && r.active && <Badge tone="amber">待入帳</Badge>}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {r.note && <span>{r.note} · </span>}
                      {r.active ? (
                        <span className="tabular-nums">
                          下次 {fmtDate(next)}
                          {(() => {
                            const d = daysBetween(todayIso(), next)
                            return d > 0 ? `（${d} 日後）` : d === 0 ? '（今日）' : ''
                          })()}
                        </span>
                      ) : (
                        '已暫停'
                      )}
                    </p>
                  </div>
                  <span
                    className={cx(
                      'shrink-0 text-sm font-semibold tabular-nums',
                      r.kind === 'income'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400',
                    )}
                  >
                    {r.kind === 'income' ? '+' : '−'}
                    {fmtMoney(r.amount)}
                  </span>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <IconButton
                      label={r.active ? '暫停' : '啟用'}
                      onClick={() => toggleActive(r)}
                    >
                      {r.active ? <Pause size={16} /> : <Play size={16} />}
                    </IconButton>
                    <IconButton
                      label="編輯"
                      onClick={() => {
                        setEditing(r)
                        setShowForm(true)
                      }}
                    >
                      <Pencil size={16} />
                    </IconButton>
                    <IconButton
                      label="刪除"
                      tone="danger"
                      onClick={() => remove(r)}
                      className="sm:opacity-0 sm:transition sm:group-hover:opacity-100"
                    >
                      <Trash2 size={16} />
                    </IconButton>
                  </div>
                </div>
              </Card>
            )
          })}
        </ul>
      )}

      {showForm && (
        <RecurringFormModal
          key={editing ? `edit-${editing.id}` : 'add'}
          editing={editing}
          cats={cats}
          onClose={() => setShowForm(false)}
          onSaved={(m) => toast.success(m)}
        />
      )}
    </div>
  )
}

function RecurringFormModal({
  editing,
  cats,
  onClose,
  onSaved,
}: {
  editing: RecurringTx | null
  cats: TxCategory[]
  onClose: () => void
  onSaved: (msg: string) => void
}) {
  const [kind, setKind] = useState<TxKind>(editing?.kind ?? 'expense')
  const [amount, setAmount] = useState(editing ? String(editing.amount) : '')
  const [note, setNote] = useState(editing?.note ?? '')
  const [cycle, setCycle] = useState<RecurrenceCycle>(editing?.cycle ?? 'monthly')
  const [startDate, setStartDate] = useState(editing?.startDate ?? todayIso())

  const kindCats = cats.filter((c) => c.kind === kind)
  const [categoryId, setCategoryId] = useState(editing?.categoryId ?? kindCats[0]?.id ?? '')

  const switchKind = (k: TxKind) => {
    setKind(k)
    const next = cats.filter((c) => c.kind === k)
    if (!next.some((c) => c.id === categoryId)) setCategoryId(next[0]?.id ?? '')
  }

  const num = Number(amount)
  const valid = amount !== '' && num > 0 && !!categoryId

  const save = () => {
    if (!valid) return
    const anchorDay = Number(startDate.slice(8, 10))
    if (editing) {
      recurringCol.update(editing.id, {
        kind,
        amount: num,
        categoryId,
        note: note.trim() || undefined,
        cycle,
        anchorDay,
        startDate,
      })
      onSaved('已更新定期項目')
    } else {
      recurringCol.add({
        kind,
        amount: num,
        categoryId,
        note: note.trim() || undefined,
        cycle,
        anchorDay,
        startDate,
        active: true,
        createdAt: new Date().toISOString(),
      })
      onSaved('已新增定期項目')
    }
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? '編輯定期項目' : '新增定期項目'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button onClick={save} disabled={!valid}>
            {editing ? '儲存' : '新增'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Pills options={KIND_PILLS} active={kind} onChange={switchKind} />
        <Field label="金額（HK$）">
          <Input
            value={amount}
            onChange={(e) =>
              setAmount(e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1'))
            }
            placeholder="0.00"
            inputMode="decimal"
          />
        </Field>
        <Field label="分類">
          {kindCats.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 px-3 py-2 text-xs text-slate-400 dark:border-slate-700">
              呢個類型仲未有分類，請先去「分類」頁新增。
            </p>
          ) : (
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {kindCats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon ? `${c.icon} ` : ''}
                  {c.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="週期">
            <Select value={cycle} onChange={(e) => setCycle(e.target.value as RecurrenceCycle)}>
              <option value="weekly">每週</option>
              <option value="biweekly">每兩週</option>
              <option value="monthly">每月</option>
              <option value="yearly">每年</option>
            </Select>
          </Field>
          <Field label="開始日期" hint="由此日起按週期計到期">
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
        </div>
        <Field label="備註（可選）">
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="例如：Netflix、出糧、交租…"
          />
        </Field>
      </div>
    </Modal>
  )
}

// ============================================================
//  新增 / 編輯交易 Modal
// ============================================================
function TxFormModal({
  editing,
  presetKind,
  cats,
  defaultDate,
  onClose,
  onSaved,
}: {
  editing: Transaction | null
  presetKind: TxKind
  cats: TxCategory[]
  defaultDate: string
  onClose: () => void
  onSaved: (msg: string) => void
}) {
  const [kind, setKind] = useState<TxKind>(editing?.kind ?? presetKind)
  const [amount, setAmount] = useState(editing ? String(editing.amount) : '')
  const [date, setDate] = useState(editing?.date ?? defaultDate)
  const [note, setNote] = useState(editing?.note ?? '')

  const kindCats = cats.filter((c) => c.kind === kind)
  const [categoryId, setCategoryId] = useState(editing?.categoryId ?? kindCats[0]?.id ?? '')

  const switchKind = (k: TxKind) => {
    setKind(k)
    const next = cats.filter((c) => c.kind === k)
    if (!next.some((c) => c.id === categoryId)) setCategoryId(next[0]?.id ?? '')
  }

  const amountNum = Number(amount)
  const valid = amount !== '' && amountNum > 0 && !!categoryId

  // 快速金額（常用面額）
  const QUICK = [20, 50, 100, 200, 500]

  const save = () => {
    if (!valid) return
    const payload = {
      kind,
      amount: amountNum,
      categoryId,
      date,
      note: note.trim() || undefined,
    }
    if (editing) {
      transactionsCol.update(editing.id, payload)
      onSaved('已儲存修改')
    } else {
      transactionsCol.add({ ...payload, createdAt: new Date().toISOString() })
      onSaved('已新增記錄')
    }
    onClose()
  }

  return (
    <Modal open onClose={onClose} title={editing ? '編輯記錄' : '記一筆'}>
      <div className="space-y-3">
        <Pills options={KIND_PILLS} active={kind} onChange={switchKind} />

        <Field label="金額（HK$）">
          <Input
            value={amount}
            onChange={(e) =>
              setAmount(e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1'))
            }
            placeholder="0.00"
            inputMode="decimal"
            autoFocus={!editing}
          />
        </Field>
        {!editing && (
          <div className="flex flex-wrap gap-1.5">
            {QUICK.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setAmount(String(q))}
                className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium tabular-nums text-slate-600 transition hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        <Field label="分類">
          {kindCats.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 px-3 py-2 text-xs text-slate-400 dark:border-slate-700">
              呢個類型仲未有分類，請先去「分類」頁新增。
            </p>
          ) : (
            <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-5">
              {kindCats.map((c) => {
                const on = c.id === categoryId
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategoryId(c.id)}
                    className={cx(
                      'flex flex-col items-center gap-1 rounded-xl border px-1 py-2 text-center transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
                      on
                        ? 'border-accent bg-accent-soft dark:bg-accent/15'
                        : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/50',
                    )}
                  >
                    <span className="text-xl">{c.icon ?? '🏷️'}</span>
                    <span
                      className={cx(
                        'w-full truncate text-[10px] leading-tight',
                        on
                          ? 'font-medium text-accent-strong dark:text-accent'
                          : 'text-slate-500 dark:text-slate-400',
                      )}
                    >
                      {c.name}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </Field>

        <Field label="日期">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>

        <Field label="備註（可選）">
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="例如：午餐、出糧…"
          />
        </Field>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button onClick={save} disabled={!valid}>
            {editing ? '儲存修改' : '新增記錄'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ============================================================
//  分類管理（含預算標示）
// ============================================================
function CategoryManager({
  txs,
  cats,
  envelopes,
}: {
  txs: Transaction[]
  cats: TxCategory[]
  envelopes: ReturnType<typeof budgetsCol.get>
}) {
  const toast = useToast()
  const confirm = useConfirm()

  const [name, setName] = useState('')
  const [kind, setKind] = useState<TxKind>('expense')
  const [icon, setIcon] = useState(EMOJI_CHOICES[1])

  const countByCat = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of txs) map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + 1)
    return map
  }, [txs])
  const budgetByCat = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of envelopes) map.set(e.categoryId, e.limit)
    return map
  }, [envelopes])

  const add = () => {
    if (!name.trim()) return
    txCategoriesCol.add({
      name: name.trim(),
      kind,
      icon,
      createdAt: new Date().toISOString(),
    })
    toast.success('已新增分類')
    setName('')
    setIcon(EMOJI_CHOICES[1])
  }

  const remove = async (cat: TxCategory) => {
    const ok = await confirm({
      title: '刪除分類？',
      message: '已用咗呢個分類嘅記錄會變成「未分類」，但唔會被刪。分類嘅預算亦會一併移除。',
      confirmText: '刪除',
      tone: 'danger',
    })
    if (!ok) return
    txCategoriesCol.remove(cat.id)
    if (budgetsCol.get().some((b) => b.id === cat.id)) budgetsCol.remove(cat.id)
    toast.success('已刪除分類')
  }

  const renderSection = (sectionKind: TxKind, title: string) => {
    const list = cats.filter((c) => c.kind === sectionKind)
    return (
      <div>
        <SectionTitle>{title}</SectionTitle>
        {list.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">下面加返個分類就得。</p>
        ) : (
          <Card>
            <ul className="divide-y divide-slate-100 dark:divide-slate-700">
              {list.map((c) => {
                const limit = budgetByCat.get(c.id)
                return (
                  <li key={c.id} className="group flex items-center gap-3 px-4 py-2.5">
                    <span className="text-lg">{c.icon ?? '🏷️'}</span>
                    <span className="flex-1 text-sm text-slate-700 dark:text-slate-200">
                      {c.name}
                    </span>
                    {limit != null && (
                      <Badge tone="accent" icon={Target}>
                        {fmtMoney(limit)}
                      </Badge>
                    )}
                    <span className="text-xs tabular-nums text-slate-400">
                      {countByCat.get(c.id) ?? 0} 筆
                    </span>
                    <IconButton
                      label={`刪除分類 ${c.name}`}
                      tone="danger"
                      onClick={() => remove(c)}
                      className="sm:opacity-0 sm:transition sm:group-hover:opacity-100"
                    >
                      <Trash2 size={16} />
                    </IconButton>
                  </li>
                )
              })}
            </ul>
          </Card>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {renderSection('expense', '支出分類')}
      {renderSection('income', '收入分類')}

      <Separator />

      {/* 新增分類 */}
      <Card className="space-y-3 border-accent/30 bg-accent-soft/40 p-4">
        <SectionTitle>新增分類</SectionTitle>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[140px] flex-1">
            <Field label="名稱">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && add()}
                placeholder="例如：保險"
              />
            </Field>
          </div>
          <div className="w-28">
            <Field label="類型">
              <Select value={kind} onChange={(e) => setKind(e.target.value as TxKind)}>
                <option value="expense">支出</option>
                <option value="income">收入</option>
              </Select>
            </Field>
          </div>
          <Button onClick={add} disabled={!name.trim()}>
            新增
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {EMOJI_CHOICES.map((choice) => (
            <button
              key={choice}
              type="button"
              onClick={() => setIcon(choice)}
              aria-pressed={choice === icon}
              aria-label={`揀 emoji ${choice}`}
              className={cx(
                'flex h-9 w-9 items-center justify-center rounded-xl border text-lg transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
                choice === icon
                  ? 'border-accent bg-accent-soft text-accent-strong'
                  : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700',
              )}
            >
              {choice}
            </button>
          ))}
        </div>
      </Card>
    </div>
  )
}
