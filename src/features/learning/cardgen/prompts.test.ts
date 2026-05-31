import { describe, it, expect } from 'vitest'
import { assembleDraft, buildUserPrompt } from './prompts'
import type { RawCard } from './types'

// ============================================================
//  assembleDraft：RawCard → { front, back } 轉換 + 驗證
//  ------------------------------------------------------------
//  逐卡型（qa / term / cloze / tf）覆蓋正常 + 全部邊界。
//  斷言用具體字串，唔用 toBeTruthy。
// ============================================================

describe('assembleDraft — qa', () => {
  it('正常：trim front/back 後原樣回', () => {
    expect(assembleDraft('qa', { front: '咩係光合作用？', back: '植物造糖' })).toEqual({
      front: '咩係光合作用？',
      back: '植物造糖',
    })
  })

  it('前後空白會被 trim 走', () => {
    expect(
      assembleDraft('qa', { front: '  問題  ', back: '\t答案\n' }),
    ).toEqual({ front: '問題', back: '答案' })
  })

  it('front 缺失 → null', () => {
    expect(assembleDraft('qa', { back: '只有答案' })).toBeNull()
  })

  it('back 缺失 → null', () => {
    expect(assembleDraft('qa', { front: '只有問題' })).toBeNull()
  })

  it('front 只得空白（trim 後空）→ null', () => {
    expect(assembleDraft('qa', { front: '   ', back: '答案' })).toBeNull()
  })

  it('back 只得空白（trim 後空）→ null', () => {
    expect(assembleDraft('qa', { front: '問題', back: '  \t ' })).toBeNull()
  })

  it('front/back 為非字串（boolean/number/null）→ s() 回空 → null', () => {
    expect(
      assembleDraft('qa', { front: 123 as unknown, back: '答案' } as RawCard),
    ).toBeNull()
    expect(
      assembleDraft('qa', { front: '問題', back: null as unknown } as RawCard),
    ).toBeNull()
  })
})

describe('assembleDraft — term', () => {
  it('正常：trim front/back 後原樣回', () => {
    expect(assembleDraft('term', { front: '通脹', back: '物價持續上升' })).toEqual(
      { front: '通脹', back: '物價持續上升' },
    )
  })

  it('term 同 qa 行為一致：缺欄回 null', () => {
    expect(assembleDraft('term', { front: '通脹' })).toBeNull()
    expect(assembleDraft('term', { back: '物價持續上升' })).toBeNull()
  })

  it('term 前後空白 trim', () => {
    expect(assembleDraft('term', { front: ' 通脹 ', back: ' 定義 ' })).toEqual({
      front: '通脹',
      back: '定義',
    })
  })
})

describe('assembleDraft — cloze', () => {
  it('正常：{{答案}} 換成 ＿＿＿＿，無 hint 背面只係答案', () => {
    expect(
      assembleDraft('cloze', {
        text: '光合作用喺植物嘅{{葉綠體}}入面發生',
        answer: '葉綠體',
      }),
    ).toEqual({
      front: '光合作用喺植物嘅＿＿＿＿入面發生',
      back: '葉綠體',
    })
  })

  it('有 hint：背面格式「答案（提示：…）」', () => {
    expect(
      assembleDraft('cloze', {
        text: '水嘅化學式係{{H2O}}',
        answer: 'H2O',
        hint: '兩個氫一個氧',
      }),
    ).toEqual({
      front: '水嘅化學式係＿＿＿＿',
      back: 'H2O（提示：兩個氫一個氧）',
    })
  })

  it('hint 只得空白（trim 後空）→ 當無 hint，背面只係答案', () => {
    expect(
      assembleDraft('cloze', {
        text: '答案係{{42}}',
        answer: '42',
        hint: '   ',
      }),
    ).toEqual({ front: '答案係＿＿＿＿', back: '42' })
  })

  it('text 內多個 {{…}} 全部換成 ＿＿＿＿', () => {
    expect(
      assembleDraft('cloze', {
        text: '{{牛頓}}第一定律又叫{{慣性}}定律',
        answer: '牛頓',
      }),
    ).toEqual({
      front: '＿＿＿＿第一定律又叫＿＿＿＿定律',
      back: '牛頓',
    })
  })

  it('text 缺失 → null', () => {
    expect(assembleDraft('cloze', { answer: '葉綠體' })).toBeNull()
  })

  it('answer 缺失 → null', () => {
    expect(assembleDraft('cloze', { text: '有句子但{{冇}}答案' })).toBeNull()
  })

  it('text 只得空白 → null', () => {
    expect(assembleDraft('cloze', { text: '   ', answer: '答案' })).toBeNull()
  })

  it('answer 只得空白 → null', () => {
    expect(
      assembleDraft('cloze', { text: '句子{{挖空}}', answer: '  ' }),
    ).toBeNull()
  })

  it('text 內無花括號（AI 冇挖空）→ front===text → null（無效偵測，鎖住）', () => {
    expect(
      assembleDraft('cloze', {
        text: '呢句完全冇花括號',
        answer: '某字',
      }),
    ).toBeNull()
  })

  it('text 含單重花括號 { }（非兩重）→ 唔當挖空 → front===text → null', () => {
    // 正則係 \{\{...\}\} 兩重，單重唔match
    expect(
      assembleDraft('cloze', { text: '單重{括號}唔算', answer: 'x' }),
    ).toBeNull()
  })
})

