// ============================================================
//  商業化 · 可觀測性（錯誤監控 + 產品分析）+ Cookie 同意
//  ------------------------------------------------------------
//  設計同 Supabase / Gemini 一致：未設 env 變數就完全 no-op。
//  重點：
//   - Sentry / PostHog 用「動態 import」—— 未設 key 連 JS chunk 都唔落。
//   - PostHog（產品分析）受 Cookie 同意 gating：用戶未「接受」前唔載入、
//     唔追蹤（私隱合規）。Sentry（錯誤監控，正當利益）照常。
//    env：VITE_SENTRY_DSN / VITE_POSTHOG_KEY (+ VITE_POSTHOG_HOST)
// ============================================================

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined
const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined
const POSTHOG_HOST =
  (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ??
  'https://us.i.posthog.com'

export const isSentryConfigured = Boolean(SENTRY_DSN)
export const isAnalyticsConfigured = Boolean(POSTHOG_KEY)

// ── Cookie 同意 ──────────────────────────────────────────────
const CONSENT_KEY = 'ntk.cookieConsent'
export type Consent = 'accepted' | 'rejected'

export function getConsent(): Consent | null {
  try {
    const v = localStorage.getItem(CONSENT_KEY)
    return v === 'accepted' || v === 'rejected' ? v : null
  } catch {
    return null
  }
}

function storeConsent(v: Consent): void {
  try {
    localStorage.setItem(CONSENT_KEY, v)
  } catch {
    /* ignore */
  }
}

// 動態載入後快取返嘅 module reference（未 init → null → 所有呼叫 no-op）
let sentry: typeof import('@sentry/react') | null = null
let posthog: (typeof import('posthog-js'))['default'] | null = null

async function initPosthog(): Promise<void> {
  if (posthog || !POSTHOG_KEY) return
  posthog = (await import('posthog-js')).default
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: true,
    // 只為已識別用戶建 person profile，慳 event 額度 + 保私隱
    person_profiles: 'identified_only',
  })
}

/** App 啟動時叫一次（main.tsx）。Sentry 照載；PostHog 要用戶已「接受」先載。 */
export async function initObservability(): Promise<void> {
  if (SENTRY_DSN) {
    sentry = await import('@sentry/react')
    sentry.init({
      dsn: SENTRY_DSN,
      integrations: [sentry.browserTracingIntegration()],
      tracesSampleRate: 0.1,
      environment: import.meta.env.MODE,
    })
  }
  if (POSTHOG_KEY && getConsent() === 'accepted') await initPosthog()
}

/** 用戶喺 Cookie 橫額「接受」時呼叫：記低同意 + 即時啟用分析。 */
export async function acceptAnalytics(): Promise<void> {
  storeConsent('accepted')
  await initPosthog()
}

/** 用戶「拒絕」時呼叫：記低拒絕（唔載入分析）。 */
export function rejectAnalytics(): void {
  storeConsent('rejected')
}

/** 追蹤產品事件（未同意 / 未 init → no-op）。 */
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
