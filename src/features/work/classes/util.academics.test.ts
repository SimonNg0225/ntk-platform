import { describe, expect, it } from 'vitest'
import type {
  Assessment,
  AttendanceRecord,
  Score,
  Student,
} from '../../../data/types'
import {
  classAcademicSummary,
  isAtRisk,
  studentAcademics,
  type StudentAcademics,
} from './util'

// ============================================================
//  班級學業 / 出席健康摘要 — 純函式測試（node、零 DOM）
//  覆蓋：空名冊、無分數、null score、maxScore<=0 除零、
//  出席率重算 present（避免捨入誤差）、跨班過濾、需關注判定。
// ============================================================

const stu = (over: Partial<Student> & { id: string }): Student => ({
  classId: 'c1',
  name: 'N',
  ...over,
})

const asm = (over: Partial<Assessment> & { id: string }): Assessment => ({
  classId: 'c1',
  name: 'Test',
  type: '測驗',
  maxScore: 100,
  createdAt: '2026-01-01',
  ...over,
})

const score = (
  over: Partial<Score> & { assessmentId: string; studentId: string },
): Score => ({
  id: 's-' + over.studentId + '-' + over.assessmentId,
  score: 0,
  ...over,
})

const att = (
  over: Partial<AttendanceRecord> & {
    studentId: string
    status: AttendanceRecord['status']
  },
): AttendanceRecord => ({
  id: 'a-' + over.studentId + '-' + (over.date ?? ''),
  classId: 'c1',
  date: '2026-01-01',
  ...over,
})

// ============================================================
//  studentAcademics — 單生跨功能指標
// ============================================================
describe('studentAcademics', () => {
  it('全空 → avg/att 皆 null，計數 0', () => {
    const r = studentAcademics('s1', [], [], [])
    expect(r).toEqual({
      avgPct: null,
      gradedCount: 0,
      attRate: null,
      attTotal: 0,
      absentCount: 0,
      lateCount: 0,
    })
  })

  it('平均分換算百分制並四捨五入（多測驗等權）', () => {
    // 40/50 = 80%、9/10 = 90% → 平均 85
    const assessments = [asm({ id: 'a1', maxScore: 50 }), asm({ id: 'a2', maxScore: 10 })]
    const scores = [
      score({ assessmentId: 'a1', studentId: 's1', score: 40 }),
      score({ assessmentId: 'a2', studentId: 's1', score: 9 }),
    ]
    const r = studentAcademics('s1', scores, assessments, [])
    expect(r.avgPct).toBe(85)
    expect(r.gradedCount).toBe(2)
  })

  it('null score 略過、唔當 0（守缺值）', () => {
    const assessments = [asm({ id: 'a1' }), asm({ id: 'a2' })]
    const scores = [
      score({ assessmentId: 'a1', studentId: 's1', score: 80 }),
      score({ assessmentId: 'a2', studentId: 's1', score: null }),
    ]
    const r = studentAcademics('s1', scores, assessments, [])
    expect(r.avgPct).toBe(80) // 只計 a1
    expect(r.gradedCount).toBe(1)
  })

  it('maxScore<=0 略過（守除零，唔產生 Infinity/NaN）', () => {
    const assessments = [asm({ id: 'a1', maxScore: 0 }), asm({ id: 'a2', maxScore: 100 })]
    const scores = [
      score({ assessmentId: 'a1', studentId: 's1', score: 5 }),
      score({ assessmentId: 'a2', studentId: 's1', score: 70 }),
    ]
    const r = studentAcademics('s1', scores, assessments, [])
    expect(r.avgPct).toBe(70)
    expect(Number.isFinite(r.avgPct as number)).toBe(true)
  })

  it('孤兒分數（assessment 已不存在）唔計入', () => {
    const scores = [score({ assessmentId: 'ghost', studentId: 's1', score: 90 })]
    const r = studentAcademics('s1', scores, [], [])
    expect(r.avgPct).toBeNull()
    expect(r.gradedCount).toBe(0)
  })

  it('出席率 = present / 全部，遲到 / 缺席分開計', () => {
    const records = [
      att({ studentId: 's1', status: 'present' }),
      att({ studentId: 's1', status: 'present' }),
      att({ studentId: 's1', status: 'late' }),
      att({ studentId: 's1', status: 'absent' }),
    ]
    const r = studentAcademics('s1', [], [], records)
    expect(r.attTotal).toBe(4)
    expect(r.attRate).toBe(50) // 2/4
    expect(r.lateCount).toBe(1)
    expect(r.absentCount).toBe(1)
  })

  it('只數屬於該 studentId 嘅紀錄（其他學生唔混入）', () => {
    const scores = [
      score({ assessmentId: 'a1', studentId: 's1', score: 100 }),
      score({ assessmentId: 'a1', studentId: 's2', score: 0 }),
    ]
    const records = [
      att({ studentId: 's1', status: 'present' }),
      att({ studentId: 's2', status: 'absent' }),
    ]
    const r = studentAcademics('s1', scores, [asm({ id: 'a1' })], records)
    expect(r.avgPct).toBe(100)
    expect(r.attRate).toBe(100)
  })
})

