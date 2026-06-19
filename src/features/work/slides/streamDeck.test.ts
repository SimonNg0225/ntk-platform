import { describe, expect, it } from 'vitest'
import { createDeckStreamParser, parseObjectBoundaries } from './streamDeck'

describe('parseObjectBoundaries', () => {
  it('半截 object → 切唔出、consumed 停喺起點', () => {
    const buf = '[{"title":"A","bul'
    const r = parseObjectBoundaries(buf, 1)
    expect(r.objects).toEqual([])
    expect(r.consumed).toBe(1)
  })

  it('補齊後切出 1 個完整 object', () => {
    const buf = '[{"title":"A","bullets":["x"]}'
    const r = parseObjectBoundaries(buf, 1)
    expect(r.objects).toHaveLength(1)
    expect(JSON.parse(r.objects[0]).title).toBe('A')
  })

  it('string 內含 } { 同轉義引號唔被誤切', () => {
    const buf = '[{"title":"a}b{c","bullets":["他說\\"嗨\\""]}]'
    const r = parseObjectBoundaries(buf, 1)
    expect(r.objects).toHaveLength(1)
    const o = JSON.parse(r.objects[0])
    expect(o.title).toBe('a}b{c')
    expect(o.bullets[0]).toBe('他說"嗨"')
  })

  it('巢狀 object（chart）只當作 1 個頂層 object', () => {
    const buf = '[{"title":"T","bullets":["x"],"chart":{"type":"bar","categories":["a"],"series":[{"name":"s","values":[1]}]}}]'
    const r = parseObjectBoundaries(buf, 1)
    expect(r.objects).toHaveLength(1)
    expect(JSON.parse(r.objects[0]).chart.type).toBe('bar')
  })

  it('一次過 2 個完整 object → 切出 2 個', () => {
    const buf = '[{"title":"A","bullets":["x"]},{"title":"B","bullets":["y"]}'
    const r = parseObjectBoundaries(buf, 1)
    expect(r.objects).toHaveLength(2)
    expect(JSON.parse(r.objects[0]).title).toBe('A')
    expect(JSON.parse(r.objects[1]).title).toBe('B')
  })
})

const FULL = JSON.stringify({
  title: '光合作用',
  subtitle: 'Photosynthesis',
  coverImageQuery: 'green leaf',
  slides: [
    { title: '引入', bullets: ['植物點樣造食物'] },
    { title: '反應式', bullets: ['二氧化碳 + 水', '光能 → 葡萄糖 + 氧氣'] },
    { title: '小結', bullets: ['光合作用養活地球'] },
  ],
})

describe('createDeckStreamParser', () => {
  it('一次過 push 同分多次 push 結果一致', () => {
    const whole = createDeckStreamParser()
    const wholeRes = whole.push(FULL)
    expect(wholeRes.meta?.title).toBe('光合作用')
    expect(wholeRes.slides).toHaveLength(3)

    // 分多次 push（逐字元，模擬最碎嘅 delta）
    const p = createDeckStreamParser()
    const acc: string[] = []
    let metaTitle: string | undefined
    let metaCount = 0
    for (const ch of FULL) {
      const r = p.push(ch)
      if (r.meta) {
        metaCount++
        metaTitle = r.meta.title
      }
      for (const s of r.slides) acc.push(s.title)
    }
    expect(metaTitle).toBe('光合作用')
    expect(metaCount).toBe(1) // meta 只回一次
    expect(acc).toEqual(['引入', '反應式', '小結'])
  })

  it('```json fence 包裹 → 正確 strip 且唔砍尾', () => {
    const p = createDeckStreamParser()
    const wrapped = '```json\n' + FULL + '\n```'
    const r = p.push(wrapped)
    expect(r.meta?.title).toBe('光合作用')
    expect(r.slides).toHaveLength(3)
  })

  it('含非法版（缺 title+bullets）→ 該版被跳過、其餘正常', () => {
    const withBad = JSON.stringify({
      title: 'T',
      slides: [
        { title: '好版', bullets: ['ok'] },
        { bullets: [] },
        { title: '另一好版', bullets: ['ok2'] },
      ],
    })
    const p = createDeckStreamParser()
    const r = p.push(withBad)
    const titles = r.slides.map((s) => s.title)
    expect(titles).toEqual(['好版', '另一好版'])
  })

  it('meta 喺 slides 之後唔再重出', () => {
    const p = createDeckStreamParser()
    // 分兩段：頭 + 尾
    const mid = FULL.indexOf('"slides"') + 20
    const r1 = p.push(FULL.slice(0, mid))
    const r2 = p.push(FULL.slice(mid))
    const metaHits = (r1.meta ? 1 : 0) + (r2.meta ? 1 : 0)
    expect(metaHits).toBe(1)
    expect([...r1.slides, ...r2.slides]).toHaveLength(3)
  })
})
