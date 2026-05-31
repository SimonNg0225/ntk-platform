import { describe, it, expect } from 'vitest'
import {
  isExcused,
  toKey,
  fromKey,
  weekdayOf,
  isWeekend,
  longDateLabel,
  shortDateLabel,
  shiftKey,
  monthDays,
  recentDayKeys,
  monthLabel,
  countDay,
  tallyByStudent,
  rateTone,
  rateBarTone,
} from './util'
import type { AttendanceRecord, AttendanceStatus } from '../../../data/types'

// ───────── isExcused ─────────
describe('isExcused', () => {
  it('病假 / 事假 / 公假 視為准假', () => {
    expect(isExcused('sick')).toBe(true)
    expect(isExcused('personal')).toBe(true)
    expect(isExcused('official')).toBe(true)
  })
  it('無故缺席 / undefined 唔算准假', () => {
    expect(isExcused('unexcused')).toBe(false)
    expect(isExcused(undefined)).toBe(false)
  })
})

// ───────── 日期 key（本地時區，無 TZ off-by-one）─────────
describe('toKey / fromKey（本地日期，唔好漂去 UTC）', () => {
  it('roundtrip：邊界月日 + 跨年', () => {
    expect(toKey(fromKey('2026-05-04'))).toBe('2026-05-04')
    expect(toKey(fromKey('2026-01-01'))).toBe('2026-01-01')
    expect(toKey(fromKey('2026-12-31'))).toBe('2026-12-31')
  })
  it('fromKey 用本地 0 時區建構件（getFullYear/Month/Date 對得返）', () => {
    const d = fromKey('2026-03-09')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(2) // 0-indexed：3 月
    expect(d.getDate()).toBe(9)
  })
  it('toKey 直接由本地年月日組成，個位數補零', () => {
    // 用本地建構（年, 月-1, 日）避免 TZ 漂移；HK=UTC+8 都唔應該 off-by-one
    expect(toKey(new Date(2026, 0, 1, 12))).toBe('2026-01-01')
    expect(toKey(new Date(2026, 8, 7, 12))).toBe('2026-09-07')
    expect(toKey(new Date(2026, 11, 31, 12))).toBe('2026-12-31')
  })
  it('toKey 喺午夜都唔會跌返上一日（本地時區，非 toISOString）', () => {
    // 若用 toISOString，HK 午夜（UTC+8）會變成前一日 UTC → 呢度確認唔會
    expect(toKey(new Date(2026, 0, 1, 0, 0, 0))).toBe('2026-01-01')
  })
})

describe('weekdayOf / isWeekend', () => {
  it('已知星期（2026-05-04 = 星期一）', () => {
    expect(weekdayOf('2026-05-04')).toBe('一')
    expect(weekdayOf('2026-05-03')).toBe('日') // 星期日
    expect(weekdayOf('2026-05-09')).toBe('六') // 星期六
    expect(weekdayOf('2026-01-01')).toBe('四') // 星期四
  })
  it('isWeekend 只認星期六 / 日', () => {
    expect(isWeekend('2026-05-03')).toBe(true) // 日
    expect(isWeekend('2026-05-09')).toBe(true) // 六
    expect(isWeekend('2026-05-04')).toBe(false) // 一
    expect(isWeekend('2026-05-08')).toBe(false) // 五
  })
})

describe('longDateLabel / shortDateLabel', () => {
  it('long：M月D日（星期X）', () => {
    expect(longDateLabel('2026-05-04')).toBe('5月4日（星期一）')
    expect(longDateLabel('2026-12-31')).toBe('12月31日（星期四）')
  })
  it('short：M/D（無補零）', () => {
    expect(shortDateLabel('2026-05-04')).toBe('5/4')
    expect(shortDateLabel('2026-01-09')).toBe('1/9')
  })
})

describe('shiftKey（前後加減日，跨月 / 跨年 / 閏年）', () => {
  it('簡單加減', () => {
    expect(shiftKey('2026-05-10', 1)).toBe('2026-05-11')
    expect(shiftKey('2026-05-10', -1)).toBe('2026-05-09')
    expect(shiftKey('2026-05-10', 0)).toBe('2026-05-10')
  })
  it('跨月 / 跨年邊界', () => {
    expect(shiftKey('2026-05-31', 1)).toBe('2026-06-01')
    expect(shiftKey('2026-01-01', -1)).toBe('2025-12-31')
  })
  it('閏年 2 月：2024-02-28 + 1 = 02-29；非閏年 2026-03-01 - 1 = 02-28', () => {
    expect(shiftKey('2024-02-28', 1)).toBe('2024-02-29')
    expect(shiftKey('2026-03-01', -1)).toBe('2026-02-28')
  })
})

