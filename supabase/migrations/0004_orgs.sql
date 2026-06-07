-- ============================================================
--  NTK Platform · 0004_orgs（多座位 / 團隊方案 — 基礎 scaffolding）
-- ------------------------------------------------------------
--  ⚠️ 本 migration 只係「資料模型基礎」：建表 + RLS。
--     座位數計費（Stripe quantity）、邀請流程、團隊管理 UI 屬後續工作，
--     未接入前端。可先安全套用，唔影響現有單人功能。
--
--  模型：
--   - orgs：一個學校 / 科組 = 一個 org，owner 為建立者。
--   - org_members：org × user = 一行（role: owner / admin / member）。
--   - seats：已購座位數（將來對應 Stripe subscription 數量）。
-- ============================================================

create table if not exists public.orgs (
  id                     uuid        primary key default gen_random_uuid(),
  name                   text        not null,
  owner_id               uuid        not null references auth.users (id) on delete cascade,
  stripe_subscription_id text        unique,
  seats                  int         not null default 1,
  created_at             timestamptz not null default now()
);

create table if not exists public.org_members (
  org_id     uuid        not null references public.orgs (id) on delete cascade,
  user_id    uuid        not null references auth.users (id) on delete cascade,
  role       text        not null default 'member',  -- owner / admin / member
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create index if not exists org_members_user_idx on public.org_members (user_id);

alter table public.orgs enable row level security;
alter table public.org_members enable row level security;

-- 成員可讀自己屬於嘅 org
drop policy if exists "orgs read member" on public.orgs;
create policy "orgs read member"
  on public.orgs
  for select
  to authenticated
  using (
    id in (select org_id from public.org_members where user_id = auth.uid())
  );

-- 成員可讀自己嘅 membership 行
drop policy if exists "org_members read own" on public.org_members;
create policy "org_members read own"
  on public.org_members
  for select
  to authenticated
  using (user_id = auth.uid());

-- 寫入（建 org / 加成員 / 改座位）一律經 service_role 或 SECURITY DEFINER 函數，
-- 故意唔開 client 寫入 policy —— 避免遞迴 RLS 同越權。座位計費上線時再補對應
-- Edge Function（Stripe quantity 同步）。
