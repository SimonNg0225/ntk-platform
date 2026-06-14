import { describe, it, expect } from 'vitest'
import { getSubjectKnowledge } from './index'
import { CHIN } from './chin'
import { buildRichSystem } from '../../features/work/grading/richSystem'

describe('中文 知識檔案', () => {
  it('兩個範疇：閱讀 + 寫作', () => {
    expect(CHIN.strands.map((s) => s.key)).toEqual(['reading', 'writing'])
  })

  it('每個課題都有 rubric / 批改慣例 / 常見錯誤 / issueTypes', () => {
    for (const s of CHIN.strands) {
      expect(s.areas.length).toBeGreaterThanOrEqual(3)
      for (const a of s.areas) {
        expect(a.rubric.length).toBeGreaterThan(0)
        expect(a.issueTypes.length).toBeGreaterThan(0)
        expect(a.markingConventions.length).toBeGreaterThan(0)
        expect(a.commonErrors.length).toBeGreaterThan(0)
      }
    }
  })

  it('registry：chin 解析到', () => {
    expect(getSubjectKnowledge('chin')?.subject).toBe('chin')
  })
})

describe('中文 buildRichSystem', () => {
  it('寫作 persona 含錯別字扣分鐵則 + 審題', () => {
    const s = buildRichSystem(CHIN, { strandKey: 'writing' })
    expect(s).toMatch(/錯別字/)
    expect(s).toMatch(/審題|離題/)
  })

  it('揀指定文言課題 → 注入十二篇 + 賞析慣例', () => {
    const s = buildRichSystem(CHIN, { strandKey: 'reading', areaKey: 'classical-set' })
    expect(s).toMatch(/出師表|師說|六國論/)
    expect(s).toMatch(/賞析|語譯/)
    expect(s).toContain('"scores"')
  })

  it('閱讀 vs 寫作 → 唔同 persona', () => {
    expect(buildRichSystem(CHIN, { strandKey: 'reading' })).not.toBe(
      buildRichSystem(CHIN, { strandKey: 'writing' }),
    )
  })
})
