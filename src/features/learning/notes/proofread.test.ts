import { describe, it, expect } from 'vitest'
import { parseProofread, PROOFREAD_SYSTEM } from './proofread'

describe('PROOFREAD_SYSTEM', () => {
  it('提到兩類問題', () => {
    expect(PROOFREAD_SYSTEM).toContain('typo')
    expect(PROOFREAD_SYSTEM).toContain('fact')
  })
})

describe('parseProofread', () => {
  const rows = [
    { type: 'typo', quote: '蘋菓', suggestion: '蘋果', note: '錯別字' },
    { type: 'fact', quote: '香港有八個區', suggestion: '香港有十八個區', note: '事實錯誤' },
  ]

  it('解析純 JSON 陣列', () => {
    const r = parseProofread(JSON.stringify(rows))
    expect(r).toHaveLength(2)
    expect(r[0].type).toBe('typo')
    expect(r[1].type).toBe('fact')
    expect(r[1].suggestion).toBe('香港有十八個區')
  })

  it('解析帶 code fence', () => {
    const r = parseProofread('```json\n' + JSON.stringify(rows) + '\n```')
    expect(r).toHaveLength(2)
  })

  it('空陣列 = 冇問題', () => {
    expect(parseProofread('[]')).toEqual([])
  })

  it('缺 quote 或 suggestion 嘅項會被丟棄', () => {
    const r = parseProofread(
      JSON.stringify([
        { type: 'typo', quote: '', suggestion: '改' },
        { type: 'typo', quote: '有', suggestion: '' },
        { type: 'typo', quote: '保留', suggestion: '保留改' },
      ]),
    )
    expect(r).toEqual([{ type: 'typo', quote: '保留', suggestion: '保留改', note: '' }])
  })

  it('未知 type 當 typo', () => {
    const r = parseProofread(JSON.stringify([{ type: 'x', quote: 'a', suggestion: 'b' }]))
    expect(r[0].type).toBe('typo')
  })

  it('格式唔正確會 throw', () => {
    expect(() => parseProofread('唔係 JSON')).toThrow()
  })
})
