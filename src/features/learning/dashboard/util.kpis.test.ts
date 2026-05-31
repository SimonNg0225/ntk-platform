// 時區敏感測試：本 repo 慣用「本地時區」key（避 toISOString 的 UTC 漂移）。
// computeKpis / buildDaySignals / streakOf 都依賴 new Date() / Date.now()，
// 用 fake timers 鎖死「今日」；卡 lastReviewed 的 UTC vs 本地日差異要在 UTC+N
// 才睇得到，所以喺 import 前鎖死 TZ = Asia/Hong_Kong（同 bug report 一致，
// 亦係真實香港用家會中招嘅情境）。
// 本 repo tsconfig 無 @types/node，故自行最小宣告 process（只用 env.TZ）。
declare const process: { env: Record<string, string | undefined> }
process.env.TZ = 'Asia/Hong_Kong'

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  computeKpis,
  buildDaySignals,
  streakOf,
  relTime,
  buildActivity,
  dayKey,
  addDays,
  type DashInput,
} from './util'
import type { Card } from '../../../data/types'
import type { FocusLog } from '../focus/types'
import type { JournalDoc } from '../journal/util'
import type { Habit, HabitLog } from '../habits/types'
import type { GoalMeta, Milestone } from '../goals/types'
import type { Goal } from '../../../data/types'
import type { Book } from '../reading/types'

// ───────── 測試工廠（只填會用到嘅欄位，其餘以合理值補齊）─────────
function emptyInput(over: Partial<DashInput> = {}): DashInput {
  return {
    cards: [],
    goals: [],
    goalMeta: [],
    milestones: [],
    books: [],
    focusLogs: [],
    focusProjects: [],
    habits: [],
    habitLogs: [],
    journal: [],
    ...over,
  }
}

function flog(over: Partial<FocusLog>): FocusLog {
  return {
    id: 'f',
    kind: 'focus',
    startedAt: '2026-05-25T08:00:00',
    endedAt: '2026-05-25T08:25:00',
    plannedMin: 25,
    actualMin: 25,
    completed: true,
    ...over,
  }
}

function card(over: Partial<Card>): Card {
  return {
    id: 'c',
    deckId: 'd',
    front: 'front',
    back: 'back',
    ease: 2.5,
    intervalDays: 0,
    repetitions: 0,
    dueDate: '2026-05-31',
    createdAt: '2026-05-01T00:00:00.000Z',
    ...over,
  }
}

function jdoc(over: Partial<JournalDoc>): JournalDoc {
  return {
    id: 'j',
    date: '2026-05-25',
    content: 'hi',
    createdAt: '2026-05-25T10:00:00.000Z',
    updatedAt: '2026-05-25T10:00:00.000Z',
    ...over,
  }
}

function habit(over: Partial<Habit>): Habit {
  return {
    id: 'h',
    name: '習慣',
    color: 'accent',
    frequency: { kind: 'daily' },
    goalKind: 'build',
    targetStreak: 0,
    archived: false,
    order: 0,
    createdAt: '2026-05-01T00:00:00.000Z',
    ...over,
  }
}

function hlog(over: Partial<HabitLog>): HabitLog {
  return { id: 'hl', habitId: 'h', date: '2026-05-31', ...over }
}

function goal(over: Partial<Goal>): Goal {
  return { id: 'g', title: '目標', progress: 0, createdAt: '2026-05-01T00:00:00.000Z', ...over }
}

function meta(over: Partial<GoalMeta>): GoalMeta {
  return { id: 'g', category: 'study', priority: 'medium', status: 'active', ...over }
}

function ms(over: Partial<Milestone>): Milestone {
  return {
    id: 'm',
    goalId: 'g',
    title: 'ms',
    done: false,
    weight: 1,
    order: 0,
    createdAt: '2026-05-01T00:00:00.000Z',
    ...over,
  }
}

