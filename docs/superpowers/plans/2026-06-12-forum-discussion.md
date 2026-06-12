# 討論區（老師社群論壇）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 喺 EziTeach 加一個全平台老師社群論壇（版 → 帖 → 回覆 + 讚/收藏 + 檢舉 + 後台審核），純文字 MVP，可靠有測試。

**Architecture:** Approach A —— 讀靠 Supabase RLS 直連（前端 client）；寫（發帖/回覆/編輯/刪/檢舉/profile）經新 `forum` Edge Function 做驗證 + rate-limit + 封禁；計數靠 DB trigger；審核擴充現有 `admin` Edge Function。論壇資料係伺服器專屬，唔入 localStorage/collections。

**Tech Stack:** React + TS + Vite + Tailwind、Supabase（Postgres + RLS + Deno Edge Functions）、vitest。沿用現有 `src/lib/admin.ts` fetch 封裝、`src/ui` kit、`features/registry`。

參考 spec：`docs/superpowers/specs/2026-06-12-forum-discussion-design.md`

---

## File Structure

**後端**
- `supabase/migrations/0011_forum.sql` — 7 表 + 索引 + RLS + triggers（建立）
- `supabase/functions/forum/index.ts` — 寫入把關 Edge Function（建立）
- `supabase/functions/admin/index.ts` — 加論壇審核 actions（修改）

**前端**
- `src/features/forum/types.ts` — 型別（建立）
- `src/features/forum/logic.ts` — 純邏輯（驗證/排序/連結數）（建立）
- `src/features/forum/logic.test.ts` — 單元測試（建立）
- `src/features/forum/api.ts` — 讀（RLS）+ 寫（forum fn）資料層（建立）
- `src/features/forum/Forum.tsx` — 功能殼 + 內部路由（建立）
- `src/features/forum/BoardList.tsx`、`ThreadList.tsx`、`ThreadView.tsx`、`ProfileEdit.tsx`、`ReportModal.tsx`（建立）
- `src/features/registry.ts` — 登記 forum 功能（修改）
- `src/lib/admin.ts` — 加論壇審核 client 函數（修改）
- `src/pages/Admin.tsx` — 加「論壇檢舉」卡（修改）
- `src/i18n/appEn.ts` — 英文字串（修改）

---

## Phase 1 — 後端（資料 + 安全）

### Task 1: Migration `0011_forum.sql`

**Files:**
- Create: `supabase/migrations/0011_forum.sql`

- [ ] **Step 1: 寫 migration（表 + 索引 + RLS + triggers + seed）**

```sql
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
```

- [ ] **Step 2: 提交**

```bash
git add supabase/migrations/0011_forum.sql
git commit -m "feat(forum): 0011 migration — 表 + RLS + triggers + seed 版區"
```

> 註：sandbox 跑唔到 Supabase。RLS / trigger 正確性由用戶 `supabase db push` 後實測（標明未核實）。

---

### Task 2: `forum` Edge Function（寫入把關）

**Files:**
- Create: `supabase/functions/forum/index.ts`

- [ ] **Step 1: 寫 Edge Function**

