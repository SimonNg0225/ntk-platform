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

// AI 真實成本：按 model 嘅 token 單價（USD / 1M tokens）。預設為 Gemini 2.5 公開價，
// 可由環境變數調整。成本 = in_tokens/1M × in 價 + out_tokens/1M × out 價。
const FLASH_IN = Number(Deno.env.get('GEMINI_FLASH_IN_USD_PER_M') ?? '0.30')
const FLASH_OUT = Number(Deno.env.get('GEMINI_FLASH_OUT_USD_PER_M') ?? '2.50')
const PRO_IN = Number(Deno.env.get('GEMINI_PRO_IN_USD_PER_M') ?? '1.25')
const PRO_OUT = Number(Deno.env.get('GEMINI_PRO_OUT_USD_PER_M') ?? '10.00')
function costUsd(model: string, inTok: number, outTok: number): number {
  const pro = (model ?? '').includes('pro')
  return (inTok / 1e6) * (pro ? PRO_IN : FLASH_IN) + (outTok / 1e6) * (pro ? PRO_OUT : FLASH_OUT)
}
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

  // ── 2) service_role（繞過 RLS；亦俾下面 DB 白名單查 app_admins）──
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  // admin 判斷：ADMIN_EMAILS env（bootstrap）OR app_admins 表（DB 名單，後台即時增刪、唔使重新部署）
  let allowed = !!actorEmail && ADMIN_EMAILS.includes(actorEmail)
  if (!allowed && actorEmail) {
    const { data: adminRow } = await admin
      .from('app_admins')
      .select('email')
      .eq('email', actorEmail)
      .maybeSingle()
    allowed = !!adminRow
  }
  if (!allowed) return json({ error: '只有管理員可以存取。' }, 403)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Request body 唔係有效 JSON。' }, 400)
  }
  const action = String(body.action ?? '')

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

        // AI 用量 + 真實成本（本月，由 ai_usage_stats 按 token 計，所有用戶都計）
        const { data: statRows } = await admin
          .from('ai_usage_stats')
          .select('feature, model, calls, in_tokens, out_tokens')
          .eq('ym', month)
          .limit(50000)
        let callsMonth = 0
        let transMonth = 0
        let aiCostUsd = 0
        for (const r of statRows ?? []) {
          callsMonth += r.calls ?? 0
          if (r.feature === 'transcribe') transMonth += r.calls ?? 0
          aiCostUsd += costUsd(r.model, r.in_tokens ?? 0, r.out_tokens ?? 0)
        }
        // 今日免費一般 AI 呼叫（沿用 ai_usage 額度計數，反映免費額度用量）
        const { data: genTodayRows } = await admin
          .from('ai_usage')
          .select('count')
          .like('bucket', `general:${today}`)
        const genToday = (genTodayRows ?? []).reduce((n, r) => n + (r.count ?? 0), 0)

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
            ai: { genToday, callsMonth, transMonth, costUsd: aiCostUsd },
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

      // ════════════ 用量 + AI 成本（真實 token，含 per-feature / per-user）════════════
      case 'usage': {
        const month = String((body.month as string) || ym())
        const { data: rows, error } = await admin
          .from('ai_usage_stats')
          .select('user_id, feature, model, calls, in_tokens, out_tokens')
          .eq('ym', month)
          .limit(50000)
        if (error) return json({ error: error.message }, 500)

        let calls = 0
        let inTok = 0
        let outTok = 0
        let cost = 0
        const byFeature = new Map<string, { calls: number; inTok: number; outTok: number; cost: number }>()
        const byUser = new Map<
          string,
          { calls: number; inTok: number; outTok: number; cost: number; features: Map<string, number> }
        >()

        for (const r of rows ?? []) {
          const c = costUsd(r.model, r.in_tokens ?? 0, r.out_tokens ?? 0)
          calls += r.calls ?? 0
          inTok += r.in_tokens ?? 0
          outTok += r.out_tokens ?? 0
          cost += c

          const f = byFeature.get(r.feature) ?? { calls: 0, inTok: 0, outTok: 0, cost: 0 }
          f.calls += r.calls ?? 0
          f.inTok += r.in_tokens ?? 0
          f.outTok += r.out_tokens ?? 0
          f.cost += c
          byFeature.set(r.feature, f)

          const u = byUser.get(r.user_id) ?? {
            calls: 0,
            inTok: 0,
            outTok: 0,
            cost: 0,
            features: new Map<string, number>(),
          }
          u.calls += r.calls ?? 0
          u.inTok += r.in_tokens ?? 0
          u.outTok += r.out_tokens ?? 0
          u.cost += c
          u.features.set(r.feature, (u.features.get(r.feature) ?? 0) + c)
          byUser.set(r.user_id, u)
        }

        const features = [...byFeature.entries()]
          .map(([feature, v]) => ({ feature, ...v }))
          .sort((a, b) => b.cost - a.cost)

        // Top 用戶（按成本）+ 補 email + 每位嘅功能花費分佈
        const top = [...byUser.entries()]
          .map(([user_id, v]) => ({ user_id, ...v }))
          .sort((a, b) => b.cost - a.cost)
          .slice(0, 50)
        await Promise.all(
          top.map(async (t) => {
            const { data } = await admin.auth.admin.getUserById(t.user_id)
            ;(t as unknown as { email: string | null }).email = data?.user?.email ?? null
          }),
        )

        return json({
          data: {
            month,
            totals: { calls, inTok, outTok, cost },
            pricing: { flashIn: FLASH_IN, flashOut: FLASH_OUT, proIn: PRO_IN, proOut: PRO_OUT },
            features,
            top: top.map((t) => ({
              user_id: t.user_id,
              email: (t as unknown as { email: string | null }).email ?? null,
              calls: t.calls,
              inTok: t.inTok,
              outTok: t.outTok,
              cost: t.cost,
              features: [...t.features.entries()]
                .map(([feature, c]) => ({ feature, cost: c }))
                .sort((a, b) => b.cost - a.cost),
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

      // ════════════ 管理員名單 ════════════
      // env（ADMIN_EMAILS）= bootstrap 唯讀；app_admins 表 = 後台可增刪。
      case 'admins:list': {
        const { data, error } = await admin
          .from('app_admins')
          .select('email, added_by, created_at')
          .order('created_at', { ascending: true })
        if (error) return json({ error: error.message }, 500)
        const dbList = (data ?? []).map((r) => ({
          email: r.email as string,
          source: 'db' as const,
          added_by: (r.added_by as string | null) ?? null,
          created_at: (r.created_at as string | null) ?? null,
        }))
        const dbEmails = new Set(dbList.map((a) => a.email))
        const envList = ADMIN_EMAILS.filter((e) => !dbEmails.has(e)).map((e) => ({
          email: e,
          source: 'env' as const,
          added_by: null,
          created_at: null,
        }))
        return json({ data: [...envList, ...dbList] })
      }

      case 'admins:add': {
        const email = String(body.email ?? '').trim().toLowerCase()
        if (!email || !email.includes('@')) return json({ error: '請輸入有效 email。' }, 400)
        const { error } = await admin
          .from('app_admins')
          .upsert({ email, added_by: actorEmail }, { onConflict: 'email' })
        if (error) return json({ error: error.message }, 500)
        await audit('admin-add', email)
        return json({ data: { ok: true } })
      }

      case 'admins:remove': {
        const email = String(body.email ?? '').trim().toLowerCase()
        if (!email) return json({ error: '缺少 email。' }, 400)
        // 防自鎖：唔可以移除自己（env bootstrap admin 移唔到，因為佢唔喺表入面）
        if (email === actorEmail) return json({ error: '唔可以移除自己。' }, 400)
        const { error } = await admin.from('app_admins').delete().eq('email', email)
        if (error) return json({ error: error.message }, 500)
        await audit('admin-remove', email)
        return json({ data: { ok: true } })
      }

      // ════════════ 論壇審核 ════════════
      case 'forum:reports': {
        const { data: reports } = await admin.from('forum_reports')
          .select('id, target_type, target_id, reason, status, created_at')
          .eq('status', 'open').order('created_at', { ascending: false }).limit(200)
        const threadIds = (reports ?? []).filter((r) => r.target_type === 'thread').map((r) => r.target_id)
        const postIds = (reports ?? []).filter((r) => r.target_type === 'post').map((r) => r.target_id)
        const [{ data: ths }, { data: pos }] = await Promise.all([
          threadIds.length ? admin.from('forum_threads').select('id, title, body, status, author_id').in('id', threadIds) : Promise.resolve({ data: [] as unknown[] }),
          postIds.length ? admin.from('forum_posts').select('id, body, status, author_id, thread_id').in('id', postIds) : Promise.resolve({ data: [] as unknown[] }),
        ])
        const tm = new Map((ths ?? []).map((t: Record<string, unknown>) => [t.id, t]))
        const pm = new Map((pos ?? []).map((p: Record<string, unknown>) => [p.id, p]))
        return json({ data: (reports ?? []).map((r) => ({
          ...r,
          content: r.target_type === 'thread' ? tm.get(r.target_id) ?? null : pm.get(r.target_id) ?? null,
        })) })
      }
      case 'forum:remove': {
        const type = String(body.type), id = String(body.id ?? '')
        const table = type === 'thread' ? 'forum_threads' : 'forum_posts'
        const { error } = await admin.from(table).update({ status: 'removed' }).eq('id', id)
        if (error) return json({ error: error.message }, 500)
        await admin.from('forum_reports').update({ status: 'resolved' }).eq('target_id', id)
        await audit('forum-remove', id, { type })
        return json({ data: { ok: true } })
      }
      case 'forum:thread-flag': {
        const id = String(body.id ?? '')
        const patch: Record<string, unknown> = {}
        if (typeof body.pinned === 'boolean') patch.pinned = body.pinned
        if (typeof body.featured === 'boolean') patch.featured = body.featured
        if (body.status === 'active' || body.status === 'locked') patch.status = body.status
        if (Object.keys(patch).length === 0) return json({ error: '冇嘢要改。' }, 400)
        const { error } = await admin.from('forum_threads').update(patch).eq('id', id)
        if (error) return json({ error: error.message }, 500)
        await audit('forum-flag', id, patch)
        return json({ data: { ok: true } })
      }
      case 'forum:resolve-report': {
        const id = String(body.id ?? '')
        const { error } = await admin.from('forum_reports').update({ status: 'resolved' }).eq('id', id)
        if (error) return json({ error: error.message }, 500)
        return json({ data: { ok: true } })
      }
      case 'forum:ban': {
        const userId = String(body.userId ?? ''), reason = String(body.reason ?? '')
        const { error } = await admin.from('forum_bans')
          .upsert({ user_id: userId, reason, banned_by: actorEmail }, { onConflict: 'user_id' })
        if (error) return json({ error: error.message }, 500)
        await audit('forum-ban', userId, { reason })
        return json({ data: { ok: true } })
      }
      case 'forum:unban': {
        const userId = String(body.userId ?? '')
        const { error } = await admin.from('forum_bans').delete().eq('user_id', userId)
        if (error) return json({ error: error.message }, 500)
        await audit('forum-unban', userId)
        return json({ data: { ok: true } })
      }

      // ════════════ 社群檢舉 ════════════
      case 'reports:list': {
        const { data: reports, error } = await admin
          .from('resource_reports')
          .select('id, resource_id, reporter_id, reason, detail, status, created_at')
          .eq('status', 'open')
          .order('created_at', { ascending: false })
          .limit(200)
        if (error) return json({ error: error.message }, 500)
        const ids = [...new Set((reports ?? []).map((r) => r.resource_id))]
        const resMap: Record<string, unknown> = {}
        if (ids.length) {
          const { data: res } = await admin
            .from('shared_resources')
            .select('id, title, owner_id, status, file_path')
            .in('id', ids)
          for (const x of res ?? []) resMap[x.id as string] = x
        }
        const rows = (reports ?? []).map((r) => ({ ...r, resource: resMap[r.resource_id] ?? null }))
        return json({ data: rows })
      }

      case 'reports:resolve': {
        const id = String(body.id ?? '')
        const act = String(body.resolution ?? '')
        if (!id || (act !== 'remove' && act !== 'dismiss')) {
          return json({ error: '參數不正確。' }, 400)
        }
        const { data: rep } = await admin
          .from('resource_reports')
          .select('id, resource_id')
          .eq('id', id)
          .maybeSingle()
        if (!rep) return json({ error: '搵唔到檢舉。' }, 404)

        if (act === 'dismiss') {
          await admin.from('resource_reports').update({ status: 'reviewed' }).eq('id', id)
          await audit('report-dismiss', id)
          return json({ data: { ok: true } })
        }
        // remove：下架資源 + 刪 storage 檔（public 直連都失效）+ 標 actioned
        const { data: res } = await admin
          .from('shared_resources')
          .select('id, file_path')
          .eq('id', rep.resource_id)
          .maybeSingle()
        await admin.from('shared_resources').update({ status: 'removed' }).eq('id', rep.resource_id)
        if (res?.file_path) {
          await admin.storage.from('community').remove([res.file_path as string])
        }
        // 同一資源其他 open 檢舉一齊標 actioned
        await admin.from('resource_reports').update({ status: 'actioned' }).eq('resource_id', rep.resource_id).eq('status', 'open')
        await audit('report-remove', rep.resource_id as string)
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
