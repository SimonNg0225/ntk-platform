-- ============================================================
--  NTK Platform · 0005_org_invites（多座位團隊 — 邀請 + 管理函數）
-- ------------------------------------------------------------
--  接住 0004_orgs：加邀請表 + 一組 SECURITY DEFINER 函數，
--  畀前端用 supabase.rpc() 安全操作（內部用 auth.uid() 驗權 + 座位上限）。
--  座位計費（Stripe quantity）由 team-billing Edge Function + webhook 更新
--  orgs.seats；本檔負責成員 / 邀請邏輯。
-- ============================================================

create table if not exists public.org_invites (
  id          uuid        primary key default gen_random_uuid(),
  org_id      uuid        not null references public.orgs (id) on delete cascade,
  email       text        not null,
  role        text        not null default 'member',
  token       text        not null unique
                          default replace(gen_random_uuid()::text, '-', '')
                                || replace(gen_random_uuid()::text, '-', ''),
  invited_by  uuid        not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  accepted_at timestamptz
);
create index if not exists org_invites_org_idx on public.org_invites (org_id);

alter table public.org_invites enable row level security;

-- org 成員可讀自己 org 嘅邀請（顯示 pending）
drop policy if exists "org_invites read member" on public.org_invites;
create policy "org_invites read member"
  on public.org_invites
  for select
  to authenticated
  using (
    org_id in (select org_id from public.org_members where user_id = auth.uid())
  );

-- ── 建立團隊（建立者 = owner，預設 1 座位）──
create or replace function public.create_org(p_name text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare new_id uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  insert into public.orgs (name, owner_id, seats)
    values (p_name, auth.uid(), 1)
    returning id into new_id;
  insert into public.org_members (org_id, user_id, role)
    values (new_id, auth.uid(), 'owner');
  return new_id;
end;$$;

-- ── 列出 org 成員（連 email，需 SECURITY DEFINER 先讀到 auth.users）──
create or replace function public.list_org_members(p_org uuid)
returns table(user_id uuid, role text, email text, created_at timestamptz)
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (
    select 1 from public.org_members where org_id = p_org and user_id = auth.uid()
  ) then raise exception 'not authorized'; end if;
  return query
    select m.user_id, m.role, u.email::text, m.created_at
    from public.org_members m
    join auth.users u on u.id = m.user_id
    where m.org_id = p_org
    order by m.created_at;
end;$$;

-- ── 建立邀請（owner / admin），回傳 token ──
create or replace function public.create_org_invite(
  p_org uuid, p_email text, p_role text default 'member'
)
returns text
language plpgsql security definer set search_path = public
as $$
declare new_token text;
begin
  if not exists (
    select 1 from public.org_members
    where org_id = p_org and user_id = auth.uid() and role in ('owner', 'admin')
  ) then raise exception 'not authorized'; end if;

  insert into public.org_invites (org_id, email, role, invited_by)
    values (p_org, lower(p_email), p_role, auth.uid())
    returning token into new_token;
  return new_token;
end;$$;

-- ── 接受邀請（呼叫者加入；座位上限檢查）──
create or replace function public.accept_org_invite(p_token text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare inv public.org_invites; used int; cap int;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into inv from public.org_invites
    where token = p_token and accepted_at is null;
  if inv.id is null then raise exception 'invite invalid or used'; end if;

  select count(*) into used from public.org_members where org_id = inv.org_id;
  select seats into cap from public.orgs where id = inv.org_id;
  if used >= cap then raise exception 'seat limit reached'; end if;

  insert into public.org_members (org_id, user_id, role)
    values (inv.org_id, auth.uid(), inv.role)
    on conflict (org_id, user_id) do nothing;
  update public.org_invites set accepted_at = now() where id = inv.id;
  return inv.org_id;
end;$$;

-- ── 移除成員（owner / admin；唔可以移除 owner）──
create or replace function public.remove_org_member(p_org uuid, p_user uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (
    select 1 from public.org_members
    where org_id = p_org and user_id = auth.uid() and role in ('owner', 'admin')
  ) then raise exception 'not authorized'; end if;
  if exists (
    select 1 from public.org_members
    where org_id = p_org and user_id = p_user and role = 'owner'
  ) then raise exception 'cannot remove owner'; end if;
  delete from public.org_members where org_id = p_org and user_id = p_user;
end;$$;
