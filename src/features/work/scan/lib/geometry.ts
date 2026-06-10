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

/** 四邊形面積（shoelace；點序 tl→tr→br→bl）。 */
export function quadArea(c: Corners): number {
  const p = [c.tl, c.tr, c.br, c.bl]
  let a = 0
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4
    a += p[i].x * p[j].y - p[j].x * p[i].y
  }
  return Math.abs(a) / 2
}

// 自動偵測四角嘅合理性門檻（避免 jscanify 回離譜結果照用）。
const MIN_AREA_FRAC = 0.1 // 面積至少佔全圖 10%
const MIN_SIDE_FRAC = 0.08 // 每邊至少 = 短邊 8%（擋退化長條）
const BOUND_TOL_FRAC = 0.02 // 角點容許超出畫面 2%（長邊計）

/**
 * 自動偵測出嚟嘅四邊形係咪「靠譜」（畀 detectCorners 過濾）。
 * 擋走：非有限座標、明顯出界、太細（< 10% 面積）、退化（有邊極短）。
 * 全頁／合理文件 → true；離譜 → false（caller 退回全頁，等用戶手動調）。
 */
export function isPlausibleQuad(c: Corners, imgW: number, imgH: number): boolean {
  if (imgW <= 0 || imgH <= 0) return false
  const pts = [c.tl, c.tr, c.br, c.bl]
  if (pts.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))) return false

  const tol = Math.max(imgW, imgH) * BOUND_TOL_FRAC
  if (pts.some((p) => p.x < -tol || p.y < -tol || p.x > imgW + tol || p.y > imgH + tol)) {
    return false
  }

  if (quadArea(c) < imgW * imgH * MIN_AREA_FRAC) return false

  const minDim = Math.min(imgW, imgH)
  const side = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y)
  const sides = [side(c.tl, c.tr), side(c.tr, c.br), side(c.br, c.bl), side(c.bl, c.tl)]
  if (sides.some((s) => s < minDim * MIN_SIDE_FRAC)) return false

  return true
}
