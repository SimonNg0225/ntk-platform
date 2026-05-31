import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  dueRecurring,
  upcomingDue,
  daysBetween,
  computeMonthStats,
  byCategory,
  monthlyTrend,
  dailyBreakdown,
  budgetRows,
  budgetSummary,
  type RecurringTx,
  type BudgetEnvelope,
} from './util'
import type { Transaction } from '../../../data/types'

// ============================================================
//  定期收支排程（dueRecurring / upcomingDue）
//  ── 依賴 todayIso() → 用 fake timers 固定系統時間做 deterministic 測 ──
//  ── 同時揭發並驗證 3 個排程計算 bug 嘅修正 ──
// ============================================================

// 造定期項：anchorDay 預設由 startDate 嘅日子推（同主元件 BudgetTracker 一致：
//   anchorDay = Number(startDate.slice(8,10))），避免測試資料同實際建立流程脫節。
const rec = (over: Partial<RecurringTx>): RecurringTx => {
  const startDate = over.startDate ?? '2026-01-15'
  return {
    id: 'r1',
    kind: 'expense',
    amount: 100,
    categoryId: 'rent',
    cycle: 'monthly',
    anchorDay: Number(startDate.slice(8, 10)),
    startDate,
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...over,
  }
}

describe('dueRecurring / upcomingDue（固定系統時間 = 2026-05-31）', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // 2026-05-31 本地正午（避免午夜邊界）；todayIso 用本地 getter → '2026-05-31'
    vi.setSystemTime(new Date(2026, 4, 31, 12, 0, 0))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  // ── dueRecurring 基本行為 ──

  it('空 list → []', () => {
    expect(dueRecurring([])).toEqual([])
  })

  it('inactive 項略過', () => {
    const r = rec({ active: false, startDate: '2026-01-15' })
    expect(dueRecurring([r])).toEqual([])
  })

  it('startDate 喺未來 → 無到期（cursor > today，回 null 略過）', () => {
    const r = rec({ startDate: '2026-08-15', cycle: 'monthly' })
    expect(dueRecurring([r])).toEqual([])
  })

  it('從未入帳（無 lastPosted）→ 用 startDate 推到 <= today 嘅最後一個', () => {
    // monthly anchor=15，start 2026-01-15，today 2026-05-31
    // 序列：1-15, 2-15, 3-15, 4-15, 5-15（6-15 > today 停）→ 最後 = 5-15
    const r = rec({ startDate: '2026-01-15', cycle: 'monthly' })
    const out = dueRecurring([r])
    expect(out).toHaveLength(1)
    expect(out[0].dueDate).toBe('2026-05-15')
    // overdueDays = daysBetween(5-15, 5-31) = 16
    expect(out[0].overdueDays).toBe(16)
    expect(out[0].recurring.id).toBe('r1')
  })

  it('已入帳後 → 由 lastPosted + 1 週期推下一個應入帳日', () => {
    // monthly anchor=15，lastPosted 2026-03-15 → 下次 4-15，再 5-15（6-15>today 停）→ 5-15
    const r = rec({ startDate: '2026-01-15', cycle: 'monthly', lastPosted: '2026-03-15' })
    const out = dueRecurring([r])
    expect(out[0].dueDate).toBe('2026-05-15')
  })

  it('已入帳且下一週期仍喺未來 → null 略過（唔重覆催）', () => {
    // lastPosted 2026-05-20 → 下次 6-20 > today(5-31) → null
    const r = rec({ startDate: '2026-01-20', cycle: 'monthly', lastPosted: '2026-05-20' })
    expect(dueRecurring([r])).toEqual([])
  })

  it('overdueDays = 0 當到期日剛好係今日', () => {
    // monthly anchor=31，start 2026-01-31 → 下面 BUG1 已證序列尾係 5-31 = today
    const r = rec({ startDate: '2026-01-31', cycle: 'monthly' })
    const out = dueRecurring([r])
    expect(out[0].dueDate).toBe('2026-05-31')
    expect(out[0].overdueDays).toBe(0)
  })

  it('多項依 dueDate 升序排', () => {
    const a = rec({ id: 'a', startDate: '2026-05-10', cycle: 'monthly' }) // due 5-10
    const b = rec({ id: 'b', startDate: '2026-05-25', cycle: 'monthly' }) // due 5-25
    const c = rec({ id: 'c', startDate: '2026-05-01', cycle: 'monthly' }) // due 5-01
    const out = dueRecurring([a, b, c])
    expect(out.map((d) => d.recurring.id)).toEqual(['c', 'a', 'b'])
  })

  it('dueDate 相同：保持輸入次序（comparator 自反，穩定排序）', () => {
    // 兩項同錨點（5-15）→ 同一 dueDate；相等 compare = 0 → 唔反轉輸入次序
    const a = rec({ id: 'a', startDate: '2026-01-15', cycle: 'monthly' })
    const b = rec({ id: 'b', startDate: '2026-01-15', cycle: 'monthly' })
    const out = dueRecurring([a, b])
    expect(out.map((d) => d.dueDate)).toEqual(['2026-05-15', '2026-05-15'])
    expect(out.map((d) => d.recurring.id)).toEqual(['a', 'b'])
  })

  // ── BUG 1：monthly 月底錨點溢位 ──
  // 修正前 stepCycle 用 next.setMonth(+1)：Jan-31 +1 月 = Mar-3（跳過 2 月）並永久污染。
  // 修正後由 anchorDay 重新錨定 → Jan-31→Feb-28→Mar-31→Apr-30→May-31。

  it('BUG1: monthly 錨定 31 號，逐月 clamp 到當月最後日（唔跳月、唔永久漂）', () => {
    // never posted, start 2026-01-31, today 2026-05-31
    const r = rec({ startDate: '2026-01-31', cycle: 'monthly' })
    const out = dueRecurring([r])
    // 修正前會係 2026-05-03（由 Mar-3 漂落嚟）；修正後 = 2026-05-31
    expect(out[0].dueDate).toBe('2026-05-31')
  })

  it('BUG1: upcomingDue monthly 錨定 31，已入帳 4-30 → 下次應為 5-31（非 5-30 漂移）', () => {
    // lastPosted 2026-04-30（4 月最後日，anchor=31 clamp 落 30）；下次重新錨定 = 5-31
    const r = rec({ startDate: '2026-01-31', cycle: 'monthly', lastPosted: '2026-04-30' })
    expect(upcomingDue(r)).toBe('2026-05-31')
  })

  it('BUG1: upcomingDue monthly 錨定 31，已入帳 5-31 → 下次 = 6-30（6 月只有 30 日）', () => {
    const r = rec({ startDate: '2026-01-31', cycle: 'monthly', lastPosted: '2026-05-31' })
    expect(upcomingDue(r)).toBe('2026-06-30')
  })

  it('BUG1: monthly 錨定 30，2 月 clamp 到 28，3 月還原 30', () => {
    // never posted, start 2025-12-30, today 2026-05-31
    // 序列：2025-12-30, 2026-01-30, 02-28, 03-30, 04-30, 05-30（06-30>today 停）→ 05-30
    const r = rec({ startDate: '2025-12-30', cycle: 'monthly' })
    const out = dueRecurring([r])
    expect(out[0].dueDate).toBe('2026-05-30')
  })

  it('正常 monthly 錨點（15）唔受影響：穩定每月 15 號（upcomingDue 推到 >= today）', () => {
    // lastPosted 2026-04-15 → 下次 05-15（< today 05-31）→ 再推 06-15（>= today）
    const r = rec({ startDate: '2026-01-15', cycle: 'monthly', lastPosted: '2026-04-15' })
    expect(upcomingDue(r)).toBe('2026-06-15')
  })

  // ── BUG 2：yearly 閏日溢位 ──
  // 修正前 setFullYear(+1)：Feb-29-2024 +1 年 = Mar-1-2025；修正後 clamp 到 Feb-28，
  // 落到下個閏年（2028）還原 Feb-29。

  it('BUG2: yearly 錨定 Feb-29（閏年起），非閏年 clamp 到 Feb-28（非漂去 Mar-1）', () => {
    // never posted, start 2024-02-29, today 2026-05-31
    // 序列：2024-02-29, 2025-02-28, 2026-02-28（2027-02-28>today 停）→ 2026-02-28
    const r = rec({ startDate: '2024-02-29', cycle: 'yearly' })
    const out = dueRecurring([r])
    // 修正前會係 2026-03-01；修正後 = 2026-02-28
    expect(out[0].dueDate).toBe('2026-02-28')
  })

  it('BUG2: upcomingDue yearly Feb-29，已入帳 2027-02-28 → 下次 = 2028-02-29（閏年還原）', () => {
    const r = rec({ startDate: '2024-02-29', cycle: 'yearly', lastPosted: '2027-02-28' })
    expect(upcomingDue(r)).toBe('2028-02-29')
  })

  it('正常 yearly 錨點唔受影響', () => {
    // start 2025-06-10, today 2026-05-31 → due 2025-06-10（2026-06-10 > today）
    const r = rec({ startDate: '2025-06-10', cycle: 'yearly' })
    const out = dueRecurring([r])
    expect(out[0].dueDate).toBe('2025-06-10')
  })

  // ── BUG 3：weekly/biweekly guard 上限太細（600 ≈ 11.5 年）──
  // 修正前久遠 startDate（>~11.5 年）會卡死喺過去；修正後 guard=5000 足夠到達今日附近。

  it('BUG3: weekly 起始 2000-01-01（久遠）未入帳 → dueDate 到達今日附近（非卡 2011）', () => {
    // 2000-01-01 係週六；每 7 日落週六。<=2026-05-31 嘅最後週六 = 2026-05-30。
    const r = rec({ startDate: '2000-01-01', cycle: 'weekly', anchorDay: 6 })
    const out = dueRecurring([r])
    // 修正前 guard 600 會卡喺 2011-07-02；修正後 = 2026-05-30
    expect(out[0].dueDate).toBe('2026-05-30')
    // overdueDays = daysBetween(5-30, 5-31) = 1
    expect(out[0].overdueDays).toBe(1)
  })

  it('BUG3: upcomingDue weekly 久遠起始 → 將來下一次（>= today）非卡過去', () => {
    const r = rec({ startDate: '2000-01-01', cycle: 'weekly', anchorDay: 6 })
    // today 5-31（週日）；下一個週六 = 2026-06-06
    expect(upcomingDue(r)).toBe('2026-06-06')
  })

  it('BUG3: biweekly 久遠起始亦到達今日附近', () => {
    // 2000-01-01 週六，每 14 日。<=2026-05-31 最後一個 = ?
    // 直接斷言「接近今日」：dueDate 應喺 2026-05 內、且距今 < 14 日。
    const r = rec({ startDate: '2000-01-01', cycle: 'biweekly', anchorDay: 6 })
    const out = dueRecurring([r])
    expect(out[0].dueDate.slice(0, 7)).toBe('2026-05')
    expect(out[0].overdueDays).toBeGreaterThanOrEqual(0)
    expect(out[0].overdueDays).toBeLessThan(14)
  })

  // ── weekly / biweekly 一般行為（錨點唔影響步進）──

  it('weekly 由 lastPosted +7 日推', () => {
    // lastPosted 2026-05-01 → +7=05-08, 05-15, 05-22, 05-29（06-05>today 停）→ 05-29
    const r = rec({ startDate: '2026-04-01', cycle: 'weekly', anchorDay: 1, lastPosted: '2026-05-01' })
    const out = dueRecurring([r])
    expect(out[0].dueDate).toBe('2026-05-29')
  })

  it('biweekly 由 startDate +14 日推', () => {
    // start 2026-05-01 → 05-15, 05-29（06-12>today 停）→ 05-29
    const r = rec({ startDate: '2026-05-01', cycle: 'biweekly', anchorDay: 1 })
    const out = dueRecurring([r])
    expect(out[0].dueDate).toBe('2026-05-29')
  })
})

