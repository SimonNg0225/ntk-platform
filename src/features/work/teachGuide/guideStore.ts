import { createCollection, type Entity } from '../../../lib/store'

// ============================================================
//  教學指引 — 本機儲存（每次生成存一份，可按課題重溫）
// ============================================================

export interface GuideRecord extends Entity {
  createdAt: string
  topicId: string
  topicName: string
  model: string
  keyPoints: string[]
  misconceptions: string[]
  steps: string[]
  activities: string[]
  differentiation: string[]
  assessment: string[]
}

export const teachGuideCol = createCollection<GuideRecord>('work_teach_guide', [])
