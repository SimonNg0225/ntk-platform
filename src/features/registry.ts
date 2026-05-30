import type { Feature } from './types'
import type { ModeId } from '../modes/modes'

// 學習模式功能
import NotesWidget from './learning/NotesWidget'
import GoalsWidget from './learning/GoalsWidget'

// 工作模式功能
import TodoWidget from './work/TodoWidget'
import ClassesWidget from './work/ClassesWidget'
import CurriculumProgress from './work/CurriculumProgress'
import QuestionBank from './work/QuestionBank'

// ============================================================
//  功能註冊表 (Feature Registry)
//  ------------------------------------------------------------
//  呢度係成個平台嘅「擴充中心」。
//
//  ★ 想加一個新功能？只需要：
//    1. 喺 src/features/<mode>/ 整一個元件
//    2. 喺下面 FEATURES 陣列加多一個項目
//    3. 完成！側邊欄、首頁概覽會自動顯示
//
//  modes:  呢個功能屬於邊啲模式（可以同時屬於兩個）
//  status: 'ready' = 可用 / 'soon' = 預留位（即將推出）
// ============================================================

export const FEATURES: Feature[] = [
  // ───────── 學習模式 ─────────
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
    id: 'learning-reading',
    modes: ['learning'],
    name: '閱讀清單',
    description: '收藏想睇嘅書同文章。',
    icon: '📖',
    status: 'soon',
  },
  {
    id: 'learning-flashcards',
    modes: ['learning'],
    name: '知識卡片',
    description: '用記憶卡複習重點概念。',
    icon: '🧠',
    status: 'soon',
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
    id: 'work-curriculum',
    modes: ['work'],
    name: '課程進度',
    description: '對住 BAFS 課程大綱追蹤每班進度。',
    icon: '📊',
    component: CurriculumProgress,
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
    id: 'work-lesson-plan',
    modes: ['work'],
    name: '備課 / 教案',
    description: '撰寫同整理 BAFS 教學計劃。',
    icon: '📋',
    status: 'soon',
  },
  {
    id: 'work-resources',
    modes: ['work'],
    name: '教學資源庫',
    description: '收藏講義、試題、教材連結。',
    icon: '🗂️',
    status: 'soon',
  },
  {
    id: 'work-gradebook',
    modes: ['work'],
    name: '成績管理',
    description: '記錄評估分數、計平均、睇弱項。',
    icon: '📈',
    status: 'soon',
  },

  // ───────── 兩個模式共用（示範跨模式功能）─────────
  {
    id: 'calendar',
    modes: ['learning', 'work'],
    name: '行事曆',
    description: '統一管理學習與工作日程。',
    icon: '📅',
    status: 'soon',
  },
]

/** 攞返某個模式可以見到嘅功能 */
export function featuresForMode(mode: ModeId): Feature[] {
  return FEATURES.filter((f) => f.modes.includes(mode))
}

/** 用 id 攞返一個功能 */
export function getFeature(id: string): Feature | undefined {
  return FEATURES.find((f) => f.id === id)
}
