import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import {
  isDevAuth,
  makeDevSession,
  loadDevSession,
  saveDevSession,
  clearDevSession,
} from '../lib/devAuth'
import { attachSync, detachSync } from '../lib/sync'
import { identifyUser, resetIdentity, track } from '../lib/observability'
import { isAdminEmail } from '../lib/support'
import { checkIsAdmin } from '../lib/admin'

// ============================================================
//  AuthContext
//  ------------------------------------------------------------
//  管理登入狀態（Google 登入）。
//  未接 Supabase 時 configured=false，App 以訪客模式運作。
// ============================================================

interface AuthContextValue {
  user: User | null
  session: Session | null
  loading: boolean
  /** 有冇接好 Supabase（即係可唔可以登入） */
  configured: boolean
  /** 當前用戶係咪管理員（env 白名單 OR app_admins 表）。 */
  isAdmin: boolean
  /** 管理員身份查完未（DB 慢查；未查完時 gate 應顯示載入中而非「冇權限」）。 */
  adminChecked: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)

  useEffect(() => {
    if (!supabase) {
      // 冇接 Supabase：本機 dev 登入時還原上次撳過嘅假 session（refresh 唔甩）。
      if (isDevAuth) setSession(loadDevSession())
      return
    }
    // 開頁先攞返現有 session
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    // 之後監聽登入 / 登出
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  // 登入後啟動雲端同步；登出 / 切換 user 時停止
  const userId = session?.user?.id
  useEffect(() => {
    if (!isSupabaseConfigured) return
    // attachSync 內部會先 await 確保所有 lazy feature collection 登記齊先 hydrate。
    if (userId) {
      void attachSync(userId)
      identifyUser(userId, { email: session?.user?.email ?? undefined })
    } else {
      detachSync()
      resetIdentity()
    }
    return () => detachSync()
  }, [userId, session?.user?.email])

  // 管理員身份：env 白名單即時知（唔閃），否則查 app_admins 表（DB 名單）
  const email = session?.user?.email ?? null
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminChecked, setAdminChecked] = useState(false)
  useEffect(() => {
    if (!email) {
      setIsAdmin(false)
      setAdminChecked(true)
      return
    }
    if (isAdminEmail(email)) {
      setIsAdmin(true)
      setAdminChecked(true)
      return
    }
    let cancelled = false
    setAdminChecked(false)
    checkIsAdmin(email)
      .then((r) => {
        if (!cancelled) {
          setIsAdmin(r)
          setAdminChecked(true)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIsAdmin(false)
          setAdminChecked(true)
        }
      })
    return () => {
      cancelled = true
    }
  }, [email])

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      session,
      loading,
      configured: isSupabaseConfigured || isDevAuth,
      isAdmin,
      adminChecked,
      signInWithGoogle: async () => {
        if (!supabase) {
          // 本機 dev：唔行真 OAuth，即刻以假帳戶登入（存 localStorage）。
          if (isDevAuth) {
            const s = makeDevSession()
            saveDevSession(s)
            setSession(s)
          }
          return
        }
        track('signup_started', { provider: 'google' })
        await supabase.auth.signInWithOAuth({
          provider: 'google',
          // 回流去根目錄（= Supabase 預設 Site URL，最穩陣，唔使逐個 path 加 allowlist）。
          // 落到 '/' 後，Landing 偵測到 OAuth 回流會自動轉去 /app。
          options: { redirectTo: window.location.origin },
        })
      },
      signOut: async () => {
        if (!supabase) {
          if (isDevAuth) {
            clearDevSession()
            setSession(null)
          }
          return
        }
        await supabase.auth.signOut()
      },
    }),
    [session, loading, isAdmin, adminChecked],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth 必須喺 <AuthProvider> 入面用')
  return ctx
}
