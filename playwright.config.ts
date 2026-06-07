import { defineConfig, devices } from '@playwright/test'

// ============================================================
//  Playwright E2E 設定
//  ------------------------------------------------------------
//  針對「訪客模式」（無 Supabase / Stripe env）嘅確定性流程：
//  行銷 → 定價 → 付費入口（未設定時顯示「即將推出」）→ 進入 App。
//  webServer 會自動 build + preview（Vite 預設 SPA fallback，client route OK）。
// ============================================================

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