describe('upcomingDue：lastPosted 喺未來（已過今日）', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 31, 12, 0, 0)) // 2026-05-31
  })
  afterEach(() => vi.useRealTimers())

  it('lastPosted 已喺今日之後 → 直接回 stepCycle(lastPosted) 結果（while 一次都唔行）', () => {
    // lastPosted 2026-07-15（未來）→ cursor = stepCycle = 2026-08-15，已 >= today 即時返回
    const r = rec({ startDate: '2026-01-15', cycle: 'monthly', lastPosted: '2026-07-15' })
    expect(upcomingDue(r)).toBe('2026-08-15')
  })
})

// ============================================================
//  daysBetween：補齊跨閏年 2 月（本地午夜，HK 無 DST）
// ============================================================

describe('daysBetween（補充邊界）', () => {
  it('跨閏年 2 月（2024-02-28 → 2024-03-01 = 2 日，因有 02-29）', () => {
    expect(daysBetween('2024-02-28', '2024-03-01')).toBe(2)
  })
  it('整年跨度（2025-05-31 → 2026-05-31 = 365）', () => {
    expect(daysBetween('2025-05-31', '2026-05-31')).toBe(365)
  })
})

// ============================================================
//  computeMonthStats：本月分支（用 fake timers 固定「今日」做已過日數）
// ============================================================

