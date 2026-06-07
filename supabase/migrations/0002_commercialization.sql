-- ============================================================
--  NTK Platform · 0002_commercialization
--  商業化：訂閱 (subscriptions) + Webhook 冪等 (billing_events)
-- ------------------------------------------------------------
--  多租戶安全原則：
--    - 每個 user 一行 subscriptions（user_id = PK）。
--    - RLS 只開「讀自己」畀 authenticated；
--      *冇* INSERT / UPDATE / DELETE policy → 前端永遠改唔到自己嘅訂閱狀態。
--    - 唯一寫入者係 Stripe Webhook Edge Function，佢用 service_role key
--      （繞過 RLS）嚟 upsert，確保訂閱狀態只可以由 Stripe 真相驅動。
-- ============================================================

-- ── 訂閱狀態 ────────────────────────────────────────────────
create table if not exists public.subscriptions (
  user_id                uuid        primary key
                                     references auth.users (id) on delete cascade,
  stripe_customer_id     text        unique,
  stripe_subscription_id text        unique,
  plan                   text        not null default 'free',   -- 'free' | 'pro'
  status                 text        not null default 'inactive',-- Stripe 訂閱狀態
  current_period_end     timestamptz,
  updated_at             timestamptz not null default now()
);

-- 用 customer id 反查 user（webhook 收到 subscription.* 事件時要）
create index if not exists subscriptions_stripe_customer_idx
  on public.subscriptions (stripe_customer_id);

alter table public.subscriptions enable row level security;

-- 只開「讀自己」。注意：故意冇 with check 嘅寫入 policy。
drop policy if exists "subscriptions read own" on public.subscriptions;
create policy "subscriptions read own"
  on public.subscriptions
  for select
  to authenticated
  using (user_id = auth.uid());

-- 沿用 0001 嘅 touch_updated_at()，每次寫入 stamp updated_at
drop trigger if exists subscriptions_touch_updated_at on public.subscriptions;
create trigger subscriptions_touch_updated_at
  before update on public.subscriptions
  for each row
  execute function public.touch_updated_at();

-- ── Webhook 冪等表 ─────────────────────────────────────────
--  Stripe 會重送事件；用 event id 做 PK，重複事件 insert 衝突即跳過。
create table if not exists public.billing_events (
  id          text        primary key,   -- Stripe event id（evt_...）
  type        text,
  received_at timestamptz not null default now()
);

alter table public.billing_events enable row level security;
-- 完全唔開 policy → 前端零存取；只有 service_role（webhook）掂到。
