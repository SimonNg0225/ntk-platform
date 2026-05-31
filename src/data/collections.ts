import { createCollection } from '../lib/store'
import { BAFS_TOPICS } from './bafs'
import type {
  Topic,
  Klass,
  Student,
  ClassProgress,
  Question,
  Resource,
  Assessment,
  Score,
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
  AttendanceRecord,
  ParentComm,
  MeetingNote,
  InboxItem,
} from './types'

// ============================================================
//  全部資料集合（單一來源，跨功能共用）
// ============================================================

// 共用骨幹
export const topicsCol = createCollection<Topic>('topics', BAFS_TOPICS)

export const classesCol = createCollection<Klass>('classes', [
  { id: 'class-5a', name: '5A', subject: 'BAFS（商業管理）' },
  { id: 'class-6b', name: '6B', subject: 'BAFS（商業管理）' },
])

export const studentsCol = createCollection<Student>('students', [])

// 工作模式
export const progressCol = createCollection<ClassProgress>('class_progress', [])
export const questionsCol = createCollection<Question>('questions', [])
export const resourcesCol = createCollection<Resource>('resources', [])
export const assessmentsCol = createCollection<Assessment>('assessments', [])
export const scoresCol = createCollection<Score>('scores', [])

// 學習模式
export const decksCol = createCollection<Deck>('decks', [])
export const cardsCol = createCollection<Card>('cards', [])
export const journalCol = createCollection<JournalEntry>('journal', [])
export const focusCol = createCollection<FocusSession>('focus_sessions', [])

export const notesCol = createCollection<Note>('learning_notes', [])
export const goalsCol = createCollection<Goal>('learning_goals', [
  {
    id: 'goal-1',
    title: '溫習 BAFS 課程內容（商業管理）',
    progress: 60,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'goal-2',
    title: '睇完一本管理學書',
    progress: 25,
    createdAt: new Date().toISOString(),
  },
])
export const tasksCol = createCollection<Task>('work_tasks', [
  { id: 'task-1', text: '批改 5A 班練習', done: false, createdAt: new Date().toISOString() },
  { id: 'task-2', text: '預備下星期市場營銷課堂', done: false, createdAt: new Date().toISOString() },
  { id: 'task-3', text: '上載功課到學校平台', done: true, createdAt: new Date().toISOString() },
])

// ───── 新一批功能 ─────
export const eventsCol = createCollection<CalendarEvent>('events', [])
export const readingCol = createCollection<ReadingItem>('reading_items', [])
export const habitsCol = createCollection<Habit>('habits', [])
export const habitLogsCol = createCollection<HabitLog>('habit_logs', [])
export const lessonPlansCol = createCollection<LessonPlan>('lesson_plans', [])
export const timetableCol = createCollection<TimetableSlot>('timetable', [])
export const attendanceCol = createCollection<AttendanceRecord>('attendance', [])
export const parentCommsCol = createCollection<ParentComm>('parent_comms', [])
export const meetingNotesCol = createCollection<MeetingNote>('meeting_notes', [])
export const inboxCol = createCollection<InboxItem>('inbox', [])

// ============================================================
//  全部集合登記表（用嚟匯出 / 匯入 / 清除資料）
//  key 對應 localStorage 名稱（唔含 ntk. 前綴）
// ============================================================
export const ALL_COLLECTIONS: { key: string; col: { get: () => unknown[]; set: (v: never[]) => void } }[] = [
  { key: 'topics', col: topicsCol },
  { key: 'classes', col: classesCol },
  { key: 'students', col: studentsCol },
  { key: 'class_progress', col: progressCol },
  { key: 'questions', col: questionsCol },
  { key: 'resources', col: resourcesCol },
  { key: 'assessments', col: assessmentsCol },
  { key: 'scores', col: scoresCol },
  { key: 'decks', col: decksCol },
  { key: 'cards', col: cardsCol },
  { key: 'journal', col: journalCol },
  { key: 'focus_sessions', col: focusCol },
  { key: 'learning_notes', col: notesCol },
  { key: 'learning_goals', col: goalsCol },
  { key: 'work_tasks', col: tasksCol },
  { key: 'events', col: eventsCol },
  { key: 'reading_items', col: readingCol },
  { key: 'habits', col: habitsCol },
  { key: 'habit_logs', col: habitLogsCol },
  { key: 'lesson_plans', col: lessonPlansCol },
  { key: 'timetable', col: timetableCol },
  { key: 'attendance', col: attendanceCol },
  { key: 'parent_comms', col: parentCommsCol },
  { key: 'meeting_notes', col: meetingNotesCol },
  { key: 'inbox', col: inboxCol },
]

// 匯出全部資料做一個 JSON 物件
export function exportAllData() {
  const data: Record<string, unknown[]> = {}
  for (const { key, col } of ALL_COLLECTIONS) data[key] = col.get()
  return { version: 1, exportedAt: new Date().toISOString(), data }
}

// 由 JSON 物件匯入（覆寫對應集合）。回傳成功匯入嘅集合數。
export function importAllData(payload: unknown): number {
  if (
    typeof payload !== 'object' ||
    payload === null ||
    !('data' in payload)
  )
    throw new Error('檔案格式唔啱')
  const data = (payload as { data: Record<string, unknown[]> }).data
  let count = 0
  for (const { key, col } of ALL_COLLECTIONS) {
    if (Array.isArray(data[key])) {
      col.set(data[key] as never[])
      count++
    }
  }
  return count
}
