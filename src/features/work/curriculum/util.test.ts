import { describe, it, expect } from 'vitest'
import {
  toKey,
  fmtDate,
  daysBetween,
  recordOf,
  statusOf,
  planOf,
  paceOf,
  csvEscape,
  groupTopics,
  countStatuses,
  type CurriculumPlan,
} from './util'
import type { Topic, ClassProgress } from '../../../data/types'

// ───── 測試工具 ─────
const topic = (over: Partial<Topic> & { id: string }): Topic => ({
  part: 'P',
  area: 'A',
  topic: 't',
  order: 0,
  ...over,
})

const prog = (over: Partial<ClassProgress> & { id: string }): ClassProgress => ({
  classId: 'c1',
  topicId: 't1',
  status: 'not_started',
  ...over,
})

const plan = (over: Partial<CurriculumPlan> & { id: string }): CurriculumPlan => ({
  classId: 'c1',
  topicId: 't1',
  ...over,
})

// ============================================================
//  toKey — Date -> YYYY-MM-DD（本地時區）
// ============================================================
describe('toKey', () => {
  it('用本地年月日格式化（補零）', () => {
    // 用明確本地時間建構，避免 TZ 漂移
    expect(toKey(new Date(2026, 0, 1))).toBe('2026-01-01') // 1月 -> 補零
    expect(toKey(new Date(2026, 11, 31))).toBe('2026-12-31')
    expect(toKey(new Date(2026, 4, 4))).toBe('2026-05-04')
  })

  it('日子單位數補零', () => {
    expect(toKey(new Date(2026, 8, 9))).toBe('2026-09-09')
  })

  it('本地午夜唔會跨日（即使接近 UTC 邊界）', () => {
    // 本地 5/4 00:00 必為 2026-05-04，無論時區
    expect(toKey(new Date(2026, 4, 4, 0, 0, 0))).toBe('2026-05-04')
    // 本地 5/4 23:59 仍為同一日
    expect(toKey(new Date(2026, 4, 4, 23, 59, 59))).toBe('2026-05-04')
  })
})

// ============================================================
//  fmtDate — ISO -> "M月D日"
//  關鍵：純日期字串要當本地日期，唔可以 off-by-one
// ============================================================
describe('fmtDate', () => {
  it('空 / undefined 回空字串', () => {
    expect(fmtDate('')).toBe('')
    expect(fmtDate(undefined)).toBe('')
  })

  it('無效日期回空字串', () => {
    expect(fmtDate('not-a-date')).toBe('')
  })

  it('純日期字串：本地日期，無時區 off-by-one', () => {
    // 任何時區（含 UTC 以西）都應為 3月1日，唔可以退做 2月28日
    expect(fmtDate('2026-03-01')).toBe('3月1日')
    expect(fmtDate('2026-01-01')).toBe('1月1日')
    expect(fmtDate('2026-12-31')).toBe('12月31日')
  })

  it('年頭年尾邊界唔跨年（時區穩定）', () => {
    // 1/1 喺 UTC 以西時區若當 UTC 解析會退到上年 12/31 —— 屬 bug
    expect(fmtDate('2026-01-01')).toBe('1月1日')
  })

  it('唔補零（月/日按數字顯示）', () => {
    expect(fmtDate('2026-09-09')).toBe('9月9日')
  })
})

// ============================================================
//  daysBetween — b - a（用 Date.UTC，免時區影響）
// ============================================================
describe('daysBetween', () => {
  it('同一日為 0', () => {
    expect(daysBetween('2026-05-04', '2026-05-04')).toBe(0)
  })

  it('相鄰一日為 1', () => {
    expect(daysBetween('2026-05-04', '2026-05-05')).toBe(1)
  })

  it('反方向為負數', () => {
    expect(daysBetween('2026-05-05', '2026-05-04')).toBe(-1)
  })

  it('跨月（2026 非閏年：2月28 -> 3月1 = 1 日）', () => {
    expect(daysBetween('2026-02-28', '2026-03-01')).toBe(1)
  })

  it('跨閏年 2 月（2024 閏年：2月28 -> 3月1 = 2 日）', () => {
    expect(daysBetween('2024-02-28', '2024-03-01')).toBe(2)
  })

  it('跨年', () => {
    expect(daysBetween('2025-12-31', '2026-01-01')).toBe(1)
  })

  it('跨越夏令時切換亦準確（UTC 基準，無 23/25 小時誤差）', () => {
    // 美國 2026-03-08 入夏令時；用 UTC 計應穩定為整數日
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2)
  })
})