// ============================================================
//  isAtRisk — 低分或低出席；資料不足唔誤報
// ============================================================
describe('isAtRisk', () => {
  const base: StudentAcademics = {
    avgPct: null,
    gradedCount: 0,
    attRate: null,
    attTotal: 0,
    absentCount: 0,
    lateCount: 0,
  }

  it('完全冇資料 → false（避免誤報）', () => {
    expect(isAtRisk(base)).toBe(false)
  })

  it('成績 < 50 → true（邊界：49 risk / 50 唔 risk）', () => {
    expect(isAtRisk({ ...base, avgPct: 49 })).toBe(true)
    expect(isAtRisk({ ...base, avgPct: 50 })).toBe(false)
  })

  it('出席 < 80 → true（邊界：79 risk / 80 唔 risk）', () => {
    expect(isAtRisk({ ...base, attRate: 79 })).toBe(true)
    expect(isAtRisk({ ...base, attRate: 80 })).toBe(false)
  })

  it('成績好但出席差 → true（任一觸發即關注）', () => {
    expect(isAtRisk({ ...base, avgPct: 95, attRate: 60 })).toBe(true)
  })

  it('成績差但出席好 → true', () => {
    expect(isAtRisk({ ...base, avgPct: 30, attRate: 100 })).toBe(true)
  })

  it('成績好出席好 → false', () => {
    expect(isAtRisk({ ...base, avgPct: 88, attRate: 95 })).toBe(false)
  })
})

