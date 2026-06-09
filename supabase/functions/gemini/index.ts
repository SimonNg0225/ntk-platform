// ============================================================
//  Edge Function: gemini
//  ------------------------------------------------------------
//  伺服器側代理去 Google Gemini API。
//  - GEMINI_API_KEY 收喺 Supabase secret，永遠唔會出前端。
//  - 先驗證呼叫者已登入（Supabase Auth JWT），未登入直接 401。
//  - 支援 streaming（SSE）同一次過回應兩種。
//
//  部署：
//    supabase functions deploy gemini
//    supabase secrets set GEMINI_API_KEY=AIza...
//  詳見 docs/SETUP.md
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

// 商業化 P1：AI 額度（防 Gemini 成本失控），按功能分流。白名單不限。
// 一般 AI（出題 / 批改 / 教案 / AI 助手…）：免費每日上限，Pro 無限。
const GENERAL_FREE_DAILY = Number(Deno.env.get('AI_DAILY_FREE_LIMIT') ?? '20')
// 錄音轉文字（音訊成本高）：免費 / Pro 各有每月上限。
const TRANSCRIBE_FREE_MONTHLY = Number(Deno.env.get('AI_TRANSCRIBE_FREE_MONTHLY') ?? '1')
const TRANSCRIBE_PRO_MONTHLY = Number(Deno.env.get('AI_TRANSCRIBE_PRO_MONTHLY') ?? '20')

// 測試白名單：呢啲 email 跳過每日額度（等同 Pro 無限），方便未接付款前測試。
// 取 AI_UNLIMITED_EMAILS，未設就退回 ADMIN_EMAILS（同 support-admin 共用一張名單）。
const UNLIMITED_EMAILS = (
  Deno.env.get('AI_UNLIMITED_EMAILS') ??
  Deno.env.get('ADMIN_EMAILS') ??
  ''
)
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean)

// 只容許呢幾個 model，避免被亂叫貴 model
const ALLOWED_MODELS = new Set(['gemini-2.5-flash', 'gemini-2.5-pro'])
const DEFAULT_MODEL = 'gemini-2.5-flash'

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface InlineImage {
  mimeType: string
  data: string // base64（唔含 data: 前綴）
}

interface ChatMessage {
  role: 'user' | 'model'
  content: string
  images?: InlineImage[]
}

