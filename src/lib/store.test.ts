import { describe, it, expect } from 'vitest'
import { createCollection, stripUndefined, type Entity } from './store'

// ════════════════════════════════════════════════════════════════
//  輕量 store —— add / update 嘅 undefined 處理
//  ----------------------------------------------------------------
//  核心契約：collection 入面嘅 item，喺 in-memory 同 persist（JSON.stringify）
//  後 reload 應有「相同 shape」。常見寫法 `field: value || undefined` 會喺
//  spread 後留低 `key: undefined`，但 JSON.stringify 會 drop —— 故 add 寫入時
//  剷走、update 視作「清除」真正刪 key，令前後一致。
//
//  註：測試環境 = node（無 localStorage），store 嘅 load/persist 全包 try/catch，
//  故 createCollection 仍可純 in-memory 運作（persist 靜默失敗，items 照更新）。
//  每個 case 用獨立 key，避免 collectionRegistry 撞名（雖然各 collection 自帶
//  獨立 items closure，互不污染）。
// ════════════════════════════════════════════════════════════════

interface Item extends Entity {
  name: string
  note?: string
  count?: number
  flag?: boolean
  tag?: string | null
}

// in-memory item 同「JSON 來回一轉」後嘅 key 集合是否一致（核心防呆）
const keysOf = (o: object) => Object.keys(o).sort()
const persistedKeysOf = (o: object) => keysOf(JSON.parse(JSON.stringify(o)))

describe('createCollection.add（寫入時剷走顯式 undefined）', () => {
  it('剷走值為 undefined 嘅 optional 欄位（key 真係唔存在，唔係 = undefined）', () => {
    const col = createCollection<Item>('test-add-strip')
    const item = col.add({ id: 'x', name: 'a', note: undefined, count: undefined })
    expect(item).toEqual({ id: 'x', name: 'a' })
    expect('note' in item).toBe(false)
    expect('count' in item).toBe(false)
    expect(keysOf(item)).toEqual(['id', 'name'])
  })

  it('只剷 undefined：null / 0 / "" / false 等 falsy 值一律保留', () => {
    const col = createCollection<Item>('test-add-falsy')
    const item = col.add({ id: 'x', name: '', count: 0, flag: false, tag: null })
    expect(item).toEqual({ id: 'x', name: '', count: 0, flag: false, tag: null })
    expect('count' in item).toBe(true)
    expect('tag' in item).toBe(true)
  })

  it('id 一定保留（即使其餘欄位全 undefined）', () => {
    const col = createCollection<Item>('test-add-id')
    const item = col.add({ id: 'keep-me', name: 'n', note: undefined, count: undefined })
    expect(item.id).toBe('keep-me')
    expect(keysOf(item)).toEqual(['id', 'name'])
  })

  it('無傳 id → 自動產生一個非空字串 id', () => {
    const col = createCollection<Item>('test-add-uid')
    const item = col.add({ name: 'n' })
    expect(typeof item.id).toBe('string')
    expect(item.id.length).toBeGreaterThan(0)
  })

  it('核心不變量：in-memory shape === persist（JSON 來回）後 shape', () => {
    const col = createCollection<Item>('test-add-shape')
    const item = col.add({ id: 'x', name: 'a', note: undefined, flag: false })
    // 修正前：item 帶 note:undefined，JSON.stringify drop 咗 → 前後 key 唔同。
    expect(keysOf(item)).toEqual(persistedKeysOf(item))
  })

  it('寫入後 get() 攞到嘅就係剷乾淨嗰個物件', () => {
    const col = createCollection<Item>('test-add-get')
    col.add({ id: 'x', name: 'a', note: undefined })
    const got = col.get().find((i) => i.id === 'x')!
    expect(got).toEqual({ id: 'x', name: 'a' })
  })
})

describe('createCollection.update（patch 內 undefined = 清除欄位）', () => {
  it('patch 中值為 undefined 嘅欄位 → 真正刪走個 key（清除）', () => {
    const col = createCollection<Item>('test-upd-clear', [
      { id: 'x', name: 'a', note: 'hi' },
    ])
    col.update('x', { note: undefined })
    const got = col.get().find((i) => i.id === 'x')!
    expect(got).toEqual({ id: 'x', name: 'a' })
    expect('note' in got).toBe(false)
  })

  it('patch 無提及嘅 key 一律保留（維持 merge 語義）', () => {
    const col = createCollection<Item>('test-upd-merge', [
      { id: 'x', name: 'a', note: 'hi', count: 3 },
    ])
    col.update('x', { name: 'b' })
    const got = col.get().find((i) => i.id === 'x')!
    expect(got).toEqual({ id: 'x', name: 'b', note: 'hi', count: 3 })
  })

  it('patch 嘅 falsy 值（0 / "" / false / null）照寫入，唔當 undefined 清除', () => {
    const col = createCollection<Item>('test-upd-falsy', [
      { id: 'x', name: 'a', count: 5 },
    ])
    col.update('x', { count: 0, name: '', flag: false, tag: null })
    const got = col.get().find((i) => i.id === 'x')!
    expect(got).toEqual({ id: 'x', name: '', count: 0, flag: false, tag: null })
  })

  it('一次過：清除一個欄位 + 改另一個 + 保留第三個', () => {
    const col = createCollection<Item>('test-upd-mixed', [
      { id: 'x', name: 'a', note: 'hi', count: 3 },
    ])
    col.update('x', { note: undefined, name: 'b' })
    const got = col.get().find((i) => i.id === 'x')!
    expect(got).toEqual({ id: 'x', name: 'b', count: 3 })
    expect('note' in got).toBe(false)
  })

  it('核心不變量：清除欄位後 in-memory shape === persist 後 shape', () => {
    const col = createCollection<Item>('test-upd-shape', [
      { id: 'x', name: 'a', note: 'hi' },
    ])
    col.update('x', { note: undefined })
    const got = col.get().find((i) => i.id === 'x')!
    expect(keysOf(got)).toEqual(persistedKeysOf(got))
  })

  it('唔影響其他 id 嘅項目（且保留原 reference）', () => {
    const other = { id: 'y', name: 'y-name' }
    const col = createCollection<Item>('test-upd-isolate', [
      { id: 'x', name: 'a' },
      other,
    ])
    col.update('x', { name: 'changed' })
    const gotY = col.get().find((i) => i.id === 'y')!
    expect(gotY).toBe(other) // 未動過嘅項目維持同一 reference
  })

  it('更新唔存在嘅 id → 集合不變', () => {
    const col = createCollection<Item>('test-upd-missing', [{ id: 'x', name: 'a' }])
    col.update('nope', { name: 'b' })
    expect(col.get()).toEqual([{ id: 'x', name: 'a' }])
  })
})

describe('stripUndefined（共用純函式）', () => {
  it('剷走 undefined 嘅 key，其餘原樣', () => {
    const out = stripUndefined({ a: 1, b: undefined, c: 'x' })
    expect(out).toEqual({ a: 1, c: 'x' })
    expect('b' in out).toBe(false)
  })

  it('只剷 undefined：null / 0 / "" / false 保留', () => {
    const out = stripUndefined({ z: 0, e: '', f: false, n: null, u: undefined })
    expect(out).toEqual({ z: 0, e: '', f: false, n: null })
    expect('u' in out).toBe(false)
  })

  it('純函式：回新物件、唔改原物件', () => {
    const src = { a: 1, b: undefined }
    const out = stripUndefined(src)
    expect(out).not.toBe(src)
    expect('b' in src).toBe(true) // 原物件原封不動
    expect('b' in out).toBe(false)
  })
})
