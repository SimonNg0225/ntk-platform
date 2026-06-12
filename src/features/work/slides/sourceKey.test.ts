import { describe, it, expect } from 'vitest'
import { slideSourceKey, type SourceKeyInput } from './sourceKey'

const base: SourceKeyInput = {
  mode: 'text',
  text: '收入嘅定義\n五步模型',
  topicId: '',
  topicText: '',
  count: 8,
  framework: false,
  pageCount: 0,
  model: 'gemini-2.5-flash',
}

describe('slideSourceKey', () => {
  it('同輸入 → 同 key（穩定）', () => {
    expect(slideSourceKey(base)).toBe(slideSourceKey({ ...base }))
  })

  it('空白／前後換行差異唔影響（正規化）', () => {
    const a = slideSourceKey(base)
    const b = slideSourceKey({ ...base, text: '  收入嘅定義 \n\n  五步模型  \n' })
    expect(b).toBe(a)
  })

  it('內容唔同 → key 唔同', () => {
    expect(slideSourceKey({ ...base, text: '完全唔同嘅內容' })).not.toBe(slideSourceKey(base))
  })

  it('版數變 → key 變', () => {
    expect(slideSourceKey({ ...base, count: 10 })).not.toBe(slideSourceKey(base))
  })

  it('模型變 → key 變', () => {
    expect(slideSourceKey({ ...base, model: 'gemini-2.5-pro' })).not.toBe(slideSourceKey(base))
  })

  it('模式變 → key 變', () => {
    const topic: SourceKeyInput = { ...base, mode: 'topic', topicId: 't1', topicText: '收入確認' }
    expect(slideSourceKey(topic)).not.toBe(slideSourceKey(base))
  })

  it('課題模式：topicId 或課題文字變 → key 變', () => {
    const t1: SourceKeyInput = { ...base, mode: 'topic', topicId: 't1', topicText: '收入確認' }
    const t2: SourceKeyInput = { ...t1, topicId: 't2' }
    const t3: SourceKeyInput = { ...t1, topicText: '收入確認（改咗）' }
    expect(slideSourceKey(t2)).not.toBe(slideSourceKey(t1))
    expect(slideSourceKey(t3)).not.toBe(slideSourceKey(t1))
  })

  it('框架模式：用分頁數，count 唔影響', () => {
    const f1: SourceKeyInput = { ...base, framework: true, pageCount: 5, count: 8 }
    const f2: SourceKeyInput = { ...f1, count: 12 } // count 唔同但框架模式應該一樣
    expect(slideSourceKey(f2)).toBe(slideSourceKey(f1))
    // 分頁數變 → key 變
    expect(slideSourceKey({ ...f1, pageCount: 6 })).not.toBe(slideSourceKey(f1))
    // framework on/off 都係唔同
    expect(slideSourceKey({ ...base, framework: true, pageCount: 5 })).not.toBe(slideSourceKey(base))
  })

  it('回傳非空字串', () => {
    expect(slideSourceKey(base)).toMatch(/^[a-z0-9]+$/)
  })
})
