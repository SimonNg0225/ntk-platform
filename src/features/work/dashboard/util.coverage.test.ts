import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  buildTaskTrend,
  buildHeat,
  buildClassProgress,
  buildGradeSummary,
  type MergedTask,
} from './util'
import type { Klass, ClassProgress, Assessment, Score } from '../../../data/types'

// ============================================================
//  補充測試：未覆蓋純函式 + 揭發疑似計算 bug
//  ------------------------------------------------------------
//  buildTaskTrend / buildHeat 依賴 localKey(new Date())（不純），
//  需 vi.useFakeTimers 鎖死「今日」先可確定斷言。
//  本 repo 慣用本地時區 key，故 setSystemTime 用本地建構 Date。
// ============================================================

const mtask = (over: Partial<MergedTask> & { id: string }): MergedTask => ({
  text: 't',
  done: false,
  createdAt: '2026-05-01T08:00:00.000Z',
  priority: 4,
  ...over,
})

// ============================================================
//  buildTaskTrend（近 N 日 新增 / 完成 計數，倒序窗口）
//  鎖今日 = 本地 2026-05-15 10:00
// ============================================================
describe('buildTaskTrend', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 15, 10, 0, 0)) // 本地 2026-05-15
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('空 tasks → 全 0，但長度 = days 且窗口倒序（最舊→今日）', () => {
    const out = buildTaskTrend([], 7)
    expect(out).toHaveLength(7)
    // i = days-1..0 → addKey(today,-(days-1)) .. addKey(today,0)
    expect(out.map((p) => p.key)).toEqual([
      '2026-05-09',
      '2026-05-10',
      '2026-05-11',
      '2026-05-12',
      '2026-05-13',
      '2026-05-14',
      '2026-05-15',
    ])
    expect(out.map((p) => p.created)).toEqual([0, 0, 0, 0, 0, 0, 0])
    expect(out.map((p) => p.completed)).toEqual([0, 0, 0, 0, 0, 0, 0])
  })

  it('label = 日（去前導零）', () => {
    const out = buildTaskTrend([], 7)
    expect(out.map((p) => p.label)).toEqual(['9', '10', '11', '12', '13', '14', '15'])
  })

  it('days=0 → 空陣列', () => {
    expect(buildTaskTrend([], 0)).toEqual([])
  })

  it('days=1 → 只今日', () => {
    const out = buildTaskTrend([], 1)
    expect(out).toHaveLength(1)
    expect(out[0].key).toBe('2026-05-15')
  })

  it('created 按 createdAt 入桶（取前 10 字日 key）；窗口外不計', () => {
    const tasks: MergedTask[] = [
      mtask({ id: 'a', createdAt: '2026-05-13T08:00:00.000Z' }),
      mtask({ id: 'b', createdAt: '2026-05-15T23:59:00.000Z' }), // 今日尾仍同日
      mtask({ id: 'c', createdAt: '2026-05-01T08:00:00.000Z' }), // 窗口外（早過 05-09）
    ]
    const out = buildTaskTrend(tasks, 7)
    expect(out.find((p) => p.key === '2026-05-13')!.created).toBe(1)
    expect(out.find((p) => p.key === '2026-05-15')!.created).toBe(1)
    // 窗口外總和應為 2（只計 a、b）
    expect(out.reduce((s, p) => s + p.created, 0)).toBe(2)
  })

  it('completed 只計 done && completedAt；done=false 但有 completedAt：created 計、completed 不計', () => {
    const tasks: MergedTask[] = [
      // 未完成但有 completedAt（殘留）：created 入 05-14、completed 不入
      mtask({ id: 'a', createdAt: '2026-05-14T08:00:00.000Z', done: false, completedAt: '2026-05-14T09:00:00.000Z' }),
      // 已完成：created 入 05-12、completed 入 05-14
      mtask({ id: 'b', createdAt: '2026-05-12T08:00:00.000Z', done: true, completedAt: '2026-05-14T10:00:00.000Z' }),
    ]
    const out = buildTaskTrend(tasks, 7)
    expect(out.find((p) => p.key === '2026-05-14')!.created).toBe(1)
    expect(out.find((p) => p.key === '2026-05-12')!.created).toBe(1)
    // 只 b 完成於 05-14
    expect(out.find((p) => p.key === '2026-05-14')!.completed).toBe(1)
    expect(out.reduce((s, p) => s + p.completed, 0)).toBe(1)
  })

  it('completedAt 在窗口外不計入 completed', () => {
    const tasks: MergedTask[] = [
      mtask({ id: 'a', createdAt: '2026-05-15T08:00:00.000Z', done: true, completedAt: '2026-05-01T10:00:00.000Z' }),
    ]
    const out = buildTaskTrend(tasks, 7)
    expect(out.reduce((s, p) => s + p.completed, 0)).toBe(0)
  })

  it('同日多件累加（created / completed 各自累加）', () => {
    const tasks: MergedTask[] = [
      mtask({ id: 'a', createdAt: '2026-05-15T08:00:00.000Z', done: true, completedAt: '2026-05-15T08:30:00.000Z' }),
      mtask({ id: 'b', createdAt: '2026-05-15T09:00:00.000Z', done: true, completedAt: '2026-05-15T09:30:00.000Z' }),
    ]
    const out = buildTaskTrend(tasks, 7)
    const today = out.find((p) => p.key === '2026-05-15')!
    expect(today.created).toBe(2)
    expect(today.completed).toBe(2)
  })
})

