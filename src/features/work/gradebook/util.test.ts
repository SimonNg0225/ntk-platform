import { describe, it, expect } from 'vitest'
import {
  ensureScheme,
  DEFAULT_WEIGHTS,
  bandsOf,
  gradeOf,
  pctTone,
  mean,
  median,
  stdev,
  quartiles,
  round1,
  pctFor,
  computeResults,
  histogram,
  shortDate,
  assessmentSortKey,
  csvEscape,
  type GradingScheme,
} from './util'
import type { Assessment, Score, Student } from '../../../data/types'

// ───────── 測試用 factory ─────────
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
): Score => ({ id: `${assessmentId}-${studentId}`, assessmentId, studentId, score })

// ============================================================
describe('ensureScheme', () => {
  it('搵到對應 classId 就回返現有方案', () => {
    const existing = scheme({ id: 'x', classId: 'c2', weighted: false })
    expect(ensureScheme('c2', [scheme(), existing])).toBe(existing)
  })

  it('搵唔到就回預設方案（id 空、用 DEFAULT_WEIGHTS、加權、hkdse）', () => {
    const r = ensureScheme('nope', [])
    expect(r.id).toBe('')
    expect(r.classId).toBe('nope')
    expect(r.weighted).toBe(true)
    expect(r.scale).toBe('hkdse')
    expect(r.dropLowest).toBe(false)
    expect(r.weights).toEqual(DEFAULT_WEIGHTS)
  })

  it('預設方案 weights 係 copy（唔會污染 DEFAULT_WEIGHTS）', () => {
    const r = ensureScheme('nope', [])
    r.weights.測驗 = 999
    expect(DEFAULT_WEIGHTS.測驗).toBe(30)
  })
})

// ============================================================
describe('bandsOf / gradeOf 等級制', () => {
  it('bandsOf 三種制式回唔同 bands', () => {
    expect(bandsOf('hkdse')[0].label).toBe('5**')
    expect(bandsOf('simple')[0].label).toBe('A')
    expect(bandsOf('percent')[0].label).toBe('優')
  })

  it('gradeOf hkdse 邊界（含下限）', () => {
    expect(gradeOf(100, 'hkdse').label).toBe('5**') // >=88
    expect(gradeOf(88, 'hkdse').label).toBe('5**') // 剛好 88
    expect(gradeOf(87.9, 'hkdse').label).toBe('5*') // <88 -> 80 段
    expect(gradeOf(50, 'hkdse').label).toBe('3') // 剛好 50
    expect(gradeOf(49.9, 'hkdse').label).toBe('2') // 跌落 40 段
    expect(gradeOf(0, 'hkdse').label).toBe('U') // 最底
  })

  it('gradeOf simple 字母制', () => {
    expect(gradeOf(80, 'simple').label).toBe('A')
    expect(gradeOf(79.9, 'simple').label).toBe('B')
    expect(gradeOf(60, 'simple').label).toBe('C')
    expect(gradeOf(0, 'simple').label).toBe('F')
  })

  it('gradeOf percent 等第制', () => {
    expect(gradeOf(75, 'percent').label).toBe('優')
    expect(gradeOf(60, 'percent').label).toBe('良')
    expect(gradeOf(50, 'percent').label).toBe('及格')
    expect(gradeOf(49, 'percent').label).toBe('待改進')
  })

  it('gradeOf 負分 / 無對應 band 跌落最底', () => {
    expect(gradeOf(-5, 'hkdse').label).toBe('U')
    expect(gradeOf(-100, 'simple').label).toBe('F')
  })
})

// ============================================================
describe('pctTone 通用色調', () => {
  it('各門檻', () => {
    expect(pctTone(75)).toBe('green')
    expect(pctTone(74.9)).toBe('accent')
    expect(pctTone(60)).toBe('accent')
    expect(pctTone(59.9)).toBe('amber')
    expect(pctTone(50)).toBe('amber')
    expect(pctTone(49.9)).toBe('rose')
    expect(pctTone(0)).toBe('rose')
  })
})

