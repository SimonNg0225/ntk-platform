import { describe, it, expect } from 'vitest'
import { stripJsonFence, parseJsonArray, extractJsonArray } from './aiJson'

// ============================================================
//  aiJson 純函式測試
//  ------------------------------------------------------------
//  全部預期值由「第一性原理」人手推導（非反推 code）：
//    stripJsonFence  — trim → 剝開頭 ```lang\n → 剝結尾 \n``` → trim
//    parseJsonArray  — 去 fence 後 JSON.parse；唔係 Array 回 null；
//                       失敗則抽第一個 '[' 至最後一個 ']' 再試。
//    extractJsonArray— 同上，但 null 時改 throw 友善 Error。
// ============================================================

describe('stripJsonFence', () => {
  it('純陣列字串：無 fence 原樣（已 trim）回傳', () => {
    expect(stripJsonFence('[1,2,3]')).toBe('[1,2,3]')
  })

  it('前後空白被 trim', () => {
    expect(stripJsonFence('   [1,2,3]   ')).toBe('[1,2,3]')
  })

  it('剝走 ```json … ``` fence', () => {
    expect(stripJsonFence('```json\n[1,2,3]\n```')).toBe('[1,2,3]')
  })

  it('剝走無語言標籤嘅 ``` … ``` fence', () => {
    expect(stripJsonFence('```\n[1,2]\n```')).toBe('[1,2]')
  })

  it('語言標籤大細階皆可（```JSON）', () => {
    expect(stripJsonFence('```JSON\n[1]\n```')).toBe('[1]')
  })

  it('CRLF（\\r\\n）換行嘅 fence 亦正確剝走', () => {
    // trim 唔會郁中間；\s* 會食埋 \r\n，結尾 \r``` 由 \n? + ``` 之後 trim 清走
    expect(stripJsonFence('```json\r\n[1,2]\r\n```')).toBe('[1,2]')
  })

  it('多行 pretty-print JSON 內部換行保留', () => {
    const input = '```json\n[\n  {"q": "1+1"}\n]\n```'
    expect(stripJsonFence(input)).toBe('[\n  {"q": "1+1"}\n]')
  })

  it('結尾 fence 後仲有空白都清乾淨', () => {
    expect(stripJsonFence('```json\n[1,2]\n```   ')).toBe('[1,2]')
  })

  it('開頭有空白行先至 fence：trim 後照剝', () => {
    expect(stripJsonFence('\n\n```json\n[1]\n```')).toBe('[1]')
  })

  // ---- edge：空輸入 / 純空白 / 淨係 fence ----
  it('空字串回空字串', () => {
    expect(stripJsonFence('')).toBe('')
  })

  it('純空白回空字串', () => {
    expect(stripJsonFence('   \n  \t ')).toBe('')
  })

  it('淨係一個 ``` fence 回空字串', () => {
    expect(stripJsonFence('```')).toBe('')
  })

  it('行內 backtick（唔喺開頭/結尾）唔當 fence、原樣保留', () => {
    expect(stripJsonFence('use `x` here')).toBe('use `x` here')
  })

  it('只有開頭 fence、無結尾 fence（截斷輸出）：剝開頭、餘下保留', () => {
    expect(stripJsonFence('```json\n[1,2,3]')).toBe('[1,2,3]')
  })
})

describe('parseJsonArray — 正常路徑', () => {
  it('純陣列', () => {
    expect(parseJsonArray('[1,2,3]')).toEqual([1, 2, 3])
  })

  it('fence 包住嘅陣列', () => {
    expect(parseJsonArray('```json\n[1,2,3]\n```')).toEqual([1, 2, 3])
  })

  it('物件陣列（多行 pretty）', () => {
    const raw = '```json\n[\n  {"q": "1+1", "a": "2"},\n  {"q": "2+2", "a": "4"}\n]\n```'
    expect(parseJsonArray(raw)).toEqual([
      { q: '1+1', a: '2' },
      { q: '2+2', a: '4' },
    ])
  })

  it('巢狀陣列', () => {
    expect(parseJsonArray('[[1,2],[3,4]]')).toEqual([
      [1, 2],
      [3, 4],
    ])
  })

  it('深層巢狀', () => {
    expect(parseJsonArray('[[[1]]]')).toEqual([[[1]]])
  })

  it('Unicode 元素', () => {
    expect(parseJsonArray('["數","學"]')).toEqual(['數', '學'])
  })

  it('陣列元素內含 "]" 字串時（direct parse 成功，唔行錯 fallback）', () => {
    expect(parseJsonArray('[{"s":"a]b"}]')).toEqual([{ s: 'a]b' }])
  })
})

