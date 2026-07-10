// ============================================================
//  aiError — AI 失敗降級的共用 helper（純 TS · 零 dependency）
//  ------------------------------------------------------------
//  aiClient.ts 的 streamChat()/complete() 失敗時只會 throw 一個
//  `Error(string)`：HTTP status 在 errorMessage() 已經攤平成廣東話
//  字串（例：「請先登入以使用 AI。」「AI 請求失敗 (503)。」），
//  abort 會係 DOMException(name='AbortError')，網絡斷線會係 fetch
//  掟出的 TypeError。所以這裡靠「error name + message 內容 +
//  navigator.onLine」來分類，而不靠不存在的 e.status 欄位。
//
//  給 feature 直接用（相對路徑 import，跟本 repo 慣例，無 @ alias）：
//    import { classifyAIError, isOffline, withRetry } from '../../lib/aiError'
//    try { await complete(opts) }
//    catch (e) { const info = classifyAIError(e); toast.error(info.message) }
//
//  全程不 import 任何嘢，亦永不 throw（withRetry 例外：重試耗盡會
//  re-throw 最後一個 error，等呼叫端照常 catch）。
// ============================================================

/** 錯誤分類。retryable = 值不值得自動重試（網絡/超時/限流/暫時性 server 先算）。 */
export type AIErrorKind =
  | 'offline' // 裝置離線（navigator.onLine = false 或 fetch 網絡層失敗）
  | 'timeout' // 逾時 / 被 abort（AbortError）
  | 'rateLimit' // 額度用盡或被限流（429 / quota / 額度）
  | 'auth' // 未登入 / 權限（401 / 403）
  | 'server' // 後端錯誤（5xx / function 未部署 / 503）
  | 'unknown' // 其他未能歸類

export interface AIErrorInfo {
  kind: AIErrorKind
  /** 值不值得自動重試（退避後再試多次）。 */
  retryable: boolean
  /** 廣東話友善提示，可直接出 toast。 */
  message: string
}

/** 每種 kind 的預設友善文案（廣東話）。 */
const FRIENDLY: Record<AIErrorKind, string> = {
  offline: '網絡似乎斷線了，請重新連線後再試。',
  timeout: 'AI 回應太耐沒有反應，請再試一次。',
  rateLimit: 'AI 用量已達上限，請稍後再試（或明天再試）。',
  auth: '請先登入以使用 AI。',
  server: 'AI 服務暫時繁忙，請稍後再試。',
  unknown: 'AI 出了一點問題，請再試一次。',
}

const TECHNICAL_CONFIG_PATTERN =
  /supabase|edge function|gemini|vite_[a-z0-9_]+|docs\/setup|未部署|environment variable/i

/** 以 navigator.onLine 為主判斷裝置離線；non-browser 環境當作有線（false）。 */
export function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

/** 由任意 thrown value 抽出可讀 message（string / Error / 有 message 欄位的 object）。 */
function rawMessage(e: unknown): string {
  if (typeof e === 'string') return e
  if (e instanceof Error) return e.message
  if (e && typeof e === 'object' && 'message' in e) {
    const m = (e as { message?: unknown }).message
    if (typeof m === 'string') return m
  }
  return ''
}

/** 由 thrown value 抽出 error name（如 'AbortError' / 'TypeError'）。 */
function errorName(e: unknown): string {
  if (e instanceof Error) return e.name
  if (e && typeof e === 'object' && 'name' in e) {
    const n = (e as { name?: unknown }).name
    if (typeof n === 'string') return n
  }
  return ''
}

/**
 * 將 AI 呼叫掟出的 error 分類成 { kind, retryable, message }。
 * 永不 throw；分不到一律 'unknown'。message 預設係對應 kind 的
 * 廣東話文案；若原本 error 已經帶住可讀的中文提示（例如後端的
 * 「請先登入以使用 AI。」），則保留原文。
 */
