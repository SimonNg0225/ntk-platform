import { describe, it, expect } from 'vitest'
import { reconcileTopics, planSummary, planDedupe, planAppendByText } from './reconcile'

const existing = [
  { id: 'a', topic: '香港的營商環境' },
  { id: 'b', topic: '企業擁有權形式' }, // 同 next「企業擁有權類型」唔同名
  { id: 'c', topic: '生產及營運管理' }, // 新版冇
]

const next = [
  { part: '必修', area: '1(a)', topic: '香港的營商環境' }, // 同名 → 保留 id a
  { part: '必修', area: '1(a)', topic: '企業擁有權類型' }, // 新名 → 新增
]

describe('reconcileTopics', () => {
  it('同名保留 id（link 唔甩）', () => {
    const p = reconcileTopics(existing, next, () => false)
    const upd = p.updates.find((u) => u.topic === '香港的營商環境')
    expect(upd?.id).toBe('a')
    expect(upd?.order).toBe(1)
  })

  it('新名 → 新增', () => {
    const p = reconcileTopics(existing, next, () => false)
    expect(p.adds.some((a) => a.topic === '企業擁有權類型')).toBe(true)
  })

  it('舊有無資料連住 → 刪', () => {
    const p = reconcileTopics(existing, next, () => false)
    expect(p.removes).toContain('b')
    expect(p.removes).toContain('c')
    expect(p.keeps).toHaveLength(0)
  })

  it('舊有有資料連住 → 保留（唔刪、排後面）', () => {
    const p = reconcileTopics(existing, next, (id) => id === 'c')
    expect(p.removes).toContain('b')
    expect(p.removes).not.toContain('c')
    expect(p.keeps.find((k) => k.id === 'c')).toBeTruthy()
  })

  it('summary 計數正確', () => {
    const s = planSummary(reconcileTopics(existing, next, (id) => id === 'c'))
    expect(s).toEqual({ matched: 1, added: 1, kept: 1, removed: 1 })
  })

  it('完全唔同科（零配對）→ 全新增；舊有資料全保留', () => {
    const econ = [
      { part: '必修', area: 'A', topic: '稀少性' },
      { part: '必修', area: 'A', topic: '彈性' },
    ]
    const p = reconcileTopics(existing, econ, () => true)
    expect(p.updates).toHaveLength(0)
    expect(p.adds).toHaveLength(2)
    expect(p.keeps).toHaveLength(3) // 全部舊有都有資料連住 → 保留
    expect(p.removes).toHaveLength(0)
  })
})

describe('planDedupe', () => {
  it('同名又冇資料連住 → 剷走多出條（保留首條）', () => {
    const topics = [
      { id: 'chin-01', topic: '《論語》論仁／論孝／論君子' },
      { id: 'uid-x', topic: '《論語》論仁／論孝／論君子' }, // 同名、唔同 id（by-id 漏網）
      { id: 'chin-02', topic: '《魚我所欲也》（孟子）' },
    ]
    const remove = planDedupe(topics, () => false)
    expect(remove).toEqual(['uid-x']) // 保留首條 chin-01，剷走重複嗰條
  })

  it('referenced 條一律保留，唔會被剷', () => {
    const topics = [
      { id: 'uid-x', topic: '《論語》論仁' }, // 冇資料連住
      { id: 'chin-01', topic: '《論語》論仁' }, // 有資料連住（referenced）
    ]
    const remove = planDedupe(topics, (id) => id === 'chin-01')
    expect(remove).toEqual(['uid-x']) // 剷 unreferenced，保留 referenced
  })

  it('兩條同名都 referenced → 都保留（唔斷連，寧可暫留重複）', () => {
    const topics = [
      { id: 'a', topic: '同一課題' },
      { id: 'b', topic: '同一課題' },
    ]
    expect(planDedupe(topics, () => true)).toEqual([])
  })

  it('內部空格差異都當同名（norm）', () => {
    const topics = [
      { id: 'a', topic: '唐詩 三首' },
      { id: 'b', topic: '唐詩三首' },
    ]
    expect(planDedupe(topics, () => false)).toEqual(['b'])
  })

  it('冇重複 → 空陣列', () => {
    const topics = [
      { id: 'a', topic: '甲' },
      { id: 'b', topic: '乙' },
    ]
    expect(planDedupe(topics, () => false)).toEqual([])
  })
})

describe('planAppendByText', () => {
  const have = [
    { topic: '《論語》論仁', order: 1 },
    { topic: '《魚我所欲也》（孟子）', order: 2 },
  ]

  it('跳過同名（即使 id 唔同），order 接喺最大值後', () => {
    const incoming = [
      { id: 'chin-01', part: 'A', area: 'a', topic: '《論語》論仁' }, // 同名 → skip
      { id: 'chin-99', part: 'A', area: 'a', topic: '新課題' }, // 新 → 加
    ]
    const out = planAppendByText(have, incoming)
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ id: 'chin-99', topic: '新課題', order: 3 })
  })

  it('incoming 自身同名只加一次', () => {
    const out = planAppendByText([], [
      { part: 'A', area: 'a', topic: '重複' },
      { part: 'A', area: 'a', topic: '重複' },
    ])
    expect(out).toHaveLength(1)
    expect(out[0].order).toBe(1)
  })
})
