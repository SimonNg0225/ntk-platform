import { describe, it, expect } from 'vitest'
import {
  monthKey,
  shiftMonth,
  monthLabel,
  monthShort,
  fmtDate,
  dowOf,
  daysInMonth,
  fmtMoney,
  fmtMoneyShort,
  round1,
  recentMonths,
  inMonth,
  computeMonthStats,
  byCategory,
  monthlyTrend,
  dailyBreakdown,
  budgetRows,
  budgetSummary,
  daysBetween,
  filtersActive,
  applyFilters,
  sortTxDesc,
  csvEscape,
  txToCsvRows,
  parseCsv,
  csvRowsToTx,
  txCsvTemplate,
  EMPTY_FILTERS,
  type BudgetEnvelope,
} from './util'
import type { Transaction, TxCategory } from '../../../data/types'

// ── 測試輔助：造一筆交易（只填關心嘅欄位） ──
const tx = (over: Partial<Transaction>): Transaction => ({
  id: 'x',
  kind: 'expense',
  amount: 100,
  categoryId: 'food',
  date: '2026-03-15',
  createdAt: '2026-03-15T00:00:00.000Z',
  ...over,
})

const env = (over: Partial<BudgetEnvelope>): BudgetEnvelope => ({
  id: 'food',
  categoryId: 'food',
  limit: 1000,
  rollover: false,
  updatedAt: '2026-03-01T00:00:00.000Z',
  ...over,
})

// ============================================================
//  日期 / 格式化（本地時區，無 UTC off-by-one）
// ============================================================

describe('monthKey', () => {
  it('用本地年月（非 UTC）', () => {
    // 喺 UTC+8，2026-05-15 本地仍係 5 月；確認用 getMonth 而唔係 toISOString
    expect(monthKey(new Date(2026, 4, 15))).toBe('2026-05')
  })
  it('月份補零', () => {
    expect(monthKey(new Date(2026, 0, 1))).toBe('2026-01')
    expect(monthKey(new Date(2026, 11, 31))).toBe('2026-12')
  })
  it('本地午夜唔會漂去上一日／上一月', () => {
    // 1 月 1 日本地 00:00（UTC+8 = 前一年 12-31 16:00 UTC）。
    // 若誤用 toISOString 會變 2025-12，本實作用本地 getter 應為 2026-01。
    expect(monthKey(new Date(2026, 0, 1, 0, 0, 0))).toBe('2026-01')
  })
})

describe('shiftMonth', () => {
  it('向後一個月', () => expect(shiftMonth('2026-03', 1)).toBe('2026-04'))
  it('跨年向後（12→翌年 1）', () => expect(shiftMonth('2026-12', 1)).toBe('2027-01'))
  it('跨年向前（1→上年 12）', () => expect(shiftMonth('2026-01', -1)).toBe('2025-12'))
  it('零位移 = 原值', () => expect(shiftMonth('2026-07', 0)).toBe('2026-07'))
  it('多月跨年', () => expect(shiftMonth('2026-02', -3)).toBe('2025-11'))
})

describe('monthLabel / monthShort', () => {
  it('monthLabel 去前導零', () => expect(monthLabel('2026-05')).toBe('2026 年 5 月'))
  it('monthLabel 12 月', () => expect(monthLabel('2026-12')).toBe('2026 年 12 月'))
  it('monthShort', () => expect(monthShort('2026-05')).toBe('5月'))
})

describe('fmtDate', () => {
  it('去前導零', () => expect(fmtDate('2026-05-23')).toBe('5月23日'))
  it('個位月日', () => expect(fmtDate('2026-01-09')).toBe('1月9日'))
})

describe('dowOf（星期幾，0=日，本地時區）', () => {
  it('2026-05-04 係星期一 = 1', () => expect(dowOf('2026-05-04')).toBe(1))
  it('2026-05-03 係星期日 = 0', () => expect(dowOf('2026-05-03')).toBe(0))
  it('2026-05-09 係星期六 = 6', () => expect(dowOf('2026-05-09')).toBe(6))
  it('月初本地日期唔漂移（UTC+8 唔會變上一日）', () => {
    // 2026-03-01 係星期日 = 0；若用 UTC 會錯成週六(6)
    expect(dowOf('2026-03-01')).toBe(0)
  })
})

