import { describe, it, expect } from 'vitest'
import { buildDigestSystem, parseDigest } from './prompts'

describe('buildDigestSystem', () => {
  it('包含類別清單同今日日期', () => {
    const sys = buildDigestSystem('2026-06-08')
    expect(sys).toContain('校務通告')
    expect(sys).toContain('2026-06-08')
    expect(sys).toContain('JSON')
  })
})

describe('parseDigest', () => {
  const good = {
    title: '家長日安排',
    category: '家長通告',
    summary: ['6月20日舉行家長日', '請於6月15日前回條'],
    actions: [
      { text: '收回家長日回條', date: '2026-06-15' },
      { text: '準備班務報告' },
    ],
  }

  it('解析純 JSON', () => {
    const r = parseDigest(JSON.stringify(good))
    expect(r.title).toBe('家長日安排')
    expect(r.category).toBe('家長通告')
    expect(r.summary).toHaveLength(2)
    expect(r.actions).toHaveLength(2)
    expect(r.actions[0].date).toBe('2026-06-15')
    expect(r.actions[1].date).toBeUndefined()
  })

  it('解析帶 code fence 嘅 JSON', () => {
    const r = parseDigest('```json\n' + JSON.stringify(good) + '\n```')
    expect(r.title).toBe('家長日安排')
  })

  it('解析前後夾雜文字嘅 JSON', () => {
    const r = parseDigest('好的，以下係結果：\n' + JSON.stringify(good) + '\n希望幫到你！')
    expect(r.category).toBe('家長通告')
  })

  it('唔合法類別退回「其他」', () => {
    const r = parseDigest(JSON.stringify({ ...good, category: '亂噏' }))
    expect(r.category).toBe('其他')
  })

  it('唔合法日期會被丟棄', () => {
    const r = parseDigest(
      JSON.stringify({ ...good, actions: [{ text: 'X', date: '下星期五' }] }),
    )
    expect(r.actions[0].date).toBeUndefined()
  })

  it('缺欄位有合理預設', () => {
    const r = parseDigest(JSON.stringify({ summary: ['只有摘要'] }))
    expect(r.title).toBe('未命名文件')
    expect(r.category).toBe('其他')
    expect(r.actions).toEqual([])
  })

  it('過濾非字串 summary 同無 text 嘅 action', () => {
    const r = parseDigest(
      JSON.stringify({
        ...good,
        summary: ['有效', 123, '', null],
        actions: [{ text: '' }, { date: '2026-01-01' }, { text: '保留' }],
      }),
    )
    expect(r.summary).toEqual(['有效'])
    expect(r.actions).toEqual([{ text: '保留', date: undefined }])
  })

  it('垃圾輸入會 throw', () => {
    expect(() => parseDigest('完全唔係 JSON')).toThrow()
    expect(() => parseDigest('')).toThrow()
  })
})
