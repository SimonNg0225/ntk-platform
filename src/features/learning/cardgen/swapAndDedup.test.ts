import { describe, it, expect } from 'vitest'
import { swapAllDrafts, dropExactDuplicates } from '../CardGenerator'
import type { DraftCard } from './types'

// ============================================================
//  swapAllDrafts / dropExactDuplicates：草稿工作室兩個工具列操作
//  ------------------------------------------------------------
//  ① swapAllDrafts —— 一鍵全部前後互換：逐張 front ⇄ back 對調，
//     同單卡 swap 一致（只動 front/back，其餘欄位原封不動）。
//     front === back 嗰張係 no-op（保留原 object ref）；全部 no-op
//     或空陣列 → 原樣回傳同一 array ref（changed guard，慳 re-render）。
//  ② dropExactDuplicates —— 去除完全重複草稿：front + back 各自 trim
//     後完全一樣只留最先出現嗰張，補既有「去重」只睇 normFront 嘅不足。
//     維持原本次序；冇重複 → 同一 array ref。
//  兩者皆純函式（畀 handler + 測試共用），無依賴時鐘 / collection 狀態。
// ============================================================

let seq = 0
function draft(
  front: string,
  back: string,
  over: Partial<DraftCard> = {},
): DraftCard {
  seq += 1
  return {
    id: 'd' + seq,
    type: 'qa',
    front,
    back,
    tags: [],
    include: true,
    flipped: false,
    dup: false,
    ...over,
  }
}

describe('swapAllDrafts', () => {
  it('空草稿 → 原樣回傳同一 ref', () => {
    const ds: DraftCard[] = []
    expect(swapAllDrafts(ds)).toBe(ds)
  })

  it('單張：front ⇄ back 對調', () => {
    const ds = [draft('正面', '背面')]
    const next = swapAllDrafts(ds)
    expect(next[0].front).toBe('背面')
    expect(next[0].back).toBe('正面')
  })

  it('多張全部對調', () => {
    const ds = [draft('Q1', 'A1'), draft('Q2', 'A2'), draft('Q3', 'A3')]
    const next = swapAllDrafts(ds)
    expect(next.map((d) => [d.front, d.back])).toEqual([
      ['A1', 'Q1'],
      ['A2', 'Q2'],
      ['A3', 'Q3'],
    ])
  })

  it('只動 front/back，其餘欄位（id/type/tags/include/flipped/dup）原封不動', () => {
    const ds = [
      draft('問', '答', {
        id: 'keep',
        type: 'term',
        tags: ['t1', 't2'],
        include: false,
        flipped: true,
        dup: true,
      }),
    ]
    const next = swapAllDrafts(ds)
    const d = next[0]
    expect(d.front).toBe('答')
    expect(d.back).toBe('問')
    expect(d.id).toBe('keep')
    expect(d.type).toBe('term')
    expect(d.tags).toEqual(['t1', 't2'])
    expect(d.include).toBe(false)
    expect(d.flipped).toBe(true)
    expect(d.dup).toBe(true)
  })

  it('對調有變化 → 回新 array（唔係同一 ref）', () => {
    const ds = [draft('A', 'B')]
    expect(swapAllDrafts(ds)).not.toBe(ds)
  })

  it('front === back 嗰張係 no-op → 保留原 object ref', () => {
    const same = draft('一樣', '一樣')
    const diff = draft('Q', 'A')
    const next = swapAllDrafts([same, diff])
    expect(next[0]).toBe(same) // 無變化 → 同一 object
    expect(next[1]).not.toBe(diff) // 有變化 → 新 object
    expect(next[1].front).toBe('A')
  })

  it('全部 front === back（全 no-op）→ 原樣回傳同一 array ref（changed guard）', () => {
    const ds = [draft('x', 'x'), draft('y', 'y')]
    expect(swapAllDrafts(ds)).toBe(ds)
  })

  it('兩次互換 = 還原（front/back 轉返原狀）', () => {
    const ds = [draft('正面', '背面'), draft('Q', 'A')]
    const once = swapAllDrafts(ds)
    const twice = swapAllDrafts(once)
    expect(twice.map((d) => [d.front, d.back])).toEqual([
      ['正面', '背面'],
      ['Q', 'A'],
    ])
  })

  it('唔會原地改動入參（回新陣列、入參逐張不變）', () => {
    const ds = [draft('A', 'B')]
    const snapshot = { front: ds[0].front, back: ds[0].back }
    swapAllDrafts(ds)
    expect(ds[0].front).toBe(snapshot.front)
    expect(ds[0].back).toBe(snapshot.back)
  })
})

