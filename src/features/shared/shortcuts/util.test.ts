import { describe, it, expect } from 'vitest'
import {
  filterShortcuts,
  countShortcuts,
  SHORTCUT_SECTIONS,
  type ShortcutSection,
} from './util'

// ============================================================
//  快捷鍵速查表純函式測試
//  ------------------------------------------------------------
//  只測「同樣輸入永遠同樣輸出、無 side effect」嘅純函式：
//    filterShortcuts / countShortcuts。
//  全部預期值用第一性原理人手計，唔靠跑 code 反推。
//  另守護 SHORTCUT_SECTIONS 嘅靜態不變量（唔好出現空 keys / 空區段）。
// ============================================================

// 細小、可預測嘅測試 fixture（唔依賴真實資料嘅文案，免文案改動時測試脆裂）
const FIXTURE: ShortcutSection[] = [
  {
    title: '全域',
    items: [
      { keys: ['⌘', 'K'], desc: '開指令面板' },
      { keys: ['?'], desc: '彈出速查' },
    ],
  },
  {
    title: '收件匣',
    scope: '喺列表',
    items: [
      { keys: ['/'], desc: '聚焦搜尋' },
      { keys: ['j'], desc: '下一項' },
    ],
  },
]

describe('countShortcuts — 平鋪累加', () => {
  it('fixture：2 + 2 = 4', () => {
    expect(countShortcuts(FIXTURE)).toBe(4)
  })

  it('空陣列 → 0', () => {
    expect(countShortcuts([])).toBe(0)
  })

  it('真實資料：等於各區段 items 長度之和', () => {
    const manual = SHORTCUT_SECTIONS.reduce((n, s) => n + s.items.length, 0)
    expect(countShortcuts(SHORTCUT_SECTIONS)).toBe(manual)
    expect(manual).toBeGreaterThan(0)
  })
})

describe('filterShortcuts — 空白查詢直通', () => {
  it('空字串：原樣回傳（同一參考）', () => {
    expect(filterShortcuts(FIXTURE, '')).toBe(FIXTURE)
  })

  it('只得空白：trim 後等同空查詢，原樣回傳', () => {
    expect(filterShortcuts(FIXTURE, '   ')).toBe(FIXTURE)
  })
})

describe('filterShortcuts — 區段標題 / scope 命中保留全部 item', () => {
  it('命中標題「全域」→ 該區段兩個 item 都喺度', () => {
    const r = filterShortcuts(FIXTURE, '全域')
    expect(r).toHaveLength(1)
    expect(r[0].title).toBe('全域')
    expect(r[0].items).toHaveLength(2)
  })

  it('命中 scope「列表」→ 收件匣全部 item（即使 desc 唔含「列表」）', () => {
    const r = filterShortcuts(FIXTURE, '列表')
    expect(r).toHaveLength(1)
    expect(r[0].title).toBe('收件匣')
    expect(r[0].items.map((i) => i.desc)).toEqual(['聚焦搜尋', '下一項'])
  })
})

describe('filterShortcuts — item 級篩選（標題未命中）', () => {
  it('命中 desc「指令」→ 只保留嗰條 item', () => {
    const r = filterShortcuts(FIXTURE, '指令')
    expect(r).toHaveLength(1)
    expect(r[0].title).toBe('全域')
    expect(r[0].items).toHaveLength(1)
    expect(r[0].items[0].desc).toBe('開指令面板')
  })

  it('按鍵 token 都可搜：查「j」→ 命中收件匣「下一項」', () => {
    const r = filterShortcuts(FIXTURE, 'j')
    expect(r).toHaveLength(1)
    expect(r[0].title).toBe('收件匣')
    expect(r[0].items).toHaveLength(1)
    expect(r[0].items[0].desc).toBe('下一項')
  })

  it('完全無命中 → 空陣列（變空嘅區段會被篩走）', () => {
    expect(filterShortcuts(FIXTURE, 'zzz冇呢樣')).toEqual([])
  })
})

describe('filterShortcuts — 大細楷不敏感', () => {
  it('查「k」（細楷）命中「⌘ K」嘅 token', () => {
    const r = filterShortcuts(FIXTURE, 'k')
    // 「k」會命中 ⌘K 嘅 'K' token；亦會命中「下一項」desc？否——desc 唔含 k。
    expect(r).toHaveLength(1)
    expect(r[0].title).toBe('全域')
    expect(r[0].items).toHaveLength(1)
    expect(r[0].items[0].keys).toEqual(['⌘', 'K'])
  })
})

describe('filterShortcuts — 純函式：唔 mutate 入參', () => {
  it('篩選後原 fixture 結構不變', () => {
    const before = JSON.stringify(FIXTURE)
    filterShortcuts(FIXTURE, '指令')
    filterShortcuts(FIXTURE, '全域')
    filterShortcuts(FIXTURE, '')
    expect(JSON.stringify(FIXTURE)).toBe(before)
  })

  it('回傳嘅 items 係新陣列（改佢唔會影響原本）', () => {
    const r = filterShortcuts(FIXTURE, '全域')
    r[0].items.push({ keys: ['X'], desc: 'injected' })
    expect(FIXTURE[0].items).toHaveLength(2) // 原本仍係 2
  })
})

describe('SHORTCUT_SECTIONS — 靜態不變量', () => {
  it('每個區段至少一個 item，每個 item 至少一粒鍵 + 非空說明', () => {
    expect(SHORTCUT_SECTIONS.length).toBeGreaterThan(0)
    for (const sec of SHORTCUT_SECTIONS) {
      expect(sec.title.trim().length).toBeGreaterThan(0)
      expect(sec.items.length).toBeGreaterThan(0)
      for (const it of sec.items) {
        expect(it.keys.length).toBeGreaterThan(0)
        expect(it.keys.every((k) => k.trim().length > 0)).toBe(true)
        expect(it.desc.trim().length).toBeGreaterThan(0)
      }
    }
  })
})
