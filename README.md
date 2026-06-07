# NTK Platform

個人**學習與工作**平台 —— 一個可以隨時切換模式嘅個人入口，目標係提升個人知識增長同工作效能。

> 版本 `v1.1`。精煉海軍藍、手機 responsive、無障礙（a11y）、PWA 離線，**👤 個人 / 💼 工作** 兩模式共 30+ 功能。個人模式涵蓋知識、自我管理、**健康追蹤** 同 **健身中心**（AI 飲食拆解 / AI 教練 / 拍照識別器材 — Gemini Vision）。
> 資料存本機（localStorage）並可登入後雲端同步（Supabase），AI 接 Gemini；未設定時以「訪客模式」純本機運作。設定見 [`docs/SETUP.md`](docs/SETUP.md)。
> ⌘K 指令面板快速跳轉；首次開啟有導覽 + 一鍵載入示範資料。

## ✨ 核心概念

- **雙模式切換**：左上角一撳，喺「👤 個人模式」同「💼 工作模式」之間切換。切換時主題色、側邊欄功能會跟住變。
- **手機 responsive**：細螢幕用頂欄漢堡掣 + 滑出式抽屜；桌面固定側邊欄。
- **記住你嘅選擇**：模式同所有資料都存喺瀏覽器，下次開返仲喺度。
- **功能註冊表 + 共用資料層**：加新功能只需登記一個項目；資料結構對齊 Supabase。

## 🧩 目前功能

| 模式 | 功能 | 狀態 |
| --- | --- | --- |
| 👤 個人 | 個人儀表板 📊（生活駕駛艙：複習/連續/健康/理財一覽） | ✅ 可用 |
| 👤 個人 | 個人 AI 助手 🤖（問答 / 解釋 / 總結 / 出題） | ✅ 可用 |
| 👤 個人 | 個人筆記 📝 | ✅ 可用 |
| 👤 個人 | 個人目標 + 進度 🎯 | ✅ 可用 |
| 👤 個人 | 知識卡 + 間隔重複 🧠（SM-2） | ✅ 可用 |
| 👤 個人 | 專注計時器 ⏱️（番茄鐘） | ✅ 可用 |
| 👤 個人 | 個人日誌 📓（Day One 式：心情月曆 / 歷年今日） | ✅ 可用 |
| 👤 個人 | AI 生成知識卡 ✨（一鍵出卡 + 匯入複習） | ✅ 可用 |
| 👤 個人 | 閱讀清單 📖（年度挑戰 / 評分 / 統計） | ✅ 可用 |
| 👤 個人 | 習慣追蹤 🔥（連續日數 / 完成率） | ✅ 可用 |
| 👤 個人 | 健康追蹤 🫀（體重/睡眠/運動/飲水/心情 + 趨勢 + 目標） | ✅ 可用 |
| 👤 個人 | 健身中心 🏋️（體態數據 / 訓練記錄 / AI飲食 / AI教練 / 動作庫） | ✅ 可用 |
| 👤 個人 | 問我嘅資料 AI 🔮（基於你自己資料問答） | ✅ 可用 |
| 💼 工作 | BAFS 教學 AI 🤖（出題 / 教案 / 批改評語） | ✅ 可用 |
| 💼 工作 | 待辦 / 批改 ✅ | ✅ 可用 |
| 💼 工作 | 班別管理 🏫 | ✅ 可用 |
| 💼 工作 | 課程進度 📊（BAFS 商業管理課題） | ✅ 可用 |
| 💼 工作 | BAFS 題庫 🧩 | ✅ 可用 |
| 💼 工作 | 教學資源庫 🗂️ | ✅ 可用 |
| 💼 工作 | 成績管理 📈（成績表 + 弱項分析） | ✅ 可用 |
| 💼 工作 | 備課 / 教案 📋（教案編輯 + 範本） | ✅ 可用 |
| 💼 工作 | 時間表 🗓️（每週課堂） | ✅ 可用 |
| 💼 工作 | 點名 / 出席 🙋（出席率 / 統計） | ✅ 可用 |
| 💼 工作 | 家長溝通 ✉️（聯絡記錄 + 範本） | ✅ 可用 |
| 💼 工作 | 會議筆記 📝 | ✅ 可用 |
| 👤 個人 / 💼 工作 | 收支記帳 💰（分類 / 趨勢 / 預算，雙模式） | ✅ 可用 |
| 💼 工作 | 工作儀表板 📊 | ✅ 可用 |
| 💼 工作 | BAFS 教學 AI 🤖 / 問我嘅資料 AI 🔮 | ✅ 可用 |
| 兩者共用 | 行事曆 📅（Apple 級：月/週/日/年 + 重複 + 拖拉縮放） | ✅ 可用 |
| 兩者共用 | 全域搜尋 🔍 / 快速擷取 ⚡ / 重要日子倒數 ⏳ / 自我測驗 🧪 | ✅ 可用 |

