import { describe, it, expect } from 'vitest'
import {
  buildSchemeSystem,
  parseScheme,
  buildRubricSystem,
  parseRubric,
} from './rubricPrompts'

describe('marking scheme', () => {
  it('system 反映科目同總分', () => {
    const s = buildSchemeSystem('數學', 10)
    expect(s).toContain('數學')
    expect(s).toContain('10')
  })
  it('解析 scheme', () => {
    const raw = JSON.stringify({
      modelAnswer: '答案要點',
      points: [{ text: '正確列式', marks: 2 }, { text: '計算正確', marks: 3 }],
      total: 5,
    })
    const r = parseScheme(raw)
    expect(r.points).toHaveLength(2)
    expect(r.total).toBe(5)
  })
  it('total 缺 → 由 points 加總', () => {
    const r = parseScheme(JSON.stringify({ points: [{ text: 'a', marks: 2 }, { text: 'b', marks: 3 }] }))
    expect(r.total).toBe(5)
  })
  it('帶 fence', () => {
    const r = parseScheme('```json\n' + JSON.stringify({ points: [{ text: 'x', marks: 1 }] }) + '\n```')
    expect(r.points).toHaveLength(1)
  })
  it('格式錯 throw', () => {
    expect(() => parseScheme('唔係 JSON')).toThrow()
  })
})

describe('rubric', () => {
  it('system 反映等級數', () => {
    expect(buildRubricSystem('英文', 4)).toContain('4')
  })
  it('解析 rubric', () => {
    const raw = JSON.stringify({
      criteria: [
        { name: '內容', levels: [{ label: '優', descriptor: '充實', marks: 4 }, { label: '可', descriptor: '一般', marks: 2 }] },
      ],
    })
    const r = parseRubric(raw)
    expect(r.criteria).toHaveLength(1)
    expect(r.criteria[0].levels).toHaveLength(2)
  })
  it('過濾無 name / 無 level 嘅準則', () => {
    const r = parseRubric(
      JSON.stringify({
        criteria: [
          { name: '', levels: [{ label: 'x', descriptor: 'y', marks: 1 }] },
          { name: '保留', levels: [{ label: 'a', descriptor: 'b', marks: 1 }] },
        ],
      }),
    )
    expect(r.criteria).toHaveLength(1)
    expect(r.criteria[0].name).toBe('保留')
  })
  it('冇 criteria throw', () => {
    expect(() => parseRubric(JSON.stringify({ criteria: [] }))).toThrow()
  })
})
