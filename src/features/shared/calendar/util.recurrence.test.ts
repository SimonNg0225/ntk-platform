import { describe, it, expect } from 'vitest'
import {
  expandOccurrences,
  getOccurrences,
  recurrenceLabel,
  sortOccurrences,
  indexByDate,
  isAllDay,
  type Occurrence,
} from './util'
import type {
  CalendarEvent,
  CalendarCategory,
  RecurrenceRule,
} from '../../../data/types'

const ev = (over: Partial<CalendarEvent>): CalendarEvent => ({
  id: 'e',
  title: 't',
  date: '2026-05-04', // 星期一
  ...over,
})

const cat = (over: Partial<CalendarCategory>): CalendarCategory => ({
  id: 'c',
  name: '行事曆',
  color: 'blue',
  visible: true,
  createdAt: '2026-01-01',
  ...over,
})

const occ = (over: Partial<CalendarEvent>, dateKey: string): Occurrence => ({
  event: ev(over),
  dateKey,
})

// ============================================================
//  expandOccurrences — 重複展開核心引擎
// ============================================================
describe('expandOccurrences — 無重複 / freq none', () => {
  it('無 recurrence：淨返自己嗰日（喺窗口內）', () => {
    expect(
      expandOccurrences(ev({ date: '2026-05-04' }), '2026-05-01', '2026-05-31'),
    ).toEqual(['2026-05-04'])
  })

  it("freq='none'：當作不重複，淨返自己嗰日", () => {
    expect(
      expandOccurrences(
        ev({ date: '2026-05-04', recurrence: { freq: 'none' } }),
        '2026-05-01',
        '2026-05-31',
      ),
    ).toEqual(['2026-05-04'])
  })

  it('事件 date 喺窗口前：returns []', () => {
    expect(
      expandOccurrences(ev({ date: '2026-04-30' }), '2026-05-01', '2026-05-31'),
    ).toEqual([])
  })

  it('事件 date 喺窗口後：returns []', () => {
    expect(
      expandOccurrences(ev({ date: '2026-06-01' }), '2026-05-01', '2026-05-31'),
    ).toEqual([])
  })

  it('事件 date 啱啱喺窗口邊界（含頭含尾）', () => {
    expect(
      expandOccurrences(ev({ date: '2026-05-01' }), '2026-05-01', '2026-05-31'),
    ).toEqual(['2026-05-01'])
    expect(
      expandOccurrences(ev({ date: '2026-05-31' }), '2026-05-01', '2026-05-31'),
    ).toEqual(['2026-05-31'])
  })

  it('無重複 + 自己嗰日喺 exDates：跳過', () => {
    expect(
      expandOccurrences(
        ev({ date: '2026-05-04', exDates: ['2026-05-04'] }),
        '2026-05-01',
        '2026-05-31',
      ),
    ).toEqual([])
  })
})

describe('expandOccurrences — daily', () => {
  it('每日（interval 預設 1）', () => {
    expect(
      expandOccurrences(
        ev({ date: '2026-05-01', recurrence: { freq: 'daily' } }),
        '2026-05-01',
        '2026-05-04',
      ),
    ).toEqual(['2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04'])
  })

  it('每 N 日（interval=3）', () => {
    expect(
      expandOccurrences(
        ev({ date: '2026-05-01', recurrence: { freq: 'daily', interval: 3 } }),
        '2026-05-01',
        '2026-05-10',
      ),
    ).toEqual(['2026-05-01', '2026-05-04', '2026-05-07', '2026-05-10'])
  })

  it('interval=0 正規化為 1（Math.max(1,...)）', () => {
    expect(
      expandOccurrences(
        ev({ date: '2026-05-01', recurrence: { freq: 'daily', interval: 0 } }),
        '2026-05-01',
        '2026-05-03',
      ),
    ).toEqual(['2026-05-01', '2026-05-02', '2026-05-03'])
  })

  it('interval 負數正規化為 1', () => {
    expect(
      expandOccurrences(
        ev({ date: '2026-05-01', recurrence: { freq: 'daily', interval: -5 } }),
        '2026-05-01',
        '2026-05-03',
      ),
    ).toEqual(['2026-05-01', '2026-05-02', '2026-05-03'])
  })

  it('窗口只覆蓋系列中段（事件由更早開始）', () => {
    // 由 5/1 每日，窗口 5/05–5/07：只返窗口內嗰幾日
    expect(
      expandOccurrences(
        ev({ date: '2026-05-01', recurrence: { freq: 'daily' } }),
        '2026-05-05',
        '2026-05-07',
      ),
    ).toEqual(['2026-05-05', '2026-05-06', '2026-05-07'])
  })

  it('跨年（12/31 daily 去到下年）', () => {
    expect(
      expandOccurrences(
        ev({ date: '2026-12-31', recurrence: { freq: 'daily' } }),
        '2026-12-31',
        '2027-01-02',
      ),
    ).toEqual(['2026-12-31', '2027-01-01', '2027-01-02'])
  })
})

