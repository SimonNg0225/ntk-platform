import { describe, it, expect } from 'vitest'
import {
  catMeta,
  priorityMeta,
  priorityRank,
  statusMeta,
  fromKey,
  computeProgress,
  clampPct,
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
