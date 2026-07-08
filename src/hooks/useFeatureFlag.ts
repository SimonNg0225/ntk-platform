import { useEffect, useState } from 'react'
import { isFeatureEnabled, onFeatureFlags } from '../lib/observability'

// ============================================================
//  Feature flag hook（PostHog 灰度發佈 / A-B 測試）
//  ------------------------------------------------------------
//  未配置 PostHog / 未同意 Cookie → 一律回 fallback（預設關），
//  即係新功能可以在 PostHog dashboard 逐步開，不用出新版。
// ============================================================

export function useFeatureFlag(key: string, fallback = false): boolean {
  const [on, setOn] = useState(() => isFeatureEnabled(key, fallback))
  useEffect(() => {
    setOn(isFeatureEnabled(key, fallback))
    return onFeatureFlags(() => setOn(isFeatureEnabled(key, fallback)))
  }, [key, fallback])
  return on
}
