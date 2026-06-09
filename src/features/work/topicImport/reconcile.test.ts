import { describe, it, expect } from 'vitest'
import { reconcileTopics, planSummary } from './reconcile'

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