// ============================================================
describe('mean / median / stdev 統計（含空輸入）', () => {
  it('mean 空陣列回 null', () => {
    expect(mean([])).toBeNull()
  })
  it('mean 一般 + 負數', () => {
    expect(mean([2, 4, 6])).toBe(4)
    expect(mean([-2, 2])).toBe(0)
    expect(mean([5])).toBe(5)
  })

  it('median 空回 null', () => {
    expect(median([])).toBeNull()
  })
  it('median 奇數個 = 正中', () => {
    expect(median([3, 1, 2])).toBe(2) // 排序後 1,2,3
  })
  it('median 偶數個 = 中間兩個平均', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5)
    expect(median([10, 0])).toBe(5)
  })

  it('stdev 少於 2 個回 null', () => {
    expect(stdev([])).toBeNull()
    expect(stdev([5])).toBeNull()
  })
  it('stdev 母體標準差（除以 N）', () => {
    // [2,4]: mean=3, var=((-1)^2+1^2)/2=1, sd=1
    expect(stdev([2, 4])).toBe(1)
    // [2,4,6]: mean=4, var=(4+0+4)/3=8/3, sd=sqrt(8/3)
    expect(stdev([2, 4, 6])).toBeCloseTo(Math.sqrt(8 / 3), 10)
    // 全相同 -> 0
    expect(stdev([7, 7, 7])).toBe(0)
  })
})

// ============================================================
describe('quartiles 四分位（線性內插 / type-7）', () => {
  it('空回 null', () => {
    expect(quartiles([])).toBeNull()
  })

  it('單一元素 -> 五個都係佢', () => {
    expect(quartiles([42])).toEqual([42, 42, 42, 42, 42])
  })

  it('奇數整齊資料（pos 落正 index）', () => {
    // [1..5]: q1 pos=1->2, med pos=2->3, q3 pos=3->4
    expect(quartiles([5, 3, 1, 4, 2])).toEqual([1, 2, 3, 4, 5])
  })

  it('偶數資料用內插', () => {
    // [1,2,3,4]: q1 pos=0.75 ->1.75, med pos=1.5 ->2.5, q3 pos=2.25 ->3.25
    expect(quartiles([4, 3, 2, 1])).toEqual([1, 1.75, 2.5, 3.25, 4])
  })

  it('兩個元素', () => {
    // [10,20]: q1 pos=0.25 ->12.5, med pos=0.5 ->15, q3 pos=0.75 ->17.5
    expect(quartiles([20, 10])).toEqual([10, 12.5, 15, 17.5, 20])
  })
})

// ============================================================
describe('round1 四捨五入到 1 位小數', () => {
  it('一般', () => {
    expect(round1(1.24)).toBe(1.2)
    expect(round1(1.25)).toBe(1.3)
    expect(round1(1.0)).toBe(1)
  })
  it('負數 + 大數', () => {
    expect(round1(-1.26)).toBe(-1.3)
    expect(round1(99.95)).toBe(100)
  })
})

// ============================================================
describe('pctFor 取百分比', () => {
  const scores = [sc('a1', 'p1', 30), sc('a1', 'p2', null), sc('a2', 'p1', 0)]

  it('max <= 0 回 null（防除零）', () => {
    expect(pctFor(scores, 'a1', 'p1', 0)).toBeNull()
    expect(pctFor(scores, 'a1', 'p1', -10)).toBeNull()
  })

  it('正常換算百分比', () => {
    expect(pctFor(scores, 'a1', 'p1', 40)).toBe(75) // 30/40
    expect(pctFor(scores, 'a1', 'p1', 60)).toBe(50) // 30/60
  })

  it('0 分 -> 0%（唔可以當無分）', () => {
    expect(pctFor(scores, 'a2', 'p1', 50)).toBe(0)
  })

  it('score 為 null -> null', () => {
    expect(pctFor(scores, 'a1', 'p2', 100)).toBeNull()
  })

  it('搵唔到紀錄 -> null', () => {
    expect(pctFor(scores, 'a9', 'p9', 100)).toBeNull()
  })
})