```ts
// ============================================================
//  Edge Function: forum —— 論壇寫入把關
//  驗登入 → 查封禁 → rate-limit → 內容驗證 → service_role 寫入。
//  actions: create-thread / create-post / edit-own / delete-own / report / set-profile
//  部署：supabase functions deploy forum
// ============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const EDIT_WINDOW_MS = 30 * 60 * 1000        // 發出後 30 分鐘可改
const NEW_ACCOUNT_MS = 10 * 60 * 1000        // account <10 分鐘唔可發帖

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
function json(o: unknown, s = 200) {
  return new Response(JSON.stringify(o), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })
}
function countLinks(s: string): number { return (s.match(/https?:\/\//gi) ?? []).length }
function clean(s: unknown): string { return typeof s === 'string' ? s.trim() : '' }

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const auth = req.headers.get('Authorization') ?? ''
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: auth } } })
  const { data: { user }, error: authErr } = await userClient.auth.getUser()
  if (authErr || !user) return json({ error: '請先登入。' }, 401)

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json({ error: 'Bad JSON' }, 400) }
  const action = String(body.action ?? '')
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  // 封禁
  const { data: ban } = await admin.from('forum_bans').select('user_id').eq('user_id', user.id).maybeSingle()
  if (ban) return json({ error: '你已被禁止喺討論區發言。' }, 403)

  // rate-limit：數最近 60 秒自己嘅內容
  async function tooMany(table: string, col: string, limit: number): Promise<boolean> {
    const since = new Date(Date.now() - 60_000).toISOString()
    const { count } = await admin.from(table).select('id', { count: 'exact', head: true })
      .eq(col, user!.id).gte('created_at', since)
    return (count ?? 0) >= limit
  }

  try {
    if (action === 'create-thread') {
      if (Date.now() - new Date(user.created_at).getTime() < NEW_ACCOUNT_MS)
        return json({ error: '新帳戶請稍候再發帖。' }, 429)
      if (await tooMany('forum_threads', 'author_id', 3)) return json({ error: '發帖太快，唞一唞。' }, 429)
      const title = clean(body.title), bodyTxt = clean(body.body)
      const board_id = clean(body.board_id)
      const tags = Array.isArray(body.tags) ? body.tags.map(clean).filter(Boolean).slice(0, 5) : []
      if (!board_id) return json({ error: '缺少版區。' }, 400)
      if (title.length < 1 || title.length > 120) return json({ error: '標題需 1–120 字。' }, 400)
      if (bodyTxt.length < 1 || bodyTxt.length > 5000) return json({ error: '內文需 1–5000 字。' }, 400)
      if (countLinks(bodyTxt) > 5) return json({ error: '連結太多。' }, 400)
      const { data, error } = await admin.from('forum_threads')
        .insert({ board_id, author_id: user.id, title, body: bodyTxt, tags })
        .select('id').single()
      if (error) return json({ error: error.message }, 500)
      return json({ data: { id: data.id } })
    }

    if (action === 'create-post') {
      if (await tooMany('forum_posts', 'author_id', 10)) return json({ error: '回覆太快，唞一唞。' }, 429)
      const thread_id = clean(body.thread_id), bodyTxt = clean(body.body)
      if (!thread_id) return json({ error: '缺少主題。' }, 400)
      if (bodyTxt.length < 1 || bodyTxt.length > 5000) return json({ error: '回覆需 1–5000 字。' }, 400)
      if (countLinks(bodyTxt) > 5) return json({ error: '連結太多。' }, 400)
      const { data: th } = await admin.from('forum_threads').select('status').eq('id', thread_id).maybeSingle()
      if (!th || th.status !== 'active') return json({ error: '此主題唔接受回覆。' }, 400)
      const { data, error } = await admin.from('forum_posts')
        .insert({ thread_id, author_id: user.id, body: bodyTxt }).select('id').single()
      if (error) return json({ error: error.message }, 500)
      return json({ data: { id: data.id } })
    }

    if (action === 'edit-own') {
      const type = String(body.type), id = clean(body.id), bodyTxt = clean(body.body)
      const table = type === 'thread' ? 'forum_threads' : 'forum_posts'
      const { data: row } = await admin.from(table).select('author_id, created_at, status').eq('id', id).maybeSingle()
      if (!row || row.author_id !== user.id) return json({ error: '只可編輯自己嘅內容。' }, 403)
      if (row.status === 'removed') return json({ error: '內容已刪除。' }, 400)
      if (Date.now() - new Date(row.created_at).getTime() > EDIT_WINDOW_MS) return json({ error: '已過編輯時限（30 分鐘）。' }, 400)
      if (bodyTxt.length < 1 || bodyTxt.length > 5000) return json({ error: '內文需 1–5000 字。' }, 400)
      const patch: Record<string, unknown> = { body: bodyTxt, updated_at: new Date().toISOString() }
      if (type === 'thread' && typeof body.title === 'string') {
        const title = clean(body.title)
        if (title.length < 1 || title.length > 120) return json({ error: '標題需 1–120 字。' }, 400)
        patch.title = title
      }
      const { error } = await admin.from(table).update(patch).eq('id', id)
      if (error) return json({ error: error.message }, 500)
      return json({ data: { ok: true } })
    }

    if (action === 'delete-own') {
      const type = String(body.type), id = clean(body.id)
      const table = type === 'thread' ? 'forum_threads' : 'forum_posts'
      const { data: row } = await admin.from(table).select('author_id').eq('id', id).maybeSingle()
      if (!row || row.author_id !== user.id) return json({ error: '只可刪除自己嘅內容。' }, 403)
      const { error } = await admin.from(table).update({ status: 'removed' }).eq('id', id)
      if (error) return json({ error: error.message }, 500)
      return json({ data: { ok: true } })
    }

    if (action === 'report') {
      if (await tooMany('forum_reports', 'reporter_id', 20)) return json({ error: '檢舉太頻密。' }, 429)
      const target_type = String(body.target_type), target_id = clean(body.target_id), reason = clean(body.reason).slice(0, 500)
      if (!['thread', 'post'].includes(target_type) || !target_id) return json({ error: '參數不正確。' }, 400)
      const { error } = await admin.from('forum_reports')
        .insert({ reporter_id: user.id, target_type, target_id, reason })
      if (error) return json({ error: error.message }, 500)
      return json({ data: { ok: true } })
    }

    if (action === 'set-profile') {
      const display_name = clean(body.display_name)
      if (display_name.length < 1 || display_name.length > 40) return json({ error: '顯示名需 1–40 字。' }, 400)
      const school = clean(body.school).slice(0, 60) || null
      const subjects = Array.isArray(body.subjects) ? body.subjects.map(clean).filter(Boolean).slice(0, 8) : []
      const { error } = await admin.from('forum_profiles')
        .upsert({ user_id: user.id, display_name, school, subjects, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
      if (error) return json({ error: error.message }, 500)
      return json({ data: { ok: true } })
    }

    return json({ error: `未知 action：${action}` }, 400)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : '伺服器錯誤。' }, 500)
  }
})
```

- [ ] **Step 2: 提交**

```bash
git add supabase/functions/forum/index.ts
git commit -m "feat(forum): forum Edge Function — 驗證 + rate-limit + 封禁 + service_role 寫入"
```

---

## Phase 2 — 前端資料層 + 純邏輯

### Task 3: 型別

**Files:**
- Create: `src/features/forum/types.ts`

- [ ] **Step 1: 寫型別**

```ts
export interface ForumBoard {
  id: string; slug: string; name: string; description: string
  sort: number; archived: boolean; created_at: string
}
export interface ForumProfile {
  user_id: string; display_name: string; school: string | null
  subjects: string[]; created_at: string; updated_at: string
}
export type ThreadStatus = 'active' | 'locked' | 'removed'
export interface ForumThread {
  id: string; board_id: string; author_id: string
  title: string; body: string; tags: string[]
  status: ThreadStatus; pinned: boolean; featured: boolean
  reply_count: number; score: number
  last_activity_at: string; created_at: string; updated_at: string
  authorName?: string         // 由 profile 併入
  mineUp?: boolean; mineSave?: boolean
}
export interface ForumPost {
  id: string; thread_id: string; author_id: string
  body: string; status: 'active' | 'removed'; score: number
  created_at: string; updated_at: string
  authorName?: string; mineUp?: boolean
}
export type ThreadSort = 'new' | 'replies' | 'top'
```

- [ ] **Step 2: 提交**

```bash
git add src/features/forum/types.ts
git commit -m "feat(forum): 型別"
```

---

### Task 4: 純邏輯 + 測試（TDD）

**Files:**
- Create: `src/features/forum/logic.ts`
- Test: `src/features/forum/logic.test.ts`

- [ ] **Step 1: 寫失敗測試**

```ts
import { describe, it, expect } from 'vitest'
import { countLinks, validateThread, validatePost, sortColumn, toggleSet } from './logic'

describe('forum logic', () => {
  it('countLinks', () => {
    expect(countLinks('no links')).toBe(0)
    expect(countLinks('see https://a.com and http://b.com')).toBe(2)
  })
  it('validateThread', () => {
    expect(validateThread('', 'body')).toBe('標題需 1–120 字。')
    expect(validateThread('x'.repeat(121), 'body')).toBe('標題需 1–120 字。')
    expect(validateThread('title', '')).toBe('內文需 1–5000 字。')
    expect(validateThread('title', 'l '.repeat(10) + 'http://a http://b http://c http://d http://e http://f')).toBe('連結太多（最多 5 條）。')
    expect(validateThread('title', 'ok body')).toBeNull()
  })
  it('validatePost', () => {
    expect(validatePost('')).toBe('回覆需 1–5000 字。')
    expect(validatePost('hi')).toBeNull()
  })
  it('sortColumn maps sort → {column, ascending}', () => {
    expect(sortColumn('new')).toEqual({ column: 'last_activity_at', ascending: false })
    expect(sortColumn('replies')).toEqual({ column: 'reply_count', ascending: false })
    expect(sortColumn('top')).toEqual({ column: 'score', ascending: false })
  })
  it('toggleSet adds/removes', () => {
    const s = new Set(['a'])
    expect([...toggleSet(s, 'b', true)]).toContain('b')
    expect([...toggleSet(s, 'a', false)]).not.toContain('a')
  })
})
```

