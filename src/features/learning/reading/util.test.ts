import { describe, it, expect } from 'vitest'
import {
  toKey,
  fromKey,
  addDays,
  daysBetween,
  progressPct,
  totalPagesRead,
  computeStats,
  computeStreaks,
  exportJson,
  parseImport,
} from './util'
import type { Book, ReadingSession } from './types'

// ───────── 測試夾具 ─────────
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

// ============================================================
//  日期 key — 本地時區（無 UTC off-by-one）
// ============================================================
describe('toKey / fromKey（本地時區）', () => {
  it('toKey 把本地年月日格成 YYYY-MM-DD（補零）', () => {
    // 本地 2026-01-05 09:00 → '2026-01-05'（月、日都補零）
    expect(toKey(new Date(2026, 0, 5, 9, 0, 0))).toBe('2026-01-05')
    expect(toKey(new Date(2026, 11, 31, 23, 0, 0))).toBe('2026-12-31')
  })

  it('fromKey 回本地午夜後（正午錨點）嘅同一日，唔會 UTC 漂移', () => {
    const d = fromKey('2026-05-04')
    // 用本地 getter 確認係 2026-05-04，正午 → 任何時區都唔會跌去前一日/後一日
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(4) // 5月 → index 4
    expect(d.getDate()).toBe(4)
    expect(d.getHours()).toBe(12)
  })

  it('toKey∘fromKey roundtrip 穩定（含年初/年尾邊界）', () => {
    expect(toKey(fromKey('2026-05-04'))).toBe('2026-05-04')
    expect(toKey(fromKey('2026-01-01'))).toBe('2026-01-01')
    expect(toKey(fromKey('2026-12-31'))).toBe('2026-12-31')
    // 閏年 2月29
    expect(toKey(fromKey('2024-02-29'))).toBe('2024-02-29')
  })
})

// ============================================================
//  addDays
// ============================================================
describe('addDays', () => {
  it('加正數跨月', () => {
    expect(toKey(addDays(fromKey('2026-01-30'), 3))).toBe('2026-02-02')
  })
  it('加 0 唔變', () => {
    expect(toKey(addDays(fromKey('2026-06-15'), 0))).toBe('2026-06-15')
  })
  it('加負數跨年', () => {
    expect(toKey(addDays(fromKey('2026-01-01'), -1))).toBe('2025-12-31')
  })
  it('結果錨喺正午（DST 安全）', () => {
    expect(addDays(fromKey('2026-03-08'), 1).getHours()).toBe(12)
  })
})

// ============================================================
//  daysBetween — 含頭尾、至少 1
// ============================================================
describe('daysBetween', () => {
  it('缺任何一邊回 undefined', () => {
    expect(daysBetween(undefined, '2026-05-01')).toBeUndefined()
    expect(daysBetween('2026-05-01', undefined)).toBeUndefined()
    expect(daysBetween(undefined, undefined)).toBeUndefined()
  })
  it('同一日 = 1（含頭尾）', () => {
    expect(daysBetween('2026-05-01', '2026-05-01')).toBe(1)
  })
  it('相差兩日 = 3（含頭尾）', () => {
    expect(daysBetween('2026-05-01', '2026-05-03')).toBe(3)
  })
  it('跨月正常', () => {
    // 1/30 → 2/2 = 4 日（30,31,1,2）
    expect(daysBetween('2026-01-30', '2026-02-02')).toBe(4)
  })
  it('反轉日期 clamp 到至少 1', () => {
    expect(daysBetween('2026-05-03', '2026-05-01')).toBe(1)
  })
})

// ============================================================
//  progressPct
// ============================================================
describe('progressPct', () => {
  it('讀完 = 100（即使無頁數）', () => {
    expect(progressPct(book({ status: 'done' }))).toBe(100)
  })
  it('無 totalPages → 0', () => {
    expect(progressPct(book({ status: 'reading', currentPage: 50 }))).toBe(0)
  })
  it('totalPages <= 0 → 0（防除零）', () => {
    expect(progressPct(book({ status: 'reading', totalPages: 0, currentPage: 10 }))).toBe(0)
  })
  it('一般百分比（四捨五入）', () => {
    // 50/200 = 25%
    expect(progressPct(book({ status: 'reading', totalPages: 200, currentPage: 50 }))).toBe(25)
    // 1/3 = 33.33 → 33
    expect(progressPct(book({ status: 'reading', totalPages: 3, currentPage: 1 }))).toBe(33)
  })
  it('無 currentPage 當 0', () => {
    expect(progressPct(book({ status: 'reading', totalPages: 100 }))).toBe(0)
  })
  it('currentPage 超過 totalPages → 封頂 100', () => {
    expect(progressPct(book({ status: 'reading', totalPages: 200, currentPage: 250 }))).toBe(100)
  })
})

