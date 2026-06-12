# 資源分享區（老師教材 gallery）設計 spec

- 日期：2026-06-12
- 狀態：設計（未實作）
- 取向：**零 infra 免費方案** —— 縮圖前端生成（圖片 / PDF 自動；Office 用封面圖 / placeholder）；Supabase Storage 存檔；寫入經 Edge Function；後台審核。

> ⚠️ 同既有 `work-resources`（個人「資源庫」，淨係存連結）**唔同**。呢個係**社群檔案分享 gallery**（上載真檔、瀏覽、下載），功能 id = `community-resources`，同論壇一樣放「社群」group。

## 1. 目標 / 非目標

**MVP 做**：
- 上載教材檔（PDF / PPT / PPTX / DOC / DOCX / PNG / JPG，單檔 ≤ 50MB）
- **縮圖 gallery**（縮圖卡 + 標題 + 類型 badge + 頁數 + 瀏覽數 + 下載數），似优品PPT 嗰種
- 分類 tab、排序（最新 / 最熱）、關鍵字搜尋
- 詳情頁：圖片 / PDF 內建預覽；Office 顯示縮圖 + 下載
- 下載（簽名 URL）+ 計下載數 / 瀏覽數
- 🚩 檢舉 + 後台移除 / 封禁

**縮圖策略（免費、唔失靈）**：
| 類型 | 縮圖 | 可靠度 |
|---|---|---|
| 圖片 | canvas 縮放 | ✅ |
| PDF | `pdfjs-dist` render 第一頁 + 讀頁數 | ✅ |
| DOCX | `mammoth`→HTML→`html2canvas`（best-effort，新 dep，lazy） | 🟡 |
| PPTX / PPT / DOC | 唔 render | —— |
| 任何 Office 冇生到縮圖 | 上傳者**可選封面圖**，否則**設計好嘅 placeholder**（類型 badge + 標題 + 配色 + 頁數） | ✅ 永不爛卡 |

每條路徑出錯都 fallback 去 placeholder → grid 永遠有靚卡。

**非目標（v2+）**：PPTX 自動 render（要 LibreOffice worker）、Office 全頁 in-browser viewer、評分 / 收藏 / 合輯 / 版本、全文檢索、後端轉檔。

## 2. 架構

- **縮圖全部前端生成**（上載前），所以 row 一建即 `ready`，**無異步 worker、無轉檔 API、零按次費用**。
- **儲存**：Supabase Storage 兩個 bucket（沿用 `0008` 嘅 pattern）
  - `resources`：**private**，原檔；下載用 `createSignedUrl`（時效）
  - `resource-thumbs`：**public-read**，縮圖（低敏感、derived）→ grid 直接 `<img src>`
  - 路徑：`{uid}/{resourceId}.{ext}`；RLS：`storage.foldername(name)[1] = auth.uid()::text` 只准寫自己 folder
- **讀**（列分類 / 列資源 / 詳情）：前端 supabase client + RLS
- **寫**（建資源 / 刪自己 / 檢舉）：經 `resources` Edge Function（驗證 + rate-limit + 封禁，service_role）
- **計數**（瀏覽 / 下載）：原子 RPC `bump_resource(id, kind)`（authenticated 可 call）
- **審核**：擴充現有 `admin` Edge Function

## 3. 資料模型（migration `0012_resources.sql`）

```
resource_categories(
  id uuid PK, slug text unique, name text, sort int, archived bool default false, created_at)

resources(
  id uuid PK, uploader_id → auth.users, category_id → resource_categories,
  title text, description text default '',
  file_path text,            -- resources bucket 路徑
  thumb_path text,           -- resource-thumbs 路徑（null = 用 placeholder）
  file_type text,            -- pdf|pptx|ppt|docx|doc|image
  file_ext text, file_size bigint,
  page_count int default 0,
  status text default 'active',   -- active|removed
  view_count int default 0, download_count int default 0,
  created_at, updated_at)
```
索引：resources(category_id, created_at desc)、resources(category_id, download_count desc)。

**RLS**：
- `resource_categories`：authenticated 讀 `archived=false`；無 client 寫。
- `resources`：authenticated 讀 `status='active'`；**無 client insert/update/delete**（經 Edge Function）。
- Storage：`resources` insert/delete own folder；`resource-thumbs` insert own + 公開讀。

