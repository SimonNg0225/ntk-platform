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
const MaterialGen = lazyFeature(() => import('./work/MaterialGen'))
const Grading = lazyFeature(() => import('./work/Grading'))
const ResourceLibrary = lazyFeature(() => import('./work/ResourceLibrary'))
const Gradebook = lazyFeature(() => import('./work/Gradebook'))
const ReportComments = lazyFeature(() => import('./work/reportComments/ReportComments'))
const ClassTools = lazyFeature(() => import('./work/classTools/ClassTools'))
const EssayMark = lazyFeature(() => import('./work/essayMark/EssayMark'))
const RubricGen = lazyFeature(() => import('./work/rubric/RubricGen'))
const DseDrill = lazyFeature(() => import('./work/dse/DseDrill'))
const Transcribe = lazyFeature(() => import('./work/transcribe/Transcribe'))
const TopicImport = lazyFeature(() => import('./work/topicImport/TopicImport'))
const LessonPlanner = lazyFeature(() => import('./work/LessonPlanner'))
const TeachGuide = lazyFeature(() => import('./work/teachGuide/TeachGuide'))
const SlideGen = lazyFeature(() => import('./work/slides/SlideGen'))
const Timetable = lazyFeature(() => import('./work/Timetable'))
const Attendance = lazyFeature(() => import('./work/Attendance'))
const ParentComms = lazyFeature(() => import('./work/ParentComms'))
const MeetingNotes = lazyFeature(() => import('./work/MeetingNotes'))
const AdminDocs = lazyFeature(() => import('./work/adminDocs/AdminDocs'))
const DocDigest = lazyFeature(() => import('./work/docDigest/DocDigest'))
const BudgetTracker = lazyFeature(() => import('./work/BudgetTracker'))
const WorkDashboard = lazyFeature(() => import('./work/WorkDashboard'))
const Team = lazyFeature(() => import('./work/Team'))

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
    selfManagedHeader: true,
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
    selfManagedHeader: true,
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
    selfManagedHeader: true,
    status: 'ready',
  },
  {
    id: 'learning-habits',
    selfManagedHeader: true,
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
    selfManagedHeader: true,
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
    selfManagedHeader: true,
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
    selfManagedHeader: true,
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
    name: '教學 AI',
    description: '出題、教案大綱、批改評語、課堂活動。',
    icon: '🤖',
    group: 'AI',
    component: AIAssistant,
    status: 'ready',
  },
  {
    id: 'work-grading',
    modes: ['work'],
    name: 'AI 批改',
    description: '批改學生答案（文字 / 相片）+ 生成成績表評語。',
    icon: '🖍️',
    group: 'AI',
    component: Grading,
    status: 'ready',
  },
  {
    id: 'work-curriculum',
    selfManagedHeader: true,
    modes: ['work'],
    name: '課程進度',
    description: '對住課程大綱追蹤每班進度。',
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
    description: '撰寫同整理教學計劃。',
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
    name: '題庫',
    description: '按課題／題型／難度儲存題目。',
    icon: '🧩',
    group: '教學',
    component: QuestionBank,
    status: 'ready',
  },
  {
    id: 'work-generate',
    selfManagedHeader: true,
    modes: ['work'],
    name: '教材生成',
    description: 'AI 生成 MC／短答／個案／長題、教學練習同試卷，直接入題庫。',
    icon: '🏭',
    group: '教學',
    component: MaterialGen,
    status: 'ready',
  },
  {
    id: 'work-teach-guide',
    selfManagedHeader: true,
    modes: ['work'],
    name: '教學指引',
    description: '揀課題，AI 教你點教：重點、學生常見誤解、教學步驟、活動、差異化、評估。',
    icon: '🧭',
    group: '教學',
    component: TeachGuide,
    status: 'ready',
  },
  {
    id: 'work-slides',
    selfManagedHeader: true,
    modes: ['work'],
    name: '教學簡報',
    description: '揀課題或貼內容，AI 生成 PowerPoint 大綱，一鍵下載 .pptx。',
    icon: '📽️',
    group: '教學',
    component: SlideGen,
    status: 'ready',
  },
  {
    id: 'work-rubric',
    selfManagedHeader: true,
    modes: ['work'],
    name: '評分準則',
    description: '貼題目，AI 出評分指引（參考答案＋評分點）或評分量表（準則×等級），可匯出 Word。',
    icon: '⚖️',
    group: '教學',
    component: RubricGen,
    status: 'ready',
  },
  {
    id: 'work-dse',
    selfManagedHeader: true,
    modes: ['work'],
    name: 'DSE 操練',
    description: '按課題出 DSE 公開試風格題目（連評分要點、達標提示），加 DSE 倒數。',
    icon: '🎓',
    group: '教學',
    component: DseDrill,
    status: 'ready',
  },
  {
    id: 'work-topic-import',
    selfManagedHeader: true,
    modes: ['work'],
    name: '課題匯入',
    description: '上載官方課程指引／syllabus，AI 抽出課題，一鍵載入做你科嘅課題（對齊真實 DSE）。',
    icon: '📥',
    group: '教學',
    component: TopicImport,
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
    selfManagedHeader: true,
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
    selfManagedHeader: true,
    modes: ['work'],
    name: '成績管理',
    description: '記錄評估分數、計平均、睇弱項。',
    icon: '📈',
    group: '學生',
    component: Gradebook,
    status: 'ready',
  },
  {
    id: 'work-report-comments',
    selfManagedHeader: true,
    modes: ['work'],
    name: '成績表評語',
    description: '揀班，AI 按每個學生成績一次過寫全班評語，可微調、重生、匯出 Word。',
    icon: '💬',
    group: '學生',
    component: ReportComments,
    status: 'ready',
  },
  {
    id: 'work-class-tools',
    selfManagedHeader: true,
    modes: ['work'],
    name: '課堂工具',
    description: '隨機抽人、即時分組、計時、計分 —— 上堂即用。',
    icon: '🎲',
    group: '學生',
    component: ClassTools,
    status: 'ready',
  },
  {
    id: 'work-essay-mark',
    selfManagedHeader: true,
    modes: ['work'],
    name: '作文批改',
    description: '貼或影低作文，AI 按準則打分、標病句、寫總評（中／英），可匯出 Word。',
    icon: '✍️',
    group: '學生',
    component: EssayMark,
    status: 'ready',
  },
  {
    id: 'work-attendance',
    selfManagedHeader: true,
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
    selfManagedHeader: true,
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
    selfManagedHeader: true,
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
    selfManagedHeader: true,
    modes: ['work'],
    name: '會議筆記',
    description: '會議與行政事項筆記。',
    icon: '🗒️',
    group: '行政',
    component: MeetingNotes,
    status: 'ready',
  },
  {
    id: 'work-team',
    modes: ['work'],
    name: '團隊 / 座位',
    description: '建立學校 / 科組團隊，邀請同事、管理座位。',
    icon: '👥',
    group: '行政',
    component: Team,
    status: 'ready',
  },
  {
    id: 'work-admin-docs',
    selfManagedHeader: true,
    modes: ['work'],
    name: '行政文件',
    description: '上載 Word 範本，認出 {標籤} 逐欄填寫，原格式生成 .docx 下載去印。',
    icon: '📄',
    group: '行政',
    component: AdminDocs,
    status: 'ready',
  },
  {
    id: 'work-doc-digest',
    selfManagedHeader: true,
    modes: ['work'],
    name: '文件速讀',
    description: '貼上 / 上載 / 影低行政文件，AI 即刻歸類、抽重點、列出要跟進事項。',
    icon: '📑',
    group: '行政',
    component: DocDigest,
    status: 'ready',
  },
  {
    id: 'work-transcribe',
    selfManagedHeader: true,
    modes: ['work'],
    name: '錄音轉文字',
    description: '上載會議／觀課錄音，AI 轉文字、抽重點、列決議同待跟進，可存入會議筆記。',
    icon: '🎙️',
    group: '行政',
    component: Transcribe,
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
    selfManagedHeader: true,
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
    selfManagedHeader: true,
  },
  {
    id: 'countdown',
    selfManagedHeader: true,
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
    selfManagedHeader: true,
    modes: ['learning', 'work'],
    name: '自我測驗',
    description: '由題庫抽 MC 即時做題、自動批改、出分同弱項分析。',
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
