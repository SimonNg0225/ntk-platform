import { describe, it, expect } from 'vitest'
import { convertSlide } from './convert'
import type { Slide } from '../../../../lib/export/types'

const bulletsSlide: Slide = {
  title: '收入確認',
  bullets: ['識別合約：雙方有約束力', '識別履約責任', '釐定交易價格 100 萬', '分攤價格', '履行時確認'],
  notes: '逐步講解',
  imageQuery: 'contract sign',
}

describe('convertSlide → steps', () => {
  it('bullets 逐點變一步：「：」前做步題、後做說明', () => {
    const r = convertSlide(bulletsSlide, 'steps')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.slide.layout).toBe('steps')
    expect(r.slide.steps).toHaveLength(5)
    expect(r.slide.steps![0]).toEqual({ title: '識別合約', desc: '雙方有約束力' })
    expect(r.slide.steps![1]).toEqual({ title: '識別履約責任', desc: undefined })
    // 唔郁其他欄位
    expect(r.slide.notes).toBe('逐步講解')
    expect(r.slide.imageQuery).toBe('contract sign')
    // bullets 保留做後備
    expect(r.slide.bullets.length).toBeGreaterThan(0)
  })

  it('多過 5 點：第 6 點起併入最後一步說明', () => {
    const s: Slide = { title: 'T', bullets: ['一', '二', '三', '四', '五', '六', '七'] }
    const r = convertSlide(s, 'steps')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.slide.steps).toHaveLength(5)
    expect(r.slide.steps![4].desc).toContain('六')
    expect(r.slide.steps![4].desc).toContain('七')
  })

  it('唔夠 2 行 → 失敗、有原因', () => {
    const r = convertSlide({ title: 'T', bullets: ['得一點'] }, 'steps')
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.reason).toBeTruthy()
  })
})

describe('convertSlide → stats', () => {
  it('抽每行第一個數字做 value、剩餘做 label', () => {
    const s: Slide = {
      title: '南京條約',
      bullets: ['賠款 2100 萬銀元', '開放 5 個通商口岸', '割讓香港島'],
    }
    const r = convertSlide(s, 'stats')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.slide.layout).toBe('stats')
    expect(r.slide.stats![0].value).toBe('2100萬')
    expect(r.slide.stats![0].label).toContain('賠款')
    expect(r.slide.stats![1].value).toBe('5')
    // 冇數字嗰行 value 用 —
    expect(r.slide.stats![2].value).toBe('—')
    expect(r.slide.stats![2].label).toContain('香港島')
  })

  it('百分比／$ 都抽到', () => {
    const s: Slide = { title: 'T', bullets: ['合格率 75%', '成本 $1,200'] }
    const r = convertSlide(s, 'stats')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.slide.stats![0].value).toBe('75%')
    expect(r.slide.stats![1].value).toBe('$1,200')
  })

  it('多過 4 行只攞頭 4', () => {
    const s: Slide = { title: 'T', bullets: ['1 a', '2 b', '3 c', '4 d', '5 e'] }
    const r = convertSlide(s, 'stats')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.slide.stats).toHaveLength(4)
  })
})

describe('convertSlide → compare', () => {
  it('前半左欄、後半右欄', () => {
    const s: Slide = { title: 'T', bullets: ['甲一', '甲二', '乙一', '乙二'] }
    const r = convertSlide(s, 'compare')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.slide.compare!.left).toEqual(['甲一', '甲二'])
    expect(r.slide.compare!.right).toEqual(['乙一', '乙二'])
    expect(r.slide.compare!.leftTitle).toBeTruthy()
  })

  it('唔夠 4 行 → 失敗（兩邊各至少 2 點）', () => {
    const r = convertSlide({ title: 'T', bullets: ['一', '二', '三'] }, 'compare')
    expect(r.ok).toBe(false)
  })
})

describe('convertSlide → cards / quote / section / bullets', () => {
  it('cards：「：」斬卡題/說明，上限 6', () => {
    const s: Slide = { title: 'T', bullets: ['流動資產：一年內變現', '非流動資產', 'A', 'B', 'C', 'D', 'E'] }
    const r = convertSlide(s, 'cards')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.slide.cards).toHaveLength(6)
    expect(r.slide.cards![0]).toEqual({ title: '流動資產', desc: '一年內變現' })
    expect(r.slide.cards![1].desc).toBeUndefined()
  })

  it('quote：首行做金句、次行做出處', () => {
    const r = convertSlide({ title: 'T', bullets: ['會計係商業嘅語言', '巴菲特'] }, 'quote')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.slide.quote!.text).toBe('會計係商業嘅語言')
    expect(r.slide.quote!.attribution).toBe('巴菲特')
  })

  it('section：清空 bullets、layout=section', () => {
    const r = convertSlide(bulletsSlide, 'section')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.slide.layout).toBe('section')
    expect(r.slide.bullets).toEqual([])
  })

  it('steps 版轉返 bullets：步題＋說明攤平做點', () => {
    const s: Slide = {
      title: 'T',
      bullets: [],
      layout: 'steps',
      steps: [
        { title: '識別合約', desc: '雙方有約束力' },
        { title: '確認收入', desc: undefined },
      ],
    }
    const r = convertSlide(s, 'bullets')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.slide.layout).toBeUndefined()
    expect(r.slide.bullets).toEqual(['識別合約：雙方有約束力', '確認收入'])
    expect(r.slide.steps).toBeUndefined()
  })

  it('轉版式會清走舊結構欄位', () => {
    const s: Slide = {
      title: 'T',
      bullets: ['a', 'b', 'c', 'd'],
      layout: 'cards',
      cards: [
        { title: 'A', desc: undefined },
        { title: 'B', desc: undefined },
      ],
    }
    const r = convertSlide(s, 'compare')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.slide.cards).toBeUndefined()
    expect(r.slide.compare).toBeTruthy()
  })

  it('stats 版攤平做 bullets：「label：value」', () => {
    const s: Slide = {
      title: 'T',
      bullets: [],
      layout: 'stats',
      stats: [
        { value: '75%', label: '合格率' },
        { value: '1842', label: '條約年份' },
      ],
    }
    const r = convertSlide(s, 'bullets')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.slide.bullets).toEqual(['合格率：75%', '條約年份：1842'])
  })
})
