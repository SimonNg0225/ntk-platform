import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { seedDemo } from './demo'
import { healthLogsCol, healthGoalsCol } from './store'
import { recentDays } from './util'
import { GOALS_ID } from './types'
import type { HealthLog, HealthGoals } from './types'

// ============================================================
//  健康示範 seeder（seedDemo）
//  ------------------------------------------------------------
//  依賴 healthLogsCol / healthGoalsCol 狀態（非純函式）→ 每個 case
//  用 set([]) 控制（同 fitness/training/demo.test.ts 手法）。
//  node 環境無 localStorage，但 store 嘅 set/load 全 try/catch 包住，
//  collection 內存 items 照樣運作。
//
//  seedDemo 兩個守衞（goals 單例 / 近兩週 logs）各自獨立：
//  goals 已存在唔阻 logs 種入，反之亦然。日期一律用 util 嘅
//  recentDays（本地時區 key），故 case 鎖死系統時間令斷言 deterministic。
//  鎖 07:00 HKT（= 前一日 23:00 UTC）兼守「本地日 vs UTC 切日」off-by-one：
//  若 seeder 改用 toISOString().slice 取日，末條日期會差一日。
// ============================================================

const PLAN_LEN = 14 // demo.ts 內 PLAN 固定 14 日（兩週）

// 造一條最簡用戶 log（只填守衞 / 計數會用到嘅欄位）
const log = (over: Partial<HealthLog> = {}): HealthLog => ({
  id: 'mine',
  date: '2026-05-31',
  createdAt: '',
  updatedAt: '',
  ...over,
})

const goals = (over: Partial<HealthGoals> = {}): HealthGoals => ({
  id: GOALS_ID,
  sleepTargetHrs: 8,
  exerciseTargetMin: 150,
  waterTargetMl: 2000,
  ...over,
})

beforeEach(() => {
  // 每個 case 前清空兩個 collection，模擬新用戶 / 已清資料
  healthLogsCol.set([])
  healthGoalsCol.set([])
  vi.useFakeTimers()
  // 07:00 HKT = 2026-05-31T23:00:00Z（UTC 噖日）。鎖死令 recentDays 可預期。
  vi.setSystemTime(new Date(2026, 5, 1, 7, 0, 0)) // 2026-06-01 本地
})

afterEach(() => {
  vi.useRealTimers()
})

describe('seedDemo — 空 collection（goals + 14 日 log 全種）', () => {
  it('added === 1(goals) + 14(logs)，logs 數 === PLAN.length', () => {
    const added = seedDemo()
    expect(added).toBe(1 + PLAN_LEN)
    expect(healthLogsCol.get()).toHaveLength(PLAN_LEN)
    expect(healthGoalsCol.get()).toHaveLength(1)
  })

  it('種入嘅 goals 係單例（id = GOALS_ID）且帶四個目標欄位', () => {
    seedDemo()
    const g = healthGoalsCol.get()[0]
    expect(g.id).toBe(GOALS_ID)
    expect(g.weightTargetKg).toBe(66)
    expect(g.sleepTargetHrs).toBe(7.5)
    expect(g.exerciseTargetMin).toBe(180)
    expect(g.waterTargetMl).toBe(2200)
  })

  it('每條 log 有獨一 id（uid 產生，無重複）', () => {
    seedDemo()
    const ids = healthLogsCol.get().map((l) => l.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('seedDemo — 兩個守衞各自獨立', () => {
  it('goals 已存在 → 唔重複種 goals，只種 logs（added 唔含 goals）', () => {
    healthGoalsCol.set([goals({ sleepTargetHrs: 9 })])
    const added = seedDemo()
    // 只種 14 條 log，唔再 +1 畀 goals
    expect(added).toBe(PLAN_LEN)
    expect(healthLogsCol.get()).toHaveLength(PLAN_LEN)
    // 原有 goals 唔被覆寫（仍係用戶設定嘅 9）
    expect(healthGoalsCol.get()).toHaveLength(1)
    expect(healthGoalsCol.get()[0].sleepTargetHrs).toBe(9)
  })

  it('logs 已有用戶資料 → logs 部分 no-op，但仍會種 goals（added 只含 goals）', () => {
    healthLogsCol.set([log()])
    const added = seedDemo()
    expect(added).toBe(1) // 淨係 goals
    // 用戶原有 log 唔被覆寫 / 唔被加碼
    expect(healthLogsCol.get().map((l) => l.id)).toEqual(['mine'])
    expect(healthGoalsCol.get()).toHaveLength(1)
  })
})

describe('seedDemo — idempotent', () => {
  it('全部已有（再 call）→ added === 0，唔重複種', () => {
    const first = seedDemo()
    expect(first).toBe(1 + PLAN_LEN)
    const logsAfter = healthLogsCol.get().length
    const goalsAfter = healthGoalsCol.get().length

    const again = seedDemo()
    expect(again).toBe(0)
    expect(healthLogsCol.get()).toHaveLength(logsAfter)
    expect(healthGoalsCol.get()).toHaveLength(goalsAfter)
  })
})

describe('seedDemo — 日期用 recentDays 本地 key（同 util 一致）', () => {
  it('14 條 log 日期 === recentDays(14)（末條今日、首條 13 日前）', () => {
    seedDemo()
    const dates = healthLogsCol.get().map((l) => l.date)
    const expected = recentDays(PLAN_LEN) // 同 seeder 同一本地時鐘基準
    expect(dates).toEqual(expected)
    // 顯式錨點：末條 = 今日本地、首條 = 13 日前
    expect(dates[dates.length - 1]).toBe('2026-06-01')
    expect(dates[0]).toBe('2026-05-19')
  })

  it('日期由舊到新、無重複（每日一條）', () => {
    seedDemo()
    const dates = healthLogsCol.get().map((l) => l.date)
    expect(new Set(dates).size).toBe(dates.length)
    const sorted = [...dates].sort()
    expect(dates).toEqual(sorted) // recentDays 本身升序
  })
})

describe('seedDemo — 空窗日子（部分指標缺）保留', () => {
  it('PLAN index 3 / 9 缺 weightKg：種入後該日 weightKg 為 undefined，其餘指標仍在', () => {
    seedDemo()
    const dates = recentDays(PLAN_LEN)
    const rows = healthLogsCol.get()
    const byDate = new Map(rows.map((r) => [r.date, r]))

    for (const idx of [3, 9]) {
      const row = byDate.get(dates[idx])!
      expect(row).toBeDefined()
      // 缺嘅指標唔會被補 0 / 補佔位 → undefined
      expect(row.weightKg).toBeUndefined()
      // 其餘指標照樣有值（忙日仍記睡眠 / 飲水 / 心情 / 備註）
      expect(typeof row.sleepHrs).toBe('number')
      expect(typeof row.waterMl).toBe('number')
      expect(typeof row.mood).toBe('number')
      expect(row.note).toBeTruthy()
    }
  })

  it('非空窗日子（如末條今日）weightKg 有值，未被空窗影響', () => {
    seedDemo()
    const dates = recentDays(PLAN_LEN)
    const byDate = new Map(healthLogsCol.get().map((r) => [r.date, r]))
    const today = byDate.get(dates[dates.length - 1])!
    expect(typeof today.weightKg).toBe('number')
  })

  it('每條種入嘅 log 都帶 createdAt / updatedAt（同 store 結構對齊）', () => {
    seedDemo()
    for (const row of healthLogsCol.get()) {
      expect(row.createdAt).toBeTruthy()
      expect(row.updatedAt).toBeTruthy()
    }
  })
})
