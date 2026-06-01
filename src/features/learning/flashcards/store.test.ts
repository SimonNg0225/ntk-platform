import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { cardMetaCol, deckPrefCol, upsertMeta, upsertPref, pruneMeta } from './store'

// ============================================================
//  flashcards/store：upsertMeta / upsertPref（insert vs update 兩分支）
//  + pruneMeta（孤兒移除）
//  ------------------------------------------------------------
//  依賴 collection 狀態（非純函式）→ 每個 case 前 set([]) 清空控制狀態。
//  node 環境無 localStorage，但 store 嘅 set/load/persist 全 try/catch
//  包住，collection 內存 items 照樣運作（同 cardgen/store.test.ts 一致）。
//  updatedAt 用 new Date().toISOString()（依當前時間）→ 用 vi fake time
//  鎖死，先可以 deterministic 斷言。
// ============================================================

beforeEach(() => {
  // 每個 case 前清空兩個 collection，避免互相污染
  cardMetaCol.set([])
  deckPrefCol.set([])
})

describe('upsertMeta — insert 分支（新 cardId）', () => {
  it('插入完整預設 meta（tags[]/suspended/flagged/lapses）+ updatedAt 非空', () => {
    upsertMeta('c1', {})
    const all = cardMetaCol.get()
    expect(all).toHaveLength(1)
    const m = all[0]
    expect(m.id).toBe('c1')
    expect(m.tags).toEqual([])
    expect(m.suspended).toBe(false)
    expect(m.flagged).toBe(false)
    expect(m.lapses).toBe(0)
    expect(typeof m.updatedAt).toBe('string')
    expect(m.updatedAt).not.toBe('')
  })

  it('patch 蓋過預設：傳 tags / suspended / flagged / lapses 取 patch 值', () => {
    upsertMeta('c2', {
      tags: ['math', 'hard'],
      suspended: true,
      flagged: true,
      lapses: 3,
      note: '私人備註',
    })
    const m = cardMetaCol.get().find((x) => x.id === 'c2')!
    expect(m.tags).toEqual(['math', 'hard'])
    expect(m.suspended).toBe(true)
    expect(m.flagged).toBe(true)
    expect(m.lapses).toBe(3)
    expect(m.note).toBe('私人備註')
    // updatedAt 仍然由 store 補上（patch 無提供）
    expect(typeof m.updatedAt).toBe('string')
    expect(m.updatedAt).not.toBe('')
  })

  it('多個唔同 cardId 各自插入，互不影響', () => {
    upsertMeta('a', { lapses: 1 })
    upsertMeta('b', { lapses: 2 })
    const all = cardMetaCol.get()
    expect(all).toHaveLength(2)
    expect(all.find((m) => m.id === 'a')!.lapses).toBe(1)
    expect(all.find((m) => m.id === 'b')!.lapses).toBe(2)
  })

  it('updatedAt 用 ISO 格式（鎖時間後可精確斷言）', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-31T09:30:00.000Z'))
    upsertMeta('c3', {})
    expect(cardMetaCol.get()[0].updatedAt).toBe('2026-05-31T09:30:00.000Z')
    vi.useRealTimers()
  })
})

describe('upsertMeta — update 分支（已存在 id）', () => {
  it('只 patch 指定欄位，其餘保留唔變', () => {
    upsertMeta('c1', { tags: ['orig'], suspended: true, lapses: 5 })
    // 第二次只改 flagged → tags / suspended / lapses 保留
    upsertMeta('c1', { flagged: true })
    const all = cardMetaCol.get()
    expect(all).toHaveLength(1) // 唔會新增，仍係同一條
    const m = all[0]
    expect(m.flagged).toBe(true)
    expect(m.tags).toEqual(['orig'])
    expect(m.suspended).toBe(true)
    expect(m.lapses).toBe(5)
  })

  it('updatedAt 每次 update 都刷新（vi fake time 斷言前後唔同）', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-31T00:00:00.000Z'))
    upsertMeta('c1', { tags: ['x'] })
    const first = cardMetaCol.get()[0].updatedAt
    expect(first).toBe('2026-05-31T00:00:00.000Z')

    // 時間推進後再 update，updatedAt 應刷新為新時刻
    vi.setSystemTime(new Date('2026-06-01T12:00:00.000Z'))
    upsertMeta('c1', { lapses: 2 })
    const second = cardMetaCol.get()[0].updatedAt
    expect(second).toBe('2026-06-01T12:00:00.000Z')
    expect(second).not.toBe(first)
    vi.useRealTimers()
  })

  it('patch 內若帶 updatedAt 仍被 store 覆寫為當前時間', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-01T08:00:00.000Z'))
    upsertMeta('c1', {})
    // 嘗試傳一個舊 updatedAt，應被 { ...patch, updatedAt: now } 蓋過
    upsertMeta('c1', { updatedAt: '2000-01-01T00:00:00.000Z', flagged: true })
    const m = cardMetaCol.get()[0]
    expect(m.flagged).toBe(true)
    expect(m.updatedAt).toBe('2026-07-01T08:00:00.000Z')
    vi.useRealTimers()
  })
})

