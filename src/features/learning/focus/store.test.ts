// 時區敏感：store 一律用本地欄位（getHours/getMinutes/getDate…），避 toISOString
// 的 UTC 漂移。fmtTime 測試以「本地建構 ISO」斷言 HH:mm，本身唔靠機器時區；
// 但為求同 srs.test.ts 一致、並守護「fmtTime 用本地時間（非 UTC）」嘅契約，
// 喺 import 前鎖死 TZ = Asia/Hong_Kong（V8 首次用 Date 即快取，故必須最前）。
// 本 repo tsconfig 無 @types/node，故自行最小宣告 process（只用 env.TZ）。
declare const process: { env: Record<string, string | undefined> }
process.env.TZ = 'Asia/Hong_Kong'

import { describe, it, expect } from 'vitest'
import {
  dailySeries,
  currentStreak,
  longestStreak,
  weekdayDistribution,
  hourDistribution,
  projectBreakdown,
  tagBreakdown,
  totalsOf,
  fmtDuration,
  fmtClock,
  fmtTime,
  relativeDay,
  logsToCsv,
  dayKey,
  addDays,
  todayKey,
  getSettings,
  SETTINGS_ID,
  type DayStat,
} from './store'
import { DEFAULT_SETTINGS, type FocusLog, type FocusSettings } from './types'

// ──────────────────────────────────────────────────────────────
//  Helpers — 本地時區固定時間，避開 toISOString 的 UTC 漂移。
//  注意：store 內部用本地欄位（getFullYear/getMonth/getDate/getDay/
//  getHours）做 key，所以 fixtures 一律用本地建構（new Date(y,m,d,…)）
//  再 .toISOString() 成 startedAt，咁本地解析返會穩定。
// ──────────────────────────────────────────────────────────────

const localISO = (
  y: number,
  m1: number, // 1-based 月
  d: number,
  hh = 12,
  mm = 0,
) => new Date(y, m1 - 1, d, hh, mm, 0, 0).toISOString()

let counter = 0
function focusLog(over: Partial<FocusLog> = {}): FocusLog {
  counter += 1
  const started = over.startedAt ?? localISO(2026, 5, 4, 10, 0)
  return {
    id: over.id ?? `log-${counter}`,
    kind: over.kind ?? 'focus',
    startedAt: started,
    endedAt: over.endedAt ?? started,
    plannedMin: over.plannedMin ?? 25,
    actualMin: over.actualMin ?? 25,
    completed: over.completed ?? true,
    projectId: over.projectId,
    label: over.label,
    tags: over.tags,
    interruptions: over.interruptions,
    rating: over.rating,
    note: over.note,
  }
}

// 取某 key 那一日的 DayStat（series 預填全部日，必定搵到）
const dayOf = (series: DayStat[], key: string) => series.find((d) => d.key === key)!

// ════════════════════════════════════════════════════════════════
//  dayKey / addDays （日期基石；其他函式全部靠佢）
// ════════════════════════════════════════════════════════════════
describe('dayKey（本地時區 YYYY-MM-DD，補零）', () => {
  it('一般日期 + 月日補零', () => {
    expect(dayKey(new Date(2026, 0, 1, 12, 0, 0))).toBe('2026-01-01') // 1月
    expect(dayKey(new Date(2026, 11, 31, 12, 0, 0))).toBe('2026-12-31') // 12月
    expect(dayKey(new Date(2026, 2, 7, 12, 0, 0))).toBe('2026-03-07') // 單位數日
    expect(dayKey(new Date(2026, 8, 9, 12, 0, 0))).toBe('2026-09-09') // 單位數月日
  })

  it('時區邊界：午夜 / 深夜仍回當地日（非 UTC off-by-one）', () => {
    // UTC+8 之下 00:00 對應 UTC 前一日 16:00；本地 getDate 必回當地日。
    expect(dayKey(new Date(2026, 0, 1, 0, 0, 0))).toBe('2026-01-01')
    expect(dayKey(new Date(2026, 4, 4, 23, 59, 0))).toBe('2026-05-04')
  })
})

describe('addDays（本地 Y/M/D 構造、自動進位）', () => {
  it('同月內加減', () => {
    expect(dayKey(addDays(new Date(2026, 4, 10, 12, 0), 5))).toBe('2026-05-15')
    expect(dayKey(addDays(new Date(2026, 4, 10, 12, 0), -3))).toBe('2026-05-07')
  })
  it('跨月（前進 / 後退）', () => {
    expect(dayKey(addDays(new Date(2026, 4, 31, 12, 0), 1))).toBe('2026-06-01')
    expect(dayKey(addDays(new Date(2026, 4, 1, 12, 0), -1))).toBe('2026-04-30')
  })
  it('跨年', () => {
    expect(dayKey(addDays(new Date(2026, 11, 31, 12, 0), 1))).toBe('2027-01-01')
    expect(dayKey(addDays(new Date(2026, 0, 1, 12, 0), -1))).toBe('2025-12-31')
  })
  it('閏年 2月（2028 為閏年，2/29 存在）', () => {
    expect(dayKey(addDays(new Date(2028, 1, 28, 12, 0), 1))).toBe('2028-02-29')
    expect(dayKey(addDays(new Date(2028, 1, 29, 12, 0), 1))).toBe('2028-03-01')
    // 平年 2026：2/28 + 1 = 3/1
    expect(dayKey(addDays(new Date(2026, 1, 28, 12, 0), 1))).toBe('2026-03-01')
  })
})

