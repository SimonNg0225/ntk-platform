-- ============================================================
--  0008_scans_storage
--  掃描 PDF 雲端存檔：private bucket「scans」+ RLS。
--    · 每個用戶只可存 / 睇 / 刪自己 uid 資料夾下嘅檔
--      （路徑慣例：`<uid>/<timestamp>-<name>.pdf`）。
--    · bucket 不公開；前端用 createSignedUrl 攞長效簽名連結畀資源庫開。
--  喺 Supabase SQL Editor 跑一次即可。
-- ============================================================

-- 1) 建立 private bucket（已存在就略過）。
insert into storage.buckets (id, name, public)
values ('scans', 'scans', false)
on conflict (id) do nothing;

-- 2) RLS：authenticated 只可操作自己 uid 資料夾下嘅物件。
--    storage.objects 預設已 enable RLS。storage.foldername(name)[1] = 首層資料夾。

drop policy if exists "scans insert own" on storage.objects;
create policy "scans insert own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'scans'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "scans read own" on storage.objects;
create policy "scans read own"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'scans'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "scans delete own" on storage.objects;
create policy "scans delete own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'scans'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