// ============================================================
//  recordOf / statusOf / planOf — 查詢 helper
// ============================================================
describe('recordOf', () => {
  const data = [
    prog({ id: 'r1', classId: 'c1', topicId: 't1', status: 'done' }),
    prog({ id: 'r2', classId: 'c1', topicId: 't2', status: 'in_progress' }),
    prog({ id: 'r3', classId: 'c2', topicId: 't1', status: 'not_started' }),
  ]

  it('依 classId + topicId 找對應記錄', () => {
    expect(recordOf(data, 'c1', 't2')?.id).toBe('r2')
    expect(recordOf(data, 'c2', 't1')?.id).toBe('r3')
  })

  it('搵唔到回 undefined', () => {
    expect(recordOf(data, 'c9', 't9')).toBeUndefined()
  })

  it('空陣列回 undefined', () => {
    expect(recordOf([], 'c1', 't1')).toBeUndefined()
  })
})

describe('statusOf', () => {
  const data = [prog({ id: 'r1', classId: 'c1', topicId: 't1', status: 'done' })]

  it('有記錄回該 status', () => {
    expect(statusOf(data, 'c1', 't1')).toBe('done')
  })

  it('無記錄預設 not_started', () => {
    expect(statusOf(data, 'c1', 'tX')).toBe('not_started')
    expect(statusOf([], 'c1', 't1')).toBe('not_started')
  })
})

describe('planOf', () => {
  const plans = [
    plan({ id: 'p1', classId: 'c1', topicId: 't1', plannedWeek: 3 }),
    plan({ id: 'p2', classId: 'c1', topicId: 't2', plannedWeek: 5 }),
  ]

  it('依 classId + topicId 找計劃', () => {
    expect(planOf(plans, 'c1', 't2')?.id).toBe('p2')
  })

  it('搵唔到回 undefined', () => {
    expect(planOf(plans, 'c1', 'tX')).toBeUndefined()
    expect(planOf([], 'c1', 't1')).toBeUndefined()
  })
})

// ============================================================
//  paceOf — pacing 判定（傳入固定 today，確定性）
// ============================================================
describe('paceOf', () => {
  const today = '2026-05-04'

  it('無 targetDate 回 none', () => {
    expect(paceOf('not_started', undefined, today)).toBe('none')
    expect(paceOf('done', undefined, today)).toBe('none')
  })

  it('已完成（done）無論日期都當 on_track', () => {
    // 即使 target 已過期亦唔當落後
    expect(paceOf('done', '2026-01-01', today)).toBe('on_track')
    expect(paceOf('done', '2026-12-31', today)).toBe('on_track')
  })

  it('target 已過期（負數日差）= behind', () => {
    expect(paceOf('in_progress', '2026-05-03', today)).toBe('behind') // diff -1
    expect(paceOf('not_started', '2026-04-01', today)).toBe('behind')
  })

  it('target 即今日（diff 0）= due_soon（臨近邊界）', () => {
    expect(paceOf('not_started', '2026-05-04', today)).toBe('due_soon')
  })

  it('target 7 日內 = due_soon（上邊界 diff=7）', () => {
    expect(paceOf('in_progress', '2026-05-05', today)).toBe('due_soon') // diff 1
    expect(paceOf('not_started', '2026-05-11', today)).toBe('due_soon') // diff 7
  })

  it('target 多於 7 日（diff>=8）= ahead', () => {
    expect(paceOf('not_started', '2026-05-12', today)).toBe('ahead') // diff 8
    expect(paceOf('in_progress', '2026-06-04', today)).toBe('ahead')
  })
})

// ============================================================
//  csvEscape — RFC-ish CSV 欄位轉義
// ============================================================
describe('csvEscape', () => {
  it('普通字串原樣', () => {
    expect(csvEscape('plain')).toBe('plain')
  })

  it('含逗號要加引號', () => {
    expect(csvEscape('a,b')).toBe('"a,b"')
  })

  it('含雙引號：引號倍寫並包引號', () => {
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""')
  })

  it('含換行要加引號', () => {
    expect(csvEscape('line1\nline2')).toBe('"line1\nline2"')
  })

  it('數字轉字串（含 0）', () => {
    expect(csvEscape(42)).toBe('42')
    expect(csvEscape(0)).toBe('0')
    expect(csvEscape(-5)).toBe('-5')
  })

  it('空字串原樣', () => {
    expect(csvEscape('')).toBe('')
  })
})

