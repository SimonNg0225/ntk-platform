import type { Feature } from './types'
import type { ModeId } from '../modes/modes'

// 學習模式功能
import NotesWidget from './learning/NotesWidget'
import GoalsWidget from './learning/GoalsWidget'
import Flashcards from './learning/Flashcards'
import FocusTimer from './learning/FocusTimer'
import Journal from './learning/Journal'
import LearningDashboard from './learning/LearningDashboard'
import ReadingList from './learning/ReadingList'
import HabitTracker from './learning/HabitTracker'

// 工作模式功能
import TodoWidget from './work/TodoWidget'
import ClassesWidget from './work/ClassesWidget'
import CurriculumProgress from './work/CurriculumProgress'
import QuestionBank from './work/QuestionBank'
import ResourceLibrary from './work/ResourceLibrary'
import Gradebook from './work/Gradebook'
import LessonPlanner from './work/LessonPlanner'
import Timetable from './work/Timetable'
import Attendance from './work/Attendance'
import ParentComms from './work/ParentComms'
import MeetingNotes from './work/MeetingNotes'

// 共用功能
import Calendar from './shared/Calendar'

export const FEATURES: Feature[] = [
  // ───────── 學習模式 ─────────
  {
    id: 'learning-dashboard',
    modes: ['learning'],
    name: '學習儀表板',
    description: '今日複習、連續日數、目標、最近筆記一覽。',
    icon: '📊',
    component: LearningDashboard,
    status: 'ready',
  },
  {
    id: 'learning-notes',
    modes: ['learning'],
    name: '學習筆記',
    description: '隨手記低學到嘅重點，自動儲存。',
    icon: '📝',
    component: NotesWidget,
    status: 'ready',
  },
  {
    id: 'learning-goals',
    modes: ['learning'],
    name: '學習目標',
    description: '設定目標、追蹤進度。',
    icon: '🎯',
    component: GoalsWidget,
    status: 'ready',
  },
  {
    id: 'learning-flashcards',
    modes: ['learning'],
    name: '知識卡 + 複習',
    description: '間隔重複（SRS），到期先彈出嚟複習。',
    icon: '🧠',
    component: Flashcards,
    status: 'ready',
  },
  {
    id: 'learning-focus',
    modes: ['learning'],
    name: '專注計時器',
    description: '番茄鐘專注 / 休息循環 + 統計。',
    icon: '⏱️',
    component: FocusTimer,
    status: 'ready',
  },
  {
    id: 'learning-journal',
    modes: ['learning'],
    name: '學習日誌',
    description: '每日反思，連續記低成長軌跡。',
    icon: '📓',
    component: Journal,
    status: 'ready',
  },
  {
    id: 'learning-reading',
    modes: ['learning'],
    name: '閱讀清單',
    description: '收藏想睇嘅書同文章，分狀態追蹤。',
    icon: '📖',
    component: ReadingList,
    status: 'ready',
  },
  {
    id: 'learning-habits',
    modes: ['learning'],
    name: '習慣追蹤',
    description: '每日打卡，建立學習好習慣。',
    icon: '🔥',
    component: HabitTracker,
    status: 'ready',
  },

  // ───────── 工作模式 ─────────
  {
    id: 'work-tasks',
    modes: ['work'],
    name: '待辦 / 批改',
    description: '備課、批改、行政事項一覽。',
    icon: '✅',
    component: TodoWidget,
    status: 'ready',
  },
  {
    id: 'work-classes',
    modes: ['work'],
    name: '班別管理',
    description: '記錄你任教嘅班別同學生。',
    icon: '🏫',
    component: ClassesWidget,
    status: 'ready',
  },
  {
    id: 'work-timetable',
    modes: ['work'],
    name: '時間表',
    description: '每週教學時間表一覽。',
    icon: '🗓️',
    component: Timetable,
    status: 'ready',
  },
  {
    id: 'work-curriculum',
    modes: ['work'],
    name: '課程進度',
    description: '對住 BAFS 課程大綱追蹤每班進度。',
    icon: '📊',
    component: CurriculumProgress,
    status: 'ready',
  },
  {
    id: 'work-lesson-plan',
    modes: ['work'],
    name: '備課 / 教案',
    description: '撰寫同整理 BAFS 教學計劃。',
    icon: '📋',
    component: LessonPlanner,
    status: 'ready',
  },
  {
    id: 'work-questions',
    modes: ['work'],
    name: 'BAFS 題庫',
    description: '按課題／題型／難度儲存題目。',
    icon: '🧩',
    component: QuestionBank,
    status: 'ready',
  },
  {
    id: 'work-resources',
    modes: ['work'],
    name: '教學資源庫',
    description: '收藏講義、試題、教材連結。',
    icon: '🗂️',
    component: ResourceLibrary,
    status: 'ready',
  },
  {
    id: 'work-gradebook',
    modes: ['work'],
    name: '成績管理',
    description: '記錄評估分數、計平均、睇弱項。',
    icon: '📈',
    component: Gradebook,
    status: 'ready',
  },
  {
    id: 'work-attendance',
    modes: ['work'],
    name: '點名 / 出席',
    description: '每堂記錄學生出席狀況。',
    icon: '🙋',
    component: Attendance,
    status: 'ready',
  },
  {
    id: 'work-parent-comms',
    modes: ['work'],
    name: '家長溝通',
    description: '記錄與家長／學生嘅聯絡同跟進。',
    icon: '📞',
    component: ParentComms,
    status: 'ready',
  },
  {
    id: 'work-meeting-notes',
    modes: ['work'],
    name: '會議筆記',
    description: '會議與行政事項筆記。',
    icon: '🗒️',
    component: MeetingNotes,
    status: 'ready',
  },

  // ───────── 兩個模式共用 ─────────
  {
    id: 'calendar',
    modes: ['learning', 'work'],
    name: '行事曆',
    description: '統一管理學習與工作日程。',
    icon: '📅',
    component: Calendar,
    status: 'ready',
  },
]

// 攞返某個模式可以見到嘅功能
export function featuresForMode(mode: ModeId): Feature[] {
  return FEATURES.filter((f) => f.modes.includes(mode))
}

// 用 id 攞返一個功能
export function getFeature(id: string): Feature | undefined {
  return FEATURES.find((f) => f.id === id)
}
