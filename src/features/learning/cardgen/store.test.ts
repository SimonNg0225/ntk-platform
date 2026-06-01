import { describe, it, expect, beforeEach } from 'vitest'
import { genHistoryCol, recentHistory, markSaved } from './store'
import type { GenRecord } from './types'

// ============================================================
//  recentHistory：由 genHistoryCol 取全部，按 ts(ISO) 降序排，取前 limit
//  ------------------------------------------------------------
//  依賴 collection 狀態（非完全純函式）→ 每個 case 用 set() 控制狀態。
//  node 環境無 localStorage，但 store 嘅 set/load 全 try/catch 包住，
//  collection 內存 items 照樣運作（已驗證）。
// ============================================================

// 造一條歷史紀錄（只填 recentHistory 排序 / 取數會用到嘅欄位）
function rec(id: string, ts: string): GenRecord {
  return {
    id,
    ts,
    topic: `topic-${id}`,
    type: 'qa',
    difficulty: 'basic',
    lang: 'zh',
    model: 'gemini-2.5-flash',
    generated: 1,
    saved: 0,
  }
}

beforeEach(() => {
  // 每個 case 前清空，避免互相污染
  genHistoryCol.set([])
})

describe('recentHistory', () => {
  it('空歷史 → 空陣列', () => {
    expect(recentHistory(10)).toEqual([])
  })

  it('單條 → 原樣回單條', () => {
    genHistoryCol.set([rec('a', '2026-01-01T00:00:00.000Z')])
    const out = recentHistory(10)
    expect(out).toHaveLength(1)
    expect(out[0].id).toBe('a')
  })

  it('按 ts 降序排（新→舊）', () => {
    genHistoryCol.set([
      rec('old', '2026-01-01T08:00:00.000Z'),
      rec('new', '2026-03-15T08:00:00.000Z'),
      rec('mid', '2026-02-10T08:00:00.000Z'),
    ])
    expect(recentHistory(10).map((r) => r.id)).toEqual(['new', 'mid', 'old'])
  })

  it('limit 截斷：5 條取前 2 → 最新 2 條', () => {
    genHistoryCol.set([
      rec('r1', '2026-01-01T00:00:00.000Z'),
      rec('r2', '2026-01-02T00:00:00.000Z'),
      rec('r3', '2026-01-03T00:00:00.000Z'),
      rec('r4', '2026-01-04T00:00:00.000Z'),
      rec('r5', '2026-01-05T00:00:00.000Z'),
    ])
    expect(recentHistory(2).map((r) => r.id)).toEqual(['r5', 'r4'])
  })

  it('limit 大過總數 → 全部回（排好序）', () => {
    genHistoryCol.set([
      rec('a', '2026-01-01T00:00:00.000Z'),
      rec('b', '2026-01-02T00:00:00.000Z'),
    ])
    expect(recentHistory(100).map((r) => r.id)).toEqual(['b', 'a'])
  })

  it('limit = 0 → 空陣列', () => {
    genHistoryCol.set([
      rec('a', '2026-01-01T00:00:00.000Z'),
      rec('b', '2026-01-02T00:00:00.000Z'),
    ])
    expect(recentHistory(0)).toEqual([])
  })

  it('預設 limit = 30：32 條只回 30 條', () => {
    const items = Array.from({ length: 32 }, (_, i) =>
      // ts 遞增：第 0 條最舊、第 31 條最新
      rec(`r${i}`, `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`),
    )
    genHistoryCol.set(items)
    const out = recentHistory()
    expect(out).toHaveLength(30)
    // 最新嗰條（r31）排第一，最舊兩條（r0、r1）被截走
    expect(out[0].id).toBe('r31')
    expect(out.map((r) => r.id)).not.toContain('r0')
    expect(out.map((r) => r.id)).not.toContain('r1')
  })

  it('兩條相同 ts（同毫秒）→ localeCompare 回 0，保留兩條', () => {
    genHistoryCol.set([
      rec('x', '2026-05-01T12:00:00.000Z'),
      rec('y', '2026-05-01T12:00:00.000Z'),
    ])
    const out = recentHistory(10)
    expect(out).toHaveLength(2)
    expect(out.map((r) => r.id).sort()).toEqual(['x', 'y'])
  })

  it('UTC ISO 字串（toISOString 格式）字典序=時間序，排序正確', () => {
    // 模擬 new Date().toISOString() 真實格式
    genHistoryCol.set([
      rec('a', '2025-12-31T23:59:59.999Z'),
      rec('b', '2026-01-01T00:00:00.000Z'),
    ])
    expect(recentHistory(10).map((r) => r.id)).toEqual(['b', 'a'])
  })

  it('唔會原地改動 collection（回新陣列）', () => {
    const items = [
      rec('a', '2026-01-01T00:00:00.000Z'),
      rec('b', '2026-01-02T00:00:00.000Z'),
    ]
    genHistoryCol.set(items)
    const before = genHistoryCol.get()
    recentHistory(10)
    // collection 內部次序唔受影響（recentHistory 用 [...].sort 複製）
    expect(genHistoryCol.get()).toBe(before)
    expect(genHistoryCol.get().map((r) => r.id)).toEqual(['a', 'b'])
  })
})

