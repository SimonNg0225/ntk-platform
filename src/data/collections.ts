import { createCollection, collectionRegistry, type Entity } from '../lib/store'
import { localDateStr } from '../lib/srs'
import { NTK_SLOTS, NTK_CYCLE_CALENDAR } from './ntk-seed'
import type {
  Topic,
  Question,
  Resource,
  Deck,
  Card,
  JournalEntry,
  FocusSession,
  Note,
  Goal,
  Task,
  CalendarEvent,
  ReadingItem,
  Habit,
  HabitLog,
  LessonPlan,
  TimetableSlot,
  MeetingNote,
  Observation,
  InboxItem,
  Countdown,
  AiThread,
  AiMessage,
  Transaction,
  TxCategory,
  QuizAttempt,
  CalendarCategory,
  CycleCalendarEntry,
  TeachingContentTrust,
} from './types'

// ============================================================
//  全部資料集合（單一來源，跨功能共用）
// ============================================================

// 共用骨幹
const DEFAULT_TOPICS: Topic[] = [
  { id: 'generic-01', part: '教學流程', area: '備課', topic: '學習目標與成功準則', order: 1 },
  { id: 'generic-02', part: '教學流程', area: '備課', topic: '課堂活動設計', order: 2 },
  { id: 'generic-03', part: '評估', area: '出題', topic: '分層練習與工作紙', order: 3 },
  { id: 'generic-04', part: '評估', area: 'DSE 操練', topic: '公開試風格題目與評分準則', order: 4 },
  { id: 'generic-05', part: '回饋', area: '批改', topic: '錯因分析與改善建議', order: 5 },
  { id: 'generic-06', part: '教學資源', area: '整理', topic: '教材歸檔與課後跟進', order: 6 },
]

export const topicsCol = createCollection<Topic>('topics', DEFAULT_TOPICS)

// 工作模式
export const questionsCol = createCollection<Question>('questions', [])
// 已儲存試卷（題庫組卷工作室 + 教材生成「試卷生成」共用同一 instance，跨組件實時同步）
export interface SavedPaper extends Entity, TeachingContentTrust {
  title: string
  className: string
  durationMin: string
  questionIds: string[]
  createdAt: string
}
export const papersCol = createCollection<SavedPaper>('questionbank.papers', [])
export const resourcesCol = createCollection<Resource>('resources', [])

// 學習模式
export const decksCol = createCollection<Deck>('decks', [])
export const cardsCol = createCollection<Card>('cards', [])
export const journalCol = createCollection<JournalEntry>('journal', [])
export const focusCol = createCollection<FocusSession>('focus_sessions', [])

export const notesCol = createCollection<Note>('learning_notes', [])
export const goalsCol = createCollection<Goal>('learning_goals', [
  {
    id: 'goal-1',
    title: '整理 DSE 課題與教材',
    progress: 60,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'goal-2',
    title: '查看完一本管理學書',
    progress: 25,
    createdAt: new Date().toISOString(),
  },
])
export const tasksCol = createCollection<Task>('work_tasks', [
  { id: 'task-1', text: '批改 5A 班練習', done: false, createdAt: new Date().toISOString() },
  { id: 'task-2', text: '預備下星期寫作課堂', done: false, createdAt: new Date().toISOString() },
  { id: 'task-3', text: '上載功課到學校平台', done: true, createdAt: new Date().toISOString() },
])

// ───── 新一批功能 ─────
export const eventsCol = createCollection<CalendarEvent>('events', [])

// 訂閱式 .ics 日曆 feed 的 token（一行：{ id:'token', token }）。
// 會 sync 上 Supabase（app_rows，collection='calendar_feed'），給 Edge Function
// calendar-feed 反查 user_id。token 由 crypto 隨機生成、可重新產生即失效舊連結。
// 詳見 src/features/shared/calendar/calendarFeed.ts。
export interface CalendarFeedToken extends Entity {
  /** 永遠係 'token'（單行）。 */
  id: string
  token: string
}
export const calendarFeedCol = createCollection<CalendarFeedToken>('calendar_feed', [])

// 行事曆分類（多個有色行事曆，可開關）
export const calendarsCol = createCollection<CalendarCategory>('calendars', [
  { id: 'cal-personal', name: '個人', color: 'accent', visible: true, createdAt: new Date().toISOString() },
  { id: 'cal-work', name: '工作', color: 'blue', visible: true, createdAt: new Date().toISOString() },
  { id: 'cal-study', name: '學習', color: 'green', visible: true, createdAt: new Date().toISOString() },
])
export const readingCol = createCollection<ReadingItem>('reading_items', [])
export const habitsCol = createCollection<Habit>('habits', [])
export const habitLogsCol = createCollection<HabitLog>('habit_logs', [])
export const lessonPlansCol = createCollection<LessonPlan>('lesson_plans', [])
export const timetableCol = createCollection<TimetableSlot>('timetable', NTK_SLOTS)
// 日循環校曆：日期 → cycle day（1..6 = A..F）。空時 seed NTK 校曆。
export const cycleCalendarCol = createCollection<CycleCalendarEntry>(
  'cycle_calendar',
  NTK_CYCLE_CALENDAR,
)
export const meetingNotesCol = createCollection<MeetingNote>('meeting_notes', [])
export const observationsCol = createCollection<Observation>('observations', [])
export const inboxCol = createCollection<InboxItem>('inbox', [])
export const countdownsCol = createCollection<Countdown>('countdowns', [
  {
    id: 'cd-seed-1',
    title: 'DSE 模擬試',
    date: localDateStr(new Date(Date.now() + 7 * 864e5)),
    category: 'exam',
    mode: 'both',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'cd-seed-2',
    title: '提交專題報告',
    date: localDateStr(new Date(Date.now() + 21 * 864e5)),
    category: 'deadline',
    mode: 'both',
    createdAt: new Date().toISOString(),
  },
])

