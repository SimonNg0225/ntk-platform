import { describe, it, expect } from 'vitest'
import { buildDseSystem, parseDse } from './dsePrompts'

describe('buildDseSystem', () => {
  it('MC 提到選項', () => {
    expect(buildDseSystem('經濟', 'mc', 'medium', 5)).toContain('options')
  })
  it('論述提到 command word', () => {
    expect(buildDseSystem('歷史', 'essay', 'hard', 2)).toContain('command word')
  })
})

describe('parseDse', () => {
  it('解析含 MC + 要點', () => {
    const raw = JSON.stringify([
      { stem: '下列邊個…', marks: 1, options: ['A', 'B', 'C', 'D'], answerIndex: 2, markingPoints: ['C 正確'], levelHint: '理解概念' },
      { stem: '分析…', marks: 8, markingPoints: ['論點1', '論點2'], levelHint: '有論證有例子' },
    ])
    const r = parseDse(raw)
    expect(r).toHaveLength(2)
    expect(r[0].options).toHaveLength(4)
    expect(r[0].answerIndex).toBe(2)
    expect(r[1].markingPoints).toHaveLength(2)
    expect(r[1].options).toBeUndefined()
  })

  it('帶 fence', () => {
    const r = parseDse('```json\n' + JSON.stringify([{ stem: 'Q', marks: 2, markingPoints: [], levelHint: '' }]) + '\n```')
    expect(r).toHaveLength(1)
  })

  it('過濾冇 stem', () => {
    const r = parseDse(JSON.stringify([{ stem: '', marks: 1 }, { stem: '保留', marks: 1, markingPoints: [], levelHint: '' }]))
    expect(r).toHaveLength(1)
  })

  it('冇題 throw', () => {
    expect(() => parseDse('[]')).toThrow()
    expect(() => parseDse('唔係 JSON')).toThrow()
  })
})
