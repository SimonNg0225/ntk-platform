// src/features/work/slides/pptx/spec.test.ts
import { describe, it, expect } from 'vitest'
import { hex, pptxFace, buildSlideOps } from './spec'
import { getTheme } from '../themes'
import type { Slide } from '../types'

const theme = getTheme('academic') // palette.bg #f8fafc, primary #1e3a8a

function slide(content: Slide['content']): Slide {
  return { id: 's1', content }
}

describe('slides/pptx/spec — 助手', () => {
  it('hex 去 # 並大寫', () => {
    expect(hex('#1e3a8a')).toBe('1E3A8A')
    expect(hex('1e3a8a')).toBe('1E3A8A')
  })
  it('hex 非法值回退黑色', () => {
    expect(hex('var(--x)')).toBe('000000')
  })
  it('pptxFace 抽第一個字體名（去引號）', () => {
    expect(pptxFace('"Source Han Serif", Georgia, serif')).toBe('Source Han Serif')
    expect(pptxFace('system-ui, sans-serif')).toBe('system-ui')
  })
})

describe('slides/pptx/spec — buildSlideOps', () => {
  it('每頁第一個 op 係背景填色（palette.bg）', () => {
    const ops = buildSlideOps(slide({ type: 'title', heading: 'T' }), theme)
    expect(ops[0]).toEqual({ kind: 'fill', color: 'F8FAFC' })
  })

  it('title：置中標題 text op，用 display 字體 + primary 色', () => {
    const ops = buildSlideOps(slide({ type: 'title', heading: '通脹', subheading: '三個成因' }), theme)
    const texts = ops.filter((o) => o.kind === 'text')
    expect(texts[0]).toMatchObject({ kind: 'text', text: '通脹', align: 'center', bold: true, color: '1E3A8A', fontFace: 'Source Han Serif' })
    expect(texts.some((o) => o.kind === 'text' && o.text === '三個成因')).toBe(true)
  })

  it('bullets：標題 text + bullets op（帶 items）', () => {
    const ops = buildSlideOps(slide({ type: 'bullets', heading: '成因', items: ['需求', '成本'] }), theme)
    expect(ops.some((o) => o.kind === 'text' && o.text === '成因')).toBe(true)
    const b = ops.find((o) => o.kind === 'bullets')
    expect(b).toMatchObject({ kind: 'bullets', items: ['需求', '成本'], bullet: true })
  })

  it('twoCol：兩個 bullets op（左右）', () => {
    const ops = buildSlideOps(slide({ type: 'twoCol', heading: '對比', left: ['a'], right: ['b'] }), theme)
    const bs = ops.filter((o) => o.kind === 'bullets')
    expect(bs).toHaveLength(2)
    expect(bs[0]).toMatchObject({ items: ['a'] })
    expect(bs[1]).toMatchObject({ items: ['b'] })
  })

  it('quote：置中大字 text，含書名號', () => {
    const ops = buildSlideOps(slide({ type: 'quote', text: '知識就是力量', attribution: '培根' }), theme)
    const q = ops.find((o) => o.kind === 'text' && o.text.includes('知識就是力量'))
    expect(q).toMatchObject({ align: 'center' })
    expect(ops.some((o) => o.kind === 'text' && o.text.includes('培根'))).toBe(true)
  })

  it('compare：table op，rows = [label, a, b]', () => {
    const ops = buildSlideOps(slide({ type: 'compare', heading: '比較', rows: [{ label: '價', a: '高', b: '低' }] }), theme)
    const tbl = ops.find((o) => o.kind === 'table')
    expect(tbl).toMatchObject({ kind: 'table', rows: [['價', '高', '低']] })
  })

  it('timeline：bullets op，每步 "N. label — detail"', () => {
    const ops = buildSlideOps(slide({ type: 'timeline', heading: '步驟', steps: [{ label: '引入', detail: '提問' }, { label: '探究' }] }), theme)
    const b = ops.find((o) => o.kind === 'bullets')
    expect(b).toMatchObject({ items: ['1. 引入 — 提問', '2. 探究'] })
  })

  it('quiz：題目 text + 選項 bullets "A. ..."', () => {
    const ops = buildSlideOps(slide({ type: 'quiz', question: '邊個啱？', options: ['甲', '乙'] }), theme)
    expect(ops.some((o) => o.kind === 'text' && o.text === '邊個啱？')).toBe(true)
    const b = ops.find((o) => o.kind === 'bullets')
    expect(b).toMatchObject({ items: ['A. 甲', 'B. 乙'] })
  })

  it('summary：bullets op，每點 "✓ ..."', () => {
    const ops = buildSlideOps(slide({ type: 'summary', heading: '總結', points: ['溫故', '知新'] }), theme)
    const b = ops.find((o) => o.kind === 'bullets')
    expect(b).toMatchObject({ items: ['✓ 溫故', '✓ 知新'] })
  })

  it('section：置中標題；有 kicker 時加一個 muted text', () => {
    const ops = buildSlideOps(slide({ type: 'section', heading: '第二章', kicker: '宏觀經濟' }), theme)
    expect(ops.some((o) => o.kind === 'text' && o.text === '第二章' && o.align === 'center')).toBe(true)
    expect(ops.some((o) => o.kind === 'text' && o.text === '宏觀經濟')).toBe(true)
  })

  it('imageText：標題 + 內文 text（Phase 2 唔處理圖）', () => {
    const ops = buildSlideOps(slide({ type: 'imageText', heading: '圖文', body: '內文', imageSide: 'right' }), theme)
    expect(ops.some((o) => o.kind === 'text' && o.text === '圖文')).toBe(true)
    expect(ops.some((o) => o.kind === 'text' && o.text === '內文')).toBe(true)
  })
})
