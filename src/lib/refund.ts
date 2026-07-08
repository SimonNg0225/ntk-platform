import { supabase } from './supabase'

// ============================================================
//  退款 client（叫 `refund` Edge Function）
//  ------------------------------------------------------------
//  退款額 = 未用份額（按 AI 點數用量）× 已付 − Stripe 手續費（用戶承擔）；
//  一次性，退完即取消訂閱。細額自動、大額待 admin 審。
// ============================================================

export interface RefundEstimate {
  refundCents: number
  feeCents: number
  amountPaidCents: number
  usagePct: number // 0..1
  currency: string
  cycle: 'month' | 'year'
}

export interface RefundResult {
  status: 'done' | 'pending_review'
  refundCents: number
}

function fnUrl(): string {
  const base = (import.meta.env.VITE_SUPABASE_URL as string).replace(/\/$/, '')
  return `${base}/functions/v1/refund`
}

async function callRefund<T>(
  action: string,
  extra: Record<string, unknown> = {},
): Promise<T> {
  if (!supabase) throw new Error('未接 Supabase，無法退款。')
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new Error('請先登入。')
  const res = await fetch(fnUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
    },
    body: JSON.stringify({ action, ...extra }),
  })
  const data = (await res.json().catch(() => null)) as
    | { data?: T; error?: string }
    | null
  if (!res.ok || !data?.data) throw new Error(data?.error ?? '操作失敗，請稍後再試。')
  return data.data
}

/** 試算退款額（不會真的退）。 */
export const refundEstimate = () => callRefund<RefundEstimate>('estimate')

/** 正式申請退款（細額即退、大額待審）。 */
export const refundRequest = () => callRefund<RefundResult>('request')

/** HK$ 顯示（仙 → 元）。 */
export const hkd = (cents: number) => `HK$${(cents / 100).toFixed(2)}`

// ───── Admin（大額退款審批）─────
export interface AdminRefund {
  id: string
  user_id: string
  email: string | null
  amount_paid_cents: number
  fee_cents: number
  refund_cents: number
  currency: string
  usage_pct: number
  status: string
  created_at: string
}

export const adminRefundsList = () => callRefund<AdminRefund[]>('admin-list')
export const adminRefundApprove = (id: string) =>
  callRefund<{ ok: boolean }>('admin-approve', { id })
export const adminRefundReject = (id: string, note = '') =>
  callRefund<{ ok: boolean }>('admin-reject', { id, note })
