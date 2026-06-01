import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { seedDemo } from './demo'
import { bodyEntriesCol, bodyProfileCol } from './store'
import { PROFILE_ID } from './types'
import { compositionChange, recompSeries, weightRateKgPerWeek } from './util'
import type { BodyEntry, BodyProfile } from './types'

// ============================================================
//  體態示範 seeder（seedDemo）
//  ------------------------------------------------------------
//  依賴 bodyEntriesCol / bodyProfileCol 狀態（非純函式）→ 每個 case
//  用 set() 控制（同 fitness/training/demo.test.ts、nutrition/demo.test.ts
//  手法）。node 環境無 localStorage，但 store 嘅 set/load 全 try/catch
//  包住，collection 內存 items 照樣運作。
//
//  兩個守衞各自獨立（length === 0 先種）：
//   - profile：單例（身高 / 目標 / 起點），畀 BMI / 進度條 / 達標預計。
//   - entries：近 4 週每日身體組成（PLAN 7 筆，橫跨 28 日窗）。
//
//  日期一律用 common 嘅 recentDays（本地時區 key），故鎖死系統時間令
//  斷言 deterministic。鎖 07:00 HKT（= 前一日 23:00 UTC）兼守「本地日
//  vs UTC 切日」off-by-one：若 seeder 改用 toISOString().slice 取日，
//  末條日期會差一日（見 srs.test.ts / nutrition demo.test.ts 同款守衞）。
// ============================================================

// PLAN 共 7 筆量度日（見 demo.ts）。
const ENTRY_COUNT = 7
// 其中同時有 weightKg + bodyFatPct（完整 InBody）嘅日數：offset 27/20/14/6/0。
const COMPLETE_COUNT = 5

// 造一條最簡用戶記錄（只填守衞 / 計數會用到嘅欄位）
const entry = (over: Partial<BodyEntry> = {}): BodyEntry => ({
  id: 'mine',
  date: '2026-05-31',
  weightKg: 70,
  createdAt: '2026-05-31T00:00:00.000Z',
  ...over,
})

const profile = (over: Partial<BodyProfile> = {}): BodyProfile => ({
  id: PROFILE_ID,
  heightCm: 180,
  ...over,
})

beforeEach(() => {
  // 每個 case 前清空兩個 collection，模擬新用戶 / 已清資料
  bodyEntriesCol.set([])
  bodyProfileCol.set([])
  vi.useFakeTimers()
  // 07:00 HKT = 2026-05-31T23:00:00Z（UTC 噖日）。鎖死令 recentDays 可預期。
  vi.setSystemTime(new Date(2026, 5, 1, 7, 0, 0)) // 2026-06-01 本地
})

afterEach(() => {
  vi.useRealTimers()
})

describe('seedDemo — 空 collection（profile + entries 全種）', () => {
  it('added === 1(profile) + 7(entries)，且各 collection 數對得返', () => {
    const added = seedDemo()
    expect(added).toBe(1 + ENTRY_COUNT)
    expect(bodyProfileCol.get()).toHaveLength(1)
    expect(bodyEntriesCol.get()).toHaveLength(ENTRY_COUNT)
    // added 拆得返兩部分總和（無漏計 / 無重複計）
    expect(bodyProfileCol.get().length + bodyEntriesCol.get().length).toBe(added)
  })

  it('種入嘅 profile 係單例（id = PROFILE_ID）且帶身高 / 目標 / 起點', () => {
    seedDemo()
    const all = bodyProfileCol.get()
    expect(all).toHaveLength(1)
    const p = all[0]
    expect(p.id).toBe(PROFILE_ID)
    // 有齊三欄先計到 BMI / 進度條 / 達標預計
    expect(typeof p.heightCm).toBe('number')
    expect(typeof p.weightTargetKg).toBe('number')
    expect(typeof p.weightStartKg).toBe('number')
    // 起點對齊 PLAN 最舊一筆體重；目標細過起點（減重情境，進度條有方向）
    expect(p.weightStartKg!).toBeGreaterThan(p.weightTargetKg!)
    expect(p.updatedAt).toBeTruthy()
  })

  it('每筆 entry 帶 date + createdAt（同 store 結構對齊）', () => {
    seedDemo()
    for (const r of bodyEntriesCol.get()) {
      expect(r.date).toBeTruthy()
      expect(r.createdAt).toBeTruthy()
      // 至少有體重（PLAN 每筆都填 weightKg）
      expect(typeof r.weightKg).toBe('number')
    }
  })
})

