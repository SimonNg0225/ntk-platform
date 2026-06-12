// ============================================================
//  Edge Function: forum —— 論壇寫入把關
//  驗登入 → 查封禁 → rate-limit → 內容驗證 → service_role 寫入。
//  actions: create-thread / create-post / edit-own / delete-own / report / set-profile
//  部署：supabase functions deploy forum
// ============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const EDIT_WINDOW_MS = 30 * 60 * 1000        // 發出後 30 分鐘可改
const NEW_ACCOUNT_MS = 10 * 60 * 1000        // account <10 分鐘唔可發帖

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
function json(o: unknown, s = 200) {
  return new Response(JSON.stringify(o), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })
}
function countLinks(s: string): number { return (s.match(/https?:\/\//gi) ?? []).length }
function clean(s: unknown): string { return typeof s === 'string' ? s.trim() : '' }

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const auth = req.headers.get('Authorization') ?? ''
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: auth } } })
  const { data: { user }, error: authErr } = await userClient.auth.getUser()
  if (authErr || !user) return json({ error: '請先登入。' }, 401)

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json({ error: 'Bad JSON' }, 400) }
  const action = String(body.action ?? '')
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  // 封禁
  const { data: ban } = await admin.from('forum_bans').select('user_id').eq('user_id', user.id).maybeSingle()
  if (ban) return json({ error: '你已被禁止喺討論區發言。' }, 403)

  // rate-limit：數最近 60 秒自己嘅內容
  async function tooMany(table: string, col: string, limit: number): Promise<boolean> {
    const since = new Date(Date.now() - 60_000).toISOString()
    const { count } = await admin.from(table).select('id', { count: 'exact', head: true })
      .eq(col, user!.id).gte('created_at', since)
    return (count ?? 0) >= limit
  }

  try {
    if (action === 'create-thread') {
      if (Date.now() - new Date(user.created_at).getTime() < NEW_ACCOUNT_MS)
        return json({ error: '新帳戶請稍候再發帖。' }, 429)
      if (await tooMany('forum_threads', 'author_id', 3)) return json({ error: '發帖太快，唞一唞。' }, 429)
      const title = clean(body.title), bodyTxt = clean(body.body)
      const board_id = clean(body.board_id)
      const tags = Array.isArray(body.tags) ? body.tags.map(clean).filter(Boolean).slice(0, 5) : []
      if (!board_id) return json({ error: '缺少版區。' }, 400)
      if (title.length < 1 || title.length > 120) return json({ error: '標題需 1–120 字。' }, 400)
      if (bodyTxt.length < 1 || bodyTxt.length > 5000) return json({ error: '內文需 1–5000 字。' }, 400)
      if (countLinks(bodyTxt) > 5) return json({ error: '連結太多。' }, 400)
      const { data, error } = await admin.from('forum_threads')
        .insert({ board_id, author_id: user.id, title, body: bodyTxt, tags })
        .select('id').single()
      if (error) return json({ error: error.message }, 500)
      return json({ data: { id: data.id } })
    }

    if (action === 'create-post') {
      if (await tooMany('forum_posts', 'author_id', 10)) return json({ error: '回覆太快，唞一唞。' }, 429)
      const thread_id = clean(body.thread_id), bodyTxt = clean(body.body)
      if (!thread_id) return json({ error: '缺少主題。' }, 400)
      if (bodyTxt.length < 1 || bodyTxt.length > 5000) return json({ error: '回覆需 1–5000 字。' }, 400)
      if (countLinks(bodyTxt) > 5) return json({ error: '連結太多。' }, 400)
      const { data: th } = await admin.from('forum_threads').select('status').eq('id', thread_id).maybeSingle()
      if (!th || th.status !== 'active') return json({ error: '此主題唔接受回覆。' }, 400)
      const { data, error } = await admin.from('forum_posts')
        .insert({ thread_id, author_id: user.id, body: bodyTxt }).select('id').single()
      if (error) return json({ error: error.message }, 500)
      return json({ data: { id: data.id } })
    }

    if (action === 'edit-own') {
      const type = String(body.type), id = clean(body.id), bodyTxt = clean(body.body)
      const table = type === 'thread' ? 'forum_threads' : 'forum_posts'
      const { data: row } = await admin.from(table).select('author_id, created_at, status').eq('id', id).maybeSingle()
      if (!row || row.author_id !== user.id) return json({ error: '只可編輯自己嘅內容。' }, 403)
      if (row.status === 'removed') return json({ error: '內容已刪除。' }, 400)
      if (Date.now() - new Date(row.created_at).getTime() > EDIT_WINDOW_MS) return json({ error: '已過編輯時限（30 分鐘）。' }, 400)
      if (bodyTxt.length < 1 || bodyTxt.length > 5000) return json({ error: '內文需 1–5000 字。' }, 400)
      const patch: Record<string, unknown> = { body: bodyTxt, updated_at: new Date().toISOString() }
      if (type === 'thread' && typeof body.title === 'string') {
        const title = clean(body.title)
        if (title.length < 1 || title.length > 120) return json({ error: '標題需 1–120 字。' }, 400)
        patch.title = title
      }
      const { error } = await admin.from(table).update(patch).eq('id', id)
      if (error) return json({ error: error.message }, 500)
      return json({ data: { ok: true } })
    }

    if (action === 'delete-own') {
      const type = String(body.type), id = clean(body.id)
      const table = type === 'thread' ? 'forum_threads' : 'forum_posts'
      const { data: row } = await admin.from(table).select('author_id').eq('id', id).maybeSingle()
      if (!row || row.author_id !== user.id) return json({ error: '只可刪除自己嘅內容。' }, 403)
      const { error } = await admin.from(table).update({ status: 'removed' }).eq('id', id)
      if (error) return json({ error: error.message }, 500)
      return json({ data: { ok: true } })
    }

    if (action === 'report') {
      if (await tooMany('forum_reports', 'reporter_id', 20)) return json({ error: '檢舉太頻密。' }, 429)
      const target_type = String(body.target_type), target_id = clean(body.target_id), reason = clean(body.reason).slice(0, 500)
      if (!['thread', 'post'].includes(target_type) || !target_id) return json({ error: '參數不正確。' }, 400)
      const { error } = await admin.from('forum_reports')
        .insert({ reporter_id: user.id, target_type, target_id, reason })
      if (error) return json({ error: error.message }, 500)
      return json({ data: { ok: true } })
    }

    if (action === 'set-profile') {
      const display_name = clean(body.display_name)
      if (display_name.length < 1 || display_name.length > 40) return json({ error: '顯示名需 1–40 字。' }, 400)
      const school = clean(body.school).slice(0, 60) || null
      const subjects = Array.isArray(body.subjects) ? body.subjects.map(clean).filter(Boolean).slice(0, 8) : []
      const { error } = await admin.from('forum_profiles')
        .upsert({ user_id: user.id, display_name, school, subjects, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
      if (error) return json({ error: error.message }, 500)
      return json({ data: { ok: true } })
    }

    return json({ error: `未知 action：${action}` }, 400)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : '伺服器錯誤。' }, 500)
  }
})