function book(over: Partial<Book>): Book {
  return {
    id: 'b',
    title: 'Book',
    status: 'reading',
    shelves: [],
    sessions: [],
    createdAt: '2026-05-01T00:00:00.000Z',
    ...over,
  }
}

// 鎖死「今日」= 2026-05-31（星期日）12:00 本地（HKT）。
// → week0 = today-6 = 2026-05-25；今週窗 = [2026-05-25, 2026-05-31]
// → prevWeekEnd = today-7 = 2026-05-24；prevWeekStart = today-13 = 2026-05-18
//   上週窗 = [2026-05-18, 2026-05-24]（與今週相鄰、唔重疊、無 gap）
const TODAY = new Date(2026, 4, 31, 12, 0, 0)

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(TODAY)
})
afterEach(() => {
  vi.useRealTimers()
})

// ═══════════════════════════════════════════════════════════
//  健全性：fake timer + TZ 鎖死後，窗邊界 key 同預期一致
// ═══════════════════════════════════════════════════════════
describe('測試環境前置（TZ=HKT + fake today=2026-05-31）', () => {
  it('今日 / 週窗 key 與預期一致', () => {
    expect(dayKey(new Date())).toBe('2026-05-31')
    expect(dayKey(addDays(new Date(), -6))).toBe('2026-05-25') // week0
    expect(dayKey(addDays(new Date(), -7))).toBe('2026-05-24') // prevWeekEnd
    expect(dayKey(addDays(new Date(), -13))).toBe('2026-05-18') // prevWeekStart
  })
  it('星期日 = getDay() 0（用嚟驗 daily/weekday 排程）', () => {
    expect(new Date().getDay()).toBe(0)
  })
  it('TZ 鎖死 = HKT（UTC+8）：守護 BUG 測試的前提（否則跨午夜 case 失效）', () => {
    // 若 TZ pin 無生效（譬如 V8 已快取 ambient TZ），呢個守護會即刻紅，
    // 提醒 BUG 1/2 的「UTC vs 本地日」測試前提唔成立。
    const probe = new Date('2026-05-04T17:00:00.000Z')
    expect(probe.getTimezoneOffset()).toBe(-480) // HKT = UTC+8
    expect(dayKey(probe)).toBe('2026-05-05') // UTC 5/4 晚 = 本地 5/5 凌晨
  })
})

// ═══════════════════════════════════════════════════════════
//  streakOf（由今日 / 昨日向前數連續活躍）
// ═══════════════════════════════════════════════════════════
describe('streakOf', () => {
  it('空 Set → 0', () => {
    expect(streakOf(new Set())).toBe(0)
  })

  it('今日活躍 + 昨日活躍 → 含今日往前數 = 2', () => {
    expect(streakOf(new Set(['2026-05-31', '2026-05-30']))).toBe(2)
  })

  it('今日無活躍但昨日活躍 → 由昨日起計（刻意設計） = 2', () => {
    expect(streakOf(new Set(['2026-05-30', '2026-05-29']))).toBe(2)
  })

  it('只有前日活躍（昨日斷層）→ 0', () => {
    // 今日(31)無、昨日(30)無 → 退到昨日仍無 → 0
    expect(streakOf(new Set(['2026-05-29']))).toBe(0)
  })

  it('今日活躍但昨日斷層 → 1（只計今日）', () => {
    expect(streakOf(new Set(['2026-05-31', '2026-05-29']))).toBe(1)
  })

  it('連續長 run（含今日往前 5 日）= 5', () => {
    expect(
      streakOf(
        new Set(['2026-05-31', '2026-05-30', '2026-05-29', '2026-05-28', '2026-05-27']),
      ),
    ).toBe(5)
  })

  it('跨月連續（5/1 → 4/29，今日設為 5/1）', () => {
    vi.setSystemTime(new Date(2026, 4, 1, 12)) // 2026-05-01
    expect(streakOf(new Set(['2026-05-01', '2026-04-30', '2026-04-29']))).toBe(3)
  })
})

