# 資源分享區（教學資源社群）— 設計 Spec

- 日期：2026-06-12
- 狀態：草擬，待 review
- 目標功能：EziTeach 主打功能「資源分享區」，讓全港老師互相分享教學資源。

## 1. 目標同範圍

### 1.1 一句講晒
一個**全港公開**嘅教學資源社群：老師可以發佈（上載實檔或貼連結）、瀏覽、搜尋、下載、評分、收藏其他老師嘅教學資源；唔當位、侵權嘅資源可以被檢舉，由管理員下架。

### 1.2 已對齊嘅核心決定
| 決定 | 揀咗 |
|---|---|
| 分享範圍 | **全港社群公開**（所有登入老師互相睇到） |
| 檔案 | **寄存實檔**（PDF/PPTX/Word/圖片，**private bucket、只登入老師簽名下載**）+ 亦容許純連結 |
| 商業模式 | **免費分享**（非 marketplace；唔收費、唔分潤） |
| 審核模式 | **發佈即上線 + 檢舉後下架**（post-moderation，唔做逐個事前審） |
| 身份私隱 | 老師自選署名（姓+稱謂 / 顯示學校與否 / 匿名），匿名只係顯示層 |

### 1.3 In scope（v1）
- 老師社群 profile（公開署名 + 私隱控制）
- 發佈資源（上載實檔 / 連結）、草稿、編輯、下架、「我的分享」數據
- 由個人資源庫一鍵「分享去社群」；由掃描成果直接分享
- 瀏覽首頁（最新 / 最多下載 / 本週熱門 / 精選）、搜尋、篩選（科目/課題/年級/類型）、排序
- 資源詳情頁（PDF 內嵌預覽、下載、發佈者 profile、相關資源）
- 評分（星）、下載計數、收藏計數
- 「收藏入我的資源庫」（存返個人 localStorage 資源庫）
- 檢舉 + 管理員審核（reuse 現有 admin 系統）
- Feature 註冊 + Sidebar 入口 + i18n（zh-HK + appEn）

### 1.4 Out of scope（v2+，YAGNI）
- 賣資源 / marketplace（收費、分潤、報稅）
- 留言串 / 問答、追蹤老師 / 動態 feed、私訊
- 版本控制、AI 自動分類 / 推薦
- 即時通知（v1 唔做；先用「我的分享」頁睇數據）

## 2. 身份 / 私隱模型（profiles）

### 2.1 為咩要新 `profiles` 表
現有 `displayName` 淨係喺 localStorage（`SettingsContext`），跨用戶睇唔到。公開社群要顯示「邊個老師分享」，所以要一個 server 端、所有登入老師可讀嘅 profile。

### 2.2 公開署名規則（純函式 `publicName(profile)`）
```
anonymous            → 「匿名老師」
else, show_school    → `${school} ${display_name}`   // 例：「XX中學 陳老師」
else                 → display_name                  // 例：「陳老師」
```
- `display_name` 由「姓氏 + 稱謂」組成（引導式 UI），亦可自訂全名/英文名。
- 稱謂選項：老師 / Sir / Miss / 先生 / 小姐（預設「老師」）。
- 私隱預設保守：`show_school = false`、`anonymous = false`、display_name = 姓+「老師」。
- **匿名只係顯示層**：server 照存 `owner_id`，被檢舉時 admin 仍然查到真實帳戶。

### 2.3 設定入口
- 「社群身份」設定（profile 設定頁 / 首次發佈時引導建立）。
- 預填：display_name 由現有 `settings.displayName` 取姓做起點（用戶可改）。

## 3. 資料層（Supabase）

### 3.1 新 table

**`profiles`** — 公開老師檔案
| 欄 | 型 | 備註 |
|---|---|---|
| id | uuid PK | = auth.users.id |
| display_name | text not null | 公開署名，例「陳老師」 |
| school | text | 可空 |
| show_school | bool not null default false | |
| anonymous | bool not null default false | |
| avatar_color | text | 縮寫頭像底色（可空，前端有預設） |
| bio | text | 可空，簡短自我介紹 |
| subjects | text[] | 任教科目（subject pack id），可空 |
| created_at / updated_at | timestamptz | |