// ============================================================
//  markSaved：生成後補回「已存數 / 牌組名」嘅唯一寫入點
//  ------------------------------------------------------------
//  本質係 genHistoryCol.update(id, { saved, deckName }) 嘅薄包裝：
//  patch 命中嗰條 record 嘅 saved / deckName，其餘欄位原封不動；
//  id 唔存在則 collection 內容不變（亦唔 throw）。
// ============================================================
describe('markSaved', () => {
  it('命中已存在 record：只改 saved / deckName，其餘欄位不變', () => {
    const original = rec('a', '2026-04-01T08:00:00.000Z')
    genHistoryCol.set([original])

    markSaved('a', 5, '生物科')

    const out = genHistoryCol.get()
    expect(out).toHaveLength(1)
    const after = out[0]
    // 目標兩欄被更新
    expect(after.saved).toBe(5)
    expect(after.deckName).toBe('生物科')
    // 其餘欄位（topic / type / generated / ts 等）原封不動
    expect(after.id).toBe('a')
    expect(after.ts).toBe('2026-04-01T08:00:00.000Z')
    expect(after.topic).toBe('topic-a')
    expect(after.type).toBe('qa')
    expect(after.generated).toBe(1)
    expect(after.difficulty).toBe('basic')
    expect(after.lang).toBe('zh')
    expect(after.model).toBe('gemini-2.5-flash')
  })

  it('多條 record：只更新目標 id，其他 record 完全不受影響', () => {
    genHistoryCol.set([
      rec('a', '2026-01-01T00:00:00.000Z'),
      rec('b', '2026-02-01T00:00:00.000Z'),
      rec('c', '2026-03-01T00:00:00.000Z'),
    ])

    markSaved('b', 3, '化學科')

    const byId = Object.fromEntries(genHistoryCol.get().map((r) => [r.id, r]))
    // b 被更新
    expect(byId.b.saved).toBe(3)
    expect(byId.b.deckName).toBe('化學科')
    // a、c 維持原 seed（saved=0、無 deckName）
    expect(byId.a.saved).toBe(0)
    expect(byId.a.deckName).toBeUndefined()
    expect(byId.c.saved).toBe(0)
    expect(byId.c.deckName).toBeUndefined()
  })

  it('id 唔存在：collection 內容無變化，亦唔 throw', () => {
    genHistoryCol.set([
      rec('a', '2026-01-01T00:00:00.000Z'),
      rec('b', '2026-02-01T00:00:00.000Z'),
    ])

    expect(() => markSaved('does-not-exist', 9, '幽靈牌組')).not.toThrow()

    // 內容（逐欄值）維持原狀；無新增、無被改
    const out = genHistoryCol.get()
    expect(out).toHaveLength(2)
    expect(out.map((r) => r.id)).toEqual(['a', 'b'])
    expect(out.every((r) => r.saved === 0)).toBe(true)
    expect(out.every((r) => r.deckName === undefined)).toBe(true)
  })

  it('saved = 0：可把已存數重置為 0（亦覆寫 deckName）', () => {
    const original: GenRecord = {
      ...rec('a', '2026-01-01T00:00:00.000Z'),
      saved: 7,
      deckName: '舊牌組',
    }
    genHistoryCol.set([original])

    markSaved('a', 0, '新牌組')

    const after = genHistoryCol.get()[0]
    expect(after.saved).toBe(0)
    expect(after.deckName).toBe('新牌組')
  })

  it('經 recentHistory 讀返：markSaved 後見到最新 saved / deckName', () => {
    genHistoryCol.set([
      rec('old', '2026-01-01T00:00:00.000Z'),
      rec('new', '2026-03-01T00:00:00.000Z'),
    ])

    markSaved('new', 4, '物理科')

    // recentHistory 由同一 collection 取數 → 應反映更新
    const out = recentHistory(10)
    const target = out.find((r) => r.id === 'new')
    expect(target).toBeDefined()
    expect(target?.saved).toBe(4)
    expect(target?.deckName).toBe('物理科')
    // 未被標記嗰條維持 saved=0
    expect(out.find((r) => r.id === 'old')?.saved).toBe(0)
  })

  it('空 collection 對任何 id markSaved：仍係空、唔 throw', () => {
    // beforeEach 已 set([])，此處再明確驗證空 collection 邊界
    expect(() => markSaved('whatever', 1, '牌組')).not.toThrow()
    expect(genHistoryCol.get()).toEqual([])
  })
})
