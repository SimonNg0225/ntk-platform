import { describe, it, expect } from 'vitest'
import { buildSlidesSystem, buildSlidesPrompt } from './prompts'

describe('slides/prompts', () => {
  it('system 要求 JSON 陣列 + 指明合法 slide type', () => {
    const s = buildSlidesSystem('企業、會計與財務概論')
    expect(s).toContain('JSON')
    expect(s).toContain('bullets')
    expect(s).toContain('企業、會計與財務概論')
  })

  it('prompt 帶課題與頁數', () => {
    const p = buildSlidesPrompt({ topic: '通脹', slideCount: 8, extra: '加例子' })
    expect(p).toContain('通脹')
    expect(p).toContain('8')
    expect(p).toContain('加例子')
  })
})
