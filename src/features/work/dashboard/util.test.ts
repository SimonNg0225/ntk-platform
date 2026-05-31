import { describe, it, expect } from 'vitest'
import {
  localKey,
  addKey,
  daysBetween,
  greeting,
  mergeTasks,
  completionStreak,
  completedInRange,
  todaySlots,
  buildAgenda,
  buildClassProgress,
  overallProgressPercent,
  buildAttendance,
  buildGradeSummary,
  buildWeekLoad,
  buildFollowUps,
  buildCountdowns,
  type MergedTask,
} from './util'
import type {
  Task,
  TimetableSlot,
  Klass,
  CalendarEvent,
  CalendarCategory,
  AttendanceRecord,
  Score,
  Assessment,
  ClassProgress,
  ParentComm,
  Countdown,
} from '../../../data/types'
import type { TaskMeta } from '../todo/types'
import type { ClassProgressRow, HeatCell } from './types'

// ───────── 小工具：砌測試資料（只填關心嘅欄位）─────────
const meta = (over: Partial<TaskMeta> & { id: string }): TaskMeta => ({
  priority: 4,
  tags: [],
  order: 0,
  updatedAt: '2026-05-01T00:00:00.000Z',
  ...over,
})

const mtask = (over: Partial<MergedTask> & { id: string }): MergedTask => ({
  text: 't',
  done: false,
  createdAt: '2026-05-01T08:00:00.000Z',
  priority: 4,
  ...over,
})

const heat = (counts: number[]): HeatCell[] =>
  counts.map((count, i) => ({ key: `2026-05-${String(i + 1).padStart(2, '0')}`, count }))

// ============================================================
//  日期 key（本地時區，無 UTC off-by-one）
// ============================================================
describe('localKey（本地日期，非 UTC）', () => {
  it('用本地年月日，唔受時區漂移影響', () => {
    // 本地 2026-05-04 00:00 —— 喺 UTC+ 區唔可以變成 05-03
    expect(localKey(new Date(2026, 4, 4))).toBe('2026-05-04')
    // 本地當日 23:30 仍然係同一日
    expect(localKey(new Date(2026, 4, 4, 23, 30))).toBe('2026-05-04')
    // 個位數月 / 日要補零
    expect(localKey(new Date(2026, 0, 9))).toBe('2026-01-09')
    expect(localKey(new Date(2026, 11, 31))).toBe('2026-12-31')
  })
})

describe('addKey（加減日，跨月跨年跨閏）', () => {
  it('普通加減', () => {
    expect(addKey('2026-05-04', 1)).toBe('2026-05-05')
    expect(addKey('2026-05-04', 0)).toBe('2026-05-04')
    expect(addKey('2026-05-04', -3)).toBe('2026-05-01')
  })
  it('跨月', () => {
    expect(addKey('2026-01-31', 1)).toBe('2026-02-01')
    expect(addKey('2026-03-01', -1)).toBe('2026-02-28') // 2026 非閏年
  })
  it('跨年', () => {
    expect(addKey('2026-12-31', 1)).toBe('2027-01-01')
    expect(addKey('2026-01-01', -1)).toBe('2025-12-31')
  })
  it('閏年 2 月', () => {
    expect(addKey('2024-03-01', -1)).toBe('2024-02-29')
    expect(addKey('2024-02-28', 1)).toBe('2024-02-29')
  })
})

describe('daysBetween（本地日差，無時區漂移）', () => {
  it('正向 / 零 / 負向', () => {
    expect(daysBetween('2026-05-01', '2026-05-04')).toBe(3)
    expect(daysBetween('2026-05-04', '2026-05-04')).toBe(0)
    expect(daysBetween('2026-05-31', '2026-05-01')).toBe(-30)
  })
  it('跨年（2026 全年 = 364 日差）', () => {
    expect(daysBetween('2026-01-01', '2026-12-31')).toBe(364)
  })
  it('跨 DST 邊界仍然係整數日（round 兜底）', () => {
    // 美國 2026-03-08 spring forward；本地日差應為 2
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2)
  })
})

describe('greeting（時段問候）', () => {
  it('邊界：0/5 夜深、6/11 早晨、12/17 午安、18/23 晚安', () => {
    expect(greeting(0)).toBe('夜深了')
    expect(greeting(5)).toBe('夜深了')
    expect(greeting(6)).toBe('早晨')
    expect(greeting(11)).toBe('早晨')
    expect(greeting(12)).toBe('午安')
    expect(greeting(17)).toBe('午安')
    expect(greeting(18)).toBe('晚安')
    expect(greeting(23)).toBe('晚安')
  })
})

