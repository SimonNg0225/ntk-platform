import { createCollection, type Entity } from '../../../lib/store'
import type { Transaction, TxCategory, TxKind } from '../../../data/types'

// ============================================================
//  收支記帳核心：純函式 + 功能專屬持久化（零副作用、零新 npm）
//  ------------------------------------------------------------
//  參考真實理財 app（MoneyLover / Money Manager / YNAB）：
//   - 分類預算「信封」（envelope budgeting）+ 超支警示 + 滾動到下月
//   - 定期收支（薪金 / 訂閱 / 租金…）自動到期入帳
//   - 儲蓄率、日均支出、最大單筆、月對月升跌、月底預測
//   - 分類佔比、收支趨勢、現金流、每日支出、支出熱力圖
//  共用 transactionsCol / txCategoriesCol 維持唔變；本功能需要而
//  Transaction / TxCategory 冇嘅資料（預算、定期）存喺呢度自家 collection。
//  唯一 key（已喺 newCollections 申報）：
//    budget_envelopes / budget_recurring
// ============================================================

// ───────── 功能專屬持久化型別 ─────────

/** 分類月度預算（信封）。以 categoryId 關聯共用 TxCategory。 */
export interface BudgetEnvelope extends Entity {
  // id === categoryId（直接用分類 id 做 key）
  categoryId: string
  limit: number // 每月上限（HK$）
  rollover: boolean // 用剩 / 超支結轉落下月（顯示用）
  updatedAt: string
}

export type RecurrenceCycle = 'weekly' | 'biweekly' | 'monthly' | 'yearly'

/** 定期收支範本（薪金 / 訂閱 / 租金…）。到期由用家一鍵入帳。 */
export interface RecurringTx extends Entity {
  kind: TxKind
  amount: number
  categoryId: string
  note?: string
  cycle: RecurrenceCycle
  /** 每月第幾日（monthly / yearly 用），或週幾（weekly 用 0-6） */
  anchorDay: number
  /** 開始日（YYYY-MM-DD）— 推算下次到期由此起 */
  startDate: string
  /** 最近一次已入帳日（YYYY-MM-DD），無 = 未入過 */
  lastPosted?: string
  active: boolean
  createdAt: string
}

export const budgetsCol = createCollection<BudgetEnvelope>('budget_envelopes', [])
export const recurringCol = createCollection<RecurringTx>('budget_recurring', [])

/** 預算 upsert（以 categoryId 做 id；limit ≤ 0 視為移除預算） */
export function upsertBudget(categoryId: string, limit: number, rollover: boolean) {
  const existing = budgetsCol.get().find((b) => b.id === categoryId)
  if (limit <= 0) {
    if (existing) budgetsCol.remove(categoryId)
    return
  }
  if (existing) {
    budgetsCol.update(categoryId, { limit, rollover, updatedAt: new Date().toISOString() })
  } else {
    budgetsCol.add({
      id: categoryId,
      categoryId,
      limit,
      rollover,
      updatedAt: new Date().toISOString(),
    })
  }
}

/** 清掉孤兒預算（分類已刪） */
export function pruneBudgets(validCatIds: Set<string>) {
  for (const b of budgetsCol.get()) {
    if (!validCatIds.has(b.categoryId)) budgetsCol.remove(b.id)
  }
}

// ============================================================
//  日期 / 格式化
// ============================================================

/** Date → 'YYYY-MM' */
export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** 'YYYY-MM' + delta 個月 → 'YYYY-MM' */
export function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number)
  return monthKey(new Date(y, m - 1 + delta, 1))
}

/** 'YYYY-MM' → 「2026 年 5 月」 */
export function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number)
  return `${y} 年 ${m} 月`
}

/** 'YYYY-MM' → 「5 月」（圖表軸用） */
export function monthShort(key: string): string {
  const [, m] = key.split('-').map(Number)
  return `${m}月`
}

/** 'YYYY-MM-DD' → 「5月23日」 */
export function fmtDate(iso: string): string {
  const [, m, d] = iso.split('-').map(Number)
  return `${m}月${d}日`
}

/** 'YYYY-MM-DD' → 星期幾（0=日） */
export function dowOf(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).getDay()
}

export const WEEKDAY_LABEL = ['日', '一', '二', '三', '四', '五', '六']

