import { describe, it, expect } from 'vitest'
import {
  folderColor,
  FOLDER_COLORS,
  domainOf,
  guessTypeFromUrl,
  faviconLetter,
  keyOf,
  addDaysKey,
  shortDate,
  tagFrequency,
  joinMeta,
  applyFilter,
  sortRows,
  typeBreakdown,
  folderBreakdown,
  topOpened,
  topicCoverage,
  emptyMeta,
  DEFAULT_FILTER,
  type ResourceMeta,
  type ResourceFolder,
  type ResourceRow,
  type FilterState,
  type SortKey,
} from './util'
import type { Resource, ResourceType } from '../../../data/types'

// ───────── 測試小工具 ─────────
const res = (over: Partial<Resource>): Resource => ({
  id: 'r',
  title: 'T',
  type: 'link',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...over,
})

const meta = (over: Partial<ResourceMeta>): ResourceMeta => ({
  id: 'r',
  favorite: false,
  archived: false,
  broken: false,
  opens: 0,
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...over,
})

const row = (r: Partial<Resource>, m: Partial<ResourceMeta> = {}): ResourceRow => ({
  res: res(r),
  meta: meta({ id: r.id ?? 'r', ...m }),
})

// ============================================================
//  folderColor — fallback 邏輯
// ============================================================
describe('folderColor', () => {
  it('已知 key 回對應色', () => {
    expect(folderColor('blue')).toBe(FOLDER_COLORS.blue)
    expect(folderColor('rose')).toBe(FOLDER_COLORS.rose)
  })
  it('undefined → slate', () => {
    expect(folderColor(undefined)).toBe(FOLDER_COLORS.slate)
  })
  it('未知 key → slate（fallback）', () => {
    expect(folderColor('not-a-color')).toBe(FOLDER_COLORS.slate)
  })
})

// ============================================================
//  domainOf — 網域抽取 + 去 www. + 容錯
// ============================================================
describe('domainOf', () => {
  it('undefined / 空字串 → undefined', () => {
    expect(domainOf(undefined)).toBeUndefined()
    expect(domainOf('')).toBeUndefined()
  })
  it('完整 URL 去 www.', () => {
    expect(domainOf('https://www.youtube.com/watch?v=abc')).toBe('youtube.com')
  })
  it('無 scheme 自動補 https://', () => {
    expect(domainOf('example.com/path')).toBe('example.com')
  })
  it('hostname 一律細階（URL 規範化）', () => {
    expect(domainOf('https://WWW.Example.COM')).toBe('example.com')
  })
  it('無法解析 → undefined（含空格）', () => {
    expect(domainOf('not a url')).toBeUndefined()
  })
})

// ============================================================
//  guessTypeFromUrl — 由 URL 猜類型
// ============================================================
describe('guessTypeFromUrl', () => {
  it('YouTube / vimeo / mp4 → video', () => {
    expect(guessTypeFromUrl('https://www.YOUTUBE.com/watch?v=x')).toBe('video')
    expect(guessTypeFromUrl('https://vimeo.com/123')).toBe('video')
    expect(guessTypeFromUrl('https://cdn.x.com/clip.mp4')).toBe('video')
  })
  it('.pdf → paper', () => {
    expect(guessTypeFromUrl('https://x.com/exam.pdf')).toBe('paper')
    expect(guessTypeFromUrl('https://x.com/exam.pdf?dl=1')).toBe('paper')
  })
  it('google slides / .pptx → slides', () => {
    expect(guessTypeFromUrl('https://docs.google.com/presentation/d/1')).toBe('slides')
    expect(guessTypeFromUrl('https://x.com/deck.pptx')).toBe('slides')
  })
  it('google doc / .docx → handout', () => {
    expect(guessTypeFromUrl('https://docs.google.com/document/d/1')).toBe('handout')
    expect(guessTypeFromUrl('https://x.com/sheet.docx')).toBe('handout')
  })
  it('唔識 → undefined', () => {
    expect(guessTypeFromUrl('https://example.com/page')).toBeUndefined()
  })
})

