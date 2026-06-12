-- ============================================================
--  EziTeach 教學易 · 0009_admin（後台管理系統）
-- ------------------------------------------------------------
--  後台用兩張新表：
--    · announcements：全站公告 / 橫額（admin 出，所有登入用戶睇到生效嗰啲）。
--    · admin_audit  ：admin 操作日誌（改方案 / 出公告 / 處理 ticket…）。
--
--  安全原則（同 0002–0007 一致）：
--    - 真正後台權限由 `admin` Edge Function 用 ADMIN_EMAILS 白名單 + service_role 驗。
--    - 用戶端對 announcements 只開「讀生效中嘅公告」；寫入零 policy（只 service_role）。
--    - admin_audit 完全唔開 client policy（只 service_role 寫 / 讀）。
-- ============================================================

-- ── 全站公告 / 橫額 ─────────────────────────────────────────
create table if not exists public.announcements (
  id         uuid        primary key default gen_random_uuid(),
  title      text        not null,
  body       text        not null default '',
  level      text        not null default 'info',   -- info | warning | success
  active     boolean     not null default true,
  starts_at  timestamptz,
  ends_at    timestamptz,
  created_by text,                                   -- admin email（出公告嗰個）
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists announcements_active_idx
  on public.announcements (active, starts_at, ends_at);

alter table public.announcements enable row level security;

-- 登入用戶只讀「生效中」嘅公告（active + 喺時間窗內）。冇寫入 policy → 只 service_role 寫。
drop policy if exists "announcements read active" on public.announcements;
create policy "announcements read active"
  on public.announcements
  for select
  to authenticated
  using (
    active = true
    and (starts_at is null or starts_at <= now())
    and (ends_at   is null or ends_at   >= now())
  );

-- 沿用 0001 touch_updated_at()
drop trigger if exists announcements_touch_updated_at on public.announcements;
create trigger announcements_touch_updated_at
  before update on public.announcements
  for each row
  execute function public.touch_updated_at();

-- ── Admin 操作日誌 ─────────────────────────────────────────
create table if not exists public.admin_audit (
  id          bigserial   primary key,
  actor_email text        not null,
  action      text        not null,   -- e.g. set-plan / announce / ticket-status
  target      text,                    -- 受影響對象（user_id / announcement id…）
  meta        jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists admin_audit_created_idx
  on public.admin_audit (created_at desc);

alter table public.admin_audit enable row level security;
-- 完全唔開 policy → client 零存取；只有 service_role（admin Edge Function）掂到。