/** 該月有幾多日 */
export function daysInMonth(key: string): number {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

/** 今日（本機）'YYYY-MM-DD' */
export function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 金額格式：HK$ + 千分位 + 最多 2 位小數，負數 -HK$123 */
export function fmtMoney(n: number): string {
  const sign = n < 0 ? '-' : ''
  const abs = Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
  return `${sign}HK$${abs}`
}

/** 緊湊金額（圖表 tooltip / 軸用，e.g. HK$1.2k） */
export function fmtMoneyShort(n: number): string {
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}HK$${round1(abs / 1_000_000)}M`
  if (abs >= 1_000) return `${sign}HK$${round1(abs / 1_000)}k`
  return `${sign}HK$${Math.round(abs)}`
}

export function round1(x: number): number {
  return Math.round(x * 10) / 10
}

/** 由今日回推 n 個 'YYYY-MM'（由舊到新）*/
export function recentMonths(n: number, fromKey?: string): string[] {
  const base = fromKey ?? monthKey(new Date())
  const result: string[] = []
  for (let i = n - 1; i >= 0; i -= 1) result.push(shiftMonth(base, -i))
  return result
}

/** 交易係咪屬於某月 */
export function inMonth(tx: { date: string }, key: string): boolean {
  return tx.date.slice(0, 7) === key
}

// ============================================================
//  統計核心
// ============================================================

export interface MonthStats {
  income: number
  expense: number
  balance: number
  count: number
  /** 儲蓄率 = (收入-支出)/收入 *100；無收入 = null */
  savingsRate: number | null
  /** 截至「今日」嘅日均支出（本月先用已過日數，過去月用全月日數） */
  dailyAvg: number
  /** 最大單筆支出 */
  topExpense: number
  /** 月底支出預測（本月：日均 × 全月日數；過去月：= expense） */
  projectedExpense: number
}

/** 計某月收支統計（含儲蓄率 / 日均 / 預測） */
export function computeMonthStats(monthTxs: Transaction[], key: string): MonthStats {
  let income = 0
  let expense = 0
  let topExpense = 0
  for (const t of monthTxs) {
    if (t.kind === 'income') income += t.amount
    else {
      expense += t.amount
      if (t.amount > topExpense) topExpense = t.amount
    }
  }
  const today = todayIso()
  const isCurrentMonth = today.slice(0, 7) === key
  const totalDays = daysInMonth(key)
  const elapsedDays = isCurrentMonth ? Number(today.slice(8, 10)) : totalDays
  const dailyAvg = elapsedDays > 0 ? expense / elapsedDays : 0
  const projectedExpense = isCurrentMonth ? dailyAvg * totalDays : expense
  return {
    income,
    expense,
    balance: income - expense,
    count: monthTxs.length,
    savingsRate: income > 0 ? round1(((income - expense) / income) * 100) : null,
    dailyAvg,
    topExpense,
    projectedExpense,
  }
}

export interface CategoryStat {
  categoryId: string
  amount: number
  count: number
  pct: number
}

/** 某月某類型（收 / 支）按分類匯總，由大到細 */
export function byCategory(
  monthTxs: Transaction[],
  kind: TxKind,
): CategoryStat[] {
  const map = new Map<string, { amount: number; count: number }>()
  let total = 0
  for (const t of monthTxs) {
    if (t.kind !== kind) continue
    total += t.amount
    const cur = map.get(t.categoryId) ?? { amount: 0, count: 0 }
    cur.amount += t.amount
    cur.count += 1
    map.set(t.categoryId, cur)
  }
  return [...map.entries()]
    .map(([categoryId, v]) => ({
      categoryId,
      amount: v.amount,
      count: v.count,
      pct: total > 0 ? Math.round((v.amount / total) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount)
}

export interface TrendRow {
  key: string
  income: number
  expense: number
  balance: number
}

/** 最近 n 個月收支趨勢（由舊到新） */
export function monthlyTrend(txs: Transaction[], n: number, fromKey?: string): TrendRow[] {
  const months = recentMonths(n, fromKey)
  const idx = new Map<string, TrendRow>()
  for (const k of months) idx.set(k, { key: k, income: 0, expense: 0, balance: 0 })
  for (const t of txs) {
    const k = t.date.slice(0, 7)
    const row = idx.get(k)
    if (!row) continue
    if (t.kind === 'income') row.income += t.amount
    else row.expense += t.amount
  }
  for (const row of idx.values()) row.balance = row.income - row.expense
  return months.map((k) => idx.get(k)!)
}

export interface DayCell {
  day: number // 1..daysInMonth
  date: string // YYYY-MM-DD
  expense: number
  income: number
}

/** 某月逐日收支（heatmap / sparkline 用） */
export function dailyBreakdown(monthTxs: Transaction[], key: string): DayCell[] {
  const n = daysInMonth(key)
  const cells: DayCell[] = Array.from({ length: n }, (_, i) => ({
    day: i + 1,
    date: `${key}-${String(i + 1).padStart(2, '0')}`,
    expense: 0,
    income: 0,
  }))
  for (const t of monthTxs) {
    const d = Number(t.date.slice(8, 10))
    if (d < 1 || d > n) continue
    if (t.kind === 'expense') cells[d - 1].expense += t.amount
    else cells[d - 1].income += t.amount
  }
  return cells
}

// ───────── 預算狀態 ─────────
export type BudgetStatus = 'ok' | 'warn' | 'over' | 'none'

export interface BudgetRow {
  categoryId: string
  limit: number
  spent: number
  remaining: number
  pct: number // 0..(>100)
  status: BudgetStatus
  rollover: boolean
}

/** 計某月各分類預算使用狀況（只計有設預算嘅支出分類） */
export function budgetRows(
  envelopes: BudgetEnvelope[],
  monthTxs: Transaction[],
): BudgetRow[] {
  const spentByCat = new Map<string, number>()
  for (const t of monthTxs) {
    if (t.kind !== 'expense') continue
    spentByCat.set(t.categoryId, (spentByCat.get(t.categoryId) ?? 0) + t.amount)
  }
  return envelopes
    .map((e) => {
      const spent = spentByCat.get(e.categoryId) ?? 0
      const pct = e.limit > 0 ? Math.round((spent / e.limit) * 100) : 0
      const status: BudgetStatus =
        spent > e.limit ? 'over' : pct >= 80 ? 'warn' : 'ok'
      return {
        categoryId: e.categoryId,
        limit: e.limit,
        spent,
        remaining: e.limit - spent,
        pct,
        status,
        rollover: e.rollover,
      }
    })
    .sort((a, b) => b.pct - a.pct)
}

export interface BudgetSummary {
  totalLimit: number
  totalSpent: number
  remaining: number
  pct: number
  overCount: number
}

export function budgetSummary(rows: BudgetRow[]): BudgetSummary {
  let totalLimit = 0
  let totalSpent = 0
  let overCount = 0
  for (const r of rows) {
    totalLimit += r.limit
    totalSpent += r.spent
    if (r.status === 'over') overCount += 1
  }
  return {
    totalLimit,
    totalSpent,
    remaining: totalLimit - totalSpent,
    pct: totalLimit > 0 ? Math.round((totalSpent / totalLimit) * 100) : 0,
    overCount,
  }
}

// ============================================================
//  定期收支：到期推算
// ============================================================

function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function dateToIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function stepCycle(d: Date, cycle: RecurrenceCycle, anchorDay: number): Date {
  if (cycle === 'weekly') {
    const next = new Date(d)
    next.setDate(next.getDate() + 7)
    return next
  }
  if (cycle === 'biweekly') {
    const next = new Date(d)
    next.setDate(next.getDate() + 14)
    return next
  }
  // monthly / yearly：由 anchorDay 重新錨定（而非盲目 setMonth／setFullYear），
  // 否則月底錨點（29/30/31）會溢位入下下個月並永久污染日期（e.g. Jan-31 +1 月 = Mar-3），
  // 閏日 Feb-29 +1 年亦會漂成 Mar-1。改為 clamp 到當月最後一日。
  let y = d.getFullYear()
  let m = d.getMonth()
  if (cycle === 'monthly') m += 1
  else y += 1
  if (m > 11) {
    y += Math.floor(m / 12)
    m %= 12
  }
  const lastDay = new Date(y, m + 1, 0).getDate()
  return new Date(y, m, Math.min(anchorDay, lastDay))
}

export const CYCLE_LABEL: Record<RecurrenceCycle, string> = {
  weekly: '每週',
  biweekly: '每兩週',
  monthly: '每月',
  yearly: '每年',
}

export interface DueInfo {
  recurring: RecurringTx
  dueDate: string // YYYY-MM-DD
  overdueDays: number // >0 = 已過期未入；0 = 今日；<0 = 將來
}

/** 篩出「到今日為止應入帳但未入」嘅定期項目 */
export function dueRecurring(list: RecurringTx[]): DueInfo[] {
  const today = todayIso()
  const out: DueInfo[] = []
  for (const r of list) {
    if (!r.active) continue
    // 真正「下次到期」= 由 lastPosted / startDate 推到 <= today 嘅最後一個
    const due = lastDueOnOrBefore(r, today)
    if (!due) continue
    out.push({ recurring: r, dueDate: due, overdueDays: daysBetween(due, today) })
  }
  return out.sort((a, b) =>
    a.dueDate === b.dueDate ? 0 : a.dueDate < b.dueDate ? -1 : 1,
  )
}

/** 推算某定期項目「將來下一次」到期日（用嚟顯示未到期項目嘅預告） */
export function upcomingDue(r: RecurringTx): string {
  const today = todayIso()
  let cursor = r.lastPosted
    ? stepCycle(isoToDate(r.lastPosted), r.cycle, r.anchorDay)
    : isoToDate(r.startDate)
  const todayD = isoToDate(today)
  let guard = 0
  while (cursor < todayD && guard < 5000) {
    cursor = stepCycle(cursor, r.cycle, r.anchorDay)
    guard += 1
  }
  return dateToIso(cursor)
}

/** 推「到 onIso 為止」最後一次應入帳日（未入過或上次已過一週期）；無 = null */
function lastDueOnOrBefore(r: RecurringTx, onIso: string): string | null {
  const on = isoToDate(onIso)
  let cursor = r.lastPosted
    ? stepCycle(isoToDate(r.lastPosted), r.cycle, r.anchorDay)
    : isoToDate(r.startDate)
  if (cursor > on) return null
  let last = dateToIso(cursor)
  let guard = 0
  while (guard < 5000) {
    const nxt = stepCycle(isoToDate(last), r.cycle, r.anchorDay)
    if (nxt > on) break
    last = dateToIso(nxt)
    guard += 1
  }
  return last
}

export function daysBetween(aIso: string, bIso: string): number {
  const a = isoToDate(aIso).getTime()
  const b = isoToDate(bIso).getTime()
  return Math.round((b - a) / 864e5)
}

// ============================================================
//  搜尋 / 篩選
// ============================================================

export interface Filters {
  kind: 'all' | TxKind
  categoryId: string // '' = 全部
  text: string
  min: number | null
  max: number | null
}

export const EMPTY_FILTERS: Filters = {
  kind: 'all',
  categoryId: '',
  text: '',
  min: null,
  max: null,
}

export function filtersActive(f: Filters): boolean {
  return (
    f.kind !== 'all' ||
    f.categoryId !== '' ||
    f.text.trim() !== '' ||
    f.min != null ||
    f.max != null
  )
}

/** 應用篩選（在已選月份嘅交易上） */
export function applyFilters(
  txs: Transaction[],
  f: Filters,
  catName: (id: string) => string,
): Transaction[] {
  const q = f.text.trim().toLowerCase()
  return txs.filter((t) => {
    if (f.kind !== 'all' && t.kind !== f.kind) return false
    if (f.categoryId && t.categoryId !== f.categoryId) return false
    if (f.min != null && t.amount < f.min) return false
    if (f.max != null && t.amount > f.max) return false
    if (q) {
      const hay = `${t.note ?? ''} ${catName(t.categoryId)}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
}

/** 交易排序：日期新→舊，同日按 createdAt 新→舊 */
export function sortTxDesc(a: Transaction, b: Transaction): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1
  if (a.createdAt === b.createdAt) return 0
  return a.createdAt < b.createdAt ? 1 : -1
}

// ============================================================
//  CSV 匯出
// ============================================================

export { csvEscape, downloadCsv } from '../shared/csv'

export function txToCsvRows(
  txs: Transaction[],
  cats: TxCategory[],
): (string | number)[][] {
  const nameOf = (id: string) => cats.find((c) => c.id === id)?.name ?? '未分類'
  const header = ['日期', '類型', '分類', '金額', '備註']
  const body = [...txs].sort(sortTxDesc).map((t) => [
    t.date,
    t.kind === 'income' ? '收入' : '支出',
    nameOf(t.categoryId),
    t.kind === 'income' ? t.amount : -t.amount,
    t.note ?? '',
  ])
  return [header, ...body]
}