// ============================================================
//  groupTopics — 先排序 -> 按 part -> area 分組
// ============================================================
describe('groupTopics', () => {
  it('空陣列回空', () => {
    expect(groupTopics([])).toEqual([])
  })

  it('按 order 排序後分組（part 首見次序）', () => {
    const res = groupTopics([
      topic({ id: 'c', part: 'P2', area: 'A3', order: 3 }),
      topic({ id: 'a', part: 'P1', area: 'A1', order: 1 }),
      topic({ id: 'd', part: 'P1', area: 'A1', order: 4 }),
      topic({ id: 'b', part: 'P1', area: 'A2', order: 2 }),
    ])
    // 排序後：a(1) b(2) c(3) d(4) -> P1 先（a），P2 後（c）
    expect(res.map((p) => p.part)).toEqual(['P1', 'P2'])
    // P1 攤平 items 依 order
    expect(res[0].items.map((t) => t.id)).toEqual(['a', 'b', 'd'])
    // P1 兩個 area：A1（a,d）、A2（b）
    expect(res[0].areas.map((a) => a.area)).toEqual(['A1', 'A2'])
    expect(res[0].areas[0].items.map((t) => t.id)).toEqual(['a', 'd'])
    expect(res[0].areas[1].items.map((t) => t.id)).toEqual(['b'])
    // P2 單一 area
    expect(res[1].items.map((t) => t.id)).toEqual(['c'])
    expect(res[1].areas[0].items.map((t) => t.id)).toEqual(['c'])
  })

  it('唔變動輸入陣列（純函式，無 side effect）', () => {
    const input = [
      topic({ id: 'b', order: 2 }),
      topic({ id: 'a', order: 1 }),
    ]
    const snapshot = input.map((t) => t.id)
    groupTopics(input)
    expect(input.map((t) => t.id)).toEqual(snapshot) // 原陣列次序不變
  })
})

// ============================================================
//  countStatuses — 完成度統計
// ============================================================
describe('countStatuses', () => {
  it('空 topicIds：全 0、pct 0（除零安全）', () => {
    expect(countStatuses([], 'c1', [])).toEqual({
      done: 0,
      inProgress: 0,
      notStarted: 0,
      total: 0,
      pct: 0,
    })
  })

  it('混合狀態計數正確', () => {
    const data = [
      prog({ id: 'r1', classId: 'c1', topicId: 't1', status: 'done' }),
      prog({ id: 'r2', classId: 'c1', topicId: 't2', status: 'in_progress' }),
      // t3 無記錄 -> not_started
    ]
    expect(countStatuses(data, 'c1', ['t1', 't2', 't3'])).toEqual({
      done: 1,
      inProgress: 1,
      notStarted: 1,
      total: 3,
      pct: 33, // round(1/3*100) = round(33.33) = 33
    })
  })

  it('pct 四捨五入（2/3 -> 67）', () => {
    const data = [
      prog({ id: 'r1', classId: 'c1', topicId: 't1', status: 'done' }),
      prog({ id: 'r2', classId: 'c1', topicId: 't2', status: 'done' }),
    ]
    expect(countStatuses(data, 'c1', ['t1', 't2', 't3']).pct).toBe(67) // round(66.67)
  })

  it('全部完成 pct 100', () => {
    const data = [prog({ id: 'r1', classId: 'c1', topicId: 't1', status: 'done' })]
    expect(countStatuses(data, 'c1', ['t1'])).toMatchObject({ done: 1, total: 1, pct: 100 })
  })

  it('只計對應 classId（其他班記錄忽略）', () => {
    const data = [
      prog({ id: 'r1', classId: 'c2', topicId: 't1', status: 'done' }), // 另一班
    ]
    expect(countStatuses(data, 'c1', ['t1'])).toMatchObject({
      done: 0,
      notStarted: 1,
      pct: 0,
    })
  })
})