// ============================================================
describe('computeResults 加權計分核心', () => {
  it('空學生 -> 空陣列', () => {
    expect(computeResults([], [], [], scheme())).toEqual([])
  })

  it('學生但完全無分 -> weighted/simple 皆 null, submitted 0', () => {
    const students = [stu('p1')]
    const assessments = [asmt({ id: 'a1', type: '測驗' })]
    const r = computeResults(students, assessments, [], scheme())
    expect(r).toHaveLength(1)
    expect(r[0].weighted).toBeNull()
    expect(r[0].simple).toBeNull()
    expect(r[0].submitted).toBe(0)
    expect(r[0].expected).toBe(1)
    expect(r[0].perAssessment.a1).toBeNull()
  })

  it('單一類別：加權 == 簡單平均', () => {
    const students = [stu('p1')]
    const assessments = [
      asmt({ id: 'a1', type: '測驗', maxScore: 100 }),
      asmt({ id: 'a2', type: '測驗', maxScore: 100 }),
    ]
    const scores = [sc('a1', 'p1', 80), sc('a2', 'p1', 60)]
    const r = computeResults(students, assessments, scores, scheme())
    expect(r[0].simple).toBe(70) // (80+60)/2
    expect(r[0].weighted).toBe(70) // 得一個類別 -> 等於平均
    expect(r[0].submitted).toBe(2)
  })

  it('跨類別加權正規化（只計有資料嘅類別）', () => {
    // 測驗 30 (avg 80) + 考試 50 (avg 40)，功課/專題無資料
    // 正規化權重: 30+50=80 -> (80*30 + 40*50)/80 = (2400+2000)/80 = 55
    const students = [stu('p1')]
    const assessments = [
      asmt({ id: 'q1', type: '測驗', maxScore: 100 }),
      asmt({ id: 'e1', type: '考試', maxScore: 100 }),
    ]
    const scores = [sc('q1', 'p1', 80), sc('e1', 'p1', 40)]
    const r = computeResults(students, assessments, scores, scheme())
    expect(r[0].simple).toBe(60) // (80+40)/2 等權
    expect(r[0].weighted).toBe(55) // 加權後
  })

  it('weighted=false -> 用簡單平均', () => {
    const students = [stu('p1')]
    const assessments = [
      asmt({ id: 'q1', type: '測驗', maxScore: 100 }),
      asmt({ id: 'e1', type: '考試', maxScore: 100 }),
    ]
    const scores = [sc('q1', 'p1', 80), sc('e1', 'p1', 40)]
    const r = computeResults(students, assessments, scores, scheme({ weighted: false }))
    expect(r[0].weighted).toBe(60) // == simple
  })

  it('類別權重為 0 全部 -> fallback 簡單平均', () => {
    const students = [stu('p1')]
    const assessments = [asmt({ id: 'q1', type: '測驗', maxScore: 100 })]
    const scores = [sc('q1', 'p1', 73)]
    const r = computeResults(
      students,
      assessments,
      scores,
      scheme({ weights: { 測驗: 0 } }),
    )
    expect(r[0].weighted).toBe(73)
  })

  it('dropLowest 剔走每類最低一次', () => {
    // 測驗類 [90, 50, 70]，剔最低 50 -> avg(90,70)=80
    const students = [stu('p1')]
    const assessments = [
      asmt({ id: 'a1', type: '測驗', maxScore: 100 }),
      asmt({ id: 'a2', type: '測驗', maxScore: 100 }),
      asmt({ id: 'a3', type: '測驗', maxScore: 100 }),
    ]
    const scores = [sc('a1', 'p1', 90), sc('a2', 'p1', 50), sc('a3', 'p1', 70)]
    const r = computeResults(
      students,
      assessments,
      scores,
      scheme({ dropLowest: true }),
    )
    expect(r[0].weighted).toBe(80)
    expect(r[0].simple).toBe(70) // 簡單平均唔受 dropLowest 影響
  })

  it('部分學生有分、計 submitted/expected', () => {
    const students = [stu('p1'), stu('p2')]
    const assessments = [
      asmt({ id: 'a1', type: '測驗', maxScore: 100 }),
      asmt({ id: 'a2', type: '測驗', maxScore: 50 }),
    ]
    const scores = [sc('a1', 'p1', 100), sc('a2', 'p1', 25), sc('a1', 'p2', 50)]
    const r = computeResults(students, assessments, scores, scheme())
    const p1 = r.find((x) => x.student.id === 'p1')!
    const p2 = r.find((x) => x.student.id === 'p2')!
    // p1: a1=100%, a2=50% -> simple 75
    expect(p1.simple).toBe(75)
    expect(p1.submitted).toBe(2)
    // p2: a1=50% only
    expect(p2.simple).toBe(50)
    expect(p2.submitted).toBe(1)
    expect(p2.expected).toBe(2)
  })
})

