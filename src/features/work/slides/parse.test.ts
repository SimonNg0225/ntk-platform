import { describe, it, expect } from 'vitest'
import { parseSlides } from './parse'

describe('slides/parse', () => {
  it('解析合法 JSON，過濾不明 type，補 id', () => {
    const raw = JSON.stringify([
      { type: 'title', content: { heading: '通脹' } },
      { type: 'bogus', content: {} },
      { type: 'bullets', content: { heading: '成因', items: ['需求', '成本'] } },
    ])
    const slides = parseSlides(raw)
    expect(slides).toHaveLength(2)
    expect(slides[0].content.type).toBe('title')
    expect(slides[0].id).toBeTruthy()
    expect(slides[1].content).toMatchObject({ type: 'bullets', items: ['需求', '成本'] })
  })

  it('容忍 markdown fence 與前後雜訊', () => {
    const raw = '```json\n[{"type":"quote","content":{"text":"知識就是力量"}}]\n```'
    const slides = parseSlides(raw)
    expect(slides).toHaveLength(1)
    expect(slides[0].content.type).toBe('quote')
  })

  it('缺欄位用 emptyContent 補齊', () => {
    const slides = parseSlides('[{"type":"bullets","content":{"heading":"X"}}]')
    expect(slides[0].content).toMatchObject({ type: 'bullets', heading: 'X', items: [] })
  })
})
