import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { seedDemo } from './demo'
import { goalsCol } from '../../../data/collections'
import { goalMetaCol, milestonesCol, goalCheckinsCol } from './types'
import { computeProgress } from './util'
import type { Goal } from '../../../data/types'
import type { GoalMeta, Milestone, GoalCheckin } from './types'

// ============================================================
//  學習目標示範 seeder（seedDemo）
//  ------------------------------------------------------------
//  依賴 goalsCol / goalMetaCol / milestonesCol / goalCheckinsCol 狀態
//  （非純函式）→ 每個 case 用 set([]) 控制起始狀態（同
//  health/demo.test.ts、fitness/training/demo.test.ts 手法）。
//  node 環境無 localStorage，但 store 嘅 set/load 全 try/catch 包住，
//  collection 內存 items 照樣運作。
//
//  四個 collection 守衞各自獨立：只喺對應 collection 而家係空先種，
//  已有資料就跳過嗰個 collection（尊重出廠／用戶資料）。
//  關鍵語意：blueprints 只喺 goalsCol 為空先建立；故若 goalsCol 非空
//  （即使 meta/milestones 為空），meta/milestones 都唔會被種（無藍本可種）。
//
//  日期一律經 util.fromKey/todayKey（本地時區）產生，故 case 鎖死系統
//  時間令斷言 deterministic，兼守「本地日 vs UTC 切日」off-by-one：
//  鎖 07:00 HKT（= 前一日 23:00 UTC）。
// ============================================================

// 自種一套完整藍本（goalsCol 空）時嘅預期計數（對齊 demo.ts buildBlueprints）：
const SEEDED_GOALS = 5
const SEEDED_METAS = 5
// 里程碑：goal1=4, goal2=0, goal3=3, goal4=0, goal5=3 → 10
const SEEDED_MILESTONES = 10
// buildCheckinsForSeeded：PMP 3 + 跑步 2 + TypeScript 1 → 6
const SEEDED_CHECKINS = 6
const SEEDED_TOTAL =
  SEEDED_GOALS + SEEDED_METAS + SEEDED_MILESTONES + SEEDED_CHECKINS

// 造一條最簡 goal / meta / milestone（只填守衞會用到嘅欄位）
const goal = (over: Partial<Goal> = {}): Goal => ({
  id: 'mine',
  title: '我自己嘅目標',
  progress: 10,
  createdAt: '2026-05-01T00:00:00.000Z',
  ...over,
})
const meta = (over: Partial<GoalMeta> = {}): GoalMeta => ({
  id: 'mine',
  category: 'study',
  priority: 'medium',
  status: 'active',
  ...over,
})
const milestone = (over: Partial<Milestone> = {}): Milestone => ({
  id: 'mine-ms',
  goalId: 'mine',
  title: '我嘅里程碑',
  done: false,
  weight: 1,
  order: 0,
  createdAt: '2026-05-01T00:00:00.000Z',
  ...over,
})
const checkin = (over: Partial<GoalCheckin> = {}): GoalCheckin => ({
  id: 'mine-ci',
  goalId: 'mine',
  progress: 10,
  createdAt: '2026-05-01T00:00:00.000Z',
  ...over,
})

beforeEach(() => {
  // 每個 case 前清空四個相關 collection，模擬新用戶 / 已清資料。
  // 出廠種子（goal-1/2、ms-1..3、goalMeta）唔會干擾。
  goalsCol.set([])
  goalMetaCol.set([])
  milestonesCol.set([])
  goalCheckinsCol.set([])
  vi.useFakeTimers()
  // 07:00 HKT = 2026-05-31T23:00:00Z（UTC 噖日）。鎖死令日期 helper 可預期。
  vi.setSystemTime(new Date(2026, 5, 1, 7, 0, 0)) // 2026-06-01 本地
})

afterEach(() => {
  vi.useRealTimers()
})

