import { describe, it, expect } from 'vitest'
import { NOTE_TEMPLATES } from './templates'
import { deriveTitle, parseTags } from './util'

describe('NOTE_TEMPLATES', () => {
  it('每個範本：唯一 id、非空 label/hint/body', () => {
    const ids = new Set<string>()
    for (const t of NOTE_TEMPLATES) {
      expect(t.id).toBeTruthy()
      expect(ids.has(t.id)).toBe(false)
      ids.add(t.id)
      expect(t.label.trim().length).toBeGreaterThan(0)
      expect(t.hint.trim().length).toBeGreaterThan(0)
      expect(t.body.trim().length).toBeGreaterThan(0)
    }
    expect(NOTE_TEMPLATES.length).toBeGreaterThanOrEqual(4)
  })

  it('body 首行可推導出有意義標題（非「未命名筆記」）', () => {
    for (const t of NOTE_TEMPLATES) {
      const title = deriveTitle({ title: '', content: t.body })
      expect(title).not.toBe('未命名筆記')
      expect(title.length).toBeGreaterThan(0)
    }
  })

  it('每個範本都帶可解析嘅 #標籤', () => {
    for (const t of NOTE_TEMPLATES) {
      expect(parseTags(t.body).length).toBeGreaterThan(0)
    }
  })
})
