// computeStats 用本地日期 component 做 14 日分桶（getFullYear/getMonth/getDate），
// 故在 import 前鎖死 TZ = Asia/Hong_Kong（UTC+8、無 DST），令「本地日」分桶
// 同 streak/busiest 邊界在任何 host 機器上都 deterministic（跟 srs.test.ts 手法）。
declare const process: { env: Record<string, string | undefined> }
process.env.TZ = 'Asia/Hong_Kong'

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  approxWords,
  approxTokens,
  bucketOf,
  groupByTime,
  BUCKET_ORDER,
  computeStats,
  conversationToMarkdown,
  safeFilename,
} from './util'
import type { AiThread, AiMessage } from '../../../data/types'

// ────────────────────────────────────────────────────────────
//  純函式測試。預期值用「第一性原理」人手計，唔靠跑 code 反推。
// ────────────────────────────────────────────────────────────

describe('approxWords（中文逐字 + 英文逐詞）', () => {
  it('空字串 → 0', () => {
    expect(approxWords('')).toBe(0)
  })

  it('純英文：逐詞', () => {
    // "hello world" → 2 個英文詞，0 個 CJK
    expect(approxWords('hello world')).toBe(2)
  })

  it('純中文：逐字', () => {
    // "你好世界" → 4 個 CJK 字，無英文詞
    expect(approxWords('你好世界')).toBe(4)
  })

  it('中英混合：CJK 字數 + 英文/數字詞數', () => {
    // "你好 world 123" → CJK：你、好 = 2；英數詞：world、123 = 2 → 共 4
    expect(approxWords('你好 world 123')).toBe(4)
  })

  it('數字算一個詞、標點唔計', () => {
    // "abc, def!" → 標點被當分隔 → abc、def = 2 個詞
    expect(approxWords('abc, def!')).toBe(2)
  })

  it('全標點/空白 → 0', () => {
    expect(approxWords('   ...!!!  ')).toBe(0)
  })

  it('日文假名都當逐字（範圍含 Hiragana/Katakana）', () => {
    // "こんにちは" → 5 個假名（U+3040–U+30FF 範圍內）
    expect(approxWords('こんにちは')).toBe(5)
  })
})

describe('approxTokens（≈ 字數 × 1.6，四捨五入）', () => {
  it('空字串 → 0', () => {
    expect(approxTokens('')).toBe(0)
  })

  it('2 詞 → round(2 × 1.6) = round(3.2) = 3', () => {
    expect(approxTokens('hello world')).toBe(3)
  })

  it('4 字 → round(4 × 1.6) = round(6.4) = 6', () => {
    expect(approxTokens('你好世界')).toBe(6)
  })

  it('5 字 → round(5 × 1.6) = round(8.0) = 8', () => {
    expect(approxTokens('一二三四五')).toBe(8)
  })
})

describe('bucketOf（相對 now 嘅時間桶，比較「瞬間」唔受時區漂移影響）', () => {
  // now = 2026-05-15 12:00 本地時間 → today = 2026-05-15 00:00 本地
  const now = new Date(2026, 4, 15, 12, 0, 0)
  // 用本地 Date 建構再 toISOString()，令「瞬間」明確、避免 UTC off-by-one
  const at = (...a: [number, number, number, number?, number?, number?]) =>
    new Date(...a).toISOString()

  it('今日（同日稍早）', () => {
    expect(bucketOf(at(2026, 4, 15, 9, 0, 0), now)).toBe('今日')
  })

  it('今日邊界：剛好今日本地零時（t === today，>= 命中）', () => {
    expect(bucketOf(at(2026, 4, 15, 0, 0, 0), now)).toBe('今日')
  })

  it('昨日（昨晚）', () => {
    expect(bucketOf(at(2026, 4, 14, 23, 0, 0), now)).toBe('昨日')
  })

  it('昨日邊界：剛好昨日本地零時（t === today - 1 日）', () => {
    expect(bucketOf(at(2026, 4, 14, 0, 0, 0), now)).toBe('昨日')
  })

  it('過去 7 日（2 日前）', () => {
    expect(bucketOf(at(2026, 4, 13, 23, 59, 0), now)).toBe('過去 7 日')
  })

  it('過去 7 日邊界：剛好 7 日前本地零時仍屬「過去 7 日」', () => {
    // today - 7*day = 2026-05-08 00:00 本地；>= 命中
    expect(bucketOf(at(2026, 4, 8, 0, 0, 0), now)).toBe('過去 7 日')
  })

  it('更早：8 日前（早過 7 日窗口）', () => {
    expect(bucketOf(at(2026, 4, 7, 23, 0, 0), now)).toBe('更早')
  })

  it('時區健全性：跨年初一本地零時，相對同日 now → 今日（無 UTC off-by-one）', () => {
    const ny = new Date(2026, 0, 1, 12, 0, 0) // 2026-01-01 本地正午
    expect(bucketOf(new Date(2026, 0, 1, 0, 0, 0).toISOString(), ny)).toBe('今日')
  })
})

