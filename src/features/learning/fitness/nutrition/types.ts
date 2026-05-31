import type { Entity } from '../../../../lib/store'

// ============================================================
//  AI 飲食營養 — 本模組專屬型別
//  ------------------------------------------------------------
//  共用 ui / store / common 不可改。凡係本模組獨有嘅資料
//  （單筆飲食、每日目標、AI 解析出嚟嘅食物項）一律喺呢度定義。
//  日期一律用 ../common 嘅本地 key（YYYY-MM-DD，避 UTC 漂移）。
// ============================================================

/** 一筆飲食紀錄（落地持久化） */
export interface FoodEntry extends Entity {
  date: string // 本地日期 key YYYY-MM-DD
  label: string // 食物名（例如「半碗白飯」）
  calories: number // kcal
  proteinG: number // 蛋白質（克）
  fatG: number // 脂肪（克）
  carbG: number // 碳水（克）
  createdAt: string // ISO 建立時間（同筆排序用）
}

/** 每日營養目標（單例；以 id='goals' 固定一筆保存） */
export interface NutritionGoals extends Entity {
  calories: number
  proteinG: number
  fatG: number
  carbG: number
}

/**
 * AI 由自然語言解析出嚟嘅食物項（未落地，純前端草稿）。
 * 同 FoodEntry 嘅四個營養欄位對齊，方便逐項微調再存。
 * 每項配一個前端臨時 key，畀編輯 / 移除定位用。
 */
export interface ParsedItem {
  key: string // 前端臨時 id（uid）
  label: string
  calories: number
  proteinG: number
  fatG: number
  carbG: number
}

/** AI 回應嘅原始 shape（未必齊 / 未必數字，逐欄 runtime 收斂） */
export interface RawFoodItem {
  label?: unknown
  calories?: unknown
  proteinG?: unknown
  fatG?: unknown
  carbG?: unknown
}

/** 四大營養聚合結果 */
export interface Macros {
  calories: number
  proteinG: number
  fatG: number
  carbG: number
}
