import type { Entity } from '../../../../lib/store'

// ============================================================
//  體態數據（InBody 式身體組成）型別
//  ------------------------------------------------------------
//  一日一條（按本地日期 key upsert）。所有指標皆 optional —— 用家
//  可能某日淨秤體重、某日先做完整 InBody。圖表 / 統計逐欄各自守衞缺值。
// ============================================================

/** 單日身體組成記錄（缺值代表嗰日冇量該指標）。 */
export interface BodyEntry extends Entity {
  /** 本地日期 key（YYYY-MM-DD，由 ../common toKey 產生，非 UTC） */
  date: string
  /** 體重（kg） */
  weightKg?: number
  /** 體脂率（%，0–100） */
  bodyFatPct?: number
  /** 骨骼肌量（kg，InBody 嘅 SMM） */
  skeletalMuscleKg?: number
  /** 內臟脂肪等級（整數級數，非 kg；InBody 一般 1–20） */
  visceralFat?: number
  createdAt: string
  updatedAt?: string
}

/** 可量度數值指標 key（畀趨勢 / KPI 共用）。內臟脂肪係等級，分開處理。 */
export type MetricKey = 'weightKg' | 'bodyFatPct' | 'skeletalMuscleKg'

/** 體態設定（單例）：身高用嚟計 BMI；體重目標用嚟計進度 / 達標預計。 */
export interface BodyProfile extends Entity {
  heightCm?: number
  /** 目標體重（kg）。可選；冇就唔顯示進度條。 */
  weightTargetKg?: number
  /**
   * 進度起點體重（kg）。可選 —— 舊資料冇此欄，UI 會 fallback 用最早一筆
   * 體重記錄做起點，保持向後相容。
   */
  weightStartKg?: number
  updatedAt?: string
}

/** 設定單例固定 id（同一 col 一條 profile）。 */
export const PROFILE_ID = 'profile'

export const DEFAULT_PROFILE: BodyProfile = {
  id: PROFILE_ID,
  heightCm: undefined,
}
