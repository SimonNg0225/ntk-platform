import { describe, expect, it } from 'vitest'
import { packTheme, SLIDE_PACKS, type SlidePackId } from './pptx'

const HEX = /^[0-9A-Fa-f]{6}$/

describe('packTheme', () => {
  it('inkwell 對齊 pptxPacks 定義', () => {
    const t = packTheme('inkwell')
    expect(t.bg).toBe('FFFFFF')
    expect(t.ink).toBe('1C1917')
    expect(t.accent).toBe('C2410C')
    expect(t.statColor).toBe('C2410C')
    expect(t.displayFont).toBe('Georgia')
    expect(t.displayItalic).toBe(true)
  })

  it('未知 id 回退 inkwell（永不 undefined）', () => {
    const t = packTheme('not-a-real-pack' as SlidePackId)
    expect(t).toBeDefined()
    expect(t.id).toBe('inkwell')
    expect(t.bg).toBe('FFFFFF')
  })

  it('全部 pack 都有有效 token', () => {
    for (const opt of SLIDE_PACKS) {
      const t = packTheme(opt.id)
      expect(t.id).toBe(opt.id)
      // hex 無 #
      expect(t.bg).toMatch(HEX)
      expect(t.ink).toMatch(HEX)
      expect(t.accent).toMatch(HEX)
      expect(t.statColor).toMatch(HEX)
      expect(t.panel).toMatch(HEX)
      // chart 色系非空、全部合法 hex
      expect(t.chartColors.length).toBeGreaterThan(0)
      for (const c of t.chartColors) expect(c).toMatch(HEX)
      // cardRadius 為數字
      expect(typeof t.cardRadius).toBe('number')
      expect(typeof t.dark).toBe('boolean')
      expect(typeof t.structDash).toBe('boolean')
      expect(t.displayFont.length).toBeGreaterThan(0)
    }
  })
})
