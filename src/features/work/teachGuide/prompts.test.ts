import { describe, it, expect } from 'vitest'
import { buildGuideSystem, parseGuide, isEmptyGuide } from './prompts'

describe('buildGuideSystem', () => {
  it('有科目時注入科目名', () => {
    expect(buildGuideSystem('經濟')).toContain('經濟')
  })
  it('冇科目都正常', () => {
    const s = buildGuideSystem()
    expect(s).toContain('keyPoints')
    expect(s).toContain('misconceptions')
  })
})

describe('parseGuide', () => {
  const good = {
    keyPoints: ['供求定律', '均衡價格'],
    misconceptions: ['以為價格只由供應決定'],
    steps: ['導入：生活例子', '講解：曲線', '練習', '總結'],
    activities: ['模擬市場拍賣'],
    differentiation: ['強：分析彈性', '弱：用圖解'],
    assessment: ['課堂提問', '隨堂小測'],
  }

  it('解析純 JSON', () => {
    const r = parseGuide(JSON.stringify(good))
    expect(r.keyPoints).toHaveLength(2)
    expect(r.steps).toHaveLength(4)
    expect(r.assessment[1]).toBe('隨堂小測')
  })

  it('解析帶 fence / 夾雜文字', () => {
    const r = parseGuide('結果如下：\n```json\n' + JSON.stringify(good) + '\n```\n完')
    expect(r.misconceptions).toHaveLength(1)
  })

  it('缺欄位回空陣列', () => {
    const r = parseGuide(JSON.stringify({ keyPoints: ['只有重點'] }))
    expect(r.keyPoints).toEqual(['只有重點'])
    expect(r.activities).toEqual([])
    expect(r.assessment).toEqual([])
  })

  it('過濾非字串', () => {
    const r = parseGuide(JSON.stringify({ keyPoints: ['有效', 1, '', null, '又一個'] }))
    expect(r.keyPoints).toEqual(['有效', '又一個'])
  })

  it('格式唔正確會 throw', () => {
    expect(() => parseGuide('唔係 JSON')).toThrow()
  })
})

describe('isEmptyGuide', () => {
  it('全空 = true', () => {
    expect(
      isEmptyGuide({
        keyPoints: [],
        misconceptions: [],
        steps: [],
        activities: [],
        differentiation: [],
        assessment: [],
      }),
    ).toBe(true)
  })
  it('有一段就 false', () => {
    expect(
      isEmptyGuide({
        keyPoints: ['x'],
        misconceptions: [],
        steps: [],
        activities: [],
        differentiation: [],
        assessment: [],
      }),
    ).toBe(false)
  })
})
