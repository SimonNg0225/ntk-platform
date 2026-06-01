import { describe, it, expect } from 'vitest'
import {
  percentileOf,
  assessmentTrendSlope,
  rankByImprovement,
  DEFAULT_WEIGHTS,
  computeResults,
  type GradingScheme,
  type StudentResult,
} from './util'
import type { Assessment, Score, Student } from '../../../data/types'

// ============================================================
//  班內百分位（percentileOf）+ 評估趨勢（assessmentTrendSlope / rankByImprovement）
//  全部純函式、唔涉日期；趨勢次序由呼叫方傳入 orderedIds，故測試完全 deterministic。
// ============================================================

// ───────── factory（沿用 util.test.ts 風格）─────────
const scheme = (over: Partial<GradingScheme> = {}): GradingScheme => ({
  id: 's1',
  classId: 'c1',
  weights: { ...DEFAULT_WEIGHTS },
  weighted: false, // 用簡單平均，方便對住分數直接核對
  scale: 'hkdse',
  dropLowest: false,
  updatedAt: '',
  ...over,
})
const stu = (id: string, name = id, studentNo?: string): Student => ({
  id,
  classId: 'c1',
  name,
  studentNo,
})
const asmt = (over: Partial<Assessment> & { id: string }): Assessment => ({
  classId: 'c1',
  name: over.id,
  type: '測驗',
  maxScore: 100,
  createdAt: '',
  ...over,
})
const sc = (a: string, s: string, score: number | null): Score => ({
  id: `${a}-${s}`,
  assessmentId: a,
  studentId: s,
  score,
})

// ============================================================
describe('percentileOf 班內百分位', () => {
  it('空分佈 → null', () => {
    expect(percentileOf(50, [])).toBeNull()
  })

  it('用「低於 + 一半相等」定義：最高分唔會係 100、最低分唔會係 0', () => {
    const all = [10, 20, 30, 40] // 唯一值、無打和
    // 40：below=3, equal=1 → (3+0.5)/4 = 87.5 → 88
    expect(percentileOf(40, all)).toBe(88)
    // 10：below=0, equal=1 → 0.5/4 = 12.5 → 13
    expect(percentileOf(10, all)).toBe(13)
    // 30：below=2, equal=1 → 2.5/4 = 62.5 → 63
    expect(percentileOf(30, all)).toBe(63)
  })

  it('全部同分 → 大家都 50（中間）', () => {
    expect(percentileOf(70, [70, 70, 70])).toBe(50)
  })

  it('打和會攤分位置（同分兩人拎同一個百分位）', () => {
    const all = [10, 50, 50, 90]
    // 50：below=1, equal=2 → (1+1)/4 = 50
    expect(percentileOf(50, all)).toBe(50)
  })

  it('value 唔喺分佈內都照計相對位置（插入語意）', () => {
    // 60 喺 [10,50,90]：below=2, equal=0 → 2/3 = 66.7 → 67
    expect(percentileOf(60, [10, 50, 90])).toBe(67)
  })

  it('clamp 落 0–100 並回整數', () => {
    const r = percentileOf(100, [0, 100])
    expect(r).toBeGreaterThanOrEqual(0)
    expect(r).toBeLessThanOrEqual(100)
    expect(Number.isInteger(r)).toBe(true)
  })
})

