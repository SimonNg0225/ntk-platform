import { createCollection, useCollection, uid } from '../../../lib/store'
import type { HealthLog, HealthGoals } from './types'
import { DEFAULT_GOALS, GOALS_ID } from './types'

// 每日健康記錄（會自動登記入 collectionRegistry → 登入後雲端同步 + 匯出）
export const healthLogsCol = createCollection<HealthLog>('health_logs_v1')
// 健康目標（單例）
export const healthGoalsCol = createCollection<HealthGoals>('health_goals_v1')

export function useHealthLogs(): HealthLog[] {
  return useCollection(healthLogsCol)
}

export function useHealthGoals(): HealthGoals {
  const rows = useCollection(healthGoalsCol)
  return rows[0] ?? DEFAULT_GOALS
}

/** 讀目標（非 hook 場合，例如儀表板 widget 計進度） */
export function getGoals(): HealthGoals {
  return healthGoalsCol.get()[0] ?? DEFAULT_GOALS
}

/** 設定 / 更新目標（單例 upsert） */
export function saveGoals(patch: Partial<HealthGoals>): void {
  const existing = healthGoalsCol.get()[0]
  if (existing) healthGoalsCol.update(existing.id, patch)
  else healthGoalsCol.add({ ...DEFAULT_GOALS, ...patch, id: GOALS_ID })
}

type MetricPatch = Partial<Omit<HealthLog, 'id' | 'date' | 'createdAt' | 'updatedAt'>>

/**
 * 記錄某日指標（按本地日期 key upsert，一日一條）。
 * patch 內某欄位設為 undefined 唔會清除已存值（用 update 合併語意）；
 * 要清空請明確傳該欄位（呼叫端自行決定）。
 */
export function logDay(date: string, patch: MetricPatch): void {
  const now = new Date().toISOString()
  const existing = healthLogsCol.get().find((l) => l.date === date)
  if (existing) {
    healthLogsCol.update(existing.id, { ...patch, updatedAt: now })
  } else {
    healthLogsCol.add({ id: uid(), date, ...patch, createdAt: now, updatedAt: now })
  }
}
