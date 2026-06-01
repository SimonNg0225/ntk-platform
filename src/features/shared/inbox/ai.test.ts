// ============================================================
//  aiTriage — Inbox AI 批量分類「回應後驗證 / 清洗迴圈」測試
//  ------------------------------------------------------------
//  aiTriage 唯一 async 依賴係 complete()（src/lib/aiClient）。
//  aiClient 嘅 import chain（→ supabase → import.meta.env）喺 node
//  測試環境會炸，故必須 vi.mock 整個 aiClient，餵固定 raw 字串。
//  本檔聚焦 source line 58-73 嘅落地邏輯（驗證 + 清洗），預期值
//  全部由第一性原理人手推導（非反推 code）：
//    收 r 當且僅當 r 真值 && typeof i==='number' && 0<=i<texts.length
//      && VALID(6 個 kind).includes(kind)；其餘整條丟棄。
//    why：係 string 就 slice(0,20)，否則 ''。
//    parseJsonArray 回 null（raw 唔係 JSON）→ throw 友善中文 Error。
//    重複 i：Map.set 後者覆蓋前者。
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

// 第一個 vi.mock aiClient 嘅 test：用 factory 回一個可控 complete spy。
// （hoist 安全：factory 內部唔引用任何外層變數。）
vi.mock('../../../lib/aiClient', () => ({
  complete: vi.fn(),
}))

import { aiTriage } from './ai'
import { complete } from '../../../lib/aiClient'

// 將 mock 過嘅 complete 收窄成 spy 型別，方便逐 test 設定回應。
const completeMock = vi.mocked(complete)

// 每個 test 餵一段「raw 字串」即 AI 原始回應（aiTriage 內部會交畀
// parseJsonArray 處理）。helper：直接餵 JSON.stringify 過嘅陣列。
const mockRawArray = (arr: unknown[]) =>
  completeMock.mockResolvedValueOnce(JSON.stringify(arr))

beforeEach(() => {
  completeMock.mockReset()
})

describe('aiTriage — 合法陣列正確映射 index → {kind, why}', () => {
  it('多條合法項目：Map 逐條映射，key = i', async () => {
    mockRawArray([
      { i: 0, kind: 'task', why: '要批改' },
      { i: 1, kind: 'event', why: '有日期' },
      { i: 2, kind: 'reference', why: '純連結' },
    ])
    const out = await aiTriage(['批改功課', '下週開會', 'https://x.com'])
    expect(out.size).toBe(3)
    expect(out.get(0)).toEqual({ kind: 'task', why: '要批改' })
    expect(out.get(1)).toEqual({ kind: 'event', why: '有日期' })
    expect(out.get(2)).toEqual({ kind: 'reference', why: '純連結' })
  })

  it('全部 6 個 VALID kind 都收得（union 全分支）', async () => {
    const kinds = ['task', 'note', 'event', 'question', 'countdown', 'reference']
    mockRawArray(kinds.map((kind, i) => ({ i, kind, why: 'ok' })))
    const out = await aiTriage(kinds.map((_, i) => `項目 ${i}`))
    expect(out.size).toBe(6)
    for (let i = 0; i < kinds.length; i++) {
      expect(out.get(i)?.kind).toBe(kinds[i])
    }
  })

  it('回空陣列：回空 Map（唔 throw）', async () => {
    mockRawArray([])
    const out = await aiTriage(['任意'])
    expect(out.size).toBe(0)
  })

  it('傳畀 complete 嘅 system / messages 帶住索引化內容', async () => {
    mockRawArray([{ i: 0, kind: 'note', why: 'x' }])
    await aiTriage(['第一條', '第二條'])
    expect(completeMock).toHaveBeenCalledTimes(1)
    const opts = completeMock.mock.calls[0][0]
    expect(opts.system).toContain('GTD')
    // 索引化：每條前面有「<i>. 」前綴
    expect(opts.messages[0].content).toContain('0. 第一條')
    expect(opts.messages[0].content).toContain('1. 第二條')
  })

  it('signal 透傳畀 complete', async () => {
    mockRawArray([])
    const ctrl = new AbortController()
    await aiTriage(['x'], ctrl.signal)
    expect(completeMock.mock.calls[0][0].signal).toBe(ctrl.signal)
  })
})

