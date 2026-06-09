# EziTeach 商業化就緒審計（Launch Readiness Audit）

> 日期：2026-06-09 · 狀態：審計完成，待修
> 方法：5 個並行 agent 讀真碼審計（billing / 安全 / 部署 / 信任合規 / 產品缺口），全部有 file:line 實證。
> 圖例：🛠️ = code 側可改 · 🧑‍💼 = operator / 商業決策要做

---

## TL;DR

商業化基建**已經好成熟**（遠超一般 side-project）：Stripe 全管道、RLS deny-by-default（零越權、零秘密外洩）、**AI 每日額度後端真 enforce（刷唔穿）**、客服系統、法律頁（對齊 PDPO）、Cookie consent 真 gating、PostHog/Sentry、交易 email 已建。

**唔係由零做。** 缺口好具體，集中三類：**收入漏洞、合規、配置**。下面按優先級列。

---

## ✅ 已完成（穩固地基，唔使再做）

- **Stripe**：checkout / customer portal / webhook（簽名驗證 + `billing_events` 冪等 + 失敗回滾 + admin 告警）/ 折扣碼（`allow_promotion_codes`）/ 團隊座位（`quantity=seats`）。`supabase/functions/{stripe-billing,stripe-webhook,team-billing}/index.ts`
- **訂閱真相只由 webhook 寫**：`subscriptions` 表 RLS 只 `select own`、無前端寫 policy → 前端改唔到自己 plan。`migrations/0002_commercialization.sql:31-37`
- **AI 每日額度後端 enforce**：`consume_ai_quota()` SECURITY DEFINER 原子 check+increment（`for update` 鎖防並發），超額回 429。前端唯一 AI 入口 `lib/aiClient.ts`（71 call sites）全經 gemini function，**無前端 API key、刷唔穿**。`migrations/0003_ai_usage.sql` + `functions/gemini/index.ts:104-135`
- **RLS deny-by-default**：`app_rows` 嚴格 `user_id = auth.uid()`，租戶間零資料混合；無任何 migration disable RLS / grant anon。`migrations/0001_init.sql`、`lib/sync.ts`
- **秘密管理（public repo）乾淨**：源碼零硬編秘密、`dist/` 零洩漏、`.env` 已 gitignore、`VITE_` 全部係可公開值。
- **客服系統**：工單 → `support_tickets`（RLS）→ Resend email；admin 收件箱（server-side `ADMIN_EMAILS` 白名單）。`functions/{support,support-admin}`
- **法律頁**：Privacy（8 節，明確引用香港 PDPO 第 486 章）+ Terms（12 節，含 AI 免責 / 自動續訂披露 / 退款）。雙語。`marketing/{Privacy,Terms}.tsx` + `i18n/index.ts`
- **Cookie consent 真 gating**：PostHog 動態 import，`consent==='accepted'` 先載入。`lib/observability.ts:46-69`
- **自助取消訂閱**：Stripe Billing Portal。`functions/stripe-billing/index.ts:103-109`

---

## 🔴 P0 — 收費前必修（Launch Blocker）

### 1. `NTK` 測試後門（收入漏洞）🛠️
定價頁打「NTK」即 client-side 解鎖全部 Pro，**無 dev gate、已 ship 入生產 bundle**（已驗 `dist` 含 `NTK`/`testPro` 字串）。任何訪客免費攞 Pro 體驗。
- 檔案：`src/lib/testPro.ts`、`src/hooks/useSubscription.ts:85`、`src/marketing/Pricing.tsx:40,220-259`
- 修法：用 `import.meta.env.DEV` 包住 / 隱藏推廣框 / 改成真・server 驗證推廣碼。
- 緩解：server AI 額度仍按真訂閱，所以唔白嫖 AI；但所有**非 AI Pro gating 失守**。

### 2. Pro 功能 0 gate（付費無誘因 + 虛假宣傳風險）🛠️🧑‍💼
除 AI 額度外，`billing.ts` 列嘅所有 Pro 賣點（多裝置同步 / 進階統計 / 匯出 / 優先客服）**免費版完全冇被擋**（全 codebase 冇 feature component 用 `isPro` gate）。
- 檔案：`src/lib/billing.ts:76-82`、`src/hooks/useSubscription.ts`、`src/components/{PlanBadge,AccountBox}.tsx`
- **商業決策**（先決定先做）：要麼真 `isPro` gate 呢啲功能逼人畀錢，要麼改 Pro 賣點 copy 至只承諾「無限 AI（+ 優先客服）」——目前唯一真差異。

### 3. 無「刪除帳戶」（PDPO 合規缺口）🛠️
私隱政策 s5 承諾可刪除個資，但產品冇途徑。Settings「清除所有資料」只清 `app_rows.data` 內容，**唔刪 Supabase Auth user / 唔刪 `subscriptions`/`support_tickets`/`org_members` 行**（仍含 user_id/email）。處理學生資料嘅平台尤其敏感。
- 檔案：`src/pages/Settings.tsx:163`、`src/lib/sync.ts`
- 修法：新 Edge Function（service_role）刪 auth user + 該 user 全部表行；Settings 加入口 + 二次確認。

