import { describe, it, expect } from 'vitest'
import {
  parseTags,
  checklistStat,
  parseLines,
  toggleTodoLine,
  deriveTitle,
  snippet,
  wordCount,
  readingMinutes,
  compareNotes,
  tagCounts,
  noteToMarkdown,
  notesToMarkdown,
} from './util'
import type { RichNote } from './store'

// 最小 RichNote 工廠（測試只關心被測欄位，其餘給安全預設）
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

// ───────────────────────── parseTags ─────────────────────────
describe('parseTags', () => {
  it('抽取多個標籤、保留出現次序', () => {
    expect(parseTags('讀書 #marketing 計劃 #bafs')).toEqual(['marketing', 'bafs'])
  })

  it('大小寫去重：保留第一個出現嘅原樣', () => {
    expect(parseTags('#BAFS 同 #bafs 同 #Bafs')).toEqual(['BAFS'])
  })

  it('支援中文 / 數字 / 底線 / 連字號', () => {
    expect(parseTags('#中文 #v2 #my_tag #co-op')).toEqual([
      '中文',
      'v2',
      'my_tag',
      'co-op',
    ])
  })

  it('空字串 → 空陣列', () => {
    expect(parseTags('')).toEqual([])
  })

  it('無標籤 → 空陣列', () => {
    expect(parseTags('純文字無 hash')).toEqual([])
  })

  it('淨係 # 無字 → 唔當標籤', () => {
    expect(parseTags('a # b ## c')).toEqual([])
  })
})

// ──────────────────────── checklistStat ───────────────────────
describe('checklistStat', () => {
  it('數 total / done（含大寫 X）', () => {
    const c = '- [ ] a\n- [x] b\n* [X] c\n普通行'
    expect(checklistStat(c)).toEqual({ total: 3, done: 2 })
  })

  it('縮排嘅待辦行都算', () => {
    expect(checklistStat('   - [ ] 縮排')).toEqual({ total: 1, done: 0 })
  })

  it('括號後無空格 → 唔當待辦', () => {
    // CHECK_RE 要求 ] 後面有一個空白；"- [x]done" 唔符合
    expect(checklistStat('- [x]done')).toEqual({ total: 0, done: 0 })
  })

  it('空字串 → 0/0', () => {
    expect(checklistStat('')).toEqual({ total: 0, done: 0 })
  })

  it('全部完成', () => {
    expect(checklistStat('- [x] a\n- [x] b')).toEqual({ total: 2, done: 2 })
  })
})

// ───────────────────────── parseLines ─────────────────────────
describe('parseLines', () => {
  it('混合文字 / 待辦，lineIndex 對應原始行號', () => {
    const out = parseLines('標題\n- [ ] 未做\n- [x] 已做')
    expect(out).toEqual([
      { kind: 'text', text: '標題' },
      { kind: 'todo', text: '未做', done: false, lineIndex: 1 },
      { kind: 'todo', text: '已做', done: true, lineIndex: 2 },
    ])
  })

  it('空字串 → 單一空文字行', () => {
    expect(parseLines('')).toEqual([{ kind: 'text', text: '' }])
  })

  it('保留空白行為 text', () => {
    expect(parseLines('a\n\nb')).toEqual([
      { kind: 'text', text: 'a' },
      { kind: 'text', text: '' },
      { kind: 'text', text: 'b' },
    ])
  })
})

// ──────────────────────── toggleTodoLine ──────────────────────
describe('toggleTodoLine', () => {
  it('未做 → 完成', () => {
    expect(toggleTodoLine('- [ ] task', 0)).toBe('- [x] task')
  })

  it('完成 → 未做（保留其餘行）', () => {
    expect(toggleTodoLine('first\n- [x] done\nlast', 1)).toBe(
      'first\n- [ ] done\nlast',
    )
  })

  it('大寫 [X] 視為已完成 → 切到未做', () => {
    expect(toggleTodoLine('- [X] up', 0)).toBe('- [ ] up')
  })

  it('行號超出範圍 → 原樣回傳', () => {
    expect(toggleTodoLine('only', 5)).toBe('only')
  })

  it('負數行號 → 原樣回傳（唔好誤中尾行）', () => {
    expect(toggleTodoLine('a\n- [ ] b', -1)).toBe('a\n- [ ] b')
  })

  it('非待辦行（無方括號）→ 原樣回傳', () => {
    expect(toggleTodoLine('純文字', 0)).toBe('純文字')
  })
})

