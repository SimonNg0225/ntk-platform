import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readingPace } from './util'
import type { Book, ReadingSession } from './types'

// ============================================================
//  閱讀步速 + 預計讀完日（readingPace）
//  ------------------------------------------------------------
//  預設 today 用 todayKey() → 依賴 new Date()。
//  用 vi.setSystemTime 鎖死「今日」為本地 2026-06-01，
//  令 etaKey / daysLeft 斷言確定（本地 constructor + 本地 getter，唔會 UTC 漂移）。
//  大部分情況直接傳 today 參數，唔依賴系統時鐘。
// ============================================================
const session = (over: Partial<ReadingSession> = {}): ReadingSession => ({
  id: 's',
  date: '2020-01-01',
  pages: 0,
  ...over,
})

const book = (over: Partial<Book> = {}): Book => ({
  id: 'b',
  title: 't',
  status: 'to_read',
  shelves: [],
  sessions: [],
  createdAt: '2020-01-01T00:00:00.000Z',
  ...over,
})

describe('readingPace — 缺料回 null', () => {
  it('非「在讀」→ null（即使有 startedOn / totalPages / currentPage）', () => {
    const base = { startedOn: '2026-05-01', totalPages: 200, currentPage: 50 }
    expect(readingPace(book({ ...base, status: 'to_read' }), '2026-05-11')).toBeNull()
    expect(readingPace(book({ ...base, status: 'done' }), '2026-05-11')).toBeNull()
    expect(readingPace(book({ ...base, status: 'dnf' }), '2026-05-11')).toBeNull()
  })

  it('無 startedOn → null', () => {
    expect(
      readingPace(book({ status: 'reading', totalPages: 200, currentPage: 50 }), '2026-05-11'),
    ).toBeNull()
  })

  it('無 totalPages / totalPages <= 0 → null', () => {
    expect(
      readingPace(book({ status: 'reading', startedOn: '2026-05-01', currentPage: 50 }), '2026-05-11'),
    ).toBeNull()
    expect(
      readingPace(
        book({ status: 'reading', startedOn: '2026-05-01', totalPages: 0, currentPage: 50 }),
        '2026-05-11',
      ),
    ).toBeNull()
  })

  it('未讀任何頁（pagesRead = 0 → pagesPerDay = 0）→ null', () => {
    expect(
      readingPace(book({ status: 'reading', startedOn: '2026-05-01', totalPages: 200 }), '2026-05-11'),
    ).toBeNull()
  })

  it('已讀到（或超過）總頁但仲標住在讀（remainingPages <= 0）→ null', () => {
    expect(
      readingPace(
        book({ status: 'reading', startedOn: '2026-05-01', totalPages: 200, currentPage: 200 }),
        '2026-05-11',
      ),
    ).toBeNull()
    expect(
      readingPace(
        book({ status: 'reading', startedOn: '2026-05-01', totalPages: 200, currentPage: 250 }),
        '2026-05-11',
      ),
    ).toBeNull()
  })
})

