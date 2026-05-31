import type { Entity } from '../../../lib/store'

// ============================================================
//  專注番茄鐘 — 功能專屬型別（喺自己檔定義，唔掂 data/types.ts）
//  ------------------------------------------------------------
//  設計參考：Forest / Focus To-Do / Be Focused
//  - 共用嘅 FocusSession（data/types）只有 4 欄，太淺；
//    呢度自己一套更深嘅 FocusLog（標籤 / 專案 / 中斷 / 評分 / 筆記）。
//  - 完成嘅專注節同時寫返共用 focusCol（向後相容、儀表板可見），
//    再喺呢度寫一份富資料版本做統計。
// ============================================================

// ───────── 專案（番茄歸類；類似 Focus To-Do 嘅 Project）─────────
export interface FocusProject extends Entity {
  name: string
  color: string // CalColor key（自家 PALETTE）
  icon?: string // emoji
  archived?: boolean
  // 每日目標番茄數（0 = 無）
  dailyGoal?: number
  createdAt: string
}

// ───────── 一節專注 / 休息紀錄 ─────────
export type FocusKind = 'focus' | 'short_break' | 'long_break'

export interface FocusLog extends Entity {
  kind: FocusKind
  startedAt: string // ISO
  endedAt: string // ISO
  plannedMin: number // 設定時長
  actualMin: number // 實際完成（提早放棄會少於 planned）
  completed: boolean // 行完整節 = true；中途放棄 = false
  projectId?: string // 對應 FocusProject.id
  label?: string // 任務描述
  tags?: string[]
  interruptions?: number // 期間分心次數
  rating?: number // 1–5 專注度自評（選填）
  note?: string // 完成後反思（選填）
}

// ───────── 計時器設定（Be Focused 風格偏好）─────────
export interface FocusSettings extends Entity {
  focusMin: number
  shortBreakMin: number
  longBreakMin: number
  longBreakEvery: number // 每 N 節長休息
  autoStartBreaks: boolean
  autoStartFocus: boolean
  tickSound: boolean // 滴答聲
  chimeSound: boolean // 完成鈴聲
  dailyGoal: number // 每日目標番茄數（全域）
}

export const DEFAULT_SETTINGS: Omit<FocusSettings, 'id'> = {
  focusMin: 25,
  shortBreakMin: 5,
  longBreakMin: 15,
  longBreakEvery: 4,
  autoStartBreaks: false,
  autoStartFocus: false,
  tickSound: false,
  chimeSound: true,
  dailyGoal: 8,
}

// ───────── 預設長度（快速切換）─────────
export interface Preset {
  id: string
  focus: number
  short: number
  long: number
}

export const PRESETS: Preset[] = [
  { id: 'classic', focus: 25, short: 5, long: 15 },
  { id: 'deep', focus: 50, short: 10, long: 20 },
  { id: 'sprint', focus: 15, short: 3, long: 10 },
  { id: 'ultradian', focus: 90, short: 20, long: 30 },
]
