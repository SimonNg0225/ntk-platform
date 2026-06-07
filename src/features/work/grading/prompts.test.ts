import { describe, it, expect } from 'vitest'
import {
  buildGradingSystem,
  buildGradingPrompt,
  buildCommentSystem,
  buildCommentPrompt,
  COMMENT_TONES,
} from './prompts'

describe('grading prompts', () => {
  it('grading system 含批改格式 + 科目語境', () => {
    const s = buildGradingSystem('經濟')
    expect(s).toContain('批改')
    expect(s).toContain('分數')
    expect(s).toContain('改善建議')
    expect(s).toContain('經濟')
  })

  it('grading system 無科目時唔加科目句', () => {
    expect(buildGradingSystem()).not.toContain('任教科目')
  })

  it('grading prompt：文字答案含題目 / 滿分 / 準則 / 答案', () => {
    const p = buildGradingPrompt({
      question: '解釋通脹',
      totalMarks: '10',
      scheme: '每個成因 2 分',
      answer: '物價上升',
    })
    expect(p).toContain('解釋通脹')
    expect(p).toContain('【滿分】10')
    expect(p).toContain('每個成因 2 分')
    expect(p).toContain('物價上升')
    expect(p).toContain('請批改')
  })

  it('grading prompt：相片模式提示見附圖、唔輸出空答案區', () => {
    const p = buildGradingPrompt({ question: 'Q', hasImage: true })
    expect(p).toContain('見附圖')
    expect(p).not.toContain('【學生答案】\n\n請批改')
  })

  it('grading prompt：無滿分 / 無準則時略過嗰兩段', () => {
    const p = buildGradingPrompt({ question: 'Q', answer: 'A' })
    expect(p).not.toContain('【滿分】')
    expect(p).not.toContain('【評分準則】')
  })

  it('comment system：要求一段、家長睇得明', () => {
    const s = buildCommentSystem()
    expect(s).toContain('評語')
    expect(s).toContain('一段')
    expect(s).toContain('家長')
  })

  it('comment prompt：含學生名 / 摘要 / 語氣指引', () => {
    const p = buildCommentPrompt({
      studentName: '陳大文',
      summary: '數學 85、欠交功課',
      tone: 'firm',
    })
    expect(p).toContain('陳大文')
    expect(p).toContain('數學 85')
    expect(p).toContain('需改善')
  })

  it('comment tones 有 3 種、id 唯一', () => {
    expect(COMMENT_TONES).toHaveLength(3)
    const ids = COMMENT_TONES.map((t) => t.id)
    expect(new Set(ids).size).toBe(3)
  })
})
