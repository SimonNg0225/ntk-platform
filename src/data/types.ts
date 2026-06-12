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

// ───── 行事曆（Apple Calendar 級）─────
export type RecurrenceFreq = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'
export interface RecurrenceRule {
  freq: RecurrenceFreq
  interval?: number // 每 N（預設 1）
  until?: string // YYYY-MM-DD（重複到此日為止，選填）
  count?: number // 或重複 N 次後停（選填）
  byWeekday?: number[] // 每週重複時指定星期幾（0=日…6=六），空 = 跟開始日嗰日
}

// 行事曆分類（多個有色行事曆，可開關顯示）
export interface CalendarCategory extends Entity {
  name: string
  color: string // CalColor key（見 features/shared/calendar/util）
  visible: boolean
  createdAt: string
}

// 行事曆事件（兩個模式共用；新欄位全部選填，向後相容）
export interface CalendarEvent extends Entity {
  title: string
  date: string // YYYY-MM-DD（開始日）
  time?: string // HH:mm（開始時間；無 = 全日）
  // ── Apple Calendar 擴充 ──
  endDate?: string // YYYY-MM-DD（結束日，預設 = date）
  endTime?: string // HH:mm（結束時間）
  allDay?: boolean
  calendarId?: string // 對應 CalendarCategory.id
  location?: string
  url?: string
  recurrence?: RecurrenceRule
  exDates?: string[] // 重複事件被刪 / 改嘅 occurrence（YYYY-MM-DD）
  alertMinutes?: number // 提前提醒（分鐘；顯示用）
  mode?: 'learning' | 'work' | 'both'
  type?: string // 舊欄位（測驗 / 會議 / 死線 / 提醒…）
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
  day: number // 1=一 … 6=六（cycle 模式下：1=Day A … 6=Day F）
  period: number // 第幾節
  classId?: string
  subject: string
  room?: string
}

/** 日循環校曆：某真實日期 → cycle day（1..6 = A..F）。id = date 'YYYY-MM-DD'。
 *  跳過嘅日子（週末/假期/考試）唔會有記錄。 */
export interface CycleCalendarEntry extends Entity {
  date: string // YYYY-MM-DD
  cycleDay: number // 1..6
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

// 重要日子倒數（兩個模式共用）
export type CountdownCategory = 'exam' | 'deadline' | 'assessment' | 'event' | 'other'
export interface Countdown extends Entity {
  title: string
  date: string // YYYY-MM-DD（目標日子）
  time?: string // HH:mm（選填，顯示用）
  category?: CountdownCategory
  mode?: 'learning' | 'work' | 'both' // 同 CalendarEvent 一致；用嚟過濾
  notes?: string
  /** 標記「到達」(即完成) 嘅時間 (ISO)。早於 date 當日 = 提前到達；
   *  未設且已過 date = 航班延誤。 */
  arrivedAt?: string
  createdAt: string
}

// ───── AI 助手（對話歷史）─────
export interface AiThread extends Entity {
  mode: 'learning' | 'work'
  title: string
  createdAt: string
}

export interface AiMessage extends Entity {
  threadId: string
  role: 'user' | 'model'
  content: string
  createdAt: string
}

// ───── 收支記帳（個人理財，工作模式）─────
export type TxKind = 'income' | 'expense'

export interface Transaction extends Entity {
  kind: TxKind
  amount: number // 正數，單位：元（最多 2 位小數）
  categoryId: string // 對應 TxCategory.id；可指向已刪分類，UI fallback「未分類」
  date: string // YYYY-MM-DD（記帳日）
  note?: string
  createdAt: string // ISO，用嚟同日多筆排序
}

export interface TxCategory extends Entity {
  name: string
  kind: TxKind // 收入分類 / 支出分類分開
  icon?: string // emoji
  createdAt: string
}

// ───── 自我測驗（題庫做題存檔，learning + work 共用）─────
// 每題答題快照：把當時題目內容一齊存落，將來題庫改咗都唔影響歷史紀錄
export interface QuizAttemptItem {
  questionId: string
  topicId: string
  difficulty: Difficulty // 重用現有 Difficulty type，唔使新增
  stem: string
  options: string[]
  answerIndex: number // 正確答案 index
  selectedIndex: number | null // 用家所選；null = 跳過 / 未答
  correct: boolean
}

export interface QuizAttempt extends Entity {
  createdAt: string // ISO，當交卷一刻
  mode: 'learning' | 'work' // 喺邊個模式做（對齊 InboxItem / CalendarEvent 嘅 mode 慣例）
  title: string // 自動產生，例如「全部課題 · 中 · 10 題」
  topicIds: string[] // 測驗範圍（空陣列 = 全部課題）
  difficulty: Difficulty | 'all' // 範圍難度（'all' = 不限）
  total: number // 題數
  correctCount: number // 答啱數
  durationSec: number // 用時（秒）
  items: QuizAttemptItem[] // 逐題快照（用嚟對答案 + 弱項分析 + 重做錯題）
}