describe('BUCKET_ORDER', () => {
  it('固定順序：今日 → 昨日 → 過去 7 日 → 更早', () => {
    expect(BUCKET_ORDER).toEqual(['今日', '昨日', '過去 7 日', '更早'])
  })
})

describe('groupByTime（按時間桶分組，保留輸入次序、跳過空桶）', () => {
  const now = new Date(2026, 4, 15, 12, 0, 0)
  const item = (id: string, ...a: [number, number, number, number?, number?, number?]) => ({
    id,
    createdAt: new Date(...a).toISOString(),
  })

  it('空陣列 → 空結果', () => {
    expect(groupByTime([], now)).toEqual([])
  })

  it('只得一個桶有嘢時，唔會出現其他空桶', () => {
    const out = groupByTime([item('a', 2026, 4, 15, 9), item('b', 2026, 4, 15, 10)], now)
    expect(out).toHaveLength(1)
    expect(out[0].bucket).toBe('今日')
    expect(out[0].items.map((i) => i.id)).toEqual(['a', 'b'])
  })

  it('跨多桶：輸出依 BUCKET_ORDER 排，桶內保留原次序', () => {
    const items = [
      item('today1', 2026, 4, 15, 9),
      item('yest1', 2026, 4, 14, 9),
      item('week1', 2026, 4, 12, 9),
      item('today2', 2026, 4, 15, 8),
      item('old1', 2026, 4, 1, 9),
    ]
    const out = groupByTime(items, now)
    expect(out.map((g) => g.bucket)).toEqual(['今日', '昨日', '過去 7 日', '更早'])
    // 桶內保留掃描次序（today1 行先過 today2）
    expect(out[0].items.map((i) => i.id)).toEqual(['today1', 'today2'])
    expect(out[1].items.map((i) => i.id)).toEqual(['yest1'])
    expect(out[2].items.map((i) => i.id)).toEqual(['week1'])
    expect(out[3].items.map((i) => i.id)).toEqual(['old1'])
  })
})

describe('conversationToMarkdown（匯出 Markdown）', () => {
  it('空訊息：得標題 + 匯出時間 header（無訊息區塊）', () => {
    const md = conversationToMarkdown('我的對話', [])
    const lines = md.split('\n')
    expect(lines[0]).toBe('# 我的對話')
    expect(lines[1]).toBe('')
    expect(lines[2].startsWith('_匯出於 ')).toBe(true)
    expect(lines[3]).toBe('')
    // header 之後再無內容
    expect(lines).toHaveLength(4)
  })

  it('user / model 角色用唔同 heading，內容 trim 過', () => {
    const md = conversationToMarkdown('T', [
      { role: 'user', content: '  你好  ' },
      { role: 'model', content: 'Hi there' },
    ])
    expect(md).toContain('### 🙋 我')
    expect(md).toContain('### 🤖 AI')
    // 內容 trim：唔應有前後空白殘留喺自己嗰行
    expect(md).toContain('\n你好\n')
    expect(md).toContain('\nHi there\n')
    // user heading 應行先過 model heading
    expect(md.indexOf('### 🙋 我')).toBeLessThan(md.indexOf('### 🤖 AI'))
  })
})