// ════════════════════════════════════════════════════════════════
//  dailySeries
// ════════════════════════════════════════════════════════════════
describe('dailySeries（逐日聚合，只計 completed focus）', () => {
  const from = new Date(2026, 4, 1, 12, 0)
  const to = new Date(2026, 4, 3, 12, 0)

  it('空 logs → 範圍內每日都係 0', () => {
    const s = dailySeries([], from, to)
    expect(s).toHaveLength(3)
    expect(s.map((d) => d.key)).toEqual(['2026-05-01', '2026-05-02', '2026-05-03'])
    expect(s.every((d) => d.minutes === 0 && d.sessions === 0)).toBe(true)
  })

  it('from > to → loop 唔行，回傳空陣列', () => {
    expect(dailySeries([], to, from)).toEqual([])
  })

  it('from === to → 單日', () => {
    const s = dailySeries([], from, from)
    expect(s).toHaveLength(1)
    expect(s[0]).toEqual({ key: '2026-05-01', minutes: 0, sessions: 0 })
  })

  it('範圍外嘅 log 唔計入（map.get 落空）', () => {
    const logs = [focusLog({ startedAt: localISO(2026, 4, 20), actualMin: 50 })]
    const s = dailySeries(logs, from, to)
    expect(s.every((d) => d.minutes === 0)).toBe(true)
  })

  it('同一日多節累加 minutes + sessions', () => {
    const logs = [
      focusLog({ startedAt: localISO(2026, 5, 2, 9), actualMin: 25 }),
      focusLog({ startedAt: localISO(2026, 5, 2, 14), actualMin: 30 }),
    ]
    const s = dailySeries(logs, from, to)
    expect(dayOf(s, '2026-05-02')).toEqual({ key: '2026-05-02', minutes: 55, sessions: 2 })
  })

  it('非 focus（休息）唔計', () => {
    const logs = [
      focusLog({ kind: 'short_break', startedAt: localISO(2026, 5, 2), actualMin: 5 }),
      focusLog({ kind: 'long_break', startedAt: localISO(2026, 5, 2), actualMin: 15 }),
    ]
    expect(dayOf(dailySeries(logs, from, to), '2026-05-02').minutes).toBe(0)
  })

  it('[BUG#1] abandoned focus 唔加 minutes、唔加 sessions（同 totalsOf.focusMin 對齊）', () => {
    // 審查實測 case：completed 25 分 + abandoned 10 分。
    // 修正前 dailySeries 日總和會係 35（含放棄）；修正後應 = 25。
    const logs = [
      focusLog({ startedAt: localISO(2026, 5, 2, 9), actualMin: 25, completed: true }),
      focusLog({ startedAt: localISO(2026, 5, 2, 14), actualMin: 10, completed: false }),
    ]
    const d = dayOf(dailySeries(logs, from, to), '2026-05-02')
    expect(d.minutes).toBe(25)
    expect(d.sessions).toBe(1)
    // 同一基數鐵證：dailySeries 日總和 === totalsOf.focusMin
    expect(d.minutes).toBe(totalsOf(logs).focusMin)
  })

  it('跨月連續日逐日預填（本地 addDays）', () => {
    const s = dailySeries([], new Date(2026, 4, 30, 12, 0), new Date(2026, 5, 2, 12, 0))
    expect(s.map((d) => d.key)).toEqual(['2026-05-30', '2026-05-31', '2026-06-01', '2026-06-02'])
  })

  it('跨年連續日逐日預填', () => {
    const s = dailySeries([], new Date(2026, 11, 30, 12, 0), new Date(2027, 0, 1, 12, 0))
    expect(s.map((d) => d.key)).toEqual(['2026-12-30', '2026-12-31', '2027-01-01'])
  })
})