describe('assembleDraft — tf', () => {
  it("正常 true + explain：front 加【是非】前綴，背面『✓ 正確 — 解釋』", () => {
    expect(
      assembleDraft('tf', {
        statement: '地球係圓嘅',
        answer: 'true',
        explain: '地球近似球體',
      }),
    ).toEqual({
      front: '【是非】地球係圓嘅',
      back: '✓ 正確 — 地球近似球體',
    })
  })

  it("正常 false + explain：背面『✗ 錯誤 — 解釋』", () => {
    expect(
      assembleDraft('tf', {
        statement: '太陽繞地球轉',
        answer: 'false',
        explain: '係地球繞太陽',
      }),
    ).toEqual({
      front: '【是非】太陽繞地球轉',
      back: '✗ 錯誤 — 係地球繞太陽',
    })
  })

  it("無 explain：背面只係判詞（無『 — 解釋』）", () => {
    expect(assembleDraft('tf', { statement: '1+1=2', answer: 'true' })).toEqual({
      front: '【是非】1+1=2',
      back: '✓ 正確',
    })
  })

  it("explain 只得空白 → 當無 explain，背面只係判詞", () => {
    expect(
      assembleDraft('tf', { statement: '命題', answer: 'false', explain: '   ' }),
    ).toEqual({ front: '【是非】命題', back: '✗ 錯誤' })
  })

  it("answer 大小寫：'True' → toLowerCase 後接受", () => {
    expect(assembleDraft('tf', { statement: 'X', answer: 'True' })).toEqual({
      front: '【是非】X',
      back: '✓ 正確',
    })
  })

  it("answer 大小寫：'FALSE' → toLowerCase 後接受", () => {
    expect(assembleDraft('tf', { statement: 'Y', answer: 'FALSE' })).toEqual({
      front: '【是非】Y',
      back: '✗ 錯誤',
    })
  })

  it("answer 前後空白：' true ' → trim + toLowerCase 後接受", () => {
    expect(assembleDraft('tf', { statement: 'Z', answer: ' true ' })).toEqual({
      front: '【是非】Z',
      back: '✓ 正確',
    })
  })

  it("answer 係 JSON boolean true（非字串）→ s() 回空 → null（刻意 reject）", () => {
    expect(
      assembleDraft('tf', {
        statement: '命題',
        answer: true as unknown,
      } as RawCard),
    ).toBeNull()
  })

  it("answer 係 JSON boolean false（非字串）→ s() 回空 → null（刻意 reject）", () => {
    expect(
      assembleDraft('tf', {
        statement: '命題',
        answer: false as unknown,
      } as RawCard),
    ).toBeNull()
  })

  it("answer 係 'yes' → 唔係 true/false → null", () => {
    expect(assembleDraft('tf', { statement: '命題', answer: 'yes' })).toBeNull()
  })

  it("answer 係 '1' → 唔係 true/false → null", () => {
    expect(assembleDraft('tf', { statement: '命題', answer: '1' })).toBeNull()
  })

  it('statement 缺失 → null', () => {
    expect(assembleDraft('tf', { answer: 'true' })).toBeNull()
  })

  it('statement 只得空白 → null', () => {
    expect(assembleDraft('tf', { statement: '  ', answer: 'true' })).toBeNull()
  })

  it('answer 缺失 → null', () => {
    expect(assembleDraft('tf', { statement: '只有命題' })).toBeNull()
  })

  it('statement 前後空白會 trim（但保留【是非】前綴）', () => {
    expect(
      assembleDraft('tf', { statement: '  命題  ', answer: 'true' }),
    ).toEqual({ front: '【是非】命題', back: '✓ 正確' })
  })
})

// ============================================================
//  buildUserPrompt：組 user prompt 字串
// ============================================================

describe('buildUserPrompt', () => {
  it('avoidFronts 空陣列 → 唔加避免段', () => {
    const p = buildUserPrompt('細胞結構', 8, [])
    expect(p).toBe('主題 / 筆記材料：\n細胞結構\n\n請根據以上材料生成 8 張知識卡。')
    expect(p).not.toContain('以下卡已經存在')
  })

  it('avoidFronts 非空 → 用「、」連接附在後面', () => {
    const p = buildUserPrompt('主題', 5, ['卡A', '卡B', '卡C'])
    expect(p).toContain('請根據以上材料生成 5 張知識卡。')
    expect(p).toContain('以下卡已經存在，唔好重複生成相同或極相似嘅卡：卡A、卡B、卡C')
  })

  it('count 最小邊界 5 原樣出現', () => {
    expect(buildUserPrompt('t', 5, [])).toContain('生成 5 張知識卡')
  })

  it('count 最大邊界 20 原樣出現', () => {
    expect(buildUserPrompt('t', 20, [])).toContain('生成 20 張知識卡')
  })

  it('avoidFronts 剛好 40 個 → 全部出現（無截斷）', () => {
    const fronts = Array.from({ length: 40 }, (_, i) => `f${i + 1}`)
    const p = buildUserPrompt('t', 10, fronts)
    const sample = p.split('：').pop() ?? ''
    expect(sample.split('、')).toHaveLength(40)
    expect(p).toContain('f40')
  })

  it('avoidFronts 超過 40（傳 45）→ 只取前 40，第 41 個唔出現', () => {
    const fronts = Array.from({ length: 45 }, (_, i) => `f${i + 1}`)
    const p = buildUserPrompt('t', 10, fronts)
    const sample = p.split('：').pop() ?? ''
    expect(sample.split('、')).toHaveLength(40)
    expect(p).toContain('f40')
    expect(p).not.toContain('f41')
    expect(p).not.toContain('f45')
  })

  it('avoidFronts 少於 40（3 個）→ 全部出現', () => {
    const p = buildUserPrompt('t', 10, ['x', 'y', 'z'])
    const sample = p.split('：').pop() ?? ''
    expect(sample.split('、')).toHaveLength(3)
  })

  it('topic 原樣嵌入', () => {
    expect(buildUserPrompt('市場營銷 4P', 8, [])).toContain(
      '主題 / 筆記材料：\n市場營銷 4P\n\n',
    )
  })
})
