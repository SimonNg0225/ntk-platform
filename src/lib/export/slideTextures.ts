// ============================================================
//  招牌紋理 — Canvas 畫嘅非文字視覺（pptxgenjs 做唔到嘅真漸層／柔邊／噪點）
//  ------------------------------------------------------------
//  pack 喺 cover/section 用 coverTextureUri(kind) 攞一張 PNG data URI，
//  addImage 做全版底圖。因為係圖片，Mac/手機/Google Slides/Keynote 都一致 render。
//  文字維持原生可編輯（疊喺底圖上）。
//  瀏覽器先有 canvas；node/SSR 回 null → pack 自動 fallback 原本純色／漸層底。
// ============================================================

export type TextureKind = 'sumi' | 'cosmos' | 'washi'

type Ctx = CanvasRenderingContext2D

/** 確定性偽隨機（同一 kind 每次畫一樣，方便快取） */
function mkRnd(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

function roundRect(x: Ctx, px: number, py: number, w: number, h: number, r: number): void {
  x.beginPath()
  x.moveTo(px + r, py)
  x.arcTo(px + w, py, px + w, py + h, r)
  x.arcTo(px + w, py + h, px, py + h, r)
  x.arcTo(px, py + h, px, py, r)
  x.arcTo(px, py, px + w, py, r)
  x.closePath()
}

/** 水墨：宣紙底 + 大片柔墨暈染 + 飛白筆觸 + 朱砂印 */
function drawSumi(x: Ctx, W: number, H: number): void {
  const sx = W / 1600
  const sy = H / 900
  x.fillStyle = '#F6F3EC'
  x.fillRect(0, 0, W, H)
  const blobs: [number, number, number, number][] = [
    [420, 360, 340, 0.32],
    [1080, 520, 420, 0.22],
    [760, 250, 220, 0.16],
  ]
  for (const [cx, cy, r, a] of blobs) {
    const g = x.createRadialGradient(cx * sx, cy * sy, 0, cx * sx, cy * sy, r * sx)
    g.addColorStop(0, `rgba(28,27,25,${a})`)
    g.addColorStop(0.6, `rgba(28,27,25,${a * 0.4})`)
    g.addColorStop(1, 'rgba(28,27,25,0)')
    x.fillStyle = g
    x.fillRect(0, 0, W, H)
  }
  for (let pass = 0; pass < 5; pass++) {
    x.beginPath()
    x.moveTo(180 * sx, 700 * sy)
    x.bezierCurveTo(520 * sx, (760 - pass * 6) * sy, 980 * sx, (560 + pass * 8) * sy, 1380 * sx, 660 * sy)
    x.strokeStyle = `rgba(26,25,23,${0.16 - pass * 0.02})`
    x.lineWidth = (70 - pass * 12) * sx
    x.lineCap = 'round'
    x.stroke()
  }
  const r1 = mkRnd(7)
  for (let i = 0; i < 1400; i++) {
    const px = (180 + r1() * 1200) * sx
    const py = (640 + r1() * 90) * sy
    if (r1() > 0.5) {
      x.fillStyle = `rgba(246,243,236,${0.5 * r1()})`
      x.fillRect(px, py, (2 + r1() * 3) * sx, (1 + r1() * 2) * sy)
    }
  }
  for (let i = 0; i < 9000; i++) {
    x.fillStyle = `rgba(60,53,44,${0.03 * r1()})`
    x.fillRect(r1() * W, r1() * H, 1, 1)
  }
  x.fillStyle = '#B33A26'
  roundRect(x, 130 * sx, 150 * sy, 70 * sx, 70 * sy, 8 * sx)
  x.fill()
}

/** 星圖：午夜藍 + 星雲輝光（lighter 疊）+ 星野 + 光暈星 */
function drawCosmos(x: Ctx, W: number, H: number): void {
  const sx = W / 1600
  const sy = H / 900
  x.fillStyle = '#0B1026'
  x.fillRect(0, 0, W, H)
  const clouds: [number, number, number, string][] = [
    [500, 380, 520, '120,90,220'],
    [1120, 560, 460, '40,120,200'],
    [820, 250, 360, '200,70,150'],
  ]
  x.globalCompositeOperation = 'lighter'
  for (const [cx, cy, r, rgb] of clouds) {
    const g = x.createRadialGradient(cx * sx, cy * sy, 0, cx * sx, cy * sy, r * sx)
    g.addColorStop(0, `rgba(${rgb},0.5)`)
    g.addColorStop(0.5, `rgba(${rgb},0.18)`)
    g.addColorStop(1, `rgba(${rgb},0)`)
    x.fillStyle = g
    x.fillRect(0, 0, W, H)
  }
  x.globalCompositeOperation = 'source-over'
  const r2 = mkRnd(42)
  for (let i = 0; i < 520; i++) {
    const px = r2() * W
    const py = r2() * H
    const s = r2()
    x.fillStyle = `rgba(232,236,255,${0.3 + s * 0.7})`
    x.beginPath()
    x.arc(px, py, (s < 0.9 ? s * 1.3 : 2.2) * sx, 0, 7)
    x.fill()
  }
  for (const [px, py] of [[360, 300], [1180, 420], [900, 640]] as [number, number][]) {
    const g = x.createRadialGradient(px * sx, py * sy, 0, px * sx, py * sy, 34 * sx)
    g.addColorStop(0, 'rgba(244,201,93,0.9)')
    g.addColorStop(0.3, 'rgba(244,201,93,0.35)')
    g.addColorStop(1, 'rgba(244,201,93,0)')
    x.fillStyle = g
    x.fillRect((px - 40) * sx, (py - 40) * sy, 80 * sx, 80 * sy)
    x.strokeStyle = 'rgba(255,255,255,0.85)'
    x.lineWidth = 1.5 * sx
    x.beginPath()
    x.moveTo((px - 14) * sx, py * sy)
    x.lineTo((px + 14) * sx, py * sy)
    x.moveTo(px * sx, (py - 14) * sy)
    x.lineTo(px * sx, (py + 14) * sy)
    x.stroke()
  }
}

/** 和紙：米色 + 纖維噪點 + 橫纖維 + 柿色左邊條 */
function drawWashi(x: Ctx, W: number, H: number): void {
  const sx = W / 1600
  x.fillStyle = '#F7F3EA'
  x.fillRect(0, 0, W, H)
  const r3 = mkRnd(11)
  for (let i = 0; i < 26000; i++) {
    const a = 0.05 * r3()
    x.fillStyle = r3() > 0.5 ? `rgba(120,100,70,${a})` : `rgba(255,255,255,${a})`
    x.fillRect(r3() * W, r3() * H, 1, 1)
  }
  for (let i = 0; i < 60; i++) {
    const y = r3() * H
    x.strokeStyle = `rgba(150,130,95,${0.05 + r3() * 0.06})`
    x.lineWidth = 0.6 * sx
    x.beginPath()
    x.moveTo(0, y)
    x.bezierCurveTo(W * 0.3, y + (r3() - 0.5) * 12, W * 0.7, y + (r3() - 0.5) * 12, W, y)
    x.stroke()
  }
  x.fillStyle = '#C8501F'
  x.fillRect(0, 0, 26 * sx, H)
}

const DRAW: Record<TextureKind, (x: Ctx, w: number, h: number) => void> = {
  sumi: drawSumi,
  cosmos: drawCosmos,
  washi: drawWashi,
}

/**
 * 攞招牌紋理 PNG data URI（瀏覽器先有；node/SSR 回 null → pack fallback）。
 * 預設 1600×900（16:9）。
 */
export function coverTextureUri(kind: TextureKind, w = 1600, h = 900): string | null {
  if (typeof document === 'undefined') return null // node / SSR：冇 canvas
  try {
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    DRAW[kind](ctx, w, h)
    return canvas.toDataURL('image/png')
  } catch {
    return null // 任何 canvas 錯誤 → fallback，唔好 throw
  }
}
