import { describe, it, expect } from 'vitest'
import { buildCommentSystem, parseComments } from './commentPrompts'

describe('buildCommentSystem', () => {
  it('反映語氣 / 語言 / 科目', () => {
    const s = buildCommentSystem({ tone: 'strict', lang: 'en', length: 'short', subjectName: '數學' })
    expect(s).toContain('數學')
    expect(s).toContain('英文')
    expect(s).toContain('JSON')
  })
})

describe('parseComments', () => {
  it('按 idx 對位', () => {
    const raw = JSON.stringify([
      { idx: 1, comment: '甲表現穩定' },
      { idx: 3, comment: '丙需努力' },
    ])
    const r = parseComments(raw, 3)
    expect(r).toEqual(['甲表現穩定', '', '丙需努力'])
  })

  it('帶 fence / 夾雜文字', () => {
    const r = parseComments('```json\n' + JSON.stringify([{ idx: 1, comment: 'A' }]) + '\n```', 1)
    expect(r[0]).toBe('A')
  })

  it('idx 做字串都收', () => {
    const r = parseComments(JSON.stringify([{ idx: '2', comment: 'B' }]), 2)
    expect(r[1]).toBe('B')
  })

  it('超範圍 / 空評語忽略', () => {
    const r = parseComments(
      JSON.stringify([
        { idx: 0, comment: 'x' },
        { idx: 5, comment: 'y' },
        { idx: 1, comment: '' },
      ]),
      2,
    )
    expect(r).toEqual(['', ''])
  })

  it('格式錯 throw', () => {
    expect(() => parseComments('唔係 JSON', 2)).toThrow()
  })
})