- [ ] **Step 2: 跑測試確認 fail**

Run: `npx vitest run src/features/forum/logic.test.ts`
Expected: FAIL（`logic.ts` 未有呢啲 export）

- [ ] **Step 3: 寫 `logic.ts`**

```ts
import type { ThreadSort } from './types'

export function countLinks(s: string): number {
  return (s.match(/https?:\/\//gi) ?? []).length
}
export function validateThread(title: string, body: string): string | null {
  const t = title.trim(), b = body.trim()
  if (t.length < 1 || t.length > 120) return '標題需 1–120 字。'
  if (b.length < 1 || b.length > 5000) return '內文需 1–5000 字。'
  if (countLinks(b) > 5) return '連結太多（最多 5 條）。'
  return null
}
export function validatePost(body: string): string | null {
  const b = body.trim()
  if (b.length < 1 || b.length > 5000) return '回覆需 1–5000 字。'
  if (countLinks(b) > 5) return '連結太多（最多 5 條）。'
  return null
}
export function sortColumn(sort: ThreadSort): { column: string; ascending: boolean } {
  if (sort === 'replies') return { column: 'reply_count', ascending: false }
  if (sort === 'top') return { column: 'score', ascending: false }
  return { column: 'last_activity_at', ascending: false }
}
export function toggleSet(set: Set<string>, id: string, on: boolean): Set<string> {
  const next = new Set(set)
  if (on) next.add(id); else next.delete(id)
  return next
}
```

- [ ] **Step 4: 跑測試確認 pass**

Run: `npx vitest run src/features/forum/logic.test.ts`
Expected: PASS（5 tests）

- [ ] **Step 5: 提交**

```bash
git add src/features/forum/logic.ts src/features/forum/logic.test.ts
git commit -m "feat(forum): 純邏輯（驗證/排序/連結數）+ 測試"
```

---

### Task 5: 資料層 `api.ts`

**Files:**
- Create: `src/features/forum/api.ts`

- [ ] **Step 1: 寫 api（讀 = supabase RLS；寫 = forum fn）**

```ts
import { supabase } from '../../lib/supabase'
import { sortColumn } from './logic'
import type { ForumBoard, ForumThread, ForumPost, ForumProfile, ThreadSort } from './types'

const PAGE = 20

async function callForum<T>(action: string, body: Record<string, unknown> = {}): Promise<T> {
  if (!supabase) throw new Error('未接 Supabase。')
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('請先登入。')
  const base = (import.meta.env.VITE_SUPABASE_URL as string).replace(/\/$/, '')
  const res = await fetch(`${base}/functions/v1/forum`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
    },
    body: JSON.stringify({ action, ...body }),
  })
  const data = (await res.json().catch(() => null)) as { data?: T; error?: string } | null
  if (!res.ok || !data) throw new Error(data?.error ?? '操作失敗。')
  return data.data as T
}

// 併入作者顯示名（一個 .in() 查 forum_profiles）
async function attachAuthors<T extends { author_id: string; authorName?: string }>(rows: T[]): Promise<T[]> {
  if (!supabase || rows.length === 0) return rows
  const ids = [...new Set(rows.map((r) => r.author_id))]
  const { data } = await supabase.from('forum_profiles').select('user_id, display_name').in('user_id', ids)
  const map = new Map((data ?? []).map((p) => [p.user_id, p.display_name]))
  return rows.map((r) => ({ ...r, authorName: map.get(r.author_id) ?? '老師' }))
}

async function myReactions(targetType: 'thread' | 'post', ids: string[]): Promise<Set<string>> {
  if (!supabase || ids.length === 0) return new Set()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Set()
  const { data } = await supabase.from('forum_reactions').select('target_id')
    .eq('user_id', user.id).eq('target_type', targetType).eq('kind', 'up').in('target_id', ids)
  return new Set((data ?? []).map((r) => r.target_id))
}

export async function listBoards(): Promise<ForumBoard[]> {
  if (!supabase) return []
  const { data, error } = await supabase.from('forum_boards').select('*').eq('archived', false).order('sort')
  if (error) throw new Error(error.message)
  return (data ?? []) as ForumBoard[]
}

export async function listThreads(boardId: string, sort: ThreadSort, page = 0): Promise<{ threads: ForumThread[]; hasMore: boolean }> {
  if (!supabase) return { threads: [], hasMore: false }
  const { column, ascending } = sortColumn(sort)
  const from = page * PAGE
  const { data, error } = await supabase.from('forum_threads').select('*')
    .eq('board_id', boardId).eq('status', 'active')
    .order('pinned', { ascending: false }).order(column, { ascending })
    .range(from, from + PAGE - 1)
  if (error) throw new Error(error.message)
  let threads = (data ?? []) as ForumThread[]
  threads = await attachAuthors(threads)
  const up = await myReactions('thread', threads.map((t) => t.id))
  threads = threads.map((t) => ({ ...t, mineUp: up.has(t.id) }))
  return { threads, hasMore: threads.length === PAGE }
}

export async function searchThreads(boardId: string, q: string): Promise<ForumThread[]> {
  if (!supabase || !q.trim()) return []
  const like = `%${q.trim()}%`
  const { data, error } = await supabase.from('forum_threads').select('*')
    .eq('board_id', boardId).eq('status', 'active')
    .or(`title.ilike.${like},body.ilike.${like}`)
    .order('last_activity_at', { ascending: false }).limit(30)
  if (error) throw new Error(error.message)
  return attachAuthors((data ?? []) as ForumThread[])
}

export async function getThread(id: string): Promise<ForumThread | null> {
  if (!supabase) return null
  const { data, error } = await supabase.from('forum_threads').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  const [t] = await attachAuthors([data as ForumThread])
  const up = await myReactions('thread', [id])
  return { ...t, mineUp: up.has(id) }
}

export async function listPosts(threadId: string, page = 0): Promise<{ posts: ForumPost[]; hasMore: boolean }> {
  if (!supabase) return { posts: [], hasMore: false }
  const from = page * PAGE
  const { data, error } = await supabase.from('forum_posts').select('*')
    .eq('thread_id', threadId).eq('status', 'active')
    .order('created_at', { ascending: true }).range(from, from + PAGE - 1)
  if (error) throw new Error(error.message)
  let posts = (data ?? []) as ForumPost[]
  posts = await attachAuthors(posts)
  const up = await myReactions('post', posts.map((p) => p.id))
  posts = posts.map((p) => ({ ...p, mineUp: up.has(p.id) }))
  return { posts, hasMore: posts.length === PAGE }
}

export async function getMyProfile(): Promise<ForumProfile | null> {
  if (!supabase) return null
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('forum_profiles').select('*').eq('user_id', user.id).maybeSingle()
  return (data as ForumProfile) ?? null
}

// 讚（樂觀，呼叫端自己回滾）：client 直接寫 forum_reactions（RLS write own），trigger 改 score
export async function setUpvote(targetType: 'thread' | 'post', targetId: string, on: boolean): Promise<void> {
  if (!supabase) throw new Error('未接 Supabase。')
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('請先登入。')
  if (on) {
    const { error } = await supabase.from('forum_reactions')
      .upsert({ user_id: user.id, target_type: targetType, target_id: targetId, kind: 'up' },
        { onConflict: 'user_id,target_type,target_id,kind' })
    if (error) throw new Error(error.message)
  } else {
    const { error } = await supabase.from('forum_reactions').delete()
      .eq('user_id', user.id).eq('target_type', targetType).eq('target_id', targetId).eq('kind', 'up')
    if (error) throw new Error(error.message)
  }
}

// 寫入（經 forum Edge Function）
export const createThread = (board_id: string, title: string, body: string, tags: string[]) =>
  callForum<{ id: string }>('create-thread', { board_id, title, body, tags })
export const createPost = (thread_id: string, body: string) =>
  callForum<{ id: string }>('create-post', { thread_id, body })
export const editOwn = (type: 'thread' | 'post', id: string, body: string, title?: string) =>
  callForum<{ ok: true }>('edit-own', { type, id, body, title })
export const deleteOwn = (type: 'thread' | 'post', id: string) =>
  callForum<{ ok: true }>('delete-own', { type, id })
export const reportContent = (target_type: 'thread' | 'post', target_id: string, reason: string) =>
  callForum<{ ok: true }>('report', { target_type, target_id, reason })
export const setProfile = (display_name: string, school: string, subjects: string[]) =>
  callForum<{ ok: true }>('set-profile', { display_name, school, subjects })
```

