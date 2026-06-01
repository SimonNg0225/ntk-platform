import { describe, it, expect } from 'vitest'
import {
  escapeICSText,
  toICSDate,
  toICSDateTime,
  toUTCStamp,
  foldLine,
  eventsToVevents,
  countdownsToVevents,
  wrapCalendar,
  buildICS,
  exportStamp,
} from './ics'
import type { CalendarEvent, CalendarCategory, Countdown } from '../../../data/types'

// ────────────────────────────────────────────────────────────
//  匯出 .ics 純函式測試。
//  測試時區由 vitest.config 釘死 Asia/Hong_Kong（UTC+8）。
//  全部唔掂 DOM —— 只係文字組裝；預期值人手按 RFC 5545 推。
// ────────────────────────────────────────────────────────────

const dtstamp = '20260601T000000Z'

function ev(p: Partial<CalendarEvent> & { id: string; title: string; date: string }): CalendarEvent {
  return { ...p } as CalendarEvent
}

describe('escapeICSText（RFC 5545 TEXT 轉義）', () => {
  it('反斜線、分號、逗號要 escape', () => {
    expect(escapeICSText('a\\b;c,d')).toBe('a\\\\b\\;c\\,d')
  })
  it('換行轉 \\n（字面兩字元）', () => {
    expect(escapeICSText('line1\nline2')).toBe('line1\\nline2')
  })
  it('反斜線要先處理，唔好重複 escape 後面引入嘅符號', () => {
    // 原文一個反斜線 → 兩個反斜線；其餘照計
    expect(escapeICSText('\\')).toBe('\\\\')
    expect(escapeICSText('a,b')).toBe('a\\,b')
  })
  it('普通字（含中文）原樣保留', () => {
    expect(escapeICSText('BAFS 卷一')).toBe('BAFS 卷一')
  })
})

describe('toICSDate（YYYY-MM-DD → YYYYMMDD）', () => {
  it('去掉間隔線', () => {
    expect(toICSDate('2026-05-04')).toBe('20260504')
    expect(toICSDate('2026-12-31')).toBe('20261231')
  })
  it('畸形 key 回空字串', () => {
    expect(toICSDate('2026-5-4')).toBe('') // 無補零唔合法
    expect(toICSDate('not-a-date')).toBe('')
    expect(toICSDate('')).toBe('')
  })
})

describe('toICSDateTime（本地 floating，無 Z）', () => {
  it('組成 YYYYMMDDTHHMMSS', () => {
    expect(toICSDateTime('2026-05-04', '09:30')).toBe('20260504T093000')
  })
  it('時 / 分補零', () => {
    expect(toICSDateTime('2026-05-04', '7:5')).toBe('20260504T070500')
  })
  it('刻意唔加 Z（保持本地時區語意，避免匯入後偏 8 個鐘）', () => {
    expect(toICSDateTime('2026-05-04', '09:30').endsWith('Z')).toBe(false)
  })
  it('畸形日期回空', () => {
    expect(toICSDateTime('bad', '09:30')).toBe('')
  })
})

describe('toUTCStamp（DTSTAMP，UTC + Z）', () => {
  it('香港時區 09:30 → UTC 01:30（減 8 鐘），帶 Z', () => {
    // 本地建構：HKT 2026-05-04 09:30 → UTC 2026-05-04 01:30
    const d = new Date(2026, 4, 4, 9, 30, 0)
    expect(toUTCStamp(d)).toBe('20260504T013000Z')
  })
  it('跨日：HKT 2026-05-04 03:00 → UTC 前一日 19:00', () => {
    const d = new Date(2026, 4, 4, 3, 0, 0)
    expect(toUTCStamp(d)).toBe('20260503T190000Z')
  })
})

describe('foldLine（RFC 5545 75 字元摺行）', () => {
  it('短行原樣', () => {
    expect(foldLine('SUMMARY:hi')).toBe('SUMMARY:hi')
    expect(foldLine('x'.repeat(75))).toBe('x'.repeat(75))
  })
  it('超過 75 字元：首段 75，續行以空格開頭', () => {
    const line = 'x'.repeat(80)
    const folded = foldLine(line)
    const parts = folded.split('\r\n')
    expect(parts[0].length).toBe(75)
    expect(parts[1].startsWith(' ')).toBe(true)
    // 還原（去掉續行前導空格）= 原文
    expect(parts.map((p, i) => (i === 0 ? p : p.slice(1))).join('')).toBe(line)
  })
})

