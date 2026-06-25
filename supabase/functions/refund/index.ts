// ============================================================
//  Edge Function: refund — 退款（按 AI 點數使用度退未用份額）
//  ------------------------------------------------------------
//  Policy（用戶已確認）：
//   - 退款 = 未用份額 × 已付金額 − Stripe 手續費（用戶承擔）。
//       月費：未用 = (1 − 當月用量%)。
//       年費：未用 = (剩餘整月 + (1 − 當月用量%)) / 12（已過月份當已消費）。
//   - 一次性：退款即時取消訂閱、轉返 free。
//   - 細額（≤ REFUND_AUTO_MAX_HKD，預設 50）自動退；大額 → pending_review + email admin。
//  actions: estimate | request | admin-list | admin-approve | admin-reject
//
//  部署：supabase functions deploy refund
//  secrets：STRIPE_SECRET_KEY、SUPABASE_*、ADMIN_EMAILS、（選）REFUND_AUTO_MAX_HKD、AI_POINTS_*
//  ⚠️ Deno + Stripe，未經 deno check / Stripe test —— 上線前必須喺 Stripe test mode 實測。
// ============================================================
import Stripe from 'https://esm.sh/stripe@17.5.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { alertAdmin } from '../_shared/email.ts'

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const ADMIN_EMAILS = (Deno.env.get('ADMIN_EMAILS') ?? '')
  .toLowerCase()
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
const REFUND_AUTO_MAX_CENTS = Number(Deno.env.get('REFUND_AUTO_MAX_HKD') ?? '50') * 100

// AI 點數池 + 權重（對齊 gemini / src/lib/credits.ts）
const POINTS_FREE = Number(Deno.env.get('AI_POINTS_FREE') ?? '30')
const POINTS_PLUS = Number(Deno.env.get('AI_POINTS_PLUS') ?? '300')
const POINTS_PRO = Number(Deno.env.get('AI_POINTS_PRO') ?? '1000')
const POINTS_BY_LABEL: Record<string, number> = { slides: 3, transcribe: 16 }
function pointCost(label: string, model: string): number {
  return (POINTS_BY_LABEL[label] ?? 1) * (model === 'gemini-2.5-pro' ? 4 : 1)
}

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  httpClient: Stripe.createFetchHttpClient(),
  apiVersion: '2024-12-18.acacia',
})

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const MONTH_MS = (365 / 12) * 24 * 60 * 60 * 1000

interface RefundCalc {
  ok: boolean
  error?: string
  subId: string
  chargeId: string
  amountPaidCents: number
  feeCents: number
  refundCents: number
  currency: string
  usagePct: number
  cycle: 'month' | 'year'
}

// deno-lint-ignore no-explicit-any
type Admin = any