describe('monthDays（1 號到月尾）', () => {
  it('5 月（0-indexed month=4）= 31 日', () => {
    const days = monthDays(2026, 4)
    expect(days.length).toBe(31)
    expect(days[0]).toBe('2026-05-01')
    expect(days[30]).toBe('2026-05-31')
  })
  it('2026 年 2 月（非閏）= 28 日', () => {
    const days = monthDays(2026, 1)
    expect(days.length).toBe(28)
    expect(days[27]).toBe('2026-02-28')
  })
  it('2024 年 2 月（閏）= 29 日', () => {
    expect(monthDays(2024, 1).length).toBe(29)
  })
})

describe('recentDayKeys（由舊到新，含 anchor）', () => {
  it('n=3，anchor 固定 → 倒數 3 日', () => {
    expect(recentDayKeys(3, '2026-05-10')).toEqual([
      '2026-05-08',
      '2026-05-09',
      '2026-05-10',
    ])
  })
  it('n=1 → 只有 anchor 自己', () => {
    expect(recentDayKeys(1, '2026-05-10')).toEqual(['2026-05-10'])
  })
  it('n=0 → 空陣列', () => {
    expect(recentDayKeys(0, '2026-05-10')).toEqual([])
  })
  it('跨月邊界', () => {
    expect(recentDayKeys(2, '2026-06-01')).toEqual(['2026-05-31', '2026-06-01'])
  })
})

describe('monthLabel', () => {
  it('0-indexed month → 年月（+1）', () => {
    expect(monthLabel(2026, 0)).toBe('2026年1月')
    expect(monthLabel(2026, 11)).toBe('2026年12月')
  })
})

// ───────── countDay ─────────
describe('countDay（單日點名分佈 + 出席率）', () => {
  const mk = (entries: [string, AttendanceStatus][]) =>
    new Map<string, AttendanceStatus>(entries)

  it('空 Map + 0 人 → 全 0、rate null', () => {
    expect(countDay(new Map(), 0)).toEqual({
      present: 0,
      late: 0,
      absent: 0,
      unmarked: 0,
      total: 0,
      rate: null,
    })
  })
  it('全部未標記（0 marked）→ rate null、unmarked = total', () => {
    expect(countDay(new Map(), 5)).toEqual({
      present: 0,
      late: 0,
      absent: 0,
      unmarked: 5,
      total: 5,
      rate: null,
    })
  })
  it('present+late 算出席；absent 唔算（2 present,1 late,1 absent / marked 4 = 75%）', () => {
    const m = mk([
      ['a', 'present'],
      ['b', 'present'],
      ['c', 'late'],
      ['d', 'absent'],
    ])
    expect(countDay(m, 5)).toEqual({
      present: 2,
      late: 1,
      absent: 1,
      unmarked: 1,
      total: 5,
      rate: 75, // (2+1)/4 = 75
    })
  })
  it('rate 四捨五入（2 出席 / 3 marked = 66.67 → 67）', () => {
    const m = mk([
      ['a', 'present'],
      ['b', 'late'],
      ['c', 'absent'],
    ])
    expect(countDay(m, 3).rate).toBe(67)
  })
  it('marked 多過 totalStudents → unmarked 唔會負（夾 0）', () => {
    const m = mk([
      ['a', 'present'],
      ['b', 'present'],
      ['c', 'present'],
    ])
    const r = countDay(m, 2)
    expect(r.unmarked).toBe(0)
    expect(r.rate).toBe(100)
  })
})

