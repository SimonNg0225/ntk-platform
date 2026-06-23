// ============================================================
//  功能旗標 (Feature Flags)
//  ------------------------------------------------------------
//  收費版上線控制：涉「學生（多數未成年人）／家長」個人資料嘅功能，
//  喺未完成香港 PDPO 私隱合規之前一律收起 —— 唔單止收 UI，仲要確保
//  相關 collection 唔上雲、唔 seed，做到「名實相符唔收未成年人資料」。
//
//  之後上架：.env.local / Vercel 設 VITE_STUDENT_DATA=1 即全部開返
//  （前提係已完成學生資料嘅收集聲明 / 同意 / 跨境等合規）。
// ============================================================

export const STUDENT_DATA_ENABLED = import.meta.env.VITE_STUDENT_DATA === '1'

// 涉學生／家長 PII 嘅功能 id —— 關閉時 nav 唔出、deep-link 攞唔到。
export const STUDENT_FEATURE_IDS = new Set<string>([
  'work-grading', // 批改（學生答案）
  'work-gradebook', // 成績管理
  'work-report-comments', // 成績表評語
  'work-class-tools', // 班務 / 座位
  'work-attendance', // 出席
  'work-parent-comms', // 家長溝通
  'work-classes', // 班級管理（學生名單主要入口）
  'work-curriculum', // 課程進度（按班）
])

// 涉學生／家長 PII 嘅 collection key —— 關閉時唔上 Supabase、唔 seed。
// （key 對應 createCollection 嘅名，見 data/collections.ts。）
export const STUDENT_COLLECTION_KEYS = new Set<string>([
  'classes', // 班別
  'students', // 學生名單
  'class_progress', // 課程進度（按班）
  'assessments', // 評估項目
  'scores', // 分數
  'attendance', // 出席紀錄
  'parent_comms', // 家長溝通紀錄
])

/** collection key 喺當前旗標下可唔可以同步上雲。 */
export function isCollectionSyncable(key: string): boolean {
  return STUDENT_DATA_ENABLED || !STUDENT_COLLECTION_KEYS.has(key)
}

/** feature id 喺當前旗標下可唔可以顯示 / 進入。 */
export function isFeatureAvailable(id: string): boolean {
  return STUDENT_DATA_ENABLED || !STUDENT_FEATURE_IDS.has(id)
}