describe('daysInMonth', () => {
  it('普通 31 日月', () => expect(daysInMonth('2026-01')).toBe(31))
  it('30 日月', () => expect(daysInMonth('2026-04')).toBe(30))
  it('2 月（非閏年 2026）= 28', () => expect(daysInMonth('2026-02')).toBe(28))
  it('2 月（閏年 2024）= 29', () => expect(daysInMonth('2024-02')).toBe(29))
  it('12 月 = 31', () => expect(daysInMonth('2026-12')).toBe(31))
})

describe('fmtMoney', () => {
  it('零', () => expect(fmtMoney(0)).toBe('HK$0'))
  it('千分位', () => expect(fmtMoney(1234567)).toBe('HK$1,234,567'))
  it('小數最多 2 位', () => expect(fmtMoney(1234.5)).toBe('HK$1,234.5'))
  it('負數放 sign 喺 HK$ 前', () => expect(fmtMoney(-1234)).toBe('-HK$1,234'))
  it('四捨五入到 2 位', () => expect(fmtMoney(1234.567)).toBe('HK$1,234.57'))
})

describe('fmtMoneyShort', () => {
  it('< 1000 取整', () => expect(fmtMoneyShort(999)).toBe('HK$999'))
  it('1.2k', () => expect(fmtMoneyShort(1200)).toBe('HK$1.2k'))
  it('1M', () => expect(fmtMoneyShort(1_000_000)).toBe('HK$1M'))
  it('1.5M', () => expect(fmtMoneyShort(1_500_000)).toBe('HK$1.5M'))
  it('負數 < 1000', () => expect(fmtMoneyShort(-500)).toBe('-HK$500'))
  it('負數 k', () => expect(fmtMoneyShort(-2300)).toBe('-HK$2.3k'))
  it('零', () => expect(fmtMoneyShort(0)).toBe('HK$0'))
})

describe('round1', () => {
  it('保留 1 位', () => expect(round1(2.44)).toBe(2.4))
  it('進位', () => expect(round1(2.46)).toBe(2.5))
  it('負數', () => expect(round1(-2.46)).toBe(-2.5))
  it('整數不變', () => expect(round1(5)).toBe(5))
})

describe('recentMonths（固定 fromKey，deterministic）', () => {
  it('由舊到新', () =>
    expect(recentMonths(3, '2026-03')).toEqual(['2026-01', '2026-02', '2026-03']))
  it('跨年回推', () =>
    expect(recentMonths(3, '2026-01')).toEqual(['2025-11', '2025-12', '2026-01']))
  it('n=1 = 當月', () => expect(recentMonths(1, '2026-06')).toEqual(['2026-06']))
})

describe('inMonth', () => {
  it('同月 true', () => expect(inMonth({ date: '2026-03-15' }, '2026-03')).toBe(true))
  it('異月 false', () => expect(inMonth({ date: '2026-04-01' }, '2026-03')).toBe(false))
})

// ============================================================
//  統計核心（用「過去月」避開 todayIso 非確定性）
// ============================================================

