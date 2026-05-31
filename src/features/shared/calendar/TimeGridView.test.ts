import { describe, it, expect } from 'vitest'
import { layoutDay, endMinutes, fmtMin } from './TimeGridView'
import type { Occurrence } from './util'
import type { CalendarEvent } from '../../../data/types'

const ev = (over: Partial<CalendarEvent>): CalendarEvent => ({
  id: 'e',
  title: 't',
  date: '2026-05-04',
  ...over,
})

const occ = (over: Partial<CalendarEvent>): Occurrence => ({
  event: ev(over),
  dateKey: '2026-05-04',
})

// ============================================================
//  endMinutes — 事件結束分鐘
// ============================================================
describe('endMinutes', () => {
  it('無 endTime → 開始 + 60', () => {
    expect(endMinutes(ev({ time: '09:00' }))).toBe(600) // 540 + 60
  })

  it('正常 endTime > startTime → 用 endTime', () => {
    expect(endMinutes(ev({ time: '09:00', endTime: '10:30' }))).toBe(630)
  })

  it('endTime == startTime → 退回 開始 + 60（唔會零時長）', () => {
    expect(endMinutes(ev({ time: '09:00', endTime: '09:00' }))).toBe(600)
  })

  it('endTime < startTime → 退回 開始 + 60（唔會負時長）', () => {
    expect(endMinutes(ev({ time: '10:00', endTime: '08:00' }))).toBe(660) // 600 + 60
  })

  it('無 time（全日）→ 0 + 60 = 60', () => {
    expect(endMinutes(ev({}))).toBe(60)
  })

  // 跨午夜（23:00–01:00）：單日時間格無法渲染跨日，故退回 s+60。
  // 23:00=1380, s+60=1440=當日午夜界線 → 視覺上正好顯示到 24:00（1 小時當日部分）。
  // 屬單日格 display 截斷而非數值錯（時長唔會變負）。記錄實際行為。
  it('跨午夜 23:00–01:00 → 退回 s+60（=1440，截斷到當日午夜，1 小時）', () => {
    expect(endMinutes(ev({ time: '23:00', endTime: '01:00' }))).toBe(1440)
  })
})

// ============================================================
//  fmtMin — 分鐘 → HH:mm（clamp [0,1439]，四捨五入）
// ============================================================
describe('fmtMin', () => {
  it('0 → 00:00', () => expect(fmtMin(0)).toBe('00:00'))
  it('60 邊界 → 01:00', () => expect(fmtMin(60)).toBe('01:00'))
  it('570 → 09:30', () => expect(fmtMin(570)).toBe('09:30'))
  it('負數 clamp 到 0 → 00:00', () => expect(fmtMin(-30)).toBe('00:00'))
  it('>1439 clamp 到 1439 → 23:59', () => expect(fmtMin(2000)).toBe('23:59'))
  it('非整數四捨五入（90.4 → 01:30）', () => expect(fmtMin(90.4)).toBe('01:30'))
  it('非整數四捨五入（89.6 → 01:30）', () => expect(fmtMin(89.6)).toBe('01:30'))
  it('1439 → 23:59', () => expect(fmtMin(1439)).toBe('23:59'))
})

