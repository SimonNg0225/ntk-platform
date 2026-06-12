import { describe, it, expect } from 'vitest'
import { countLinks, validateThread, validatePost, sortColumn, toggleSet } from './logic'

describe('forum logic', () => {
  it('countLinks', () => {
    expect(countLinks('no links')).toBe(0)
    expect(countLinks('see https://a.com and http://b.com')).toBe(2)
  })
  it('validateThread', () => {
    expect(validateThread('', 'body')).toBe('標題需 1–120 字。')
    expect(validateThread('x'.repeat(121), 'body')).toBe('標題需 1–120 字。')
    expect(validateThread('title', '')).toBe('內文需 1–5000 字。')
    expect(validateThread('title', 'l '.repeat(10) + 'http://a http://b http://c http://d http://e http://f')).toBe('連結太多（最多 5 條）。')
    expect(validateThread('title', 'ok body')).toBeNull()
  })
  it('validatePost', () => {
    expect(validatePost('')).toBe('回覆需 1–5000 字。')
    expect(validatePost('hi')).toBeNull()
  })
  it('sortColumn maps sort → {column, ascending}', () => {
    expect(sortColumn('new')).toEqual({ column: 'last_activity_at', ascending: false })
    expect(sortColumn('replies')).toEqual({ column: 'reply_count', ascending: false })
    expect(sortColumn('top')).toEqual({ column: 'score', ascending: false })
  })
  it('toggleSet adds/removes', () => {
    const s = new Set(['a'])
    expect([...toggleSet(s, 'b', true)]).toContain('b')
    expect([...toggleSet(s, 'a', false)]).not.toContain('a')
  })
})
