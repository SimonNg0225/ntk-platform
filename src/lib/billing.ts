import { supabase, isSupabaseConfigured } from './supabase'
import { track } from './observability'

// ============================================================
//  商業化 · 收費（Stripe 訂閱）
//  ------------------------------------------------------------
//  前端只負責：
//    - 顯示方案（PLANS）
//    - 叫 Edge Function `stripe-billing` 開 Checkout / 客戶中心，
//      攞返 Stripe 嘅 redirect URL 然後跳轉。
//  Stripe secret key / webhook secret 全部喺 Edge Function secret，
//  前端永遠掂唔到。未接 Supabase / 未設 price → 當免費版。
// ============================================================

export type PlanId = 'free' | 'pro'

export type BillingCycle = 'monthly' | 'annual'

export interface Plan {
  id: PlanId
  name: string
  priceLabel: string
  tagline: string
  /** Stripe Price ID（月繳；喺 .env 設定）。免費版冇。 */
  priceId?: string
  /** Stripe Price ID（年繳，選用）。 */
  annualPriceId?: string
  /** 年繳價格顯示（例：HK$480 / 年）。 */
  annualPriceLabel?: string
  /** 年繳賣點（例：慳兩個月）。 */
  annualNote?: string
  features: string[]
  highlighted?: boolean
}

const PRO_PRICE_ID = import.meta.env.VITE_STRIPE_PRO_PRICE_ID as
  | string
  | undefined
const PRO_ANNUAL_PRICE_ID = import.meta.env
  .VITE_STRIPE_PRO_ANNUAL_PRICE_ID as string | undefined

/** 按結算週期攞 plan 嘅 priceId / 顯示價（年繳未設就 fallback 月繳）。 */
export function priceForCycle(
  plan: Plan,
  cycle: BillingCycle,
): { priceId?: string; label: string } {
  if (cycle === 'annual' && plan.annualPriceId) {
    return { priceId: plan.annualPriceId, label: plan.annualPriceLabel ?? plan.priceLabel }
  }
  return { priceId: plan.priceId, label: plan.priceLabel }
}

export const PLANS: Plan[] = [
  {
    id: 'free',
    name: '免費版',
    priceLabel: 'HK$0',
    tagline: '老師自用，永久免費',
    features: [
      '全部教學功能：備課、題庫、成績、點名、家長溝通',
      '本機儲存 + 單一裝置雲端同步',
      '每日 AI 出題 / 批改額度（基本）',
      '社群支援',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    priceLabel: 'HK$48 / 月',
    tagline: '重度備課 / 全職教師',
    priceId: PRO_PRICE_ID,
    annualPriceId: PRO_ANNUAL_PRICE_ID,
    annualPriceLabel: 'HK$480 / 年',
    annualNote: '年繳慳兩個月',
    highlighted: true,
    features: [
      '免費版全部功能',
      '無限 AI 出題、教案、批改評語',
      '多裝置即時雲端同步',
      '成績進階統計 + 資料匯出',
      '優先客服支援',
    ],
  },
]

/** 收費功能有冇接好（Supabase + Stripe price 都齊先算）。 */
export const isBillingConfigured =
  isSupabaseConfigured && Boolean(PRO_PRICE_ID)

function billingFunctionUrl(): string {
  const base = (import.meta.env.VITE_SUPABASE_URL as string).replace(/\/$/, '')
  return `${base}/functions/v1/stripe-billing`
}

async function callBilling(
  action: 'checkout' | 'portal',
  body: Record<string, unknown>,
): Promise<string> {
  if (!supabase) throw new Error('未接 Supabase，無法收費。')
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new Error('請先登入先可以管理訂閱。')

  const res = await fetch(billingFunctionUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
    },
    body: JSON.stringify({ action, ...body }),
  })
  const data = (await res.json().catch(() => null)) as
    | { url?: string; error?: string }
    | null
  if (!res.ok || !data?.url) {
    throw new Error(data?.error ?? '操作失敗，請稍後再試。')
  }
  return data.url
}

/** 開 Stripe Checkout 升級訂閱，成功後跳轉去付款頁。 */
export async function startCheckout(priceId: string): Promise<void> {
  track('checkout_started', { priceId })
  const url = await callBilling('checkout', {
    priceId,
    successUrl: `${window.location.origin}/app?upgraded=1`,
    cancelUrl: `${window.location.origin}/pricing`,
  })
  window.location.href = url
}

/** 開 Stripe 客戶自助中心（更新付款方式 / 取消訂閱）。 */
export async function openBillingPortal(): Promise<void> {
  const url = await callBilling('portal', {
    returnUrl: `${window.location.origin}/pricing`,
  })
  window.location.href = url
}
