import { describe, it, expect } from 'vitest'
import { buildSlideSystem, parseDeck } from './slidePrompts'

describe('buildSlideSystem', () => {
  it('注入科目同版數', () => {
    const s = buildSlideSystem('經濟', 8)
    expect(s).toContain('經濟')
    expect(s).toContain('8')
    expect(s).toContain('slides')
  })
})

describe('parseDeck', () => {
  const good = {
    title: '供求理論',
    subtitle: '經濟 · 中四',
    slides: [
      { title: '咩係供求', bullets: ['供應', '需求'], notes: '由生活例子入手' },
      { title: '均衡價格', bullets: ['交叉點'] },
    ],
  }

  it('解析純 JSON', () => {
    const d = parseDeck(JSON.stringify(good), 'X')
    expect(d.title).toBe('供求理論')
    expect(d.subtitle).toBe('經濟 · 中四')
    expect(d.slides).toHaveLength(2)
    expect(d.slides[0].notes).toBe('由生活例子入手')
    expect(d.slides[1].notes).toBeUndefined()
  })

  it('解析帶 fence', () => {
    const d = parseDeck('```json\n' + JSON.stringify(good) + '\n```', 'X')
    expect(d.slides).toHaveLength(2)
  })

  it('缺 title 用 fallback', () => {
    const d = parseDeck(JSON.stringify({ slides: [{ title: 'A', bullets: ['x'] }] }), '後備標題')
    expect(d.title).toBe('後備標題')
  })

  it('過濾空版同非字串 bullet', () => {
    const d = parseDeck(
      JSON.stringify({
        title: 'T',
        slides: [{ title: '', bullets: [] }, { title: '保留', bullets: ['ok', 1, ''] }],
      }),
      'X',
    )
    expect(d.slides).toHaveLength(1)
    expect(d.slides[0].bullets).toEqual(['ok'])
  })

  it('冇 slides 會 throw', () => {
    expect(() => parseDeck(JSON.stringify({ title: 'T', slides: [] }), 'X')).toThrow()
    expect(() => parseDeck('唔係 JSON', 'X')).toThrow()
  })
})