// AI 對話歷史（兩個模式共用，按 mode 區分）
export const aiThreadsCol = createCollection<AiThread>('ai_threads', [])
export const aiMessagesCol = createCollection<AiMessage>('ai_messages', [])

// 收支記帳（個人理財）預設分類
const DEFAULT_CATEGORIES: TxCategory[] = [
  { id: 'cat-salary', name: '薪金', kind: 'income', icon: '💼', createdAt: new Date().toISOString() },
  { id: 'cat-other-income', name: '其他收入', kind: 'income', icon: '➕', createdAt: new Date().toISOString() },
  { id: 'cat-food', name: '飲食', kind: 'expense', icon: '🍜', createdAt: new Date().toISOString() },
  { id: 'cat-transport', name: '交通', kind: 'expense', icon: '🚇', createdAt: new Date().toISOString() },
  { id: 'cat-shopping', name: '購物', kind: 'expense', icon: '🛍️', createdAt: new Date().toISOString() },
  { id: 'cat-bills', name: '帳單／水電', kind: 'expense', icon: '🧾', createdAt: new Date().toISOString() },
  { id: 'cat-entertainment', name: '娛樂', kind: 'expense', icon: '🎮', createdAt: new Date().toISOString() },
  { id: 'cat-other-expense', name: '其他支出', kind: 'expense', icon: '📦', createdAt: new Date().toISOString() },
]

export const txCategoriesCol = createCollection<TxCategory>('tx_categories', DEFAULT_CATEGORIES)
export const transactionsCol = createCollection<Transaction>('transactions', [])

// 自我測驗紀錄（learning + work 共用）
export const quizAttemptsCol = createCollection<QuizAttempt>('quiz_attempts', [])

migrateNeutralSeedData()

function migrateNeutralSeedData() {
  const topics = topicsCol.get()
  if (topics.length > 0 && topics.every((topic) => /^bafs-\d+$/.test(topic.id))) {
    topicsCol.set(DEFAULT_TOPICS)
  }

  const goals = goalsCol.get()
  if (goals.some((goal) => goal.id === 'goal-1' && goal.title === '溫習 BAFS 課程內容（商業管理）')) {
    goalsCol.set(
      goals.map((goal) =>
        goal.id === 'goal-1' && goal.title === '溫習 BAFS 課程內容（商業管理）'
          ? { ...goal, title: '整理 DSE 課題與教材' }
          : goal,
      ),
    )
  }

  const tasks = tasksCol.get()
  if (tasks.some((task) => task.id === 'task-2' && task.text === '預備下星期市場營銷課堂')) {
    tasksCol.set(
      tasks.map((task) =>
        task.id === 'task-2' && task.text === '預備下星期市場營銷課堂'
          ? { ...task, text: '預備下星期寫作課堂' }
          : task,
      ),
    )
  }

  const countdowns = countdownsCol.get()
  if (countdowns.some((item) => item.id === 'cd-seed-1' && item.title === 'BAFS 模擬試')) {
    countdownsCol.set(
      countdowns.map((item) =>
        item.id === 'cd-seed-1' && item.title === 'BAFS 模擬試'
          ? { ...item, title: 'DSE 模擬試' }
          : item,
      ),
    )
  }

  const slots = timetableCol.get()
  let changedSlots = false
  const nextSlots = slots.map((slot) => {
    if (slot.subject === '3A · ASB') {
      changedSlots = true
      return { ...slot, subject: '3A · 班務' }
    }
    if (slot.subject === '3A · BAFS') {
      changedSlots = true
      return { ...slot, subject: '3A · 初中課' }
    }
    if (slot.subject.endsWith('· BAFS')) {
      changedSlots = true
      return { ...slot, subject: slot.subject.replace('BAFS', '高中課') }
    }
    return slot
  })
  if (changedSlots) timetableCol.set(nextSlots)
}

// ============================================================
//  全部集合登記表（用來匯出 / 匯入 / 清除資料）
//  key 對應 localStorage 名稱（不含 ntk. 前綴）
// ============================================================
// 匯出全部資料做一個 JSON 物件
export function exportAllData() {
  const data: Record<string, unknown[]> = {}
  for (const [key, col] of collectionRegistry) data[key] = col.get()
  return { version: 1, exportedAt: new Date().toISOString(), data }
}

// 由 JSON 物件匯入（覆寫對應集合）。回傳成功匯入的集合數。
export function importAllData(payload: unknown): number {
  if (
    typeof payload !== 'object' ||
    payload === null ||
    !('data' in payload)
  )
    throw new Error('檔案格式不正確')
  const data = (payload as { data: Record<string, unknown[]> }).data
  let count = 0
  for (const [key, col] of collectionRegistry) {
    if (Array.isArray(data[key])) {
      col.set(data[key] as never[])
      count++
    }
  }
  return count
}
