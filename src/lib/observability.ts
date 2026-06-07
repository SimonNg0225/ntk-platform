// ============================================================
//  商業化 · 可觀測性（錯誤監控 + 產品分析）
//  ------------------------------------------------------------
//  設計同 Supabase / Gemini 一致：未設 env 變數就完全 no-op。
//  重點：Sentry / PostHog 用「動態 import」—— 未設 key 連 JS chunk
//  都唔會落，唔會拖慢首屏（PostHog ~195KB / Sentry 唔細）。
//    - Sentry   ← VITE_SENTRY_DSN
//    - PostHog  ← VITE_POSTHOG_KEY (+ VITE_POSTHOG_HOST)
// ============================================================

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined
const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined
const POSTHOG_HOST =
  (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ??
  'https://us.i.posthog.com'

export const isSentryConfigured = Boolean(SENTRY_DSN)
export const isAnalyticsConfigured = Boolean(POSTHOG_KEY)

// 動態載入後快取返嘅 module reference（未 init → null → 所有呼叫 no-op）
let sentry: typeof import('@sentry/react') | null = null
let posthog: (typeof import('posthog-js'))['default'] | null = null

/** App 啟動時叫一次（main.tsx）。未設 key 就靜靜咁略過，連 chunk 都唔載。 */
export async function initObservability(): Promise<void> {
  if (SENTRY_DSN) {
    sentry = await import('@sentry/react')
    sentry.init({
      dsn: SENTRY_DSN,
      integrations: [sentry.browserTracingIntegration()],
      // 商業化初期取樣 10%，量大再調低慳 quota
      tracesSampleRate: 0.1,
      environment: import.meta.env.MODE,
    })
  }
  if (POSTHOG_KEY) {
    posthog = (await import('posthog-js')).default
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      capture_pageview: true,
      // 只為已識別用戶建 person profile，慳 event 額度 + 保私隱
      person_profiles: 'identified_only',
    })
  }
}

/** 追蹤產品事件（未 init → no-op）。 */
export function track(event: string, props?: Record<string, unknown>): void {
  posthog?.capture(event, props)
}

/** 登入後關聯用戶身份（轉化漏斗、留存分析用）。 */
export function identifyUser(
  userId: string,
  traits?: Record<string, unknown>,
): void {
  posthog?.identify(userId, traits)
  sentry?.setUser({ id: userId })
}

/** 登出時清除身份。 */
export function resetIdentity(): void {
  posthog?.reset()
  sentry?.setUser(null)
}