// ============================================================
//  待辦：合併 meta
// ============================================================
describe('mergeTasks（task + sidecar meta）', () => {
  const tasks: Task[] = [
    { id: 'a', text: '甲', done: false, createdAt: '2026-05-01T08:00:00.000Z' },
    { id: 'b', text: '乙', done: true, createdAt: '2026-05-02T08:00:00.000Z' },
  ]
  it('有 meta 取 meta，無 meta priority 預設 4', () => {
    const metas: TaskMeta[] = [
      meta({ id: 'a', priority: 1, due: '2026-05-10', completedAt: undefined }),
    ]
    const out = mergeTasks(tasks, metas)
    expect(out).toEqual([
      {
        id: 'a',
        text: '甲',
        done: false,
        createdAt: '2026-05-01T08:00:00.000Z',
        due: '2026-05-10',
        priority: 1,
        completedAt: undefined,
      },
      {
        id: 'b',
        text: '乙',
        done: true,
        createdAt: '2026-05-02T08:00:00.000Z',
        due: undefined,
        priority: 4,
        completedAt: undefined,
      },
    ])
  })
  it('空 meta：全部 priority=4、無 due', () => {
    const out = mergeTasks(tasks, [])
    expect(out.map((t) => t.priority)).toEqual([4, 4])
    expect(out.every((t) => t.due === undefined)).toBe(true)
  })
  it('空 tasks → 空陣列', () => {
    expect(mergeTasks([], [meta({ id: 'x' })])).toEqual([])
  })
})

// ============================================================
//  完成 streak（連續完成日數）
// ============================================================
describe('completionStreak', () => {
  it('連續完成日數（由尾算起）', () => {
    // 兩日前=1、一日前=1、今日=1 → streak 3
    expect(completionStreak(heat([1, 1, 1]))).toBe(3)
  })
  it('今日未做唔斷 streak（只跳過今日）', () => {
    // 一日前 1、今日 0 → 今日跳過、一日前 1 → streak 1
    expect(completionStreak(heat([1, 1, 0]))).toBe(2)
    expect(completionStreak(heat([0, 1, 0]))).toBe(1)
  })
  it('今日已做但之前斷咗 → 由今日起計', () => {
    // 今日 1、一日前 0（中斷）→ streak 1
    expect(completionStreak(heat([1, 0, 1]))).toBe(1)
  })
  it('全 0 → 0', () => {
    expect(completionStreak(heat([0, 0, 0]))).toBe(0)
  })
  it('空陣列 → 0', () => {
    expect(completionStreak([])).toBe(0)
  })
  it('單格今日有做 → 1；單格今日無做 → 0', () => {
    expect(completionStreak(heat([1]))).toBe(1)
    expect(completionStreak(heat([0]))).toBe(0)
  })
})

// ============================================================
//  區間完成數（週對比）
// ============================================================
describe('completedInRange', () => {
  const tasks: MergedTask[] = [
    mtask({ id: '1', done: true, completedAt: '2026-05-01T09:00:00.000Z' }),
    mtask({ id: '2', done: true, completedAt: '2026-05-04T23:59:00.000Z' }),
    mtask({ id: '3', done: true, completedAt: '2026-05-08T00:00:00.000Z' }),
    mtask({ id: '4', done: false, completedAt: '2026-05-04T09:00:00.000Z' }), // 未完成不計
    mtask({ id: '5', done: true }), // 無 completedAt 不計
  ]
  it('閉區間（含首尾日）', () => {
    // 05-01..05-04：#1、#2 → 2
    expect(completedInRange(tasks, '2026-05-01', '2026-05-04')).toBe(2)
  })
  it('端點包含（completedAt 取前 10 字做日 key）', () => {
    // 05-04..05-08：#2、#3 → 2
    expect(completedInRange(tasks, '2026-05-04', '2026-05-08')).toBe(2)
  })
  it('區間外 → 0', () => {
    expect(completedInRange(tasks, '2026-06-01', '2026-06-30')).toBe(0)
  })
})

