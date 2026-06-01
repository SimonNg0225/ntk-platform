import { describe, it, expect } from 'vitest'
import { collectionRegistry } from '../lib/store'
import { preloadAllFeatures } from '../features/registry'
import { exportAllData, importAllData, topicsCol } from './collections'

// 各 feature 嘅 collection 係 lazy 動態 import 先 createCollection 並登記入
// collectionRegistry。exportAllData / importAllData 都係枚舉 collectionRegistry，
// 所以呼叫前必須 await preloadAllFeatures()（同 Settings 匯出/匯入/清除、sync.ts
// 一致），否則匯出殘缺、匯入靜靜跳過未登記嘅 feature col。
//
// 呢條 test 鎖住嗰個前置條件：preload 後 registry 一定含齊代表性 feature col，
// 而匯出含、匯入寫得入呢啲 col。

// 代表多個獨立 feature chunk 嘅 lazy collection（唔喺 data/collections.ts 靜態登記）
const LAZY_FEATURE_KEYS = [
  'fitness_training_v1',
  'notes_rich_v2',
  'health_logs_v1',
  'journal_v2',
]

describe('exportAllData / importAllData ＋ preloadAllFeatures', () => {
  it('preload 後 collectionRegistry 含齊 lazy feature collection', async () => {
    const before = collectionRegistry.size
    await preloadAllFeatures()
    const after = collectionRegistry.size

    // preload 真係多登記咗 lazy feature collection（唔止靜態核心清單）
    expect(after).toBeGreaterThan(before)
    for (const key of LAZY_FEATURE_KEYS) {
      expect(collectionRegistry.has(key)).toBe(true)
    }
  })

  it('preload 後 exportAllData 含 feature collection（唔會殘缺）', async () => {
    await preloadAllFeatures()
    const { data } = exportAllData()
    for (const key of LAZY_FEATURE_KEYS) {
      expect(key in data).toBe(true)
    }
  })

  it('preload 後 importAllData 會寫入 feature collection（唔會靜靜跳過）', async () => {
    await preloadAllFeatures()
    const payload = {
      data: Object.fromEntries(
        LAZY_FEATURE_KEYS.map((key, i) => [key, [{ id: `imported-${i}` }]]),
      ),
    }
    const count = importAllData(payload)

    // 每個 feature col 都覆寫到
    expect(count).toBeGreaterThanOrEqual(LAZY_FEATURE_KEYS.length)
    for (const key of LAZY_FEATURE_KEYS) {
      const col = collectionRegistry.get(key)
      expect(col).toBeDefined()
      expect((col!.get() as { id: string }[]).map((r) => r.id)).toContain(
        `imported-${LAZY_FEATURE_KEYS.indexOf(key)}`,
      )
    }
  })
})

// ============================================================
//  importAllData — 壞檔守衞（throw 分支）＋ 跳過/未登記 key 邊界
//  ------------------------------------------------------------
//  既有測試只覆蓋 happy path。importAllData 係匯入壞檔嘅第一道防線：
//  payload 唔係物件 / null / 缺 'data' 欄位都要 throw '檔案格式唔啱'。
//  另外覆蓋兩條靜默分支：data[key] 非陣列嗰啲 key 要被跳過（唔覆寫、
//  唔計入 count）；data 含未登記 key 唔崩、count 唔加。
//
//  importAllData 全程冇日期邏輯（無 new Date()），故無需 vi 鎖時間；
//  vitest.config 已全域 pin TZ=Asia/Hong_Kong。col.set 走 store 嘅
//  persist（try/catch 包住），node 無 localStorage 亦照運作（同上文一致）。
// ============================================================
describe('importAllData — 壞檔守衞 throw 分支', () => {
  it('payload === null → throw 檔案格式唔啱', () => {
    // typeof null === 'object'，靠 payload === null 一句兜住
    expect(() => importAllData(null)).toThrow('檔案格式唔啱')
  })

  it('payload 係原始型別（number / string / boolean / undefined）→ throw', () => {
    expect(() => importAllData(42)).toThrow('檔案格式唔啱')
    expect(() => importAllData('not an object')).toThrow('檔案格式唔啱')
    expect(() => importAllData(true)).toThrow('檔案格式唔啱')
    expect(() => importAllData(undefined)).toThrow('檔案格式唔啱')
  })

  it('payload 係物件但缺 data 欄位 → throw（即使有其他欄位）', () => {
    expect(() => importAllData({})).toThrow('檔案格式唔啱')
    // 似真匯出檔但漏咗 data（例如手改壞 / 舊格式）
    expect(() => importAllData({ version: 1, exportedAt: '2026-06-01' })).toThrow(
      '檔案格式唔啱',
    )
  })

  it('守衞短路次序正確：("data" in payload) 唔會喺 null/原始型別上爆 TypeError', () => {
    // 'in' 用喺非物件會掟 TypeError；靠前兩個 clause 短路擋住，
    // 故掟出嘅一定係我哋自訂嘅「檔案格式唔啱」而唔係 TypeError。
    for (const bad of [null, undefined, 0, '', NaN, false]) {
      expect(() => importAllData(bad)).toThrowError(/檔案格式唔啱/)
    }
  })
})

describe('importAllData — 跳過非陣列 / 未登記 key（靜默分支）', () => {
  it('合法 payload（data 含登記 key 嘅陣列）會覆寫並回正確 count', async () => {
    // 確保 registry 含齊（同 happy-path 一致先 preload）
    await preloadAllFeatures()
    const seed = [{ id: 'sentinel-topic' }]
    importAllData({ data: { topics: seed } })
    expect(topicsCol.get()).toEqual(seed)
  })

  it('data[key] 唔係陣列（物件 / 字串 / 數字 / null）→ 唔覆寫、唔計入 count', () => {
    // 先放一個 sentinel 落已登記嘅 topics col，之後驗證冇被改
    const sentinel = [{ id: 'keep-me' }]
    topicsCol.set(sentinel as never[])

    // data 只含「非陣列」值（覆蓋 object / string / number / null 幾種）；
    // 其餘登記 key 喺 data 度係 undefined → 一律 Array.isArray=false → skip。
    const count = importAllData({
      data: {
        topics: { not: 'an array' }, // 物件
        classes: 'oops', // 字串
        students: 123, // 數字
        decks: null, // null
      },
    })

    // 全部非陣列 → 一個都唔覆寫
    expect(count).toBe(0)
    // topics 維持原 sentinel，冇被 { not: 'an array' } 覆蓋
    expect(topicsCol.get()).toEqual(sentinel)
  })

  it('data 含未登記 key → 唔崩、count 唔加（只算登記 + 陣列嗰啲）', () => {
    const before = topicsCol.get()
    // 一個合法登記 key（topics）+ 一個完全未登記嘅 key
    const count = importAllData({
      data: {
        topics: [{ id: 'real-1' }],
        __not_a_real_collection__: [{ id: 'ghost' }],
        另一個唔存在嘅: [{ id: 'ghost2' }],
      },
    })

    // 只有 topics（唯一登記 + 陣列）被算入；未登記 key 完全被忽略
    expect(count).toBe(1)
    expect(topicsCol.get()).toEqual([{ id: 'real-1' }])
    // 確認真係改咗（sanity：唔係 before）
    expect(topicsCol.get()).not.toEqual(before)
  })

  it('data 係空物件 → count 0、唔掟錯（每個登記 key 都係 undefined → skip）', () => {
    expect(importAllData({ data: {} })).toBe(0)
  })
})
