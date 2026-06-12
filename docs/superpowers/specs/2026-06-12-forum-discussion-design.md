# 討論區（老師社群論壇）設計 spec

- 日期：2026-06-12
- 狀態：設計（未實作）
- 取向：Approach A —— RLS 直連讀取 + 薄 Edge Function 把關寫入

## 1. 目標 / 非目標

**目標**：喺 EziTeach 加一個**全平台老師社群論壇**，分版討論（版 → 帖 → 回覆），
可用、可靠、有審核，唔係 demo 兒戲。第一個「真・多人共享」功能。

**MVP（v1）做**：
- 版區 Boards（seed 預設，後台可加 / 排序 / 封存）
- 帖 Threads（標題 + 純文字內文 + 標籤 + 所屬版）
- 回覆 Posts（平鋪，無樓中樓）
- 互動：👍 有用（讚）、🔖 收藏
- 身分 Profile：顯示名 + 學校（選填）+ 任教科 tags（選填）+ 字母頭像
- 審核：🚩 檢舉 → 後台佇列；後台刪 / 鎖 / 置頂 / 精華 / 封禁用戶
- 排序：最新 / 最多回覆 / 最熱；版內分頁
- 搜尋：基本關鍵字（ILIKE，標題 + 內文）

**非目標（v2+，明確唔做）**：
圖片上傳、通知 / @提及、追蹤版或用戶、標「最佳答案」、樓中樓、
一鍵分享 EziTeach 簡報 / 工作紙入帖、realtime live 更新、全文檢索。

## 2. 架構決定

論壇資料**唔入 localStorage / app_rows**（同 local-first 其餘功能分開）。
係伺服器專屬 table，連網先用到（離線唔支援，可接受）。

- **讀**（列版、列帖、睇帖+回覆、睇 profile、睇自己 reactions）：
  前端 `supabase` client 直接查，靠 **RLS** 開放「登入老師可讀全部活躍內容」。
- **寫**（發帖 / 回覆 / 編輯自己 / 刪自己 / 檢舉 / 改 profile）：
  經新 `forum` Edge Function（service_role），統一做 **驗證 + rate-limit + 封禁檢查**。
  → table **冇 client INSERT/UPDATE/DELETE policy**（reactions 例外，見下）。
- **Reactions**（讚 / 收藏）：高頻、低風險 → 容許 client 直接 insert/delete（RLS：`user_id = auth.uid()`）。
  計數由 **DB trigger** 原子維護，唔靠前端加數，杜絕 drift。
- **審核**：擴充現有 `admin` Edge Function（沿用 `ADMIN_EMAILS` 白名單 + service_role）。

## 3. 資料模型（migration `0011_forum.sql`）

```
forum_profiles(
  user_id uuid PK → auth.users, display_name text, school text,
  subjects text[], created_at, updated_at)

forum_boards(
  id uuid PK, slug text unique, name text, description text,
  sort int, archived bool default false, created_at)

forum_threads(
  id uuid PK, board_id → forum_boards, author_id → auth.users,
  title text, body text, tags text[],
  status text default 'active',         -- active | locked | removed
  pinned bool default false, featured bool default false,
  reply_count int default 0, score int default 0,
  last_activity_at timestamptz, created_at, updated_at)

forum_posts(                            -- 回覆（平鋪）
  id uuid PK, thread_id → forum_threads, author_id → auth.users,
  body text, status text default 'active',   -- active | removed
  score int default 0, created_at, updated_at)

forum_reactions(
  user_id uuid → auth.users, target_type text,  -- 'thread' | 'post'
  target_id uuid, kind text,                     -- 'up' | 'save'
  created_at, PK(user_id, target_type, target_id, kind))

forum_reports(
  id uuid PK, reporter_id → auth.users, target_type text, target_id uuid,
  reason text, status text default 'open',       -- open | resolved
  created_at)

forum_bans(
  user_id uuid PK → auth.users, reason text, banned_by text, created_at)
```

索引：threads(board_id, last_activity_at desc)、threads(board_id, score desc)、
posts(thread_id, created_at)、reports(status, created_at)。

**Triggers（保證計數正確）**：
- `forum_posts` after insert/soft-delete → 更新 `forum_threads.reply_count` + `last_activity_at`
- `forum_reactions(kind='up')` after insert/delete → 更新對應 thread / post 嘅 `score`

## 4. RLS

- `forum_boards`：authenticated 可讀 `archived = false`；無 client 寫。
- `forum_threads`：authenticated 可讀 `status <> 'removed'`；無 client 寫。
- `forum_posts`：authenticated 可讀 `status = 'active'`；無 client 寫。
- `forum_profiles`：authenticated 可讀全部；可 upsert / update **自己**（`user_id = auth.uid()`）。
- `forum_reactions`：authenticated 可讀全部；可 insert / delete **自己**。
- `forum_reports`：可 insert **自己**（`reporter_id = auth.uid()`）；**唔可讀**（admin service_role 先睇到）。
- `forum_bans`：零 client policy（admin service_role 專用）。

