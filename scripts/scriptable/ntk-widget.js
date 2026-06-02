// ============================================================
//  NTK Platform — iOS 主畫面小組件（Scriptable）
//  ------------------------------------------------------------
//  個人用：喺 iPhone「Scriptable」app 入面跑，由 Supabase 直接攞數據，
//  喺主畫面顯示：🔥 連續寫日誌天數 · ✅ 未完成待辦 · ⏳ 下個重要日子倒數。
//
//  點解要 Supabase？widget 係原生環境，讀唔到網頁 app 嘅 localStorage，
//  所以一定要由雲端（你嘅 Supabase）攞。全部集合都存喺 app_rows 表
//  （user_id / collection / data jsonb）。
//
//  ── 安裝步驟 ──────────────────────────────────────────────
//  1. App Store 下載「Scriptable」（免費）。
//  2. Scriptable → ＋ 新增 script → 改名 NTK → 將呢個檔全文貼入去。
//  3. 填好下面 CONFIG 三項：
//       • SUPABASE_URL：同 .env.local 嘅 VITE_SUPABASE_URL 一樣
//       • SUPABASE_KEY：建議用 service_role key（Supabase Dashboard →
//         Project Settings → API → service_role）。因為你個 app 用 Google
//         OAuth 登入，widget 冇得行登入流程，所以用 service_role 直接讀。
//         ⚠️ service_role 可繞過 RLS、權限好大 —— 只可放喺你自己部機，
//         切勿外洩 / commit。淨係用 anon key 嘅話 RLS 會擋住，攞唔到資料。
//       • USER_ID：你嘅 Supabase 用戶 UID（Dashboard → Authentication →
//         Users → 撳你個帳戶 → 複製 User UID）。
//  4. 主畫面長按 → ＋ → Scriptable → 揀中型 widget → 編輯 → Script 揀 NTK。
//  ============================================================

const CONFIG = {
  SUPABASE_URL: 'https://YOUR-PROJECT.supabase.co', // ← 填你嘅
  SUPABASE_KEY: 'YOUR_SERVICE_ROLE_KEY', // ← 填你嘅（service_role）
  USER_ID: 'YOUR_USER_UID', // ← 填你嘅 Supabase 用戶 UID
}

// 主題色（同 app 一致：海軍藍 accent）
const ACCENT = new Color('#2f6cb3')
const BG_TOP = new Color('#0f172a')
const BG_BOT = new Color('#1e293b')
const FG = new Color('#e2e8f0')
const MUTED = new Color('#94a3b8')

// ───────── 日期工具（本地時區，對齊 app 嘅 YYYY-MM-DD 語意）─────────
function dayKey(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// 由今日起連續有日誌嘅日數（今日未寫就由琴日計起，唔斷 streak）
function journalStreak(journalDocs) {
  const set = new Set((journalDocs || []).map((e) => e && e.date).filter(Boolean))
  let streak = 0
  const cur = new Date()
  if (!set.has(dayKey(cur))) cur.setDate(cur.getDate() - 1)
  while (set.has(dayKey(cur))) {
    streak += 1
    cur.setDate(cur.getDate() - 1)
  }
  return streak
}

// 下一個未過嘅重要日子（date >= 今日，最近嗰個）
function nextCountdown(countdowns) {
  const today = dayKey(new Date())
  const upcoming = (countdowns || [])
    .filter((c) => c && typeof c.date === 'string' && c.date >= today)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  if (!upcoming.length) return null
  const c = upcoming[0]
  const days = Math.round(
    (Date.parse(c.date + 'T00:00:00') - Date.parse(today + 'T00:00:00')) / 86_400_000,
  )
  return { title: c.title || '重要日子', days }
}

// ───────── 由 Supabase 攞 app_rows ─────────
async function fetchCollections() {
  const url =
    `${CONFIG.SUPABASE_URL.replace(/\/$/, '')}` +
    `/rest/v1/app_rows?select=collection,data&user_id=eq.${encodeURIComponent(CONFIG.USER_ID)}`
  const req = new Request(url)
  req.headers = {
    apikey: CONFIG.SUPABASE_KEY,
    Authorization: `Bearer ${CONFIG.SUPABASE_KEY}`,
  }
  const rows = await req.loadJSON()
  if (!Array.isArray(rows)) throw new Error('Supabase 回應格式唔啱')
  const map = {}
  for (const row of rows) map[row.collection] = row.data || []
  return map
}

// ───────── 砌 widget ─────────
function statRow(widget, emoji, value, label) {
  const row = widget.addStack()
  row.centerAlignContent()
  const e = row.addText(emoji)
  e.font = Font.systemFont(18)
  row.addSpacer(8)
  const col = row.addStack()
  col.layoutVertically()
  const v = col.addText(String(value))
  v.font = Font.boldSystemFont(20)
  v.textColor = FG
  const l = col.addText(label)
  l.font = Font.systemFont(11)
  l.textColor = MUTED
}

function buildWidget(data) {
  const w = new ListWidget()
  const g = new LinearGradient()
  g.colors = [BG_TOP, BG_BOT]
  g.locations = [0, 1]
  w.backgroundGradient = g
  w.setPadding(14, 16, 14, 16)

  // 標題
  const head = w.addStack()
  head.centerAlignContent()
  const dot = head.addText('●')
  dot.font = Font.boldSystemFont(10)
  dot.textColor = ACCENT
  head.addSpacer(6)
  const title = head.addText('NTK 個人平台')
  title.font = Font.semiboldSystemFont(13)
  title.textColor = FG
  head.addSpacer()
  const time = head.addText(dayKey(new Date()).slice(5).replace('-', '/'))
  time.font = Font.systemFont(11)
  time.textColor = MUTED

  w.addSpacer(10)

  const streak = journalStreak(data['journal_v2'])
  const tasks = (data['work_tasks'] || []).filter((t) => t && !t.done).length
  const nc = nextCountdown(data['countdowns'])

  statRow(w, '🔥', `${streak} 日`, '連續寫日誌')
  w.addSpacer(7)
  statRow(w, '✅', `${tasks}`, '未完成待辦')
  w.addSpacer(7)
  statRow(
    w,
    '⏳',
    nc ? (nc.days === 0 ? '今日' : `${nc.days} 日`) : '—',
    nc ? `距離：${nc.title}` : '冇即將到嘅重要日子',
  )

  return w
}

function errorWidget(message) {
  const w = new ListWidget()
  w.backgroundColor = BG_TOP
  w.setPadding(16, 16, 16, 16)
  const t = w.addText('NTK widget 設定未完成')
  t.font = Font.semiboldSystemFont(13)
  t.textColor = FG
  w.addSpacer(6)
  const m = w.addText(message)
  m.font = Font.systemFont(11)
  m.textColor = MUTED
  return w
}

// ───────── 入口 ─────────
let widget
try {
  if (CONFIG.SUPABASE_URL.includes('YOUR-PROJECT') || CONFIG.USER_ID.includes('YOUR_')) {
    widget = errorWidget('請先喺檔案頂部填好 CONFIG（SUPABASE_URL / SUPABASE_KEY / USER_ID）。')
  } else {
    const data = await fetchCollections()
    widget = buildWidget(data)
  }
} catch (e) {
  widget = errorWidget(String((e && e.message) || e))
}

if (config.runsInWidget) {
  Script.setWidget(widget)
} else {
  await widget.presentMedium()
}
Script.complete()