RLS：
- SELECT：`to authenticated`（公開檔案，全部登入老師可讀）。
- INSERT/UPDATE：只 `id = auth.uid()`（owner upsert 自己）。

**`shared_resources`** — 分享資源主表
| 欄 | 型 | 備註 |
|---|---|---|
| id | uuid PK | |
| owner_id | uuid not null | → auth.users（匿名都存） |
| title | text not null | |
| description | text | |
| subject_pack_id | text | 例 'bafs'（可空 = 通用） |
| topic_id | text | 例 'econ-01'（可空） |
| grade | text | 年級（可空） |
| type | text not null | handout/slides/paper/link/video/note |
| tags | text[] | |
| file_path | text | `community` bucket 路徑（連結型 = null） |
| file_name / file_mime | text | |
| file_size | int | bytes |
| external_url | text | 純連結型用（檔案型 = null） |
| license | text not null | 'original'（原創）/ 'shareable'（獲授權可分享） |
| status | text not null default 'published' | published / draft / removed |
| download_count | int not null default 0 | |
| save_count | int not null default 0 | trigger 維護 |
| rating_sum / rating_count | int not null default 0 | trigger 維護 |
| created_at / updated_at | timestamptz | |

RLS：
- SELECT：`status = 'published'`（任何登入老師）**OR** `owner_id = auth.uid()`（睇返自己草稿/已下架）。
- INSERT：`with check owner_id = auth.uid()` 且 `status in ('published','draft')`。
- UPDATE/DELETE：只 `owner_id = auth.uid()`（owner 可改內容欄、可喺 draft↔published 之間轉、可自行下架自己資源）。
- 防 owner 篡改計數：`download_count/save_count/rating_sum/rating_count` 只由評分/收藏 trigger 同 `bump_download` RPC 維護；另設一個 `BEFORE UPDATE` trigger，**非 service_role** 嘅 update 一律保留呢幾欄嘅 OLD 值，令 owner 改唔到自己計數。
- 下架（status→removed）由 admin edge function（service_role）做，唔靠 client。

**`resource_ratings`** — 一人一評分
| owner | resource_id uuid, user_id uuid, stars int(1–5), created_at | PK (resource_id, user_id) |

RLS：SELECT 只自己（`user_id = auth.uid()` — 用嚟知「我畀過幾多星」；公開平均分由 `shared_resources.rating_*` 計，唔使讀人哋逐條評分）；INSERT/UPDATE/DELETE 只自己。
Trigger：insert/update/delete 後重算 `shared_resources.rating_sum/rating_count`。

**`resource_saves`** — 收藏（社群計數用）
| resource_id uuid, user_id uuid, created_at | PK (resource_id, user_id) |

RLS：SELECT/INSERT/DELETE 只自己。Trigger 維護 `save_count`。
（注意：「收藏入我的資源庫」另外會喺前端 localStorage 加一個 `Resource` — 見 §6.3。）

**`resource_reports`** — 檢舉
| id uuid PK, resource_id uuid, reporter_id uuid, reason text, detail text, status text default 'open'（open/reviewed/actioned）, created_at |

RLS：INSERT 只 `reporter_id = auth.uid()`；**唔開** client SELECT（admin 經 edge function service_role 讀）。

### 3.2 計數 / 防作弊策略
- `rating_*`、`save_count`：**DB trigger** 喺 ratings/saves 表變動時自動重算，寫入 `shared_resources` —— 列表讀計數零 join、原子、client 改唔到。
- `download_count`：`SECURITY DEFINER` RPC `bump_download(p_resource uuid)` —— client 撳下載時叫一次，function 內 `+1`（client 唔直接寫 counter）。
- 下架 / 刪 storage object：admin edge function（service_role）。

