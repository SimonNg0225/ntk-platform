import { describe, it, expect, afterEach, vi } from 'vitest'
import { finishedInYear, finishedThisYear } from './util'
import type { Book } from './types'

// ============================================================
//  年度閱讀挑戰：finishedInYear / finishedThisYear
//  ------------------------------------------------------------
//  純函式（無 React），只測計算。
//  關鍵：只計 status='done'，按 finishedOn 本地年份歸類；
//  缺 finishedOn 用 createdAt 嘅本地年份（非 UTC slice，避免漂移）。
// ============================================================
const book = (over: Partial<Book> = {}): Book => ({
  id: 'b',
  title: 't',
  status: 'to_read',
  shelves: [],
  sessions: [],
  createdAt: '2020-01-01T00:00:00.000Z',
  ...over,
})

describe('finishedInYear', () => {
  it('空陣列 → 0（守空）', () => {
    expect(finishedInYear([], 2026)).toBe(0)
  })

  it('只計 status=done；reading/to_read/dnf 一律唔計（即使有 finishedOn）', () => {
    const books: Book[] = [
      book({ status: 'done', finishedOn: '2026-03-01' }),
      book({ status: 'reading', finishedOn: '2026-03-01' }),
      book({ status: 'to_read', finishedOn: '2026-03-01' }),
      book({ status: 'dnf', finishedOn: '2026-03-01' }),
    ]
    expect(finishedInYear(books, 2026)).toBe(1)
  })

  it('按 finishedOn 年份歸類，只數指定年', () => {
    const books: Book[] = [
      book({ status: 'done', finishedOn: '2026-01-01' }),
      book({ status: 'done', finishedOn: '2026-07-15' }),
      book({ status: 'done', finishedOn: '2026-12-31' }),
      book({ status: 'done', finishedOn: '2025-12-31' }), // 上年
      book({ status: 'done', finishedOn: '2027-01-01' }), // 下年
    ]
    expect(finishedInYear(books, 2026)).toBe(3)
    expect(finishedInYear(books, 2025)).toBe(1)
    expect(finishedInYear(books, 2027)).toBe(1)
    expect(finishedInYear(books, 2024)).toBe(0)
  })

  it('年份邊界：12-31 屬該年、01-01 屬下一年（唔混淆）', () => {
    const books: Book[] = [
      book({ id: 'a', status: 'done', finishedOn: '2026-12-31' }),
      book({ id: 'b', status: 'done', finishedOn: '2027-01-01' }),
    ]
    expect(finishedInYear(books, 2026)).toBe(1)
    expect(finishedInYear(books, 2027)).toBe(1)
  })

  it('前綴比對唔會撞year（2026 唔會誤中 20260 之類；年份係嚴格 YYYY- 前綴）', () => {
    // finishedOn 永遠 YYYY-MM-DD，故 '2026-' 前綴只中 2026 年。
    const books: Book[] = [
      book({ status: 'done', finishedOn: '2026-02-02' }),
      book({ status: 'done', finishedOn: '2020-26-99' as string }), // 畸形：唔以 '2026-' 開頭
    ]
    expect(finishedInYear(books, 2026)).toBe(1)
  })

  it('done 但缺 finishedOn → 用 createdAt 本地年份（非 UTC slice）', () => {
    // 本地 2026-01-01 01:00 → toISOString()=2025-12-31T17:00:00Z（HK UTC+8）。
    // 若用 UTC slice 會誤判為 2025；正解用本地 key → 2026。
    const localNewYear = new Date(2026, 0, 1, 1, 0, 0).toISOString()
    const books: Book[] = [book({ status: 'done', createdAt: localNewYear })]
    expect(finishedInYear(books, 2026)).toBe(1)
    expect(finishedInYear(books, 2025)).toBe(0)
  })

  it('finishedOn 在場時優先於 createdAt', () => {
    const books: Book[] = [
      book({
        status: 'done',
        finishedOn: '2026-06-10',
        createdAt: '2020-01-01T00:00:00.000Z',
      }),
    ]
    expect(finishedInYear(books, 2026)).toBe(1)
    expect(finishedInYear(books, 2020)).toBe(0)
  })

  it('混合大組：只數該年 done', () => {
    const books: Book[] = [
      book({ status: 'done', finishedOn: '2026-01-05' }),
      book({ status: 'done', finishedOn: '2026-02-05' }),
      book({ status: 'done', finishedOn: '2026-11-05' }),
      book({ status: 'reading', finishedOn: '2026-03-05' }),
      book({ status: 'done', finishedOn: '2025-06-05' }),
    ]
    expect(finishedInYear(books, 2026)).toBe(3)
  })
})

// ============================================================
//  finishedThisYear — 依賴 thisYear()（new Date().getFullYear()）
//  鎖系統時間令斷言確定（本地 constructor → 任何 CI TZ 一致）。
// ============================================================
describe('finishedThisYear', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('鎖今日為本地 2026-05-31 → 數 2026 年 done', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 31, 10, 0, 0))
    const books: Book[] = [
      book({ status: 'done', finishedOn: '2026-01-01' }),
      book({ status: 'done', finishedOn: '2026-05-30' }),
      book({ status: 'done', finishedOn: '2025-12-31' }), // 上年唔計
      book({ status: 'reading', finishedOn: '2026-05-01' }), // 未讀完唔計
    ]
    expect(finishedThisYear(books)).toBe(2)
  })

  it('跨年後（鎖 2027-01-02）：去年讀完唔再計入今年', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2027, 0, 2, 9, 0, 0))
    const books: Book[] = [
      book({ status: 'done', finishedOn: '2026-12-31' }), // 去年
      book({ status: 'done', finishedOn: '2027-01-01' }), // 今年
    ]
    expect(finishedThisYear(books)).toBe(1)
  })

  it('空陣列 → 0', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 31, 10, 0, 0))
    expect(finishedThisYear([])).toBe(0)
  })
})
