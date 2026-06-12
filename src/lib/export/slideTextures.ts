// ============================================================
//  招牌紋理 — Canvas 畫嘅非文字視覺（pptxgenjs 做唔到嘅真漸層／柔邊／噪點）
//  ------------------------------------------------------------
//  每套 pack 配一個 generator + 色板（TEX 登記表）。pack cover 用
//  coverTextureUri(pack.id) 攞 PNG data URI，addImage 做全版底圖。
//  因為係圖片，Mac/手機/Google Slides/Keynote render 都一致；文字維持原生可編輯。
//  瀏覽器先有 canvas；node/SSR 回 null → pack fallback 原本純色／漸層底。
// ============================================================

type Ctx = CanvasRenderingContext2D
interface Pal { bg: string; ink: string; accent: string; accent2?: string; accent3?: string }

function mkRnd(seed: number): () => number {
  let s = seed >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0), s / 4294967296)
}
function roundRect(x: Ctx, px: number, py: number, w: number, h: number, r: number): void {
  x.beginPath(); x.moveTo(px + r, py)
  x.arcTo(px + w, py, px + w, py + h, r); x.arcTo(px + w, py + h, px, py + h, r)
  x.arcTo(px, py + h, px, py, r); x.arcTo(px, py, px + w, py, r); x.closePath()
}
function hex2rgb(h: string): [number, number, number] {
  const n = parseInt(h.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
function fill(x: Ctx, W: number, H: number, c: string): void { x.fillStyle = c; x.fillRect(0, 0, W, H) }
function radial(x: Ctx, cx: number, cy: number, r: number, inner: string, outer: string): void {
  const g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, inner); g.addColorStop(1, outer); x.fillStyle = g
}
function grain(x: Ctx, W: number, H: number, n: number, rgb: string, amax: number, seed: number): void {
  const r = mkRnd(seed)
  for (let i = 0; i < n; i++) { x.fillStyle = `rgba(${rgb},${amax * r()})`; x.fillRect(r() * W, r() * H, 1, 1) }
}

// ───────── generators ─────────
function gInkWash(x: Ctx, W: number, H: number, p: Pal): void {
  fill(x, W, H, p.bg)
  const [ir, ig, ib] = hex2rgb(p.ink)
  const blobs: [number, number, number, number][] = [[0.26, 0.4, 0.34, 0.3], [0.68, 0.58, 0.42, 0.2], [0.48, 0.28, 0.22, 0.15]]
  for (const [fx, fy, fr, a] of blobs) {
    radial(x, fx * W, fy * H, fr * W, `rgba(${ir},${ig},${ib},${a})`, `rgba(${ir},${ig},${ib},0)`); x.fillRect(0, 0, W, H)
  }
  for (let pass = 0; pass < 5; pass++) {
    x.beginPath(); x.moveTo(0.11 * W, 0.78 * H)
    x.bezierCurveTo(0.33 * W, (0.84 - pass * 0.007) * H, 0.61 * W, (0.62 + pass * 0.009) * H, 0.86 * W, 0.73 * H)
    x.strokeStyle = `rgba(${ir},${ig},${ib},${0.15 - pass * 0.02})`; x.lineWidth = (70 - pass * 12) * (W / 1600); x.lineCap = 'round'; x.stroke()
  }
  grain(x, W, H, 8000, '60,53,44', 0.03, 7)
  if (p.accent) { x.fillStyle = p.accent; roundRect(x, 0.08 * W, 0.17 * H, 0.044 * W, 0.078 * H, 0.005 * W); x.fill() }
}
function gNebula(x: Ctx, W: number, H: number, p: Pal): void {
  // 深空漸層底（頂稍亮 → 底沉）
  const [br, bgc, bb] = hex2rgb(p.bg)
  const lt = (v: number, a: number) => Math.min(255, Math.round(v + a))
  const dk = (v: number, m: number) => Math.round(v * m)
  const sky = x.createLinearGradient(0, 0, 0, H)
  sky.addColorStop(0, `rgb(${lt(br, 8)},${lt(bgc, 12)},${lt(bb, 22)})`)
  sky.addColorStop(0.6, `rgb(${br},${bgc},${bb})`)
  sky.addColorStop(1, `rgb(${dk(br, 0.5)},${dk(bgc, 0.5)},${dk(bb, 0.55)})`)
  x.fillStyle = sky; x.fillRect(0, 0, W, H)
  // 銀河帶（斜向柔光）
  x.save(); x.translate(W * 0.55, H * 0.42); x.rotate(-0.32)
  const mw = x.createLinearGradient(0, -H * 0.3, 0, H * 0.3)
  mw.addColorStop(0, 'rgba(150,160,200,0)'); mw.addColorStop(0.5, 'rgba(150,160,200,0.09)'); mw.addColorStop(1, 'rgba(150,160,200,0)')
  x.fillStyle = mw; x.fillRect(-W, -H * 0.16, 2 * W, H * 0.32); x.restore()
  // 暗調星雲（去飽和、層疊三組柔暈）
  x.globalCompositeOperation = 'lighter'
  const wisps: [number, number, number, string][] = [[0.34, 0.4, 0.42, '52,70,120'], [0.64, 0.56, 0.38, '40,104,104'], [0.5, 0.3, 0.32, '130,86,104']]
  for (const [fx, fy, fr, rgb] of wisps) for (let k = 0; k < 3; k++) { const r = fr * W * (0.55 + k * 0.28), a = 0.075 - k * 0.02; radial(x, (fx + (k - 1) * 0.05) * W, (fy + (k - 1) * 0.04) * H, r, `rgba(${rgb},${a})`, `rgba(${rgb},0)`); x.fillRect(0, 0, W, H) }
  x.globalCompositeOperation = 'source-over'
  grain(x, W, H, 24000, '140,150,190', 0.018, 91) // 氣體顆粒
  const [sr, sg, sb] = hex2rgb(p.ink), r2 = mkRnd(7)
  for (let i = 0; i < 760; i++) { const s = r2(), sz = (s < 0.86 ? s * 0.9 : s < 0.97 ? 1.6 : 2.5) * (W / 1600); x.fillStyle = `rgba(${sr},${sg},${sb},${0.22 + s * 0.6})`; x.beginPath(); x.arc(r2() * W, r2() * H, sz, 0, 7); x.fill() }
  const [ar, ag, ab] = hex2rgb(p.accent) // 兩粒柔光星（無十字閃）
  for (const [fx, fy] of [[0.26, 0.3], [0.72, 0.62]] as [number, number][]) { radial(x, fx * W, fy * H, 0.018 * W, `rgba(${ar},${ag},${ab},0.85)`, `rgba(${ar},${ag},${ab},0)`); x.fillRect(fx * W - 0.04 * W, fy * H - 0.06 * H, 0.08 * W, 0.12 * H) }
}
function gPaper(x: Ctx, W: number, H: number, p: Pal): void {
  fill(x, W, H, p.bg)
  const [dr, dg, db] = hex2rgb(p.ink)
  const r = mkRnd(11)
  for (let i = 0; i < 5; i++) { radial(x, r() * W, r() * H, (0.2 + r() * 0.2) * W, `rgba(${dr},${dg},${db},0.05)`, `rgba(${dr},${dg},${db},0)`); x.fillRect(0, 0, W, H) }
  for (let i = 0; i < 40000; i++) { const a = 0.06 * r(); x.fillStyle = r() > 0.5 ? `rgba(${dr},${dg},${db},${a})` : `rgba(255,255,255,${a})`; x.fillRect(r() * W, r() * H, 1, 1) }
  for (let i = 0; i < 70; i++) { const y = r() * H; x.strokeStyle = `rgba(${dr},${dg},${db},${0.04 + r() * 0.06})`; x.lineWidth = 0.7; x.beginPath(); x.moveTo(0, y); x.bezierCurveTo(W * 0.3, y + (r() - 0.5) * 16, W * 0.7, y + (r() - 0.5) * 16, W, y); x.stroke() }
  const v = x.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.72); v.addColorStop(0, `rgba(${dr},${dg},${db},0)`); v.addColorStop(1, `rgba(${dr},${dg},${db},0.07)`); x.fillStyle = v; x.fillRect(0, 0, W, H)
  if (p.accent) { x.fillStyle = p.accent; x.fillRect(0, 0, 0.016 * W, H) }
}
function gSunset(x: Ctx, W: number, H: number, p: Pal): void {
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, p.accent); g.addColorStop(0.55, p.accent2 || p.bg); g.addColorStop(1, p.bg); x.fillStyle = g; x.fillRect(0, 0, W, H)
  // 透視地網格
  const horizon = 0.62 * H, [lr, lg, lb] = hex2rgb(p.accent3 || p.accent), col = `rgba(${lr},${lg},${lb},0.35)`
  x.strokeStyle = col; x.lineWidth = 1
  for (let i = 1; i <= 7; i++) { const t = i / 7, y = horizon + (H - horizon) * (t * t); x.beginPath(); x.moveTo(0, y); x.lineTo(W, y); x.stroke() }
  for (let c = 0; c <= 10; c++) { const bx = (W * c) / 10; x.beginPath(); x.moveTo(W / 2, horizon); x.lineTo(bx, H); x.stroke() }
}
function gGlowScan(x: Ctx, W: number, H: number, p: Pal): void {
  fill(x, W, H, p.bg)
  x.globalCompositeOperation = 'lighter'
  for (const [fx, fy, c] of [[0.28, 0.4, p.accent], [0.72, 0.6, p.accent2 || p.accent]] as [number, number, string][]) {
    const [r, g, b] = hex2rgb(c); radial(x, fx * W, fy * H, 0.5 * W, `rgba(${r},${g},${b},0.32)`, `rgba(${r},${g},${b},0)`); x.fillRect(0, 0, W, H)
  }
  x.globalCompositeOperation = 'source-over'
  for (let y = 0; y < H; y += 3) { x.fillStyle = 'rgba(0,0,0,0.16)'; x.fillRect(0, y, W, 1) } // 掃描線
}
function gTechGrid(x: Ctx, W: number, H: number, p: Pal): void {
  fill(x, W, H, p.bg)
  const [lr, lg, lb] = hex2rgb(p.accent), step = W / 26
  x.strokeStyle = `rgba(${lr},${lg},${lb},0.16)`; x.lineWidth = 1
  for (let gx = 0; gx <= W; gx += step) { x.beginPath(); x.moveTo(gx, 0); x.lineTo(gx, H); x.stroke() }
  for (let gy = 0; gy <= H; gy += step) { x.beginPath(); x.moveTo(0, gy); x.lineTo(W, gy); x.stroke() }
  // 角準星
  x.strokeStyle = `rgba(${lr},${lg},${lb},0.5)`; x.lineWidth = 2
  for (const [cx, cy] of [[0.5, 0.5], [3.5, 2.5], [22.5, 14.5]] as [number, number][]) { const px = cx * step, py = cy * step; x.beginPath(); x.moveTo(px - 12, py); x.lineTo(px + 12, py); x.moveTo(px, py - 12); x.lineTo(px, py + 12); x.stroke() }
}
function gHalftone(x: Ctx, W: number, H: number, p: Pal): void {
  fill(x, W, H, p.bg)
  const [ar, ag, ab] = hex2rgb(p.accent), step = W / 60
  for (let gy = 0; gy < H; gy += step) for (let gx = 0; gx < W; gx += step) {
    const d = 1 - (gx / W) * 0.65; x.fillStyle = `rgba(${ar},${ag},${ab},${0.42 * d})`; x.beginPath(); x.arc(gx, gy, step * 0.42 * d, 0, 7); x.fill()
  }
}
function gScatter(x: Ctx, W: number, H: number, p: Pal): void {
  fill(x, W, H, p.bg)
  const cols = [p.accent, p.accent2 || p.accent, p.accent3 || p.ink], r = mkRnd(23)
  for (let i = 0; i < 90; i++) {
    const c = cols[Math.floor(r() * cols.length)], [cr, cg, cb] = hex2rgb(c)
    x.save(); x.translate(r() * W, r() * H); x.rotate((r() - 0.5) * 1.2); x.globalAlpha = 0.16 + r() * 0.18; x.fillStyle = `rgb(${cr},${cg},${cb})`
    const s = (8 + r() * 26) * (W / 1600), k = r()
    if (k < 0.4) x.fillRect(-s / 2, -s / 2, s, s)
    else if (k < 0.7) { x.beginPath(); x.arc(0, 0, s / 2, 0, 7); x.fill() }
    else { x.beginPath(); x.moveTo(0, -s / 2); x.lineTo(s / 2, s / 2); x.lineTo(-s / 2, s / 2); x.closePath(); x.fill() }
    x.restore()
  }
}
function gWaves(x: Ctx, W: number, H: number, p: Pal): void {
  fill(x, W, H, p.accent) // 淺海色頂
  const [br, bg, bb] = hex2rgb(p.bg)
  for (let i = 0; i < 4; i++) {
    const t = (i + 1) / 4, y = H * (0.3 + t * 0.6)
    x.fillStyle = `rgba(${br},${bg},${bb},${0.45 + i * 0.16})`
    x.beginPath(); x.moveTo(0, y); x.bezierCurveTo(W * 0.3, y - 50 * (W / 1600), W * 0.7, y + 50 * (W / 1600), W, y - 20 * (W / 1600)); x.lineTo(W, H); x.lineTo(0, H); x.closePath(); x.fill()
  }
}
function gCrackle(x: Ctx, W: number, H: number, p: Pal): void {
  fill(x, W, H, p.bg)
  // 青瓷釉色不均
  const [ir, ig, ib] = hex2rgb(p.ink)
  for (let i = 0; i < 4; i++) { radial(x, mkRnd(i + 1)() * W, mkRnd(i + 5)() * H, 0.4 * W, `rgba(${ir},${ig},${ib},0.08)`, `rgba(${ir},${ig},${ib},0)`); x.fillRect(0, 0, W, H) }
  const r = mkRnd(5)
  x.strokeStyle = `rgba(${ir},${ig},${ib},0.22)`; x.lineWidth = 1
  for (let i = 0; i < 130; i++) { let px = r() * W, py = r() * H; x.beginPath(); x.moveTo(px, py); for (let s = 0; s < 4; s++) { px += (r() - 0.5) * 150; py += (r() - 0.5) * 150; x.lineTo(px, py) } x.stroke() }
}
function gSoftMesh(x: Ctx, W: number, H: number, p: Pal): void {
  fill(x, W, H, p.bg)
  for (const [fx, fy, c] of [[0.18, 0.22, p.accent], [0.82, 0.38, p.accent2 || p.accent], [0.5, 0.88, p.accent3 || p.accent]] as [number, number, string][]) {
    const [r, g, b] = hex2rgb(c); radial(x, fx * W, fy * H, 0.72 * W, `rgba(${r},${g},${b},0.42)`, `rgba(${r},${g},${b},0)`); x.fillRect(0, 0, W, H)
  }
}
function gLowPoly(x: Ctx, W: number, H: number, p: Pal): void {
  fill(x, W, H, p.bg)
  const [ar, ag, ab] = hex2rgb(p.accent), r = mkRnd(9), cols = 8, rows = 5
  for (let gy = 0; gy < rows; gy++) for (let gx = 0; gx < cols; gx++) {
    const cw = W / cols, ch = H / rows, px = gx * cw, py = gy * ch, a = 0.04 + r() * 0.1
    x.fillStyle = `rgba(${ar},${ag},${ab},${a})`
    x.beginPath(); x.moveTo(px, py); x.lineTo(px + cw, py); x.lineTo(px, py + ch); x.closePath(); x.fill()
    x.fillStyle = `rgba(${ar},${ag},${ab},${a * 0.6})`
    x.beginPath(); x.moveTo(px + cw, py); x.lineTo(px + cw, py + ch); x.lineTo(px, py + ch); x.closePath(); x.fill()
  }
}
function gMarble(x: Ctx, W: number, H: number, p: Pal): void {
  fill(x, W, H, p.bg)
  const r = mkRnd(3)
  for (let i = 0; i < 22; i++) { x.strokeStyle = `rgba(120,116,108,${0.04 + r() * 0.06})`; x.lineWidth = (1 + r() * 4) * (W / 1600); let px = r() * W, py = r() * H; x.beginPath(); x.moveTo(px, py); for (let s = 0; s < 6; s++) { px += (r() - 0.3) * 260; py += (r() - 0.5) * 90; x.bezierCurveTo(px - 40, py + 20, px + 30, py - 25, px, py) } x.stroke() }
  if (p.accent) { const [ar, ag, ab] = hex2rgb(p.accent); x.strokeStyle = `rgba(${ar},${ag},${ab},0.25)`; x.lineWidth = 1.4; let px = 0, py = 0.4 * H; x.beginPath(); x.moveTo(px, py); for (let s = 0; s < 8; s++) { px += W / 8; py += (r() - 0.5) * 70; x.lineTo(px, py) } x.stroke() }
}
function gChalk(x: Ctx, W: number, H: number, p: Pal): void {
  fill(x, W, H, p.bg)
  grain(x, W, H, 16000, '255,255,255', 0.04, 13) // 粉筆灰
  const [ar, ag, ab] = hex2rgb(p.accent || 'FFFFFF')
  x.strokeStyle = `rgba(${ar},${ag},${ab},0.1)`; x.lineWidth = 1; x.setLineDash([8, 6])
  for (let i = 0; i < 3; i++) { const y = (0.3 + i * 0.22) * H; x.beginPath(); x.moveTo(0.06 * W, y); x.lineTo(0.94 * W, y); x.stroke() }
  x.setLineDash([])
}
function gNoise(x: Ctx, W: number, H: number, p: Pal): void {
  fill(x, W, H, p.bg)
  grain(x, W, H, 20000, p.ink === '000000' ? '0,0,0' : '40,40,40', 0.05, 17)
  if (p.accent) { x.fillStyle = p.accent; x.fillRect(0, 0.88 * H, W, 0.025 * H) } // 粗底色帶
}
function gFestive(x: Ctx, W: number, H: number, p: Pal): void {
  // 紅金絲緞：對角紅漸層 + 金斜光帶 + 細金粉 + 金框
  const [br, bgc, bb] = hex2rgb(p.bg)
  const lt = (m: number) => `rgb(${Math.min(255, Math.round(br + (255 - br) * m))},${Math.min(255, Math.round(bgc + (255 - bgc) * m))},${Math.min(255, Math.round(bb + (255 - bb) * m))})`
  const dk = (m: number) => `rgb(${Math.round(br * m)},${Math.round(bgc * m)},${Math.round(bb * m)})`
  const g = x.createLinearGradient(0, 0, W, H)
  g.addColorStop(0, dk(0.9)); g.addColorStop(0.5, lt(0.12)); g.addColorStop(1, dk(0.82))
  x.fillStyle = g; x.fillRect(0, 0, W, H)
  const [ar, ag, ab] = hex2rgb(p.accent)
  x.globalCompositeOperation = 'lighter'
  for (let i = 0; i < 6; i++) {
    x.save(); x.translate(W * (0.1 + i * 0.16), 0); x.rotate(0.5)
    const lg = x.createLinearGradient(0, 0, 90 * (W / 1600), 0)
    lg.addColorStop(0, `rgba(${ar},${ag},${ab},0)`); lg.addColorStop(0.5, `rgba(${ar},${ag},${ab},${0.05 + (i % 2) * 0.03})`); lg.addColorStop(1, `rgba(${ar},${ag},${ab},0)`)
    x.fillStyle = lg; x.fillRect(0, -H, 90 * (W / 1600), 3 * H); x.restore()
  }
  x.globalCompositeOperation = 'source-over'
  const r = mkRnd(5)
  for (let i = 0; i < 800; i++) { x.fillStyle = `rgba(${ar},${ag},${ab},${0.1 + r() * 0.3})`; x.fillRect(r() * W, r() * H, 1, 1) }
  x.strokeStyle = `rgba(${ar},${ag},${ab},0.5)`; x.lineWidth = 2 * (W / 1600); x.strokeRect(W * 0.025, H * 0.04, W * 0.95, H * 0.92)
}

