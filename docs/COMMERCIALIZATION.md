# 商業化指南（Commercialization）

呢份文件係 NTK Platform 由「個人自用」行去「商業化（多用戶 · 收費 · 可營運）」嘅
**設定步驟 + Roadmap**。

> TL;DR：所有商業化功能**未設 env 就降級**，唔影響現有訪客模式。
> 設好下面嘅 key 就逐項啟用。

---

## 1. 今次已經落地咗咩

| 範疇 | 內容 | 檔案 |
| --- | --- | --- |
| **套件** | Stripe / Sentry / PostHog / react-router / react-hook-form / zod / react-helmet-async | `package.json` |
| **路由** | `/` 行銷首頁、`/pricing` 定價、`/app/*` 產品 | `src/main.tsx`、`src/marketing/` |
| **錯誤監控 + 分析** | Sentry + PostHog，**動態 import**，未設 key 零 bytes | `src/lib/observability.ts` |
| **收費（前端）** | 方案定義、Checkout / 客戶中心、訂閱 hook | `src/lib/billing.ts`、`src/hooks/useSubscription.ts` |
| **多租戶（後端）** | `subscriptions` + `billing_events`，RLS 只讀自己 | `supabase/migrations/0002_commercialization.sql` |
| **收費（後端）** | Checkout / Portal + Webhook（Stripe 真相來源） | `supabase/functions/stripe-billing`、`stripe-webhook` |

設計原則：**前端只讀訂閱、永遠改唔到**；訂閱狀態只可以由 Stripe Webhook（service_role）寫入。

---

## 2. 一次性設定

### 2.1 跑 migration（多租戶訂閱表）

```bash
supabase db push        # 或喺 SQL editor 跑 supabase/migrations/0002_commercialization.sql
```

### 2.2 Stripe 收費

1. Stripe Dashboard → 建立 **Product + 月費 Price**（記低 `price_...`）。
2. 前端 env（`.env.local` + Vercel）：
   ```
   VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
   VITE_STRIPE_PRO_PRICE_ID=price_...
   ```
3. Edge Function secret（**唔好入前端**）：
   ```bash
   supabase secrets set STRIPE_SECRET_KEY=sk_live_...
   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
   supabase functions deploy stripe-billing
   supabase functions deploy stripe-webhook --no-verify-jwt
   ```
4. Stripe Dashboard → Webhooks → 加 endpoint：
   `https://<project-ref>.functions.supabase.co/stripe-webhook`
   訂閱事件：`checkout.session.completed`、`customer.subscription.updated`、
   `customer.subscription.deleted`。把 signing secret 填返上面 `STRIPE_WEBHOOK_SECRET`。

> `SUPABASE_SERVICE_ROLE_KEY` 喺 Supabase 部署 function 時自動注入，唔使手動設。

### 2.3 Sentry（錯誤監控，選用）

```
VITE_SENTRY_DSN=https://...ingest.sentry.io/...
```

### 2.4 PostHog（產品分析，選用）

```
VITE_POSTHOG_KEY=phc_...
VITE_POSTHOG_HOST=https://us.i.posthog.com
```

---

## 3. 功能 Gating（點樣鎖 Pro 功能）

`useSubscription()` 回 `{ isPro, plan, status }`，喺任何功能元件用：

```tsx
const { isPro } = useSubscription()
if (!isPro) return <UpgradePrompt />   // 例如 AI 無限額度、進階統計
```

> ⚠️ 前端 gating 只係 UX；**真正額度 / 權限要喺 Edge Function 側驗**
> （例如 gemini function 入面 check 訂閱），否則用戶可以繞過。見 Roadmap P1。

---

## 4. Roadmap

