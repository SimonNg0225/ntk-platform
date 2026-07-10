import { describe, expect, it } from 'vitest'
import { FEATURE_SEARCH_ALIASES, matchesSearchQuery } from './featureSearch'

describe('功能搜尋別名', () => {
  it.each([
    ['work-slides', 'ppt'],
    ['work-generate', 'worksheet'],
    ['work-grade-analytics', '預測等級'],
    ['work-doc-digest', '文件摘要'],
    ['work-prompt-library', '家長信'],
  ])('%s 可用「%s」搜尋', (featureId, query) => {
    expect(matchesSearchQuery(query, FEATURE_SEARCH_ALIASES[featureId] ?? [])).toBe(true)
  })

  it('搜尋不分英文大小寫', () => {
    expect(matchesSearchQuery('POWERPOINT', FEATURE_SEARCH_ALIASES['work-slides'])).toBe(true)
  })
})
