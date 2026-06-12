-- ============================================================
--  EziTeach 教學易 · 0010_ai_usage_stats（AI 真實用量 / 成本記錄）
-- ------------------------------------------------------------
--  ai_usage（0007）係「額度計數器」：Pro 一般 AI 唔扣額 → 唔寫表，
--  白名單跳過，亦冇 per-feature。故無法反映真實成本。
--
--  本表 ai_usage_stats 係「用量分析日誌」（月度聚合）：
--    gemini Edge Function 每次成功呼叫後 best-effort 記低，
--    *所有* 用戶都計（連 Pro / 白名單），帶住功能 + model + 真實 token。
--    成本 = token × 單價（由後台按 model 計），唔再靠「每次估」。
--
--  安全：用戶只讀自己；寫入只限 service_role / SECURITY DEFINER 函數。
-- ============================================================

create table if not exists public.ai_usage_stats (
  user_id    uuid   not null references auth.users (id) on delete cascade,
  ym         text   not null,                 -- 月份 bucket，例：2026-06
  feature    text   not null default 'general',-- 功能 source（grading / slides / transcribe…）
  model      text   not null default 'unknown',-- gemini-2.5-flash / gemini-2.5-pro
  calls      int    not null default 0,
  in_tokens  bigint not null default 0,        -- prompt tokens 累計
  out_tokens bigint not null default 0,        -- candidates tokens 累計
  updated_at timestamptz not null default now(),
  primary key (user_id, ym, feature, model)
);

create index if not exists ai_usage_stats_ym_idx on public.ai_usage_stats (ym);

alter table public.ai_usage_stats enable row level security;

drop policy if exists "ai_usage_stats read own" on public.ai_usage_stats;
create policy "ai_usage_stats read own"
  on public.ai_usage_stats
  for select
  to authenticated
  using (user_id = auth.uid());
-- 冇 insert/update policy → 前端寫唔到；只 service_role / SECURITY DEFINER 可寫。

-- 原子累加：插入該 (user, 月, 功能, model) 行（如無）→ 累加 calls / tokens。
-- 由 gemini Edge Function（service_role）每次成功呼叫後呼叫；失敗唔阻 AI 回應。
create or replace function public.bump_ai_usage(
  p_user uuid, p_ym text, p_feature text, p_model text,
  p_in int, p_out int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.ai_usage_stats (user_id, ym, feature, model, calls, in_tokens, out_tokens)
    values (p_user, p_ym, coalesce(nullif(p_feature, ''), 'general'),
            coalesce(nullif(p_model, ''), 'unknown'), 1, greatest(p_in, 0), greatest(p_out, 0))
  on conflict (user_id, ym, feature, model) do update
    set calls      = public.ai_usage_stats.calls + 1,
        in_tokens  = public.ai_usage_stats.in_tokens + greatest(p_in, 0),
        out_tokens = public.ai_usage_stats.out_tokens + greatest(p_out, 0),
        updated_at = now();
end;
$$;
