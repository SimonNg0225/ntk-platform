import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 'prompt'：偵測到新版唔靜靜換，而係彈「更新」banner 由用戶撳（避免打字途中突然 reload）。
      // 配合 vercel.json sw.js no-cache + PwaUpdater 定期檢查 → Safari 都即刻認到新部署。
      registerType: 'prompt',
      injectRegister: false, // 改由 src/components/PwaUpdater.tsx 自行 registerSW（要 periodic update）
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'NTK Platform · 個人學習與工作平台',
        short_name: 'NTK',
        description: '個人學習與工作平台 — 學習 / 工作雙模式，雲端同步 + AI 助手',
        lang: 'zh-HK',
        theme_color: '#2f6cb3',
        background_color: '#f4f7fb',
        display: 'standalone',
        start_url: '/app',
        icons: [
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
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
          // 商業化 vendor：各自獨立 chunk，唔拖慢首屏 + 可長期快取
          sentry: ['@sentry/react'],
          analytics: ['posthog-js'],
        },
      },
    },
  },
})