// ============================================================
//  layoutDay — 同日重疊事件分欄（cluster lane assignment）
// ============================================================
describe('layoutDay', () => {
  it('空 list → []', () => {
    expect(layoutDay([])).toEqual([])
  })

  it('全部全日 → 過濾後空（全日唔上時間格）', () => {
    expect(layoutDay([occ({ allDay: true }), occ({})])).toEqual([])
  })

  it('完全唔重疊：各自 lanes=1，lane=0', () => {
    const res = layoutDay([
      occ({ id: 'a', time: '09:00', endTime: '10:00' }),
      occ({ id: 'b', time: '11:00', endTime: '12:00' }),
    ])
    expect(res).toHaveLength(2)
    for (const r of res) {
      expect(r.lanes).toBe(1)
      expect(r.lane).toBe(0)
    }
  })

  it('兩個剛好相接（A 結束 = B 開始）→ 同 lane（用 <= 邊界，唔當重疊）', () => {
    const res = layoutDay([
      occ({ id: 'a', time: '09:00', endTime: '10:00' }),
      occ({ id: 'b', time: '10:00', endTime: '11:00' }),
    ])
    // start(B)=clusterEnd(A) → flush 開新 cluster，兩者各 lanes=1
    expect(res).toHaveLength(2)
    const a = res.find((r) => r.occ.event.id === 'a')!
    const b = res.find((r) => r.occ.event.id === 'b')!
    expect(a.lanes).toBe(1)
    expect(b.lanes).toBe(1)
    expect(b.lane).toBe(0)
  })

  it('兩個重疊 → lanes=2，分到 lane 0 / 1', () => {
    const res = layoutDay([
      occ({ id: 'a', time: '09:00', endTime: '11:00' }),
      occ({ id: 'b', time: '10:00', endTime: '12:00' }),
    ])
    expect(res).toHaveLength(2)
    expect(res.every((r) => r.lanes === 2)).toBe(true)
    expect(res.map((r) => r.lane).sort()).toEqual([0, 1])
  })

  it('三個互相重疊 → lanes=3', () => {
    const res = layoutDay([
      occ({ id: 'a', time: '09:00', endTime: '12:00' }),
      occ({ id: 'b', time: '09:30', endTime: '12:00' }),
      occ({ id: 'c', time: '10:00', endTime: '12:00' }),
    ])
    expect(res).toHaveLength(3)
    expect(res.every((r) => r.lanes === 3)).toBe(true)
    expect(res.map((r) => r.lane).sort()).toEqual([0, 1, 2])
  })

  it('A、C 唔重疊但都同 B 重疊 → 同 cluster，lanes=2', () => {
    // A 09:00-10:00, B 09:30-11:30(同 A 同 C 都重疊), C 11:00-12:00
    const res = layoutDay([
      occ({ id: 'a', time: '09:00', endTime: '10:00' }),
      occ({ id: 'b', time: '09:30', endTime: '11:30' }),
      occ({ id: 'c', time: '11:00', endTime: '12:00' }),
    ])
    expect(res).toHaveLength(3)
    // 同一 cluster（因 B 連住 A 同 C），lanes 全 = 2
    expect(res.every((r) => r.lanes === 2)).toBe(true)
  })

  it('lane 重用：早結束嘅 lane 畀後來唔重疊嘅事件用', () => {
    // A 09:00-10:00（lane0）, B 09:30-11:30（lane1）, C 10:00-10:30（A 已完，重用 lane0）
    const res = layoutDay([
      occ({ id: 'a', time: '09:00', endTime: '10:00' }),
      occ({ id: 'b', time: '09:30', endTime: '11:30' }),
      occ({ id: 'c', time: '10:00', endTime: '10:30' }),
    ])
    const a = res.find((r) => r.occ.event.id === 'a')!
    const b = res.find((r) => r.occ.event.id === 'b')!
    const c = res.find((r) => r.occ.event.id === 'c')!
    expect(a.lane).toBe(0)
    expect(b.lane).toBe(1)
    expect(c.lane).toBe(0) // 重用 A 騰出嘅 lane0（A 結束=C 開始，<= 可重用）
    // 三者同 cluster（B 橋接），lanes = 2
    expect(a.lanes).toBe(2)
    expect(b.lanes).toBe(2)
    expect(c.lanes).toBe(2)
  })

  it('混入全日事件：只排定時，全日被過濾', () => {
    const res = layoutDay([
      occ({ id: 'allday', allDay: true }),
      occ({ id: 'timed', time: '09:00', endTime: '10:00' }),
    ])
    expect(res).toHaveLength(1)
    expect(res[0].occ.event.id).toBe('timed')
  })

  it('start/end 分鐘數計算正確', () => {
    const res = layoutDay([occ({ id: 'a', time: '09:15', endTime: '10:45' })])
    expect(res[0].start).toBe(555) // 9*60+15
    expect(res[0].end).toBe(645) // 10*60+45
  })
})
