// ============================================================
//  NTK Platform — 今日課堂 iOS 小組件（Scriptable）
//  ------------------------------------------------------------
//  喺 iPhone 主畫面顯示「今日課堂」：計返今日係 Day 幾（6 日循環，
//  由校曆 cycle_calendar 決定；或星期模式），列出當日堂 + 高亮緊上嗰節。
//  同 ntk-widget.js 一樣由你 Supabase 嘅 app_rows 攞數據。
//
//  ── 安裝 ──────────────────────────────────────────────────
//  1. Scriptable（免費）→ ＋ 新 script → 改名「NTK 課堂」→ 全文貼入。
//  2. 填好下面 CONFIG（同 ntk-widget.js 一模一樣）：
//       • SUPABASE_URL：同 .env.local 嘅 VITE_SUPABASE_URL 一樣
//       • SUPABASE_KEY：service_role key（Dashboard → Settings → API）
//         ⚠️ 權限大、可繞 RLS —— 只放你部機，切勿外洩 / commit。
//       • USER_ID：你嘅 Supabase 用戶 UID —— ⚠️ 係一條 **UUID**
//         （Dashboard → Authentication → Users → 複製 User UID），
//         唔係你個 GitHub / 登入名！
//  3. 主畫面長按 → ＋ → Scriptable → 中 / 大 widget → Script 揀「NTK 課堂」。
//  ============================================================

const CONFIG = {
  SUPABASE_URL: 'https://YOUR-PROJECT.supabase.co', // ← 填你嘅
  SUPABASE_KEY: 'YOUR_SERVICE_ROLE_KEY', // ← 填你嘅（service_role）
  USER_ID: 'YOUR_USER_UID', // ← 填你嘅 Supabase 用戶 UID（UUID，唔係用戶名）
}

// 主題色（工作模式 = 青綠 teal；精緻深色 + 通透 accent）
const ACCENT = new Color('#2dd4bf') // teal-300，醒目（標題點 / 日期 / 上緊標記）
const ACCENT_DEEP = new Color('#0f766e') // teal-700，「上緊」格底色（襯白字）
const BG_TOP = new Color('#0c1f24') // 左上：teal 調深色
const BG_BOT = new Color('#0a0e17') // 右下：近黑海軍藍 → 對角漸層有深度
const FG = new Color('#f1f5f9')
const MUTED = new Color('#8aa0b0')
const CARD = new Color('#16242e') // 柔和卡底

const CYCLE_LABELS = ['A', 'B', 'C', 'D', 'E', 'F']
const WD = ['日', '一', '二', '三', '四', '五', '六']

