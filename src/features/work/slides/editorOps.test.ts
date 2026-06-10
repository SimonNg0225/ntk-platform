import { describe, it, expect } from 'vitest'
import { reorderSlides, changeSlideType, newSlide } from './editorOps'
import type { Slide } from './types'

const mk = (id: string, type: Slide['content']['type'] = 'bullets'): Slide =>
  ({ id, content: type === 'bullets' ? { type, heading: 'H', items: ['a'] } : { type, heading: 'H' } as Slide['content'] })

describe('slides/editorOps', () => {
  it('reorderSlides 上移 / 下移；邊界唔郁', () => {
    const arr = [mk('1'), mk('2'), mk('3')]
    expect(reorderSlides(arr, 2, -1).map((s) => s.id)).toEqual(['1', '3', '2'])
    expect(reorderSlides(arr, 0, -1).map((s) => s.id)).toEqual(['1', '2', '3']) // 頂部上移無效
    expect(reorderSlides(arr, 2, 1).map((s) => s.id)).toEqual(['1', '2', '3'])  // 底部下移無效
  })

  it('changeSlideType 換 type 並用 emptyContent 重置，保留 id / imageRef / notes', () => {
    const s: Slide = { id: 'x', content: { type: 'bullets', heading: 'H', items: ['a'] }, speakerNotes: 'n', imageRef: { kind: 'stock', src: 'u' } }
    const out = changeSlideType(s, 'quiz')
    expect(out.id).toBe('x')
    expect(out.content.type).toBe('quiz')
    expect(out.content).toMatchObject({ question: '', options: [] })
    expect(out.speakerNotes).toBe('n')
    expect(out.imageRef).toEqual({ kind: 'stock', src: 'u' })
  })

  it('newSlide 造一張帶 id 嘅指定 type 空白頁', () => {
    const s = newSlide('summary')
    expect(s.id).toBeTruthy()
    expect(s.content).toEqual({ type: 'summary', heading: '', points: [] })
  })
})
