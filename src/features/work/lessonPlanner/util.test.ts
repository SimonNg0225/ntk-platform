import { describe, it, expect } from 'vitest'
import {
  totalPhaseMinutes,
  materialsDone,
  keyOf,
  fromKey,
  addDaysKey,
  startOfWeekKey,
  weekdayDateKeys,
  shortDateLabel,
  longDateLabel,
  weekRangeLabel,
  computeCoverage,
  type LessonPhase,
  type MaterialItem,
} from './util'
import type { Topic } from '../../../data/types'

// ───────── 小工廠 ─────────
const phase = (minutes: number, over: Partial<LessonPhase> = {}): LessonPhase => ({
  id: 'p',
  label: 'x',
  minutes,
  detail: '',
  ...over,
})
const mat = (done: boolean): MaterialItem => ({ id: 'm', text: 't', done })
const topic = (over: Partial<Topic>): Topic => ({
  id: 't',
  part: '必修',
  area: 'A',
  topic: '課題',
  order: 0,
  ...over,
})

// ============================================================
//  totalPhaseMinutes
// ============================================================
describe('totalPhaseMinutes', () => {
  it('空陣列 = 0', () => {
    expect(totalPhaseMinutes([])).toBe(0)
  })

  it('正常加總', () => {
    expect(totalPhaseMinutes([phase(5), phase(20), phase(8)])).toBe(33)
  })

  it('非數字 / NaN / undefined 視為 0（唔會出 NaN）', () => {
    // minutes 可能由 input 變成 NaN；Number(NaN)||0 應該當 0
    expect(
      totalPhaseMinutes([phase(10), phase(NaN), phase(5)]),
    ).toBe(15)
    expect(
      totalPhaseMinutes([phase(undefined as unknown as number), phase(7)]),
    ).toBe(7)
  })

  it('負數照加（時長理論上唔應負，但唔特別 clamp）', () => {
    expect(totalPhaseMinutes([phase(20), phase(-5)])).toBe(15)
  })
})

// ============================================================
//  materialsDone
// ============================================================
describe('materialsDone', () => {
  it('空陣列 = {done:0,total:0}（唔除零）', () => {
    expect(materialsDone([])).toEqual({ done: 0, total: 0 })
  })

  it('部分完成', () => {
    expect(materialsDone([mat(true), mat(false), mat(true)])).toEqual({
      done: 2,
      total: 3,
    })
  })

  it('全部完成', () => {
    expect(materialsDone([mat(true), mat(true)])).toEqual({ done: 2, total: 2 })
  })
})

// ============================================================
//  keyOf / fromKey（本地時區，無 TZ off-by-one）
// ============================================================
describe('keyOf / fromKey（本地日期，唔係 UTC）', () => {
  it('keyOf 補零', () => {
    // 2026-01-05 本地（noon 構造避免 DST）
    expect(keyOf(new Date(2026, 0, 5, 12))).toBe('2026-01-05')
    expect(keyOf(new Date(2026, 11, 31, 12))).toBe('2026-12-31')
  })

  it('keyOf 用本地日期，即使早朝時間都唔會漂去前一日', () => {
    // 00:30 本地時間：若誤用 UTC（toISOString）喺 UTC+8 會變前一日 16:30
    expect(keyOf(new Date(2026, 4, 4, 0, 30))).toBe('2026-05-04')
    // 23:30 本地：若誤用 UTC 喺 UTC-x 會跳去後一日
    expect(keyOf(new Date(2026, 4, 4, 23, 30))).toBe('2026-05-04')
  })

  it('fromKey → keyOf roundtrip', () => {
    expect(keyOf(fromKey('2026-05-04'))).toBe('2026-05-04')
    expect(keyOf(fromKey('2026-01-01'))).toBe('2026-01-01')
    expect(keyOf(fromKey('2026-12-31'))).toBe('2026-12-31')
    expect(keyOf(fromKey('2024-02-29'))).toBe('2024-02-29') // 閏年
  })

  it('fromKey 解析到正確本地日期（年/月/日）', () => {
    const d = fromKey('2026-05-04')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(4) // 5 月 → index 4
    expect(d.getDate()).toBe(4)
  })
})

