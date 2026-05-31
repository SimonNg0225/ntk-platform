import { describe, it, expect } from 'vitest'
import type { HealthLog, HealthGoals } from './types'
import {
  toKey,
  fromKey,
  addDays,
  addDaysKey,
  todayKey,
  recentDays,
  byDate,
  valueOn,
  entriesOf,
  latestEntry,
  seriesOf,
  average,
  weeklyExercise,
  waterOn,
  weightTrend,
  goalPct,
  loggingStreak,
  summarize,
} from './util'

const ANCHOR = new Date(2026, 5, 1, 12, 0, 0) // 2026-06-01 本地正午（星期一）

const log = (date: string, over: Partial<HealthLog> = {}): HealthLog => ({
  id: date,
  date,
  createdAt: '',
  updatedAt: '',
  ...over,
})

describe('日期 key（本地時區，無 UTC 漂移）', () => {
  it('toKey/fromKey roundtrip', () => {
    expect(toKey(fromKey('2026-06-01'))).toBe('2026-06-01')
    expect(toKey(fromKey('2026-01-01'))).toBe('2026-01-01')
    expect(toKey(fromKey('2026-12-31'))).toBe('2026-12-31')
  })
  it('toKey 用本地分量（非 UTC slice）', () => {
    // 本地正午起任何時區都係同一日
    expect(toKey(new Date(2026, 5, 1, 0, 30))).toBe('2026-06-01')
    expect(toKey(new Date(2026, 5, 1, 23, 30))).toBe('2026-06-01')
  })
  it('recentDays：含 anchor 當日、由舊到新', () => {
    expect(recentDays(3, ANCHOR)).toEqual(['2026-05-30', '2026-05-31', '2026-06-01'])
    expect(recentDays(1, ANCHOR)).toEqual(['2026-06-01'])
  })
  it('recentDays(0) → 空陣列（守衞，唔崩）', () => {
    expect(recentDays(0, ANCHOR)).toEqual([])
  })
  it('addDays：跨月 / 跨年正確（用本地分量，非毫秒加減）', () => {
    expect(toKey(addDays(fromKey('2026-06-01'), -1))).toBe('2026-05-31') // 跨月退一
    expect(toKey(addDays(fromKey('2026-01-01'), -1))).toBe('2025-12-31') // 跨年退一
    expect(toKey(addDays(fromKey('2026-02-28'), 1))).toBe('2026-03-01') // 平年 2 月底
    expect(toKey(addDays(fromKey('2024-02-28'), 1))).toBe('2024-02-29') // 閏年 2 月底
  })
  it('addDaysKey：直接用 key 進退、零位移為原日', () => {
    expect(addDaysKey('2026-06-01', 0)).toBe('2026-06-01')
    expect(addDaysKey('2026-06-01', 7)).toBe('2026-06-08')
    expect(addDaysKey('2026-12-31', 1)).toBe('2027-01-01')
  })
  it('todayKey：預設用本地當下、可傳 anchor', () => {
    expect(todayKey(ANCHOR)).toBe('2026-06-01')
    // 預設參數應回一個合法本地 key（roundtrip 穩定）
    const k = todayKey()
    expect(toKey(fromKey(k))).toBe(k)
  })
})

describe('byDate / valueOn', () => {
  it('重複日期：後者覆寫', () => {
    const m = byDate([log('2026-06-01', { weightKg: 70 }), log('2026-06-01', { weightKg: 71 })])
    expect(m.size).toBe(1)
    expect(m.get('2026-06-01')?.weightKg).toBe(71)
  })
  it('valueOn：有值 / 缺值 / NaN 守衞', () => {
    const logs = [log('2026-06-01', { sleepHrs: 7.5 }), log('2026-05-31', { sleepHrs: NaN })]
    expect(valueOn(logs, '2026-06-01', 'sleepHrs')).toBe(7.5)
    expect(valueOn(logs, '2026-06-01', 'weightKg')).toBeUndefined()
    expect(valueOn(logs, '2026-05-31', 'sleepHrs')).toBeUndefined() // NaN → undefined
    expect(valueOn(logs, '2099-01-01', 'sleepHrs')).toBeUndefined()
  })
})

