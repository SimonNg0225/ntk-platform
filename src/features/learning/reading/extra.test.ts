import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  relativeLabel,
  monthlyFinished,
  activityHeatmap,
  progressPct,
  computeStreaks,
} from './util'
import { heatLevel } from './Charts'
import type { Book, ReadingSession } from './types'

// ============================================================
//  測試夾具
//  ------------------------------------------------------------
//  relativeLabel / monthlyFinished / activityHeatmap 都依賴
//  new Date()（透過 todayKey() / now / today）。
//  用 vi.setSystemTime 鎖死「今日」令斷言確定。
//  關鍵：用本地時間 constructor（new Date(年,月,日,...)）落 system time，
//  source 全部用本地 getter（getFullYear/getMonth/getDate/getDay）讀返出嚟，
//  所以唔論 CI 機係咩 TZ 結果都一致（唔會 UTC 漂移）。
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

// ============================================================
//  relativeLabel — 相對今日嘅中文標籤
//  鎖今日為本地 2026-05-15 10:00
// ============================================================
describe('relativeLabel', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 15, 10, 0, 0)) // 本地 2026-05-15
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('空 key → 空字串', () => {
    expect(relativeLabel()).toBe('')
    expect(relativeLabel('')).toBe('')
  })

  it('今日 / 聽日 / 尋日 三個臨界字串', () => {
    expect(relativeLabel('2026-05-15')).toBe('今日')
    expect(relativeLabel('2026-05-16')).toBe('聽日')
    expect(relativeLabel('2026-05-14')).toBe('尋日')
  })

  it('過去：diff < 0 用 -diff 顯示「N 日前」（負號處理）', () => {
    expect(relativeLabel('2026-05-13')).toBe('2 日前')
    expect(relativeLabel('2026-05-05')).toBe('10 日前')
  })

  it('未來：diff > 0 顯示「N 日後」', () => {
    expect(relativeLabel('2026-05-18')).toBe('3 日後')
  })

  it('跨月仍以日數計（5-15 對上月 4-30 = 15 日前）', () => {
    // 4月有 30 日：4-30,5-1..5-15 → 4-30 距今 15 日
    expect(relativeLabel('2026-04-30')).toBe('15 日前')
  })

  it('跨年仍以日數計（5-15 對 2025-12-31）', () => {
    // relativeLabel 用「原始日差」（非 inclusive）：
    // 2025-12-31 → 2026-05-15，2026 非閏年：Jan31+Feb28+Mar31+Apr30=120 到 4-30，+15 = 135 日
    expect(relativeLabel('2025-12-31')).toBe('135 日前')
  })
})

