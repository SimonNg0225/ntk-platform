import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  relativeDate,
  addedTrend,
  openTrend,
  shortDate,
  type ResourceRow,
  type ResourceMeta,
  type OpenLog,
} from './util'
import type { Resource } from '../../../data/types'

// ============================================================
//  測試對象：relativeDate / addedTrend / openTrend
//  ------------------------------------------------------------
//  三者都喺內部讀「現在時間」（new Date() / todayKey()），所以全部測試
//  都用 vi.useFakeTimers() 釘死「而家」做可重現基準。
//  全部斷言用「本地時區」分量建構日期，對齊 repo 慣用嘅本地 key
//  （避免 toISOString 嘅 UTC 漂移）。
// ============================================================

// ───────── 測試小工具 ─────────
const meta = (over: Partial<ResourceMeta>): ResourceMeta => ({
  id: 'r',
  favorite: false,
  archived: false,
  broken: false,
  opens: 0,
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...over,
})

const row = (id: string, createdAt: string): ResourceRow => ({
  res: { id, title: 'T', type: 'link', createdAt } as Resource,
  meta: meta({ id }),
})

const log = (resourceId: string, ts: string): OpenLog => ({
  id: `log-${resourceId}-${ts}`,
  resourceId,
  ts,
})

// 「本地某日某時」→ ISO 字串（測試輸入用，模擬實際存落 createdAt / ts 嘅值）
const localISO = (
  y: number,
  mon: number, // 1-based 月份（方便閱讀）
  d: number,
  h = 12,
  min = 0,
): string => new Date(y, mon - 1, d, h, min).toISOString()

// ============================================================
//  relativeDate — 相對時間標籤（含兩個 bug）
// ============================================================
describe('relativeDate', () => {
  // 釘「而家」= 本地 2026-05-31 21:35
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 31, 21, 35, 0))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('undefined → 「—」', () => {
    expect(relativeDate(undefined)).toBe('—')
  })

  it('同日 <1 小時 → 「剛剛」', () => {
    // 而家 21:35，then 21:00 → 差 35 分鐘，floor(diffMs/36e5)=0 <1
    expect(relativeDate(localISO(2026, 5, 31, 21, 0))).toBe('剛剛')
  })

  it('同日 5 小時 → 「5 小時前」', () => {
    // 而家 21:35，then 16:35 → 整 5 小時
    expect(relativeDate(localISO(2026, 5, 31, 16, 35))).toBe('5 小時前')
  })

  it('同日 1 小時整 → 「1 小時前」（hrs 邊界）', () => {
    expect(relativeDate(localISO(2026, 5, 31, 20, 35))).toBe('1 小時前')
  })

  // ── BUG 1：跨午夜但相距 <24h ──
  it('BUG1：前一日 23:30（距今約 22h，跨午夜）→ 應「昨日」而非「0 日前」', () => {
    // 而家 5/31 21:35；then 5/30 23:30 → elapsed ≈ 22h05m。
    // 舊邏輯 Math.floor(22h/天)=0 會誤出「0 日前」；
    // 日曆日差（5/30→5/31 午夜）= 1 → 正確「昨日」。
    expect(relativeDate(localISO(2026, 5, 30, 23, 30))).toBe('昨日')
  })

  it('剛好跨午夜 24h（前一日同一時刻）→ 「昨日」', () => {
    // 而家 5/31 21:35；then 5/30 21:35 → 整 24h，日曆日差 = 1。
    expect(relativeDate(localISO(2026, 5, 30, 21, 35))).toBe('昨日')
  })

  it('days === 1（前一日上午）→ 「昨日」', () => {
    expect(relativeDate(localISO(2026, 5, 30, 9, 0))).toBe('昨日')
  })

  it('days = 6 → 「6 日前」', () => {
    expect(relativeDate(localISO(2026, 5, 25, 10, 0))).toBe('6 日前')
  })

  it('days = 7 → 「1 週前」（7/7 邊界）', () => {
    expect(relativeDate(localISO(2026, 5, 24, 10, 0))).toBe('1 週前')
  })

  it('days = 29 → 「4 週前」', () => {
    // 5/2 → 5/31 = 29 日；floor(29/7)=4
    expect(relativeDate(localISO(2026, 5, 2, 10, 0))).toBe('4 週前')
  })

  it('days = 30 → 絕對日期（<30 邊界外）', () => {
    // 5/1 → 5/31 = 30 日 → 本地 getFullYear/Month/Date 絕對日期
    expect(relativeDate(localISO(2026, 5, 1, 10, 0))).toBe('2026/5/1')
  })

  it('跨年絕對日期用本地年/月/日', () => {
    expect(relativeDate(localISO(2025, 12, 15, 10, 0))).toBe('2025/12/15')
  })

  // ── BUG 2：未來時戳 ──
  it('BUG2：未來時戳（明日 10:00）→ 應 clamp「剛剛」而非「-1/-2 日前」', () => {
    // 而家 5/31 21:35；then 6/1 10:00（未來）→ diffMs 為負。
    // 舊邏輯 Math.floor(負/天) = -1 / -2 → 誤出負日前。
    expect(relativeDate(localISO(2026, 6, 1, 10, 0))).toBe('剛剛')
  })

  it('BUG2：未來但同日（今日稍後）→ 「剛剛」', () => {
    // 而家 5/31 21:35；then 5/31 23:00（未來、同日）→ sameDay 分支
    // hrs = floor(負/36e5) < 1 → 「剛剛」。
    expect(relativeDate(localISO(2026, 5, 31, 23, 0))).toBe('剛剛')
  })

  it('未來多日（後日）→ 仍 clamp「剛剛」', () => {
    expect(relativeDate(localISO(2026, 6, 3, 10, 0))).toBe('剛剛')
  })
})