// ============================================================
describe('assessmentTrendSlope 線性趨勢斜率', () => {
  const pa = (xs: (number | null)[]): Record<string, number | null> => {
    const m: Record<string, number | null> = {}
    xs.forEach((v, i) => (m[`a${i}`] = v))
    return m
  }
  const ids = (n: number) => Array.from({ length: n }, (_, i) => `a${i}`)

  it('少於 2 個有效分數 → null', () => {
    expect(assessmentTrendSlope(pa([]), ids(0))).toBeNull()
    expect(assessmentTrendSlope(pa([50]), ids(1))).toBeNull()
    expect(assessmentTrendSlope(pa([50, null, null]), ids(3))).toBeNull()
  })

  it('完美上升直線：斜率 = 每步升幅', () => {
    // 50,60,70,80 → +10/評估
    expect(assessmentTrendSlope(pa([50, 60, 70, 80]), ids(4))).toBeCloseTo(10, 6)
  })

  it('完美下跌：負斜率', () => {
    expect(assessmentTrendSlope(pa([80, 60, 40]), ids(3))).toBeCloseTo(-20, 6)
  })

  it('全部同分 → 0', () => {
    expect(assessmentTrendSlope(pa([70, 70, 70]), ids(3))).toBe(0)
  })

  it('跳過未交（null）：只用有分嘅評估排次序', () => {
    // 有效序列 = 50,70（中間 null 略過），x=0,1 → 斜率 20
    expect(assessmentTrendSlope(pa([50, null, 70]), ids(3))).toBeCloseTo(20, 6)
  })

  it('orderedIds 決定時間次序（倒轉次序 → 斜率反號）', () => {
    const m = pa([50, 60, 70, 80])
    const up = assessmentTrendSlope(m, ids(4))
    const down = assessmentTrendSlope(m, [...ids(4)].reverse())
    expect(down).toBeCloseTo(-(up as number), 6)
  })

  it('orderedIds 內冇嘅 key 會被忽略', () => {
    const m = pa([50, 60, 70])
    // 只睇 a0,a2 → 收集到 [50,70]，x=0,1（用次序，唔理原本間隔）→ 斜率 20
    expect(assessmentTrendSlope(m, ['a0', 'a2'])).toBeCloseTo(20, 6)
  })

  it('noisy 但整體向上：斜率為正', () => {
    const s = assessmentTrendSlope(pa([40, 55, 50, 70, 65]), ids(5))
    expect(s).not.toBeNull()
    expect(s!).toBeGreaterThan(0)
  })
})

// ============================================================
describe('rankByImprovement 進步榜', () => {
  // 三個評估 a1<a2<a3
  const assessments = [asmt({ id: 'a1' }), asmt({ id: 'a2' }), asmt({ id: 'a3' })]
  const orderedIds = ['a1', 'a2', 'a3']

  const build = (scores: Score[], studs: Student[]): StudentResult[] =>
    computeResults(studs, assessments, scores, scheme())

  it('最進步喺前、最退步喺後', () => {
    const studs = [stu('up'), stu('down'), stu('flat')]
    const scores = [
      sc('a1', 'up', 40), sc('a2', 'up', 60), sc('a3', 'up', 80), // +20
      sc('a1', 'down', 90), sc('a2', 'down', 70), sc('a3', 'down', 50), // -20
      sc('a1', 'flat', 60), sc('a2', 'flat', 60), sc('a3', 'flat', 60), // 0
    ]
    const ranked = rankByImprovement(build(scores, studs), orderedIds)
    expect(ranked.map((e) => e.student.id)).toEqual(['up', 'flat', 'down'])
    expect(ranked[0].slope!).toBeGreaterThan(0)
    expect(ranked[ranked.length - 1].slope!).toBeLessThan(0)
  })

  it('剔走有效分數不足（<2）嘅學生', () => {
    const studs = [stu('ok'), stu('one'), stu('none')]
    const scores = [
      sc('a1', 'ok', 50), sc('a2', 'ok', 70),
      sc('a1', 'one', 80), // 只得一個
      // none：完全冇分
    ]
    const ranked = rankByImprovement(build(scores, studs), orderedIds)
    expect(ranked.map((e) => e.student.id)).toEqual(['ok'])
    expect(ranked[0].points).toBe(2)
  })

  it('同斜率時按學號／姓名穩定排序', () => {
    const studs = [stu('b', 'B', '02'), stu('a', 'A', '01')]
    const scores = [
      sc('a1', 'b', 50), sc('a2', 'b', 60), sc('a3', 'b', 70),
      sc('a1', 'a', 50), sc('a2', 'a', 60), sc('a3', 'a', 70),
    ]
    const ranked = rankByImprovement(build(scores, studs), orderedIds)
    expect(ranked.map((e) => e.student.id)).toEqual(['a', 'b']) // 01 在前
  })

  it('points 反映實際用嚟計斜率嘅評估數（含跳過 null）', () => {
    const studs = [stu('p')]
    const scores = [sc('a1', 'p', 50), sc('a3', 'p', 90)] // a2 未交
    const ranked = rankByImprovement(build(scores, studs), orderedIds)
    expect(ranked[0].points).toBe(2)
  })

  it('空輸入 → 空榜', () => {
    expect(rankByImprovement([], orderedIds)).toEqual([])
  })
})
