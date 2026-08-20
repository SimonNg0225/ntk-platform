import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import type { Feature } from './types'
import type { ModeId } from '../modes/modes'
import { isFeatureAvailable } from '../lib/featureFlags'

// 動態載入 feature 元件 → 各功能拆獨立 chunk，到用先 load（縮細初始 bundle）。
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
const QuestionBank = lazyFeature(() => import('./work/QuestionBank'))
const MaterialGen = lazyFeature(() => import('./work/MaterialGen'))
const ResourceLibrary = lazyFeature(() => import('./work/ResourceLibrary'))
const Community = lazyFeature(() => import('./work/community/Community'))
const RubricGen = lazyFeature(() => import('./work/rubric/RubricGen'))
const DseDrill = lazyFeature(() => import('./work/dse/DseDrill'))
const Transcribe = lazyFeature(() => import('./work/transcribe/Transcribe'))
const TopicImport = lazyFeature(() => import('./work/topicImport/TopicImport'))
const LessonPlanner = lazyFeature(() => import('./work/LessonPlanner'))
const TeachGuide = lazyFeature(() => import('./work/teachGuide/TeachGuide'))
const SlideGen = lazyFeature(() => import('./work/slides/SlideGen'))
const GradeAnalytics = lazyFeature(() => import('./work/GradeAnalytics'))
const Timetable = lazyFeature(() => import('./work/Timetable'))
const MeetingNotes = lazyFeature(() => import('./work/MeetingNotes'))
const AdminDocs = lazyFeature(() => import('./work/adminDocs/AdminDocs'))
const Scan = lazyFeature(() => import('./work/scan/Scan'))
const DocDigest = lazyFeature(() => import('./work/docDigest/DocDigest'))
const WorkDashboard = lazyFeature(() => import('./work/WorkDashboard'))
const Team = lazyFeature(() => import('./work/Team'))
const PromptLibrary = lazyFeature(() => import('./work/PromptLibrary'))
const ClassroomPack = lazyFeature(() => import('./work/ClassroomPack'))

// 社群功能
const Forum = lazyFeature(() => import('./forum/Forum'))

// 共用功能
const Calendar = lazyFeature(() => import('./shared/Calendar'))
const Countdown = lazyFeature(() => import('./shared/Countdown'))
const GlobalSearch = lazyFeature(() => import('./shared/GlobalSearch'))
const Inbox = lazyFeature(() => import('./shared/Inbox'))
const QuizMode = lazyFeature(() => import('./shared/QuizMode'))
const AIAssistant = lazyFeature(() => import('./shared/AIAssistant'))
const VoiceAssistant = lazyFeature(() => import('./shared/VoiceAssistant'))
const AskData = lazyFeature(() => import('./shared/AskData'))
const Observation = lazyFeature(() => import('./work/observation/Observation'))
const WorkReport = lazyFeature(() => import('./work/workReport/WorkReport'))

