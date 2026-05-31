import { describe, it, expect } from 'vitest'
import {
  localISO,
  addDays,
  localDay,
  daysBetween,
  dueBucket,
  dueLabel,
  parseQuickAdd,
  projColorCls,
  smartSort,
  completionStreak,
  todayISO,
} from './util'
import type { HeatCell } from './util'
import type { FullTask, Project, TaskMeta, Priority } from './types'

// ── 測試工廠 ──────────────────────────────────────────────
const proj = (over: Partial<Project>): Project => ({
  id: 'p',
  name: 'Proj',
  color: 'accent',
  order: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  ...over,
})

const meta = (over: Partial<TaskMeta>): TaskMeta => ({
  id: 't',
  priority: 4,
  tags: [],
  order: 0,
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...over,
})

const task = (
  over: Omit<Partial<FullTask>, 'meta'> & { meta?: Partial<TaskMeta> },
): FullTask => {
  const { meta: metaOver, ...rest } = over
  return {
    id: 't',
    text: 'task',
    done: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    subtasks: [],
    ...rest,
    meta: meta(metaOver ?? {}),
  }
}

const cell = (count: number): HeatCell => ({ key: 'k', count })

// ── localISO：本地年月日，補零，無 UTC 漂移 ──────────────
describe('localISO', () => {
  it('補零月份/日', () => {
    // new Date(year, monthIndex, day) 用本地時間建構，localISO 亦讀本地分量
    expect(localISO(new Date(2026, 0, 5))).toBe('2026-01-05') // 一月（idx 0）
    expect(localISO(new Date(2026, 11, 31))).toBe('2026-12-31') // 十二月（idx 11）
    expect(localISO(new Date(2026, 8, 9))).toBe('2026-09-09')
  })
  it('本地午夜唔會因時區跳去前一日（off-by-one 防護）', () => {
    // 本地時間建構嘅 00:00，toISOString 喺 UTC+ 時區會變成前一日 23:xx，
    // 但 localISO 用本地分量，必然係當日。
    expect(localISO(new Date(2026, 4, 4, 0, 0, 0))).toBe('2026-05-04')
    expect(localISO(new Date(2026, 4, 4, 23, 59, 59))).toBe('2026-05-04')
  })
})

// ── addDays：跨月/跨年/負數/零 ────────────────────────────
describe('addDays', () => {
  it('一般加減', () => {
    expect(addDays('2026-05-10', 5)).toBe('2026-05-15')
    expect(addDays('2026-05-10', -3)).toBe('2026-05-07')
    expect(addDays('2026-05-10', 0)).toBe('2026-05-10')
  })
  it('跨月邊界', () => {
    expect(addDays('2026-05-31', 1)).toBe('2026-06-01')
    expect(addDays('2026-06-01', -1)).toBe('2026-05-31')
  })
  it('跨年邊界', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
  })
  it('閏/平年二月', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28') // 2026 平年
    expect(addDays('2024-03-01', -1)).toBe('2024-02-29') // 2024 閏年
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01')
  })
})

// ── localDay：完整時間戳 → 本地 YYYY-MM-DD ────────────────
describe('localDay', () => {
  it('無時區標記嘅時間戳當本地時間（off-by-one 防護）', () => {
    // JS 將「日期+時間、無 Z」當本地時間 parse；localDay 必然回當日，
    // 唔會因 UTC 換算偏差一日。
    expect(localDay('2026-05-04T00:00:00')).toBe('2026-05-04')
    expect(localDay('2026-05-04T23:30:00')).toBe('2026-05-04')
    expect(localDay('2026-12-31T12:00:00')).toBe('2026-12-31')
  })
})

// ── daysBetween：b - a ───────────────────────────────────
describe('daysBetween', () => {
  it('正負/零', () => {
    expect(daysBetween('2026-05-01', '2026-05-08')).toBe(7)
    expect(daysBetween('2026-05-08', '2026-05-01')).toBe(-7)
    expect(daysBetween('2026-05-04', '2026-05-04')).toBe(0)
  })
  it('跨月/跨年', () => {
    expect(daysBetween('2026-05-31', '2026-06-01')).toBe(1)
    expect(daysBetween('2025-12-31', '2026-01-01')).toBe(1)
  })
  it('閏/平年二月', () => {
    expect(daysBetween('2026-02-28', '2026-03-01')).toBe(1) // 平年
    expect(daysBetween('2024-02-28', '2024-03-01')).toBe(2) // 閏年（跨 2/29）
  })
})