describe('aiTriage — i 越界 / 負數 / 非 number → 該條丟棄', () => {
  it('i >= texts.length：丟棄（上界用 input texts.length，非陣列長度）', async () => {
    // texts 得 2 條（index 0,1）；i=2 越界 → 丟。i=0 合法保留。
    mockRawArray([
      { i: 0, kind: 'task', why: 'keep' },
      { i: 2, kind: 'task', why: 'drop' },
    ])
    const out = await aiTriage(['a', 'b'])
    expect(out.size).toBe(1)
    expect(out.has(0)).toBe(true)
    expect(out.has(2)).toBe(false)
  })

  it('i 為負數：丟棄', async () => {
    mockRawArray([{ i: -1, kind: 'task', why: 'x' }])
    const out = await aiTriage(['a', 'b'])
    expect(out.size).toBe(0)
  })

  it('i 為字串（typeof !== number）：丟棄', async () => {
    // '0' 雖然 < length（弱比較會過），但 typeof 'string' → 丟。
    mockRawArray([{ i: '0', kind: 'task', why: 'x' }])
    const out = await aiTriage(['a', 'b'])
    expect(out.size).toBe(0)
  })

  it('i 缺欠（undefined）：丟棄', async () => {
    mockRawArray([{ kind: 'task', why: 'x' }])
    const out = await aiTriage(['a'])
    expect(out.size).toBe(0)
  })

  it('元素為 null：丟棄（r 真值守門）', async () => {
    mockRawArray([null, { i: 0, kind: 'note', why: 'ok' }])
    const out = await aiTriage(['a'])
    expect(out.size).toBe(1)
    expect(out.get(0)?.kind).toBe('note')
  })

  it('i = texts.length（剛好出界，因為 < 非 <=）：丟棄', async () => {
    // 邊界守護：length=1 → 合法 index 只有 0；i=1 應丟。
    mockRawArray([{ i: 1, kind: 'task', why: 'x' }])
    const out = await aiTriage(['only'])
    expect(out.size).toBe(0)
  })
})

describe('aiTriage — kind 唔喺 VALID 6 個之列 → 丟棄', () => {
  it("kind = 'spam'（非法）：丟棄", async () => {
    mockRawArray([
      { i: 0, kind: 'spam', why: 'x' },
      { i: 1, kind: 'note', why: 'ok' },
    ])
    const out = await aiTriage(['a', 'b'])
    expect(out.size).toBe(1)
    expect(out.has(0)).toBe(false)
    expect(out.get(1)?.kind).toBe('note')
  })

  it('kind 大細階敏感：「Task」（大階 T）非法 → 丟棄', async () => {
    mockRawArray([{ i: 0, kind: 'Task', why: 'x' }])
    const out = await aiTriage(['a'])
    expect(out.size).toBe(0)
  })

  it('kind 缺欠 / 非字串：丟棄', async () => {
    mockRawArray([
      { i: 0, why: 'no kind' },
      { i: 1, kind: 123, why: 'num kind' },
    ])
    const out = await aiTriage(['a', 'b'])
    expect(out.size).toBe(0)
  })
})