describe('computeMonthStats（過去月 2026-03，相對 2026-05-31 為過去）', () => {
  it('空陣列：全 0，savingsRate=null，無 NaN', () => {
    const s = computeMonthStats([], '2026-03')
    expect(s).toEqual({
      income: 0,
      expense: 0,
      balance: 0,
      count: 0,
      savingsRate: null,
      dailyAvg: 0,
      topExpense: 0,
      projectedExpense: 0,
    })
  })

  it('收支匯總 + 儲蓄率 + 日均（過去月用全月日數 31）', () => {
    const txs = [
      tx({ kind: 'income', amount: 10000, categoryId: 'salary' }),
      tx({ kind: 'expense', amount: 3100, categoryId: 'rent' }),
      tx({ kind: 'expense', amount: 100, categoryId: 'food' }),
    ]
    const s = computeMonthStats(txs, '2026-03')
    expect(s.income).toBe(10000)
    expect(s.expense).toBe(3200)
    expect(s.balance).toBe(6800)
    expect(s.count).toBe(3)
    // (10000-3200)/10000*100 = 68
    expect(s.savingsRate).toBe(68)
    // 過去月：expense / daysInMonth(31) = 3200/31 = 103.2258… 唔 round
    expect(s.dailyAvg).toBeCloseTo(3200 / 31, 10)
    expect(s.topExpense).toBe(3100)
    // 過去月 projectedExpense = expense
    expect(s.projectedExpense).toBe(3200)
  })

  it('只有支出無收入：savingsRate=null', () => {
    const s = computeMonthStats([tx({ amount: 500 })], '2026-03')
    expect(s.savingsRate).toBeNull()
    expect(s.expense).toBe(500)
  })

  it('儲蓄率四捨五入到 1 位', () => {
    // income 3000, expense 1000 → 2000/3000*100 = 66.666… → 66.7
    const s = computeMonthStats(
      [tx({ kind: 'income', amount: 3000 }), tx({ kind: 'expense', amount: 1000 })],
      '2026-03',
    )
    expect(s.savingsRate).toBe(66.7)
  })
})

describe('byCategory', () => {
  it('空陣列 → []', () => expect(byCategory([], 'expense')).toEqual([]))

  it('按分類匯總並由大到細排，pct 取整', () => {
    const txs = [
      tx({ categoryId: 'food', amount: 30 }),
      tx({ categoryId: 'food', amount: 20 }),
      tx({ categoryId: 'rent', amount: 70 }),
    ]
    const r = byCategory(txs, 'expense')
    // total = 120；rent 70 (58%), food 50 (42%) → 由大到細
    expect(r).toEqual([
      { categoryId: 'rent', amount: 70, count: 1, pct: 58 },
      { categoryId: 'food', amount: 50, count: 2, pct: 42 },
    ])
  })

  it('只計指定 kind', () => {
    const txs = [
      tx({ kind: 'income', categoryId: 'salary', amount: 9000 }),
      tx({ kind: 'expense', categoryId: 'food', amount: 100 }),
    ]
    expect(byCategory(txs, 'income')).toEqual([
      { categoryId: 'salary', amount: 9000, count: 1, pct: 100 },
    ])
  })
})

describe('monthlyTrend（固定 fromKey）', () => {
  it('空交易：每月 0', () => {
    expect(monthlyTrend([], 2, '2026-03')).toEqual([
      { key: '2026-02', income: 0, expense: 0, balance: 0 },
      { key: '2026-03', income: 0, expense: 0, balance: 0 },
    ])
  })

  it('歸入對應月，範圍外略過，balance=income-expense', () => {
    const txs = [
      tx({ date: '2026-02-10', kind: 'income', amount: 5000 }),
      tx({ date: '2026-03-05', kind: 'expense', amount: 1200 }),
      tx({ date: '2026-03-20', kind: 'income', amount: 8000 }),
      tx({ date: '2026-01-01', kind: 'expense', amount: 999 }), // 範圍外
    ]
    expect(monthlyTrend(txs, 2, '2026-03')).toEqual([
      { key: '2026-02', income: 5000, expense: 0, balance: 5000 },
      { key: '2026-03', income: 8000, expense: 1200, balance: 6800 },
    ])
  })
})