// ============================================================
describe('histogram 10 個 bin（含邊界 / 滿分 / 負數）', () => {
  it('空輸入 -> 10 個 0 count bin', () => {
    const h = histogram([])
    expect(h).toHaveLength(10)
    expect(h.every((b) => b.count === 0)).toBe(true)
    expect(h[0]).toMatchObject({ from: 0, to: 10, label: '0–10' })
    expect(h[9]).toMatchObject({ from: 90, to: 100, label: '90–100' })
  })

  it('滿分 100 入最後一個 bin（唔好溢出）', () => {
    const h = histogram([100])
    expect(h[9].count).toBe(1)
    expect(h.reduce((s, b) => s + b.count, 0)).toBe(1)
  })

  it('邊界值 10/20 入上一個 bin', () => {
    const h = histogram([0, 9.9, 10, 20])
    expect(h[0].count).toBe(2) // 0, 9.9
    expect(h[1].count).toBe(1) // 10
    expect(h[2].count).toBe(1) // 20
  })

  it('負數 clamp 落 bin 0', () => {
    const h = histogram([-5, -100])
    expect(h[0].count).toBe(2)
  })

  it('超過 100 clamp 落最後 bin', () => {
    const h = histogram([150])
    expect(h[9].count).toBe(1)
  })
})

// ============================================================
describe('shortDate 日期標籤（本地時區，無 off-by-one）', () => {
  it('空 / undefined -> 空字串', () => {
    expect(shortDate()).toBe('')
    expect(shortDate('')).toBe('')
  })

  it('純日期字串係本地日期（唔受 UTC 漂移影響）', () => {
    // 關鍵：2026-01-15 喺任何時區都應該係 1/15，唔好變 1/14
    expect(shortDate('2026-01-15')).toBe('1/15')
    expect(shortDate('2026-03-01')).toBe('3/1')
    expect(shortDate('2026-12-31')).toBe('12/31')
    expect(shortDate('2026-01-01')).toBe('1/1')
  })

  it('無效日期 -> 空字串', () => {
    expect(shortDate('not-a-date')).toBe('')
    expect(shortDate('2026-13-40')).toBe('')
  })
})

// ============================================================
describe('assessmentSortKey 排序鍵', () => {
  it('有 date 用 date', () => {
    expect(assessmentSortKey(asmt({ id: 'a', date: '2026-05-01', createdAt: '2026-01-01' }))).toBe(
      '2026-05-01',
    )
  })
  it('無 date 退回 createdAt', () => {
    expect(assessmentSortKey(asmt({ id: 'a', createdAt: '2026-01-01' }))).toBe('2026-01-01')
  })
  it('兩者皆無 -> 空字串', () => {
    expect(assessmentSortKey(asmt({ id: 'a', createdAt: '' }))).toBe('')
  })
})

// ============================================================
describe('csvEscape CSV 轉義', () => {
  it('純文字唔加引號', () => {
    expect(csvEscape('hello')).toBe('hello')
    expect(csvEscape(42)).toBe('42')
  })
  it('含逗號 / 引號 / 換行就包引號並 double 引號', () => {
    expect(csvEscape('a,b')).toBe('"a,b"')
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""')
    expect(csvEscape('line1\nline2')).toBe('"line1\nline2"')
  })
})
