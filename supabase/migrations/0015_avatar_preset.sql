-- ============================================================
--  EziTeach 教學易 · 0015_avatar_preset（頭像 persona / 上載）
-- ------------------------------------------------------------
--  畀首次註冊（features/onboarding）同個人檔案揀「教師形象頭像」。
--   · avatar_preset  預設 persona id（m-01..m-10 / f-01..f-10；NULL = 用文字頭像）
--   · avatar_url     自訂上載頭像（留畀下一階段；今期未啟用）
--  顯示優先：avatar_url → avatar_preset + avatar_color → 文字（署名首字）+ avatar_color。
--  全部 add column if not exists（可重複安全跑）；RLS / trigger 沿用 0012。
-- ============================================================

alter table public.profiles
  add column if not exists avatar_preset text,
  add column if not exists avatar_url    text;
