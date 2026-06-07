// ============================================================
//  Edge Function: team-billing
//  ------------------------------------------------------------
//  團隊座位收費（Stripe quantity）。
//  - 先驗證呼叫者已登入，且係該 org 嘅 owner / admin。
//  - action 'checkout-seats'：開訂閱 Checkout，line item = 團隊 price，
//    quantity = 座位數；subscription metadata 帶 org_id，畀 webhook 反查。
//  - 座位數同步：由 stripe-webhook 收到 subscription 事件（metadata.org_id）
//    時更新 orgs.seats + stripe_subscription_id。
//
//  部署：
//    supabase functions deploy team-billing
//    supabase secrets set STRIPE_SECRET_KEY=sk_... STRIPE_TEAM_PRICE_ID=price_...
// ============================================================

import Stripe from 'https://esm.sh/stripe@17.5.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? ''
const STRIPE_TEAM_PRICE_ID = Deno.env.get('STRIPE_TEAM_PRICE_ID') ?? ''
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
  if (!STRIPE_SECRET_KEY || !STRIPE_TEAM_PRICE_ID) {
    return json({ error: '伺服器未設定 STRIPE_SECRET_KEY / STRIPE_TEAM_PRICE_ID。' }, 500)
  }

  const authHeader = req.headers.get('Authorization') ?? ''
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser()
  if (authError || !user) return json({ error: '請先登入。' }, 401)

  let body: {
    action?: string
    orgId?: string
    seats?: number
    successUrl?: string
    cancelUrl?: string
  }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Request body 唔係有效 JSON。' }, 400)
  }
  if (!body.orgId) return json({ error: '缺少 orgId。' }, 400)

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  // 驗證：呼叫者係該 org 嘅 owner / admin
  const { data: membership } = await admin
    .from('org_members')
    .select('role')
    .eq('org_id', body.orgId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!membership || !['owner', 'admin'].includes(membership.role as string)) {
    return json({ error: '只有團隊擁有者 / 管理員可以操作。' }, 403)
  }

  const seats = Math.max(1, Math.floor(Number(body.seats ?? 1)))

  // checkout-seats
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer_email: user.email ?? undefined,
    line_items: [{ price: STRIPE_TEAM_PRICE_ID, quantity: seats }],
    client_reference_id: body.orgId,
    subscription_data: { metadata: { org_id: body.orgId } },
    metadata: { org_id: body.orgId },
    success_url: body.successUrl ?? `${SUPABASE_URL}`,
    cancel_url: body.cancelUrl ?? `${SUPABASE_URL}`,
    allow_promotion_codes: true,
  })
  return json({ url: session.url })
})
