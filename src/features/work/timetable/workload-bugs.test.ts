import { describe, it, expect } from 'vitest'
import {
  computeWorkload,
  lastLessonEndMin,
  minutesOf,
  DEFAULT_BELLS,
  type BellRow,
} from './util'
import type { TimetableSlot } from '../../../data/types'

// ============================================================
//  TDD bug-reveal/confirm 測試（針對第一階段審查標示嘅 3 個疑似 bug）
//  - Bug#1 maxConsecutive 跨小息/午膳照累計 → 高估（已修：遇 break 斷 run）
//  - Bug#2 computeWorkload 對 days 範圍外 slot 計法不一致（已修：入口先 filter）
//  - Bug#3 TodayPanel 寫死 16:00 → 改用 lastLessonEndMin(bells)（新純函式）
// ============================================================

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
const recess = (start: string, end: string): BellRow => ({
  period: 0,
  kind: 'recess',
  label: '小息',
  start,
  end,
})
const lunch = (start: string, end: string): BellRow => ({
  period: 0,
  kind: 'lunch',
  label: '午膳',
  start,
  end,
})

const days = [1, 2, 3, 4, 5, 6]
const noClass = new Map<string, string>()

// ────────────────────────────────────────────────────────────
//  Bug#1：maxConsecutive 唔應該跨小息/午膳累計
//  DEFAULT_BELLS 序列：P1 P2 [小息] P3 P4 P5 [午膳] P6 P7 P8
// ────────────────────────────────────────────────────────────
describe('Bug#1 maxConsecutive 跨小息/午膳要斷開', () => {
  it('午膳前後（P5+P6）唔算連堂 → 各自 1（修正前會錯誤計成 2）', () => {
    const slots = [
      slot({ id: 'a', day: 1, period: 5 }), // 11:15-11:55（午膳前最後）
      slot({ id: 'b', day: 1, period: 6 }), // 13:00-13:40（午膳後第一）
    ]
    const w = computeWorkload(slots, DEFAULT_BELLS, days, noClass)
    // 中間隔住午膳（11:55-13:00），有得抖 → 最長連堂應為 1
    expect(w.maxConsecutive).toBe(1)
  })

  it('小息前後（P2+P3）唔算連堂 → 1（修正前會錯誤計成 2）', () => {
    const slots = [
      slot({ id: 'a', day: 1, period: 2 }), // 08:55-09:35（小息前）
      slot({ id: 'b', day: 1, period: 3 }), // 09:55-10:35（小息後）
    ]
    const w = computeWorkload(slots, DEFAULT_BELLS, days, noClass)
    expect(w.maxConsecutive).toBe(1)
  })

  it('連住全日 8 節：小息斷 P2|P3、午膳斷 P5|P6 → 最長 block = P3,P4,P5 = 3', () => {
    // 滿堂 P1..P8：block 切成 [P1,P2]=2 / [P3,P4,P5]=3 / [P6,P7,P8]=3 → max 3
    const slots = [1, 2, 3, 4, 5, 6, 7, 8].map((p) =>
      slot({ id: `p${p}`, day: 1, period: p }),
    )
    const w = computeWorkload(slots, DEFAULT_BELLS, days, noClass)
    expect(w.maxConsecutive).toBe(3)
  })

  it('同一 block 內真正連堂照計：P3,P4,P5（中間無 break）→ 3', () => {
    const slots = [
      slot({ id: 'a', day: 1, period: 3 }),
      slot({ id: 'b', day: 1, period: 4 }),
      slot({ id: 'c', day: 1, period: 5 }),
    ]
    const w = computeWorkload(slots, DEFAULT_BELLS, days, noClass)
    expect(w.maxConsecutive).toBe(3)
  })

  it('無小息/午膳嘅鐘聲：全部 lesson 連住照計（fix 唔影響）', () => {
    // 自訂 4 節背對背、冇 break → 4 連
    const bells = [
      lesson(1, '09:00', '09:40'),
      lesson(2, '09:40', '10:20'),
      lesson(3, '10:20', '11:00'),
      lesson(4, '11:00', '11:40'),
    ]
    const slots = [1, 2, 3, 4].map((p) => slot({ id: `p${p}`, day: 2, period: p }))
    const w = computeWorkload(slots, bells, days, noClass)
    expect(w.maxConsecutive).toBe(4)
  })

  it('break 斷開後兩段，取較長嗰段：[P1]=1 vs [P3,P4]=2 → 2', () => {
    const bells = [
      lesson(1, '09:00', '09:40'),
      recess('09:40', '10:00'),
      lesson(3, '10:00', '10:40'),
      lesson(4, '10:40', '11:20'),
    ]
    const slots = [
      slot({ id: 'a', day: 3, period: 1 }),
      slot({ id: 'b', day: 3, period: 3 }),
      slot({ id: 'c', day: 3, period: 4 }),
    ]
    const w = computeWorkload(slots, bells, days, noClass)
    expect(w.maxConsecutive).toBe(2)
  })

  it('連堂仍唔可以跨日累計（回歸保護）', () => {
    // day1 尾 block P6,P7,P8 = 3；day2 P1,P2 = 2 → 唔可變 5，最長 3
    const slots = [
      slot({ id: 'a', day: 1, period: 6 }),
      slot({ id: 'b', day: 1, period: 7 }),
      slot({ id: 'c', day: 1, period: 8 }),
      slot({ id: 'd', day: 2, period: 1 }),
      slot({ id: 'e', day: 2, period: 2 }),
    ]
    const w = computeWorkload(slots, DEFAULT_BELLS, days, noClass)
    expect(w.maxConsecutive).toBe(3)
  })
})

