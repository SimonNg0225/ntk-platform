-- ============================================================
--  EziTeach AI · 0018_org_invite_hardening
-- ------------------------------------------------------------
--  團隊邀請只限指定電郵、7 日內有效；建立／接受都鎖 org row，
--  令成員 + 有效待接受邀請不會在並發時超過已購座位。
-- ============================================================

alter table public.org_invites
  add column if not exists expires_at timestamptz;

update public.org_invites
set expires_at = created_at + interval '7 days'
where expires_at is null;

alter table public.org_invites
  alter column expires_at set default (now() + interval '7 days'),
  alter column expires_at set not null;

create index if not exists org_invites_live_idx
  on public.org_invites (org_id, expires_at)
  where accepted_at is null;

-- 邀請 token 屬敏感 bearer token，只讓 owner / admin 讀取。
drop policy if exists "org_invites read member" on public.org_invites;
drop policy if exists "org_invites read admin" on public.org_invites;
create policy "org_invites read admin"
  on public.org_invites
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.org_id = org_invites.org_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  );

create or replace function public.create_org_invite(
  p_org uuid,
  p_email text,
  p_role text default 'member'
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_email text := lower(trim(p_email));
  new_token text;
  used_count int;
  pending_count int;
  seat_cap int;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if normalized_email !~ '^[a-z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}$' then
    raise exception 'invalid invite email';
  end if;
  if p_role not in ('admin', 'member') then raise exception 'invalid invite role'; end if;
  if not exists (
    select 1 from public.org_members
    where org_id = p_org and user_id = auth.uid() and role in ('owner', 'admin')
  ) then raise exception 'not authorized'; end if;

  -- 所有建立／接受邀請先鎖同一 org row，序列化座位計算。
  select seats into seat_cap
  from public.orgs
  where id = p_org
  for update;
  if seat_cap is null then raise exception 'organization not found'; end if;

  if exists (
    select 1
    from public.org_members m
    join auth.users u on u.id = m.user_id
    where m.org_id = p_org and lower(u.email) = normalized_email
  ) then raise exception 'email is already a member'; end if;

  -- 過期邀請及同電郵舊邀請不再佔座；重新邀請會換新 token。
  delete from public.org_invites
  where org_id = p_org
    and accepted_at is null
    and (expires_at <= now() or lower(email) = normalized_email);

  select count(*) into used_count
  from public.org_members
  where org_id = p_org;

  select count(*) into pending_count
  from public.org_invites
  where org_id = p_org
    and accepted_at is null
    and expires_at > now();

  if used_count + pending_count >= seat_cap then
    raise exception 'seat limit reached';
  end if;

  insert into public.org_invites (
    org_id,
    email,
    role,
    invited_by,
    expires_at
  ) values (
    p_org,
    normalized_email,
    p_role,
    auth.uid(),
    now() + interval '7 days'
  )
  returning token into new_token;

  return new_token;
end;
$$;

create or replace function public.accept_org_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.org_invites;
  caller_email text;
  used_count int;
  seat_cap int;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  -- 先找 org，再鎖 org；之後重讀並鎖 invite，跟 create 的鎖次序一致。
  select * into inv
  from public.org_invites
  where token = p_token and accepted_at is null;
  if inv.id is null then raise exception 'invite invalid or used'; end if;

  select seats into seat_cap
  from public.orgs
  where id = inv.org_id
  for update;
  if seat_cap is null then raise exception 'organization not found'; end if;

  select * into inv
  from public.org_invites
  where id = inv.id and accepted_at is null
  for update;
  if inv.id is null then raise exception 'invite invalid or used'; end if;
  if inv.expires_at <= now() then raise exception 'invite expired'; end if;

  select lower(email) into caller_email
  from auth.users
  where id = auth.uid();
  if caller_email is null or caller_email <> lower(inv.email) then
    raise exception 'invite email mismatch';
  end if;

  if exists (
    select 1 from public.org_members
    where org_id = inv.org_id and user_id = auth.uid()
  ) then
    update public.org_invites set accepted_at = now() where id = inv.id;
    return inv.org_id;
  end if;

  select count(*) into used_count
  from public.org_members
  where org_id = inv.org_id;
  if used_count >= seat_cap then raise exception 'seat limit reached'; end if;

  insert into public.org_members (org_id, user_id, role)
  values (inv.org_id, auth.uid(), inv.role);

  update public.org_invites set accepted_at = now() where id = inv.id;
  return inv.org_id;
end;
$$;

revoke all on function public.create_org_invite(uuid, text, text) from public;
revoke all on function public.accept_org_invite(text) from public;
grant execute on function public.create_org_invite(uuid, text, text) to authenticated;
grant execute on function public.accept_org_invite(text) to authenticated;
