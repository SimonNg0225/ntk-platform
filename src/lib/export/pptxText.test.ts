import { describe, it, expect } from 'vitest'
import PizZip from 'pizzip'
import { mix, estimateLines, fitTitle, clampText, lineHeightIn } from './pptxText'
import { buildPptxFile, SLIDE_PACKS } from './pptx'
import type { Deck } from './types'

describe('mix', () => {
  it('黑白混色已知值', () => {
    expect(mix('000000', 'FFFFFF', 0)).toBe('FFFFFF')
    expect(mix('000000', 'FFFFFF', 1)).toBe('000000')
    expect(mix('000000', 'FFFFFF', 0.5)).toBe('808080')
  })

  it('食得連 # 嘅輸入，輸出大寫無 #', () => {
    expect(mix('#C2410C', '#FFFFFF', 1)).toBe('C2410C')
    expect(mix('#c2410c', '#ffffff', 0)).toBe('FFFFFF')
  })

  it('t 超界會 clamp', () => {
    expect(mix('000000', 'FFFFFF', -1)).toBe('FFFFFF')
    expect(mix('000000', 'FFFFFF', 2)).toBe('000000')
  })
})

describe('estimateLines', () => {
  it('純中文按 1em 計', () => {
    // 20 字 × 18pt × 1.06 ≈ 5.3"，欄闊 5" → 2 行
    expect(estimateLines('一二三四五六七八九十一二三四五六七八九十', 18, 5)).toBe(2)
    // 6 字好鬆 → 1 行
    expect(estimateLines('供應與需求曲', 18, 5)).toBe(1)
  })

  it('純英文按 0.55em 計', () => {
    // 10 字元 × 0.55 × 18/72 × 1.06 ≈ 1.46" → 1 行
    expect(estimateLines('abcdefghij', 18, 5)).toBe(1)
    // 70 字元 ≈ 10.2" → 3 行
    expect(estimateLines('a'.repeat(70), 18, 5)).toBe(3)
  })

  it('中英混排各按各嘅闊度計', () => {
    // 10 中 + 10 英 = (10×1 + 10×0.55) × 16/72 × 1.06 ≈ 3.65" → 欄 2" 要 2 行
    expect(estimateLines('供求理論基本概念入門GDP growth', 16, 2)).toBeGreaterThanOrEqual(2)
  })

  it('空字串或零闊度都至少回 1 行', () => {
    expect(estimateLines('', 18, 5)).toBe(1)
    expect(estimateLines('abc', 18, 0)).toBe(1)
  })
})

describe('fitTitle', () => {
  it('版題四級邊界', () => {
    expect(fitTitle('一'.repeat(12))).toEqual({ fontPt: 30, lines: 1 })
    expect(fitTitle('一'.repeat(13))).toEqual({ fontPt: 28, lines: 1 })
    expect(fitTitle('一'.repeat(16))).toEqual({ fontPt: 28, lines: 1 })
    expect(fitTitle('一'.repeat(17))).toEqual({ fontPt: 26, lines: 2 })
    expect(fitTitle('一'.repeat(22))).toEqual({ fontPt: 26, lines: 2 })
    expect(fitTitle('一'.repeat(23))).toEqual({ fontPt: 24, lines: 2 })
  })

  it('封面另一條梯', () => {
    expect(fitTitle('一'.repeat(14), 'cover').fontPt).toBe(44)
    expect(fitTitle('一'.repeat(15), 'cover').fontPt).toBe(40)
    expect(fitTitle('一'.repeat(20), 'cover').fontPt).toBe(40)
    expect(fitTitle('一'.repeat(21), 'cover').fontPt).toBe(36)
  })

  it('前後空白唔計入字數', () => {
    expect(fitTitle('  ' + '一'.repeat(12) + '  ').fontPt).toBe(30)
  })
})

describe('clampText', () => {
  it('短過上限原樣回', () => {
    expect(clampText('供求理論', 10)).toBe('供求理論')
  })

  it('超長截斷加省略號，總長 = max', () => {
    const out = clampText('一'.repeat(40), 10)
    expect(out).toBe('一'.repeat(9) + '…')
    expect([...out].length).toBe(10)
  })
})

describe('lineHeightIn', () => {
  it('行高 = pt × 1.32 / 72', () => {
    expect(lineHeightIn(18)).toBeCloseTo(0.33, 5)
  })
})

// ============================================================
//  buildPptxFile smoke — 6 版樣板 deck × 5 packs 真係砌一次檔，
//  驗 zip 完整 + theme patch 生效（a:ea 有 Microsoft JhengHei）
// ============================================================

const PNG_1PX =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

