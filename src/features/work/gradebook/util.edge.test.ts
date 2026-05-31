import { describe, it, expect } from 'vitest'
import {
  DEFAULT_WEIGHTS,
  computeResults,
  pctFor,
  quartiles,
  stdev,
  median,
  mean,
  round1,
  shortDate,
  type GradingScheme,
} from './util'
import type { Assessment, Score, Student } from '../../../data/types'

// ============================================================
//  補充邊界測試（util.edge）
//  針對審查清單入面、現有 util.test.ts 未明確覆蓋嘅 edge case：
//  - computeResults：0 分計入 submitted/平均、dropLowest 守衛/重複最低、round1 邊界
//  - pctFor：score==max -> 100、score>max 唔 clamp -> >100
//  - quartiles：pos 落正整數 index 唔內插、未排序先排序
//  - stdev：確認除以 N（母體）而非 N-1（樣本）
//  - median：唔 mutate 傳入陣列、未排序先排序
//  - mean：和為 0
//  - round1：負數 .5 邊界（Math.round 向 +Inf）、整數原樣
//  - shortDate：完整 ISO datetime 走 new Date 分支
// ============================================================

const scheme = (over: Partial<GradingScheme> = {}): GradingScheme => ({
  id: 's1',
  classId: 'c1',
  weights: { ...DEFAULT_WEIGHTS },
  weighted: true,
  scale: 'hkdse',
  dropLowest: false,
  updatedAt: '',
  ...over,
})

const stu = (id: string, name = id): Student => ({ id, classId: 'c1', name })

const asmt = (over: Partial<Assessment> & { id: string }): Assessment => ({
  classId: 'c1',
  name: over.id,
  type: '測驗',
  maxScore: 100,
  createdAt: '',
  ...over,
})

const sc = (
  assessmentId: string,
  studentId: string,
  score: number | null,
): Score => ({
  id: `${assessmentId}-${studentId}`,
  assessmentId,
  studentId,
  score,
})

// ============================================================
describe('computeResults 補充邊界', () => {
  it('0 分（非 null）當有分：計入 submitted 同平均', () => {
    // a1=0 分（0%）、a2=80 分（80%）→ 兩項都已交，simple=(0+80)/2=40
    const students = [stu('p1')]
    const assessments = [
      asmt({ id: 'a1', type: '測驗', maxScore: 100 }),
      asmt({ id: 'a2', type: '測驗', maxScore: 100 }),
    ]
    const scores = [sc('a1', 'p1', 0), sc('a2', 'p1', 80)]
    const r = computeResults(students, assessments, scores, scheme())
    expect(r[0].perAssessment.a1).toBe(0) // 0% 非 null
    expect(r[0].submitted).toBe(2) // 0 分都算已交
    expect(r[0].simple).toBe(40) // (0+80)/2
    expect(r[0].weighted).toBe(40) // 單一類別 -> 等於平均
  })

  it('dropLowest 但某類得 1 個分 -> 唔剔（pts.length>1 守衛）', () => {
    // 測驗類得 a1=40 一個分；考試類得 e1=80 一個分
    // 兩類各 1 個分都唔可以剔（會變空），weighted 按 30/50 正規化
    // = (40*30 + 80*50)/80 = (1200+4000)/80 = 65
    const students = [stu('p1')]
    const assessments = [
      asmt({ id: 'a1', type: '測驗', maxScore: 100 }),
      asmt({ id: 'e1', type: '考試', maxScore: 100 }),
    ]
    const scores = [sc('a1', 'p1', 40), sc('e1', 'p1', 80)]
    const r = computeResults(
      students,
      assessments,
      scores,
      scheme({ dropLowest: true }),
    )
    expect(r[0].weighted).toBe(65) // 無剔任何分
    expect(r[0].simple).toBe(60) // (40+80)/2
  })

  it('dropLowest 有重複最低分 -> 只剔一個（indexOf 取第一個）', () => {
    // 測驗類 [50, 50, 80]，剔走第一個 50 -> 剩 [50, 80] avg=65
    const students = [stu('p1')]
    const assessments = [
      asmt({ id: 'a1', type: '測驗', maxScore: 100 }),
      asmt({ id: 'a2', type: '測驗', maxScore: 100 }),
      asmt({ id: 'a3', type: '測驗', maxScore: 100 }),
    ]
    const scores = [sc('a1', 'p1', 50), sc('a2', 'p1', 50), sc('a3', 'p1', 80)]
    const r = computeResults(
      students,
      assessments,
      scores,
      scheme({ dropLowest: true }),
    )
    expect(r[0].weighted).toBe(65) // 只剔一個 50
    expect(r[0].simple).toBe(60) // 簡單平均 (50+50+80)/3 = 60
  })

  it('round1 後總分邊界：99.95 -> 100', () => {
    // 單一類別兩個分：100% 同 99.9% -> 平均 99.95 -> round1 -> 100
    const students = [stu('p1')]
    const assessments = [
      asmt({ id: 'a1', type: '測驗', maxScore: 100 }),
      asmt({ id: 'a2', type: '測驗', maxScore: 1000 }),
    ]
    // a2: 999/1000 = 99.9%
    const scores = [sc('a1', 'p1', 100), sc('a2', 'p1', 999)]
    const r = computeResults(students, assessments, scores, scheme())
    expect(r[0].simple).toBe(100) // round1(99.95)
    expect(r[0].weighted).toBe(100) // 單一類別 -> 同 simple
  })
})