// ═══════════════════════════════════════════════════════════
//  buildDaySignals（近 N 日逐日訊號 + 綜合 score）
// ═══════════════════════════════════════════════════════════
describe('buildDaySignals', () => {
  it('days = N 回傳 exactly N 個（含頭尾），最後一個 = 今日', () => {
    const s14 = buildDaySignals(emptyInput(), 14)
    expect(s14).toHaveLength(14)
    expect(s14[13].key).toBe('2026-05-31') // 末格 = 今日
    expect(s14[0].key).toBe('2026-05-18') // 頭格 = today-13
    expect(buildDaySignals(emptyInput(), 1)).toHaveLength(1)
    expect(buildDaySignals(emptyInput(), 30)).toHaveLength(30)
    expect(buildDaySignals(emptyInput(), 90)).toHaveLength(90)
  })

  it('days = 0 → 空陣列（邊界）', () => {
    expect(buildDaySignals(emptyInput(), 0)).toEqual([])
  })

  it('空輸入：每日全 0、score 0、journaled false', () => {
    const s = buildDaySignals(emptyInput(), 7)
    for (const d of s) {
      expect(d.focusMin).toBe(0)
      expect(d.reviews).toBe(0)
      expect(d.habitsDone).toBe(0)
      expect(d.journaled).toBe(false)
      expect(d.score).toBe(0)
    }
  })

  it('label / weekday 由本地日推算（2026-05-31 = 星期日）', () => {
    const s = buildDaySignals(emptyInput(), 1)
    expect(s[0].label).toBe('5/31')
    expect(s[0].weekday).toBe(0)
  })

  it('單一 focus 25 分（completed）→ 該日 focusMin=25、score=1.0', () => {
    const s = buildDaySignals(
      emptyInput({ focusLogs: [flog({ startedAt: '2026-05-31T09:00:00', actualMin: 25 })] }),
      7,
    )
    const today = s[s.length - 1]
    expect(today.focusMin).toBe(25)
    expect(today.score).toBeCloseTo(1.0, 10)
  })

  it('未完成 / 非 focus 嘅 focusLog 唔計入 focusMin', () => {
    const s = buildDaySignals(
      emptyInput({
        focusLogs: [
          flog({ id: 'a', startedAt: '2026-05-31T09:00:00', actualMin: 50, completed: false }),
          flog({ id: 'b', startedAt: '2026-05-31T10:00:00', actualMin: 50, kind: 'short_break' }),
        ],
      }),
      7,
    )
    expect(s[s.length - 1].focusMin).toBe(0)
  })

  it('同日多筆 focus 累加分鐘；同日多筆習慣累加計數', () => {
    const s = buildDaySignals(
      emptyInput({
        focusLogs: [
          flog({ id: 'a', startedAt: '2026-05-31T09:00:00', actualMin: 25 }),
          flog({ id: 'b', startedAt: '2026-05-31T11:00:00', actualMin: 25 }),
        ],
        habitLogs: [
          hlog({ id: 'h1', date: '2026-05-31' }),
          hlog({ id: 'h2', date: '2026-05-31' }),
          hlog({ id: 'h3', date: '2026-05-31' }),
        ],
      }),
      7,
    )
    const today = s[s.length - 1]
    expect(today.focusMin).toBe(50)
    expect(today.habitsDone).toBe(3)
    // score = 50/25 + 0 + 3 + 0 = 5
    expect(today.score).toBeCloseTo(5, 10)
  })

  it('score 公式：focus/25 + reviews/5 + habitsDone + (journaled?1:0)', () => {
    const s = buildDaySignals(
      emptyInput({
        focusLogs: [flog({ startedAt: '2026-05-31T09:00:00', actualMin: 50 })], // 50/25 = 2
        cards: [
          card({ id: 'c1', lastReviewed: '2026-05-31T09:00:00' }),
          card({ id: 'c2', lastReviewed: '2026-05-31T10:00:00' }),
          card({ id: 'c3', lastReviewed: '2026-05-31T11:00:00' }),
          card({ id: 'c4', lastReviewed: '2026-05-31T12:00:00' }),
          card({ id: 'c5', lastReviewed: '2026-05-31T13:00:00' }), // 5 reviews → 5/5 = 1
        ],
        habitLogs: [hlog({ id: 'h1', date: '2026-05-31' })], // +1
        journal: [jdoc({ id: 'j1', date: '2026-05-31' })], // +1
      }),
      7,
    )
    const today = s[s.length - 1]
    expect(today.focusMin).toBe(50)
    expect(today.reviews).toBe(5)
    expect(today.habitsDone).toBe(1)
    expect(today.journaled).toBe(true)
    // 2 + 1 + 1 + 1 = 5
    expect(today.score).toBeCloseTo(5, 10)
  })
})