export function classifyAIError(e: unknown): AIErrorInfo {
  const name = errorName(e)
  const raw = rawMessage(e)
  const msg = raw.toLowerCase()

  const make = (kind: AIErrorKind, retryable: boolean): AIErrorInfo => ({
    kind,
    retryable,
    // 後端已有可讀中文就使用原文，否則用預設友善文案
    message:
      hasReadableChinese(raw) && !TECHNICAL_CONFIG_PATTERN.test(raw)
        ? raw
        : FRIENDLY[kind],
  })

  // 1) 主動取消 / 逾時：fetch abort 係 DOMException(name='AbortError')
  if (name === 'AbortError' || msg.includes('aborted') || msg.includes('timeout') || msg.includes('timed out')) {
    return make('timeout', true)
  }

  // 2) 離線：navigator 講離線，或 fetch 網絡層失敗（TypeError / 'failed to fetch' / 'network'）
  if (isOffline()) return make('offline', true)
  if (
    name === 'TypeError' &&
    (msg.includes('fetch') || msg.includes('network') || msg.includes('load failed'))
  ) {
    return make('offline', true)
  }
  if (msg.includes('failed to fetch') || msg.includes('networkerror') || msg.includes('network error')) {
    return make('offline', true)
  }

  // 3) 限流 / 額度（429 / quota / rate / 額度 / 上限）
  if (
    msg.includes('429') ||
    msg.includes('rate limit') ||
    msg.includes('quota') ||
    msg.includes('too many requests') ||
    raw.includes('額度') ||
    raw.includes('用量') ||
    raw.includes('上限')
  ) {
    return make('rateLimit', true)
  }

  // 4) 認證 / 權限（401 / 403 / 未登入 / 請先登入）
  if (
    msg.includes('401') ||
    msg.includes('403') ||
    msg.includes('unauthorized') ||
    msg.includes('forbidden') ||
    raw.includes('登入') ||
    raw.includes('未接 Supabase')
  ) {
    return make('auth', false)
  }

  // 5) 後端 / 服務（5xx / 503 / function 未部署 / 搜尋不到）
  if (
    /\b5\d\d\b/.test(raw) ||
    msg.includes('server') ||
    msg.includes('unavailable') ||
    msg.includes('bad gateway') ||
    raw.includes('搜尋不到') ||
    raw.includes('未部署')
  ) {
    return make('server', true)
  }

  return make('unknown', false)
}

/** 粗略判斷字串有沒有 CJK 中文字（有就當係後端／本地已備好可讀提示）。 */
function hasReadableChinese(s: string): boolean {
  return /[一-鿿]/.test(s)
}

export interface WithRetryOptions {
  /** 總共試幾多次（含第一次）。預設 3。 */
  tries?: number
  /** 第一次重試前的基礎延遲（毫秒）。之後指數退避。預設 600。 */
  baseDelayMs?: number
  /** 可選：傳入呼叫端的 AbortSignal；一旦 abort 即停止重試並掟出。 */
  signal?: AbortSignal
  /**
   * 可選：自訂「這個 error 值不值得再試」。預設用 classifyAIError().retryable。
   * 回 false 就立即 re-throw，不再等。
   */
  shouldRetry?: (e: unknown, info: AIErrorInfo) => boolean
}

/** 內部小睡，支援 abort 即時喚醒並掟錯。 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    const t = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(t)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

/**
 * 對 retryable 錯誤做指數退避重試。fn 每次都會重新呼叫（要 idempotent）。
 * 預設只重試 classifyAIError 判定 retryable 的錯誤（離線 / 逾時 / 限流 /
 * 暫時性 server）；auth / unknown 立即 re-throw 不嘥時間。
 * 重試耗盡會 re-throw 最後一個 error，呼叫端照常 try/catch + classifyAIError。
 *
 * 例：
 *   const text = await withRetry(() => complete(opts), { tries: 3, signal })
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: WithRetryOptions = {},
): Promise<T> {
  const tries = Math.max(1, options.tries ?? 3)
  const baseDelayMs = Math.max(0, options.baseDelayMs ?? 600)
  const { signal, shouldRetry } = options

  let lastErr: unknown
  for (let attempt = 0; attempt < tries; attempt++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    try {
      return await fn()
    } catch (e) {
      lastErr = e
      const info = classifyAIError(e)
      const retry = shouldRetry ? shouldRetry(e, info) : info.retryable
      const isLast = attempt === tries - 1
      // 不值得試 / 已經係最後一次 / 已被取消 → 立即放棄
      if (!retry || isLast || signal?.aborted) {
        throw e
      }
      // 指數退避 + 少量休息動，避免同時重試造成尖峰
      const delay = baseDelayMs * 2 ** attempt + Math.floor(Math.random() * 100)
      await sleep(delay, signal)
    }
  }
  // 理論上去不到這裡（迴圈內必 return 或 throw），保險起見 re-throw
  throw lastErr
}
