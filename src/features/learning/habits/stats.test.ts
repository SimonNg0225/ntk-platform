import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  currentStreak,
  bestStreak,
  rateOverDays,
  thisWeekProgress,
  overallStats,
  streakAtRisk,
  weekdayInsights,
} from './util'
import type { Habit, HabitFrequency } from './types'

// ============================================================
//  統計引擎（streak / 完成率 / 本週進度 / 整體聚合）
//  ------------------------------------------------------------
//  呢啲函式內部用 new Date() / todayKey() 取「今日」，所以用假時鐘
//  把「今日」釘死，令測試與真實執行日期無關（CI 任何日都綠）。
//  本 repo 慣用「本地時區正午」錨定 key（避開 toISOString 的 UTC 漂移），
//  故設系統時間為本地正午。
// ============================================================

/** 釘「今日」為某本地日（正午）。 */
function pinToday(y: number, m1: number, d: number) {
  vi.setSystemTime(new Date(y, m1 - 1, d, 12, 0, 0, 0))
}

const set = (...keys: string[]) => new Set(keys)

const daily: HabitFrequency = { kind: 'daily' }
const monToFri: HabitFrequency = { kind: 'weekdays', days: [1, 2, 3, 4, 5] }

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

// 參考日曆（2026年5月）：
//   24=日 25=一 26=二 27=三 28=四 29=五 30=六 31=日
//   18=一 19=二 20=三 21=四 22=五 23=六

describe('currentStreak（目前連續完成日數，尊重頻率）', () => {
  it('空集合 → 0（任何頻率）', () => {
    pinToday(2026, 5, 30)
    expect(currentStreak(new Set<string>(), daily)).toBe(0)
    expect(currentStreak(new Set<string>(), monToFri)).toBe(0)
    expect(currentStreak(new Set<string>(), { kind: 'weekly', times: 3 })).toBe(0)
  })

  it('daily：今日完成 → 由今日起算', () => {
    pinToday(2026, 5, 25) // 一
    // 連續三日含今日
    expect(currentStreak(set('2026-05-23', '2026-05-24', '2026-05-25'), daily)).toBe(3)
  })

  it('daily：今日未完成但琴日完成 → 由琴日起算（保住琴日 streak）', () => {
    pinToday(2026, 5, 25) // 一；今日未打卡
    expect(currentStreak(set('2026-05-23', '2026-05-24'), daily)).toBe(2)
  })

  it('daily：今日 + 琴日都未完成 → 0', () => {
    pinToday(2026, 5, 25)
    // 最近完成喺前日（5/23），今日(25)同琴日(24)皆無 → 由琴日(24)起算即斷
    expect(currentStreak(set('2026-05-23'), daily)).toBe(0)
  })

  it('weekdays：中間夾住週末（非排程日）唔中斷連續', () => {
    pinToday(2026, 5, 29) // 五
    // 逢一至五；完成 本週一至五 + 上週五，跨越週六(23)/週日(24)非排程日
    const done = set(
      '2026-05-22', // 上週五
      '2026-05-25', // 一
      '2026-05-26', // 二
      '2026-05-27', // 三
      '2026-05-28', // 四
      '2026-05-29', // 五（今日）
    )
    // 週末 23/24 非排程 → 跳過不中斷；5/22 接得返 → 共 6
    expect(currentStreak(done, monToFri)).toBe(6)
  })

  it('weekdays：今日係非排程日（週六）但 done.has(today) → 由今日起算', () => {
    pinToday(2026, 5, 30) // 六（逢一至五習慣嘅非排程日）
    // 起點計法：done.has(today) 為真 → cursor 由今日(週六)開始；
    // 但週六非排程 → 跳過，落到週五(29) 開始計連續。
    const done = set('2026-05-30', '2026-05-29', '2026-05-28', '2026-05-27')
    // 週六(30)雖在集合但非排程跳過；29/28/27 連續 3 個排程日
    expect(currentStreak(done, monToFri)).toBe(3)
  })

  it('全部日都完成（長連續）→ 唔撞 5000 guard，回正確日數', () => {
    pinToday(2026, 5, 30)
    const done = new Set<string>()
    // 連續 100 日（含今日）
    const base = new Date(2026, 4, 30, 12)
    for (let i = 0; i < 100; i += 1) {
      const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() - i, 12)
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      done.add(k)
    }
    expect(currentStreak(done, daily)).toBe(100)
  })

  it('跨月回溯連續（4月底接 5月初）', () => {
    pinToday(2026, 5, 2) // 六
    // 4/29,4/30,5/1,5/2 連續 4 日（daily）
    expect(currentStreak(set('2026-04-29', '2026-04-30', '2026-05-01', '2026-05-02'), daily)).toBe(4)
  })

  it('[bug 2 複查] weekly 用日曆連續：完美 Mon/Wed/Fri 仍被當斷', () => {
    // 已知設計（code 註解自稱「最直觀」）：weekly 對每一日都當排程日，
    // 必須日曆連續先續到 streak。一個完美「每週 3 次（一三五）」用家：
    pinToday(2026, 5, 29) // 五（今日有打卡）
    const weekly3: HabitFrequency = { kind: 'weekly', times: 3 }
    const done = set('2026-05-25', '2026-05-27', '2026-05-29') // 一、三、五
    // 今日(五)有打卡 → streak 1；琴日(四 5/28)無打卡即斷 → 得 1（非 3）。
    expect(currentStreak(done, weekly3)).toBe(1)

    // 釘今日為週六（5/30，無打卡）→ 由琴日(五 29)起算 → 仍只得 1。
    pinToday(2026, 5, 30)
    expect(currentStreak(done, weekly3)).toBe(1)
  })
})