describe('dailyBreakdown', () => {
  it('2 月非閏 → 28 格，逐日 0', () => {
    const cells = dailyBreakdown([], '2026-02')
    expect(cells.length).toBe(28)
    expect(cells[0]).toEqual({ day: 1, date: '2026-02-01', expense: 0, income: 0 })
    expect(cells[27]).toEqual({ day: 28, date: '2026-02-28', expense: 0, income: 0 })
  })

  it('歸日，補零日期，超界略過', () => {
    const txs = [
      tx({ date: '2026-03-01', kind: 'expense', amount: 10 }),
      tx({ date: '2026-03-01', kind: 'income', amount: 100 }),
      tx({ date: '2026-03-15', kind: 'expense', amount: 25 }),
    ]
    const cells = dailyBreakdown(txs, '2026-03')
    expect(cells.length).toBe(31)
    expect(cells[0]).toEqual({ day: 1, date: '2026-03-01', expense: 10, income: 100 })
    expect(cells[14]).toEqual({ day: 15, date: '2026-03-15', expense: 25, income: 0 })
  })
})

// ============================================================
//  預算狀態
// ============================================================

describe('budgetRows', () => {
  it('空 envelope → []', () => expect(budgetRows([], [])).toEqual([]))

  it('狀態分級 + remaining + 由 pct 高到低排', () => {
    const envs = [
      env({ id: 'food', categoryId: 'food', limit: 1000 }),
      env({ id: 'rent', categoryId: 'rent', limit: 2000 }),
      env({ id: 'fun', categoryId: 'fun', limit: 500 }),
    ]
    const txs = [
      tx({ categoryId: 'food', amount: 850 }), // 85% → warn
      tx({ categoryId: 'rent', amount: 2100 }), // 105% → over
      tx({ categoryId: 'fun', amount: 100 }), // 20% → ok
    ]
    const rows = budgetRows(envs, txs)
    // 排序：over(rent 105) > warn(food 85) > ok(fun 20)
    expect(rows.map((r) => r.categoryId)).toEqual(['rent', 'food', 'fun'])
    expect(rows[0]).toEqual({
      categoryId: 'rent',
      limit: 2000,
      spent: 2100,
      remaining: -100,
      pct: 105,
      status: 'over',
      rollover: false,
    })
    expect(rows[1].status).toBe('warn')
    expect(rows[1].pct).toBe(85)
    expect(rows[2].status).toBe('ok')
    expect(rows[2].remaining).toBe(400)
  })

  it('剛好 80% = warn（邊界）', () => {
    const rows = budgetRows([env({ limit: 1000 })], [tx({ categoryId: 'food', amount: 800 })])
    expect(rows[0].pct).toBe(80)
    expect(rows[0].status).toBe('warn')
  })

  it('剛好等於上限唔當 over（spent 不大於 limit）', () => {
    const rows = budgetRows([env({ limit: 1000 })], [tx({ categoryId: 'food', amount: 1000 })])
    expect(rows[0].status).toBe('warn') // 100% 但唔 over
    expect(rows[0].remaining).toBe(0)
  })

  it('只計支出，收入唔當使費', () => {
    const rows = budgetRows(
      [env({ categoryId: 'food', limit: 1000 })],
      [tx({ categoryId: 'food', kind: 'income', amount: 5000 })],
    )
    expect(rows[0].spent).toBe(0)
    expect(rows[0].status).toBe('ok')
  })
})

describe('budgetSummary', () => {
  it('空 → 全 0，pct=0（無除零 NaN）', () => {
    expect(budgetSummary([])).toEqual({
      totalLimit: 0,
      totalSpent: 0,
      remaining: 0,
      pct: 0,
      overCount: 0,
    })
  })

  it('匯總 + overCount', () => {
    const rows = budgetRows(
      [
        env({ id: 'food', categoryId: 'food', limit: 1000 }),
        env({ id: 'rent', categoryId: 'rent', limit: 2000 }),
      ],
      [
        tx({ categoryId: 'food', amount: 1200 }), // over
        tx({ categoryId: 'rent', amount: 500 }),
      ],
    )
    const s = budgetSummary(rows)
    expect(s.totalLimit).toBe(3000)
    expect(s.totalSpent).toBe(1700)
    expect(s.remaining).toBe(1300)
    // 1700/3000*100 = 56.66 → round = 57
    expect(s.pct).toBe(57)
    expect(s.overCount).toBe(1)
  })
})

