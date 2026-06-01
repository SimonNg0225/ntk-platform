import { describe, it, expect } from 'vitest'
import {
  computeRecentFeatures,
  resolveRecentItems,
  MAX_RECENT_FEATURES,
} from './util'
import type { RecentFeature } from './util'

// ============================================================
//  指令面板「最近開啟功能」純函式測試
//  ------------------------------------------------------------
//  只測「同樣輸入永遠同樣輸出、無 side effect」嘅純函式：
//    computeRecentFeatures（dedupe / 置頂 / 限量；now 由參數注入）
//    resolveRecentItems（按現況解析返可跳轉項；過濾已失效 / 跨模式）
//  跳過：pushRecentFeature / clearRecentFeatures（寫 collection + 用 Date.now）。
//  computeRecentFeatures 把 now 設計成參數注入（同 applyOperators 收 now 一致），
//  故唔使 fake timers；所有預期值用第一性原理人手計。
//  vitest.config 已全域 pin TZ=Asia/Hong_Kong（本檔無日期格式化，與時區無關）。
// ============================================================

// 工廠：造一條 RecentFeature（id 同 featureId 對齊，跟 wrapper 行為）
const rf = (featureId: string, at: number): RecentFeature => ({
  id: featureId,
  featureId,
  at,
})

describe('computeRecentFeatures — dedupe / 置頂 / 限量（純函式）', () => {
  it('空清單開一個 → 得返一條（at = 傳入 now）', () => {
    expect(computeRecentFeatures([], 'learning-notes', 100)).toEqual([
      rf('learning-notes', 100),
    ])
  })

  it('開新功能 → 置頂，其餘維持原相對次序', () => {
    const prev = [rf('a', 30), rf('b', 20), rf('c', 10)]
    expect(computeRecentFeatures(prev, 'd', 40)).toEqual([
      rf('d', 40),
      rf('a', 30),
      rf('b', 20),
      rf('c', 10),
    ])
  })

  it('重開已存在功能 → 去重 + 置頂（更新 at），唔會有重複', () => {
    const prev = [rf('a', 30), rf('b', 20), rf('c', 10)]
    // 重開 c：先抽走舊 c，再以 now=50 置頂
    expect(computeRecentFeatures(prev, 'c', 50)).toEqual([
      rf('c', 50),
      rf('a', 30),
      rf('b', 20),
    ])
  })

  it('重開「已喺第一」嘅功能 → 仍只得一條、at 更新', () => {
    const prev = [rf('a', 30), rf('b', 20)]
    expect(computeRecentFeatures(prev, 'a', 99)).toEqual([
      rf('a', 99),
      rf('b', 20),
    ])
  })

  it('限量：超過 max 砍尾（預設 MAX_RECENT_FEATURES）', () => {
    // 造滿 MAX 條（id = f0..f{MAX-1}，at 遞減令 f0 排頭），再開一個新嘅
    const prev = Array.from({ length: MAX_RECENT_FEATURES }, (_, i) =>
      rf(`f${i}`, MAX_RECENT_FEATURES - i),
    )
    const out = computeRecentFeatures(prev, 'new', 1000)
    expect(out).toHaveLength(MAX_RECENT_FEATURES)
    expect(out[0]).toEqual(rf('new', 1000))
    // 最舊嗰個（f{MAX-1}，原本喺尾）被砍走
    expect(out.some((r) => r.featureId === `f${MAX_RECENT_FEATURES - 1}`)).toBe(false)
    // 其餘 f0..f{MAX-2} 仍喺度
    expect(out.slice(1).map((r) => r.featureId)).toEqual(
      Array.from({ length: MAX_RECENT_FEATURES - 1 }, (_, i) => `f${i}`),
    )
  })

  it('自訂 max 覆寫上限', () => {
    const prev = [rf('a', 3), rf('b', 2), rf('c', 1)]
    expect(computeRecentFeatures(prev, 'd', 4, 2)).toEqual([
      rf('d', 4),
      rf('a', 3),
    ])
  })

  it('max = 0 → 空陣列（極端但唔崩）', () => {
    expect(computeRecentFeatures([rf('a', 1)], 'b', 2, 0)).toEqual([])
  })

  it('負數 max 當 0 處理（Math.max(0, max)）', () => {
    expect(computeRecentFeatures([rf('a', 1)], 'b', 2, -5)).toEqual([])
  })

  it('空 featureId → 原樣回（唔記），但係新陣列（唔 mutate 入參）', () => {
    const prev = [rf('a', 1)]
    const out = computeRecentFeatures(prev, '', 9)
    expect(out).toEqual(prev)
    expect(out).not.toBe(prev) // 回新陣列
  })

  it('純空白 featureId → trim 後當空 → 原樣回', () => {
    const prev = [rf('a', 1)]
    expect(computeRecentFeatures(prev, '   ', 9)).toEqual(prev)
  })

  it('featureId 前後空白 → trim 後先存（id 同 featureId 都係 trim 後）', () => {
    expect(computeRecentFeatures([], '  home  ', 5)).toEqual([rf('home', 5)])
  })

  it('唔 mutate 入參（原陣列內容 + 次序不變）', () => {
    const prev = [rf('a', 30), rf('b', 20), rf('c', 10)]
    const snapshot = prev.map((r) => ({ ...r }))
    computeRecentFeatures(prev, 'c', 50)
    expect(prev).toEqual(snapshot)
  })
})

