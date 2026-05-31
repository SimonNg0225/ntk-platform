import { describe, it, expect } from 'vitest'
import {
  toKey,
  fromKey,
  addDays,
  addDaysKey,
  startOfWeek,
  weekKeys,
  monthMatrix,
  minutesOf,
  hourLabel,
} from './util'

// ============================================================
//  toKey — Date → 本地時區 YYYY-MM-DD（避 toISOString UTC 漂移）
// ============================================================
describe('toKey', () => {
  it('月 / 日補零（個位數 padStart）', () => {
    expect(toKey(new Date(2026, 0, 5, 12))).toBe('2026-01-05')
    expect(toKey(new Date(2026, 8, 9, 12))).toBe('2026-09-09')
  })

  it('month+1（getMonth 0-indexed）', () => {
    expect(toKey(new Date(2026, 11, 25, 12))).toBe('2026-12-25')
  })

  it('12 月 31 日 / 1 月 1 日', () => {
    expect(toKey(new Date(2026, 11, 31, 12))).toBe('2026-12-31')
    expect(toKey(new Date(2026, 0, 1, 12))).toBe('2026-01-01')
  })

  it('用本地分量，唔受時段影響（午夜 vs 中午同一日）', () => {
    expect(toKey(new Date(2026, 4, 4, 0, 0, 0))).toBe('2026-05-04')
    expect(toKey(new Date(2026, 4, 4, 23, 59, 59))).toBe('2026-05-04')
  })
})

// ============================================================
//  fromKey — key → 本地 Date（錨定中午 12:00）
// ============================================================
describe('fromKey', () => {
  it('解析年月日，錨定中午', () => {
    const d = fromKey('2026-05-04')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(4) // 0-indexed
    expect(d.getDate()).toBe(4)
    expect(d.getHours()).toBe(12)
  })

  it('閏年 2/29', () => {
    const d = fromKey('2024-02-29')
    expect(d.getMonth()).toBe(1)
    expect(d.getDate()).toBe(29)
  })

  it('缺失月 / 日分量 fallback 1', () => {
    // 只有年份 → m ?? 1 → 1 月，d ?? 1 → 1 號
    const d = fromKey('2026')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(0)
    expect(d.getDate()).toBe(1)
  })

  it('toKey/fromKey roundtrip（多個日期）', () => {
    for (const k of ['2026-01-01', '2026-02-28', '2024-02-29', '2026-12-31']) {
      expect(toKey(fromKey(k))).toBe(k)
    }
  })
})

// ============================================================
//  addDays — 本地加 N 日（中午錨定避 DST 漂移）
// ============================================================
describe('addDays', () => {
  it('n=0 → 同一日', () => {
    expect(toKey(addDays(fromKey('2026-05-04'), 0))).toBe('2026-05-04')
  })

  it('正數跨月（month 進位）', () => {
    expect(toKey(addDays(fromKey('2026-05-30'), 5))).toBe('2026-06-04')
  })

  it('負數跨月', () => {
    expect(toKey(addDays(fromKey('2026-05-03'), -5))).toBe('2026-04-28')
  })

  it('跨年（12 月底 + N → 下年）', () => {
    expect(toKey(addDays(fromKey('2026-12-30'), 5))).toBe('2027-01-04')
  })

  it('跨閏年 2 月底', () => {
    // 2024 閏年：2/28 + 1 = 2/29
    expect(toKey(addDays(fromKey('2024-02-28'), 1))).toBe('2024-02-29')
    // 平年 2026：2/28 + 1 = 3/01
    expect(toKey(addDays(fromKey('2026-02-28'), 1))).toBe('2026-03-01')
  })

  it('中午錨定：加日後仍係中午（日數正確，無 DST 漂移）', () => {
    const d = addDays(fromKey('2026-03-08'), 1) // 美國 DST 切換附近
    expect(d.getHours()).toBe(12)
    expect(toKey(d)).toBe('2026-03-09')
  })
})