// ============================================================
//  totalPagesRead
// ============================================================
describe('totalPagesRead', () => {
  it('讀完 + 有 totalPages → 整本', () => {
    expect(
      totalPagesRead(book({ status: 'done', totalPages: 320, currentPage: 10 })),
    ).toBe(320)
  })
  it('讀完但無 totalPages → 取 session 累計 vs currentPage 嘅大者', () => {
    expect(
      totalPagesRead(
        book({
          status: 'done',
          currentPage: 80,
          sessions: [session({ pages: 30 }), session({ pages: 20 })],
        }),
      ),
    ).toBe(80) // max(50, 80)
  })
  it('在讀：session 累計大過 currentPage 取 session', () => {
    expect(
      totalPagesRead(
        book({
          status: 'reading',
          currentPage: 40,
          sessions: [session({ pages: 30 }), session({ pages: 25 })],
        }),
      ),
    ).toBe(55) // max(55, 40)
  })
  it('空 sessions + 無 currentPage → 0', () => {
    expect(totalPagesRead(book({ status: 'reading' }))).toBe(0)
  })
})

// ============================================================
//  computeStreaks — longestStreak（deterministic）
//  currentStreak 用 2020 古早日期 → 一定唔係今日/尋日 → 0
// ============================================================
describe('computeStreaks', () => {
  it('完全冇 session → 兩者都 0', () => {
    expect(computeStreaks([book(), book()])).toEqual({
      longestStreak: 0,
      currentStreak: 0,
    })
  })

  it('longestStreak 取最長連續段（跨書合併日子）', () => {
    const books = [
      book({
        sessions: [
          session({ id: '1', date: '2020-01-01' }),
          session({ id: '2', date: '2020-01-02' }),
        ],
      }),
      book({
        sessions: [
          session({ id: '3', date: '2020-01-03' }), // 接上 → 連續 3
          session({ id: '4', date: '2020-01-10' }), // 斷開
          session({ id: '5', date: '2020-01-11' }), // 連續 2
        ],
      }),
    ]
    const r = computeStreaks(books)
    expect(r.longestStreak).toBe(3)
    expect(r.currentStreak).toBe(0) // 2020 唔可能係 2026 嘅今日/尋日
  })

  it('同一日重複 session 唔會撐大 streak', () => {
    const books = [
      book({
        sessions: [
          session({ id: '1', date: '2020-03-01' }),
          session({ id: '2', date: '2020-03-01' }), // 同日
        ],
      }),
    ]
    expect(computeStreaks(books).longestStreak).toBe(1)
  })

  it('單一孤立日 → longest 1', () => {
    expect(
      computeStreaks([book({ sessions: [session({ date: '2020-07-04' })] })]).longestStreak,
    ).toBe(1)
  })
})

// ============================================================
//  computeStats — 彙總（避開非確定嘅 currentStreak：用 2020 日期）
// ============================================================
describe('computeStats', () => {
  it('空陣列 → 全零、avgRating 0、無 -Infinity', () => {
    const s = computeStats([])
    expect(s.total).toBe(0)
    expect(s.byStatus).toEqual({ to_read: 0, reading: 0, done: 0, dnf: 0 })
    expect(s.rated).toBe(0)
    expect(s.avgRating).toBe(0)
    expect(s.totalPagesAll).toBe(0)
    expect(s.totalMinutes).toBe(0)
    expect(s.ratingDist).toEqual([0, 0, 0, 0, 0, 0])
    expect(s.topShelves).toEqual([])
    expect(s.longestStreak).toBe(0)
    expect(s.currentStreak).toBe(0)
    // byFormat 永遠列齊三種格式（count 0）
    expect(s.byFormat).toEqual([
      { format: 'paper', count: 0 },
      { format: 'ebook', count: 0 },
      { format: 'audio', count: 0 },
    ])
  })

  it('彙總一組書（人手計）', () => {
    const books: Book[] = [
      book({
        id: 'B1',
        status: 'done',
        totalPages: 200,
        rating: 5,
        format: 'paper',
        shelves: ['fiction', 'fav'],
        sessions: [
          session({ id: 's1', date: '2020-01-01', pages: 50, minutes: 30 }),
          session({ id: 's2', date: '2020-01-02', pages: 60, minutes: 20 }),
        ],
      }),
      book({
        id: 'B2',
        status: 'reading',
        totalPages: 100,
        currentPage: 40,
        rating: 3.5,
        format: 'ebook',
        shelves: ['fiction'],
        sessions: [session({ id: 's3', date: '2020-01-03', pages: 40, minutes: 25 })],
      }),
      book({
        id: 'B3',
        status: 'to_read',
        rating: 0, // 未評分 → 唔計入 rated
        format: 'paper',
        shelves: [],
        sessions: [],
      }),
    ]
    const s = computeStats(books)

    expect(s.total).toBe(3)
    expect(s.byStatus).toEqual({ to_read: 1, reading: 1, done: 1, dnf: 0 })

    // rated：B1(5) + B2(3.5) = 2；ratingSum 8.5 → avg 4.25
    expect(s.rated).toBe(2)
    expect(s.avgRating).toBeCloseTo(4.25, 5)

    // ratingDist：round(5)=5、round(3.5)=4（半星向上）
    expect(s.ratingDist).toEqual([0, 0, 0, 0, 1, 1])

    // byFormat：paper 2、ebook 1、audio 0（固定順序）
    expect(s.byFormat).toEqual([
      { format: 'paper', count: 2 },
      { format: 'ebook', count: 1 },
      { format: 'audio', count: 0 },
    ])

    // totalPagesAll：B1 讀完→200、B2 max(40,40)=40、B3 0 → 240
    expect(s.totalPagesAll).toBe(240)
    // totalMinutes：30+20 + 25 = 75
    expect(s.totalMinutes).toBe(75)

    // topShelves：fiction 2 行先、fav 1
    expect(s.topShelves).toEqual([
      { name: 'fiction', count: 2 },
      { name: 'fav', count: 1 },
    ])

    // longest：2020-01-01..03 連續 3
    expect(s.longestStreak).toBe(3)
    expect(s.currentStreak).toBe(0)
  })
})

