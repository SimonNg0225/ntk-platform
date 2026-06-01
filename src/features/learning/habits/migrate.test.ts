// ============================================================
//  migrateLegacyHabits() — 舊 habits / habit_logs → v2 一次性遷移
//  ------------------------------------------------------------
//  此邏輯靠三樣 module-level 副作用：
//    ①collection 喺 createCollection() 即由 localStorage load（module-init）；
//    ②module-level `migrated` flag（同 process 內只跑一次）；
//    ③localStorage 旗標 'ntk.habits_v2_migrated'（跨 reload 守衞）。
//  故每個 case 都要：先備好 in-memory localStorage（含舊／v2 種子）→
//  vi.resetModules() 令 module 重新跑（重置 `migrated` flag + collection
//  重新 load）→ 再 await import('./types')。咁先測得到唔同初始狀態下嘅分支。
//
//  注意：唔引 jsdom，自行整最小 localStorage shim 用 vi.stubGlobal 注入。
//  createdAt fallback 用 new Date().toISOString()（依賴當前時間），故相關
//  case 用 vi.useFakeTimers + setSystemTime 鎖死，令斷言 deterministic。
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Habit, HabitLog } from './types'

// ───────── 最小 in-memory localStorage shim（只實作用到嘅 API）─────────
function makeLocalStorage() {
  const map = new Map<string, string>()
  return {
    store: map,
    getItem: (k: string): string | null => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string): void => {
      map.set(k, String(v))
    },
    removeItem: (k: string): void => {
      map.delete(k)
    },
    clear: (): void => {
      map.clear()
    },
  }
}

let ls: ReturnType<typeof makeLocalStorage>

// 先 seed 好 localStorage，再 reset + import，攞到「以該初始狀態開機」嘅 module。
async function freshImport() {
  vi.resetModules() // 重置 module-level `migrated` flag + 令 collection 重新 load
  return import('./types')
}

// 寫一個 collection 嘅初始 localStorage（用 createCollection 嘅 'ntk.' 前綴）。
const seedCol = (key: string, value: unknown) =>
  ls.setItem(`ntk.${key}`, JSON.stringify(value))

const readCol = <T>(key: string): T =>
  JSON.parse(ls.getItem(`ntk.${key}`) ?? 'null') as T

const FLAG_KEY = 'ntk.habits_v2_migrated'