describe('expandOccurrences — count（series 位置計，非窗口內數量）', () => {
  it('count=3：總共 3 次', () => {
    expect(
      expandOccurrences(
        ev({ date: '2026-05-01', recurrence: { freq: 'daily', count: 3 } }),
        '2026-05-01',
        '2026-05-31',
      ),
    ).toEqual(['2026-05-01', '2026-05-02', '2026-05-03'])
  })

  it('count cap 計埋窗口外嘅 occurrence：窗口由第 3 日先開始，第 3 次後就停', () => {
    // 由 5/1 每日 count=4 → series = 5/1,5/2,5/3,5/4。
    // 窗口 5/3–5/31：count 由 series 位置數（5/1、5/2 都食咗 cap），
    // 所以窗口內只見 5/3、5/4（唔係 5/3..5/6）。
    expect(
      expandOccurrences(
        ev({ date: '2026-05-01', recurrence: { freq: 'daily', count: 4 } }),
        '2026-05-03',
        '2026-05-31',
      ),
    ).toEqual(['2026-05-03', '2026-05-04'])
  })

  it('exDates 命中時 occurrence 跳過但 count 照計', () => {
    // count=3 → series 5/1,5/2,5/3；5/2 喺 exDates → 仍只到 5/3（唔會補多一次）
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
})

describe('expandOccurrences — until（inclusive）', () => {
  it('until 等於某日：嗰日要保留（key>until 先 stop）', () => {
    expect(
      expandOccurrences(
        ev({ date: '2026-05-01', recurrence: { freq: 'daily', until: '2026-05-03' } }),
        '2026-05-01',
        '2026-05-31',
      ),
    ).toEqual(['2026-05-01', '2026-05-02', '2026-05-03'])
  })

  it('until 喺窗口尾之前：以 until 為界', () => {
    expect(
      expandOccurrences(
        ev({ date: '2026-05-01', recurrence: { freq: 'daily', until: '2026-05-02' } }),
        '2026-05-01',
        '2026-05-31',
      ),
    ).toEqual(['2026-05-01', '2026-05-02'])
  })
})

describe('expandOccurrences — weekly + byWeekday', () => {
  it('逢一三五（interval=1）', () => {
    // 5/04 係星期一
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

  it('第一週跳過 seriesStart 之前嗰啲選中日', () => {
    // series 由星期三 5/06 開始，byWeekday=[1,3,5]（一三五）
    // 第一週嘅星期一 5/04 喺 seriesStart 之前 → 唔出，由 5/06 起
    expect(
      expandOccurrences(
        ev({
          date: '2026-05-06', // 星期三
          recurrence: { freq: 'weekly', interval: 1, byWeekday: [1, 3, 5] },
        }),
        '2026-05-04',
        '2026-05-12',
      ),
    ).toEqual(['2026-05-06', '2026-05-08', '2026-05-11'])
  })

  it('series 開始日唔係選中星期幾（開始日本身唔出現）', () => {
    // series 由星期一 5/04 開始，但 byWeekday=[2,4]（二、四）
    // 5/04 唔喺選中集 → 由 5/05(二)、5/07(四) 起
    expect(
      expandOccurrences(
        ev({
          date: '2026-05-04', // 星期一
          recurrence: { freq: 'weekly', interval: 1, byWeekday: [2, 4] },
        }),
        '2026-05-04',
        '2026-05-10',
      ),
    ).toEqual(['2026-05-05', '2026-05-07'])
  })

  it('每 2 週逢一（中間嗰週跳過）', () => {
    expect(
      expandOccurrences(
        ev({
          date: '2026-05-04', // 星期一
          recurrence: { freq: 'weekly', interval: 2, byWeekday: [1] },
        }),
        '2026-05-01',
        '2026-06-01',
      ),
    ).toEqual(['2026-05-04', '2026-05-18', '2026-06-01'])
  })

  it('byWeekday 加 count（跨多週數夠次數就停）', () => {
    // 逢一三，count=4 → 5/04(一),5/06(三),5/11(一),5/13(三)
    expect(
      expandOccurrences(
        ev({
          date: '2026-05-04',
          recurrence: { freq: 'weekly', interval: 1, byWeekday: [1, 3], count: 4 },
        }),
        '2026-05-01',
        '2026-05-31',
      ),
    ).toEqual(['2026-05-04', '2026-05-06', '2026-05-11', '2026-05-13'])
  })

  it('byWeekday 去重 + 排序（亂序輸入照樣升序）', () => {
    expect(
      expandOccurrences(
        ev({
          date: '2026-05-04',
          recurrence: { freq: 'weekly', interval: 1, byWeekday: [5, 1, 3, 1] },
        }),
        '2026-05-04',
        '2026-05-10',
      ),
    ).toEqual(['2026-05-04', '2026-05-06', '2026-05-08'])
  })
})

describe('expandOccurrences — monthly / yearly clamp（bug #1 揭發 + 修正後行為）', () => {
  it('每月 15 號（正常，無溢出）', () => {
    expect(
      expandOccurrences(
        ev({ date: '2026-01-15', recurrence: { freq: 'monthly', count: 3 } }),
        '2026-01-01',
        '2026-12-31',
      ),
    ).toEqual(['2026-01-15', '2026-02-15', '2026-03-15'])
  })

  // ── bug #1 (high)：由 1/31 開始嘅每月，舊 code 會永久漂移去每月 3 號 ──
  // 舊行為（錯）：1/31, 3/03, 4/03, 5/03, 6/03（2 月被吞、之後變 3 號）
  // 正確行為：clamp 返當月最後一日，且保留 31 作基準
  it('每月 31 號：跨短月 clamp 到月尾，唔漂移（bug #1）', () => {
    expect(
      expandOccurrences(
        ev({ date: '2026-01-31', recurrence: { freq: 'monthly', count: 6 } }),
        '2026-01-01',
        '2026-12-31',
      ),
    ).toEqual([
      '2026-01-31',
      '2026-02-28', // 2026 平年
      '2026-03-31',
      '2026-04-30',
      '2026-05-31',
      '2026-06-30',
    ])
  })

  it('每月 30 號：2 月 clamp 到 28，3 月返 30（保留基準）', () => {
    expect(
      expandOccurrences(
        ev({ date: '2026-01-30', recurrence: { freq: 'monthly', count: 4 } }),
        '2026-01-01',
        '2026-12-31',
      ),
    ).toEqual(['2026-01-30', '2026-02-28', '2026-03-30', '2026-04-30'])
  })

  it('每月 31 號到閏年 2 月 → clamp 到 29', () => {
    // 2024 係閏年
    expect(
      expandOccurrences(
        ev({ date: '2024-01-31', recurrence: { freq: 'monthly', count: 2 } }),
        '2024-01-01',
        '2024-12-31',
      ),
    ).toEqual(['2024-01-31', '2024-02-29'])
  })

  it('每 2 個月 31 號（interval=2，跨月仍以 31 為基準）', () => {
    expect(
      expandOccurrences(
        ev({ date: '2026-01-31', recurrence: { freq: 'monthly', interval: 2, count: 3 } }),
        '2026-01-01',
        '2026-12-31',
      ),
    ).toEqual(['2026-01-31', '2026-03-31', '2026-05-31'])
  })

  it('每月 31 號跨年（12/31 → 下年 1/31、2 月 clamp）', () => {
    expect(
      expandOccurrences(
        ev({ date: '2026-12-31', recurrence: { freq: 'monthly', count: 3 } }),
        '2026-12-01',
        '2027-12-31',
      ),
    ).toEqual(['2026-12-31', '2027-01-31', '2027-02-28'])
  })

  it('每年 1/15（正常）', () => {
    expect(
      expandOccurrences(
        ev({ date: '2026-01-15', recurrence: { freq: 'yearly', count: 3 } }),
        '2026-01-01',
        '2028-12-31',
      ),
    ).toEqual(['2026-01-15', '2027-01-15', '2028-01-15'])
  })

  // ── bug #1 (high)：由閏日 2/29 開始嘅每年，舊 code 會永久變每年 3/1 ──
  // 舊行為（錯）：2024-02-29, 2025-03-01, 2026-03-01, 2027-03-01
  // 正確行為：非閏年 clamp 到 2/28，唔變 3/1
  it('每年 2/29（閏日起）：非閏年 clamp 到 2/28，唔變 3/1（bug #1）', () => {
    expect(
      expandOccurrences(
        ev({ date: '2024-02-29', recurrence: { freq: 'yearly', count: 4 } }),
        '2024-01-01',
        '2027-12-31',
      ),
    ).toEqual(['2024-02-29', '2025-02-28', '2026-02-28', '2027-02-28'])
  })
})

describe('expandOccurrences — guard / 無界系列', () => {
  it('無 until / 無 count + 闊窗口：受 3000 guard 上限保護（唔當機）', () => {
    // 每日由 2000-01-01，窗口去到 2026：用 guard 截斷，唔會無限。
    // 只斷言：有回傳、係陣列、且最後一個 <= endKey。
    const out = expandOccurrences(
      ev({ date: '2000-01-01', recurrence: { freq: 'daily' } }),
      '2025-01-01',
      '2025-12-31',
    )
    expect(Array.isArray(out)).toBe(true)
    // 2000-01-01 起每日，3000 日 guard 大約到 2008，故 2025 窗口會落空
    expect(out).toEqual([])
  })

  it('guard 內嘅長序列照常展開（窗口貼近開始）', () => {
    const out = expandOccurrences(
      ev({ date: '2026-01-01', recurrence: { freq: 'daily' } }),
      '2026-01-01',
      '2026-01-05',
    )
    expect(out).toEqual([
      '2026-01-01',
      '2026-01-02',
      '2026-01-03',
      '2026-01-04',
      '2026-01-05',
    ])
  })
})

// ============================================================
//  recurrenceLabel — 中文標籤
// ============================================================
describe('recurrenceLabel', () => {
  it('undefined → 不重複', () => {
    expect(recurrenceLabel(undefined)).toBe('不重複')
  })

  it("freq='none' → 不重複", () => {
    expect(recurrenceLabel({ freq: 'none' })).toBe('不重複')
  })

  it('interval=1：每日 / 每週 / 每個月 / 每年', () => {
    expect(recurrenceLabel({ freq: 'daily' })).toBe('每日')
    expect(recurrenceLabel({ freq: 'weekly' })).toBe('每週')
    expect(recurrenceLabel({ freq: 'monthly' })).toBe('每個月')
    expect(recurrenceLabel({ freq: 'yearly' })).toBe('每年')
  })

  it('interval>1：每 N X', () => {
    expect(recurrenceLabel({ freq: 'daily', interval: 3 })).toBe('每 3 日')
    expect(recurrenceLabel({ freq: 'weekly', interval: 2 })).toBe('每 2 週')
    expect(recurrenceLabel({ freq: 'monthly', interval: 6 })).toBe('每 6 個月')
    expect(recurrenceLabel({ freq: 'yearly', interval: 2 })).toBe('每 2 年')
  })

  it('interval 缺失或 <1 正規化為 1（每X，唔顯示數字）', () => {
    expect(recurrenceLabel({ freq: 'daily', interval: 0 })).toBe('每日')
    expect(recurrenceLabel({ freq: 'weekly', interval: -3 })).toBe('每週')
  })

  it('weekly byWeekday：排序後拼星期名', () => {
    // [5,1,3] → 排序 1,3,5 → 一三五
    expect(recurrenceLabel({ freq: 'weekly', byWeekday: [5, 1, 3] })).toBe('每週 一三五')
  })

  it('weekly interval>1 + byWeekday', () => {
    expect(recurrenceLabel({ freq: 'weekly', interval: 2, byWeekday: [0, 6] })).toBe(
      '每 2 週 日六',
    )
  })

  it('until 優先於 count 顯示（until 行先）', () => {
    const rule: RecurrenceRule = {
      freq: 'daily',
      until: '2026-12-31',
      count: 10,
    }
    expect(recurrenceLabel(rule)).toBe('每日，至 2026-12-31')
  })

  it('只有 count：共 N 次', () => {
    expect(recurrenceLabel({ freq: 'daily', count: 5 })).toBe('每日，共 5 次')
  })

  it('weekly byWeekday + count', () => {
    expect(
      recurrenceLabel({ freq: 'weekly', byWeekday: [1, 3, 5], count: 8 }),
    ).toBe('每週 一三五，共 8 次')
  })
})

// ============================================================
//  getOccurrences — 跨 events 展開 + 過濾隱藏行事曆
// ============================================================
describe('getOccurrences', () => {
  it('空 events → []', () => {
    expect(getOccurrences([], [cat({})], '2026-05-01', '2026-05-31')).toEqual([])
  })

  it('展開單一事件並附 category', () => {
    const events = [ev({ id: 'e1', date: '2026-05-04', calendarId: 'c' })]
    const out = getOccurrences(events, [cat({ id: 'c' })], '2026-05-01', '2026-05-31')
    expect(out).toHaveLength(1)
    expect(out[0].dateKey).toBe('2026-05-04')
    expect(out[0].event.id).toBe('e1')
    expect(out[0].category?.id).toBe('c')
  })

  it('cat.visible=false → 整個事件跳過', () => {
    const events = [ev({ id: 'e1', date: '2026-05-04', calendarId: 'c' })]
    const out = getOccurrences(
      events,
      [cat({ id: 'c', visible: false })],
      '2026-05-01',
      '2026-05-31',
    )
    expect(out).toEqual([])
  })

  it('事件 calendarId 指向唔存在嘅 cat → cat=undefined，照展開', () => {
    const events = [ev({ id: 'e1', date: '2026-05-04', calendarId: 'ghost' })]
    const out = getOccurrences(events, [cat({ id: 'c' })], '2026-05-01', '2026-05-31')
    expect(out).toHaveLength(1)
    expect(out[0].category).toBeUndefined()
  })

  it('事件無 calendarId → cat=undefined，照展開', () => {
    const events = [ev({ id: 'e1', date: '2026-05-04' })]
    const out = getOccurrences(events, [cat({ id: 'c' })], '2026-05-01', '2026-05-31')
    expect(out).toHaveLength(1)
    expect(out[0].category).toBeUndefined()
  })

  it('多事件 + 重複展開（總 occurrence 數正確）', () => {
    const events = [
      ev({ id: 'e1', date: '2026-05-01', recurrence: { freq: 'daily', count: 3 } }),
      ev({ id: 'e2', date: '2026-05-10' }),
    ]
    const out = getOccurrences(events, [], '2026-05-01', '2026-05-31')
    expect(out).toHaveLength(4) // 3 + 1
  })
})

// ============================================================
//  isAllDay / sortOccurrences / indexByDate
// ============================================================
describe('isAllDay', () => {
  it('allDay=true → true（即使有 time）', () => {
    expect(isAllDay(ev({ allDay: true, time: '09:00' }))).toBe(true)
  })

  it('allDay=false 但冇 time → true（視為全日）', () => {
    expect(isAllDay(ev({ allDay: false }))).toBe(true)
  })

  it('allDay undefined 有 time → false（非全日）', () => {
    expect(isAllDay(ev({ time: '09:00' }))).toBe(false)
  })
})

describe('sortOccurrences', () => {
  it('全日排定時前面', () => {
    const allDay = occ({ allDay: true }, '2026-05-04')
    const timed = occ({ time: '09:00' }, '2026-05-04')
    expect(sortOccurrences(allDay, timed)).toBe(-1)
    expect(sortOccurrences(timed, allDay)).toBe(1)
  })

  it('兩個定時：按 time localeCompare', () => {
    const a = occ({ time: '09:00' }, '2026-05-04')
    const b = occ({ time: '14:00' }, '2026-05-04')
    expect(sortOccurrences(a, b)).toBeLessThan(0)
    expect(sortOccurrences(b, a)).toBeGreaterThan(0)
  })

  it('相同 time → 0（穩定）', () => {
    const a = occ({ id: 'a', time: '09:00' }, '2026-05-04')
    const b = occ({ id: 'b', time: '09:00' }, '2026-05-04')
    expect(sortOccurrences(a, b)).toBe(0)
  })

  it('兩個全日（time undefined → 空字串比較 → 0）', () => {
    const a = occ({ id: 'a', allDay: true }, '2026-05-04')
    const b = occ({ id: 'b', allDay: true }, '2026-05-04')
    expect(sortOccurrences(a, b)).toBe(0)
  })
})

describe('indexByDate', () => {
  it('空輸入 → 空 Map', () => {
    const m = indexByDate([])
    expect(m.size).toBe(0)
  })

  it('單一 occurrence', () => {
    const m = indexByDate([occ({ id: 'e1', time: '09:00' }, '2026-05-04')])
    expect(m.size).toBe(1)
    expect(m.get('2026-05-04')).toHaveLength(1)
  })

  it('同一 dateKey 多個 occurrence：聚合且按 sortOccurrences 排序', () => {
    const m = indexByDate([
      occ({ id: 'timed', time: '14:00' }, '2026-05-04'),
      occ({ id: 'allday', allDay: true }, '2026-05-04'),
      occ({ id: 'early', time: '08:00' }, '2026-05-04'),
    ])
    const list = m.get('2026-05-04')!
    expect(list.map((o) => o.event.id)).toEqual(['allday', 'early', 'timed'])
  })

  it('多個 dateKey 各自分組', () => {
    const m = indexByDate([
      occ({ id: 'e1' }, '2026-05-04'),
      occ({ id: 'e2' }, '2026-05-05'),
    ])
    expect(m.size).toBe(2)
    expect(m.get('2026-05-04')).toHaveLength(1)
    expect(m.get('2026-05-05')).toHaveLength(1)
  })
})
