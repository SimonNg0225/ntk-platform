import { describe, it, expect } from 'vitest'
import { getSubjectKnowledge } from './index'
import { BAFS } from './bafs'
import { buildRichSystem, resolveStrand } from '../../features/work/grading/richSystem'
import { parseStructured } from '../../features/work/grading/structured'

describe('BAFS 知識檔案', () => {
  it('有三個範疇：必修 / 會計 / 商業管理', () => {
    expect(BAFS.strands.map((s) => s.key)).toEqual(['core', 'accounting', 'bm'])
  })

  it('會計同商管範疇各有多個課題，每個有 rubric + issueTypes', () => {
    for (const key of ['accounting', 'bm']) {
      const strand = BAFS.strands.find((s) => s.key === key)!
      expect(strand.areas.length).toBeGreaterThanOrEqual(5)
      for (const a of strand.areas) {
        expect(a.rubric.length).toBeGreaterThan(0)
        expect(a.issueTypes.length).toBeGreaterThan(0)
        expect(a.markingConventions.length).toBeGreaterThan(0)
        expect(a.commonErrors.length).toBeGreaterThan(0)
      }
    }
  })

  it('registry：bafs 有、未知科無', () => {
    expect(getSubjectKnowledge('bafs')?.subject).toBe('bafs')
    expect(getSubjectKnowledge('zzz')).toBeUndefined()
    expect(getSubjectKnowledge(undefined)).toBeUndefined()
  })
})

describe('buildRichSystem（逐範疇 / 課題定制）', () => {
  it('會計 vs 商管 → 唔同 persona', () => {
    const acct = buildRichSystem(BAFS, { strandKey: 'accounting' })
    const bm = buildRichSystem(BAFS, { strandKey: 'bm' })
    expect(acct).toContain('會計')
    expect(bm).toContain('商業管理')
    expect(acct).not.toBe(bm)
  })

  it('揀咗課題 → 注入該課題嘅批改慣例 + 常見錯誤 + 命令詞 + JSON 規格', () => {
    const s = buildRichSystem(BAFS, { strandKey: 'accounting', areaKey: 'ratios' })
    expect(s).toContain('比率')
    expect(s).toMatch(/批改慣例/)
    expect(s).toMatch(/常見失分/)
    expect(s).toContain('命令詞')
    expect(s).toContain('"scores"')
  })

  it('自訂 rubric 蓋過預設；題目注入', () => {
    const s = buildRichSystem(BAFS, { strandKey: 'bm', areaKey: 'marketing', rubric: '4Ps 各 5 分', question: '為新飲品設計營銷' })
    expect(s).toContain('4Ps 各 5 分')
    expect(s).toContain('為新飲品設計營銷')
  })

  it('resolveStrand fallback 去第一個', () => {
    expect(resolveStrand(BAFS, 'no-such').key).toBe('core')
    expect(resolveStrand(BAFS, 'bm').key).toBe('bm')
  })

  it('輸出格式同 parseStructured 相容（round-trip）', () => {
    // buildRichSystem 嘅 JSON 規格 → AI 回應 → parseStructured 解析得返
    const raw = JSON.stringify({
      total: 9, maxTotal: 13,
      scores: [{ criterion: '比率計算', score: 4, max: 5, comment: '公式啱' }],
      issues: [{ quote: '毛利率用錯分母', type: 'calc', suggestion: '用銷售淨額做分母' }],
      overall: '計算大致正確，分析可再深入。',
    })
    const r = parseStructured(raw)
    expect(r.total).toBe(9)
    expect(r.issues[0].type).toBe('calc')
  })
})
