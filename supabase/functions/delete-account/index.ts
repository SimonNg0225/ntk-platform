// ============================================================
//  Edge Function: delete-account
//  ------------------------------------------------------------
//  用戶自助刪除帳戶（PDPO「刪除權」）：驗證登入 → 用 service_role
//  刪晒呢個 user 喺 app_rows 嘅所有雲端資料 + 刪 auth 用戶本身
//  （連 email 等身份）。不可逆；前端會先 confirm。
//
//  部署（用返現有 service_role secret，毋須額外設定）：
//    supabase functions deploy delete-account
//
//  ⚠️ 其他以 user_id 連住嘅表（forum / community / support_tickets /
//     team 等）：若 schema 已設 ON DELETE CASCADE 連去 auth.users，
//     刪 auth 用戶時會自動清；若無，請喺下面 service_role 段補刪。
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

  // ── 驗證登入（攞返 caller 自己嘅 user id）──
  const authHeader = req.headers.get('Authorization') ?? ''
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser()
  if (authError || !user) return json({ error: '請先登入。' }, 401)

  // ── service_role：刪晒用戶資料 + auth 帳戶（不可逆）──
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  // 1) 雲端同步資料（所有 collection）
  const { error: rowsErr } = await admin
    .from('app_rows')
    .delete()
    .eq('user_id', user.id)
  if (rowsErr) return json({ error: `刪除資料失敗：${rowsErr.message}` }, 500)

  // 2) auth 用戶本身（連 email / 身份）—— 若其他表設 cascade 會一拼清走
  const { error: delErr } = await admin.auth.admin.deleteUser(user.id)
  if (delErr) return json({ error: `刪除帳戶失敗：${delErr.message}` }, 500)

  return json({ ok: true })
})
