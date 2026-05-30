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

// ───── 新一批功能 ─────

// 行事曆（兩個模式共用）
export interface CalendarEvent extends Entity {
  title: string
  date: string // YYYY-MM-DD
  time?: string // HH:mm
  mode?: 'learning' | 'work' | 'both'
  type?: string // 測驗 / 會議 / 死線 / 提醒…
  notes?: string
}

// 閱讀清單（學習）
export type ReadingStatus = 'to_read' | 'reading' | 'done'
export interface ReadingItem extends Entity {
  title: string
  author?: string
  url?: string
  status: ReadingStatus
  notes?: string
  createdAt: string
}

// 習慣追蹤（學習）
export interface Habit extends Entity {
  name: string
  icon?: string
  createdAt: string
}
export interface HabitLog extends Entity {
  habitId: string
  date: string // YYYY-MM-DD（有記錄 = 當日完成）
}

// 備課 / 教案（工作）
export interface LessonPlan extends Entity {
  title: string
  classId?: string
  topicId?: string
  date?: string
  objectives?: string
  activities?: string
  resourcesNote?: string
  createdAt: string
}

// 時間表（工作）
export interface TimetableSlot extends Entity {
  day: number // 1=一 … 6=六
  period: number // 第幾節
  classId?: string
  subject: string
  room?: string
}

// 出席（工作）
export type AttendanceStatus = 'present' | 'absent' | 'late'
export interface AttendanceRecord extends Entity {
  classId: string
  studentId: string
  date: string // YYYY-MM-DD
  status: AttendanceStatus
}

// 家長 / 學生溝通記錄（工作）
export interface ParentComm extends Entity {
  classId: string
  studentId?: string
  date: string
  channel: string // 電話 / 電郵 / 面談 / 手冊
  summary: string
  followUp?: boolean
  createdAt: string
}

// 會議 / 行政筆記（工作）
export interface MeetingNote extends Entity {
  title: string
  date: string
  content: string
  tags?: string[]
  createdAt: string
}

// 快速擷取 Inbox（共用）
export interface InboxItem extends Entity {
  text: string
  mode?: 'learning' | 'work'
  createdAt: string
}