// ════════════════════════════════════════════════════════════════
//  currentStreak
// ════════════════════════════════════════════════════════════════
describe('currentStreak（由今日往回數連續達標日；今日未做唔即斷）', () => {
  const today = new Date()
  const tk = todayKey()
  const yesterdayKey = dayKey(addDays(today, -1))
  const twoAgoKey = dayKey(addDays(today, -2))
  const threeAgoKey = dayKey(addDays(today, -3))

  // 用本地建構回 ISO（startedAt），確保 keyOf 解析返同一本地日。
  const logOnKey = (key: string, over: Partial<FocusLog> = {}) => {
    const [y, m, d] = key.split('-').map(Number)
    return focusLog({ startedAt: localISO(y, m, d, 10), ...over })
  }

  it('空 logs → 0', () => {
    expect(currentStreak([])).toBe(0)
  })

  it('今日有做 → 由今日起計', () => {
    expect(currentStreak([logOnKey(tk)])).toBe(1)
    expect(currentStreak([logOnKey(tk), logOnKey(yesterdayKey)])).toBe(2)
    expect(
      currentStreak([logOnKey(tk), logOnKey(yesterdayKey), logOnKey(twoAgoKey)]),
    ).toBe(3)
  })

  it('今日無但尋日有 → 唔斷，由尋日起計', () => {
    expect(currentStreak([logOnKey(yesterdayKey)])).toBe(1)
    expect(currentStreak([logOnKey(yesterdayKey), logOnKey(twoAgoKey)])).toBe(2)
  })

  it('今日同尋日都無 → 0', () => {
    expect(currentStreak([logOnKey(twoAgoKey), logOnKey(threeAgoKey)])).toBe(0)
  })

  it('中間斷一日 → 由連續段起計', () => {
    // 今日 + 尋日有，前日無（斷） → streak = 2
    expect(currentStreak([logOnKey(tk), logOnKey(yesterdayKey), logOnKey(threeAgoKey)])).toBe(2)
  })

  it('只有 abandoned focus → 唔算 completed → 0', () => {
    expect(currentStreak([logOnKey(tk, { completed: false })])).toBe(0)
  })

  it('非 focus（休息）唔算', () => {
    expect(currentStreak([logOnKey(tk, { kind: 'short_break' })])).toBe(0)
  })

  it('同日重複多 log（Set 去重）唔會重複計', () => {
    expect(currentStreak([logOnKey(tk), logOnKey(tk), logOnKey(tk)])).toBe(1)
  })
})

// ════════════════════════════════════════════════════════════════
//  longestStreak
// ════════════════════════════════════════════════════════════════
describe('longestStreak（歷來最長連續達標）', () => {
  it('空 logs → 0', () => {
    expect(longestStreak([])).toBe(0)
  })

  it('單一日 → 1', () => {
    expect(longestStreak([focusLog({ startedAt: localISO(2026, 5, 4) })])).toBe(1)
  })

  it('全部連續 → 全長', () => {
    const logs = [
      focusLog({ startedAt: localISO(2026, 5, 1) }),
      focusLog({ startedAt: localISO(2026, 5, 2) }),
      focusLog({ startedAt: localISO(2026, 5, 3) }),
      focusLog({ startedAt: localISO(2026, 5, 4) }),
    ]
    expect(longestStreak(logs)).toBe(4)
  })

  it('全部唔連續（每段 1）→ 1', () => {
    const logs = [
      focusLog({ startedAt: localISO(2026, 5, 1) }),
      focusLog({ startedAt: localISO(2026, 5, 3) }),
      focusLog({ startedAt: localISO(2026, 5, 5) }),
    ]
    expect(longestStreak(logs)).toBe(1)
  })

  it('多段：取最長嗰段', () => {
    // 5/1,5/2,5/3 (=3) … 斷 … 5/10,5/11 (=2) → 最長 3
    const logs = [
      focusLog({ startedAt: localISO(2026, 5, 1) }),
      focusLog({ startedAt: localISO(2026, 5, 2) }),
      focusLog({ startedAt: localISO(2026, 5, 3) }),
      focusLog({ startedAt: localISO(2026, 5, 10) }),
      focusLog({ startedAt: localISO(2026, 5, 11) }),
    ]
    expect(longestStreak(logs)).toBe(3)
  })

  it('同日重複（Set 去重）→ 唔會被當成 diff=0 中斷', () => {
    // 兩個都係 5/1 + 一個 5/2：去重後 [5/1,5/2] 連續 → 2（唔係 1）
    const logs = [
      focusLog({ startedAt: localISO(2026, 5, 1, 9) }),
      focusLog({ startedAt: localISO(2026, 5, 1, 15) }),
      focusLog({ startedAt: localISO(2026, 5, 2, 10) }),
    ]
    expect(longestStreak(logs)).toBe(2)
  })

  it('跨年連續（12/31 → 1/1）算連續', () => {
    const logs = [
      focusLog({ startedAt: localISO(2026, 12, 31) }),
      focusLog({ startedAt: localISO(2027, 1, 1) }),
    ]
    expect(longestStreak(logs)).toBe(2)
  })

  it('用正午 anchor：相鄰日 diff 必為 1（DST 不影響 round）', () => {
    // 連續 5 日跨越任何潛在 DST 邊界，仍應 = 5
    const logs = [
      focusLog({ startedAt: localISO(2026, 3, 7) }),
      focusLog({ startedAt: localISO(2026, 3, 8) }),
      focusLog({ startedAt: localISO(2026, 3, 9) }),
      focusLog({ startedAt: localISO(2026, 3, 10) }),
      focusLog({ startedAt: localISO(2026, 3, 11) }),
    ]
    expect(longestStreak(logs)).toBe(5)
  })

  it('只有 abandoned → 0', () => {
    expect(longestStreak([focusLog({ completed: false })])).toBe(0)
  })
})