// ────────────────────────────────────────────────────────────
//  computeStats — 整體統計（14 日分桶 / streak / busiest / 平均）
//  computeStats 內部用 new Date() 取「今日」→ 用 fake timers 鎖死。
//  鎖死「今日」= 2026-05-15 12:00 本地（HKT）。14 日視窗（由舊到新）：
//    index 0  = 2026-05-02（13 日前）
//    …
//    index 13 = 2026-05-15（今日）
//  訊息時間統一用「本地 Date → toISOString()」明確化瞬間（避 UTC off-by-one），
//  分桶 key 用本地日 component（同 source 一致）。預期值全用第一性原理人手計。
// ────────────────────────────────────────────────────────────
describe('computeStats（整體統計）', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 15, 12, 0, 0)) // 今日 = 2026-05-15 本地
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  let nextId = 0
  const thread = (over: Partial<AiThread> = {}): AiThread => ({
    id: `t${nextId++}`,
    mode: 'learning',
    title: '對話',
    createdAt: new Date(2026, 4, 15, 9).toISOString(),
    ...over,
  })
  // 訊息：用本地日期 component 建構瞬間（同分桶基準一致）
  const msg = (
    role: 'user' | 'model',
    content: string,
    at: [number, number, number, number?, number?, number?],
  ): AiMessage => ({
    id: `m${nextId++}`,
    threadId: 't0',
    role,
    content,
    createdAt: new Date(...at).toISOString(),
  })

  it('空 threads + 空 messages → 全 0 / null，daily 仍 14 格', () => {
    const s = computeStats([], [])
    expect(s.threads).toBe(0)
    expect(s.userMsgs).toBe(0)
    expect(s.modelMsgs).toBe(0)
    expect(s.totalWords).toBe(0)
    expect(s.avgPerThread).toBe(0) // 除零保護：threads = 0 → 0（唔係 NaN）
    expect(s.streak).toBe(0)
    expect(s.busiestDay).toBeNull()
    expect(s.daily).toHaveLength(14)
    expect(s.daily.every((d) => d.count === 0)).toBe(true)
  })

  it('userMsgs / modelMsgs 按 role 分流計數', () => {
    const s = computeStats(
      [],
      [
        msg('user', 'a', [2026, 4, 15, 9]),
        msg('model', 'b', [2026, 4, 15, 9]),
        msg('user', 'c', [2026, 4, 15, 9]),
      ],
    )
    expect(s.userMsgs).toBe(2)
    expect(s.modelMsgs).toBe(1)
  })

  it('totalWords 用 approxWords 累加（中英混合）', () => {
    // "你好 world" → CJK 2 + 詞 1 = 3；"foo bar" → 詞 2；空字串 → 0 → 共 5
    const s = computeStats(
      [],
      [
        msg('user', '你好 world', [2026, 4, 15, 9]),
        msg('model', 'foo bar', [2026, 4, 15, 9]),
        msg('user', '', [2026, 4, 15, 9]),
      ],
    )
    expect(s.totalWords).toBe(5)
  })

  it('avgPerThread = round((user + model) / threads)', () => {
    // 2 threads；user 3 + model 2 = 5 → round(5/2) = round(2.5) = 3（四捨五入）
    const s = computeStats(
      [thread(), thread()],
      [
        msg('user', 'a', [2026, 4, 15, 9]),
        msg('user', 'b', [2026, 4, 15, 9]),
        msg('user', 'c', [2026, 4, 15, 9]),
        msg('model', 'd', [2026, 4, 15, 9]),
        msg('model', 'e', [2026, 4, 15, 9]),
      ],
    )
    expect(s.threads).toBe(2)
    expect(s.avgPerThread).toBe(3)
  })

  it('avgPerThread：threads = 0 但有訊息 → 除零保護回 0', () => {
    const s = computeStats([], [msg('user', 'a', [2026, 4, 15, 9])])
    expect(s.avgPerThread).toBe(0)
  })

  it('daily：固定 14 格、由舊到新、label 為 M/D、key 為零補 YYYY-MM-DD', () => {
    const s = computeStats([], [])
    expect(s.daily).toHaveLength(14)
    // 最舊（index 0）= 13 日前 = 2026-05-02；最新（index 13）= 今日 = 2026-05-15
    expect(s.daily[0].key).toBe('2026-05-02')
    expect(s.daily[0].label).toBe('5/2') // label 唔補零
    expect(s.daily[13].key).toBe('2026-05-15')
    expect(s.daily[13].label).toBe('5/15')
    // key 嚴格遞增（由舊到新）
    const keys = s.daily.map((d) => d.key)
    expect([...keys].sort()).toEqual(keys)
  })

  it('daily：訊息按本地日入對應桶；視窗外（太舊 / 未來）唔入桶', () => {
    const s = computeStats(
      [],
      [
        msg('user', 'today1', [2026, 4, 15, 1]), // 今日（index 13）
        msg('user', 'today2', [2026, 4, 15, 23]), // 今日（同日不同時刻）
        msg('model', 'd02', [2026, 4, 2, 12]), // 最舊一格（index 0）
        msg('user', 'tooOld', [2026, 4, 1, 12]), // 14 日前 → 視窗外
        msg('user', 'future', [2026, 4, 16, 12]), // 明日 → 視窗外
      ],
    )
    expect(s.daily[13].count).toBe(2) // 今日兩條
    expect(s.daily[0].count).toBe(1) // 最舊一格一條
    // 視窗外兩條都唔計入任何桶 → 桶總和 = 3
    expect(s.daily.reduce((a, d) => a + d.count, 0)).toBe(3)
    // 但 userMsgs/modelMsgs 係全量計（唔受 14 日視窗限制）
    expect(s.userMsgs).toBe(4)
    expect(s.modelMsgs).toBe(1)
  })

  it('streak：由今日往回連續有訊息日數', () => {
    // 今日(05-15)、昨日(05-14)、前日(05-13) 各有訊息；05-12 無 → streak = 3
    const s = computeStats(
      [],
      [
        msg('user', 'a', [2026, 4, 15, 9]),
        msg('user', 'b', [2026, 4, 14, 9]),
        msg('user', 'c', [2026, 4, 13, 9]),
        msg('user', 'gap', [2026, 4, 11, 9]), // 05-11（隔咗 05-12）→ 唔續
      ],
    )
    expect(s.streak).toBe(3)
  })

  it('streak：今日無訊息 → 0（即使昨日有）', () => {
    const s = computeStats([], [msg('user', 'a', [2026, 4, 14, 9])]) // 只昨日
    expect(s.streak).toBe(0)
  })

  it('streak：斷一日即止（中段空檔唔算）', () => {
    // 今日有、昨日(05-14)無、前日(05-13)有 → 由今日往回遇到 05-14 = 0 即停 → streak = 1
    const s = computeStats(
      [],
      [msg('user', 'today', [2026, 4, 15, 9]), msg('user', 'old', [2026, 4, 13, 9])],
    )
    expect(s.streak).toBe(1)
  })

  it('busiestDay：取最高 count 嗰日', () => {
    // 05-14 有 3 條（最高）、05-15 有 1 條 → busiest = 05-14
    const s = computeStats(
      [],
      [
        msg('user', 'a', [2026, 4, 15, 9]),
        msg('user', 'b', [2026, 4, 14, 9]),
        msg('model', 'c', [2026, 4, 14, 10]),
        msg('user', 'd', [2026, 4, 14, 11]),
      ],
    )
    expect(s.busiestDay).toEqual({ label: '5/14', count: 3 })
  })

  it('busiestDay：count 相同時取較早嗰日（reduce 用 > 嚴格比較，後來者唔頂替）', () => {
    // 05-13 同 05-15 各 2 條 → 較早嘅 05-13 勝出
    const s = computeStats(
      [],
      [
        msg('user', 'a', [2026, 4, 13, 9]),
        msg('user', 'b', [2026, 4, 13, 10]),
        msg('user', 'c', [2026, 4, 15, 9]),
        msg('user', 'd', [2026, 4, 15, 10]),
      ],
    )
    expect(s.busiestDay).toEqual({ label: '5/13', count: 2 })
  })

  it('busiestDay：全 0（無視窗內訊息）→ null', () => {
    // 唯一訊息喺視窗外 → 所有桶都係 0 → busiest 回 null（非 {count:0}）
    const s = computeStats([], [msg('user', 'x', [2026, 4, 1, 12])])
    expect(s.busiestDay).toBeNull()
  })

  it('threads 計數直接反映 threads 陣列長度（與訊息無關）', () => {
    const s = computeStats([thread(), thread(), thread()], [])
    expect(s.threads).toBe(3)
    expect(s.avgPerThread).toBe(0) // (0+0)/3 = 0
  })
})

describe('safeFilename（過濾非法字元 + 截斷）', () => {
  it('空字串 → fallback "conversation"', () => {
    expect(safeFilename('')).toBe('conversation')
  })

  it('Windows 非法字元全部換成底線', () => {
    // \ / : * ? " < > | 全部 → _
    expect(safeFilename('a\\b/c:d*e?f"g<h>i|j')).toBe('a_b_c_d_e_f_g_h_i_j')
  })

  it('正常檔名保持不變', () => {
    expect(safeFilename('我的對話 2026-05-31')).toBe('我的對話 2026-05-31')
  })

  it('截斷至 60 字', () => {
    const long = 'x'.repeat(100)
    expect(safeFilename(long)).toBe('x'.repeat(60))
    expect(safeFilename(long).length).toBe(60)
  })
})