describe('upsertPref — insert 分支（新 deckId）', () => {
  it('插入帶 DEFAULT 值（newPerDay 20 / reviewPerDay 0 / order due）', () => {
    upsertPref('d1', {})
    const all = deckPrefCol.get()
    expect(all).toHaveLength(1)
    const p = all[0]
    expect(p.id).toBe('d1')
    expect(p.newPerDay).toBe(20)
    expect(p.reviewPerDay).toBe(0)
    expect(p.order).toBe('due')
  })

  it('patch 蓋過部分預設，其餘仍用 DEFAULT', () => {
    upsertPref('d2', { newPerDay: 5, order: 'random' })
    const p = deckPrefCol.get().find((x) => x.id === 'd2')!
    expect(p.newPerDay).toBe(5) // patch
    expect(p.order).toBe('random') // patch
    expect(p.reviewPerDay).toBe(0) // 預設保留
  })

  it('DeckPref 無 updatedAt 欄位 → insert 唔會無端加上', () => {
    upsertPref('d3', {})
    const p = deckPrefCol.get()[0] as unknown as Record<string, unknown>
    expect('updatedAt' in p).toBe(false)
  })
})

describe('upsertPref — update 分支（已存在 deckId）', () => {
  it('只 patch 指定欄位，其餘保留', () => {
    upsertPref('d1', { newPerDay: 10, reviewPerDay: 50, order: 'added' })
    upsertPref('d1', { newPerDay: 99 }) // 只改 newPerDay
    const all = deckPrefCol.get()
    expect(all).toHaveLength(1) // 唔新增
    const p = all[0]
    expect(p.newPerDay).toBe(99)
    expect(p.reviewPerDay).toBe(50) // 保留
    expect(p.order).toBe('added') // 保留
  })

  it('update 唔會引入 updatedAt（DeckPref 無此欄；upsertPref 亦唔加）', () => {
    upsertPref('d1', { newPerDay: 7 })
    upsertPref('d1', { order: 'due' })
    const p = deckPrefCol.get()[0] as unknown as Record<string, unknown>
    expect('updatedAt' in p).toBe(false)
  })
})

describe('pruneMeta — 孤兒移除', () => {
  // 預先 seed 三條 meta（直接 set，繞過 upsert 嘅時間依賴）
  const seed = () =>
    cardMetaCol.set([
      { id: 'keep1', tags: [], suspended: false, flagged: false, lapses: 0, updatedAt: 't1' },
      { id: 'orphan', tags: [], suspended: false, flagged: false, lapses: 0, updatedAt: 't2' },
      { id: 'keep2', tags: [], suspended: false, flagged: false, lapses: 0, updatedAt: 't3' },
    ])

  it('刪走唔喺 validCardIds 嘅 meta、保留有效嘅', () => {
    seed()
    pruneMeta(new Set(['keep1', 'keep2']))
    const ids = cardMetaCol.get().map((m) => m.id)
    expect(ids).toEqual(['keep1', 'keep2'])
    expect(ids).not.toContain('orphan')
  })

  it('空 set → 全部清走', () => {
    seed()
    pruneMeta(new Set())
    expect(cardMetaCol.get()).toEqual([])
  })

  it('validCardIds 涵蓋全部 → 一個都唔刪', () => {
    seed()
    pruneMeta(new Set(['keep1', 'orphan', 'keep2']))
    expect(cardMetaCol.get().map((m) => m.id)).toEqual(['keep1', 'orphan', 'keep2'])
  })

  it('多個連續孤兒全部移除（守護 iterate-while-mutate 唔會漏刪）', () => {
    // remove 用 items = items.filter(...) 重新賦值；for...of 行緊舊快照，
    // 即使連續兩條都係孤兒亦唔會「跳過」中間嗰條。
    cardMetaCol.set([
      { id: 'o1', tags: [], suspended: false, flagged: false, lapses: 0, updatedAt: 't' },
      { id: 'o2', tags: [], suspended: false, flagged: false, lapses: 0, updatedAt: 't' },
      { id: 'o3', tags: [], suspended: false, flagged: false, lapses: 0, updatedAt: 't' },
      { id: 'keep', tags: [], suspended: false, flagged: false, lapses: 0, updatedAt: 't' },
    ])
    pruneMeta(new Set(['keep']))
    expect(cardMetaCol.get().map((m) => m.id)).toEqual(['keep'])
  })

  it('空 meta collection → 唔報錯、維持空', () => {
    cardMetaCol.set([])
    expect(() => pruneMeta(new Set(['anything']))).not.toThrow()
    expect(cardMetaCol.get()).toEqual([])
  })

  it('validCardIds 含唔存在嘅 id → 唔影響現有有效 meta', () => {
    seed()
    // set 入面有啲 id 根本冇對應 meta（多餘）→ 無副作用
    pruneMeta(new Set(['keep1', 'keep2', 'ghost-a', 'ghost-b']))
    expect(cardMetaCol.get().map((m) => m.id)).toEqual(['keep1', 'keep2'])
  })
})

afterEach(() => {
  // 確保任何 case 漏咗解除 fake timers 都唔會洩漏到下一個檔
  vi.useRealTimers()
})
