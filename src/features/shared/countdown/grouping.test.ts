import { describe, it, expect } from 'vitest'
import {
  timeBucket,
  groupByTime,
  filterByCategory,
  categoryCounts,
  BUCKET_META,
  type CategoryFilter,
} from './grouping'
import type { Countdown, CountdownCategory } from '../../../data/types'

// ────────────────────────────────────────────────────────────
//  純函式測試（Countdown 時間分段 + 分類篩選）。
//  預期值用第一性原理人手計，唔靠跑 code 反推。
//  日期一律用「本地時區」語意（呢個 repo 刻意避 toISOString 的 UTC 漂移；
//  分段用本地正午錨點 + getDay()/getMonth()，與 Countdown.tsx 一致）。
//  環境 node、無 jsdom，全部唔掂 DOM/React。
// ────────────────────────────────────────────────────────────

// helper：砌最小 Countdown（只在意 date / category）
const cd = (over: Partial<Countdown> & { id: string }): Countdown => ({
  title: '',
  date: '2026-06-01',
  createdAt: '2026-01-01T00:00:00',
  ...over,
})

describe('timeBucket（目標日 → 本週 / 本月 / 更遠）', () => {
  // 基準錨點：2026-06-03 係星期三（getDay()=3）。
  // 本曆週尾（星期日）= 6 月 7 日。本曆月尾 = 6 月 30 日。
  const TODAY = '2026-06-03'

  it('今日本身 → week（下邊界，週內含今日）', () => {
    expect(timeBucket('2026-06-03', TODAY)).toBe('week')
  })

  it('本週稍後（週四 6/4）→ week', () => {
    expect(timeBucket('2026-06-04', TODAY)).toBe('week')
  })

  it('本曆週尾星期日 6/7 → week（上邊界，含星期日）', () => {
    expect(timeBucket('2026-06-07', TODAY)).toBe('week')
  })

  it('下星期一 6/8 → month（已過本週日，但仍在 6 月）', () => {
    expect(timeBucket('2026-06-08', TODAY)).toBe('month')
  })

  it('本曆月尾 6/30 → month（上邊界，含月尾）', () => {
    expect(timeBucket('2026-06-30', TODAY)).toBe('month')
  })

  it('下個月 7/1 → far（過咗本月）', () => {
    expect(timeBucket('2026-07-01', TODAY)).toBe('far')
  })

  it('明年同月 2027-06-05 → far（同月不同年，唔算本月）', () => {
    // 防 off-by-one：只比 getMonth() 會錯收，必須連年份一齊比。
    expect(timeBucket('2027-06-05', TODAY)).toBe('far')
  })

  it('今日就係星期日：週尾 = 今日，淨係今日入 week', () => {
    // 2026-06-07 係星期日（getDay()=0）→ 6 - 0 = 0，週尾 = 自己。
    expect(timeBucket('2026-06-07', '2026-06-07')).toBe('week') // 今日
    expect(timeBucket('2026-06-08', '2026-06-07')).toBe('month') // 聽日已出週
  })

  it('今日就係星期一：成個 7 日窗都入 week 直到今個禮拜日', () => {
    // 2026-06-01 係星期一（getDay()=1）→ 本週日 = 6/1 + 6 = 6/7。
    expect(timeBucket('2026-06-01', '2026-06-01')).toBe('week')
    expect(timeBucket('2026-06-07', '2026-06-01')).toBe('week') // 同週星期日
    expect(timeBucket('2026-06-08', '2026-06-01')).toBe('month') // 出週、仍在 6 月
  })

  it('週尾跨月：本週日落喺下個月時，跨月嘅日子仍歸 week', () => {
    // 2026-06-29 係星期一（getDay()=1）→ 由今日去星期日 = (7-1)%7 = 6 日
    //   → 本週日 = 2026-07-05，跨咗去 7 月。週內（含跨月部分）全部 week。
    expect(timeBucket('2026-06-29', '2026-06-29')).toBe('week') // 今日
    expect(timeBucket('2026-07-05', '2026-06-29')).toBe('week') // 同週、跨月仍 week
    expect(timeBucket('2026-07-06', '2026-06-29')).toBe('far') // 出週、又唔同月 → far
  })

  it('12 月跨年週：本週日去到明年 1 月仍歸 week', () => {
    // 2026-12-28 係星期一（getDay()=1）→ 本週日 = 2027-01-03（跨年）。
    expect(timeBucket('2027-01-03', '2026-12-28')).toBe('week') // 跨年同週
    expect(timeBucket('2027-01-04', '2026-12-28')).toBe('far') // 出週、明年 → far
  })

  it('畸形 key（target 或 today）→ far（唔丟錯）', () => {
    expect(timeBucket('', TODAY)).toBe('far')
    expect(timeBucket('2026-06-04', '')).toBe('far')
    expect(timeBucket('abc', TODAY)).toBe('far')
  })
})