// ============================================================
//  faviconLetter
// ============================================================
describe('faviconLetter', () => {
  it('undefined / 空 → 中點', () => {
    expect(faviconLetter(undefined)).toBe('·')
    expect(faviconLetter('')).toBe('·')
  })
  it('首字母大寫', () => {
    expect(faviconLetter('youtube.com')).toBe('Y')
    expect(faviconLetter('abc')).toBe('A')
  })
})

// ============================================================
//  日期 key（本地時區，無 UTC off-by-one）
// ============================================================
describe('keyOf（本地日期）', () => {
  it('用本地 getFullYear/Month/Date，無 TZ 漂移', () => {
    // 本地午夜建構 → 本地 key 必同日，唔會跌去前一日（UTC off-by-one 陷阱）。
    // 喺 UTC+ 時區，本地 00:00 嘅 UTC 瞬間係前一日；若 keyOf 誤用
    // getUTC* 就會回 2025-12-31，呢個斷言可揪出 off-by-one。
    expect(keyOf(new Date(2026, 0, 1, 0, 0, 0))).toBe('2026-01-01')
    expect(keyOf(new Date(2026, 11, 31))).toBe('2026-12-31')
    expect(keyOf(new Date(2026, 4, 4, 12, 30))).toBe('2026-05-04')
  })
  it('keyOf 跟「本地」分量，TZ-robust（同一 Date 自比，不論 runner 時區）', () => {
    const d = new Date(2026, 4, 4, 23, 30) // 本地 5/4 深夜
    const expected = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate(),
    ).padStart(2, '0')}`
    expect(keyOf(d)).toBe(expected)
    expect(keyOf(d)).toBe('2026-05-04')
  })
  it('月 / 日補零', () => {
    expect(keyOf(new Date(2026, 2, 9))).toBe('2026-03-09')
  })
})

describe('addDaysKey（純字串日期運算）', () => {
  it('加日', () => {
    expect(addDaysKey('2026-05-04', 1)).toBe('2026-05-05')
    expect(addDaysKey('2026-05-04', 3)).toBe('2026-05-07')
  })
  it('減日（負數）', () => {
    expect(addDaysKey('2026-05-04', -1)).toBe('2026-05-03')
    expect(addDaysKey('2026-05-04', -4)).toBe('2026-04-30')
  })
  it('n = 0 回原日', () => {
    expect(addDaysKey('2026-05-04', 0)).toBe('2026-05-04')
  })
  it('跨月 / 跨年邊界', () => {
    expect(addDaysKey('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDaysKey('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDaysKey('2026-01-01', -1)).toBe('2025-12-31')
  })
  it('2026 非閏年：2/28 + 1 = 3/1', () => {
    expect(addDaysKey('2026-02-28', 1)).toBe('2026-03-01')
  })
  it('2028 閏年：2/28 + 1 = 2/29', () => {
    expect(addDaysKey('2028-02-28', 1)).toBe('2028-02-29')
  })
})

describe('shortDate', () => {
  it('M/D（無補零）', () => {
    expect(shortDate('2026-05-04')).toBe('5/4')
    expect(shortDate('2026-12-09')).toBe('12/9')
    expect(shortDate('2026-01-01')).toBe('1/1')
  })
})

// ============================================================
//  tagFrequency — 次數降序，平手 tag 升序
// ============================================================
describe('tagFrequency', () => {
  it('空陣列 → []', () => {
    expect(tagFrequency([])).toEqual([])
  })
  it('無 tags 欄位 → []', () => {
    expect(tagFrequency([res({ id: 'a' }), res({ id: 'b' })])).toEqual([])
  })
  it('累計 + 次數降序', () => {
    const out = tagFrequency([
      res({ id: 'a', tags: ['dse', 'econ'] }),
      res({ id: 'b', tags: ['dse'] }),
      res({ id: 'c', tags: ['dse', 'econ'] }),
    ])
    expect(out).toEqual([
      { tag: 'dse', count: 3 },
      { tag: 'econ', count: 2 },
    ])
  })
  it('平手按 tag 字母升序', () => {
    const out = tagFrequency([res({ id: 'a', tags: ['banana', 'apple'] })])
    expect(out).toEqual([
      { tag: 'apple', count: 1 },
      { tag: 'banana', count: 1 },
    ])
  })
})

// ============================================================
//  joinMeta — resources × metas join
// ============================================================
describe('joinMeta', () => {
  it('有 meta 用真 meta；無 meta 用 emptyMeta', () => {
    const resources = [res({ id: 'a', url: 'https://www.foo.com/x' }), res({ id: 'b' })]
    const metas = [meta({ id: 'a', favorite: true, opens: 5 })]
    const out = joinMeta(resources, metas)
    expect(out).toHaveLength(2)
    expect(out[0].meta.favorite).toBe(true)
    expect(out[0].meta.opens).toBe(5)
    expect(out[0].domain).toBe('foo.com')
    // 無 meta → emptyMeta 預設值
    expect(out[1].meta.id).toBe('b')
    expect(out[1].meta.favorite).toBe(false)
    expect(out[1].meta.opens).toBe(0)
    expect(out[1].domain).toBeUndefined()
  })
  it('空 resources → []', () => {
    expect(joinMeta([], [meta({ id: 'a' })])).toEqual([])
  })
})

// ============================================================
//  sortRows — 各 SortKey
// ============================================================
describe('sortRows', () => {
  it('recent：createdAt 降序', () => {
    const rows = [
      row({ id: 'old', createdAt: '2026-01-01T00:00:00Z' }),
      row({ id: 'new', createdAt: '2026-03-01T00:00:00Z' }),
    ]
    expect(sortRows(rows, 'recent').map((r) => r.res.id)).toEqual(['new', 'old'])
  })
  it('oldest：createdAt 升序', () => {
    const rows = [
      row({ id: 'new', createdAt: '2026-03-01T00:00:00Z' }),
      row({ id: 'old', createdAt: '2026-01-01T00:00:00Z' }),
    ]
    expect(sortRows(rows, 'oldest').map((r) => r.res.id)).toEqual(['old', 'new'])
  })
  it('title：A→Z', () => {
    const rows = [
      row({ id: 'b', title: 'Beta' }),
      row({ id: 'a', title: 'Alpha' }),
    ]
    expect(sortRows(rows, 'title').map((r) => r.res.id)).toEqual(['a', 'b'])
  })
  it('opens：開啟次數降序，平手 createdAt 降序', () => {
    const rows = [
      row({ id: 'lo' }, { opens: 1 }),
      row({ id: 'hi' }, { opens: 9 }),
      row({ id: 'tieNew', createdAt: '2026-03-01T00:00:00Z' }, { opens: 9 }),
    ]
    // hi & tieNew 同 9 次 → createdAt 較新者先（tieNew 03 > hi 01）
    expect(sortRows(rows, 'opens').map((r) => r.res.id)).toEqual(['tieNew', 'hi', 'lo'])
  })
  it('lastOpened：有值較新者先，undefined 排最後', () => {
    const rows = [
      row({ id: 'never' }, {}),
      row({ id: 'recent' }, { lastOpened: '2026-03-01T00:00:00Z' }),
      row({ id: 'older' }, { lastOpened: '2026-01-01T00:00:00Z' }),
    ]
    expect(sortRows(rows, 'lastOpened').map((r) => r.res.id)).toEqual([
      'recent',
      'older',
      'never',
    ])
  })
  it('type：按 TYPE_ORDER（handout→note）', () => {
    const rows = [
      row({ id: 'n', type: 'note' }),
      row({ id: 'h', type: 'handout' }),
      row({ id: 'v', type: 'video' }),
    ]
    expect(sortRows(rows, 'type').map((r) => r.res.id)).toEqual(['h', 'v', 'n'])
  })
  it('唔變更原陣列（純函式）', () => {
    const rows = [
      row({ id: 'a', createdAt: '2026-01-01T00:00:00Z' }),
      row({ id: 'b', createdAt: '2026-03-01T00:00:00Z' }),
    ]
    const before = rows.map((r) => r.res.id)
    sortRows(rows, 'recent')
    expect(rows.map((r) => r.res.id)).toEqual(before)
  })
})

// ============================================================
//  applyFilter — 智能視圖 / 類型 / 收藏夾 / 標籤 / 搜尋
// ============================================================
const f = (over: Partial<FilterState>): FilterState => ({
  ...DEFAULT_FILTER,
  ...over,
})

describe('applyFilter', () => {
  it('預設（all）隱藏封存', () => {
    const rows = [
      row({ id: 'live' }),
      row({ id: 'arch' }, { archived: true }),
    ]
    expect(applyFilter(rows, f({})).map((r) => r.res.id)).toEqual(['live'])
  })
  it('archived 視圖只顯示封存', () => {
    const rows = [
      row({ id: 'live' }),
      row({ id: 'arch' }, { archived: true }),
    ]
    expect(applyFilter(rows, f({ smart: 'archived' })).map((r) => r.res.id)).toEqual([
      'arch',
    ])
  })
  it('favorites：只收藏（且非封存）', () => {
    const rows = [
      row({ id: 'fav' }, { favorite: true }),
      row({ id: 'plain' }),
      row({ id: 'favArch' }, { favorite: true, archived: true }),
    ]
    expect(applyFilter(rows, f({ smart: 'favorites' })).map((r) => r.res.id)).toEqual([
      'fav',
    ])
  })
  it('unsorted：只無收藏夾', () => {
    const rows = [
      row({ id: 'sorted' }, { folderId: 'fx' }),
      row({ id: 'free' }),
    ]
    expect(applyFilter(rows, f({ smart: 'unsorted' })).map((r) => r.res.id)).toEqual([
      'free',
    ])
  })
  it('broken：只失效', () => {
    const rows = [row({ id: 'ok' }), row({ id: 'bad' }, { broken: true })]
    expect(applyFilter(rows, f({ smart: 'broken' })).map((r) => r.res.id)).toEqual(['bad'])
  })
  it('recent_opened：只開過', () => {
    const rows = [
      row({ id: 'opened' }, { lastOpened: '2026-01-01T00:00:00Z' }),
      row({ id: 'never' }),
    ]
    expect(applyFilter(rows, f({ smart: 'recent_opened' })).map((r) => r.res.id)).toEqual([
      'opened',
    ])
  })
  it('type 篩選', () => {
    const rows = [row({ id: 'v', type: 'video' }), row({ id: 'p', type: 'paper' })]
    expect(applyFilter(rows, f({ type: 'video' })).map((r) => r.res.id)).toEqual(['v'])
  })
  it('folderId 指定', () => {
    const rows = [
      row({ id: 'inF' }, { folderId: 'fx' }),
      row({ id: 'other' }, { folderId: 'fy' }),
      row({ id: 'none' }),
    ]
    expect(applyFilter(rows, f({ folderId: 'fx' })).map((r) => r.res.id)).toEqual(['inF'])
  })
  it('folderId = __none：只未分類', () => {
    const rows = [
      row({ id: 'inF' }, { folderId: 'fx' }),
      row({ id: 'none' }),
    ]
    expect(applyFilter(rows, f({ folderId: '__none' })).map((r) => r.res.id)).toEqual([
      'none',
    ])
  })
  it('tags：AND 多選', () => {
    const rows = [
      row({ id: 'both', tags: ['a', 'b', 'c'] }),
      row({ id: 'onlyA', tags: ['a'] }),
    ]
    expect(applyFilter(rows, f({ tags: ['a', 'b'] })).map((r) => r.res.id)).toEqual([
      'both',
    ])
  })
  it('search：命中 title / notes / url / domain / tags', () => {
    const rows = [
      row({ id: 'byTitle', title: 'Macro Economics' }),
      row({ id: 'byTag', title: 'X', tags: ['microeco'] }),
      row({ id: 'byDomain', title: 'Y', url: 'https://www.eco.org/a' }),
      row({ id: 'miss', title: 'Nothing' }),
    ]
    const out = applyFilter(rows, f({ search: 'eco' })).map((r) => r.res.id)
    expect(out).toEqual(['byTitle', 'byTag', 'byDomain'])
  })
  it('search 大細階不敏感 + trim', () => {
    const rows = [row({ id: 'hit', title: 'Hello World' })]
    expect(applyFilter(rows, f({ search: '  WORLD  ' })).map((r) => r.res.id)).toEqual([
      'hit',
    ])
  })
  it('組合：type + folder + 排序', () => {
    const rows = [
      row({ id: 'v2', type: 'video', createdAt: '2026-02-01T00:00:00Z' }, { folderId: 'fx' }),
      row({ id: 'v1', type: 'video', createdAt: '2026-01-01T00:00:00Z' }, { folderId: 'fx' }),
      row({ id: 'p', type: 'paper' }, { folderId: 'fx' }),
    ]
    const out = applyFilter(rows, f({ type: 'video', folderId: 'fx', sort: 'recent' }))
    expect(out.map((r) => r.res.id)).toEqual(['v2', 'v1'])
  })
})

// ============================================================
//  typeBreakdown — 永遠回 6 類（TYPE_ORDER）
// ============================================================
describe('typeBreakdown', () => {
  it('空 → 全 0，順序 = TYPE_ORDER', () => {
    expect(typeBreakdown([])).toEqual([
      { type: 'handout', count: 0 },
      { type: 'slides', count: 0 },
      { type: 'paper', count: 0 },
      { type: 'link', count: 0 },
      { type: 'video', count: 0 },
      { type: 'note', count: 0 },
    ])
  })
  it('計數正確', () => {
    const rows = [
      row({ id: '1', type: 'video' }),
      row({ id: '2', type: 'video' }),
      row({ id: '3', type: 'paper' }),
    ]
    const out = typeBreakdown(rows)
    const get = (t: ResourceType) => out.find((x) => x.type === t)!.count
    expect(get('video')).toBe(2)
    expect(get('paper')).toBe(1)
    expect(get('handout')).toBe(0)
  })
})

// ============================================================
//  folderBreakdown — 依 order 排序 + 永遠尾接「未分類」
// ============================================================
describe('folderBreakdown', () => {
  const folders: ResourceFolder[] = [
    { id: 'fb', name: 'B', color: 'blue', order: 1, createdAt: '2026-01-01' },
    { id: 'fa', name: 'A', color: 'rose', order: 0, createdAt: '2026-01-01' },
  ]
  it('依 order 排序，計數，尾接 __none', () => {
    const rows = [
      row({ id: '1' }, { folderId: 'fa' }),
      row({ id: '2' }, { folderId: 'fa' }),
      row({ id: '3' }, { folderId: 'fb' }),
      row({ id: '4' }), // 無收藏夾
    ]
    expect(folderBreakdown(rows, folders)).toEqual([
      { id: 'fa', name: 'A', color: 'rose', count: 2 },
      { id: 'fb', name: 'B', color: 'blue', count: 1 },
      { id: '__none', name: '未分類', color: 'slate', count: 1 },
    ])
  })
  it('空 rows → 全 0 + 未分類 0', () => {
    expect(folderBreakdown([], folders)).toEqual([
      { id: 'fa', name: 'A', color: 'rose', count: 0 },
      { id: 'fb', name: 'B', color: 'blue', count: 0 },
      { id: '__none', name: '未分類', color: 'slate', count: 0 },
    ])
  })
})

// ============================================================
//  topOpened — 只計開過，降序，top N
// ============================================================
describe('topOpened', () => {
  it('濾走 0 次，降序', () => {
    const rows = [
      row({ id: 'a' }, { opens: 0 }),
      row({ id: 'b' }, { opens: 5 }),
      row({ id: 'c' }, { opens: 2 }),
    ]
    expect(topOpened(rows).map((r) => r.res.id)).toEqual(['b', 'c'])
  })
  it('限制 top N', () => {
    const rows = [
      row({ id: 'a' }, { opens: 9 }),
      row({ id: 'b' }, { opens: 8 }),
      row({ id: 'c' }, { opens: 7 }),
    ]
    expect(topOpened(rows, 2).map((r) => r.res.id)).toEqual(['a', 'b'])
  })
  it('全 0 → []', () => {
    expect(topOpened([row({ id: 'a' }, { opens: 0 })])).toEqual([])
  })
  it('空陣列 → []', () => {
    expect(topOpened([])).toEqual([])
  })
})

// ============================================================
//  topicCoverage — 課題分佈 top N + 未連結
// ============================================================
describe('topicCoverage', () => {
  const nameOf = (id: string) => ({ t1: '宏觀', t2: '微觀' }[id] ?? '')
  it('降序 + 未連結尾接（>0 先接）', () => {
    const rows = [
      row({ id: '1', topicId: 't1' }),
      row({ id: '2', topicId: 't1' }),
      row({ id: '3', topicId: 't2' }),
      row({ id: '4' }), // 無 topic
    ]
    expect(topicCoverage(rows, nameOf)).toEqual([
      { id: 't1', name: '宏觀', count: 2 },
      { id: 't2', name: '微觀', count: 1 },
      { id: '__none', name: '未連結課題', count: 1 },
    ])
  })
  it('無未連結就唔接 __none', () => {
    const rows = [row({ id: '1', topicId: 't1' })]
    expect(topicCoverage(rows, nameOf)).toEqual([{ id: 't1', name: '宏觀', count: 1 }])
  })
  it('已刪課題顯示佔位名', () => {
    const rows = [row({ id: '1', topicId: 'ghost' })]
    expect(topicCoverage(rows, nameOf)).toEqual([
      { id: 'ghost', name: '（已刪課題）', count: 1 },
    ])
  })
  it('限制 top N（未連結唔受 N 影響）', () => {
    const rows = [
      row({ id: '1', topicId: 't1' }),
      row({ id: '2', topicId: 't1' }),
      row({ id: '3', topicId: 't2' }),
      row({ id: '4' }),
    ]
    const out = topicCoverage(rows, nameOf, 1)
    expect(out).toEqual([
      { id: 't1', name: '宏觀', count: 2 },
      { id: '__none', name: '未連結課題', count: 1 },
    ])
  })
})

// ============================================================
//  emptyMeta — 結構（updatedAt 為時戳，只驗其餘）
// ============================================================
describe('emptyMeta', () => {
  it('預設旗標全 false / opens 0 / id 帶入', () => {
    const m = emptyMeta('abc')
    expect(m.id).toBe('abc')
    expect(m.favorite).toBe(false)
    expect(m.archived).toBe(false)
    expect(m.broken).toBe(false)
    expect(m.opens).toBe(0)
    expect(m.folderId).toBeUndefined()
    expect(m.rating).toBeUndefined()
    expect(m.lastOpened).toBeUndefined()
  })
})

// 抑制 SortKey 未用警告（type-only 引入確保簽名穩定）
const _sortKeys: SortKey[] = ['recent', 'oldest', 'title', 'opens', 'lastOpened', 'type']
describe('SortKey 完整性', () => {
  it('六個排序鍵', () => expect(_sortKeys).toHaveLength(6))
})