// ════════════════════════════════════════════════════════════════
//  weekdayDistribution
// ════════════════════════════════════════════════════════════════
describe('weekdayDistribution（0=日…6=六，本地 getDay）', () => {
  it('空 logs → 全 0、固定 7 格', () => {
    expect(weekdayDistribution([])).toEqual([0, 0, 0, 0, 0, 0, 0])
  })

  it('歸入正確 weekday（2026-05-04 為星期一 → index 1）', () => {
    // 2026-05-04 本地 = 星期一
    expect(new Date(2026, 4, 4, 12, 0).getDay()).toBe(1)
    const out = weekdayDistribution([focusLog({ startedAt: localISO(2026, 5, 4), actualMin: 25 })])
    expect(out[1]).toBe(25)
    expect(out.reduce((a, b) => a + b, 0)).toBe(25)
  })

  it('同一 weekday 多日累加（5/4 與 5/11 都係星期一）', () => {
    expect(new Date(2026, 4, 11, 12, 0).getDay()).toBe(1)
    const out = weekdayDistribution([
      focusLog({ startedAt: localISO(2026, 5, 4), actualMin: 25 }),
      focusLog({ startedAt: localISO(2026, 5, 11), actualMin: 30 }),
    ])
    expect(out[1]).toBe(55)
  })

  it('[BUG#1] abandoned focus 唔計入（同 totals 對齊）', () => {
    const out = weekdayDistribution([
      focusLog({ startedAt: localISO(2026, 5, 4), actualMin: 25, completed: true }),
      focusLog({ startedAt: localISO(2026, 5, 4), actualMin: 10, completed: false }),
    ])
    expect(out[1]).toBe(25)
  })
})

// ════════════════════════════════════════════════════════════════
//  hourDistribution
// ════════════════════════════════════════════════════════════════
describe('hourDistribution（0–23，本地 getHours）', () => {
  it('空 logs → 全 0、固定 24 格', () => {
    const out = hourDistribution([])
    expect(out).toHaveLength(24)
    expect(out.every((v) => v === 0)).toBe(true)
  })

  it('歸入 startedAt 嗰個鐘（唔分割跨午夜）', () => {
    // 23:30 開始 90 分（理論上跨午夜）仍全歸 23 時。
    const out = hourDistribution([
      focusLog({ startedAt: localISO(2026, 5, 4, 23, 30), actualMin: 90 }),
    ])
    expect(out[23]).toBe(90)
    expect(out[0]).toBe(0)
  })

  it('同一鐘頭多節累加', () => {
    const out = hourDistribution([
      focusLog({ startedAt: localISO(2026, 5, 4, 10, 5), actualMin: 25 }),
      focusLog({ startedAt: localISO(2026, 5, 4, 10, 40), actualMin: 25 }),
    ])
    expect(out[10]).toBe(50)
  })

  it('[BUG#1] abandoned focus 唔計入', () => {
    const out = hourDistribution([
      focusLog({ startedAt: localISO(2026, 5, 4, 10), actualMin: 25, completed: true }),
      focusLog({ startedAt: localISO(2026, 5, 4, 10), actualMin: 10, completed: false }),
    ])
    expect(out[10]).toBe(25)
  })
})

// ════════════════════════════════════════════════════════════════
//  projectBreakdown
// ════════════════════════════════════════════════════════════════
describe('projectBreakdown（按 projectId 聚合，minutes 降序）', () => {
  it('空 logs → 空陣列', () => {
    expect(projectBreakdown([])).toEqual([])
  })

  it('全部無 projectId → 單一 null bucket', () => {
    const out = projectBreakdown([
      focusLog({ actualMin: 25 }),
      focusLog({ actualMin: 30 }),
    ])
    expect(out).toEqual([{ projectId: null, minutes: 55, sessions: 2 }])
  })

  it('多專案按 minutes 降序排', () => {
    const out = projectBreakdown([
      focusLog({ projectId: 'a', actualMin: 20 }),
      focusLog({ projectId: 'b', actualMin: 50 }),
      focusLog({ projectId: 'c', actualMin: 35 }),
    ])
    expect(out.map((p) => p.projectId)).toEqual(['b', 'c', 'a'])
    expect(out.map((p) => p.minutes)).toEqual([50, 35, 20])
  })

  it('[BUG#1] abandoned 唔再令 minutes vs sessions 失同步；總和 === focusMin', () => {
    const logs = [
      focusLog({ projectId: 'a', actualMin: 25, completed: true }),
      focusLog({ projectId: 'a', actualMin: 10, completed: false }),
    ]
    const out = projectBreakdown(logs)
    expect(out).toEqual([{ projectId: 'a', minutes: 25, sessions: 1 }])
    // [BUG#2 連帶修正] sum(projectBreakdown.minutes) === totals.focusMin，
    // 令 StatsView 專案佔比百分比分母同分子同一基數。
    const sum = out.reduce((s, p) => s + p.minutes, 0)
    expect(sum).toBe(totalsOf(logs).focusMin)
  })

  it('minutes 相同時 sort 唔互換已存在嘅相對次序（穩定性）', () => {
    // a 先入、b 後入，兩者同 minutes；穩定 sort 應保留 a 在 b 前。
    const out = projectBreakdown([
      focusLog({ projectId: 'a', actualMin: 25 }),
      focusLog({ projectId: 'b', actualMin: 25 }),
    ])
    expect(out.map((p) => p.projectId)).toEqual(['a', 'b'])
  })
})