// ── dueBucket：分桶邊界 ──────────────────────────────────
describe('dueBucket', () => {
  const ref = '2026-05-10'
  it('無到期 → none', () => {
    expect(dueBucket(undefined, ref)).toBe('none')
    expect(dueBucket('', ref)).toBe('none')
  })
  it('逾期/今日/聽日', () => {
    expect(dueBucket('2026-05-09', ref)).toBe('overdue')
    expect(dueBucket('2026-05-10', ref)).toBe('today')
    expect(dueBucket('2026-05-11', ref)).toBe('tomorrow')
  })
  it('soon/later 邊界（7 vs 8 日）', () => {
    expect(dueBucket('2026-05-12', ref)).toBe('soon') // +2
    expect(dueBucket('2026-05-17', ref)).toBe('soon') // +7（含）
    expect(dueBucket('2026-05-18', ref)).toBe('later') // +8
  })
})

// ── dueLabel：人類可讀文字（ref = 2026-05-04 星期一）────────
describe('dueLabel', () => {
  const ref = '2026-05-04' // 星期一
  it('今日/聽日/尋日', () => {
    expect(dueLabel('2026-05-04', ref)).toBe('今日')
    expect(dueLabel('2026-05-05', ref)).toBe('聽日')
    expect(dueLabel('2026-05-03', ref)).toBe('尋日')
  })
  it('逾期 N 日（N≥2）', () => {
    expect(dueLabel('2026-05-01', ref)).toBe('逾期 3 日')
    expect(dueLabel('2026-04-04', ref)).toBe('逾期 30 日')
  })
  it('一週內顯示星期 +「N 日後」', () => {
    // 2026-05-06 係星期三 → 週三（2 日後）
    expect(dueLabel('2026-05-06', ref)).toBe('週三（2 日後）')
    // 2026-05-11 係星期一 → 週一（7 日後）
    expect(dueLabel('2026-05-11', ref)).toBe('週一（7 日後）')
  })
  it('超過一週顯示「月日 星期」', () => {
    // 2026-05-20 係星期三
    expect(dueLabel('2026-05-20', ref)).toBe('5月20日 週三')
  })
})

// ── parseQuickAdd：智能解析（非日期部分 deterministic）──────
describe('parseQuickAdd', () => {
  const projects = [proj({ id: 'p1', name: '雜務' }), proj({ id: 'p2', name: 'Work' })]

  it('純文字：無任何記號', () => {
    const r = parseQuickAdd('簡單任務', projects)
    expect(r.text).toBe('簡單任務')
    expect(r.priority).toBeUndefined()
    expect(r.projectId).toBeUndefined()
    expect(r.tags).toEqual([])
    expect(r.due).toBeUndefined()
  })

  it('優先級：!!! → P1，!! → P2，! → P3', () => {
    expect(parseQuickAdd('做嘢 !!!', projects).priority).toBe(1 as Priority)
    expect(parseQuickAdd('做嘢 !!', projects).priority).toBe(2 as Priority)
    expect(parseQuickAdd('做嘢 !', projects).priority).toBe(3 as Priority)
  })

  it('標籤：多個 + 去重', () => {
    const r = parseQuickAdd('task @家務 @急 @家務', projects)
    expect(r.tags).toEqual(['家務', '急'])
    expect(r.text).toBe('task')
  })

  it('專案：完全相符 → 配對 id 並移除 token', () => {
    const r = parseQuickAdd('買米 #雜務', projects)
    expect(r.projectId).toBe('p1')
    expect(r.text).toBe('買米')
  })

  it('專案：部分相符（包含）/ 大小寫無關', () => {
    expect(parseQuickAdd('a #雜', projects).projectId).toBe('p1') // 包含「雜」
    expect(parseQuickAdd('b #work', projects).projectId).toBe('p2') // 大小寫無關
  })

  it('專案：無配對 → 唔設 id，且保留原文 #token', () => {
    const r = parseQuickAdd('task #唔存在', projects)
    expect(r.projectId).toBeUndefined()
    expect(r.text).toBe('task #唔存在')
  })

  it('綜合：文字 + 優先級 + 標籤 + 專案一齊', () => {
    const r = parseQuickAdd('買牛奶 !!! @家務 #雜務', projects)
    expect(r.text).toBe('買牛奶')
    expect(r.priority).toBe(1 as Priority)
    expect(r.tags).toEqual(['家務'])
    expect(r.projectId).toBe('p1')
  })

  it('到期關鍵字/+N：設到期且為合法本地 ISO（相對今日）', () => {
    // due 依賴系統今日，唔斷言確切值；只驗格式 + 相對關係（deterministic 邏輯）
    const r1 = parseQuickAdd('交報告 today', projects)
    expect(r1.due).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(r1.due).toBe(todayISO()) // today → 今日（0 偏移）
    expect(r1.text).toBe('交報告')

    const r2 = parseQuickAdd('交報告 +3', projects)
    expect(r2.due).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(daysBetween(todayISO(), r2.due!)).toBe(3) // +3 → 今日後 3 日

    const r3 = parseQuickAdd('交報告 tmr', projects)
    expect(daysBetween(todayISO(), r3.due!)).toBe(1) // 聽日 → +1
  })
})

