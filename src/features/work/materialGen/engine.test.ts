import { describe, expect, it } from 'vitest'
import { buildPrompt, parseDrafts } from './engine'

describe('materialGen engine DSE-style MC', () => {
  it('BAFS MC prompt includes subject-specific DSE calibration', () => {
    const prompt = buildPrompt('mc', '市場營銷管理', {
      difficulty: 'hard',
      count: 4,
      extra: '',
      subject: '企會財（商業管理範疇）',
    })

    expect(prompt).toContain('BAFS DSE-style 校準')
    expect(prompt).toContain('商業情境')
    expect(prompt).toContain('干擾選項')
    expect(prompt).toContain('唯一最佳答案')
    expect(prompt).toContain('rationales')
    expect(prompt).toContain('不可複製或改寫官方試題')
  })

  it('generic MC prompt still applies DSE-style quality rules', () => {
    const prompt = buildPrompt('mc', '細胞結構', {
      difficulty: 'medium',
      count: 3,
      extra: '加入資料判斷',
      subject: '生物',
    })

    expect(prompt).toContain('DSE-style 通用校準')
    expect(prompt).toContain('情境、資料或概念辨析')
    expect(prompt).toContain('答案唯一')
    expect(prompt).toContain('加入資料判斷')
  })

  it('parseDrafts preserves MC review metadata for teacher checking', () => {
    const drafts = parseDrafts('mc', [
      {
        stem: '某零售店推出會員積分計劃。以下哪項最能反映其市場營銷目的？',
        options: ['提高顧客忠誠度', '減少固定成本', '增加存貨周轉日數', '降低企業社會責任'],
        answerIndex: 0,
        marks: 1,
        examSkill: '情境應用',
        testedConcept: '顧客關係管理',
        trap: '把市場推廣目的與成本控制混淆',
        rationales: [
          '會員積分可鼓勵重複購買，最貼近顧客忠誠度。',
          '積分計劃通常會增加而非減少固定成本。',
          '存貨周轉日數不是此策略的直接目的。',
          '企業社會責任不是會員制度的主要目標。',
        ],
        followUp: '可請學生比較會員制、折扣和廣告的不同目的。',
      },
    ])

    expect(drafts).toHaveLength(1)
    expect(drafts[0].examSkill).toBe('情境應用')
    expect(drafts[0].testedConcept).toBe('顧客關係管理')
    expect(drafts[0].trap).toContain('成本控制')
    expect(drafts[0].rationales?.[0]).toContain('重複購買')
    expect(drafts[0].followUp).toContain('會員制')
  })
})
