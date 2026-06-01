import { describe, it, expect } from 'vitest'
import {
  kindDef,
  kindLabel,
  parseTags,
  stripTags,
  relativeTime,
  dayKey,
  dayGroupLabel,
  guessKind,
  buildRow,
  sortRows,
  byOldest,
  computeStats,
  staleInboxRows,
  STALE_DAYS,
  allTags,
  type InboxRow,
} from './util'
import type { InboxItem } from '../../../data/types'
import type { InboxKind, InboxMeta } from './types'

// ───────── helpers ─────────
const item = (over: Partial<InboxItem> & { id: string }): InboxItem => ({
  text: '',
  createdAt: '2026-05-15T09:00:00',
  ...over,
})

const row = (over: Partial<InboxRow> & { item: InboxItem }): InboxRow => ({
  guessed: true,
  tags: [],
  pinned: false,
  archived: false,
  ...over,
})

// 全部 epoch / ISO 都用「絕對」基準（relativeTime 只睇 epoch diff，
// 與測試機時區無關）。
const NOW = Date.UTC(2027, 5, 1, 12, 0, 0) // 2027-06-01T12:00:00Z
const minus = (ms: number): string => new Date(NOW - ms).toISOString()
const DAY = 86400000

describe('kindDef / kindLabel', () => {
  it('回對應分類定義', () => {
    expect(kindDef('task').label).toBe('待辦')
    expect(kindDef('event').feature).toBe('calendar')
    expect(kindDef('reference').feature).toBeNull()
  })
  it('kindLabel 對齊 KINDS', () => {
    expect(kindLabel('note')).toBe('筆記')
    expect(kindLabel('event')).toBe('行事曆')
    expect(kindLabel('question')).toBe('題目')
    expect(kindLabel('countdown')).toBe('倒數')
  })
  it('未知 id 退回 reference（最後一個）', () => {
    expect(kindDef('nope' as InboxKind).id).toBe('reference')
  })
})

describe('parseTags', () => {
  it('抽 #標籤、去重、保次序、轉細階', () => {
    expect(parseTags('買 #grocery #Grocery #牛奶_2 完成')).toEqual(['grocery', '牛奶_2'])
  })
  it('保留首次出現次序', () => {
    expect(parseTags('a #Foo b #bar c #foo')).toEqual(['foo', 'bar'])
  })
  it('空字串 / 無標籤 → 空陣列', () => {
    expect(parseTags('')).toEqual([])
    expect(parseTags('完全冇任何標籤')).toEqual([])
  })
  it('裸 # / ## 唔當標籤（要至少一個合法字元）', () => {
    expect(parseTags('# ## ###')).toEqual([])
  })
})

describe('stripTags', () => {
  it('剝走 # 起首符號但保留字詞，並 trim', () => {
    expect(stripTags('買 #grocery 牛奶')).toBe('買 grocery 牛奶')
    expect(stripTags('  #hello world  ')).toBe('hello world')
  })
  it('空字串 → 空字串', () => {
    expect(stripTags('')).toBe('')
  })
})

describe('relativeTime（epoch diff，與時區無關）', () => {
  it('<1 分鐘 → 啱啱', () => {
    expect(relativeTime(minus(30 * 1000), NOW)).toBe('啱啱')
    expect(relativeTime(minus(0), NOW)).toBe('啱啱')
  })
  it('分鐘 / 小時 / 日', () => {
    expect(relativeTime(minus(5 * 60000), NOW)).toBe('5 分鐘前')
    expect(relativeTime(minus(3 * 3600000), NOW)).toBe('3 小時前')
    expect(relativeTime(minus(2 * DAY), NOW)).toBe('2 日前')
    expect(relativeTime(minus(6 * DAY), NOW)).toBe('6 日前')
  })
  it('週（day 7..34）', () => {
    expect(relativeTime(minus(7 * DAY), NOW)).toBe('1 週前')
    expect(relativeTime(minus(21 * DAY), NOW)).toBe('3 週前')
    expect(relativeTime(minus(34 * DAY), NOW)).toBe('4 週前')
  })
  it('月（day 35..359）', () => {
    expect(relativeTime(minus(35 * DAY), NOW)).toBe('1 個月前')
    expect(relativeTime(minus(200 * DAY), NOW)).toBe('6 個月前')
    expect(relativeTime(minus(359 * DAY), NOW)).toBe('11 個月前')
  })
  // BUG 守門：原本 day 360..364 因 day/30 與 day/365 唔一致而回「0 年前」
  it('年：360–364 日唔可以係「0 年前」', () => {
    expect(relativeTime(minus(360 * DAY), NOW)).toBe('1 年前')
    expect(relativeTime(minus(364 * DAY), NOW)).toBe('1 年前')
    expect(relativeTime(minus(365 * DAY), NOW)).toBe('1 年前')
    expect(relativeTime(minus(800 * DAY), NOW)).toBe('2 年前')
  })
  it('無效 iso → 空字串', () => {
    expect(relativeTime('not-a-date', NOW)).toBe('')
  })
  it('未來時間（now < t）→ 啱啱', () => {
    expect(relativeTime(new Date(NOW + 5 * 60000).toISOString(), NOW)).toBe('啱啱')
  })
})

