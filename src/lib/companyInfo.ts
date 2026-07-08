import { SUPPORT_MAILTO } from './support'
import { BRAND_NAME } from './brand'

// ============================================================
//  商業 / 法律資料（單一 source of truth）
//  ------------------------------------------------------------
//  顯示在 Footer / Pricing / 交易 email（前端）。取得到商業登記證 (BR)
//  之後 set 環境變數就會自動在各處出現;未 set 時相關行自動隱藏。
//    VITE_COMPANY_NAME  營運者法定名稱（例：EziTeach AI Limited）
//    VITE_BR_NUMBER     商業登記證號碼
//  （Edge Function 嗰邊另用 Deno env：COMPANY_NAME / BR_NUMBER /
//    SUPPORT_EMAIL，見 supabase/functions/_shared/email.ts。）
// ============================================================

export const COMPANY = {
  /** 品牌名（永遠顯示） */
  brand: BRAND_NAME,
  /** 營運者法定名稱（獨資／有限公司全名）；未 set 為空 → 隱藏 */
  legalName: ((import.meta.env.VITE_COMPANY_NAME as string | undefined) ?? '').trim(),
  /** 商業登記證號碼；未 set 為空 → 隱藏 */
  brNumber: ((import.meta.env.VITE_BR_NUMBER as string | undefined) ?? '').trim(),
  /** 客服 email（同 support.ts 一致） */
  supportEmail: SUPPORT_MAILTO,
  /** 地區 */
  region: '香港 Hong Kong',
} as const
