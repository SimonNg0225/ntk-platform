import { describe, it, expect } from 'vitest'
import {
  approxWords,
  approxTokens,
  bucketOf,
  groupByTime,
  BUCKET_ORDER,
  conversationToMarkdown,
  safeFilename,
} from './util'

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
