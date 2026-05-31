import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  currentStreak,
  moodTrend,
  monthlyCounts,
  relativeTime,
  MONTHS_SHORT,
} from './util'
import type { JournalDoc } from './util'

// ============================================================
//  學習日誌 — 「依賴當下時間」嘅純函式測試
//  ------------------------------------------------------------
//  currentStreak / moodTrend / monthlyCounts / relativeTime 全部
//  讀 todayKey() / new Date() / Date.now()，所以用 fake timers 把
//  「今日」鎖死先可重現斷言。本檔獨立於 util.test.ts（嗰個用真實
//  時間測純日期工具），唔互相干擾。
//
//  鎖定基準日：2026-05-31（星期日）本地正午。
//  注意：本 repo 慣用本地時區 key，故 setSystemTime 亦用本地建構嘅
//  Date（new Date(2026, 4, 31, 12)），同 toKey/fromKey 嘅本地語意一致。
// ============================================================

const TODAY = new Date(2026, 4, 31, 12, 0, 0, 0) // 2026-05-31 本地正午（星期日）

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(TODAY)
})

afterEach(() => {
  vi.useRealTimers()
})

// 測試專用：砌一篇日誌（只需傳要關心嘅欄位）
const doc = (over: Partial<JournalDoc>): JournalDoc => ({
  id: 'd',
  date: '2026-05-31',
  content: '',
  createdAt: '2026-05-31T08:00:00.000Z',
  updatedAt: '2026-05-31T08:00:00.000Z',
  ...over,
})

// ───────────────────────── currentStreak（由今日起連續天數）─────────────────────────
describe('currentStreak（今日=2026-05-31）', () => {
  it('空集合 → 0', () => {
    expect(currentStreak(new Set())).toBe(0)
  })

  it('只得今日 → 1', () => {
    expect(currentStreak(new Set(['2026-05-31']))).toBe(1)
  })

  it('今日 + 連續向後幾日 → 全數', () => {
    expect(
      currentStreak(
        new Set(['2026-05-31', '2026-05-30', '2026-05-29', '2026-05-28']),
      ),
    ).toBe(4)
  })

  it('今日未寫但琴日有 → 由琴日計起，唔斷 streak', () => {
    // 今日 2026-05-31 冇；2026-05-30 / 05-29 有 → streak 由琴日計 = 2
    expect(currentStreak(new Set(['2026-05-30', '2026-05-29']))).toBe(2)
  })

  it('今日同琴日都冇 → 0（即使更早有紀錄都唔計）', () => {
    expect(currentStreak(new Set(['2026-05-28', '2026-05-27']))).toBe(0)
  })

  it('今日有但中間斷一日 → 只計今日嗰段', () => {
    // 今日 05-31 有、05-30 有、05-29 冇、05-28 有 → 只計 05-31+05-30 = 2
    expect(
      currentStreak(new Set(['2026-05-31', '2026-05-30', '2026-05-28'])),
    ).toBe(2)
  })

  it('今日未寫、琴日有但再前一日斷 → 只計琴日嗰段', () => {
    // 今日 05-31 冇、05-30 有、05-29 冇 → 由 05-30 計起遇斷 = 1
    expect(currentStreak(new Set(['2026-05-30', '2026-05-28']))).toBe(1)
  })
})

describe('currentStreak — 跨月 / 跨年向後行', () => {
  it('跨月：今日 6/1 向後連續到 5 月尾', () => {
    vi.setSystemTime(new Date(2026, 5, 1, 12)) // 2026-06-01
    expect(
      currentStreak(new Set(['2026-06-01', '2026-05-31', '2026-05-30'])),
    ).toBe(3)
  })

  it('跨年：今日 1/1 向後連續到去年 12 月尾', () => {
    vi.setSystemTime(new Date(2026, 0, 1, 12)) // 2026-01-01
    expect(
      currentStreak(new Set(['2026-01-01', '2025-12-31', '2025-12-30'])),
    ).toBe(3)
  })

  it('跨年：今日 1/1 未寫但去年 12/31 有 → 由 12/31 計起唔斷', () => {
    vi.setSystemTime(new Date(2026, 0, 1, 12)) // 2026-01-01
    expect(currentStreak(new Set(['2025-12-31', '2025-12-30']))).toBe(2)
  })
})

