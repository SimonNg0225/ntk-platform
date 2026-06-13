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

-- ───────── Grandfather 現有用戶（完全唔阻佢哋）─────────
-- 將「呢條 migration 跑之前已存在」嘅所有 auth 帳戶標記為已完成登記（onboarded_at = now）。
-- 結果：現有用戶下次登入唔會彈登記表單；只有將來全新註冊（migration 之後先出現喺
-- auth.users）嘅用戶先會行登記流程。
--   · 冇 profile 嘅現有用戶 → 補一個 row（署名用 Google 帳戶名 → email 前綴 → 「老師」fallback）。
--   · 已有 profile（用過資源分享區 / 論壇）嘅 → 只補 onboarded_at，保留原有署名 / 學校等資料。
-- 可重複安全跑（on conflict）。
insert into public.profiles (id, display_name, onboarded_at)
select
  u.id,
  coalesce(
    nullif(u.raw_user_meta_data->>'full_name', ''),
    nullif(u.raw_user_meta_data->>'name', ''),
    nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
    '老師'
  ),
  now()
from auth.users u
on conflict (id) do update
  set onboarded_at = coalesce(public.profiles.onboarded_at, now());
