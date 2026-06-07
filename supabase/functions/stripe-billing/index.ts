// ============================================================
//  Edge Function: stripe-billing
//  ------------------------------------------------------------
//  伺服器側處理 Stripe Checkout / 客戶自助中心。
//  - 先驗證呼叫者已登入（Supabase Auth JWT），未登入 401。
//  - action 'checkout' → 開訂閱 Checkout Session，回 redirect url。
//  - action 'portal'   → 開 Billing Portal，回 redirect url。
//  - Stripe secret key 喺 Supabase secret，前端永遠掂唔到。
//  - 用 service_role 寫 subscriptions（記低 stripe_customer_id），
//    繞過 RLS（前端寫唔到訂閱表，只 webhook / 此處可寫）。
//
//  部署：
//    supabase functions deploy stripe-billing
//    supabase secrets set STRIPE_SECRET_KEY=sk_...
//  詳見 docs/COMMERCIALIZATION.md
// ============================================================

import Stripe from 'https://esm.sh/stripe@17.5.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  httpClient: Stripe.createFetchHttpClient(),
  apiVersion: '2024-12-18.acacia',
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!STRIPE_SECRET_KEY) {
    return json({ error: '伺服器未設定 STRIPE_SECRET_KEY。' }, 500)
  }

  // ── 驗證登入 ──────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization') ?? ''
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser()
  if (authError || !user) {
    return json({ error: '請先登入。' }, 401)
  }

  // service_role：可繞過 RLS 寫 subscriptions
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  let body: {
    action?: string
    priceId?: string
    successUrl?: string
    cancelUrl?: string
    returnUrl?: string
  }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Request body 唔係有效 JSON。' }, 400)
  }

  // ── 攞 / 開 Stripe customer（一個 user 一個 customer）─────────
  const { data: existing } = await admin
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .maybeSingle()

  let customerId = existing?.stripe_customer_id as string | undefined
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { supabase_user_id: user.id },
    })
    customerId = customer.id
    // 即刻記低（plan 暫 free，真正啟用由 webhook 寫返）
    await admin.from('subscriptions').upsert({
      user_id: user.id,
      stripe_customer_id: customerId,
    })
  }

  // ── action: portal ────────────────────────────────────────
  if (body.action === 'portal') {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: body.returnUrl ?? `${SUPABASE_URL}`,
    })
    return json({ url: session.url })
  }

  // ── action: checkout（預設）────────────────────────────────
  if (!body.priceId) {
    return json({ error: '缺少 priceId。' }, 400)
  }
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: body.priceId, quantity: 1 }],
    // 方便 webhook 反查係邊個 user（雙保險：customer metadata 亦有）
    client_reference_id: user.id,
    success_url: body.successUrl ?? `${SUPABASE_URL}`,
    cancel_url: body.cancelUrl ?? `${SUPABASE_URL}`,
    allow_promotion_codes: true,
  })
  return json({ url: session.url })
})
