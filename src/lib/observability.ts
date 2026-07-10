// ============================================================
//  商業化 · 可觀測性（錯誤監控 + 產品分析）+ Cookie 同意
//  ------------------------------------------------------------
//  設計同 Supabase / Gemini 一致：未設 env 變數就完全 no-op。
//  重點：
//   - Sentry / PostHog 用「動態 import」—— 未設 key 連 JS chunk 都不落。
//   - PostHog（產品分析）受 Cookie 同意 gating：用戶未「接受」前不載入、
//     不追蹤（私隱合規）。Sentry（錯誤監控，正當利益）照常。
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

// 動態載入後快取返的 module reference（未 init → null → 所有呼叫 no-op）
let sentry: typeof import('@sentry/react') | null = null
let posthog: (typeof import('posthog-js'))['default'] | null = null
const queuedEvents: { event: string; props?: Record<string, unknown> }[] = []
let queuedIdentity: { userId: string; traits?: Record<string, unknown> } | null = null

const ATTRIBUTION_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'gclid',
  'fbclid',
] as const

function currentAttribution(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  const url = new URL(window.location.href)
  const out: Record<string, string> = {}
  for (const key of ATTRIBUTION_KEYS) {
    const value = url.searchParams.get(key)
    if (value) out[key] = value
  }
  return out
}

function currentPageProps(): Record<string, unknown> {
  if (typeof window === 'undefined') return {}
  return {
    $current_url: `${window.location.origin}${window.location.pathname}`,
    path: window.location.pathname,
    title: document.title,
    referrer: document.referrer || undefined,
    ...currentAttribution(),
  }
}

function withCommonProps(props?: Record<string, unknown>): Record<string, unknown> {
  return {
    ...currentPageProps(),
    ...props,
  }
}

function flushQueuedEvents(): void {
  if (!posthog) return
  if (queuedIdentity) {
    posthog.identify(queuedIdentity.userId, queuedIdentity.traits)
  }
  while (queuedEvents.length) {
    const item = queuedEvents.shift()
    if (item) posthog.capture(item.event, item.props)
  }
}

async function initPosthog(): Promise<void> {
  if (posthog || !POSTHOG_KEY) return
  posthog = (await import('posthog-js')).default
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: false,
    autocapture: false,
    mask_all_text: true,
    mask_all_element_attributes: true,
    // 只為已識別用戶建 person profile，慳 event 額度 + 保私隱
    person_profiles: 'identified_only',
  })
  flushQueuedEvents()
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

/** 用戶在 Cookie 橫額「接受」時呼叫：記低同意 + 即時啟用分析。 */
export async function acceptAnalytics(): Promise<void> {
  storeConsent('accepted')
  await initPosthog()
  trackPageView({ source: 'cookie_accept' })
}

/** 用戶「拒絕」時呼叫：記低拒絕（不載入分析）。 */
export function rejectAnalytics(): void {
  storeConsent('rejected')
}

/** 追蹤產品事件（未同意 / 未 init → no-op）。 */
export function track(event: string, props?: Record<string, unknown>): void {
  if (!POSTHOG_KEY || getConsent() !== 'accepted') return
  const payload = withCommonProps(props)
  if (posthog) {
    posthog.capture(event, payload)
    return
  }
  queuedEvents.push({ event, props: payload })
}

/**
 * 同一瀏覽器只送一次的產品事件（例如首次見 onboarding）。
 * 未同意分析前不會寫標記，避免用戶之後接受 Cookie 時永久漏掉事件。
 */
export function trackOnce(event: string, props?: Record<string, unknown>): void {
  if (!POSTHOG_KEY || getConsent() !== 'accepted') return
  const key = `ntk.analytics.once.${event}`
  try {
    if (localStorage.getItem(key)) return
    localStorage.setItem(key, new Date().toISOString())
  } catch {
    /* localStorage 不可用時照常送，寧願少量重複亦不阻產品 */
  }
  track(event, props)
}

/** 追蹤頁面瀏覽；React Router / app 內虛擬頁面切換用。 */
export function trackPageView(props?: Record<string, unknown>): void {
  track('$pageview', props)
}

/** 追蹤外部連結點擊。 */
export function trackOutboundClick(url: string, props?: Record<string, unknown>): void {
  track('outbound_link_clicked', {
    url,
    ...props,
  })
}

// ── Feature flags（PostHog；未同意 / 未配置 → 一律回 fallback）─────
export function isFeatureEnabled(key: string, fallback = false): boolean {
  const v = posthog?.isFeatureEnabled(key)
  return typeof v === 'boolean' ? v : fallback
}

/** 註冊 flags 載入 / 變更回呼；回傳取消訂閱函數。 */
export function onFeatureFlags(cb: () => void): () => void {
  if (!posthog) return () => {}
  try {
    const unsub = posthog.onFeatureFlags(() => cb())
    return typeof unsub === 'function' ? unsub : () => {}
  } catch {
    return () => {}
  }
}

/** 登入後關聯用戶身份（轉化漏斗、留存分析用）。 */
export function identifyUser(
  userId: string,
  traits?: Record<string, unknown>,
): void {
  const safeTraits = traits ? { ...traits } : undefined
  if (safeTraits) {
    delete safeTraits.email
    delete safeTraits.name
  }
  queuedIdentity = { userId, traits: safeTraits }
  if (posthog && getConsent() === 'accepted') posthog.identify(userId, safeTraits)
  sentry?.setUser({ id: userId })
}

/** 登出時清除身份。 */
export function resetIdentity(): void {
  queuedIdentity = null
  posthog?.reset()
  sentry?.setUser(null)
}
