import { describe, it, expect } from 'vitest'
import { getSubjectKnowledge } from './index'
import { CSD } from './csd'
import { buildRichSystem } from '../../features/work/grading/richSystem'

describe('公民與社會發展 知識檔案', () => {
  it('四個範疇：技巧 + 三大主題', () => {
    expect(CSD.strands.map((s) => s.key)).toEqual(['skills', 'hk', 'china', 'world'])
  })

  it('lang = zh、達標 / 未達標兩級匯報', () => {
    expect(CSD.lang).toBe('zh')
    expect(CSD.assessment.weightings).toMatch(/達標/)
    expect(CSD.levelDescriptors.map((l) => l.level).join(' ')).toMatch(/未達標/)
  })

  it('每個課題都有 rubric / 批改慣例 / 常見錯誤 / issueTypes', () => {
    for (const s of CSD.strands) {
      expect(s.areas.length).toBeGreaterThanOrEqual(2)
      for (const a of s.areas) {
        expect(a.rubric.length).toBeGreaterThan(0)
        expect(a.issueTypes.length).toBeGreaterThan(0)
        expect(a.markingConventions.length).toBeGreaterThan(0)
        expect(a.commonErrors.length).toBeGreaterThan(0)
      }
    }
  })

  it('registry：csd 解析到', () => {
    expect(getSubjectKnowledge('csd')?.subject).toBe('csd')
  })
})

describe('公民 buildRichSystem', () => {
  it('預設範疇（技巧）persona 含「扣資料 / 多角度」鐵則', () => {
    const s = buildRichSystem(CSD)
    expect(s).toMatch(/資料/)
    expect(s).toMatch(/多角度|持份者/)
  })

  it('揀立場論證課題 → 注入正反 / 結論慣例 + JSON 規格', () => {
    const s = buildRichSystem(CSD, { strandKey: 'skills', areaKey: 'argumentation-stance' })
    expect(s).toMatch(/正反|結論|多大程度/)
    expect(s).toContain('"scores"')
  })

  it('主題各異 → 唔同 persona / 內容', () => {
    expect(buildRichSystem(CSD, { strandKey: 'hk' })).not.toBe(
      buildRichSystem(CSD, { strandKey: 'world' }),
    )
  })
})
