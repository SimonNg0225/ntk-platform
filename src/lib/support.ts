import { supabase, isSupabaseConfigured } from './supabase'

// ============================================================
//  客服系統
//  ------------------------------------------------------------
//  兩種：
//   1) 自家 in-app 聯絡表單（即裝即用）：登入後 → support Edge Function
//      → 存 ticket + email 客服。未接 Supabase → mailto fallback。
//   2) Crisp 即時聊天（選用）：設 VITE_CRISP_WEBSITE_ID + 同意 Cookie 後載入。
// ============================================================

const CRISP_ID = import.meta.env.VITE_CRISP_WEBSITE_ID as string | undefined

/** 客服 email（mailto fallback 用）。 */
export const SUPPORT_MAILTO =
  (import.meta.env.VITE_SUPPORT_EMAIL as string | undefined) ??
  'support@eziteach.example'

/** in-app 聯絡表單可唔可以直接提交（要 Supabase）；否則用 mailto。 */
export const isContactConfigured = isSupabaseConfigured

/** 提交客服查詢（登入用戶 → Edge Function）。 */
export async function submitSupportTicket(
  subject: string,
  message: string,
): Promise<void> {
  if (!supabase) throw new Error('未接 Supabase。')
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new Error('請先登入先可以聯絡客服。')
  const base = (import.meta.env.VITE_SUPABASE_URL as string).replace(/\/$/, '')
  const res = await fetch(`${base}/functions/v1/support`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
    },
    body: JSON.stringify({ subject, message }),
  })
  const data = (await res.json().catch(() => null)) as
    | { ok?: boolean; error?: string }
    | null
  if (!res.ok || !data?.ok) {
    throw new Error(data?.error ?? '提交失敗，請稍後再試。')
  }
}

/** mailto fallback（未接 Supabase / 未登入時用）。 */
export function supportMailto(subject: string, message: string): string {
  const q = new URLSearchParams({ subject, body: message }).toString()
  return `mailto:${SUPPORT_MAILTO}?${q}`
}

export const isSupportConfigured = Boolean(CRISP_ID)

let loaded = false

export function loadCrisp(): void {
  if (!CRISP_ID || loaded || typeof document === 'undefined') return
  loaded = true
  const w = window as unknown as {
    $crisp: unknown[]
    CRISP_WEBSITE_ID: string
  }
  w.$crisp = []
  w.CRISP_WEBSITE_ID = CRISP_ID
  const s = document.createElement('script')
  s.id = 'crisp-script'
  s.src = 'https://client.crisp.chat/l.js'
  s.async = true
  document.head.appendChild(s)
}
