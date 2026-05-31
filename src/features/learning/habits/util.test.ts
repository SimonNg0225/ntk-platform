import { describe, it, expect } from 'vitest'
import {
  toKey,
  fromKey,
  addDays,
  addDaysKey,
  weekdayOf,
  recentDays,
  longDateLabel,
  daysBetween,
  logsByHabit,
  heatLevel,
  buildHeatGrid,
  monthMatrix,
  pct,
} from './util'
import type { HabitLog } from './types'

// 固定本地時間 12:00 起點 helper（同模組內部一致，避開 DST/午夜漂移）
const localNoon = (y: number, m1: number, d: number) => new Date(y, m1 - 1, d, 12, 0, 0, 0)

describe('toKey（本地時區 YYYY-MM-DD，非 UTC）', () => {
  it('用本地日期欄位組 key', () => {
    expect(toKey(localNoon(2026, 5, 4))).toBe('2026-05-04')
    expect(toKey(localNoon(2026, 1, 1))).toBe('2026-01-01')
    expect(toKey(localNoon(2026, 12, 31))).toBe('2026-12-31')
  })

  it('月 / 日補零', () => {
    expect(toKey(localNoon(2026, 3, 7))).toBe('2026-03-07')
    expect(toKey(localNoon(2026, 9, 9))).toBe('2026-09-09')
  })

  it('時區邊界：午夜 00:00 仍回當地日期（非前一日 UTC）', () => {
    // 在 UTC+8（Asia/Hong_Kong）00:00 對應 UTC 前一日 16:00。
    // 若誤用 toISOString 會變 off-by-one；本地 getDate 必須回當地日。
    expect(toKey(new Date(2026, 0, 1, 0, 0, 0, 0))).toBe('2026-01-01')
    expect(toKey(new Date(2026, 11, 31, 0, 0, 0, 0))).toBe('2026-12-31')
  })

  it('時區邊界：深夜 23:59 仍回當地日期（非後一日 UTC）', () => {
    expect(toKey(new Date(2026, 4, 4, 23, 59, 0, 0))).toBe('2026-05-04')
  })
})

describe('fromKey（解析回本地正午 Date）', () => {
  it('roundtrip toKey∘fromKey 不漂移（含年首 / 年尾）', () => {
    expect(toKey(fromKey('2026-05-04'))).toBe('2026-05-04')
    expect(toKey(fromKey('2026-01-01'))).toBe('2026-01-01')
    expect(toKey(fromKey('2026-12-31'))).toBe('2026-12-31')
    expect(toKey(fromKey('2024-02-29'))).toBe('2024-02-29') // 閏日
  })

  it('錨定在 12:00（避免 DST / 午夜漂移）', () => {
    const d = fromKey('2026-05-04')
    expect(d.getHours()).toBe(12)
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(4) // 0-indexed：5月
    expect(d.getDate()).toBe(4)
  })
})

describe('weekdayOf', () => {
  it('回本地星期（0=日 … 6=六）', () => {
    expect(weekdayOf('2026-05-04')).toBe(1) // 星期一
    expect(weekdayOf('2026-05-01')).toBe(5) // 星期五
    expect(weekdayOf('2026-05-03')).toBe(0) // 星期日
    expect(weekdayOf('2026-05-09')).toBe(6) // 星期六
  })
})

describe('addDays', () => {
  it('正數加日，跨月正確', () => {
    expect(toKey(addDays(localNoon(2026, 4, 30), 1))).toBe('2026-05-01')
  })

  it('負數減日，跨月正確', () => {
    expect(toKey(addDays(localNoon(2026, 5, 1), -1))).toBe('2026-04-30')
  })

  it('0 日保持不變', () => {
    expect(toKey(addDays(localNoon(2026, 5, 4), 0))).toBe('2026-05-04')
  })

  it('跨年（+1 / -1）', () => {
    expect(toKey(addDays(localNoon(2026, 12, 31), 1))).toBe('2027-01-01')
    expect(toKey(addDays(localNoon(2026, 1, 1), -1))).toBe('2025-12-31')
  })

  it('大跨度（+365）跨整年', () => {
    // 2026 非閏年 → +365 落 2027-01-01
    expect(toKey(addDays(localNoon(2026, 1, 1), 365))).toBe('2027-01-01')
  })
})

describe('addDaysKey', () => {
  it('key→key 位移（含 0 / 負數 / 跨月）', () => {
    expect(addDaysKey('2026-05-04', 0)).toBe('2026-05-04')
    expect(addDaysKey('2026-05-04', 3)).toBe('2026-05-07')
    expect(addDaysKey('2026-05-01', -1)).toBe('2026-04-30')
    expect(addDaysKey('2025-12-31', 1)).toBe('2026-01-01')
  })

  it('閏日附近（2024-02-28 → +1 = 02-29）', () => {
    expect(addDaysKey('2024-02-28', 1)).toBe('2024-02-29')
    expect(addDaysKey('2024-02-29', 1)).toBe('2024-03-01')
  })
})