describe('eventsToVevents（可見事件 → VEVENT，重複展開）', () => {
  const cats: CalendarCategory[] = [
    { id: 'work', name: '工作', color: 'blue', visible: true, createdAt: '' },
    { id: 'hidden', name: '私人', color: 'rose', visible: false, createdAt: '' },
  ]

  it('全日事件：用 VALUE=DATE，DTEND 為下一日（exclusive）', () => {
    const out = eventsToVevents(
      [ev({ id: 'e1', title: '假期', date: '2026-05-04', allDay: true })],
      cats,
      '2026-05-01',
      '2026-05-31',
      dtstamp,
    )
    const text = out.join('\n')
    expect(text).toContain('DTSTART;VALUE=DATE:20260504')
    expect(text).toContain('DTEND;VALUE=DATE:20260505') // 下一日
    expect(text).toContain('SUMMARY:假期')
  })

  it('有時間事件：DTSTART/DTEND 用 DATE-TIME，endTime 決定長度', () => {
    const out = eventsToVevents(
      [ev({ id: 'e2', title: '會議', date: '2026-05-04', time: '09:00', endTime: '10:30' })],
      cats,
      '2026-05-01',
      '2026-05-31',
      dtstamp,
    )
    const text = out.join('\n')
    expect(text).toContain('DTSTART:20260504T090000')
    expect(text).toContain('DTEND:20260504T103000')
  })

  it('無 endTime → 零長度（DTEND = DTSTART）', () => {
    const out = eventsToVevents(
      [ev({ id: 'e3', title: '提醒', date: '2026-05-04', time: '14:00' })],
      cats,
      '2026-05-01',
      '2026-05-31',
      dtstamp,
    )
    const text = out.join('\n')
    expect(text).toContain('DTSTART:20260504T140000')
    expect(text).toContain('DTEND:20260504T140000')
  })

  it('endTime 跨過午夜邊界？此處 endTime < time 當零長度（同日語意）', () => {
    // time 23:30、endTime 00:30 → diff 為負 → 當 0（DTEND=DTSTART）
    const out = eventsToVevents(
      [ev({ id: 'e4', title: '夜', date: '2026-05-04', time: '23:30', endTime: '00:30' })],
      cats,
      '2026-05-01',
      '2026-05-31',
      dtstamp,
    )
    const text = out.join('\n')
    expect(text).toContain('DTSTART:20260504T233000')
    expect(text).toContain('DTEND:20260504T233000')
  })

  it('隱藏行事曆嘅事件唔匯出', () => {
    const out = eventsToVevents(
      [
        ev({ id: 'vis', title: '出', date: '2026-05-04', allDay: true, calendarId: 'work' }),
        ev({ id: 'hid', title: '唔出', date: '2026-05-04', allDay: true, calendarId: 'hidden' }),
      ],
      cats,
      '2026-05-01',
      '2026-05-31',
      dtstamp,
    )
    const text = out.join('\n')
    expect(text).toContain('SUMMARY:出')
    expect(text).not.toContain('SUMMARY:唔出')
  })

  it('每日重複展開：範圍內每日一個 VEVENT', () => {
    const out = eventsToVevents(
      [
        ev({
          id: 'rec',
          title: '晨運',
          date: '2026-05-01',
          allDay: true,
          recurrence: { freq: 'daily', interval: 1 },
        }),
      ],
      cats,
      '2026-05-01',
      '2026-05-05', // 含頭含尾 5 日
      dtstamp,
    )
    const begins = out.filter((l) => l === 'BEGIN:VEVENT').length
    expect(begins).toBe(5)
    const text = out.join('\n')
    expect(text).toContain('DTSTART;VALUE=DATE:20260501')
    expect(text).toContain('DTSTART;VALUE=DATE:20260505')
  })

  it('排序穩定：日期升序（先 1 號後 3 號）', () => {
    const out = eventsToVevents(
      [
        ev({ id: 'b', title: '後', date: '2026-05-03', allDay: true }),
        ev({ id: 'a', title: '前', date: '2026-05-01', allDay: true }),
      ],
      cats,
      '2026-05-01',
      '2026-05-31',
      dtstamp,
    )
    const text = out.join('\n')
    expect(text.indexOf('SUMMARY:前')).toBeLessThan(text.indexOf('SUMMARY:後'))
  })

  it('VALARM：alertMinutes > 0 寫 TRIGGER:-PTnM', () => {
    const out = eventsToVevents(
      [ev({ id: 'al', title: '考試', date: '2026-05-04', time: '09:00', alertMinutes: 30 })],
      cats,
      '2026-05-01',
      '2026-05-31',
      dtstamp,
    )
    const text = out.join('\n')
    expect(text).toContain('BEGIN:VALARM')
    expect(text).toContain('TRIGGER:-PT30M')
  })

  it('notes + 行事曆名併入 DESCRIPTION', () => {
    const out = eventsToVevents(
      [ev({ id: 'd', title: '會議', date: '2026-05-04', allDay: true, calendarId: 'work', notes: '記得帶報告' })],
      cats,
      '2026-05-01',
      '2026-05-31',
      dtstamp,
    )
    const text = out.join('\n')
    expect(text).toContain('DESCRIPTION:記得帶報告\\n行事曆：工作')
  })

  it('UID 穩定：同一事件同一 occurrence，多次匯出 UID 一致', () => {
    const make = () =>
      eventsToVevents(
        [ev({ id: 'stable', title: 'x', date: '2026-05-04', allDay: true })],
        cats,
        '2026-05-01',
        '2026-05-31',
        dtstamp,
      ).find((l) => l.startsWith('UID:'))
    expect(make()).toBe(make())
    expect(make()).toContain('UID:ev-stable-20260504@ntk-platform')
  })
})

