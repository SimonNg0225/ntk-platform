import { describe, it, expect } from 'vitest'
import { longestAbsentStreak, lastPresentKey, summarizeNotes } from './util'
import type { AttendanceNote } from './util'
import type { AttendanceRecord, AttendanceStatus } from '../../../data/types'

// ============================================================
//  attendance util — 個別學生摘要（drill-down）純函式測試
//  ------------------------------------------------------------
//  涵蓋 longestAbsentStreak / lastPresentKey / summarizeNotes
//  重點守：空 / 缺值 / 除零 / gap 行為 / 多生隔離
// ============================================================

const rec = (
  studentId: string,
  date: string,
  status: AttendanceStatus,
): AttendanceRecord => ({
  id: `${studentId}-${date}-${status}`,
  classId: 'c1',
  studentId,
  date,
  status,
})

const note = (patch: Partial<AttendanceNote>): AttendanceNote => ({
  id: Math.random().toString(36).slice(2),
  classId: 'c1',
  studentId: 's1',
  date: '2026-05-01',
  updatedAt: '2026-05-01T00:00:00.000Z',
  ...patch,
})

// ───────── longestAbsentStreak ─────────
describe('longestAbsentStreak（期內最長連續缺席段）', () => {
  it('空 records → 0', () => {
    expect(longestAbsentStreak([], 's1', ['2026-05-01', '2026-05-02'])).toBe(0)
  })

  it('空 dayKeys → 0（即使有記錄）', () => {
    expect(longestAbsentStreak([rec('s1', '2026-05-01', 'absent')], 's1', [])).toBe(0)
  })

  it('全部出席 → 0', () => {
    const days = ['2026-05-01', '2026-05-02', '2026-05-03']
    const records = [
      rec('s1', '2026-05-01', 'present'),
      rec('s1', '2026-05-02', 'late'),
      rec('s1', '2026-05-03', 'present'),
    ]
    expect(longestAbsentStreak(records, 's1', days)).toBe(0)
  })

  it('取最長段（非最近）：頭段 3、尾段 1 → 3', () => {
    // 05-01..03 absent（3 連），05-04 present（斷），05-05 absent（1）
    const days = ['2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04', '2026-05-05']
    const records = [
      rec('s1', '2026-05-01', 'absent'),
      rec('s1', '2026-05-02', 'absent'),
      rec('s1', '2026-05-03', 'absent'),
      rec('s1', '2026-05-04', 'present'),
      rec('s1', '2026-05-05', 'absent'),
    ]
    expect(longestAbsentStreak(records, 's1', days)).toBe(3)
  })

  it('gap（未標記日）跳過唔斷：absent, gap, absent → 連續 2', () => {
    const days = ['2026-05-01', '2026-05-02', '2026-05-03']
    const records = [
      rec('s1', '2026-05-01', 'absent'),
      // 05-02 無記錄
      rec('s1', '2026-05-03', 'absent'),
    ]
    expect(longestAbsentStreak(records, 's1', days)).toBe(2)
  })

  it('late 斷開（present/late 都算斷）：absent, late, absent, absent → 2', () => {
    const days = ['2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04']
    const records = [
      rec('s1', '2026-05-01', 'absent'),
      rec('s1', '2026-05-02', 'late'),
      rec('s1', '2026-05-03', 'absent'),
      rec('s1', '2026-05-04', 'absent'),
    ]
    expect(longestAbsentStreak(records, 's1', days)).toBe(2)
  })

  it('dayKeys 亂序傳入：仍按真實日期排序計', () => {
    const days = ['2026-05-03', '2026-05-01', '2026-05-02']
    const records = [
      rec('s1', '2026-05-01', 'absent'),
      rec('s1', '2026-05-02', 'absent'),
      rec('s1', '2026-05-03', 'present'),
    ]
    expect(longestAbsentStreak(records, 's1', days)).toBe(2)
  })

  it('只計目標學生（其他生缺席唔影響）', () => {
    const days = ['2026-05-01', '2026-05-02']
    const records = [
      rec('s1', '2026-05-01', 'present'),
      rec('s1', '2026-05-02', 'present'),
      rec('s2', '2026-05-01', 'absent'),
      rec('s2', '2026-05-02', 'absent'),
    ]
    expect(longestAbsentStreak(records, 's1', days)).toBe(0)
    expect(longestAbsentStreak(records, 's2', days)).toBe(2)
  })

  it('範圍外日子忽略（dayKeys 以外唔計入段）', () => {
    // 05-01 absent 喺範圍外；窗口只 05-02..03
    const days = ['2026-05-02', '2026-05-03']
    const records = [
      rec('s1', '2026-05-01', 'absent'),
      rec('s1', '2026-05-02', 'present'),
      rec('s1', '2026-05-03', 'absent'),
    ]
    expect(longestAbsentStreak(records, 's1', days)).toBe(1)
  })
})