// ============================================================
//  buildHeat（近 N 日完成件數熱力，倒序窗口）
//  鎖今日 = 本地 2026-05-15 10:00
// ============================================================
describe('buildHeat', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 15, 10, 0, 0))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('空 tasks → 全 0、長度 = days、窗口倒序', () => {
    const out = buildHeat([], 5)
    expect(out).toHaveLength(5)
    expect(out.map((c) => c.key)).toEqual([
      '2026-05-11',
      '2026-05-12',
      '2026-05-13',
      '2026-05-14',
      '2026-05-15',
    ])
    expect(out.map((c) => c.count)).toEqual([0, 0, 0, 0, 0])
  })

  it('days=0 → 空陣列', () => {
    expect(buildHeat([], 0)).toEqual([])
  })

  it('只計 done && completedAt（未完成 / 無 completedAt 不計）', () => {
    const tasks: MergedTask[] = [
      mtask({ id: 'a', done: true, completedAt: '2026-05-14T08:00:00.000Z' }),
      mtask({ id: 'b', done: false, completedAt: '2026-05-14T09:00:00.000Z' }), // 未完成不計
      mtask({ id: 'c', done: true }), // 無 completedAt 不計
    ]
    const out = buildHeat(tasks, 5)
    expect(out.find((c) => c.key === '2026-05-14')!.count).toBe(1)
    expect(out.reduce((s, c) => s + c.count, 0)).toBe(1)
  })

  it('窗口外完成不計入', () => {
    const tasks: MergedTask[] = [
      mtask({ id: 'a', done: true, completedAt: '2026-05-01T08:00:00.000Z' }), // 早過 05-11
    ]
    const out = buildHeat(tasks, 5)
    expect(out.reduce((s, c) => s + c.count, 0)).toBe(0)
  })

  it('同日多件累加（取前 10 字日 key）', () => {
    const tasks: MergedTask[] = [
      mtask({ id: 'a', done: true, completedAt: '2026-05-15T08:00:00.000Z' }),
      mtask({ id: 'b', done: true, completedAt: '2026-05-15T23:59:00.000Z' }), // 仍同日
      mtask({ id: 'c', done: true, completedAt: '2026-05-15T12:00:00.000Z' }),
    ]
    const out = buildHeat(tasks, 5)
    expect(out.find((c) => c.key === '2026-05-15')!.count).toBe(3)
  })
})