// ============================================================
//  今日課堂（依星期過濾 + 按節排序）
// ============================================================
describe('todaySlots', () => {
  const tt: TimetableSlot[] = [
    { id: 's1', day: 1, period: 3, subject: 'A' },
    { id: 's2', day: 1, period: 1, subject: 'B' },
    { id: 's3', day: 2, period: 1, subject: 'C' },
  ]
  it('過濾當日 + 按 period 升序', () => {
    const out = todaySlots(tt, 1)
    expect(out.map((s) => s.id)).toEqual(['s2', 's1'])
  })
  it('當日無堂 → 空（如星期日 jsDay=0）', () => {
    expect(todaySlots(tt, 0)).toEqual([])
  })
  it('唔會改動原陣列（slice 副本）', () => {
    const before = tt.map((s) => s.id)
    todaySlots(tt, 1)
    expect(tt.map((s) => s.id)).toEqual(before)
  })
})

// ============================================================
//  今日議程（合併課堂 / 事件 / 到期待辦 / 倒數，按 sortKey 排）
// ============================================================
describe('buildAgenda', () => {
  const todayKey = '2026-05-04' // 星期一 → jsDay 1
  const jsDay = 1
  const base = {
    timetable: [] as TimetableSlot[],
    classNameById: new Map<string, string>(),
    events: [] as CalendarEvent[],
    calendars: [] as CalendarCategory[],
    tasks: [] as MergedTask[],
    countdowns: [] as Countdown[],
    todayKey,
    jsDay,
  }

  it('空輸入 → 空議程', () => {
    expect(buildAgenda(base)).toEqual([])
  })

  it('課堂：節 → 時間（08:00 起每節一小時）+ sortKey', () => {
    const items = buildAgenda({
      ...base,
      timetable: [{ id: 't1', day: 1, period: 1, subject: '數', room: 'R1' }],
      classNameById: new Map([['c1', '5A']]),
    })
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      kind: 'class',
      time: '08:00',
      sortKey: 480, // 8*60
      badge: 'R1',
    })
  })

  it('第 3 節 = 10:00（sortKey 600）', () => {
    const items = buildAgenda({
      ...base,
      timetable: [{ id: 't3', day: 1, period: 3, subject: '英' }],
    })
    expect(items[0].time).toBe('10:00')
    expect(items[0].sortKey).toBe(600)
  })

  it('逾期待辦置頂(sortKey -2)、今日到期置尾(999)、且顯示逾期日數', () => {
    const items = buildAgenda({
      ...base,
      tasks: [
        mtask({ id: 'od', text: '逾期', due: '2026-05-01' }), // 逾期 3 日
        mtask({ id: 'tdy', text: '今日', due: '2026-05-04' }),
        mtask({ id: 'fut', text: '將來', due: '2026-05-10' }), // > today 唔列
        mtask({ id: 'dn', text: '已完成', due: '2026-05-01', done: true }), // done 唔列
      ],
    })
    expect(items.map((i) => i.title)).toEqual(['逾期', '今日'])
    const overdue = items.find((i) => i.title === '逾期')!
    expect(overdue.sortKey).toBe(-2)
    expect(overdue.overdue).toBe(true)
    expect(overdue.subtitle).toBe('逾期 3 日')
    const today = items.find((i) => i.title === '今日')!
    expect(today.sortKey).toBe(999)
    expect(today.overdue).toBe(false)
  })

  it('事件：learning 過濾走，全日 sortKey=-1', () => {
    const events: CalendarEvent[] = [
      { id: 'e1', title: '工作會議', date: todayKey, time: '09:30', mode: 'work' },
      { id: 'e2', title: '全日活動', date: todayKey, allDay: true, mode: 'both' },
      { id: 'e3', title: '學習事件', date: todayKey, time: '11:00', mode: 'learning' },
    ]
    const items = buildAgenda({ ...base, events })
    const titles = items.map((i) => i.title)
    expect(titles).toContain('工作會議')
    expect(titles).toContain('全日活動')
    expect(titles).not.toContain('學習事件')
    expect(items.find((i) => i.title === '工作會議')!.sortKey).toBe(570) // 9*60+30
    expect(items.find((i) => i.title === '全日活動')!.sortKey).toBe(-1)
  })

  it('倒數：learning 過濾走，只計今日，sortKey 依時間', () => {
    const countdowns: Countdown[] = [
      { id: 'c1', title: '今日倒數', date: todayKey, time: '14:00', mode: 'work', createdAt: '' },
      { id: 'c2', title: '學習倒數', date: todayKey, mode: 'learning', createdAt: '' },
      { id: 'c3', title: '改天倒數', date: '2026-05-05', mode: 'both', createdAt: '' },
    ]
    const items = buildAgenda({ ...base, countdowns })
    expect(items.map((i) => i.title)).toEqual(['今日倒數'])
    expect(items[0].sortKey).toBe(840) // 14*60
  })

  it('整體排序：全日/逾期在前，時間升序，再 title', () => {
    const items = buildAgenda({
      ...base,
      timetable: [{ id: 't1', day: 1, period: 2, subject: '物' }], // 09:00 → 540
      tasks: [mtask({ id: 'od', text: '逾期', due: '2026-05-01' })], // -2
      events: [{ id: 'e2', title: '全日', date: todayKey, allDay: true, mode: 'work' }], // -1
    })
    // -2(逾期) < -1(全日) < 540(課堂)
    expect(items.map((i) => i.sortKey)).toEqual([-2, -1, 540])
  })
})