### 4. 對外 email 全部 `.example` 假網域 🛠️ + 🧑‍💼
`privacy@` / `support@` / `noreply@eziteach.example` 係 RFC-2606 保留假網域，**永遠收唔到信** → 法律頁法定聯絡途徑 + 客服實際失效。
- 檔案：`marketing/Privacy.tsx:69`、`marketing/Terms.tsx:61`、`lib/support.ts:17`、`functions/_shared/email.ts:13`、`.env.example:36`
- 修法：🛠️ 改成真網域信箱 + 🧑‍💼 你提供真信箱。

### 5. Email deliverability 零設定 🧑‍💼
無 SPF / DKIM / DMARC / 寄件網域驗證任何文檔 → 歡迎/收據/客服信好可能入 spam 或被拒。
- 修法：Resend 驗證寄件網域 + 加 SPF/DKIM DNS + 設 DMARC；`docs/COMMERCIALIZATION.md` 補 DNS 步驟。

### 6. DB backup（商業營運紅線）🧑‍💼
Supabase **Free plan 無自動 backup**。開始收費 + 存學生成績後，一次意外 = 不可逆 + 法律責任。
- 修法：升 Supabase Pro（日 backup + PITR）並**驗證 restore**。

### 7. 上線配置（documented，但唔做就上唔到線）🧑‍💼
- **Supabase Auth Site URL 改正式網域**（唔改＝登入後被掟返 localhost，最高頻故障）
- **`GEMINI_API_KEY` + deploy gemini function**（唔做＝全 AI 賣點死）
- **`AI_DAILY_FREE_LIMIT`**（唔設＝免費用戶刷爆你 Gemini 帳單，主要蝕錢風險）
- **Stripe**：建 Product/Price → `VITE_STRIPE_PRO_PRICE_ID`（缺＝定價頁「即將推出」收唔到錢）+ `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` + webhook endpoint + 開 Customer Portal + **`stripe-webhook --no-verify-jwt`** 部署
- **跑齊 6 個 migration**（0001→0006；漏 0003＝AI 額度 RPC 唔存在）
- 詳見 `docs/SETUP.md` + `docs/COMMERCIALIZATION.md`（已有完整步驟）

---

## 🟠 P1 — 上線前應修

### 8. 團隊邀請 token 漏洞（賣座位前必修）🛠️
`accept_org_invite` 接受邀請**唔驗 email**（任何攞到 token 嘅登入用戶都可加入佔座位）、**無到期**、座位上限有 **TOCTOU race**（並發可超賣）；token 經 RLS 畀全 org 成員讀到 + UI 可複製。
- 檔案：`migrations/0005_org_invites.sql:93-109`
- 修法：accept 時驗 `auth.users.email == inv.email`；加 `expires_at`（如 7 日）；座位上限原子化（`insert...select...where count < cap`）。
- 註：目前 team 唔 share 資料（見 #12），所以暫時係「座位/計費繞過」；一旦團隊共享上線即升級為資料越權。

### 9. PostHog 入咗用戶 email（PII）+ autocapture 預設開 🛠️
`identifyUser` 將真人 email 送入 PostHog person property；autocapture 無關 / 無 mask，學生姓名/成績可能經 DOM text 入 analytics。
- 檔案：`src/context/AuthContext.tsx:58`、`src/lib/observability.ts:49-54,109`
- 修法：移除 email trait（或 hash / 只留 userId）；設 `autocapture:false` 或 `mask_all_text`。

### 10. 無 `invoice.payment_failed` 處理 🛠️
webhook 只處理 checkout/subscription updated/deleted。信用卡過期、續費失敗（`past_due`）即時降級但**用戶收唔到任何通知**。
- 檔案：`functions/stripe-webhook/index.ts:107`
- 修法：加 `invoice.payment_failed` → 通知 email。

### 11. CORS 收緊 + function rate-limit 🛠️
所有 function `Access-Control-Allow-Origin: '*'`；`support`/`stripe-billing` 無節流（可刷 ticket / Stripe customer / Resend email 成本）。
- 修法：CORS allowlist 正式 domain；support/billing 加每 user 簡單節流。

---

## 🟢 P2 — 體驗 / 規模化

