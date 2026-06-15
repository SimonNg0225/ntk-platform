import { describe, it, expect } from 'vitest'
import {
  SUBJECT_LESSON_TEMPLATES,
  GENERIC_TEMPLATES,
  templatesForSubject,
  allBuiltinTemplates,
} from './subjectTemplates'

const all = allBuiltinTemplates()

describe('subjectTemplates 結構驗證', () => {
  it('每個範本欄位齊全且合理', () => {
    for (const t of all) {
      expect(t.id, `id: ${t.name}`).toBeTruthy()
      expect(t.name.trim(), `name: ${t.id}`).toBeTruthy()
      expect(t.style.trim(), `style: ${t.id}`).toBeTruthy()
      expect(t.objectives.trim().length, `objectives: ${t.id}`).toBeGreaterThan(5)
      // phases 3-8 個，每個 label 非空、minutes 1-60
      expect(t.phases.length, `phases count: ${t.id}`).toBeGreaterThanOrEqual(3)
      expect(t.phases.length, `phases count: ${t.id}`).toBeLessThanOrEqual(8)
      for (const p of t.phases) {
        expect(p.label.trim(), `phase label: ${t.id}`).toBeTruthy()
        expect(p.detail.trim(), `phase detail: ${t.id}`).toBeTruthy()
        expect(p.minutes, `phase minutes: ${t.id}/${p.label}`).toBeGreaterThanOrEqual(1)
        expect(p.minutes, `phase minutes: ${t.id}/${p.label}`).toBeLessThanOrEqual(60)
      }
      // 總時長合理（一節課，放寬到 30-95 容體育堂）
      const total = t.phases.reduce((s, p) => s + p.minutes, 0)
      expect(total, `total minutes: ${t.id} = ${total}`).toBeGreaterThanOrEqual(30)
      expect(total, `total minutes: ${t.id} = ${total}`).toBeLessThanOrEqual(95)
      // materials 非空、每項非空
      expect(t.materials.length, `materials: ${t.id}`).toBeGreaterThanOrEqual(1)
      for (const m of t.materials) expect(m.trim(), `material item: ${t.id}`).toBeTruthy()
    }
  })

  it('全部 id 唯一', () => {
    const ids = all.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('每科至少 1 個範本', () => {
    for (const [subjectId, list] of Object.entries(SUBJECT_LESSON_TEMPLATES)) {
      expect(list.length, `subject ${subjectId}`).toBeGreaterThanOrEqual(1)
      // id 前綴對應 subjectId
      for (const t of list) expect(t.id.startsWith(subjectId)).toBe(true)
    }
  })

  it('涵蓋主要 DSE 科目', () => {
    const ids = Object.keys(SUBJECT_LESSON_TEMPLATES)
    for (const s of ['bafs', 'chin', 'eng', 'math', 'phys', 'chem', 'bio', 'econ']) {
      expect(ids, `缺 ${s}`).toContain(s)
    }
  })
})

describe('templatesForSubject', () => {
  it('已知科目回該科範本', () => {
    const r = templatesForSubject('chem')
    expect(r.length).toBeGreaterThanOrEqual(1)
    expect(r[0].subjectId).toBe('chem')
  })
  it('未知 / custom / undefined → 通用組', () => {
    expect(templatesForSubject('custom')).toBe(GENERIC_TEMPLATES)
    expect(templatesForSubject('zzz')).toBe(GENERIC_TEMPLATES)
    expect(templatesForSubject(undefined)).toBe(GENERIC_TEMPLATES)
  })
})
