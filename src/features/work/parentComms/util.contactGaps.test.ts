import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { ParentComm } from '../../../data/types'
import {
  contactGaps,
  DEFAULT_CONTACT_GAP_DAYS,
  type CommRow,
  type CommMeta,
} from './util'

// ============================================================
//  contactGaps — 需聯絡名單（從未聯絡 / 太耐冇聯絡）純函式
//  ------------------------------------------------------------
//  著重：
//   · 從未聯絡（never）：名冊上有但全無溝通記錄
//   · 太耐冇聯絡（stale）：距上次聯絡 ≥ staleDays（含邊界）
//   · 排序：never 先（按名），再 stale 按 daysSince 大 → 細
//   · 自訂 staleDays
//   · 預設 anchor = 今日（鎖系統時間，deterministic）
//   · 純函式：唔變更原入參
// ============================================================

const comm = (over: Partial<ParentComm> = {}): ParentComm => ({
  id: 'c',
  classId: 'k1',
  date: '2026-05-15',
  channel: '電話',
  summary: '',
  createdAt: '2026-05-15T08:00:00.000Z',
  ...over,
})

const meta = (over: Partial<CommMeta> = {}): CommMeta => ({
  id: 'm',
  commId: 'c',
  updatedAt: '2026-05-15T08:00:00.000Z',
  ...over,
})

const row = (c: Partial<ParentComm> = {}, m?: Partial<CommMeta>): CommRow => ({
  comm: comm(c),
  meta: m ? meta(m) : undefined,
})

