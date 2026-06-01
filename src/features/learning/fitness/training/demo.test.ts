import { describe, it, expect, beforeEach } from 'vitest'
import { seedDemo } from './demo'
import { workoutCol } from './store'
import type { Workout } from './types'

// ============================================================
//  訓練示範 seeder（seedDemo）
//  ------------------------------------------------------------
//  依賴 workoutCol 狀態（非純函式）→ 每個 case 用 set() 控制。
//  node 環境無 localStorage，但 store 嘅 set/load 全 try/catch 包住，
//  collection 內存 items 照樣運作（同 cardgen/store.test.ts）。
//
//  迴歸重點：store 出廠種子曾經令 workoutCol 永不為空，
//  令 seedDemo 的 length===0 守衞恒 false、整份 PLAN 變死碼。
//  store 改空種子後，以下測試確保 seeder 真係種到嘢。
// ============================================================

// 造一條最簡 workout（只填守衞 / 計數會用到嘅欄位）
function w(id: string): Workout {
  return {
    id,
    date: '2026-05-31',
    exercises: [],
    createdAt: '2026-05-31T12:00:00.000Z',
  }
}

beforeEach(() => {
  // 每個 case 前清空，模擬新用戶 / 已清資料
  workoutCol.set([])
})

describe('seedDemo（訓練示範）', () => {
  it('空 collection → 種入完整 PLAN，回傳新增筆數（> 0）', () => {
    const added = seedDemo()
    const rows = workoutCol.get()
    // 守衞曾經恒 false 令此處為 0；改空種子後應真正種到。
    expect(added).toBeGreaterThan(0)
    expect(rows).toHaveLength(added)
  })

  it('種入嘅資料含趨勢 / PR / RPE 所需內容（非通用佔位）', () => {
    seedDemo()
    const rows = workoutCol.get()
    // PLAN 橫跨多日（最舊 20 日前、最新今日）→ 趨勢圖有料
    const dates = new Set(rows.map((r) => r.date))
    expect(dates.size).toBeGreaterThan(1)
    // 至少有 set 填咗 RPE（畀平均 RPE 計算）
    const hasRpe = rows.some((r) =>
      r.exercises.some((e) => e.sets.some((s) => typeof s.rpe === 'number')),
    )
    expect(hasRpe).toBe(true)
    // 每筆都有獨一 id（uid 產生，無重複）
    const ids = rows.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('idempotent：已有資料時再 call → 回 0，唔重複種', () => {
    const added = seedDemo()
    expect(added).toBeGreaterThan(0)
    const after = workoutCol.get().length

    const again = seedDemo()
    expect(again).toBe(0)
    expect(workoutCol.get()).toHaveLength(after)
  })

  it('collection 已有用戶資料 → seeder 為 no-op，唔覆寫', () => {
    workoutCol.set([w('mine')])
    const added = seedDemo()
    expect(added).toBe(0)
    expect(workoutCol.get().map((r) => r.id)).toEqual(['mine'])
  })
})
