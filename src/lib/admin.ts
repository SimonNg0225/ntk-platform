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