// ============================================================
//  功能註冊表 (Feature Registry) — 平台擴充中心
//  加新功能：整個元件 → 在下方加一項（填 group）→ 完成。
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
    group: '助手',
    component: AIAssistant,
    status: 'ready',
    selfManagedHeader: true,
    fullHeight: true,
    hideNextSteps: true,
  },
  {
    id: 'learning-card-generator',
    selfManagedHeader: true,
    modes: ['learning'],
    name: 'AI 生成知識卡',
    description: '貼上主題或筆記，AI 一鍵生成知識卡，直接存入牌組複習。',
    icon: '✨',
    group: '助手',
    component: CardGenerator,
    status: 'ready',
  },
  {
    id: 'learning-notes',
    selfManagedHeader: true,
    modes: ['learning'],
    name: '個人筆記',
    description: '隨手記低學到的重點，自動儲存。',
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
    description: '間隔重複（SRS），到期先彈出來複習。',
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
    description: '收藏想查看的書同文章，分狀態追蹤。',
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
    description: '記錄體重、睡眠、運動、飲水、心情，查看趨勢同達標進度。',
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
    id: 'work-classroom-pack',
    selfManagedHeader: true,
    modes: ['work'],
    name: '課堂套裝',
    description: '輸入一個課題，一次建立互相一致的教案、工作紙及簡報，逐份編輯和覆核。',
    icon: '📦',
    group: '教學',
    component: ClassroomPack,
    status: 'ready',
    hideNextSteps: true,
  },
  {
    id: 'work-ai',
    modes: ['work'],
    name: '助手對話',
    description: '由教學助手帶入任務後，繼續追問、修改和生成。',
    icon: '🤖',
    group: '助手',
    component: AIAssistant,
    status: 'ready',
    hideFromNavigation: true,
    selfManagedHeader: true,
    fullHeight: true,
    hideNextSteps: true,
  },
  {
    id: 'work-voice-assistant',
    modes: ['work'],
    name: 'Ezi 智能助手',
    description: '說出目標，由助手理解上下文、規劃步驟，並在確認後執行教學工作。',
    icon: '🎧',
    group: '助手',
    component: VoiceAssistant,
    status: 'ready',
    selfManagedHeader: true,
    fullHeight: true,
    hideNextSteps: true,
  },
  {
    id: 'work-prompt-library',
    selfManagedHeader: true,
    modes: ['work'],
    name: '教學助手',
    description: '按工作情境選擇助手：電郵、備課、出題、評語、簡報、家長溝通、行政整理等。',
    icon: '📚',
    group: '助手',
    component: PromptLibrary,
    status: 'ready',
    hideNextSteps: true,
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
    icon: '🪄',
    group: '教學',
    component: MaterialGen,
    status: 'ready',
  },
  {
    id: 'work-teach-guide',
    selfManagedHeader: true,
    modes: ['work'],
    name: '教學指引',
    description: '選擇課題，AI 協助整理教學指引：重點、學生常見誤解、教學步驟、活動、差異化、評估。',
    icon: '🧭',
    group: '教學',
    component: TeachGuide,
    status: 'ready',
  },
  {
    id: 'work-slides',
    selfManagedHeader: true,
    modes: ['work'],
    name: '簡報工作室',
    description: '四步引導整 PowerPoint：選擇課題／貼上內容／上載教材 → 選擇設計 → 設定 → 即時預覽生成。34 套模板、自動配圖，一鍵下載 .pptx。',
    icon: '📽️',
    group: '教學',
    component: SlideGen,
    status: 'ready',
    requiresPaid: true,
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
    id: 'work-grade-analytics',
    selfManagedHeader: true,
    modes: ['work'],
    name: '成績分析',
    description: '匯入測考分數，分析題目表現、預測等級、識別弱項和生成跟進分組。',
    icon: '📈',
    group: '教學',
    component: GradeAnalytics,
    status: 'ready',
  },
  {
    id: 'work-topic-import',
    selfManagedHeader: true,
    modes: ['work'],
    name: '課題匯入',
    description: '上載官方課程指引／syllabus，AI 抽出課題，一鍵載入做你科的課題（對齊真實 DSE）。',
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
    id: 'work-community',
    selfManagedHeader: true,
    modes: ['work'],
    name: '資源分享區',
    description: '全港老師互相分享教學資源，上載／瀏覽／下載／評分。',
    icon: '🌐',
    group: '教學',
    component: Community,
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
    name: '科組協作',
    description: '先用個人工作台整理教材，需要時再開科組空間邀請同事。',
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
    requiresPaid: true,
  },
  {
    id: 'work-scan',
    selfManagedHeader: true,
    modes: ['work'],
    name: '掃描 PDF',
    description: '用鏡頭或上載相片，自動偵邊拉正、套掃描濾鏡，輸出可搜尋 PDF。',
    icon: '📷',
    group: '行政',
    component: Scan,
    status: 'ready',
    requiresPaid: true,
  },
  {
    id: 'work-doc-digest',
    selfManagedHeader: true,
    modes: ['work'],
    name: '文件速讀',
    description: '貼上 / 上載 / 影低行政文件，AI 立即歸類、抽重點、列出要跟進事項。',
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
    id: 'work-observation',
    selfManagedHeader: true,
    modes: ['work'],
    name: '觀課 / 評課',
    description:
      '貼課堂文字稿或錄音轉文字，AI 對六項觀課準則撮要 + 亮點同建議，存記錄可列印。',
    icon: '👁️',
    group: '教學',
    component: Observation,
    status: 'ready',
  },
  {
    id: 'work-report',
    selfManagedHeader: true,
    modes: ['work'],
    name: '工作週報',
    description:
      '選擇時段一鍵聚合行事曆、待辦、會議筆記，AI 撮要成一頁「已完成事項 / 待跟進 / 重點」。',
    icon: '🗞️',
    group: '行政',
    component: WorkReport,
    status: 'ready',
  },

  // ═══════════ 社群 ═══════════
  {
    id: 'community-forum',
    modes: ['work', 'learning'],
    name: '老師社群',
    description: '同全港老師分版討論：教學、班務、考評、見工求職。',
    icon: '💬',
    group: '社群',
    component: Forum,
    status: 'ready',
  },

  // ═══════════ 兩個模式共用 ═══════════
  {
    id: 'ask-data',
    selfManagedHeader: true,
    modes: ['learning', 'work'],
    name: '資料問答 AI',
    description: 'AI 根據你的筆記 / 待辦 / 目標 / 日程回答你的問題。',
    icon: '✨',
    group: 'AI',
    component: AskData,
    status: 'ready',
    hideFromNavigation: true,
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
    description: '一次過搜尋全部筆記、題目、資源、教案…',
    icon: '🔍',
    group: '工具',
    component: GlobalSearch,
    status: 'ready',
    hideFromNavigation: true,
  },
  {
    id: 'inbox',
    modes: ['learning', 'work'],
    name: '快速擷取',
    description: '一秒記下想法，遲些轉成待辦或筆記。',
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
    description: '考試、死線、評估倒數，大數字一眼查看全部還有幾多日。',
    icon: '⏳',
    group: '工具',
    component: Countdown,
    status: 'ready',
  },
  {
    id: 'quiz',
    selfManagedHeader: true,
    modes: ['learning'],
    name: '自我測驗',
    description: '由題庫抽 MC 即時做題、自動批改、出分同弱項分析。',
    icon: '📝',
    group: '工具',
    component: QuizMode,
    status: 'ready',
  },
]

// 取得返某個模式可以見到的功能
export function featuresForMode(mode: ModeId): Feature[] {
  return FEATURES.filter(
    (f) => f.modes.includes(mode) && isFeatureAvailable(f.id) && !f.hideFromNavigation,
  )
}

// 取得返某個模式的功能，按 group 分組（保持註冊次序）
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

// 用 id 取得返一個功能
export function getFeature(id: string): Feature | undefined {
  if (!isFeatureAvailable(id)) return undefined
  return FEATURES.find((f) => f.id === id)
}