// ============================================================
describe('pctFor 補充邊界', () => {
  it('score == max -> 100%', () => {
    const scores = [sc('a1', 'p1', 50)]
    expect(pctFor(scores, 'a1', 'p1', 50)).toBe(100)
  })

  it('score > max -> >100（函式本身唔 clamp）', () => {
    const scores = [sc('a1', 'p1', 60)]
    expect(pctFor(scores, 'a1', 'p1', 50)).toBe(120) // 60/50*100
  })
})

// ============================================================
describe('quartiles 補充邊界', () => {
  it('pos 落正整數 index 唔內插（七個整齊資料）', () => {
    // n=7: q1 pos=(7-1)*0.25=1.5（內插）… 改用 n=5 已喺主測試覆蓋
    // 用 n=9 [1..9]: q1 pos=8*0.25=2 -> s[2]=3, med pos=4 -> s[4]=5, q3 pos=6 -> s[6]=7
    expect(quartiles([9, 1, 8, 2, 7, 3, 6, 4, 5])).toEqual([1, 3, 5, 7, 9])
  })

  it('未排序輸入會先排序', () => {
    // 同上資料打亂後結果一致，並確認 min/max 取排序後頭尾
    expect(quartiles([5, 9, 1, 3, 7])).toEqual([1, 3, 5, 7, 9])
  })
})

// ============================================================
describe('stdev 補充邊界（母體 N 而非樣本 N-1）', () => {
  it('[2,4] 母體標準差 = 1（樣本會係 sqrt(2)≈1.414）', () => {
    // 除以 N=2: var=((-1)^2+1^2)/2=1 -> sd=1
    // 若誤用 N-1=1: var=2 -> sd=√2≈1.414，明確排除
    expect(stdev([2, 4])).toBe(1)
    expect(stdev([2, 4])).not.toBeCloseTo(Math.SQRT2, 5)
  })

  it('[0,0,0,12] 母體標準差確認除以 N=4', () => {
    // mean=3, var=(9+9+9+81)/4=108/4=27 -> sd=√27≈5.196
    expect(stdev([0, 0, 0, 12])).toBeCloseTo(Math.sqrt(27), 10)
  })
})

// ============================================================
describe('median / mean 補充邊界', () => {
  it('median 唔可以 mutate 傳入陣列', () => {
    const input = [3, 1, 2]
    const copy = [...input]
    const m = median(input)
    expect(m).toBe(2)
    expect(input).toEqual(copy) // 原陣列順序保持唔變
  })

  it('mean 和為 0 回 0（非 null）', () => {
    expect(mean([-3, 3])).toBe(0)
    expect(mean([-5, 0, 5])).toBe(0)
  })
})

// ============================================================
describe('round1 補充邊界', () => {
  it('負數 .5 邊界：Math.round 向 +Inf（-1.25 -> -1.2）', () => {
    expect(round1(-1.25)).toBe(-1.2)
    expect(round1(-1.35)).toBe(-1.3) // -13.5 -> -13 -> -1.3
  })

  it('整數原樣', () => {
    expect(round1(5)).toBe(5)
    expect(round1(0)).toBe(0)
    expect(round1(-7)).toBe(-7)
  })
})

// ============================================================
describe('shortDate 補充邊界（完整 ISO datetime 走 new Date 分支）', () => {
  it('完整 ISO datetime 用 new Date 解析（非純日期分支）', () => {
    // T08:30Z：由 UTC-8 至 UTC+14 本地日期都仍係 3/15，避免時區 flaky
    expect(shortDate('2026-03-15T08:30:00.000Z')).toBe('3/15')
  })

  it('完整 ISO datetime 無效 -> 空字串', () => {
    expect(shortDate('2026-03-15T99:99:99Z')).toBe('')
  })
})