// ============================================================
//  定期收支：daysBetween（純）
// ============================================================

describe('daysBetween（本地日期，HK 無 DST → 每日剛好 864e5ms）', () => {
  it('同日 = 0', () => expect(daysBetween('2026-03-15', '2026-03-15')).toBe(0))
  it('正向相差', () => expect(daysBetween('2026-03-01', '2026-03-04')).toBe(3))
  it('反向 = 負', () => expect(daysBetween('2026-03-04', '2026-03-01')).toBe(-3))
  it('跨月', () => expect(daysBetween('2026-02-28', '2026-03-01')).toBe(1))
  it('跨年（2025-12-31 → 2026-01-01）', () =>
    expect(daysBetween('2025-12-31', '2026-01-01')).toBe(1))
})

// ============================================================
//  搜尋 / 篩選
// ============================================================

describe('filtersActive', () => {
  it('預設 = 無 active', () => expect(filtersActive(EMPTY_FILTERS)).toBe(false))
  it('改 kind = active', () =>
    expect(filtersActive({ ...EMPTY_FILTERS, kind: 'income' })).toBe(true))
  it('淨空白字 text 唔算 active', () =>
    expect(filtersActive({ ...EMPTY_FILTERS, text: '   ' })).toBe(false))
  it('min=0 都算 active（!= null）', () =>
    expect(filtersActive({ ...EMPTY_FILTERS, min: 0 })).toBe(true))
})

describe('applyFilters', () => {
  const cat = (id: string) => (id === 'food' ? '餐飲' : id === 'salary' ? '薪金' : '其他')
  const data: Transaction[] = [
    tx({ id: '1', kind: 'expense', categoryId: 'food', amount: 50, note: '午餐' }),
    tx({ id: '2', kind: 'income', categoryId: 'salary', amount: 9000, note: '人工' }),
    tx({ id: '3', kind: 'expense', categoryId: 'food', amount: 500, note: '聚餐' }),
  ]

  it('無篩選 = 原樣', () =>
    expect(applyFilters(data, EMPTY_FILTERS, cat).map((t) => t.id)).toEqual(['1', '2', '3']))

  it('按 kind', () =>
    expect(
      applyFilters(data, { ...EMPTY_FILTERS, kind: 'income' }, cat).map((t) => t.id),
    ).toEqual(['2']))

  it('按 categoryId', () =>
    expect(
      applyFilters(data, { ...EMPTY_FILTERS, categoryId: 'food' }, cat).map((t) => t.id),
    ).toEqual(['1', '3']))

  it('min/max 區間（含邊界）', () =>
    expect(
      applyFilters(data, { ...EMPTY_FILTERS, min: 50, max: 500 }, cat).map((t) => t.id),
    ).toEqual(['1', '3']))

  it('文字搜尋 note 同分類名（大小寫不敏感）', () =>
    expect(applyFilters(data, { ...EMPTY_FILTERS, text: '餐飲' }, cat).map((t) => t.id)).toEqual([
      '1',
      '3',
    ]))

  it('文字配 note', () =>
    expect(applyFilters(data, { ...EMPTY_FILTERS, text: '人工' }, cat).map((t) => t.id)).toEqual([
      '2',
    ]))
})

describe('sortTxDesc（日期新→舊；同日 createdAt 新→舊）', () => {
  it('排序穩定', () => {
    const list: Transaction[] = [
      tx({ id: 'a', date: '2026-03-01', createdAt: '2026-03-01T08:00:00Z' }),
      tx({ id: 'b', date: '2026-03-05', createdAt: '2026-03-05T08:00:00Z' }),
      tx({ id: 'c', date: '2026-03-05', createdAt: '2026-03-05T10:00:00Z' }),
    ]
    expect([...list].sort(sortTxDesc).map((t) => t.id)).toEqual(['c', 'b', 'a'])
  })
  it('同筆比較 = 0（comparator 自反）', () => {
    const t = tx({ id: 'a', date: '2026-03-01', createdAt: '2026-03-01T08:00:00Z' })
    expect(sortTxDesc(t, t)).toBe(0)
  })
})