// ============================================================
//  classAcademicSummary — 全班 roll-up
// ============================================================
describe('classAcademicSummary', () => {
  it('空名冊 → 全 null / 0（無除零）', () => {
    const r = classAcademicSummary([], [], [], [])
    expect(r).toEqual({
      avgGradePct: null,
      gradedStudents: 0,
      attendanceRate: null,
      attendedStudents: 0,
      atRiskCount: 0,
      total: 0,
    })
  })

  it('有學生但完全無成績 / 出席 → 指標 null、total 反映人數', () => {
    const r = classAcademicSummary([stu({ id: 's1' }), stu({ id: 's2' })], [], [], [])
    expect(r.avgGradePct).toBeNull()
    expect(r.attendanceRate).toBeNull()
    expect(r.gradedStudents).toBe(0)
    expect(r.attendedStudents).toBe(0)
    expect(r.atRiskCount).toBe(0)
    expect(r.total).toBe(2)
  })

  it('班平均分 = 各生 avg 等權平均（多測驗學生唔過度加權）', () => {
    // s1 兩個測驗：100% + 100% → avg 100
    // s2 一個測驗：50% → avg 50
    // 班平均 = (100 + 50) / 2 = 75（而非按 score 條數加權嘅 83）
    const roster = [stu({ id: 's1' }), stu({ id: 's2' })]
    const assessments = [asm({ id: 'a1' }), asm({ id: 'a2' })]
    const scores = [
      score({ assessmentId: 'a1', studentId: 's1', score: 100 }),
      score({ assessmentId: 'a2', studentId: 's1', score: 100 }),
      score({ assessmentId: 'a1', studentId: 's2', score: 50 }),
    ]
    const r = classAcademicSummary(roster, scores, assessments, [])
    expect(r.avgGradePct).toBe(75)
    expect(r.gradedStudents).toBe(2)
  })

  it('只有部分學生有成績時，平均只計有成績嗰幾位', () => {
    const roster = [stu({ id: 's1' }), stu({ id: 's2' }), stu({ id: 's3' })]
    const scores = [score({ assessmentId: 'a1', studentId: 's1', score: 60 })]
    const r = classAcademicSummary(roster, scores, [asm({ id: 'a1' })], [])
    expect(r.avgGradePct).toBe(60)
    expect(r.gradedStudents).toBe(1)
    expect(r.total).toBe(3)
  })

  it('班出席率用原始紀錄總數（present 重數，非由 rate 反推）', () => {
    // s1：3 present / 4   s2：1 present / 1
    // 整體 = (3+1) / (4+1) = 4/5 = 80%
    const roster = [stu({ id: 's1' }), stu({ id: 's2' })]
    const records = [
      att({ studentId: 's1', status: 'present', date: '01' }),
      att({ studentId: 's1', status: 'present', date: '02' }),
      att({ studentId: 's1', status: 'present', date: '03' }),
      att({ studentId: 's1', status: 'absent', date: '04' }),
      att({ studentId: 's2', status: 'present', date: '01' }),
    ]
    const r = classAcademicSummary(roster, [], [], records)
    expect(r.attendanceRate).toBe(80)
    expect(r.attendedStudents).toBe(2)
  })

  it('遲到計入分母但唔當出席（present 嚴格）', () => {
    const roster = [stu({ id: 's1' })]
    const records = [
      att({ studentId: 's1', status: 'present', date: '01' }),
      att({ studentId: 's1', status: 'late', date: '02' }),
    ]
    const r = classAcademicSummary(roster, [], [], records)
    expect(r.attendanceRate).toBe(50) // 1 present / 2
  })

  it('跨班過濾：其他班學生嘅成績 / 出席唔會混入本班統計', () => {
    const roster = [stu({ id: 's1' })]
    const scores = [
      score({ assessmentId: 'a1', studentId: 's1', score: 80 }),
      score({ assessmentId: 'a1', studentId: 'outsider', score: 0 }),
    ]
    const records = [
      att({ studentId: 's1', status: 'present' }),
      att({ studentId: 'outsider', status: 'absent' }),
    ]
    const r = classAcademicSummary(roster, scores, [asm({ id: 'a1' })], records)
    expect(r.avgGradePct).toBe(80)
    expect(r.attendanceRate).toBe(100)
    expect(r.attendedStudents).toBe(1)
  })

  it('需關注計數：低分或低出席嘅學生數', () => {
    // s1 高分高出席（OK）、s2 低分、s3 低出席、s4 無資料（唔算）
    const roster = [stu({ id: 's1' }), stu({ id: 's2' }), stu({ id: 's3' }), stu({ id: 's4' })]
    const assessments = [asm({ id: 'a1' })]
    const scores = [
      score({ assessmentId: 'a1', studentId: 's1', score: 90 }),
      score({ assessmentId: 'a1', studentId: 's2', score: 30 }),
    ]
    const records = [
      att({ studentId: 's1', status: 'present', date: '01' }),
      att({ studentId: 's3', status: 'absent', date: '01' }),
      att({ studentId: 's3', status: 'absent', date: '02' }),
    ]
    const r = classAcademicSummary(roster, scores, assessments, records)
    expect(r.atRiskCount).toBe(2) // s2（低分）+ s3（低出席）
  })

  it('純函式：唔變動傳入陣列', () => {
    const roster = [stu({ id: 's1' })]
    const scores = [score({ assessmentId: 'a1', studentId: 's1', score: 70 })]
    const snapshot = scores.map((s) => s.id)
    classAcademicSummary(roster, scores, [asm({ id: 'a1' })], [])
    expect(scores.map((s) => s.id)).toEqual(snapshot)
  })
})