// ═══════════════════════════════════════════════════════════
//  computeKpis（核心 KPI 彙整）
// ═══════════════════════════════════════════════════════════
describe('computeKpis — 空輸入', () => {
  it('全部回 0 / moodAvg = null', () => {
    const k = computeKpis(emptyInput())
    expect(k.dueCards).toBe(0)
    expect(k.streak).toBe(0)
    expect(k.longestStreak).toBe(0)
    expect(k.focusMinWeek).toBe(0)
    expect(k.focusMinPrevWeek).toBe(0)
    expect(k.reviewsWeek).toBe(0)
    expect(k.reviewsPrevWeek).toBe(0)
    expect(k.focusSessionsWeek).toBe(0)
    expect(k.habitRate).toBe(0)
    expect(k.habitDoneToday).toBe(0)
    expect(k.habitDueToday).toBe(0)
    expect(k.goalsActive).toBe(0)
    expect(k.goalsAvgProgress).toBe(0)
    expect(k.booksReading).toBe(0)
    expect(k.pagesWeek).toBe(0)
    expect(k.journalWeek).toBe(0)
    expect(k.moodAvg).toBeNull()
    expect(k.quizDays).toBe(0)
  })
})

describe('computeKpis — 專注（本週 / 上週 + 節數）', () => {
  it('本週 focus 累加分鐘 + 節數；上週分開計', () => {
    const k = computeKpis(
      emptyInput({
        focusLogs: [
          flog({ id: 'a', startedAt: '2026-05-25T08:00:00', actualMin: 25 }), // week0 邊界（inclusive）
          flog({ id: 'b', startedAt: '2026-05-31T08:00:00', actualMin: 50 }), // today 邊界（inclusive）
          flog({ id: 'c', startedAt: '2026-05-18T08:00:00', actualMin: 30 }), // prevWeekStart 邊界
          flog({ id: 'd', startedAt: '2026-05-24T08:00:00', actualMin: 40 }), // prevWeekEnd 邊界
        ],
      }),
    )
    expect(k.focusMinWeek).toBe(75) // 25 + 50
    expect(k.focusSessionsWeek).toBe(2)
    expect(k.focusMinPrevWeek).toBe(70) // 30 + 40
  })

  it('窗外（today-14 = 2026-05-17）唔計入上週；未完成唔計', () => {
    const k = computeKpis(
      emptyInput({
        focusLogs: [
          flog({ id: 'a', startedAt: '2026-05-17T08:00:00', actualMin: 99 }), // 上週窗前一日 → 唔計
          flog({ id: 'b', startedAt: '2026-05-31T08:00:00', actualMin: 25, completed: false }), // 未完成 → 唔計
        ],
      }),
    )
    expect(k.focusMinWeek).toBe(0)
    expect(k.focusMinPrevWeek).toBe(0)
    expect(k.focusSessionsWeek).toBe(0)
  })
})