const tx = (over: Partial<Transaction>): Transaction => ({
  id: 'x',
  kind: 'expense',
  amount: 100,
  categoryId: 'food',
  date: '2026-05-15',
  createdAt: '2026-05-15T00:00:00.000Z',
  ...over,
})

describe('computeMonthStats：本月用「已過日數」（固定今日 = 2026-05-10）', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 10, 12, 0, 0)) // 2026-05-10 → elapsedDays=10
  })
  afterEach(() => vi.useRealTimers())

  it('本月 dailyAvg = expense / 已過日數（10），projectedExpense = dailyAvg × 全月日數（31）', () => {
    // 兩筆支出共 1000；本月 5 月有 31 日，今日 10 號
    const s = computeMonthStats(
      [tx({ amount: 600, date: '2026-05-03' }), tx({ amount: 400, date: '2026-05-08' })],
      '2026-05',
    )
    expect(s.expense).toBe(1000)
    expect(s.dailyAvg).toBeCloseTo(1000 / 10, 10) // 100
    expect(s.projectedExpense).toBeCloseTo((1000 / 10) * 31, 10) // 3100
  })

  it('本月空陣列：dailyAvg=0（elapsedDays>0 但 expense=0，無 NaN），projectedExpense=0', () => {
    const s = computeMonthStats([], '2026-05')
    expect(s.dailyAvg).toBe(0)
    expect(s.projectedExpense).toBe(0)
    expect(s.savingsRate).toBeNull()
  })

  it('未來月份（2026-08，isCurrentMonth=false）當過去月處理：用全月日數、projected=expense', () => {
    // 8 月有 31 日；dailyAvg = 310/31，projected = expense（非 ×31）
    const s = computeMonthStats([tx({ amount: 310, date: '2026-08-15' })], '2026-08')
    expect(s.dailyAvg).toBeCloseTo(310 / 31, 10)
    expect(s.projectedExpense).toBe(310)
  })
})