- [ ] **Step 2: tsc 檢查**

Run: `npx tsc --noEmit`
Expected: PASS（exit 0）

- [ ] **Step 3: 提交**

```bash
git add src/features/forum/api.ts
git commit -m "feat(forum): 資料層 api（讀 RLS / 寫 forum fn / 讚直連）"
```

---

## Phase 3 — UI

> 所有元件用 `src/ui` kit（`Card/Button/Input/Textarea/Field/Badge/EmptyState/Modal/Select/cx`）。
> 共用 async 載入用本地細 hook（仿 `Admin.tsx` 嘅 `useAsync`）。

### Task 6: `ProfileEdit` + `ReportModal`

**Files:**
- Create: `src/features/forum/ProfileEdit.tsx`
- Create: `src/features/forum/ReportModal.tsx`

- [ ] **Step 1: `ProfileEdit.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { Modal, Field, Input, Button } from '../../ui'
import { useToast } from '../../context/ToastContext'
import { getMyProfile, setProfile } from './api'

export default function ProfileEdit({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved?: () => void }) {
  const toast = useToast()
  const [name, setName] = useState('')
  const [school, setSchool] = useState('')
  const [subjects, setSubjects] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (!open) return
    getMyProfile().then((p) => {
      if (!p) return
      setName(p.display_name); setSchool(p.school ?? ''); setSubjects(p.subjects.join('、'))
    })
  }, [open])
  const save = async () => {
    if (!name.trim()) { toast.error('請輸入顯示名'); return }
    try {
      setSaving(true)
      await setProfile(name.trim(), school.trim(), subjects.split(/[、,，\s]+/).map((s) => s.trim()).filter(Boolean))
      toast.success('已儲存個人資料'); onSaved?.(); onClose()
    } catch (e) { toast.error(e instanceof Error ? e.message : '儲存失敗') } finally { setSaving(false) }
  }
  return (
    <Modal open={open} onClose={onClose} title="討論區個人資料">
      <div className="space-y-3">
        <Field label="顯示名"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：陳老師" /></Field>
        <Field label="學校（選填）"><Input value={school} onChange={(e) => setSchool(e.target.value)} /></Field>
        <Field label="任教科（選填，逗號分隔）"><Input value={subjects} onChange={(e) => setSubjects(e.target.value)} placeholder="中文、BAFS" /></Field>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button onClick={save} disabled={saving}>{saving ? '儲存中…' : '儲存'}</Button>
        </div>
      </div>
    </Modal>
  )
}
```

- [ ] **Step 2: `ReportModal.tsx`**

```tsx
import { useState } from 'react'
import { Modal, Textarea, Button } from '../../ui'
import { useToast } from '../../context/ToastContext'
import { reportContent } from './api'

export default function ReportModal({ open, onClose, targetType, targetId }: {
  open: boolean; onClose: () => void; targetType: 'thread' | 'post'; targetId: string | null
}) {
  const toast = useToast()
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    if (!targetId) return
    try {
      setBusy(true)
      await reportContent(targetType, targetId, reason.trim())
      toast.success('已提交檢舉，多謝你'); setReason(''); onClose()
    } catch (e) { toast.error(e instanceof Error ? e.message : '提交失敗') } finally { setBusy(false) }
  }
  return (
    <Modal open={open} onClose={onClose} title="檢舉內容">
      <div className="space-y-3">
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="理由（選填）：違規 / 廣告 / 攻擊性…" />
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>取消</Button><Button variant="danger" onClick={submit} disabled={busy}>提交檢舉</Button></div>
      </div>
    </Modal>
  )
}
```

- [ ] **Step 3: tsc + 提交**

Run: `npx tsc --noEmit` → PASS
```bash
git add src/features/forum/ProfileEdit.tsx src/features/forum/ReportModal.tsx
git commit -m "feat(forum): ProfileEdit + ReportModal"
```

---

### Task 7: `ThreadView`（帖內文 + 回覆 + composer + 讚/檢舉）

**Files:**
- Create: `src/features/forum/ThreadView.tsx`

- [ ] **Step 1: 寫元件**