// ════════════════════════════════════════════════════════════════
//  tagBreakdown
// ════════════════════════════════════════════════════════════════
describe('tagBreakdown（每 tag minutes 總和，一節多 tag 各全額）', () => {
  it('空 logs / 全部無 tag → 空陣列', () => {
    expect(tagBreakdown([])).toEqual([])
    expect(tagBreakdown([focusLog({ tags: undefined })])).toEqual([])
  })

  it('一節多 tag → 每個都加全額 actualMin（總和大過實際時間）', () => {
    const out = tagBreakdown([focusLog({ tags: ['x', 'y'], actualMin: 25 })])
    expect(out).toEqual([
      { tag: 'x', minutes: 25 },
      { tag: 'y', minutes: 25 },
    ])
    // 實際只 25 分，但兩 tag 合計 50 —— 刻意重複計。
    expect(out.reduce((s, t) => s + t.minutes, 0)).toBe(50)
  })

  it('重複 tag 名跨節累加 + 按 minutes 降序', () => {
    const out = tagBreakdown([
      focusLog({ tags: ['read'], actualMin: 20 }),
      focusLog({ tags: ['read', 'deep'], actualMin: 30 }),
    ])
    expect(out[0]).toEqual({ tag: 'read', minutes: 50 })
    expect(out[1]).toEqual({ tag: 'deep', minutes: 30 })
  })

  it('[BUG#1] abandoned focus 唔計入', () => {
    const out = tagBreakdown([
      focusLog({ tags: ['x'], actualMin: 25, completed: true }),
      focusLog({ tags: ['x'], actualMin: 10, completed: false }),
    ])
    expect(out).toEqual([{ tag: 'x', minutes: 25 }])
  })

  it('空 tags 陣列唔產生任何 entry', () => {
    expect(tagBreakdown([focusLog({ tags: [] })])).toEqual([])
  })
})