### P0 — 已完成
- [x] 路由 + 行銷 / 定價頁
- [x] Stripe 訂閱（Checkout / Portal / Webhook）
- [x] 多租戶訂閱表 + RLS（前端只讀）
- [x] Sentry + PostHog（零成本降級）
- [x] 機構級 SaaS 介面重設計 + 工作模式設預設（教師導向）
- [x] **多科課程包**：科目設定 + 各科起始課題大綱（見下）

#### 多科課程包（教師通用化）
- 科目包 registry：`src/data/subjects.ts`（`SubjectPack` + `SUBJECT_PACKS`）。
  BAFS 重用 `data/bafs.ts`，故預設 topics 種子同舊版一致（測試不變）。
- 任教科目設定：`SettingsContext.subjectPackId`（預設 `bafs`）。
- 設定頁「任教科目」：揀科目 → **附加** 或 **取代** 課題到 `topicsCol`。
- 教學 AI 自動以所選科目為語境（`AIAssistant` 注入 system prompt）。
- **加新科目包**：喺 `SUBJECT_PACKS` 加一項（`buildTopics(id, outline)`）即可，
  其餘功能（課程進度 / 題庫 / 自測）自動沿用。
- 起始大綱係精簡模板，未必涵蓋官方課程全部細項，老師可自行調整。

### P1 — 收費前必做
- [x] **Gemini Edge Function 加訂閱 / 額度檢查**（防 AI 成本被刷爆）
- [x] 免費版每日 AI 額度（`ai_usage` 表 + `consume_ai_quota` 原子函數）
- [x] Webhook 失敗告警（Resend email + 冪等回滾 → Stripe 重送）
- [x] 私隱政策 + 服務條款頁
- [x] Cookie / 分析同意

#### AI 額度（防成本爆）
- migration `0003_ai_usage.sql`：`ai_usage` + `consume_ai_quota(p_user, p_limit)`。
- `gemini` Edge Function：先用 service_role 查 `subscriptions`，Pro 不限；
  免費版每次呼叫原子遞增當日用量，超額回 **429**（前端顯示「升級 Pro」訊息）。
- 上限由 env `AI_DAILY_FREE_LIMIT`（預設 20）控制：
  `supabase secrets set AI_DAILY_FREE_LIMIT=20` 後 `supabase functions deploy gemini`。
- **測試白名單**：`AI_UNLIMITED_EMAILS`（逗號分隔）內嘅 email 跳過每日額度
  （等同 Pro 無限）；未設就退回 `ADMIN_EMAILS`。方便未接付款前測試。
  `supabase secrets set AI_UNLIMITED_EMAILS=you@example.com` 後重新部署 gemini。
- 跑 migration：`supabase db push`（含 0003）。

#### 交易 Email + Webhook 告警（Resend）
- 共用 helper `supabase/functions/_shared/email.ts`（`sendEmail` / `alertAdmin` + 範本）。
- `stripe-webhook`：升級 → 寄「歡迎 Pro」；取消 → 寄取消通知；
  **處理失敗 → 刪冪等記錄 + email 告警 admin + 回 500（Stripe 自動重送）**。
- secret（未設 → email 靜靜 no-op，唔影響收費邏輯）：
  ```bash
  supabase secrets set RESEND_API_KEY=re_...
  supabase secrets set RESEND_FROM='NTK Platform <noreply@你的網域>'
  supabase secrets set ADMIN_ALERT_EMAIL=you@example.com
  supabase functions deploy stripe-webhook --no-verify-jwt
  ```

#### E2E 測試（Playwright）
- `playwright.config.ts` + `e2e/*.spec.ts`：行銷 → 定價 → **付費入口**
  （未設 Stripe 時撳「升級 Pro」彈「即將推出」）→ 私隱/條款 → 進入 App。
- 本地 / CI：`npm run test:e2e`（首次要 `npx playwright install chromium`）。
- CI：`.github/workflows/e2e.yml`（PR + 手動觸發，與單元測試分開）。