// ───────── tallyByStudent ─────────
describe('tallyByStudent（逐生彙總 + 連續缺席）', () => {
  const rec = (
    studentId: string,
    date: string,
    status: AttendanceStatus,
  ): AttendanceRecord => ({ id: `${studentId}-${date}`, classId: 'c1', studentId, date, status })

  it('空 records / 空名單', () => {
    expect(tallyByStudent([], [], ['2026-05-01']).size).toBe(0)
    const out = tallyByStudent([], ['s1'], ['2026-05-01'])
    expect(out.get('s1')).toEqual({
      present: 0,
      late: 0,
      absent: 0,
      marked: 0,
      rate: null,
      currentAbsentStreak: 0,
    })
  })

  it('基本計數 + 出席率（present+late）/ marked', () => {
    const days = ['2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04']
    const records = [
      rec('s1', '2026-05-01', 'present'),
      rec('s1', '2026-05-02', 'late'),
      rec('s1', '2026-05-03', 'absent'),
      rec('s1', '2026-05-04', 'present'),
    ]
    const t = tallyByStudent(records, ['s1'], days).get('s1')!
    expect(t.present).toBe(2)
    expect(t.late).toBe(1)
    expect(t.absent).toBe(1)
    expect(t.marked).toBe(4)
    expect(t.rate).toBe(75) // (2+1)/4
  })

  it('連續缺席：由最新一日往前數，遇 present/late 即停', () => {
    const days = ['2026-05-01', '2026-05-02', '2026-05-03']
    // 最新 05-03 absent、05-02 absent、05-01 present → streak = 2
    const records = [
      rec('s1', '2026-05-01', 'present'),
      rec('s1', '2026-05-02', 'absent'),
      rec('s1', '2026-05-03', 'absent'),
    ]
    expect(tallyByStudent(records, ['s1'], days).get('s1')!.currentAbsentStreak).toBe(2)
  })

  it('連續缺席：未標記日（無記錄）跳過唔斷', () => {
    const days = ['2026-05-01', '2026-05-02', '2026-05-03']
    // 05-03 absent、05-02 無記錄（跳過）、05-01 absent → streak = 2
    const records = [
      rec('s1', '2026-05-01', 'absent'),
      rec('s1', '2026-05-03', 'absent'),
    ]
    expect(tallyByStudent(records, ['s1'], days).get('s1')!.currentAbsentStreak).toBe(2)
  })

  it('連續缺席：最新一日係 present → streak = 0（即使之前缺席）', () => {
    const days = ['2026-05-01', '2026-05-02']
    const records = [
      rec('s1', '2026-05-01', 'absent'),
      rec('s1', '2026-05-02', 'present'),
    ]
    expect(tallyByStudent(records, ['s1'], days).get('s1')!.currentAbsentStreak).toBe(0)
  })

  it('dayKeys 亂序傳入：streak 仍按真實日期次序計', () => {
    // 故意亂序；最新真實日 05-03 = absent，05-02 = absent，05-01 = present → 2
    const days = ['2026-05-02', '2026-05-01', '2026-05-03']
    const records = [
      rec('s1', '2026-05-01', 'present'),
      rec('s1', '2026-05-02', 'absent'),
      rec('s1', '2026-05-03', 'absent'),
    ]
    expect(tallyByStudent(records, ['s1'], days).get('s1')!.currentAbsentStreak).toBe(2)
  })

  it('範圍外嘅記錄唔計入（dayKeys 以外日子忽略）', () => {
    const days = ['2026-05-02', '2026-05-03']
    const records = [
      rec('s1', '2026-05-01', 'absent'), // 範圍外
      rec('s1', '2026-05-02', 'present'),
      rec('s1', '2026-05-03', 'present'),
    ]
    const t = tallyByStudent(records, ['s1'], days).get('s1')!
    expect(t.marked).toBe(2)
    expect(t.present).toBe(2)
    expect(t.currentAbsentStreak).toBe(0)
  })
})

// ───────── rateTone / rateBarTone ─────────
describe('rateTone（出席率 → 色調）', () => {
  it('null → slate', () => expect(rateTone(null)).toBe('slate'))
  it('邊界值', () => {
    expect(rateTone(95)).toBe('green')
    expect(rateTone(94)).toBe('accent')
    expect(rateTone(90)).toBe('accent')
    expect(rateTone(89)).toBe('amber')
    expect(rateTone(80)).toBe('amber')
    expect(rateTone(79)).toBe('rose')
    expect(rateTone(0)).toBe('rose')
  })
})

describe('rateBarTone（null fallback accent）', () => {
  it('null → accent（非 slate）', () => expect(rateBarTone(null)).toBe('accent'))
  it('邊界值', () => {
    expect(rateBarTone(95)).toBe('green')
    expect(rateBarTone(90)).toBe('accent')
    expect(rateBarTone(80)).toBe('amber')
    expect(rateBarTone(79)).toBe('rose')
  })
})
