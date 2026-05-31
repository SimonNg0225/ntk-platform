import { describe, it, expect } from 'vitest'
import {
  wordCount,
  snippet,
  compareNotes,
  tagCounts,
  parseTags,
  deriveTitle,
} from './util'
import type { RichNote } from './store'

// ============================================================
//  補測：第一階段審查列出、但 util.test.ts 未覆蓋嘅邊界 case。
//  （唔重覆已測 case，只補空隙）
// ============================================================

const note = (over: Partial<RichNote> & { content: string }): RichNote => ({
  id: over.id ?? 'n',
  title: over.title ?? '',
  content: over.content,
  notebookId: over.notebookId ?? null,
  pinned: over.pinned ?? false,
  favorite: over.favorite ?? false,
  archived: over.archived ?? false,
  trashed: over.trashed ?? false,
  color: over.color ?? 'none',
  createdAt: over.createdAt ?? '2026-01-01T00:00:00.000Z',
  updatedAt: over.updatedAt ?? '2026-01-01T00:00:00.000Z',
})

// ───────────────────── wordCount CJK 邊界 ─────────────────────
describe('wordCount — CJK 範圍邊界', () => {
  it('假名（平 / 片）逐字計入', () => {
    // ひらがな 4 字 + カタカナ 3 字 = 7
    expect(wordCount('ひらがな')).toBe(4)
    expect(wordCount('カタカ')).toBe(3)
  })

  it('CJK 標點（U+3000–303F：，。「」全形空格）唔在範圍 → 不計', () => {
    expect(wordCount('，。「」　')).toBe(0)
  })

  it('擴展 A 區（U+3400 㐀）唔在 U+4E00 起點 → 不計（已知設計界限）', () => {
    expect(wordCount('㐀')).toBe(0)
  })

  it('邊界字元 U+9FFF（鿿）計入', () => {
    expect(wordCount('鿿')).toBe(1)
  })

  it('純標點（拉丁）唔計', () => {
    // [A-Za-z0-9]+ 唔含標點 → 0
    expect(wordCount('!!! ??? ...')).toBe(0)
  })
})

// ───────────────────── snippet 退回首行 ─────────────────────
describe('snippet — 餘行全係標籤/空白時退回首行', () => {
  it('餘下行全部係標籤 → 退回首行（首行去標籤後有字）', () => {
    // 首行「#first 行有字」去標籤 → 「行有字」；餘行全 tag → 過濾空
    expect(snippet('#first 行有字\n#only\n#tagonly')).toBe('行有字')
  })

  it('全部行（含首行）都係標籤 → 退回首行去標籤後得空字串', () => {
    expect(snippet('#header\n#a\n#b')).toBe('')
  })

  it('剛好 == max 唔截斷（用第二行，首行作標題被跳過）', () => {
    // 第二行 4 字、max=4 → 唔加省略號
    expect(snippet('題\n一二三四', 4)).toBe('一二三四')
  })

  it('> max 截斷後長度 = max + 1（省略號）', () => {
    const r = snippet('題\n一二三四五六', 4)
    expect(r).toBe('一二三四…')
    expect(r.length).toBe(5)
  })
})

// ───────────────────── compareNotes 相等 / 同釘選 ─────────────────────
describe('compareNotes — 相等時間與雙方釘選', () => {
  it('updated 相等 → 回傳 0（正確 comparator 契約，ES 穩定排序保留次序）', () => {
    const a = note({ id: 'a', content: '', updatedAt: '2026-03-03T00:00:00.000Z' })
    const b = note({ id: 'b', content: '', updatedAt: '2026-03-03T00:00:00.000Z' })
    expect(compareNotes(a, b, 'updated')).toBe(0)
  })

  it('created 相等 → 回傳 0', () => {
    const a = note({ id: 'a', content: '', createdAt: '2026-03-03T00:00:00.000Z' })
    const b = note({ id: 'b', content: '', createdAt: '2026-03-03T00:00:00.000Z' })
    expect(compareNotes(a, b, 'created')).toBe(0)
  })

  it('兩者皆釘選 → 跳過 pinned 分支、照落 key（updated）比較', () => {
    const newer = note({
      id: 'a',
      content: '',
      pinned: true,
      updatedAt: '2026-05-10T00:00:00.000Z',
    })
    const older = note({
      id: 'b',
      content: '',
      pinned: true,
      updatedAt: '2026-05-01T00:00:00.000Z',
    })
    // 兩者皆 pinned（pinned 相等）→ 唔走置頂分支，按 updated：newer 排前
    expect(compareNotes(newer, older, 'updated')).toBe(-1)
    expect(compareNotes(older, newer, 'updated')).toBe(1)
  })

  it('兩者皆非釘選 → 同樣落 key 分支（words）', () => {
    const many = note({ id: 'a', content: 'a b c' }) // 3
    const few = note({ id: 'b', content: 'a' }) // 1
    expect(compareNotes(many, few, 'words')).toBe(-2) // 1 - 3
  })
})

// ───────────────────── tagCounts 同票穩定性 ─────────────────────
describe('tagCounts — 同票排序穩定性', () => {
  it('同 count 標籤維持插入次序（穩定排序）', () => {
    // 三個各出現一次嘅標籤，排序後同 count → 依首次出現次序
    const notes = [note({ content: '#alpha #beta #gamma' })]
    expect(tagCounts(notes)).toEqual([
      { tag: 'alpha', count: 1 },
      { tag: 'beta', count: 1 },
      { tag: 'gamma', count: 1 },
    ])
  })
})

// ───────────────────── parseTags 重複同款 ─────────────────────
describe('parseTags — 完全重複標籤只留一次', () => {
  it('同一原樣標籤重複出現 → 只留一個', () => {
    expect(parseTags('#repeat 中間 #repeat 尾 #repeat')).toEqual(['repeat'])
  })
})

// ───────────────────── deriveTitle 全空白 title ─────────────────────
describe('deriveTitle — 全空白 title 當無 title', () => {
  it('title 全空白 + 內文有字 → 用內文首行', () => {
    expect(deriveTitle({ title: '   \t  ', content: '內文首行\n第二行' })).toBe('內文首行')
  })
})