describe('aiTriage — why 清洗', () => {
  it('why 非字串（number）→ 回空字串 ""（kind 仍收）', async () => {
    mockRawArray([{ i: 0, kind: 'task', why: 999 }])
    const out = await aiTriage(['a'])
    expect(out.get(0)).toEqual({ kind: 'task', why: '' })
  })

  it('why 缺欠（undefined）→ 回空字串 ""', async () => {
    mockRawArray([{ i: 0, kind: 'task' }])
    const out = await aiTriage(['a'])
    expect(out.get(0)?.why).toBe('')
  })

  it('why 為 null → 回空字串 ""', async () => {
    mockRawArray([{ i: 0, kind: 'note', why: null }])
    const out = await aiTriage(['a'])
    expect(out.get(0)?.why).toBe('')
  })

  it('why 過長 → slice 到頭 20 字', async () => {
    // 25 個字 → 取頭 20。
    const long = '一二三四五六七八九十一二三四五六七八九十一二三四五'
    expect(long.length).toBe(25)
    mockRawArray([{ i: 0, kind: 'question', why: long }])
    const out = await aiTriage(['a'])
    expect(out.get(0)?.why).toBe(long.slice(0, 20))
    expect(out.get(0)?.why.length).toBe(20)
  })

  it('why 啱 20 字（邊界）：原樣保留', async () => {
    const exactly20 = '一二三四五六七八九十一二三四五六七八九十'
    expect(exactly20.length).toBe(20)
    mockRawArray([{ i: 0, kind: 'note', why: exactly20 }])
    const out = await aiTriage(['a'])
    expect(out.get(0)?.why).toBe(exactly20)
  })

  it('why 為空字串：原樣保留 ""（係 string，唔當缺欠）', async () => {
    mockRawArray([{ i: 0, kind: 'note', why: '' }])
    const out = await aiTriage(['a'])
    expect(out.get(0)).toEqual({ kind: 'note', why: '' })
  })
})

describe('aiTriage — 重複 i：後者覆蓋前者（Map.set 語意）', () => {
  it('同一 i 出現兩次：保留陣列較後嗰個', async () => {
    mockRawArray([
      { i: 0, kind: 'task', why: '先' },
      { i: 0, kind: 'note', why: '後' },
    ])
    const out = await aiTriage(['a'])
    expect(out.size).toBe(1)
    expect(out.get(0)).toEqual({ kind: 'note', why: '後' })
  })

  it('重複 i 但後者非法：非法嗰個唔覆蓋，保留先前合法值', async () => {
    // 後者 kind 非法 → 連 set 都唔行 → 前者合法值留低。
    mockRawArray([
      { i: 0, kind: 'task', why: '合法先' },
      { i: 0, kind: 'spam', why: '非法後' },
    ])
    const out = await aiTriage(['a'])
    expect(out.size).toBe(1)
    expect(out.get(0)).toEqual({ kind: 'task', why: '合法先' })
  })
})

describe('aiTriage — parse 失敗 → throw 友善中文 Error', () => {
  it('raw 唔係 JSON（parseJsonArray 回 null）：throw 友善 message', async () => {
    completeMock.mockResolvedValueOnce('我幫你分類好喇！不過唔係 JSON 格式 🙂')
    await expect(aiTriage(['a'])).rejects.toThrow('AI 回應唔係有效 JSON，請再試一次。')
  })

  it('raw 係 JSON object（非陣列）：parseJsonArray 回 null → throw', async () => {
    // parseJsonArray 只收 Array；object 會回 null。
    completeMock.mockResolvedValueOnce('{"i":0,"kind":"task"}')
    await expect(aiTriage(['a'])).rejects.toThrow('AI 回應唔係有效 JSON')
  })

  it('raw 空字串：parseJsonArray 回 null → throw', async () => {
    completeMock.mockResolvedValueOnce('')
    await expect(aiTriage(['a'])).rejects.toThrow('AI 回應唔係有效 JSON')
  })

  it('raw 帶 ```json fence 包住合法陣列：仍 parse 得（經 stripJsonFence）', async () => {
    completeMock.mockResolvedValueOnce('```json\n[{"i":0,"kind":"task","why":"x"}]\n```')
    const out = await aiTriage(['a'])
    expect(out.get(0)).toEqual({ kind: 'task', why: 'x' })
  })
})
