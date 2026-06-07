-- ============================================================
--  EziTeach 教學易 · 0006_support（客服 / 意見）
-- ------------------------------------------------------------
--  in-app 客服表單嘅後台：support 表單 → support edge function
--  （service_role）插入 support_tickets + email 通知客服。
--  RLS：用戶只可讀自己提交嘅 ticket；寫入只限 service_role（edge function）。
-- ============================================================

create table if not exists public.support_tickets (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        references auth.users (id) on delete set null,
  email      text,
  subject    text        not null,
  message    text        not null,
  status     text        not null default 'open',  -- open / closed
  created_at timestamptz not null default now()
);

create index if not exists support_tickets_user_idx
  on public.support_tickets (user_id);

alter table public.support_tickets enable row level security;

-- 用戶讀自己嘅 ticket（可做「我嘅查詢」清單）；冇 insert policy → 只 service_role 寫
drop policy if exists "support read own" on public.support_tickets;
create policy "support read own"
  on public.support_tickets
  for select
  to authenticated
  using (user_id = auth.uid());