- **英文 i18n 未完成** 🛠️：`appEn.ts` 只 187 行，646 句 inline 廣東話 defaultValue + 113 個檔 raw 中文 → 切英文大量 fallback 顯示中文。**淨係打中文市場就唔急**。
- **團隊方案賣咗座位但成員間未 share 資料** 🛠️🧑‍💼：`org_id` 前端零使用，`app_rows` 全 user-scoped → 要諗清楚 team 賣咩 value。
- **Ops 缺口**：零 staging、CI 唔 gate lint/typecheck（無 ESLint config）、e2e 唔卡 main、無 health check / uptime 監控、部署全人手、`package.json` 無 `engines` pin。
- **交易 email 缺收據信 + 團隊邀請信**（目前邀請靠 copy link，無自動寄）。
- **docs 品牌殘留「NTK Platform」**（SETUP/COMMERCIALIZATION/`alertAdmin` 主旨 `[NTK Alert]`）→ 更新做 EziTeach。
- **OnboardingModal / SupportButton / Settings 多數 UI 仍 hardcode 廣東話**（i18n 漸進中）。

---

## 🔑 Operator 配置清單（env / Stripe / Supabase / DNS）

### 前端 `VITE_*`（Vercel env，可公開）
| 變數 | 必需性 | 漏設後果 |
|---|---|---|
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | **必需** | 全 app 訪客模式（無登入/同步/AI） |
| `VITE_STRIPE_PRO_PRICE_ID` | 收費必需 | 定價頁「即將推出」，收唔到錢 |
| `VITE_STRIPE_PRO_ANNUAL_PRICE_ID` | 選用 | 無月/年切換 |
| `VITE_STRIPE_TEAM_PRICE_ID` | 選用 | 買唔到座位 |
| `VITE_GOOGLE_CLIENT_ID` | 選用 | 資源庫 Google Drive 分頁停用 |
| `VITE_SENTRY_DSN` / `VITE_POSTHOG_KEY` (+`_HOST`) | 選用 | 無錯誤監控 / 無分析（盲飛） |
| `VITE_ADMIN_EMAILS` / `VITE_SUPPORT_EMAIL` / `VITE_CRISP_WEBSITE_ID` | 選用 | 客服收件箱可見性 / fallback |

### Edge Function secrets（`supabase secrets set`，永不入前端）
| 變數 | 用途 | 必需性 |
|---|---|---|
| `GEMINI_API_KEY` | AI | **必需** |
| `AI_DAILY_FREE_LIMIT`（預設 20） | 防刷爆 | **強烈建議** |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | 收費 | 收費必需 |
| `STRIPE_TEAM_PRICE_ID` | 團隊座位 | 團隊必需 |
| `RESEND_API_KEY` / `RESEND_FROM` / `ADMIN_ALERT_EMAIL` / `SUPPORT_EMAIL` | 交易 email | 選用（未設→email no-op） |
| `ADMIN_EMAILS` | 客服收件箱權限 | 客服必需 |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_ANON_KEY` | 全 function | 自動注入 |

### 部署步驟摘要
1. Supabase project（Singapore）→ 跑齊 migrations 0001–0006
2. Google OAuth → **Auth Site URL + Redirect URLs 設正式網域**
3. `supabase functions deploy {gemini,stripe-billing,stripe-webhook,team-billing,support,support-admin,calendar-feed}`（webhook 同 calendar-feed 要 `--no-verify-jwt`）
4. `supabase secrets set ...`（上表）
5. Stripe Dashboard：Product/Price + Webhook endpoint + 開 Customer Portal
6. Vercel：`VITE_*` env + 部署 + Google/Supabase redirect 加 Vercel 網域
7. 🧑‍💼 升 Supabase Pro（backup）+ Resend 驗網域（SPF/DKIM/DMARC）

---

## ❓ 待定商業決策

- **Pro 點賣？**（決定 #2 點做）
  - (A) 真 gate 功能（同步/統計/匯出）逼人畀錢 → 要逐個功能加 `isPro` gate + upgrade prompt
  - (B) Pro 只賣「無限 AI（+ 優先客服 / 年費折扣）」→ 改 Pro 賣點 copy，唔使 gate 功能
- 團隊方案賣咩 value（目前無共享資料）？
- 主打中文市場定要英文版（決定 P2 i18n 急唔急）？

---

## 修補建議順序（畀 launch）

1. 🛠️ **封 `NTK` 後門**（#1）— 5 分鐘止血
2. 🧑‍💼 **決定 Pro 點賣**（#2）→ 跟住 🛠️ gate 功能 或 改 copy
3. 🛠️ **加「刪除帳戶」**（#3）
4. 🛠️ **換走 `.example` email**（#4，你提供真信箱）+ 🛠️ **`invoice.payment_failed` 通知**（#10）
5. 🛠️ **邀請 token 綁 email + 到期 + 座位 race**（#8，賣團隊前）
6. 🛠️ **PostHog PII / autocapture**（#9）
7. 🧑‍💼 配置清單 + DNS + Supabase Pro backup（#5,6,7）

---

*來源：2026-06-09 五路並行 code 審計。所有 file:line 以當時 HEAD `f99e938` 為準；修改後行號或變。*