describe('computeKpis — 習慣完成率（今日，0-100）', () => {
  it('dueHabits = 0（無排程）→ habitRate = 0（除零防護）', () => {
    const k = computeKpis(
      emptyInput({
        // 2026-05-31 係星期日(0)，呢個習慣只逢星期一(1) → 今日唔 due
        habits: [habit({ id: 'h1', frequency: { kind: 'weekdays', days: [1] } })],
      }),
    )
    expect(k.habitDueToday).toBe(0)
    expect(k.habitRate).toBe(0)
  })

  it('1/3 完成 → 四捨五入 33%', () => {
    const k = computeKpis(
      emptyInput({
        habits: [
          habit({ id: 'h1' }),
          habit({ id: 'h2' }),
          habit({ id: 'h3' }),
        ],
        habitLogs: [hlog({ id: 'l1', habitId: 'h1', date: '2026-05-31' })],
      }),
    )
    expect(k.habitDueToday).toBe(3)
    expect(k.habitDoneToday).toBe(1)
    expect(k.habitRate).toBe(33) // round(33.33) = 33
  })

  it('2/3 完成 → 四捨五入 67%', () => {
    const k = computeKpis(
      emptyInput({
        habits: [habit({ id: 'h1' }), habit({ id: 'h2' }), habit({ id: 'h3' })],
        habitLogs: [
          hlog({ id: 'l1', habitId: 'h1', date: '2026-05-31' }),
          hlog({ id: 'l2', habitId: 'h2', date: '2026-05-31' }),
        ],
      }),
    )
    expect(k.habitRate).toBe(67) // round(66.67) = 67
  })

  it('封存習慣唔計入 due；只計今日（昨日 log 唔算）', () => {
    const k = computeKpis(
      emptyInput({
        habits: [
          habit({ id: 'h1' }),
          habit({ id: 'h2', archived: true }), // 封存 → 唔計
        ],
        habitLogs: [hlog({ id: 'l1', habitId: 'h1', date: '2026-05-30' })], // 昨日 → 唔算今日完成
      }),
    )
    expect(k.habitDueToday).toBe(1)
    expect(k.habitDoneToday).toBe(0)
    expect(k.habitRate).toBe(0)
  })
})

describe('computeKpis — 目標加權平均進度', () => {
  it('無目標 → goalsAvgProgress = 0（除零防護）、goalsActive = 0', () => {
    const k = computeKpis(emptyInput())
    expect(k.goalsActive).toBe(0)
    expect(k.goalsAvgProgress).toBe(0)
  })

  it('里程碑加權（weight 不等）而非單純比例', () => {
    // g1: 里程碑 done(weight 3) + undone(weight 1) → 3/4 = 75%
    // g2: 無里程碑 → fallback progress = 25
    // 平均 = round((75 + 25) / 2) = 50
    const k = computeKpis(
      emptyInput({
        goals: [goal({ id: 'g1' }), goal({ id: 'g2', progress: 25 })],
        goalMeta: [meta({ id: 'g1' }), meta({ id: 'g2' })],
        milestones: [
          ms({ id: 'm1', goalId: 'g1', done: true, weight: 3 }),
          ms({ id: 'm2', goalId: 'g1', done: false, weight: 1 }),
        ],
      }),
    )
    expect(k.goalsActive).toBe(2)
    expect(k.goalsAvgProgress).toBe(50)
  })

  it('封存 / 已完成目標唔計入 active', () => {
    const k = computeKpis(
      emptyInput({
        goals: [goal({ id: 'g1' }), goal({ id: 'g2' }), goal({ id: 'g3' })],
        goalMeta: [
          meta({ id: 'g1', status: 'active' }),
          meta({ id: 'g2', archived: true }),
          meta({ id: 'g3', status: 'done' }),
        ],
      }),
    )
    expect(k.goalsActive).toBe(1)
  })
})

