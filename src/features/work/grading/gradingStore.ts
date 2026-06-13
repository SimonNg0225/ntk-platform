import { createCollection, type Entity } from '../../../lib/store'
import type { GradeIssue, GradeScore } from './structured'

// ============================================================
//  AI 批改 — 結構化批改記錄（歷史）
//  ------------------------------------------------------------
//  沿用原「作文批改」嘅 collection key（'work_essay_mark'），令舊歷史
//  唔丟失；型別擴充：subject 由 'zh'|'en' 通用化做任何科目 packId，
//  並加可選 question（題目 / 寫作提示）。
// ============================================================

export interface GradingRecord extends Entity {
  createdAt: string
  /** 科目 packId（舊記錄可能係 'zh' / 'en'，照樣相容）。 */
  subject: string
  /** 顯示標題（取答案首句 / 題目）。 */
  title: string
  /** 題目 / 寫作提示（選填）。 */
  question?: string
  total: number
  maxTotal: number
  scores: GradeScore[]
  issues: GradeIssue[]
  overall: string
  model: string
}

export const gradingCol = createCollection<GradingRecord>('work_essay_mark', [])