```tsx
import { useEffect, useState } from 'react'
import { ArrowLeft, ThumbsUp, Flag, Trash2, Send } from 'lucide-react'
import { Card, Button, Textarea, Badge, EmptyState, cx } from '../../ui'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import { getThread, listPosts, createPost, deleteOwn, setUpvote } from './api'
import { validatePost } from './logic'
import ReportModal from './ReportModal'
import type { ForumThread, ForumPost } from './types'
import { supabase } from '../../lib/supabase'

const rel = (s: string) => new Date(s).toLocaleString('zh-HK')

export default function ThreadView({ threadId, onBack }: { threadId: string; onBack: () => void }) {
  const toast = useToast(); const confirm = useConfirm()
  const [thread, setThread] = useState<ForumThread | null>(null)
  const [posts, setPosts] = useState<ForumPost[]>([])
  const [loading, setLoading] = useState(true)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [meId, setMeId] = useState<string | null>(null)
  const [report, setReport] = useState<{ type: 'thread' | 'post'; id: string } | null>(null)

  const load = () => {
    setLoading(true)
    Promise.all([getThread(threadId), listPosts(threadId)])
      .then(([t, p]) => { setThread(t); setPosts(p.posts) })
      .catch((e) => toast.error(e instanceof Error ? e.message : '載入失敗'))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load(); supabase?.auth.getUser().then(({ data }) => setMeId(data.user?.id ?? null)) }, [threadId]) // eslint-disable-line

  const send = async () => {
    const err = validatePost(reply); if (err) { toast.error(err); return }
    try {
      setSending(true)
      await createPost(threadId, reply.trim())
      setReply(''); load()
    } catch (e) { toast.error(e instanceof Error ? e.message : '回覆失敗') } finally { setSending(false) }
  }
  const upThread = async () => {
    if (!thread) return
    const on = !thread.mineUp
    setThread({ ...thread, mineUp: on, score: thread.score + (on ? 1 : -1) })
    try { await setUpvote('thread', thread.id, on) } catch { setThread(thread); toast.error('操作失敗') }
  }
  const upPost = async (p: ForumPost) => {
    const on = !p.mineUp
    setPosts((cur) => cur.map((x) => x.id === p.id ? { ...x, mineUp: on, score: x.score + (on ? 1 : -1) } : x))
    try { await setUpvote('post', p.id, on) } catch { load(); toast.error('操作失敗') }
  }
  const del = async (type: 'thread' | 'post', id: string) => {
    if (!(await confirm({ title: '刪除？', message: '此動作無法復原。', confirmText: '刪除', tone: 'danger' }))) return
    try { await deleteOwn(type, id); if (type === 'thread') onBack(); else load() }
    catch (e) { toast.error(e instanceof Error ? e.message : '刪除失敗') }
  }

  if (loading) return <p className="py-10 text-center text-sm text-slate-400">載入中…</p>
  if (!thread) return <EmptyState icon="🗑️" title="主題唔存在或已刪除。" />

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-accent"><ArrowLeft size={15} /> 返回版面</button>
      <Card className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">{thread.title}</h2>
            <p className="mt-1 text-xs text-slate-400">{thread.authorName} · {rel(thread.created_at)}</p>
          </div>
          <div className="flex shrink-0 gap-1">
            <button onClick={() => setReport({ type: 'thread', id: thread.id })} className="rounded p-1.5 text-slate-400 hover:text-rose-500" title="檢舉"><Flag size={15} /></button>
            {meId === thread.author_id && <button onClick={() => del('thread', thread.id)} className="rounded p-1.5 text-slate-400 hover:text-rose-500" title="刪除"><Trash2 size={15} /></button>}
          </div>
        </div>
        <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700 dark:text-slate-200">{thread.body}</p>
        {thread.tags.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{thread.tags.map((t) => <Badge key={t} tone="slate">#{t}</Badge>)}</div>}
        <div className="mt-4">
          <button onClick={upThread} className={cx('inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition', thread.mineUp ? 'border-accent bg-accent-soft text-accent-strong' : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700')}>
            <ThumbsUp size={14} /> 有用 · {thread.score}
          </button>
        </div>
      </Card>

      <p className="px-1 text-sm font-medium text-slate-500">{thread.reply_count} 則回覆</p>
      {posts.map((p) => (
        <Card key={p.id} className="p-4">
          <div className="flex items-start justify-between gap-3">
            <p className="text-xs text-slate-400">{p.authorName} · {rel(p.created_at)}</p>
            <div className="flex shrink-0 gap-1">
              <button onClick={() => setReport({ type: 'post', id: p.id })} className="rounded p-1 text-slate-400 hover:text-rose-500" title="檢舉"><Flag size={14} /></button>
              {meId === p.author_id && <button onClick={() => del('post', p.id)} className="rounded p-1 text-slate-400 hover:text-rose-500" title="刪除"><Trash2 size={14} /></button>}
            </div>
          </div>
          <p className="mt-1.5 whitespace-pre-wrap break-words text-sm text-slate-700 dark:text-slate-200">{p.body}</p>
          <button onClick={() => upPost(p)} className={cx('mt-2 inline-flex items-center gap-1 text-xs font-medium', p.mineUp ? 'text-accent-strong' : 'text-slate-400 hover:text-accent')}><ThumbsUp size={12} /> {p.score}</button>
        </Card>
      ))}

      {thread.status === 'locked' ? (
        <p className="rounded-xl bg-slate-50 py-3 text-center text-sm text-slate-400 dark:bg-slate-800/50">🔒 此主題已鎖,唔接受回覆。</p>
      ) : (
        <Card className="p-4">
          <Textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={3} placeholder="寫低你嘅回覆…" />
          <div className="mt-2 flex justify-end"><Button icon={Send} onClick={send} disabled={sending}>{sending ? '發送中…' : '回覆'}</Button></div>
        </Card>
      )}
      <ReportModal open={!!report} onClose={() => setReport(null)} targetType={report?.type ?? 'thread'} targetId={report?.id ?? null} />
    </div>
  )
}
```

- [ ] **Step 2: tsc + 提交**

Run: `npx tsc --noEmit` → PASS
```bash
git add src/features/forum/ThreadView.tsx
git commit -m "feat(forum): ThreadView（帖+回覆+讚+檢舉+刪）"
```

---

### Task 8: `ThreadList`（版內帖列表 + 排序 + 搜尋 + 發帖）

**Files:**
- Create: `src/features/forum/ThreadList.tsx`

- [ ] **Step 1: 寫元件**

