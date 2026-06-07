import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { hasTestPro, onTestProChange } from '../lib/testPro'

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
  /** 係咪測試 Pro（推廣代碼「NTK」本機解鎖，非真實付費）。 */
  isTest: boolean
}

const FREE: SubscriptionState = {
  plan: 'free',
  status: null,
  isPro: false,
  currentPeriodEnd: null,
  loading: false,
  isTest: false,
}

const TEST_PRO: SubscriptionState = {
  plan: 'pro',
  status: 'test',
  isPro: true,
  currentPeriodEnd: null,
  loading: false,
  isTest: true,
}

export function useSubscription(): SubscriptionState {
  const { user } = useAuth()
  const [state, setState] = useState<SubscriptionState>(() => ({
    ...FREE,
    loading: Boolean(user),
  }))
  // 測試 Pro（推廣代碼）：本機即時生效，蓋過真實訂閱狀態
  const [testPro, setTestPro] = useState(hasTestPro)
  useEffect(() => onTestProChange(() => setTestPro(hasTestPro())), [])

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
          isTest: false,
        })
      })
    return () => {
      cancelled = true
    }
  }, [user])

  // 測試 Pro 蓋過（除非真實已經係 Pro）
  if (testPro && !state.isPro) return TEST_PRO
  return state
}
