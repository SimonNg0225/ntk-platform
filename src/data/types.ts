import type { Entity } from '../lib/store'

// ============================================================
//  網域資料型別（欄位對齊 Supabase 將來嘅表）
// ============================================================

// ───── 共用骨幹 ─────
export interface Topic extends Entity {
  part: string // 必修 / 選修(商業管理)
  area: string // 課題範疇
  topic: string // 課題
  order: number
}

export interface Klass extends Entity {
  name: string // 例如 5A
  subject: string // 例如 BAFS（商業管理）
}

export interface Student extends Entity {
  classId: string
  name: string
  studentNo?: string
}

// ───── 工作模式 ─────
export type ProgressStatus = 'not_started' | 'in_progress' | 'done'

export interface ClassProgress extends Entity {
  classId: string
  topicId: string
  status: ProgressStatus
  notes?: string
  dateDone?: string
}

export type QuestionType = 'mc' | 'short' | 'long' | 'case'
export type Difficulty = 'easy' | 'medium' | 'hard'

export interface Question extends Entity {
  topicId: string
  type: QuestionType
  difficulty: Difficulty
  stem: string
  options?: string[] // MC 用
  answerIndex?: number // MC 正確答案
  answer?: string // 非 MC 參考答案
  marks?: number
  source?: string
  tags?: string[]
  createdAt: string
}

export type ResourceType =
  | 'handout'
  | 'slides'
  | 'paper'
  | 'link'
  | 'video'
  | 'note'

export interface Resource extends Entity {
  title: string
  type: ResourceType
  url?: string
  topicId?: string
  tags?: string[]
  notes?: string
  createdAt: string
}

export interface Assessment extends Entity {
  classId: string
  name: string
  type: string // 測驗 / 考試 / 功課
  date?: string
  maxScore: number
  topicId?: string
  createdAt: string
}

export interface Score extends Entity {
  assessmentId: string
  studentId: string
  score: number | null
  remark?: string
}

// ───── 學習模式 ─────
export interface Deck extends Entity {
  name: string
  description?: string
  createdAt: string
}

export interface Card extends Entity {
  deckId: string
  front: string
  back: string
  ease: number // 預設 2.5
  intervalDays: number // 預設 0
  repetitions: number // 預設 0
  dueDate: string // ISO date
  lastReviewed?: string
  createdAt: string
}

export interface JournalEntry extends Entity {
  date: string // YYYY-MM-DD
  content: string
  mood?: string
  tags?: string[]
}

export interface FocusSession extends Entity {
  startedAt: string
  durationMin: number
  label?: string
  completed: boolean
}

export interface Note extends Entity {
  content: string
  createdAt: string
}

export interface Goal extends Entity {
  title: string
  progress: number // 0-100
  createdAt: string
}

export interface Task extends Entity {
  text: string
  done: boolean
  createdAt: string
}