describe('bestStreak（史上最長連續，尊重頻率）', () => {
  it('空集合 → 0', () => {
    pinToday(2026, 5, 30)
    expect(bestStreak(new Set<string>(), daily)).toBe(0)
  })

  it('單一完成日 → 1', () => {
    pinToday(2026, 5, 30)
    expect(bestStreak(set('2026-05-20'), daily)).toBe(1)
  })

  it('兩段連續取較長者', () => {
    pinToday(2026, 5, 30)
    // 段一：5/18,5/19（長 2）；段二：5/22,5/23,5/24（長 3）
    const done = set('2026-05-18', '2026-05-19', '2026-05-22', '2026-05-23', '2026-05-24')
    expect(bestStreak(done, daily)).toBe(3)
  })

  it('weekdays：非排程日（週末）唔重置 run', () => {
    pinToday(2026, 5, 30)
    // 逢一至五；上週五(22) + 本週一至四(25-28)，跨週末仍算一段連續排程日 → 5
    const done = set('2026-05-22', '2026-05-25', '2026-05-26', '2026-05-27', '2026-05-28')
    expect(bestStreak(done, monToFri)).toBe(5)
  })

  it('cursor <= today 邊界：今日之後（未來）嘅完成唔計入', () => {
    pinToday(2026, 5, 27) // 三
    // 5/25,5/26,5/27（到今日，連續 3）+ 5/28,5/29（未來，cursor>today 唔掃）
    const done = set('2026-05-25', '2026-05-26', '2026-05-27', '2026-05-28', '2026-05-29')
    expect(bestStreak(done, daily)).toBe(3) // 只數到今日
  })

  it('跨年連續（去年底接今年初）', () => {
    pinToday(2026, 1, 3)
    // 2025-12-30,12-31,2026-01-01,01-02,01-03 連續 5 日
    const done = set('2025-12-30', '2025-12-31', '2026-01-01', '2026-01-02', '2026-01-03')
    expect(bestStreak(done, daily)).toBe(5)
  })

  it('[bug 2 複查] weekly 完美 Mon/Wed/Fri：best 仍得 1（日曆連續懲罰）', () => {
    pinToday(2026, 5, 30)
    const weekly3: HabitFrequency = { kind: 'weekly', times: 3 }
    // 連續兩個完美週（每週一三五）：6 次完成但每次都被隔日斷開
    const done = set(
      '2026-05-18', '2026-05-20', '2026-05-22', // 第一週 一三五
      '2026-05-25', '2026-05-27', '2026-05-29', // 第二週 一三五
    )
    // 日曆連續下，每個完成日都被中間空隙隔開 → best 永遠 1。
    expect(bestStreak(done, weekly3)).toBe(1)
  })
})

