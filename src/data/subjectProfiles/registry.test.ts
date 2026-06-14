import { describe, it, expect } from 'vitest'
import { SUBJECT_PACKS } from '../subjects'
import { getSubjectKnowledge } from './index'

// 批改 issue 分類合法 key（對齊 grading/markingProfiles 嘅 I map）。
// rich profile 嘅 area.issueTypes 只可用呢啲，否則 UI 標籤對唔到。
const VALID_ISSUE_KEYS = new Set([
  'concept', 'calc', 'step', 'method', 'term', 'wording', 'grammar', 'spelling',
  'content', 'argument', 'evidence', 'data', 'fact', 'application', 'unit',
  'equation', 'vocabulary', 'analysis', 'organization',
])

// 'custom' = 通用 fallback，無課題、無 rich 檔。
const RICH_PACKS = SUBJECT_PACKS.filter((p) => p.id !== 'custom')

describe('subjectProfiles registry — 全科完整性', () => {
  it('每個 SUBJECT_PACK（custom 除外）都有 rich 知識檔', () => {
    for (const p of RICH_PACKS) {
      const k = getSubjectKnowledge(p.id)
      expect(k, `缺 rich 檔：${p.id}`).toBeDefined()
      expect(k!.subject).toBe(p.id)
      expect(k!.label.length).toBeGreaterThan(0)
      expect(['zh', 'en']).toContain(k!.lang)
    }
  })

  it('每科 assessment / commandWords / levelDescriptors 齊全', () => {
    for (const p of RICH_PACKS) {
      const k = getSubjectKnowledge(p.id)!
      expect(k.assessment.papers.length, `${p.id} papers`).toBeGreaterThan(0)
      expect(k.assessment.weightings.length).toBeGreaterThan(0)
      expect(k.assessment.questionTypes.length).toBeGreaterThan(0)
      expect(k.commandWords.length, `${p.id} commandWords`).toBeGreaterThan(0)
      expect(k.levelDescriptors.length, `${p.id} levelDescriptors`).toBeGreaterThan(0)
      expect(k.source.length).toBeGreaterThan(0)
    }
  })

  it('每個 strand / area 結構完整，issueTypes 全部合法', () => {
    for (const p of RICH_PACKS) {
      const k = getSubjectKnowledge(p.id)!
      expect(k.strands.length, `${p.id} 無 strand`).toBeGreaterThan(0)
      const strandKeys = new Set<string>()
      for (const s of k.strands) {
        expect(s.key.length, `${p.id} strand key 空`).toBeGreaterThan(0)
        expect(strandKeys.has(s.key), `${p.id} strand key 重複：${s.key}`).toBe(false)
        strandKeys.add(s.key)
        expect(s.persona.length, `${p.id}/${s.key} 無 persona`).toBeGreaterThan(0)
        expect(s.areas.length, `${p.id}/${s.key} 無 area`).toBeGreaterThan(0)
        const areaKeys = new Set<string>()
        for (const a of s.areas) {
          expect(a.key.length).toBeGreaterThan(0)
          expect(areaKeys.has(a.key), `${p.id}/${s.key} area key 重複：${a.key}`).toBe(false)
          areaKeys.add(a.key)
          expect(a.keyConcepts.length, `${p.id}/${a.key} keyConcepts`).toBeGreaterThan(0)
          expect(a.markingConventions.length, `${p.id}/${a.key} markingConventions`).toBeGreaterThan(0)
          expect(a.commonErrors.length, `${p.id}/${a.key} commonErrors`).toBeGreaterThan(0)
          expect(a.rubric.length, `${p.id}/${a.key} rubric`).toBeGreaterThan(0)
          for (const r of a.rubric) {
            expect(r.criterion.length, `${p.id}/${a.key} rubric criterion 空`).toBeGreaterThan(0)
            expect(r.max, `${p.id}/${a.key} rubric max`).toBeGreaterThan(0)
            expect(r.focus.length, `${p.id}/${a.key} rubric focus 空`).toBeGreaterThan(0)
          }
          expect(a.issueTypes.length, `${p.id}/${a.key} issueTypes`).toBeGreaterThan(0)
          for (const t of a.issueTypes) {
            expect(VALID_ISSUE_KEYS.has(t), `${p.id}/${a.key} 非法 issueType：${t}`).toBe(true)
          }
        }
      }
    }
  })
})
