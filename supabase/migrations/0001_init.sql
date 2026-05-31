-- ============================================================
--  NTK Platform · 0001_init
--  雲端資料同步基礎表
-- ------------------------------------------------------------
--  設計：一張通用表 app_rows 存放所有「集合 (collection)」。
--    - 每個 user × 每個 collection = 一個 row
--    - row 入面 data 係一個 JSONB 陣列（即係該集合全部項目）
--    - 前端用 (user_id, collection) 做 key 嚟 upsert / 讀取
--
--  點解唔逐個功能開一張表？
--    - 呢個平台嘅核心係「登記一個集合就有新功能」，資料形狀千變萬化。
--    - 用一張通用表 + RLS，加新集合完全唔使再寫 SQL，維護成本最低。
--    - 個人用途、每個集合資料量細，整個集合一次過讀寫完全夠用。
--
--  安全：開 RLS，policy 保證每個 user 淨係掂到自己 user_id 嘅 row。
-- ============================================================

create table if not exists public.app_rows (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  collection text        not null,
  data       jsonb       not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, collection)
);

-- 開 Row Level Security
alter table public.app_rows enable row level security;

-- 一個 policy cover 晒 SELECT / INSERT / UPDATE / DELETE
-- using       → 讀 / 改 / 刪：只可以掂自己嘅 row
-- with check  → 寫入：只可以寫自己 user_id 嘅 row
drop policy if exists "app_rows owner full access" on public.app_rows;
create policy "app_rows owner full access"
  on public.app_rows
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 自動更新 updated_at（每次寫入都 stamp 一次）
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists app_rows_touch_updated_at on public.app_rows;
create trigger app_rows_touch_updated_at
  before update on public.app_rows
  for each row
  execute function public.touch_updated_at();
