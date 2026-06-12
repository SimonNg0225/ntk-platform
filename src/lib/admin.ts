import { supabase } from './supabase'
import { isAdminEmail } from './support'

// ============================================================
//  後台管理 client（EziTeach Admin）
//  ------------------------------------------------------------
//  全部經 `admin` Edge Function（service_role 喺後端，前端攞唔到）。
//  前端 isAdminEmail() 只係 UI gate；真正權限由 Edge Function 用
//  ADMIN_EMAILS 白名單驗。
// ============================================================

export { isAdminEmail }

/**
 * DB-aware 管理員判斷：env 白名單（即時、bootstrap）OR app_admins 表（查 DB）。
 * RLS 只准讀「自己嗰行」，所以非管理員查自己嘅 email 會回 0 行 = 唔係 admin。
 */
export async function checkIsAdmin(email: string | null | undefined): Promise<boolean> {
  if (!email) return false
  if (isAdminEmail(email)) return true
  if (!supabase) return false
  const { data } = await supabase
    .from('app_admins')
    .select('email')
    .eq('email', email.toLowerCase())
    .maybeSingle()
  return !!data
}

async function callAdmin<T>(action: string, body: Record<string, unknown> = {}): Promise<T> {
  if (!supabase) throw new Error('未接 Supabase。')
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new Error('請先登入。')
  const base = (import.meta.env.VITE_SUPABASE_URL as string).replace(/\/$/, '')
  const res = await fetch(`${base}/functions/v1/admin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
    },
    body: JSON.stringify({ action, ...body }),
  })
  const data = (await res.json().catch(() => null)) as { data?: T; error?: string } | null
  if (!res.ok || !data) throw new Error(data?.error ?? '操作失敗。')
  return data.data as T
}

// ── 型別 ──────────────────────────────────────────────────
export interface AdminOverview {
  users: { total: number }
  subs: { pro: number; activePro: number; free: number; mrrHkd: number }
  ai: { genToday: number; callsMonth: number; transMonth: number; costUsd: number }
  orgs: { count: number; seats: number; members: number }
  tickets: { open: number; total: number }
  announcements: { active: number }
}

export interface AdminUser {
  id: string
  email: string | null
  created_at: string
  last_sign_in_at: string | null
  plan: string
  status: string
  current_period_end: string | null
}

export interface UsageFeature {
  feature: string
  calls: number
  inTok: number
  outTok: number
  cost: number
}

export interface AdminUsage {
  month: string
  totals: { calls: number; inTok: number; outTok: number; cost: number }
  pricing: { flashIn: number; flashOut: number; proIn: number; proOut: number }
  features: UsageFeature[]
  top: {
    user_id: string
    email: string | null
    calls: number
    inTok: number
    outTok: number
    cost: number
    features: { feature: string; cost: number }[]
  }[]
}

export interface AdminOrg {
  id: string
  name: string
  seats: number
  members: number
  owner_email: string | null
  paid: boolean
  created_at: string
}

export interface Announcement {
  id: string
  title: string
  body: string
  level: 'info' | 'warning' | 'success'
  active: boolean
  starts_at: string | null
  ends_at: string | null
  created_by: string | null
  created_at: string
}

export interface AdminTicket {
  id: string
  subject: string
  message: string
  status: string
  email: string | null
  created_at: string
}

export interface AdminEntry {
  email: string
  /** 'env' = ADMIN_EMAILS 環境變數（bootstrap，唯讀）；'db' = app_admins 表（可移除） */
  source: 'env' | 'db'
  added_by: string | null
  created_at: string | null
}

// ── API ───────────────────────────────────────────────────
export const adminOverview = () => callAdmin<AdminOverview>('overview')

export const adminListUsers = (q = '', page = 1) =>
  callAdmin<{ users: AdminUser[]; page: number; hasMore: boolean }>('users', { q, page })

export const adminSetPlan = (userId: string, plan: 'free' | 'pro', status = '') =>
  callAdmin<{ ok: true }>('set-plan', { userId, plan, status })

export const adminUsage = (month?: string) =>
  callAdmin<AdminUsage>('usage', month ? { month } : {})

export const adminListOrgs = () => callAdmin<AdminOrg[]>('orgs')

export const adminListAnnouncements = () =>
  callAdmin<Announcement[]>('announcements:list')

export const adminSaveAnnouncement = (a: Partial<Announcement>) =>
  callAdmin<{ ok: true }>('announcements:save', { announcement: a })

export const adminDeleteAnnouncement = (id: string) =>
  callAdmin<{ ok: true }>('announcements:delete', { id })

export const adminListTickets = () => callAdmin<AdminTicket[]>('tickets:list')

export const adminSetTicketStatus = (id: string, status: 'open' | 'closed') =>
  callAdmin<{ ok: true }>('tickets:set-status', { id, status })

// ── 管理員名單（DB 管理）─────────────────────────────────────
export const adminListAdmins = () => callAdmin<AdminEntry[]>('admins:list')

export const adminAddAdmin = (email: string) =>
  callAdmin<{ ok: true }>('admins:add', { email })

export const adminRemoveAdmin = (email: string) =>
  callAdmin<{ ok: true }>('admins:remove', { email })

// ── 論壇審核 ──
export interface ForumReport {
  id: string
  target_type: 'thread' | 'post'
  target_id: string
  reason: string
  status: string
  created_at: string
  content: { title?: string; body?: string; status?: string; author_id?: string } | null
}
export const adminForumReports = () => callAdmin<ForumReport[]>('forum:reports')
export const adminForumRemove = (type: 'thread' | 'post', id: string) =>
  callAdmin<{ ok: true }>('forum:remove', { type, id })
export const adminForumResolve = (id: string) =>
  callAdmin<{ ok: true }>('forum:resolve-report', { id })
export const adminForumBan = (userId: string, reason = '') =>
  callAdmin<{ ok: true }>('forum:ban', { userId, reason })
