import { describe, it, expect } from 'vitest'
import {
  dayLabel,
  dayShort,
  weekCycleLabel,
  weeksOverlap,
  lessonPeriods,
  bellByPeriod,
  minutesOf,
  durationMin,
  fmtDuration,
  colorOf,
  autoColorFor,
  slotKey,
  detectConflicts,
  computeWorkload,
  jsDayToTimetable,
  findUpNext,
  buildCsv,
  SLOT_COLORS,
  SLOT_COLOR_KEYS,
  DEFAULT_BELLS,
  type BellRow,
  type SlotMeta,
} from './util'
import type { TimetableSlot } from '../../../data/types'

// ───────── helpers ─────────
const slot = (over: Partial<TimetableSlot>): TimetableSlot => ({
  id: 's',
  day: 1,
  period: 1,
  subject: '數學',
  ...over,
})

const lesson = (period: number, start: string, end: string): BellRow => ({
  period,
  kind: 'lesson',
  label: `第 ${period} 節`,
  start,
  end,
})

describe('星期 dayLabel / dayShort', () => {
  it('已知星期回正確中文', () => {
    expect(dayLabel(1)).toBe('星期一')
    expect(dayLabel(6)).toBe('星期六')
    expect(dayShort(1)).toBe('一')
    expect(dayShort(6)).toBe('六')
  })
  it('未知星期 fallback', () => {
    expect(dayLabel(7)).toBe('星期7')
    expect(dayShort(0)).toBe('0')
  })
})

describe('循環週 weekCycleLabel / weeksOverlap', () => {
  it('weekCycleLabel', () => {
    expect(weekCycleLabel('A')).toBe('A 週')
    expect(weekCycleLabel('B')).toBe('B 週')
    expect(weekCycleLabel('all')).toBe('每週')
    expect(weekCycleLabel(undefined)).toBe('每週')
  })
  it('weeksOverlap：all 同任何重疊', () => {
    expect(weeksOverlap('all', 'A')).toBe(true)
    expect(weeksOverlap('A', 'all')).toBe(true)
    expect(weeksOverlap(undefined, 'B')).toBe(true) // undefined → all
    expect(weeksOverlap('A', undefined)).toBe(true)
  })
  it('weeksOverlap：同週重疊、異週唔重疊', () => {
    expect(weeksOverlap('A', 'A')).toBe(true)
    expect(weeksOverlap('B', 'B')).toBe(true)
    expect(weeksOverlap('A', 'B')).toBe(false)
    expect(weeksOverlap('B', 'A')).toBe(false)
  })
})