// ════════════════════════════════════════════════════════════════
//  totalsOf
// ════════════════════════════════════════════════════════════════
describe('totalsOf（總結指標，全部防除零）', () => {
  it('空 logs → 全部 0 / null，無 NaN', () => {
    const t = totalsOf([])
    expect(t).toEqual({
      focusMin: 0,
      sessions: 0,
      abandoned: 0,
      interruptions: 0,
      avgRating: null,
      completionRate: 0,
      avgSessionMin: 0,
    })
  })

  it('focusMin / sessions 只計 completed；abandoned = focus − done', () => {
    const t = totalsOf([
      focusLog({ actualMin: 25, completed: true }),
      focusLog({ actualMin: 30, completed: true }),
      focusLog({ actualMin: 10, completed: false }),
    ])
    expect(t.focusMin).toBe(55)
    expect(t.sessions).toBe(2)
    expect(t.abandoned).toBe(1)
  })

  it('全部 abandoned → done=0，防除零：completionRate=0、avgSessionMin=0', () => {
    const t = totalsOf([
      focusLog({ actualMin: 10, completed: false }),
      focusLog({ actualMin: 5, completed: false }),
    ])
    expect(t.sessions).toBe(0)
    expect(t.completionRate).toBe(0)
    expect(t.avgSessionMin).toBe(0)
    expect(t.avgRating).toBe(null)
  })

  it('interruptions 對「所有 focus」加總（含放棄節）', () => {
    // 此乃 interruptions 欄位的既定契約（總分心次數）。
    const t = totalsOf([
      focusLog({ interruptions: 2, completed: true }),
      focusLog({ interruptions: 3, completed: false }),
    ])
    expect(t.interruptions).toBe(5)
    // 對比基數：sessions 只計 completed = 1 → 兩者基數不同（StatsView 平均/節
    // 在 JSX 內用 interruptions/sessions，屬展示層議題，見檔尾說明）。
    expect(t.sessions).toBe(1)
  })

  it('interruptions 缺值用 ?? 0', () => {
    const t = totalsOf([focusLog({ interruptions: undefined }), focusLog({ interruptions: 4 })])
    expect(t.interruptions).toBe(4)
  })

  it('avgRating：只計有評分嘅 completed 節之平均', () => {
    const t = totalsOf([
      focusLog({ rating: 4, completed: true }),
      focusLog({ rating: 2, completed: true }),
      focusLog({ rating: undefined, completed: true }), // 無評分唔入分母
    ])
    expect(t.avgRating).toBe(3) // (4+2)/2
  })

  it('avgRating：completed 但無人評分 → null', () => {
    const t = totalsOf([focusLog({ rating: undefined, completed: true })])
    expect(t.avgRating).toBe(null)
  })

  it('avgRating：abandoned 節嘅評分唔計入', () => {
    const t = totalsOf([
      focusLog({ rating: 5, completed: true }),
      focusLog({ rating: 1, completed: false }), // 放棄，唔入
    ])
    expect(t.avgRating).toBe(5)
  })

  it('completionRate：done/focus*100（3/4 = 75）', () => {
    const t = totalsOf([
      focusLog({ completed: true }),
      focusLog({ completed: true }),
      focusLog({ completed: true }),
      focusLog({ completed: false }),
    ])
    expect(t.completionRate).toBe(75)
  })

  it('avgSessionMin = focusMin / done', () => {
    const t = totalsOf([
      focusLog({ actualMin: 20, completed: true }),
      focusLog({ actualMin: 40, completed: true }),
    ])
    expect(t.avgSessionMin).toBe(30)
  })

  it('非 focus（休息）完全唔計入任何指標', () => {
    const t = totalsOf([
      focusLog({ kind: 'short_break', actualMin: 5, completed: true, interruptions: 9 }),
      focusLog({ kind: 'long_break', actualMin: 15, completed: true }),
    ])
    expect(t).toEqual({
      focusMin: 0,
      sessions: 0,
      abandoned: 0,
      interruptions: 0,
      avgRating: null,
      completionRate: 0,
      avgSessionMin: 0,
    })
  })
})

// ════════════════════════════════════════════════════════════════
//  fmtDuration
// ════════════════════════════════════════════════════════════════
describe('fmtDuration（分鐘 → 中文時長）', () => {
  it('0 → 「0 分」', () => {
    expect(fmtDuration(0)).toBe('0 分')
  })
  it('< 60 → 「N 分」', () => {
    expect(fmtDuration(1)).toBe('1 分')
    expect(fmtDuration(59)).toBe('59 分')
  })
  it('60 / 61 邊界', () => {
    expect(fmtDuration(60)).toBe('1 時')
    expect(fmtDuration(61)).toBe('1 時 1 分')
  })
  it('整點唔顯示分；有餘數顯示分', () => {
    expect(fmtDuration(120)).toBe('2 時')
    expect(fmtDuration(125)).toBe('2 時 5 分')
  })
  it('先 Math.round：59.6 → 60 → 「1 時」', () => {
    expect(fmtDuration(59.6)).toBe('1 時')
  })
  it('小數四捨五入後 < 60', () => {
    expect(fmtDuration(25.4)).toBe('25 分')
    expect(fmtDuration(25.5)).toBe('26 分')
  })
  it('大數值', () => {
    expect(fmtDuration(600)).toBe('10 時')
    expect(fmtDuration(615)).toBe('10 時 15 分')
  })
})

// ════════════════════════════════════════════════════════════════
//  fmtClock
// ════════════════════════════════════════════════════════════════
describe('fmtClock（總秒數 → mm:ss）', () => {
  it('0 → 00:00', () => {
    expect(fmtClock(0)).toBe('00:00')
  })
  it('補零（< 10 秒 / < 10 分）', () => {
    expect(fmtClock(5)).toBe('00:05')
    expect(fmtClock(65)).toBe('01:05')
  })
  it('59 / 60 / 61 秒邊界', () => {
    expect(fmtClock(59)).toBe('00:59')
    expect(fmtClock(60)).toBe('01:00')
    expect(fmtClock(61)).toBe('01:01')
  })
  it('mm 可超過 99（唔截斷）', () => {
    expect(fmtClock(3600)).toBe('60:00')
    expect(fmtClock(6000)).toBe('100:00')
  })
})

// ════════════════════════════════════════════════════════════════
//  relativeDay
// ════════════════════════════════════════════════════════════════
describe('relativeDay（day key → 今日/昨日/M月D日）', () => {
  it('今日 → 「今日」', () => {
    expect(relativeDay(todayKey())).toBe('今日')
  })
  it('昨日 → 「昨日」', () => {
    expect(relativeDay(dayKey(addDays(new Date(), -1)))).toBe('昨日')
  })
  it('其他日 → 「M月D日」（無前導零）', () => {
    expect(relativeDay('2026-03-07')).toBe('3月7日')
    expect(relativeDay('2026-12-25')).toBe('12月25日')
  })
  it('閏年 2月29日', () => {
    expect(relativeDay('2028-02-29')).toBe('2月29日')
  })
})

