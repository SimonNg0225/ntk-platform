import { describe, it, expect } from 'vitest'
import { recomputeDup, normFront } from '../CardGenerator'
import type { DraftCard } from './types'

// ============================================================
//  recomputeDup：草稿 dup（重複）旗標重算
//  ------------------------------------------------------------
//  之前 bug：重算 dup 嘅 useEffect 只依賴 [targetFronts]，inline 編輯 /
//  swap / regenOne 改咗 front 之後 dup 唔會重算 → 「相似卡」警告 +
//  dupCount + 黃框同實際 front 脫節。修復把純邏輯抽成 recomputeDup
//  (effect + 測試共用)，effect 加埋 draftFronts 簽名做依賴。
//
//  本檔鎖死：① 撞目標牌組命中 ② 草稿之間互撞（seen-set，有次序）
//  ③ 編輯入撞 / 編輯走離撞 / swap 撞 都正確翻 flag ④ changed guard
//  （冇 flag 反轉回傳同一 array ref，保證 effect 唔會多餘 re-render）。
// ============================================================

let seq = 0
function draft(front: string, dup = false, over: Partial<DraftCard> = {}): DraftCard {
  seq += 1
  return {
    id: 'd' + seq,
    type: 'qa',
    front,
    back: 'back',
    tags: [],
    include: true,
    flipped: false,
    dup,
    ...over,
  }
}

const fronts = (s: string[]) => new Set(s.map(normFront))

describe('recomputeDup', () => {
  it('空草稿 → 原樣回傳同一 ref', () => {
    const ds: DraftCard[] = []
    expect(recomputeDup(ds, fronts(['x']))).toBe(ds)
  })

  it('撞目標牌組現有 front → dup = true', () => {
    const ds = [draft('What is AI?', false)]
    const next = recomputeDup(ds, fronts(['what is ai']))
    expect(next[0].dup).toBe(true)
  })

  it('唔撞 → dup = false（且 dup 本來就 false 時回傳同一 ref）', () => {
    const ds = [draft('全新題目', false)]
    const next = recomputeDup(ds, fronts(['其他卡']))
    expect(next[0].dup).toBe(false)
    expect(next).toBe(ds) // 冇 flag 反轉 → 同一 array ref（effect 短路）
  })

  it('兩張草稿正規化後相同 → 第二張當重複（seen-set，有次序）', () => {
    const ds = [draft('Hello, World', false), draft('hello world', false)]
    const next = recomputeDup(ds, fronts([]))
    expect(next[0].dup).toBe(false)
    expect(next[1].dup).toBe(true)
  })

  // ── 核心 bug 場景：front 改咗之後要重算 ──────────────────────
  it('編輯「入」撞：原本唔重複，front 改到撞目標牌組 → dup 由 false 翻 true', () => {
    const target = fronts(['市場營銷4p'])
    const before = [draft('隨便一題', false)]
    expect(recomputeDup(before, target)[0].dup).toBe(false)

    // 模擬 inline 編輯：front 改到撞目標牌組
    const edited = [{ ...before[0], front: '市場營銷 4P' }]
    const after = recomputeDup(edited, target)
    expect(after[0].dup).toBe(true)
  })

  it('編輯「走離」撞：原本判重複，front 改走 → dup 由 true 清返 false', () => {
    const target = fronts(['what is ai'])
    // 原本被判重複（dup 已係 true，模擬上一輪 effect 算出嘅 stale 狀態）
    const before = [draft('What is AI?', true)]
    const edited = [{ ...before[0], front: '一條全新嘅問題' }]
    const after = recomputeDup(edited, target)
    expect(after[0].dup).toBe(false)
  })

  it('swap（前後互換）令 front 變到撞 → dup 翻 true', () => {
    const target = fronts(['paris'])
    // swap 前 front = 「法國首都」唔撞；swap 係 { front: back, back: front }
    const beforeSwap = [draft('法國首都', false, { back: 'Paris' })]
    expect(recomputeDup(beforeSwap, target)[0].dup).toBe(false)

    const swapped = [
      { ...beforeSwap[0], front: beforeSwap[0].back, back: beforeSwap[0].front },
    ]
    expect(swapped[0].front).toBe('Paris')
    expect(recomputeDup(swapped, target)[0].dup).toBe(true)
  })

  it('regenOne 換新 front 解走撞 → dup 由 true 清返 false', () => {
    const target = fronts(['old question'])
    const before = [draft('Old question', true)]
    // regenOne：patchDraft 改 front/back
    const regenned = [{ ...before[0], front: 'A brand new question' }]
    expect(recomputeDup(regenned, target)[0].dup).toBe(false)
  })

  it('多張：部分翻 flag 時只 clone 改動嗰張，未變嗰張保留原 object ref', () => {
    const a = draft('卡A', false)
    const b = draft('卡B', false)
    const next = recomputeDup([a, b], fronts(['卡b']))
    expect(next[0]).toBe(a) // 卡A 冇變 → 同一 object
    expect(next[1]).not.toBe(b) // 卡B 翻 true → 新 object
    expect(next[1].dup).toBe(true)
  })

  it('changed guard：所有 flag 已係正確值 → 回傳同一 array ref（唔會觸發 re-render）', () => {
    const ds = [draft('撞嘅卡', true), draft('唔撞嘅卡', false)]
    const next = recomputeDup(ds, fronts(['撞嘅卡']))
    expect(next).toBe(ds)
  })
})