### 3.3 Storage
- 新 bucket **`community`**：**private**（唔公開；只有登入用戶簽名先攞到檔）。
- 讀取 RLS（`storage.objects`）：SELECT `to authenticated` —— 任何登入老師可為 `community` 內檔案生成簽名連結；登出 / 非註冊用戶冇 session → 攞唔到 → **下載唔到**。✅ 符合「打開 app（登入）先下載到、只 for 註冊用戶」。
- 寫入 RLS：`(storage.foldername(name))[1] = auth.uid()::text`（只可寫自己 uid 資料夾），同 `scans` bucket 一致。
- 下載 / 預覽：前端用登入 session 即場 `createSignedUrl(path, 3600)` 攞**1 個鐘短期連結**再開。
- 路徑：`<user_id>/<resource_id>-<ascii-safe-name>.<ext>`。
- 限制：前端檢查（type 白名單：pdf/pptx/docx/png/jpg；size 上限暫定 25MB）。
- 下架時 admin function set status='removed' + 連 storage object 一齊刪（雙重保險：listing 隱藏 + 真正刪檔）。
- 註：storage RLS 係 bucket 層（任何登入者可簽任何 `community` object）。草稿/已下架檔路徑唔公開兼下架即刪，殘餘風險低；若要嚴格「只簽已發佈資源」，可改用 edge function（service_role 查 status 後先簽）—— v1 列為加固選項。

### 3.4 Migration
- `0012_community.sql`（接 `0011_app_admins.sql`）：以上全部表 + RLS + trigger + `community` bucket + storage RLS。

## 4. 後端 RPC / Edge Function

### 4.1 RPC（SECURITY DEFINER）
- `bump_download(p_resource uuid)` → void（+1 download_count，只 published）。
- （rating/save 用普通 insert + trigger，唔使 RPC。）

### 4.2 Admin edge function（reuse 現有 `admin`）
新增 action：
- `reports:list` → 列出 open 檢舉（連 resource 摘要）。
- `reports:resolve` → `{ id, action: 'remove' | 'dismiss' }`：remove = set resource status='removed' + 刪 storage object + 標 report actioned + 寫 admin_audit；dismiss = 標 reviewed。
- 授權沿用啱整好嘅「env OR app_admins」邏輯。

## 5. 前端架構

### 5.1 新 lib
- `src/lib/community.ts` — Supabase query/RPC wrapper：
  - `listResources(filter, sort, page)`、`getResource(id)`、`relatedResources(r)`
  - `publishResource(payload)`、`updateResource`、`setResourceStatus(own draft/publish/down)`、`myResources()`
  - `rateResource(id, stars)`、`saveResource(id)` / `unsave`、`bumpDownload(id)`、`reportResource(id, reason, detail)`
  - `getProfile(userId)`、`upsertMyProfile(profile)`
- `src/lib/communityProfile.ts`（或 community.ts 內）— 純函式 `publicName(profile)`、`buildDisplayName(surname, title)`。
- 擴 `src/lib/supabaseStorage.ts` — `uploadCommunityFile(blob, name, userId, resourceId)` → `community`（private）bucket；同 `communitySignedUrl(path, ttl=3600)`（用登入 session 生成短期下載/預覽連結）。

### 5.2 新 feature 元件 `src/features/work/community/`
- `Community.tsx` — 容器 + masthead + tab（瀏覽 / 我的分享 / 我的社群身份）。
- `BrowseTab` — 首頁列表（最新/熱門/精選）+ 搜尋 + 篩選 + 排序 + 卡片 grid。
- `ResourceDetail` — 詳情（PDF 預覽、下載、發佈者、評分、相關）。
- `PublishForm` — 發佈/編輯（檔案上載 or 連結、科目/課題/年級/類型/tag、授權聲明）。
- `MyShares` — 我嘅分享管理 + 數據。
- `ProfileSetup` / `ProfileCard` — 社群身份設定 + 公開卡。
- `community/util.ts`（純函式：篩選/排序、payload 驗證、publicName、檔案類型/大細檢查）+ `util.test.ts`。

### 5.3 Reuse map
| Reuse | 嚟源 |
|---|---|
| 資源類型 + 類型色（chip/dot/icon） | `src/features/work/resourceLibrary/util.ts` |
| 科目/課題分類 | `src/data/subjects.ts`（SUBJECT_PACKS） |
| UI 元件（Card/Button/Field/Select/Badge/Modal/Tabs/EmptyState…） | `src/ui` |
| 上載模式 + ascii-safe 檔名 | `src/lib/supabaseStorage.ts` |
| 個人資源型別（收藏返本地時用） | `src/data/types.ts` Resource |
| Admin 授權 + 後台卡式 | `admin` edge function + `Admin.tsx` ContentTab |

