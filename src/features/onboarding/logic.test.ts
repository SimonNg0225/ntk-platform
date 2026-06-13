import { describe, it, expect } from 'vitest'
import { ROLES, BANDS, validateRegistration } from './logic'

const okInput = { displayName: '陳老師', role: 'teacher', subjects: ['bafs'] }

describe('validateRegistration', () => {
  it('齊料（署名 + 身份 + 科目 + 同意）→ ok', () => {
    expect(validateRegistration(okInput, true)).toEqual({ ok: true })
  })

  it('署名空 → 報錯', () => {
    const r = validateRegistration({ ...okInput, displayName: '  ' }, true)
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/署名|姓氏/)
  })

  it('未揀身份 → 報錯', () => {
    const r = validateRegistration({ ...okInput, role: '' }, true)
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/身份/)
  })

  it('未揀科目 → 報錯', () => {
    const r = validateRegistration({ ...okInput, subjects: [] }, true)
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/科目/)
  })

  it('未同意條款 → 報錯', () => {
    const r = validateRegistration(okInput, false)
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/同意/)
  })
})

describe('選項清單', () => {
  it('身份角色有 4 個、值唯一', () => {
    expect(ROLES).toHaveLength(4)
    expect(new Set(ROLES.map((r) => r.id)).size).toBe(4)
  })

  it('學制有小學 / 初中 / 高中三段', () => {
    expect(BANDS.map((b) => b.id)).toEqual(['primary', 'junior', 'senior'])
  })
})