describe('rateOverDays（過去 windowDays 完成率 0-100）', () => {
  it('daily：全完成 → 100；全未完成 → 0', () => {
    pinToday(2026, 5, 27) // 三
    expect(rateOverDays(set('2026-05-25', '2026-05-26', '2026-05-27'), daily, 3)).toBe(100)
    expect(rateOverDays(new Set<string>(), daily, 3)).toBe(0)
  })

  it('daily：四捨五入（1/3→33%、2/3→67%）', () => {
    pinToday(2026, 5, 27)
    expect(rateOverDays(set('2026-05-25'), daily, 3)).toBe(33)
    expect(rateOverDays(set('2026-05-25', '2026-05-26'), daily, 3)).toBe(67)
  })

  it('daily：windowDays=0 → 防除零回 0', () => {
    pinToday(2026, 5, 30)
    expect(rateOverDays(new Set<string>(), daily, 0)).toBe(0)
    expect(rateOverDays(set('2026-05-30'), daily, 0)).toBe(0)
  })

  it('weekdays：只計排程日做分母（週末唔計）', () => {
    pinToday(2026, 5, 30) // 六；窗 7 日 = 5/24..5/30
    // 排程日（逢一至五）= 5/25..5/29 共 5 日；週日(24)/週六(30) 唔計。
    expect(
      rateOverDays(set('2026-05-25', '2026-05-26', '2026-05-27', '2026-05-28', '2026-05-29'), monToFri, 7),
    ).toBe(100)
    // 完成其中 3 個排程日 → 3/5 = 60%
    expect(rateOverDays(set('2026-05-25', '2026-05-27', '2026-05-29'), monToFri, 7)).toBe(60)
  })

  it('weekdays：無排程日（days=[]）→ scheduled=0 → 回 0', () => {
    pinToday(2026, 5, 30)
    const none: HabitFrequency = { kind: 'weekdays', days: [] }
    expect(rateOverDays(set('2026-05-29'), none, 7)).toBe(0)
  })

  it('weekly：分母 = (windowDays/7)×times，完成數封頂 100', () => {
    pinToday(2026, 5, 30)
    const weekly2: HabitFrequency = { kind: 'weekly', times: 2 }
    // 14 日窗 → 週數 = 14/7 = 2，target = 2×2 = 4
    // 完成 4 → 100；完成 2 → 50；完成 1 → 25
    const w = (...d: string[]) => rateOverDays(new Set(d), weekly2, 14)
    expect(w('2026-05-27', '2026-05-28', '2026-05-29', '2026-05-30')).toBe(100)
    expect(w('2026-05-29', '2026-05-30')).toBe(50)
    expect(w('2026-05-30')).toBe(25)
    // 完成超過 target（6 > 4）→ Math.min 封頂 100，唔超
    expect(w('2026-05-25', '2026-05-26', '2026-05-27', '2026-05-28', '2026-05-29', '2026-05-30')).toBe(100)
  })

  it('weekly：times=0 → target=0 → 防除零回 0', () => {
    pinToday(2026, 5, 30)
    const weekly0: HabitFrequency = { kind: 'weekly', times: 0 }
    expect(rateOverDays(set('2026-05-29', '2026-05-30'), weekly0, 14)).toBe(0)
  })

  it('[bug 3 修復] weekly 分母用精確週數，唔取整（windowDays=30）', () => {
    pinToday(2026, 5, 30)
    const weekly3: HabitFrequency = { kind: 'weekly', times: 3 }
    // 30 日橫跨 30/7 = 4.2857 週，target = 4.2857×3 = 12.857（非舊有取整 4×3=12）。
    // 部分完成 10 次：
    //   修復後：round(10 / 12.857 × 100) = 78%
    //   舊（bug）：round(10 / 12 × 100) = 83%（少計分母 → 偏高）
    // 用過去 30 日內 10 個完成日（5/21..5/30 連續 10 日皆喺窗內）。
    const done = set(
      '2026-05-21', '2026-05-22', '2026-05-23', '2026-05-24', '2026-05-25',
      '2026-05-26', '2026-05-27', '2026-05-28', '2026-05-29', '2026-05-30',
    )
    expect(rateOverDays(done, weekly3, 30)).toBe(78)
    expect(rateOverDays(done, weekly3, 30)).not.toBe(83) // 確認唔再係舊有偏高值

    // 完成 13 次（真正每週做足 3 次 30 日約 12.9 次）→ 仍由 Math.min 封頂 100。
    const done13 = new Set(done)
    done13.add('2026-05-20')
    done13.add('2026-05-19')
    done13.add('2026-05-18')
    expect(rateOverDays(done13, weekly3, 30)).toBe(100)
  })
})

