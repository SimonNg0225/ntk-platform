import { describe, expect, it } from 'vitest'
import type { CalendarEvent, CycleCalendarEntry, TimetableSlot } from './types'
import {
  mergeNtkSchoolEvents,
  NTK_CYCLE_CALENDAR,
  NTK_SCHOOL_EVENTS,
  NTK_SLOTS,
  upgradeNtkCycleCalendarSeed,
  upgradeNtkTimetableSeed,
} from './ntk-seed'

const EXPECTED_2026_27 = [
  '1-3:S5 L3 · BAFS@55',
  '1-4:S5 L3 · BAFS@55',
  '2-1:S6 L1 · BAFS@51',
  '2-2:S6 L1 · BAFS@51',
  '2-5:S6 L3 · BAFS@51',
  '2-6:S6 L3 · BAFS@51',
  '2-7:S5 L1 · BAFS@55',
  '2-8:S5 L1 · BAFS@55',
  '3-3:S6 L1 · BAFS@51',
  '3-4:S6 L1 · BAFS@51',
  '3-7:S5 L3 · BAFS@55',
  '3-8:S5 L3 · BAFS@55',
  '4-1:S6 L3 · BAFS@51',
  '4-2:S6 L3 · BAFS@51',
  '4-4:3A · BAFS@25',
  '4-5:S5 L1 · BAFS@55',
  '4-6:S5 L1 · BAFS@55',
  '5-1:S5 L1 · BAFS@55',
  '5-2:S5 L1 · BAFS@55',
  '5-3:S6 L3 · BAFS@51',
  '5-4:S6 L3 · BAFS@51',
  '5-5:S6 L1 · BAFS@51',
  '5-6:S6 L1 · BAFS@51',
  '6-1:S5 L3 · BAFS@55',
  '6-2:S5 L3 · BAFS@55',
  '6-5:3A · BAFS@25',
]

const LEGACY_2025_26_CELLS = [
  '2-1', '2-2', '2-3', '2-4', '2-5', '2-6', '2-7', '2-8',
  '3-3', '3-4', '3-5', '3-6', '3-7', '3-8',
  '4-3', '4-5', '4-7', '4-8',
  '5-3', '5-4', '5-7', '5-8',
  '6-1', '6-2', '6-5', '6-6', '6-8',
]

describe('NTK 2026/27 時間表', () => {
  it('逐格對應相片中的 26 節課堂與課室', () => {
    expect(
      NTK_SLOTS.map(
        (slot) => `${slot.day}-${slot.period}:${slot.subject}@${slot.room}`,
      ),
    ).toEqual(EXPECTED_2026_27)
    expect(new Set(NTK_SLOTS.map((slot) => `${slot.day}-${slot.period}`)).size).toBe(26)
  })

  it('把上一學年的 NTK 預設課表升級，不保留舊格', () => {
    const legacy: TimetableSlot[] = LEGACY_2025_26_CELLS.map((cell) => {
      const [day, period] = cell.split('-').map(Number)
      return {
        id: `ntk-${cell}`,
        day,
        period,
        subject: '舊學年課堂',
        room: '56',
      }
    })

    const result = upgradeNtkTimetableSeed(legacy)
    expect(result.migrated).toBe(true)
    expect(result.slots).toEqual(NTK_SLOTS)
  })

  it('不會覆蓋使用者自行建立的時間表', () => {
    const custom: TimetableSlot[] = [
      { id: 'custom-lesson', day: 1, period: 1, subject: '中文', room: '101' },
    ]
    const result = upgradeNtkTimetableSeed(custom)
    expect(result).toEqual({ slots: custom, migrated: false })
  })
})