describe('resolveRecentItems — 按現況解析可跳轉項（過濾已失效 / 跨模式）', () => {
  // 模擬指令面板「目前模式下可跳轉項目」（只需 id；可帶其他欄位）
  const items = [
    { id: 'home', label: '首頁概覽' },
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
    { id: 'c', label: 'C' },
  ]

  it('按 recents 次序回對應項（保留 recents 由新到舊次序）', () => {
    const recents = [rf('b', 30), rf('home', 20), rf('a', 10)]
    expect(resolveRecentItems(recents, items)).toEqual([
      { id: 'b', label: 'B' },
      { id: 'home', label: '首頁概覽' },
      { id: 'a', label: 'A' },
    ])
  })

  it('隔走目前無效嘅 featureId（已移除 / 唔屬目前模式）', () => {
    // 'gone' 唔喺 items（例如切咗模式後嗰個功能唔見） → 跳過
    const recents = [rf('gone', 40), rf('a', 30), rf('zzz', 20)]
    expect(resolveRecentItems(recents, items)).toEqual([{ id: 'a', label: 'A' }])
  })

  it('回傳嘅係 available 入面同一參照（畀 UI 直接用埋 action / icon）', () => {
    const recents = [rf('c', 10)]
    const out = resolveRecentItems(recents, items)
    expect(out[0]).toBe(items[3]) // 同一物件參照（items[3] === {id:'c'}）
  })

  it('去重：recents 有重複 featureId 只出一次（保第一個出現嘅）', () => {
    const recents = [rf('a', 30), rf('a', 20), rf('b', 10)]
    expect(resolveRecentItems(recents, items).map((i) => i.id)).toEqual(['a', 'b'])
  })

  it('限量：limit 截斷（按解析後次序）', () => {
    const recents = [rf('a', 40), rf('b', 30), rf('c', 20), rf('home', 10)]
    expect(resolveRecentItems(recents, items, 2).map((i) => i.id)).toEqual([
      'a',
      'b',
    ])
  })

  it('limit 喺「去重 + 過濾之後」先計（無效項唔佔額）', () => {
    // gone1 / gone2 無效；limit 2 應攞到頭兩個有效項（a, b），唔會因無效項食咗額
    const recents = [
      rf('gone1', 50),
      rf('a', 40),
      rf('gone2', 30),
      rf('b', 20),
      rf('c', 10),
    ]
    expect(resolveRecentItems(recents, items, 2).map((i) => i.id)).toEqual([
      'a',
      'b',
    ])
  })

  it('空 recents → 空陣列', () => {
    expect(resolveRecentItems([], items)).toEqual([])
  })

  it('空 available → 空陣列（樣樣都解析唔到）', () => {
    expect(resolveRecentItems([rf('a', 1)], [])).toEqual([])
  })

  it('全部 recents 都失效 → 空陣列', () => {
    const recents = [rf('x', 3), rf('y', 2), rf('z', 1)]
    expect(resolveRecentItems(recents, items)).toEqual([])
  })

  it('唔 mutate 入參', () => {
    const recents = [rf('b', 30), rf('a', 10)]
    const recentsSnap = recents.map((r) => ({ ...r }))
    const itemsSnap = items.map((i) => ({ ...i }))
    resolveRecentItems(recents, items)
    expect(recents).toEqual(recentsSnap)
    expect(items).toEqual(itemsSnap)
  })
})