interface RequestBody {
  messages: ChatMessage[]
  system?: string
  model?: string
  temperature?: number
  stream?: boolean
  feature?: string // 額度分流用：'transcribe' = 錄音轉文字（每月）；其餘 = 一般 AI（每日）
}

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }
  if (!GEMINI_API_KEY) {
    return json(
      { error: '伺服器未設定 GEMINI_API_KEY，請用 `supabase secrets set` 設定。' },
      500,
    )
  }

  // ── 驗證登入 ──────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization') ?? ''
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return json({ error: '請先登入先可以用 AI 功能。' }, 401)
  }

  // ── 解析 request（先 parse：畀額度按 feature 分流，亦唔好喺 invalid 請求扣額度）─
  let body: RequestBody
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Request body 唔係有效 JSON。' }, 400)
  }

  const messages = Array.isArray(body.messages) ? body.messages : []
  if (messages.length === 0) {
    return json({ error: '冇提供 messages。' }, 400)
  }

  // ── 訂閱 / 額度檢查（按功能）─────────────────────────────
  // 一般 AI：免費每日上限、Pro 無限；錄音轉文字（成本高）：免費 / Pro 各有每月上限。白名單不限。
  const callerEmail = (user.email ?? '').toLowerCase()
  const whitelisted = !!callerEmail && UNLIMITED_EMAILS.includes(callerEmail)
  if (SERVICE_ROLE_KEY && !whitelisted) {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
    const { data: sub } = await admin
      .from('subscriptions')
      .select('plan, status')
      .eq('user_id', user.id)
      .maybeSingle()
    const isPro =
      sub?.plan === 'pro' &&
      (sub?.status === 'active' || sub?.status === 'trialing')

    const feature = typeof body.feature === 'string' ? body.feature : 'general'
    const now = new Date()
    const ym = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
    const ymd = `${ym}-${String(now.getUTCDate()).padStart(2, '0')}`

    // 一般 AI + Pro → 無限（bucket 留 null 即跳過檢查）
    let bucket: string | null = null
    let limit = 0
    if (feature === 'transcribe') {
      bucket = `transcribe:${ym}` // 每月
      limit = isPro ? TRANSCRIBE_PRO_MONTHLY : TRANSCRIBE_FREE_MONTHLY
    } else if (!isPro) {
      bucket = `general:${ymd}` // 每日
      limit = GENERAL_FREE_DAILY
    }

    if (bucket) {
      const { data: quota, error: quotaErr } = await admin.rpc('consume_ai_quota', {
        p_user: user.id,
        p_bucket: bucket,
        p_limit: limit,
      })
      const row = Array.isArray(quota) ? quota[0] : quota
      if (!quotaErr && row && row.allowed === false) {
        const msg =
          feature === 'transcribe'
            ? isPro
              ? `本月錄音轉文字額度已用完（Pro 每月 ${TRANSCRIBE_PRO_MONTHLY} 次）。下個月 1 號重置。`
              : `本月免費錄音轉文字額度已用完（每月 ${TRANSCRIBE_FREE_MONTHLY} 次）。升級 Pro 每月 ${TRANSCRIBE_PRO_MONTHLY} 次，或下個月再試。`
            : `已用完今日免費 AI 額度（每日 ${GENERAL_FREE_DAILY} 次）。升級 Pro 即可無限使用，或聽日再試。`
        return json({ error: msg, code: 'quota_exceeded' }, 429)
      }
    }
  }

  const model =
    body.model && ALLOWED_MODELS.has(body.model) ? body.model : DEFAULT_MODEL
  const wantStream = body.stream !== false // 預設 streaming
  const temperature =
    typeof body.temperature === 'number' ? body.temperature : 0.7

  // ── 砌 Gemini payload ────────────────────────────────────
  const contents = messages.map((m) => {
    const parts: Record<string, unknown>[] = [{ text: String(m.content ?? '') }]
    if (Array.isArray(m.images)) {
      for (const im of m.images) {
        if (im?.data && im?.mimeType) {
          parts.push({ inlineData: { mimeType: im.mimeType, data: im.data } })
        }
      }
    }
    return { role: m.role === 'model' ? 'model' : 'user', parts }
  })

  const payload: Record<string, unknown> = {
    contents,
    generationConfig: { temperature },
  }
  if (body.system) {
    payload.systemInstruction = { parts: [{ text: body.system }] }
  }

  // ── 一次過回應 ───────────────────────────────────────────
  if (!wantStream) {
    const res = await fetch(
      `${GEMINI_BASE}/${model}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    )
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return json(
        { error: `Gemini 錯誤 (${res.status})`, detail: data },
        502,
      )
    }
    const text =
      data?.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p.text ?? '')
        .join('') ?? ''
    return json({ text })
  }

  // ── Streaming（SSE）─────────────────────────────────────
  const res = await fetch(
    `${GEMINI_BASE}/${model}:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  )
  if (!res.ok || !res.body) {
    const errText = await res.text().catch(() => '')
    return json(
      { error: `Gemini 錯誤 (${res.status})`, detail: errText.slice(0, 500) },
      502,
    )
  }

  const stream = transformGeminiSSE(res.body)
  return new Response(stream, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
})

// 將 Gemini 嘅 SSE (alt=sse) 轉成我哋自己嘅簡化 SSE：
//   data: {"text":"..."}   ← 每段文字 delta
//   data: [DONE]           ← 完結
function transformGeminiSSE(
  body: ReadableStream<Uint8Array>,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()
  let buffer = ''

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = body.getReader()
      try {
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
            try {
              const parsed = JSON.parse(payload)
              const text =
                parsed?.candidates?.[0]?.content?.parts
                  ?.map((p: { text?: string }) => p.text ?? '')
                  .join('') ?? ''
              if (text) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ text })}\n\n`),
                )
              }
            } catch {
              // 忽略 parse 唔到嘅 chunk
            }
          }
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      } catch (e) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ error: String(e) })}\n\n`,
          ),
        )
      } finally {
        controller.close()
        reader.releaseLock()
      }
    },
  })
}