describe('seedDemo — 種入資料畀下游趨勢 / 分析有料（非 insufficient/null）', () => {
  it('橫跨多日（new Set(date).size > 1）令趨勢圖有料', () => {
    seedDemo()
    const dates = new Set(bodyEntriesCol.get().map((r) => r.date))
    expect(dates.size).toBeGreaterThan(1)
    expect(dates.size).toBe(ENTRY_COUNT) // 7 筆各自唔同日（無同日覆寫）
  })

  it('至少兩筆同時有 weightKg + bodyFatPct（畀組成分析計到）', () => {
    seedDemo()
    const complete = bodyEntriesCol
      .get()
      .filter((r) => typeof r.weightKg === 'number' && typeof r.bodyFatPct === 'number')
    expect(complete.length).toBeGreaterThanOrEqual(2)
    expect(complete.length).toBe(COMPLETE_COUNT)
  })

  it('compositionChange：唔回 insufficient，首尾有得計（脂肪落）', () => {
    seedDemo()
    // seeder 同 util 共用同一本地時鐘基準（fake timer）。窗 = 28 日覆蓋全 PLAN。
    const cc = compositionChange(bodyEntriesCol.get(), 28)
    expect(cc.verdict).not.toBe('insufficient')
    expect(cc.fatDeltaKg).not.toBeNull()
    expect(cc.leanDeltaKg).not.toBeNull()
    // 首尾日期 = PLAN 最舊 / 最新完整 InBody 日
    expect(cc.fromDate).toBe('2026-05-05')
    expect(cc.toDate).toBe('2026-06-01')
    // 示範走勢：脂肪量明顯下降（減脂）
    expect(cc.fatDeltaKg!).toBeLessThan(0)
  })

  it('weightRateKgPerWeek：唔回 null，且為負（體重穩步落）', () => {
    seedDemo()
    const rate = weightRateKgPerWeek(bodyEntriesCol.get(), 28)
    expect(rate).not.toBeNull()
    expect(rate!).toBeLessThan(0)
  })

  it('recompSeries：至少兩個日子脂肪 + 瘦體重皆有值（雙線非斷晒）', () => {
    seedDemo()
    const series = recompSeries(bodyEntriesCol.get(), 28)
    const both = series.filter((p) => p.fat !== null && p.lean !== null)
    expect(both.length).toBeGreaterThanOrEqual(2)
    expect(both.length).toBe(COMPLETE_COUNT)
  })
})

describe('seedDemo — 兩個守衞各自獨立', () => {
  it('profile 已存在 → profile no-op，只種 entries（added 唔含 profile）', () => {
    bodyProfileCol.set([profile({ heightCm: 200 })])
    const added = seedDemo()
    // 只種 7 筆 entries，唔再 +1 畀 profile
    expect(added).toBe(ENTRY_COUNT)
    expect(bodyEntriesCol.get()).toHaveLength(ENTRY_COUNT)
    // 原有 profile 唔被覆寫（仍係用戶 200cm，唔變示範 175cm）
    expect(bodyProfileCol.get()).toHaveLength(1)
    expect(bodyProfileCol.get()[0].heightCm).toBe(200)
  })

  it('entries 已有用戶資料 → entries no-op，但仍會種 profile（added 只含 profile）', () => {
    bodyEntriesCol.set([entry()])
    const added = seedDemo()
    expect(added).toBe(1) // 淨係 profile
    // 用戶原有 entry 唔被覆寫 / 唔被加碼
    expect(bodyEntriesCol.get().map((r) => r.id)).toEqual(['mine'])
    expect(bodyProfileCol.get()).toHaveLength(1)
    expect(bodyProfileCol.get()[0].id).toBe(PROFILE_ID)
  })
})

describe('seedDemo — idempotent（已有資料再 call 唔覆寫）', () => {
  it('全部已有（再 call）→ added === 0，唔重複種', () => {
    const first = seedDemo()
    expect(first).toBe(1 + ENTRY_COUNT)
    const entriesAfter = bodyEntriesCol.get().length
    const profileAfter = bodyProfileCol.get().length

    const again = seedDemo()
    expect(again).toBe(0)
    expect(bodyEntriesCol.get()).toHaveLength(entriesAfter)
    expect(bodyProfileCol.get()).toHaveLength(profileAfter)
  })

  it('profile 已種、entries 被清 → 只重種 entries（added === 7，唔再加 profile）', () => {
    seedDemo() // 兩者皆種
    bodyEntriesCol.set([]) // 用戶清走 entries，保留 profile
    const again = seedDemo()
    expect(again).toBe(ENTRY_COUNT) // 淨係 entries 重種
    expect(bodyProfileCol.get()).toHaveLength(1) // profile 唔重複種（仍單例）
  })
})

describe('seedDemo — entry id 獨一', () => {
  it('每筆 entry 有獨一 id（uid 產生，無撞）', () => {
    seedDemo()
    const ids = bodyEntriesCol.get().map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.every((id) => typeof id === 'string' && id.length > 0)).toBe(true)
  })

  it('日期全部落喺 recentDays(28) 範圍內（本地 key，末條今日 2026-06-01）', () => {
    seedDemo()
    const dates = bodyEntriesCol.get().map((r) => r.date)
    // 最新一筆（offset 0）= 今日本地、最舊一筆（offset 27）= 27 日前
    const sorted = [...dates].sort()
    expect(sorted[sorted.length - 1]).toBe('2026-06-01')
    expect(sorted[0]).toBe('2026-05-05')
    // 無未來日（唔超過 anchor）
    expect(dates.every((d) => d <= '2026-06-01')).toBe(true)
  })
})