## 6. 關鍵流程

### 6.1 發佈
PublishForm 收內容 → （檔案型）`uploadCommunityFile` → `publishResource(payload)` 插 `shared_resources`（status published/draft）→ 成功跳詳情頁。首次發佈無 profile → 先引導 `ProfileSetup`。

### 6.2 瀏覽 → 下載
BrowseTab `listResources(filter)` → 卡片 → ResourceDetail `getResource` → 撳下載：`bumpDownload(id)`（計數）+（檔案型）用登入 session `communitySignedUrl(path)` 攞短期連結開檔 /（連結型）開 `external_url`。未登入冇 session → 簽唔到 → 下載唔到。

### 6.3 「收藏入我的資源庫」
撳收藏：`saveResource(id)`（server，save_count +1）**並且**將資源加入本地 `resourcesCol`（一個 `Resource`：title/type/url=詳情或檔案連結/topicId/tags），令老師喺現有個人資源庫見返。兩者並行，互不依賴。

### 6.4 檢舉 → 下架
詳情頁「檢舉」→ `reportResource` 插 `resource_reports`。Admin「內容+支援」→「社群檢舉」卡 `reports:list` → 撳「下架」`reports:resolve{action:remove}`。

## 7. 錯誤處理
- 未接 Supabase / 未登入：community 同客服一樣顯示 EmptyState（需登入）。
- 上載失敗 / 檔案太大 / 類型唔啱：前端即時擋 + toast，唔好 silent。
- RPC / query 失敗：toast 真實 error（沿用現有 pattern）。
- 下載：`bumpDownload` 失敗都照開檔（計數 best-effort，唔阻下載）。
- 匿名資源：詳情頁唔出真實 email / 帳戶；admin 端先見 owner_id。

## 8. 測試（沿用 repo 慣例：vitest node env、純函式）
- `community/util.test.ts`：`publicName`（三種署名情況）、`buildDisplayName`、篩選/排序、發佈 payload 驗證（必填、license、檔案類型/大細）、parse `shared_resources` row。
- 唔做 component test（vitest 無 jsdom）。RLS 靠 migration review + 部署後手測。

## 9. 整合 / 收尾
- `src/features/registry.ts` 加 feature（id 例 `work-community`，group「教學」，icon、component lazy）。
- Sidebar 自動顯示。
- i18n：`community.*` namespace（zh-HK defaultValue + appEn 補英文）；feat 名加入 appEn。
- 個人資源庫加「分享去社群」入口；掃描成果加「分享」。

## 10. 建議實施階段（每階段可獨立 ship）
1. **資料層**：`0012_community.sql`（表 + RLS + trigger + bucket）+ `bump_download` RPC。
2. **後端 wrapper**：`community.ts` + storage helper + profile 純函式 + 測試。
3. **瀏覽/消費**：Community 容器 + BrowseTab + ResourceDetail + 下載 + 收藏（含本地）。
4. **發佈**：PublishForm + MyShares + ProfileSetup；個人庫/掃描「分享去社群」入口。
5. **質素**：評分 + 計數接線。
6. **審核**：檢舉流程 + admin `reports:*` + 後台「社群檢舉」卡。
7. **收尾**：feature 註冊 + i18n + 文案 + 視覺打磨。

> 規模較大（主打功能）。實施計劃（writing-plans）會按上面階段分拆，每段可獨立驗證 / ship。

## 11. 待確認 / 已知取捨
- 檔案大細上限 25MB（暫定，可調）。
- `community` 用 **private bucket + 簽名連結**（只登入老師下載到，符合「打開 app 先下載、只 for 註冊用戶」）；代價：每次下載/預覽多一個攞簽名連結嘅 round-trip。storage RLS 係 bucket 層，嚴格「只簽已發佈」需 edge function（v1 列加固選項）。
- 評分：一人一星級（1–5），無評論文字（v1）。
- PDF 內嵌預覽用現有 pdfjs；非 PDF（pptx/docx）v1 只提供下載 + 類型 icon，唔做線上預覽。
