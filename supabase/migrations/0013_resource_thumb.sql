-- ============================================================
--  EziTeach · 0013_resource_thumb（資源縮圖路徑）
-- ------------------------------------------------------------
--  shared_resources 加 thumb_path：前端生成嘅縮圖（圖片 / PDF 第一頁）
--  存喺 community bucket（同原檔同一個 uid 資料夾），用簽名 URL 喺 gallery 顯示。
--  Office 檔冇縮圖 → thumb_path null → 前端出設計 placeholder。
-- ============================================================

alter table public.shared_resources
  add column if not exists thumb_path text;
