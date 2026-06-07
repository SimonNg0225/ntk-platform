// ============================================================
//  Edge Function: stripe-webhook
//  ------------------------------------------------------------
//  Stripe → 我哋嘅唯一「訂閱真相來源」。
//  - verify_jwt = false（Stripe 唔會帶 Supabase JWT），改用 Stripe
//    簽名 (Stripe-Signature) 驗證，secret = STRIPE_WEBHOOK_SECRET。
//  - 用 service_role 寫 subscriptions（繞過 RLS）。
//  - billing_events 做冪等：同一 event id 處理過就跳過。
//
//  處理事件：
//    checkout.session.completed       → 啟用訂閱
//    customer.subscription.updated    → 更新狀態 / 週期
//    customer.subscription.deleted    → 降級返 free
//
//  部署：
//    supabase functions deploy stripe-webhook --no-verify-jwt
//    supabase secrets set STRIPE_SECRET_KEY=sk_... STRIPE_WEBHOOK_SECRET=whsec_...
//  詳見 docs/COMMERCIALIZATION.md
// ============================================================

import Stripe from 'https://esm.sh/stripe@17.5.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  sendEmail,
  alertAdmin,
  welcomeProEmail,
  canceledEmail,
} from '../_shared/email.ts'

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? ''
const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  httpClient: Stripe.createFetchHttpClient(),
  apiVersion: '2024-12-18.acacia',
})
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

// 由 Stripe subscription 狀態推導我哋嘅 plan
function planFromStatus(status: string): 'free' | 'pro' {
  return status === 'active' || status === 'trialing' ? 'pro' : 'free'
}

async function upsertByCustomer(
  customerId: string,
  fields: Record<string, unknown>,
): Promise<void> {
  await admin
    .from('subscriptions')
    .update(fields)
    .eq('stripe_customer_id', customerId)
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }
  if (!STRIPE_WEBHOOK_SECRET) {
    return new Response('未設定 STRIPE_WEBHOOK_SECRET', { status: 500 })
  }

  const signature = req.headers.get('Stripe-Signature') ?? ''
  const raw = await req.text()

  // ── 驗證 Stripe 簽名（Deno 要用 async 版）──────────────────
  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(
      raw,
      signature,
      STRIPE_WEBHOOK_SECRET,
    )
  } catch (err) {
    return new Response(`Webhook 簽名驗證失敗: ${(err as Error).message}`, {
      status: 400,
    })
  }

  // ── 冪等：見過嘅 event 直接跳過 ───────────────────────────
  const { error: dupErr } = await admin
    .from('billing_events')
    .insert({ id: event.id, type: event.type })
  if (dupErr) {
    // PK 衝突 = 重送，已處理過
    return new Response(JSON.stringify({ received: true, duplicate: true }), {
      status: 200,
    })
  }

  // ── 處理事件（失敗 → 回滾冪等記錄 + 告警 + 500 等 Stripe 重送）──
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const customerId = String(session.customer)
        const subscriptionId = session.subscription
          ? String(session.subscription)
          : null
        let periodEnd: string | null = null
        let status = 'active'
        if (subscriptionId) {
          const subscription =
            await stripe.subscriptions.retrieve(subscriptionId)
          status = subscription.status
          periodEnd = new Date(
            subscription.current_period_end * 1000,
          ).toISOString()
        }
        await upsertByCustomer(customerId, {
          stripe_subscription_id: subscriptionId,
          status,
          plan: planFromStatus(status),
          current_period_end: periodEnd,
        })
        // 交易 email：歡迎升級（收件人 = checkout 填嘅 email）
        const email = session.customer_details?.email
        if (email && planFromStatus(status) === 'pro') {
          const m = welcomeProEmail()
          await sendEmail({ to: email, subject: m.subject, html: m.html })
        }
        break
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = String(subscription.customer)
        const deleted = event.type === 'customer.subscription.deleted'
        const status = deleted ? 'canceled' : subscription.status
        await upsertByCustomer(customerId, {
          stripe_subscription_id: subscription.id,
          status,
          plan: planFromStatus(status),
          current_period_end: new Date(
            subscription.current_period_end * 1000,
          ).toISOString(),
        })
        // 交易 email：取消通知
        if (deleted) {
          const customer = await stripe.customers.retrieve(customerId)
          const email =
            !('deleted' in customer) && customer.email ? customer.email : null
          if (email) {
            const m = canceledEmail()
            await sendEmail({ to: email, subject: m.subject, html: m.html })
          }
        }
        break
      }
      default:
        // 其他事件唔處理
        break
    }
  } catch (e) {
    // 刪走冪等記錄令 Stripe 重送時可重試；同時告警 admin。
    await admin.from('billing_events').delete().eq('id', event.id)
    await alertAdmin(
      'Stripe webhook 處理失敗',
      `event.type=${event.type}\nevent.id=${event.id}\n${String(e)}`,
    )
    return new Response(JSON.stringify({ error: 'handler_failed' }), {
      status: 500,
    })
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 })
})