```tsx
import { useEffect, useState } from 'react'
import { ArrowLeft, Plus, MessageSquare, ThumbsUp, Pin, Search } from 'lucide-react'
import { Card, Button, Input, Textarea, Field, Tabs, EmptyState, Badge, Modal, cx } from '../../ui'
import { useToast } from '../../context/ToastContext'
import { listThreads, searchThreads, createThread, getMyProfile } from './api'
import { validateThread } from './logic'
import ProfileEdit from './ProfileEdit'
import type { ForumBoard, ForumThread, ThreadSort } from './types'

export default function ThreadList({ board, onBack, onOpenThread }: {
  board: ForumBoard; onBack: () => void; onOpenThread: (id: string) => void
}) {
  const toast = useToast()
  const [sort, setSort] = useState<ThreadSort>('new')
  const [threads, setThreads] = useState<ForumThread[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [composing, setComposing] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [title, setTitle] = useState(''); const [body, setBody] = useState(''); const [tags, setTags] = useState('')
  const [posting, setPosting] = useState(false)

  const load = () => {
    setLoading(true)
    listThreads(board.id, sort).then((r) => setThreads(r.threads))
      .catch((e) => toast.error(e instanceof Error ? e.message : '載入失敗')).finally(() => setLoading(false))
  }
  useEffect(load, [board.id, sort]) // eslint-disable-line

  const doSearch = async () => {
    if (!q.trim()) { load(); return }
    setLoading(true)
    try { setThreads(await searchThreads(board.id, q)) } catch (e) { toast.error(e instanceof Error ? e.message : '搜尋失敗') } finally { setLoading(false) }
  }

  const openCompose = async () => {
    const p = await getMyProfile()
    if (!p) { toast.info('請先填寫討論區顯示名'); setProfileOpen(true); return }
    setComposing(true)
  }
  const submit = async () => {
    const err = validateThread(title, body); if (err) { toast.error(err); return }
    try {
      setPosting(true)
      const { id } = await createThread(board.id, title.trim(), body.trim(), tags.split(/[、,，\s]+/).map((s) => s.trim()).filter(Boolean))
      setComposing(false); setTitle(''); setBody(''); setTags('')
      onOpenThread(id)
    } catch (e) { toast.error(e instanceof Error ? e.message : '發帖失敗') } finally { setPosting(false) }
  }

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-accent"><ArrowLeft size={15} /> 所有版面</button>
      <div className="flex items-center justify-between gap-3">
        <div><h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">{board.name}</h2><p className="text-xs text-slate-400">{board.description}</p></div>
        <Button icon={Plus} onClick={openCompose}>發帖</Button>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-56"><Tabs<ThreadSort> active={sort} onChange={setSort} tabs={[{ id: 'new', label: '最新' }, { id: 'replies', label: '最多回覆' }, { id: 'top', label: '最熱' }]} size="sm" /></div>
        <form onSubmit={(e) => { e.preventDefault(); doSearch() }} className="flex flex-1 gap-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜尋本版…" />
          <Button type="submit" variant="secondary" icon={Search}>搜尋</Button>
        </form>
      </div>

      {loading ? <p className="py-10 text-center text-sm text-slate-400">載入中…</p>
        : threads.length === 0 ? <EmptyState icon="💬" title="呢個版仲未有帖。" hint="做第一個開話題嘅老師啦！" />
        : (
          <ul className="space-y-2">
            {threads.map((t) => (
              <li key={t.id}>
                <Card className="cursor-pointer p-4 transition hover:-translate-y-0.5 hover:shadow-md" onClick={() => onOpenThread(t.id)}>
                  <div className="flex items-start gap-2">
                    {t.pinned && <Pin size={14} className="mt-1 shrink-0 text-amber-500" />}
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-semibold text-slate-800 dark:text-slate-100">{t.title}</h3>
                      <p className="mt-0.5 truncate text-xs text-slate-400">{t.authorName} · {new Date(t.last_activity_at).toLocaleDateString('zh-HK')}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3 text-xs text-slate-400">
                      <span className="inline-flex items-center gap-1"><ThumbsUp size={12} /> {t.score}</span>
                      <span className="inline-flex items-center gap-1"><MessageSquare size={12} /> {t.reply_count}</span>
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}

      <Modal open={composing} onClose={() => setComposing(false)} title={`喺「${board.name}」發帖`} size="lg">
        <div className="space-y-3">
          <Field label="標題"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="一句講清你想討論咩" /></Field>
          <Field label="內文"><Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} /></Field>
          <Field label="標籤（選填，逗號分隔，最多 5）"><Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="中六、應試技巧" /></Field>
          <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setComposing(false)}>取消</Button><Button onClick={submit} disabled={posting}>{posting ? '發布中…' : '發布'}</Button></div>
        </div>
      </Modal>
      <ProfileEdit open={profileOpen} onClose={() => setProfileOpen(false)} onSaved={() => setComposing(true)} />
    </div>
  )
}
```

- [ ] **Step 2: tsc + 提交**

Run: `npx tsc --noEmit` → PASS
```bash
git add src/features/forum/ThreadList.tsx
git commit -m "feat(forum): ThreadList（排序/搜尋/發帖）"
```

---

### Task 9: `BoardList` + `Forum`（殼 + 內部路由）

**Files:**
- Create: `src/features/forum/BoardList.tsx`
- Create: `src/features/forum/Forum.tsx`

- [ ] **Step 1: `BoardList.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { MessagesSquare, UserCog } from 'lucide-react'
import { Card, EmptyState, Button } from '../../ui'
import { useToast } from '../../context/ToastContext'
import { listBoards } from './api'
import ProfileEdit from './ProfileEdit'
import type { ForumBoard } from './types'

export default function BoardList({ onOpenBoard }: { onOpenBoard: (b: ForumBoard) => void }) {
  const toast = useToast()
  const [boards, setBoards] = useState<ForumBoard[]>([])
  const [loading, setLoading] = useState(true)
  const [profileOpen, setProfileOpen] = useState(false)
  useEffect(() => {
    listBoards().then(setBoards).catch((e) => toast.error(e instanceof Error ? e.message : '載入失敗')).finally(() => setLoading(false))
  }, []) // eslint-disable-line
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500 dark:text-slate-400">揀一個版面，同全港老師交流。</p>
        <Button variant="ghost" icon={UserCog} onClick={() => setProfileOpen(true)}>個人資料</Button>
      </div>
      {loading ? <p className="py-10 text-center text-sm text-slate-400">載入中…</p>
        : boards.length === 0 ? <EmptyState icon="💬" title="未有版面。" />
        : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {boards.map((b) => (
              <li key={b.id}>
                <Card className="flex cursor-pointer items-center gap-3 p-4 transition hover:-translate-y-0.5 hover:shadow-md" onClick={() => onOpenBoard(b)}>
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent"><MessagesSquare size={20} /></span>
                  <div className="min-w-0"><h3 className="font-semibold text-slate-800 dark:text-slate-100">{b.name}</h3><p className="truncate text-xs text-slate-400">{b.description}</p></div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      <ProfileEdit open={profileOpen} onClose={() => setProfileOpen(false)} />
    </div>
  )
}
```

