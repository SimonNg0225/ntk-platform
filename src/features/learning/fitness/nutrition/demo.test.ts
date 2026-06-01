import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { seedDemo } from './demo'
import { foodCol, goalsCol, DEFAULT_GOALS, GOALS_ID, readGoals } from './store'
import { recentDays } from '../common'
import { weeklyCalories, mealGroups } from './util'
import type { FoodEntry, NutritionGoals } from './types'

// ============================================================
//  AI 飲食營養示範 seeder（seedDemo）
//  ------------------------------------------------------------
//  依賴 foodCol / goalsCol 狀態（非純函式）→ 每個 case 用 set() 控制
//  （同 fitness/training/demo.test.ts、health/demo.test.ts 手法）。
//  node 環境無 localStorage，但 store 嘅 set/load 全 try/catch 包住，
//  collection 內存 items 照樣運作。
//
//  兩個守衞各自獨立：
//   - goals：單例。goalsArePristine() —— 空 或 仍係原廠 DEFAULT_GOALS
//     先覆寫做示範目標；已被用戶改過（四值任一唔同）→ no-op，唔撞甩。
//   - food：淨係喺 foodCol 而家係空（.length === 0）先種近一週紀錄。
//
//  日期一律用 common 嘅 recentDays（本地時區 key），故 case 鎖死系統
//  時間令斷言 deterministic。鎖 07:00 HKT（= 前一日 23:00 UTC）兼守
//  「本地日 vs UTC 切日」off-by-one：若 seeder 改用 toISOString().slice
//  取日，末條日期會差一日。
// ============================================================

// WEEK：7 日，每日餐數 4/4/4/3/4/3/4 → 共 26 筆飲食。
const FOOD_COUNT = 26
const WEEK_DAYS = 7

// 造一筆最簡用戶飲食（只填守衞 / 計數會用到嘅欄位）
const food = (over: Partial<FoodEntry> = {}): FoodEntry => ({
  id: 'mine',
  date: '2026-05-31',
  label: '我嘅嘢食',
  calories: 100,
  proteinG: 5,
  fatG: 3,
  carbG: 10,
  createdAt: '2026-05-31T00:00:00.000Z',
  ...over,
})

const goals = (over: Partial<NutritionGoals> = {}): NutritionGoals => ({
  ...DEFAULT_GOALS,
  ...over,
})

beforeEach(() => {
  // 每個 case 前清空兩個 collection，模擬新用戶 / 已清資料
  foodCol.set([])
  goalsCol.set([])
  vi.useFakeTimers()
  // 07:00 HKT = 2026-05-31T23:00:00Z（UTC 噖日）。鎖死令 recentDays 可預期。
  vi.setSystemTime(new Date(2026, 5, 1, 7, 0, 0)) // 2026-06-01 本地
})

afterEach(() => {
  vi.useRealTimers()
})

describe('seedDemo — 空 collection（goals + 26 筆飲食全種）', () => {
  it('added === 1(goals) + 26(food)，food 數 === FOOD_COUNT', () => {
    const added = seedDemo()
    expect(added).toBe(1 + FOOD_COUNT)
    expect(foodCol.get()).toHaveLength(FOOD_COUNT)
    expect(goalsCol.get()).toHaveLength(1)
    // added 拆得返兩部分總和（無漏計 / 無重複計）
    expect(foodCol.get().length + goalsCol.get().length).toBe(added)
  })

  it('種入嘅 goals 係單例（id = GOALS_ID）且帶減脂期四個目標欄位', () => {
    seedDemo()
    const all = goalsCol.get()
    expect(all).toHaveLength(1)
    const g = readGoals()
    expect(g.id).toBe(GOALS_ID)
    // demo 減脂期目標（略低卡、高蛋白）—— 同 DEFAULT_GOALS 唔同
    expect(g.calories).toBe(2100)
    expect(g.proteinG).toBe(150)
    expect(g.fatG).toBe(65)
    expect(g.carbG).toBe(210)
  })

  it('每筆飲食都帶完整四大營養 + meal + createdAt（同 store 結構對齊）', () => {
    seedDemo()
    for (const r of foodCol.get()) {
      expect(typeof r.calories).toBe('number')
      expect(typeof r.proteinG).toBe('number')
      expect(typeof r.fatG).toBe('number')
      expect(typeof r.carbG).toBe('number')
      expect(r.label).toBeTruthy()
      expect(r.meal).toBeTruthy()
      expect(r.createdAt).toBeTruthy()
    }
  })
})

