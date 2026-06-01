// relativeTime 嘅 >=7 日退化分支用 new Date(t).getFullYear()/getMonth()/getDate()
// （讀「本地時區」component），故喺 import 前鎖死 TZ = Asia/Hong_Kong（跟 srs.test.ts
// 同樣手法）：令絕對日期斷言喺任何 host TZ 都成立。其餘相對分支只睇 epoch diff，
// 與時區無關。本 repo tsconfig 無 @types/node，故自行最小宣告 process（只用 env.TZ）。
declare const process: { env: Record<string, string | undefined> }
process.env.TZ = 'Asia/Hong_Kong'

import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  fuzzyMatch,
  highlightSegments,
  snippetAround,
  parseQuery,
  isPinned,
  relativeTime,
} from './util'
import type { PinnedSearch } from './util'

// ============================================================
//  全域搜尋純函式測試
//  ------------------------------------------------------------
//  只測「同樣輸入永遠同樣輸出、無 side effect」嘅純函式：
//    fuzzyMatch / highlightSegments / snippetAround / parseQuery / isPinned
//  relativeTime：無 now 參數（內部裸 Date.now），改用 vi fake timers 釘死系統
//  時間後測（見檔尾 describe）。
//  跳過：pushRecent / clearRecents / removeRecent / togglePin（寫 collection
//  + 用 Date.now）。
//  全部預期值用第一性原理人手計，唔靠跑 code 反推。
// ============================================================

const pin = (q: string): PinnedSearch => ({ id: q.toLowerCase(), q, createdAt: 0 })

describe('fuzzyMatch — 子字串快路（連續命中大獎）', () => {
  it('字頭命中：score = 1000 + len*6 + 120（sub=0 無扣分）', () => {
    // "hello" / "hel" → sub=0, indices [0,1,2]
    // 1000 + 3*6 + 120 = 1138
    expect(fuzzyMatch('hello', 'hel')).toEqual({ score: 1138, indices: [0, 1, 2] })
  })

  it('詞首（前一字元係空格）命中：+70 而非 +120', () => {
    // "foo bar" / "bar" → sub=4，prev=' ' 係 boundary
    // 1000 + 3*6 + 70 - min(4,40) = 1000+18+70-4 = 1084
    expect(fuzzyMatch('foo bar', 'bar')).toEqual({ score: 1084, indices: [4, 5, 6] })
  })

  it('中段非詞首命中：無字頭/詞首獎，只扣「越前越好」', () => {
    // "abcdef" / "cd" → sub=2，prev='b' 唔係 boundary
    // 1000 + 2*6 - min(2,40) = 1000+12-2 = 1010
    expect(fuzzyMatch('abcdef', 'cd')).toEqual({ score: 1010, indices: [2, 3] })
  })

  it('大細階無關（toLowerCase）', () => {
    // "HELLO" / "ell" → t="hello"，sub=1，prev='h' 唔係 boundary
    // 1000 + 3*6 - 1 = 1017
    expect(fuzzyMatch('HELLO', 'ell')).toEqual({ score: 1017, indices: [1, 2, 3] })
  })

  it('中文子字串命中', () => {
    // "數學科" / "數學" → sub=0，indices [0,1]
    // 1000 + 2*6 + 120 = 1132
    expect(fuzzyMatch('數學科', '數學')).toEqual({ score: 1132, indices: [0, 1] })
  })
})

describe('fuzzyMatch — 子序列比對', () => {
  it('camel/字頭混合：react native → "rn"', () => {
    // "react native"：r0 ... n6（' '係 boundary）
    // qi0 r@0: else +4=4；found0 +22=26
    // qi1 n@6: 非連續 else +4=30；prev t[5]=' ' boundary +22=52；-min(6,30)*0.15=0.9 → 51.1
    // 命中比例 +(2/12)*40=6.6667 → 57.766… → round 58
    expect(fuzzyMatch('react native', 'rn')).toEqual({ score: 58, indices: [0, 6] })
  })

  it('連續命中加 streak（中間隔一個 X）', () => {
    // "abXcd" / "abcd"：a0 b1 c3 d4
    // a0: +4 +22 = 26
    // b1 連續(streak→1): +14+6=20 → 46；prev a 非bd；-0.15 → 45.85
    // c3 斷開(streak→0): +4 → 49.85；prev 'X' 非bd；-0.45 → 49.4
    // d4 連續(streak→1): +14+6=20 → 69.4；prev c 非bd；-0.6 → 68.8
    // +(4/5)*40=32 → 100.8 → 101
    expect(fuzzyMatch('abXcd', 'abcd')).toEqual({ score: 101, indices: [0, 1, 3, 4] })
  })

  it('長連續 streak 累加（abcXd / abcd）', () => {
    // a0:+4+22=26；b1 streak1 +20 →46 -0.15=45.85；c2 streak2 +14+12=26 →71.85 -0.3=71.55
    // d4 斷開 streak0 +4 →75.55；prev 'X' 非bd；-0.6=74.95；+(4/5)*40=32 →106.95 → 107
    expect(fuzzyMatch('abcXd', 'abcd')).toEqual({ score: 107, indices: [0, 1, 2, 4] })
  })

  it('詞首子序列（連字號分隔）：foo-bar → "fb"', () => {
    // f0:+4+22=26；b4 非連續 +4=30；prev '-' boundary +22=52；-min(4,30)*0.15=0.6 →51.4
    // +(2/7)*40=11.4286 →62.83 → 63
    expect(fuzzyMatch('foo-bar', 'fb')).toEqual({ score: 63, indices: [0, 4] })
  })

  it('中文子序列：中文數學 → "中數"', () => {
    // 中0:+4+22=26；數@2 非連續 +4=30；prev '文' 非bd；-min(2,30)*0.15=0.3 →29.7
    // +(2/4)*40=20 →49.7 → 50
    expect(fuzzyMatch('中文數學', '中數')).toEqual({ score: 50, indices: [0, 2] })
  })
})