// ============================================================
//  班級課程進度
// ============================================================
describe('buildClassProgress', () => {
  const classes: Klass[] = [
    { id: 'c1', name: '5A', subject: 'BAFS' },
    { id: 'c2', name: '5B', subject: 'BAFS' },
  ]
  const progress: ClassProgress[] = [
    { id: 'p1', classId: 'c1', topicId: 't1', status: 'done' },
    { id: 'p2', classId: 'c1', topicId: 't2', status: 'done' },
    { id: 'p3', classId: 'c1', topicId: 't3', status: 'in_progress' },
    { id: 'p4', classId: 'c2', topicId: 't1', status: 'not_started' },
  ]
  it('用 totalTopics 做分母計百分比', () => {
    const rows = buildClassProgress(classes, progress, 4)
    // c1: done 2 / 4 = 50%；c2: done 0 / 4 = 0%
    expect(rows).toEqual([
      { id: 'c1', name: '5A', done: 2, inProgress: 1, total: 4, percent: 50 },
      { id: 'c2', name: '5B', done: 0, inProgress: 0, total: 4, percent: 0 },
    ])
  })
  it('totalTopics=0 時退回該班 row 數做分母', () => {
    const rows = buildClassProgress(classes, progress, 0)
    // c1: 3 rows, done 2 → round(2/3*100)=67；c2: 1 row, done 0 → 0
    expect(rows[0]).toMatchObject({ total: 3, percent: 67 })
    expect(rows[1]).toMatchObject({ total: 1, percent: 0 })
  })
  it('班無進度且 totalTopics=0 → 分母 0 → percent 0（無 NaN）', () => {
    const rows = buildClassProgress([{ id: 'c9', name: '6A', subject: 'X' }], [], 0)
    expect(rows[0]).toEqual({ id: 'c9', name: '6A', done: 0, inProgress: 0, total: 0, percent: 0 })
  })
  it('空班 → 空陣列', () => {
    expect(buildClassProgress([], progress, 4)).toEqual([])
  })
})

describe('overallProgressPercent', () => {
  const row = (percent: number): ClassProgressRow => ({
    id: 'x',
    name: 'x',
    done: 0,
    inProgress: 0,
    total: 0,
    percent,
  })
  it('多班平均（四捨五入）', () => {
    // (50+0)/2 = 25
    expect(overallProgressPercent([row(50), row(0)])).toBe(25)
    // (67+0+50)/3 = 39
    expect(overallProgressPercent([row(67), row(0), row(50)])).toBe(39)
  })
  it('空陣列 → 0（無除零）', () => {
    expect(overallProgressPercent([])).toBe(0)
  })
})

