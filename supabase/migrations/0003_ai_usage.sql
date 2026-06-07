-- ============================================================
--  NTK Platform · 0003_ai_usage
--  商業化 P1：免費版每日 AI 額度（防 Gemini 成本被刷爆）
-- ------------------------------------------------------------
--  - ai_usage：每個 user × 每日一行，記低當日 AI 呼叫次數。
--  - consume_ai_quota()：原子地檢查 + 遞增，避免並發 race。
--    由 Gemini Edge Function（service_role）呼叫；Pro 用戶唔行此檢查。
--  - RLS：用戶只可讀自己用量（前端可顯示「今日剩餘」）；寫入只限
--    service_role / SECURITY DEFINER 函數。
-- ============================================================

create table if not exists public.ai_usage (
  user_id uuid  not null references auth.users (id) on delete cascade,
  day     date  not null default current_date,
  count   int   not null default 0,
  primary key (user_id, day)
);

alter table public.ai_usage enable row level security;

drop policy if exists "ai_usage read own" on public.ai_usage;
create policy "ai_usage read own"
  on public.ai_usage
  for select
  to authenticated
  using (user_id = auth.uid());
-- 冇 insert/update policy → 前端寫唔到；只 service_role / SECURITY DEFINER 可寫。

-- 原子配額：插入當日行（如無）→ 鎖定 → 未到上限就 +1。
-- 回 allowed（今次准唔准）同 used（遞增後用量）。
create or replace function public.consume_ai_quota(p_user uuid, p_limit int)
returns table(allowed boolean, used int)
language plpgsql
security definer
set search_path = public
as $$
declare
  cur int;
begin
  insert into public.ai_usage (user_id, day, count)
    values (p_user, current_date, 0)
    on conflict (user_id, day) do nothing;

  select count into cur
    from public.ai_usage
    where user_id = p_user and day = current_date
    for update;

  if cur >= p_limit then
    return query select false, cur;
  else
    update public.ai_usage
      set count = count + 1
      where user_id = p_user and day = current_date;
    return query select true, cur + 1;
  end if;
end;
$$;
