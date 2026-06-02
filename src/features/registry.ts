import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import type { Feature } from './types'
import type { ModeId } from '../modes/modes'

// 動態載入 feature 元件 → 各功能拆獨立 chunk，到用先 load（縮細初始 bundle）。
// .preload：App idle 時背景預載全部，確保所有功能嘅 collection 都登記（同步 / 匯出完整）。
type LazyFeature = LazyExoticComponent<ComponentType> & {
  preload: () => Promise<unknown>
}
function lazyFeature(
  loader: () => Promise<{ default: ComponentType }>,
): LazyFeature {
  const C = lazy(loader) as LazyFeature
  C.preload = loader
  return C
}

// 個人模式功能
const NotesWidget = lazyFeature(() => import('./learning/NotesWidget'))
const GoalsWidget = lazyFeature(() => import('./learning/GoalsWidget'))
const Flashcards = lazyFeature(() => import('./learning/Flashcards'))
const CardGenerator = lazyFeature(() => import('./learning/CardGenerator'))
const FocusTimer = lazyFeature(() => import('./learning/FocusTimer'))
const Journal = lazyFeature(() => import('./learning/Journal'))
const LearningDashboard = lazyFeature(() => import('./learning/LearningDashboard'))
const ReadingList = lazyFeature(() => import('./learning/ReadingList'))
const HabitTracker = lazyFeature(() => import('./learning/HabitTracker'))
const HealthTracker = lazyFeature(() => import('./learning/HealthTracker'))
const Fitness = lazyFeature(() => import('./learning/Fitness'))

// 工作模式功能
const TodoWidget = lazyFeature(() => import('./work/TodoWidget'))
const ClassesWidget = lazyFeature(() => import('./work/ClassesWidget'))
const CurriculumProgress = lazyFeature(() => import('./work/CurriculumProgress'))
const QuestionBank = lazyFeature(() => import('./work/QuestionBank'))
const ResourceLibrary = lazyFeature(() => import('./work/ResourceLibrary'))
const Gradebook = lazyFeature(() => import('./work/Gradebook'))
const LessonPlanner = lazyFeature(() => import('./work/LessonPlanner'))
const Timetable = lazyFeature(() => import('./work/Timetable'))
const Attendance = lazyFeature(() => import('./work/Attendance'))
const ParentComms = lazyFeature(() => import('./work/ParentComms'))
const MeetingNotes = lazyFeature(() => import('./work/MeetingNotes'))
const BudgetTracker = lazyFeature(() => import('./work/BudgetTracker'))
const WorkDashboard = lazyFeature(() => import('./work/WorkDashboard'))

// 共用功能
const Calendar = lazyFeature(() => import('./shared/Calendar'))
const Countdown = lazyFeature(() => import('./shared/Countdown'))
const GlobalSearch = lazyFeature(() => import('./shared/GlobalSearch'))
const Inbox = lazyFeature(() => import('./shared/Inbox'))
const QuizMode = lazyFeature(() => import('./shared/QuizMode'))
const AIAssistant = lazyFeature(() => import('./shared/AIAssistant'))
const AskData = lazyFeature(() => import('./shared/AskData'))

// ============================================================
//  功能註冊表 (Feature Registry) — 平台擴充中心
//  加新功能：整個元件 → 喺下面加一項（填 group）→ 完成。
// ============================================================

