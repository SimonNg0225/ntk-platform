// ============================================================
//  Edge Function: calendar-feed
//  ------------------------------------------------------------
//  訂閱式 .ics 日曆 feed（iPhone / iPad 原生提醒）。
//
//  - 入口：GET .../calendar-feed?token=<userToken>
//  - 用 service_role 反查 app_rows：collection='calendar_feed' 嗰啲 row
//    嘅 data（陣列）入面，邊個元素 token === 傳入 token → 攞返該 row 嘅
//    user_id（唔使新 table；token 存喺 app_rows）。攞唔到 → 401。
//  - 再讀該 user 嘅 events / countdowns 兩個 collection，砌成 .ics 回。
//  - 唯讀；service_role 只喺 function env，零秘密 hardcode。
//
//  ⚠️ 呢個係 Deno function，**唔入 app 嘅 tsc / build**，亦唔好畀任何
//     app 模組 import。.ics 砌法刻意鏡像
//     src/features/shared/calendar/ics.ts（格式 / escaping / VALARM /
//     RRULE / floating local time），但喺度自寫一份，零 app 依賴。
//
//  部署：
//    supabase functions deploy calendar-feed
//    （SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 由 Supabase 預設注入）
//  詳見 docs/superpowers/specs/2026-06-04-calendar-feed-reminders-design.md
// ============================================================

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

// 重複事件無限展開 —— 交畀行事曆 app 按 RRULE 自行展開（feed 永續彈提醒）。
// 非重複事件唔需要範圍框（全部直接出一個 VEVENT），故毋須 range 參數。

// ───────── 型別（鏡像 app data/types.ts 嘅相關欄位，唔 import）─────────

type RecurrenceFreq = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'

interface RecurrenceRule {
  freq: RecurrenceFreq
  interval?: number
  until?: string // YYYY-MM-DD
  count?: number
  byWeekday?: number[] // 0=日…6=六
}

interface CalendarEvent {
  id: string
  title: string
  date: string // YYYY-MM-DD
  time?: string // HH:mm（無 = 全日）
  endDate?: string
  endTime?: string
  allDay?: boolean
  calendarId?: string
  location?: string
  url?: string
  recurrence?: RecurrenceRule
  exDates?: string[]
  alertMinutes?: number
  notes?: string
}

interface Countdown {
  id: string
  title: string
  date: string // YYYY-MM-DD
  time?: string // HH:mm（選填）
  category?: string
  notes?: string
}

// ============================================================
//  .ics 砌法（鏡像 src/features/shared/calendar/ics.ts）
// ============================================================

/** RFC 5545 文字轉義：反斜線、分號、逗號要 escape，換行轉 \n。 */
function escapeICSText(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
}

/** YYYY-MM-DD → YYYYMMDD（DATE 值）；畸形 key 回 ''。 */
function toICSDate(key: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key)
  return m ? `${m[1]}${m[2]}${m[3]}` : ''
}

/**
 * 「本地時間」DATE-TIME 值：YYYYMMDDTHHMMSS（floating，無 Z / TZID）。
 * 同 app ics.ts 一致 —— app 全程用本地時區語意，floating local time
 * 匯入到任何行事曆都當機主本地時間，貼合原意（提醒時間唔走樣）。
 */
function toICSDateTime(key: string, time: string): string {
  const d = toICSDate(key)
  if (!d) return ''
  const [h = '0', mi = '0'] = time.split(':')
  const hh = String(Number(h) || 0).padStart(2, '0')
  const mm = String(Number(mi) || 0).padStart(2, '0')
  return `${d}T${hh}${mm}00`
}