- [ ] **Step 2: `Forum.tsx`（內部 3 態路由：board list / thread list / thread view）**

```tsx
import { useState } from 'react'
import { isSupabaseConfigured } from '../../lib/supabase'
import { EmptyState, Card } from '../../ui'
import BoardList from './BoardList'
import ThreadList from './ThreadList'
import ThreadView from './ThreadView'
import type { ForumBoard } from './types'

export default function Forum() {
  const [board, setBoard] = useState<ForumBoard | null>(null)
  const [threadId, setThreadId] = useState<string | null>(null)

  if (!isSupabaseConfigured) {
    return <Card className="p-8"><EmptyState icon="🔌" title="討論區需要連接雲端" hint="未接 Supabase；登入後先用到社群論壇。" /></Card>
  }
  if (threadId) return <ThreadView threadId={threadId} onBack={() => setThreadId(null)} />
  if (board) return <ThreadList board={board} onBack={() => setBoard(null)} onOpenThread={setThreadId} />
  return <BoardList onOpenBoard={setBoard} />
}
```

- [ ] **Step 3: tsc + 提交**

Run: `npx tsc --noEmit` → PASS
```bash
git add src/features/forum/BoardList.tsx src/features/forum/Forum.tsx
git commit -m "feat(forum): BoardList + Forum 殼"
```

---

### Task 10: 登記功能 + i18n

**Files:**
- Modify: `src/features/registry.ts`
- Modify: `src/i18n/appEn.ts`

- [ ] **Step 1: registry —— 加 lazy import（同其他 `const X = lazyFeature(...)` 一組）**

```ts
const Forum = lazyFeature(() => import('./forum/Forum'))
```

- [ ] **Step 2: registry —— 加 feature 條目（two modes 都見到，放喺一個合適 group，例如工作模式「社群」）**

喺 features 陣列加（參考 task 開始時睇到嘅條目格式；`group` 用現有或新增 '社群'）：

```ts
  {
    id: 'community-forum',
    modes: ['work', 'learning'],
    name: '老師社群',
    description: '同全港老師分版討論：教學、班務、考評、見工求職。',
    icon: '💬',
    group: '社群',
    component: Forum,
    status: 'ready',
  },
```

- [ ] **Step 3: appEn.ts —— 加功能名（`feat` map 內）+ 任何新 t() 字串**

喺 `feat:` map 加：

```ts
    'community-forum': { name: 'Teacher community', desc: 'Discuss teaching, class, assessment and jobs with teachers across HK.' },
```

> 註：本功能 UI 字串目前用硬編繁中（同 Countdown 等一致）。若要英文化卡內文字，照 spec 後續再做；MVP 範圍只譯功能名。

- [ ] **Step 4: build + 提交**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS
```bash
git add src/features/registry.ts src/i18n/appEn.ts
git commit -m "feat(forum): 登記功能 + 功能名 i18n"
```

---

## Phase 4 — 後台審核

### Task 11: `admin` Edge Function 加論壇 actions

**Files:**
- Modify: `supabase/functions/admin/index.ts`

- [ ] **Step 1: 喺 `switch (action)` 加 cases（用現有 `admin` service_role client + `audit()`）**

```ts
      // ════════════ 論壇審核 ════════════
      case 'forum:reports': {
        const { data: reports } = await admin.from('forum_reports')
          .select('id, target_type, target_id, reason, status, created_at')
          .eq('status', 'open').order('created_at', { ascending: false }).limit(200)
        // 併入被檢舉內容預覽
        const threadIds = (reports ?? []).filter((r) => r.target_type === 'thread').map((r) => r.target_id)
        const postIds = (reports ?? []).filter((r) => r.target_type === 'post').map((r) => r.target_id)
        const [{ data: ths }, { data: pos }] = await Promise.all([
          threadIds.length ? admin.from('forum_threads').select('id, title, body, status, author_id').in('id', threadIds) : Promise.resolve({ data: [] }),
          postIds.length ? admin.from('forum_posts').select('id, body, status, author_id, thread_id').in('id', postIds) : Promise.resolve({ data: [] }),
        ])
        const tm = new Map((ths ?? []).map((t) => [t.id, t]))
        const pm = new Map((pos ?? []).map((p) => [p.id, p]))
        return json({ data: (reports ?? []).map((r) => ({
          ...r,
          content: r.target_type === 'thread' ? tm.get(r.target_id) ?? null : pm.get(r.target_id) ?? null,
        })) })
      }
      case 'forum:remove': {
        const type = String(body.type), id = String(body.id ?? '')
        const table = type === 'thread' ? 'forum_threads' : 'forum_posts'
        const { error } = await admin.from(table).update({ status: 'removed' }).eq('id', id)
        if (error) return json({ error: error.message }, 500)
        await admin.from('forum_reports').update({ status: 'resolved' }).eq('target_id', id)
        await audit('forum-remove', id, { type })
        return json({ data: { ok: true } })
      }
      case 'forum:thread-flag': {
        const id = String(body.id ?? ''); const patch: Record<string, unknown> = {}
        if (typeof body.pinned === 'boolean') patch.pinned = body.pinned
        if (typeof body.featured === 'boolean') patch.featured = body.featured
        if (body.status === 'active' || body.status === 'locked') patch.status = body.status
        if (Object.keys(patch).length === 0) return json({ error: '冇嘢要改。' }, 400)
        const { error } = await admin.from('forum_threads').update(patch).eq('id', id)
        if (error) return json({ error: error.message }, 500)
        await audit('forum-flag', id, patch)
        return json({ data: { ok: true } })
      }
      case 'forum:resolve-report': {
        const id = String(body.id ?? '')
        const { error } = await admin.from('forum_reports').update({ status: 'resolved' }).eq('id', id)
        if (error) return json({ error: error.message }, 500)
        return json({ data: { ok: true } })
      }
      case 'forum:ban': {
        const userId = String(body.userId ?? ''), reason = String(body.reason ?? '')
        const { error } = await admin.from('forum_bans').upsert({ user_id: userId, reason, banned_by: actorEmail }, { onConflict: 'user_id' })
        if (error) return json({ error: error.message }, 500)
        await audit('forum-ban', userId, { reason })
        return json({ data: { ok: true } })
      }
      case 'forum:unban': {
        const userId = String(body.userId ?? '')
        const { error } = await admin.from('forum_bans').delete().eq('user_id', userId)
        if (error) return json({ error: error.message }, 500)
        await audit('forum-unban', userId)
        return json({ data: { ok: true } })
      }
```

