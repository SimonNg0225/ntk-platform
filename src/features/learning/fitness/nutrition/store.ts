import { createCollection } from '../../../../lib/store'
import type { FoodEntry, NutritionGoals } from './types'

// ============================================================
//  AI 飲食營養 — 本模組專屬持久化
//  ------------------------------------------------------------
//  唔掂 data/collections.ts —— createCollection 會自動登記，
//  登入後跟住雲端同步。key 必須獨一、前綴 fitness_。
//   - fitness_nutrition_v1 ：逐筆飲食紀錄
//   - fitness_nutrition_goals_v1 ：每日目標（單例，固定 id='goals'）
// ============================================================

export const foodCol = createCollection<FoodEntry>('fitness_nutrition_v1', [])

/** 固定單例 id —— 目標只得一筆 */
export const GOALS_ID = 'goals'

/** 預設目標：cal 2000 / P 120 / F 60 / C 220 */
export const DEFAULT_GOALS: NutritionGoals = {
  id: GOALS_ID,
  calories: 2000,
  proteinG: 120,
  fatG: 60,
  carbG: 220,
}

export const goalsCol = createCollection<NutritionGoals>(
  'fitness_nutrition_goals_v1',
  [DEFAULT_GOALS],
)

/**
 * 由 collection 攞返目標單例；若因任何原因唔見咗（例如舊資料 / 被清），
 * 回退到 DEFAULT_GOALS，保證下游永遠攞到一份完整目標。
 */
export function readGoals(): NutritionGoals {
  const found = goalsCol.get().find((g) => g.id === GOALS_ID)
  return found ?? DEFAULT_GOALS
}

/** 寫入 / 更新目標單例（無就 add，有就 update） */
export function saveGoals(next: Omit<NutritionGoals, 'id'>) {
  const exists = goalsCol.get().some((g) => g.id === GOALS_ID)
  if (exists) goalsCol.update(GOALS_ID, next)
  else goalsCol.add({ id: GOALS_ID, ...next })
}