// ───────── 工具 ─────────
function dayKey(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function minutesOf(hhmm) {
  if (!hhmm || typeof hhmm !== 'string') return -1
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

// 今日係邊個 day（cycle 模式 → 校曆查 1..6；否則星期一..六=1..6；冇排 → 0）
function todayDayNum(cal, cfg) {
  const today = dayKey(new Date())
  if (cfg && cfg.cycle) {
    const e = (cal || []).find((c) => c && c.date === today)
    return e ? e.cycleDay : 0
  }
  const dow = new Date().getDay() // 0=日, 1=一 … 6=六
  return dow === 0 ? 0 : dow
}

function dayTitle(dayNum, cycle) {
  if (dayNum < 1) return cycle ? '休息日' : `星期${WD[new Date().getDay()]}`
  return cycle ? `Day ${CYCLE_LABELS[dayNum - 1] || dayNum}` : `星期${WD[dayNum]}`
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
  if (!Array.isArray(rows)) {
    const msg = rows && rows.message ? rows.message : 'Supabase 回應格式唔啱'
    throw new Error(msg)
  }
  const map = {}
  for (const row of rows) map[row.collection] = row.data || []
  return map
}

// ───────── 整理今日堂 ─────────
function todaysLessons(data) {
  const slots = data['timetable'] || []
  const cal = data['cycle_calendar'] || []
  const cfgRow = (data['timetable_config'] || [])[0] || {}
  const cycle = !!cfgRow.cycle
  const bells = cfgRow.bells || []
  const bellByPeriod = {}
  for (const b of bells) if (b && b.kind === 'lesson') bellByPeriod[b.period] = b

  const dayNum = todayDayNum(cal, cfgRow)
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes()

  const lessons = slots
    .filter((s) => s && s.day === dayNum)
    .sort((a, b) => (a.period || 0) - (b.period || 0))
    .map((s) => {
      const bell = bellByPeriod[s.period]
      const start = bell ? bell.start : ''
      const end = bell ? bell.end : ''
      const isNow = bell && minutesOf(start) <= nowMin && nowMin < minutesOf(end)
      const isPast = bell && minutesOf(end) <= nowMin
      return { period: s.period, subject: s.subject || '', room: s.room || '', start, end, isNow, isPast }
    })

  return { dayNum, cycle, lessons }
}

// ───────── 砌 widget ─────────
function lessonRow(w, l) {
  const row = w.addStack()
  row.centerAlignContent()
  row.setPadding(5, 8, 5, 8)
  row.cornerRadius = 9
  if (l.isNow) row.backgroundColor = ACCENT_DEEP
  else if (!l.isPast) row.backgroundColor = CARD

  const time = row.addStack()
  time.layoutVertically()
  const t1 = time.addText(l.start || `第${l.period}節`)
  t1.font = Font.semiboldSystemFont(11)
  t1.textColor = l.isNow ? Color.white() : ACCENT
  if (l.end) {
    const t2 = time.addText(l.end)
    t2.font = Font.systemFont(9)
    t2.textColor = l.isNow ? new Color('#ccfbf1') : MUTED
  }
  time.size = new Size(42, 0)

  row.addSpacer(8)
  const col = row.addStack()
  col.layoutVertically()
  const subj = col.addText(l.subject)
  subj.font = Font.semiboldSystemFont(13)
  subj.textColor = l.isNow ? Color.white() : l.isPast ? MUTED : FG
  subj.lineLimit = 1
  if (l.room) {
    const rm = col.addText(`課室 ${l.room}`)
    rm.font = Font.systemFont(10)
    rm.textColor = l.isNow ? new Color('#dbeafe') : MUTED
  }
  row.addSpacer()
  if (l.isNow) {
    const live = row.addText('● 上緊')
    live.font = Font.boldSystemFont(10)
    live.textColor = Color.white()
  }
}

function buildWidget(data) {
  const w = new ListWidget()
  const g = new LinearGradient()
  g.colors = [BG_TOP, BG_BOT]
  g.locations = [0, 1]
  g.startPoint = new Point(0, 0) // 對角漸層（左上 → 右下），有深度
  g.endPoint = new Point(1, 1)
  w.backgroundGradient = g
  w.setPadding(13, 14, 13, 14)

  const { dayNum, cycle, lessons } = todaysLessons(data)

  // 標題
  const head = w.addStack()
  head.centerAlignContent()
  const dot = head.addText('●')
  dot.font = Font.boldSystemFont(10)
  dot.textColor = ACCENT
  head.addSpacer(6)
  const title = head.addText('今日課堂')
  title.font = Font.semiboldSystemFont(13)
  title.textColor = FG
  head.addSpacer()
  const tag = head.addText(`${dayTitle(dayNum, cycle)} · ${dayKey(new Date()).slice(5).replace('-', '/')}`)
  tag.font = Font.mediumSystemFont(11)
  tag.textColor = ACCENT

  w.addSpacer(9)

  if (!lessons.length) {
    const empty = w.addText(dayNum < 1 ? '今日休息 🎉' : '今日冇堂 🎉')
    empty.font = Font.semiboldSystemFont(15)
    empty.textColor = FG
    const sub = w.addText(dayNum < 1 ? '唔喺上課循環日' : '當日課表係空')
    sub.font = Font.systemFont(11)
    sub.textColor = MUTED
    return w
  }

  // 最多顯示 6 節（widget 高度有限），其餘提示「仲有 N 節」
  const MAX = 6
  for (const l of lessons.slice(0, MAX)) {
    lessonRow(w, l)
    w.addSpacer(4)
  }
  if (lessons.length > MAX) {
    const more = w.addText(`＋ 仲有 ${lessons.length - MAX} 節`)
    more.font = Font.systemFont(10)
    more.textColor = MUTED
  }

  return w
}

function errorWidget(message) {
  const w = new ListWidget()
  w.backgroundColor = BG_TOP
  w.setPadding(16, 16, 16, 16)
  const t = w.addText('NTK 課堂 widget 設定未完成')
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
    widget = errorWidget('請先喺檔案頂部填好 CONFIG（SUPABASE_URL / SUPABASE_KEY / USER_ID）。USER_ID 要係 UUID。')
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
  await widget.presentLarge()
}
Script.complete()