// ───────────────────────── moodTrend（近 n 日含今日，由舊到新）─────────────────────────
describe('moodTrend（今日=2026-05-31）', () => {
  it('空 docs → 空陣列', () => {
    expect(moodTrend([], 30)).toEqual([])
  })

  it('近 30 日邊界：start = today-(n-1) = 2026-05-02 inclusive；today-n=05-01 排除', () => {
    const docs = [
      doc({ id: 'in', date: '2026-05-02', mood: '😀' }), // 啱啱喺邊界內
      doc({ id: 'out', date: '2026-05-01', mood: '🙂' }), // 邊界外（排除）
      doc({ id: 'today', date: '2026-05-31', mood: '😐' }), // 含今日
    ]
    const out = moodTrend(docs, 30)
    expect(out.map((p) => p.key)).toEqual(['2026-05-02', '2026-05-31'])
    expect(out.map((p) => p.score)).toEqual([5, 3]) // 😀=5, 😐=3
  })

  it('輸出按日期 key 升序（由舊到新）', () => {
    const docs = [
      doc({ id: 'c', date: '2026-05-31', mood: '😀' }),
      doc({ id: 'a', date: '2026-05-10', mood: '🙂' }),
      doc({ id: 'b', date: '2026-05-20', mood: '😐' }),
    ]
    expect(moodTrend(docs, 30).map((p) => p.key)).toEqual([
      '2026-05-10',
      '2026-05-20',
      '2026-05-31',
    ])
  })

  it('同日多篇 → 取 updatedAt 最大（最後修改）嗰篇嘅心情', () => {
    const docs = [
      doc({
        id: 'early',
        date: '2026-05-20',
        mood: '😣', // score 1
        updatedAt: '2026-05-20T08:00:00.000Z',
      }),
      doc({
        id: 'late',
        date: '2026-05-20',
        mood: '😀', // score 5（最後修改，應取呢個）
        updatedAt: '2026-05-20T20:00:00.000Z',
      }),
    ]
    const out = moodTrend(docs, 30)
    expect(out).toHaveLength(1)
    expect(out[0].score).toBe(5)
    expect(out[0].emoji).toBe('😀')
  })

  it('無 mood 嘅 doc 唔計', () => {
    const docs = [
      doc({ id: 'nomood', date: '2026-05-15' }), // 冇 mood
      doc({ id: 'withmood', date: '2026-05-16', mood: '🙂' }),
    ]
    expect(moodTrend(docs, 30).map((p) => p.key)).toEqual(['2026-05-16'])
  })

  it('未知 emoji（moodScore undefined）→ 唔 push', () => {
    const docs = [
      doc({ id: 'unknown', date: '2026-05-15', mood: '🤖' }), // 未知
      doc({ id: 'known', date: '2026-05-16', mood: '😀' }),
    ]
    const out = moodTrend(docs, 30)
    expect(out.map((p) => p.emoji)).toEqual(['😀'])
  })

  it('days<=0 → start>today，全部排除 → 空陣列', () => {
    const docs = [doc({ id: 'today', date: '2026-05-31', mood: '😀' })]
    // days=0 → start = addDays(today, 1) = 2026-06-01 > 今日所有 doc.date
    expect(moodTrend(docs, 0)).toEqual([])
  })

  it('近 7 日窗：start=2026-05-25 inclusive，再舊嘅排除', () => {
    const docs = [
      doc({ id: 'in', date: '2026-05-25', mood: '😀' }),
      doc({ id: 'out', date: '2026-05-24', mood: '🙂' }),
    ]
    expect(moodTrend(docs, 7).map((p) => p.key)).toEqual(['2026-05-25'])
  })
})

