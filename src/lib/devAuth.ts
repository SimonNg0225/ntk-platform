import type { Session, User } from '@supabase/supabase-js'

// ============================================================
//  本機 dev 登入繞道（.env.local 設 VITE_DEV_AUTH=1）
//  ------------------------------------------------------------
//  唔使 Supabase、唔使真 Google OAuth：撳「用 Google 登入」即刻以一個本機
//  測試帳戶登入，方便喺本機 test 晒所有需要登入嘅功能。搭配 VITE_DEV_AI=1
//  就連 AI 都唔使 Supabase。
//
//  · isSupabaseConfigured 維持 false → 唔會打任何後端：雲端同步、訂閱、首次
//    登記、admin DB 查詢全部已 guard 住 supabase null，照樣 no-op。
//  · 假 session 只存喺呢部機 localStorage（refresh 唔甩），永遠唔出後端。
//  · 只喺本機 dev 有意義；prod 唔應該設呢個 flag（vercel build 唔會帶 .env.local）。
// ============================================================

export const isDevAuth = import.meta.env.VITE_DEV_AUTH === '1'

const STORAGE_KEY = 'eziteach.devAuth.session'

// 可用 VITE_DEV_AUTH_EMAIL 自訂測試帳戶 email（例如撞中 VITE_ADMIN_EMAILS 試後台）。
const DEV_EMAIL =
  (import.meta.env.VITE_DEV_AUTH_EMAIL as string | undefined)?.trim() ||
  'dev@localhost'

const DEV_NAME =
  (import.meta.env.VITE_DEV_AUTH_NAME as string | undefined)?.trim() ||
  '本機測試老師'

/** 砌一個「夠用」嘅假 Supabase session（夠 app 各處讀 user.id / email / 名 / 頭像）。 */
export function makeDevSession(): Session {
  const user: User = {
    id: '00000000-0000-4000-8000-000000000001',
    aud: 'authenticated',
    role: 'authenticated',
    email: DEV_EMAIL,
    app_metadata: { provider: 'google', providers: ['google'] },
    user_metadata: { full_name: DEV_NAME, name: DEV_NAME, email: DEV_EMAIL },
    identities: [],
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
    email_confirmed_at: '2024-01-01T00:00:00.000Z',
  }
  return {
    access_token: 'dev-access-token',
    refresh_token: 'dev-refresh-token',
    token_type: 'bearer',
    expires_in: 3600,
    user,
  }
}

export function loadDevSession(): Session | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Session) : null
  } catch {
    return null
  }
}

export function saveDevSession(s: Session): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  } catch {
    /* ignore */
  }
}

export function clearDevSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}
