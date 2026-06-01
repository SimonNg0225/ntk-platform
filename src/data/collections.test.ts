import { describe, it, expect } from 'vitest'
import { collectionRegistry } from '../lib/store'
import { preloadAllFeatures } from '../features/registry'
import { exportAllData, importAllData } from './collections'

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