describe('computeKpis — 閱讀（本週頁數 + 在讀本數）', () => {
  it('多本書多 session 累加；session.date 邊界 inclusive；窗外唔計', () => {
    const k = computeKpis(
      emptyInput({
        books: [
          book({
            id: 'b1',
            status: 'reading',
            sessions: [
              { id: 's1', date: '2026-05-25', pages: 10 }, // week0 邊界 inclusive
              { id: 's2', date: '2026-05-31', pages: 20 }, // today 邊界 inclusive
              { id: 's3', date: '2026-05-24', pages: 99 }, // 窗外（上週）→ 唔計
            ],
          }),
          book({
            id: 'b2',
            status: 'done',
            sessions: [{ id: 's4', date: '2026-05-28', pages: 5 }],
          }),
        ],
      }),
    )
    expect(k.pagesWeek).toBe(35) // 10 + 20 + 5
    expect(k.booksReading).toBe(1) // 只有 b1 status=reading
  })
})

describe('computeKpis — 日誌（本週篇數 + 近 7 日平均心情）', () => {
  it('本週篇數計窗內；moodAvg 一位小數', () => {
    const k = computeKpis(
      emptyInput({
        journal: [
          jdoc({ id: 'j1', date: '2026-05-25', mood: '😀' }), // score 5（邊界 inclusive）
          jdoc({ id: 'j2', date: '2026-05-31', mood: '😐' }), // score 3（邊界 inclusive）
          jdoc({ id: 'j3', date: '2026-05-24', mood: '😀' }), // 窗外 → 唔計
          jdoc({ id: 'j4', date: '2026-05-28' }), // 無 mood → 計篇數唔計心情
        ],
      }),
    )
    expect(k.journalWeek).toBe(3) // j1, j2, j4（窗內）
    // moodAvg = round((5 + 3) / 2 * 10) / 10 = 4
    expect(k.moodAvg).toBe(4)
  })

  it('窗內全無心情 → moodAvg = null（除零防護）', () => {
    const k = computeKpis(
      emptyInput({ journal: [jdoc({ id: 'j1', date: '2026-05-26' })] }),
    )
    expect(k.journalWeek).toBe(1)
    expect(k.moodAvg).toBeNull()
  })
})

describe('computeKpis — 到期卡 + streak/longestStreak 串接', () => {
  it('dueCards 用 isDue（dueDate <= 今日 UTC slice）', () => {
    const k = computeKpis(
      emptyInput({
        cards: [
          card({ id: 'c1', dueDate: '2026-05-31' }), // = 今日 → due
          card({ id: 'c2', dueDate: '2026-05-30' }), // 過期 → due
          card({ id: 'c3', dueDate: '2026-06-30' }), // 未到期 → 唔 due
        ],
      }),
    )
    expect(k.dueCards).toBe(2)
  })

  it('streak / longestStreak 由四源彙整活躍日推算', () => {
    const k = computeKpis(
      emptyInput({
        // 連續 2 日（今日 + 昨日）有活動 → streak 2
        focusLogs: [flog({ id: 'f1', startedAt: '2026-05-31T09:00:00' })],
        habitLogs: [hlog({ id: 'l1', habitId: 'h1', date: '2026-05-30' })],
        // 歷史最長：5/10,5/11,5/12 連續 3 日
        journal: [
          jdoc({ id: 'j1', date: '2026-05-10' }),
          jdoc({ id: 'j2', date: '2026-05-11' }),
          jdoc({ id: 'j3', date: '2026-05-12' }),
        ],
      }),
    )
    expect(k.streak).toBe(2)
    expect(k.longestStreak).toBe(3)
  })
})