// ───────── lastPresentKey ─────────
describe('lastPresentKey（最後一次出席日）', () => {
  it('空 records → null', () => {
    expect(lastPresentKey([], 's1', ['2026-05-01'])).toBeNull()
  })

  it('從未出席（全 absent）→ null', () => {
    const days = ['2026-05-01', '2026-05-02']
    const records = [
      rec('s1', '2026-05-01', 'absent'),
      rec('s1', '2026-05-02', 'absent'),
    ]
    expect(lastPresentKey(records, 's1', days)).toBeNull()
  })

  it('present / late 都當「有返學」，取最新一日', () => {
    const days = ['2026-05-01', '2026-05-02', '2026-05-03']
    const records = [
      rec('s1', '2026-05-01', 'present'),
      rec('s1', '2026-05-02', 'late'), // 最新一次「有返」
      rec('s1', '2026-05-03', 'absent'),
    ]
    expect(lastPresentKey(records, 's1', days)).toBe('2026-05-02')
  })

  it('亂序 dayKeys：仍返真實最新出席日', () => {
    const days = ['2026-05-02', '2026-05-03', '2026-05-01']
    const records = [
      rec('s1', '2026-05-01', 'present'),
      rec('s1', '2026-05-03', 'present'),
    ]
    expect(lastPresentKey(records, 's1', days)).toBe('2026-05-03')
  })

  it('只計目標學生', () => {
    const days = ['2026-05-01', '2026-05-02']
    const records = [
      rec('s1', '2026-05-01', 'absent'),
      rec('s2', '2026-05-02', 'present'),
    ]
    expect(lastPresentKey(records, 's1', days)).toBeNull()
    expect(lastPresentKey(records, 's2', days)).toBe('2026-05-02')
  })

  it('範圍外嘅出席日唔當（窗口外忽略）', () => {
    const days = ['2026-05-02', '2026-05-03']
    const records = [
      rec('s1', '2026-05-01', 'present'), // 範圍外
      rec('s1', '2026-05-02', 'absent'),
      rec('s1', '2026-05-03', 'absent'),
    ]
    expect(lastPresentKey(records, 's1', days)).toBeNull()
  })
})

// ───────── summarizeNotes ─────────
describe('summarizeNotes（聚合出席細項）', () => {
  it('空陣列 → 全 0、lateMinutesAvg = null（唔除零）', () => {
    const s = summarizeNotes([])
    expect(s.byKind).toEqual({ sick: 0, personal: 0, official: 0, unexcused: 0 })
    expect(s.excusedCount).toBe(0)
    expect(s.unexcusedCount).toBe(0)
    expect(s.lateLoggedCount).toBe(0)
    expect(s.lateMinutesTotal).toBe(0)
    expect(s.lateMinutesAvg).toBeNull()
    expect(Number.isNaN(s.lateMinutesAvg as unknown as number)).toBe(false)
    expect(s.earlyLeaveCount).toBe(0)
  })

  it('缺席類別計數 + 准假 / 無故彙總', () => {
    const s = summarizeNotes([
      note({ absenceKind: 'sick' }),
      note({ absenceKind: 'sick' }),
      note({ absenceKind: 'personal' }),
      note({ absenceKind: 'official' }),
      note({ absenceKind: 'unexcused' }),
      note({}), // 無類別 → 唔計
    ])
    expect(s.byKind).toEqual({ sick: 2, personal: 1, official: 1, unexcused: 1 })
    expect(s.excusedCount).toBe(4) // sick2 + personal1 + official1
    expect(s.unexcusedCount).toBe(1)
  })

  it('遲到分鐘：總和 + 平均（只計有填者）', () => {
    const s = summarizeNotes([
      note({ lateMinutes: 10 }),
      note({ lateMinutes: 20 }),
      note({ lateMinutes: 30 }),
    ])
    expect(s.lateLoggedCount).toBe(3)
    expect(s.lateMinutesTotal).toBe(60)
    expect(s.lateMinutesAvg).toBe(20)
  })

  it('平均四捨五入（10 + 15 = 25 / 2 = 12.5 → 13）', () => {
    const s = summarizeNotes([note({ lateMinutes: 10 }), note({ lateMinutes: 15 })])
    expect(s.lateMinutesAvg).toBe(13)
  })

  it('lateMinutes 為 0 / undefined 唔當有填（避免拉低平均）', () => {
    const s = summarizeNotes([
      note({ lateMinutes: 0 }),
      note({ lateMinutes: undefined }),
      note({ lateMinutes: 12 }),
    ])
    expect(s.lateLoggedCount).toBe(1)
    expect(s.lateMinutesTotal).toBe(12)
    expect(s.lateMinutesAvg).toBe(12)
  })

  it('早退計數獨立於缺席 / 遲到', () => {
    const s = summarizeNotes([
      note({ earlyLeave: true }),
      note({ earlyLeave: true, absenceKind: 'sick' }),
      note({ earlyLeave: false }),
      note({}),
    ])
    expect(s.earlyLeaveCount).toBe(2)
  })

  it('混合 note：各維度互不干擾', () => {
    const s = summarizeNotes([
      note({ absenceKind: 'sick', reason: '感冒' }),
      note({ lateMinutes: 5, earlyLeave: true }),
      note({ absenceKind: 'unexcused' }),
    ])
    expect(s.byKind.sick).toBe(1)
    expect(s.unexcusedCount).toBe(1)
    expect(s.lateLoggedCount).toBe(1)
    expect(s.lateMinutesAvg).toBe(5)
    expect(s.earlyLeaveCount).toBe(1)
  })
})