describe('readingPace — 計算（人手核對）', () => {
  it('一般情況：100 頁 / 10 日 = 每日 10 頁，剩 100 頁 → 10 日後', () => {
    // startedOn 2026-05-01 → today 2026-05-10：daysBetween 含頭尾 = 10 日
    // currentPage 100 / 200 → pagesRead 100；pagesPerDay = 100/10 = 10
    // remaining = 200-100 = 100；daysLeft = ceil(100/10) = 10
    // eta = 2026-05-10 + 10 日 = 2026-05-20
    const r = readingPace(
      book({ status: 'reading', startedOn: '2026-05-01', totalPages: 200, currentPage: 100 }),
      '2026-05-10',
    )
    expect(r).not.toBeNull()
    expect(r!.pagesPerDay).toBeCloseTo(10, 5)
    expect(r!.remainingPages).toBe(100)
    expect(r!.daysLeft).toBe(10)
    expect(r!.etaKey).toBe('2026-05-20')
  })

  it('daysLeft 向上取整（ceil）：剩 95 頁、每日 10 頁 → 10 日', () => {
    // pagesRead 105 / 10 日 = 10.5 頁/日；remaining = 200-105 = 95
    // ceil(95 / 10.5) = ceil(9.05) = 10
    const r = readingPace(
      book({ status: 'reading', startedOn: '2026-05-01', totalPages: 200, currentPage: 105 }),
      '2026-05-10',
    )
    expect(r!.daysLeft).toBe(10)
    expect(r!.etaKey).toBe('2026-05-20')
  })

  it('用 session 累計推 pagesRead（大過 currentPage 時）', () => {
    // sessions 共 120 頁 > currentPage 100 → pagesRead 120
    // 10 日 → 12 頁/日；remaining = 300-100 = 200；ceil(200/12) = 17
    const r = readingPace(
      book({
        status: 'reading',
        startedOn: '2026-05-01',
        totalPages: 300,
        currentPage: 100,
        sessions: [session({ id: 's1', pages: 70 }), session({ id: 's2', pages: 50 })],
      }),
      '2026-05-10',
    )
    expect(r!.pagesPerDay).toBeCloseTo(12, 5)
    expect(r!.remainingPages).toBe(200)
    expect(r!.daysLeft).toBe(17)
  })

  it('開始即今日（daysElapsed = 1）：唔會除零，pagesPerDay = pagesRead', () => {
    // started 同 today 同一日 → daysBetween = 1；pagesRead 30 → 30 頁/日
    // remaining = 200-30 = 170；ceil(170/30) = 6
    const r = readingPace(
      book({ status: 'reading', startedOn: '2026-05-10', totalPages: 200, currentPage: 30 }),
      '2026-05-10',
    )
    expect(r!.pagesPerDay).toBeCloseTo(30, 5)
    expect(r!.daysLeft).toBe(6)
    expect(r!.etaKey).toBe('2026-05-16')
  })

  it('剩極少（1 頁）→ daysLeft clamp 到至少 1', () => {
    // pagesRead 199 / 10 日 ≈ 19.9 頁/日；remaining = 200-199 = 1；ceil(1/19.9)=1
    const r = readingPace(
      book({ status: 'reading', startedOn: '2026-05-01', totalPages: 200, currentPage: 199 }),
      '2026-05-10',
    )
    expect(r!.remainingPages).toBe(1)
    expect(r!.daysLeft).toBe(1)
    expect(r!.etaKey).toBe('2026-05-11')
  })

  it('eta 跨月計算正確', () => {
    // started 2026-05-20 → today 2026-05-30：11 日；pagesRead 110 → 10 頁/日
    // remaining = 200-110 = 90；ceil(90/10)=9；2026-05-30 + 9 = 2026-06-08
    const r = readingPace(
      book({ status: 'reading', startedOn: '2026-05-20', totalPages: 200, currentPage: 110 }),
      '2026-05-30',
    )
    expect(r!.daysLeft).toBe(9)
    expect(r!.etaKey).toBe('2026-06-08')
  })
})

describe('readingPace — today 預設用系統時鐘（鎖時區）', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 5, 1, 10, 0, 0)) // 本地 2026-06-01
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('唔傳 today → 用 todayKey()（2026-06-01）', () => {
    // started 2026-05-23 → today 2026-06-01：10 日；pagesRead 100 → 10 頁/日
    // remaining = 200-100 = 100；ceil(100/10)=10；2026-06-01 + 10 = 2026-06-11
    const r = readingPace(
      book({ status: 'reading', startedOn: '2026-05-23', totalPages: 200, currentPage: 100 }),
    )
    expect(r!.pagesPerDay).toBeCloseTo(10, 5)
    expect(r!.daysLeft).toBe(10)
    expect(r!.etaKey).toBe('2026-06-11')
  })
})
