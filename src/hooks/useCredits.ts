import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useSubscription } from './useSubscription'
import {
  monthlyCredits,
  creditCostOf,
  creditCost,
  type ChargeContext,
} from '../lib/credits'

// ============================================================
//  AI 點數餘額 hook（顯示用）
//  ------------------------------------------------------------
//  權威來源 = 後端 `ai_usage_stats`（每月每功能 calls）。RLS「read own」
//  給用戶讀自己那些。已用點數 = Σ(calls × creditCostOf(feature, model))，
//  同 admin 後台用同一套權重，所以兩邊數一致。跨裝置準（不靠本機 ledger）。
// ============================================================

/** 當前月份 bucket，對齊 ai_usage_stats.ym（'YYYY-MM'）。 */
function ym(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export interface CreditsState {
  plan: 'free' | 'plus' | 'pro'
  /** 每月點數池。 */
  pool: number
  /** 本月已用點數。 */
  used: number
  /** 本月剩餘點數。 */
  remaining: number
  loading: boolean
  /** 某動作要扣幾多點。 */
  costOf: (ctx: ChargeContext) => number
  /** 重新拉取（生成完之後叫，更新餘額）。 */
  reload: () => void
}

export function useCredits(): CreditsState {
  const { user } = useAuth()
  const sub = useSubscription()
  const pool = monthlyCredits(sub.plan)
  const [used, setUsed] = useState(0)
  const [loading, setLoading] = useState(false)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let cancelled = false
    if (!supabase || !user) {
      setUsed(0)
      return
    }
    setLoading(true)
    void supabase
      .from('ai_usage_stats')
      .select('feature, model, calls')
      .eq('user_id', user.id)
      .eq('ym', ym())
      .then(({ data }) => {
        if (cancelled) return
        const rows = (data ?? []) as {
          feature: string
          model: string
          calls: number
        }[]
        const pts = rows.reduce(
          (sum, r) => sum + creditCostOf(r.feature, r.model) * (r.calls ?? 0),
          0,
        )
        setUsed(pts)
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [user, sub.plan, nonce])

  return {
    plan: sub.plan,
    pool,
    used,
    remaining: Math.max(0, pool - used),
    loading,
    costOf: (ctx) => creditCost(ctx),
    reload: () => setNonce((n) => n + 1),
  }
}