describe('dayKey（本地日期，無 UTC off-by-one）', () => {
  // 用本地時間字串（無 Z）：午間本地時間喺任何時區都係同一個曆日。
  it('回本地 YYYY-MM-DD（補零）', () => {
    expect(dayKey('2026-05-04T09:30:00')).toBe('2026-05-04')
    expect(dayKey('2026-03-05T08:00:00')).toBe('2026-03-05')
  })
  it('年首 / 年尾邊界', () => {
    expect(dayKey('2026-01-01T00:00:00')).toBe('2026-01-01')
    expect(dayKey('2026-12-31T23:00:00')).toBe('2026-12-31')
  })
})

describe('dayGroupLabel', () => {
  // now 用本地正午 epoch，內部 today/yesterday 換算自洽。
  const now = new Date(2026, 4, 15, 12, 0, 0).getTime() // 2026-05-15 本地正午
  it('今日 / 昨日', () => {
    expect(dayGroupLabel('2026-05-15', now)).toBe('今日')
    expect(dayGroupLabel('2026-05-14', now)).toBe('昨日')
  })
  it('同年 → M月D日', () => {
    expect(dayGroupLabel('2026-05-10', now)).toBe('5月10日')
    expect(dayGroupLabel('2026-01-03', now)).toBe('1月3日')
  })
  it('跨年 → Y年M月D日', () => {
    expect(dayGroupLabel('2025-12-25', now)).toBe('2025年12月25日')
  })
})

describe('guessKind（離線規則式）', () => {
  it('題目：問號結尾或疑問詞起首', () => {
    expect(guessKind('點解天係藍色')).toBe('question')
    expect(guessKind('呢題識唔識做?')).toBe('question')
  })
  it('倒數優先於行事曆（考試/deadline）', () => {
    expect(guessKind('下星期五考試 deadline')).toBe('countdown')
  })
  it('行事曆：時間 / 開會', () => {
    expect(guessKind('聽日下午 3:30 開會')).toBe('event')
  })
  it('待辦：行動詞', () => {
    expect(guessKind('記得買牛奶')).toBe('task')
  })
  it('參考：連結', () => {
    expect(guessKind('www.site.org 連結')).toBe('reference')
  })
  it('估唔到 → note（預設）', () => {
    expect(guessKind('天氣幾好')).toBe('note')
    expect(guessKind('')).toBe('note')
  })
})

describe('buildRow（合併 item + meta）', () => {
  it('無 meta：靠估分類 + parse 標籤', () => {
    const r = buildRow(item({ id: '1', text: '記得交 #homework' }))
    expect(r.kind).toBe('task')
    expect(r.guessed).toBe(true)
    expect(r.tags).toEqual(['homework'])
    expect(r.pinned).toBe(false)
    expect(r.archived).toBe(false)
  })
  it('有明確 kind：唔再估', () => {
    const meta: InboxMeta = { id: '1', kind: 'note' }
    const r = buildRow(item({ id: '1', text: '記得交功課' }), meta)
    expect(r.kind).toBe('note')
    expect(r.guessed).toBe(false)
  })
  it('meta.tags 非空時取代 parse 結果；空陣列退回 parse', () => {
    const withTags = buildRow(item({ id: '1', text: '#a #b' }), { id: '1', tags: ['manual'] })
    expect(withTags.tags).toEqual(['manual'])
    const emptyTags = buildRow(item({ id: '1', text: '#a #b' }), { id: '1', tags: [] })
    expect(emptyTags.tags).toEqual(['a', 'b'])
  })
  it('pinned / archived 由 meta 推導', () => {
    const r = buildRow(item({ id: '1', text: 'x' }), {
      id: '1',
      pinned: true,
      status: 'archived',
    })
    expect(r.pinned).toBe(true)
    expect(r.archived).toBe(true)
  })
})

