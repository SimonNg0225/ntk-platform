import { describe, it, expect } from 'vitest'
import { buildTrend, buildHeat, addDays, localDay, todayISO } from './util'
import type { FullTask, TaskMeta } from './types'

// ============================================================
//  buildTrend / buildHeat 純函式測試
//  ------------------------------------------------------------
//  兩個函式都用「系統今日」起計窗口，所以預期 key 一律由 addDays(
//  todayISO(), -n) 推導（唔硬碼日期），令斷言喺任何日子都成立。
//  同時用「explicit UTC ISO + 本地凌晨」case 驗 localDay 唔漂一日。
// ============================================================

// ── 測試工廠（同 util.test.ts 一致）──────────────────────
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

// 由今日往回 n 日嘅本地午夜時間戳（無 Z = 本地時間，畀 localDay 當本地）
const localNoonDaysAgo = (n: number): string => `${addDays(todayISO(), -n)}T12:00:00`

// ============================================================
//  buildTrend
// ============================================================
describe('buildTrend', () => {
  it('空 tasks：每桶 created/completed = 0、長度 = days、key 連續到今日', () => {
    const out = buildTrend([], 7)
    expect(out).toHaveLength(7)
    // 全部 0
    expect(out.every((p) => p.created === 0 && p.completed === 0)).toBe(true)
    // key 由最早（今日 -6）到今日，且逐日 +1 連續
    expect(out[0].key).toBe(addDays(todayISO(), -6))
    expect(out[6].key).toBe(todayISO())
    for (let i = 1; i < out.length; i++) {
      expect(out[i].key).toBe(addDays(out[i - 1].key, 1))
    }
  })

  it('days = 0 → 回空陣列（for 迴圈唔行）', () => {
    expect(buildTrend([], 0)).toEqual([])
    // 即使有 task 都係空（窗口長度 0）
    expect(buildTrend([task({ createdAt: localNoonDaysAgo(0) })], 0)).toEqual([])
  })

  it('days = 1 → 只得今日一桶', () => {
    const out = buildTrend([], 1)
    expect(out).toHaveLength(1)
    expect(out[0].key).toBe(todayISO())
  })

  it('label：日數無前導零（05 → 5、月初 1）', () => {
    // 直接驗每桶 label = 該 key 日分量去前導零
    const out = buildTrend([], 30)
    for (const p of out) {
      const dayNum = Number(p.key.split('-')[2])
      expect(p.label).toBe(String(dayNum))
      // 確認真係無前導零（例如 '05' 唔可以出現）
      expect(p.label).not.toMatch(/^0\d/)
    }
  })

  it('createdAt 落窗口 → created 計入；completed 預設 0', () => {
    const out = buildTrend([task({ createdAt: localNoonDaysAgo(2) })], 7)
    const key = addDays(todayISO(), -2)
    const hit = out.find((p) => p.key === key)!
    expect(hit.created).toBe(1)
    expect(hit.completed).toBe(0)
    // 其餘桶 created 全 0
    expect(out.filter((p) => p.key !== key).every((p) => p.created === 0)).toBe(true)
  })

  it('done && completedAt 落窗口 → completed 計入（同時 created 計喺建立日）', () => {
    const out = buildTrend(
      [
        task({
          createdAt: localNoonDaysAgo(3),
          done: true,
          meta: { completedAt: localNoonDaysAgo(1) },
        }),
      ],
      7,
    )
    const createdKey = addDays(todayISO(), -3)
    const doneKey = addDays(todayISO(), -1)
    expect(out.find((p) => p.key === createdKey)!.created).toBe(1)
    expect(out.find((p) => p.key === doneKey)!.completed).toBe(1)
    // created 唔會錯記去完成日
    expect(out.find((p) => p.key === doneKey)!.created).toBe(0)
  })

  it('同一日多條 task → created/completed 累加（>1）', () => {
    const day1 = localNoonDaysAgo(1)
    const out = buildTrend(
      [
        task({ id: 'a', createdAt: day1, done: true, meta: { completedAt: day1 } }),
        task({ id: 'b', createdAt: day1, done: true, meta: { completedAt: day1 } }),
        task({ id: 'c', createdAt: day1 }),
      ],
      7,
    )
    const hit = out.find((p) => p.key === addDays(todayISO(), -1))!
    expect(hit.created).toBe(3)
    expect(hit.completed).toBe(2)
  })

  it('createdAt / completedAt 喺窗口外 → 唔計入（idx.has 過濾）', () => {
    const out = buildTrend(
      [
        // 建立喺 10 日前（窗口只 7 日）
        task({
          id: 'old',
          createdAt: localNoonDaysAgo(10),
          done: true,
          meta: { completedAt: localNoonDaysAgo(10) },
        }),
      ],
      7,
    )
    expect(out.every((p) => p.created === 0 && p.completed === 0)).toBe(true)
  })

  it('done = true 但 completedAt 缺 → 只 created、唔計 completed', () => {
    const out = buildTrend(
      [task({ createdAt: localNoonDaysAgo(1), done: true, meta: {} })],
      7,
    )
    const hit = out.find((p) => p.key === addDays(todayISO(), -1))!
    expect(hit.created).toBe(1)
    expect(hit.completed).toBe(0)
    // 全窗口 completed 都係 0
    expect(out.every((p) => p.completed === 0)).toBe(true)
  })

  it('createdAt 係 UTC ISO，本地凌晨 → 行 localDay 配對本地桶（唔 off-by-one）', () => {
    // 用「今日本地午夜」嘅完整時間戳。localDay 會 parse 成本地時間 →
    // 必然係今日，唔會因 UTC slice 漂去尋日。
    const todayLocalMidnight = `${todayISO()}T00:00:00`
    const out = buildTrend([task({ createdAt: todayLocalMidnight })], 7)
    expect(out.find((p) => p.key === todayISO())!.created).toBe(1)
    // 尋日桶唔應該被誤記
    expect(out.find((p) => p.key === addDays(todayISO(), -1))!.created).toBe(0)
  })

  it('跨月/跨年窗口：key 連續正確', () => {
    // days 夠大令窗口必然跨月（30 日窗口必跨至少一次月界）。
    const out = buildTrend([], 30)
    expect(out).toHaveLength(30)
    for (let i = 1; i < out.length; i++) {
      expect(out[i].key).toBe(addDays(out[i - 1].key, 1))
    }
    expect(out[29].key).toBe(todayISO())
  })
})