// ───────── 每套 pack → generator + 色板 ─────────
type Gen = (x: Ctx, W: number, H: number, p: Pal) => void
const TEX: Record<string, [Gen, Pal]> = {
  // core
  inkwell: [gInkWash, { bg: '#FBFAF7', ink: '1A1A1A', accent: '#C0341F' }],
  celadon: [gCrackle, { bg: '#E8F0EA', ink: '3A5246', accent: '#B07A4A' }],
  dawn: [gSoftMesh, { bg: '#FFF7EC', ink: '3A2E1A', accent: '#F5A623', accent2: '#F7C56B', accent3: '#FAD9A0' }],
  nocturne: [gNebula, { bg: '#10131C', ink: 'C9D2E0', accent: 'D4A94E', accent2: '2A3550', accent3: '3A2F50' }],
  grid: [gTechGrid, { bg: '#FFFFFF', ink: '1A1A1A', accent: '#1E50A0' }],
  seminar: [gSoftMesh, { bg: '#0F1A2E', ink: 'E6ECF5', accent: 'C8A84E', accent2: '2A3E5E' }],
  // gallery1
  chalk: [gChalk, { bg: '#1E3A30', ink: 'EAF2EC', accent: '#EAF2EC' }],
  press: [gPaper, { bg: '#F7F5EF', ink: '2A2A2A', accent: '#C0231F' }],
  neon: [gGlowScan, { bg: '#0A0A14', ink: 'E6F0FF', accent: '00E5FF', accent2: 'FF2D9B' }],
  confetti: [gScatter, { bg: '#FCFBF8', ink: '2A2A2A', accent: '#FF5C5C', accent2: '#36C', accent3: '#FFC533' }],
  pastel: [gSoftMesh, { bg: '#FBF7FB', ink: '4A4458', accent: '#F0A6C8', accent2: '#A6C8F0', accent3: '#A6E0C8' }],
  // gallery2
  blueprint: [gTechGrid, { bg: '#0F3F6E', ink: 'F0F6FF', accent: '#BFD7F2' }],
  ivy: [gPaper, { bg: '#F4F1E6', ink: '23402B', accent: '#1F4D2E' }],
  redgrid: [gTechGrid, { bg: '#FBF7F2', ink: '2A2A2A', accent: '#C0231F' }],
  transit: [gSoftMesh, { bg: '#F5F6F8', ink: '17191C', accent: '#F2B705', accent2: '#17191C' }],
  ocean: [gWaves, { bg: '#0A2A4A', ink: 'D0E4F0', accent: '#3A7CA8' }],
  // gallery3
  washi: [gPaper, { bg: '#F7F3EA', ink: '2B2B27', accent: '#C8501F' }],
  terminal: [gGlowScan, { bg: '#0D1117', ink: 'E6EDF3', accent: '3FB950', accent2: '2EA043' }],
  pixel: [gHalftone, { bg: '#1A1C2C', ink: 'F4F4F6', accent: '#FF004D' }],
  botanic: [gPaper, { bg: '#FBF8F1', ink: '23402B', accent: '#6B8F3C' }],
  // gallery4
  marble: [gMarble, { bg: '#F5F2EC', ink: '262421', accent: '#A8852E' }],
  origami: [gLowPoly, { bg: '#FBFBFC', ink: '1F2937', accent: '#E0314B' }],
  cinema: [gGlowScan, { bg: '#151210', ink: 'EFE7D8', accent: 'E8A33D', accent2: 'C8822A' }],
  festival: [gFestive, { bg: '#9E1B1B', ink: 'FFF6E8', accent: '#E8B14E' }],
  // gallery5
  comic: [gHalftone, { bg: '#FAF6EE', ink: '15151A', accent: '#E63B2E' }],
  manuscript: [gPaper, { bg: '#F3E9D2', ink: '3A2218', accent: '#B68A2E' }],
  isometric: [gTechGrid, { bg: '#EEF1F5', ink: '222834', accent: '#3D6CF0' }],
  glitch: [gGlowScan, { bg: '#0A0A12', ink: 'E8E8F0', accent: 'FF2D6F', accent2: '16E0E0' }],
  // gallery6
  vapor: [gSunset, { bg: '#271B3F', ink: 'FDE9F4', accent: '#FF6AD5', accent2: '#7A4AA0', accent3: '#05D9E8' }],
  bauhaus: [gScatter, { bg: '#F2EFE6', ink: '1A1A1A', accent: '#D5301E', accent2: '#1E50A0', accent3: '#F2B705' }],
  cosmos: [gNebula, { bg: '#0B1026', ink: 'E8ECFF', accent: 'F4C95D', accent2: '785AD8', accent3: '2878C8' }],
  // gallery7
  scrapbook: [gPaper, { bg: '#EFE7D6', ink: '3A352C', accent: '#5BB0A6' }],
  sumi: [gInkWash, { bg: '#F6F3EC', ink: '1C1B19', accent: '#B33A26' }],
  brutalist: [gNoise, { bg: '#F4F4F0', ink: '000000', accent: '#FF4D00' }],
}

/** 攞招牌紋理 PNG data URI（瀏覽器先有；node/SSR 或未登記 pack 回 null → fallback）。 */
export function coverTextureUri(packId: string, w = 1600, h = 900): string | null {
  if (typeof document === 'undefined') return null
  const entry = TEX[packId]
  if (!entry) return null
  try {
    const canvas = document.createElement('canvas')
    canvas.width = w; canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    entry[0](ctx, w, h, entry[1])
    return canvas.toDataURL('image/png')
  } catch {
    return null
  }
}
