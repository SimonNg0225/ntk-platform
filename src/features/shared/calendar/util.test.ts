import { describe, it, expect } from 'vitest'
import { toKey, fromKey, expandOccurrences, recurrenceLabel } from './util'
import type { CalendarEvent } from '../../../data/types'

const ev = (over: Partial<CalendarEvent>): CalendarEvent => ({
  id: 'e',
  title: 't',
  date: '2026-05-04', // 星期一
  ...over,
})

describe('日期 key（本地時區，無 TZ 漂移）', () => {
  it('toKey/fromKey roundtrip', () => {
    expect(toKey(fromKey('2026-05-04'))).toBe('2026-05-04')
    expect(toKey(fromKey('2026-01-01'))).toBe('2026-01-01')
    expect(toKey(fromKey('2026-12-31'))).toBe('2026-12-31')
  })
})

describe('expandOccurrences 重複展開', () => {
  it('非重複：淨係自己嗰日（喺範圍內）', () => {
    expect(
      expandOccurrences(ev({ date: '2026-05-04' }), '2026-05-01', '2026-05-31'),
    ).toEqual(['2026-05-04'])
    expect(
      expandOccurrences(ev({ date: '2026-06-04' }), '2026-05-01', '2026-05-31'),
    ).toEqual([])
  })

  it('每日 + interval', () => {
    expect(
      expandOccurrences(
        ev({ date: '2026-05-01', recurrence: { freq: 'daily', interval: 2 } }),
        '2026-05-01',
        '2026-05-07',
      ),
    ).toEqual(['2026-05-01', '2026-05-03', '2026-05-05', '2026-05-07'])
  })

  it('每週指定星期（逢一三五）', () => {
    expect(
      expandOccurrences(
        ev({
          date: '2026-05-04',
          recurrence: { freq: 'weekly', interval: 1, byWeekday: [1, 3, 5] },
        }),
        '2026-05-04',
        '2026-05-10',
      ),
    ).toEqual(['2026-05-04', '2026-05-06', '2026-05-08'])
  })

  it('until（重複至）', () => {
    expect(
      expandOccurrences(
        ev({ date: '2026-05-01', recurrence: { freq: 'daily', until: '2026-05-03' } }),
        '2026-05-01',
        '2026-05-31',
      ),
    ).toEqual(['2026-05-01', '2026-05-02', '2026-05-03'])
  })

  it('count（重複 N 次）', () => {
    expect(
      expandOccurrences(
        ev({ date: '2026-05-01', recurrence: { freq: 'daily', count: 2 } }),
        '2026-05-01',
        '2026-05-31',
      ),
    ).toEqual(['2026-05-01', '2026-05-02'])
  })

  it('exDates 例外（編輯/刪除單次）', () => {
    expect(
      expandOccurrences(
        ev({
          date: '2026-05-01',
          recurrence: { freq: 'daily', count: 3 },
          exDates: ['2026-05-02'],
        }),
        '2026-05-01',
        '2026-05-31',
      ),
    ).toEqual(['2026-05-01', '2026-05-03'])
  })

  it('每月 / 每年', () => {
    expect(
      expandOccurrences(
        ev({ date: '2026-01-15', recurrence: { freq: 'monthly', count: 3 } }),
        '2026-01-01',
        '2026-12-31',
      ),
    ).toEqual(['2026-01-15', '2026-02-15', '2026-03-15'])
  })
})

describe('recurrenceLabel', () => {
  it('不重複', () => expect(recurrenceLabel(undefined)).toBe('不重複'))
  it('每日', () => expect(recurrenceLabel({ freq: 'daily' })).toBe('每日'))
  it('每 2 週', () => expect(recurrenceLabel({ freq: 'weekly', interval: 2 })).toContain('每 2'))
  it('每週指定星期顯示星期名', () =>
    expect(recurrenceLabel({ freq: 'weekly', byWeekday: [1, 3, 5] })).toContain('一'))
})
