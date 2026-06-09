import { describe, it, expect } from 'vitest'
import { buildTranscribeSystem, parseTranscript } from './transcribePrompts'

describe('buildTranscribeSystem', () => {
  it('要求 JSON 四欄', () => {
    const s = buildTranscribeSystem()
    expect(s).toContain('summary')
    expect(s).toContain('actions')
    expect(s).toContain('transcript')
  })
})

describe('parseTranscript', () => {
  const good = {
    summary: ['討論期末安排', '檢視進度'],
    decisions: ['下週五交卷'],
    actions: ['陳老師準備試卷'],
    transcript: '會議由主席開場…',
  }
  it('解析純 JSON', () => {
    const r = parseTranscript(JSON.stringify(good))
    expect(r.summary).toHaveLength(2)
    expect(r.decisions).toEqual(['下週五交卷'])
    expect(r.transcript).toContain('主席')
  })
  it('帶 fence / 缺欄', () => {
    const r = parseTranscript('```json\n' + JSON.stringify({ summary: ['只有摘要'] }) + '\n```')
    expect(r.summary).toEqual(['只有摘要'])
    expect(r.actions).toEqual([])
    expect(r.transcript).toBe('')
  })
  it('過濾非字串', () => {
    const r = parseTranscript(JSON.stringify({ summary: ['ok', 1, '', null] }))
    expect(r.summary).toEqual(['ok'])
  })
  it('格式錯 throw', () => {
    expect(() => parseTranscript('唔係 JSON')).toThrow()
  })
})