describe('seedDemo — 種入資料畀下游圖表/分段有料', () => {
  it('橫跨多日（new Set(date).size > 1）令趨勢/週卡路里有料', () => {
    seedDemo()
    const rows = foodCol.get()
    const dates = new Set(rows.map((r) => r.date))
    expect(dates.size).toBeGreaterThan(1)
    expect(dates.size).toBe(WEEK_DAYS) // 7 日各有紀錄
  })

  it('weeklyCalories：近 7 日多個非零日（柱狀圖/趨勢非得一條柱）', () => {
    seedDemo()
    // seeder 同 weeklyCalories 共用同一本地時鐘基準（fake timer）。
    const week = weeklyCalories(foodCol.get())
    expect(week).toHaveLength(7)
    const nonZeroDays = week.filter((d) => d.calories > 0)
    // WEEK 鋪滿 7 日 → 7 日全部有卡路里
    expect(nonZeroDays).toHaveLength(7)
    // 末項（今日）刻意鋪足四段 → 卡路里 > 0
    expect(week[6].key).toBe('2026-06-01')
    expect(week[6].calories).toBeGreaterThan(0)
  })

  it('今日（anchor）含多個 MealSlot 令 mealGroups 分段（飽滿日誌）', () => {
    seedDemo()
    const days = recentDays(WEEK_DAYS)
    const today = days[days.length - 1] // 今日本地 key
    const groups = mealGroups(foodCol.get(), today)
    // 今日刻意鋪 早/午/晚/小食 四段
    expect(groups.map((g) => g.meal)).toEqual([
      'breakfast',
      'lunch',
      'dinner',
      'snack',
    ])
    // 每段小計卡路里 > 0（真有嘢食，非空段佔位）
    for (const g of groups) {
      expect(g.subtotal.calories).toBeGreaterThan(0)
      expect(g.entries.length).toBeGreaterThan(0)
    }
  })

  it('食物名橫跨多款（非單一佔位字串，去重統計有料）', () => {
    seedDemo()
    const labels = new Set(foodCol.get().map((r) => r.label))
    expect(labels.size).toBeGreaterThan(1)
  })
})

describe('seedDemo — 兩個守衞各自獨立', () => {
  it('goals 已被用戶改過 → 唔覆寫 goals，只種 food（added 唔含 goals）', () => {
    // 用戶把卡路里改成 1800（同 DEFAULT_GOALS 唔同）→ 非 pristine
    goalsCol.set([goals({ calories: 1800 })])
    const added = seedDemo()
    // 只種 26 筆 food，唔再 +1 畀 goals
    expect(added).toBe(FOOD_COUNT)
    expect(foodCol.get()).toHaveLength(FOOD_COUNT)
    // 原有 goals 唔被覆寫（仍係用戶設定嘅 1800）
    expect(goalsCol.get()).toHaveLength(1)
    expect(readGoals().calories).toBe(1800)
  })

  it('goals 仍係原廠 DEFAULT_GOALS（pristine）→ 覆寫做示範目標', () => {
    goalsCol.set([{ ...DEFAULT_GOALS }]) // 原廠未改
    const added = seedDemo()
    expect(added).toBe(1 + FOOD_COUNT) // goals 仍會種（覆寫原廠）
    expect(goalsCol.get()).toHaveLength(1) // 仍單例，唔會多出一筆
    expect(readGoals().calories).toBe(2100) // 已覆寫做 demo 目標
  })

  it('food 已有用戶資料 → food 部分 no-op，但仍會種 goals（added 只含 goals）', () => {
    foodCol.set([food()])
    const added = seedDemo()
    expect(added).toBe(1) // 淨係 goals
    // 用戶原有 food 唔被覆寫 / 唔被加碼
    expect(foodCol.get().map((r) => r.id)).toEqual(['mine'])
    expect(goalsCol.get()).toHaveLength(1)
    expect(readGoals().calories).toBe(2100)
  })
})

describe('seedDemo — idempotent（已有資料再 call 唔覆寫）', () => {
  it('全部已有（再 call）→ added === 0，唔重複種', () => {
    const first = seedDemo()
    expect(first).toBe(1 + FOOD_COUNT)
    const foodAfter = foodCol.get().length
    const goalsAfter = goalsCol.get().length

    const again = seedDemo()
    expect(again).toBe(0)
    expect(foodCol.get()).toHaveLength(foodAfter)
    expect(goalsCol.get()).toHaveLength(goalsAfter)
  })

  it('種完之後 goals 已變 demo 值（非 pristine）→ 再 call 唔覆寫 goals', () => {
    seedDemo() // 種入 → goals 變成 demo 2100（已非原廠）
    // 用戶清空 food 但保留 demo goals，再 call
    foodCol.set([])
    const again = seedDemo()
    // food 重新種返 26 筆；goals 此刻已非 pristine → 唔再 +1
    expect(again).toBe(FOOD_COUNT)
    expect(readGoals().calories).toBe(2100)
  })
})

describe('seedDemo — id 獨一 + 日期分佈', () => {
  it('每筆飲食有獨一 id（uid 產生，無撞）', () => {
    seedDemo()
    const ids = foodCol.get().map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.every((id) => typeof id === 'string' && id.length > 0)).toBe(true)
  })

  it('日期全部落喺 recentDays(7) 範圍內（本地 key，末條今日 / 首條 6 日前）', () => {
    seedDemo()
    const expected = recentDays(WEEK_DAYS) // 同 seeder 同一本地時鐘基準
    const rows = foodCol.get()
    // 每筆日期都屬於 recentDays(7)
    const allowed = new Set(expected)
    expect(rows.every((r) => allowed.has(r.date))).toBe(true)
    // 顯式錨點：末條 = 今日本地、首條 = 6 日前
    expect(expected[expected.length - 1]).toBe('2026-06-01')
    expect(expected[0]).toBe('2026-05-26')
  })

  it('同餐內 createdAt 遞增（微錯開令「新→舊」排序穩定）', () => {
    seedDemo()
    const times = foodCol.get().map((r) => Date.parse(r.createdAt))
    // seeder 用 base + seq*1000 砌遞增 ISO → 全程嚴格遞增、無重覆時刻
    for (let i = 1; i < times.length; i += 1) {
      expect(times[i]).toBeGreaterThan(times[i - 1])
    }
  })
})
