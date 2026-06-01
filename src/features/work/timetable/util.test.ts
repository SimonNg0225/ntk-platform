import { describe, it, expect } from 'vitest'
import {
  dayLabel,
  dayShort,
  cycleLabel,
  cycleShort,
  cycleDayForDate,
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
  clampApplyDays,
  detectConflicts,
  computeWorkload,
  computeFreePeriods,
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

describe('日循環 cycleLabel / cycleShort', () => {
  it('day 1..6 → Day A..F（cycle 模式標籤）', () => {
    expect(cycleLabel(1)).toBe('Day A')
    expect(cycleLabel(2)).toBe('Day B')
    expect(cycleLabel(6)).toBe('Day F')
    expect(cycleShort(1)).toBe('A')
    expect(cycleShort(2)).toBe('B')
    expect(cycleShort(6)).toBe('F')
  })
  it('cycle 標籤同星期標籤截然不同（WorkloadView 回歸保護）', () => {
    // cycle 模式唔可以顯示成「星期X / 二三…」，否則 NTK 老師會睇錯日子
    expect(cycleShort(2)).not.toBe(dayShort(2))
    expect(cycleLabel(2)).not.toBe(dayLabel(2))
  })
  it('超範圍 fallback', () => {
    expect(cycleShort(7)).toBe('7')
    expect(cycleLabel(7)).toBe('Day 7')
  })
})

describe('cycleDayForDate 校曆查日期 → cycle day', () => {
  // 由日期(YYYY-MM-DD)經校曆映射到 cycle day(1..6)，直接決定 Timetable / WorkDashboard
  // 嘅「今日堂」顯示。命中回 cycleDay；假期/未排（搵唔到）回 null。
  const cal = [
    { date: '2026-05-04', cycleDay: 3 },
    { date: '2026-05-05', cycleDay: 4 },
    { date: '2026-05-06', cycleDay: 5 },
  ]

  it('命中：日期喺校曆 → 回對應 cycle day', () => {
    expect(cycleDayForDate('2026-05-04', cal)).toBe(3)
    expect(cycleDayForDate('2026-05-05', cal)).toBe(4)
    expect(cycleDayForDate('2026-05-06', cal)).toBe(5)
  })

  it('搵唔到：日期唔喺校曆（假期/未排日）→ 回 null', () => {
    // 5-04 同 5-05 之間若係週末/假期，根本唔會喺校曆 → 唔應該揀錯某日課堂
    expect(cycleDayForDate('2026-05-07', cal)).toBeNull()
    expect(cycleDayForDate('2026-12-25', cal)).toBeNull()
  })

  it('空校曆 [] → 一律 null（未匯入校曆時唔會誤揀）', () => {
    expect(cycleDayForDate('2026-05-04', [])).toBeNull()
  })

  it('重複日期：find 命中首見嗰條（取第一筆相符）', () => {
    const dup = [
      { date: '2026-05-04', cycleDay: 3 },
      { date: '2026-05-04', cycleDay: 6 }, // 後來重複，應被忽略
    ]
    expect(cycleDayForDate('2026-05-04', dup)).toBe(3)
  })

  it('cycleDay 為 0 都要原樣回 0（唔好被當 falsy 誤回 null）', () => {
    // 0 係 falsy，若 code 用 `e?.cycleDay || null` 會錯回 null；此 case 守護返
    const zero = [{ date: '2026-05-04', cycleDay: 0 }]
    expect(cycleDayForDate('2026-05-04', zero)).toBe(0)
    expect(cycleDayForDate('2026-05-04', zero)).not.toBeNull()
  })

  it('日期 key 必須完全相符（唔做模糊/前綴比對）', () => {
    // 防止 '2026-05-0' 之類部分字串誤命中 '2026-05-04'
    expect(cycleDayForDate('2026-05-0', cal)).toBeNull()
    expect(cycleDayForDate('2026-05-040', cal)).toBeNull()
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

describe('computeFreePeriods 空堂時段查詢', () => {
  const bells = DEFAULT_BELLS // P1 P2 [小息] P3 P4 P5 [午膳] P6 P7 P8
  const days = [1, 2, 3, 4, 5, 6]

  it('全空：每日按 break 切成 3 段（P1-2 / P3-5 / P6-8）', () => {
    const segs = computeFreePeriods([], bells, [1])
    expect(segs).toHaveLength(3)
    expect(segs[0]).toEqual({
      day: 1,
      periods: [1, 2],
      start: '08:15',
      end: '09:35',
      minutes: 80,
    })
    expect(segs[1].periods).toEqual([3, 4, 5])
    expect(segs[2].periods).toEqual([6, 7, 8])
  })

  it('題述示例：星期三 P3,P4 空 → 一段 09:55–11:15 連續 2 節', () => {
    // 三填滿 P1,P2,P5,P6,P7,P8（只剩 P3,P4 空），其餘日全填以隔離
    const filled: TimetableSlot[] = []
    for (const day of days) {
      for (const p of [1, 2, 3, 4, 5, 6, 7, 8]) {
        if (day === 3 && (p === 3 || p === 4)) continue
        filled.push(slot({ id: `${day}-${p}`, day, period: p }))
      }
    }
    const segs = computeFreePeriods(filled, bells, days)
    expect(segs).toHaveLength(1)
    expect(segs[0]).toEqual({
      day: 3,
      periods: [3, 4],
      start: '09:55',
      end: '11:15',
      minutes: 80,
    })
  })

  it('有堂嘅節會打斷連續空檔（P3 上緊 → P1-2 同 P4-5 分兩段）', () => {
    // 自訂無 break 鐘聲，淨睇「有堂」斷段
    const b = [
      lesson(1, '09:00', '09:40'),
      lesson(2, '09:40', '10:20'),
      lesson(3, '10:20', '11:00'),
      lesson(4, '11:00', '11:40'),
      lesson(5, '11:40', '12:20'),
    ]
    const slots = [slot({ id: 'a', day: 2, period: 3 })] // 只 P3 有堂
    const segs = computeFreePeriods(slots, b, [2])
    expect(segs).toHaveLength(2)
    expect(segs[0]).toEqual({
      day: 2,
      periods: [1, 2],
      start: '09:00',
      end: '10:20',
      minutes: 80,
    })
    expect(segs[1]).toEqual({
      day: 2,
      periods: [4, 5],
      start: '11:00',
      end: '12:20',
      minutes: 80,
    })
  })

  it('小息/午膳即使前後皆空都要斷段（同 maxConsecutive 一致）', () => {
    // P2 同 P3 都空，但中間隔小息 → 唔可以併成一段
    const slots = [1, 4, 5, 6, 7, 8].map((p) => slot({ id: `p${p}`, day: 1, period: p }))
    // 剩低空：P2（小息前）、P3（小息後）
    const segs = computeFreePeriods(slots, bells, [1])
    expect(segs).toHaveLength(2)
    expect(segs[0].periods).toEqual([2])
    expect(segs[1].periods).toEqual([3])
  })

  it('某日完全無空堂 → 嗰日唔出現任何段', () => {
    const slots = [1, 2, 3, 4, 5, 6, 7, 8].map((p) =>
      slot({ id: `p${p}`, day: 2, period: p }),
    )
    const segs = computeFreePeriods(slots, bells, [2])
    expect(segs).toEqual([])
  })

  it('排序：先 day 升序，後段首 period 升序', () => {
    // day2 全填、day1 同 day3 剩 P1-2 空
    const slots: TimetableSlot[] = []
    for (const p of [1, 2, 3, 4, 5, 6, 7, 8]) slots.push(slot({ id: `2-${p}`, day: 2, period: p }))
    for (const day of [1, 3]) {
      for (const p of [3, 4, 5, 6, 7, 8]) slots.push(slot({ id: `${day}-${p}`, day, period: p }))
    }
    const segs = computeFreePeriods(slots, bells, [1, 2, 3])
    expect(segs.map((s) => s.day)).toEqual([1, 3]) // day2 無空堂；day1 先於 day3
    expect(segs.every((s) => s.periods[0] === 1)).toBe(true)
  })

  it('範圍外日子嘅 slot 唔影響空堂（只睇 days 內）', () => {
    // days 只一；星期二（範圍外）填滿都唔關事；星期一全空
    const slots = [1, 2, 3, 4, 5, 6, 7, 8].map((p) =>
      slot({ id: `2-${p}`, day: 2, period: p }),
    )
    const segs = computeFreePeriods(slots, bells, [1])
    expect(segs).toHaveLength(3) // 星期一照常 3 段全空
    expect(segs.every((s) => s.day === 1)).toBe(true)
  })

  it('唔喺鐘聲嘅 slot（period 99）唔當佔用任何 lesson 節', () => {
    const slots = [slot({ id: 'x', day: 1, period: 99 })]
    const segs = computeFreePeriods(slots, bells, [1])
    // P1..P8 全空 → 仍 3 段
    expect(segs).toHaveLength(3)
  })

  it('minutes 跨段內 break 一齊計（連住空檔含夾住嘅小息時間）', () => {
    // 自訂：P1,P2 空，中間夾 break；P1 09:00 起、P2 10:00 收
    const b = [
      lesson(1, '09:00', '09:40'),
      lesson(2, '09:40', '10:00'),
    ]
    const segs = computeFreePeriods([], b, [1])
    expect(segs).toHaveLength(1)
    expect(segs[0].minutes).toBe(60) // 09:00 → 10:00
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

// ───────── clampApplyDays（批量套用守門，防孤兒 slot）─────────
describe('clampApplyDays', () => {
  it('剔除顯示範圍外嘅日子（星期六當設定收窄為一至五）', () => {
    // 批量 picker 永遠列一至六；顯示範圍只一至五 → 星期六(6) 唔可寫入
    expect(clampApplyDays([1, 3, 6], [1, 2, 3, 4, 5])).toEqual([1, 3])
  })

  it('全部喺範圍內 → 原樣保留', () => {
    expect(clampApplyDays([1, 2, 5], [1, 2, 3, 4, 5])).toEqual([1, 2, 5])
  })

  it('全部喺範圍外 → 空陣列（呼叫端據此唔寫入任何 slot）', () => {
    expect(clampApplyDays([6], [1, 2, 3, 4, 5])).toEqual([])
  })

  it('保留原次序，去重', () => {
    expect(clampApplyDays([3, 1, 3, 2, 6, 1], [1, 2, 3])).toEqual([3, 1, 2])
  })

  it('當前格(d.day)永遠喺顯示範圍內 → 夾完至少保留當前日', () => {
    // 格只由 WeekGrid 範圍內可開，故 applyDays 一定含一個範圍內嘅當前日
    expect(clampApplyDays([2], [1, 2, 3, 4, 5])).toEqual([2])
    expect(clampApplyDays([4, 6], [1, 2, 3, 4, 5])).toEqual([4]) // 6 被剔，4 留低
  })

  it('空輸入 → 空輸出', () => {
    expect(clampApplyDays([], [1, 2, 3])).toEqual([])
  })
})
