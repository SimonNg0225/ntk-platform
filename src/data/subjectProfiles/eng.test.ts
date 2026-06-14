import { describe, it, expect } from 'vitest'
import { getSubjectKnowledge } from './index'
import { ENG } from './eng'
import { buildRichSystem } from '../../features/work/grading/richSystem'

describe('English 知識檔案', () => {
  it('四個範疇：閱讀 / 寫作 / 聆聽綜合 / 說話', () => {
    expect(ENG.strands.map((s) => s.key)).toEqual([
      'reading',
      'writing',
      'listening-integrated',
      'speaking',
    ])
  })

  it('lang = en', () => {
    expect(ENG.lang).toBe('en')
  })

  it('每個課題都有 rubric / 批改慣例 / 常見錯誤 / issueTypes', () => {
    for (const s of ENG.strands) {
      expect(s.areas.length).toBeGreaterThanOrEqual(2)
      for (const a of s.areas) {
        expect(a.rubric.length).toBeGreaterThan(0)
        expect(a.issueTypes.length).toBeGreaterThan(0)
        expect(a.markingConventions.length).toBeGreaterThan(0)
        expect(a.commonErrors.length).toBeGreaterThan(0)
      }
    }
  })

  it('寫作 Part B 含八個選修單元', () => {
    const partB = ENG.strands
      .find((s) => s.key === 'writing')!
      .areas.find((a) => a.key === 'elective-extended')!
    expect(partB.keyConcepts.join(' ')).toMatch(/Short Stories|Drama|Workplace/)
  })

  it('registry：eng 解析到', () => {
    expect(getSubjectKnowledge('eng')?.subject).toBe('eng')
  })
})

describe('English buildRichSystem', () => {
  it('英文科 → 英文輸出指示 + JSON 規格', () => {
    const s = buildRichSystem(ENG, { strandKey: 'writing' })
    expect(s).toMatch(/in English/)
    expect(s).toContain('"scores"')
  })

  it('揀寫作 argumentative → 注入 Content / Language / Organisation', () => {
    const s = buildRichSystem(ENG, { strandKey: 'writing', areaKey: 'argumentative-persuasive' })
    expect(s).toMatch(/Content/)
    expect(s).toMatch(/Organisation/)
    expect(s).toMatch(/organization/) // issue type key
  })

  it('說話卷 persona 含四大評分域', () => {
    const s = buildRichSystem(ENG, { strandKey: 'speaking' })
    expect(s).toMatch(/Pronunciation & Delivery/)
    expect(s).toMatch(/Communication Strategies/)
  })

  it('閱讀 vs 寫作 → 唔同 persona', () => {
    expect(buildRichSystem(ENG, { strandKey: 'reading' })).not.toBe(
      buildRichSystem(ENG, { strandKey: 'writing' }),
    )
  })
})
