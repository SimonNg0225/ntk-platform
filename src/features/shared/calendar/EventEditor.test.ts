import { describe, it, expect } from 'vitest'
import { applyFullEdit, plusHour } from './EventEditor'
import type { CalendarEvent } from '../../../data/types'

// ============================================================
//  plusHour — HH:mm 加 1 小時，作結束時間預設
//  bug #3 (low)：舊 code 對 23:xx 會 wrap 到 00:xx（如 23:30→00:30），
//  令結束時間預設早過開始。修正：clamp 喺 23:59，唔 wrap 過午夜，
//  確保預設結束時間永遠 >= 開始時間。
// ============================================================
describe('plusHour', () => {
  it('一般：09:00 → 10:00', () => {
    expect(plusHour('09:00')).toBe('10:00')
  })

  it('保留分鐘：09:30 → 10:30', () => {
    expect(plusHour('09:30')).toBe('10:30')
  })

  it('00:00 → 01:00', () => {
    expect(plusHour('00:00')).toBe('01:00')
  })

  it('缺分量容錯（"09" → 10:00）', () => {
    expect(plusHour('09')).toBe('10:00')
  })

  // ── bug #3 揭發 + 修正後行為 ──
  it('23:30 → 23:59（clamp，唔 wrap 到 00:30，預設結束唔會早過開始）', () => {
    expect(plusHour('23:30')).toBe('23:59')
  })

  it('23:00 → 23:59（clamp，唔 wrap 到 00:00）', () => {
    expect(plusHour('23:00')).toBe('23:59')
  })

  it('22:30 → 23:30（未到上限，正常加 1 小時）', () => {
    expect(plusHour('22:30')).toBe('23:30')
  })

  it('23:59 → 23:59（已到上限，停喺 23:59）', () => {
    expect(plusHour('23:59')).toBe('23:59')
  })
})

// ============================================================
//  applyFullEdit — 整體編輯儲存：清空欄位要「真正消失」
//  bug (P1, data-integrity)：舊 code 用 eventsCol.update()（merge），
//  buildPayload 對清空欄位「省略 key」→ merge 殘留舊值。最嚴重：將重複
//  事件改成『不重複』後 recurrence 殘留 → 事件永遠繼續重複，無法取消。
//  修正：buildPayload 對清空欄位顯式 = undefined，儲存改用 applyFullEdit
//  整體取代並剔走 undefined key。expandOccurrences 靠 ev.recurrence 判斷，
//  所以 recurrence 必須真正消失。
// ============================================================
describe('applyFullEdit', () => {
  const recurring: CalendarEvent = {
    id: 'e1',
    title: '每週例會',
    date: '2026-06-01',
    time: '09:00',
    endTime: '10:00',
    location: '會議室 A',
    url: 'https://example.com',
    notes: '帶手提',
    calendarId: 'cal1',
    alertMinutes: 15,
    recurrence: { freq: 'weekly', interval: 1 },
    exDates: ['2026-06-08'],
  }

  it('改成不重複（recurrence=undefined）→ recurrence 真正消失', () => {
    // buildPayload 喺 freq==='none' 時會畀 recurrence: undefined
    const next = applyFullEdit(recurring, {
      title: '每週例會',
      date: '2026-06-01',
      allDay: false,
      time: '09:00',
      endTime: '10:00',
      recurrence: undefined,
      location: undefined,
      url: undefined,
      notes: undefined,
      calendarId: undefined,
      endDate: undefined,
      alertMinutes: undefined,
    })
    expect('recurrence' in next).toBe(false)
    expect(next.recurrence).toBeUndefined()
  })

  it('清空 location/url/notes → 對應 key 真正消失，唔殘留舊值', () => {
    const next = applyFullEdit(recurring, {
      title: '每週例會',
      date: '2026-06-01',
      allDay: false,
      time: '09:00',
      endTime: '10:00',
      recurrence: { freq: 'weekly', interval: 1 },
      location: undefined,
      url: undefined,
      notes: undefined,
    })
    expect('location' in next).toBe(false)
    expect('url' in next).toBe(false)
    expect('notes' in next).toBe(false)
  })

  it('allDay false→true（time/endTime=undefined）→ 唔殘留舊 time/endTime', () => {
    const next = applyFullEdit(recurring, {
      title: '每週例會',
      date: '2026-06-01',
      allDay: true,
      time: undefined,
      endTime: undefined,
    })
    expect(next.allDay).toBe(true)
    expect('time' in next).toBe(false)
    expect('endTime' in next).toBe(false)
  })

  it('保留 id 同原 exDates（整體取代但唔丟例外日）', () => {
    const next = applyFullEdit(recurring, {
      title: '改咗名',
      date: '2026-06-01',
      allDay: false,
      time: '09:00',
      recurrence: { freq: 'weekly', interval: 1 },
    })
    expect(next.id).toBe('e1')
    expect(next.exDates).toEqual(['2026-06-08'])
    expect(next.title).toBe('改咗名')
  })

  it('有值嘅欄位正常寫入（更新 location）', () => {
    const next = applyFullEdit(recurring, {
      title: '每週例會',
      date: '2026-06-01',
      allDay: false,
      time: '09:00',
      location: '會議室 B',
    })
    expect(next.location).toBe('會議室 B')
  })
})
