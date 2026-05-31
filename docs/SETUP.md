# NTK Platform · 接入 Supabase + Gemini 設定指引

> 呢份係「**你要親手做**」嘅清單。code 我已經寫晒，但建 project、跑 SQL、部署 function、設 key 呢幾步要喺你自己嘅帳戶做。
> 由零開始，照住做一次就得。預計 30–45 分鐘。

完成之前，App 會繼續以「**訪客模式**」運作（資料存喺瀏覽器），唔會壞 —— 所以你可以分段慢慢做。

---

## 📋 一覽：要攞嘅 3 樣嘢

| 要攞 | 喺邊度攞 | 放邊 |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Supabase → Project Settings → API | `.env.local`（+ Vercel） |
| `VITE_SUPABASE_ANON_KEY` | 同上（anon public key） | `.env.local`（+ Vercel） |
| `GEMINI_API_KEY` | Google AI Studio | Supabase secret（**唔好**放前端） |

⚠️ **安全底線**：`GEMINI_API_KEY` 同 Supabase `service_role` key **永遠唔好**放前端 / 唔好 commit。只有上面兩個 `VITE_` 開頭嘅先可以放前端。

---

## 步驟 1 — 開 Supabase project + 攞前端 key

1. 去 <https://supabase.com> 開個帳戶，撳 **New project**（地區揀近啲嘅，例如 Singapore；記住個 database password）。
2. 等 project 起好（約 2 分鐘）。
3. 入 **Project Settings → API**，抄低：
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public** key → `VITE_SUPABASE_ANON_KEY`
4. 喺 project 根目錄整個 `.env.local`（已被 git 排除）：

   ```bash
   cp .env.example .env.local
   ```

   填入：

   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGci...
   ```

5. 重開 `npm run dev`。左下角應該由「訪客模式」變成「用 Google 登入」掣（登入要做完步驟 3 先 work）。

---

## 步驟 2 — 跑 SQL migration（建資料表 + RLS）

1. 喺 Supabase 左邊揀 **SQL Editor → New query**。
2. 打開本 repo 嘅 [`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql)，**全選貼上**，撳 **Run**。
3. 入 **Table Editor**，應該見到一張 `app_rows` 表，而且 **RLS 係 enabled**。

> 呢張表用一個通用結構存晒所有功能嘅資料（筆記、目標、待辦、AI 對話…）。RLS policy 保證每個 user 只掂到自己嘅資料。

---

## 步驟 3 — 設定 Google 登入

要兩邊夾：Google Cloud 整 OAuth client、Supabase 填返入去。

### 3a. Supabase 側攞 callback URL
1. Supabase → **Authentication → Providers → Google** → 揭開。
2. 抄低佢顯示嘅 **Callback URL**（樣似 `https://xxxx.supabase.co/auth/v1/callback`）。

### 3b. Google Cloud 整 OAuth client
1. 去 <https://console.cloud.google.com> → 新建（或揀）一個 project。
2. **APIs & Services → OAuth consent screen**：揀 External，填 app 名 + 你嘅 email，儲存（測試階段加自己做 test user 就得）。
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**：
   - Application type：**Web application**
   - **Authorized JavaScript origins**：
     - `http://localhost:5173`
     - 你嘅 Vercel 網域（例如 `https://ntk-platform.vercel.app`）
   - **Authorized redirect URIs**：貼返步驟 3a 抄低嗰個 Supabase **Callback URL**
4. 攞到 **Client ID** + **Client secret**。

### 3c. 填返入 Supabase
1. 返 Supabase → **Authentication → Providers → Google**，貼入 Client ID + Client secret，**Enable** + Save。
2. **Authentication → URL Configuration**：
   - **Site URL**：開發用 `http://localhost:5173`（上線改成 Vercel 網域）
   - **Redirect URLs**：加 `http://localhost:5173` 同你嘅 Vercel 網域
3. 返 App 撳「用 Google 登入」測試。登入後資料會自動由本機 seed 上雲、之後改動自動同步。

---

## 步驟 4 — 部署 Gemini Edge Function

### 4a. 攞 Gemini API key
去 <https://aistudio.google.com/app/apikey> → **Create API key**，抄低（`AIza...`）。

### 4b. 裝 Supabase CLI
```bash
# macOS（Homebrew）
brew install supabase/tap/supabase

# 其他平台見 https://supabase.com/docs/guides/cli
supabase --version
```

### 4c. 連結 project + 部署
喺 project 根目錄：
```bash
supabase login                       # 會開瀏覽器登入
supabase link --project-ref <你的 project ref>   # ref 喺 Project Settings → General
supabase functions deploy gemini     # 部署本 repo 嘅 supabase/functions/gemini
```

### 4d. 設 Gemini key 做 secret（重點：唔出前端）
```bash
supabase secrets set GEMINI_API_KEY=AIza...你的key
```

> 改完 secret 之後，function 會自動用新值，唔使重新部署。

完成後，登入狀態下入「🤖 學習夥伴 AI」/「🤖 BAFS 教學 AI」就傾到偈（streaming 打字效果）。

---

## 步驟 5 — Vercel（上線用）

喺 Vercel → 你個 project → **Settings → Environment Variables** 加返同樣兩個：
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```
（**唔使**喺 Vercel 放 Gemini key —— 佢淨係喺 Supabase。）
記得喺步驟 3 嘅 Google origins / Supabase Redirect URLs 都加埋 Vercel 網域。

---

## ✅ 驗證清單

- [ ] `.env.local` 填好兩個 `VITE_` 變數，左下角出到登入掣
- [ ] `app_rows` 表存在 + RLS enabled
- [ ] Google 登入成功，登入後 reload 仲喺登入狀態
- [ ] 喺一部機改資料、另一部機（或無痕視窗）登入同一帳戶睇到同步
- [ ] AI 助手傾到偈，登出後顯示「請先登入」

---

## 🧯 疑難排解

| 症狀 | 多數原因 / 解決 |
| --- | --- |
| 撳登入無反應 / redirect 錯 | Google 嘅 redirect URI 同 Supabase Callback URL 對唔上；Supabase 嘅 Redirect URLs 未加你個網域 |
| 登入後資料無同步 | SQL migration 未跑；或 RLS policy 唔啱（用步驟 2 個 SQL 重跑一次） |
| AI 回 401「請先登入」 | 未登入，或 session 過期 → 重新登入 |
| AI 回 404 / 搵唔到服務 | `gemini` function 未部署（`supabase functions deploy gemini`） |
| AI 回 500「未設定 GEMINI_API_KEY」 | 未設 secret（`supabase secrets set GEMINI_API_KEY=...`） |
| AI 回 502 Gemini 錯誤 | key 唔啱 / 額度問題 / model 名唔啱（預設 `gemini-2.5-flash`） |
| function CORS error | 確認用緊本 repo 版本嘅 function（已加 CORS header），重新 deploy |

> 睇 function log 除錯：`supabase functions logs gemini`