describe('computeMonthStats：補充收支邊界（過去月 2026-03，固定今日 2026-05-10）', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 10, 12, 0, 0))
  })
  afterEach(() => vi.useRealTimers())

  it('income=0（只有支出）→ savingsRate=null（防除零）', () => {
    const s = computeMonthStats([tx({ kind: 'expense', amount: 500, date: '2026-03-01' })], '2026-03')
    expect(s.savingsRate).toBeNull()
  })

  it('只有收入無支出 → savingsRate=100、balance=income、topExpense=0', () => {
    const s = computeMonthStats(
      [tx({ kind: 'income', amount: 8000, date: '2026-03-01', categoryId: 'salary' })],
      '2026-03',
    )
    expect(s.savingsRate).toBe(100)
    expect(s.balance).toBe(8000)
    expect(s.topExpense).toBe(0)
    expect(s.expense).toBe(0)
  })

  it('支出 > 收入 → balance 負、savingsRate 負', () => {
    // income 1000, expense 1500 → (1000-1500)/1000*100 = -50
    const s = computeMonthStats(
      [
        tx({ kind: 'income', amount: 1000, date: '2026-03-01' }),
        tx({ kind: 'expense', amount: 1500, date: '2026-03-02' }),
      ],
      '2026-03',
    )
    expect(s.balance).toBe(-500)
    expect(s.savingsRate).toBe(-50)
  })

  it('topExpense 只計 expense kind（大額 income 唔當最大單筆）', () => {
    const s = computeMonthStats(
      [
        tx({ kind: 'income', amount: 99999, date: '2026-03-01' }),
        tx({ kind: 'expense', amount: 200, date: '2026-03-02' }),
        tx({ kind: 'expense', amount: 350, date: '2026-03-03' }),
      ],
      '2026-03',
    )
    expect(s.topExpense).toBe(350)
  })
})