// ============================================================
//  CSV
// ============================================================

describe('csvEscape', () => {
  it('普通字唔包', () => expect(csvEscape('hello')).toBe('hello'))
  it('數字 → 字串', () => expect(csvEscape(123)).toBe('123'))
  it('含逗號要包引號', () => expect(csvEscape('a,b')).toBe('"a,b"'))
  it('含引號要 double 並包', () => expect(csvEscape('say "hi"')).toBe('"say ""hi"""'))
  it('含換行要包', () => expect(csvEscape('a\nb')).toBe('"a\nb"'))
})

describe('txToCsvRows', () => {
  const cats: TxCategory[] = [
    { id: 'food', name: '餐飲', kind: 'expense', createdAt: '2026-01-01T00:00:00Z' },
    { id: 'salary', name: '薪金', kind: 'income', createdAt: '2026-01-01T00:00:00Z' },
  ]
  it('表頭 + 收入正/支出負金額 + 已刪分類 fallback', () => {
    const txs: Transaction[] = [
      tx({ id: '1', date: '2026-03-05', kind: 'expense', categoryId: 'food', amount: 80, note: '午餐' }),
      tx({ id: '2', date: '2026-03-10', kind: 'income', categoryId: 'salary', amount: 9000, note: '' }),
      tx({ id: '3', date: '2026-03-01', kind: 'expense', categoryId: 'ghost', amount: 50, note: undefined }),
    ]
    const rows = txToCsvRows(txs, cats)
    expect(rows[0]).toEqual(['日期', '類型', '分類', '金額', '備註'])
    // 排序：日期新→舊 → 03-10, 03-05, 03-01
    expect(rows[1]).toEqual(['2026-03-10', '收入', '薪金', 9000, ''])
    expect(rows[2]).toEqual(['2026-03-05', '支出', '餐飲', -80, '午餐'])
    expect(rows[3]).toEqual(['2026-03-01', '支出', '未分類', -50, ''])
  })
})

// ============================================================
//  CSV 匯入：parseCsv（鏡像題庫零依賴 parser）
// ============================================================

describe('parseCsv', () => {
  it('空輸入 → []', () => expect(parseCsv('')).toEqual([]))
  it('純空白 / 空行過濾掉', () => {
    expect(parseCsv('\n  \n,,\n')).toEqual([])
  })
  it('基本逗號切欄', () => {
    expect(parseCsv('a,b,c')).toEqual([['a', 'b', 'c']])
  })
  it('檔尾無換行嘅最後一行都收得到', () => {
    expect(parseCsv('a,b\nc,d')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ])
  })
  it('引號包欄位入面嘅逗號當文字', () => {
    expect(parseCsv('a,"b,c",d')).toEqual([['a', 'b,c', 'd']])
  })
  it('逃逸雙引號（""→ "）', () => {
    expect(parseCsv('"say ""hi"""')).toEqual([['say "hi"']])
  })
  it('引號內換行保留', () => {
    expect(parseCsv('"line1\nline2",x')).toEqual([['line1\nline2', 'x']])
  })
  it('\\r\\n 同 \\r 都正規化成換行', () => {
    expect(parseCsv('a,b\r\nc,d\re,f')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
      ['e', 'f'],
    ])
  })
  it('去除開頭 BOM', () => {
    expect(parseCsv('﻿日期,金額')).toEqual([['日期', '金額']])
  })
})

// ============================================================
//  CSV 匯入：csvRowsToTx（解析 + fuzzy 對分類 + 略過）
// ============================================================