**RPC**：`bump_resource(p_id uuid, p_kind text)` SECURITY DEFINER → `view_count`/`download_count` +1（authenticated 可 call）。

**Seed 分類**：各科教材 / 工作紙 / 簡報 / 試卷與評估 / 行政表格 / 其他。

## 4. `resources` Edge Function（新）

沿用 forum/admin 模式（驗 JWT、CORS、service_role、封禁查 `forum_bans` 共用、rate-limit）。
- `create { category_id, title, description, file_path, thumb_path, file_type, file_ext, file_size, page_count }`
  —— 驗證：標題 1–120、描述 ≤ 2000、size ≤ 50MB、type 白名單、檔案確實存在於上傳者 folder（service_role 查 storage）。建 row。
- `delete-own { id }` —— 軟刪 status=removed（並可選刪 storage 檔）。
- `report { id, reason }` —— 寫 `forum_reports`（target_type 加 `'resource'`）。

> rate-limit：每分鐘上載 ≤ 3、檢舉沿用論壇。封禁沿用 `forum_bans`（一個社群禁令）。

## 5. 上傳流程（前端）

1. 揀檔 → 驗類型 / 大小
2. **生縮圖**（`src/features/resources/thumb.ts`）：image→canvas；pdf→pdfjs 第一頁 + 頁數；docx→mammoth+html2canvas（lazy，失敗就 null）；其餘→null。可選「附封面圖」覆蓋。
3. 上載原檔去 `resources/{uid}/{id}.ext`；有縮圖就上載去 `resource-thumbs/{uid}/{id}.jpg`
4. call `resources` Edge Function `create`（帶 metadata + 路徑）
5. 完成 → 跳去 gallery / 詳情。失敗 → 清掉已上載檔 + toast。

## 6. 前端

- 功能 `community-resources`（lazy，group「社群」，icon 📚）。
- `src/features/resources/`：
  - `api.ts`（讀 RLS + 寫 Edge Function + storage 上傳 + signed URL 下載 + bump RPC）
  - `thumb.ts`（縮圖生成；pdfjs / mammoth+html2canvas lazy import）
  - `types.ts`、`logic.ts`（驗證 / 排序）+ `logic.test.ts`
  - `Gallery.tsx`（grid + 分類 tab + 排序 + 搜尋 + 上傳掣）
  - `ResourceCard.tsx`（縮圖卡；無縮圖→placeholder）
  - `ResourceDetail.tsx`（圖/PDF 內建預覽 + 下載 + 檢舉 + 刪自己）
  - `UploadModal.tsx`（揀檔 + 標題/分類/描述 + 封面圖選項 + 進度）
  - `Resources.tsx`（殼：gallery / detail 內部路由）
- ui kit + ErrorBoundary + 三態。
- **新 dep**：`mammoth` + `html2canvas`（只喺上載 docx 時 lazy load）。`pdfjs-dist` 已有。

## 7. 後台審核（擴充 `admin`）

重用 `forum_reports` 表，`target_type` 加多個值 `'resource'`。admin actions：`resource:reports`（列，連住資源預覽）、`resource:remove`（status=removed）、`resource:resolve`、封禁沿用 `forum:ban`。後台「內容+支援」加一張獨立「資源檢舉」卡（結構同論壇檢舉卡一致）。

## 8. 可靠性 / 測試

- vitest：縮圖類型判斷、檔案驗證、排序、placeholder fallback 邏輯（純函數）。
- 縮圖每路徑 try/catch → fallback placeholder，**永不爛卡**。
- 計數靠 RPC 原子 +1。軟刪除。signed URL 時效下載。
- RLS / storage policy sandbox 跑唔到 → 用戶 `db push` 後實測（標明未核實）。

## 9. 部署需求

- `supabase db push`（0012 + storage buckets/policies）
- `supabase functions deploy resources` + `supabase functions deploy admin`
- 前端 Vercel 自動
- 沿用 `ADMIN_EMAILS`

## 10. 定案（已確認）

1. **預覽方向**：零 infra 免費 —— 圖片/PDF 自動縮圖、DOCX best-effort、Office 封面圖/placeholder。
2. **分類**：各科教材 / 工作紙 / 簡報 / 試卷與評估 / 行政表格 / 其他。
3. **限制**：單檔 ≤ 50MB；類型 PDF/PPT/PPTX/DOC/DOCX/PNG/JPG。
