import { describe, it, expect } from 'vitest'
import {
  catMeta,
  priorityMeta,
  priorityRank,
  statusMeta,
  fromKey,
  computeProgress,
  clampPct,
  syncMilestonesInto,
  type DraftMilestone,
  type MilestoneStore,
  CATEGORIES,
  PRIORITIES,
  STATUSES,
} from './util'
import type { Milestone } from './types'

// 只測「純函式」：同樣輸入永遠同樣輸出、無 side effect。
// 跳過 todayKey / daysUntil / dueLabel / buildMomentum / relTime（依賴系統當前時間，
// 又唔接受日期參數，無法 deterministic 測）。

const ms = (over: Partial<Milestone>): Milestone => ({
  id: 'm',
  goalId: 'g',
  title: 't',
  done: false,
  weight: 1,
  order: 0,
  createdAt: '2026-05-01T00:00:00.000Z',
  ...over,
})

// ───────── 分類元資料 catMeta ─────────
describe('catMeta（分類 → 元資料，含 fallback）', () => {
  it('已知分類回對應 meta', () => {
    expect(catMeta('study').id).toBe('study')
    expect(catMeta('study').label).toBe('溫習')
    expect(catMeta('exam').label).toBe('考試')
    expect(catMeta('health').id).toBe('health')
  })

  it('undefined → 預設 other', () => {
    expect(catMeta(undefined).id).toBe('other')
    expect(catMeta(undefined).label).toBe('其他')
  })

  it('未知 id → fallback 到最後一項（other）', () => {
    // 強制傳一個唔喺列表嘅 id：應回最後一項而唔係 undefined
    expect(catMeta('nope' as never).id).toBe('other')
    expect(catMeta('nope' as never)).toBe(CATEGORIES[CATEGORIES.length - 1])
  })
})

// ───────── 優先 priorityMeta / priorityRank ─────────
describe('priorityMeta（優先 → 元資料）', () => {
  it('已知優先回對應 meta', () => {
    expect(priorityMeta('high').label).toBe('高')
    expect(priorityMeta('medium').label).toBe('中')
    expect(priorityMeta('low').label).toBe('低')
  })

  it('undefined → 預設 medium（PRIORITIES[1]）', () => {
    expect(priorityMeta(undefined)).toBe(PRIORITIES[1])
    expect(priorityMeta(undefined).id).toBe('medium')
  })
})

describe('priorityRank（排序權重：高=大）', () => {
  it('high=3, medium=2, low=1', () => {
    expect(priorityRank('high')).toBe(3)
    expect(priorityRank('medium')).toBe(2)
    expect(priorityRank('low')).toBe(1)
  })

  it('undefined 視為 medium=2', () => {
    expect(priorityRank(undefined)).toBe(2)
  })

  it('排序：高 > 中 > 低', () => {
    const sorted = (['low', 'high', 'medium'] as const)
      .slice()
      .sort((a, b) => priorityRank(b) - priorityRank(a))
    expect(sorted).toEqual(['high', 'medium', 'low'])
  })
})

// ───────── 狀態 statusMeta ─────────
describe('statusMeta（狀態 → 元資料）', () => {
  it('已知狀態回對應 meta', () => {
    expect(statusMeta('active').label).toBe('進行中')
    expect(statusMeta('paused').label).toBe('暫停')
    expect(statusMeta('done').label).toBe('已完成')
  })

  it('undefined → 預設 active（STATUSES[0]）', () => {
    expect(statusMeta(undefined)).toBe(STATUSES[0])
    expect(statusMeta(undefined).id).toBe('active')
  })
})

// ───────── 日期 fromKey（本地時區，無 UTC off-by-one）─────────
describe('fromKey（YYYY-MM-DD → 本地 Date，中午錨點）', () => {
  it('回本地日期（getFullYear/Month/Date 同字串一致）', () => {
    const d = fromKey('2026-05-04')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(4) // 5 月 → index 4
    expect(d.getDate()).toBe(4)
  })

  it('年初 / 年尾邊界唔會漂去前後一日', () => {
    const a = fromKey('2026-01-01')
    expect([a.getFullYear(), a.getMonth(), a.getDate()]).toEqual([2026, 0, 1])
    const b = fromKey('2026-12-31')
    expect([b.getFullYear(), b.getMonth(), b.getDate()]).toEqual([2026, 11, 31])
  })

  it('錨定喺中午 12:00（避開時區邊界 off-by-one）', () => {
    const d = fromKey('2026-03-15')
    expect(d.getHours()).toBe(12)
    expect(d.getMinutes()).toBe(0)
  })

  it('缺月/日 → 預設 1 月 1 日（防呆）', () => {
    const d = fromKey('2026')
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 0, 1])
  })
})

