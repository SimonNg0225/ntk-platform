import type { Entity } from '../../../lib/store'
import { Scale, Moon, Dumbbell, Droplet, Smile, type LucideIcon } from 'lucide-react'

// ============================================================
//  健康追蹤資料模型
//  ------------------------------------------------------------
//  每日一條 HealthLog（按本地日期 key upsert）；五個核心指標
//  （體重 / 睡眠 / 運動 / 飲水 / 心情）+ 備註。
//  目標（HealthGoals）係單例，畀進度環/達標判斷用。
//  欄位刻意扁平、可選，方便對齊 Supabase jsonb + 部分日子只記部分指標。
// ============================================================

export type MetricKey = 'weightKg' | 'sleepHrs' | 'exerciseMin' | 'waterMl' | 'mood'

export interface HealthLog extends Entity {
  id: string
  /** 本地時區 YYYY-MM-DD（每日一條） */
  date: string
  weightKg?: number
  sleepHrs?: number
  /** 當日運動分鐘 */
  exerciseMin?: number
  /** 當日飲水量（ml） */
  waterMl?: number
  /** 心情 1（差）– 5（好） */
  mood?: number
  note?: string
  createdAt: string
  updatedAt: string
}

export interface HealthGoals extends Entity {
  /** 固定單例 id */
  id: string
  /** 目標體重（kg，可選） */
  weightTargetKg?: number
  /** 每晚睡眠目標（小時） */
  sleepTargetHrs: number
  /** 每週運動目標（分鐘；WHO 建議 150） */
  exerciseTargetMin: number
  /** 每日飲水目標（ml） */
  waterTargetMl: number
}

export const GOALS_ID = 'singleton'

export const DEFAULT_GOALS: HealthGoals = {
  id: GOALS_ID,
  sleepTargetHrs: 8,
  exerciseTargetMin: 150,
  waterTargetMl: 2000,
}

/** 指標 UI metadata —— 驅動快速記錄輸入同圖表標籤。 */
export interface MetricDef {
  key: MetricKey
  label: string
  unit: string
  icon: LucideIcon
  /** 輸入步進 */
  step: number
  /** 合理上限（防手殘輸入爆數；亦做 input max） */
  max: number
  /** 圖表/數值顯示小數位 */
  decimals: number
  /** 色調 token（配合 Charts / Ring） */
  tone: 'accent' | 'indigo' | 'emerald' | 'sky' | 'amber'
}

export const METRICS: MetricDef[] = [
  { key: 'weightKg', label: '體重', unit: 'kg', icon: Scale, step: 0.1, max: 400, decimals: 1, tone: 'accent' },
  { key: 'sleepHrs', label: '睡眠', unit: '小時', icon: Moon, step: 0.5, max: 24, decimals: 1, tone: 'indigo' },
  { key: 'exerciseMin', label: '運動', unit: '分鐘', icon: Dumbbell, step: 5, max: 1440, decimals: 0, tone: 'emerald' },
  { key: 'waterMl', label: '飲水', unit: 'ml', icon: Droplet, step: 100, max: 10000, decimals: 0, tone: 'sky' },
  { key: 'mood', label: '心情', unit: '/5', icon: Smile, step: 1, max: 5, decimals: 0, tone: 'amber' },
]

export const MOOD_EMOJI = ['😣', '🙁', '😐', '🙂', '😄'] as const

export function metricDef(key: MetricKey): MetricDef {
  return METRICS.find((m) => m.key === key) ?? METRICS[0]
}