// ============================================================
//  出席率
// ============================================================
describe('buildAttendance', () => {
  const recs: AttendanceRecord[] = [
    { id: 'r1', classId: 'c1', studentId: 's1', date: '2026-05-01', status: 'present' },
    { id: 'r2', classId: 'c1', studentId: 's2', date: '2026-05-02', status: 'late' },
    { id: 'r3', classId: 'c1', studentId: 's3', date: '2026-05-03', status: 'absent' },
    { id: 'r4', classId: 'c1', studentId: 's4', date: '2026-04-30', status: 'absent' }, // sinceKey 之前，過濾
  ]
  it('present+late 視為到，計出席率', () => {
    const s = buildAttendance(recs, '2026-05-01')
    // present1 late1 absent1 total3；rate=round(2/3*100)=67
    expect(s).toEqual({ present: 1, late: 1, absent: 1, total: 3, rate: 67 })
  })
  it('sinceKey 過濾（< sinceKey 唔計）', () => {
    const s = buildAttendance(recs, '2026-05-03')
    // 只 r3 absent
    expect(s).toEqual({ present: 0, late: 0, absent: 1, total: 1, rate: 0 })
  })
  it('空記錄 → total 0、rate 0（無除零 NaN）', () => {
    expect(buildAttendance([], '2026-05-01')).toEqual({
      present: 0,
      late: 0,
      absent: 0,
      total: 0,
      rate: 0,
    })
  })
})

// ============================================================
//  成績分布
// ============================================================
describe('buildGradeSummary', () => {
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

  it('無任何有成績評估 → 空 bins / 0', () => {
    const out = buildGradeSummary([asmt({ id: 'a1' })], [])
    expect(out.assessment).toBeUndefined()
    expect(out.graded).toBe(0)
    expect(out.average).toBe(0)
    expect(out.max).toBe(0)
    expect(out.bins.map((b) => b.count)).toEqual([0, 0, 0, 0, 0])
  })

  it('揀最近日期嗰份評估', () => {
    const assessments = [
      asmt({ id: 'old', date: '2026-05-01' }),
      asmt({ id: 'new', date: '2026-05-10' }),
    ]
    const scores = [sc('old', 50), sc('new', 90)]
    const out = buildGradeSummary(assessments, scores)
    expect(out.assessment?.id).toBe('new')
    expect(out.graded).toBe(1)
  })

  it('分數入正確區間（0-19/20-39/40-59/60-79/80-100）', () => {
    // maxScore 100；分數 = 百分比
    const scores = [
      sc('a1', 0, 'x0'), // bin0
      sc('a1', 19, 'x19'), // bin0
      sc('a1', 20, 'x20'), // bin1
      sc('a1', 59, 'x59'), // bin2
      sc('a1', 60, 'x60'), // bin3
      sc('a1', 79, 'x79'), // bin3
      sc('a1', 80, 'x80'), // bin4
      sc('a1', 100, 'x100'), // bin4
    ]
    const out = buildGradeSummary([asmt({ id: 'a1', date: '2026-05-01' })], scores)
    expect(out.bins.map((b) => b.count)).toEqual([2, 1, 1, 2, 2])
    expect(out.graded).toBe(8)
  })

  it('平均百分比四捨五入；maxScore 換算', () => {
    // maxScore 50：score 25 → 50%、score 50 → 100%、score 40 → 80%
    const out = buildGradeSummary(
      [asmt({ id: 'a1', date: '2026-05-01', maxScore: 50 })],
      [sc('a1', 25, 'q25'), sc('a1', 50, 'q50'), sc('a1', 40, 'q40')],
    )
    // pct: 50,100,80 → avg = round(230/3) = 77
    expect(out.average).toBe(77)
    expect(out.max).toBe(50)
    // bin: 50→2, 100→4, 80→4
    expect(out.bins.map((b) => b.count)).toEqual([0, 0, 1, 0, 2])
  })

  it('null 分數唔計入（揀評估 + 統計都跳過）', () => {
    const out = buildGradeSummary(
      [asmt({ id: 'a1', date: '2026-05-01' })],
      [sc('a1', null, 'n1'), sc('a1', 80, 'g1')],
    )
    expect(out.graded).toBe(1)
    expect(out.average).toBe(80)
  })

  it('超出滿分嘅分數 clamp 到 100（唔爆 bin / 唔超 100%）', () => {
    // maxScore 50、score 60 → 120% → clamp 100 → bin4、average 100
    const out = buildGradeSummary(
      [asmt({ id: 'a1', date: '2026-05-01', maxScore: 50 })],
      [sc('a1', 60, 'over')],
    )
    expect(out.average).toBe(100)
    expect(out.bins.map((b) => b.count)).toEqual([0, 0, 0, 0, 1])
  })

  it('maxScore=0 退回 100，唔會除以零變 NaN', () => {
    const out = buildGradeSummary(
      [asmt({ id: 'a1', date: '2026-05-01', maxScore: 0 })],
      [sc('a1', 50, 'z')],
    )
    expect(out.max).toBe(100)
    expect(Number.isNaN(out.average)).toBe(false)
    expect(out.average).toBe(50)
  })
})

