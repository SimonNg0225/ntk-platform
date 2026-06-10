import { describe, it, expect } from 'vitest'
import { SLIDE_TYPES, emptyContent, type SlideType } from './types'

describe('slides/types', () => {
  it('涵蓋 10 種 slide-type', () => {
    expect(SLIDE_TYPES).toEqual([
      'title', 'section', 'bullets', 'twoCol', 'imageText',
      'quote', 'compare', 'timeline', 'quiz', 'summary',
    ])
  })

  it('每種 type 都有預設 content（必要欄位齊）', () => {
    for (const t of SLIDE_TYPES) {
      const c = emptyContent(t as SlideType)
      expect(c).toBeTypeOf('object')
    }
    expect(emptyContent('bullets')).toEqual({ heading: '', items: [] })
    expect(emptyContent('quiz')).toEqual({ question: '', options: [] })
    expect(emptyContent('compare')).toEqual({ heading: '', rows: [] })
  })
})
