import { describe, expect, it } from 'vitest'
import { mergeRefinedDeck } from './refineDeck'
import type { Deck } from '../../../lib/export/types'

function mkDeck(n: number, over: Partial<Deck> = {}): Deck {
  return {
    title: 'ORIG',
    subtitle: 'orig-sub',
    coverImageQuery: 'orig cover',
    slides: Array.from({ length: n }, (_, i) => ({ title: `S${i}`, bullets: ['x'] })),
    ...over,
  }
}

describe('mergeRefinedDeck', () => {
  it('title 永遠以 original 為準（refine 改 title 不採用）', () => {
    const orig = mkDeck(4)
    const refined = mkDeck(4, { title: 'REFINED-TITLE' })
    expect(mergeRefinedDeck(orig, refined).title).toBe('ORIG')
  })

  it('refined 冇 coverImageQuery → 保留 original 的', () => {
    const orig = mkDeck(4)
    const refined = mkDeck(4, { coverImageQuery: undefined })
    expect(mergeRefinedDeck(orig, refined).coverImageQuery).toBe('orig cover')
  })

  it('refined 有 coverImageQuery → 用 refined', () => {
    const orig = mkDeck(4)
    const refined = mkDeck(4, { coverImageQuery: 'new cover' })
    expect(mergeRefinedDeck(orig, refined).coverImageQuery).toBe('new cover')
  })

  it('slides 大幅縮水（<50%）→ 拒絕、回 original.slides', () => {
    const orig = mkDeck(8)
    const refined = mkDeck(3) // 3 < ceil(8*0.5)=4
    expect(mergeRefinedDeck(orig, refined).slides).toHaveLength(8)
  })

  it('slides 適度增減（≥50%）→ 用 refined.slides', () => {
    const orig = mkDeck(8)
    const refined = mkDeck(6)
    const m = mergeRefinedDeck(orig, refined)
    expect(m.slides).toHaveLength(6)
  })

  it('refined.slides 空 → 保留 original', () => {
    const orig = mkDeck(4)
    const refined = mkDeck(0)
    expect(mergeRefinedDeck(orig, refined).slides).toHaveLength(4)
  })

  it('正常 refined → subtitle 用 refined（若有）', () => {
    const orig = mkDeck(4)
    const refined = mkDeck(4, { subtitle: 'new-sub' })
    expect(mergeRefinedDeck(orig, refined).subtitle).toBe('new-sub')
  })
})
