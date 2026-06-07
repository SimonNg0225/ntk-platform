// ============================================================
//  Edge Function: support
//  ------------------------------------------------------------
//  in-app 客服表單後台：驗證登入 → 存 support_tickets（service_role）
//  → email 通知客服（Resend，reply-to = 用戶 email，方便直接回覆）。
//
//  部署：
//    supabase functions deploy support
//    supabase secrets set RESEND_API_KEY=re_... SUPPORT_EMAIL=help@yourdomain
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmail, supportTicketEmail, SUPPORT_EMAIL } from '../_shared/email.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

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

  // ── 驗證登入 ──
  const authHeader = req.headers.get('Authorization') ?? ''
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser()
  if (authError || !user) return json({ error: '請先登入先可以聯絡客服。' }, 401)

  let body: { subject?: string; message?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Request body 唔係有效 JSON。' }, 400)
  }
  const subject = (body.subject ?? '').toString().trim().slice(0, 200)
  const message = (body.message ?? '').toString().trim().slice(0, 5000)
  if (!subject || !message) {
    return json({ error: '請填寫主題同內容。' }, 400)
  }

  // ── 存 ticket（service_role）──
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
  const { error: insErr } = await admin.from('support_tickets').insert({
    user_id: user.id,
    email: user.email ?? null,
    subject,
    message,
  })
  if (insErr) {
    return json({ error: '提交失敗，請稍後再試。' }, 500)
  }

  // ── email 通知客服（未設 Resend / SUPPORT_EMAIL 就靜靜跳過，ticket 已存）──
  if (SUPPORT_EMAIL) {
    const m = supportTicketEmail({
      subject,
      message,
      fromEmail: user.email ?? '',
      userId: user.id,
    })
    await sendEmail({
      to: SUPPORT_EMAIL,
      subject: m.subject,
      html: m.html,
      replyTo: user.email ?? undefined,
    })
  }

  return json({ ok: true })
})
