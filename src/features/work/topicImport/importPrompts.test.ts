import { describe, it, expect } from 'vitest'
import { buildImportSystem, parseTopics } from './importPrompts'

describe('buildImportSystem', () => {
  it('注入科目', () => {
    expect(buildImportSystem('BAFS')).toContain('BAFS')
    expect(buildImportSystem()).toContain('JSON')
  })
})

describe('parseTopics', () => {
  const good = [
    { part: '必修', area: '1(a) 營商環境', topic: '香港的營商環境' },
    { part: '必修', area: '1(a) 營商環境', topic: '企業擁有權類型' },
    { part: '選修', area: '3(b) 財務管理', topic: '財務分析' },
  ]
  it('解析陣列', () => {
    const r = parseTopics(JSON.stringify(good))
    expect(r).toHaveLength(3)
    expect(r[0].area).toBe('1(a) 營商環境')
  })
  it('帶 fence', () => {
    const r = parseTopics('```json\n' + JSON.stringify(good) + '\n```')
    expect(r).toHaveLength(3)
  })
  it('缺欄位有預設、過濾無 topic', () => {
    const r = parseTopics(JSON.stringify([{ topic: '只有課題' }, { part: 'x', area: 'y' }]))
    expect(r).toHaveLength(1)
    expect(r[0]).toEqual({ part: '', area: '', topic: '只有課題' })
  })
  it('空 / 垃圾 throw', () => {
    expect(() => parseTopics('[]')).toThrow()
    expect(() => parseTopics('唔係 JSON')).toThrow()
  })
})