describe('fuzzyMatch — edge cases', () => {
  it('空 query → 中性命中（score 0）', () => {
    expect(fuzzyMatch('anything', '')).toEqual({ score: 0, indices: [] })
  })

  it('空 text + 空 query → 中性命中', () => {
    expect(fuzzyMatch('', '')).toEqual({ score: 0, indices: [] })
  })

  it('空 text + 非空 query → null（唔匹配）', () => {
    expect(fuzzyMatch('', 'a')).toBeNull()
  })

  it('完全唔匹配 → null', () => {
    expect(fuzzyMatch('abc', 'xyz')).toBeNull()
  })

  it('query 重複字元但 text 只有一個 → null', () => {
    // 'a' 命中 index0，第二個 'a' 由 index1 起搵唔到
    expect(fuzzyMatch('abc', 'aa')).toBeNull()
  })

  it('query 比 text 長且唔可能成子序列 → null', () => {
    expect(fuzzyMatch('ab', 'abc')).toBeNull()
  })
})

describe('highlightSegments — 命中分段', () => {
  it('開頭命中：分成 hit / 非 hit 兩段', () => {
    expect(highlightSegments('hello', [0, 1])).toEqual([
      { text: 'he', hit: true },
      { text: 'llo', hit: false },
    ])
  })

  it('中段命中：非 hit / hit / 非 hit 三段', () => {
    expect(highlightSegments('hello', [2, 3])).toEqual([
      { text: 'he', hit: false },
      { text: 'll', hit: true },
      { text: 'o', hit: false },
    ])
  })

  it('空 indices → 全段非 hit', () => {
    expect(highlightSegments('hello', [])).toEqual([{ text: 'hello', hit: false }])
  })

  it('out-of-range index 被忽略 → 全段非 hit', () => {
    expect(highlightSegments('hello', [10])).toEqual([{ text: 'hello', hit: false }])
  })

  it('分散多段命中（index 0 與 4）', () => {
    // h0 hit, e1l2l3 非hit, o4 hit
    expect(highlightSegments('hello', [0, 4])).toEqual([
      { text: 'h', hit: true },
      { text: 'ell', hit: false },
      { text: 'o', hit: true },
    ])
  })

  it('重複 / 亂序 index 透過 Set 正規化', () => {
    expect(highlightSegments('hello', [3, 2, 2])).toEqual([
      { text: 'he', hit: false },
      { text: 'll', hit: true },
      { text: 'o', hit: false },
    ])
  })

  it('空 text → 無段（空陣列）', () => {
    expect(highlightSegments('', [0])).toEqual([])
  })
})