> **Supabase 雲端 + Gemini AI 已接入。** Google 登入、資料雲端同步（全部 collection 自動同步）、AI 助手（兩個模式）都喺 code 度做好；
> 設定好你自己嘅 Supabase project + Gemini key 即可啟用，未設定時以「訪客模式」（資料存本機）運作。
> 一次性設定步驟見 **[`docs/SETUP.md`](docs/SETUP.md)**。

## 🛡️ 工程品質

- **無障礙（a11y）**：icon 按鈕有 aria-label、動態區 aria-live、toggle 有 aria-pressed/current；Modal 有 `role=dialog` + focus-trap + Esc 關閉；對話框/選單鍵盤可達。
- **手機 responsive**：27 個功能全部 375px 起無橫向溢出；表格橫捲、多欄手機收窄、觸控目標 ≥36px。
- **測試**：1200+ 個 vitest 單元測試（純函式 / 業務計算 / 行事曆重複引擎），GitHub Actions CI 每次 push 跑 build + test。
- **穩健**：Error Boundary 防單一功能崩潰拖垮全 app；空 / 邊緣資料有 guard。
- **效能**：每個功能 React.lazy 分包（code-split）+ idle 預載；vendor（react/supabase/lucide）獨立 chunk。
- **PWA**：可安裝、離線可用（vite-plugin-pwa + Workbox）。
- **深色模式**：navy-tinted slate，全功能支援。

## 💼 商業化

要由「個人自用」行去「多用戶 · 收費 · 可營運」？已接入 **Stripe 訂閱、Sentry 監控、PostHog 分析、行銷 / 定價頁**，全部**未設 env 就降級**，唔影響訪客模式。設定步驟 + Roadmap 見 **[`docs/COMMERCIALIZATION.md`](docs/COMMERCIALIZATION.md)**。

## 🚀 點樣行起

需要 Node.js 18 以上。

```bash
npm install      # 安裝套件（第一次）
npm run dev      # 開發模式，瀏覽器開 http://localhost:5173
npm run build    # 打包做正式版本（輸出到 dist/）
npm run preview  # 預覽打包後嘅版本
```

## 🛠️ 點樣加新功能

1. 喺 `src/features/learning/` 或 `src/features/work/` 整一個 React 元件。
2. 喺 `src/features/registry.ts` 嘅 `FEATURES` 陣列加項目：`id`、`name`、`icon`、`modes`、`group`、`component: lazyFeature(() => import('./...'))`（自動分包）。
3. 要持久化資料？喺功能資料夾用 `createCollection<T>('key', ...)`（會自動登記去 `collectionRegistry`，登入後一齊雲端同步 + 匯出）。
4. 搞掂！側邊欄、首頁概覽、⌘K 指令面板會自動顯示新功能。

想加多一個模式（例如「研究模式」）？喺 `src/modes/modes.ts` 嘅 `MODES` 加多一個就得。

## 📁 專案結構

```
src/
├── modes/modes.ts            # 模式定義（學習 / 工作、主題色）
├── context/                  # Mode / Auth / Settings / Toast / Confirm / Nav 狀態
├── lib/
│   ├── store.ts              # ★ createCollection（localStorage）+ collectionRegistry
│   ├── sync.ts               # 登入後逐 collection 雲端同步（last-write-wins）
│   ├── supabase.ts           # Supabase client + Google OAuth
│   └── ai.ts                 # Gemini 串流（經 Supabase Edge Function 代理）
├── ui/index.tsx              # ★ 共用元件庫（Button/Card/Modal/Table/EmptyState…）
├── features/
│   ├── registry.ts           # ★ 功能註冊表（React.lazy 分包 + 擴充中心）
│   ├── featureIcons.tsx      # lucide 圖示系統
│   ├── learning/  work/  shared/   # 功能（每個 = 主元件 + 同名子資料夾放 util/store/charts）
├── components/               # Sidebar / MobileTopBar / CommandPalette(⌘K) / ErrorBoundary
├── pages/Home.tsx            # 首頁概覽
└── App.tsx                   # 主框架（Suspense + ErrorBoundary + ⌘K）
```