describe('thisWeekProgress（本週：週日起到今日 已完成 count + target）', () => {
  it('空集合 → count 0；target 隨頻率（daily=7 / weekly=times / weekdays=days.length）', () => {
    pinToday(2026, 5, 30) // 六
    expect(thisWeekProgress(new Set<string>(), daily)).toEqual({ count: 0, target: 7 })
    expect(thisWeekProgress(new Set<string>(), { kind: 'weekly', times: 3 })).toEqual({
      count: 0,
      target: 3,
    })
    expect(thisWeekProgress(new Set<string>(), monToFri)).toEqual({ count: 0, target: 5 })
  })

  it('今日係週日（只睇今日一格）', () => {
    pinToday(2026, 5, 31) // 日；本週只有今日一格
    // 今日(31)有打卡；上週六(30)雖完成但屬上一週，唔應計入
    expect(thisWeekProgress(set('2026-05-31', '2026-05-30'), daily)).toEqual({
      count: 1,
      target: 7,
    })
  })

  it('今日係週六（睇足 Sun..Sat 7 格）daily 全完成 → count 7', () => {
    pinToday(2026, 5, 30) // 六
    const done = set(
      '2026-05-24', '2026-05-25', '2026-05-26', '2026-05-27',
      '2026-05-28', '2026-05-29', '2026-05-30',
    )
    expect(thisWeekProgress(done, daily)).toEqual({ count: 7, target: 7 })
  })

  it('weekly：count 可超過 target（做多過 times）', () => {
    pinToday(2026, 5, 30)
    const weekly2: HabitFrequency = { kind: 'weekly', times: 2 }
    // 本週完成 4 日（weekly 模式任何日都算）→ count 4 > target 2
    const done = set('2026-05-25', '2026-05-26', '2026-05-27', '2026-05-28')
    expect(thisWeekProgress(done, weekly2)).toEqual({ count: 4, target: 2 })
  })

  it('[bug 1 修復] weekdays：count 只數排程日完成，非排程日打卡唔計入', () => {
    pinToday(2026, 5, 30) // 六
    // 逢一至五（target=5）。用家喺週日(24，非排程)打咗卡 + 週一(25) + 週三(27)。
    // 修復後：只數排程日 → 週一、週三 = 2（週日 24 唔計）。
    // 舊（bug）：唔過濾排程日 → 連週日 24 都計 = 3，分子基數同 target 基數唔一致。
    const done = set('2026-05-24', '2026-05-25', '2026-05-27')
    expect(thisWeekProgress(done, monToFri)).toEqual({ count: 2, target: 5 })

    // 對照：純非排程日（週日 + 週六）打卡 → count 0（兩者皆非排程）。
    expect(thisWeekProgress(set('2026-05-24', '2026-05-30'), monToFri)).toEqual({
      count: 0,
      target: 5,
    })
  })

  it('daily / weekly：count 不受「排程過濾」影響（每日皆排程，無回歸）', () => {
    pinToday(2026, 5, 30)
    // daily：本週完成 3 日 → count 3
    expect(thisWeekProgress(set('2026-05-25', '2026-05-28', '2026-05-30'), daily)).toEqual({
      count: 3,
      target: 7,
    })
    // weekly：同上 3 日全計（任何日皆算）→ count 3
    expect(
      thisWeekProgress(set('2026-05-25', '2026-05-28', '2026-05-30'), { kind: 'weekly', times: 5 }),
    ).toEqual({ count: 3, target: 5 })
  })
})