- [ ] **Step 2: 提交**

```bash
git add supabase/functions/admin/index.ts
git commit -m "feat(forum): admin Edge Function 論壇審核 actions"
```

---

### Task 12: 後台「論壇檢舉」卡

**Files:**
- Modify: `src/lib/admin.ts`
- Modify: `src/pages/Admin.tsx`

- [ ] **Step 1: `src/lib/admin.ts` 加型別 + 函數**

```ts
export interface ForumReport {
  id: string; target_type: 'thread' | 'post'; target_id: string
  reason: string; status: string; created_at: string
  content: { title?: string; body?: string; status?: string; author_id?: string } | null
}
export const adminForumReports = () => callAdmin<ForumReport[]>('forum:reports')
export const adminForumRemove = (type: 'thread' | 'post', id: string) => callAdmin<{ ok: true }>('forum:remove', { type, id })
export const adminForumResolve = (id: string) => callAdmin<{ ok: true }>('forum:resolve-report', { id })
export const adminForumBan = (userId: string, reason = '') => callAdmin<{ ok: true }>('forum:ban', { userId, reason })
```

- [ ] **Step 2: `Admin.tsx` —— 喺 `ContentTab` 加 `<ForumReportsCard />`（放 `AnnouncementsCard` / `TicketsCard` 之間或之後）**

```tsx
function ForumReportsCard() {
  const { data, loading, err, reload } = useAsync<import('../lib/admin').ForumReport[]>(adminForumReports)
  const toast = useToast()
  const [rows, setRows] = useState<import('../lib/admin').ForumReport[]>([])
  useEffect(() => { if (data) setRows(data) }, [data])
  const remove = async (r: import('../lib/admin').ForumReport) => {
    try { await adminForumRemove(r.target_type, r.target_id); setRows((c) => c.filter((x) => x.id !== r.id)); toast.success('已移除內容') }
    catch (e) { toast.error(e instanceof Error ? e.message : '失敗') }
  }
  const ignore = async (r: import('../lib/admin').ForumReport) => {
    try { await adminForumResolve(r.id); setRows((c) => c.filter((x) => x.id !== r.id)) }
    catch (e) { toast.error(e instanceof Error ? e.message : '失敗') }
  }
  const ban = async (r: import('../lib/admin').ForumReport) => {
    if (!r.content?.author_id) return
    try { await adminForumBan(r.content.author_id); toast.success('已封禁該用戶') }
    catch (e) { toast.error(e instanceof Error ? e.message : '失敗') }
  }
  return (
    <Card className="p-5">
      <SectionTitle right={<RefreshBtn loading={loading} onClick={reload} />}>
        <span className="inline-flex items-center gap-1.5">論壇檢舉 {rows.length > 0 && <Badge tone="amber">{rows.length}</Badge>}</span>
      </SectionTitle>
      {!data ? <LoadErr loading={loading} err={err} empty={rows.length === 0} />
        : rows.length === 0 ? <EmptyState icon="✅" title="冇待處理檢舉。" />
        : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={r.id} className="rounded-xl border border-[color:var(--border)] p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Badge tone="slate">{r.target_type === 'thread' ? '主題' : '回覆'}</Badge>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-600 dark:text-slate-300">{r.content?.title ?? ''} {r.content?.body ?? '（內容已不存在）'}</p>
                    <p className="mt-1 text-[10px] text-slate-400">理由：{r.reason || '（無）'} · {new Date(r.created_at).toLocaleString('zh-HK')}</p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    <Button size="sm" variant="danger" onClick={() => remove(r)}>移除</Button>
                    <Button size="sm" variant="ghost" onClick={() => ban(r)}>封禁作者</Button>
                    <Button size="sm" variant="ghost" onClick={() => ignore(r)}>忽略</Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
    </Card>
  )
}
```

加 import：`import { adminForumReports, adminForumRemove, adminForumResolve, adminForumBan } from '../lib/admin'`，
並喺 `ContentTab` 的 return 加 `<ForumReportsCard />`。

- [ ] **Step 3: build + 提交**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS
```bash
git add src/lib/admin.ts src/pages/Admin.tsx
git commit -m "feat(forum): 後台論壇檢舉卡（移除/封禁/忽略）"
```

---

## 完成標準 / 部署

- [ ] `npx tsc --noEmit` PASS、`npm run build` PASS、`npx vitest run src/features/forum` PASS
- [ ] 用戶部署：`supabase db push`（0011）+ `supabase functions deploy forum` + `supabase functions deploy admin`
- [ ] 用戶實測（sandbox 核實唔到）：發帖 / 回覆 / 讚 / 檢舉 / 後台移除 / 封禁；RLS（登出睇唔到、改唔到他人內容）

## MVP 範圍微調（後端已備、UI 留 fast-follow）

為咗令 MVP **核心穩陣**（版 / 帖 / 回覆 / 讚 / 檢舉 / 後台審核），以下三樣**後端 / schema 已做好**，但**第一版唔出 UI**，下一個 iteration 先加（唔影響核心可用性）：

1. **🔖 收藏**：`forum_reactions` 已支援 `kind='save'`、trigger 唔受影響；缺「收藏掣 + 我的收藏」頁。
2. **編輯自己帖**：`forum` fn `edit-own`（30 分鐘窗）已做；缺前端編輯 modal。
3. **載入更多分頁**：`api.listThreads/listPosts` 已回 `hasMore`；UI 先載第一頁（20 條，最新優先），缺「載入更多」掣。

> 即係 schema / Edge Function 一次過鋪好，唔使第二次改 migration；fast-follow 只係加前端。

## 風險 / 備註

- **RLS / trigger 正確性** sandbox 跑唔到，需用戶實測 —— 標明未核實。
- 讚走 client 直連（RLS write own）；其餘寫入全經 `forum` fn（rate-limit + 封禁）。
- 軟刪除（status=removed）令刪帖唔整爛回覆。
- i18n MVP 只譯功能名；卡內文字硬編繁中（同現有功能一致），全面英文化屬後續。
