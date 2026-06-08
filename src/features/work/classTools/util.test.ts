import { describe, it, expect } from 'vitest'
import { shuffle, makeGroups, fmtClock } from './util'

describe('shuffle', () => {
  it('保留所有元素、唔改原本', () => {
    const src = [1, 2, 3, 4, 5]
    const out = shuffle(src)
    expect(out).toHaveLength(5)
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5])
    expect(src).toEqual([1, 2, 3, 4, 5])
  })
})

describe('makeGroups', () => {
  it('分到指定組數、平均分配', () => {
    const g = makeGroups([1, 2, 3, 4, 5, 6, 7], 3)
    expect(g).toHaveLength(3)
    const sizes = g.map((x) => x.length).sort()
    expect(sizes).toEqual([2, 2, 3])
    expect(g.flat().sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('組數多過人數 → 唔會超過人數', () => {
    const g = makeGroups([1, 2], 5)
    expect(g.length).toBeLessThanOrEqual(2)
    expect(g.flat()).toHaveLength(2)
  })

  it('空陣列安全', () => {
    expect(makeGroups([], 3).flat()).toEqual([])
  })
})

describe('fmtClock', () => {
  it('格式 mm:ss', () => {
    expect(fmtClock(0)).toBe('00:00')
    expect(fmtClock(65)).toBe('01:05')
    expect(fmtClock(600)).toBe('10:00')
    expect(fmtClock(-5)).toBe('00:00')
  })
})