// ════════════════════════════════════════════════════════════════
//  logsToCsv
// ════════════════════════════════════════════════════════════════
describe('logsToCsv（CSV 匯出）', () => {
  const projName = (id?: string) => (id === 'p1' ? '溫習' : '工作')

  it('空 logs → 淨係 header 一行', () => {
    const csv = logsToCsv([], projName)
    const lines = csv.split('\n')
    expect(lines).toHaveLength(1)
    expect(lines[0]).toContain('"日期"')
    expect(lines[0]).toContain('"完成"')
    expect(lines[0]).toContain('"筆記"')
  })

  it('kind 中文化 + 布林轉是/否', () => {
    const csv = logsToCsv(
      [focusLog({ kind: 'focus', completed: true, startedAt: localISO(2026, 5, 4, 9) })],
      projName,
    )
    const row = csv.split('\n')[1]
    expect(row).toContain('"專注"')
    expect(row).toContain('"是"')
  })

  it('休息類型中文化 + completed=false → 否', () => {
    const csv = logsToCsv(
      [focusLog({ kind: 'short_break', completed: false, startedAt: localISO(2026, 5, 4, 9) })],
      projName,
    )
    expect(csv.split('\n')[1]).toContain('"短休"')
    expect(csv.split('\n')[1]).toContain('"否"')
  })

  it('按 startedAt 升序排', () => {
    const csv = logsToCsv(
      [
        focusLog({ id: 'late', startedAt: localISO(2026, 5, 4, 15), label: 'B' }),
        focusLog({ id: 'early', startedAt: localISO(2026, 5, 4, 9), label: 'A' }),
      ],
      projName,
    )
    const rows = csv.split('\n').slice(1)
    expect(rows[0]).toContain('"A"')
    expect(rows[1]).toContain('"B"')
  })

  it('逃逸雙引號（「" → ""」）', () => {
    const csv = logsToCsv([focusLog({ label: 'say "hi"', startedAt: localISO(2026, 5, 4, 9) })], projName)
    // say "hi" 應變成 "say ""hi"""
    expect(csv).toContain('"say ""hi"""')
  })

  it('含逗號嘅欄位被引號包住（CSV 不會被誤切）', () => {
    const csv = logsToCsv([focusLog({ label: 'a,b,c', startedAt: localISO(2026, 5, 4, 9) })], projName)
    expect(csv).toContain('"a,b,c"')
  })

  it('note 換行轉空格', () => {
    const csv = logsToCsv(
      [focusLog({ note: 'line1\nline2', startedAt: localISO(2026, 5, 4, 9) })],
      projName,
    )
    expect(csv).toContain('"line1 line2"')
    // 整個 note 在同一 CSV 行（資料行數 = 1）
    expect(csv.split('\n')).toHaveLength(2)
  })

  it('缺 tags/rating/interruptions 用 ?? 預設（空 / 0）', () => {
    const csv = logsToCsv(
      [focusLog({ tags: undefined, rating: undefined, interruptions: undefined, startedAt: localISO(2026, 5, 4, 9) })],
      projName,
    )
    const cells = csv.split('\n')[1].split(',')
    // head 次序：日期,開始,結束,類型,專案,任務,標籤,計劃,實際,完成,中斷,評分,筆記
    expect(cells[6]).toBe('""') // tags 空
    expect(cells[10]).toBe('"0"') // interruptions ?? 0
    expect(cells[11]).toBe('""') // rating 缺 → 空
  })

  it('rating=0 當 falsy → 唔輸出（空）', () => {
    const csv = logsToCsv([focusLog({ rating: 0, startedAt: localISO(2026, 5, 4, 9) })], projName)
    const cells = csv.split('\n')[1].split(',')
    expect(cells[11]).toBe('""')
  })

  it('tags 用空格 join；專案經 projName 解析', () => {
    const csv = logsToCsv(
      [focusLog({ tags: ['a', 'b'], projectId: 'p1', startedAt: localISO(2026, 5, 4, 9) })],
      projName,
    )
    expect(csv).toContain('"a b"')
    expect(csv).toContain('"溫習"')
  })

  it('無 projectId → 專案欄留空', () => {
    const csv = logsToCsv([focusLog({ projectId: undefined, startedAt: localISO(2026, 5, 4, 9) })], projName)
    const cells = csv.split('\n')[1].split(',')
    expect(cells[4]).toBe('""')
  })
})