// ────────────────────────────────────────────────────────────
//  Bug#2：days 範圍外嘅 slot 要一致地唔計（total / byDay / byClass / 分鐘）
// ────────────────────────────────────────────────────────────
describe('Bug#2 days 範圍外 slot 一致過濾', () => {
  it('範圍外（星期六）slot 唔入 total，total 同 byDay 總和一致', () => {
    // days = 一至五；但有一條星期六(6)嘅堂
    const d15 = [1, 2, 3, 4, 5]
    const slots = [
      slot({ id: 'a', day: 1, period: 1 }),
      slot({ id: 'b', day: 2, period: 1 }),
      slot({ id: 'x', day: 6, period: 1 }), // 範圍外
    ]
    const w = computeWorkload(slots, DEFAULT_BELLS, d15, noClass)
    // 修正後：範圍外嗰條唔計入 total
    expect(w.total).toBe(2)
    const sumByDay = w.byDay.reduce((s, d) => s + d.count, 0)
    expect(sumByDay).toBe(w.total) // total 同每日分佈對得上
  })

  it('範圍外 slot 唔加 totalMinutes / 唔入 byClass / 唔入 byPeriod', () => {
    const d15 = [1, 2, 3, 4, 5]
    const slots = [
      slot({ id: 'a', day: 1, period: 1, classId: 'c1' }), // 40 分
      slot({ id: 'x', day: 6, period: 2, classId: 'sat' }), // 範圍外
    ]
    const w = computeWorkload(slots, DEFAULT_BELLS, d15, noClass)
    expect(w.totalMinutes).toBe(40) // 只計範圍內嗰節
    // 範圍外班別 'sat' 唔應出現
    expect(w.byClass.some((c) => c.classId === 'sat')).toBe(false)
    expect(w.byClass.find((c) => c.classId === 'c1')?.count).toBe(1)
    // byPeriod 只得範圍內：P1=1、P2=0（範圍外嗰條唔計）
    expect(w.byPeriod.find((p) => p.period === 1)?.count).toBe(1)
    expect(w.byPeriod.find((p) => p.period === 2)?.count).toBe(0)
  })

  it('範圍內 slot 完全唔受影響（fix 唔誤殺）', () => {
    const d15 = [1, 2, 3, 4, 5]
    const slots = [
      slot({ id: 'a', day: 1, period: 1 }),
      slot({ id: 'b', day: 5, period: 2 }),
    ]
    const w = computeWorkload(slots, DEFAULT_BELLS, d15, noClass)
    expect(w.total).toBe(2)
    expect(w.daysWithLessons).toBe(2)
  })
})

// ────────────────────────────────────────────────────────────
//  Bug#3：lastLessonEndMin — 取代寫死 16:00（鐘聲可自訂含晚課）
// ────────────────────────────────────────────────────────────
describe('Bug#3 lastLessonEndMin（取代硬編碼 16:00）', () => {
  it('DEFAULT_BELLS 尾堂 P8 收 15:00 → 900（≠ 寫死 16:00=960）', () => {
    expect(lastLessonEndMin(DEFAULT_BELLS)).toBe(15 * 60) // 900
    // 證明 15:30(=930) 全堂完後：用 900 基準會判「已完」(930>=900)，
    // 但寫死 960 會錯判「未有更多」(930<960)
    expect(930 >= lastLessonEndMin(DEFAULT_BELLS)).toBe(true)
    expect(930 >= 16 * 60).toBe(false)
  })

  it('有晚課（最後一節 17:30 收）→ 取真正最尾 = 1050，唔受 16:00 限', () => {
    const bells = [
      lesson(1, '09:00', '09:40'),
      lesson(2, '16:50', '17:30'), // 晚課，超過 16:00
    ]
    expect(lastLessonEndMin(bells)).toBe(17 * 60 + 30) // 1050
  })

  it('忽略小息/午膳，只睇 lesson 嘅 end', () => {
    const bells = [
      lesson(1, '09:00', '09:40'),
      lunch('12:00', '18:00'), // 超長 break，但唔算放學時間
      lesson(2, '13:00', '13:40'),
    ]
    // 最後 lesson end = 13:40（唔係午膳 18:00）
    expect(lastLessonEndMin(bells)).toBe(13 * 60 + 40) // 820
  })

  it('無任何 lesson → 0', () => {
    expect(lastLessonEndMin([])).toBe(0)
    expect(lastLessonEndMin([recess('09:00', '09:20')])).toBe(0)
  })

  it('lesson 次序亂置都取得到最大 end（用 max 而非最後一個）', () => {
    const bells = [
      lesson(8, '14:20', '15:00'), // 擺喺最前但係最遲收
      lesson(1, '08:15', '08:55'),
    ]
    expect(lastLessonEndMin(bells)).toBe(15 * 60) // 900
  })

  it('end 用 minutesOf 解析（同基準一致）', () => {
    const bells = [lesson(1, '08:00', '08:50')]
    expect(lastLessonEndMin(bells)).toBe(minutesOf('08:50')) // 530
  })
})