export const FEATURES: Feature[] = [
  // ═══════════ 個人模式 ═══════════
  {
    id: 'learning-dashboard',
    modes: ['learning'],
    name: '個人儀表板',
    description: '今日複習、連續日數、目標、最近筆記一覽。',
    icon: '📊',
    group: '概覽',
    component: LearningDashboard,
    status: 'ready',
  },
  {
    id: 'learning-ai',
    modes: ['learning'],
    name: '個人 AI 助手',
    description: '問答、解釋概念、總結筆記、出練習。',
    icon: '🤖',
    group: 'AI',
    component: AIAssistant,
    status: 'ready',
  },
  {
    id: 'learning-card-generator',
    selfManagedHeader: true,
    modes: ['learning'],
    name: 'AI 生成知識卡',
    description: '貼上主題或筆記，AI 一鍵生成知識卡，直接存入牌組複習。',
    icon: '✨',
    group: 'AI',
    component: CardGenerator,
    status: 'ready',
  },
  {
    id: 'learning-notes',
    selfManagedHeader: true,
    modes: ['learning'],
    name: '個人筆記',
    description: '隨手記低學到嘅重點，自動儲存。',
    icon: '📝',
    group: '知識管理',
    component: NotesWidget,
    status: 'ready',
  },
  {
    id: 'learning-flashcards',
    modes: ['learning'],
    name: '知識卡 + 複習',
    description: '間隔重複（SRS），到期先彈出嚟複習。',
    icon: '🧠',
    group: '知識管理',
    component: Flashcards,
    status: 'ready',
  },
  {
    id: 'learning-reading',
    modes: ['learning'],
    name: '閱讀清單',
    description: '收藏想睇嘅書同文章，分狀態追蹤。',
    icon: '📖',
    group: '知識管理',
    component: ReadingList,
    status: 'ready',
  },
  {
    id: 'learning-goals',
    modes: ['learning'],
    name: '個人目標',
    description: '設定目標、追蹤進度。',
    icon: '🎯',
    group: '目標與習慣',
    component: GoalsWidget,
    status: 'ready',
  },
  {
    id: 'learning-habits',
    modes: ['learning'],
    name: '習慣追蹤',
    description: '每日打卡，建立個人好習慣。',
    icon: '🔥',
    group: '目標與習慣',
    component: HabitTracker,
    status: 'ready',
  },
  {
    id: 'learning-focus',
    modes: ['learning'],
    name: '專注計時器',
    description: '番茄鐘專注 / 休息循環 + 統計。',
    icon: '⏱️',
    group: '目標與習慣',
    component: FocusTimer,
    status: 'ready',
  },
  {
    id: 'learning-journal',
    modes: ['learning'],
    name: '個人日誌',
    description: '每日反思，連續記低成長軌跡。',
    icon: '📓',
    group: '目標與習慣',
    component: Journal,
    status: 'ready',
  },
  {
    id: 'learning-health',
    selfManagedHeader: true,
    modes: ['learning'],
    name: '健康追蹤',
    description: '記錄體重、睡眠、運動、飲水、心情，睇趨勢同達標進度。',
    icon: '🫀',
    group: '健康',
    component: HealthTracker,
    status: 'ready',
  },
  {
    id: 'learning-fitness',
    modes: ['learning'],
    name: '健身中心',
    description: '體態數據、訓練記錄、AI 飲食營養、AI 教練、動作庫。',
    icon: '🏋️',
    group: '健康',
    component: Fitness,
    status: 'ready',
  },

  // ═══════════ 工作模式 ═══════════
  {
    id: 'work-dashboard',
    modes: ['work'],
    name: '工作儀表板',
    description: '今日課堂、待辦、待跟進、各班進度一覽。',
    icon: '🧭',
    group: '概覽',
    component: WorkDashboard,
    status: 'ready',
  },
  {
    id: 'work-ai',
    modes: ['work'],
    name: 'BAFS 教學 AI',
    description: '出題、教案大綱、批改評語、課堂活動。',
    icon: '🤖',
    group: 'AI',
    component: AIAssistant,
    status: 'ready',
  },
  {
    id: 'work-curriculum',
    selfManagedHeader: true,
    modes: ['work'],
    name: '課程進度',
    description: '對住 BAFS 課程大綱追蹤每班進度。',
    icon: '📊',
    group: '教學',
    component: CurriculumProgress,
    status: 'ready',
  },
  {
    id: 'work-lesson-plan',
    selfManagedHeader: true,
    modes: ['work'],
    name: '備課 / 教案',
    description: '撰寫同整理 BAFS 教學計劃。',
    icon: '📋',
    group: '教學',
    component: LessonPlanner,
    status: 'ready',
  },
  {
    id: 'work-timetable',
    selfManagedHeader: true,
    modes: ['work'],
    name: '時間表',
    description: '每週教學時間表一覽。',
    icon: '🗓️',
    group: '教學',
    component: Timetable,
    status: 'ready',
  },
  {
    id: 'work-questions',
    selfManagedHeader: true,
    modes: ['work'],
    name: 'BAFS 題庫',
    description: '按課題／題型／難度儲存題目。',
    icon: '🧩',
    group: '教學',
    component: QuestionBank,
    status: 'ready',
  },
  {
    id: 'work-resources',
    selfManagedHeader: true,
    modes: ['work'],
    name: '教學資源庫',
    description: '收藏講義、試題、教材連結。',
    icon: '🗂️',
    group: '教學',
    component: ResourceLibrary,
    status: 'ready',
  },
  {
    id: 'work-classes',
    modes: ['work'],
    name: '班別管理',
    description: '記錄你任教嘅班別同學生。',
    icon: '🏫',
    group: '學生',
    component: ClassesWidget,
    status: 'ready',
  },
  {
    id: 'work-gradebook',
    modes: ['work'],
    name: '成績管理',
    description: '記錄評估分數、計平均、睇弱項。',
    icon: '📈',
    group: '學生',
    component: Gradebook,
    status: 'ready',
  },
  {
    id: 'work-attendance',
    modes: ['work'],
    name: '點名 / 出席',
    description: '每堂記錄學生出席狀況。',
    icon: '🙋',
    group: '學生',
    component: Attendance,
    status: 'ready',
  },
  {
    id: 'work-parent-comms',
    modes: ['work'],
    name: '家長溝通',
    description: '記錄與家長／學生嘅聯絡同跟進。',
    icon: '📞',
    group: '學生',
    component: ParentComms,
    status: 'ready',
  },
  {
    id: 'work-tasks',
    modes: ['work'],
    name: '待辦 / 批改',
    description: '備課、批改、行政事項一覽。',
    icon: '✅',
    group: '行政',
    component: TodoWidget,
    status: 'ready',
  },
  {
    id: 'work-meeting-notes',
    modes: ['work'],
    name: '會議筆記',
    description: '會議與行政事項筆記。',
    icon: '🗒️',
    group: '行政',
    component: MeetingNotes,
    status: 'ready',
  },
  {
    id: 'work-budget',
    selfManagedHeader: true,
    modes: ['learning', 'work'],
    name: '收支記帳',
    description: '記錄每日收入支出，睇本月結餘同分類佔比。',
    icon: '💰',
    group: '理財',
    component: BudgetTracker,
    status: 'ready',
  },

  // ═══════════ 兩個模式共用 ═══════════
  {
    id: 'ask-data',
    selfManagedHeader: true,
    modes: ['learning', 'work'],
    name: '問我嘅資料 AI',
    description: 'AI 根據你嘅筆記 / 待辦 / 目標 / 日程回答你嘅問題。',
    icon: '✨',
    group: 'AI',
    component: AskData,
    status: 'ready',
  },
  {
    id: 'calendar',
    modes: ['learning', 'work'],
    name: '行事曆',
    description: '統一管理個人與工作日程。',
    icon: '📅',
    group: '工具',
    component: Calendar,
    status: 'ready',
  },
  {
    id: 'search',
    selfManagedHeader: true,
    modes: ['learning', 'work'],
    name: '全域搜尋',
    description: '一次過搵晒筆記、題目、資源、教案…',
    icon: '🔍',
    group: '工具',
    component: GlobalSearch,
    status: 'ready',
  },
  {
    id: 'inbox',
    modes: ['learning', 'work'],
    name: '快速擷取',
    description: '一秒掉低諗法，遲啲轉成待辦或筆記。',
    icon: '📥',
    group: '工具',
    component: Inbox,
    status: 'ready',
  },
  {
    id: 'countdown',
    modes: ['learning', 'work'],
    name: '重要日子倒數',
    description: '考試、死線、評估倒數，大數字一眼睇晒仲有幾多日。',
    icon: '⏳',
    group: '工具',
    component: Countdown,
    status: 'ready',
  },
  {
    id: 'quiz',
    modes: ['learning', 'work'],
    name: '自我測驗',
    description: '由 BAFS 題庫抽 MC 即時做題、自動批改、出分同弱項分析。',
    icon: '📝',
    group: '工具',
    component: QuizMode,
    status: 'ready',
  },
]

