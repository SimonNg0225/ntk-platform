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
import { attachSync, detachSync } from '../lib/sync'
import { identifyUser, resetIdentity } from '../lib/observability'

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
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)

  useEffect(() => {
    if (!supabase) return
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

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      session,
      loading,
      configured: isSupabaseConfigured,
      signInWithGoogle: async () => {
        if (!supabase) return
        await supabase.auth.signInWithOAuth({
          provider: 'google',
          // 回流去根目錄（= Supabase 預設 Site URL，最穩陣，唔使逐個 path 加 allowlist）。
          // 落到 '/' 後，Landing 偵測到 OAuth 回流會自動轉去 /app。
          options: { redirectTo: window.location.origin },
        })
      },
      signOut: async () => {
        if (!supabase) return
        await supabase.auth.signOut()
      },
    }),
    [session, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth 必須喺 <AuthProvider> 入面用')
  return ctx
}
