import { describe, it, expect } from 'vitest'
import { parseWikiLinks, resolveNoteByTitle, backlinksOf } from './util'
import type { RichNote } from './store'

const note = (over: Partial<RichNote> & { id: string }): RichNote => ({
  title: '',
  content: '',
  notebookId: null,
  pinned: false,
  favorite: false,
  archived: false,
  trashed: false,
  color: 'none',
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
  ...over,
})

describe('parseWikiLinks', () => {
  it('抽出 [[標題]]、去重（case-insensitive）、保留次序', () => {
    expect(parseWikiLinks('見 [[SWOT]] 同 [[市場 4P]] 再 [[swot]]')).toEqual([
      'SWOT',
      '市場 4P',
    ])
  })

  it('trim 內部空白；忽略空連結', () => {
    expect(parseWikiLinks('[[  讀書筆記  ]] [[]] [[   ]]')).toEqual(['讀書筆記'])
  })

  it('無連結 / 空字串 → 空陣列', () => {
    expect(parseWikiLinks('普通文字無連結')).toEqual([])
    expect(parseWikiLinks('')).toEqual([])
  })
})

describe('resolveNoteByTitle', () => {
  const notes = [
    note({ id: 'a', title: 'SWOT 分析' }),
    note({ id: 'b', content: '市場 4P\n內容' }), // 由內文首行推導標題
  ]
  it('以顯示標題配對（case-insensitive）', () => {
    expect(resolveNoteByTitle(notes, 'swot 分析')?.id).toBe('a')
    expect(resolveNoteByTitle(notes, '市場 4P')?.id).toBe('b')
  })
  it('配唔到 / 空標題 → undefined', () => {
    expect(resolveNoteByTitle(notes, '唔存在')).toBeUndefined()
    expect(resolveNoteByTitle(notes, '   ')).toBeUndefined()
  })
})

describe('backlinksOf', () => {
  it('搵返所有 [[...]] 指住 target 嘅筆記（target 自己即使自連都排除）', () => {
    const target = note({ id: 't', title: '深度工作', content: '我引返自己 [[深度工作]]' })
    const notes = [
      target, // 自連 → 唔計返自己
      note({ id: 'x', content: '參考 [[深度工作]] 嘅方法' }),
      note({ id: 'y', content: '提到 [[深度工作]] 同 [[其他]]' }),
      note({ id: 'z', content: '冇連結' }),
    ]
    const ids = backlinksOf(notes, target).map((n) => n.id)
    expect(ids).toEqual(['x', 'y'])
  })

  it('配對 case-insensitive；無人連 → 空陣列', () => {
    const target = note({ id: 't', title: 'BAFS' })
    expect(backlinksOf([target, note({ id: 'x', content: '[[bafs]]' })], target).map((n) => n.id)).toEqual(['x'])
    expect(backlinksOf([target], target)).toEqual([])
  })
})