describe('countdownsToVevents（倒數 → VEVENT）', () => {
  const cd = (p: Partial<Countdown> & { id: string; title: string; date: string }): Countdown =>
    ({ createdAt: '', ...p }) as Countdown

  it('無時間 → 全日（VALUE=DATE，DTEND 下一日）', () => {
    const out = countdownsToVevents([cd({ id: 'c1', title: 'DSE', date: '2026-04-01' })], dtstamp)
    const text = out.join('\n')
    expect(text).toContain('DTSTART;VALUE=DATE:20260401')
    expect(text).toContain('DTEND;VALUE=DATE:20260402')
    expect(text).toContain('SUMMARY:DSE')
  })

  it('有時間 → 零長度 DATE-TIME', () => {
    const out = countdownsToVevents(
      [cd({ id: 'c2', title: '交 IES', date: '2026-04-01', time: '17:00' })],
      dtstamp,
    )
    const text = out.join('\n')
    expect(text).toContain('DTSTART:20260401T170000')
    expect(text).toContain('DTEND:20260401T170000')
  })

  it('分類中文標籤寫入 DESCRIPTION', () => {
    const out = countdownsToVevents(
      [cd({ id: 'c3', title: '卷一', date: '2026-04-01', category: 'exam', notes: '溫熟' })],
      dtstamp,
    )
    expect(out.join('\n')).toContain('DESCRIPTION:溫熟\\n分類：考試')
  })

  it('畸形日期跳過', () => {
    const out = countdownsToVevents([cd({ id: 'bad', title: 'x', date: 'oops' })], dtstamp)
    expect(out.filter((l) => l === 'BEGIN:VEVENT').length).toBe(0)
  })

  it('排序：日期升序', () => {
    const out = countdownsToVevents(
      [cd({ id: 'b', title: '後', date: '2026-06-01' }), cd({ id: 'a', title: '前', date: '2026-04-01' })],
      dtstamp,
    )
    const text = out.join('\n')
    expect(text.indexOf('SUMMARY:前')).toBeLessThan(text.indexOf('SUMMARY:後'))
  })
})

