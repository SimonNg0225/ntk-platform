import { supabase, isSupabaseConfigured } from './supabase'
import { track } from './observability'

// ============================================================
//  商業化 · 收費（Stripe 訂閱）
//  ------------------------------------------------------------
//  前端只負責：
//    - 顯示方案（PLANS）
//    - 叫 Edge Function `stripe-billing` 開 Checkout / 客戶中心，
//      取得返 Stripe 的 redirect URL 然後跳轉。
//  Stripe secret key / webhook secret 全部在 Edge Function secret，
//  前端永遠掂不到。未接 Supabase / 未設 price → 當免費版。
// ============================================================

export type PlanId = 'free' | 'plus' | 'pro'

export type BillingCycle = 'monthly' | 'annual'

export interface Plan {
  id: PlanId
  name: string
  priceLabel: string
  /** 月費（HKD 數字，0 = 免費）；用來計 AI 成本佔比。 */
  priceHkd: number
  /** 每月 AI 點數池（見 credits.ts；池 × 點價 ≤ 月費 30%）。 */
  monthlyCredits: number
  tagline: string
  /** Stripe Price ID（月繳；在 .env 設定）。免費版沒有。 */
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

const PLUS_PRICE_ID = import.meta.env.VITE_STRIPE_PLUS_PRICE_ID as
  | string
  | undefined
const PLUS_ANNUAL_PRICE_ID = import.meta.env
  .VITE_STRIPE_PLUS_ANNUAL_PRICE_ID as string | undefined
const PRO_PRICE_ID = import.meta.env.VITE_STRIPE_PRO_PRICE_ID as
  | string
  | undefined
const PRO_ANNUAL_PRICE_ID = import.meta.env
  .VITE_STRIPE_PRO_ANNUAL_PRICE_ID as string | undefined

/** 按結算週期取得 plan 的 priceId / 顯示價（年繳未設就 fallback 月繳）。 */
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
    name: '免費',
    priceLabel: 'HK$0',
    priceHkd: 0,
    monthlyCredits: 30,
    tagline: '嘗試 AI 備課',
    features: [
      '核心工具：教案、出題、評分準則、DSE 操練、文件摘要',
      '每月 30 AI 點數（試用）',
      '登入後雲端同步',
      '社群資源分享',
    ],
  },
  {
    id: 'plus',
    name: 'Plus',
    priceLabel: 'HK$28 / 月',
    priceHkd: 28,
    monthlyCredits: 300,
    tagline: '日常備課，夠用有突',
    priceId: PLUS_PRICE_ID,
    annualPriceId: PLUS_ANNUAL_PRICE_ID,
    annualPriceLabel: 'HK$280 / 年',
    annualNote: '年繳慳兩個月',
    features: [
      '免費版全部功能',
      '每月 300 AI 點數（約 300 份教材 / 100 套簡報 / 18 段錄音）',
      '解鎖簡報、行政文件範本和掃描工具',
      '較多錄音轉文字額度',
      '優先客服',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    priceLabel: 'HK$78 / 月',
    priceHkd: 78,
    monthlyCredits: 1000,
    tagline: '重度備課 / 全日校老師',
    priceId: PRO_PRICE_ID,
    annualPriceId: PRO_ANNUAL_PRICE_ID,
    annualPriceLabel: 'HK$780 / 年',
    annualNote: '年繳慳兩個月',
    highlighted: true,
    features: [
      'Plus 全部功能',
      '每月 1000 AI 點數（約 1000 份教材 / 333 套簡報 / 62 段錄音）',
      'Pro 高階 AI 模型',
      '最高錄音轉文字額度',
      '優先客服支援',
    ],
  },
]

/** 收費功能有沒有接好（Supabase + Stripe price 都齊先算）。 */
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
  if (!session) throw new Error('請先登入以管理訂閱。')

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
