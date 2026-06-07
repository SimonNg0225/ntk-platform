import { supabase, isSupabaseConfigured } from './supabase'

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

export interface Plan {
  id: PlanId
  name: string
  priceLabel: string
  tagline: string
  /** Stripe Price ID（喺 .env 設定，對應 Stripe Dashboard 嘅 price）。免費版冇。 */
  priceId?: string
  features: string[]
  highlighted?: boolean
}

const PRO_PRICE_ID = import.meta.env.VITE_STRIPE_PRO_PRICE_ID as
  | string
  | undefined

export const PLANS: Plan[] = [
  {
    id: 'free',
    name: '免費版',
    priceLabel: 'HK$0',
    tagline: '個人自用，永久免費',
    features: [
      '全部 30+ 學習 / 工作功能',
      '本機儲存 + 單一裝置雲端同步',
      '每日 AI 額度（基本）',
      '社群支援',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    priceLabel: 'HK$48 / 月',
    tagline: '專業 / 進階用戶',
    priceId: PRO_PRICE_ID,
    highlighted: true,
    features: [
      '免費版全部功能',
      '無限 AI 助手 / AI 教練 / 拍照識別',
      '多裝置即時雲端同步',
      '優先客服支援',
      '資料匯出 + 進階統計',
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
