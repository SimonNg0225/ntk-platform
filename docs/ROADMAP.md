# NTK Platform · 發展藍圖 (Roadmap)

> 由「純前端 + 瀏覽器儲存」進化成「**雲端帳戶 + AI 助手**」嘅完整計劃。
> 加入兩塊新基建：**Supabase**（後端 / 資料庫 / 登入）同 **Gemini**（AI）。

---

## 目錄
1. [整體架構](#1-整體架構)
2. [⚠️ 安全原則（最重要）](#2-️-安全原則最重要)
3. [技術棧新增](#3-技術棧新增)
4. [資料模型（Supabase 資料表）](#4-資料模型supabase-資料表)
5. [AI 功能設計（兩個模式）](#5-ai-功能設計兩個模式)
6. [分階段計劃](#6-分階段計劃)
7. [環境變數 / 設定](#7-環境變數--設定)
8. [邊啲我做、邊啲你做](#8-邊啲我做邊啲你做)

---

## 1. 整體架構

```
┌─────────────────────────────────────────────┐
│  前端 (Vite + React, 部署喺 Vercel)            │
│  - UI / 模式切換 / 各功能                       │
│  - @supabase/supabase-js（用 anon key，安全）   │
└───────────┬──────────────────────┬────────────┘
            │ 登入 / 讀寫資料         │ 叫 AI（帶登入身份）
            ▼                       ▼
┌──────────────────────┐   ┌──────────────────────────┐
│  Supabase            │   │  Supabase Edge Function    │
│  - Auth（登入）       │   │  "gemini"（伺服器側）        │
│  - Postgres + RLS     │   │  - 收住 GEMINI_API_KEY      │
│  - Storage（檔案）     │   │  - 代理去 Gemini，key 唔出街 │
└──────────────────────┘   └───────────┬────────────────┘
                                        ▼
                                ┌────────────────┐
                                │  Gemini API     │
                                └────────────────┘
```

**重點**：前端永遠唔會直接接觸 Gemini key；所有 AI 呼叫經過 Edge Function 中轉。

---

## 2. ⚠️ 安全原則（最重要）

1. **Gemini API key 只可以放喺 Supabase Edge Function 嘅 secret**，絕對唔好放落前端。
   - 前端 code（包括所有 `VITE_` 開頭嘅變數）會打包入公開 JS，任何人都睇到。
   - 一旦個 key 出街 = 俾人免費碌你數。
2. **Supabase `anon key` 可以放前端** —— 佢係設計成公開嘅，配合 **RLS（Row Level Security）** 保證每個 user 只可以掂到自己嘅資料。
3. **Supabase `service_role` key 永遠唔好放前端**（佢可以繞過 RLS）。
4. 所有真 key 用 `.env.local`（已被 `.gitignore` 排除）或 Vercel / Supabase 嘅環境變數，**唔好 commit 入 git**。

---

## 3. 技術棧新增

| 套件 / 工具 | 用途 |
| --- | --- |
| `@supabase/supabase-js` | 前端連 Supabase（auth + DB） |
| Supabase CLI | 管理 migration、部署 Edge Function、設 secret |
| Supabase Edge Functions (Deno) | 伺服器側代理 Gemini |
| Gemini（`gemini-2.5-flash` 為主，複雜任務用 `gemini-2.5-pro`） | AI 生成 |
| （選用）`@tanstack/react-query` | 管理雲端資料的載入 / 快取 / 同步 |

---

## 4. 資料模型（Supabase 資料表）

全部表都有 `user_id`（= `auth.uid()`）+ **RLS policy**：「只可以 select/insert/update/delete 自己 user_id 嘅 row」。

| 表 | 主要欄位 | 對應功能 |
| --- | --- | --- |
| `profiles` | `id`(=auth uid), `display_name`, `role`, `subject` | 個人檔案（例如：教師 / BAFS） |
| `notes` | `id`, `user_id`, `content`, `created_at` | 學習筆記 |
| `goals` | `id`, `user_id`, `title`, `progress`, `created_at` | 學習目標 |
| `tasks` | `id`, `user_id`, `text`, `done`, `due_date` | 待辦 / 批改 |
| `classes` | `id`, `user_id`, `name`, `subject`, `students` | 班別管理 |
| `reading_items` | `id`, `user_id`, `title`, `url`, `status` | 閱讀清單 |
| `flashcards` | `id`, `user_id`, `deck`, `front`, `back` | 知識卡片（可由 AI 生成） |
| `ai_threads` | `id`, `user_id`, `mode`, `title`, `created_at` | AI 對話串 |
| `ai_messages` | `id`, `thread_id`, `role`, `content`, `created_at` | AI 對話內容 |

> 搬資料時：而家 localStorage 入面嘅示範資料，可以喺第一次登入時「一鍵匯入」上雲（選用）。

---

## 5. AI 功能設計（兩個模式）

### 📘 學習模式 — 個人學習夥伴
- **AI 問答**：傾偈式問問題，可以連住你嘅筆記做 context。
- **筆記總結**：揀一篇 / 多篇筆記 → Gemini 整理成重點 / 大綱。
- **生成知識卡**：俾一個主題或一段筆記 → 自動出一疊問答卡，存入 `flashcards`。

### 💼 工作模式 — BAFS 教學助手
- **出題機**：揀課題（會計 / 商業管理…）、難度、題型（MC / 短答 / 長題）→ 生成題目 + 參考答案。
- **教案大綱**：俾課題 + 節數 → 生成教學目標、流程、活動建議。
- **批改 / 評語助手**：貼學生答案 → 建議評語、改善方向、評分參考（老師最後決定）。

> 所有 AI 功能共用一個 Edge Function + 一個前端 AI 元件；唔同功能只係換 prompt / 參數。

---

## 6. 分階段計劃

### Phase 0 — 準備（你做，約 15 分鐘）
- [ ] 開一個 Supabase project，記低 `Project URL` + `anon key`
- [ ] 喺 Google AI Studio 攞一個 Gemini API key
- [ ] 裝 Supabase CLI（部署 Edge Function / migration 用）

### Phase 1 — Supabase 接入 + 登入
- [ ] 裝 `@supabase/supabase-js`，建立 supabase client（讀 env）
- [ ] `AuthContext` + 登入畫面（Email magic link，或 Google 登入）
- [ ] App 加「登入 / 訪客模式」分流：未登入可以用本機示範，登入後用雲端

### Phase 2 — 資料上雲
- [ ] 寫 SQL migration：建表 + RLS policy
- [ ] 整一個 `useSupabaseTable` hook，統一處理讀寫
- [ ] 將筆記 / 目標 / 待辦 / 班別由 localStorage 改成 Supabase
- [ ]（選用）首次登入「一鍵匯入本機資料」

### Phase 3 — Gemini AI 基建
- [ ] 寫 Edge Function `gemini`：驗證登入 → 代理去 Gemini（key 做 secret）
- [ ] 前端 `aiClient`（叫 Edge Function）+ 可重用嘅 AI 對話 UI 元件
- [ ]（進階）串流回應（streaming）令打字效果更順

### Phase 4 — AI 功能（兩個模式）
- [ ] 學習：AI 問答、筆記總結、生成知識卡
- [ ] 工作：BAFS 出題機、教案大綱、批改評語助手
- [ ] AI 對話歷史存入 `ai_threads` / `ai_messages`

### Phase 5 — 打磨
- [ ] AI 用量 / 速率限制、錯誤處理、loading 狀態
- [ ] 行事曆、資料匯出、深色模式（選用）
- [ ] 效能 / 無障礙 / 手機體驗再優化

---

## 7. 環境變數 / 設定

### 前端（`.env.local`，已被 gitignore；Vercel 都要設同樣兩個）
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...   # 公開安全
```

### Edge Function secret（用 Supabase CLI 設，唔會出街）
```
supabase secrets set GEMINI_API_KEY=AIza...
```

> ✅ 你只需要將 Gemini key 設做 Supabase secret，唔使喺對話度貼俾我。
> 前端嗰兩個（URL + anon key）放 `.env.local` / Vercel 環境變數即可。

---

## 8. 邊啲我做、邊啲你做

| 我（喺 code 度做） | 你（一次性設定） |
| --- | --- |
| 寫所有前端 code、hook、UI | 開 Supabase project |
| 寫 SQL migration（建表 + RLS） | 喺 Supabase 跑 migration（或畀我指示你貼 SQL） |
| 寫 Edge Function（Gemini 代理） | 用 CLI 部署 Function + 設 `GEMINI_API_KEY` secret |
| 寫設定文件 / 步驟指引 | 喺 Vercel + 本機設環境變數 |

> ⚠️ 因為呢個雲端開發環境連 Supabase / 外網有限制，我**冇辦法代你跑 migration 或部署 Function**；嗰幾步要你喺自己戶口做，我會逐步畀清楚指示。
