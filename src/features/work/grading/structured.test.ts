import { describe, it, expect } from 'vitest'
import { SUBJECT_PACKS } from '../../../data/subjects'
import { MARKING_PROFILES, profileForSubject } from './markingProfiles'
import { buildStructuredSystem, parseStructured } from './structured'

describe('markingProfiles', () => {
  it('每個 SUBJECT_PACK 都解析到 profile（有準則 + 錯處分類）', () => {
    for (const p of SUBJECT_PACKS) {
      const prof = profileForSubject(p.id)
      expect(prof.rubric.length).toBeGreaterThan(0)
      expect(prof.issues.length).toBeGreaterThan(0)
    }
  })

  it('全 27 科逐科 bespoke：每個 pack id 都有自己嘅 profile（非 fallback）', () => {
    for (const p of SUBJECT_PACKS) {
      expect(MARKING_PROFILES[p.id]?.packId).toBe(p.id)
    }
  })

  it('未知科目 → custom 通用 fallback', () => {
    expect(profileForSubject('zzz').packId).toBe('custom')
    expect(profileForSubject(undefined).packId).toBe('custom')
    expect(profileForSubject(null).packId).toBe('custom')
  })
})

describe('buildStructuredSystem', () => {
  it('注入該科 persona + 準則 + 錯處 key + JSON 規格', () => {
    const s = buildStructuredSystem(MARKING_PROFILES.math)
    expect(s).toContain('數學')
    expect(s).toContain('方法')
    expect(s).toContain('"scores"')
    expect(s).toContain('calc')
  })

  it('英文科 → 英文輸出指示', () => {
    expect(buildStructuredSystem(MARKING_PROFILES.eng)).toMatch(/English/)
  })

  it('自訂 rubric 蓋過預設；題目會注入', () => {
    const s = buildStructuredSystem(MARKING_PROFILES.chin, {
      rubric: '內容50/表達50',
      question: '我的志願',
    })
    expect(s).toContain('內容50/表達50')
    expect(s).toContain('我的志願')
  })
})

describe('parseStructured', () => {
  it('解析正常 JSON', () => {
    const raw = JSON.stringify({
      total: 7,
      maxTotal: 10,
      scores: [{ criterion: '內容', score: 4, max: 5, comment: '好' }],
      issues: [{ quote: '錯處', type: 'wording', suggestion: '改法' }],
      overall: '整體不錯',
    })
    const r = parseStructured(raw)
    expect(r.total).toBe(7)
    expect(r.maxTotal).toBe(10)
    expect(r.scores).toHaveLength(1)
    expect(r.issues[0].suggestion).toBe('改法')
    expect(r.overall).toBe('整體不錯')
  })

  it('maxTotal 缺 → 由 scores 合計', () => {
    const raw = JSON.stringify({
      total: 8,
      scores: [
        { criterion: 'a', score: 4, max: 6 },
        { criterion: 'b', score: 4, max: 4 },
      ],
      issues: [],
      overall: '',
    })
    expect(parseStructured(raw).maxTotal).toBe(10)
  })

  it('容錯：濾走唔完整嘅 issue / score', () => {
    const raw = JSON.stringify({
      total: 0,
      maxTotal: 0,
      scores: [{ criterion: '', score: 1, max: 1 }],
      issues: [
        { quote: '', suggestion: 'x' },
        { quote: 'a', suggestion: 'b' },
      ],
      overall: '',
    })
    const r = parseStructured(raw)
    expect(r.scores).toHaveLength(0)
    expect(r.issues).toHaveLength(1)
  })

  it('壞回應 → throw', () => {
    expect(() => parseStructured('呢個唔係 JSON')).toThrow()
  })
})