// ───────────────────────── deriveTitle ────────────────────────
describe('deriveTitle', () => {
  it('有 title → 用 trim 後嘅 title', () => {
    expect(deriveTitle({ title: '  我的筆記  ', content: 'x' })).toBe('我的筆記')
  })

  it('無 title → 取首個非空行（去除 markdown 符號）', () => {
    expect(deriveTitle({ title: '', content: '# 大標題\n內文' })).toBe('大標題')
  })

  it('跳過開頭空行', () => {
    expect(deriveTitle({ title: '   ', content: '\n\n  真正首行' })).toBe('真正首行')
  })

  it('首行係待辦 → 去除 checkbox 標記', () => {
    expect(deriveTitle({ title: '', content: '- [x] 買牛奶' })).toBe('買牛奶')
  })

  it('完全空內容 → 預設「未命名筆記」', () => {
    expect(deriveTitle({ title: '', content: '' })).toBe('未命名筆記')
  })

  it('首行淨係 markdown 符號 → 預設名', () => {
    expect(deriveTitle({ title: '', content: '***' })).toBe('未命名筆記')
  })
})

// ────────────────────────── snippet ───────────────────────────
describe('snippet', () => {
  it('跳過首行（標題），取餘下文字、去標籤', () => {
    expect(snippet('標題行\n正文內容 #tag')).toBe('正文內容')
  })

  it('待辦行轉為 ☐ 標記', () => {
    expect(snippet('標題\n- [ ] 待辦事項')).toBe('☐ 待辦事項')
  })

  it('只有首行時退回首行（去標籤）', () => {
    expect(snippet('#only 一行內容')).toBe('一行內容')
  })

  it('空字串 → 空字串', () => {
    expect(snippet('')).toBe('')
  })

  it('超過 max 截斷並加省略號', () => {
    // 首行係標題會被跳過，所以用兩行；第二行 10 個 x，max=4
    const r = snippet('t\nxxxxxxxxxx', 4)
    expect(r).toBe('xxxx…')
    expect(r.length).toBe(5) // 4 字 + 省略號
  })

  it('剛好等於 max → 唔截斷', () => {
    expect(snippet('t\nabcd', 4)).toBe('abcd')
  })
})

// ───────────────────────── wordCount ──────────────────────────
describe('wordCount', () => {
  it('純中文逐字計', () => {
    expect(wordCount('市場營銷')).toBe(4)
  })

  it('純英文按空白分詞', () => {
    expect(wordCount('hello world foo')).toBe(3)
  })

  it('中英混合：CJK 逐字 + 拉丁詞', () => {
    // 市場營銷=4 個 CJK；"4P" 係一個拉丁 token → 5
    expect(wordCount('市場營銷4P')).toBe(5)
  })

  it('標點符號唔計入', () => {
    expect(wordCount('，。！？')).toBe(0)
  })

  it('空字串 → 0', () => {
    expect(wordCount('')).toBe(0)
  })

  it('連字號分隔當兩個拉丁 token', () => {
    // [A-Za-z0-9]+ 唔含 '-'，所以 "co-op" → ["co","op"] = 2
    expect(wordCount('co-op')).toBe(2)
  })
})

// ──────────────────────── readingMinutes ──────────────────────
describe('readingMinutes', () => {
  it('250 字 → 1 分鐘', () => {
    expect(readingMinutes(250)).toBe(1)
  })

  it('500 字 → 2 分鐘', () => {
    expect(readingMinutes(500)).toBe(2)
  })

  it('四捨五入：375 → 2（round 1.5）', () => {
    expect(readingMinutes(375)).toBe(2)
  })

  it('0 字 → 至少 1 分鐘（下限）', () => {
    expect(readingMinutes(0)).toBe(1)
  })

  it('極少字（< 125）round 落 0 → 仍 1 分鐘', () => {
    expect(readingMinutes(100)).toBe(1)
  })
})

