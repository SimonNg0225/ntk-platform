import type { Entity } from '../../../../lib/store'

// ============================================================
//  訓練記錄 + 週期化 — 資料型別
//  ------------------------------------------------------------
//  一次「訓練 (Workout)」= 某一日（本地 key）做嘅多個動作，
//  每個動作有多組 set（次數 / 重量 / 可選 RPE 1-10）。
//  欄位刻意扁平、好序列化，對齊雲端同步表結構。
// ============================================================

/** 單組 set：次數 × 重量（kg），RPE 為可選自覺費力 1-10。 */
export interface WorkoutSet {
  reps: number
  weightKg: number
  /** Rate of Perceived Exertion 1-10，可缺（未填） */
  rpe?: number
}

/** 一個動作：名 + 多組 set。 */
export interface Exercise {
  name: string
  sets: WorkoutSet[]
}

/** 一次訓練（一日一筆或多筆皆可）。 */
export interface Workout extends Entity {
  id: string
  /** 本地時區日期 key YYYY-MM-DD（嚴禁 UTC） */
  date: string
  title?: string
  exercises: Exercise[]
  note?: string
  createdAt: string
}