// ============================================================
//  addDaysKey（跨月 / 跨年 / 負數 / 閏年）
// ============================================================
describe('addDaysKey', () => {
  it('加 0 = 原日', () => {
    expect(addDaysKey('2026-05-04', 0)).toBe('2026-05-04')
  })

  it('同月內加', () => {
    expect(addDaysKey('2026-05-04', 3)).toBe('2026-05-07')
  })

  it('跨月', () => {
    expect(addDaysKey('2026-05-31', 1)).toBe('2026-06-01')
  })

  it('跨年', () => {
    expect(addDaysKey('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('負數（往前）', () => {
    expect(addDaysKey('2026-06-01', -1)).toBe('2026-05-31')
    expect(addDaysKey('2026-01-01', -1)).toBe('2025-12-31')
  })

  it('閏年 2 月底', () => {
    expect(addDaysKey('2024-02-28', 1)).toBe('2024-02-29')
    expect(addDaysKey('2024-02-29', 1)).toBe('2024-03-01')
  })

  it('平年 2 月底（2026 唔閏）', () => {
    expect(addDaysKey('2026-02-28', 1)).toBe('2026-03-01')
  })
})

// ============================================================
//  startOfWeekKey（由星期一起算，香港上課週）
// ============================================================
describe('startOfWeekKey（週一為首）', () => {
  it('星期一 → 自己', () => {
    // 2026-05-04 = 星期一
    expect(startOfWeekKey(new Date(2026, 4, 4, 12))).toBe('2026-05-04')
  })

  it('週中（星期三）→ 退回週一', () => {
    // 2026-05-06 = 星期三 → 週一係 05-04
    expect(startOfWeekKey(new Date(2026, 4, 6, 12))).toBe('2026-05-04')
  })

  it('星期日 → 退回同週週一（即上一個星期一，差 -6）', () => {
    // 2026-05-10 = 星期日 → 對應週一係 05-04（唔係跳去 05-11）
    expect(startOfWeekKey(new Date(2026, 4, 10, 12))).toBe('2026-05-04')
  })

  it('跨月退回上月', () => {
    // 2026-03-01 = 星期日 → 週一係上月 2026-02-23
    expect(startOfWeekKey(new Date(2026, 2, 1, 12))).toBe('2026-02-23')
  })

  it('構造時用日期任何鐘數都得（無 DST 漂移）', () => {
    // 用 00:00 構造，仍應落喺 05-04（星期一）
    expect(startOfWeekKey(new Date(2026, 4, 6, 0, 0))).toBe('2026-05-04')
  })
})

// ============================================================
//  weekdayDateKeys（一～五，5 個上課日）
// ============================================================
describe('weekdayDateKeys', () => {
  it('由週一展開 5 日', () => {
    expect(weekdayDateKeys('2026-05-04')).toEqual([
      '2026-05-04',
      '2026-05-05',
      '2026-05-06',
      '2026-05-07',
      '2026-05-08',
    ])
  })

  it('跨月週', () => {
    // 週一 2026-06-29 → 一~五 跨入 7 月
    expect(weekdayDateKeys('2026-06-29')).toEqual([
      '2026-06-29',
      '2026-06-30',
      '2026-07-01',
      '2026-07-02',
      '2026-07-03',
    ])
  })
})

// ============================================================
//  shortDateLabel / longDateLabel
// ============================================================
describe('shortDateLabel', () => {
  it('M/D（無補零）', () => {
    expect(shortDateLabel('2026-05-04')).toBe('5/4')
    expect(shortDateLabel('2026-12-31')).toBe('12/31')
    expect(shortDateLabel('2026-01-01')).toBe('1/1')
  })
})

describe('longDateLabel', () => {
  it('完整中文日期 + 正確星期', () => {
    // 2026-05-04 = 星期一
    expect(longDateLabel('2026-05-04')).toBe('2026年5月4日（星期一）')
  })

  it('星期日顯示「日」', () => {
    // 2026-05-10 = 星期日
    expect(longDateLabel('2026-05-10')).toBe('2026年5月10日（星期日）')
  })

  it('年初星期計算正確', () => {
    // 2026-01-01 = 星期四
    expect(longDateLabel('2026-01-01')).toBe('2026年1月1日（星期四）')
  })
})

// ============================================================
//  weekRangeLabel
// ============================================================
describe('weekRangeLabel（週一 → 週五）', () => {
  it('同月：合併月份', () => {
    // 週一 2026-05-04 → 週五 2026-05-08
    expect(weekRangeLabel('2026-05-04')).toBe('5月4–8日')
  })

  it('跨月：兩段 M/D', () => {
    // 週一 2026-06-29 → 週五 2026-07-03
    expect(weekRangeLabel('2026-06-29')).toBe('6/29 – 7/3')
  })

  it('同月（雙位數日）', () => {
    // 週一 2026-05-11 → 週五 2026-05-15
    expect(weekRangeLabel('2026-05-11')).toBe('5月11–15日')
  })
})

// ============================================================
//  computeCoverage（BAFS 範疇覆蓋率）
// ============================================================
describe('computeCoverage', () => {
  it('空課題 → 空陣列', () => {
    expect(computeCoverage([], new Set(), new Set())).toEqual([])
  })

  it('按範疇統計 total / planned / taught', () => {
    const topics: Topic[] = [
      topic({ id: 't1', area: 'A', part: '必修', order: 0 }),
      topic({ id: 't2', area: 'A', part: '必修', order: 1 }),
      topic({ id: 't3', area: 'B', part: '選修', order: 2 }),
    ]
    const planned = new Set(['t1', 't3'])
    const taught = new Set(['t1'])
    const res = computeCoverage(topics, planned, taught)
    expect(res).toHaveLength(2)
    expect(res[0]).toEqual({
      area: 'A',
      part: '必修',
      totalTopics: 2,
      plannedTopics: 1, // 只 t1
      taughtTopics: 1, // 只 t1
    })
    expect(res[1]).toEqual({
      area: 'B',
      part: '選修',
      totalTopics: 1,
      plannedTopics: 1, // t3
      taughtTopics: 0,
    })
  })

  it('依範疇首見 order 排序（B 在前因為 order 細）', () => {
    const topics: Topic[] = [
      topic({ id: 'a1', area: 'A', order: 5 }),
      topic({ id: 'b1', area: 'B', order: 1 }),
    ]
    const res = computeCoverage(topics, new Set(), new Set())
    expect(res.map((r) => r.area)).toEqual(['B', 'A'])
  })

  it('taught 但唔喺 planned 集合都照計（兩個集合獨立）', () => {
    const topics: Topic[] = [topic({ id: 'x', area: 'A', order: 0 })]
    const res = computeCoverage(topics, new Set(), new Set(['x']))
    expect(res[0].plannedTopics).toBe(0)
    expect(res[0].taughtTopics).toBe(1)
  })
})