// ════════════════════════════════════════════════════════════════
//  getSettings（由設定陣列搵 SETTINGS_ID 條，搵唔到 fallback default）
//  設定集合契約：只得一條 record（id 固定 = SETTINGS_ID）。
// ════════════════════════════════════════════════════════════════
describe('getSettings（搵 SETTINGS_ID 條，缺則 fallback DEFAULT_SETTINGS）', () => {
  // 完整一條設定（與 DEFAULT 不同值），用以驗證「原樣回該條、唔被 default 覆蓋」。
  const customSettings: FocusSettings = {
    id: SETTINGS_ID,
    focusMin: 50,
    shortBreakMin: 10,
    longBreakMin: 20,
    longBreakEvery: 3,
    autoStartBreaks: true,
    autoStartFocus: true,
    tickSound: true,
    chimeSound: false,
    dailyGoal: 12,
  }

  it('陣列含 SETTINGS_ID 條 → 原樣回該條（同一 reference、唔混入 default）', () => {
    const found = getSettings([customSettings])
    expect(found).toBe(customSettings) // 回原物件本身（find 結果），非新建副本
    expect(found.focusMin).toBe(50) // 用自訂值，唔被 DEFAULT_SETTINGS.focusMin(25) 蓋
    expect(found.autoStartFocus).toBe(true)
  })

  it('多條時揀中 id === SETTINGS_ID 嗰條（忽略其他 id）', () => {
    const other: FocusSettings = { ...customSettings, id: 'other-id', focusMin: 99 }
    const found = getSettings([other, customSettings])
    expect(found).toBe(customSettings)
    expect(found.focusMin).toBe(50)
  })

  it('空陣列 → fallback：id === SETTINGS_ID + 全 DEFAULT_SETTINGS', () => {
    const fb = getSettings([])
    expect(fb.id).toBe(SETTINGS_ID)
    // fallback 攤平 DEFAULT_SETTINGS（逐欄等值）
    expect(fb).toEqual({ id: SETTINGS_ID, ...DEFAULT_SETTINGS })
    expect(fb.focusMin).toBe(25)
    expect(fb.dailyGoal).toBe(8)
    expect(fb.chimeSound).toBe(true)
  })

  it('陣列只有其他 id 嘅 record → 仍 fallback default（搵唔到目標 id）', () => {
    const other: FocusSettings = { ...customSettings, id: 'someone-else' }
    const fb = getSettings([other])
    expect(fb.id).toBe(SETTINGS_ID)
    expect(fb).toEqual({ id: SETTINGS_ID, ...DEFAULT_SETTINGS })
    // 確認無錯攞咗 other 嘅自訂值
    expect(fb.focusMin).toBe(DEFAULT_SETTINGS.focusMin)
  })
})

// ════════════════════════════════════════════════════════════════
//  fmtTime（ISO → 本地 HH:mm，補零；唔受 UTC 漂移）
//  與 store 其他本地時間慣例一致：用 getHours/getMinutes（非 UTC）。
//  fixtures 用本地建構 ISO（new Date(y,m,d,hh,mm).toISOString()），
//  故斷言喺任何 host TZ 都成立。
// ════════════════════════════════════════════════════════════════
describe('fmtTime（ISO → 本地 HH:mm，時 / 分補零）', () => {
  it('時 / 分都補零成兩位（09:05）', () => {
    expect(fmtTime(new Date(2026, 4, 4, 9, 5, 0).toISOString())).toBe('09:05')
  })

  it('只分需要補零（13:07）', () => {
    expect(fmtTime(new Date(2026, 4, 4, 13, 7, 0).toISOString())).toBe('13:07')
  })

  it('午夜邊界 00:00', () => {
    expect(fmtTime(new Date(2026, 4, 4, 0, 0, 0).toISOString())).toBe('00:00')
  })

  it('午夜後一分鐘 00:01（時補零）', () => {
    expect(fmtTime(new Date(2026, 4, 4, 0, 1, 0).toISOString())).toBe('00:01')
  })

  it('日終邊界 23:59', () => {
    expect(fmtTime(new Date(2026, 4, 4, 23, 59, 0).toISOString())).toBe('23:59')
  })

  it('唔受 UTC 漂移：HKT 凌晨（對應 UTC 前一日晚）仍回本地時鐘', () => {
    // 本地 00:30 HKT = 前一日 16:30 UTC；用 UTC 寫法會回 '16:30'（錯）。
    // fmtTime 用 getHours/getMinutes → 應回本地 '00:30'。
    expect(fmtTime(new Date(2026, 4, 4, 0, 30, 0).toISOString())).toBe('00:30')
    // 守護 TZ pin 真正生效（HKT = UTC+8）；否則上面時區斷言失去意義。
    expect(new Date(2026, 4, 4, 0, 30, 0).getTimezoneOffset()).toBe(-480)
  })

  it('秒被忽略（只取時 / 分，唔進位）', () => {
    expect(fmtTime(new Date(2026, 4, 4, 8, 9, 59).toISOString())).toBe('08:09')
  })
})
