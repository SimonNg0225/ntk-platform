import { describe, it, expect } from 'vitest'
import { pageDimsFromImage, mapBboxToPdf } from './pdfText'

describe('pageDimsFromImage', () => {
  it('橫向相 → 頁面長邊封頂 842pt(A4 長邊)、保持比例', () => {
    const d = pageDimsFromImage(2000, 1000) // 2:1
    expect(d.w).toBe(842)
    expect(d.h).toBe(421)
  })
  it('直向相 → 高度封頂 842pt', () => {
    const d = pageDimsFromImage(1000, 2000) // 1:2
    expect(d.h).toBe(842)
    expect(d.w).toBe(421)
  })
})

describe('mapBboxToPdf', () => {
  it('左上角字 → PDF 左上（翻 Y 後 y 接近頁頂）', () => {
    // 圖 1000x1000px，頁 500x500pt（縮放 0.5）
    const r = mapBboxToPdf(
      { x0: 0, y0: 0, x1: 100, y1: 50 },
      { w: 1000, h: 1000 },
      { w: 500, h: 500 },
    )
    expect(r.x).toBeCloseTo(0)
    expect(r.w).toBeCloseTo(50)   // 100px * 0.5
    expect(r.h).toBeCloseTo(25)   // 50px * 0.5
    // y0=0 喺圖頂 → PDF y = 頁高 - (y1*scale) = 500 - 25 = 475
    expect(r.y).toBeCloseTo(475)
  })
})