describe('snippetAround — 命中窗 + offset 映射', () => {
  it('無 indices + 短文：整段返回，offset 0，無省略號', () => {
    expect(snippetAround('hello world', [])).toEqual({ text: 'hello world', offset: 0 })
  })

  it('無 indices + 超長文：截到 pad*2 並加尾省略號', () => {
    // pad 預設 36 → 切 72 字。造 80 字確保 > 72。
    const text = 'x'.repeat(80)
    const r = snippetAround(text, [])
    expect(r.offset).toBe(0)
    expect(r.text).toBe('x'.repeat(72) + '…')
  })

  it('短文 + 開頭命中：無前後省略號，offset 0', () => {
    expect(snippetAround('hello world', [0])).toEqual({ text: 'hello world', offset: 0 })
  })

  it('長文取窗：前後加省略號，offset = start - 1', () => {
    // 命中 16..18（fox），pad 10 → start=6 end=28
    // body = slice(6,28) = "ick brown fox jumps ov"，前後皆有省略號
    const long =
      'The quick brown fox jumps over the lazy dog and keeps running far away into the night sky'
    const r = snippetAround(long, [16, 17, 18], 10)
    expect(r.text).toBe('…ick brown fox jumps ov…')
    expect(r.offset).toBe(5) // start(6) - prefix.length(1)
  })

  it('offset 映射正確：snippet[i] 對應原文 [i + offset]', () => {
    const long =
      'The quick brown fox jumps over the lazy dog and keeps running far away into the night sky'
    const r = snippetAround(long, [16, 17, 18], 10)
    // snippet 第 1 個字（i=1，前綴'…'後第一個 body 字元）應對應原文 index 6
    const i = 1
    expect(r.text[i]).toBe(long[i + r.offset])
    // 命中字元 'f'（原文 16）→ snippet index = 16 - offset = 11
    expect(r.text[16 - r.offset]).toBe('f')
  })

  it('換行 / tab 攤平成空格（保持長度 1:1）', () => {
    expect(snippetAround('a\nb\tc', [0], 36)).toEqual({ text: 'a b c', offset: 0 })
  })
})

describe('parseQuery — type: 運算子解析', () => {
  it('抽出有效 type: 並保留其餘關鍵字', () => {
    expect(parseQuery('hello type:note world', ['note', 'todo'])).toEqual({
      text: 'hello world',
      typeFilter: 'note',
    })
  })

  it('type: 大細階無關（正規化成細階）', () => {
    expect(parseQuery('type:NOTE hi', ['note'])).toEqual({
      text: 'hi',
      typeFilter: 'note',
    })
  })

  it('無效 type 當作普通關鍵字保留', () => {
    expect(parseQuery('type:xyz hi', ['note'])).toEqual({
      text: 'type:xyz hi',
      typeFilter: null,
    })
  })

  it('只得 type: → text 空、typeFilter 設定', () => {
    expect(parseQuery('type:note', ['note'])).toEqual({ text: '', typeFilter: 'note' })
  })

  it('空字串輸入 → text 空、無 filter', () => {
    expect(parseQuery('', ['note'])).toEqual({ text: '', typeFilter: null })
  })

  it('純空白輸入 → text trim 後為空', () => {
    expect(parseQuery('   ', ['note'])).toEqual({ text: '', typeFilter: null })
  })

  it('type: 後無值（type: 加空格）唔當運算子', () => {
    // /^type:(\S+)$/ 要至少一個非空白字元，"type:" 單獨 token 唔匹配
    expect(parseQuery('type: hi', ['note'])).toEqual({
      text: 'type: hi',
      typeFilter: null,
    })
  })

  it('多個 type: → 最後一個有效嘅勝出', () => {
    expect(parseQuery('type:note type:todo x', ['note', 'todo'])).toEqual({
      text: 'x',
      typeFilter: 'todo',
    })
  })
})

describe('isPinned — 釘選判斷（trim + 大細階無關）', () => {
  it('trim + 大細階後相等 → true', () => {
    expect(isPinned('  Hello ', [pin('hello')])).toBe(true)
  })

  it('唔喺釘選列表 → false', () => {
    expect(isPinned('hi', [pin('hello')])).toBe(false)
  })

  it('空釘選陣列 → false', () => {
    expect(isPinned('hi', [])).toBe(false)
  })

  it('多個釘選中任一相符即 true', () => {
    expect(isPinned('TODO', [pin('note'), pin('todo'), pin('q')])).toBe(true)
  })
})

