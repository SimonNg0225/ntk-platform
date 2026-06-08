import { describe, it, expect } from 'vitest'
import { buildEssaySystem, parseEssay } from './essayPrompts'

describe('buildEssaySystem', () => {
  it('中文 / 英文 / 自訂 rubric', () => {
    expect(buildEssaySystem('zh')).toContain('中文')
    expect(buildEssaySystem('en')).toContain('English')
    expect(buildEssaySystem('zh', '我的準則')).toContain('我的準則')
  })
})

describe('parseEssay', () => {
  const good = {
    total: 32,
    maxTotal: 40,
    scores: [
      { criterion: '內容', score: 14, max: 16, comment: '題材切題' },
      { criterion: '錯別字', score: 8, max: 10, comment: '有少量錯字' },
    ],
    issues: [{ quote: '我地', type: 'spelling', suggestion: '我哋' }],
    overall: '整體不錯，注意錯別字。',
  }

  it('解析純 JSON', () => {
    const r = parseEssay(JSON.stringify(good))
    expect(r.total).toBe(32)
    expect(r.maxTotal).toBe(40)
    expect(r.scores).toHaveLength(2)
    expect(r.issues[0].quote).toBe('我地')
    expect(r.overall).toContain('整體')
  })

  it('帶 fence', () => {
    const r = parseEssay('```json\n' + JSON.stringify(good) + '\n```')
    expect(r.scores).toHaveLength(2)
  })

  it('maxTotal 缺 → 由 scores 加總', () => {
    const r = parseEssay(JSON.stringify({ total: 20, scores: [{ criterion: 'A', score: 10, max: 25 }] }))
    expect(r.maxTotal).toBe(25)
  })

  it('過濾無效 score / issue', () => {
    const r = parseEssay(
      JSON.stringify({
        scores: [{ criterion: '', score: 5, max: 10 }, { criterion: '保留', score: 5, max: 10 }],
        issues: [{ quote: '', suggestion: 'x' }, { quote: 'a', suggestion: 'b' }],
      }),
    )
    expect(r.scores).toHaveLength(1)
    expect(r.issues).toHaveLength(1)
  })

  it('格式錯 throw', () => {
    expect(() => parseEssay('唔係 JSON')).toThrow()
  })
})
