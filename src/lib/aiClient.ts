import { supabase, isSupabaseConfigured } from './supabase'
import { isBillingConfigured } from './billing'
import { chargeCredits, getActivePlan } from './credits'

// ============================================================
//  前端 AI client
//  ------------------------------------------------------------
//  叫 Supabase Edge Function "gemini"（帶住登入 token）。
//  Gemini API key 在 server 側，前端永遠掂不到。
//  - streamChat()：async generator，逐段 yield 文字（打字效果）。
//  - complete()  ：一次過取得全部成段（內部用 streamChat 收集）。
// ============================================================

export type AIModel = 'gemini-2.5-flash' | 'gemini-2.5-pro'

export interface AIImage {
  mimeType: string
  data: string // base64（不含 data: 前綴）
}

export interface AIMessage {
  role: 'user' | 'model'
  content: string
  /** 多模態：附帶圖片給 Gemini Vision 分析（例：拍照識別器材 / 姿勢） */
  images?: AIImage[]
}

export interface AIChatOptions {
  messages: AIMessage[]
  system?: string
  model?: AIModel
  temperature?: number
  signal?: AbortSignal
  /** 額度分流標記（後端按此計額度）：'transcribe' = 錄音轉文字（每月）；預設一般 AI（每日）。 */
  feature?: string
  /** 用量分析標籤（功能名，如 'grading' / 'slides'）。不影響額度，只給後台統計每個功能成本。 */
  source?: string
}

/** 本地 dev 繞道：.env.local 設 VITE_DEV_AI=1 → AI 改打本地 /dev-ai/gemini（免 Supabase / 免登入），方便 test。prod 不受影響。 */
const DEV_AI = import.meta.env.VITE_DEV_AI === '1'

/** 有沒有接好 Supabase（AI 經 Supabase function）；或開了本地 dev 繞道 */
export const isAIConfigured = isSupabaseConfigured || DEV_AI

function functionsUrl(): string {
  const base = (import.meta.env.VITE_SUPABASE_URL as string).replace(/\/$/, '')
  return `${base}/functions/v1/gemini`
}

async function authedHeaders(): Promise<Record<string, string>> {
  if (!supabase) throw new Error('未接 Supabase，無法使用 AI。')
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new Error('請先登入以使用 AI。')
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
  }
}

/** 串流對話：逐段 yield 文字 delta */
export async function* streamChat(
  opts: AIChatOptions,
): AsyncGenerator<string, void, unknown> {
  const plan = getActivePlan()
  if (!DEV_AI && opts.model === 'gemini-2.5-pro' && plan !== 'pro') {
    throw new Error('Pro 高階 AI 模型只限 Pro 方案使用。')
  }
  // AI 點數計量：只在已配置收費（接了 Stripe）時 enforce；未配置 → inert，
  // 零行為改變。權威額度仍在後端 gemini Edge Function，這裡只前端 UX gating。
  if (isBillingConfigured) {
    const charge = chargeCredits(plan, {
      source: opts.source,
      feature: opts.feature,
      model: opts.model,
    })
    if (!charge.ok) {
      throw new Error(
        `AI 點數不夠：今個月剩 ${charge.remaining} 點，此動作要 ${charge.cost} 點。可去定價頁升級。`,
      )
    }
  }
  const headers = DEV_AI ? { 'Content-Type': 'application/json' } : await authedHeaders()
  const res = await fetch(DEV_AI ? '/dev-ai/gemini' : functionsUrl(), {
    method: 'POST',
    headers,
    body: JSON.stringify({
      messages: opts.messages,
      system: opts.system,
      model: opts.model,
      temperature: opts.temperature,
      feature: opts.feature,
      source: opts.source,
      stream: true,
    }),
    signal: opts.signal,
  })

  if (!res.ok || !res.body) {
    throw new Error(await errorMessage(res))
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const payload = trimmed.slice(5).trim()
      if (!payload || payload === '[DONE]') continue
      let parsed: { text?: string; error?: string }
      try {
        parsed = JSON.parse(payload)
      } catch {
        continue
      }
      if (parsed.error) throw new Error(parsed.error)
      if (parsed.text) yield parsed.text
    }
  }
}

/** 一次過取得全部成段回應 */
export async function complete(opts: AIChatOptions): Promise<string> {
  let out = ''
  for await (const chunk of streamChat(opts)) out += chunk
  return out
}

async function errorMessage(res: Response): Promise<string> {
  try {
    const data = await res.json()
    if (data?.error) return String(data.error)
  } catch {
    /* ignore */
  }
  if (res.status === 401) return '請先登入以使用 AI。'
  if (res.status === 404)
    return 'AI 服務搜尋不到（gemini function 未部署？見 docs/SETUP.md）。'
  return `AI 請求失敗 (${res.status})。`
}
