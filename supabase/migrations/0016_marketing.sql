-- ============================================================
--  EziTeach 教學易 · 0016_marketing（後台行銷內容管理）
-- ------------------------------------------------------------
--  新表 marketing_content：集中管理推廣 campaign 嘅內容草稿
--  （Landing 文案 / 示範腳本 / SEO 文 / 社交帖 / Email…）,
--  全部管理員共用（雲端同步）。
--
--  安全（同 0009 announcements / admin_audit 一致）：
--    - 真正權限由 `admin` Edge Function 用 ADMIN_EMAILS / app_admins
--      + service_role 驗。
--    - 呢張表完全唔開 client policy → 一般用戶零存取,只 service_role
--      （admin Edge Function）讀寫。
--
--  部署：
--    supabase db push           （或 apply 呢個 migration）
--    supabase functions deploy admin
-- ============================================================

create table if not exists public.marketing_content (
  id         uuid        primary key default gen_random_uuid(),
  type       text        not null default 'other',   -- landing | demo-script | seo-article | social | email | other
  title      text        not null,
  channel    text        not null default '',
  status     text        not null default 'draft',   -- idea | draft | review | published
  body       text        not null default '',
  notes      text        not null default '',
  created_by text,                                    -- admin email
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketing_content_updated_idx
  on public.marketing_content (updated_at desc);

alter table public.marketing_content enable row level security;
-- 完全唔開 policy → client 零存取;只 service_role（admin Edge Function）掂到。

-- 沿用 0001 touch_updated_at()
drop trigger if exists marketing_content_touch_updated_at on public.marketing_content;
create trigger marketing_content_touch_updated_at
  before update on public.marketing_content
  for each row
  execute function public.touch_updated_at();

-- ── 種子：開學備課 campaign 頭三件資產（固定 id；重跑唔會重複）──
insert into public.marketing_content (id, type, title, channel, status, body, notes) values
(
  'a0000000-0000-0000-0000-000000000001', 'landing', 'Landing page 文案 v1', 'Landing page', 'draft',
  $body$H1：香港老師嘅一站式工作台
副標：備課、改卷、行政,一個地方搞掂——慳返嘅時間,留畀真正嘅教學。

Hero：
EziTeach 教學易 為香港前線老師而整。由出堂課簡報、AI 輔助批改,到教學資源共享同行政文件,全部喺同一個地方完成。廣東話介面,識香港校曆(循環日)。

價值點：
1. 一鍵出堂課簡報 —— 輸入課題,即出可下載 .pptx,34 套專業版式任揀。
2. AI 輔助批改 —— 多科覆蓋,減重複、快回饋,評語你話事。
3. 教學資源一區共享 —— 原創／衍生教材互通,搵得返、用得着。
4. 識循環日 + 廣東話介面 —— 本地老師為本地老師而設。

社會證據(placeholder)：
「已有 ▢▢▢ 位香港老師用緊」
引言：「以前做一份簡報要成個鐘,而家幾分鐘。」——▢▢ 老師

CTA：主「免費開始」／ 副「睇 30 秒示範」

FAQ：
- 使唔使收費? 有免費版,夠日常用;進階功能有 Pro。
- 我嘅教材安全? 你嘅內容私密儲存,公唔公開你話事。
- 支援邊啲科? 多科覆蓋,中英數人文商科都得。
- 使唔使裝嘢? 唔使,開瀏覽器就用得。
- 有冇學校團隊版? 有,科組／全校可開團隊。

SEO meta：
Title：EziTeach 教學易 — 香港老師一站式備課・批改・資源工作台
Description：為香港前線老師而設:一鍵出堂課簡報、AI 輔助批改、教學資源共享,廣東話介面、識循環日。免費開始,慳時間留畀教學。$body$,
  $notes$主 CTA「免費開始」;社會證據同 testimonial 待補真實數字。$notes$
),
(
  'a0000000-0000-0000-0000-000000000002', 'demo-script', '示範片 #1：30 秒出一份簡報', 'Threads / IG Reels', 'draft',
  $body$片名：30 秒出一份堂課簡報
平台：Threads / IG Reels　長度：約 35 秒
格式：時間 → 畫面 → 字幕／旁白

0–3s（Hook）：老師深夜對住空白 PowerPoint。字幕「夜晚 11 點,仲做緊聽日嘅簡報?」
3–8s：打開 EziTeach,輸入課題「光合作用」。旁白「打個課題……」
8–18s：㩒生成,一版版有圖有重點跳出。字幕「一鍵,成份簡報出晒。」
18–26s：揀版式(showcase 幾套) + 下載 .pptx。字幕「34 套版式,下載即用真檔。」
26–32s：老師熄機走人。旁白「慳返嘅時間,留畀教學。」
32–35s（CTA）：收尾卡。字幕「EziTeach 教學易・免費試 → 連結喺 bio」

備註：
- 全程真實 screen recording,唔好用 mockup。
- 首 3 秒一定要有 hook 留住人。
- 配輕快 BGM;字幕大、夠對比。$body$,
  $notes$真實 screen recording;首 3 秒 hook 最關鍵。$notes$
),
(
  'a0000000-0000-0000-0000-000000000003', 'seo-article', 'SEO 文 #1：香港教師備課工具點揀', 'Blog / SEO', 'draft',
  $body$主關鍵詞：香港教師備課工具
標題：香港教師備課工具點揀?2026 年慳時間實戰指南

引言(hook)：
香港老師平均每星期花幾多個鐘喺備課同改卷?問十個老師,十個都話「多到唔敢計」。呢篇講下點用對工具,將重複嘅備課、批改、行政工序壓縮,騰返時間做真正影響學生嘅事。

H2 1. 備課最食時間嘅三件事
- 做簡報／工作紙
- 搵同整教材
- 行政文件(通告、表格)

H2 2. 揀備課工具睇咩?
- 本地化:識香港校曆(循環日)、廣東話介面
- 一站式:唔使開十個 app
- 輸出可用:出到真 .pptx、PDF
- 資料私隱清晰

H2 3. 一鍵出簡報點運作
輸入課題 → 自動排版 → 揀版式 → 下載即用。

H2 4. AI 輔助批改:快但你話事
AI 出初稿、老師定稿;覆蓋多科,減重複工序。

H2 5. 由今個暑假開始
暑假備課季試一個工具,9 月開學就順。

結論 + CTA：
與其逐個 app 拼,不如試吓一站式工作台。EziTeach 教學易免費開始。

Meta description：
香港教師備課工具邊個好?由出簡報、批改到資源管理,本指南教你揀啱工具、慳返備課改卷時間,暑假開始 9 月開學就順。

內部連結：Landing、Pricing
圖 alt 機會：簡報生成截圖、批改流程截圖$body$,
  $notes$主關鍵詞「香港教師備課工具」;結尾 CTA 連 Landing。$notes$
)
on conflict (id) do nothing;