// ============================================================
//  exportJson — round-trip with parseImport
// ============================================================
describe('exportJson / parseImport', () => {
  it('exportJson 出 pretty JSON；parseImport 後再 export 係 idempotent', () => {
    const books = [
      book({
        id: 'X',
        title: '書名',
        status: 'reading',
        totalPages: 100,
        currentPage: 30,
        shelves: ['a'],
        sessions: [session({ id: 'z', date: '2026-05-01', pages: 30, minutes: 10 })],
      }),
    ]
    const json = exportJson(books)
    expect(json).toContain('\n') // pretty (indent=2)
    // parseImport 會將 optional 欄位顯式補成 undefined（正規化形狀）；
    // 故用「再 round-trip 一次」確認穩定 + 抽查關鍵欄位，避免比較缺鍵 vs undefined。
    const back = parseImport(json)
    expect(back).not.toBeNull()
    const twice = parseImport(exportJson(back!))
    expect(twice).toEqual(back)
    const b = back![0]
    expect(b.id).toBe('X')
    expect(b.title).toBe('書名')
    expect(b.status).toBe('reading')
    expect(b.totalPages).toBe(100)
    expect(b.currentPage).toBe(30)
    expect(b.shelves).toEqual(['a'])
    expect(b.sessions).toEqual([{ id: 'z', date: '2026-05-01', pages: 30, minutes: 10 }])
    expect(b.createdAt).toBe('2020-01-01T00:00:00.000Z')
  })

  it('非陣列 / 無效 JSON → null', () => {
    expect(parseImport('{"not":"array"}')).toBeNull()
    expect(parseImport('not json at all')).toBeNull()
    expect(parseImport('123')).toBeNull()
  })

  it('空陣列 → 空陣列', () => {
    expect(parseImport('[]')).toEqual([])
  })

  it('寬鬆補齊缺欄位（id/title/status 等）', () => {
    const out = parseImport(JSON.stringify([{ id: 'k', title: '只有標題' }]))
    expect(out).not.toBeNull()
    const b = out![0]
    expect(b.id).toBe('k')
    expect(b.title).toBe('只有標題')
    expect(b.status).toBe('to_read') // 預設
    expect(b.shelves).toEqual([])
    expect(b.sessions).toEqual([])
    expect(b.favorite).toBe(false)
  })

  it('無效 status / format 退回安全預設', () => {
    const out = parseImport(
      JSON.stringify([{ id: 'k', title: 't', status: 'bogus', format: 'bogus' }]),
    )
    const b = out![0]
    expect(b.status).toBe('to_read')
    expect(b.format).toBeUndefined()
  })

  it('保留有效 status / format', () => {
    const out = parseImport(
      JSON.stringify([{ id: 'k', title: 't', status: 'done', format: 'audio' }]),
    )
    const b = out![0]
    expect(b.status).toBe('done')
    expect(b.format).toBe('audio')
  })

  it('session pages 數字化、minutes 選填保留', () => {
    const out = parseImport(
      JSON.stringify([
        {
          id: 'k',
          title: 't',
          sessions: [
            { id: 's1', date: '2026-05-01', pages: '12', minutes: '5' },
            { id: 's2', date: '2026-05-02', pages: 8 },
          ],
        },
      ]),
    )
    const b = out![0]
    expect(b.sessions[0]).toEqual({ id: 's1', date: '2026-05-01', pages: 12, minutes: 5 })
    expect(b.sessions[1]).toEqual({ id: 's2', date: '2026-05-02', pages: 8, minutes: undefined })
  })
})