describe('dropExactDuplicates', () => {
  it('空草稿 → 原樣回傳同一 ref', () => {
    const ds: DraftCard[] = []
    expect(dropExactDuplicates(ds)).toBe(ds)
  })

  it('單張 → 原樣回傳同一 ref（少於 2 張無得重複）', () => {
    const ds = [draft('Q', 'A')]
    expect(dropExactDuplicates(ds)).toBe(ds)
  })

  it('front + back 都完全一樣 → 只留第一張', () => {
    const ds = [draft('Q', 'A', { id: 'first' }), draft('Q', 'A', { id: 'dup' })]
    const next = dropExactDuplicates(ds)
    expect(next).toHaveLength(1)
    expect(next[0].id).toBe('first')
  })

  it('front 一樣但 back 唔同 → 兩張都保留（唔係完全相同）', () => {
    const ds = [draft('Q', 'A1'), draft('Q', 'A2')]
    expect(dropExactDuplicates(ds)).toHaveLength(2)
  })

  it('back 一樣但 front 唔同 → 兩張都保留', () => {
    const ds = [draft('Q1', 'A'), draft('Q2', 'A')]
    expect(dropExactDuplicates(ds)).toHaveLength(2)
  })

  it('多張重複只保留各自最先出現嗰張，維持原次序', () => {
    const ds = [
      draft('B', 'b', { id: 'b1' }),
      draft('A', 'a', { id: 'a1' }),
      draft('B', 'b', { id: 'b2' }),
      draft('A', 'a', { id: 'a2' }),
      draft('C', 'c', { id: 'c1' }),
    ]
    const next = dropExactDuplicates(ds)
    expect(next.map((d) => d.id)).toEqual(['b1', 'a1', 'c1'])
  })

  it('前後空白差異 trim 後當完全相同（只留第一張）', () => {
    const ds = [
      draft('  Q  ', 'A', { id: 'first' }),
      draft('Q', '  A  ', { id: 'dup' }),
    ]
    const next = dropExactDuplicates(ds)
    expect(next).toHaveLength(1)
    expect(next[0].id).toBe('first')
  })

  it('唔會把 front/back 邊界錯配（"a"+"b c" vs "a b"+"c" 唔當重複）', () => {
    // key 用空白分隔，但兩邊都 trim，故 "a"|"b c" 同 "a b"|"c" 唔同 key
    const ds = [draft('a', 'b c'), draft('a b', 'c')]
    expect(dropExactDuplicates(ds)).toHaveLength(2)
  })

  it('保留嗰張係原 object ref（無 clone）', () => {
    const first = draft('Q', 'A')
    const dup = draft('Q', 'A')
    const next = dropExactDuplicates([first, dup])
    expect(next[0]).toBe(first)
  })

  it('冇任何重複 → 原樣回傳同一 array ref（changed guard）', () => {
    const ds = [draft('Q1', 'A1'), draft('Q2', 'A2'), draft('Q3', 'A3')]
    expect(dropExactDuplicates(ds)).toBe(ds)
  })

  it('全部三張完全一樣 → 只剩一張', () => {
    const ds = [draft('X', 'Y'), draft('X', 'Y'), draft('X', 'Y')]
    expect(dropExactDuplicates(ds)).toHaveLength(1)
  })

  it('唔會原地改動入參（回新陣列、入參長度不變）', () => {
    const ds = [draft('Q', 'A'), draft('Q', 'A')]
    dropExactDuplicates(ds)
    expect(ds).toHaveLength(2)
  })
})
