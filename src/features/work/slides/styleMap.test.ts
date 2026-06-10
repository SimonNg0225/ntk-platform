import { describe, it, expect } from 'vitest'
import { themeVars } from './styleMap'
import { getTheme } from './themes'

describe('slides/styleMap', () => {
  it('將 theme palette 轉成 CSS 變數', () => {
    const v = themeVars(getTheme('academic'))
    expect(v['--sl-bg']).toBe('#f8fafc')
    expect(v['--sl-primary']).toBe('#1e3a8a')
    expect(v['--sl-font-display']).toContain('serif')
  })
})