describe('recentDays（傳明確 anchor → deterministic）', () => {
  it('由舊到新、含 anchor 當日', () => {
    expect(recentDays(3, localNoon(2026, 5, 4))).toEqual([
      '2026-05-02',
      '2026-05-03',
      '2026-05-04',
    ])
  })

  it('n=1 只回 anchor 當日', () => {
    expect(recentDays(1, localNoon(2026, 5, 4))).toEqual(['2026-05-04'])
  })

  it('n=0 回空陣列（邊界）', () => {
    expect(recentDays(0, localNoon(2026, 5, 4))).toEqual([])
  })

  it('跨月回溯', () => {
    expect(recentDays(3, localNoon(2026, 5, 2))).toEqual([
      '2026-04-30',
      '2026-05-01',
      '2026-05-02',
    ])
  })
})

describe('longDateLabel', () => {
  it('組「M月D日（星期X）」', () => {
    expect(longDateLabel('2026-05-04')).toBe('5月4日（星期一）')
    expect(longDateLabel('2026-05-03')).toBe('5月3日（星期日）')
    expect(longDateLabel('2026-12-31')).toBe('12月31日（星期四）')
  })
})

describe('daysBetween（b - a）', () => {
  it('正向 / 反向 / 同日', () => {
    expect(daysBetween('2026-05-01', '2026-05-04')).toBe(3)
    expect(daysBetween('2026-05-04', '2026-05-01')).toBe(-3)
    expect(daysBetween('2026-05-04', '2026-05-04')).toBe(0)
  })

  it('跨年 / 跨閏月（noon 錨定避免漂移）', () => {
    expect(daysBetween('2025-12-31', '2026-01-01')).toBe(1)
    expect(daysBetween('2024-02-28', '2024-03-01')).toBe(2) // 含 2/29
    expect(daysBetween('2023-02-28', '2023-03-01')).toBe(1) // 平年
  })
})

describe('logsByHabit（分組 → Map<habitId, Set<date>>）', () => {
  const log = (habitId: string, date: string): HabitLog => ({ id: `${habitId}-${date}`, habitId, date })

  it('空陣列 → 空 Map（邊界）', () => {
    const m = logsByHabit([])
    expect(m.size).toBe(0)
  })

  it('同習慣多日歸入同一 Set', () => {
    const m = logsByHabit([log('h1', '2026-05-01'), log('h1', '2026-05-02')])
    expect(m.size).toBe(1)
    expect(m.get('h1')).toEqual(new Set(['2026-05-01', '2026-05-02']))
  })

  it('多習慣分開歸組', () => {
    const m = logsByHabit([log('h1', '2026-05-01'), log('h2', '2026-05-01'), log('h2', '2026-05-03')])
    expect(m.get('h1')).toEqual(new Set(['2026-05-01']))
    expect(m.get('h2')).toEqual(new Set(['2026-05-01', '2026-05-03']))
  })

  it('重複（同習慣同日）去重', () => {
    const m = logsByHabit([log('h1', '2026-05-01'), log('h1', '2026-05-01')])
    expect(m.get('h1')?.size).toBe(1)
  })
})

describe('heatLevel（完成密度 0-4 級）', () => {
  const set = (...keys: string[]) => new Set(keys)

  it('當日未完成 → 0', () => {
    expect(heatLevel(set('2026-05-01'), '2026-05-02')).toBe(0)
  })

  it('空集合 → 0', () => {
    expect(heatLevel(new Set<string>(), '2026-05-02')).toBe(0)
  })

  it('密度 1-2 日 → 級 1', () => {
    expect(heatLevel(set('2026-05-10'), '2026-05-10')).toBe(1) // 只當日（around=1）
    expect(heatLevel(set('2026-05-09', '2026-05-10'), '2026-05-10')).toBe(1) // around=2
  })

  it('密度 3-4 日 → 級 2', () => {
    expect(heatLevel(set('2026-05-08', '2026-05-09', '2026-05-10'), '2026-05-10')).toBe(2)
    expect(
      heatLevel(set('2026-05-07', '2026-05-08', '2026-05-09', '2026-05-10'), '2026-05-10'),
    ).toBe(2)
  })

  it('密度 5-6 日 → 級 3', () => {
    expect(
      heatLevel(
        set('2026-05-06', '2026-05-07', '2026-05-08', '2026-05-09', '2026-05-10'),
        '2026-05-10',
      ),
    ).toBe(3)
  })

  it('連續 7 日（含當日）→ 級 4（最深）', () => {
    expect(
      heatLevel(
        set(
          '2026-05-04',
          '2026-05-05',
          '2026-05-06',
          '2026-05-07',
          '2026-05-08',
          '2026-05-09',
          '2026-05-10',
        ),
        '2026-05-10',
      ),
    ).toBe(4)
  })

  it('窗外（>6 日前）唔計入密度', () => {
    // 當日 + 7 日前（窗外，i 只到 6）→ around=1 → 級 1
    expect(heatLevel(set('2026-05-10', '2026-05-03'), '2026-05-10')).toBe(1)
  })
})