describe('wrapCalendar（VCALENDAR 外殼 + CRLF）', () => {
  it('有 VCALENDAR 頭尾、VERSION 2.0、PRODID', () => {
    const out = wrapCalendar([])
    expect(out.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(out).toContain('VERSION:2.0')
    expect(out).toContain('PRODID:-//NTK Platform//Calendar Export//ZH')
    expect(out.trimEnd().endsWith('END:VCALENDAR')).toBe(true)
  })

  it('用 CRLF 連行（RFC 5545）', () => {
    const out = wrapCalendar(['BEGIN:VEVENT', 'END:VEVENT'])
    expect(out).toContain('\r\n')
    expect(out).not.toMatch(/[^\r]\n/) // 唔應該有單獨 LF
  })

  it('calName → X-WR-CALNAME', () => {
    const out = wrapCalendar([], '我的行事曆')
    expect(out).toContain('X-WR-CALNAME:我的行事曆')
  })
})

describe('buildICS（主入口整合）', () => {
  const cats: CalendarCategory[] = [
    { id: 'work', name: '工作', color: 'blue', visible: true, createdAt: '' },
  ]
  const events: CalendarEvent[] = [
    ev({ id: 'e1', title: '會議', date: '2026-05-04', time: '09:00', endTime: '10:00' }),
  ]
  const countdowns: Countdown[] = [
    { id: 'c1', title: 'DSE', date: '2026-04-01', createdAt: '' } as Countdown,
  ]

  it('includeEvents only：只有事件、無倒數', () => {
    const out = buildICS({
      events,
      cats,
      countdowns,
      rangeStart: '2026-05-01',
      rangeEnd: '2026-05-31',
      includeEvents: true,
      includeCountdowns: false,
      now: new Date(2026, 5, 1, 8, 0, 0),
    })
    expect(out).toContain('SUMMARY:會議')
    expect(out).not.toContain('SUMMARY:DSE')
  })

  it('includeCountdowns only：只有倒數', () => {
    const out = buildICS({
      events,
      cats,
      countdowns,
      rangeStart: '2026-05-01',
      rangeEnd: '2026-05-31',
      includeEvents: false,
      includeCountdowns: true,
      now: new Date(2026, 5, 1, 8, 0, 0),
    })
    expect(out).toContain('SUMMARY:DSE')
    expect(out).not.toContain('SUMMARY:會議')
  })

  it('兩者都揀：兩個 VEVENT', () => {
    const out = buildICS({
      events,
      cats,
      countdowns,
      rangeStart: '2026-05-01',
      rangeEnd: '2026-05-31',
      includeEvents: true,
      includeCountdowns: true,
      now: new Date(2026, 5, 1, 8, 0, 0),
    })
    expect((out.match(/BEGIN:VEVENT/g) ?? []).length).toBe(2)
  })

  it('全部唔揀 / 無資料：仍係有效空 VCALENDAR', () => {
    const out = buildICS({
      events: [],
      cats,
      countdowns: [],
      rangeStart: '2026-05-01',
      rangeEnd: '2026-05-31',
      includeEvents: true,
      includeCountdowns: true,
      now: new Date(2026, 5, 1, 8, 0, 0),
    })
    expect(out).toContain('BEGIN:VCALENDAR')
    expect(out).toContain('END:VCALENDAR')
    expect(out).not.toContain('BEGIN:VEVENT')
  })

  it('DTSTAMP 用注入嘅 now（UTC）', () => {
    // HKT 2026-06-01 08:00 → UTC 2026-06-01 00:00
    const out = buildICS({
      events: [],
      cats,
      countdowns: [],
      rangeStart: '2026-05-01',
      rangeEnd: '2026-05-31',
      includeEvents: false,
      includeCountdowns: false,
      now: new Date(2026, 5, 1, 8, 0, 0),
    })
    // 無 VEVENT 時冇 DTSTAMP，行；改放一個事件確認
    const out2 = buildICS({
      events,
      cats,
      countdowns: [],
      rangeStart: '2026-05-01',
      rangeEnd: '2026-05-31',
      includeEvents: true,
      includeCountdowns: false,
      now: new Date(2026, 5, 1, 8, 0, 0),
    })
    expect(out).not.toContain('DTSTAMP')
    expect(out2).toContain('DTSTAMP:20260601T000000Z')
  })
})

describe('exportStamp（檔名日期戳，本地）', () => {
  it('回本地 YYYY-MM-DD', () => {
    expect(exportStamp(new Date(2026, 4, 4, 23, 59, 0))).toBe('2026-05-04')
  })
})