/** DTSTAMP 要 UTC：YYYYMMDDTHHMMSSZ。 */
function toUTCStamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`
  )
}

const RRULE_FREQ: Record<RecurrenceFreq, string> = {
  none: '',
  daily: 'DAILY',
  weekly: 'WEEKLY',
  monthly: 'MONTHLY',
  yearly: 'YEARLY',
}
const BYDAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const

/** RecurrenceRule.until（YYYY-MM-DD）→ UNTIL 值（YYYYMMDD）；畸形 / 非真實日 → ''。 */
function rruleUntil(until: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(until)
  if (!m) return ''
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return ''
  const dt = new Date(y, mo - 1, d)
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return ''
  return `${m[1]}${m[2]}${m[3]}`
}

/**
 * RecurrenceRule → 一條 RRULE 值（唔含 "RRULE:" 前綴）。
 * 順序固定 FREQ;INTERVAL;BYDAY;UNTIL;COUNT，令輸出可重現（同 app ics.ts）。
 */
function recurrenceToRRule(rec?: RecurrenceRule): string {
  if (!rec || rec.freq === 'none') return ''
  const freq = RRULE_FREQ[rec.freq]
  if (!freq) return ''
  const parts: string[] = [`FREQ=${freq}`]

  const interval = Math.floor(rec.interval ?? 1)
  if (Number.isFinite(interval) && interval > 1) parts.push(`INTERVAL=${interval}`)

  if (rec.freq === 'weekly' && rec.byWeekday && rec.byWeekday.length) {
    const codes = [...new Set(rec.byWeekday)]
      .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
      .sort((a, b) => a - b)
      .map((d) => BYDAY_CODES[d])
    if (codes.length) parts.push(`BYDAY=${codes.join(',')}`)
  }

  if (rec.until) {
    const u = rruleUntil(rec.until)
    if (u) parts.push(`UNTIL=${u}`)
  }
  if (typeof rec.count === 'number' && Number.isFinite(rec.count) && rec.count > 0) {
    parts.push(`COUNT=${Math.floor(rec.count)}`)
  }

  return parts.join(';')
}

/** HH:mm → 當日分鐘數。 */
function minutesOf(time?: string): number {
  if (!time) return 0
  const [h, m] = time.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

/** 由 DATE key 推下一日（all-day VEVENT 嘅 DTEND，iCal 用 exclusive end）。 */
function nextDayKey(key: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key)
  if (!m) return key
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + 1, 12)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/**
 * 一個 occurrence 嘅結束 DATE-TIME（由開始日 +time，加 durationMin 分鐘）。
 * 會自動跨日 carry（用本地 Date 運算），同 app ics.ts 一致。
 */
function endDateTime(key: string, time: string, durationMin: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key)
  if (!m) return ''
  const start = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0)
  start.setMinutes(minutesOf(time) + Math.max(0, durationMin))
  const p = (n: number) => String(n).padStart(2, '0')
  const dk = `${start.getFullYear()}-${p(start.getMonth() + 1)}-${p(start.getDate())}`
  return `${toICSDate(dk)}T${p(start.getHours())}${p(start.getMinutes())}00`
}

/** 同一 occurrence 嘅持續分鐘：有 endTime → endTime−time（同日；負/0 當 0）；否則 0。 */
function durationMinutes(ev: CalendarEvent): number {
  if (!ev.time || !ev.endTime) return 0
  const diff = minutesOf(ev.endTime) - minutesOf(ev.time)
  return diff > 0 ? diff : 0
}

/** 事件係咪全日（無 time，或顯式 allDay）。 */
function isAllDay(ev: CalendarEvent): boolean {
  return ev.allDay === true || !ev.time
}

/** 安全 UID：穩定碎片組成（同資料重匯 UID 一致，方便更新）。 */
function uidFor(prefix: string, id: string, dateKey: string): string {
  const safe = String(id).replace(/[^A-Za-z0-9_-]/g, '')
  return `${prefix}-${safe}-${dateKey.replace(/-/g, '')}@ntk-platform`
}

/** RFC 5545 行摺疊：>75 字元摺行，續行以一個空格開頭（同 app ics.ts）。 */
function foldLine(line: string): string {
  if (line.length <= 75) return line
  const parts: string[] = []
  let rest = line
  parts.push(rest.slice(0, 75))
  rest = rest.slice(75)
  while (rest.length > 74) {
    parts.push(' ' + rest.slice(0, 74))
    rest = rest.slice(74)
  }
  if (rest.length) parts.push(' ' + rest)
  return parts.join('\r\n')
}

interface VeventOpts {
  uid: string
  dtstamp: string
  summary: string
  dtstart: string
  dtend: string
  allDay: boolean
  description?: string
  location?: string
  url?: string
  alertMinutes?: number
  rrule?: string
  exDates?: string[]
}

/** 砌一個 VEVENT 嘅行陣列（鏡像 app ics.ts veventLines）。 */
function veventLines(opts: VeventOpts): string[] {
  const lines: string[] = ['BEGIN:VEVENT', `UID:${opts.uid}`, `DTSTAMP:${opts.dtstamp}`]
  if (opts.allDay) {
    lines.push(`DTSTART;VALUE=DATE:${opts.dtstart}`)
    lines.push(`DTEND;VALUE=DATE:${opts.dtend}`)
  } else {
    lines.push(`DTSTART:${opts.dtstart}`)
    lines.push(`DTEND:${opts.dtend}`)
  }
  if (opts.rrule) lines.push(`RRULE:${opts.rrule}`)
  if (opts.exDates && opts.exDates.length) {
    // EXDATE 對齊 DTSTART 嘅 VALUE 類型：全日 DATE、有時間 DATE-TIME。
    const ds = [...new Set(opts.exDates)]
      .map((k) => toICSDate(k))
      .filter(Boolean)
      .sort()
    if (ds.length) {
      if (opts.allDay) {
        lines.push(`EXDATE;VALUE=DATE:${ds.join(',')}`)
      } else {
        const t = opts.dtstart.includes('T') ? opts.dtstart.slice(opts.dtstart.indexOf('T')) : ''
        lines.push(`EXDATE:${ds.map((d) => `${d}${t}`).join(',')}`)
      }
    }
  }
  lines.push(`SUMMARY:${escapeICSText(opts.summary)}`)
  if (opts.location?.trim()) lines.push(`LOCATION:${escapeICSText(opts.location.trim())}`)
  if (opts.url?.trim()) lines.push(`URL:${escapeICSText(opts.url.trim())}`)
  if (opts.description?.trim()) lines.push(`DESCRIPTION:${escapeICSText(opts.description.trim())}`)
  if (typeof opts.alertMinutes === 'number' && opts.alertMinutes > 0) {
    lines.push(
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeICSText(opts.summary)}`,
      `TRIGGER:-PT${Math.round(opts.alertMinutes)}M`,
      'END:VALARM',
    )
  }
  lines.push('END:VEVENT')
  return lines
}