describe('overallStats（多習慣聚合）', () => {
  const habit = (id: string, frequency: HabitFrequency): Habit => ({
    id,
    name: id,
    color: 'accent',
    frequency,
    goalKind: 'build',
    targetStreak: 0,
    archived: false,
    order: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
  })

  it('habits=[] → 全 0，todayRate 0（防除零）', () => {
    pinToday(2026, 5, 30)
    const s = overallStats([], new Map())
    expect(s).toEqual({
      totalHabits: 0,
      dueToday: 0,
      doneToday: 0,
      bestCurrentStreak: 0,
      todayRate: 0,
      perfectDays7: 0,
    })
  })

  it('一般混合：dueToday / doneToday / todayRate / bestCurrentStreak / perfectDays7', () => {
    pinToday(2026, 5, 30) // 六
    // h1 daily：完成 5/27,5/28,5/29（今日 30 未完成）→ 今日 due 但未做；currentStreak 3（由琴日起）
    // h2 weekdays[6]（逢週六）：完成今日 5/30 → 今日 due 且已做；currentStreak 1
    const habits = [habit('h1', daily), habit('h2', { kind: 'weekdays', days: [6] })]
    const byHabit = new Map<string, Set<string>>([
      ['h1', set('2026-05-27', '2026-05-28', '2026-05-29')],
      ['h2', set('2026-05-30')],
    ])
    const s = overallStats(habits, byHabit)
    expect(s.totalHabits).toBe(2)
    expect(s.dueToday).toBe(2) // h1(daily) + h2(週六今日 due)
    expect(s.doneToday).toBe(1) // 只有 h2 今日完成
    expect(s.todayRate).toBe(50) // round(1/2*100)
    expect(s.bestCurrentStreak).toBe(3) // max(h1=3, h2=1)
    // 過去 7 日完美日：5/27,5/28,5/29（只 h1 due 且完成）；5/30 due=2 但只 h2 完成 → 唔完美
    expect(s.perfectDays7).toBe(3)
  })

  it('今日全部非排程（dueToday=0）→ todayRate 回 0 唔 NaN', () => {
    pinToday(2026, 5, 30) // 六
    // 唯一習慣逢週一 → 今日(六)非排程 → dueToday 0
    const habits = [habit('h1', { kind: 'weekdays', days: [1] })]
    const byHabit = new Map<string, Set<string>>([['h1', set('2026-05-25')]])
    const s = overallStats(habits, byHabit)
    expect(s.dueToday).toBe(0)
    expect(s.doneToday).toBe(0)
    expect(s.todayRate).toBe(0) // 防除零，非 NaN
    expect(Number.isNaN(s.todayRate)).toBe(false)
    // perfectDays7：只有週一(25) due=1 且完成 → 1；其餘日 due=0 唔算完美
    expect(s.perfectDays7).toBe(1)
  })

  it('perfectDays7：某日 due=0 唔算完美（即使無未完成項）', () => {
    pinToday(2026, 5, 30) // 六
    // 單一逢週一習慣，但該週一未完成 → 過去 7 日無任何完美日
    const habits = [habit('h1', { kind: 'weekdays', days: [1] })]
    const byHabit = new Map<string, Set<string>>([['h1', new Set<string>()]])
    const s = overallStats(habits, byHabit)
    // 週一 due=1 ok=0 → 唔完美；其餘 6 日 due=0 → 唔算 → 共 0
    expect(s.perfectDays7).toBe(0)
  })

  it('perfectDays7：某日全部 due 完成 → +1（daily 連續 7 日全完成 → 7）', () => {
    pinToday(2026, 5, 30)
    const habits = [habit('h1', daily)]
    const byHabit = new Map<string, Set<string>>([
      [
        'h1',
        set('2026-05-24', '2026-05-25', '2026-05-26', '2026-05-27', '2026-05-28', '2026-05-29', '2026-05-30'),
      ],
    ])
    const s = overallStats(habits, byHabit)
    expect(s.perfectDays7).toBe(7)
  })

  it('weekdays 習慣今日非排程 → 唔計入 dueToday（混 daily 對照）', () => {
    pinToday(2026, 5, 30) // 六
    // h1 daily（今日 due）；h2 逢週一（今日非排程，唔計 due）
    const habits = [habit('h1', daily), habit('h2', { kind: 'weekdays', days: [1] })]
    const byHabit = new Map<string, Set<string>>([['h1', set('2026-05-30')]])
    const s = overallStats(habits, byHabit)
    expect(s.dueToday).toBe(1) // 只 h1
    expect(s.doneToday).toBe(1)
    expect(s.todayRate).toBe(100)
  })
})

