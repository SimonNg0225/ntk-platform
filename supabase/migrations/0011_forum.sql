-- ============================================================
--  EziTeach · 0011_forum（老師社群論壇）
--  讀：RLS 開放登入老師讀全部活躍內容；寫：經 forum Edge Function（service_role）。
--  reactions 例外：client 可寫自己；計數由 trigger 維護。
-- ============================================================

-- 公開 profile（顯示名 + 學校 + 科目）
create table if not exists public.forum_profiles (
  user_id      uuid        primary key references auth.users(id) on delete cascade,
  display_name text        not null,
  school       text,
  subjects     text[]      not null default '{}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.forum_boards (
  id          uuid        primary key default gen_random_uuid(),
  slug        text        not null unique,
  name        text        not null,
  description text        not null default '',
  sort        int         not null default 0,
  archived    boolean     not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists public.forum_threads (
  id               uuid        primary key default gen_random_uuid(),
  board_id         uuid        not null references public.forum_boards(id) on delete cascade,
  author_id        uuid        not null references auth.users(id) on delete cascade,
  title            text        not null,
  body             text        not null,
  tags             text[]      not null default '{}',
  status           text        not null default 'active',   -- active|locked|removed
  pinned           boolean     not null default false,
  featured         boolean     not null default false,
  reply_count      int         not null default 0,
  score            int         not null default 0,
  last_activity_at timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists forum_threads_board_active_idx on public.forum_threads (board_id, last_activity_at desc);
create index if not exists forum_threads_board_score_idx  on public.forum_threads (board_id, score desc);

create table if not exists public.forum_posts (
  id         uuid        primary key default gen_random_uuid(),
  thread_id  uuid        not null references public.forum_threads(id) on delete cascade,
  author_id  uuid        not null references auth.users(id) on delete cascade,
  body       text        not null,
  status     text        not null default 'active',         -- active|removed
  score      int         not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists forum_posts_thread_idx on public.forum_posts (thread_id, created_at);

create table if not exists public.forum_reactions (
  user_id     uuid        not null references auth.users(id) on delete cascade,
  target_type text        not null,   -- thread|post
  target_id   uuid        not null,
  kind        text        not null,   -- up|save
  created_at  timestamptz not null default now(),
  primary key (user_id, target_type, target_id, kind)
);

create table if not exists public.forum_reports (
  id          uuid        primary key default gen_random_uuid(),
  reporter_id uuid        not null references auth.users(id) on delete cascade,
  target_type text        not null,   -- thread|post
  target_id   uuid        not null,
  reason      text        not null default '',
  status      text        not null default 'open',  -- open|resolved
  created_at  timestamptz not null default now()
);
create index if not exists forum_reports_status_idx on public.forum_reports (status, created_at desc);

create table if not exists public.forum_bans (
  user_id    uuid        primary key references auth.users(id) on delete cascade,
  reason     text,
  banned_by  text,
  created_at timestamptz not null default now()
);

-- ── RLS ──
alter table public.forum_profiles  enable row level security;
alter table public.forum_boards    enable row level security;
alter table public.forum_threads   enable row level security;
alter table public.forum_posts     enable row level security;
alter table public.forum_reactions enable row level security;
alter table public.forum_reports   enable row level security;
alter table public.forum_bans      enable row level security;

drop policy if exists "fp read all"  on public.forum_profiles;
create policy "fp read all"  on public.forum_profiles for select to authenticated using (true);
drop policy if exists "fp upsert own" on public.forum_profiles;
create policy "fp upsert own" on public.forum_profiles for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "fp update own" on public.forum_profiles;
create policy "fp update own" on public.forum_profiles for update to authenticated using (user_id = auth.uid());

drop policy if exists "fb read" on public.forum_boards;
create policy "fb read" on public.forum_boards for select to authenticated using (archived = false);

drop policy if exists "ft read" on public.forum_threads;
create policy "ft read" on public.forum_threads for select to authenticated using (status <> 'removed');

drop policy if exists "fpo read" on public.forum_posts;
create policy "fpo read" on public.forum_posts for select to authenticated using (status = 'active');

drop policy if exists "fr read own" on public.forum_reactions;
create policy "fr read own" on public.forum_reactions for select to authenticated using (true);
drop policy if exists "fr write own" on public.forum_reactions;
create policy "fr write own" on public.forum_reactions for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "fr delete own" on public.forum_reactions;
create policy "fr delete own" on public.forum_reactions for delete to authenticated using (user_id = auth.uid());

drop policy if exists "frep insert own" on public.forum_reports;
create policy "frep insert own" on public.forum_reports for insert to authenticated with check (reporter_id = auth.uid());
-- forum_reports 唔開 select（admin service_role 先睇）；forum_bans 零 policy。
-- threads/posts 唔開 client insert/update/delete（全經 forum Edge Function）。

-- ── Triggers：維護 reply_count / score / last_activity_at ──
create or replace function public.forum_after_post() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and new.status = 'active' then
    update public.forum_threads
      set reply_count = reply_count + 1, last_activity_at = now()
      where id = new.thread_id;
  elsif tg_op = 'UPDATE' and old.status = 'active' and new.status = 'removed' then
    update public.forum_threads
      set reply_count = greatest(reply_count - 1, 0)
      where id = new.thread_id;
  end if;
  return new;
end; $$;
drop trigger if exists forum_posts_after on public.forum_posts;
create trigger forum_posts_after after insert or update on public.forum_posts
  for each row execute function public.forum_after_post();

create or replace function public.forum_after_reaction() returns trigger
language plpgsql security definer set search_path = public as $$
declare d int; t text; tid uuid;
begin
  if tg_op = 'INSERT' then d := 1; t := new.target_type; tid := new.target_id;
  else d := -1; t := old.target_type; tid := old.target_id; end if;
  if coalesce(new.kind, old.kind) <> 'up' then return coalesce(new, old); end if;
  if t = 'thread' then update public.forum_threads set score = greatest(score + d, 0) where id = tid;
  elsif t = 'post' then update public.forum_posts  set score = greatest(score + d, 0) where id = tid; end if;
  return coalesce(new, old);
end; $$;
drop trigger if exists forum_reactions_after on public.forum_reactions;
create trigger forum_reactions_after after insert or delete on public.forum_reactions
  for each row execute function public.forum_after_reaction();

-- ── Seed 版區 ──
insert into public.forum_boards (slug, name, description, sort) values
  ('staffroom',   '茶水間',     '輕鬆閒聊、教師日常', 10),
  ('classroom',   '班級經營',   '班務、訓輔、學生關係', 20),
  ('assessment',  '考評與評估', '出卷、評分、DSE/校內考評', 30),
  ('career',      '行政與職涯', '行政事務、晉升、教師職涯', 40),
  ('jobs',        '見工 / 求職', '教席招聘、見工心得、求職交流', 50),
  ('subj-chinese','中文科',     '中文科教學交流', 100),
  ('subj-english','英文科',     'English panel discussion', 110),
  ('subj-maths',  '數學科',     '數學科教學交流', 120),
  ('subj-ls',     '公民/通識',  '公民與社會發展科', 130),
  ('subj-bafs',   'BAFS',       '企業、會計與財務概論', 140)
on conflict (slug) do nothing;
