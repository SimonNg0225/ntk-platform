// ============================================================
//  Edge Function: admin（EziTeach 後台管理系統）
//  ------------------------------------------------------------
//  一條 Edge Function 服務四大後台模組：
//    1) 用戶 + 訂閱  （overview / users / set-plan）
//    2) 用量 + AI 成本（usage）
//    3) 學校 B2B     （orgs）
//    4) 內容 + 支援  （announcements:* / tickets:*）
//
//  安全：驗證登入 + email 喺 ADMIN_EMAILS 白名單先放行；
//        之後一律用 service_role（繞過 RLS）讀寫，敏感操作寫 admin_audit。
//        service_role key 只存喺呢個 Edge Function，前端永遠攞唔到。
//
//  部署：
//    supabase functions deploy admin
//    supabase secrets set ADMIN_EMAILS=you@example.com
//    （選用）supabase secrets set AI_COST_PER_CALL_USD=0.002 \
//                                 AI_COST_PER_TRANSCRIBE_USD=0.02 \
//                                 PRO_PRICE_HKD=48
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const ADMIN_EMAILS = (Deno.env.get('ADMIN_EMAILS') ?? '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean)

// AI 成本估算單價（USD / 次）。Gemini 無逐次回 token，故以「每次呼叫」估，標明為估算。
const COST_PER_CALL = Number(Deno.env.get('AI_COST_PER_CALL_USD') ?? '0.002')
const COST_PER_TRANSCRIBE = Number(Deno.env.get('AI_COST_PER_TRANSCRIBE_USD') ?? '0.02')
// Pro 月費（HKD）—— 估 MRR 用。
const PRO_PRICE_HKD = Number(Deno.env.get('PRO_PRICE_HKD') ?? '48')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// 日期工具（UTC；同 gemini Edge Function 嘅 bucket 命名一致）
function ymd(d = new Date()): string {
  return d.toISOString().slice(0, 10) // 2026-06-12
}
function ym(d = new Date()): string {
  return d.toISOString().slice(0, 7) // 2026-06
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  // ── 1) 驗證登入 + admin 白名單 ──
  const authHeader = req.headers.get('Authorization') ?? ''
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser()
  if (authError || !user) return json({ error: '請先登入。' }, 401)

  const actorEmail = (user.email ?? '').toLowerCase()
  if (!actorEmail || !ADMIN_EMAILS.includes(actorEmail)) {
    return json({ error: '只有管理員可以存取。' }, 403)
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Request body 唔係有效 JSON。' }, 400)
  }
  const action = String(body.action ?? '')

  // ── 2) service_role（繞過 RLS）──
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  const audit = (a: string, target: string | null, meta?: unknown) =>
    admin
      .from('admin_audit')
      .insert({ actor_email: actorEmail, action: a, target, meta: meta ?? null })
      .then(() => {}, () => {}) // best-effort，唔阻主流程

  try {
    switch (action) {
      // ════════════ 概覽 KPI ════════════
      case 'overview': {
        const today = ymd()
        const month = ym()

        const [subsRes, orgsRes, membersRes, ticketsRes, annRes] = await Promise.all([
          admin.from('subscriptions').select('plan, status'),
          admin.from('orgs').select('seats'),
          admin.from('org_members').select('org_id'),
          admin.from('support_tickets').select('status'),
          admin.from('announcements').select('id, active'),
        ])

        const subs = subsRes.data ?? []
        const activePro = subs.filter(
          (s) => s.plan === 'pro' && ['active', 'trialing'].includes(s.status),
        ).length
        const pro = subs.filter((s) => s.plan === 'pro').length

        // AI 用量（按 bucket 前綴聚合）
        const [genTodayRes, genMonthRes, transMonthRes] = await Promise.all([
          admin.from('ai_usage').select('count').like('bucket', `general:${today}`),
          admin.from('ai_usage').select('count').like('bucket', `general:${month}-%`),
          admin.from('ai_usage').select('count').like('bucket', `transcribe:${month}`),
        ])
        const sum = (rows: { count: number }[] | null) =>
          (rows ?? []).reduce((n, r) => n + (r.count ?? 0), 0)
        const genToday = sum(genTodayRes.data)
        const genMonth = sum(genMonthRes.data)
        const transMonth = sum(transMonthRes.data)
        const estCostUsd = genMonth * COST_PER_CALL + transMonth * COST_PER_TRANSCRIBE

        // 用戶總數（auth.users）
        let totalUsers = 0
        const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 })
        // supabase-js 唔回 total；用 count 方式：改數 subscriptions 行做近似，
        // 但 subscriptions 只有付費流程行先有。故用 listUsers 全量分頁數（上限保護）。
        totalUsers = await countAuthUsers(admin)
        void list

        const tickets = ticketsRes.data ?? []
        return json({
          data: {
            users: { total: totalUsers },
            subs: {
              pro,
              activePro,
              free: Math.max(totalUsers - pro, 0),
              mrrHkd: activePro * PRO_PRICE_HKD,
            },
            ai: { genToday, genMonth, transMonth, estCostUsd },
            orgs: {
              count: (orgsRes.data ?? []).length,
              seats: (orgsRes.data ?? []).reduce((n, o) => n + (o.seats ?? 0), 0),
              members: (membersRes.data ?? []).length,
            },
            tickets: {
              open: tickets.filter((t) => t.status !== 'closed').length,
              total: tickets.length,
            },
            announcements: { active: (annRes.data ?? []).filter((a) => a.active).length },
          },
        })
      }

      // ════════════ 用戶 + 訂閱 ════════════
      case 'users': {
        const q = String(body.q ?? '').trim().toLowerCase()
        const page = Math.max(1, Number(body.page ?? 1))
        const perPage = 50
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
        if (error) return json({ error: error.message }, 500)
        let users = (data?.users ?? []).map((u) => ({
          id: u.id,
          email: u.email ?? null,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at ?? null,
        }))
        if (q) users = users.filter((u) => (u.email ?? '').toLowerCase().includes(q))

        // 併入訂閱狀態
        const ids = users.map((u) => u.id)
        const subMap = new Map<string, { plan: string; status: string; current_period_end: string | null }>()
        if (ids.length) {
          const { data: subs } = await admin
            .from('subscriptions')
            .select('user_id, plan, status, current_period_end')
            .in('user_id', ids)
          for (const s of subs ?? [])
            subMap.set(s.user_id, {
              plan: s.plan,
              status: s.status,
              current_period_end: s.current_period_end,
            })
        }
        const merged = users.map((u) => ({
          ...u,
          plan: subMap.get(u.id)?.plan ?? 'free',
          status: subMap.get(u.id)?.status ?? 'inactive',
          current_period_end: subMap.get(u.id)?.current_period_end ?? null,
        }))
        return json({ data: { users: merged, page, hasMore: (data?.users ?? []).length === perPage } })
      }

      case 'set-plan': {
        const userId = String(body.userId ?? '')
        const plan = String(body.plan ?? '')
        const status = String(body.status ?? '')
        if (!userId || !['free', 'pro'].includes(plan)) {
          return json({ error: '參數不正確。' }, 400)
        }
        const { error } = await admin.from('subscriptions').upsert(
          {
            user_id: userId,
            plan,
            status: status || (plan === 'pro' ? 'active' : 'inactive'),
          },
          { onConflict: 'user_id' },
        )
        if (error) return json({ error: error.message }, 500)
        await audit('set-plan', userId, { plan, status })
        return json({ data: { ok: true } })
      }

      // ════════════ 用量 + AI 成本 ════════════
      case 'usage': {
        const month = ym()
        const { data: rows, error } = await admin
          .from('ai_usage')
          .select('user_id, bucket, count')
          .or(`bucket.like.general:${month}-%,bucket.like.transcribe:${month}`)
          .limit(20000)
        if (error) return json({ error: error.message }, 500)

        let genMonth = 0
        let transMonth = 0
        const perUser = new Map<string, { general: number; transcribe: number }>()
        for (const r of rows ?? []) {
          const isTrans = r.bucket.startsWith('transcribe:')
          if (isTrans) transMonth += r.count
          else genMonth += r.count
          const cur = perUser.get(r.user_id) ?? { general: 0, transcribe: 0 }
          if (isTrans) cur.transcribe += r.count
          else cur.general += r.count
          perUser.set(r.user_id, cur)
        }

        // Top 用戶（按總呼叫）+ 補 email
        const top = [...perUser.entries()]
          .map(([user_id, v]) => ({ user_id, ...v, total: v.general + v.transcribe }))
          .sort((a, b) => b.total - a.total)
          .slice(0, 20)
        const emailMap = new Map<string, string | null>()
        await Promise.all(
          top.map(async (t) => {
            const { data } = await admin.auth.admin.getUserById(t.user_id)
            emailMap.set(t.user_id, data?.user?.email ?? null)
          }),
        )

        return json({
          data: {
            month,
            genMonth,
            transMonth,
            costPerCall: COST_PER_CALL,
            costPerTranscribe: COST_PER_TRANSCRIBE,
            estCostUsd: genMonth * COST_PER_CALL + transMonth * COST_PER_TRANSCRIBE,
            top: top.map((t) => ({
              ...t,
              email: emailMap.get(t.user_id) ?? null,
              estCostUsd: t.general * COST_PER_CALL + t.transcribe * COST_PER_TRANSCRIBE,
            })),
          },
        })
      }

      // ════════════ 學校 B2B ════════════
      case 'orgs': {
        const { data: orgs, error } = await admin
          .from('orgs')
          .select('id, name, owner_id, seats, stripe_subscription_id, created_at')
          .order('created_at', { ascending: false })
          .limit(500)
        if (error) return json({ error: error.message }, 500)

        const { data: members } = await admin.from('org_members').select('org_id')
        const memberCount = new Map<string, number>()
        for (const m of members ?? [])
          memberCount.set(m.org_id, (memberCount.get(m.org_id) ?? 0) + 1)

        const ownerIds = [...new Set((orgs ?? []).map((o) => o.owner_id))]
        const ownerEmail = new Map<string, string | null>()
        await Promise.all(
          ownerIds.map(async (id) => {
            const { data } = await admin.auth.admin.getUserById(id)
            ownerEmail.set(id, data?.user?.email ?? null)
          }),
        )

        return json({
          data: (orgs ?? []).map((o) => ({
            id: o.id,
            name: o.name,
            seats: o.seats,
            members: memberCount.get(o.id) ?? 0,
            owner_email: ownerEmail.get(o.owner_id) ?? null,
            paid: !!o.stripe_subscription_id,
            created_at: o.created_at,
          })),
        })
      }

      // ════════════ 內容：公告 ════════════
      case 'announcements:list': {
        const { data, error } = await admin
          .from('announcements')
          .select('id, title, body, level, active, starts_at, ends_at, created_by, created_at')
          .order('created_at', { ascending: false })
          .limit(200)
        if (error) return json({ error: error.message }, 500)
        return json({ data })
      }

      case 'announcements:save': {
        const a = (body.announcement ?? {}) as Record<string, unknown>
        const title = String(a.title ?? '').trim()
        if (!title) return json({ error: '標題不可為空。' }, 400)
        const level = ['info', 'warning', 'success'].includes(String(a.level))
          ? String(a.level)
          : 'info'
        const row = {
          title,
          body: String(a.body ?? ''),
          level,
          active: a.active !== false,
          starts_at: a.starts_at ? String(a.starts_at) : null,
          ends_at: a.ends_at ? String(a.ends_at) : null,
          created_by: actorEmail,
        }
        if (a.id) {
          const { error } = await admin.from('announcements').update(row).eq('id', String(a.id))
          if (error) return json({ error: error.message }, 500)
          await audit('announce-update', String(a.id), { title })
        } else {
          const { error } = await admin.from('announcements').insert(row)
          if (error) return json({ error: error.message }, 500)
          await audit('announce-create', null, { title })
        }
        return json({ data: { ok: true } })
      }

      case 'announcements:delete': {
        const id = String(body.id ?? '')
        if (!id) return json({ error: '缺少 id。' }, 400)
        const { error } = await admin.from('announcements').delete().eq('id', id)
        if (error) return json({ error: error.message }, 500)
        await audit('announce-delete', id)
        return json({ data: { ok: true } })
      }

      // ════════════ 支援：客服 ════════════
      case 'tickets:list': {
        const { data, error } = await admin
          .from('support_tickets')
          .select('id, subject, message, status, email, created_at')
          .order('created_at', { ascending: false })
          .limit(200)
        if (error) return json({ error: error.message }, 500)
        return json({ data })
      }

      case 'tickets:set-status': {
        const id = String(body.id ?? '')
        const status = String(body.status ?? '')
        if (!id || !['open', 'closed'].includes(status)) {
          return json({ error: '參數不正確。' }, 400)
        }
        const { error } = await admin
          .from('support_tickets')
          .update({ status })
          .eq('id', id)
        if (error) return json({ error: error.message }, 500)
        await audit('ticket-status', id, { status })
        return json({ data: { ok: true } })
      }

      default:
        return json({ error: `未知 action：${action}` }, 400)
    }
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : '伺服器錯誤。' }, 500)
  }
})

// auth.users 全量分頁數（上限保護，避免極端情況拖死）。
async function countAuthUsers(
  admin: ReturnType<typeof createClient>,
): Promise<number> {
  let total = 0
  const perPage = 1000
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) break
    const n = data?.users?.length ?? 0
    total += n
    if (n < perPage) break
  }
  return total
}