describe('NTK 2026/27 Day A–F 校曆', () => {
  it('完整轉錄兩學期 140 個循環日', () => {
    expect(NTK_CYCLE_CALENDAR).toHaveLength(140)
    expect(new Set(NTK_CYCLE_CALENDAR.map((entry) => entry.date)).size).toBe(140)

    const byDate = new Map(NTK_CYCLE_CALENDAR.map((entry) => [entry.date, entry.cycleDay]))
    expect(byDate.get('2026-09-03')).toBe(1)
    expect(byDate.get('2026-12-04')).toBe(5)
    expect(byDate.get('2027-01-05')).toBe(1)
    expect(byDate.get('2027-04-08')).toBe(2)
    expect(byDate.get('2027-06-04')).toBe(3)
  })

  it('不把假期、考試、校務活動當成循環日', () => {
    const dates = new Set(NTK_CYCLE_CALENDAR.map((entry) => entry.date))
    for (const date of [
      '2026-10-01',
      '2026-11-06',
      '2026-11-23',
      '2027-01-21',
      '2027-03-22',
      '2027-04-07',
      '2027-05-07',
      '2027-05-13',
    ]) {
      expect(dates.has(date), date).toBe(false)
    }
  })

  it('只把舊版 2025/26 預設片段升級', () => {
    const legacy: CycleCalendarEntry[] = [
      ['2026-06-01', 5], ['2026-06-02', 6], ['2026-06-03', 1], ['2026-06-04', 2], ['2026-06-05', 3],
      ['2026-06-08', 4], ['2026-06-09', 5], ['2026-06-10', 6], ['2026-06-11', 1], ['2026-06-12', 2],
      ['2026-06-15', 3], ['2026-06-16', 4], ['2026-06-17', 5], ['2026-06-18', 6],
    ].map(([date, cycleDay]) => ({ id: String(date), date: String(date), cycleDay: Number(cycleDay) }))

    expect(upgradeNtkCycleCalendarSeed(legacy)).toEqual({
      entries: NTK_CYCLE_CALENDAR,
      migrated: true,
    })

    const custom: CycleCalendarEntry[] = [
      { id: 'custom-date', date: '2026-09-01', cycleDay: 6 },
    ]
    expect(upgradeNtkCycleCalendarSeed(custom)).toEqual({ entries: custom, migrated: false })
  })
})

describe('NTK 2026/27 校曆特別事項', () => {
  it('包含 53 項已核對事項，全部為無時間的工作日曆事項', () => {
    expect(NTK_SCHOOL_EVENTS).toHaveLength(53)
    expect(new Set(NTK_SCHOOL_EVENTS.map((event) => event.id)).size).toBe(53)
    for (const event of NTK_SCHOOL_EVENTS) {
      expect(event.allDay).toBe(true)
      expect(event.time).toBeUndefined()
      expect(event.calendarId).toBe('cal-work')
      expect(event.mode).toBe('work')
      expect(event.type).toBe('學校校曆')
    }
  })

  it('保留校曆上的跨日範圍及同日多項事項', () => {
    const event = (title: string) => NTK_SCHOOL_EVENTS.find((item) => item.title === title)
    expect(event('中六統一測驗')).toMatchObject({ date: '2026-09-01', endDate: '2026-09-10' })
    expect(event('聖誕節及元旦假期')).toMatchObject({ date: '2026-12-24', endDate: '2027-01-03' })
    expect(event('農曆新年假期')).toMatchObject({ date: '2027-02-04', endDate: '2027-02-15' })
    expect(event('復活節及清明節假期')).toMatchObject({ date: '2027-03-26', endDate: '2027-04-06' })
    expect(event('暑假')).toMatchObject({ date: '2027-07-16', endDate: '2027-08-31' })
    expect(NTK_SCHOOL_EVENTS.filter((item) => item.date === '2026-09-01')).toHaveLength(2)
  })

  it('合併時保留個人事項，並按 id 或日期簽名防止重複', () => {
    const custom: CalendarEvent = {
      id: 'my-event',
      title: '我的會議',
      date: '2026-09-08',
      allDay: true,
    }
    const existingOpeningDay: CalendarEvent = {
      id: 'manually-added-opening',
      title: '開學日',
      date: '2026-09-01',
      allDay: true,
    }
    const first = mergeNtkSchoolEvents([custom, existingOpeningDay])
    expect(first.migrated).toBe(true)
    expect(first.events.filter((event) => event.title === '開學日')).toHaveLength(1)
    expect(first.events).toContain(custom)

    const second = mergeNtkSchoolEvents(first.events)
    expect(second).toEqual({ events: first.events, migrated: false })
  })
})
