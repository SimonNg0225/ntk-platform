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
import { preloadAllFeatures } from '../features/registry'

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
    let cancelled = false
    if (userId) {
      // 先確保所有 lazy-load feature 嘅 collection 都登記齊，再啟動同步；
      // 否則 hydration 只覆蓋早期登記嘅核心 collection，feature 資料唔會
      // cloud→local 同步，第一次本地寫入仲會反過嚟覆蓋雲端（跨裝置丟資料）。
      void preloadAllFeatures().then(() => {
        if (!cancelled) void attachSync(userId)
      })
    } else {
      detachSync()
    }
    return () => {
      cancelled = true
      detachSync()
    }
  }, [userId])

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
