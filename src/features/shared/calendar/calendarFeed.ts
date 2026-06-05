import { calendarFeedCol, type CalendarFeedToken } from '../../../data/collections'

// ============================================================
//  訂閱式 .ics 日曆 feed —— token 生成 + webcal 連結組裝
//  ------------------------------------------------------------
//  - token：≥128-bit、URL-safe 隨機字串，存喺 calendarFeedCol（單行
//    id='token'）。會 sync 上 Supabase（app_rows，collection='calendar_feed'），
//    畀 Edge Function calendar-feed 反查 user_id。
//  - webcal 連結：webcal://<project-ref>.supabase.co/functions/v1/
//    calendar-feed?token=<token>（project-ref 由 VITE_SUPABASE_URL 拆）。
//  - 純邏輯、無 React，方便單元測試。
//  詳見 docs/superpowers/specs/2026-06-04-calendar-feed-reminders-design.md
// ============================================================

/** 單行 token 喺 collection 內固定用呢個 id。 */
export const FEED_TOKEN_ID = 'token'

/** token 位元組數（16 bytes = 128-bit；base64url 後約 22 字）。 */
const TOKEN_BYTES = 24 // 192-bit，留足餘裕（> 128-bit 規範下限）

/**
 * 用 crypto 生成一個 URL-safe（base64url，去 padding）隨機 token。
 * 至少 128-bit 亂數。crypto.getRandomValues 喺瀏覽器同 Node ≥16 都有。
 */
export function generateFeedToken(bytes: number = TOKEN_BYTES): string {
  const buf = new Uint8Array(bytes)
  crypto.getRandomValues(buf)
  // bytes → binary string → base64 → base64url（+/= 換成 -_，去尾部 =）
  let bin = ''
  for (const b of buf) bin += String.fromCharCode(b)
  const b64 = typeof btoa !== 'undefined' ? btoa(bin) : bufToBase64Node(buf)
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Node fallback（測試 / SSR 等無 btoa 嘅環境）。 */
function bufToBase64Node(buf: Uint8Array): string {
  // 避免直接靠 Buffer 型別（瀏覽器 build 唔想拉入 node typings）。
  const G = globalThis as unknown as {
    Buffer?: { from(d: Uint8Array): { toString(enc: string): string } }
  }
  if (G.Buffer) return G.Buffer.from(buf).toString('base64')
  // 極端 fallback：手寫 base64（理論上唔會行到，btoa/Buffer 至少有一個）。
  return ''
}

/**
 * 攞現有 token；無就生成一個、存入 collection、回傳。
 * 多次呼叫穩定回同一個（除非 rotateToken）。
 */
export function getOrCreateToken(): string {
  const existing = calendarFeedCol.get().find((r) => r.id === FEED_TOKEN_ID)
  if (existing?.token) return existing.token
  const token = generateFeedToken()
  // set 成單行（即使本來有畸形資料，都收斂成一行乾淨 token）。
  calendarFeedCol.set([{ id: FEED_TOKEN_ID, token } as CalendarFeedToken])
  return token
}

/**
 * 換一個新 token（舊連結即時失效）。回傳新 token。
 */
export function rotateToken(): string {
  const token = generateFeedToken()
  calendarFeedCol.set([{ id: FEED_TOKEN_ID, token } as CalendarFeedToken])
  return token
}

/** 讀現有 token（唔生成）；無就回 null。畀 UI 判斷「未訂閱過」。 */
export function peekToken(): string | null {
  return calendarFeedCol.get().find((r) => r.id === FEED_TOKEN_ID)?.token ?? null
}

/**
 * 由 Supabase URL 拆 project-ref：
 *   https://abcdefgh.supabase.co       → abcdefgh
 *   https://abcdefgh.supabase.co/      → abcdefgh
 *   https://abcdefgh.supabase.in.xxx   → abcdefgh（取第一段 subdomain）
 * 拆唔到（空 / 非 supabase host）→ null。
 */
export function projectRefFromUrl(url: string | undefined | null): string | null {
  if (!url) return null
  let host: string
  try {
    host = new URL(url).host // 例如 abcdefgh.supabase.co
  } catch {
    // 唔係完整 URL，當佢可能淨係 host
    host = String(url).replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  }
  if (!host) return null
  host = host.replace(/:\d+$/, '') // 去走 :port（例如 localhost:54321）
  // 真實 supabase 主機一定係多段（<ref>.supabase.co）；單段主機（如 localhost）
  // 拆唔出合理 ref。
  if (!host.includes('.')) return null
  const ref = host.split('.')[0]?.trim()
  if (!ref || ref === 'supabase' || ref === 'localhost') return null
  return ref
}

/**
 * 組 webcal 連結：webcal://<ref>.supabase.co/functions/v1/calendar-feed?token=<token>
 * ref 拆唔到 → null。
 */
export function buildWebcalUrl(
  supabaseUrl: string | undefined | null,
  token: string,
): string | null {
  const ref = projectRefFromUrl(supabaseUrl)
  if (!ref) return null
  return `webcal://${ref}.supabase.co/functions/v1/calendar-feed?token=${encodeURIComponent(
    token,
  )}`
}

/** 同 webcal 連結，但用 https://（畀「複製」之後手動貼、或非 Apple 裝置用）。 */
export function buildHttpsUrl(
  supabaseUrl: string | undefined | null,
  token: string,
): string | null {
  const webcal = buildWebcalUrl(supabaseUrl, token)
  return webcal ? webcal.replace(/^webcal:\/\//, 'https://') : null
}