describe('streakAtRisk（今日就會斷嘅連勝）', () => {
  // 直接傳 anchor（本地正午）令斷言 deterministic，毋須 setSystemTime。
  const anchor = (y: number, m1: number, d: number) => new Date(y, m1 - 1, d, 12, 0, 0, 0)
  const habit = (
    id: string,
    frequency: HabitFrequency,
    extra?: Partial<Habit>,
  ): Habit => ({
    id,
    name: id,
    color: 'accent',
    frequency,
    goalKind: 'build',
    targetStreak: 0,
    archived: false,
    order: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...extra,
  })

  it('空習慣 → 空陣列', () => {
    expect(streakAtRisk([], new Map(), anchor(2026, 5, 30))).toEqual([])
  })

  it('今日 due + 未完成 + streak>=1 → 入選（用琴日起算 streak）', () => {
    // 今日 5/30（六）daily 未打卡，但 5/28、5/29 連續 → streak 2 可斷。
    const habits = [habit('h1', daily)]
    const byHabit = new Map([['h1', set('2026-05-28', '2026-05-29')]])
    expect(streakAtRisk(habits, byHabit, anchor(2026, 5, 30))).toEqual([
      { id: 'h1', name: 'h1', streak: 2 },
    ])
  })

  it('今日已完成 → 唔入選（已保住）', () => {
    const habits = [habit('h1', daily)]
    const byHabit = new Map([['h1', set('2026-05-29', '2026-05-30')]])
    expect(streakAtRisk(habits, byHabit, anchor(2026, 5, 30))).toEqual([])
  })

  it('streak=0（琴日都斷咗）→ 唔入選', () => {
    // 今日 5/30 未完成、琴日 5/29 亦未完成 → currentStreak 由琴日起算即 0。
    const habits = [habit('h1', daily)]
    const byHabit = new Map([['h1', set('2026-05-27')]])
    expect(streakAtRisk(habits, byHabit, anchor(2026, 5, 30))).toEqual([])
  })

  it('今日非排程日（weekdays 唔包今日）→ 唔入選', () => {
    // h1 逢週一，今日 5/30（六）非排程 → 即使有連勝都唔算「今日要保」。
    const habits = [habit('h1', { kind: 'weekdays', days: [1] })]
    const byHabit = new Map([['h1', set('2026-05-25')]])
    expect(streakAtRisk(habits, byHabit, anchor(2026, 5, 30))).toEqual([])
  })

  it('已封存習慣略過（即使今日 due + 有連勝）', () => {
    const habits = [habit('h1', daily, { archived: true })]
    const byHabit = new Map([['h1', set('2026-05-28', '2026-05-29')]])
    expect(streakAtRisk(habits, byHabit, anchor(2026, 5, 30))).toEqual([])
  })

  it('多個 at-risk → 按 streak 由大到小排', () => {
    const habits = [
      habit('低', daily),
      habit('高', daily),
      habit('中', daily),
    ]
    const byHabit = new Map([
      ['低', set('2026-05-29')], // streak 1
      ['高', set('2026-05-27', '2026-05-28', '2026-05-29')], // streak 3
      ['中', set('2026-05-28', '2026-05-29')], // streak 2
    ])
    const r = streakAtRisk(habits, byHabit, anchor(2026, 5, 30))
    expect(r.map((x) => x.name)).toEqual(['高', '中', '低'])
    expect(r.map((x) => x.streak)).toEqual([3, 2, 1])
  })

  it('同 streak → 按名稱排序（穩定、與輸入次序無關）', () => {
    // 故意逆序輸入（B 先 A 後），同 streak 時應按名稱升序回 A、B。
    const habits = [habit('B', daily), habit('A', daily)]
    const byHabit = new Map([
      ['B', set('2026-05-29')],
      ['A', set('2026-05-29')],
    ])
    const r = streakAtRisk(habits, byHabit, anchor(2026, 5, 30))
    expect(r.map((x) => x.name)).toEqual(['A', 'B'])
  })

  it('weekdays：跨週末連勝保住 → 今日（週一）未打卡仍算 at-risk', () => {
    // h1 逢一至五；上週一至五全完成（22 五… 等），今日 6/1（週一）未打卡。
    // 週末 5/30、5/31 非排程日跳過唔中斷 → streak 接得返。
    const monToFriH = habit('h1', monToFri)
    const byHabit = new Map([
      [
        'h1',
        set('2026-05-25', '2026-05-26', '2026-05-27', '2026-05-28', '2026-05-29'),
      ],
    ])
    const r = streakAtRisk([monToFriH], byHabit, anchor(2026, 6, 1)) // 週一
    expect(r).toHaveLength(1)
    expect(r[0].id).toBe('h1')
    expect(r[0].streak).toBe(5) // 上週一至五
  })

  it('mixed：only due+未完成+streak>=1 嘅入選（綜合篩選）', () => {
    pinToday(2026, 5, 30) // 同時驗 anchor 預設 = 真實今日
    const habits = [
      habit('done-today', daily), // 今日已完成 → 排除
      habit('no-streak', daily), // 無連勝 → 排除
      habit('off-day', { kind: 'weekdays', days: [1] }), // 今日非排程 → 排除
      habit('at-risk', daily), // 入選
    ]
    const byHabit = new Map([
      ['done-today', set('2026-05-30')],
      ['no-streak', new Set<string>()],
      ['off-day', set('2026-05-25')],
      ['at-risk', set('2026-05-28', '2026-05-29')],
    ])
    // 唔傳 anchor，靠 setSystemTime 釘死今日 → 驗預設參數路徑
    const r = streakAtRisk(habits, byHabit)
    expect(r.map((x) => x.id)).toEqual(['at-risk'])
    expect(r[0].streak).toBe(2)
  })
})