// ============================================================
//  addedTrend — 過去 N 日每日新增資源數
// ============================================================
describe('addedTrend', () => {
  // 釘「今日」= 本地 2026-05-31（todayKey 依賴本地日期）
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 31, 10, 0, 0))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('空 rows → N 個全 0 bucket（順序由舊到新）', () => {
    const out = addedTrend([], 3)
    expect(out).toEqual([
      { key: '2026-05-29', label: '5/29', count: 0 },
      { key: '2026-05-30', label: '5/30', count: 0 },
      { key: '2026-05-31', label: '5/31', count: 0 },
    ])
  })

  it('bucket 數恰好 = days', () => {
    expect(addedTrend([], 7)).toHaveLength(7)
    expect(addedTrend([], 30)).toHaveLength(30)
  })

  it('days = 1 → 只今日一個 bucket（off-by-one 防護）', () => {
    const out = addedTrend([], 1)
    expect(out).toEqual([{ key: '2026-05-31', label: '5/31', count: 0 }])
  })

  it('days = 0 → 空陣列（無 bucket）', () => {
    expect(addedTrend([], 0)).toEqual([])
  })

  it('createdAt 落今日 → 命中最後一個 bucket（count 1）', () => {
    const out = addedTrend([row('a', localISO(2026, 5, 31, 8, 0))], 3)
    expect(out.map((b) => b.count)).toEqual([0, 0, 1])
    expect(out[2].key).toBe('2026-05-31')
  })

  it('同一日多筆 → 累加', () => {
    const out = addedTrend(
      [
        row('a', localISO(2026, 5, 30, 8, 0)),
        row('b', localISO(2026, 5, 30, 9, 0)),
        row('c', localISO(2026, 5, 30, 23, 30)),
      ],
      3,
    )
    // 全部落 5/30（中間 bucket）
    expect(out.map((b) => b.count)).toEqual([0, 3, 0])
  })

  it('createdAt 早過視窗（>N 日前）→ 唔命中、唔計入', () => {
    // 視窗 3 日 = 5/29..5/31；5/20 喺視窗外
    const out = addedTrend([row('old', localISO(2026, 5, 20, 8, 0))], 3)
    expect(out.map((b) => b.count)).toEqual([0, 0, 0])
  })

  it('createdAt 係未來日 → 唔命中', () => {
    const out = addedTrend([row('future', localISO(2026, 6, 5, 8, 0))], 3)
    expect(out.map((b) => b.count)).toEqual([0, 0, 0])
  })

  it('分散多日各自落 bucket（本地 key 無 UTC 漂移）', () => {
    const out = addedTrend(
      [
        row('a', localISO(2026, 5, 29, 1, 0)),
        row('b', localISO(2026, 5, 31, 23, 30)), // 深夜，本地仍 5/31
      ],
      3,
    )
    expect(out).toEqual([
      { key: '2026-05-29', label: '5/29', count: 1 },
      { key: '2026-05-30', label: '5/30', count: 0 },
      { key: '2026-05-31', label: '5/31', count: 1 },
    ])
  })
})

// ============================================================
//  openTrend — 過去 N 日每日開啟次數
// ============================================================
describe('openTrend', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 31, 10, 0, 0))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('空 logs → N 個全 0 bucket（label 用 shortDate）', () => {
    const out = openTrend([], 3)
    expect(out).toEqual([
      { key: '2026-05-29', label: shortDate('2026-05-29'), count: 0 },
      { key: '2026-05-30', label: '5/30', count: 0 },
      { key: '2026-05-31', label: '5/31', count: 0 },
    ])
  })

  it('bucket 數 = days', () => {
    expect(openTrend([], 5)).toHaveLength(5)
  })

  it('days = 1 → 只今日一個 bucket', () => {
    expect(openTrend([], 1)).toEqual([
      { key: '2026-05-31', label: '5/31', count: 0 },
    ])
  })

  it('days = 0 → 空陣列', () => {
    expect(openTrend([], 0)).toEqual([])
  })

  it('ts 落今日 → 最後 bucket +1', () => {
    const out = openTrend([log('a', localISO(2026, 5, 31, 9, 0))], 3)
    expect(out.map((b) => b.count)).toEqual([0, 0, 1])
  })

  it('同日多次開啟 → 累加', () => {
    const out = openTrend(
      [
        log('a', localISO(2026, 5, 30, 8, 0)),
        log('a', localISO(2026, 5, 30, 12, 0)),
        log('b', localISO(2026, 5, 30, 20, 0)),
      ],
      3,
    )
    expect(out.map((b) => b.count)).toEqual([0, 3, 0])
  })

  it('ts 早過視窗 → 唔計入', () => {
    const out = openTrend([log('a', localISO(2026, 5, 1, 8, 0))], 3)
    expect(out.map((b) => b.count)).toEqual([0, 0, 0])
  })

  it('ts 未來 → 唔命中', () => {
    const out = openTrend([log('a', localISO(2026, 6, 2, 8, 0))], 3)
    expect(out.map((b) => b.count)).toEqual([0, 0, 0])
  })

  it('多日混合落正確 bucket', () => {
    const out = openTrend(
      [
        log('a', localISO(2026, 5, 29, 6, 0)),
        log('b', localISO(2026, 5, 31, 23, 30)),
        log('c', localISO(2026, 5, 31, 1, 0)),
      ],
      3,
    )
    expect(out).toEqual([
      { key: '2026-05-29', label: '5/29', count: 1 },
      { key: '2026-05-30', label: '5/30', count: 0 },
      { key: '2026-05-31', label: '5/31', count: 2 },
    ])
  })
})