describe('entriesOf / latestEntry', () => {
  it('過濾非有限值、按日期升序', () => {
    const logs = [
      log('2026-06-01', { weightKg: 70 }),
      log('2026-05-20', { weightKg: 72 }),
      log('2026-05-25', { weightKg: Infinity }),
    ]
    expect(entriesOf(logs, 'weightKg')).toEqual([
      { date: '2026-05-20', value: 72 },
      { date: '2026-06-01', value: 70 },
    ])
  })
  it('latestEntry：最新一筆 / 空→null', () => {
    expect(latestEntry([log('2026-05-20', { weightKg: 72 }), log('2026-06-01', { weightKg: 70 })], 'weightKg')).toEqual({
      date: '2026-06-01',
      value: 70,
    })
    expect(latestEntry([], 'weightKg')).toBeNull()
  })
})

describe('seriesOf', () => {
  it('長度=days、缺資料嗰日 null', () => {
    const s = seriesOf([log('2026-06-01', { mood: 4 })], 'mood', 3, ANCHOR)
    expect(s).toEqual([
      { date: '2026-05-30', value: null },
      { date: '2026-05-31', value: null },
      { date: '2026-06-01', value: 4 },
    ])
  })
})

describe('average（空窗回 null，唔回 NaN）', () => {
  it('只計有記錄嘅日', () => {
    const logs = [log('2026-06-01', { sleepHrs: 8 }), log('2026-05-31', { sleepHrs: 6 })]
    expect(average(logs, 'sleepHrs', 3, ANCHOR)).toBe(7) // (8+6)/2
  })
  it('完全冇資料 → null（非 NaN）', () => {
    expect(average([], 'sleepHrs', 7, ANCHOR)).toBeNull()
    expect(average([log('2026-06-01', { weightKg: 70 })], 'sleepHrs', 7, ANCHOR)).toBeNull()
  })
})

describe('weeklyExercise / waterOn（缺=0）', () => {
  it('近 7 日運動總和', () => {
    const logs = [
      log('2026-06-01', { exerciseMin: 30 }),
      log('2026-05-30', { exerciseMin: 45 }),
      log('2026-05-20', { exerciseMin: 999 }), // 窗外，唔計
    ]
    expect(weeklyExercise(logs, ANCHOR)).toBe(75)
  })
  it('空 → 0', () => {
    expect(weeklyExercise([], ANCHOR)).toBe(0)
    expect(waterOn([], '2026-06-01')).toBe(0)
    expect(waterOn([log('2026-06-01', { waterMl: 1500 })], '2026-06-01')).toBe(1500)
  })
})

describe('weightTrend', () => {
  it('空 → null', () => {
    expect(weightTrend([], 7, ANCHOR)).toBeNull()
  })
  it('單一筆 → delta null', () => {
    expect(weightTrend([log('2026-06-01', { weightKg: 70 })], 7, ANCHOR)).toEqual({
      latestKg: 70,
      deltaKg: null,
    })
  })
  it('一週變化（最新 − 約 7 日前）', () => {
    const logs = [log('2026-05-25', { weightKg: 72 }), log('2026-06-01', { weightKg: 70.5 })]
    const t = weightTrend(logs, 7, ANCHOR)
    expect(t?.latestKg).toBe(70.5)
    expect(t?.deltaKg).toBeCloseTo(-1.5, 5)
  })
  it('全部資料都喺截止日之前：最新即基準 → delta null（唔虛報變化）', () => {
    // 兩筆都係 1 個月前（遠早於 7 日 cutoff），prev 會落到 latest 自己。
    const logs = [log('2026-04-20', { weightKg: 72 }), log('2026-05-01', { weightKg: 71 })]
    const t = weightTrend(logs, 7, ANCHOR)
    expect(t?.latestKg).toBe(71)
    expect(t?.deltaKg).toBeNull()
  })
  it('忽略非有限體重（NaN/Infinity 唔污染趨勢）', () => {
    const logs = [
      log('2026-05-25', { weightKg: 72 }),
      log('2026-05-28', { weightKg: NaN }),
      log('2026-06-01', { weightKg: 70 }),
    ]
    const t = weightTrend(logs, 7, ANCHOR)
    expect(t?.latestKg).toBe(70)
    expect(t?.deltaKg).toBeCloseTo(-2, 5)
  })
})

