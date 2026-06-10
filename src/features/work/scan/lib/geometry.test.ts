import { describe, it, expect } from 'vitest'
import { orderCorners, downscaleDims } from './geometry'

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
