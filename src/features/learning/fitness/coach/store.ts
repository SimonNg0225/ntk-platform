import { createCollection, type Entity } from '../../../../lib/store'

// ============================================================
//  AI 健身教練 — 本地資料層
//  ------------------------------------------------------------
//  只存「課表生成」工具產出、用家撳「存做計劃」嘅課表。
//  動作姿勢問答（streamChat）同體態診斷（一次過文字）唔落地，
//  純即時顯示，所以唔需要 collection。
//  key 前綴 fitness_ → createCollection 會自動登記 → 登入後雲端同步。
// ============================================================

/** 單個訓練動作 */
export interface CoachExercise {
  name: string
  sets: string
  reps: string
  note: string
}

/** 一日訓練 */
export interface CoachDay {
  day: string
  focus: string
  exercises: CoachExercise[]
}

/** 已存課表（一份 = 一個完整週課表） */
export interface CoachPlan extends Entity {
  /** 顯示名（用家可改；預設由目標 + 日期組成） */
  title: string
  /** 訓練目標 label（增肌 / 減脂 / 力量 / 體能） */
  goal: string
  /** 每週訓練日數 */
  daysPerWeek: number
  /** 可用器材 label 陣列 */
  equipment: string[]
  /** 課表內容 */
  days: CoachDay[]
  /** ISO 建立時間 */
  createdAt: string
}

export const coachPlansCol = createCollection<CoachPlan>('fitness_coach_plans_v1')