// ============================================================
//  monthlyFinished — 過去 N 個月每月讀完本數 + 頁數
//  鎖今日為本地 2026-05-15 → 窗口（12 個月）= 2025-06 .. 2026-05
// ============================================================
describe('monthlyFinished', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 15, 10, 0, 0)) // 本地 2026-05
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('空陣列 → N 個 0 桶（預設 12），桶 key 由舊到新、格式 YYYY-MM 補零', () => {
    const out = monthlyFinished([])
    expect(out).toHaveLength(12)
    expect(out.every((m) => m.books === 0 && m.pages === 0)).toBe(true)
    expect(out.map((m) => m.key)).toEqual([
      '2025-06', '2025-07', '2025-08', '2025-09', '2025-10', '2025-11',
      '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05',
    ])
    // label 用 MONTHS[getMonth()]：頭尾抽查
    expect(out[0].label).toBe('6月')
    expect(out[11].label).toBe('5月')
  })

  it('自訂月數（months=3 → 3 個桶：2026-03/04/05）', () => {
    const out = monthlyFinished([], 3)
    expect(out.map((m) => m.key)).toEqual(['2026-03', '2026-04', '2026-05'])
  })

  it('只計 done；非 done（reading/to_read/dnf）一律略過', () => {
    const books: Book[] = [
      book({ status: 'reading', finishedOn: '2026-05-10', totalPages: 100 }),
      book({ status: 'to_read', finishedOn: '2026-05-10', totalPages: 100 }),
      book({ status: 'dnf', finishedOn: '2026-05-10', totalPages: 100 }),
    ]
    const out = monthlyFinished(books)
    expect(out.find((m) => m.key === '2026-05')!.books).toBe(0)
  })

  it('done 書按 finishedOn 落月份桶，pages 用 totalPagesRead（整本）', () => {
    const books: Book[] = [
      book({ id: 'a', status: 'done', finishedOn: '2026-05-03', totalPages: 200 }),
      book({ id: 'b', status: 'done', finishedOn: '2026-05-20', totalPages: 150 }),
      book({ id: 'c', status: 'done', finishedOn: '2026-03-01', totalPages: 90 }),
    ]
    const out = monthlyFinished(books)
    const may = out.find((m) => m.key === '2026-05')!
    const mar = out.find((m) => m.key === '2026-03')!
    expect(may.books).toBe(2)
    expect(may.pages).toBe(350) // 200 + 150
    expect(mar.books).toBe(1)
    expect(mar.pages).toBe(90)
  })

  it('落窗口外嘅月份唔計入（finishedOn 早過窗口起點 2025-06）', () => {
    const books: Book[] = [
      book({ status: 'done', finishedOn: '2025-05-31', totalPages: 100 }), // 窗口前一個月
      book({ status: 'done', finishedOn: '2024-12-25', totalPages: 100 }), // 更早
    ]
    const out = monthlyFinished(books)
    expect(out.reduce((s, m) => s + m.books, 0)).toBe(0)
  })

  // ── 揭發 suspectedBug #1：done 書缺 finishedOn 時 fallback 用 createdAt ──
  //    createdAt 係 ISO(UTC)；HK(UTC+8) 本地 1 月初凌晨建立的書，
  //    UTC 會跌去上一年 12 月。修正前用 createdAt.slice(0,10) → 落 2025-12 桶
  //    （跌出 2026 今年）；修正後改用本地 key → 正確落 2026-01 桶。
  it('[bug#1] done 書缺 finishedOn：用本地 key（非 UTC slice）落月份桶', () => {
    // 本地 2026-01-01 01:00 → toISOString() = 2025-12-31T17:00:00Z（HK）
    const localNewYearMidnight = new Date(2026, 0, 1, 1, 0, 0).toISOString()
    const books: Book[] = [
      book({ status: 'done', totalPages: 120, createdAt: localNewYearMidnight }),
    ]
    const out = monthlyFinished(books)
    const jan2026 = out.find((m) => m.key === '2026-01')!
    const dec2025 = out.find((m) => m.key === '2025-12')!
    // 應落 2026-01（本地），唔好因 UTC 漂移跌去 2025-12
    expect(jan2026.books).toBe(1)
    expect(jan2026.pages).toBe(120)
    expect(dec2025.books).toBe(0)
  })

  it('[bug#1] finishedOn 在場時優先用 finishedOn（唔受 createdAt 影響）', () => {
    const books: Book[] = [
      book({
        status: 'done',
        finishedOn: '2026-04-10',
        createdAt: new Date(2026, 0, 1, 1, 0, 0).toISOString(),
        totalPages: 80,
      }),
    ]
    const out = monthlyFinished(books)
    expect(out.find((m) => m.key === '2026-04')!.books).toBe(1)
    expect(out.find((m) => m.key === '2026-01')!.books).toBe(0)
  })
})

// ============================================================
//  activityHeatmap — 過去 N 週每日 session 方格（週日對齊）
//  鎖今日為本地 2026-05-31（星期日，getDay()===0）
//  → endSun = 今日 + (6 - 0) = 2026-06-06；start = endSun - (weeks*7-1)
// ============================================================
describe('activityHeatmap', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 31, 10, 0, 0)) // 本地 2026-05-31 週日
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('鎖定基準日確為星期日（令窗口尾推到本週六穩定）', () => {
    expect(new Date(2026, 4, 31).getDay()).toBe(0)
  })

  it('空陣列 → 全 0 格；週數 × 7 格數正確（無 off-by-one）', () => {
    const cols = activityHeatmap([], 18)
    expect(cols).toHaveLength(18)
    expect(cols.every((c) => c.length === 7)).toBe(true)
    const flat = cols.flat()
    expect(flat).toHaveLength(126) // 18 × 7
    expect(flat.every((cell) => cell.pages === 0 && cell.sessions === 0)).toBe(true)
  })

  it('自訂週數（weeks=4 → 4 欄 × 7 = 28 格）', () => {
    const cols = activityHeatmap([], 4)
    expect(cols).toHaveLength(4)
    expect(cols.flat()).toHaveLength(28)
  })

  it('窗口尾 = endSun（今日 2026-05-31 週日 → 本週六 2026-06-06）；起點對齊週日', () => {
    const cols = activityHeatmap([], 18)
    const flat = cols.flat()
    // 最後一格 = endSun = 2026-06-06
    expect(flat[flat.length - 1].key).toBe('2026-06-06')
    // 第一格 = endSun - (18*7-1) 日 = 2026-02-01，且係每欄第一行（週日）
    expect(flat[0].key).toBe('2026-02-01')
    expect(new Date(2026, 1, 1).getDay()).toBe(0) // 確認 start 落喺週日
  })

  it('每日 session 落正確方格：pages 相加、sessions 計次', () => {
    const books: Book[] = [
      book({
        sessions: [
          session({ id: '1', date: '2026-05-30', pages: 20 }),
          session({ id: '2', date: '2026-05-30', pages: 15 }), // 同日第二次
          session({ id: '3', date: '2026-05-31', pages: 40 }),
        ],
      }),
    ]
    const cols = activityHeatmap(books, 18)
    const flat = cols.flat()
    const may30 = flat.find((c) => c.key === '2026-05-30')!
    const may31 = flat.find((c) => c.key === '2026-05-31')!
    expect(may30.pages).toBe(35) // 20 + 15
    expect(may30.sessions).toBe(2) // 計兩次
    expect(may31.pages).toBe(40)
    expect(may31.sessions).toBe(1)
  })

  it('跨書同日 session 合併到同一格', () => {
    const books: Book[] = [
      book({ id: 'A', sessions: [session({ id: 'a1', date: '2026-05-29', pages: 10 })] }),
      book({ id: 'B', sessions: [session({ id: 'b1', date: '2026-05-29', pages: 25 })] }),
    ]
    const flat = activityHeatmap(books, 18).flat()
    const may29 = flat.find((c) => c.key === '2026-05-29')!
    expect(may29.pages).toBe(35)
    expect(may29.sessions).toBe(2)
  })

  it('窗口外嘅 session 唔出現喺任何格', () => {
    const books: Book[] = [
      book({ sessions: [session({ id: 'old', date: '2020-01-01', pages: 99 })] }),
    ]
    const flat = activityHeatmap(books, 18).flat()
    expect(flat.some((c) => c.key === '2020-01-01')).toBe(false)
    expect(flat.every((c) => c.pages === 0)).toBe(true)
  })
})

