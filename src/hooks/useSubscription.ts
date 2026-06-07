import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// ============================================================
//  商業化 · 訂閱狀態 hook
//  ------------------------------------------------------------
//  讀取目前登入用戶嘅 subscriptions 行（RLS 保證只讀到自己）。
//  未登入 / 未接 Supabase / 無有效訂閱 → 一律當免費版。
//  Webhook 先係唯一寫入者（service_role 繞過 RLS），前端只讀。
// ============================================================

export interface SubscriptionState {
  plan: 'free' | 'pro'
  status: string | null
  /** 有冇有效付費訂閱（用嚟做功能 gating）。 */
  isPro: boolean
  currentPeriodEnd: string | null
  loading: boolean
}

const FREE: SubscriptionState = {
  plan: 'free',
  status: null,
  isPro: false,
  currentPeriodEnd: null,
  loading: false,
}

export function useSubscription(): SubscriptionState {
  const { user } = useAuth()
  const [state, setState] = useState<SubscriptionState>(() => ({
    ...FREE,
    loading: Boolean(user),
  }))

  useEffect(() => {
    let cancelled = false
    if (!supabase || !user) {
      setState(FREE)
      return
    }
    setState((s) => ({ ...s, loading: true }))
    void supabase
      .from('subscriptions')
      .select('plan, status, current_period_end')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        const active = data?.status === 'active' || data?.status === 'trialing'
        const isPro = active && data?.plan === 'pro'
        setState({
          plan: isPro ? 'pro' : 'free',
          status: (data?.status as string | undefined) ?? null,
          isPro,
          currentPeriodEnd:
            (data?.current_period_end as string | undefined) ?? null,
          loading: false,
        })
      })
    return () => {
      cancelled = true
    }
  }, [user])

  return state
}
