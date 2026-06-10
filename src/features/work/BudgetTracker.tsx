import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import './budget/i18n'
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
  Upload,
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
  Textarea,
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
  csvRowsToTx,
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
  parseCsv,
  pruneBudgets,
  recurringCol,
  shiftMonth,
  sortTxDesc,
  todayIso,
  txCsvTemplate,
  txToCsvRows,
  upcomingDue,
  upsertBudget,
  type BudgetRow,
  type Filters,
  type ParsedTx,
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

// KIND_PILLS are built inside component so t() is available

const EMOJI_CHOICES = ['🏷️', '💼', '🍜', '🚇', '🛍️', '🧾', '🎮', '🏠', '💊', '✈️', '📚', '🎁', '☕', '⛽', '🏥']

// ───────── 頂層元件 ─────────
export default function BudgetTracker() {
  const { t } = useTranslation()
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
  const catName = (id: string) => catOf(id)?.name ?? t('budget.uncategorised', { defaultValue: '未分類' })

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
    <div className="space-y-5">
      {/* ───────── 帳本 masthead：serif 標題 + 月份翻揭 + 記一筆 ───────── */}
      <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-accent/70">
            {t('budget.ledgerKicker', { defaultValue: 'Ledger · 流水帳' })}
          </p>
          <h1 className="mt-1 font-serif text-2xl font-semibold leading-tight tracking-tight text-slate-800 dark:text-slate-100 sm:text-[28px]">
            {t('budget.title', { defaultValue: '收支記帳' })}
          </h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
            <span className="tabular-nums">{monthLabel(month)}</span>
            <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">·</span>
            <span className="tabular-nums">
              {t('budget.monthCount', { defaultValue: '本月 {{count}} 筆過帳', count: stats.count })}
            </span>
            {due.length > 0 && tab !== 'recurring' && (
              <>
                <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">·</span>
                <button
                  onClick={() => setTab('recurring')}
                  className="inline-flex items-center gap-1 font-medium text-amber-600 transition hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
                >
                  <CalendarClock size={12} /> {t('budget.dueAlert', { defaultValue: '{{count}} 筆定期待入帳', count: due.length })}
                </button>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-full border border-slate-200/80 bg-white p-0.5 shadow-xs dark:border-slate-700/60 dark:bg-slate-800 dark:shadow-none">
            <IconButton label={t('budget.prevMonth', { defaultValue: '上個月' })} onClick={() => setMonth((m) => shiftMonth(m, -1))}>
              <ChevronLeft size={18} />
            </IconButton>
            <button
              onClick={() => setMonth(monthKey(new Date()))}
              className="min-w-[6.5rem] rounded-full px-2.5 py-1 text-center text-sm font-semibold tabular-nums text-slate-800 transition hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-700"
              title={t('budget.returnToCurrentMonth', { defaultValue: '返回本月' })}
            >
              {monthLabel(month)}
            </button>
            <IconButton label={t('budget.nextMonth', { defaultValue: '下個月' })} onClick={() => setMonth((m) => shiftMonth(m, 1))}>
              <ChevronRight size={18} />
            </IconButton>
          </div>
          <Button icon={Plus} onClick={() => openAdd('expense')}>
            {t('budget.addEntry', { defaultValue: '記一筆' })}
          </Button>
        </div>
      </header>

      {/* ───────── 結餘對帳單（單張帳本身分；ledger 行 + 帳簿側欄） ───────── */}
      <LedgerStatement stats={stats} expenseTrend={expenseTrend} />

      {/* Tabs */}
      <Tabs
        tabs={[
          { id: 'overview', label: t('budget.tabOverview', { defaultValue: '總覽' }) },
          { id: 'list', label: t('budget.tabList', { defaultValue: '記錄' }) },
          { id: 'budgets', label: t('budget.tabBudgets', { defaultValue: '預算' }) },
          { id: 'analysis', label: t('budget.tabAnalysis', { defaultValue: '分析' }) },
          { id: 'recurring', label: t('budget.tabRecurring', { defaultValue: '定期' }) },
          { id: 'categories', label: t('budget.tabCategories', { defaultValue: '分類' }) },
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

// ───────── 結餘對帳單（單張帳本：左頁帳本側欄結餘 + 右頁 ledger 過帳行）─────────
//  概念：一張會計對帳單。左欄係 accent「帳本封皮」印住淨結餘大數；右欄係
//  收入 / 支出 / 儲蓄率三條 ledger 行（leader dots + 右對齊 tabular-nums 金額），
//  最後一條雙底線收結，呼應傳統手寫帳簿嘅「結算」儀式。
function LedgerStatement({
  stats,
  expenseTrend,
}: {
  stats: ReturnType<typeof computeMonthStats>
  expenseTrend?: { value: string; dir: 'up' | 'down' | 'flat' }
}) {
  const { t } = useTranslation()
  const positive = stats.balance >= 0
  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-700/60 dark:bg-slate-800 dark:shadow-none">
      <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,11rem)_1fr]">
        {/* 左頁：帳本封皮 — 淨結餘 */}
        <div className="hero-gradient relative flex flex-col justify-between overflow-hidden p-5 text-white">
          <div className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-white/10 blur-2xl" />
          {/* 帳簿裝訂孔 */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute right-0 top-0 hidden h-full w-px bg-white/20 sm:block"
          />
          <div className="relative flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-wider text-white/75">
              {t('budget.monthBalance', { defaultValue: '本月結餘' })}
            </span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/15 backdrop-blur">
              <Wallet size={15} />
            </span>
          </div>
          <div className="relative mt-6 sm:mt-4">
            <p className="font-serif text-[34px] font-semibold leading-none tabular-nums slashed-zero">
              {fmtMoney(stats.balance)}
            </p>
            <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-medium text-white/90 backdrop-blur">
              {positive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {positive ? t('budget.positive', { defaultValue: '收大於支' }) : t('budget.negative', { defaultValue: '入不敷支' })}
            </p>
          </div>
        </div>

        {/* 右頁：ledger 過帳行 */}
        <dl className="flex flex-col justify-center gap-0.5 p-4 sm:p-5">
          <LedgerLine
            icon={ArrowUpRight}
            tone="emerald"
            label={t('budget.income', { defaultValue: '收入' })}
            amount={`+${fmtMoney(stats.income)}`}
          />
          <LedgerLine
            icon={ArrowDownRight}
            tone="rose"
            label={t('budget.expense', { defaultValue: '支出' })}
            amount={`−${fmtMoney(stats.expense)}`}
            trend={expenseTrend}
            note={stats.count > 0 ? t('budget.entryCount', { defaultValue: '{{count}} 筆', count: stats.count }) : undefined}
          />
          <LedgerLine
            icon={Sparkles}
            tone="accent"
            label={t('budget.savingsRate', { defaultValue: '儲蓄率' })}
            amount={stats.savingsRate == null ? '—' : `${stats.savingsRate}%`}
            note={stats.savingsRate == null ? t('budget.savingsRateHint', { defaultValue: '記低收支即計' }) : t('budget.savingsRateNote', { defaultValue: '收入用剩' })}
            ruled
          />
        </dl>
      </div>
    </section>
  )
}

type LineTone = 'rose' | 'emerald' | 'accent'
const LINE_CHIP: Record<LineTone, string> = {
  rose: 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300',
  emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
  accent: 'bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent',
}
const LINE_AMOUNT: Record<LineTone, string> = {
  rose: 'text-rose-600 dark:text-rose-400',
  emerald: 'text-emerald-600 dark:text-emerald-400',
  accent: 'text-slate-800 dark:text-slate-100',
}
// 單條 ledger 行：icon chip · 標籤 · leader dots（撐開）· 右對齊金額。
// ruled=true 時上方加雙底線（帳簿結算線），標示「最後一行」。
function LedgerLine({
  icon: Icon,
  tone,
  label,
  amount,
  note,
  trend,
  ruled = false,
}: {
  icon: LucideIcon
  tone: LineTone
  label: string
  amount: string
  note?: string
  trend?: { value: string; dir: 'up' | 'down' | 'flat' }
  ruled?: boolean
}) {
  return (
    <div
      className={cx(
        'flex items-center gap-3 py-2.5',
        ruled && 'mt-0.5 border-t-2 border-double border-slate-200 pt-3 dark:border-slate-700',
      )}
    >
      <span className={cx('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', LINE_CHIP[tone])}>
        <Icon size={15} aria-hidden="true" />
      </span>
      <dt className="shrink-0 text-sm font-medium text-slate-600 dark:text-slate-300">
        {label}
        {note && <span className="ml-1.5 text-xs font-normal text-slate-400">· {note}</span>}
      </dt>
      {/* leader dots：手寫帳本嗰種「……」對齊線 */}
      <span
        aria-hidden="true"
        className="mt-2 min-w-[1.5rem] flex-1 self-end border-b border-dotted border-slate-200 dark:border-slate-700"
      />
      <dd className="flex shrink-0 items-baseline gap-1.5">
        {trend && trend.dir !== 'flat' && (
          <span
            className={cx(
              'inline-flex items-center gap-0.5 text-[11px] font-semibold tabular-nums',
              trend.dir === 'up' ? 'text-rose-500' : 'text-emerald-500',
            )}
          >
            {trend.dir === 'up' ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {trend.value}
          </span>
        )}
        <span className={cx('font-serif text-lg font-semibold tabular-nums slashed-zero', LINE_AMOUNT[tone])}>
          {amount}
        </span>
      </dd>
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
  const { t } = useTranslation()
  const cells = useMemo(() => dailyBreakdown(monthTxs, month), [monthTxs, month])
  const todayDay =
    month === monthKey(new Date()) ? Number(todayIso().slice(8, 10)) : null

  const donutSegs = expenseCats.slice(0, 7).map((row, i) => ({
    label: catOf(row.categoryId)?.name ?? t('budget.uncategorised', { defaultValue: '未分類' }),
    value: row.amount,
    color: SLICE_HEX[i % SLICE_HEX.length],
  }))

  const recent = monthTxs.slice(0, 5)

  if (stats.count === 0)
    return (
      <div className="animate-fade-in">
        <EmptyState
          icon={Receipt}
          title={t('budget.emptyTitle', { defaultValue: '呢個月暫時冇記錄' })}
          hint={t('budget.emptyHint', { defaultValue: '撳「記一筆」開始記低你嘅收支，總覽會即時計出分類佔比、預算同每日走勢。' })}
          action={
            <div className="flex gap-2">
              <Button icon={Plus} onClick={() => onAdd('expense')}>
                {t('budget.addExpense', { defaultValue: '記支出' })}
              </Button>
              <Button variant="secondary" icon={Plus} onClick={() => onAdd('income')}>
                {t('budget.addIncome', { defaultValue: '記收入' })}
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
            {t('budget.dueCard', { defaultValue: '有 {{count}} 筆定期收支到期未入帳', count: due.length })}
          </p>
          <Button size="sm" variant="secondary" onClick={onGoRecurring}>
            {t('budget.goHandle', { defaultValue: '前往處理' })}
          </Button>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* 分類佔比 */}
        <Card className="rounded-2xl p-4">
          <SectionTitle icon={PieChart}>{t('budget.categoryBreakdown', { defaultValue: '本月支出分類' })}</SectionTitle>
          {donutSegs.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
              {t('budget.noExpenseYet', { defaultValue: '今個月仲未有支出記錄。' })}
            </p>
          ) : (
            <CategoryDonut
              segments={donutSegs}
              centerValue={fmtMoney(stats.expense).replace('HK$', '')}
              centerLabel={t('budget.centerLabel', { defaultValue: '本月支出' })}
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
                {t('budget.manage', { defaultValue: '管理' })}
              </button>
            }
          >
            {t('budget.budgetOverview', { defaultValue: '預算狀況' })}
          </SectionTitle>
          {bRows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400">{t('budget.noBudgetYet', { defaultValue: '仲未為分類設預算。' })}</p>
              <Button size="sm" variant="secondary" icon={Target} onClick={onGoBudgets}>
                {t('budget.setBudget', { defaultValue: '設定分類預算' })}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600 dark:text-slate-300">
                  {t('budget.totalBudgetUsed', { defaultValue: '總預算用咗' })}{' '}
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
                            {cat?.icon ?? '🏷️'} {cat?.name ?? t('budget.uncategorised', { defaultValue: '未分類' })}
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
              {t('budget.dailyAvgLabel', { defaultValue: '日均 {{amount}}', amount: fmtMoney(stats.dailyAvg) })}
            </span>
          }
        >
          {t('budget.dailySpend', { defaultValue: '本月每日支出' })}
        </SectionTitle>
        <DailySpendChart cells={cells} todayDay={todayDay} />
        {todayDay != null && stats.projectedExpense > stats.expense && (
          <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
            <Sparkles size={13} className="text-accent" />
            {t('budget.projectionNote', { defaultValue: '按目前速度，本月底支出預計約' })}{' '}
            <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">
              {fmtMoney(stats.projectedExpense)}
            </span>
            {prevExpense > 0 && (
              <span className="tabular-nums">
                {t('budget.prevMonthNote', { defaultValue: '（上月 {{amount}}）', amount: fmtMoney(prevExpense) })}
              </span>
            )}
          </p>
        )}
      </Card>

      {/* 最近交易（收據樣式：serif 抬頭 + leader 行 + 鋸齒底邊） */}
      <Card className="rounded-2xl p-4">
        <SectionTitle icon={Receipt}>{t('budget.recentTransactions', { defaultValue: '最近交易' })}</SectionTitle>
        <ul className="divide-y divide-dashed divide-slate-200/80 dark:divide-slate-700/60">
          {recent.map((tx) => {
            const cat = catOf(tx.categoryId)
            const income = tx.kind === 'income'
            return (
              <li
                key={tx.id}
                className="flex items-center gap-3 py-2 text-sm"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-base dark:bg-slate-700/60">
                  {cat?.icon ?? '🏷️'}
                </span>
                <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-200">
                  {cat?.name ?? t('budget.uncategorised', { defaultValue: '未分類' })}
                  {tx.note && <span className="ml-1.5 text-xs text-slate-400">· {tx.note}</span>}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-slate-400">
                  {fmtDate(tx.date)}
                </span>
                <span
                  className={cx(
                    'shrink-0 font-serif text-[15px] font-semibold tabular-nums slashed-zero',
                    income
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400',
                  )}
                >
                  {income ? '+' : '−'}
                  {fmtMoney(tx.amount)}
                </span>
              </li>
            )
          })}
        </ul>
        {/* 鋸齒收據底邊 */}
        <div
          aria-hidden="true"
          className="-mx-4 -mb-4 mt-2 h-2.5 bg-[radial-gradient(circle_at_6px_-2px,transparent_5px,white_5px)] bg-[length:12px_10px] bg-repeat-x dark:bg-[radial-gradient(circle_at_6px_-2px,transparent_5px,theme(colors.slate.800)_5px)]"
        />
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
  const { t } = useTranslation()
  const toast = useToast()
  const confirm = useConfirm()
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [showFilter, setShowFilter] = useState(false)
  const [showImport, setShowImport] = useState(false)
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
      title: t('budget.confirmBulkDeleteTitle', { defaultValue: '刪除 {{count}} 筆記錄？', count: selected.size }),
      message: t('budget.confirmBulkDeleteMessage', { defaultValue: '揀咗嘅收支記錄會永久移除，無法復原。' }),
      confirmText: t('budget.confirmBulkDeleteConfirm', { defaultValue: '刪除' }),
      tone: 'danger',
    })
    if (!ok) return
    for (const id of selected) transactionsCol.remove(id)
    toast.success(t('budget.bulkDeletedToast', { defaultValue: '已刪除 {{count}} 筆記錄', count: selected.size }))
    setSelected(new Set())
  }

  const removeOne = async (tx: Transaction) => {
    const ok = await confirm({
      title: t('budget.confirmDeleteOneTitle', { defaultValue: '刪除記錄？' }),
      message: t('budget.confirmDeleteOneMessage', { defaultValue: '此筆收支記錄將永久移除，無法復原。' }),
      confirmText: t('budget.confirmDeleteOneConfirm', { defaultValue: '刪除' }),
      tone: 'danger',
    })
    if (!ok) return
    transactionsCol.remove(tx.id)
    toast.success(t('budget.deletedOneToast', { defaultValue: '已刪除記錄' }))
  }

  const exportCsv = () => {
    if (visible.length === 0) return
    downloadCsv(`收支_${monthTxs[0]?.date.slice(0, 7) ?? 'export'}.csv`, txToCsvRows(visible, cats))
    toast.success(t('budget.exportedCsvToast', { defaultValue: '已匯出 CSV' }))
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
            placeholder={t('budget.searchPlaceholder', { defaultValue: '搜尋備註 / 分類…' })}
          />
        </div>
        <IconButton
          label={t('budget.advancedFilter', { defaultValue: '進階篩選' })}
          active={showFilter || active}
          onClick={() => setShowFilter((v) => !v)}
        >
          <Filter size={18} />
        </IconButton>
        <IconButton label={t('budget.importCsv', { defaultValue: '匯入 CSV' })} onClick={() => setShowImport(true)}>
          <Upload size={18} />
        </IconButton>
        <IconButton label={t('budget.exportCsv', { defaultValue: '匯出 CSV' })} onClick={exportCsv} disabled={visible.length === 0}>
          <Download size={18} />
        </IconButton>
      </div>

      {showImport && (
        <ImportTxModal cats={cats} catName={catName} onClose={() => setShowImport(false)} />
      )}

      {/* 快速 kind pills */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Pills
          options={[
            { id: 'all', label: t('budget.filterAll', { defaultValue: '全部' }) },
            { id: 'income', label: t('budget.filterIncome', { defaultValue: '收入' }) },
            { id: 'expense', label: t('budget.filterExpense', { defaultValue: '支出' }) },
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
            <X size={12} /> {t('budget.clearFilter', { defaultValue: '清除篩選' })}
          </button>
        )}
      </div>

      {/* 進階篩選展開 */}
      {showFilter && (
        <Card className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3 animate-fade-in">
          <Field label={t('budget.filterCategory', { defaultValue: '分類' })}>
            <Select
              value={filters.categoryId}
              onChange={(e) => setFilters((f) => ({ ...f, categoryId: e.target.value }))}
            >
              <option value="">{t('budget.filterAllCategories', { defaultValue: '全部分類' })}</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon ? `${c.icon} ` : ''}
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('budget.filterMinAmount', { defaultValue: '最低金額' })}>
            <Input
              inputMode="decimal"
              value={filters.min ?? ''}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  min: e.target.value === '' ? null : Number(e.target.value.replace(/[^0-9.]/g, '')),
                }))
              }
              placeholder={t('budget.filterNoLimit', { defaultValue: '不限' })}
            />
          </Field>
          <Field label={t('budget.filterMaxAmount', { defaultValue: '最高金額' })}>
            <Input
              inputMode="decimal"
              value={filters.max ?? ''}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  max: e.target.value === '' ? null : Number(e.target.value.replace(/[^0-9.]/g, '')),
                }))
              }
              placeholder={t('budget.filterNoLimit', { defaultValue: '不限' })}
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
            {selected.size > 0 ? t('budget.selectedCount', { defaultValue: '已揀 {{count}} 筆', count: selected.size }) : t('budget.selectAll', { defaultValue: '全選（{{count}}）', count: visible.length })}
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
            {t('budget.selectedCount', { defaultValue: '已揀 {{count}} 筆', count: selected.size })}
          </span>
          <Button size="sm" variant="danger" icon={Trash2} onClick={bulkDelete} className="ml-auto">
            {t('budget.bulkDelete', { defaultValue: '刪除' })}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            {t('budget.cancelSelection', { defaultValue: '取消' })}
          </Button>
        </div>
      )}

      {/* 列表 */}
      {visible.length === 0 ? (
        active ? (
          <EmptyState icon={Search} title={t('budget.noFilterResults', { defaultValue: '冇符合篩選嘅記錄' })} hint={t('budget.noFilterHint', { defaultValue: '試吓放寬條件或清除篩選。' })} />
        ) : (
          <EmptyState
            icon={Receipt}
            title={t('budget.noRecordsTitle', { defaultValue: '呢個月暫時冇記錄' })}
            hint={t('budget.noRecordsHint', { defaultValue: '撳「記一筆」開始記低你嘅收支。' })}
            action={<Button icon={Plus} onClick={onAdd}>{t('budget.addEntryBtn', { defaultValue: '記一筆' })}</Button>}
          />
        )
      ) : (
        <ul className="space-y-1.5">
          {visible.map((tx, i) => {
            const cat = catOf(tx.categoryId)
            const income = tx.kind === 'income'
            const checked = selected.has(tx.id)
            return (
              <li
                key={tx.id}
                className={cx(
                  'group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-slate-200/80 bg-white py-2.5 pl-3 pr-3.5 transition duration-200 animate-fade-in-up hover:border-slate-300 hover:shadow-md dark:border-slate-700/60 dark:bg-slate-800 dark:hover:border-slate-600',
                  checked && 'border-accent/40 ring-1 ring-accent/30',
                )}
                style={{ animationDelay: `${Math.min(i, 10) * 25}ms` }}
              >
                {/* 收支色帶（收據左緣） */}
                <span
                  aria-hidden="true"
                  className={cx(
                    'absolute inset-y-0 left-0 w-1',
                    income ? 'bg-emerald-400/80 dark:bg-emerald-500/70' : 'bg-rose-400/80 dark:bg-rose-500/70',
                  )}
                />
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(tx.id)}
                  className="ml-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 text-accent focus:ring-accent/40 dark:border-slate-600 dark:bg-slate-700"
                  aria-label={t('budget.selectRecord', { defaultValue: '揀選記錄' })}
                />
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-lg dark:bg-slate-700/60">
                  {cat?.icon ?? '🏷️'}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
                      {cat?.name ?? t('budget.uncategorised', { defaultValue: '未分類' })}
                    </span>
                    {!cat && <Badge tone="slate">{t('budget.uncategorised', { defaultValue: '未分類' })}</Badge>}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                    {tx.note && (
                      <span className="truncate text-slate-500 dark:text-slate-400">{tx.note}</span>
                    )}
                    <span className="tabular-nums text-slate-400">{fmtDate(tx.date)}</span>
                  </div>
                </div>
                <span
                  className={cx(
                    'ml-auto shrink-0 font-serif text-[15px] font-semibold tabular-nums slashed-zero',
                    income
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400',
                  )}
                >
                  {income ? '+' : '−'}
                  {fmtMoney(tx.amount)}
                </span>
                <div className="flex shrink-0 items-center gap-0.5">
                  <IconButton label={t('budget.editRecord', { defaultValue: '編輯記錄' })} onClick={() => onEdit(tx)}>
                    <Pencil size={16} />
                  </IconButton>
                  <IconButton
                    label={t('budget.deleteRecord', { defaultValue: '刪除記錄' })}
                    tone="danger"
                    onClick={() => removeOne(tx)}
                    className="sm:opacity-0 sm:transition sm:group-hover:opacity-100"
                  >
                    <Trash2 size={16} />
                  </IconButton>
                </div>
              </li>
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
  const { t } = useTranslation()
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
                <p className="text-xs text-slate-500 dark:text-slate-400">{t('budget.totalBudgetThisMonth', { defaultValue: '本月總預算' })}</p>
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
                {bSummary.remaining < 0 ? t('budget.over', { defaultValue: '超支 ' }) : t('budget.remaining', { defaultValue: '剩 ' })}
                {fmtMoney(Math.abs(bSummary.remaining))}
              </p>
              {bSummary.overCount > 0 && (
                <Badge tone="rose" className="mt-1">
                  {t('budget.overBudgetCategories', { defaultValue: '{{count}} 個分類超支', count: bSummary.overCount })}
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
              {t('budget.budgetNote', { defaultValue: '註：預算上限為固定設定，呢度顯示 {{month}} 嘅實際使用情況。', month: monthLabel(month) })}
            </p>
          )}
        </Card>
      )}

      {/* 已設預算 */}
      {bRows.length === 0 ? (
        <EmptyState
          icon={Target}
          title={t('budget.noBudgetsTitle', { defaultValue: '仲未設分類預算' })}
          hint={t('budget.noBudgetsHint', { defaultValue: '為支出分類設定每月上限，就可以追蹤超支同剩餘。揀下面任何一個分類開始。' })}
        />
      ) : (
        <div className="space-y-2">
          <SectionTitle>{t('budget.categoryBudgets', { defaultValue: '分類預算' })}</SectionTitle>
          {bRows.map((r) => {
            const cat = catOf(r.categoryId)
            return (
              <Card key={r.categoryId} hover className="p-3.5">
                <button
                  type="button"
                  onClick={() => cat && setEditCat(cat)}
                  aria-label={t('budget.editBudgetAriaLabel', { defaultValue: '編輯 {{name}} 預算', name: cat?.name ?? t('budget.uncategorised', { defaultValue: '未分類' }) })}
                  className="flex w-full items-center gap-3 rounded-lg text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                >
                  <BudgetRing pct={r.pct} over={r.status === 'over'} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-sm font-medium text-slate-800 dark:text-slate-100">
                        <span>{cat?.icon ?? '🏷️'}</span>
                        {cat?.name ?? t('budget.uncategorised', { defaultValue: '未分類' })}
                        {r.rollover && (
                          <Badge tone="slate" className="ml-1">
                            {t('budget.rolloverBadge', { defaultValue: '結轉' })}
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
                      <span className="tabular-nums text-slate-400">{t('budget.pctUsed', { defaultValue: '{{pct}}% 已用', pct: r.pct })}</span>
                      <span
                        className={cx(
                          'tabular-nums',
                          r.remaining < 0
                            ? 'text-rose-500'
                            : 'text-slate-400',
                        )}
                      >
                        {r.remaining < 0
                          ? t('budget.overAmount', { defaultValue: '超 {{amount}}', amount: fmtMoney(-r.remaining) })
                          : t('budget.remainingAmount', { defaultValue: '剩 {{amount}}', amount: fmtMoney(r.remaining) })}
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
          <SectionTitle>{t('budget.unbudgetedSection', { defaultValue: '未設預算' })}</SectionTitle>
          <Card>
            <ul className="divide-y divide-slate-100 dark:divide-slate-700">
              {unbudgeted.map((c) => (
                <li key={c.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="text-lg">{c.icon ?? '🏷️'}</span>
                  <span className="flex-1 text-sm text-slate-700 dark:text-slate-200">{c.name}</span>
                  <Button size="sm" variant="secondary" icon={Plus} onClick={() => setEditCat(c)}>
                    {t('budget.setBudgetBtn', { defaultValue: '設預算' })}
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
  const { t } = useTranslation()
  const [limit, setLimit] = useState(existing ? String(existing.limit) : '')
  const [rollover, setRollover] = useState(existing?.rollover ?? false)
  const num = Number(limit)
  const valid = limit !== '' && num > 0

  const save = () => {
    if (!valid) return
    upsertBudget(cat.id, num, rollover)
    onSaved(existing ? t('budget.budgetUpdatedToast', { defaultValue: '已更新預算' }) : t('budget.budgetCreatedToast', { defaultValue: '已設定預算' }))
    onClose()
  }
  const clear = () => {
    upsertBudget(cat.id, 0, false)
    onSaved(t('budget.budgetRemovedToast', { defaultValue: '已移除預算' }))
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      footer={
        <>
          {existing && (
            <Button variant="ghost" onClick={clear} className="mr-auto text-rose-600">
              {t('budget.removeBudget', { defaultValue: '移除預算' })}
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            {t('budget.cancel', { defaultValue: '取消' })}
          </Button>
          <Button onClick={save} disabled={!valid}>
            {existing ? t('budget.updateLimit', { defaultValue: '更新上限' }) : t('budget.createBudget', { defaultValue: '立此預算' })}
          </Button>
        </>
      }
    >
      {/* 信封抬頭：kicker + 分類 emoji + serif 名（呼應帳本 / 預算信封語言） */}
      <header className="-mx-5 -mt-5 mb-4 flex items-center gap-3 border-b border-dashed border-slate-200/90 px-5 pb-3.5 dark:border-slate-700/70 sm:-mx-6 sm:-mt-6 sm:px-6">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-lg dark:bg-accent/15">
          {cat.icon ?? '🏷️'}
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.3em] text-accent/70">
            {t('budget.envelopeKicker', { defaultValue: 'Envelope · 預算信封' })}
          </p>
          <h3 className="mt-0.5 truncate font-serif text-lg font-semibold leading-tight text-slate-800 dark:text-slate-100">
            {cat.name}
          </h3>
        </div>
      </header>

      <div className="space-y-3.5">
        <Field label={t('budget.monthlyLimit', { defaultValue: '每月上限（HK$）' })}>
          {/* 帳本式上限輸入：固定 HK$ 前綴 + 大 serif 數字 */}
          <div className="flex items-baseline gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 transition focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/30 dark:border-slate-700 dark:bg-slate-900/40">
            <span
              className="font-serif text-base font-semibold text-slate-400 dark:text-slate-500"
              aria-hidden="true"
            >
              HK$
            </span>
            <input
              value={limit}
              onChange={(e) =>
                setLimit(e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1'))
              }
              placeholder="3,000"
              inputMode="decimal"
              autoFocus
              aria-label={t('budget.monthlyLimitAriaLabel', { defaultValue: '每月上限' })}
              className="w-full bg-transparent font-serif text-2xl font-semibold leading-none tabular-nums slashed-zero text-slate-800 outline-none placeholder:text-slate-300 dark:text-slate-100 dark:placeholder:text-slate-600"
            />
          </div>
        </Field>
        <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-slate-200 bg-white p-3 transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600">
          <input
            type="checkbox"
            checked={rollover}
            onChange={(e) => setRollover(e.target.checked)}
            className="mt-0.5 h-4 w-4 cursor-pointer rounded border-slate-300 text-accent focus:ring-accent/40 dark:border-slate-600 dark:bg-slate-700"
          />
          <span>
            <span className="block text-sm font-medium text-slate-700 dark:text-slate-200">
              {t('budget.rolloverLabel', { defaultValue: '結轉至下月' })}
            </span>
            <span className="block text-xs text-slate-400">
              {t('budget.rolloverHint', { defaultValue: '用剩 / 超支會喺概念上帶落下個月（標示用）。' })}
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
  const { t } = useTranslation()
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
                { id: '6', label: t('budget.months6', { defaultValue: '6 個月' }) },
                { id: '12', label: t('budget.months12', { defaultValue: '12 個月' }) },
              ]}
            />
          }
        >
          {t('budget.cashflowTrend', { defaultValue: '收支趨勢' })}
        </SectionTitle>
        <CashflowBars rows={trend} />
      </Card>

      {/* 淨結餘走勢 */}
      <Card className="rounded-2xl p-4">
        <SectionTitle icon={Wallet}>{t('budget.netBalance', { defaultValue: '每月淨結餘' })}</SectionTitle>
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
                  { id: 'expense', label: t('budget.analysisExpense', { defaultValue: '支出' }) },
                  { id: 'income', label: t('budget.analysisIncome', { defaultValue: '收入' }) },
                ]}
              />
            }
          >
            {t('budget.categoryBreakdownAnalysis', { defaultValue: '本月{{kind}}分類', kind: kind === 'expense' ? t('budget.expenseKind', { defaultValue: '支出' }) : t('budget.incomeKind', { defaultValue: '收入' }) })}
          </SectionTitle>
          {catStats.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
              {kind === 'expense' ? t('budget.noExpenseCats', { defaultValue: '今個月仲未有支出記錄。' }) : t('budget.noIncomeCats', { defaultValue: '今個月仲未有收入記錄。' })}
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
                        {cat?.name ?? t('budget.uncategorised', { defaultValue: '未分類' })}
                        <span className="text-slate-400">· {t('budget.entryCount', { defaultValue: '{{count}} 筆', count: row.count })}</span>
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
          <SectionTitle icon={TrendingDown}>{t('budget.spendingHeatmap', { defaultValue: '本月消費熱力' })}</SectionTitle>
          <SpendingHeatmap cells={dailyBreakdown(monthTxs, month)} />
        </Card>
      </div>

      {/* 統計摘要 */}
      <Card className="rounded-2xl p-4">
        <SectionTitle icon={Sparkles}>{t('budget.monthlyStats', { defaultValue: '本月數據' })}</SectionTitle>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          <Stat label={t('budget.statDailyAvg', { defaultValue: '日均支出' })} value={fmtMoney(stats.dailyAvg)} />
          <Stat label={t('budget.statTopExpense', { defaultValue: '最大單筆' })} value={fmtMoney(stats.topExpense)} />
          <Stat
            label={t('budget.statProjected', { defaultValue: '月底預測' })}
            value={fmtMoney(stats.projectedExpense)}
            hint={month === monthKey(new Date()) ? t('budget.statProjectedHint', { defaultValue: '按目前速度' }) : t('budget.statProjectedActual', { defaultValue: '實際' })}
          />
          <Stat
            label={t('budget.statSavingsRate', { defaultValue: '儲蓄率' })}
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
  const { t } = useTranslation()
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
    toast.success(t('budget.postedToast', { defaultValue: '已入帳：{{name}} {{amount}}', name: catName(r.categoryId), amount: fmtMoney(r.amount) }))
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
    toast.success(t('budget.postedAllToast', { defaultValue: '已入帳 {{count}} 筆定期收支', count: due.length }))
  }

  const toggleActive = (r: RecurringTx) =>
    recurringCol.update(r.id, { active: !r.active })

  const remove = async (r: RecurringTx) => {
    const ok = await confirm({
      title: t('budget.confirmDeleteRecurringTitle', { defaultValue: '刪除定期項目？' }),
      message: t('budget.confirmDeleteRecurringMessage', { defaultValue: '只會刪除呢個範本，已入帳嘅記錄唔受影響。' }),
      confirmText: t('budget.confirmDeleteRecurringConfirm', { defaultValue: '刪除' }),
      tone: 'danger',
    })
    if (!ok) return
    recurringCol.remove(r.id)
    toast.success(t('budget.deletedRecurringToast', { defaultValue: '已刪除定期項目' }))
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* 到期待入帳 */}
      {due.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/60 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
          <div className="mb-3 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-sm font-semibold text-amber-800 dark:text-amber-200">
              <CalendarClock size={16} />
              {t('budget.pendingHeader', { defaultValue: '待入帳（{{count}}）', count: due.length })}
            </span>
            <Button size="sm" icon={CheckCircle2} onClick={postAll}>
              {t('budget.postAll', { defaultValue: '全部入帳' })}
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
                      {cat?.name ?? t('budget.uncategorised', { defaultValue: '未分類' })}
                      {r.note && <span className="ml-1 text-xs text-slate-400">· {r.note}</span>}
                    </p>
                    <p className="text-xs tabular-nums text-slate-400">
                      {t('budget.dueOn', { defaultValue: '應於 {{date}}', date: fmtDate(info.dueDate) })}
                      {info.overdueDays > 0 && (
                        <span className="ml-1 text-amber-600 dark:text-amber-400">
                          {t('budget.overdueBy', { defaultValue: '（遲咗 {{days}} 日）', days: info.overdueDays })}
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
                    {t('budget.postOne', { defaultValue: '入帳' })}
                  </Button>
                </li>
              )
            })}
          </ul>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <SectionTitle>{t('budget.allRecurringSection', { defaultValue: '所有定期項目' })}</SectionTitle>
        <Button
          size="sm"
          icon={Plus}
          onClick={() => {
            setEditing(null)
            setShowForm(true)
          }}
        >
          {t('budget.addRecurring', { defaultValue: '新增定期' })}
        </Button>
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          icon={Repeat}
          title={t('budget.noRecurringTitle', { defaultValue: '仲未有定期收支' })}
          hint={t('budget.noRecurringHint', { defaultValue: '設定薪金、訂閱、租金等定期收支，到期就可以一鍵入帳，唔使每次手動記。' })}
          action={
            <Button
              icon={Plus}
              onClick={() => {
                setEditing(null)
                setShowForm(true)
              }}
            >
              {t('budget.addRecurring', { defaultValue: '新增定期' })}
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
                        {cat?.name ?? t('budget.uncategorised', { defaultValue: '未分類' })}
                      </span>
                      <Badge tone="blue">{CYCLE_LABEL[r.cycle]}</Badge>
                      {!r.active && <Badge tone="slate">{t('budget.pausedBadge', { defaultValue: '已暫停' })}</Badge>}
                      {isDue && r.active && <Badge tone="amber">{t('budget.dueBadge', { defaultValue: '待入帳' })}</Badge>}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {r.note && <span>{r.note} · </span>}
                      {r.active ? (
                        <span className="tabular-nums">
                          {t('budget.nextDue', { defaultValue: '下次 {{date}}', date: fmtDate(next) })}
                          {(() => {
                            const d = daysBetween(todayIso(), next)
                            return d > 0 ? t('budget.daysLater', { defaultValue: '（{{days}} 日後）', days: d }) : d === 0 ? t('budget.today', { defaultValue: '（今日）' }) : ''
                          })()}
                        </span>
                      ) : (
                        t('budget.pausedStatus', { defaultValue: '已暫停' })
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
                      label={r.active ? t('budget.pauseBtn', { defaultValue: '暫停' }) : t('budget.resumeBtn', { defaultValue: '啟用' })}
                      onClick={() => toggleActive(r)}
                    >
                      {r.active ? <Pause size={16} /> : <Play size={16} />}
                    </IconButton>
                    <IconButton
                      label={t('budget.editBtn', { defaultValue: '編輯' })}
                      onClick={() => {
                        setEditing(r)
                        setShowForm(true)
                      }}
                    >
                      <Pencil size={16} />
                    </IconButton>
                    <IconButton
                      label={t('budget.deleteBtn', { defaultValue: '刪除' })}
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
  const { t } = useTranslation()
  const KIND_PILLS: { id: TxKind; label: string }[] = [
    { id: 'expense', label: t('budget.filterExpense', { defaultValue: '支出' }) },
    { id: 'income', label: t('budget.filterIncome', { defaultValue: '收入' }) },
  ]
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
      onSaved(t('budget.updatedRecurringToast', { defaultValue: '已更新定期項目' }))
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
      onSaved(t('budget.addedRecurringToast', { defaultValue: '已新增定期項目' }))
    }
    onClose()
  }

  const income = kind === 'income'

  return (
    <Modal
      open
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('budget.cancel', { defaultValue: '取消' })}
          </Button>
          <Button onClick={save} disabled={!valid}>
            {editing ? t('budget.saveBtn', { defaultValue: '儲存' }) : t('budget.addBtn', { defaultValue: '新增' })}
          </Button>
        </>
      }
    >
      {/* 定期收支抬頭：kicker + serif 標題（呼應帳本語言，標示自動入帳範本） */}
      <header className="-mx-5 -mt-5 mb-4 border-b border-dashed border-slate-200/90 px-5 pb-3.5 dark:border-slate-700/70 sm:-mx-6 sm:-mt-6 sm:px-6">
        <p className="text-[10px] font-medium uppercase tracking-[0.3em] text-accent/70">
          {t('budget.recurringKicker', { defaultValue: 'Standing order · 定期' })}
        </p>
        <h3 className="mt-1 flex items-center gap-2 font-serif text-lg font-semibold leading-tight text-slate-800 dark:text-slate-100">
          <Repeat size={17} className="text-accent" aria-hidden="true" />
          {editing ? t('budget.editRecurringTitle', { defaultValue: '編輯定期項目' }) : t('budget.addRecurringTitle', { defaultValue: '新增定期項目' })}
        </h3>
      </header>

      <div className="space-y-3">
        <Pills options={KIND_PILLS} active={kind} onChange={switchKind} />
        <Field label={t('budget.amountField', { defaultValue: '金額（HK$）' })}>
          <div
            className={cx(
              'flex items-baseline gap-2 rounded-xl border bg-slate-50/70 px-3.5 py-2.5 transition focus-within:ring-2 focus-within:ring-accent/30 dark:bg-slate-900/40',
              income
                ? 'border-emerald-200/80 focus-within:border-emerald-400 dark:border-emerald-500/30'
                : 'border-rose-200/80 focus-within:border-rose-400 dark:border-rose-500/30',
            )}
          >
            <span
              className={cx(
                'font-serif text-2xl font-semibold leading-none tabular-nums',
                income ? 'text-emerald-500 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400',
              )}
              aria-hidden="true"
            >
              {income ? '+' : '−'}
            </span>
            <input
              value={amount}
              onChange={(e) =>
                setAmount(e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1'))
              }
              placeholder="0.00"
              inputMode="decimal"
              aria-label={t('budget.amountAriaLabel', { defaultValue: '金額' })}
              className={cx(
                'w-full bg-transparent font-serif text-2xl font-semibold leading-none tabular-nums slashed-zero outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600',
                income ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300',
              )}
            />
          </div>
        </Field>
        <Field label={t('budget.categoryField', { defaultValue: '分類' })}>
          {kindCats.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 px-3 py-2 text-xs text-slate-400 dark:border-slate-700">
              {t('budget.noCategoryMsg', { defaultValue: '呢個類型仲未有分類，請先去「分類」頁新增。' })}
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
          <Field label={t('budget.cycleField', { defaultValue: '週期' })}>
            <Select value={cycle} onChange={(e) => setCycle(e.target.value as RecurrenceCycle)}>
              <option value="weekly">{t('budget.cycleWeekly', { defaultValue: '每週' })}</option>
              <option value="biweekly">{t('budget.cycleBiweekly', { defaultValue: '每兩週' })}</option>
              <option value="monthly">{t('budget.cycleMonthly', { defaultValue: '每月' })}</option>
              <option value="yearly">{t('budget.cycleYearly', { defaultValue: '每年' })}</option>
            </Select>
          </Field>
          <Field label={t('budget.startDateField', { defaultValue: '開始日期' })} hint={t('budget.startDateHint', { defaultValue: '由此日起按週期計到期' })}>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
        </div>
        <Field label={t('budget.noteField', { defaultValue: '備註（可選）' })}>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('budget.notePlaceholder', { defaultValue: '例如：Netflix、出糧、交租…' })}
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
  const { t } = useTranslation()
  const KIND_PILLS: { id: TxKind; label: string }[] = [
    { id: 'expense', label: t('budget.filterExpense', { defaultValue: '支出' }) },
    { id: 'income', label: t('budget.filterIncome', { defaultValue: '收入' }) },
  ]
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

  const income = kind === 'income'

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
      onSaved(t('budget.savedTxToast', { defaultValue: '已儲存修改' }))
    } else {
      transactionsCol.add({ ...payload, createdAt: new Date().toISOString() })
      onSaved(t('budget.addedTxToast', { defaultValue: '已新增記錄' }))
    }
    onClose()
  }

  return (
    <Modal open onClose={onClose}>
      {/* 收據抬頭：kicker + serif 標題 + 自家關閉鍵（呼應主畫面帳本語言） */}
      <header className="-mx-5 -mt-5 mb-4 flex items-start justify-between gap-3 border-b border-dashed border-slate-200/90 px-5 pb-3.5 dark:border-slate-700/70 sm:-mx-6 sm:-mt-6 sm:px-6">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.3em] text-accent/70">
            Ledger · {income ? t('budget.ledgerIncomeKicker', { defaultValue: '收入' }) : t('budget.ledgerExpenseKicker', { defaultValue: '支出' })}
          </p>
          <h3 className="mt-1 flex items-center gap-2 font-serif text-xl font-semibold leading-tight text-slate-800 dark:text-slate-100">
            <Receipt size={18} className="text-accent" aria-hidden="true" />
            {editing ? t('budget.editRecordTitle', { defaultValue: '編輯記錄' }) : t('budget.addRecordTitle', { defaultValue: '記一筆' })}
          </h3>
        </div>
        <button
          onClick={onClose}
          className="-mr-1 mt-0.5 shrink-0 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:hover:bg-slate-700"
          aria-label={t('budget.closeAriaLabel', { defaultValue: '關閉' })}
        >
          <X size={18} />
        </button>
      </header>

      <div className="space-y-4">
        <Pills options={KIND_PILLS} active={kind} onChange={switchKind} />

        {/* 收據「合計」行：大 serif 金額 + 收支正負色，帶 ruled 底線質感 */}
        <Field label={t('budget.amountFieldHK', { defaultValue: '金額（HK$）' })}>
          <div
            className={cx(
              'flex items-baseline gap-2 rounded-xl border bg-slate-50/70 px-3.5 py-2.5 transition focus-within:ring-2 focus-within:ring-accent/30 dark:bg-slate-900/40',
              income
                ? 'border-emerald-200/80 focus-within:border-emerald-400 dark:border-emerald-500/30'
                : 'border-rose-200/80 focus-within:border-rose-400 dark:border-rose-500/30',
            )}
          >
            <span
              className={cx(
                'font-serif text-2xl font-semibold leading-none tabular-nums',
                income ? 'text-emerald-500 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400',
              )}
              aria-hidden="true"
            >
              {income ? '+' : '−'}
            </span>
            <input
              value={amount}
              onChange={(e) =>
                setAmount(e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1'))
              }
              placeholder="0.00"
              inputMode="decimal"
              autoFocus={!editing}
              aria-label={t('budget.txAmountAriaLabel', { defaultValue: '金額' })}
              className={cx(
                'w-full bg-transparent font-serif text-2xl font-semibold leading-none tabular-nums slashed-zero outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600',
                income ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300',
              )}
            />
          </div>
        </Field>
        {!editing && (
          <div className="-mt-1.5 flex flex-wrap gap-1.5">
            {QUICK.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setAmount(String(q))}
                className="rounded-full border border-slate-200/80 bg-white px-3 py-1 text-xs font-medium tabular-nums text-slate-600 shadow-xs transition hover:border-accent/40 hover:bg-accent-soft hover:text-accent-strong dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:shadow-none dark:hover:bg-accent/15 dark:hover:text-accent"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        <Field label={t('budget.txCategoryField', { defaultValue: '分類' })}>
          {kindCats.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 px-3 py-2 text-xs text-slate-400 dark:border-slate-700">
              {t('budget.txNoCategoryMsg', { defaultValue: '呢個類型仲未有分類，請先去「分類」頁新增。' })}
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
                        ? 'border-accent bg-accent-soft shadow-xs dark:bg-accent/15 dark:shadow-none'
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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,9rem)_1fr]">
          <Field label={t('budget.dateField', { defaultValue: '日期' })}>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label={t('budget.txNoteField', { defaultValue: '備註（可選）' })}>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('budget.txNotePlaceholder', { defaultValue: '例如：午餐、出糧…' })}
            />
          </Field>
        </div>

        {/* 結算線：帳簿雙底線收結，呼應 LedgerStatement 嘅 ruled 行 */}
        <div className="-mx-5 mt-1 flex items-center justify-end gap-2 border-t-2 border-double border-slate-200 px-5 pt-4 dark:border-slate-700 sm:-mx-6 sm:px-6">
          <Button variant="secondary" onClick={onClose}>
            {t('budget.cancel', { defaultValue: '取消' })}
          </Button>
          <Button icon={editing ? undefined : Plus} onClick={save} disabled={!valid}>
            {editing ? t('budget.saveTx', { defaultValue: '儲存修改' }) : t('budget.addTx', { defaultValue: '記低' })}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ============================================================
//  CSV 匯入交易 Modal（鏡像題庫匯入：揀檔 / 貼上 → 預覽 → 確認入帳）
// ============================================================
function ImportTxModal({
  cats,
  catName,
  onClose,
}: {
  cats: TxCategory[]
  catName: (id: string) => string
  onClose: () => void
}) {
  const { t } = useTranslation()
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [text, setText] = useState('')

  const preview = useMemo(() => {
    if (!text.trim()) return { parsed: [] as ParsedTx[], skipped: 0 }
    return csvRowsToTx(parseCsv(text), cats)
  }, [text, cats])

  const unmatched = useMemo(
    () => preview.parsed.filter((p) => !p.matched).length,
    [preview.parsed],
  )

  const onFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => setText(String(reader.result ?? ''))
    reader.readAsText(file)
  }

  const downloadTemplate = () => {
    downloadCsv('收支匯入範本.csv', parseCsv(txCsvTemplate()))
  }

  const commit = () => {
    if (preview.parsed.length === 0) {
      toast.error(t('budget.noTxToImportError', { defaultValue: '未有可匯入嘅交易' }))
      return
    }
    const now = new Date().toISOString()
    for (const p of preview.parsed) {
      transactionsCol.add({
        kind: p.kind,
        amount: p.amount,
        categoryId: p.categoryId,
        date: p.date,
        note: p.note,
        createdAt: now,
      })
    }
    toast.success(t('budget.importedToast', { defaultValue: '已匯入 {{count}} 筆交易', count: preview.parsed.length }))
    onClose()
  }

  return (
    <Modal open onClose={onClose} size="lg">
      {/* 匯入抬頭：kicker + serif 標題 + 自家關閉鍵（呼應帳本語言） */}
      <header className="-mx-5 -mt-5 mb-4 flex items-start justify-between gap-3 border-b border-dashed border-slate-200/90 px-5 pb-3.5 dark:border-slate-700/70 sm:-mx-6 sm:-mt-6 sm:px-6">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.3em] text-accent/70">
            {t('budget.importKicker', { defaultValue: 'Ledger · 匯入' })}
          </p>
          <h3 className="mt-1 flex items-center gap-2 font-serif text-xl font-semibold leading-tight text-slate-800 dark:text-slate-100">
            <Upload size={18} className="text-accent" aria-hidden="true" />
            {t('budget.importTitle', { defaultValue: '匯入交易（CSV）' })}
          </h3>
        </div>
        <button
          onClick={onClose}
          className="-mr-1 mt-0.5 shrink-0 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:hover:bg-slate-700"
          aria-label={t('budget.closeAriaLabel', { defaultValue: '關閉' })}
        >
          <X size={18} />
        </button>
      </header>

      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-2xl border border-accent/20 bg-accent-soft/50 p-3.5 dark:border-accent/25 dark:bg-accent/10">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent text-white">
            <Upload size={16} />
          </span>
          <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            {t('budget.importInfo', { defaultValue: 'CSV 欄位：日期、類型（收入／支出）、分類、金額、備註，同匯出格式一樣。類型留空會按金額正負推斷；分類名會自動對應到最相近嘅現有分類，對唔到就落「未分類」。第一次用建議先下載範本。' })}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv,text/plain"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onFile(f)
            }}
          />
          <Button variant="secondary" icon={Upload} onClick={() => fileRef.current?.click()}>
            {t('budget.chooseCsvBtn', { defaultValue: '選擇 CSV 檔' })}
          </Button>
          <Button variant="ghost" icon={Download} onClick={downloadTemplate}>
            {t('budget.downloadTemplateBtn', { defaultValue: '下載範本' })}
          </Button>
        </div>

        <Field label={t('budget.pasteLabel', { defaultValue: '或直接貼上 CSV 內容' })}>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('budget.pastePlaceholder', { defaultValue: '日期,類型,分類,金額,備註…' })}
            rows={6}
            className="font-mono text-xs"
          />
        </Field>

        {text.trim() && (
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-3.5 dark:border-slate-700/60 dark:bg-slate-900/40">
            <div className="mb-2.5 flex flex-wrap items-center gap-2 text-xs" aria-live="polite">
              <Badge tone="green" dot>
                {t('budget.canImportBadge', { defaultValue: '可匯入 {{count}}', count: preview.parsed.length })}
              </Badge>
              {unmatched > 0 && (
                <Badge tone="amber" dot>
                  {t('budget.uncategorisedBadge', { defaultValue: '未分類 {{count}}', count: unmatched })}
                </Badge>
              )}
              {preview.skipped > 0 && (
                <Badge tone="rose" dot>
                  {t('budget.skippedBadge', { defaultValue: '略過 {{count}}', count: preview.skipped })}
                </Badge>
              )}
            </div>
            <ul className="max-h-44 space-y-1.5 overflow-y-auto">
              {preview.parsed.slice(0, 8).map((p, i) => (
                <li
                  key={i}
                  className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300"
                >
                  <span className="shrink-0 tabular-nums text-slate-400">{fmtDate(p.date)}</span>
                  <Badge tone={p.kind === 'income' ? 'green' : 'rose'}>
                    {p.kind === 'income' ? t('budget.importIncomeLabel', { defaultValue: '收入' }) : t('budget.importExpenseLabel', { defaultValue: '支出' })}
                  </Badge>
                  <span className="shrink-0 truncate text-slate-500 dark:text-slate-400">
                    {p.matched ? catName(p.categoryId) : `${t('budget.uncategorisedLabel', { defaultValue: '未分類' })}${p.rawCategory ? `（${p.rawCategory}）` : ''}`}
                  </span>
                  <span
                    className={cx(
                      'ml-auto shrink-0 font-semibold tabular-nums',
                      p.kind === 'income'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400',
                    )}
                  >
                    {p.kind === 'income' ? '+' : '−'}
                    {fmtMoney(p.amount)}
                  </span>
                </li>
              ))}
              {preview.parsed.length > 8 && (
                <li className="text-xs text-slate-400 dark:text-slate-500">
                  {t('budget.moreRows', { defaultValue: '…仲有 {{count}} 筆', count: preview.parsed.length - 8 })}
                </li>
              )}
            </ul>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            {t('budget.cancel', { defaultValue: '取消' })}
          </Button>
          <Button onClick={commit} disabled={preview.parsed.length === 0}>
            {t('budget.importBtn', { defaultValue: '匯入（{{count}}）', count: preview.parsed.length })}
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
  const { t } = useTranslation()
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
    toast.success(t('budget.addedCatToast', { defaultValue: '已新增分類' }))
    setName('')
    setIcon(EMOJI_CHOICES[1])
  }

  const remove = async (cat: TxCategory) => {
    const ok = await confirm({
      title: t('budget.confirmDeleteCatTitle', { defaultValue: '刪除分類？' }),
      message: t('budget.confirmDeleteCatMessage', { defaultValue: '已用咗呢個分類嘅記錄會變成「未分類」，但唔會被刪。分類嘅預算亦會一併移除。' }),
      confirmText: t('budget.confirmDeleteCatConfirm', { defaultValue: '刪除' }),
      tone: 'danger',
    })
    if (!ok) return
    txCategoriesCol.remove(cat.id)
    if (budgetsCol.get().some((b) => b.id === cat.id)) budgetsCol.remove(cat.id)
    toast.success(t('budget.deletedCatToast', { defaultValue: '已刪除分類' }))
  }

  const renderSection = (sectionKind: TxKind, title: string) => {
    const list = cats.filter((c) => c.kind === sectionKind)
    return (
      <div>
        <SectionTitle>{title}</SectionTitle>
        {list.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('budget.emptyCatHint', { defaultValue: '下面加返個分類就得。' })}</p>
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
                      {t('budget.catEntries', { defaultValue: '{{count}} 筆', count: countByCat.get(c.id) ?? 0 })}
                    </span>
                    <IconButton
                      label={t('budget.deleteCatAriaLabel', { defaultValue: '刪除分類 {{name}}', name: c.name })}
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
      {renderSection('expense', t('budget.expenseCatsSection', { defaultValue: '支出分類' }))}
      {renderSection('income', t('budget.incomeCatsSection', { defaultValue: '收入分類' }))}

      <Separator />

      {/* 新增分類 */}
      <Card className="space-y-3 border-accent/30 bg-accent-soft/40 p-4">
        <SectionTitle>{t('budget.addCategorySection', { defaultValue: '新增分類' })}</SectionTitle>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[140px] flex-1">
            <Field label={t('budget.catNameLabel', { defaultValue: '名稱' })}>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && add()}
                placeholder={t('budget.catNamePlaceholder', { defaultValue: '例如：保險' })}
              />
            </Field>
          </div>
          <div className="w-28">
            <Field label={t('budget.catTypeLabel', { defaultValue: '類型' })}>
              <Select value={kind} onChange={(e) => setKind(e.target.value as TxKind)}>
                <option value="expense">{t('budget.catTypeExpense', { defaultValue: '支出' })}</option>
                <option value="income">{t('budget.catTypeIncome', { defaultValue: '收入' })}</option>
              </Select>
            </Field>
          </div>
          <Button onClick={add} disabled={!name.trim()}>
            {t('budget.addCategoryBtn', { defaultValue: '新增' })}
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {EMOJI_CHOICES.map((choice) => (
            <button
              key={choice}
              type="button"
              onClick={() => setIcon(choice)}
              aria-pressed={choice === icon}
              aria-label={t('budget.pickEmojiAriaLabel', { defaultValue: '揀 emoji {{emoji}}', emoji: choice })}
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
