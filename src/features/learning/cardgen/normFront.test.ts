import { describe, it, expect } from 'vitest'
import { normFront } from '../CardGenerator'

// ============================================================
//  normFront：去重比對用嘅正面正規化
//  ------------------------------------------------------------
//  toLowerCase + 去除 [空白 / 中英標點 / 底線 / 連字號 / 全形底線] + trim。
//  決定草稿 dup 旗標 / dupCount，計錯會誤判重複。
//  （normFront 喺 CardGenerator.tsx 為 top-level 純函式，已加 export。）
// ============================================================

describe('normFront', () => {
  it('空字串 → 空字串', () => {
    expect(normFront('')).toBe('')
  })

  it('純空白 → 空字串', () => {
    expect(normFront('   \t \n ')).toBe('')
  })

  it('純標點 → 空字串', () => {
    expect(normFront('，。？！；：「」【】（）')).toBe('')
  })

  it('純標點（半形）→ 空字串', () => {
    expect(normFront('.,?!;:()')).toBe('')
  })

  it('大小寫差異：Hello vs hello 視為同一', () => {
    expect(normFront('Hello')).toBe('hello')
    expect(normFront('HELLO')).toBe('hello')
    expect(normFront('Hello')).toBe(normFront('hello'))
  })

  it('前後空白去掉', () => {
    expect(normFront('  abc  ')).toBe('abc')
  })

  it('中間空白去掉', () => {
    expect(normFront('a b c')).toBe('abc')
  })

  it('中文標點（，。？！；：「」【】）去掉', () => {
    expect(normFront('你好，世界。')).toBe('你好世界')
    expect(normFront('問題？答案！')).toBe('問題答案')
  })

  it('全形 vs 半形括號都去掉，結果相同', () => {
    expect(normFront('（abc）')).toBe('abc')
    expect(normFront('(abc)')).toBe('abc')
    expect(normFront('（abc）')).toBe(normFront('(abc)'))
  })

  it('底線去掉', () => {
    expect(normFront('a_b_c')).toBe('abc')
  })

  it('全形底線 ＿ 去掉（填空題幹常見）', () => {
    expect(normFront('答案係＿＿＿＿')).toBe('答案係')
  })

  it('中間連字號 a-b-c → abc', () => {
    expect(normFront('a-b-c')).toBe('abc')
  })

  it('em-dash — 去掉', () => {
    expect(normFront('正確 — 解釋')).toBe('正確解釋')
  })

  it('字元類 [】()…—＿] 唔會意外組成範圍吃掉其他字元（保留中英數字）', () => {
    // 若 \- 冇正確跳脫，可能組成範圍誤刪字元。確認字母/數字/中文都保留。
    expect(normFront('Test123中文')).toBe('test123中文')
    // 介乎被刪字元 ASCII 碼之間嘅字母（如 ] 0x5D、_ 0x5F 中間嘅 ^ 0x5E）
    expect(normFront('a^b')).toBe('a^b')
  })

  it('混合：大小寫 + 空白 + 中英標點 + 底線 + 連字號 一次過正規化', () => {
    expect(normFront('  Hello, 世界！_test-123  ')).toBe('hello世界test123')
  })

  it('兩個只差標點/空白/大小寫嘅 front 正規化後相同（重複偵測命中）', () => {
    expect(normFront('What is AI?')).toBe(normFront('what is ai'))
    expect(normFront('市場營銷 4P')).toBe(normFront('市場營銷4P'.toLowerCase()))
  })

  it('純標點兩張都得空字串（會被當重複，鎖住呢個行為）', () => {
    expect(normFront('！！！')).toBe('')
    expect(normFront('...')).toBe('')
    expect(normFront('！！！')).toBe(normFront('...'))
  })

  it('反引號 ` 去掉', () => {
    expect(normFront('`code`')).toBe('code')
  })

  it('單雙引號去掉', () => {
    expect(normFront('"quote\'s"')).toBe('quotes')
  })
})