// 攞返某個模式可以見到嘅功能
export function featuresForMode(mode: ModeId): Feature[] {
  return FEATURES.filter((f) => f.modes.includes(mode))
}

// 攞返某個模式嘅功能，按 group 分組（保持註冊次序）
export function groupedFeatures(mode: ModeId): { group: string; items: Feature[] }[] {
  const groups: { group: string; items: Feature[] }[] = []
  for (const f of featuresForMode(mode)) {
    let g = groups.find((x) => x.group === f.group)
    if (!g) {
      g = { group: f.group, items: [] }
      groups.push(g)
    }
    g.items.push(f)
  }
  return groups
}

// 用 id 攞返一個功能
export function getFeature(id: string): Feature | undefined {
  return FEATURES.find((f) => f.id === id)
}

// 背景預載全部功能 chunk（App idle 時呼叫）：令所有 lazy 功能嘅 collection
// 都會建立並登記入 collectionRegistry，確保雲端同步 / 匯出匯入覆蓋齊全。
export function preloadAllFeatures(): Promise<void> {
  const loaders: Promise<unknown>[] = []
  for (const f of FEATURES) {
    const c = f.component as Partial<LazyFeature> | undefined
    if (c && typeof c.preload === 'function') loaders.push(c.preload())
  }
  return Promise.all(loaders).then(() => undefined)
}