describe('鐘聲 lessonPeriods / bellByPeriod', () => {
  it('lessonPeriods 只取 lesson（跳過小息/午膳 period 0）', () => {
    expect(lessonPeriods(DEFAULT_BELLS)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })
  it('lessonPeriods 空陣列', () => {
    expect(lessonPeriods([])).toEqual([])
  })
  it('bellByPeriod 只 map lesson，唔含 period 0', () => {
    const m = bellByPeriod(DEFAULT_BELLS)
    expect(m.size).toBe(8)
    expect(m.has(0)).toBe(false) // 小息/午膳唔入 map
    expect(m.get(1)?.start).toBe('08:15')
    expect(m.get(8)?.end).toBe('15:00')
  })
})

describe('時間 minutesOf', () => {
  it('正常 HH:mm', () => {
    expect(minutesOf('00:00')).toBe(0)
    expect(minutesOf('08:15')).toBe(8 * 60 + 15) // 495
    expect(minutesOf('15:00')).toBe(15 * 60) // 900
    expect(minutesOf('23:59')).toBe(23 * 60 + 59) // 1439
  })
  it('空 / undefined → 0（唔好 NaN）', () => {
    expect(minutesOf(undefined)).toBe(0)
    expect(minutesOf('')).toBe(0)
  })
  it('無冒號 / 亂值唔好 NaN', () => {
    expect(minutesOf('8')).toBe(480) // h=8, m 缺 → 0
    expect(minutesOf('aa:bb')).toBe(0) // NaN guard → 0
  })
})

describe('durationMin', () => {
  it('正常時段分鐘數', () => {
    expect(durationMin(lesson(1, '08:15', '08:55'))).toBe(40)
    expect(durationMin(lesson(6, '13:00', '13:40'))).toBe(40)
  })
  it('end 早過 start → clamp 0（唔好負數）', () => {
    expect(durationMin(lesson(1, '10:00', '09:00'))).toBe(0)
  })
  it('零長度', () => {
    expect(durationMin(lesson(1, '08:15', '08:15'))).toBe(0)
  })
})

describe('fmtDuration', () => {
  it('純分鐘', () => {
    expect(fmtDuration(0)).toBe('0 分')
    expect(fmtDuration(40)).toBe('40 分')
    expect(fmtDuration(59)).toBe('59 分')
  })
  it('整點小時（無餘分）', () => {
    expect(fmtDuration(60)).toBe('1 小時')
    expect(fmtDuration(120)).toBe('2 小時')
  })
  it('小時 + 分', () => {
    expect(fmtDuration(65)).toBe('1 小時 5 分')
    expect(fmtDuration(135)).toBe('2 小時 15 分')
  })
})

describe('顏色 colorOf / autoColorFor', () => {
  it('colorOf 已知 key', () => {
    expect(colorOf('blue')).toBe(SLOT_COLORS.blue)
    expect(colorOf('rose')).toBe(SLOT_COLORS.rose)
  })
  it('colorOf 未知 / undefined → accent', () => {
    expect(colorOf(undefined)).toBe(SLOT_COLORS.accent)
    expect(colorOf('not-a-color')).toBe(SLOT_COLORS.accent)
  })
  it('autoColorFor 穩定（同 key 永遠同色）+ 回合法 key', () => {
    const a = autoColorFor('數學')
    const b = autoColorFor('數學')
    expect(a).toBe(b)
    expect(SLOT_COLOR_KEYS).toContain(a)
  })
  it('autoColorFor 空字串 deterministic → 第一個 key (accent)', () => {
    // 空字串：迴圈唔行，h=0，index 0 = 'accent'
    expect(autoColorFor('')).toBe('accent')
  })
  it('autoColorFor 已知 hash（手算）', () => {
    // 'A' charCode 65 → 65 % 8 = 1 → SLOT_COLOR_KEYS[1] = 'blue'
    expect(autoColorFor('A')).toBe('blue')
    // 'B' charCode 66 → 66 % 8 = 2 → SLOT_COLOR_KEYS[2] = 'green'
    expect(autoColorFor('B')).toBe('green')
  })
})

describe('slotKey', () => {
  it('day-period 格式', () => {
    expect(slotKey(1, 1)).toBe('1-1')
    expect(slotKey(6, 8)).toBe('6-8')
  })
})

describe('jsDayToTimetable', () => {
  it('一至六一致，星期日(0)→0', () => {
    expect(jsDayToTimetable(1)).toBe(1) // 一
    expect(jsDayToTimetable(6)).toBe(6) // 六
    expect(jsDayToTimetable(0)).toBe(0) // 日 → 無堂
  })
})

describe('detectConflicts 撞堂偵測', () => {
  const noMeta = new Map<string, SlotMeta>()

  it('無重複格 → 無衝突', () => {
    const slots = [
      slot({ id: 'a', day: 1, period: 1, classId: 'c1', room: 'R1' }),
      slot({ id: 'b', day: 1, period: 2, classId: 'c1', room: 'R1' }),
    ]
    expect(detectConflicts(slots, noMeta)).toEqual([])
  })

  it('空輸入 → 無衝突', () => {
    expect(detectConflicts([], noMeta)).toEqual([])
  })

  it('同格同班 → class 衝突', () => {
    const slots = [
      slot({ id: 'a', day: 2, period: 3, classId: 'c1' }),
      slot({ id: 'b', day: 2, period: 3, classId: 'c1' }),
    ]
    const out = detectConflicts(slots, noMeta)
    expect(out).toHaveLength(1)
    expect(out[0]).toEqual({
      kind: 'class',
      day: 2,
      period: 3,
      value: 'c1',
      slotKeys: ['2-3'],
    })
  })

  it('同格同室 → room 衝突', () => {
    const slots = [
      slot({ id: 'a', day: 1, period: 1, room: 'Lab1', classId: 'c1' }),
      slot({ id: 'b', day: 1, period: 1, room: 'Lab1', classId: 'c2' }),
    ]
    const out = detectConflicts(slots, noMeta)
    // 班別唔同（c1/c2）→ 無 class 衝突；但同室 → room 衝突
    expect(out).toEqual([
      { kind: 'room', day: 1, period: 1, value: 'Lab1', slotKeys: ['1-1'] },
    ])
  })

  it('同格但週唔重疊（A vs B）→ 無衝突（因同格共用一個 meta，week 相同則重疊）', () => {
    // 此資料模型每格只有一個 meta（key=day-period），故同格兩 slot 共用 week。
    // 設為 'A'：weeksOverlap('A','A')=true → 仍衝突
    const meta = new Map<string, SlotMeta>([['1-1', { id: '1-1', week: 'A' }]])
    const slots = [
      slot({ id: 'a', day: 1, period: 1, classId: 'c1' }),
      slot({ id: 'b', day: 1, period: 1, classId: 'c1' }),
    ]
    const out = detectConflicts(slots, meta)
    expect(out).toHaveLength(1)
    expect(out[0].kind).toBe('class')
  })
})

describe('computeWorkload 工作量統計', () => {
  const bells = DEFAULT_BELLS // lesson periods 1..8，每節 40 分（除第 6 由午膳後）
  const days = [1, 2, 3, 4, 5, 6]
  const classNames = new Map<string, string>([
    ['c1', '中一甲'],
    ['c2', '中二乙'],
  ])

  it('空 slots：全 0、無 busiestDay、free = 全部節數', () => {
    const w = computeWorkload([], bells, days, classNames)
    expect(w.total).toBe(0)
    expect(w.totalMinutes).toBe(0)
    expect(w.busiestDay).toBeUndefined()
    expect(w.maxConsecutive).toBe(0)
    expect(w.daysWithLessons).toBe(0)
    expect(w.byDay).toEqual(days.map((day) => ({ day, count: 0 })))
    // 8 個 lesson period 全空堂
    expect(w.freeByDay[0]).toEqual({ day: 1, busy: 0, free: 8 })
    expect(w.byClass).toEqual([])
  })

  it('總數 / 每日 / 分鐘 / busiestDay', () => {
    // 星期一 3 堂 (P1,P2,P3)，星期二 1 堂 (P1) → total 4
    const slots = [
      slot({ id: 'a', day: 1, period: 1, classId: 'c1' }),
      slot({ id: 'b', day: 1, period: 2, classId: 'c1' }),
      slot({ id: 'c', day: 1, period: 3, classId: 'c2' }),
      slot({ id: 'd', day: 2, period: 1, classId: 'c2' }),
    ]
    const w = computeWorkload(slots, bells, days, classNames)
    expect(w.total).toBe(4)
    // 每堂 40 分 × 4 = 160
    expect(w.totalMinutes).toBe(160)
    // 星期一 3 堂為最忙
    expect(w.busiestDay).toEqual({ day: 1, count: 3 })
    expect(w.byDay.find((d) => d.day === 1)?.count).toBe(3)
    expect(w.byDay.find((d) => d.day === 2)?.count).toBe(1)
    expect(w.byDay.find((d) => d.day === 3)?.count).toBe(0)
    expect(w.daysWithLessons).toBe(2)
  })

  it('byClass：含未指定班別 + 已刪班別，依 count 降序', () => {
    const slots = [
      slot({ id: 'a', day: 1, period: 1, classId: 'c1' }),
      slot({ id: 'b', day: 1, period: 2, classId: 'c1' }),
      slot({ id: 'c', day: 1, period: 3 }), // 無 classId
      slot({ id: 'd', day: 2, period: 1, classId: 'gone' }), // 已刪
    ]
    const w = computeWorkload(slots, bells, days, classNames)
    // c1=2、未指定=1、已刪=1 → 第一個係 c1
    expect(w.byClass[0]).toEqual({ classId: 'c1', label: '中一甲', count: 2 })
    const none = w.byClass.find((x) => x.classId === undefined)
    expect(none?.label).toBe('未指定班別')
    expect(none?.count).toBe(1)
    const gone = w.byClass.find((x) => x.classId === 'gone')
    expect(gone?.label).toBe('已刪班別')
  })

  it('maxConsecutive：連堂計到最長，遇空堂重設', () => {
    // P3,P4,P5 係同一個 block（中間冇小息/午膳）連 3 堂 → 最長 = 3
    // P7,P8 另一段連 2；P6 空堂令 P5→P6→P7 唔接埋一齊
    const slots = [
      slot({ id: 'c', day: 1, period: 3 }),
      slot({ id: 'd', day: 1, period: 4 }),
      slot({ id: 'e', day: 1, period: 5 }),
      slot({ id: 'g', day: 1, period: 7 }),
      slot({ id: 'h', day: 1, period: 8 }),
    ]
    const w = computeWorkload(slots, bells, days, classNames)
    expect(w.maxConsecutive).toBe(3)
  })

  it('freeByDay：busy + free = lesson period 總數', () => {
    const slots = [
      slot({ id: 'a', day: 3, period: 1 }),
      slot({ id: 'b', day: 3, period: 2 }),
    ]
    const w = computeWorkload(slots, bells, days, classNames)
    const d3 = w.freeByDay.find((x) => x.day === 3)!
    expect(d3.busy).toBe(2)
    expect(d3.free).toBe(6) // 8 - 2
    expect(d3.busy + d3.free).toBe(8)
  })

  it('byPeriod：跨日同節合計', () => {
    const slots = [
      slot({ id: 'a', day: 1, period: 1 }),
      slot({ id: 'b', day: 2, period: 1 }),
      slot({ id: 'c', day: 3, period: 1 }),
      slot({ id: 'd', day: 1, period: 4 }),
    ]
    const w = computeWorkload(slots, bells, days, classNames)
    expect(w.byPeriod.find((p) => p.period === 1)?.count).toBe(3)
    expect(w.byPeriod.find((p) => p.period === 4)?.count).toBe(1)
    expect(w.byPeriod.find((p) => p.period === 8)?.count).toBe(0)
  })

  it('maxConsecutive：連堂唔可以跨日累計', () => {
    // 星期一尾兩節 (P7,P8) + 星期二頭兩節 (P1,P2)：各日 2 連，唔可以變 4
    const slots = [
      slot({ id: 'a', day: 1, period: 7 }),
      slot({ id: 'b', day: 1, period: 8 }),
      slot({ id: 'c', day: 2, period: 1 }),
      slot({ id: 'd', day: 2, period: 2 }),
    ]
    const w = computeWorkload(slots, bells, days, classNames)
    expect(w.maxConsecutive).toBe(2)
  })

  it('只計一節：totalMinutes = 該節長度（非 lesson period 唔加分鐘）', () => {
    // period 1 (40 分) + period 99（唔喺鐘聲，無對應 bell）→ minutes 只計 40
    const slots = [
      slot({ id: 'a', day: 1, period: 1 }),
      slot({ id: 'b', day: 1, period: 99 }),
    ]
    const w = computeWorkload(slots, bells, days, classNames)
    expect(w.total).toBe(2) // 兩條 slot 都計入總數
    expect(w.totalMinutes).toBe(40) // 但 period 99 無對應鐘聲 → 唔加分鐘
  })
})

describe('findUpNext 下一堂 / 現正上緊', () => {
  const bells = DEFAULT_BELLS
  // 星期一：P1 08:15-08:55, P3 09:55-10:35
  const slots = [
    slot({ id: 'a', day: 1, period: 1, subject: '中文' }),
    slot({ id: 'b', day: 1, period: 3, subject: '數學' }),
    slot({ id: 'x', day: 2, period: 1, subject: '英文' }), // 其他日
  ]

  it('現正上緊（now，startsInMin 0）', () => {
    // 08:30 = 510 分，落喺 P1 (495-535)
    const r = findUpNext(slots, bells, 1, 510)
    expect(r?.status).toBe('now')
    expect(r?.startsInMin).toBe(0)
    expect(r?.slot.period).toBe(1)
  })

  it('下一堂 soon（15 分內）', () => {
    // 09:45 = 585。P1 已過(<535)，P3 start 09:55=595。diff = 595-585 = 10 ≤ 15 → soon
    const r = findUpNext(slots, bells, 1, 585)
    expect(r?.status).toBe('soon')
    expect(r?.startsInMin).toBe(10)
    expect(r?.slot.period).toBe(3)
  })

  it('下一堂 later（>15 分）', () => {
    // 09:00 = 540。下一堂 P3 595。diff = 55 > 15 → later
    const r = findUpNext(slots, bells, 1, 540)
    expect(r?.status).toBe('later')
    expect(r?.startsInMin).toBe(55)
    expect(r?.slot.period).toBe(3)
  })

  it('全部堂已過 → undefined', () => {
    // 16:00 = 960，P3 end 10:35=635，全過
    expect(findUpNext(slots, bells, 1, 960)).toBeUndefined()
  })

  it('當日無堂 → undefined', () => {
    expect(findUpNext(slots, bells, 5, 480)).toBeUndefined()
  })

  it('開課邊界：剛好 start 一刻 = now', () => {
    // P1 start 08:15 = 495
    const r = findUpNext(slots, bells, 1, 495)
    expect(r?.status).toBe('now')
    expect(r?.slot.period).toBe(1)
  })

  it('剛好 end 一刻：唔再算 now（exclusive end）', () => {
    // P1 end 08:55 = 535。唔喺 P1（exclusive），下一堂 P3 595 → later (diff 60)
    const r = findUpNext(slots, bells, 1, 535)
    expect(r?.status).toBe('later')
    expect(r?.slot.period).toBe(3)
    expect(r?.startsInMin).toBe(60)
  })
})

describe('buildCsv 匯出', () => {
  const bells = DEFAULT_BELLS
  const days = [1, 2, 3, 4, 5, 6]
  const classNames = new Map<string, string>([['c1', '中一甲']])

  it('表頭 + 排序（先 day 後 period）', () => {
    const slots = [
      slot({ id: 'b', day: 1, period: 3, subject: '數學', classId: 'c1', room: 'R1' }),
      slot({ id: 'a', day: 1, period: 1, subject: '中文', classId: 'c1', room: 'R2' }),
    ]
    const meta = new Map<string, SlotMeta>([
      ['1-1', { id: '1-1', week: 'A', note: '備課' }],
    ])
    const csv = buildCsv(slots, bells, days, classNames, meta)
    const lines = csv.split('\n')
    expect(lines[0]).toBe('星期,節數,時間,科目,班別,課室,循環週,備註')
    // 排序後 P1 在 P3 之前
    expect(lines[1]).toBe('星期一,第 1 節,08:15-08:55,中文,中一甲,R2,A 週,備課')
    expect(lines[2]).toBe('星期一,第 3 節,09:55-10:35,數學,中一甲,R1,每週,')
    expect(lines).toHaveLength(3)
  })

  it('過濾唔喺 days 範圍嘅 slot', () => {
    const slots = [slot({ id: 'a', day: 6, period: 1, subject: '體育' })]
    const csv = buildCsv(slots, bells, [1, 2, 3, 4, 5], classNames, new Map())
    // 星期六唔喺範圍 → 只剩表頭
    expect(csv.split('\n')).toHaveLength(1)
  })

  it('CSV escape：逗號 / 引號 / 換行要包引號', () => {
    const slots = [
      slot({ id: 'a', day: 1, period: 1, subject: '數學, 進階', room: 'A"B', classId: 'c1' }),
    ]
    const meta = new Map<string, SlotMeta>([
      ['1-1', { id: '1-1', note: '行1\n行2' }],
    ])
    const csv = buildCsv(slots, bells, [1], classNames, meta)
    const line = csv.split('\n').slice(1).join('\n') // 含換行，唔可以單純 split
    expect(line).toContain('"數學, 進階"') // 逗號 → 包引號
    expect(line).toContain('"A""B"') // 引號 → 雙寫 + 包引號
    expect(line).toContain('"行1\n行2"') // 換行 → 包引號
  })

  it('空 slots → 只有表頭', () => {
    const csv = buildCsv([], bells, days, classNames, new Map())
    expect(csv).toBe('星期,節數,時間,科目,班別,課室,循環週,備註')
  })
})