describe('parseJsonArray — fallback（抽第一個 [ 至最後一個 ]）', () => {
  it('前面有解說文字 + fenced 陣列', () => {
    const raw = '當然！以下係卡片：\n```json\n["卡一","卡二"]\n```'
    expect(parseJsonArray(raw)).toEqual(['卡一', '卡二'])
  })

  it('陣列前後皆有解說文字（無 fence）', () => {
    expect(parseJsonArray('Here:\n[1, 2, 3]\nDone')).toEqual([1, 2, 3])
  })

  it('前解說 + fence + 後解說（結尾 fence 唔喺末，靠 fallback 救）', () => {
    const raw =
      'Here is the JSON you requested:\n```json\n[{"q":"1+1","a":"2"}]\n```\nLet me know if you need more!'
    expect(parseJsonArray(raw)).toEqual([{ q: '1+1', a: '2' }])
  })

  it('物件入面包住陣列：fallback 會抽到內層陣列', () => {
    // 設計如此：先 direct parse 失敗（頂層唔係 array），再抽 [ … ]
    expect(parseJsonArray('{"items":[1,2,3]}')).toEqual([1, 2, 3])
  })
})

describe('parseJsonArray — edge / 回 null', () => {
  it('空字串回 null', () => {
    expect(parseJsonArray('')).toBeNull()
  })

  it('純空白回 null', () => {
    expect(parseJsonArray('   ')).toBeNull()
  })

  it('頂層係物件（非陣列）且無可抽陣列：回 null', () => {
    expect(parseJsonArray('{"a":1}')).toBeNull()
  })

  it('頂層係數字：回 null', () => {
    expect(parseJsonArray('42')).toBeNull()
  })

  it('JSON null 字面值：回 null', () => {
    expect(parseJsonArray('null')).toBeNull()
  })

  it('完全唔係 JSON：回 null', () => {
    expect(parseJsonArray('not json at all')).toBeNull()
  })

  it('截斷陣列（冇收 "]"）：回 null', () => {
    expect(parseJsonArray('[1,2,3')).toBeNull()
  })

  it('非法 JSON（trailing comma）：回 null', () => {
    expect(parseJsonArray('[1,2,]')).toBeNull()
  })

  // ---- 邊界：空陣列係合法且 truthy，必須照回 [] ----
  it('空陣列 [] 回 []（唔可以當 falsy 漏掉）', () => {
    expect(parseJsonArray('[]')).toEqual([])
  })

  it('fence 包住嘅空陣列回 []', () => {
    expect(parseJsonArray('```json\n[]\n```')).toEqual([])
  })
})

describe('extractJsonArray — 成功回陣列、失敗 throw', () => {
  it('合法輸入回陣列', () => {
    expect(extractJsonArray('[1,2,3]')).toEqual([1, 2, 3])
  })

  it('fenced 輸入回陣列', () => {
    expect(extractJsonArray('```json\n["a","b"]\n```')).toEqual(['a', 'b'])
  })

  it('空陣列 [] 回 []（唔 throw）', () => {
    expect(extractJsonArray('[]')).toEqual([])
  })

  it('空字串 throw 友善中文 Error', () => {
    expect(() => extractJsonArray('')).toThrow('AI 回應唔係有效 JSON，請再試一次。')
  })

  it('非陣列 JSON throw', () => {
    expect(() => extractJsonArray('{"a":1}')).toThrow()
  })

  it('完全唔係 JSON throw', () => {
    expect(() => extractJsonArray('garbage')).toThrow()
  })
})