describe('contactGaps（傳固定 anchor = 2026-06-01）', () => {
  const anchor = '2026-06-01'

  it('空名冊 → 空陣列', () => {
    expect(contactGaps([], [], {}, anchor)).toEqual([])
  })

  it('名冊上全部從未聯絡 → 全部 never，按名升序', () => {
    const students = [
      { id: 's2', name: '陳大文' },
      { id: 's1', name: '李小明' },
    ]
    const gaps = contactGaps(students, [], {}, anchor)
    expect(gaps).toEqual([
      { studentId: 's1', status: 'never' },
      { studentId: 's2', status: 'never' },
    ])
  })

  it('近期有聯絡（未夠 staleDays）→ 唔出現喺名單', () => {
    const students = [{ id: 's1', name: '李小明' }]
    // 距 anchor 只 1 日，遠遠未夠 30 日
    const gaps = contactGaps(students, [row({ studentId: 's1', date: '2026-05-31' })], {}, anchor)
    expect(gaps).toEqual([])
  })

  it('剛好 = staleDays（邊界含入）→ stale', () => {
    const students = [{ id: 's1', name: '李小明' }]
    // 2026-06-01 − 30 日 = 2026-05-02
    const gaps = contactGaps(students, [row({ studentId: 's1', date: '2026-05-02' })], {}, anchor)
    expect(gaps).toHaveLength(1)
    expect(gaps[0]).toEqual({
      studentId: 's1',
      lastDate: '2026-05-02',
      daysSince: 30,
      status: 'stale',
    })
  })

  it('staleDays − 1（差一日未夠）→ 唔列入', () => {
    const students = [{ id: 's1', name: '李小明' }]
    // 距 anchor 29 日 = 2026-05-03
    const gaps = contactGaps(students, [row({ studentId: 's1', date: '2026-05-03' })], {}, anchor)
    expect(gaps).toEqual([])
  })

  it('never 先（按名），再 stale（按 daysSince 大 → 細）', () => {
    const students = [
      { id: 'stale_near', name: 'A 近' }, // stale 30 日
      { id: 'stale_far', name: 'B 遠' }, // stale 60 日
      { id: 'never_b', name: 'B 未聯絡' },
      { id: 'never_a', name: 'A 未聯絡' },
    ]
    const rows = [
      row({ studentId: 'stale_near', date: '2026-05-02' }), // 30 日前
      row({ studentId: 'stale_far', date: '2026-04-02' }), // 60 日前
    ]
    const gaps = contactGaps(students, rows, {}, anchor)
    // never 先（A < B），再 stale 按 daysSince 大 → 細（遠 60 > 近 30）
    expect(gaps.map((g) => g.studentId)).toEqual([
      'never_a',
      'never_b',
      'stale_far',
      'stale_near',
    ])
    expect(gaps[0].status).toBe('never')
    expect(gaps[2].status).toBe('stale')
    expect(gaps[2].daysSince).toBe(60)
    expect(gaps[3].daysSince).toBe(30)
  })

  it('取每生最近一次溝通計 daysSince（多條記錄取最大日期）', () => {
    const students = [{ id: 's1', name: '李小明' }]
    const rows = [
      row({ studentId: 's1', date: '2026-03-01' }),
      row({ studentId: 's1', date: '2026-04-15' }), // 最近 → 用呢個
      row({ studentId: 's1', date: '2026-02-20' }),
    ]
    const gaps = contactGaps(students, rows, {}, anchor)
    expect(gaps[0].lastDate).toBe('2026-04-15')
    // 2026-06-01 − 2026-04-15 = 47 日
    expect(gaps[0].daysSince).toBe(47)
  })

  it('自訂 staleDays（7 日）', () => {
    const students = [
      { id: 's1', name: '李小明' }, // 10 日前 → stale
      { id: 's2', name: '陳大文' }, // 3 日前 → 唔算
    ]
    const rows = [
      row({ studentId: 's1', date: '2026-05-22' }), // 10 日前
      row({ studentId: 's2', date: '2026-05-29' }), // 3 日前
    ]
    const gaps = contactGaps(students, rows, { staleDays: 7 }, anchor)
    expect(gaps.map((g) => g.studentId)).toEqual(['s1'])
    expect(gaps[0].daysSince).toBe(10)
  })

  it('只計名冊內嘅學生：有記錄但唔喺名冊嘅唔會出現', () => {
    const students = [{ id: 's1', name: '李小明' }]
    const rows = [
      row({ studentId: 's1', date: '2026-04-01' }), // stale
      row({ studentId: 'ghost', date: '2026-04-01' }), // 唔喺名冊
    ]
    const gaps = contactGaps(students, rows, {}, anchor)
    expect(gaps.map((g) => g.studentId)).toEqual(['s1'])
  })

  it('無名嘅學生（name 缺）：never 排序用 id 做穩定 fallback', () => {
    const students = [
      { id: 'z' },
      { id: 'a' },
    ]
    const gaps = contactGaps(students, [], {}, anchor)
    expect(gaps.map((g) => g.studentId)).toEqual(['a', 'z'])
  })

  it('純函式：唔變更原 students / rows', () => {
    const students = [{ id: 's1', name: '李小明' }]
    const rows = [row({ studentId: 's1', date: '2026-04-01' })]
    const sSnap = JSON.parse(JSON.stringify(students))
    const rSnap = JSON.parse(JSON.stringify(rows))
    contactGaps(students, rows, {}, anchor)
    expect(students).toEqual(sSnap)
    expect(rows).toEqual(rSnap)
  })

  it('DEFAULT_CONTACT_GAP_DAYS = 30', () => {
    expect(DEFAULT_CONTACT_GAP_DAYS).toBe(30)
  })
})

// ───────── 預設 anchor = 今日（鎖系統時間，deterministic）─────────
describe('contactGaps（預設 anchor = 今日，fake timers）', () => {
  beforeAll(() => {
    vi.useFakeTimers()
    // 本地正午，避開 UTC / 夏令時邊界
    vi.setSystemTime(new Date(2026, 5, 1, 12, 0, 0)) // 2026-06-01
  })
  afterAll(() => {
    vi.useRealTimers()
  })

  it('唔傳 anchor 時用今日計 daysSince', () => {
    const students = [{ id: 's1', name: '李小明' }]
    // 今日 2026-06-01，上次 2026-05-01 = 31 日前 → stale
    const gaps = contactGaps(students, [row({ studentId: 's1', date: '2026-05-01' })])
    expect(gaps).toHaveLength(1)
    expect(gaps[0].status).toBe('stale')
    expect(gaps[0].daysSince).toBe(31)
  })

  it('唔傳 anchor：近期聯絡唔列入', () => {
    const students = [{ id: 's1', name: '李小明' }]
    const gaps = contactGaps(students, [row({ studentId: 's1', date: '2026-05-30' })])
    expect(gaps).toEqual([])
  })
})
