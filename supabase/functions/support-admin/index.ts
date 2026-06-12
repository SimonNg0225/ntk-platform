// ============================================================
//  Edge Function: support-admin
//  ------------------------------------------------------------
//  客服收件箱（管理員）。驗證登入 + email 喺 ADMIN_EMAILS 白名單，
//  先可以列出 / 更新全部 support_tickets（service_role 繞過 RLS）。
//
//  部署：
//    supabase functions deploy support-admin
//    supabase secrets set ADMIN_EMAILS=you@example.com,colleague@example.com
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const ADMIN_EMAILS = (Deno.env.get('ADMIN_EMAILS') ?? '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean)

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

  const authHeader = req.headers.get('Authorization') ?? ''
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser()
  if (authError || !user) return json({ error: '請先登入。' }, 401)

  const email = (user.email ?? '').toLowerCase()
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  // admin 判斷：ADMIN_EMAILS env（bootstrap）OR app_admins 表（DB 名單，後台即時增刪）
  let allowed = !!email && ADMIN_EMAILS.includes(email)
  if (!allowed && email) {
    const { data: adminRow } = await admin
      .from('app_admins')
      .select('email')
      .eq('email', email)
      .maybeSingle()
    allowed = !!adminRow
  }
  if (!allowed) return json({ error: '只有管理員可以存取。' }, 403)

  let body: { action?: string; id?: string; status?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Request body 唔係有效 JSON。' }, 400)
  }

  if (body.action === 'list') {
    const { data, error } = await admin
      .from('support_tickets')
      .select('id, subject, message, status, email, created_at')
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) return json({ error: error.message }, 500)
    return json({ data })
  }

  if (body.action === 'set-status') {
    if (!body.id || (body.status !== 'open' && body.status !== 'closed')) {
      return json({ error: '參數不正確。' }, 400)
    }
    const { error } = await admin
      .from('support_tickets')
      .update({ status: body.status })
      .eq('id', body.id)
    if (error) return json({ error: error.message }, 500)
    return json({ data: { ok: true } })
  }

  return json({ error: '未知 action。' }, 400)
})