// ============================================================
//  byCategory：補充邊界（total 防零、round 加總 ≠100、同額排序、重複 cat 累加）
// ============================================================

describe('byCategory（補充邊界）', () => {
  it('單一分類 → pct=100', () => {
    expect(byCategory([tx({ categoryId: 'food', amount: 250 })], 'expense')).toEqual([
      { categoryId: 'food', amount: 250, count: 1, pct: 100 },
    ])
  })

  it('三等分 round 後 pct 加總 = 99（33+33+33，非強制湊 100）', () => {
    const txs = [
      tx({ id: '1', categoryId: 'a', amount: 100 }),
      tx({ id: '2', categoryId: 'b', amount: 100 }),
      tx({ id: '3', categoryId: 'c', amount: 100 }),
    ]
    const r = byCategory(txs, 'expense')
    expect(r.map((x) => x.pct)).toEqual([33, 33, 33])
    expect(r.reduce((s, x) => s + x.pct, 0)).toBe(99)
  })

  it('重複 categoryId 累加 amount/count', () => {
    const txs = [
      tx({ id: '1', categoryId: 'food', amount: 30 }),
      tx({ id: '2', categoryId: 'food', amount: 20 }),
      tx({ id: '3', categoryId: 'food', amount: 50 }),
    ]
    expect(byCategory(txs, 'expense')).toEqual([
      { categoryId: 'food', amount: 100, count: 3, pct: 100 },
    ])
  })

  it('過濾另一 kind（指定 income 時唔計 expense）', () => {
    const txs = [
      tx({ kind: 'expense', categoryId: 'food', amount: 999 }),
      tx({ kind: 'income', categoryId: 'salary', amount: 5000 }),
    ]
    expect(byCategory(txs, 'income')).toEqual([
      { categoryId: 'salary', amount: 5000, count: 1, pct: 100 },
    ])
  })
})

// ============================================================
//  monthlyTrend：補充跨年、n=1
// ============================================================

describe('monthlyTrend（補充邊界）', () => {
  it('跨年回推（n=3 from 2026-01）每月 income/expense/balance 正確', () => {
    const txs = [
      tx({ date: '2025-11-10', kind: 'income', amount: 1000 }),
      tx({ date: '2025-12-05', kind: 'expense', amount: 400 }),
      tx({ date: '2026-01-20', kind: 'income', amount: 2000 }),
      tx({ date: '2026-01-22', kind: 'expense', amount: 700 }),
      tx({ date: '2025-09-01', kind: 'expense', amount: 9999 }), // 範圍外（早於窗口）
      tx({ date: '2026-02-01', kind: 'income', amount: 8888 }), // 範圍外（晚於窗口）
    ]
    expect(monthlyTrend(txs, 3, '2026-01')).toEqual([
      { key: '2025-11', income: 1000, expense: 0, balance: 1000 },
      { key: '2025-12', income: 0, expense: 400, balance: -400 },
      { key: '2026-01', income: 2000, expense: 700, balance: 1300 },
    ])
  })

  it('n=1 = 單一當月', () => {
    const txs = [tx({ date: '2026-03-15', kind: 'income', amount: 500 })]
    expect(monthlyTrend(txs, 1, '2026-03')).toEqual([
      { key: '2026-03', income: 500, expense: 0, balance: 500 },
    ])
  })
})

// ============================================================
//  dailyBreakdown：補充閏年、31 日月、超界、同日累加
// ============================================================

