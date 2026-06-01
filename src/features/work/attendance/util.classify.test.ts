import { describe, it, expect } from 'vitest'
import { classifyAttendance, CHRONIC_ABSENCE_PCT } from './util'
import type { StudentTally } from './util'

// ============================================================
//  attendance util — 班級關注名單分類器純函式測試
//  ------------------------------------------------------------
//  涵蓋 classifyAttendance：chronic（缺席率 ≥ 門檻）/ perfect（零缺席）
//  重點守：空 / marked=0 資料不足 / 門檻邊界（含 =）/ 排序 / 自訂門檻 /
//          捨入用原始計數（唔靠 tally.rate）
// ============================================================

// 起一個 StudentTally；rate 喺 classifyAttendance 用唔到（佢用 absent/marked），
// 但為咗貼合型別仍照填一個合理值（present+late / marked）。
const tally = (patch: Partial<StudentTally> = {}): StudentTally => {
  const present = patch.present ?? 0
  const late = patch.late ?? 0
  const absent = patch.absent ?? 0
  const marked = patch.marked ?? present + late + absent
  const rate = marked === 0 ? null : Math.round(((present + late) / marked) * 100)
  return {
    present,
    late,
    absent,
    marked,
    rate,
    currentAbsentStreak: patch.currentAbsentStreak ?? 0,
    ...patch,
  }
}

const mapOf = (entries: Record<string, StudentTally>): Map<string, StudentTally> =>
  new Map(Object.entries(entries))

describe('classifyAttendance（班級關注名單分類器）', () => {
  it('常數預設 20%', () => {
    expect(CHRONIC_ABSENCE_PCT).toBe(20)
  })

  it('空 map → 兩張名單都空', () => {
    const r = classifyAttendance(new Map())
    expect(r.chronic).toEqual([])
    expect(r.perfect).toEqual([])
  })

  it('marked = 0（資料不足）→ 兩邊都唔入（即使 absent=0 都唔當全勤）', () => {
    const r = classifyAttendance(mapOf({ s1: tally({ marked: 0 }) }))
    expect(r.chronic).toEqual([])
    expect(r.perfect).toEqual([])
  })

  it('零缺席 + 有記錄 → 入 perfect、唔入 chronic', () => {
    // present 9 + late 1，absent 0，marked 10
    const r = classifyAttendance(mapOf({ s1: tally({ present: 9, late: 1, absent: 0 }) }))
    expect(r.chronic).toEqual([])
    expect(r.perfect).toEqual([{ studentId: 's1', marked: 10 }])
  })

  it('缺席率 = 門檻（剛好 20%）→ 入 chronic（門檻含等號）', () => {
    // absent 2 / marked 10 = 20%
    const r = classifyAttendance(mapOf({ s1: tally({ present: 8, absent: 2 }) }))
    expect(r.chronic).toEqual([
      { studentId: 's1', rate: 20, absent: 2, marked: 10, streak: 0 },
    ])
    expect(r.perfect).toEqual([])
  })

  it('缺席率低於門檻（19%）→ 唔入 chronic', () => {
    // absent 19 / marked 100 = 19%
    const r = classifyAttendance(mapOf({ s1: tally({ present: 81, absent: 19 }) }))
    expect(r.chronic).toEqual([])
    expect(r.perfect).toEqual([]) // 有缺席 → 唔係全勤
  })

  it('chronic 計算用原始 absent/marked，唔靠 tally.rate（捨入一致）', () => {
    // absent 1 / marked 3 = 33.33% → round 33
    const r = classifyAttendance(mapOf({ s1: tally({ present: 2, absent: 1 }) }))
    expect(r.chronic).toEqual([
      { studentId: 's1', rate: 33, absent: 1, marked: 3, streak: 0 },
    ])
  })

  it('chronic 排序：缺席率大→細', () => {
    const r = classifyAttendance(
      mapOf({
        low: tally({ present: 7, absent: 3 }), // 30%
        high: tally({ present: 4, absent: 6 }), // 60%
        mid: tally({ present: 6, absent: 4 }), // 40%
      }),
    )
    expect(r.chronic.map((c) => c.studentId)).toEqual(['high', 'mid', 'low'])
  })

  it('chronic 同缺席率時：再按 streak 大→細', () => {
    const r = classifyAttendance(
      mapOf({
        a: tally({ present: 5, absent: 5, currentAbsentStreak: 2 }), // 50%, streak 2
        b: tally({ present: 5, absent: 5, currentAbsentStreak: 4 }), // 50%, streak 4
      }),
    )
    expect(r.chronic.map((c) => c.studentId)).toEqual(['b', 'a'])
    expect(r.chronic.map((c) => c.streak)).toEqual([4, 2])
  })

  it('perfect 排序：已點日數大→細', () => {
    const r = classifyAttendance(
      mapOf({
        few: tally({ present: 3, absent: 0 }), // marked 3
        many: tally({ present: 12, absent: 0 }), // marked 12
        mid: tally({ present: 7, late: 1, absent: 0 }), // marked 8
      }),
    )
    expect(r.perfect).toEqual([
      { studentId: 'many', marked: 12 },
      { studentId: 'mid', marked: 8 },
      { studentId: 'few', marked: 3 },
    ])
  })

  it('chronic 同 perfect 互斥：有缺席唔會入 perfect、零缺席唔會入 chronic', () => {
    const r = classifyAttendance(
      mapOf({
        chronicGuy: tally({ present: 5, absent: 5 }), // 50% → chronic
        perfectGirl: tally({ present: 10, absent: 0 }), // 0% → perfect
        soso: tally({ present: 95, absent: 5 }), // 5% → 兩邊都唔入
      }),
    )
    expect(r.chronic.map((c) => c.studentId)).toEqual(['chronicGuy'])
    expect(r.perfect.map((p) => p.studentId)).toEqual(['perfectGirl'])
  })

  it('自訂門檻 chronicRatePct：50% 時 30% 嗰個唔再算 chronic', () => {
    const tallies = mapOf({
      s1: tally({ present: 7, absent: 3 }), // 30%
      s2: tally({ present: 4, absent: 6 }), // 60%
    })
    const def = classifyAttendance(tallies) // 預設 20%
    expect(def.chronic.map((c) => c.studentId)).toEqual(['s2', 's1'])
    const strict = classifyAttendance(tallies, { chronicRatePct: 50 })
    expect(strict.chronic.map((c) => c.studentId)).toEqual(['s2'])
  })

  it('全到（晒）但全係遲到亦算全勤（present/late 都唔係缺席）', () => {
    const r = classifyAttendance(mapOf({ s1: tally({ late: 6, absent: 0 }) }))
    expect(r.perfect).toEqual([{ studentId: 's1', marked: 6 }])
    expect(r.chronic).toEqual([])
  })
})
