import type {
  CalendarEvent,
  CalendarCategory,
  Countdown,
} from '../../../data/types'
import { fromKey, getOccurrences, isAllDay, minutesOf, toKey } from './util'

// ============================================================
//  匯出 .ics（iCalendar / RFC 5545）—— 純文字組裝，零依賴
//  - 可見事件（尊重 calendar 開關 + 重複展開成逐個 occurrence）
//  - 同／或全部倒數（每個倒數寫成一個全日 VEVENT）
//  匯入 Apple / Google / Outlook Calendar 用。
// ============================================================

/**
 * RFC 5545 文字轉義：反斜線、分號、逗號要 escape，換行轉 \n。
 * 用喺 SUMMARY / DESCRIPTION / LOCATION 等 TEXT 值。
 */
export function escapeICSText(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
}

/** 把 YYYY-MM-DD 拆成 YYYYMMDD（DATE 值，全日事件用）。畸形 key 回 ''。 */
export function toICSDate(key: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key)
  return m ? `${m[1]}${m[2]}${m[3]}` : ''
}

/**
 * 砌一個「本地時間」DATE-TIME 值：YYYYMMDDTHHMMSS（無 Z，無 TZID）。
 * 唔加 Z（UTC）—— 因為 app 全程用本地時區語意，加 Z 會令匯入後偏移時差。
 * 用 floating local time，匯入到任何行事曆都當作機主本地時間，貼合原意。
 */
export function toICSDateTime(key: string, time: string): string {
  const d = toICSDate(key)
  if (!d) return ''
  const [h = '0', mi = '0'] = time.split(':')
  const hh = String(Number(h) || 0).padStart(2, '0')
  const mm = String(Number(mi) || 0).padStart(2, '0')
  return `${d}T${hh}${mm}00`
}

/** 由 DATE key 推下一日（給 all-day VEVENT 嘅 DTEND，iCal 用 exclusive end）。 */
function nextDayKey(key: string): string {
  const d = fromKey(key)
  return toKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 12))
}

/**
 * 計一個 occurrence 嘅結束 DATE-TIME（同一日，加 durationMin 分鐘）。
 * 只用喺有時間嘅事件。會自動跨日 carry（用本地 Date 運算）。
 */
function endDateTime(key: string, time: string, durationMin: number): string {
  const base = fromKey(key)
  const start = new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate(),
    0,
    0,
    0,
    0,
  )
  start.setMinutes(minutesOf(time) + Math.max(0, durationMin))
  return `${toICSDate(toKey(start))}T${String(start.getHours()).padStart(2, '0')}${String(
    start.getMinutes(),
  ).padStart(2, '0')}00`
}

/**
 * 一個事件「同一個 occurrence」嘅持續分鐘數：
 * - 有 endTime → endTime − time（同日；負或 0 當 0）
 * - 否則 → 0（即 DTEND = DTSTART，零長度，匯入後多數顯示為該時間點）
 */
function durationMinutes(ev: CalendarEvent): number {
  if (!ev.time || !ev.endTime) return 0
  const diff = minutesOf(ev.endTime) - minutesOf(ev.time)
  return diff > 0 ? diff : 0
}

/** 安全 UID：用穩定碎片組成，唔靠隨機（同一資料匯出多次 UID 一致，方便重匯更新）。 */
function uidFor(prefix: string, id: string, dateKey: string): string {
  const safe = String(id).replace(/[^A-Za-z0-9_-]/g, '')
  return `${prefix}-${safe}-${dateKey.replace(/-/g, '')}@ntk-platform`
}