### P2 — 營運
- [x] 交易 email（收據 / 取消）→ Resend
- [x] E2E 測試覆蓋付費流程 → Playwright
- [x] 客服系統：自家 in-app 聯絡表單（即裝即用）+ Crisp 即時聊天（選用）

#### 客服系統
- **自家表單**（預設）：app 右下角浮動掣 → 聯絡表單。登入用戶提交 →
  `support` Edge Function 存 `support_tickets`（`0006_support.sql`）+ email 客服
  （Resend，reply-to = 用戶）；未登入 / 未接 Supabase → mailto fallback。
- **Crisp 即時聊天**（選用）：設 `VITE_CRISP_WEBSITE_ID` → 同意 Cookie 後載入，
  取代自家浮動掣。
- 部署：
  ```bash
  supabase db push                       # 含 0006
  supabase functions deploy support
  supabase secrets set SUPPORT_EMAIL=help@你的網域   # 未設則用 ADMIN_ALERT_EMAIL
  ```
  （email 通知要 `RESEND_API_KEY`；未設 → ticket 照存，唔出 email。）
- [x] PostHog 漏斗：`landing_cta_click` → `signup_started` → `checkout_started`（+ `app_opened`）
- [x] 多語言 i18n（react-i18next）：行銷 + **全導航層雙語**
  （Landing / 定價 / 私隱 / 條款 / Cookie / 設定 + 側欄 / 首頁 / ⌘K / 功能名稱·描述·分組·模式 / 帳戶·方案）。
  資源：`src/i18n/appEn.ts`（en 用 feature id 做 key，zh-HK 靠 `defaultValue` 回退 → E2E 不變）。
  各功能**內部** UI 逐字翻譯為漸進工作（t() 模式已建立，照 namespace 加 key 即可）

### P3 — 規模化
- [x] Feature flags / 灰度發佈（PostHog）：`useFeatureFlag(key)`（未同意/未配置 → fallback）
- [x] 年費方案 + 折扣碼（`VITE_STRIPE_PRO_ANNUAL_PRICE_ID` + 定價切換；Checkout 已開 `allow_promotion_codes`）
- [x] 團隊 / 多座位方案（seats）：建團隊 / 邀請 / 成員管理 / 座位 checkout 完整流程

#### 團隊 / 多座位（seats）
- 資料：`0004_orgs.sql`（orgs / org_members）+ `0005_org_invites.sql`
  （org_invites + RPC：`create_org` / `list_org_members` / `create_org_invite`
  / `accept_org_invite` / `remove_org_member`，全 SECURITY DEFINER + 座位上限）。
- UI：工作模式「團隊 / 座位」功能（`src/features/work/Team.tsx`）—— 建團隊、
  邀請連結（`/app?invite=token`）、成員管理、座位用量。
- 計費：`team-billing` Edge Function（Stripe quantity = 座位數，metadata 帶 org_id）；
  `stripe-webhook` 收到帶 `org_id` 嘅 subscription 事件 → 更新 `orgs.seats`。
- 部署：
  ```bash
  supabase db push                       # 含 0004 / 0005
  supabase functions deploy team-billing
  supabase secrets set STRIPE_TEAM_PRICE_ID=price_...（按座位計費嘅 price）
  ```
  前端 `VITE_STRIPE_TEAM_PRICE_ID` 設咗，「增加座位」先會開 Stripe；未設 → 提示「即將推出」。

> 圖例：[x] 完成 · [~] 基礎已落地、餘下漸進工作 · [ ] 未做

---

## 5. 安全備註

- **訂閱真相只信 Stripe Webhook**：前端 / 客戶端永遠改唔到 `subscriptions`
  （RLS 只開 select；寫入要 service_role）。
- **唔好喺前端放** `service_role` / `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`。
- Webhook 用簽名驗證 + `billing_events` 冪等去重，防偽造 / 重送。
- 收費前一定要做 **P1 嘅 AI 額度檢查**，否則 Gemini API 費用係主要蝕錢風險。
