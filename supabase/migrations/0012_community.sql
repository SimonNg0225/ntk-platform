-- ============================================================
--  EziTeach 教學易 · 0012_community（資源分享區 / 教學資源社群）
-- ------------------------------------------------------------
--  全港公開社群：老師發佈教學資源（上載實檔 or 連結）、瀏覽、搜尋、
--  下載、評分、收藏；檢舉 → 管理員下架。
--
--  · profiles            公開老師檔案（署名 / 私隱控制；匿名只係顯示層）
--  · shared_resources    分享資源主表（計數欄由 trigger / RPC 維護）
--  · resource_ratings    一人一評分（trigger 重算平均）
--  · resource_saves      收藏（trigger 維護 save_count）
--  · resource_reports    檢舉（client 只可 insert；admin service_role 讀）
--  · bump_download()     SECURITY DEFINER RPC：下載計數 +1
--  · guard_resource_counters  防 owner 直接篡改計數欄
--  · community bucket    private —— 只有登入老師簽名先下載到
-- ============================================================

-- ───────── profiles：公開老師檔案 ─────────
create table if not exists public.profiles (
  id           uuid        primary key references auth.users (id) on delete cascade,
  display_name text        not null,            -- 公開署名，例「陳老師」
  school       text,                            -- 學校（可空）
  show_school  boolean     not null default false,
  anonymous    boolean     not null default false,
  avatar_color text,                            -- 縮寫頭像底色（前端有預設）
  bio          text,
  subjects     text[]      not null default '{}',  -- 任教科目（subject pack id）
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles read all" on public.profiles;
create policy "profiles read all"
  on public.profiles for select to authenticated using (true);

drop policy if exists "profiles insert own" on public.profiles;
create policy "profiles insert own"
  on public.profiles for insert to authenticated with check (id = auth.uid());

drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own"
  on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ───────── shared_resources：分享資源主表 ─────────
create table if not exists public.shared_resources (
  id              uuid        primary key default gen_random_uuid(),
  owner_id        uuid        not null references auth.users (id) on delete cascade,
  title           text        not null,
  description     text,
  subject_pack_id text,                          -- 例 'bafs'（可空 = 通用）
  topic_id        text,                          -- 例 'econ-01'（可空）
  grade           text,                          -- 年級（可空）
  type            text        not null,          -- handout/slides/paper/link/video/note
  tags            text[]      not null default '{}',
  file_path       text,                          -- community bucket 路徑（連結型 = null）
  file_name       text,
  file_mime       text,
  file_size       integer,                       -- bytes
  external_url    text,                          -- 純連結型用（檔案型 = null）
  license         text        not null default 'original',  -- original / shareable
  status          text        not null default 'published', -- published / draft / removed
  download_count  integer     not null default 0,
  save_count      integer     not null default 0,
  rating_sum      integer     not null default 0,
  rating_count    integer     not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists shared_resources_browse_idx
  on public.shared_resources (status, created_at desc);
create index if not exists shared_resources_owner_idx
  on public.shared_resources (owner_id);
create index if not exists shared_resources_subject_idx
  on public.shared_resources (subject_pack_id);

alter table public.shared_resources enable row level security;

-- 讀：已發佈（任何登入老師）OR 自己（睇返草稿/已下架）
drop policy if exists "shared read published or own" on public.shared_resources;
create policy "shared read published or own"
  on public.shared_resources for select to authenticated
  using (status = 'published' or owner_id = auth.uid());

-- 插：只可插自己嘅；唔可以一開就 'removed'
drop policy if exists "shared insert own" on public.shared_resources;
create policy "shared insert own"
  on public.shared_resources for insert to authenticated
  with check (owner_id = auth.uid() and status in ('published', 'draft'));

-- 改 / 刪：只自己（計數欄另由 guard trigger 鎖住）
drop policy if exists "shared update own" on public.shared_resources;
create policy "shared update own"
  on public.shared_resources for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "shared delete own" on public.shared_resources;
create policy "shared delete own"
  on public.shared_resources for delete to authenticated
  using (owner_id = auth.uid());

-- 防 owner 篡改計數：一般 authenticated/anon 嘅 update 一律保留 OLD 計數值；
-- 只有 SECURITY DEFINER 維護函式（以 owner 身分跑）改得到。
create or replace function public.guard_resource_counters()
returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.download_count := old.download_count;
    new.save_count     := old.save_count;
    new.rating_sum     := old.rating_sum;
    new.rating_count   := old.rating_count;
  end if;
  return new;
end $$;

drop trigger if exists shared_resources_guard on public.shared_resources;
create trigger shared_resources_guard
  before update on public.shared_resources
  for each row execute function public.guard_resource_counters();

drop trigger if exists shared_resources_touch on public.shared_resources;
create trigger shared_resources_touch
  before update on public.shared_resources
  for each row execute function public.touch_updated_at();

-- ───────── resource_ratings：一人一評分 ─────────
create table if not exists public.resource_ratings (
  resource_id uuid        not null references public.shared_resources (id) on delete cascade,
  user_id     uuid        not null references auth.users (id) on delete cascade,
  stars       integer     not null check (stars between 1 and 5),
  created_at  timestamptz not null default now(),
  primary key (resource_id, user_id)
);

alter table public.resource_ratings enable row level security;

-- 只讀/寫自己（知「我畀過幾多星」）；公開平均分由 shared_resources.rating_* 計
drop policy if exists "ratings own" on public.resource_ratings;
create policy "ratings own"
  on public.resource_ratings for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 重算平均（SECURITY DEFINER → 以 owner 身分改 shared_resources 計數，繞過 guard）
create or replace function public.recompute_resource_rating()
returns trigger language plpgsql security definer set search_path = public as $$
declare rid uuid;
begin
  rid := coalesce(new.resource_id, old.resource_id);
  update public.shared_resources s set
    rating_sum   = coalesce((select sum(stars)  from public.resource_ratings where resource_id = rid), 0),
    rating_count = coalesce((select count(*)     from public.resource_ratings where resource_id = rid), 0)
  where s.id = rid;
  return null;
end $$;

drop trigger if exists resource_ratings_recompute on public.resource_ratings;
create trigger resource_ratings_recompute
  after insert or update or delete on public.resource_ratings
  for each row execute function public.recompute_resource_rating();

-- ───────── resource_saves：收藏（社群計數）─────────
create table if not exists public.resource_saves (
  resource_id uuid        not null references public.shared_resources (id) on delete cascade,
  user_id     uuid        not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (resource_id, user_id)
);

alter table public.resource_saves enable row level security;

drop policy if exists "saves own" on public.resource_saves;
create policy "saves own"
  on public.resource_saves for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.recompute_resource_saves()
returns trigger language plpgsql security definer set search_path = public as $$
declare rid uuid;
begin
  rid := coalesce(new.resource_id, old.resource_id);
  update public.shared_resources s set
    save_count = coalesce((select count(*) from public.resource_saves where resource_id = rid), 0)
  where s.id = rid;
  return null;
end $$;

drop trigger if exists resource_saves_recompute on public.resource_saves;
create trigger resource_saves_recompute
  after insert or delete on public.resource_saves
  for each row execute function public.recompute_resource_saves();

-- ───────── resource_reports：檢舉 ─────────
create table if not exists public.resource_reports (
  id          uuid        primary key default gen_random_uuid(),
  resource_id uuid        not null references public.shared_resources (id) on delete cascade,
  reporter_id uuid        not null references auth.users (id) on delete set null,
  reason      text        not null,    -- copyright / inappropriate / quality / other
  detail      text,
  status      text        not null default 'open',  -- open / reviewed / actioned
  created_at  timestamptz not null default now()
);

create index if not exists resource_reports_open_idx
  on public.resource_reports (status, created_at desc);

alter table public.resource_reports enable row level security;

-- 只可插自己嘅檢舉；唔開 select policy → admin 經 edge function（service_role）讀
drop policy if exists "reports insert own" on public.resource_reports;
create policy "reports insert own"
  on public.resource_reports for insert to authenticated
  with check (reporter_id = auth.uid());

-- ───────── 下載計數 RPC（SECURITY DEFINER，client 唔直接寫 counter）─────────
create or replace function public.bump_download(p_resource uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.shared_resources
    set download_count = download_count + 1
  where id = p_resource and status = 'published';
end $$;

grant execute on function public.bump_download(uuid) to authenticated;

-- ───────── community storage bucket（private）─────────
insert into storage.buckets (id, name, public)
  values ('community', 'community', false)
  on conflict (id) do nothing;

-- 寫：只可寫自己 uid 資料夾（同 scans 一致）
drop policy if exists "community insert own" on storage.objects;
create policy "community insert own"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'community' and (storage.foldername(name))[1] = auth.uid()::text);

-- 讀：任何登入老師可簽名（→ 未登入冇 session 攞唔到，下載唔到）
drop policy if exists "community read auth" on storage.objects;
create policy "community read auth"
  on storage.objects for select to authenticated
  using (bucket_id = 'community');

drop policy if exists "community update own" on storage.objects;
create policy "community update own"
  on storage.objects for update to authenticated
  using (bucket_id = 'community' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "community delete own" on storage.objects;
create policy "community delete own"
  on storage.objects for delete to authenticated
  using (bucket_id = 'community' and (storage.foldername(name))[1] = auth.uid()::text);