## 5. `forum` Edge Function（新）

沿用 gemini/admin 模式（驗 JWT、CORS、service_role）。每個寫操作前先：
1. 驗登入；2. 查 `forum_bans` → 封咗就 403；3. **rate-limit**（原子 RPC，見下）；4. 內容驗證。

Actions：
- `create-thread { board_id, title, body, tags }`
- `create-post { thread_id, body }`（鎖咗 / removed 嘅 thread 拒絕）
- `edit-own { type:'thread'|'post', id, ... }`（只改自己、限時窗內）
- `delete-own { type, id }`（軟刪：status → removed）
- `report { target_type, target_id, reason }`
- `set-profile { display_name, school, subjects }`

**Rate-limit**：仿 `consume_ai_quota` 嘅原子 RPC `forum_rate_check(p_user, p_action, p_limit, p_window)`，
例：每分鐘發帖 ≤ 3、回覆 ≤ 10、檢舉 ≤ 20。新 account（建立 <10 分鐘）發帖冷卻。

**驗證**：標題 1–120 字、內文 1–5000 字、連結數上限、tags ≤ 5、去除空白。

## 6. 後台審核（擴充 `admin` Edge Function）

新 actions：`forum:reports`（列 open 檢舉 + 連住內容）、`forum:remove`（thread/post → removed）、
`forum:lock` / `forum:pin` / `forum:feature`（thread flag）、`forum:ban` / `forum:unban`、
`forum:board-save` / `forum:board-archive`。全部寫 `admin_audit`。
前端：後台「內容 + 支援」分頁加「論壇檢舉」卡。

## 7. 前端

- 新功能 `forum` 登記入 `features/registry`（lazy chunk）；側欄 / 首頁出現「老師社群」卡。
- 資料層 `src/features/forum/api.ts`：讀用 supabase client + RLS；寫 call `forum` Edge Function
  （仿 `src/lib/admin.ts` 嘅 fetch 封裝）。**唔行 collections / localStorage**。
- 頁面：
  - `BoardList`：版區列表（帖數 / 最後活動）
  - `ThreadList(board)`：帖列表（排序切換、分頁、搜尋、發帖入口）
  - `ThreadView(thread)`：帖內文 + 回覆列表（分頁）+ 回覆 composer + 讚 / 收藏 / 檢舉
  - `ProfileEdit`：改顯示名 / 學校 / 科目（首次發帖前提示填）
  - `ReportModal`：檢舉理由
- 全部 ui kit（Card/Button/EmptyState/Modal/Badge…）；包 ErrorBoundary；載入 / 空 / 錯誤三態。
- 讚 / 收藏：樂觀更新，失敗回滾 + toast。
- i18n：新字串行 `t()` + `defaultValue`（繁中）+ `appEn.ts` 加英文。

## 8. 可靠性 / 測試策略

- **vitest 單元測試**（純邏輯）：內容驗證、連結數、排序 comparator、分頁 cursor、
  reaction toggle、時間格式、tags 清理。
- **計數**：靠 DB trigger（唔靠前端），避免 reply_count / score drift。
- **軟刪除**：刪帖 = status removed，回覆唔受影響、唔現孤兒。
- **錯誤處理**：Edge Function 統一 JSON error；前端逐頁 try/catch + 重試掣。
- **RLS**：migration 內寫清；sandbox 跑唔到 Supabase，**需你 apply migration 後實測**（標明未核實）。
- **rate-limit + ban + 驗證**：擋住濫發 / 攻擊面，令「公開」唔等於失控。

## 9. 部署需求（你嗰邊）

- `supabase db push`（apply `0011_forum.sql`）
- `supabase functions deploy forum`
- `supabase functions deploy admin`（更新版）
- 前端 Vercel 自動部署
- 沿用現有 `ADMIN_EMAILS`（審核權限）

## 10. 定案（2026-06-12，已確認）

1. **預設版區 seed**：各主要 DSE 科 + 班級經營 + 考評 + 行政職涯 + **見工 / 求職** + 茶水間。
   （**唔包資源分享** —— 資源分享另開獨立功能區，唔屬論壇範圍。）
2. **Rate-limit**：每分鐘 發帖 ≤ 3 / 回覆 ≤ 10 / 檢舉 ≤ 20；新 account（建立 <10 分鐘）發帖冷卻。
3. **編輯自己帖時間窗**：發出後 30 分鐘內可改。

> 註：論壇唔接 EziTeach 資源庫（即使 v2 都唔做「分享簡報入帖」）—— 資源交流交畀另一個獨立區。