describe('buildHeatGrid（GitHub 式：列=星期，欄=週）', () => {
  it('單欄：由 endKey 那週六向前對齊週日起，7 格', () => {
    const g = buildHeatGrid('2026-05-04', 1) // 週一
    expect(g.weeks).toHaveLength(1)
    expect(g.weeks[0].map((c) => c.key)).toEqual([
      '2026-05-03', // 週日
      '2026-05-04',
      '2026-05-05',
      '2026-05-06',
      '2026-05-07',
      '2026-05-08',
      '2026-05-09', // 週六
    ])
  })

  it('inRange：> endKey 嘅未來格為 false', () => {
    const g = buildHeatGrid('2026-05-04', 1)
    const byKey = Object.fromEntries(g.weeks[0].map((c) => [c.key, c.inRange]))
    expect(byKey['2026-05-03']).toBe(true)
    expect(byKey['2026-05-04']).toBe(true) // 等於 end → 含
    expect(byKey['2026-05-05']).toBe(false)
    expect(byKey['2026-05-09']).toBe(false)
  })

  it('每欄 7 格、共 weeks 欄', () => {
    const g = buildHeatGrid('2026-01-15', 2)
    expect(g.weeks).toHaveLength(2)
    g.weeks.forEach((col) => expect(col).toHaveLength(7))
    // 末格 = endKey 那週六（2026-01-17）
    expect(g.weeks[1][6].key).toBe('2026-01-17')
    // 首格 = 向前 2 週嘅週日（2026-01-04）
    expect(g.weeks[0][0].key).toBe('2026-01-04')
  })

  it('monthMarks：同月只標一次（首欄）', () => {
    const g = buildHeatGrid('2026-01-15', 2) // 全部喺 1月
    expect(g.monthMarks).toEqual([{ col: 0, label: '1月' }])
  })

  it('monthMarks：跨月時標出新月份欄位', () => {
    // 由 2026-02-07（週六）向前 3 欄 → 涵蓋 1月尾 + 2月
    const g = buildHeatGrid('2026-02-07', 3)
    // 首欄週日
    expect(g.weeks[0][0].key).toBe('2026-01-18')
    // 2月第一個週日落喺第 3 欄（index 2）：01-18, 01-25, 02-01
    expect(g.weeks[2][0].key).toBe('2026-02-01')
    expect(g.monthMarks).toEqual([
      { col: 0, label: '1月' },
      { col: 2, label: '2月' },
    ])
  })
})

describe('monthMatrix（單月 6×7 = 42 格）', () => {
  it('長度永遠 42', () => {
    expect(monthMatrix(2026, 4)).toHaveLength(42)
    expect(monthMatrix(2026, 1)).toHaveLength(42)
  })

  it('5月 2026：由 4/26（週日）起，含 5/1，尾到 6/6', () => {
    const cells = monthMatrix(2026, 4).map(toKey)
    expect(cells[0]).toBe('2026-04-26') // 5/1 是週五 → 回補到上個週日
    expect(cells[5]).toBe('2026-05-01')
    expect(cells[41]).toBe('2026-06-06')
  })

  it('首格永遠係週日', () => {
    expect(monthMatrix(2026, 4)[0].getDay()).toBe(0)
    expect(monthMatrix(2026, 11)[0].getDay()).toBe(0)
  })

  it('1月：回補到上一年 12月（跨年邊界）', () => {
    const cells = monthMatrix(2026, 0).map(toKey)
    expect(cells[0]).toBe('2025-12-28') // 1/1/2026 是週四
    expect(cells[4]).toBe('2026-01-01')
  })

  it('12月：尾段溢出到下一年（跨年邊界）', () => {
    const cells = monthMatrix(2026, 11).map(toKey)
    expect(cells[0]).toBe('2026-11-29') // 12/1/2026 是週二
    expect(cells[41]).toBe('2027-01-09')
  })
})

describe('pct（四捨五入 + %）', () => {
  it('整數 / 四捨五入', () => {
    expect(pct(0)).toBe('0%')
    expect(pct(100)).toBe('100%')
    expect(pct(66.4)).toBe('66%')
    expect(pct(66.5)).toBe('67%')
  })

  it('負數', () => {
    expect(pct(-3.2)).toBe('-3%')
  })
})
