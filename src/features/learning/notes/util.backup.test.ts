import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { exportNotesJson, parseNotesImport } from './util'
import type { Notebook, RichNote } from './store'

// 鎖死 now（fake timers）→ exportedAt / 缺欄位補 ISO 都係確定值
const NOW = new Date('2026-06-01T08:00:00.000Z')

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})
afterEach(() => {
  vi.useRealTimers()
})

// 最小工廠（測試只關心被測欄位）
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
const notebook = (over: Partial<Notebook> = {}): Notebook => ({
  id: over.id ?? 'nb',
  name: over.name ?? '筆記本',
  color: over.color ?? 'accent',
  createdAt: over.createdAt ?? '2026-01-01T00:00:00.000Z',
})

// ============================================================
//  exportNotesJson — 信封格式 {version, exportedAt, notes, notebooks}
// ============================================================
describe('exportNotesJson', () => {
  it('輸出 pretty JSON，含 version / exportedAt（now）/ notes / notebooks', () => {
    const json = exportNotesJson([note({ id: 'a', content: 'hi' })], [notebook({ id: 'x' })])
    expect(json).toContain('\n') // pretty（indent=2）
    const parsed = JSON.parse(json)
    expect(parsed.version).toBe(1)
    expect(parsed.exportedAt).toBe(NOW.toISOString())
    expect(parsed.notes).toHaveLength(1)
    expect(parsed.notes[0].id).toBe('a')
    expect(parsed.notebooks).toHaveLength(1)
    expect(parsed.notebooks[0].id).toBe('x')
  })

  it('空資料 → notes / notebooks 都係空陣列', () => {
    const parsed = JSON.parse(exportNotesJson([], []))
    expect(parsed.notes).toEqual([])
    expect(parsed.notebooks).toEqual([])
  })
})

// ============================================================
//  exportNotesJson → parseNotesImport round-trip
// ============================================================
describe('exportNotesJson / parseNotesImport round-trip', () => {
  it('完整還原所有欄位（釘選 / 色標 / 筆記本 / 時間）', () => {
    const notes = [
      note({
        id: 'a',
        title: '標題',
        content: '內文 #tag\n- [x] done',
        notebookId: 'nb1',
        pinned: true,
        favorite: true,
        archived: false,
        trashed: false,
        color: 'amber',
        createdAt: '2026-05-01T00:00:00.000Z',
        updatedAt: '2026-05-02T00:00:00.000Z',
      }),
    ]
    const notebooks = [notebook({ id: 'nb1', name: 'BAFS', color: 'accent' })]
    const back = parseNotesImport(exportNotesJson(notes, notebooks))
    expect(back).not.toBeNull()
    expect(back!.notes).toEqual(notes)
    expect(back!.notebooks).toEqual(notebooks)
  })

  it('parseNotesImport 後再 export / parse 係 idempotent', () => {
    const json = exportNotesJson(
      [note({ id: 'a', content: 'x', pinned: true, color: 'rose' })],
      [notebook({ id: 'nb1' })],
    )
    const once = parseNotesImport(json)
    const twice = parseNotesImport(exportNotesJson(once!.notes, once!.notebooks))
    expect(twice).toEqual(once)
  })
})

// ============================================================
//  parseNotesImport — 寬鬆解析
// ============================================================
describe('parseNotesImport（寬鬆）', () => {
  it('缺欄位逐欄補預設（false / 空字串 / now ISO / notebookId null / color none）', () => {
    const out = parseNotesImport(JSON.stringify({ notes: [{ id: 'k' }] }))
    expect(out).not.toBeNull()
    const n = out!.notes[0]
    expect(n.id).toBe('k')
    expect(n.title).toBe('')
    expect(n.content).toBe('')
    expect(n.notebookId).toBeNull()
    expect(n.pinned).toBe(false)
    expect(n.favorite).toBe(false)
    expect(n.archived).toBe(false)
    expect(n.trashed).toBe(false)
    expect(n.color).toBe('none')
    expect(n.createdAt).toBe(NOW.toISOString())
    expect(n.updatedAt).toBe(NOW.toISOString())
  })

  it('缺 id 自動補（非空字串）', () => {
    const out = parseNotesImport(JSON.stringify({ notes: [{ title: '冇 id' }] }))
    expect(out!.notes[0].id).toBeTruthy()
    expect(typeof out!.notes[0].id).toBe('string')
  })

  it('筆記本缺 name → 補「未命名筆記本」、缺 color → slate', () => {
    const out = parseNotesImport(JSON.stringify({ notebooks: [{ id: 'nb' }] }))
    expect(out!.notebooks[0].name).toBe('未命名筆記本')
    expect(out!.notebooks[0].color).toBe('slate')
  })

  it('notes / notebooks 非陣列 → 當空陣列（唔 throw）', () => {
    const out = parseNotesImport(
      JSON.stringify({ notes: 'oops', notebooks: { not: 'array' } }),
    )
    // notes 非陣列、notebooks 非陣列 → 兩者都當缺 → 無一陣列 → null
    expect(out).toBeNull()
  })

  it('只有 notes 陣列（notebooks 非陣列）→ 接受、notebooks 補空', () => {
    const out = parseNotesImport(JSON.stringify({ notes: [{ id: 'a' }], notebooks: 5 }))
    expect(out).not.toBeNull()
    expect(out!.notes).toHaveLength(1)
    expect(out!.notebooks).toEqual([])
  })

  it('只有 notebooks 陣列 → 接受、notes 補空', () => {
    const out = parseNotesImport(JSON.stringify({ notebooks: [{ id: 'nb' }] }))
    expect(out).not.toBeNull()
    expect(out!.notebooks).toHaveLength(1)
    expect(out!.notes).toEqual([])
  })

  it('真實值保留：pinned/favorite/archived/trashed = true', () => {
    const out = parseNotesImport(
      JSON.stringify({
        notes: [{ id: 'a', pinned: true, favorite: true, archived: true, trashed: true }],
      }),
    )
    const n = out!.notes[0]
    expect(n.pinned).toBe(true)
    expect(n.favorite).toBe(true)
    expect(n.archived).toBe(true)
    expect(n.trashed).toBe(true)
  })

  it('pinned 非 boolean（如 "yes" / 1）→ false（嚴格 === true）', () => {
    const out = parseNotesImport(
      JSON.stringify({ notes: [{ id: 'a', pinned: 'yes', favorite: 1 }] }),
    )
    expect(out!.notes[0].pinned).toBe(false)
    expect(out!.notes[0].favorite).toBe(false)
  })

  it('無效 JSON / 非物件 / 陣列頂層 → null', () => {
    expect(parseNotesImport('not json')).toBeNull()
    expect(parseNotesImport('123')).toBeNull()
    expect(parseNotesImport('"str"')).toBeNull()
    expect(parseNotesImport('null')).toBeNull()
    expect(parseNotesImport('[]')).toBeNull() // 陣列頂層唔係備份信封
    expect(parseNotesImport('{}')).toBeNull() // 無 notes 又無 notebooks
  })
})
