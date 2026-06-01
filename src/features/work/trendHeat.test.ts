import { describe, it, expect } from 'vitest'
import {
  buildTrendCore,
  buildHeatCore,
  completionStreak,
  type DateHelpers,
  type HeatCell,
} from './trendHeat'

// ============================================================
//  共用核心測試：buildTrendCore / buildHeatCore / completionStreak
//  ------------------------------------------------------------
//  dashboard/util 同 todo/util 各自有逐字相同嘅本地日期工具
//  （localKey/addKey vs localISO/addDays）。呢度注入一套等價、
//  簡單嘅「純 YYYY-MM-DD 字串運算」helper（鎖死今日），驗核心
//  骨架 + accessor 行為，唔受系統時鐘影響。
// ============================================================

// 固定今日 = 2026-05-15；用 UTC 算術做純字串日期加減（測試用，等價於本地 helper）。
const FIXED_TODAY = '2026-05-15'
const dh: DateHelpers = {
  todayKey: () => FIXED_TODAY,
  addDays: (key, n) => {
    const [y, m, d] = key.split('-').map(Number)
    const dt = new Date(Date.UTC(y, m - 1, d))
    dt.setUTCDate(dt.getUTCDate() + n)
    return dt.toISOString().slice(0, 10)
  },
  // 測試型 localDay：直接取 YYYY-MM-DD（accessor 已餵本地形式字串）
  localDay: (iso) => iso.slice(0, 10),
}

interface Row {
  created: string
  done: boolean
  completed?: string
}
const row = (created: string, done = false, completed?: string): Row => ({
  created,
  done,
  completed,
})

// 同 dashboard / todo 落實一致：completedAt accessor 折入 done 守門
const createdOf = (r: Row) => r.created
const completedOf = (r: Row) => (r.done ? r.completed : undefined)

describe('buildTrendCore', () => {
  it('空 → 全 0、長度 = days、窗口倒序（最舊→今日）', () => {
    const out = buildTrendCore<Row>([], 7, createdOf, completedOf, dh)
    expect(out).toHaveLength(7)
    expect(out[0].key).toBe('2026-05-09')
    expect(out[6].key).toBe(FIXED_TODAY)
    expect(out.every((p) => p.created === 0 && p.completed === 0)).toBe(true)
  })

  it('days=0 → 空陣列', () => {
    expect(buildTrendCore<Row>([row('2026-05-15')], 0, createdOf, completedOf, dh)).toEqual([])
  })

  it('label 去前導零', () => {
    const out = buildTrendCore<Row>([], 7, createdOf, completedOf, dh)
    expect(out.map((p) => p.label)).toEqual(['9', '10', '11', '12', '13', '14', '15'])
  })

  it('created 入桶；completed 只計 done && completedAt', () => {
    const rows: Row[] = [
      row('2026-05-13'), // created → 05-13
      row('2026-05-12', true, '2026-05-14'), // created 05-12、completed 05-14
      row('2026-05-14', false, '2026-05-14'), // 未完成：created 計、completed 不計
      row('2026-05-01', true, '2026-05-01'), // 窗口外（早過 05-09）：兩者皆不計
    ]
    const out = buildTrendCore<Row>(rows, 7, createdOf, completedOf, dh)
    expect(out.find((p) => p.key === '2026-05-13')!.created).toBe(1)
    expect(out.find((p) => p.key === '2026-05-12')!.created).toBe(1)
    expect(out.find((p) => p.key === '2026-05-14')!.created).toBe(1)
    expect(out.reduce((s, p) => s + p.created, 0)).toBe(3)
    // 只有「已完成 b」喺 05-14 完成
    expect(out.find((p) => p.key === '2026-05-14')!.completed).toBe(1)
    expect(out.reduce((s, p) => s + p.completed, 0)).toBe(1)
  })

  it('同日多件累加', () => {
    const rows: Row[] = [
      row('2026-05-15', true, '2026-05-15'),
      row('2026-05-15', true, '2026-05-15'),
    ]
    const out = buildTrendCore<Row>(rows, 7, createdOf, completedOf, dh)
    const today = out.find((p) => p.key === FIXED_TODAY)!
    expect(today.created).toBe(2)
    expect(today.completed).toBe(2)
  })
})

describe('buildHeatCore', () => {
  it('空 → 全 0、長度 = days、倒序', () => {
    const out = buildHeatCore<Row>([], 5, completedOf, dh)
    expect(out).toHaveLength(5)
    expect(out[0].key).toBe('2026-05-11')
    expect(out[4].key).toBe(FIXED_TODAY)
    expect(out.every((c) => c.count === 0)).toBe(true)
  })

  it('days=0 → 空陣列', () => {
    expect(buildHeatCore<Row>([row('x', true, '2026-05-15')], 0, completedOf, dh)).toEqual([])
  })

  it('只計 done && completedAt，窗口外不計，同日累加', () => {
    const rows: Row[] = [
      row('x', true, '2026-05-14'),
      row('x', false, '2026-05-14'), // 未完成不計
      row('x', true, undefined), // 無 completedAt 不計
      row('x', true, '2026-05-01'), // 窗口外不計
      row('x', true, '2026-05-15'),
      row('x', true, '2026-05-15'),
    ]
    const out = buildHeatCore<Row>(rows, 5, completedOf, dh)
    expect(out.find((c) => c.key === '2026-05-14')!.count).toBe(1)
    expect(out.find((c) => c.key === FIXED_TODAY)!.count).toBe(2)
    expect(out.reduce((s, c) => s + c.count, 0)).toBe(3)
    // 窗口外嗰個 key 根本唔喺 cells
    expect(out.some((c) => c.key === '2026-05-01')).toBe(false)
  })
})

describe('completionStreak', () => {
  const cells = (counts: number[]): HeatCell[] =>
    counts.map((count, i) => ({ key: `k${i}`, count }))

  it('空 → 0', () => {
    expect(completionStreak([])).toBe(0)
  })
  it('連續完成由尾數', () => {
    expect(completionStreak(cells([1, 1, 1]))).toBe(3)
  })
  it('今日(最後一格)未做唔斷，只跳過今日', () => {
    expect(completionStreak(cells([1, 1, 0]))).toBe(2)
    expect(completionStreak(cells([0, 1, 0]))).toBe(1)
  })
  it('今日做咗但之前斷 → 由今日起計', () => {
    expect(completionStreak(cells([1, 0, 1]))).toBe(1)
  })
  it('全 0 → 0；單格', () => {
    expect(completionStreak(cells([0, 0, 0]))).toBe(0)
    expect(completionStreak(cells([1]))).toBe(1)
    expect(completionStreak(cells([0]))).toBe(0)
  })
})