describe('dailyBreakdown（補充邊界）', () => {
  it('閏年 2 月 = 29 格', () => {
    const cells = dailyBreakdown([], '2024-02')
    expect(cells.length).toBe(29)
    expect(cells[28]).toEqual({ day: 29, date: '2024-02-29', expense: 0, income: 0 })
  })

  it('31 日月 = 31 格', () => {
    expect(dailyBreakdown([], '2026-01').length).toBe(31)
  })

  it('超界日（d<1 或 d>n）略過', () => {
    // 2 月只有 28 日；29/30/31 號交易應被略過
    const txs = [
      tx({ date: '2026-02-30', kind: 'expense', amount: 999 }),
      tx({ date: '2026-02-15', kind: 'expense', amount: 50 }),
    ]
    const cells = dailyBreakdown(txs, '2026-02')
    expect(cells.length).toBe(28)
    expect(cells[14]).toEqual({ day: 15, date: '2026-02-15', expense: 50, income: 0 })
    // 全月支出總和 = 50（被略過嘅 999 唔計入）
    expect(cells.reduce((s, c) => s + c.expense, 0)).toBe(50)
  })

  it('同日多筆累加（income/expense 分流）', () => {
    const txs = [
      tx({ date: '2026-03-10', kind: 'expense', amount: 30 }),
      tx({ date: '2026-03-10', kind: 'expense', amount: 70 }),
      tx({ date: '2026-03-10', kind: 'income', amount: 500 }),
    ]
    const cells = dailyBreakdown(txs, '2026-03')
    expect(cells[9]).toEqual({ day: 10, date: '2026-03-10', expense: 100, income: 500 })
  })
})

// ============================================================
//  budgetRows / budgetSummary：補充 limit=0 防零、remaining 負、over 排序
// ============================================================

const env = (over: Partial<BudgetEnvelope>): BudgetEnvelope => ({
  id: 'food',
  categoryId: 'food',
  limit: 1000,
  rollover: false,
  updatedAt: '2026-03-01T00:00:00.000Z',
  ...over,
})

describe('budgetRows / budgetSummary（補充邊界）', () => {
  it('limit=0 防除零（pct=0），任何支出即 over（spent>0 > limit）', () => {
    const rows = budgetRows([env({ limit: 0 })], [tx({ categoryId: 'food', amount: 100 })])
    expect(rows[0].pct).toBe(0)
    expect(rows[0].status).toBe('over') // spent(100) > limit(0)
    expect(rows[0].remaining).toBe(-100)
  })

  it('limit=0 且無支出 → spent=0 唔 over（0 不大於 0）→ ok，pct=0', () => {
    const rows = budgetRows([env({ limit: 0 })], [])
    expect(rows[0].status).toBe('ok')
    expect(rows[0].pct).toBe(0)
  })

  it('無對應交易 → spent=0、remaining=limit、status=ok', () => {
    const rows = budgetRows([env({ categoryId: 'food', limit: 1000 })], [])
    expect(rows[0].spent).toBe(0)
    expect(rows[0].remaining).toBe(1000)
    expect(rows[0].status).toBe('ok')
    expect(rows[0].pct).toBe(0)
  })

  it('remaining 負（超支）+ 由 pct 高到低排序', () => {
    const envs = [
      env({ id: 'a', categoryId: 'a', limit: 100 }),
      env({ id: 'b', categoryId: 'b', limit: 100 }),
    ]
    const txs = [
      tx({ categoryId: 'a', amount: 50 }), // 50% ok
      tx({ categoryId: 'b', amount: 300 }), // 300% over, remaining -200
    ]
    const rows = budgetRows(envs, txs)
    expect(rows.map((r) => r.categoryId)).toEqual(['b', 'a']) // pct 降序
    expect(rows[0].remaining).toBe(-200)
    expect(rows[0].pct).toBe(300)
  })

  it('budgetSummary：總超支 remaining 負 + pct 四捨五入 + overCount', () => {
    const rows = budgetRows(
      [
        env({ id: 'a', categoryId: 'a', limit: 300 }),
        env({ id: 'b', categoryId: 'b', limit: 300 }),
      ],
      [
        tx({ categoryId: 'a', amount: 400 }), // over
        tx({ categoryId: 'b', amount: 350 }), // over
      ],
    )
    const s = budgetSummary(rows)
    expect(s.totalLimit).toBe(600)
    expect(s.totalSpent).toBe(750)
    expect(s.remaining).toBe(-150) // 總超支
    // 750/600*100 = 125
    expect(s.pct).toBe(125)
    expect(s.overCount).toBe(2)
  })

  it('budgetSummary：totalLimit=0 防除零（pct=0，無 NaN）', () => {
    const rows = budgetRows([env({ limit: 0 })], [])
    const s = budgetSummary(rows)
    expect(s.totalLimit).toBe(0)
    expect(s.pct).toBe(0)
    expect(Number.isNaN(s.pct)).toBe(false)
  })
})