// ───────── 里程碑加權進度 computeProgress ─────────
describe('computeProgress（有里程碑 = 加權完成率；否則用 fallback）', () => {
  it('空里程碑：回 clamp 後嘅 fallback', () => {
    expect(computeProgress([], 50)).toBe(50)
    expect(computeProgress([], 0)).toBe(0)
    expect(computeProgress([], 100)).toBe(100)
  })

  it('空里程碑：fallback 超界要被夾到 [0,100]', () => {
    expect(computeProgress([], 150)).toBe(100) // 上限
    expect(computeProgress([], -10)).toBe(0) // 下限（負數）
  })

  it('加權：weights [2,3,1]、只完成第一個 → round(2/6*100)=33', () => {
    const list = [
      ms({ weight: 2, done: true }),
      ms({ weight: 3, done: false }),
      ms({ weight: 1, done: false }),
    ]
    expect(computeProgress(list, 99)).toBe(33) // fallback 被忽略
  })

  it('全部完成 → 100；全部未完成 → 0', () => {
    expect(
      computeProgress([ms({ weight: 2, done: true }), ms({ weight: 3, done: true })], 0),
    ).toBe(100)
    expect(
      computeProgress([ms({ weight: 5, done: false }), ms({ weight: 1, done: false })], 88),
    ).toBe(0)
  })

  it('weight 0 / 負數會被當作 1（最低權重）', () => {
    // weight:0 → done；weight:-5 → 未完成 → done=1, total=2 → 50
    const list = [ms({ weight: 0, done: true }), ms({ weight: -5, done: false })]
    expect(computeProgress(list, 0)).toBe(50)
  })

  it('round 行為：done=1/total=3 → round(33.33)=33', () => {
    const list = [
      ms({ weight: 1, done: true }),
      ms({ weight: 1, done: false }),
      ms({ weight: 1, done: false }),
    ]
    expect(computeProgress(list, 0)).toBe(33)
  })
})

// ───────── clampPct（夾到 0-100 整數）─────────
describe('clampPct（夾到 [0,100] + 四捨五入）', () => {
  it('範圍內四捨五入', () => {
    expect(clampPct(50.4)).toBe(50)
    expect(clampPct(50.5)).toBe(51)
    expect(clampPct(99.9)).toBe(100)
  })

  it('邊界：負數 → 0；超 100 → 100', () => {
    expect(clampPct(0)).toBe(0)
    expect(clampPct(100)).toBe(100)
    expect(clampPct(-5)).toBe(0)
    expect(clampPct(150)).toBe(100)
  })

  it('非有限值（NaN / ±Infinity）→ 0，唔可以污染進度', () => {
    // bug：原本 Math.max(0, Math.min(100, Math.round(NaN))) = NaN，
    // 會經 GoalDetail.bump() 寫入 progress 變成 NaN。clamp 必須回有效數字。
    expect(clampPct(NaN)).toBe(0)
    expect(clampPct(Infinity)).toBe(0)
    expect(clampPct(-Infinity)).toBe(0)
    // 真實情境：goal.progress 為 undefined 時 undefined + 10
    expect(clampPct((undefined as unknown as number) + 10)).toBe(0)
  })
})

// ───────── syncMilestonesInto（upsert，保留時間戳）─────────
// 迴歸測試：GoalEditor 原本「先全刪再重 add」會將每個里程碑嘅 createdAt
// 同已完成嘅 doneAt 重設為儲存當刻 → 原始建立／完成時間永久流失。
// 改成按 id upsert 後，純編輯標題唔應改動呢兩個時間戳。

// 造一個最小 in-memory MilestoneStore（仿 createCollection 行為）
function makeStore(seed: Milestone[]): MilestoneStore & { all: () => Milestone[] } {
  let items: Milestone[] = [...seed]
  return {
    get: () => items,
    add: (data) => {
      const item = { id: data.id ?? 'auto', ...data } as Milestone
      items = [...items, item]
      return item
    },
    update: (id, patch) => {
      items = items.map((i) => (i.id === id ? { ...i, ...patch } : i))
    },
    remove: (id) => {
      items = items.filter((i) => i.id !== id)
    },
    all: () => items,
  }
}

const draft = (over: Partial<DraftMilestone>): DraftMilestone => ({
  id: 'm1',
  title: 't',
  done: false,
  weight: 1,
  ...over,
})