beforeEach(() => {
  ls = makeLocalStorage()
  vi.stubGlobal('localStorage', ls)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

// ════════════════════════════════════════════════════════════════
//  ① 正常遷移：v2 空 + 舊有資料 → 全部搬過去
// ════════════════════════════════════════════════════════════════
describe('migrateLegacyHabits — v2 空 + 舊資料有嘢（正常遷移）', () => {
  it('遷移到位：id / name / icon 保留、frequency=daily、goalKind=build、order=index', async () => {
    seedCol('habits', [
      { id: 'h1', name: '飲水', icon: '💧', createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 'h2', name: '閱讀', icon: '📚', createdAt: '2026-02-02T00:00:00.000Z' },
    ])
    seedCol('habit_logs', [])

    const { migrateLegacyHabits, habitV2Col } = await freshImport()
    migrateLegacyHabits()

    const out = habitV2Col.get()
    expect(out).toHaveLength(2)

    expect(out[0]).toMatchObject({
      id: 'h1',
      name: '飲水',
      icon: '💧',
      frequency: { kind: 'daily' },
      goalKind: 'build',
      targetStreak: 0,
      archived: false,
      order: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
    })
    expect(out[1]).toMatchObject({
      id: 'h2',
      name: '閱讀',
      icon: '📚',
      order: 1,
      createdAt: '2026-02-02T00:00:00.000Z',
    })
  })

  it('color 依 HABIT_COLOR_KEYS round-robin（palette[i % len]）', async () => {
    const { HABIT_COLOR_KEYS } = await import('./types')
    const len = HABIT_COLOR_KEYS.length
    // 整 len+2 條，逼 index 繞返轉頭（i=len → 第 0 色；i=len+1 → 第 1 色）
    const legacy = Array.from({ length: len + 2 }, (_, i) => ({
      id: `h${i}`,
      name: `習慣 ${i}`,
      createdAt: '2026-01-01T00:00:00.000Z',
    }))
    seedCol('habits', legacy)
    seedCol('habit_logs', [])

    const { migrateLegacyHabits, habitV2Col, HABIT_COLOR_KEYS: KEYS } = await freshImport()
    migrateLegacyHabits()

    const out = habitV2Col.get()
    out.forEach((h, i) => {
      expect(h.color).toBe(KEYS[i % len])
    })
    // 明確守住「繞返轉頭」：第 0 條同第 len 條同色
    expect(out[0].color).toBe(out[len].color)
    expect(out[1].color).toBe(out[len + 1].color)
  })

  it('logs 一併遷移：只保留 id / habitId / date（其餘欄位丟棄）', async () => {
    seedCol('habits', [{ id: 'h1', name: '飲水', createdAt: '2026-01-01T00:00:00.000Z' }])
    seedCol('habit_logs', [
      { id: 'l1', habitId: 'h1', date: '2026-05-30' },
      { id: 'l2', habitId: 'h1', date: '2026-05-31' },
    ])

    const { migrateLegacyHabits, habitLogV2Col } = await freshImport()
    migrateLegacyHabits()

    const logs = habitLogV2Col.get()
    expect(logs).toEqual([
      { id: 'l1', habitId: 'h1', date: '2026-05-30' },
      { id: 'l2', habitId: 'h1', date: '2026-05-31' },
    ])
  })

  it('遷移後寫低 localStorage 旗標（下次 reload 唔再做）', async () => {
    seedCol('habits', [{ id: 'h1', name: '飲水', createdAt: '2026-01-01T00:00:00.000Z' }])
    seedCol('habit_logs', [])

    const { migrateLegacyHabits } = await freshImport()
    expect(ls.getItem(FLAG_KEY)).toBeNull() // 做之前未有旗標
    migrateLegacyHabits()
    expect(ls.getItem(FLAG_KEY)).toBe('1') // 做完打旗
  })
})

// ════════════════════════════════════════════════════════════════
//  ⑥ createdAt 缺失 → fallback 用 new Date().toISOString()
// ════════════════════════════════════════════════════════════════
describe('migrateLegacyHabits — createdAt 缺失 fallback', () => {
  it('舊 habit 無 createdAt → 用當下時間（vi 鎖死系統時間後可確定值）', async () => {
    vi.useFakeTimers()
    const fixed = new Date('2026-06-01T03:00:00.000Z')
    vi.setSystemTime(fixed)

    // 故意唔放 createdAt（legacy 寫法上 createdAt 係 required，但實際舊資料
    // 可能殘缺；source 用 `h.createdAt ?? new Date().toISOString()` 兜底）。
    seedCol('habits', [{ id: 'h1', name: '舊習慣' }])
    seedCol('habit_logs', [])

    const { migrateLegacyHabits, habitV2Col } = await freshImport()
    migrateLegacyHabits()

    expect(habitV2Col.get()[0].createdAt).toBe(fixed.toISOString())
  })

  it('部分有部分冇：有嘅保留原值，冇嘅先兜底', async () => {
    vi.useFakeTimers()
    const fixed = new Date('2026-06-01T03:00:00.000Z')
    vi.setSystemTime(fixed)

    seedCol('habits', [
      { id: 'h1', name: '有日期', createdAt: '2025-12-25T00:00:00.000Z' },
      { id: 'h2', name: '冇日期' },
    ])
    seedCol('habit_logs', [])

    const { migrateLegacyHabits, habitV2Col } = await freshImport()
    migrateLegacyHabits()

    const out = habitV2Col.get()
    expect(out[0].createdAt).toBe('2025-12-25T00:00:00.000Z') // 原值保留
    expect(out[1].createdAt).toBe(fixed.toISOString()) // 兜底
  })
})

// ════════════════════════════════════════════════════════════════
//  ② v2 已有資料 → 守衞：唔覆寫（no-op），但仍打旗
// ════════════════════════════════════════════════════════════════
describe('migrateLegacyHabits — v2 已有資料（守衞 no-op）', () => {
  it('唔覆寫既有 v2 habits（即使舊資料都有嘢）', async () => {
    const existingV2: Habit[] = [
      {
        id: 'v2-keep',
        name: '已存在 v2',
        color: 'rose',
        frequency: { kind: 'weekly', times: 3 },
        goalKind: 'quit',
        targetStreak: 21,
        archived: false,
        order: 0,
        createdAt: '2026-03-03T00:00:00.000Z',
      },
    ]
    seedCol('habits_v2', existingV2)
    seedCol('habits', [{ id: 'h1', name: '舊習慣', createdAt: '2026-01-01T00:00:00.000Z' }])
    seedCol('habit_logs', [{ id: 'l1', habitId: 'h1', date: '2026-05-30' }])

    const { migrateLegacyHabits, habitV2Col, habitLogV2Col } = await freshImport()
    migrateLegacyHabits()

    // v2 原封不動（守衞 existing.length === 0 唔成立）
    expect(habitV2Col.get()).toEqual(existingV2)
    // v2 logs 都唔應被舊 logs 蓋過（保持原本嘅空）
    expect(habitLogV2Col.get()).toEqual([])
  })

  it('no-op 情況下都會打旗標（往後唔再嘗試）', async () => {
    seedCol('habits_v2', [
      {
        id: 'v2-keep',
        name: '已存在',
        color: 'blue',
        frequency: { kind: 'daily' },
        goalKind: 'build',
        targetStreak: 0,
        archived: false,
        order: 0,
        createdAt: '2026-03-03T00:00:00.000Z',
      },
    ])
    seedCol('habits', [{ id: 'h1', name: '舊', createdAt: '2026-01-01T00:00:00.000Z' }])
    seedCol('habit_logs', [])

    const { migrateLegacyHabits } = await freshImport()
    migrateLegacyHabits()
    expect(ls.getItem(FLAG_KEY)).toBe('1')
  })
})

// ════════════════════════════════════════════════════════════════
//  ③ 舊資料空 → 唔遷移（v2 維持空）
// ════════════════════════════════════════════════════════════════
describe('migrateLegacyHabits — 舊資料空（唔遷移）', () => {
  it('舊 habits 空 → v2 維持空，但仍打旗', async () => {
    seedCol('habits', [])
    seedCol('habit_logs', [])

    const { migrateLegacyHabits, habitV2Col, habitLogV2Col } = await freshImport()
    migrateLegacyHabits()

    expect(habitV2Col.get()).toEqual([])
    expect(habitLogV2Col.get()).toEqual([])
    expect(ls.getItem(FLAG_KEY)).toBe('1')
  })

  it('舊 habits 空但有 logs（資料不一致）→ 仍唔遷移（守衞睇 habits.length）', async () => {
    // 守衞係 legacyHabits.length > 0；舊 habits 空就算有孤兒 logs 都唔搬。
    seedCol('habits', [])
    seedCol('habit_logs', [{ id: 'l1', habitId: 'ghost', date: '2026-05-30' }])

    const { migrateLegacyHabits, habitV2Col, habitLogV2Col } = await freshImport()
    migrateLegacyHabits()

    expect(habitV2Col.get()).toEqual([])
    expect(habitLogV2Col.get()).toEqual([]) // 孤兒 logs 唔會被搬入 v2
  })
})

// ════════════════════════════════════════════════════════════════
//  ④ localStorage 旗標已 '1' → 直接 return，唔再遷移
// ════════════════════════════════════════════════════════════════
describe('migrateLegacyHabits — localStorage 旗標已 1（早 return）', () => {
  it('旗標已 1：即使 v2 空 + 舊有嘢，都唔遷移（守衞係旗標，唔係資料）', async () => {
    ls.setItem(FLAG_KEY, '1') // 預先當「之前已遷移過」
    seedCol('habits', [{ id: 'h1', name: '舊', createdAt: '2026-01-01T00:00:00.000Z' }])
    seedCol('habit_logs', [{ id: 'l1', habitId: 'h1', date: '2026-05-30' }])
    seedCol('habits_v2', []) // v2 空

    const { migrateLegacyHabits, habitV2Col, habitLogV2Col } = await freshImport()
    migrateLegacyHabits()

    expect(habitV2Col.get()).toEqual([]) // 因旗標而完全跳過
    expect(habitLogV2Col.get()).toEqual([])
  })
})

// ════════════════════════════════════════════════════════════════
//  ⑤ module `migrated` flag 已 true → 第二次 call 即 return（idempotent）
// ════════════════════════════════════════════════════════════════
describe('migrateLegacyHabits — idempotent（同一 module 內只跑一次）', () => {
  it('第二次 call 係 no-op：就算之間清走旗標 + 加新舊資料，都唔會再搬', async () => {
    seedCol('habits', [{ id: 'h1', name: '飲水', createdAt: '2026-01-01T00:00:00.000Z' }])
    seedCol('habit_logs', [])

    const { migrateLegacyHabits, habitV2Col } = await freshImport()
    migrateLegacyHabits() // 第一次：搬 1 條 + 打旗 + 設 migrated=true
    expect(habitV2Col.get()).toHaveLength(1)

    // 模擬「之後又有新舊資料、又有人手動清走旗標」——若 `migrated` flag 真係
    // module-level，第二次 call 應喺第一句 `if (migrated) return` 即彈走。
    ls.removeItem(FLAG_KEY)
    habitV2Col.set([]) // 人為清空 v2
    seedCol('habits', [
      { id: 'hX', name: '後加', createdAt: '2026-04-04T00:00:00.000Z' },
    ])

    migrateLegacyHabits() // 第二次：應即 return，唔再搬

    expect(habitV2Col.get()).toEqual([]) // 維持被清空狀態（無第二次遷移）
    expect(ls.getItem(FLAG_KEY)).toBeNull() // 連旗標都冇再寫返（證實未行到打旗嗰句）
  })

  it('全新 module（resetModules 後）`migrated` 重置 → 可再次遷移', async () => {
    seedCol('habits', [{ id: 'h1', name: '飲水', createdAt: '2026-01-01T00:00:00.000Z' }])
    seedCol('habit_logs', [])

    const first = await freshImport()
    first.migrateLegacyHabits()
    expect(first.habitV2Col.get()).toHaveLength(1)

    // 全新 import（新 module 實例）：migrated 由 false 起，旗標亦因新 ls 而無。
    ls = makeLocalStorage()
    vi.stubGlobal('localStorage', ls)
    seedCol('habits', [
      { id: 'a', name: 'A', createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 'b', name: 'B', createdAt: '2026-01-02T00:00:00.000Z' },
    ])
    seedCol('habit_logs', [])

    const second = await freshImport()
    second.migrateLegacyHabits()
    expect(second.habitV2Col.get()).toHaveLength(2) // 新 module 可再遷移
  })
})

// ════════════════════════════════════════════════════════════════
//  錯誤容忍：localStorage.getItem 掟錯 → try/catch 吞掉，唔拋出
// ════════════════════════════════════════════════════════════════
describe('migrateLegacyHabits — localStorage 拋錯時靜默吞掉', () => {
  it('getItem 掟錯（如私密模式 quota）→ 唔向外拋', async () => {
    // 先用正常 ls 完成 module load（collection 已 load 完），再令 getItem 掟錯，
    // 咁 migrate 內讀旗標 `localStorage.getItem(flagKey)` 會入 catch。
    seedCol('habits', [{ id: 'h1', name: '飲水', createdAt: '2026-01-01T00:00:00.000Z' }])
    seedCol('habit_logs', [])
    const mod = await freshImport()

    const throwingLs = {
      ...ls,
      getItem: () => {
        throw new Error('SecurityError: localStorage 被封')
      },
    }
    vi.stubGlobal('localStorage', throwingLs)

    expect(() => mod.migrateLegacyHabits()).not.toThrow()
  })
})
