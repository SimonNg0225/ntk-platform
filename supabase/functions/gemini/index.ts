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
const TRANSCRIBE_PLUS_MONTHLY = Number(Deno.env.get('AI_TRANSCRIBE_PLUS_MONTHLY') ?? '10')

// AI 點數池（對齊 src/lib/credits.ts monthlyCredits）+ 逐動作扣點權重。
// 直接用點數池做權威閘，同前端 useCredits / 後台 admin 同一套數。
const POINTS_FREE = Number(Deno.env.get('AI_POINTS_FREE') ?? '30')
const POINTS_PLUS = Number(Deno.env.get('AI_POINTS_PLUS') ?? '300')
const POINTS_PRO = Number(Deno.env.get('AI_POINTS_PRO') ?? '1000')
const POINTS_BY_LABEL: Record<string, number> = { slides: 3, transcribe: 16 }
function pointCost(label: string, model: string): number {
  const base = POINTS_BY_LABEL[label] ?? 1
  const mult = model === 'gemini-2.5-pro' ? 4 : 1
  return base * mult
}

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
  source?: string // 用量分析用：功能標籤（grading / slides…）。唔影響額度，淨係記錄。
}

// 用量記錄（best-effort，唔阻 AI 回應）：每次成功呼叫後記低真實 token。
// 所有用戶都記（連 Pro / 白名單），帶住功能 + model。寫入 ai_usage_stats。
async function logAiUsage(
  userId: string,
  label: string,
  model: string,
  usage: { promptTokenCount?: number; candidatesTokenCount?: number } | null | undefined,
): Promise<void> {
  try {
    if (!SERVICE_ROLE_KEY) return
    const inTok = Math.max(0, Number(usage?.promptTokenCount ?? 0)) | 0
    const outTok = Math.max(0, Number(usage?.candidatesTokenCount ?? 0)) | 0
    if (!inTok && !outTok) return
    const now = new Date()
    const ym = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
    await admin.rpc('bump_ai_usage', {
      p_user: userId,
      p_ym: ym,
      p_feature: label,
      p_model: model,
      p_in: inTok,
      p_out: outTok,
    })
  } catch {
    /* best-effort：記錄失敗唔影響用戶 */
  }
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

  const model =
    body.model && ALLOWED_MODELS.has(body.model) ? body.model : DEFAULT_MODEL
  // 用量標籤：優先 source（功能），否則 feature（如 transcribe），預設 general。
  const usageLabel =
    (typeof body.source === 'string' && body.source) ||
    (typeof body.feature === 'string' && body.feature) ||
    'general'

  // ── 訂閱 / AI 點數池額度檢查 ─────────────────────────────
  // 直接用點數池做權威閘（同前端 useCredits / 後台同一套權重，數一致）：
  // 免費 30 / Plus 300 / Pro 1000 點/月；每次扣 1（標準）/ 3（簡報）/ 16（錄音）點，
  // 用 Pro 高階模型 ×4。已用點數由 ai_usage_stats（每月 calls × 權重）即時計。白名單不限。
  // 注意：read-then-check，極端並發下可能輕微超用（可接受；目的係防失控，唔係分毫不差）。
  const callerEmail = (user.email ?? '').toLowerCase()
  const whitelisted = !!callerEmail && UNLIMITED_EMAILS.includes(callerEmail)
  if (SERVICE_ROLE_KEY && !whitelisted) {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
    const { data: sub } = await admin
      .from('subscriptions')
      .select('plan, status')
      .eq('user_id', user.id)
      .maybeSingle()
    const active = sub?.status === 'active' || sub?.status === 'trialing'
    const pool =
      active && sub?.plan === 'pro'
        ? POINTS_PRO
        : active && sub?.plan === 'plus'
          ? POINTS_PLUS
          : POINTS_FREE

    const now = new Date()
    const ym = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
    const cost = pointCost(usageLabel, model)
    const { data: rows } = await admin
      .from('ai_usage_stats')
      .select('feature, model, calls')
      .eq('user_id', user.id)
      .eq('ym', ym)
    const used = (rows ?? []).reduce(
      (s: number, r: { feature: string; model: string; calls: number }) =>
        s + pointCost(r.feature, r.model) * (r.calls ?? 0),
      0,
    )
    if (used + cost > pool) {
      return json(
        {
          error: `本月 AI 點數已用完（${used}/${pool} 點，呢個動作要 ${cost} 點）。升級方案或下個月 1 號重置。`,
          code: 'quota_exceeded',
        },
        429,
      )
    }
  }
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
    await logAiUsage(user.id, usageLabel, model, data?.usageMetadata)
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

  const stream = transformGeminiSSE(res.body, (usage) =>
    logAiUsage(user.id, usageLabel, model, usage),
  )
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
  onDone?: (
    usage: { promptTokenCount?: number; candidatesTokenCount?: number } | undefined,
  ) => void | Promise<void>,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()
  let buffer = ''
  // Gemini 喺串流中／最後一個 chunk 會帶 usageMetadata（真實 token）；逐個 chunk 更新，最後用。
  let usage: { promptTokenCount?: number; candidatesTokenCount?: number } | undefined

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
              if (parsed?.usageMetadata) usage = parsed.usageMetadata
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
        if (onDone) await onDone(usage)
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