// ============================================================
//  relativeTime（globalSearch 版）— 缺 now 參數，靠 vi 釘死系統時間先可測
//  ------------------------------------------------------------
//  簽名係 relativeTime(iso?): string | null，內部用裸 Date.now()（與 inbox 版
//  收 now 參數唔同 → 呢個係缺陷源頭：無法純函式注入，只能 fake timers）。
//  分支（全部用第一性原理人手計門檻）：
//    diff < 6e4(60s)        → '啱啱'
//    diff < 36e5(1hr)       → '{floor(diff/6e4)} 分鐘前'
//    diff < 864e5(24hr)     → '{floor(diff/36e5)} 小時前'
//    diff < 7×864e5(7日)    → '{floor(diff/864e5)} 日前'
//    其餘                    → 'YYYY/M/D'（本地 component，月/日「唔補零」，與
//                              inbox 版退化成「N 週/月/年前」唔同）
//  時間錨：NOW 固定一個 UTC 瞬間；相對分支只睇 diff（與 TZ 無關），絕對分支
//  靠頂部 TZ pin（HKT）令本地 Y/M/D 確定。
// ============================================================
describe('relativeTime（globalSearch 版，fake timers 釘死 now）', () => {
  const MIN = 6e4 // 60_000ms
  const HOUR = 36e5 // 3_600_000ms
  const DAY = 864e5 // 86_400_000ms
  // 錨定「現在」= 2026-06-01T12:00:00Z（任意但固定）。
  const NOW = Date.UTC(2026, 5, 1, 12, 0, 0)
  // 由 NOW 倒數 ms 構造 iso（UTC ISO；relativeTime 只關心 epoch diff）。
  const ago = (ms: number): string => new Date(NOW - ms).toISOString()

  afterEach(() => {
    vi.useRealTimers()
  })

  // 每個 case 入面先釘死系統時間（取代裸 Date.now()）。
  const pin = () => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  }

  it('undefined → null（無 iso）', () => {
    pin()
    expect(relativeTime(undefined)).toBeNull()
    expect(relativeTime()).toBeNull()
  })

  it('非法 iso → null（Date.parse 回 NaN）', () => {
    pin()
    expect(relativeTime('not-a-date')).toBeNull()
    expect(relativeTime('')).toBeNull() // 空字串先撞 !iso 短路 → null
  })

  it('diff < 60s → 「啱啱」（含 0 同 59s 邊界）', () => {
    pin()
    expect(relativeTime(ago(0))).toBe('啱啱') // 啱啱同一刻
    expect(relativeTime(ago(30 * 1000))).toBe('啱啱') // 30s
    expect(relativeTime(ago(MIN - 1))).toBe('啱啱') // 59.999s 仍 < 6e4
  })

  it('分鐘分支：60s 起、59 分鐘上限（floor）', () => {
    pin()
    // 剛好 60s：diff < 6e4 false → 入分鐘分支，floor(60000/6e4)=1
    expect(relativeTime(ago(MIN))).toBe('1 分鐘前')
    expect(relativeTime(ago(5 * MIN))).toBe('5 分鐘前')
    expect(relativeTime(ago(59 * MIN))).toBe('59 分鐘前') // 上限：< 36e5
  })

  it('小時分支：剛好 1hr 起、23 小時上限（floor）', () => {
    pin()
    // 剛好 1hr：diff < 36e5 false → 入小時分支，floor(3600000/36e5)=1
    expect(relativeTime(ago(HOUR))).toBe('1 小時前')
    expect(relativeTime(ago(HOUR + 59 * MIN))).toBe('1 小時前') // 1h59m 仍係「1 小時前」
    expect(relativeTime(ago(23 * HOUR))).toBe('23 小時前') // 上限：< 864e5
  })

  it('日分支：剛好 24hr 起、6 日上限（floor）', () => {
    pin()
    // 剛好 24hr：diff < 864e5 false → 入日分支，floor(86400000/864e5)=1
    expect(relativeTime(ago(DAY))).toBe('1 日前')
    expect(relativeTime(ago(DAY + 23 * HOUR))).toBe('1 日前') // 1d23h 仍係「1 日前」
    expect(relativeTime(ago(6 * DAY))).toBe('6 日前') // 上限：< 7×864e5
  })

  it('>= 7 日退化成絕對日期「YYYY/M/D」（本地 component，月/日唔補零）', () => {
    pin()
    // 構造一個本地（HKT, UTC+8）日子係 2026/3/5 嘅瞬間：2026-03-05T00:00:00+08:00。
    // 距 NOW 遠超 7 日，必入絕對分支。月=3、日=5 皆單位數 → 驗證「唔補零」。
    expect(relativeTime('2026-03-05T00:00:00+08:00')).toBe('2026/3/5')
    // 兩位數月/日照常顯示（唔加多餘前綴）。
    expect(relativeTime('2025-12-25T08:00:00+08:00')).toBe('2025/12/25')
  })

  it('剛好 7 日 → 已退化成絕對日期（唔再係「7 日前」）', () => {
    pin()
    // diff = 7×864e5：diff < 7×DAY false → 絕對分支。
    // NOW=2026-06-01T12:00Z，減 7 日 = 2026-05-25T12:00Z = HKT 2026-05-25 20:00 → 2026/5/25
    expect(relativeTime(ago(7 * DAY))).toBe('2026/5/25')
  })

  it('本地時區邊界：UTC 與 HKT 跨日令絕對日期差一日（守護 TZ pin 生效）', () => {
    pin()
    // 2026-03-04T20:00:00Z：UTC 係 3/4，但 HKT(+8) 係 3/5 04:00。
    // relativeTime 用本地 component → 回 '2026/3/5'（若 TZ pin 失效會變 '2026/3/4'）。
    expect(relativeTime('2026-03-04T20:00:00Z')).toBe('2026/3/5')
  })
})