function sampleDeck(): Deck {
  return {
    title: '香港人口老化嘅社會經濟影響同政策回應分析', // 22 字長題行封面階梯
    subtitle: '通識 · 中五',
    slides: [
      { title: '單元導入', bullets: [] }, // section
      {
        title: '人口結構關鍵數字',
        layout: 'stats',
        bullets: ['65 歲以上人口持續上升', '撫養比率惡化'],
        stats: [
          { value: '20.5%', label: '長者人口比例' },
          { value: '1.7', label: '出生率（每名婦女）' },
          { value: '85.2', label: '女性平均壽命' },
          { value: '2046', label: '高峰年份預測' },
        ],
      },
      {
        title: '安老政策兩種取向比較',
        layout: 'compare',
        bullets: ['居家安老成本較低', '院舍照顧較有保障'],
        compare: {
          leftTitle: '居家安老',
          left: ['成本較低，長者保持自主', '社區網絡得以維持', '照顧者壓力較大'],
          rightTitle: '院舍照顧',
          right: ['專業醫護全日候命', '輪候時間長', '脫離原有社區'],
        },
      },
      {
        title: '政策制定流程',
        layout: 'steps',
        bullets: ['由研究到立法到檢討'],
        steps: [
          { title: '研究諮詢', desc: '收集人口數據同持份者意見' },
          { title: '政策草擬', desc: '跨部門協作訂出方案' },
          { title: '立法執行', desc: '撥款同行政配套落地' },
          { title: '成效檢討', desc: '定期評估再調整' },
        ],
      },
      {
        title: '核心觀點',
        layout: 'quote',
        bullets: ['老吾老以及人之老'],
        quote: { text: '老吾老，以及人之老；幼吾幼，以及人之幼。', attribution: '孟子 · 梁惠王上' },
      },
      {
        title: '長者人口趨勢數據',
        bullets: ['長者比例由 2016 年起加速上升', '2046 年預計達三成', '勞動人口同步收縮'],
        chart: {
          type: 'bar',
          categories: ['2016', '2026', '2036', '2046'],
          series: [{ name: '長者比例', values: [16, 21, 26, 31] }],
          unit: '%',
        },
        imageQuery: 'elderly hong kong', // chart 優先 — 呢版相應該被忽略
      },
    ],
    coverImageQuery: 'hong kong city',
  }
}

describe('buildPptxFile smoke', () => {
  it('5 個 pack 各砌一次：zip 完整兼 theme patch 生效', async () => {
    const deck = sampleDeck()
    const photo = { dataUri: PNG_1PX, credit: '相片：Test / Pexels', width: 800, height: 1200 }
    for (const packMeta of SLIDE_PACKS) {
      const out = await buildPptxFile(deck, {
        pack: packMeta.id,
        coverPhoto: photo,
        slidePhotos: { 5: photo }, // 同版有 chart → 應該行 chart 路（唔會爆）
      })
      // node 環境回 Uint8Array
      expect(out).toBeInstanceOf(Uint8Array)
      const bytes = out as Uint8Array
      expect(bytes.length).toBeGreaterThan(10240)
      // zip 頭 'PK'
      expect(bytes[0]).toBe(0x50)
      expect(bytes[1]).toBe(0x4b)
      // 開返出嚟驗 theme1.xml — a:ea 軌已補 CJK 字體
      const zip = new PizZip(bytes)
      const theme = zip.file('ppt/theme/theme1.xml')?.asText() ?? ''
      expect(theme).toContain('Microsoft JhengHei')
      expect(theme).not.toContain('<a:ea typeface=""/>')
      expect(theme).not.toContain('新細明體')
      // 每版都有 slide XML（封面 + 6 版）
      expect(zip.file('ppt/slides/slide7.xml')).toBeTruthy()
    }
  }, 30000)

  it('配圖版（無 chart）都出到檔', async () => {
    const deck = sampleDeck()
    // 抽走 chart，令第 6 版行 split 配圖路
    deck.slides[5] = { ...deck.slides[5], chart: undefined }
    const photo = { dataUri: PNG_1PX, credit: '相片：Test / Pexels', width: 1200, height: 800 }
    const out = (await buildPptxFile(deck, { pack: 'celadon', slidePhotos: { 5: photo } })) as Uint8Array
    expect(out.length).toBeGreaterThan(10240)
    expect(new PizZip(out).file('ppt/slides/slide7.xml')).toBeTruthy()
  })

  it('layout 資料唔合格會靜默回退 bullets（唔 throw）', async () => {
    const deck: Deck = {
      title: '回退測試',
      slides: [
        { title: '得一個 stat', layout: 'stats', bullets: ['兜底點一', '兜底點二'], stats: [{ value: '1', label: '唔夠' }] },
        { title: '空 quote', layout: 'quote', bullets: ['兜底'], quote: { text: '' } },
      ],
    }
    const out = (await buildPptxFile(deck)) as Uint8Array
    expect(out.length).toBeGreaterThan(10240)
  })
})
