-- ============================================================
--  EziTeach 教學易 · 0014_profile_onboarding（新用戶註冊 / 首次個人資料登記）
-- ------------------------------------------------------------
--  擴充 public.profiles（0012 建）做「全 app 統一身份」，畀首次登入嘅
--  個人資料登記表單寫入。新欄位全部選填 / 有預設，向後相容：
--   · role              身份角色（teacher / pre_service / tutor / other）
--   · bands             任教學制（primary / junior / senior；多選）
--   · accepted_terms_at 同意服務條款 / 社群守則嘅時間（NULL = 未同意）
--   · onboarded_at      完成首次登記嘅時間（NULL = 未登記 → 前端彈登記表單）
--  全部 add column if not exists（可重複安全跑）；RLS / trigger 沿用 0012。
-- ============================================================

alter table public.profiles
  add column if not exists role              text,
  add column if not exists bands             text[]      not null default '{}',
  add column if not exists accepted_terms_at timestamptz,
  add column if not exists onboarded_at      timestamptz;