async function computeRefund(admin: Admin, userId: string): Promise<RefundCalc | { ok: false; error: string }> {
  const { data: subRow } = await admin
    .from('subscriptions')
    .select('stripe_customer_id, stripe_subscription_id, plan, status')
    .eq('user_id', userId)
    .maybeSingle()
  const active = subRow?.status === 'active' || subRow?.status === 'trialing'
  if (!subRow?.stripe_subscription_id || !active) {
    return { ok: false, error: '冇有效付費訂閱，無得退款。' }
  }
  const subId = String(subRow.stripe_subscription_id)
  const sub = await stripe.subscriptions.retrieve(subId)
  const item = sub.items.data[0]
  const cycle: 'month' | 'year' =
    item?.price?.recurring?.interval === 'year' ? 'year' : 'month'

  // 本期已付（最近一張 paid invoice）+ 退款對象 charge
  const inv = await stripe.invoices.list({
    customer: String(subRow.stripe_customer_id),
    subscription: subId,
    status: 'paid',
    limit: 1,
  })
  const invoice = inv.data[0]
  const amountPaidCents = invoice?.amount_paid ?? item?.price?.unit_amount ?? 0
  const currency = invoice?.currency ?? 'hkd'
  const chargeId = (invoice?.charge as string | null) ?? null
  if (!amountPaidCents || !chargeId) {
    return { ok: false, error: '搵唔到付款紀錄，無得自動退款。' }
  }

  // 當月 AI 點數用量%（ai_usage_stats × 權重 / pool）
  const pool =
    subRow.plan === 'pro' ? POINTS_PRO : subRow.plan === 'plus' ? POINTS_PLUS : POINTS_FREE
  const now = new Date()
  const ym = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
  const { data: rows } = await admin
    .from('ai_usage_stats')
    .select('feature, model, calls')
    .eq('user_id', userId)
    .eq('ym', ym)
  const used = (rows ?? []).reduce(
    (s: number, r: { feature: string; model: string; calls: number }) =>
      s + pointCost(r.feature, r.model) * (r.calls ?? 0),
    0,
  )
  const usagePct = pool > 0 ? Math.min(1, used / pool) : 0

  // 未用份額（月費 / 年費）
  let unusedFrac: number
  if (cycle === 'year') {
    const periodStartMs = (sub.start_date ?? Math.floor(now.getTime() / 1000)) * 1000
    const elapsedFullMonths = Math.max(
      0,
      Math.min(11, Math.floor((now.getTime() - periodStartMs) / MONTH_MS)),
    )
    const futureMonths = Math.max(0, 12 - elapsedFullMonths - 1)
    unusedFrac = (futureMonths + (1 - usagePct)) / 12
  } else {
    unusedFrac = 1 - usagePct
  }
  const gross = Math.round(amountPaidCents * unusedFrac)
  const feeCents = Math.round(amountPaidCents * 0.034 + 235) // ~3.4% + HK$2.35
  const refundCents = Math.max(0, gross - feeCents)

  return {
    ok: true,
    subId,
    chargeId,
    amountPaidCents,
    feeCents,
    refundCents,
    currency,
    usagePct,
    cycle,
  }
}

