import { describe, it, expect } from 'vitest'
import { getSubjectKnowledge } from './index'
import { MATH } from './math'
import { buildRichSystem } from '../../features/work/grading/richSystem'

describe('數學（必修）知識檔案', () => {
  it('三個範疇：數與代數 / 度量圖形空間 / 數據處理', () => {
    expect(MATH.strands.map((s) => s.key)).toEqual(['algebra', 'geometry', 'stats'])
  })

  it('每個課題都有 rubric / 批改慣例 / 常見錯誤 / issueTypes', () => {
    for (const s of MATH.strands) {
      expect(s.areas.length).toBeGreaterThanOrEqual(2)
      for (const a of s.areas) {
        expect(a.rubric.length).toBeGreaterThan(0)
        expect(a.issueTypes.length).toBeGreaterThan(0)
        expect(a.markingConventions.length).toBeGreaterThan(0)
        expect(a.commonErrors.length).toBeGreaterThan(0)
      }
    }
  })

  it('registry：math 解析到', () => {
    expect(getSubjectKnowledge('math')?.subject).toBe('math')
  })
})

describe('數學 buildRichSystem', () => {
  it('persona 含方法分 M / 答案分 A 鐵則', () => {
    const s = buildRichSystem(MATH, { strandKey: 'algebra' })
    expect(s).toMatch(/方法分|M）/)
    expect(s).toMatch(/錯一步|follow-through/)
  })

  it('揀三角學課題 → 注入歧義 / 計算機模式慣例 + JSON 規格', () => {
    const s = buildRichSystem(MATH, { strandKey: 'geometry', areaKey: 'trigonometry' })
    expect(s).toMatch(/正弦定律|歧義|計算機|模式/)
    expect(s).toContain('"scores"')
  })

  it('輸出為繁體中文指示（非英文）', () => {
    expect(buildRichSystem(MATH, { strandKey: 'stats' })).toMatch(/繁體中文/)
  })
})