describe('csvRowsToTx', () => {
  const cats: TxCategory[] = [
    { id: 'food', name: '飲食', kind: 'expense', createdAt: '2026-01-01T00:00:00Z' },
    { id: 'transport', name: '交通', kind: 'expense', createdAt: '2026-01-01T00:00:00Z' },
    { id: 'salary', name: '薪金', kind: 'income', createdAt: '2026-01-01T00:00:00Z' },
  ]

  it('空 rows → 空結果', () => {
    expect(csvRowsToTx([], cats)).toEqual({ parsed: [], skipped: 0 })
  })

  it('帶表頭（中文）：依欄名定位、收入正/支出負、分類完全對應', () => {
    const rows = parseCsv(
      [
        '日期,類型,分類,金額,備註',
        '2026-05-03,支出,飲食,68,午餐',
        '2026-05-05,收入,薪金,18000,五月人工',
      ].join('\n'),
    )
    const { parsed, skipped } = csvRowsToTx(rows, cats)
    expect(skipped).toBe(0)
    expect(parsed).toHaveLength(2)
    expect(parsed[0]).toMatchObject({
      kind: 'expense',
      amount: 68,
      categoryId: 'food',
      date: '2026-05-03',
      note: '午餐',
      matched: true,
    })
    expect(parsed[1]).toMatchObject({
      kind: 'income',
      amount: 18000,
      categoryId: 'salary',
      date: '2026-05-05',
      note: '五月人工',
      matched: true,
    })
  })

  it('無表頭：用固定欄序（日期/類型/分類/金額/備註）', () => {
    const rows = parseCsv('2026-05-03,支出,交通,50,巴士')
    const { parsed } = csvRowsToTx(rows, cats)
    expect(parsed[0]).toMatchObject({ categoryId: 'transport', amount: 50, kind: 'expense' })
  })

  it('類型留空：由金額正負推斷（負→支出、正→收入）', () => {
    const rows = parseCsv(
      ['日期,類型,分類,金額,備註', '2026-05-03,,飲食,-68,', '2026-05-05,,薪金,18000,'].join('\n'),
    )
    const { parsed } = csvRowsToTx(rows, cats)
    expect(parsed[0]).toMatchObject({ kind: 'expense', amount: 68 })
    expect(parsed[1]).toMatchObject({ kind: 'income', amount: 18000 })
  })

  it('金額取絕對值（正負只代表類型，唔會入負數）', () => {
    const rows = parseCsv('2026-05-03,支出,飲食,-68,')
    expect(csvRowsToTx(rows, cats).parsed[0].amount).toBe(68)
  })

  it('金額去除貨幣符號 / 千分位', () => {
    const rows = parseCsv('2026-05-03,收入,薪金,"HK$18,000.50",')
    expect(csvRowsToTx(rows, cats).parsed[0].amount).toBe(18000.5)
  })

  it('英文類型 income/expense 都認得', () => {
    const rows = parseCsv(
      ['date,type,category,amount,note', '2026-05-03,expense,飲食,68,', '2026-05-05,income,薪金,18000,'].join('\n'),
    )
    const { parsed } = csvRowsToTx(rows, cats)
    expect(parsed[0].kind).toBe('expense')
    expect(parsed[1].kind).toBe('income')
  })

  it('分類 fuzzy：部分包含都對應到', () => {
    const rows = parseCsv('2026-05-03,支出,飲食開支,68,')
    expect(csvRowsToTx(rows, cats).parsed[0]).toMatchObject({
      categoryId: 'food',
      matched: true,
    })
  })

  it('分類對唔到 → categoryId 空 + matched=false + 保留原名', () => {
    const rows = parseCsv('2026-05-03,支出,旅行,500,沖繩')
    expect(csvRowsToTx(rows, cats).parsed[0]).toMatchObject({
      categoryId: '',
      matched: false,
      rawCategory: '旅行',
    })
  })

  it('同名跨類型：優先對應符合類型嗰個', () => {
    const dualCats: TxCategory[] = [
      { id: 'bonus-in', name: '獎金', kind: 'income', createdAt: '2026-01-01T00:00:00Z' },
      { id: 'bonus-out', name: '獎金', kind: 'expense', createdAt: '2026-01-01T00:00:00Z' },
    ]
    const rows = parseCsv('2026-05-03,收入,獎金,1000,')
    expect(csvRowsToTx(rows, dualCats).parsed[0].categoryId).toBe('bonus-in')
  })

  it('日期 YYYY/M/D 正規化成 YYYY-MM-DD（補零）', () => {
    const rows = parseCsv('2026/5/3,支出,飲食,68,')
    expect(csvRowsToTx(rows, cats).parsed[0].date).toBe('2026-05-03')
  })

  it('略過：無效日期 / 金額空白 / 金額零', () => {
    const rows = parseCsv(
      [
        '日期,類型,分類,金額,備註',
        '唔係日期,支出,飲食,68,',
        '2026-05-03,支出,飲食,,缺金額',
        '2026-05-04,支出,飲食,0,零',
        '2026-05-05,支出,飲食,68,有效',
      ].join('\n'),
    )
    const { parsed, skipped } = csvRowsToTx(rows, cats)
    expect(skipped).toBe(3)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].note).toBe('有效')
  })

  it('非法月份日子（13 月 / 32 日）略過', () => {
    const rows = parseCsv(
      ['日期,類型,分類,金額,備註', '2026-13-01,支出,飲食,10,', '2026-05-32,支出,飲食,10,'].join('\n'),
    )
    expect(csvRowsToTx(rows, cats).skipped).toBe(2)
  })

  it('備註留空 → note undefined（唔會變空字串）', () => {
    const rows = parseCsv('2026-05-03,支出,飲食,68,')
    expect(csvRowsToTx(rows, cats).parsed[0].note).toBeUndefined()
  })
})

