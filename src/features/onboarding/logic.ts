// ============================================================
//  新用戶登記 — 純邏輯（選項 + 驗證）
//  ------------------------------------------------------------
//  零 runtime 依賴（只 import type），可 node 直接單元測試。
//  UI 喺 ProfileSetupModal.tsx；I/O 喺 lib/profile.ts。
// ============================================================

import type { TeacherRole, SchoolBand } from '../../lib/profile'

/** 身份角色選項（決定預設工作模式 / 內容語境）。 */
export const ROLES: readonly { id: TeacherRole; label: string }[] = [
  { id: 'teacher', label: '在職老師' },
  { id: 'pre_service', label: '準教師 / 實習' },
  { id: 'tutor', label: '補習導師' },
  { id: 'other', label: '其他' },
]

/** 任教學制 / 年級（多選，選填）。 */
export const BANDS: readonly { id: SchoolBand; label: string }[] = [
  { id: 'primary', label: '小學' },
  { id: 'junior', label: '初中' },
  { id: 'senior', label: '高中（DSE）' },
]

/**
 * 驗證登記表單。必填：署名、身份、最少一個任教科目、同意條款。
 * 其餘（學制 / 學校 / 簡介 / 頭像色）一律選填。
 */
export function validateRegistration(
  input: { displayName: string; role: string; subjects: string[] },
  agreed: boolean,
): { ok: boolean; error?: string } {
  if (!input.displayName.trim()) return { ok: false, error: '請填姓氏（或自訂署名）。' }
  if (!input.role) return { ok: false, error: '請揀你嘅身份。' }
  if (!input.subjects || input.subjects.length === 0) {
    return { ok: false, error: '請揀最少一個任教科目。' }
  }
  if (!agreed) return { ok: false, error: '請先同意服務條款同社群守則。' }
  return { ok: true }
}