// ============================================================
//  Bug #1 [high]：buildClassProgress percent 冇 clamp 上限
//  ------------------------------------------------------------
//  done = 該班 status==='done' 列數；total = totalTopics（全域）。
//  當 done > totalTopics（刪 topic 但 progress 殘留），percent 應 clamp 100，
//  done 顯示亦應 <= total。修前會見 167%。
// ============================================================
describe('buildClassProgress — percent / done 應 clamp（揭發 Bug #1）', () => {
  const classes: Klass[] = [{ id: 'c1', name: '5A', subject: 'BAFS' }]

  it('done(5) > totalTopics(3)：percent clamp 至 100、done 顯示 clamp 至 total', () => {
    const progress: ClassProgress[] = [
      { id: 'p1', classId: 'c1', topicId: 't1', status: 'done' },
      { id: 'p2', classId: 'c1', topicId: 't2', status: 'done' },
      { id: 'p3', classId: 'c1', topicId: 't3', status: 'done' },
      { id: 'p4', classId: 'c1', topicId: 't4', status: 'done' },
      { id: 'p5', classId: 'c1', topicId: 't5', status: 'done' },
    ]
    const rows = buildClassProgress(classes, progress, 3)
    expect(rows[0].total).toBe(3)
    // 防 UI 顯示「5/3（167%）」：percent 上限 100、done 不超 total
    expect(rows[0].percent).toBe(100)
    expect(rows[0].done).toBeLessThanOrEqual(rows[0].total)
    expect(rows[0].done).toBe(3)
  })

  it('正常 done(2) <= total(4)：percent 不受 clamp 影響、done 原值', () => {
    const progress: ClassProgress[] = [
      { id: 'p1', classId: 'c1', topicId: 't1', status: 'done' },
      { id: 'p2', classId: 'c1', topicId: 't2', status: 'done' },
      { id: 'p3', classId: 'c1', topicId: 't3', status: 'in_progress' },
    ]
    const rows = buildClassProgress(classes, progress, 4)
    expect(rows[0]).toMatchObject({ done: 2, inProgress: 1, total: 4, percent: 50 })
  })

  it('done = total：percent 剛好 100、done = total', () => {
    const progress: ClassProgress[] = [
      { id: 'p1', classId: 'c1', topicId: 't1', status: 'done' },
      { id: 'p2', classId: 'c1', topicId: 't2', status: 'done' },
    ]
    const rows = buildClassProgress(classes, progress, 2)
    expect(rows[0].percent).toBe(100)
    expect(rows[0].done).toBe(2)
  })
})

// ============================================================
//  Bug #2 [med]：buildGradeSummary 揀「最近評估」混合比較
//  不同長度日期字串（date 10 字 vs createdAt ISO）。
//  ------------------------------------------------------------
//  同一日曆日下，ISO 字串字典序排喺裸 date 之後，
//  令「只有 createdAt（無 date）」嗰份被當成更新而誤選。
//  正確：用日 key（slice 0..10）統一比較。
// ============================================================
describe('buildGradeSummary — 同日 date vs createdAt 揀選（揭發 Bug #2）', () => {
  const asmt = (over: Partial<Assessment> & { id: string }): Assessment => ({
    classId: 'c1',
    name: '測驗',
    type: '測驗',
    maxScore: 100,
    createdAt: '2026-05-01T00:00:00.000Z',
    ...over,
  })
  const sc = (assessmentId: string, score: number | null, id = assessmentId + score): Score => ({
    id,
    assessmentId,
    studentId: 's',
    score,
  })

  it('A 有 date=2026-05-10、B 只有 createdAt=2026-05-10T08:00（同曆日）→ 應揀 A（有明確 date）', () => {
    const assessments = [
      asmt({ id: 'A', date: '2026-05-10', createdAt: '2026-05-10T00:00:00.000Z' }),
      asmt({ id: 'B', date: undefined, createdAt: '2026-05-10T08:00:00.000Z' }),
    ]
    // A 全部 90 分、B 全部 30 分；揀啱 A → average 90、揀錯 B → average 30
    const scores = [sc('A', 90, 'a90'), sc('B', 30, 'b30')]
    const out = buildGradeSummary(assessments, scores)
    expect(out.assessment?.id).toBe('A')
    expect(out.average).toBe(90)
    expect(out.graded).toBe(1)
  })

  it('不同曆日仍按日期降序揀最新（B 較新一日）', () => {
    const assessments = [
      asmt({ id: 'A', date: '2026-05-10' }),
      asmt({ id: 'B', date: undefined, createdAt: '2026-05-11T08:00:00.000Z' }),
    ]
    const scores = [sc('A', 90, 'a90'), sc('B', 30, 'b30')]
    const out = buildGradeSummary(assessments, scores)
    expect(out.assessment?.id).toBe('B')
    expect(out.average).toBe(30)
  })

  it('兩份都只有 createdAt：仍揀較新嗰份', () => {
    const assessments = [
      asmt({ id: 'A', date: undefined, createdAt: '2026-05-09T08:00:00.000Z' }),
      asmt({ id: 'B', date: undefined, createdAt: '2026-05-12T08:00:00.000Z' }),
    ]
    const scores = [sc('A', 90, 'a90'), sc('B', 40, 'b40')]
    const out = buildGradeSummary(assessments, scores)
    expect(out.assessment?.id).toBe('B')
    expect(out.average).toBe(40)
  })
})
