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
