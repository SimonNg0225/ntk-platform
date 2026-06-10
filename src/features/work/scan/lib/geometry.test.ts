import { describe, it, expect } from 'vitest'
import { orderCorners, downscaleDims, quadArea, isPlausibleQuad } from './geometry'
import type { Corners } from './types'

describe('orderCorners', () => {
  it('將四個亂序點排成 tl/tr/br/bl', () => {
    const pts = [
      { x: 90, y: 12 },  // tr
      { x: 8, y: 100 },  // bl
      { x: 10, y: 10 },  // tl
      { x: 95, y: 105 }, // br
    ]
    const c = orderCorners(pts)
    expect(c.tl).toEqual({ x: 10, y: 10 })
    expect(c.tr).toEqual({ x: 90, y: 12 })
    expect(c.br).toEqual({ x: 95, y: 105 })
    expect(c.bl).toEqual({ x: 8, y: 100 })
  })
})

describe('downscaleDims', () => {
  it('長邊超過上限時按比例縮細', () => {
    expect(downscaleDims(4000, 3000, 2000)).toEqual({ w: 2000, h: 1500 })
  })
  it('已細過上限就原樣', () => {
    expect(downscaleDims(1200, 800, 2000)).toEqual({ w: 1200, h: 800 })
  })
  it('直度相（高 > 闊）都啱', () => {
    expect(downscaleDims(1500, 3000, 2000)).toEqual({ w: 1000, h: 2000 })
  })
})

const quad = (
  tl: [number, number], tr: [number, number],
  br: [number, number], bl: [number, number],
): Corners => ({
  tl: { x: tl[0], y: tl[1] }, tr: { x: tr[0], y: tr[1] },
  br: { x: br[0], y: br[1] }, bl: { x: bl[0], y: bl[1] },
})

describe('quadArea', () => {
  it('長方形面積 = 闊 × 高（shoelace）', () => {
    expect(quadArea(quad([0, 0], [600, 0], [600, 800], [0, 800]))).toBe(480000)
  })
  it('退化（四點重合）面積 = 0', () => {
    expect(quadArea(quad([5, 5], [5, 5], [5, 5], [5, 5]))).toBe(0)
  })
})

describe('isPlausibleQuad', () => {
  const W = 1000, H = 1000
  it('合理文件四邊形 → true', () => {
    expect(isPlausibleQuad(quad([200, 100], [800, 100], [800, 900], [200, 900]), W, H)).toBe(true)
  })
  it('整幅全頁 → true（允許）', () => {
    expect(isPlausibleQuad(quad([0, 0], [1000, 0], [1000, 1000], [0, 1000]), W, H)).toBe(true)
  })
  it('太細（<10% 面積）→ false', () => {
    expect(isPlausibleQuad(quad([0, 0], [100, 0], [100, 100], [0, 100]), W, H)).toBe(false)
  })
  it('退化（零面積）→ false', () => {
    expect(isPlausibleQuad(quad([5, 5], [5, 5], [5, 5], [5, 5]), W, H)).toBe(false)
  })
  it('角點超出畫面（容差外）→ false', () => {
    expect(isPlausibleQuad(quad([200, 100], [1300, 100], [1300, 900], [200, 900]), W, H)).toBe(false)
  })
  it('有一邊極短（退化長條）→ false', () => {
    // tr 同 br 幾乎重合 → 右邊長度近 0
    expect(isPlausibleQuad(quad([100, 100], [900, 100], [900, 110], [100, 900]), W, H)).toBe(false)
  })
  it('非有限座標 → false', () => {
    expect(isPlausibleQuad(quad([NaN, 0], [800, 0], [800, 900], [0, 900]), W, H)).toBe(false)
  })
})
