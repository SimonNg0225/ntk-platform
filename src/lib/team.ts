import { supabase } from './supabase'

// ============================================================
//  商業化 · 團隊 / 多座位（client）
//  ------------------------------------------------------------
//  org / 成員 / 邀請 經 Supabase RPC（SECURITY DEFINER，內部驗權）；
//  座位計費經 team-billing Edge Function（Stripe quantity）。
// ============================================================

export interface Org {
  id: string
  name: string
  owner_id: string
  seats: number
  stripe_subscription_id: string | null
}

export interface OrgMember {
  user_id: string
  role: string
  email: string
  created_at: string
}

export interface OrgInvite {
  id: string
  email: string
  role: string
  token: string
  created_at: string
  accepted_at: string | null
}

function need() {
  if (!supabase) throw new Error('未接 Supabase，無法使用團隊功能。')
  return supabase
}

/** 我所屬嘅團隊（RLS 只回自己係成員嘅 org）。 */
export async function listMyOrgs(): Promise<Org[]> {
  const { data, error } = await need()
    .from('orgs')
    .select('id, name, owner_id, seats, stripe_subscription_id')
  if (error) throw new Error(error.message)
  return (data ?? []) as Org[]
}

export async function createOrg(name: string): Promise<string> {
  const { data, error } = await need().rpc('create_org', { p_name: name })
  if (error) throw new Error(error.message)
  return data as string
}

export async function listMembers(orgId: string): Promise<OrgMember[]> {
  const { data, error } = await need().rpc('list_org_members', { p_org: orgId })
  if (error) throw new Error(error.message)
  return (data ?? []) as OrgMember[]
}

export async function listPendingInvites(orgId: string): Promise<OrgInvite[]> {
  const { data, error } = await need()
    .from('org_invites')
    .select('id, email, role, token, created_at, accepted_at')
    .eq('org_id', orgId)
    .is('accepted_at', null)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as OrgInvite[]
}

/** 建立邀請，回傳可分享嘅加入連結。 */
export async function inviteMember(
  orgId: string,
  email: string,
  role = 'member',
): Promise<string> {
  const { data, error } = await need().rpc('create_org_invite', {
    p_org: orgId,
    p_email: email,
    p_role: role,
  })
  if (error) throw new Error(error.message)
  const token = data as string
  return `${window.location.origin}/app?invite=${token}`
}

export async function acceptInvite(token: string): Promise<string> {
  const { data, error } = await need().rpc('accept_org_invite', {
    p_token: token,
  })
  if (error) throw new Error(error.message)
  return data as string
}

export async function removeMember(
  orgId: string,
  userId: string,
): Promise<void> {
  const { error } = await need().rpc('remove_org_member', {
    p_org: orgId,
    p_user: userId,
  })
  if (error) throw new Error(error.message)
}

const TEAM_PRICE_ID = import.meta.env.VITE_STRIPE_TEAM_PRICE_ID as
  | string
  | undefined

/** 團隊座位收費有冇配置（要團隊 price）。 */
export const isSeatBillingConfigured = Boolean(TEAM_PRICE_ID)

/** 開 Stripe Checkout 購買 / 調整座位（quantity = 座位數）。 */
export async function startSeatCheckout(
  orgId: string,
  seats: number,
): Promise<void> {
  const s = need()
  const {
    data: { session },
  } = await s.auth.getSession()
  if (!session) throw new Error('請先登入。')
  const base = (import.meta.env.VITE_SUPABASE_URL as string).replace(/\/$/, '')
  const res = await fetch(`${base}/functions/v1/team-billing`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
    },
    body: JSON.stringify({
      action: 'checkout-seats',
      orgId,
      seats,
      successUrl: `${window.location.origin}/app?seats=ok`,
      cancelUrl: `${window.location.origin}/app`,
    }),
  })
  const data = (await res.json().catch(() => null)) as
    | { url?: string; error?: string }
    | null
  if (!res.ok || !data?.url) {
    throw new Error(data?.error ?? '開啟付款頁失敗。')
  }
  window.location.href = data.url
}