// ── 匯出 → 匯入往返：匯出嘅 CSV 餵返匯入應該還原到等價交易 ──
describe('匯出 / 匯入往返一致', () => {
  const cats: TxCategory[] = [
    { id: 'food', name: '飲食', kind: 'expense', createdAt: '2026-01-01T00:00:00Z' },
    { id: 'salary', name: '薪金', kind: 'income', createdAt: '2026-01-01T00:00:00Z' },
  ]
  it('txToCsvRows → CSV 文字 → parseCsv → csvRowsToTx 還原', () => {
    const txs: Transaction[] = [
      tx({ id: '1', date: '2026-03-05', kind: 'expense', categoryId: 'food', amount: 80, note: '午, 餐' }),
      tx({ id: '2', date: '2026-03-10', kind: 'income', categoryId: 'salary', amount: 9000, note: '' }),
    ]
    const csvText = txToCsvRows(txs, cats)
      .map((r) => r.map((v) => csvEscape(v)).join(','))
      .join('\n')
    const { parsed, skipped } = csvRowsToTx(parseCsv(csvText), cats)
    expect(skipped).toBe(0)
    // 匯出按日期新→舊：先 03-10（收入），再 03-05（支出）
    expect(parsed[0]).toMatchObject({ kind: 'income', amount: 9000, categoryId: 'salary' })
    expect(parsed[1]).toMatchObject({
      kind: 'expense',
      amount: 80,
      categoryId: 'food',
      note: '午, 餐',
    })
  })
})

describe('txCsvTemplate', () => {
  it('範本可被自己解析 + 對應到預設分類', () => {
    const cats: TxCategory[] = [
      { id: 'food', name: '飲食', kind: 'expense', createdAt: '2026-01-01T00:00:00Z' },
      { id: 'salary', name: '薪金', kind: 'income', createdAt: '2026-01-01T00:00:00Z' },
      { id: 'transport', name: '交通', kind: 'expense', createdAt: '2026-01-01T00:00:00Z' },
    ]
    const { parsed, skipped } = csvRowsToTx(parseCsv(txCsvTemplate()), cats)
    expect(skipped).toBe(0)
    expect(parsed).toHaveLength(3)
    expect(parsed.every((p) => p.matched)).toBe(true)
  })
})
