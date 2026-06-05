# 手機/iPad 原生提醒 — 訂閱式 .ics 日曆 feed + quick-add 重複偵測 設計 spec

> 日期：2026-06-04 · 狀態：已 brainstorm → spec → workflow
> 目標：iPhone / iPad 到時間收到**原生提醒**，靠訂閱式 .ics feed（Apple 日曆原生鬧鐘），唔搞 web-push。

## 已拍板（brainstorm）

- 通知方案：**訂閱式 .ics 日曆 feed**（Supabase Edge Function 回 live .ics + VALARM）→ iPhone/iPad 訂閱一次 → Apple 日曆自動同步 + 原生彈提醒。
- 順便：quick-add **重複偵測**（每日 / 每週X → recurrence + RRULE）。

## 已有可重用

- `src/features/shared/calendar/ics.ts`：已生成 .ics，含 **VALARM**（alertMinutes → TRIGGER:-PTnM）。
- `eventsCol`('events') / `countdownsCol`('countdowns')；`CalendarEvent` 有 `recurrence: RecurrenceRule {freq,interval,until,count,byWeekday}`、`alertMinutes`。
- Supabase + Edge Function（已有 `supabase/functions/gemini`）→ 可再 deploy function。Edge Function 自動有 `SUPABASE_SERVICE_ROLE_KEY` env。

## 架構

### 1. Edge Function `supabase/functions/calendar-feed/index.ts`（Deno）
- 入口：`GET ...?token=<userToken>`。
- 用 service_role 查 `app_rows`：搵 `collection='calendar_feed'` 且 `data->>'token' = token` 嗰行 → 攞 `user_id`（**反查**，唔使新 table）。搵唔到 → 401。
- 讀該 user 嘅 `events` + `countdowns` 兩個 collection（app_rows）。
- 生成 .ics（Deno 內自寫，鏡像 ics.ts 格式）：每個事件 VEVENT（DTSTART/DTEND、SUMMARY、有時間→DTSTART 帶時分、全日→VALUE=DATE）；`alertMinutes>0` → VALARM TRIGGER；`recurrence.freq!=='none'` → **RRULE**（FREQ/INTERVAL/UNTIL/COUNT/BYDAY）。countdown 當全日重要日（可帶 VALARM 當日 9am 之類）。
- 回 `Content-Type: text/calendar; charset=utf-8` + `Cache-Control` 短（畀 Apple 定期 refresh）。
- 無秘密 commit（用 env service_role）；token gate；唯讀。

### 2. App：訂閱 UI（新 `CalendarSubscribe.tsx`，放行事曆 / 倒數頁頂 or 設定）
- `calendarFeedCol = createCollection('calendar_feed', [])`：存 `{ id:'token', token }`。首次「訂閱」時 random 生成（crypto.getRandomValues，長、難猜）並存（會 sync 上 Supabase 畀 feed function 反查到）。
- 顯示 **webcal:// 連結**：`webcal://<project-ref>.supabase.co/functions/v1/calendar-feed?token=<token>`（project-ref 由 VITE_SUPABASE_URL 拆）。
- 「複製連結」+ 可點（喺裝置上點 webcal:// 直接開 Apple 日曆訂閱）+ 簡明步驟（iPhone/iPad：點連結 → 訂閱;或 設定→日曆→帳戶→加入已訂閱的日曆）。
- 「重新產生連結」（換 token，舊連結即失效）。
- 未接 Supabase / 未登入 → 友善提示（feed 要雲端先有意義）。

### 3. quick-add 重複偵測
- `ParsedDraft` 加 `recurrence?: { freq:'daily'|'weekly'; interval?; byWeekday?:number[] }`（簡化版，對應 RecurrenceRule）。
- `buildQuickAddPrompt`：叫 AI 偵測「每日 / 每朝 / 每週一 / 逢週五」等 → 回 recurrence（只限 event；無就 null）。
- `toDraft`：正規化 recurrence（freq 白名單、byWeekday 0–6）。
- `commit`（event）：寫 `eventsCol.add({ ..., recurrence: {freq, ...} })`。
- 客戶端 `ics.ts`：加 RRULE 輸出（令手動匯出 + feed 一致；feed function 各自實作但邏輯一致）。

## 安全

- token：≥ 128-bit random、URL-safe；唯讀曝露事件標題/時間（用戶自己訂自己）。
- 可「重新產生」即時失效舊連結。
- 倉庫 **public** → 零秘密 commit；service_role 只喺 Edge Function env。

## ⚠️ 用戶要做（我整唔到落你 Supabase）

1. Deploy function：`supabase functions deploy calendar-feed`（喺 inner repo / 連住 project）。
2. 確認 function 有 `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`（Supabase 預設注入）。
3. App 內「訂閱」攞連結 → iPhone/iPad 點一下訂閱。
（無 DB migration —— token 存喺 app_rows，零 SQL。）

## 測試

- `ics.ts` RRULE 單元測試（freq/interval/until/count/byday → RRULE 行）。
- quick-add `toDraft` recurrence 正規化測試。
- Edge Function：本機 `supabase functions serve` + curl 驗 .ics（用戶側做）；我哋確保純邏輯（.ics builder）可獨立測。
- tsc 0 / build / 全測試。

## 範圍外

- Web Push（已比較，唔做）。
- Android / Google Calendar 訂閱（.ics 通用，理論上都 work，但今次聚焦 Apple）。
- 雙向（編輯日曆改返 app）—— feed 唯讀。

## 階段（workflow）

- **A**：quick-add 重複偵測（parse recurrence + modal 顯示/可改 + commit）+ `ics.ts` RRULE + 測試。
- **B**：Edge Function `calendar-feed`（Deno：token 反查 + .ics with VALARM/RRULE）。
- **C**：App 訂閱 UI（token 生成 + webcal 連結 + 步驟 + 重新產生）+ 入口（行事曆/倒數）。
