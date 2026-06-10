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
2. 逐個打開並執行本 repo `supabase/migrations/` 入面嘅檔案（由細到大）：
   - [`0001_init.sql`](../supabase/migrations/0001_init.sql) — `app_rows`（通用資料表）+ RLS
   - [`0002_commercialization.sql`](../supabase/migrations/0002_commercialization.sql) — `subscriptions` + `billing_events`（收費，選用）
   - [`0003_ai_usage.sql`](../supabase/migrations/0003_ai_usage.sql) — `ai_usage` + 每日 AI 額度（選用）
   每個檔案**全選貼上 → Run**。（裝咗 Supabase CLI 嘅話，一句 `supabase db push` 可全部跑晒。）
3. 入 **Table Editor**，應該見到 `app_rows` 表，而且 **RLS 係 enabled**。

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
2. **Authentication → URL Configuration**（⚠️ 最易撞板，睇清楚）：
   - **Site URL**：登入後嘅「預設」回流地址。開發用 `http://localhost:5173`，
     上線**必須**改成你嘅正式網域（例如 `https://ntk-platform.vercel.app`）。
     > 唔改嘅話，真實用戶喺正式網站登入完會被掟返去 `localhost`。
   - **Redirect URLs**：用萬用字元加齊各環境（一行一個）：
     ```
     http://localhost:5173/**
     https://你的正式網域/**
     ```
     > Supabase 只接受喺呢個白名單入面嘅 `redirectTo`；唔喺名單就會
     > **fallback 去 Site URL**。本 App 嘅 `redirectTo` 用根目錄（最穩陣），
     > 落到 `/` 之後會**自動轉去 `/app`**，所以即使你只加咗根網域都 work。
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

完成後，登入狀態下入「🤖 個人 AI 助手」/「🤖 教學 AI」就傾到偈（streaming 打字效果）。

> 收費 / AI 每日額度 / Resend 交易 email 等商業化設定，見 [`docs/COMMERCIALIZATION.md`](./COMMERCIALIZATION.md)。

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
| 登入後跳去 `localhost/#access_token=…` 卡住 | 正常！App 會自動處理 token 並轉去 `/app`。若真係卡住：① Site URL 仲係 `localhost`（上線要改成正式網域）；② Redirect URLs 未用 `/**` 加齊；③ 用咗舊版前端（`git pull` 取最新版） |
| 上線後登入掟返 localhost | Supabase **Site URL** 仲係 `http://localhost:5173`，改成正式網域 |
| 登入後資料無同步 | SQL migration 未跑；或 RLS policy 唔啱（用步驟 2 個 SQL 重跑一次） |
| AI 回 401「請先登入」 | 未登入，或 session 過期 → 重新登入 |
| AI 回 404 / 搵唔到服務 | `gemini` function 未部署（`supabase functions deploy gemini`） |
| AI 回 500「未設定 GEMINI_API_KEY」 | 未設 secret（`supabase secrets set GEMINI_API_KEY=...`） |
| AI 回 502 Gemini 錯誤 | key 唔啱 / 額度問題 / model 名唔啱（預設 `gemini-2.5-flash`） |
| function CORS error | 確認用緊本 repo 版本嘅 function（已加 CORS header），重新 deploy |

> 睇 function log 除錯：`supabase functions logs gemini`

---

## 📂 Google Drive 整合（教學資源庫 · 選用）

令「教學資源庫」可以直接連你 Google Drive 一個資料夾，**live 瀏覽 / 搜尋 / 開檔**（唯讀，跨裝置）。未設定都唔影響其他功能（會顯示降級提示）。

### 你喺 Google Cloud 要做（一次過）

1. 去 [console.cloud.google.com](https://console.cloud.google.com) → 建（或揀）一個 project。
2. **API 和服務 → 程式庫** → 搵「Google Drive API」→ **啟用**。
3. **API 和服務 → OAuth 同意畫面**：
   - User Type 揀 **外部** → 建立。
   - 填 App 名 / 你嘅支援 email。
   - **發布狀態保持「測試中」**（唔使 Google 審核）。
   - **測試使用者** 加你自己（同想用嘅同事）email，上限 100 個。
4. **API 和服務 → 憑證 → 建立憑證 → OAuth 用戶端 ID**：
   - 應用程式類型：**網頁應用程式**。
   - **已授權的 JavaScript 來源** 加：
     - `https://<你嘅 Vercel 網域>`（例如 `https://ntk-platform.vercel.app`）
     - `http://localhost:5173`（本機開發用）
   - 建立後 **抄低「用戶端 ID」**（樣式：`xxxx.apps.googleusercontent.com`）。
5. 設定環境變數 `VITE_GOOGLE_CLIENT_ID`：
   - **Vercel**：Project → Settings → Environment Variables → 加 `VITE_GOOGLE_CLIENT_ID` = 你個用戶端 ID → **Redeploy**。
   - **本機（選用）**：`.env.local` 加 `VITE_GOOGLE_CLIENT_ID=...`。

### 用法

- 教學資源庫頂部切去 **「Google Drive」** → 撳 **連接 Google Drive** → Google 授權彈窗（你自己登入，app 攞唔到你密碼）。
- 之後可以入資料夾、用檔名搜尋、一撳喺新分頁開檔。電腦／手機（含 Safari / iPhone）用同一個 Google 帳號授權都見到。

### 注意

- **唯讀**：app 唔會改 / 刪 / 上載你 Drive 嘅嘢。
- **scope** 用 `drive.readonly`（敏感）→ 所以保持 OAuth「測試中」模式（你 + 測試使用者用得）。
- token 約 1 小時，過期撳返「連接」即可。
- client ID 係**可以公開**嘅，放前端無問題（OAuth token flow 唔涉及 secret）。

---

### 教學簡報 — 圖庫搜尋（選用）

簡報生成可用 Pexels 免費圖庫搜圖。喺環境變數加：

    VITE_PEXELS_API_KEY=你嘅_pexels_key

未設定時，圖庫搜尋會自動停用（仍可用內建插圖／上載圖片）。
申請：https://www.pexels.com/api/

.pptx 匯出純前端（PptxGenJS），無需任何設定／API key；撳「匯出 PPTX」即下載可編輯嘅 PowerPoint。

圖片上載會喺瀏覽器自動縮細並內嵌入簡報（data URL），毋須額外雲端儲存設定。

亦可喺「教學簡報 → 由教案」分頁，揀一份備課教案一鍵轉成簡報初稿，再用編輯器微調。