describe('goalPct', () => {
  it('正常 / 可超過 100', () => {
    expect(goalPct(1500, 2000)).toBe(75)
    expect(goalPct(2500, 2000)).toBe(125)
  })
  it('target<=0 → 0；value<=0 → 0（防除零 / 負）', () => {
    expect(goalPct(1500, 0)).toBe(0)
    expect(goalPct(1500, -5)).toBe(0)
    expect(goalPct(0, 2000)).toBe(0)
    expect(goalPct(-100, 2000)).toBe(0)
  })
  it('NaN / Infinity 輸入 → 0（永不回 NaN / Infinity）', () => {
    expect(goalPct(NaN, 2000)).toBe(0)
    expect(goalPct(1500, NaN)).toBe(0)
    expect(goalPct(Infinity, 2000)).toBe(0)
    expect(goalPct(1500, Infinity)).toBe(0) // 1500/Inf=0 → 仍係有限 0
    expect(Number.isFinite(goalPct(1500, Infinity))).toBe(true)
  })
})

describe('loggingStreak', () => {
  it('今日有記錄：由今日連續往前數', () => {
    const logs = [
      log('2026-06-01', { mood: 4 }),
      log('2026-05-31', { sleepHrs: 7 }),
      log('2026-05-30', { weightKg: 70 }),
    ]
    expect(loggingStreak(logs, ANCHOR)).toBe(3)
  })
  it('今日無、琴日有：由琴日數（保住 streak）', () => {
    const logs = [log('2026-05-31', { mood: 3 }), log('2026-05-30', { mood: 3 })]
    expect(loggingStreak(logs, ANCHOR)).toBe(2)
  })
  it('中間有缺口：斷喺缺口', () => {
    const logs = [log('2026-06-01', { mood: 4 }), log('2026-05-30', { mood: 4 })] // 缺 05-31
    expect(loggingStreak(logs, ANCHOR)).toBe(1)
  })
  it('完全無 → 0', () => {
    expect(loggingStreak([], ANCHOR)).toBe(0)
  })
})

describe('summarize（整合快照，全程無 NaN）', () => {
  const goals: HealthGoals = {
    id: 'singleton',
    sleepTargetHrs: 8,
    exerciseTargetMin: 150,
    waterTargetMl: 2000,
  }
  it('空資料：數值欄 null / 0，唔崩唔 NaN', () => {
    const s = summarize([], goals, ANCHOR)
    expect(s.weightKg).toBeNull()
    expect(s.weightDelta7).toBeNull()
    expect(s.sleepAvg7).toBeNull()
    expect(s.exerciseWeek).toBe(0)
    expect(s.exercisePct).toBe(0)
    expect(s.waterToday).toBe(0)
    expect(s.waterPct).toBe(0)
    expect(s.moodAvg7).toBeNull()
    expect(s.streak).toBe(0)
    expect(s.loggedToday).toBe(false)
  })
  it('有資料：各欄正確', () => {
    const logs = [
      log('2026-06-01', { weightKg: 70, sleepHrs: 8, exerciseMin: 30, waterMl: 1000, mood: 4 }),
      log('2026-05-31', { weightKg: 70.5, sleepHrs: 6, exerciseMin: 20 }),
    ]
    const s = summarize(logs, goals, ANCHOR)
    expect(s.weightKg).toBe(70)
    expect(s.sleepAvg7).toBe(7) // (8+6)/2
    expect(s.exerciseWeek).toBe(50)
    expect(s.exercisePct).toBe(33) // 50/150 → 33%
    expect(s.waterToday).toBe(1000)
    expect(s.waterPct).toBe(50)
    expect(s.moodAvg7).toBe(4)
    expect(s.streak).toBe(2)
    expect(s.loggedToday).toBe(true)
  })
})