describe('groupByTime（分段 + 保留次序 + 略過空段）', () => {
  const TODAY = '2026-06-03' // 星期三；週尾 6/7、月尾 6/30

  it('混合三段：各歸其位、只回有內容嘅段、段次序 week→month→far', () => {
    const items = [
      cd({ id: 'a', date: '2026-06-04' }), // week
      cd({ id: 'b', date: '2026-06-20' }), // month
      cd({ id: 'c', date: '2026-09-01' }), // far
    ]
    const groups = groupByTime(items, TODAY)
    expect(groups.map((g) => g.bucket)).toEqual(['week', 'month', 'far'])
    expect(groups.map((g) => g.items.map((i) => i.id))).toEqual([['a'], ['b'], ['c']])
  })

  it('空段唔出（只有 week 同 far）', () => {
    const items = [
      cd({ id: 'a', date: '2026-06-05' }), // week
      cd({ id: 'c', date: '2026-12-01' }), // far
    ]
    const groups = groupByTime(items, TODAY)
    expect(groups.map((g) => g.bucket)).toEqual(['week', 'far'])
  })

  it('保留入面原有次序（唔自己再排）', () => {
    // 同一段內，輸入次序 b 先過 a，輸出都應該 b 先過 a。
    const items = [
      cd({ id: 'b', date: '2026-06-06' }),
      cd({ id: 'a', date: '2026-06-05' }),
    ]
    const groups = groupByTime(items, TODAY)
    expect(groups).toHaveLength(1)
    expect(groups[0].bucket).toBe('week')
    expect(groups[0].items.map((i) => i.id)).toEqual(['b', 'a'])
  })

  it('空陣列 → 空結果', () => {
    expect(groupByTime([], TODAY)).toEqual([])
  })

  it('label / hint 對齊 BUCKET_META', () => {
    const items = [cd({ id: 'a', date: '2026-06-04' })]
    const [g] = groupByTime(items, TODAY)
    const meta = BUCKET_META.find((m) => m.id === 'week')!
    expect(g.label).toBe(meta.label)
    expect(g.hint).toBe(meta.hint)
  })
})

describe('BUCKET_META（分段元資料）', () => {
  it('剛好三段、次序 week→month→far', () => {
    expect(BUCKET_META.map((m) => m.id)).toEqual(['week', 'month', 'far'])
  })
  it('label 係繁中', () => {
    expect(BUCKET_META.map((m) => m.label)).toEqual(['本週內', '本月內', '更遠'])
  })
})

describe('filterByCategory（按分類篩選）', () => {
  const items = [
    cd({ id: 'a', category: 'exam' }),
    cd({ id: 'b', category: 'deadline' }),
    cd({ id: 'c', category: 'exam' }),
    cd({ id: 'd' }), // 無分類
  ]

  it("'all' → 原樣回傳（同一個 reference）", () => {
    expect(filterByCategory(items, 'all')).toBe(items)
  })

  it('揀 exam → 淨係 exam（保次序）', () => {
    expect(filterByCategory(items, 'exam').map((c) => c.id)).toEqual(['a', 'c'])
  })

  it('揀 deadline → 淨係 deadline', () => {
    expect(filterByCategory(items, 'deadline').map((c) => c.id)).toEqual(['b'])
  })

  it('無分類嘅項唔會中任何具體分類篩選', () => {
    // 'd' 無 category，揀任何具體分類都唔應出現。
    for (const f of ['exam', 'deadline', 'assessment', 'event', 'other'] as CountdownCategory[]) {
      expect(filterByCategory(items, f).some((c) => c.id === 'd')).toBe(false)
    }
  })

  it('揀無人用嘅分類 → 空陣列', () => {
    expect(filterByCategory(items, 'event')).toEqual([])
  })
})

describe('categoryCounts（每分類項數 + all 總數）', () => {
  it('正常統計：all = 總數，具體分類各自計', () => {
    const items = [
      cd({ id: 'a', category: 'exam' }),
      cd({ id: 'b', category: 'exam' }),
      cd({ id: 'c', category: 'deadline' }),
      cd({ id: 'd' }), // 無分類：只計入 all
    ]
    const counts = categoryCounts(items)
    expect(counts.all).toBe(4)
    expect(counts.exam).toBe(2)
    expect(counts.deadline).toBe(1)
    expect(counts.assessment).toBe(0)
    expect(counts.event).toBe(0)
    expect(counts.other).toBe(0)
  })

  it('空陣列 → 全部 0', () => {
    const counts = categoryCounts([])
    const keys: CategoryFilter[] = ['all', 'exam', 'deadline', 'assessment', 'event', 'other']
    for (const k of keys) expect(counts[k]).toBe(0)
  })

  it('all 永遠等於 sum(具體分類) + 無分類項', () => {
    const items = [
      cd({ id: 'a', category: 'assessment' }),
      cd({ id: 'b', category: 'event' }),
      cd({ id: 'c', category: 'other' }),
      cd({ id: 'd' }),
      cd({ id: 'e' }),
    ]
    const counts = categoryCounts(items)
    const sumSpecific =
      counts.exam + counts.deadline + counts.assessment + counts.event + counts.other
    expect(sumSpecific).toBe(3) // 3 個有分類
    expect(counts.all).toBe(5) // 連 2 個無分類
  })
})