// ============================================================
//  addDaysKey — key → key 加 N 日
// ============================================================
describe('addDaysKey', () => {
  it('跨月', () => {
    expect(addDaysKey('2026-05-30', 5)).toBe('2026-06-04')
  })

  it('跨年', () => {
    expect(addDaysKey('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('負數', () => {
    expect(addDaysKey('2026-01-01', -1)).toBe('2025-12-31')
  })

  it('roundtrip 同 addDays 一致', () => {
    expect(addDaysKey('2026-05-04', 10)).toBe(toKey(addDays(fromKey('2026-05-04'), 10)))
  })
})

// ============================================================
//  startOfWeek — 某日所屬週嘅星期日
// ============================================================
describe('startOfWeek', () => {
  it('輸入本身就係星期日（位移 0）', () => {
    // 2026-05-03 係星期日
    expect(toKey(startOfWeek(fromKey('2026-05-03')))).toBe('2026-05-03')
  })

  it('輸入星期六（位移 -6）', () => {
    // 2026-05-09 係星期六 → 該週日 5/03
    expect(toKey(startOfWeek(fromKey('2026-05-09')))).toBe('2026-05-03')
  })

  it('輸入星期一', () => {
    // 2026-05-04 星期一 → 週日 5/03
    expect(toKey(startOfWeek(fromKey('2026-05-04')))).toBe('2026-05-03')
  })

  it('跨月（週日喺上月）', () => {
    // 2026-05-01 星期五 → 週日 2026-04-26
    expect(toKey(startOfWeek(fromKey('2026-05-01')))).toBe('2026-04-26')
  })

  it('跨年（週日喺上年）', () => {
    // 2027-01-01 星期五 → 週日 2026-12-27
    expect(toKey(startOfWeek(fromKey('2027-01-01')))).toBe('2026-12-27')
  })
})

// ============================================================
//  weekKeys — 某日所屬一週嘅 7 個 key（日→六）
// ============================================================
describe('weekKeys', () => {
  it('正好 7 個 key 且連續（日→六）', () => {
    const ks = weekKeys(fromKey('2026-05-06')) // 星期三
    expect(ks).toEqual([
      '2026-05-03',
      '2026-05-04',
      '2026-05-05',
      '2026-05-06',
      '2026-05-07',
      '2026-05-08',
      '2026-05-09',
    ])
  })

  it('跨月週（前幾日上月、後幾日今月）', () => {
    // 5/01 星期五 → 週由 4/26（日）到 5/02（六）
    const ks = weekKeys(fromKey('2026-05-01'))
    expect(ks).toHaveLength(7)
    expect(ks[0]).toBe('2026-04-26')
    expect(ks[6]).toBe('2026-05-02')
  })

  it('跨年週（12 月底 → 1 月初）', () => {
    // 2027-01-01 星期五 → 週由 2026-12-27 到 2027-01-02
    const ks = weekKeys(fromKey('2027-01-01'))
    expect(ks[0]).toBe('2026-12-27')
    expect(ks[6]).toBe('2027-01-02')
  })
})

// ============================================================
//  monthMatrix — 某年某月 6×7=42 格（由 1 號嗰個星期日起）
// ============================================================
describe('monthMatrix', () => {
  it('永遠正好 42 格', () => {
    expect(monthMatrix(2026, 0)).toHaveLength(42)
    expect(monthMatrix(2026, 4)).toHaveLength(42)
    expect(monthMatrix(2024, 1)).toHaveLength(42)
  })

  it('month 0-indexed（month=0 係一月）', () => {
    const cells = monthMatrix(2026, 0)
    // 2026-01-01 係星期四 → 前面補 4 格（12/28 日起）
    expect(toKey(cells[0])).toBe('2025-12-28') // 星期日
    expect(cells.some((c) => toKey(c) === '2026-01-01')).toBe(true)
  })

  it('1 號就係星期日（無前置補格，start = 1 號）', () => {
    // 2026-03-01 係星期日
    const cells = monthMatrix(2026, 2)
    expect(toKey(cells[0])).toBe('2026-03-01')
  })

  it('1 號係星期六（前面補 6 格上月）', () => {
    // 2026-08-01 係星期六 → 起點 = 7/26（日）
    const cells = monthMatrix(2026, 7)
    expect(toKey(cells[0])).toBe('2026-07-26')
    expect(toKey(cells[6])).toBe('2026-08-01')
  })

  it('二月平年（2026 = 28 日）', () => {
    const cells = monthMatrix(2026, 1)
    const febDays = cells.filter((c) => c.getMonth() === 1).map((c) => c.getDate())
    expect(Math.max(...febDays)).toBe(28)
  })

  it('二月閏年（2024 = 29 日）', () => {
    const cells = monthMatrix(2024, 1)
    const febDays = cells.filter((c) => c.getMonth() === 1).map((c) => c.getDate())
    expect(Math.max(...febDays)).toBe(29)
  })

  it('12 月（month=11，下月跨年到下年一月補格）', () => {
    const cells = monthMatrix(2026, 11)
    expect(cells).toHaveLength(42)
    // 含 12/31，且尾段有 2027 年 1 月補格
    expect(cells.some((c) => toKey(c) === '2026-12-31')).toBe(true)
    expect(cells.some((c) => c.getFullYear() === 2027 && c.getMonth() === 0)).toBe(true)
  })
})

// ============================================================
//  minutesOf — HH:mm → 由午夜起分鐘數
// ============================================================
describe('minutesOf', () => {
  it('undefined → 0', () => expect(minutesOf(undefined)).toBe(0))
  it('空字串 → 0', () => expect(minutesOf('')).toBe(0))
  it('00:00 → 0', () => expect(minutesOf('00:00')).toBe(0))
  it('09:30 → 570', () => expect(minutesOf('09:30')).toBe(570))
  it('23:59 → 1439', () => expect(minutesOf('23:59')).toBe(1439))
  it('缺分鐘分量容錯（"09" → h||0 用 9，m||0 用 0）', () => {
    expect(minutesOf('09')).toBe(540)
  })
})

// ============================================================
//  hourLabel — 0-23 → 中文 12 小時制
// ============================================================
describe('hourLabel', () => {
  it('0 → 凌晨 12', () => expect(hourLabel(0)).toBe('凌晨 12'))
  it('11 → 上午 11（邊界）', () => expect(hourLabel(11)).toBe('上午 11'))
  it('12 → 中午 12', () => expect(hourLabel(12)).toBe('中午 12'))
  it('13 → 下午 1（h-12）', () => expect(hourLabel(13)).toBe('下午 1'))
  it('23 → 下午 11', () => expect(hourLabel(23)).toBe('下午 11'))
  it('1 → 上午 1', () => expect(hourLabel(1)).toBe('上午 1'))
})