// ── projColorCls：已知色 + fallback ──────────────────────
describe('projColorCls', () => {
  it('已知色回對應 class', () => {
    expect(projColorCls('blue').dot).toBe('bg-blue-500')
    expect(projColorCls('green').dot).toBe('bg-emerald-500')
    expect(projColorCls('accent').dot).toBe('bg-accent')
  })
  it('未知色 fallback 去 accent', () => {
    expect(projColorCls('唔存在').dot).toBe('bg-accent')
    expect(projColorCls('').dot).toBe('bg-accent')
  })
})

// ── smartSort：未完成優先 → 到期 → 優先級 → order ──────────
describe('smartSort', () => {
  it('未完成排喺已完成之前', () => {
    const done = task({ done: true })
    const undone = task({ done: false })
    expect(smartSort(undone, done)).toBeLessThan(0)
    expect(smartSort(done, undone)).toBeGreaterThan(0)
  })
  it('有到期排喺無到期之前', () => {
    const withDue = task({ meta: { due: '2026-05-10' } })
    const noDue = task({ meta: {} })
    expect(smartSort(withDue, noDue)).toBeLessThan(0)
    expect(smartSort(noDue, withDue)).toBeGreaterThan(0)
  })
  it('兩者都有到期：較早者在前', () => {
    const early = task({ meta: { due: '2026-05-10' } })
    const late = task({ meta: { due: '2026-05-20' } })
    expect(smartSort(early, late)).toBeLessThan(0)
    expect(smartSort(late, early)).toBeGreaterThan(0)
  })
  it('同到期：按優先級（P1 在 P3 前）', () => {
    const p1 = task({ meta: { due: '2026-05-10', priority: 1 } })
    const p3 = task({ meta: { due: '2026-05-10', priority: 3 } })
    expect(smartSort(p1, p3)).toBeLessThan(0)
  })
  it('同優先級無到期：按手動 order', () => {
    const a = task({ meta: { order: 1 } })
    const b = task({ meta: { order: 5 } })
    expect(smartSort(a, b)).toBe(-4)
    expect(smartSort(b, a)).toBe(4)
  })
})

// ── completionStreak：連續完成日數 ───────────────────────
describe('completionStreak', () => {
  it('空陣列 → 0', () => {
    expect(completionStreak([])).toBe(0)
  })
  it('今日未完成唔斷 streak（由尋日往前數）', () => {
    // [前日, 尋日, 今日=0] → 數到尋日+前日 = 2
    expect(completionStreak([cell(1), cell(1), cell(0)])).toBe(2)
  })
  it('今日完成 → 連同往前一齊數', () => {
    // [前日=0, 尋日, 今日] → 今日+尋日 = 2，到前日=0 斷
    expect(completionStreak([cell(0), cell(1), cell(1)])).toBe(2)
  })
  it('中間有空窗即斷（非今日）', () => {
    // [..., 尋日=0, 今日=1] → 今日 1，尋日 0 斷
    expect(completionStreak([cell(1), cell(0), cell(1)])).toBe(1)
  })
  it('全部完成', () => {
    expect(completionStreak([cell(1), cell(1), cell(1)])).toBe(3)
  })
  it('全部 0', () => {
    expect(completionStreak([cell(0), cell(0), cell(0)])).toBe(0)
  })
  it('單格今日=0 → 0；單格今日=1 → 1', () => {
    expect(completionStreak([cell(0)])).toBe(0)
    expect(completionStreak([cell(1)])).toBe(1)
  })
})