// ───────────────────────── monthlyCounts（近 n 月，由舊到新）─────────────────────────
describe('monthlyCounts（now=2026-05-31）', () => {
  it('空 docs → 12 個桶全 0', () => {
    const out = monthlyCounts([], 12)
    expect(out).toHaveLength(12)
    expect(out.every((b) => b.count === 0)).toBe(true)
  })

  it('months=0 → 空陣列', () => {
    expect(monthlyCounts([], 0)).toEqual([])
  })

  it('months=1 → 只當月（2026-05）', () => {
    const out = monthlyCounts(
      [doc({ id: '1', date: '2026-05-10' }), doc({ id: '2', date: '2026-04-30' })],
      1,
    )
    expect(out).toHaveLength(1)
    expect(out[0].ym).toBe('2026-05')
    expect(out[0].count).toBe(1) // 只計 2026-05 嗰篇，4 月嗰篇喺窗外
  })

  it('12 桶由舊到新，末桶 = 當月 2026-05；label 對應月份', () => {
    const out = monthlyCounts([], 12)
    expect(out[0].ym).toBe('2025-06') // 倒數 12 個月
    expect(out[11].ym).toBe('2026-05') // 末桶 = 當月
    expect(out[11].label).toBe(MONTHS_SHORT[4]) // 5 月 = index 4 → '5月'
    expect(out[0].label).toBe(MONTHS_SHORT[5]) // 6 月 = index 5 → '6月'
  })

  it('每篇 doc 依 date.slice(0,7) 落對應桶；範圍外（太舊/未來）唔計', () => {
    const docs = [
      doc({ id: 'a', date: '2026-05-15' }), // 當月（末桶）
      doc({ id: 'b', date: '2026-05-20' }), // 當月（末桶）
      doc({ id: 'c', date: '2025-06-01' }), // 最舊桶
      doc({ id: 'old', date: '2025-05-31' }), // 範圍外（早過最舊桶）→ 唔計
      doc({ id: 'future', date: '2026-06-01' }), // 範圍外（未來）→ 唔計
    ]
    const out = monthlyCounts(docs, 12)
    const may = out.find((b) => b.ym === '2026-05')!
    const jun25 = out.find((b) => b.ym === '2025-06')!
    expect(may.count).toBe(2)
    expect(jun25.count).toBe(1)
    // 全部桶總和應只計到落桶嘅 3 篇
    expect(out.reduce((s, b) => s + b.count, 0)).toBe(3)
  })

  it('當月 doc 入最後一桶', () => {
    const out = monthlyCounts([doc({ id: '1', date: '2026-05-31' })], 12)
    expect(out[out.length - 1].ym).toBe('2026-05')
    expect(out[out.length - 1].count).toBe(1)
  })

  it('跨年倒數（now.getMonth()-i 為負）：now=2026-02 → 桶橫跨 2025', () => {
    vi.setSystemTime(new Date(2026, 1, 15, 12)) // 2026-02-15
    const out = monthlyCounts(
      [
        doc({ id: 'a', date: '2025-03-10' }), // 最舊桶
        doc({ id: 'b', date: '2026-02-01' }), // 末桶（當月）
      ],
      12,
    )
    expect(out[0].ym).toBe('2025-03')
    expect(out[0].label).toBe(MONTHS_SHORT[2]) // 3 月
    expect(out[0].count).toBe(1)
    expect(out[11].ym).toBe('2026-02')
    expect(out[11].label).toBe(MONTHS_SHORT[1]) // 2 月
    expect(out[11].count).toBe(1)
  })
})

// ───────────────────────── relativeTime（相對時間）─────────────────────────
describe('relativeTime（now=2026-05-31T12:00 本地）', () => {
  // 用本地建構嘅 Date 取得「此刻」的 ISO，逐個邊界往前推。
  const nowMs = TODAY.getTime()
  const isoAgo = (ms: number) => new Date(nowMs - ms).toISOString()

  it('invalid ISO → 空字串', () => {
    expect(relativeTime('not-a-date')).toBe('')
    expect(relativeTime('')).toBe('')
  })

  it('剛好 0 秒 → 啱啱', () => {
    expect(relativeTime(isoAgo(0))).toBe('啱啱')
  })

  it('<60 秒 → 啱啱', () => {
    expect(relativeTime(isoAgo(59_000))).toBe('啱啱')
  })

  it('剛好 60 秒 → 1 分鐘前', () => {
    expect(relativeTime(isoAgo(60_000))).toBe('1 分鐘前')
  })

  it('59 分鐘 → 59 分鐘前；剛好 60 分鐘 → 1 小時前', () => {
    expect(relativeTime(isoAgo(59 * 60_000))).toBe('59 分鐘前')
    expect(relativeTime(isoAgo(60 * 60_000))).toBe('1 小時前')
  })

  it('23 小時 → 23 小時前；剛好 24 小時 → 1 日前', () => {
    expect(relativeTime(isoAgo(23 * 3_600_000))).toBe('23 小時前')
    expect(relativeTime(isoAgo(24 * 3_600_000))).toBe('1 日前')
  })

  it('29 日 → 29 日前；30 日 → 落本地日期格式（非相對措辭）', () => {
    expect(relativeTime(isoAgo(29 * 86_400_000))).toBe('29 日前')
    const at30 = relativeTime(isoAgo(30 * 86_400_000))
    // 30 日（含）以上走 toLocaleDateString 分支：唔再係「啱啱 / …前」措辭，
    // 且包含年份。唔硬編 ICU 確切格式（隨環境而異），只驗語意。
    expect(at30).not.toBe('啱啱')
    expect(at30).not.toMatch(/前$/)
    expect(at30).toContain('2026')
  })

  it('未來時間（時鐘偏移，sec 為負）→ <60 → 啱啱', () => {
    // updatedAt 比此刻遲 5 秒（例如多機時鐘有偏差）：sec = -5 < 60 → 啱啱
    expect(relativeTime(new Date(nowMs + 5_000).toISOString())).toBe('啱啱')
  })
})
