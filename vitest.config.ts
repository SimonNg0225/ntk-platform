import { defineConfig } from 'vitest/config'

// 釘死測試時區 = Asia/Hong_Kong（UTC+8）。
// 本 repo 多個時間相依純函式 test 刻意假設「本地時區 = 香港」（見
// goals/util.time.test.ts 等的註解）。CI runner 預設 UTC，會令呢類「本地日曆日」
// 測試漂移一日而誤報失敗，故喺此統一鎖定，令本地同 CI 結果一致。
process.env.TZ = 'Asia/Hong_Kong'

// 測試專用設定（同 vite.config 分開，避免 vitest 4 嘅 rolldown 型別同
// vite 5 嘅 manualChunks 物件寫法衝突）。
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // collections.test.ts 嘅 preloadAllFeatures() 會動態 import 全部 feature
    // chunk（cold）；喺成個 suite 並行 transform 嘅負載下，預設 5s 偶爾唔夠而
    // 超時誤報。畀多啲緩衝（純函式 test 唔受影響）。
    testTimeout: 20000,
  },
})
