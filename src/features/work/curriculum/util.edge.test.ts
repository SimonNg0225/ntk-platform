import { describe, it, expect } from 'vitest'
import { toKey, fmtDate, groupTopics } from './util'
import type { Topic } from '../../../data/types'

// ============================================================
//  補充邊界測試（util.test.ts 未覆蓋嘅缺口）
//  - toKey：閏年 2 月 29
//  - fmtDate：完整 ISO（含 T）路徑 — 走 new Date(iso) 用本地 getter，
//    需同 toKey（本地時區）一致；呢條路徑喺 util.test.ts 完全無覆蓋。
//  - groupTopics：單元素、重複 order（穩定）
//  全部以「由本地 Date 推導 ISO」方式構造，確保任何時區都過（無 TZ 假設）。
// ============================================================

const topic = (over: Partial<Topic> & { id: string }): Topic => ({
  part: 'P',
  area: 'A',
  topic: 't',
  order: 0,
  ...over,
})

// ============================================================
//  toKey — 閏年邊界
// ============================================================
describe('toKey（閏年）', () => {
  it('閏年 2 月 29 日正確（2024）', () => {
    // 本地 2024-02-29 必為 "2024-02-29"，無論時區（用本地建構子）
    expect(toKey(new Date(2024, 1, 29))).toBe('2024-02-29')
  })

  it('閏年翌日為 3 月 1 日（無提早跳月）', () => {
    expect(toKey(new Date(2024, 2, 1))).toBe('2024-03-01')
  })
})

// ============================================================
//  fmtDate — 完整 ISO（含 T）路徑
//  關鍵：dateDone 係 new Date().toISOString()（UTC）。fmtDate 對含 T
//  嘅字串走 new Date(iso) + 本地 getMonth/getDate，結果應同 toKey 一致。
// ============================================================
describe('fmtDate（完整 ISO 路徑）', () => {
  it('完整 ISO 以本地時區顯示，與 toKey 月/日一致', () => {
    // 由本地 Date 推導 ISO：任何時區下 toISOString 與 toKey 必對應同一本地日
    const local = new Date(2026, 4, 4, 12, 0, 0) // 本地 5/4 中午
    const iso = local.toISOString()
    expect(iso).toContain('T') // 確認走完整 ISO 分支
    const m = `${local.getMonth() + 1}月${local.getDate()}日`
    expect(fmtDate(iso)).toBe(m)
    expect(fmtDate(iso)).toBe('5月4日')
  })

  it('完整 ISO 近本地午夜：用本地日，唔會因 UTC 漂移跨日', () => {
    // 本地 1/1 00:30；喺 UTC+8 其 ISO 會係上年 12/31，但本地 getter 應仍係 1/1
    const local = new Date(2026, 0, 1, 0, 30, 0)
    const iso = local.toISOString()
    expect(fmtDate(iso)).toBe(`${local.getMonth() + 1}月${local.getDate()}日`)
    expect(fmtDate(iso)).toBe('1月1日')
    // 同 toKey 一致（本檔重點：兩條本地時區路徑對齊）
    expect(fmtDate(iso)).toBe(`${toKey(local).split('-').map(Number)[1]}月${toKey(local).split('-').map(Number)[2]}日`)
  })

  it('完整 ISO 但無效日期回空字串', () => {
    expect(fmtDate('2026-13-45T00:00:00.000Z')).toBe('')
    expect(fmtDate('garbage T text')).toBe('')
  })
})

// ============================================================
//  groupTopics — 單元素 / 重複 order
// ============================================================
describe('groupTopics（單元素 / 重複 order）', () => {
  it('單一課題：一個 part 一個 area', () => {
    const res = groupTopics([topic({ id: 'only', part: 'P1', area: 'A1', order: 5 })])
    expect(res).toHaveLength(1)
    expect(res[0].part).toBe('P1')
    expect(res[0].items.map((t) => t.id)).toEqual(['only'])
    expect(res[0].areas).toHaveLength(1)
    expect(res[0].areas[0].area).toBe('A1')
    expect(res[0].areas[0].items.map((t) => t.id)).toEqual(['only'])
  })

  it('重複 order：唔丟失元素，全部歸入正確 part/area', () => {
    const res = groupTopics([
      topic({ id: 'x', part: 'P1', area: 'A1', order: 1 }),
      topic({ id: 'y', part: 'P1', area: 'A1', order: 1 }), // 同 order
      topic({ id: 'z', part: 'P2', area: 'A2', order: 1 }), // 同 order 不同 part
    ])
    // 兩個 part 都要在（首見次序 P1 先）
    expect(res.map((p) => p.part)).toEqual(['P1', 'P2'])
    // P1 兩個元素都保留（無因 order 相等而被吞）
    const p1ids = res[0].items.map((t) => t.id).sort()
    expect(p1ids).toEqual(['x', 'y'])
    expect(res[0].areas).toHaveLength(1)
    expect(res[0].areas[0].items.map((t) => t.id).sort()).toEqual(['x', 'y'])
    // P2 一個
    expect(res[1].items.map((t) => t.id)).toEqual(['z'])
    // 總數守恆
    expect(res.reduce((n, p) => n + p.items.length, 0)).toBe(3)
  })
})
