-- ============================================================
--  NTK Platform · 0007_ai_usage_per_feature
--  AI 額度改「按功能」分流：
--    · 一般 AI（出題 / 批改 / 教案 / AI 助手…）：免費每日上限、Pro 無限（同舊）。
--    · 錄音轉文字（音訊成本高）：免費 / Pro 各有每月上限。
--  ------------------------------------------------------------
--  ai_usage 由 (user_id, day) 改成通用 (user_id, bucket)，
--  bucket = "<feature>:<period>"，例：
--    "general:2026-06-08"（一般 AI，按日）
--    "transcribe:2026-06"（錄音轉文字，按月）
--  上限同 bucket 由 gemini Edge Function 按 feature + plan 決定後傳入。
-- ============================================================

-- 由 0003 嘅 (user_id, day) 改成通用 bucket。計數無價值，直接重建（簽名都變咗）。
drop function if exists public.consume_ai_quota(uuid, int);
drop table if exists public.ai_usage;

create table public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  bucket  text not null,
  count   int  not null default 0,
  primary key (user_id, bucket)
);

alter table public.ai_usage enable row level security;

drop policy if exists "ai_usage read own" on public.ai_usage;
create policy "ai_usage read own"
  on public.ai_usage
  for select
  to authenticated
  using (user_id = auth.uid());
-- 冇 insert/update policy → 前端寫唔到；只 service_role / SECURITY DEFINER 可寫。

-- 通用原子配額：bucket 由 caller（Edge Function）決定（已含功能 + 週期）。
-- 插入該 bucket 行（如無）→ 鎖定 → 未到上限就 +1。回 allowed / used。
create or replace function public.consume_ai_quota(p_user uuid, p_bucket text, p_limit int)
returns table(allowed boolean, used int)
language plpgsql
security definer
set search_path = public
as $$
declare
  cur int;
begin
  insert into public.ai_usage (user_id, bucket, count)
    values (p_user, p_bucket, 0)
    on conflict (user_id, bucket) do nothing;

  select count into cur
    from public.ai_usage
    where user_id = p_user and bucket = p_bucket
    for update;

  if cur >= p_limit then
    return query select false, cur;
  else
    update public.ai_usage
      set count = count + 1
      where user_id = p_user and bucket = p_bucket;
    return query select true, cur + 1;
  end if;
end;
$$;