/** 事件有冇真正重複（recurrence 存在且 freq !== none）。 */
function hasRecurrence(ev: CalendarEvent): boolean {
  return !!ev.recurrence && ev.recurrence.freq !== 'none'
}

/**
 * 把事件轉成 VEVENT 行（feed 版）。
 *  · 重複事件 → 單一 master VEVENT + RRULE（錨定 ev.date，交畀行事曆 app
 *    按 RRULE 無限展開；EXDATE 帶被刪 occurrence）。
 *  · 非重複事件 → 直接出一個 VEVENT（ev.date）。
 * Feed 唔做行事曆開關過濾（feed = 全部自己嘅事件）。
 */
function eventToVevent(ev: CalendarEvent, dtstamp: string): string[] {
  if (!toICSDate(ev.date)) return [] // 跳過畸形日期
  const allDay = isAllDay(ev)
  const desc = ev.notes?.trim() || undefined
  const common = {
    uid: uidFor('ev', ev.id, ev.date),
    dtstamp,
    summary: ev.title ?? '',
    description: desc,
    location: ev.location,
    url: ev.url,
    alertMinutes: ev.alertMinutes,
  }
  if (hasRecurrence(ev)) {
    const rrule = recurrenceToRRule(ev.recurrence)
    if (allDay) {
      return veventLines({
        ...common,
        dtstart: toICSDate(ev.date),
        dtend: toICSDate(nextDayKey(ev.date)),
        allDay: true,
        rrule,
        exDates: ev.exDates,
      })
    }
    const time = ev.time as string
    return veventLines({
      ...common,
      dtstart: toICSDateTime(ev.date, time),
      dtend: endDateTime(ev.date, time, durationMinutes(ev)),
      allDay: false,
      rrule,
      exDates: ev.exDates,
    })
  }
  if (allDay) {
    return veventLines({
      ...common,
      dtstart: toICSDate(ev.date),
      dtend: toICSDate(nextDayKey(ev.date)),
      allDay: true,
    })
  }
  const time = ev.time as string
  return veventLines({
    ...common,
    dtstart: toICSDateTime(ev.date, time),
    dtend: endDateTime(ev.date, time, durationMinutes(ev)),
    allDay: false,
  })
}