describe('sortRows（置頂優先，再時間新→舊）', () => {
  it('置頂排前（即使較舊）', () => {
    const pinnedOld = row({ item: item({ id: 'p', createdAt: '2026-05-01T00:00:00' }), pinned: true })
    const freshUnpinned = row({ item: item({ id: 'f', createdAt: '2026-05-20T00:00:00' }) })
    expect(sortRows(pinnedOld, freshUnpinned)).toBe(-1)
    expect(sortRows(freshUnpinned, pinnedOld)).toBe(1)
  })
  it('同置頂狀態 → 新嘅排前', () => {
    const newer = row({ item: item({ id: 'n', createdAt: '2026-05-20T00:00:00' }) })
    const older = row({ item: item({ id: 'o', createdAt: '2026-05-01T00:00:00' }) })
    expect(sortRows(newer, older)).toBeLessThan(0)
    expect(sortRows(older, newer)).toBeGreaterThan(0)
  })
  it('完整排序：置頂在前，組內新→舊', () => {
    const a = row({ item: item({ id: 'a', createdAt: '2026-05-01T00:00:00' }), pinned: true })
    const b = row({ item: item({ id: 'b', createdAt: '2026-05-20T00:00:00' }) })
    const c = row({ item: item({ id: 'c', createdAt: '2026-05-10T00:00:00' }) })
    expect([b, c, a].sort(sortRows).map((r) => r.item.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('allTags（去重 + 排序）', () => {
  it('合併所有 row 標籤、去重、升序', () => {
    const rows = [
      row({ item: item({ id: '1' }), tags: ['b', 'a'] }),
      row({ item: item({ id: '2' }), tags: ['a', 'c'] }),
    ]
    expect(allTags(rows)).toEqual(['a', 'b', 'c'])
  })
  it('空輸入 → 空陣列', () => {
    expect(allTags([])).toEqual([])
  })
})

describe('computeStats', () => {
  // 固定基準：2026-05-15 本地正午；createdAt 用本地時間字串，
  // 令 dayKey 直接等於字串前綴（與時區無關）。
  const now = new Date(2026, 4, 15, 12, 0, 0).getTime()
  const rows: InboxRow[] = [
    row({ item: item({ id: '1', createdAt: '2026-05-15T09:00:00' }), kind: 'task', pinned: true, tags: ['a', 'b'] }),
    row({ item: item({ id: '2', createdAt: '2026-05-15T11:00:00' }), kind: 'note', tags: ['a'] }),
    row({ item: item({ id: '3', createdAt: '2026-05-14T10:00:00' }), kind: 'event', tags: ['b'] }),
    row({ item: item({ id: '4', createdAt: '2026-05-09T10:00:00' }), kind: 'task', tags: ['a', 'c'] }),
    row({ item: item({ id: '5', createdAt: '2026-05-08T10:00:00' }), kind: 'note', tags: [] }),
    row({ item: item({ id: '6', createdAt: '2026-05-02T10:00:00' }), kind: 'reference', tags: [] }),
    row({ item: item({ id: '7', createdAt: '2026-04-30T10:00:00' }), kind: 'question', tags: ['x'], archived: true }),
  ]
  const s = computeStats(rows, now)

  it('計數：待處理 / 已歸檔 / 置頂', () => {
    expect(s.inboxCount).toBe(6)
    expect(s.archivedCount).toBe(1)
    expect(s.pinnedCount).toBe(1)
  })
  it('byKind 只計待處理', () => {
    expect(s.byKind).toEqual({ task: 2, note: 2, event: 1, question: 0, countdown: 0, reference: 1 })
  })
  it('perDay：近 14 日（2026-05-02..05-15）+ 各日計數', () => {
    expect(s.perDay).toHaveLength(14)
    expect(s.perDay[0].key).toBe('2026-05-02')
    expect(s.perDay[13].key).toBe('2026-05-15')
    expect(s.perDay[13].label).toBe('5/15')
    const byDay = Object.fromEntries(s.perDay.map((d) => [d.key, d.count]))
    expect(byDay['2026-05-15']).toBe(2)
    expect(byDay['2026-05-14']).toBe(1)
    expect(byDay['2026-05-09']).toBe(1)
    expect(byDay['2026-05-08']).toBe(1)
    expect(byDay['2026-05-02']).toBe(1)
    expect(byDay['2026-05-10']).toBe(0)
    // 視窗外（4/30）唔入 perDay
    expect(s.perDay.reduce((n, d) => n + d.count, 0)).toBe(6)
  })
  it('todayCaptured / weekCaptured（含已歸檔；week = 近 7 日）', () => {
    expect(s.todayCaptured).toBe(2) // 5/15 兩件
    expect(s.weekCaptured).toBe(4) // 5/9..5/15：#1#2#3#4（#5 喺 5/8 已出界）
  })
  it('oldestInboxIso：最舊待處理（排除已歸檔）', () => {
    expect(s.oldestInboxIso).toBe('2026-05-02T10:00:00')
  })
  it('topTags：待處理標籤、count 降序、平手 tag 升序', () => {
    expect(s.topTags).toEqual([
      { tag: 'a', count: 3 },
      { tag: 'b', count: 2 },
      { tag: 'c', count: 1 },
    ])
  })
  it('空輸入：全 0、無 oldest、空 topTags、仍有 14 格', () => {
    const e = computeStats([], now)
    expect(e.inboxCount).toBe(0)
    expect(e.archivedCount).toBe(0)
    expect(e.byKind).toEqual({ task: 0, note: 0, event: 0, question: 0, countdown: 0, reference: 0 })
    expect(e.perDay).toHaveLength(14)
    expect(e.todayCaptured).toBe(0)
    expect(e.weekCaptured).toBe(0)
    expect(e.oldestInboxIso).toBeUndefined()
    expect(e.topTags).toEqual([])
  })
})

describe('byOldest（純時間舊→新）', () => {
  it('最舊排頭', () => {
    const older = row({ item: item({ id: 'o', createdAt: '2026-05-01T00:00:00' }) })
    const newer = row({ item: item({ id: 'n', createdAt: '2026-05-20T00:00:00' }) })
    expect(byOldest(older, newer)).toBeLessThan(0)
    expect(byOldest(newer, older)).toBeGreaterThan(0)
  })
  it('唔理置頂（與 sortRows 唔同）', () => {
    const pinnedNew = row({ item: item({ id: 'p', createdAt: '2026-05-20T00:00:00' }), pinned: true })
    const old = row({ item: item({ id: 'o', createdAt: '2026-05-01T00:00:00' }) })
    // byOldest 只睇時間：舊嗰個排頭，置頂不影響
    expect([pinnedNew, old].sort(byOldest).map((r) => r.item.id)).toEqual(['o', 'p'])
  })
})

describe('staleInboxRows（拖延中：擱置超過 N 日嘅待處理）', () => {
  it('預設門檻 = STALE_DAYS（7 日）', () => {
    expect(STALE_DAYS).toBe(7)
  })
  it('只計超過門檻嘅待處理項，按最舊→最新排', () => {
    const rows: InboxRow[] = [
      row({ item: item({ id: 'fresh', createdAt: minus(2 * DAY) }) }), // 2 日：未夠耐
      row({ item: item({ id: 'edge', createdAt: minus(7 * DAY) }) }), // 啱 7 日：算
      row({ item: item({ id: 'old', createdAt: minus(20 * DAY) }) }), // 20 日
      row({ item: item({ id: 'oldest', createdAt: minus(40 * DAY) }) }), // 40 日
    ]
    const stale = staleInboxRows(rows, 7, NOW)
    expect(stale.map((r) => r.item.id)).toEqual(['oldest', 'old', 'edge'])
  })
  it('排除已歸檔（即使好舊）', () => {
    const rows: InboxRow[] = [
      row({ item: item({ id: 'a', createdAt: minus(30 * DAY) }), archived: true }),
      row({ item: item({ id: 'b', createdAt: minus(30 * DAY) }) }),
    ]
    expect(staleInboxRows(rows, 7, NOW).map((r) => r.item.id)).toEqual(['b'])
  })
  it('門檻可調（自訂 days）', () => {
    const rows: InboxRow[] = [
      row({ item: item({ id: 'a', createdAt: minus(10 * DAY) }) }),
      row({ item: item({ id: 'b', createdAt: minus(40 * DAY) }) }),
    ]
    expect(staleInboxRows(rows, 30, NOW).map((r) => r.item.id)).toEqual(['b'])
    expect(staleInboxRows(rows, 5, NOW).map((r) => r.item.id)).toEqual(['b', 'a'])
  })
  it('days <= 0 → 全部待處理（按最舊排）', () => {
    const rows: InboxRow[] = [
      row({ item: item({ id: 'new', createdAt: minus(1000) }) }),
      row({ item: item({ id: 'old', createdAt: minus(5 * DAY) }) }),
    ]
    expect(staleInboxRows(rows, 0, NOW).map((r) => r.item.id)).toEqual(['old', 'new'])
  })
  it('無效 createdAt 一律排除', () => {
    const rows: InboxRow[] = [
      row({ item: item({ id: 'bad', createdAt: 'not-a-date' }) }),
      row({ item: item({ id: 'ok', createdAt: minus(30 * DAY) }) }),
    ]
    expect(staleInboxRows(rows, 7, NOW).map((r) => r.item.id)).toEqual(['ok'])
  })
  it('冇拖延項 → 空陣列', () => {
    const rows: InboxRow[] = [row({ item: item({ id: 'a', createdAt: minus(1 * DAY) }) })]
    expect(staleInboxRows(rows, 7, NOW)).toEqual([])
    expect(staleInboxRows([], 7, NOW)).toEqual([])
  })
})
