import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// ── Dev-only：本地複製 Supabase 「gemini」Edge Function ─────────────────────
// 令你淨係用一個免費 Gemini API key（.env.local 嘅 GEMINI_API_KEY）就可以喺本機
// test 晒所有 AI，唔使部署 Supabase / 唔使登入。只喺 `vite`（dev）行，prod build 唔會包。
// 搭配前端 aiClient.ts 嘅 VITE_DEV_AI=1。GEMINI_API_KEY 只留喺 Node 側，永遠唔出前端。
function devAiGemini(apiKey: string): Plugin {
  const ALLOWED = new Set(['gemini-2.5-flash', 'gemini-2.5-pro'])
  const BASE = 'https://generativelanguage.googleapis.com/v1beta/models'
  return {
    name: 'dev-ai-gemini',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/dev-ai/gemini', async (req, res) => {
        const send = (status: number, obj: unknown) => {
          res.statusCode = status
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify(obj))
        }
        if (req.method !== 'POST') return send(405, { error: 'POST only' })
        if (!apiKey)
          return send(500, {
            error:
              '未設定 GEMINI_API_KEY —— 喺 .env.local 加一行 GEMINI_API_KEY=AIza... 再重開 dev server。',
          })
        let raw = ''
        try {
          for await (const chunk of req) raw += chunk
        } catch {
          /* ignore */
        }
        let body: any
        try {
          body = JSON.parse(raw || '{}')
        } catch {
          return send(400, { error: 'Request body 唔係有效 JSON。' })
        }
        const messages = Array.isArray(body.messages) ? body.messages : []
        if (!messages.length) return send(400, { error: '冇提供 messages。' })
        const model =
          body.model && ALLOWED.has(body.model) ? body.model : 'gemini-2.5-flash'
        const temperature =
          typeof body.temperature === 'number' ? body.temperature : 0.7
        const contents = messages.map((m: any) => {
          const parts: any[] = [{ text: String(m?.content ?? '') }]
          if (Array.isArray(m?.images))
            for (const im of m.images)
              if (im?.data && im?.mimeType)
                parts.push({ inlineData: { mimeType: im.mimeType, data: im.data } })
          return { role: m?.role === 'model' ? 'model' : 'user', parts }
        })
        const payload: any = { contents, generationConfig: { temperature } }
        if (body.system) payload.systemInstruction = { parts: [{ text: String(body.system) }] }
        const wantStream = body.stream !== false
        try {
          if (!wantStream) {
            const r = await fetch(`${BASE}/${model}:generateContent?key=${apiKey}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            })
            const data: any = await r.json().catch(() => null)
            if (!r.ok) return send(502, { error: `Gemini 錯誤 (${r.status})`, detail: data })
            const text =
              data?.candidates?.[0]?.content?.parts
                ?.map((p: any) => p?.text ?? '')
                .join('') ?? ''
            return send(200, { text })
          }
          const r = await fetch(
            `${BASE}/${model}:streamGenerateContent?alt=sse&key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            },
          )
          if (!r.ok || !r.body) {
            const t = await r.text().catch(() => '')
            return send(502, { error: `Gemini 錯誤 (${r.status})`, detail: t.slice(0, 500) })
          }
          res.statusCode = 200
          res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
          res.setHeader('Cache-Control', 'no-cache')
          const reader = (r.body as any).getReader()
          const dec = new TextDecoder()
          let buf = ''
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            buf += dec.decode(value, { stream: true })
            const lines = buf.split('\n')
            buf = lines.pop() ?? ''
            for (const line of lines) {
              const t = line.trim()
              if (!t.startsWith('data:')) continue
              const p = t.slice(5).trim()
              if (!p || p === '[DONE]') continue
              try {
                const parsed = JSON.parse(p)
                const text =
                  parsed?.candidates?.[0]?.content?.parts
                    ?.map((x: any) => x?.text ?? '')
                    .join('') ?? ''
                if (text) res.write(`data: ${JSON.stringify({ text })}\n\n`)
              } catch {
                /* 忽略 parse 唔到嘅 chunk */
              }
            }
          }
          res.write('data: [DONE]\n\n')
          res.end()
        } catch (e) {
          if (!res.headersSent) return send(500, { error: String(e) })
          try {
            res.end()
          } catch {
            /* ignore */
          }
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // 載入埋非 VITE_ 變數（第三個參數 ''）；GEMINI_API_KEY 淨係喺 Node 側 dev middleware 用，唔出前端。
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [
      react(),
      devAiGemini(env.GEMINI_API_KEY ?? ''),
      VitePWA({
        // 'prompt'：偵測到新版唔靜靜換，而係彈「更新」banner 由用戶撳（避免打字途中突然 reload）。
        // 配合 vercel.json sw.js no-cache + PwaUpdater 定期檢查 → Safari 都即刻認到新部署。
        registerType: 'prompt',
        injectRegister: false, // 改由 src/components/PwaUpdater.tsx 自行 registerSW（要 periodic update）
        includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
        workbox: {
          // OpenCV.js（10MB+）係掃描功能用嘅，runtime 先 fetch `/vendor/opencv/opencv.js`，
          // 唔應該（亦超過 2MiB 上限）入 precache manifest；排除佢免 build 報錯。
          globIgnores: ['**/vendor/opencv/**'],
        },
        manifest: {
          name: 'EziTeach 教學易 · 香港教師工作台',
          short_name: 'EziTeach',
          description: '個人學習與工作平台 — 學習 / 工作雙模式，雲端同步 + AI 助手',
          lang: 'zh-HK',
          theme_color: '#2f6cb3',
          background_color: '#f4f7fb',
          display: 'standalone',
          start_url: '/app',
          icons: [
            { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
            { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
      }),
    ],
    server: {
      host: true,
      port: 5173,
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            supabase: ['@supabase/supabase-js'],
            lucide: ['lucide-react'],
            // 註：@sentry/react、posthog-js 由 observability.ts 動態 import（consent-gated），
            // Rollup 已自動 code-split；唔再喺度列 manualChunks，免整出空 chunk（build 警告）。
          },
        },
      },
    },
  }
})