// ============================================================
//  heatLevel（Charts.tsx）— 當日頁數 → 0..4 熱度等級
//  分界用 < 而非 <=：<=0→0、<15→1、<40→2、<80→3、>=80→4
//  （此函式為 module 私有純函式，已加 export 供單測）
// ============================================================
describe('heatLevel', () => {
  it('pages <= 0 → 0（含負數）', () => {
    expect(heatLevel(0)).toBe(0)
    expect(heatLevel(-5)).toBe(0)
  })

  it('1..14 → 1；分界 14/15（< 而非 <=）', () => {
    expect(heatLevel(1)).toBe(1)
    expect(heatLevel(14)).toBe(1)
    expect(heatLevel(15)).toBe(2) // 15 跌入下一級
  })

  it('15..39 → 2；分界 39/40', () => {
    expect(heatLevel(39)).toBe(2)
    expect(heatLevel(40)).toBe(3)
  })

  it('40..79 → 3；分界 79/80', () => {
    expect(heatLevel(79)).toBe(3)
    expect(heatLevel(80)).toBe(4)
  })

  it('>= 80 → 4（含極大值）', () => {
    expect(heatLevel(80)).toBe(4)
    expect(heatLevel(100000)).toBe(4)
  })
})

// ============================================================
//  progressPct — 補測 suspectedBug #2（未讀完用 floor，唔好 round 成假 100%）
//  （正常 case / 防除零 / 封頂已喺 util.test.ts 覆蓋；呢度專攻 99.5% 邊界）
// ============================================================
describe('progressPct — 99.5% 邊界（bug#2）', () => {
  it('[bug#2] 在讀 199/200（=99.5%）唔應 round 成 100%，要 floor 成 99', () => {
    expect(progressPct(book({ status: 'reading', totalPages: 200, currentPage: 199 }))).toBe(99)
  })

  it('[bug#2] 在讀 398/400（=99.5%）同樣 → 99（唔好混淆真·讀完）', () => {
    expect(progressPct(book({ status: 'reading', totalPages: 400, currentPage: 398 }))).toBe(99)
  })

  it('真·讀完（status done）依然 100%（與在讀 99.x% 區分得到）', () => {
    expect(progressPct(book({ status: 'done', totalPages: 200, currentPage: 199 }))).toBe(100)
  })

  it('在讀已到最後一頁 200/200 = 100%（真係讀到尾，唔屬 bug）', () => {
    expect(progressPct(book({ status: 'reading', totalPages: 200, currentPage: 200 }))).toBe(100)
  })

  it('在讀超頁 250/200 仍封頂 100%（floor 後 min 照封頂，沿用既有行為）', () => {
    expect(progressPct(book({ status: 'reading', totalPages: 200, currentPage: 250 }))).toBe(100)
  })
})