// ───────── ① 空 → 三個 col 都種到嘢，added > 0 ─────────
describe('seedDemo — 全空（用戶清空過）→ 種一套完整連貫目標', () => {
  it('三個主 col 都種到嘢、added > 0、且 added === 實際新增總 row 數', () => {
    const added = seedDemo()
    expect(added).toBeGreaterThan(0)
    expect(goalsCol.get().length).toBeGreaterThan(0)
    expect(goalMetaCol.get().length).toBeGreaterThan(0)
    expect(milestonesCol.get().length).toBeGreaterThan(0)
    // added 必須等於四個 col 實際新增嘅 row 總數（無漏計 / 多計）
    const actual =
      goalsCol.get().length +
      goalMetaCol.get().length +
      milestonesCol.get().length +
      goalCheckinsCol.get().length
    expect(added).toBe(actual)
    // 對齊 buildBlueprints 藍本固定計數
    expect(added).toBe(SEEDED_TOTAL)
    expect(goalsCol.get()).toHaveLength(SEEDED_GOALS)
    expect(goalMetaCol.get()).toHaveLength(SEEDED_METAS)
    expect(milestonesCol.get()).toHaveLength(SEEDED_MILESTONES)
    expect(goalCheckinsCol.get()).toHaveLength(SEEDED_CHECKINS)
  })

  it('種入嘅 goal / meta / milestone / checkin 全部有獨一 id（uid 產生，無重複）', () => {
    seedDemo()
    for (const rows of [
      goalsCol.get(),
      goalMetaCol.get(),
      milestonesCol.get(),
      goalCheckinsCol.get(),
    ]) {
      const ids = rows.map((r) => r.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })
})

// ───────── ② id 對得上 + 加權進度有料（唔淨係 fallback）─────────
describe('seedDemo — goal ↔ meta ↔ milestone 關聯完整', () => {
  it('每個種入嘅 goal 都有對應 goalMeta（id 一一對應、無多無少）', () => {
    seedDemo()
    const goalIds = new Set(goalsCol.get().map((g) => g.id))
    const metaIds = new Set(goalMetaCol.get().map((m) => m.id))
    // 數量相同 + 每個 goal 都有 meta + 每個 meta 都對應一個 goal
    expect(metaIds.size).toBe(goalIds.size)
    for (const gid of goalIds) expect(metaIds.has(gid)).toBe(true)
    for (const mid of metaIds) expect(goalIds.has(mid)).toBe(true)
  })

  it('至少一個目標有里程碑，且其加權進度由里程碑算出（非 fallback）', () => {
    seedDemo()
    const milestones = milestonesCol.get()
    // 按 goalId 分組
    const byGoal = new Map<string, Milestone[]>()
    for (const m of milestones) {
      const arr = byGoal.get(m.goalId) ?? []
      arr.push(m)
      byGoal.set(m.goalId, arr)
    }
    // 至少一個 goal 有 milestones（畀 computeProgress 加權）
    expect(byGoal.size).toBeGreaterThan(0)

    // 揀一個「部分完成」嘅 goal：加權進度應落喺 (0,100) 開區間，
    // 證明係由 done/weight 真正算出，唔係吞 fallback。
    const partial = [...byGoal.values()].find(
      (list) => list.some((m) => m.done) && list.some((m) => !m.done),
    )
    expect(partial).toBeDefined()
    // 故意傳一個明顯錯嘅 fallback（999）：有里程碑時必須被忽略。
    const prog = computeProgress(partial!, 999)
    expect(prog).toBeGreaterThan(0)
    expect(prog).toBeLessThan(100)
    expect(prog).not.toBe(999) // fallback 被忽略
  })

  it('「全部完成」嘅目標（IELTS）加權進度 = 100；fallback 不參與', () => {
    seedDemo()
    const byGoal = new Map<string, Milestone[]>()
    for (const m of milestonesCol.get()) {
      const arr = byGoal.get(m.goalId) ?? []
      arr.push(m)
      byGoal.set(m.goalId, arr)
    }
    const allDone = [...byGoal.values()].find(
      (list) => list.length > 0 && list.every((m) => m.done),
    )
    expect(allDone).toBeDefined()
    expect(computeProgress(allDone!, 0)).toBe(100) // fallback 0 都應被忽略
  })

  it('里程碑 weight 全部 ≥ 1、order 連續由 0 起（每個 goal 內）', () => {
    seedDemo()
    const byGoal = new Map<string, Milestone[]>()
    for (const m of milestonesCol.get()) {
      const arr = byGoal.get(m.goalId) ?? []
      arr.push(m)
      byGoal.set(m.goalId, arr)
    }
    for (const list of byGoal.values()) {
      for (const m of list) expect(m.weight).toBeGreaterThanOrEqual(1)
      const orders = list.map((m) => m.order).sort((a, b) => a - b)
      expect(orders).toEqual(list.map((_, i) => i)) // 0,1,2,...
    }
  })

  it('已完成里程碑帶 doneAt、未完成則無 doneAt（時間線一致）', () => {
    seedDemo()
    for (const m of milestonesCol.get()) {
      if (m.done) expect(m.doneAt).toBeTruthy()
      else expect(m.doneAt).toBeUndefined()
    }
  })
})

// ───────── ③ 任一 col 已有資料 → 對應部分唔覆寫 ─────────
describe('seedDemo — 各 collection 守衞獨立、唔覆寫既有資料', () => {
  it('goalsCol 已有用戶 goal → 唔種任何 goal/meta/milestone（無藍本），只種 checkins', () => {
    // 關鍵語意：blueprints 只喺 goalsCol 空先建立。goalsCol 非空時 blueprints=[]，
    // 即使 meta/milestones 本身為空，亦無嘢可種（尊重既有 goalsCol 狀態）。
    goalsCol.set([goal({ id: 'mine' })])
    const added = seedDemo()
    // goal 唔覆寫
    expect(goalsCol.get().map((g) => g.id)).toEqual(['mine'])
    // meta / milestones 仍為空（無藍本可種）
    expect(goalMetaCol.get()).toHaveLength(0)
    expect(milestonesCol.get()).toHaveLength(0)
    // checkins 空 → 種預設（掛出廠 goal-1 / goal-2）
    expect(goalCheckinsCol.get().length).toBeGreaterThan(0)
    expect(added).toBe(goalCheckinsCol.get().length)
  })

  it('goalMetaCol 已有資料（但 goalsCol 空）→ goals/milestones 照種、meta 唔覆寫', () => {
    goalMetaCol.set([meta({ id: 'pre', priority: 'low' })])
    const added = seedDemo()
    // goals / milestones 照種（goalsCol 空 → 有藍本）
    expect(goalsCol.get()).toHaveLength(SEEDED_GOALS)
    expect(milestonesCol.get()).toHaveLength(SEEDED_MILESTONES)
    // meta 唔被覆寫（仍係用戶嗰條 'pre'）
    expect(goalMetaCol.get().map((m) => m.id)).toEqual(['pre'])
    expect(goalMetaCol.get()[0].priority).toBe('low')
    // added 唔含 meta（5 + 0 + 10 + 6）
    expect(added).toBe(SEEDED_GOALS + SEEDED_MILESTONES + SEEDED_CHECKINS)
  })

  it('milestonesCol 已有資料（但 goalsCol 空）→ goals/meta 照種、milestones 唔覆寫', () => {
    milestonesCol.set([milestone({ id: 'pre-ms' })])
    const added = seedDemo()
    expect(goalsCol.get()).toHaveLength(SEEDED_GOALS)
    expect(goalMetaCol.get()).toHaveLength(SEEDED_METAS)
    // milestones 唔被覆寫
    expect(milestonesCol.get().map((m) => m.id)).toEqual(['pre-ms'])
    // added 唔含 milestones（5 + 5 + 0 + 6）
    expect(added).toBe(SEEDED_GOALS + SEEDED_METAS + SEEDED_CHECKINS)
  })

  it('goalCheckinsCol 已有資料 → 其餘照種、checkins 唔覆寫（added 唔含 checkins）', () => {
    goalCheckinsCol.set([checkin({ id: 'pre-ci' })])
    const added = seedDemo()
    expect(goalCheckinsCol.get().map((c) => c.id)).toEqual(['pre-ci'])
    // 其餘三個照種
    expect(added).toBe(SEEDED_GOALS + SEEDED_METAS + SEEDED_MILESTONES)
  })
})

// ───────── ④ 已有資料再 call → added === 0 idempotent ─────────
describe('seedDemo — idempotent（重複 call 唔再種）', () => {
  it('全空時種一次，再 call → added === 0，各 col 數目不變', () => {
    const first = seedDemo()
    expect(first).toBe(SEEDED_TOTAL)
    const snapshot = [
      goalsCol.get().length,
      goalMetaCol.get().length,
      milestonesCol.get().length,
      goalCheckinsCol.get().length,
    ]

    const again = seedDemo()
    expect(again).toBe(0)
    expect([
      goalsCol.get().length,
      goalMetaCol.get().length,
      milestonesCol.get().length,
      goalCheckinsCol.get().length,
    ]).toEqual(snapshot)
  })

  it('連 call 三次：只有第一次種到，之後恒 0', () => {
    expect(seedDemo()).toBe(SEEDED_TOTAL)
    expect(seedDemo()).toBe(0)
    expect(seedDemo()).toBe(0)
  })
})

// ───────── ⑤ 無孤兒：milestone.goalId / checkin.goalId 指向存在嘅 goal ─────────
describe('seedDemo — 引用完整性（無孤兒）', () => {
  it('全空種入時：每條 milestone.goalId 都指向一個種入嘅 goal', () => {
    seedDemo()
    const goalIds = new Set(goalsCol.get().map((g) => g.id))
    for (const m of milestonesCol.get()) {
      expect(goalIds.has(m.goalId)).toBe(true)
    }
  })

  it('全空種入時：每條 checkin.goalId 都指向一個種入嘅 goal（自種簽到掛新目標）', () => {
    seedDemo()
    const goalIds = new Set(goalsCol.get().map((g) => g.id))
    const checkins = goalCheckinsCol.get()
    expect(checkins.length).toBeGreaterThan(0)
    for (const c of checkins) {
      expect(goalIds.has(c.goalId)).toBe(true)
    }
  })

  it('預設情境（goalsCol 非空 → 無自種目標）：簽到掛出廠目標 goal-1 / goal-2', () => {
    // goalsCol 已有出廠等價資料 → blueprints 空 → 用 buildDefaultCheckins。
    goalsCol.set([goal({ id: 'goal-1' }), goal({ id: 'goal-2' })])
    seedDemo()
    const checkinGoalIds = new Set(goalCheckinsCol.get().map((c) => c.goalId))
    // 預設簽到只應掛 goal-1 / goal-2
    expect([...checkinGoalIds].sort()).toEqual(['goal-1', 'goal-2'])
  })
})