// ============================================================
//  本週課擔（每日節數）
// ============================================================
describe('buildWeekLoad', () => {
  const tt: TimetableSlot[] = [
    { id: 's1', day: 1, period: 1, subject: 'A' },
    { id: 's2', day: 1, period: 2, subject: 'B' },
    { id: 's3', day: 3, period: 1, subject: 'C' },
    { id: 's4', day: 0, period: 1, subject: 'D' }, // 星期日：唔顯示
  ]
  it('顯示一～六，每日節數正確，label 對齊', () => {
    const out = buildWeekLoad(tt, 3)
    expect(out.map((d) => d.day)).toEqual([1, 2, 3, 4, 5, 6])
    expect(out.map((d) => d.label)).toEqual(['一', '二', '三', '四', '五', '六'])
    expect(out.map((d) => d.periods)).toEqual([2, 0, 1, 0, 0, 0])
  })
  it('isToday 標記正確（jsDay=3）', () => {
    const out = buildWeekLoad(tt, 3)
    expect(out.find((d) => d.day === 3)!.isToday).toBe(true)
    expect(out.filter((d) => d.isToday)).toHaveLength(1)
  })
  it('jsDay=0（星期日）→ 無一格 isToday', () => {
    const out = buildWeekLoad(tt, 0)
    expect(out.some((d) => d.isToday)).toBe(false)
  })
  it('空時間表 → 全部 0', () => {
    const out = buildWeekLoad([], 1)
    expect(out.map((d) => d.periods)).toEqual([0, 0, 0, 0, 0, 0])
  })
})

// ============================================================
//  待跟進家長（按日期新→舊）
// ============================================================
describe('buildFollowUps', () => {
  const comms: ParentComm[] = [
    { id: 'm1', classId: 'c1', date: '2026-05-01', channel: '電話', summary: 'a', followUp: true, createdAt: '' },
    { id: 'm2', classId: 'c2', date: '2026-05-05', channel: '電郵', summary: 'b', followUp: true, createdAt: '' },
    { id: 'm3', classId: 'c1', date: '2026-05-03', channel: '面談', summary: 'c', followUp: false, createdAt: '' },
  ]
  it('只取 followUp，按日期降序，補班名', () => {
    const out = buildFollowUps(comms, new Map([['c1', '5A']]))
    expect(out.map((r) => r.comm.id)).toEqual(['m2', 'm1'])
    expect(out[0].className).toBe('—') // c2 無對應 → fallback
    expect(out[1].className).toBe('5A')
  })
  it('無 followUp → 空', () => {
    expect(buildFollowUps([comms[2]], new Map())).toEqual([])
  })
})

// ============================================================
//  倒數（work/both、未過期、最近排前）
// ============================================================
describe('buildCountdowns', () => {
  const today = '2026-05-04'
  const cds: Countdown[] = [
    { id: 'c1', title: '今日', date: '2026-05-04', mode: 'work', createdAt: '' }, // 0 日
    { id: 'c2', title: '三日後', date: '2026-05-07', mode: 'both', createdAt: '' }, // 3 日
    { id: 'c3', title: '已過', date: '2026-05-01', mode: 'work', createdAt: '' }, // -3 過濾
    { id: 'c4', title: '學習', date: '2026-05-06', mode: 'learning', createdAt: '' }, // 過濾
    { id: 'c5', title: '無 mode', date: '2026-05-10', createdAt: '' }, // 未標 → 計（mode!==learning）
  ]
  it('過濾 learning / 已過期，按 daysLeft 升序', () => {
    const out = buildCountdowns(cds, today)
    expect(out.map((r) => r.cd.title)).toEqual(['今日', '三日後', '無 mode'])
    expect(out.map((r) => r.daysLeft)).toEqual([0, 3, 6])
  })
  it('今日當日（0 日）要保留（>= 0）', () => {
    const out = buildCountdowns([cds[0]], today)
    expect(out).toHaveLength(1)
    expect(out[0].daysLeft).toBe(0)
  })
  it('空輸入 → 空', () => {
    expect(buildCountdowns([], today)).toEqual([])
  })
})