// ═══════════════════════════════════════════════════════════
//  relTime（相對時間）
// ═══════════════════════════════════════════════════════════
describe('relTime', () => {
  it('< 1 分鐘 → 啱啱', () => {
    expect(relTime(new Date(TODAY.getTime() - 30 * 1000).toISOString())).toBe('啱啱')
  })
  it('59 分鐘前 / 60 分鐘 = 1 小時邊界', () => {
    expect(relTime(new Date(TODAY.getTime() - 59 * 60000).toISOString())).toBe('59 分鐘前')
    expect(relTime(new Date(TODAY.getTime() - 60 * 60000).toISOString())).toBe('1 小時前')
  })
  it('23 小時 / 24 小時 = 1 日邊界', () => {
    expect(relTime(new Date(TODAY.getTime() - 23 * 3600000).toISOString())).toBe('23 小時前')
    expect(relTime(new Date(TODAY.getTime() - 24 * 3600000).toISOString())).toBe('1 日前')
  })
  it('29 日前（仍以「N 日前」顯示）', () => {
    expect(relTime(new Date(TODAY.getTime() - 29 * 86400000).toISOString())).toBe('29 日前')
  })
  it('30 日或以上 → 顯示月日（fromKey(iso.slice(0,10))）', () => {
    // 35 日前 = 2026-04-26（本地）。注意：relTime 用 iso.slice(0,10)（UTC 日）→
    // fromKey 還原本地正午。TODAY 為本地正午，35 日前 UTC instant 的日期分量
    // 與本地一致（同為 2026-04-26），故顯示「4月26日」。
    const iso = new Date(TODAY.getTime() - 35 * 86400000).toISOString()
    expect(relTime(iso)).toBe('4月26日')
  })
})

// ═══════════════════════════════════════════════════════════
//  BUG 1（high）：lastReviewed 用 UTC slice 而非本地日 key
//  ------------------------------------------------------------
//  lastReviewed 由 srs.ts 用 new Date().toISOString()（UTC）寫入；
//  其餘所有來源（focus startedAt / 習慣 date / 日誌 date）一律用本地日。
//  computeKpis 的 reviewsWeek/reviewsPrevWeek、buildDaySignals 的 reviews、
//  streakOf 都應該用本地日 keyOf(c.lastReviewed)，而唔係 .slice(0,10)。
//  在 UTC+8（HKT）下，夜晚（本地）的複習 UTC 仍屬前一日，會落錯格。
// ═══════════════════════════════════════════════════════════
describe('BUG 1 — lastReviewed 應計本地日（非 UTC slice）', () => {
  it('週窗邊界：複習 2026-05-24T17:00Z（本地 2026-05-25）應計入本週、非上週', () => {
    // 本地 key = 2026-05-25（今週窗 25..31 內）
    // UTC slice = 2026-05-24（上週窗 18..24 內）→ bug 會錯歸上週
    const input = emptyInput({
      cards: [card({ id: 'c1', lastReviewed: '2026-05-24T17:00:00.000Z' })],
    })
    const k = computeKpis(input)
    expect(k.reviewsWeek).toBe(1) // 修正後計入本週
    expect(k.reviewsPrevWeek).toBe(0) // 唔應落上週
  })

  it('buildDaySignals：複習 2026-05-30T17:00Z（本地 2026-05-31）應落今日格', () => {
    // 本地 key = 2026-05-31（今日）；UTC slice = 2026-05-30（昨日）
    const s = buildDaySignals(
      emptyInput({ cards: [card({ id: 'c1', lastReviewed: '2026-05-30T17:00:00.000Z' })] }),
      7,
    )
    const today = s.find((d) => d.key === '2026-05-31')!
    const yesterday = s.find((d) => d.key === '2026-05-30')!
    expect(today.reviews).toBe(1) // 修正後落今日
    expect(yesterday.reviews).toBe(0) // 唔應落昨日
  })

  it('streakOf（經 computeKpis）：本地今晚複習 + 昨日活動 → 連續 2 日', () => {
    // 複習 UTC 2026-05-30T17:00Z = 本地 2026-05-31（今日）
    // 昨日(2026-05-30)有習慣 → 連續今日 + 昨日 = 2
    // bug：複習落 2026-05-30 → 今日無活躍 → 由昨日起數 = 1（錯）
    const k = computeKpis(
      emptyInput({
        cards: [card({ id: 'c1', lastReviewed: '2026-05-30T17:00:00.000Z' })],
        habitLogs: [hlog({ id: 'l1', habitId: 'h1', date: '2026-05-30' })],
      }),
    )
    expect(k.streak).toBe(2)
  })
})

