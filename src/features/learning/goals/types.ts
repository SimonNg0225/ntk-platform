// ============================================================
//  學習目標（OKR / Strides 級）— 功能專屬型別 + 持久化
//  ------------------------------------------------------------
//  鐵則：唔可以改 data/types.ts 或 data/collections.ts。
//  做法：共用 goalsCol（Goal: title/progress/createdAt）保持向後相容，
//        所有「深化」欄位（分類、目標日、優先、狀態、里程碑、簽到）
//        放喺呢度自己嘅 createCollection，用 goalId 關聯。
// ============================================================
import { createCollection } from '../../../lib/store'
import type { Entity } from '../../../lib/store'

// ───────── 目標延伸資料（一對一 goalId）─────────
export type GoalCategory =
  | 'study'
  | 'exam'
  | 'reading'
  | 'skill'
  | 'career'
  | 'health'
  | 'other'

export type GoalPriority = 'low' | 'medium' | 'high'

export type GoalStatus = 'active' | 'paused' | 'done'

export interface GoalMeta extends Entity {
  // id === Goal.id（共用主鍵，方便對齊）
  category: GoalCategory
  priority: GoalPriority
  status: GoalStatus
  /** YYYY-MM-DD 目標達成日（選填） */
  targetDate?: string
  /** YYYY-MM-DD 開始日（選填；預設 = Goal.createdAt 當日） */
  startDate?: string
  notes?: string
  /** 是否被封存（完成後收起；唔影響 status） */
  archived?: boolean
}

// ───────── 里程碑（Key Results；多個一對 goalId）─────────
export interface Milestone extends Entity {
  goalId: string
  title: string
  done: boolean
  /** 權重（1-5；用嚟加權計目標總進度），預設 1 */
  weight: number
  order: number
  createdAt: string
  doneAt?: string
}

// ───────── 進度簽到（Check-in；建立動量時間線）─────────
export interface GoalCheckin extends Entity {
  goalId: string
  /** 簽到當下嘅進度快照 0-100 */
  progress: number
  note?: string
  /** ISO datetime */
  createdAt: string
}

// ───────── 持久化集合（自己 key，自動存 localStorage）─────────
export const goalMetaCol = createCollection<GoalMeta>('learning_goal_meta', [
  {
    id: 'goal-1',
    category: 'study',
    priority: 'high',
    status: 'active',
    targetDate: new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10),
  },
  {
    id: 'goal-2',
    category: 'reading',
    priority: 'medium',
    status: 'active',
    targetDate: new Date(Date.now() + 60 * 864e5).toISOString().slice(0, 10),
  },
])

export const milestonesCol = createCollection<Milestone>(
  'learning_goal_milestones',
  [
    { id: 'ms-1', goalId: 'goal-1', title: '溫完必修部分', done: true, weight: 2, order: 0, createdAt: new Date().toISOString(), doneAt: new Date().toISOString() },
    { id: 'ms-2', goalId: 'goal-1', title: '溫完選修（商業管理）', done: false, weight: 3, order: 1, createdAt: new Date().toISOString() },
    { id: 'ms-3', goalId: 'goal-1', title: '做一份模擬卷', done: false, weight: 1, order: 2, createdAt: new Date().toISOString() },
  ],
)

export const goalCheckinsCol = createCollection<GoalCheckin>(
  'learning_goal_checkins',
  [],
)
