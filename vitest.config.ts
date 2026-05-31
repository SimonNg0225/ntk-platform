import { defineConfig } from 'vitest/config'

// 測試專用設定（同 vite.config 分開，避免 vitest 4 嘅 rolldown 型別同
// vite 5 嘅 manualChunks 物件寫法衝突）。
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