// ═══════════════════════════════════════════════════════════
//  BUG 2（med）：buildActivity 排序基準不一致
//  ------------------------------------------------------------
//  卡事件用 at = c.lastReviewed（原始 UTC instant，帶 Z），但習慣 / 日誌 /
//  書事件用 `${date}T12:00:00`（本地正午字串）。排序係純字串比較，混用
//  UTC instant 同本地正午字串會喺跨時段時錯亂。
//  示範（HKT）：複習於本地 13:00（= UTC 05:00Z），同日有個習慣（正午）。
//    實際本地時間：複習(13:00) 在習慣(正午) 之後 → 複習應排前（較新）。
//    但字串比較：'2026-05-25T05:00:00.000Z' < '2026-05-25T12:00:00' →
//    複習被當成較舊、排去習慣之後（錯）。
//  正確：卡事件亦以本地 key 砌正午字串，統一基準。
// ═══════════════════════════════════════════════════════════
describe('BUG 2 — buildActivity 排序應統一本地基準', () => {
  it('同一本地日：午後複習應排喺正午習慣之前（修正後用本地正午基準 → 平手亦穩定）', () => {
    // 複習本地 2026-05-25 13:00 = UTC 2026-05-25T05:00:00.000Z
    const items = buildActivity(
      emptyInput({
        cards: [card({ id: 'c1', lastReviewed: '2026-05-25T05:00:00.000Z' })],
        habitLogs: [hlog({ id: 'l1', habitId: 'h1', date: '2026-05-25' })],
      }),
      [],
      10,
    )
    // 修正後：卡事件 at = keyOf(lastReviewed) 本地正午 = '2026-05-25T12:00:00'，
    // 與習慣 '2026-05-25T12:00:00' 同日平手；至少唔會再因 UTC '05:00Z' 字串
    // 被錯誤判為「更舊」而排到習慣之後。兩者都係本地正午基準。
    const ids = items.map((i) => i.id)
    expect(ids).toContain('c-c1')
    expect(ids).toContain('h-l1')
    // 兩個事件 at 字串相等（同日同基準）→ 穩定排序、唔倒置
    const cardItem = items.find((i) => i.id === 'c-c1')!
    const habitItem = items.find((i) => i.id === 'h-l1')!
    expect(cardItem.at).toBe('2026-05-25T12:00:00')
    expect(habitItem.at).toBe('2026-05-25T12:00:00')
  })

  it('跨日：本地較新嘅複習排喺較舊習慣之前（基準統一後次序正確）', () => {
    // 複習本地 2026-05-26（= UTC 2026-05-25T19:00:00.000Z，UTC 仲係 25 號！）
    // 習慣 2026-05-24。本地次序：複習(26) > 習慣(24)。
    // 舊 bug：複習 at = '2026-05-25T19:00:00.000Z'，習慣 = '2026-05-24T12:00:00'，
    //         字串比較啱啱啱（25>24）→ 呢個 case 本身唔會錯；
    // 但統一基準後複習 at = '2026-05-26T12:00:00' 更貼真實本地日，次序仍正確。
    const items = buildActivity(
      emptyInput({
        cards: [card({ id: 'c1', lastReviewed: '2026-05-25T19:00:00.000Z' })],
        habitLogs: [hlog({ id: 'l1', habitId: 'h1', date: '2026-05-24' })],
      }),
      [],
      10,
    )
    expect(items.map((i) => i.id)).toEqual(['c-c1', 'h-l1'])
    expect(items[0].at).toBe('2026-05-26T12:00:00') // 本地日 26，非 UTC 25
  })
})