// ──────────────────────── compareNotes ────────────────────────
describe('compareNotes', () => {
  it('釘選永遠排喺非釘選之前（任何 key）', () => {
    const pinned = note({ id: 'p', content: '', pinned: true })
    const plain = note({ id: 'q', content: '', pinned: false })
    expect(compareNotes(pinned, plain, 'updated')).toBe(-1)
    expect(compareNotes(plain, pinned, 'updated')).toBe(1)
    // 即使 plain 更新時間較新，釘選仍優先
    const plainNewer = note({
      id: 'q',
      content: '',
      pinned: false,
      updatedAt: '2099-01-01T00:00:00.000Z',
    })
    expect(compareNotes(pinned, plainNewer, 'updated')).toBe(-1)
  })

  it('updated：較新（updatedAt 較大）排前', () => {
    const newer = note({ content: '', updatedAt: '2026-05-10T00:00:00.000Z' })
    const older = note({ content: '', updatedAt: '2026-05-01T00:00:00.000Z' })
    expect(compareNotes(newer, older, 'updated')).toBe(-1)
    expect(compareNotes(older, newer, 'updated')).toBe(1)
  })

  it('created：較新（createdAt 較大）排前', () => {
    const newer = note({ content: '', createdAt: '2026-05-10T00:00:00.000Z' })
    const older = note({ content: '', createdAt: '2026-05-01T00:00:00.000Z' })
    expect(compareNotes(newer, older, 'created')).toBe(-1)
    expect(compareNotes(older, newer, 'created')).toBe(1)
  })

  it('words：字數多排前（負數表示 a 在前）', () => {
    const many = note({ content: 'one two three four five' }) // 5 拉丁詞
    const few = note({ content: 'one two' }) // 2
    expect(compareNotes(many, few, 'words')).toBe(-3) // 2 - 5
    expect(compareNotes(few, many, 'words')).toBe(3)
  })

  it('title：依 deriveTitle 字典序', () => {
    const a = note({ content: '', title: 'apple' })
    const b = note({ content: '', title: 'banana' })
    expect(compareNotes(a, b, 'title')).toBeLessThan(0)
    expect(compareNotes(b, a, 'title')).toBeGreaterThan(0)
  })
})

// ───────────────────────── tagCounts ──────────────────────────
describe('tagCounts', () => {
  it('跨多篇統計、依用量由多到少排序', () => {
    const notes = [
      note({ content: '#a #b' }),
      note({ content: '#a #c' }),
      note({ content: '#a' }),
    ]
    expect(tagCounts(notes)).toEqual([
      { tag: 'a', count: 3 },
      { tag: 'b', count: 1 },
      { tag: 'c', count: 1 },
    ])
  })

  it('大小寫合併（保留首個原樣，每篇內已去重）', () => {
    // parseTags 喺單篇內已去重：第二篇 "#tag #TAG" → 只算一次。
    // 三篇各含一次（大小寫不同）→ 合併成 1 個標籤、count = 3。
    const notes = [
      note({ content: '#Tag' }),
      note({ content: '#tag' }),
      note({ content: '#TAG' }),
    ]
    expect(tagCounts(notes)).toEqual([{ tag: 'Tag', count: 3 }])
  })

  it('空陣列 → 空結果', () => {
    expect(tagCounts([])).toEqual([])
  })

  it('無標籤嘅筆記 → 空結果', () => {
    expect(tagCounts([note({ content: '無標籤' })])).toEqual([])
  })
})

// ───────────────────── noteToMarkdown / notes ─────────────────
describe('noteToMarkdown / notesToMarkdown', () => {
  it('輸出 # 標題 + 內文（標題行存在）', () => {
    const md = noteToMarkdown(note({ title: '我的題', content: '正文一\n正文二' }))
    expect(md.startsWith('# 我的題\n')).toBe(true)
    expect(md).toContain('正文一\n正文二')
    expect(md.endsWith('\n')).toBe(true)
  })

  it('無 title 時用內文首行推導出 # 標題', () => {
    const md = noteToMarkdown(note({ title: '', content: '推導標題\n下一行' }))
    expect(md.startsWith('# 推導標題\n')).toBe(true)
    // 內文整段保留（包括已被用作標題嘅首行）
    expect(md).toContain('推導標題\n下一行')
  })

  it('多篇以分隔線連接', () => {
    const a = note({ title: 'A', content: 'aa' })
    const b = note({ title: 'B', content: 'bb' })
    expect(notesToMarkdown([a, b])).toContain('\n\n---\n\n')
  })

  it('空陣列 → 空字串', () => {
    expect(notesToMarkdown([])).toBe('')
  })
})