async function refundAndCancel(
  admin: Admin,
  userId: string,
  subId: string,
  chargeId: string,
  refundCents: number,
): Promise<string | null> {
  let stripeRefundId: string | null = null
  if (refundCents > 0) {
    const r = await stripe.refunds.create({ charge: chargeId, amount: refundCents })
    stripeRefundId = r.id
  }
  await stripe.subscriptions.cancel(subId)
  await admin
    .from('subscriptions')
    .update({ status: 'canceled', plan: 'free' })
    .eq('user_id', userId)
  return stripeRefundId
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!STRIPE_SECRET_KEY) return json({ error: '伺服器未設定 STRIPE_SECRET_KEY。' }, 500)

  const authHeader = req.headers.get('Authorization') ?? ''
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
  const {
    data: { user },
    error: authErr,
  } = await userClient.auth.getUser()
  if (authErr || !user) return json({ error: '請先登入。' }, 401)
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Body 唔係有效 JSON。' }, 400)
  }
  const action = String(body.action ?? '')
  const actorEmail = (user.email ?? '').toLowerCase()

  async function isAdmin(): Promise<boolean> {
    if (actorEmail && ADMIN_EMAILS.includes(actorEmail)) return true
    if (!actorEmail) return false
    const { data } = await admin
      .from('app_admins')
      .select('email')
      .eq('email', actorEmail)
      .maybeSingle()
    return !!data
  }

  try {
    if (action === 'estimate' || action === 'request') {
      const calc = await computeRefund(admin, user.id)
      if (!calc.ok) return json({ error: calc.error }, 400)

      if (action === 'estimate') {
        return json({
          data: {
            refundCents: calc.refundCents,
            feeCents: calc.feeCents,
            amountPaidCents: calc.amountPaidCents,
            usagePct: calc.usagePct,
            currency: calc.currency,
            cycle: calc.cycle,
          },
        })
      }

      // request
      if (calc.refundCents <= REFUND_AUTO_MAX_CENTS) {
        const stripeRefundId = await refundAndCancel(
          admin,
          user.id,
          calc.subId,
          calc.chargeId,
          calc.refundCents,
        )
        await admin.from('refunds').insert({
          user_id: user.id,
          stripe_subscription_id: calc.subId,
          stripe_refund_id: stripeRefundId,
          amount_paid_cents: calc.amountPaidCents,
          fee_cents: calc.feeCents,
          refund_cents: calc.refundCents,
          currency: calc.currency,
          usage_pct: calc.usagePct,
          status: 'done',
        })
        return json({ data: { status: 'done', refundCents: calc.refundCents } })
      }
      // 大額 → 待審
      await admin.from('refunds').insert({
        user_id: user.id,
        stripe_subscription_id: calc.subId,
        amount_paid_cents: calc.amountPaidCents,
        fee_cents: calc.feeCents,
        refund_cents: calc.refundCents,
        currency: calc.currency,
        usage_pct: calc.usagePct,
        status: 'pending_review',
      })
      await alertAdmin(
        '新退款待審',
        `User ${user.email ?? user.id} 申請退款 HK$${(calc.refundCents / 100).toFixed(2)}（已用 ${Math.round(calc.usagePct * 100)}% AI 點數）。請入後台審批。`,
      ).catch(() => {})
      return json({ data: { status: 'pending_review', refundCents: calc.refundCents } })
    }

    // ── admin actions ──
    if (action === 'admin-list') {
      if (!(await isAdmin())) return json({ error: '只限管理員。' }, 403)
      const { data } = await admin
        .from('refunds')
        .select('*')
        .eq('status', 'pending_review')
        .order('created_at', { ascending: false })
        .limit(200)
      const withEmail = await Promise.all(
        (data ?? []).map(async (r: Record<string, unknown>) => {
          const { data: u } = await admin.auth.admin.getUserById(String(r.user_id))
          return { ...r, email: u?.user?.email ?? null }
        }),
      )
      return json({ data: withEmail })
    }

    if (action === 'admin-approve') {
      if (!(await isAdmin())) return json({ error: '只限管理員。' }, 403)
      const id = String(body.id ?? '')
      const { data: row } = await admin.from('refunds').select('*').eq('id', id).maybeSingle()
      if (!row || row.status !== 'pending_review') {
        return json({ error: '退款紀錄唔存在或已處理。' }, 400)
      }
      const sub = await stripe.subscriptions.retrieve(String(row.stripe_subscription_id))
      const inv = await stripe.invoices.list({
        customer: String(sub.customer),
        subscription: String(row.stripe_subscription_id),
        status: 'paid',
        limit: 1,
      })
      const chargeId = (inv.data[0]?.charge as string | null) ?? null
      let stripeRefundId: string | null = null
      if (Number(row.refund_cents) > 0 && chargeId) {
        const r = await stripe.refunds.create({
          charge: chargeId,
          amount: Number(row.refund_cents),
        })
        stripeRefundId = r.id
      }
      await stripe.subscriptions.cancel(String(row.stripe_subscription_id))
      await admin
        .from('subscriptions')
        .update({ status: 'canceled', plan: 'free' })
        .eq('user_id', row.user_id)
      await admin
        .from('refunds')
        .update({
          status: 'done',
          stripe_refund_id: stripeRefundId,
          reviewed_by: actorEmail,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', id)
      return json({ data: { ok: true } })
    }

    if (action === 'admin-reject') {
      if (!(await isAdmin())) return json({ error: '只限管理員。' }, 403)
      const id = String(body.id ?? '')
      await admin
        .from('refunds')
        .update({
          status: 'rejected',
          reviewed_by: actorEmail,
          reviewed_at: new Date().toISOString(),
          note: String(body.note ?? ''),
        })
        .eq('id', id)
      return json({ data: { ok: true } })
    }

    return json({ error: '未知 action。' }, 400)
  } catch (e) {
    await alertAdmin('refund function 出錯', String((e as Error).message ?? e)).catch(() => {})
    return json({ error: (e as Error).message ?? '退款處理失敗。' }, 500)
  }
})
