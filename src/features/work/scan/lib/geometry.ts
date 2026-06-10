import type { Pt, Corners } from './types'

/**
 * 將 4 個未排序角點排成 {tl, tr, br, bl}。
 * 慣用法：x+y 最細 = 左上、最大 = 右下；x−y 最細 = 左下、最大 = 右上。
 */
export function orderCorners(pts: Pt[]): Corners {
  if (pts.length !== 4) throw new Error('orderCorners 需要剛好 4 點')
  const bySum = [...pts].sort((a, b) => a.x + a.y - (b.x + b.y))
  const byDiff = [...pts].sort((a, b) => a.x - a.y - (b.x - b.y))
  return {
    tl: bySum[0],
    br: bySum[3],
    bl: byDiff[0],
    tr: byDiff[3],
  }
}

/** 長邊縮到 maxEdge（保持比例、四捨五入）；已細過就原樣。 */
export function downscaleDims(w: number, h: number, maxEdge: number): { w: number; h: number } {
  const longEdge = Math.max(w, h)
  if (longEdge <= maxEdge) return { w, h }
  const k = maxEdge / longEdge
  return { w: Math.round(w * k), h: Math.round(h * k) }
}