// ============================================================
//  computeStreaks — currentStreak「數到正數」分支
//  ------------------------------------------------------------
//  既有 util.test.ts / extra.test.ts 全用 2020 古早 session 日期，
//  currentStreak 永遠 0，故「今日往回數 / 今日無但尋日有 / 遇斷裂即停」
//  三條 current 路徑同 longest 嘅互動完全未行。
//  此處鎖死「今日」= 本地 2026-05-31（跟 extra.test.ts 做法），
//  全部用相對今日嘅 session.date 斷言正確 currentStreak（同 longest 互動）。
//  ── 為何用本地 constructor 落 system time：source 用 todayKey()/addDays()
//     全經本地 getter，故任何 CI TZ 結果一致（無 UTC 漂移）。
// ============================================================
describe('computeStreaks — currentStreak 正數分支（鎖今日 2026-05-31）', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 31, 10, 0, 0)) // 本地 2026-05-31
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('(1) 今日 + 連續往前 2 日 → currentStreak=3（longest 同樣 3）', () => {
    const books = [
      book({
        sessions: [
          session({ id: '1', date: '2026-05-29' }),
          session({ id: '2', date: '2026-05-30' }),
          session({ id: '3', date: '2026-05-31' }), // 今日
        ],
      }),
    ]
    const r = computeStreaks(books)
    expect(r.currentStreak).toBe(3)
    expect(r.longestStreak).toBe(3)
  })

  it('(2) 今日無 session 但尋日有、再前一日亦有 → 由尋日計起 currentStreak=2', () => {
    // 今日(5-31)無；尋日(5-30)有 → cursor 退到尋日往回數：5-30、5-29 → 2
    const books = [
      book({
        sessions: [
          session({ id: '1', date: '2026-05-29' }),
          session({ id: '2', date: '2026-05-30' }), // 尋日（最近一日）
        ],
      }),
    ]
    const r = computeStreaks(books)
    expect(r.currentStreak).toBe(2)
    expect(r.longestStreak).toBe(2)
  })

  it('(3) 今日同尋日都無 → currentStreak=0，但 longest 仍係舊段長度', () => {
    // 舊段 5-20..5-22 連續 3：current 因今日/尋日皆無 → 0；longest 唔受影響仍 3
    const books = [
      book({
        sessions: [
          session({ id: '1', date: '2026-05-20' }),
          session({ id: '2', date: '2026-05-21' }),
          session({ id: '3', date: '2026-05-22' }),
        ],
      }),
    ]
    const r = computeStreaks(books)
    expect(r.currentStreak).toBe(0)
    expect(r.longestStreak).toBe(3)
  })

  it('(4) 今日有、尋日無（中間斷）→ currentStreak=1（longest 取舊長段）', () => {
    // 今日(5-31)有但尋日(5-30)無 → 今日往回即斷 → current 1。
    // 另有舊連續段 5-24..5-26（長 3）→ longest 3，與 current 1 並存。
    const books = [
      book({
        sessions: [
          session({ id: 'old1', date: '2026-05-24' }),
          session({ id: 'old2', date: '2026-05-25' }),
          session({ id: 'old3', date: '2026-05-26' }),
          session({ id: 'today', date: '2026-05-31' }), // 今日，孤立（5-30 缺）
        ],
      }),
    ]
    const r = computeStreaks(books)
    expect(r.currentStreak).toBe(1)
    expect(r.longestStreak).toBe(3)
  })

  it('(5) 跨書同日 session 去重唔會撐大 current（兩本書同日 → 當一日）', () => {
    // 兩本書都喺今日(5-31)有 session；加埋尋日(5-30)一次 → current 應為 2，唔係 3。
    const books = [
      book({ id: 'A', sessions: [session({ id: 'a1', date: '2026-05-31' })] }),
      book({ id: 'B', sessions: [session({ id: 'b1', date: '2026-05-31' })] }), // 同日另一本
      book({ id: 'C', sessions: [session({ id: 'c1', date: '2026-05-30' })] }),
    ]
    const r = computeStreaks(books)
    expect(r.currentStreak).toBe(2) // 5-31（去重）、5-30
    expect(r.longestStreak).toBe(2)
  })

  it('(6) 跨月回退：今日 6/1 連到 5/31、5/30 → current 正確 3', () => {
    // 改鎖今日為本地 2026-06-01；cursor 由 6-1 退到 5-31、5-30（fromKey/addDays 跨月退）。
    vi.setSystemTime(new Date(2026, 5, 1, 10, 0, 0)) // 本地 2026-06-01
    const books = [
      book({
        sessions: [
          session({ id: '1', date: '2026-05-30' }),
          session({ id: '2', date: '2026-05-31' }),
          session({ id: '3', date: '2026-06-01' }), // 今日
        ],
      }),
    ]
    const r = computeStreaks(books)
    expect(r.currentStreak).toBe(3)
    expect(r.longestStreak).toBe(3)
  })

  it('守護：鎖定基準日確為本地 2026-05-31（令相對 session 日期斷言穩定）', () => {
    expect(new Date().getFullYear()).toBe(2026)
    expect(new Date().getMonth()).toBe(4) // 5月 = index 4
    expect(new Date().getDate()).toBe(31)
  })
})