describe('syncMilestonesInto（按 id upsert，保留 createdAt / doneAt）', () => {
  const CREATED = '2026-01-02T03:04:05.000Z'
  const DONE_AT = '2026-02-03T04:05:06.000Z'
  const NOW = '2026-06-01T00:00:00.000Z'

  it('純編輯既有里程碑標題：createdAt 不變、doneAt 不變（核心迴歸）', () => {
    const store = makeStore([
      { id: 'a', goalId: 'g', title: '舊標題', done: true, weight: 2, order: 0, createdAt: CREATED, doneAt: DONE_AT },
    ])
    syncMilestonesInto(
      store,
      'g',
      [draft({ id: 'a', title: '新標題', done: true, weight: 2 })],
      () => NOW,
    )
    const m = store.all().find((x) => x.id === 'a')!
    expect(m.title).toBe('新標題')
    expect(m.createdAt).toBe(CREATED) // 唔可以被重設
    expect(m.doneAt).toBe(DONE_AT) // 已完成嘅完成時間唔可以被重設
  })

  it('改其他里程碑唔影響無關里程碑嘅時間戳', () => {
    const store = makeStore([
      { id: 'a', goalId: 'g', title: 'A', done: true, weight: 1, order: 0, createdAt: CREATED, doneAt: DONE_AT },
      { id: 'b', goalId: 'g', title: 'B', done: false, weight: 1, order: 1, createdAt: '2026-01-05T00:00:00.000Z' },
    ])
    syncMilestonesInto(
      store,
      'g',
      [
        draft({ id: 'a', title: 'A', done: true, weight: 1 }),
        draft({ id: 'b', title: 'B 改咗', done: false, weight: 1 }),
      ],
      () => NOW,
    )
    const a = store.all().find((x) => x.id === 'a')!
    expect(a.createdAt).toBe(CREATED)
    expect(a.doneAt).toBe(DONE_AT)
  })

  it('done 由 false→true：寫入 doneAt = now', () => {
    const store = makeStore([
      { id: 'a', goalId: 'g', title: 'A', done: false, weight: 1, order: 0, createdAt: CREATED },
    ])
    syncMilestonesInto(store, 'g', [draft({ id: 'a', done: true })], () => NOW)
    const a = store.all().find((x) => x.id === 'a')!
    expect(a.done).toBe(true)
    expect(a.doneAt).toBe(NOW)
    expect(a.createdAt).toBe(CREATED)
  })

  it('done 由 true→false：清走 doneAt', () => {
    const store = makeStore([
      { id: 'a', goalId: 'g', title: 'A', done: true, weight: 1, order: 0, createdAt: CREATED, doneAt: DONE_AT },
    ])
    syncMilestonesInto(store, 'g', [draft({ id: 'a', done: false })], () => NOW)
    const a = store.all().find((x) => x.id === 'a')!
    expect(a.done).toBe(false)
    expect(a.doneAt).toBeUndefined()
  })

  it('新里程碑：add 並寫 createdAt = now；done 則 doneAt = now', () => {
    const store = makeStore([])
    syncMilestonesInto(
      store,
      'g',
      [
        draft({ id: 'new1', title: '未完成', done: false }),
        draft({ id: 'new2', title: '已完成', done: true }),
      ],
      () => NOW,
    )
    const n1 = store.all().find((x) => x.id === 'new1')!
    const n2 = store.all().find((x) => x.id === 'new2')!
    expect(n1.createdAt).toBe(NOW)
    expect(n1.doneAt).toBeUndefined()
    expect(n2.createdAt).toBe(NOW)
    expect(n2.doneAt).toBe(NOW)
  })

  it('草稿移除咗嘅里程碑：由 collection 刪走', () => {
    const store = makeStore([
      { id: 'a', goalId: 'g', title: 'A', done: false, weight: 1, order: 0, createdAt: CREATED },
      { id: 'b', goalId: 'g', title: 'B', done: false, weight: 1, order: 1, createdAt: CREATED },
    ])
    // 草稿只剩 a
    syncMilestonesInto(store, 'g', [draft({ id: 'a', title: 'A' })], () => NOW)
    expect(store.all().map((m) => m.id)).toEqual(['a'])
  })

  it('order 按草稿次序重寫；weight 0/負數夾到最低 1', () => {
    const store = makeStore([
      { id: 'a', goalId: 'g', title: 'A', done: false, weight: 3, order: 0, createdAt: CREATED },
      { id: 'b', goalId: 'g', title: 'B', done: false, weight: 3, order: 1, createdAt: CREATED },
    ])
    // 調轉次序：b 先、a 後；a weight 設 0（應變 1）
    syncMilestonesInto(
      store,
      'g',
      [
        draft({ id: 'b', title: 'B', weight: 2 }),
        draft({ id: 'a', title: 'A', weight: 0 }),
      ],
      () => NOW,
    )
    const a = store.all().find((x) => x.id === 'a')!
    const b = store.all().find((x) => x.id === 'b')!
    expect(b.order).toBe(0)
    expect(a.order).toBe(1)
    expect(a.weight).toBe(1) // 0 → 1
    expect(b.weight).toBe(2)
  })

  it('只處理指定 goalId，其他 goal 嘅里程碑唔受影響', () => {
    const store = makeStore([
      { id: 'a', goalId: 'g1', title: 'A', done: false, weight: 1, order: 0, createdAt: CREATED },
      { id: 'x', goalId: 'g2', title: 'X', done: true, weight: 1, order: 0, createdAt: CREATED, doneAt: DONE_AT },
    ])
    // 對 g1 做 sync，但草稿為空 → 只刪 g1 嘅，唔可以掂 g2
    syncMilestonesInto(store, 'g1', [], () => NOW)
    expect(store.all().map((m) => m.id)).toEqual(['x'])
    const x = store.all().find((m) => m.id === 'x')!
    expect(x.doneAt).toBe(DONE_AT)
  })
})