const COUNTDOWN_CAT_LABEL: Record<string, string> = {
  exam: '考試',
  deadline: '死線',
  assessment: '評估',
  event: '活動',
  other: '其他',
}

/**
 * 把倒數轉成 VEVENT 行（重要日子）。
 *  · 有時間 → 該時間點（零長度 DATE-TIME）+ 當日提醒（VALARM TRIGGER:-PT0M）。
 *  · 無時間 → 全日事件 + 當日提醒（VALARM TRIGGER:PT9H = 當日 09:00）。
 * Feed 版額外加 VALARM，令訂閱者倒數當日收到原生提醒（app 匯出版唔加）。
 */
function countdownToVevent(c: Countdown, dtstamp: string): string[] {
  if (!toICSDate(c.date)) return [] // 跳過畸形日期
  const cat = c.category ? COUNTDOWN_CAT_LABEL[c.category] : ''
  const desc = [c.notes?.trim(), cat ? `分類：${cat}` : ''].filter(Boolean).join('\n')
  const summary = c.title ?? ''
  if (c.time) {
    const lines: string[] = [
      'BEGIN:VEVENT',
      `UID:${uidFor('cd', c.id, c.date)}`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${toICSDateTime(c.date, c.time)}`,
      `DTEND:${toICSDateTime(c.date, c.time)}`,
      `SUMMARY:${escapeICSText(summary)}`,
    ]
    if (desc) lines.push(`DESCRIPTION:${escapeICSText(desc)}`)
    // 準時提醒（TRIGGER:-PT0M = 事件開始一刻）。
    lines.push(
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeICSText(summary)}`,
      'TRIGGER:-PT0M',
      'END:VALARM',
      'END:VEVENT',
    )
    return lines
  }
  // 全日：當日 09:00 提醒（相對 DTSTART 00:00 → +9 小時）。
  const lines: string[] = [
    'BEGIN:VEVENT',
    `UID:${uidFor('cd', c.id, c.date)}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;VALUE=DATE:${toICSDate(c.date)}`,
    `DTEND;VALUE=DATE:${toICSDate(nextDayKey(c.date))}`,
    `SUMMARY:${escapeICSText(summary)}`,
  ]
  if (desc) lines.push(`DESCRIPTION:${escapeICSText(desc)}`)
  lines.push(
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeICSText(summary)}`,
    'TRIGGER:PT9H',
    'END:VALARM',
    'END:VEVENT',
  )
  return lines
}

/**
 * 純函數 .ics builder（方便日後測試）：events + countdowns → 完整 VCALENDAR 文字。
 * CRLF 換行、行摺疊、escape 全做齊。無任何 VEVENT 時仍回有效（空）VCALENDAR。
 */
export function buildIcs(
  events: CalendarEvent[],
  countdowns: Countdown[],
  now: Date = new Date(),
): string {
  const dtstamp = toUTCStamp(now)
  const groups: string[] = []

  // 穩定排序（日期 → 時間 → 標題），令輸出可重現。
  const sortedEvents = events.slice().sort((a, b) => {
    if ((a.date ?? '') !== (b.date ?? '')) return (a.date ?? '') < (b.date ?? '') ? -1 : 1
    const ta = a.time ?? ''
    const tb = b.time ?? ''
    if (ta !== tb) return ta < tb ? -1 : 1
    return (a.title ?? '').localeCompare(b.title ?? '')
  })
  for (const ev of sortedEvents) groups.push(...eventToVevent(ev, dtstamp))

  const sortedCd = countdowns.slice().sort((a, b) =>
    (a.date ?? '') !== (b.date ?? '')
      ? (a.date ?? '') < (b.date ?? '')
        ? -1
        : 1
      : (a.title ?? '').localeCompare(b.title ?? ''),
  )
  for (const c of sortedCd) groups.push(...countdownToVevent(c, dtstamp))

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//EziTeach//Calendar Feed//ZH',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:EziTeach 教學易',
  ]
  lines.push(...groups, 'END:VCALENDAR')
  return lines.map(foldLine).join('\r\n') + '\r\n'
}

// ============================================================
//  Supabase REST helpers（service_role 直連 PostgREST）
// ============================================================

interface AppRow {
  user_id?: string
  collection?: string
  data?: unknown
}

/** 共用 service_role headers。 */
function serviceHeaders(): HeadersInit {
  return {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  }
}

/**
 * 反查 token → user_id。
 * data 喺 app_rows 係「整個 collection 嘅陣列」（見 src/lib/sync.ts），即
 * calendar_feed 行嘅 data = [{ id:'token', token:'...' }]。PostgREST 嘅
 * `data->>token` 對陣列唔 work，故拉晒 calendar_feed 行（數量極少）再喺
 * code 內比對 token —— 正確又穩陣。攞唔到 → null。
 */
async function lookupUserByToken(token: string): Promise<string | null> {
  const url =
    `${SUPABASE_URL}/rest/v1/app_rows` +
    `?select=user_id,data&collection=eq.calendar_feed`
  const res = await fetch(url, { headers: serviceHeaders() })
  if (!res.ok) return null
  const rows = (await res.json().catch(() => null)) as AppRow[] | null
  if (!Array.isArray(rows)) return null
  for (const row of rows) {
    if (!row.user_id) continue
    const arr = Array.isArray(row.data) ? (row.data as Array<Record<string, unknown>>) : []
    for (const el of arr) {
      if (el && typeof el === 'object' && el.token === token) {
        return row.user_id
      }
    }
  }
  return null
}

/** 讀某 user 嘅 events / countdowns 兩個 collection。 */
async function loadUserCalendar(
  uid: string,
): Promise<{ events: CalendarEvent[]; countdowns: Countdown[] }> {
  const url =
    `${SUPABASE_URL}/rest/v1/app_rows` +
    `?select=collection,data&user_id=eq.${encodeURIComponent(uid)}` +
    `&collection=in.(events,countdowns)`
  const res = await fetch(url, { headers: serviceHeaders() })
  let events: CalendarEvent[] = []
  let countdowns: Countdown[] = []
  if (!res.ok) return { events, countdowns }
  const rows = (await res.json().catch(() => null)) as AppRow[] | null
  if (!Array.isArray(rows)) return { events, countdowns }
  for (const row of rows) {
    const data = Array.isArray(row.data) ? row.data : []
    if (row.collection === 'events') events = data as CalendarEvent[]
    else if (row.collection === 'countdowns') countdowns = data as Countdown[]
  }
  return { events, countdowns }
}

// ============================================================
//  HTTP entry
// ============================================================

function textResponse(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'GET') {
    return textResponse('Method not allowed', 405)
  }
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    // env 缺失（理論上 Supabase 會注入）——唔洩漏細節。
    return textResponse('Server not configured', 500)
  }

  const token = new URL(req.url).searchParams.get('token')?.trim()
  if (!token) {
    return textResponse('Missing token', 400)
  }

  let uid: string | null
  try {
    uid = await lookupUserByToken(token)
  } catch {
    return textResponse('Lookup failed', 502)
  }
  if (!uid) {
    return textResponse('Invalid token', 401)
  }

  let events: CalendarEvent[]
  let countdowns: Countdown[]
  try {
    const loaded = await loadUserCalendar(uid)
    events = loaded.events
    countdowns = loaded.countdowns
  } catch {
    return textResponse('Failed to load calendar', 502)
  }

  const ics = buildIcs(events, countdowns)
  return new Response(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      // Apple 會定期 refresh；短 cache 令更新快啲反映。
      'Cache-Control': 'public, max-age=3600',
    },
  })
})