describe('weekdayInsights（星期分佈洞察：最易堅持／最易甩底 + 逐習慣最常完成日）', () => {
  // 直接傳 anchor（本地正午）令斷言 deterministic。
  const anchor = (y: number, m1: number, d: number) => new Date(y, m1 - 1, d, 12, 0, 0, 0)
  const habit = (id: string, frequency: HabitFrequency, name = id): Habit => ({
    id,
    name,
    color: 'accent',
    frequency,
    goalKind: 'build',
    targetStreak: 0,
    archived: false,
    order: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
  })

  // 窗口用 7 日 + anchor 5/30（六）：恰好每個星期幾各出現一次。
  //   5/24=日 5/25=一 5/26=二 5/27=三 5/28=四 5/29=五 5/30=六
  const win = 7
  const at530 = anchor(2026, 5, 30)

  it('習慣=[] → 全空，best/worst 為 null', () => {
    const r = weekdayInsights([], new Map(), win, at530)
    expect(r.best).toBeNull()
    expect(r.worst).toBeNull()
    expect(r.perHabitBest).toEqual([])
    // perWeekday 仍有 7 格，rate 全 0、due 全 0
    expect(r.perWeekday).toHaveLength(7)
    expect(r.perWeekday.map((d) => d.rate)).toEqual([0, 0, 0, 0, 0, 0, 0])
    expect(r.perWeekday.every((d) => d.due === 0)).toBe(true)
  })

  it('perWeekday 由日到六對齊，標籤正確', () => {
    const habits = [habit('h1', daily)]
    const byHabit = new Map([['h1', set('2026-05-25')]]) // 只完成週一
    const r = weekdayInsights(habits, byHabit, win, at530)
    expect(r.perWeekday.map((d) => d.weekday)).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(r.perWeekday.map((d) => d.label)).toEqual(['日', '一', '二', '三', '四', '五', '六'])
    // daily：每個星期幾各 1 due；只週一完成 → 週一 100%、其餘 0%
    expect(r.perWeekday[1]).toMatchObject({ weekday: 1, due: 1, done: 1, rate: 100 })
    expect(r.perWeekday[0]).toMatchObject({ due: 1, done: 0, rate: 0 })
  })

  it('best = 完成率最高、worst = 最低（daily 全週 due=1）', () => {
    // 完成 一/二/三（3 日），其餘 4 日未做。daily → 每日 due=1。
    const habits = [habit('h1', daily)]
    const byHabit = new Map([['h1', set('2026-05-25', '2026-05-26', '2026-05-27')]])
    const r = weekdayInsights(habits, byHabit, win, at530)
    // 完成日 rate=100、未完成日 rate=0。best 同分（一/二/三皆 100）→ 取最細 index = 一(1)。
    expect(r.best).toMatchObject({ weekday: 1, rate: 100 })
    // worst 同分（日/四/五/六皆 0）→ 取最細 index = 日(0)。
    expect(r.worst).toMatchObject({ weekday: 0, rate: 0 })
  })

  it('weekdays 排程：非排程日唔計入 due（best/worst 只比有排程嘅日）', () => {
    // 逢一三五；窗口內排程日 = 一(25)/三(27)/五(29)，各 due=1。
    // 完成 一 + 三，五未做 → 一/三 100%、五 0%；其餘 4 日 due=0 唔參與。
    const habits = [habit('h1', { kind: 'weekdays', days: [1, 3, 5] })]
    const byHabit = new Map([['h1', set('2026-05-25', '2026-05-27')]])
    const r = weekdayInsights(habits, byHabit, win, at530)
    // 非排程日 due=0
    expect(r.perWeekday[0].due).toBe(0) // 日
    expect(r.perWeekday[2].due).toBe(0) // 二
    expect(r.perWeekday[1].due).toBe(1) // 一
    expect(r.perWeekday[5]).toMatchObject({ due: 1, done: 0, rate: 0 }) // 五
    // best 同分（一/三 100）→ 一(1)；worst = 五(5) 0%（due=0 嘅日唔當 worst）
    expect(r.best).toMatchObject({ weekday: 1, rate: 100 })
    expect(r.worst).toMatchObject({ weekday: 5, rate: 0 })
  })

  it('perHabitBest：逐習慣最常完成嘅星期幾（按完成次數，跨多週累加）', () => {
    // 窗口 21 日（3 週）+ anchor 5/30。3 個週一：5/11? 唔係 — 用實際日曆：
    //   往回 3 週嘅週一 = 5/11、5/18、5/25；週三 = 5/13、5/20、5/27。
    const win21 = 21
    const habits = [habit('h1', daily, '阿一')]
    // h1：週一完成 3 次、週三完成 1 次 → 最常 = 週一(1)，count 3
    const byHabit = new Map([
      ['h1', set('2026-05-11', '2026-05-18', '2026-05-25', '2026-05-13')],
    ])
    const r = weekdayInsights(habits, byHabit, win21, at530)
    expect(r.perHabitBest).toEqual([
      { id: 'h1', name: '阿一', weekday: 1, label: '一', count: 3 },
    ])
  })

  it('perHabitBest：零完成嘅習慣略過', () => {
    const habits = [habit('h1', daily), habit('h2', daily)]
    const byHabit = new Map([['h1', set('2026-05-25')]]) // h2 全無完成
    const r = weekdayInsights(habits, byHabit, win, at530)
    expect(r.perHabitBest.map((x) => x.id)).toEqual(['h1'])
  })

  it('perHabitBest：多習慣按完成次數由多到少排（同次數按 weekday → name）', () => {
    const win21 = 21
    const habits = [
      habit('few', daily, '少'),
      habit('many', daily, '多'),
    ]
    const byHabit = new Map([
      // 少：週二完成 1 次
      ['few', set('2026-05-12')],
      // 多：週一完成 3 次
      ['many', set('2026-05-11', '2026-05-18', '2026-05-25')],
    ])
    const r = weekdayInsights(habits, byHabit, win21, at530)
    expect(r.perHabitBest.map((x) => x.name)).toEqual(['多', '少'])
    expect(r.perHabitBest.map((x) => x.count)).toEqual([3, 1])
  })

  it('perHabitBest：同習慣兩個星期幾打平 → 取最細 weekday index', () => {
    // 週一(25) 同 週二(26) 各完成 1 次 → 打平取 一(1)。
    const habits = [habit('h1', daily)]
    const byHabit = new Map([['h1', set('2026-05-25', '2026-05-26')]])
    const r = weekdayInsights(habits, byHabit, win, at530)
    expect(r.perHabitBest).toHaveLength(1)
    expect(r.perHabitBest[0]).toMatchObject({ weekday: 1, count: 1 })
  })

  it('預設參數路徑：唔傳 anchor 用真實今日（fake timer 釘死）', () => {
    vi.setSystemTime(at530) // 釘今日為 5/30
    const habits = [habit('h1', daily)]
    const byHabit = new Map([['h1', set('2026-05-25')]])
    // 唔傳 windowDays / anchor → 默認 84 日窗口、anchor=今日；
    // 84 日窗口含 5/25（週一）→ 至少有完成、best 應為週一。
    const r = weekdayInsights(habits, byHabit)
    expect(r.perWeekday).toHaveLength(7)
    expect(r.best?.weekday).toBe(1) // 唯一有完成嘅日 → 完成率最高
    expect(r.perHabitBest[0]).toMatchObject({ id: 'h1', weekday: 1 })
  })

  it('補打卡喺非排程日：唔計入 due/rate，但計入 perHabitBest 完成次數', () => {
    // 逢週一（只週一排程）；但用家喺週六(30)補打卡咗一次 + 週一(25)正常打卡。
    const habits = [habit('h1', { kind: 'weekdays', days: [1] })]
    const byHabit = new Map([['h1', set('2026-05-25', '2026-05-30')]])
    const r = weekdayInsights(habits, byHabit, win, at530)
    // 週六非排程 → due=0、rate=0（唔受補打卡影響）
    expect(r.perWeekday[6]).toMatchObject({ due: 0, done: 0, rate: 0 })
    // 週一排程 + 完成 → due=1 done=1 rate=100
    expect(r.perWeekday[1]).toMatchObject({ due: 1, done: 1, rate: 100 })
    // perHabitBest：週一同週六各完成 1 次打平 → 取最細 index 週一(1)
    expect(r.perHabitBest[0]).toMatchObject({ weekday: 1, count: 1 })
  })
})