/** 砌一個 VEVENT 嘅行陣列（唔含 BEGIN/END 以外嘅尾部換行；後面統一 join）。 */
function veventLines(opts: {
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
}): string[] {
  const lines: string[] = ['BEGIN:VEVENT', `UID:${opts.uid}`, `DTSTAMP:${opts.dtstamp}`]
  if (opts.allDay) {
    lines.push(`DTSTART;VALUE=DATE:${opts.dtstart}`)
    lines.push(`DTEND;VALUE=DATE:${opts.dtend}`)
  } else {
    lines.push(`DTSTART:${opts.dtstart}`)
    lines.push(`DTEND:${opts.dtend}`)
  }
  lines.push(`SUMMARY:${escapeICSText(opts.summary)}`)
  if (opts.location?.trim()) lines.push(`LOCATION:${escapeICSText(opts.location.trim())}`)
  if (opts.url?.trim()) lines.push(`URL:${escapeICSText(opts.url.trim())}`)
  if (opts.description?.trim())
    lines.push(`DESCRIPTION:${escapeICSText(opts.description.trim())}`)
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

/**
 * 把可見事件（展開所有 occurrence）轉成 VEVENT 行。
 * 尊重行事曆開關（隱藏行事曆嘅事件唔出）—— 直接借用 getOccurrences 嘅過濾邏輯。
 * 範圍由 [startKey, endKey]（YYYY-MM-DD）框住，避免無限重複爆檔。
 */
export function eventsToVevents(
  events: CalendarEvent[],
  cats: CalendarCategory[],
  startKey: string,
  endKey: string,
  dtstamp: string,
): string[] {
  const out: string[] = []
  const occ = getOccurrences(events, cats, startKey, endKey)
  // 穩定排序：日期 → 時間 → 標題，令匯出檔可重現（方便 diff / 重匯）。
  occ.sort((a, b) => {
    if (a.dateKey !== b.dateKey) return a.dateKey < b.dateKey ? -1 : 1
    const ta = a.event.time ?? ''
    const tb = b.event.time ?? ''
    if (ta !== tb) return ta < tb ? -1 : 1
    return a.event.title.localeCompare(b.event.title)
  })
  for (const o of occ) {
    const ev = o.event
    const allDay = isAllDay(ev)
    const catName = o.category?.name
    // 把行事曆名 / 舊 type 併入描述，匯入後仍睇得返脈絡。
    const descParts = [ev.notes?.trim(), catName ? `行事曆：${catName}` : '']
      .filter(Boolean)
      .join('\n')
    if (allDay) {
      out.push(
        ...veventLines({
          uid: uidFor('ev', ev.id, o.dateKey),
          dtstamp,
          summary: ev.title,
          dtstart: toICSDate(o.dateKey),
          dtend: toICSDate(nextDayKey(o.dateKey)),
          allDay: true,
          description: descParts || undefined,
          location: ev.location,
          url: ev.url,
          alertMinutes: ev.alertMinutes,
        }),
      )
    } else {
      const time = ev.time as string
      out.push(
        ...veventLines({
          uid: uidFor('ev', ev.id, o.dateKey),
          dtstamp,
          summary: ev.title,
          dtstart: toICSDateTime(o.dateKey, time),
          dtend: endDateTime(o.dateKey, time, durationMinutes(ev)),
          allDay: false,
          description: descParts || undefined,
          location: ev.location,
          url: ev.url,
          alertMinutes: ev.alertMinutes,
        }),
      )
    }
  }
  return out
}

const COUNTDOWN_CAT_LABEL: Record<string, string> = {
  exam: '考試',
  deadline: '死線',
  assessment: '評估',
  event: '活動',
  other: '其他',
}

/**
 * 把倒數轉成 VEVENT 行。倒數本質係「某日（可選時間）嘅大日子」：
 * - 有時間 → 該時間點（零長度 DATE-TIME 事件）
 * - 無時間 → 全日事件
 */
export function countdownsToVevents(items: Countdown[], dtstamp: string): string[] {
  const out: string[] = []
  const sorted = items
    .slice()
    .sort((a, b) => (a.date !== b.date ? (a.date < b.date ? -1 : 1) : a.title.localeCompare(b.title)))
  for (const c of sorted) {
    if (!toICSDate(c.date)) continue // 跳過畸形日期
    const cat = c.category ? COUNTDOWN_CAT_LABEL[c.category] : ''
    const desc = [c.notes?.trim(), cat ? `分類：${cat}` : '']
      .filter(Boolean)
      .join('\n')
    if (c.time) {
      out.push(
        ...veventLines({
          uid: uidFor('cd', c.id, c.date),
          dtstamp,
          summary: c.title,
          dtstart: toICSDateTime(c.date, c.time),
          dtend: toICSDateTime(c.date, c.time),
          allDay: false,
          description: desc || undefined,
        }),
      )
    } else {
      out.push(
        ...veventLines({
          uid: uidFor('cd', c.id, c.date),
          dtstamp,
          summary: c.title,
          dtstart: toICSDate(c.date),
          dtend: toICSDate(nextDayKey(c.date)),
          allDay: true,
          description: desc || undefined,
        }),
      )
    }
  }
  return out
}

/** 把 VEVENT 行包成完整 VCALENDAR，並用 CRLF（RFC 5545）連接。 */
export function wrapCalendar(veventLineGroups: string[], calName?: string): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//NTK Platform//Calendar Export//ZH',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ]
  if (calName?.trim()) {
    lines.push(`X-WR-CALNAME:${escapeICSText(calName.trim())}`)
  }
  lines.push(...veventLineGroups, 'END:VCALENDAR')
  return lines.map(foldLine).join('\r\n') + '\r\n'
}

/**
 * RFC 5545 行摺疊：超過 75 個八位元組（這裡用字元近似）嘅行要摺，
 * 續行以一個空格開頭。多數短行唔受影響；長 SUMMARY / DESCRIPTION 先觸發。
 */
export function foldLine(line: string): string {
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

export interface BuildICSOptions {
  events: CalendarEvent[]
  cats: CalendarCategory[]
  countdowns: Countdown[]
  /** 展開重複事件嘅範圍（含頭含尾，YYYY-MM-DD）。 */
  rangeStart: string
  rangeEnd: string
  includeEvents: boolean
  includeCountdowns: boolean
  /** 匯出時間戳（DTSTAMP，UTC basic 格式 YYYYMMDDTHHMMSSZ）。可注入以利測試。 */
  now?: Date
  calName?: string
}

/** DTSTAMP 要 UTC：YYYYMMDDTHHMMSSZ。 */
export function toUTCStamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`
  )
}

/** 主入口：砌完整 .ics 文字。無任何 VEVENT 時仍回有效（空）VCALENDAR。 */
export function buildICS(opts: BuildICSOptions): string {
  const dtstamp = toUTCStamp(opts.now ?? new Date())
  const groups: string[] = []
  if (opts.includeEvents) {
    groups.push(
      ...eventsToVevents(opts.events, opts.cats, opts.rangeStart, opts.rangeEnd, dtstamp),
    )
  }
  if (opts.includeCountdowns) {
    groups.push(...countdownsToVevents(opts.countdowns, dtstamp))
  }
  return wrapCalendar(groups, opts.calName)
}

/** 用喺檔名嘅日期戳：YYYY-MM-DD（本地）。 */
export function exportStamp(d: Date): string {
  return toKey(d)
}