// ============================================================
//  buildHeat
// ============================================================
describe('buildHeat', () => {
  it('空 tasks：全部 count = 0、長度 = days、key 連續到今日', () => {
    const cells = buildHeat([], 7)
    expect(cells).toHaveLength(7)
    expect(cells.every((c) => c.count === 0)).toBe(true)
    expect(cells[0].key).toBe(addDays(todayISO(), -6))
    expect(cells[6].key).toBe(todayISO())
    for (let i = 1; i < cells.length; i++) {
      expect(cells[i].key).toBe(addDays(cells[i - 1].key, 1))
    }
  })

  it('days = 0 → 空陣列', () => {
    expect(buildHeat([], 0)).toEqual([])
    expect(
      buildHeat([task({ done: true, meta: { completedAt: localNoonDaysAgo(0) } })], 0),
    ).toEqual([])
  })

  it('cells 順序：cells[0] 最早、cells[last] 今日', () => {
    const cells = buildHeat([], 5)
    expect(cells[0].key).toBe(addDays(todayISO(), -4))
    expect(cells[cells.length - 1].key).toBe(todayISO())
  })

  it('完成落窗口 → count 計入嗰一日', () => {
    const cells = buildHeat(
      [task({ done: true, meta: { completedAt: localNoonDaysAgo(2) } })],
      7,
    )
    const key = addDays(todayISO(), -2)
    expect(cells.find((c) => c.key === key)!.count).toBe(1)
    expect(cells.filter((c) => c.key !== key).every((c) => c.count === 0)).toBe(true)
  })

  it('同一日多項完成 → count 累加', () => {
    const day = localNoonDaysAgo(1)
    const cells = buildHeat(
      [
        task({ id: 'a', done: true, meta: { completedAt: day } }),
        task({ id: 'b', done: true, meta: { completedAt: day } }),
        task({ id: 'c', done: true, meta: { completedAt: day } }),
      ],
      7,
    )
    expect(cells.find((c) => c.key === addDays(todayISO(), -1))!.count).toBe(3)
  })

  it('completedAt 喺窗口外 → 唔出現喺 cells', () => {
    const cells = buildHeat(
      [task({ done: true, meta: { completedAt: localNoonDaysAgo(10) } })],
      7,
    )
    expect(cells.every((c) => c.count === 0)).toBe(true)
    // 而且窗口外嗰個 key 根本唔喺 cells 入面
    expect(cells.some((c) => c.key === addDays(todayISO(), -10))).toBe(false)
  })

  it('done = true 但 completedAt undefined → 唔計（if 守門）', () => {
    const cells = buildHeat([task({ done: true, meta: {} })], 7)
    expect(cells.every((c) => c.count === 0)).toBe(true)
  })

  it('completedAt 本地午夜（UTC ISO 邊界）→ 行 localDay 唔漂一日', () => {
    const todayLocalMidnight = `${todayISO()}T00:00:00`
    const cells = buildHeat(
      [task({ done: true, meta: { completedAt: todayLocalMidnight } })],
      7,
    )
    expect(cells.find((c) => c.key === todayISO())!.count).toBe(1)
    expect(cells.find((c) => c.key === addDays(todayISO(), -1))!.count).toBe(0)
  })

  it('跨月/跨年窗口：key 連續正確（30 日）', () => {
    const cells = buildHeat([], 30)
    expect(cells).toHaveLength(30)
    for (let i = 1; i < cells.length; i++) {
      expect(cells[i].key).toBe(addDays(cells[i - 1].key, 1))
    }
    expect(cells[29].key).toBe(todayISO())
  })

  it('localDay 對齊：completedAt 用 localDay 落本地桶（同 buildTrend 一致）', () => {
    // 完整時間戳（無 Z）會被 localDay 當本地 parse，落今日 -1 桶。
    const k = localDay(localNoonDaysAgo(1))
    expect(k).toBe(addDays(todayISO(), -1)) // 前置確認工具行為
    const cells = buildHeat(
      [task({ done: true, meta: { completedAt: localNoonDaysAgo(1) } })],
      7,
    )
    expect(cells.find((c) => c.key === k)!.count).toBe(1)
  })
})
