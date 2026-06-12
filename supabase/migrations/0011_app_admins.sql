-- ============================================================
--  EziTeach 教學易 · 0011_app_admins（DB 管理員名單）
-- ------------------------------------------------------------
--  原本「管理員」只靠 ADMIN_EMAILS / VITE_ADMIN_EMAILS 環境變數白名單，
--  要喺兩處手動維護、新增管理員要改 env + 重新部署。
--  呢張表令管理員名單入 DB：admin Edge Function 授權時 env 白名單（bootstrap）
--  OR app_admins 表都認，後台可即時增刪、唔使重新部署。
--  RLS：任何登入用戶淨係讀到「自己嗰行」（俾前端判斷自己係咪 admin）；
--       讀全名單 / 增刪一律經 admin Edge Function（service_role），唔開其他 policy。
-- ============================================================

create table if not exists public.app_admins (
  email      text        primary key,           -- 一律小寫
  added_by   text,                               -- 邊個管理員加嘅（actor email）
  created_at timestamptz not null default now()
);

alter table public.app_admins enable row level security;

-- 讀「自己嗰行」：前端 select where email = 自己 → 有行 = admin、冇行 = 唔係。
drop policy if exists "app_admins read own" on public.app_admins;
create policy "app_admins read own"
  on public.app_admins
  for select
  to authenticated
  using (email = lower(coalesce(auth.jwt() ->> 'email', '')));
