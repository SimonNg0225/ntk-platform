-- 0017_refunds.sql — 退款申請紀錄
-- ------------------------------------------------------------
-- 退款 policy：按 AI 點數使用度退「未用份額」，用戶承擔 Stripe 手續費，
-- 一次性（退完即取消訂閱）；細額自動、大額入 admin 審。
-- 寫入只經 service_role（refund edge function）；用戶只可讀自己。

create table if not exists public.refunds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_subscription_id text,
  stripe_refund_id text,
  amount_paid_cents int not null default 0,   -- 本期已付（仙）
  fee_cents int not null default 0,           -- Stripe 手續費（仙；用戶承擔）
  refund_cents int not null default 0,        -- 實退（仙）
  currency text not null default 'hkd',
  usage_pct numeric not null default 0,       -- 當期 AI 點數用量（0..1）
  status text not null default 'pending_review', -- pending_review | done | rejected
  note text,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists refunds_user_idx on public.refunds (user_id);
create index if not exists refunds_status_idx on public.refunds (status);

alter table public.refunds enable row level security;

drop policy if exists "refunds read own" on public.refunds;
create policy "refunds read own" on public.refunds
  for select to authenticated using (user_id = auth.uid());
