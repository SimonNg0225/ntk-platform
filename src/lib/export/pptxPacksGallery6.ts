// ============================================================
//  pptx template packs — gallery 第六輯（蒸汽波／包浩斯／星圖）
//  ------------------------------------------------------------
//  · 蒸汽波 vapor   — Y2K 復古：透視地網格 + 橫紋落日 + Memphis 碎片
//  · 包浩斯 bauhaus — 幾何構成：三原色圓／三角／方塊 + 粗黑斜桿
//  · 星圖 cosmos    — 星空宇宙：星野 + 星座連線 + 軌道環
//  鐵律同 pptxPacks.ts：所有文字經 tx()；色 6 位 hex 無 #；
//  shadow 只准 outer；無 gradient／SVG；rectRadius 單位吋。
//  形狀只准 rect／roundRect／ellipse／line／chevron／triangle —
//  所有母題由此六基本形拼砌（透視網 = 多條 line，軌道 = ellipse 框，
//  星 = 細實心 ellipse 點，Memphis 曲線 = 短 chevron／triangle）。
// ============================================================

import type PptxGenJS from 'pptxgenjs'
import {
  addCoverImage,
  dateLabel,
  drawFooter,
  hline,
  pad2,
  photoCreditOnImage,
  scaffold,
  sectionWord,
  tx,
  type FrameCtx,
  type Pack,
  type Rect,
} from './pptxPacks'
import type { Slide } from './types'
import { clampText, estimateLines, fitTitle, mix } from './pptxText'
import { gradLinear, gradRadial } from './pptxGradients'

// ============================================================
//  蒸汽波 vapor — Y2K 復古
//  深靛藍底 + 近白粉墨 + 桃紅／青二重點睛：成個 deck 似 80s／Y2K
//  retrowave 海報 —— 透視地網格沿版底鋪開、太陽由桃青橫紋砌成、
//  Memphis 小碎片（短 chevron／triangle）散落角位。
// ============================================================

const VAP = { bg: '271B3F', ink: 'FDE9F4', soft: 'CBB6D6', faint: '8E7AA3', hair: '4A3A66', pink: 'FF6AD5', cyan: '05D9E8', panel: '3A2A57' }

/**
 * 透視地網格：橫線（地平線下逐條收窄間距）+ 多條由底邊射向消失點嘅斜線。
 * 全部極淡（grid color）。cx = 消失點橫座標，vy = 消失點縱座標（=地平線）。
 */
function perspGrid(slide: PptxGenJS.Slide, x: number, vy: number, w: number, bottom: number, color: string): void {
  const cx = x + w / 2
  // 橫線：由地平線往下，間距逐條加大（透視）
  const rows = 7
  for (let r = 1; r <= rows; r++) {
    const t = r / rows
    const ly = vy + (bottom - vy) * (t * t) // 平方 = 近大遠細
    hline(slide, x, ly, w, color, 0.75)
  }
  // 射線：由底邊等距點連向消失點
  const cols = 9
  for (let c = 0; c <= cols; c++) {
    const bx = x + (w * c) / cols
    slide.addShape('line', { x: cx, y: vy, w: bx - cx, h: bottom - vy, line: { color, width: 0.75 } })
  }
}

/**
 * 橫紋落日：喺一個圓形範圍內由上而下疊短 hline，桃／青交替。
 * 落日下半截條紋逐條變短（模擬圓邊收窄）。cx/cy = 圓心，r = 半徑。
 */
function bandedSun(slide: PptxGenJS.Slide, cx: number, cy: number, r: number): void {
  const bands = 9
  for (let b = 0; b < bands; b++) {
    const t = (b + 0.5) / bands
    const ly = cy - r + 2 * r * t // 由頂到底
    // 圓邊半弦長：sqrt(r^2 - (ly-cy)^2)
    const dy = ly - cy
    const half = Math.sqrt(Math.max(0, r * r - dy * dy))
    const col = b % 2 === 0 ? VAP.pink : VAP.cyan
    // 上半截實、下半截條紋（retrowave 落日特色：下方有橫斷間隙）
    const pt = b < bands / 2 ? 4 : 3
    hline(slide, cx - half, ly, half * 2, col, pt)
  }
}

/** Memphis 小碎片：一束 2-3 個短 chevron／triangle（kind 決定形態、rot 決定朝向） */
function memphisBit(slide: PptxGenJS.Slide, x: number, y: number, size: number, kind: number, color: string): void {
  if (kind === 0) {
    slide.addShape('chevron', { x, y, w: size, h: size * 0.7, fill: { color }, line: { type: 'none' } })
    slide.addShape('chevron', { x: x + size * 0.5, y, w: size, h: size * 0.7, fill: { color }, line: { type: 'none' } })
  } else if (kind === 1) {
    slide.addShape('triangle', { x, y, w: size, h: size, fill: { color }, line: { type: 'none' }, rotate: 0 })
    slide.addShape('triangle', { x: x + size * 0.7, y: y + size * 0.2, w: size * 0.7, h: size * 0.7, fill: { color }, line: { type: 'none' }, rotate: 180 })
  } else if (kind === 2) {
    slide.addShape('chevron', { x, y, w: size, h: size * 0.7, fill: { color }, line: { type: 'none' }, rotate: 90 })
    slide.addShape('triangle', { x: x + size * 0.4, y: y + size * 0.6, w: size * 0.6, h: size * 0.6, fill: { color }, line: { type: 'none' }, rotate: 270 })
  } else {
    slide.addShape('triangle', { x, y, w: size, h: size, fill: { color }, line: { type: 'none' }, rotate: 90 })
    slide.addShape('triangle', { x: x + size * 0.55, y, w: size, h: size, fill: { color }, line: { type: 'none' }, rotate: 270 })
  }
}

/**
 * 招牌：stats 渲染成「落日條紋 tile」——
 * 各 stat 一塊 tile，tile 底由幾條桃／青交替橫帶鋪滿（retrowave 落日），
 * 巨號值疊喺條紋之上、標籤喺下。Y2K 海報數字感。2–4 項。
 */
function renderVaporSunsetTiles(slide: PptxGenJS.Slide, body: Rect, pack: Pack, s: Slide): void {
  const items = (s.stats ?? []).slice(0, 4)
  if (items.length < 2) return
  const n = items.length
  const gap = 0.4
  const cw = (body.w - gap * (n - 1)) / n
  const th = Math.min(2.8, body.h - 0.5)
  const ty = body.y + (body.h - th) / 2
  const bandZone = th * 0.62 // 上半塊鋪條紋
  items.forEach((st, i) => {
    const cx = body.x + i * (cw + gap)
    // tile 底板（panel）
    slide.addShape('roundRect', { x: cx, y: ty, w: cw, h: th, rectRadius: pack.cardRadius, fill: { color: pack.panel }, line: { color: mix(VAP.pink, pack.bg, 0.4), width: 1 } })
    // 落日漸層：桃紅（頂）→ 紫 → 青（底），由 gradFill 注入（取代假橫帶）
    const sunset = gradLinear(90, [
      { pos: 0, color: VAP.pink },
      { pos: 50, color: mix(VAP.pink, VAP.cyan, 0.5) },
      { pos: 100, color: VAP.cyan },
    ])
    slide.addShape('rect', { x: cx + 0.08, y: ty + 0.08, w: cw - 0.16, h: bandZone - 0.02, fill: { color: sunset }, line: { type: 'none' } })
    // 巨號值（疊喺條紋之上）
    tx(slide, clampText(st.value.trim(), 8), { x: cx + 0.1, y: ty + 0.12, w: cw - 0.2, h: bandZone, fontSize: 52, bold: true, color: pack.ink, align: 'center', valign: 'middle', fontFace: pack.displayFont, fit: 'shrink' })
    // 標籤（條紋下）
    tx(slide, clampText(st.label.trim(), 22), { x: cx + 0.14, y: ty + bandZone + 0.12, w: cw - 0.28, h: th - bandZone - 0.24, fontSize: 13, color: pack.inkSoft, align: 'center', valign: 'middle', lineSpacingMultiple: 1.16, fit: 'shrink' })
  })
}

const vapor: Pack = {
  id: 'vapor',
  name: '蒸汽波',
  hint: 'Y2K 復古 · 流行文化',
  swatches: ['#271B3F', '#FF6AD5', '#05D9E8'],
  dark: true,
  bg: VAP.bg,
  ink: VAP.ink,
  inkSoft: VAP.soft,
  faint: VAP.faint,
  hair: VAP.hair,
  accent: VAP.pink,
  statColor: VAP.cyan,
  panel: VAP.panel,
  cardRadius: 0.06,
  displayFont: 'Arial Black',
  displayItalic: false,
  pageNoColor: VAP.soft,
  chartColors: ['FF6AD5', '05D9E8', 'B388EB', 'F8C8E8'],
  chartGridColor: VAP.hair,
  bulletPt: [18, 18, 17, 17, 16],
  titlePt: 28,
  marker: { kind: 'triangle', size: 0.11, color: VAP.pink, indent: 0.32 },
  tileStyle: 'panel',
  compareStyle: 'panels',
  stepNode: { kind: 'roundSquareFill', size: 0.32, color: VAP.pink, numColor: VAP.bg },
  quoteMark: { kind: 'glyph', color: mix(VAP.pink, VAP.bg, 0.4) },
  splitPhoto: 'bleedScrim',
  overrides: { stats: renderVaporSunsetTiles },

  // 逐版母題：一束極淡 Memphis 小碎片（短 chevron／triangle），
  // 形態按 seq % 4 輪換、角位亦按 seq 走（似海報飄過嘅貼紙）。
  deco(slide, ctx: FrameCtx) {
    const spots: [number, number][] = [
      [12.5, 0.5], // 右上
      [0.3, 6.9], // 左下
      [12.5, 6.9], // 右下
      [0.3, 0.5], // 左上
    ]
    const [dx, dy] = spots[ctx.seq % 4]
    const col = mix(ctx.seq % 2 === 0 ? VAP.pink : VAP.cyan, VAP.bg, 0.45)
    memphisBit(slide, dx, dy, 0.22, ctx.seq % 4, col)
  },

  cover(slide, deck, brand, img) {
    slide.background = { color: VAP.bg }
    const hasImg = Boolean(img)
    // 版底透視地網格（地平線 ~4.7）
    perspGrid(slide, 0, 4.7, 13.33, 7.5, mix(VAP.cyan, VAP.bg, 0.7))
    // 橫紋落日（右上，無相時擺大）
    if (!hasImg) {
      // 真放射落日輝光：桃紅中心 → 青淡出（墊喺橫紋落日後）
      const sunR = 1.7 * 1.5
      slide.addShape('ellipse', {
        x: 10.4 - sunR,
        y: 2.5 - sunR,
        w: sunR * 2,
        h: sunR * 2,
        fill: {
          color: gradRadial([
            { pos: 0, color: VAP.pink, alpha: 42 },
            { pos: 60, color: mix(VAP.pink, VAP.cyan, 0.5), alpha: 18 },
            { pos: 100, color: VAP.cyan, alpha: 0 },
          ]),
        },
        line: { type: 'none' },
      })
      bandedSun(slide, 10.4, 2.5, 1.7)
    }
    // kicker
    tx(slide, 'TEACHING DECK · 教學簡報', { x: 0.9, y: 1.0, w: 8, h: 0.3, fontSize: 10, color: VAP.cyan, charSpacing: 4, bold: true })
    // retro 大題：桃紅本體 + 青色 offset 重影（先畫青影、後畫桃本體）
    const titleW = hasImg ? 6.2 : 9.4
    const fit = fitTitle(deck.title, 'cover')
    const lines = Math.max(1, Math.min(2, estimateLines(deck.title, fit.fontPt, titleW)))
    tx(slide, deck.title, { x: 0.97, y: 2.42, w: titleW, h: 1.55, fontSize: fit.fontPt, bold: true, color: mix(VAP.cyan, VAP.bg, 0.15), lineSpacingMultiple: 1.06, fit: 'shrink' })
    tx(slide, deck.title, { x: 0.9, y: 2.35, w: titleW, h: 1.55, fontSize: fit.fontPt, bold: true, color: VAP.pink, lineSpacingMultiple: 1.06, fit: 'shrink' })
    if (deck.subtitle) {
      const subY = 2.35 + (lines * fit.fontPt * 1.06) / 72 + 0.26
      tx(slide, deck.subtitle, { x: 0.9, y: subY, w: hasImg ? 5.9 : 9, h: 0.5, fontSize: 15, color: VAP.ink })
    }
    if (img) {
      // 右側相 + 桃紅框 + 青色 offset 影
      const frame: Rect = { x: 7.7, y: 1.4, w: 4.8, h: 3.6 }
      slide.addShape('rect', { x: frame.x + 0.1, y: frame.y + 0.1, w: frame.w, h: frame.h, fill: { color: mix(VAP.cyan, VAP.bg, 0.2) }, line: { type: 'none' } })
      addCoverImage(slide, img, frame)
      slide.addShape('rect', { x: frame.x, y: frame.y, w: frame.w, h: frame.h, fill: { type: 'none' }, line: { color: VAP.pink, width: 1.5 } })
      photoCreditOnImage(slide, img.credit, frame)
    }
    // Memphis 碎片散落（左下 + 右上）
    memphisBit(slide, 0.95, 6.45, 0.26, 0, mix(VAP.pink, VAP.bg, 0.3))
    memphisBit(slide, 2.0, 6.5, 0.22, 2, mix(VAP.cyan, VAP.bg, 0.35))
    // 期 + brand
    tx(slide, dateLabel(), { x: 0.9, y: 6.95, w: 5, h: 0.3, fontSize: 10, color: VAP.cyan })
    tx(slide, brand, { x: 9.43, y: 7.05, w: 3, h: 0.3, fontSize: 9, color: VAP.faint, align: 'right' })
  },

  section(slide, no, title) {
    slide.background = { color: VAP.bg }
    // 版底透視網格 + 大橫紋落日（章節 = 海報 hero）
    perspGrid(slide, 0, 5.1, 13.33, 7.5, mix(VAP.cyan, VAP.bg, 0.72))
    bandedSun(slide, 6.665, 2.4, 2.0)
    // 巨號（青色 offset + 桃本體，疊喺落日上）
    tx(slide, pad2(no), { x: 0.87, y: 1.27, w: 6, h: 2.9, fontSize: 150, bold: true, color: mix(VAP.cyan, VAP.bg, 0.25), fontFace: 'Arial Black' })
    tx(slide, pad2(no), { x: 0.8, y: 1.2, w: 6, h: 2.9, fontSize: 150, bold: true, color: mix(VAP.pink, VAP.bg, 0.15), fontFace: 'Arial Black' })
    tx(slide, title, { x: 0.9, y: 5.4, w: 11.2, h: 1.2, fontSize: 32, bold: true, color: VAP.ink })
    tx(slide, `SECTION ${sectionWord(no)}`, { x: 0.9, y: 6.62, w: 6, h: 0.3, fontSize: 9, color: VAP.cyan, charSpacing: 4 })
  },

  contentFrame(slide, ctx) {
    slide.background = { color: VAP.bg }
    const { body } = scaffold(slide, vapor, ctx, { kickerY: 0.58, titleY: 0.9, hairline: true })
    // 右上小橫紋落日（配圖出血版省略）
    if (!ctx.hasPhoto) bandedSun(slide, 12.0, 0.95, 0.42)
    drawFooter(slide, vapor, ctx)
    return body
  },
}

// ============================================================
//  包浩斯 bauhaus — 幾何構成
//  米白底 + 純黑墨 + 三原色（紅／藍／黃）：純幾何 primitives —
//  圓（ellipse）、三角（triangle）、方（rect）作唯一 motif，
//  大膽不對稱擺位，配一條粗黑斜桿（rotate rect）。零圓角、粗體。
// ============================================================

const BAU = { bg: 'F2EFE6', ink: '1A1A1A', soft: '4A4A46', faint: '8A8A84', hair: 'D8D4C8', red: 'D5301E', blue: '1E50A0', yellow: 'F2B705', panel: 'EAE6DA' }

const BAU_PRIMARIES = [BAU.red, BAU.blue, BAU.yellow]

/** 三原色圓 */
function bauCircle(slide: PptxGenJS.Slide, x: number, y: number, d: number, color: string): void {
  slide.addShape('ellipse', { x, y, w: d, h: d, fill: { color }, line: { type: 'none' } })
}

/** 三原色三角 */
function bauTri(slide: PptxGenJS.Slide, x: number, y: number, size: number, color: string, rotate = 0): void {
  slide.addShape('triangle', { x, y, w: size, h: size, fill: { color }, line: { type: 'none' }, rotate })
}

/** 三原色方 */
function bauSquare(slide: PptxGenJS.Slide, x: number, y: number, size: number, color: string): void {
  slide.addShape('rect', { x, y, w: size, h: size, fill: { color }, line: { type: 'none' } })
}

/** 粗黑斜桿（rotate rect）：cx/cy = 中心，len = 長，thick = 厚 */
function bauBar(slide: PptxGenJS.Slide, cx: number, cy: number, len: number, thick: number, deg: number, color: string): void {
  slide.addShape('rect', { x: cx - len / 2, y: cy - thick / 2, w: len, h: thick, fill: { color }, line: { type: 'none' }, rotate: deg })
}

/**
 * 招牌母題：喺卡角畫一個 primitive（圓／三角／方按 index 輪換、三原色按 index 輪換）。
 * 統一接口俾 renderBauhausBlocks 同 deco 用。
 */
function bauPrimitive(slide: PptxGenJS.Slide, x: number, y: number, size: number, idx: number, color: string): void {
  const k = idx % 3
  if (k === 0) bauCircle(slide, x, y, size, color)
  else if (k === 1) bauTri(slide, x, y, size, color)
  else bauSquare(slide, x, y, size, color)
}

/**
 * 招牌：cards 渲染成「幾何構成塊」——
 * 各卡一塊大膽色塊（白底 + 粗黑框），卡角一個 primitive（圓／三角／方
 * 按 index 輪換、三原色按 index 輪換），純黑粗標題、正文。包浩斯構成感。2–6 卡。
 */
function renderBauhausBlocks(slide: PptxGenJS.Slide, body: Rect, pack: Pack, s: Slide): void {
  const items = (s.cards ?? []).slice(0, 6)
  if (items.length < 2) return
  const n = items.length
  const cols = n <= 2 ? n : n <= 4 ? 2 : 3
  const rows = Math.ceil(n / cols)
  const gap = 0.34
  const cw = (body.w - gap * (cols - 1)) / cols
  const ch = (body.h - gap * (rows - 1)) / rows
  const corner = Math.min(0.56, ch * 0.3, cw * 0.24)
  items.forEach((card, i) => {
    const r = Math.floor(i / cols)
    const c = i % cols
    const cx = body.x + c * (cw + gap)
    const cy = body.y + r * (ch + gap)
    const prim = BAU_PRIMARIES[i % 3]
    // 大膽色塊：白底 + 粗黑框（零圓角）
    slide.addShape('rect', { x: cx, y: cy, w: cw, h: ch, fill: { color: 'FFFFFF' }, line: { color: pack.ink, width: 2.5 } })
    // 卡角 primitive（右上角，圓／三角／方輪換）
    bauPrimitive(slide, cx + cw - corner - 0.22, cy + 0.22, corner, i, prim)
    // 純黑粗標題（左對齊，避開右上 primitive）
    tx(slide, clampText(card.title.trim(), 14), { x: cx + 0.26, y: cy + 0.26, w: cw - corner - 0.6, h: 0.86, fontSize: 18, bold: true, color: pack.ink, lineSpacingMultiple: 1.04, fontFace: pack.displayFont, fit: 'shrink' })
    // 卡內粗黑分隔桿
    slide.addShape('rect', { x: cx + 0.26, y: cy + corner + 0.34, w: cw - 0.52, h: 0.05, fill: { color: pack.ink }, line: { type: 'none' } })
    // 正文
    if (card.desc) {
      tx(slide, clampText(card.desc.trim(), 80), { x: cx + 0.26, y: cy + corner + 0.5, w: cw - 0.52, h: ch - corner - 0.74, fontSize: 12, color: pack.inkSoft, lineSpacingMultiple: 1.22, fit: 'shrink' })
    }
  })
}

const bauhaus: Pack = {
  id: 'bauhaus',
  name: '包浩斯',
  hint: '幾何構成 · 藝術/設計',
  swatches: ['#D5301E', '#1E50A0', '#F2B705'],
  dark: false,
  bg: BAU.bg,
  ink: BAU.ink,
  inkSoft: BAU.soft,
  faint: BAU.faint,
  hair: BAU.hair,
  accent: BAU.red,
  statColor: BAU.red,
  panel: BAU.panel,
  cardRadius: 0,
  displayFont: 'Arial Black',
  displayItalic: false,
  pageNoColor: BAU.soft,
  chartColors: ['D5301E', '1E50A0', 'F2B705', '4A4A46'],
  chartGridColor: BAU.hair,
  bulletPt: [18, 18, 17, 17, 16],
  titlePt: 28,
  marker: { kind: 'square', size: 0.11, color: BAU.red, indent: 0.32 },
  tileStyle: 'cellBorder',
  compareStyle: 'panels',
  stepNode: { kind: 'squareFill', size: 0.34, color: BAU.ink, numColor: 'FFFFFF' },
  quoteMark: { kind: 'square', size: 0.16, color: BAU.red },
  splitPhoto: 'bleedHair',
  overrides: { cards: renderBauhausBlocks },

  // 逐版母題：一個小 primitive（圓／三角／方按 seq % 3 揀），
  // 三原色按 seq 輪換，角位按 seq 走（似構成練習嘅角落基本形）。
  deco(slide, ctx: FrameCtx) {
    const spots: [number, number][] = [
      [12.55, 0.5],
      [0.36, 6.86],
      [12.55, 6.86],
      [0.36, 0.5],
    ]
    const [dx, dy] = spots[ctx.seq % 4]
    const col = BAU_PRIMARIES[ctx.seq % 3]
    bauPrimitive(slide, dx, dy, 0.2, ctx.seq % 3, col)
  },

  cover(slide, deck, brand, img) {
    slide.background = { color: BAU.bg }
    const hasImg = Boolean(img)
    // 全版極淡米白深度漸層（壓底，幾何構成浮其上）
    slide.addShape('rect', {
      x: 0,
      y: 0,
      w: 13.33,
      h: 7.5,
      fill: {
        color: gradLinear(90, [
          { pos: 0, color: mix(BAU.bg, 'FFFFFF', 0.04) },
          { pos: 100, color: mix(BAU.bg, BAU.ink, 0.06) },
        ]),
      },
      line: { type: 'none' },
    })
    // 包浩斯構圖：大紅圓（右上）+ 藍三角（右下）+ 黃方（角）+ 粗黑斜桿
    if (!hasImg) {
      // 大紅圓 hero：極淡受光漸層（頂亮 → 紅 → 底沉），保持平塗膽色
      slide.addShape('ellipse', {
        x: 9.0,
        y: 0.7,
        w: 3.4,
        h: 3.4,
        fill: {
          color: gradLinear(90, [
            { pos: 0, color: mix(BAU.red, 'FFFFFF', 0.18) },
            { pos: 100, color: mix(BAU.red, BAU.ink, 0.14) },
          ]),
        },
        line: { type: 'none' },
      })
      bauTri(slide, 9.3, 4.2, 2.8, BAU.blue, 180)
      bauSquare(slide, 11.7, 3.3, 1.0, BAU.yellow)
    }
    // 粗黑斜桿（橫貫構圖，不對稱）
    bauBar(slide, 9.7, 3.6, 5.2, 0.22, 28, BAU.ink)
    // kicker：黑方點 + 字
    bauSquare(slide, 0.9, 1.06, 0.16, BAU.ink)
    tx(slide, 'TEACHING DECK · 教學簡報', { x: 1.2, y: 1.02, w: 7, h: 0.3, fontSize: 10, color: BAU.ink, charSpacing: 3, bold: true })
    // 大膽黑粗題（左下，不對稱）
    const titleW = hasImg ? 6.0 : 7.6
    const fit = fitTitle(deck.title, 'cover')
    const lines = Math.max(1, Math.min(2, estimateLines(deck.title, fit.fontPt, titleW)))
    tx(slide, deck.title, { x: 0.9, y: 2.7, w: titleW, h: 1.7, fontSize: fit.fontPt, bold: true, color: BAU.ink, lineSpacingMultiple: 1.05, fit: 'shrink' })
    if (deck.subtitle) {
      const subY = 2.7 + (lines * fit.fontPt * 1.05) / 72 + 0.24
      tx(slide, deck.subtitle, { x: 0.9, y: subY, w: titleW, h: 0.5, fontSize: 15, color: BAU.soft })
    }
    if (img) {
      // 左下相 + 粗黑框 + 角落黃方
      const frame: Rect = { x: 0.9, y: 4.6, w: 5.6, h: 2.0 }
      addCoverImage(slide, img, frame)
      slide.addShape('rect', { x: frame.x, y: frame.y, w: frame.w, h: frame.h, fill: { type: 'none' }, line: { color: BAU.ink, width: 2.5 } })
      bauSquare(slide, frame.x + frame.w - 0.42, frame.y - 0.18, 0.36, BAU.yellow)
      photoCreditOnImage(slide, img.credit, frame)
    }
    // 期 + brand
    tx(slide, dateLabel(), { x: 0.9, y: 6.85, w: 5, h: 0.3, fontSize: 10, color: BAU.soft })
    tx(slide, brand, { x: 0.9, y: 7.15, w: 5, h: 0.3, fontSize: 9, color: BAU.faint })
  },

  section(slide, no, title) {
    slide.background = { color: BAU.bg }
    // 巨型原色 primitive（按章節號輪換）+ 大黑號
    const prim = BAU_PRIMARIES[(no - 1) % 3]
    bauPrimitive(slide, 8.4, 1.2, 4.0, no - 1, prim)
    bauBar(slide, 8.6, 3.0, 5.4, 0.24, 32, BAU.ink)
    tx(slide, pad2(no), { x: 0.8, y: 1.2, w: 6, h: 2.9, fontSize: 158, bold: true, color: BAU.ink, fontFace: 'Arial Black' })
    // 粗黑桿壓住標題列
    slide.addShape('rect', { x: 0.9, y: 4.4, w: 5.0, h: 0.08, fill: { color: BAU.red }, line: { type: 'none' } })
    tx(slide, title, { x: 0.9, y: 4.62, w: 8.0, h: 1.2, fontSize: 32, bold: true, color: BAU.ink })
    tx(slide, `SECTION ${sectionWord(no)}`, { x: 0.9, y: 5.85, w: 6, h: 0.3, fontSize: 9, color: BAU.faint, charSpacing: 4 })
  },

  contentFrame(slide, ctx) {
    slide.background = { color: BAU.bg }
    const { body } = scaffold(slide, bauhaus, ctx, { kickerY: 0.58, titleY: 0.9, hairline: true })
    // 右上三粒原色 primitive 小隊（配圖出血版省略）
    if (!ctx.hasPhoto) {
      bauCircle(slide, 11.5, 0.56, 0.24, BAU.red)
      bauTri(slide, 11.92, 0.56, 0.24, BAU.blue)
      bauSquare(slide, 12.34, 0.56, 0.24, BAU.yellow)
    }
    drawFooter(slide, bauhaus, ctx)
    return body
  },
}

// ============================================================
//  星圖 cosmos — 星空宇宙
//  午夜藍底 + 星光墨 + 金／青點睛：天文星圖意象 —— 散落細星點
//  （細實心 ellipse）作星野、細線連星成星座、同心 ellipse 框作軌道環。
//  封面題目浮喺星野上、一條金軌道弧掃過。
// ============================================================

const COS = { bg: '0B1026', ink: 'E8ECFF', soft: 'B4BCDB', faint: '7480A8', hair: '2A335A', gold: 'F4C95D', cyan: '6BD0E0', panel: '161C3A' }

/** 星野：散落 n 粒細實心 ellipse 星點（偽隨機，seed 決定佈局），極淡 */
function starfield(slide: PptxGenJS.Slide, area: Rect, count: number, seed: number, color: string): void {
  let v = seed * 9301 + 49297
  const rand = (): number => {
    v = (v * 9301 + 49297) % 233280
    return v / 233280
  }
  for (let k = 0; k < count; k++) {
    const sx = area.x + rand() * area.w
    const sy = area.y + rand() * area.h
    const d = 0.03 + rand() * 0.05
    slide.addShape('ellipse', { x: sx, y: sy, w: d, h: d, fill: { color }, line: { type: 'none' } })
  }
}

/** 星座連線：依序連 points（細線），點上加細星點 */
function constellation(slide: PptxGenJS.Slide, points: [number, number][], lineColor: string, starColor: string): void {
  for (let k = 0; k < points.length - 1; k++) {
    const [ax, ay] = points[k]
    const [bx, by] = points[k + 1]
    slide.addShape('line', { x: ax, y: ay, w: bx - ax, h: by - ay, line: { color: lineColor, width: 0.75 } })
  }
  for (const [px, py] of points) {
    slide.addShape('ellipse', { x: px - 0.04, y: py - 0.04, w: 0.08, h: 0.08, fill: { color: starColor }, line: { type: 'none' } })
  }
}

/** 軌道環：n 重同心 ellipse 框（outline only），cx/cy = 圓心 */
function orbitRings(slide: PptxGenJS.Slide, cx: number, cy: number, r0: number, rings: number, step: number, color: string): void {
  for (let k = 0; k < rings; k++) {
    const rr = r0 + k * step
    slide.addShape('ellipse', { x: cx - rr, y: cy - rr, w: rr * 2, h: rr * 2, fill: { type: 'none' }, line: { color, width: 0.75 } })
  }
}

/** 帶光暈星：細實心金點 + 外一圈極淡光暈環（cx/cy = 中心，d = 星直徑） */
function glowStar(slide: PptxGenJS.Slide, cx: number, cy: number, d: number, color: string, glow: string): void {
  const g = d * 3
  // 真光暈：放射漸層（中心 glow 半透 → 邊緣全透）
  slide.addShape('ellipse', { x: cx - g / 2, y: cy - g / 2, w: g, h: g, fill: { color: gradRadial([{ pos: 0, color: glow, alpha: 55 }, { pos: 100, color: glow, alpha: 0 }]) }, line: { type: 'none' } })
  slide.addShape('ellipse', { x: cx - d / 2, y: cy - d / 2, w: d, h: d, fill: { color }, line: { type: 'none' } })
}

/**
 * 招牌：steps 渲染成「星座」——
 * 各步一粒星（細實心 ellipse + 光暈環）沿一條輕微起伏嘅路徑排，
 * 星與星之間以細金「星座線」連起（似將星連成一個圖形），
 * 步號 tag + title + desc 喺各星附近。連星成座意象。2–5 步。
 */
function renderCosmosConstellation(slide: PptxGenJS.Slide, body: Rect, pack: Pack, s: Slide): void {
  const items = (s.steps ?? []).slice(0, 5)
  if (items.length < 2) return
  const n = items.length
  // 淡星野墊底
  starfield(slide, body, 26, n * 7 + 3, mix(pack.ink, pack.bg, 0.72))
  const x0 = body.x + 0.7
  const x1 = body.x + body.w - 0.7
  const seg = (x1 - x0) / (n - 1)
  const midY = body.y + body.h * 0.42
  const amp = Math.min(0.9, body.h * 0.18)
  // 各星座標（輕微起伏：正弦上下擺）
  const pts: [number, number][] = items.map((_, i) => {
    const px = x0 + seg * i
    const py = midY + Math.sin(i * 1.1) * amp
    return [px, py]
  })
  // 星座連線（細金線）
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i]
    const [bx, by] = pts[i + 1]
    slide.addShape('line', { x: ax, y: ay, w: bx - ax, h: by - ay, line: { color: mix(pack.accent, pack.bg, 0.35), width: 1 } })
  }
  items.forEach((st, i) => {
    const [cx, cy] = pts[i]
    // 星（金實心 + 光暈環）
    glowStar(slide, cx, cy, 0.16, pack.accent, mix(pack.accent, pack.bg, 0.55))
    // 步號 tag（星上方小圈）
    const tagD = 0.32
    slide.addShape('ellipse', { x: cx - tagD / 2, y: cy - amp - 0.62, w: tagD, h: tagD, fill: { color: pack.panel }, line: { color: pack.accent, width: 1 } })
    tx(slide, String(i + 1), { x: cx - tagD / 2, y: cy - amp - 0.62, w: tagD, h: tagD, fontSize: 12, bold: true, color: pack.accent, align: 'center', valign: 'middle', fontFace: pack.displayFont })
    // title + desc（星下，交錯避免重疊）
    const colW = Math.min(seg * 0.96, 2.5)
    const tcx = Math.max(body.x + 0.05, Math.min(cx - colW / 2, body.x + body.w - colW - 0.05))
    const labelY = cy + 0.22
    tx(slide, clampText(st.title.trim(), 12), { x: tcx, y: labelY, w: colW, h: 0.36, fontSize: 15, bold: true, color: pack.ink, align: 'center', fit: 'shrink' })
    if (st.desc) {
      tx(slide, clampText(st.desc.trim(), 40), { x: tcx, y: labelY + 0.4, w: colW, h: Math.max(0.3, body.y + body.h - labelY - 0.5), fontSize: 11, color: pack.inkSoft, align: 'center', lineSpacingMultiple: 1.18, fit: 'shrink' })
    }
  })
}

const cosmos: Pack = {
  id: 'cosmos',
  name: '星圖',
  hint: '星空宇宙 · 科學/地理',
  swatches: ['#0B1026', '#F4C95D', '#6BD0E0'],
  dark: true,
  bg: COS.bg,
  ink: COS.ink,
  inkSoft: COS.soft,
  faint: COS.faint,
  hair: COS.hair,
  accent: COS.gold,
  statColor: COS.cyan,
  panel: COS.panel,
  cardRadius: 0.06,
  displayFont: 'Georgia',
  displayItalic: false,
  pageNoColor: COS.soft,
  chartColors: ['F4C95D', '6BD0E0', '9B8CE0', 'B4BCDB'],
  chartGridColor: COS.hair,
  bulletPt: [18, 18, 17, 17, 16],
  titlePt: 28,
  marker: { kind: 'dot', size: 0.09, color: COS.gold, indent: 0.3 },
  tileStyle: 'panel',
  compareStyle: 'panels',
  stepNode: { kind: 'circleOutline', size: 0.34, color: COS.gold, numColor: COS.gold },
  quoteMark: { kind: 'glyph', color: mix(COS.gold, COS.bg, 0.45) },
  splitPhoto: 'bleedScrim',
  overrides: { steps: renderCosmosConstellation },

  // 逐版母題：幾粒極淡星野點 + 一粒較大有標籤嘅星，
  // 星位按 seq 沿頂邊推進（似逐版升起一顆新星），極淡。
  deco(slide, ctx: FrameCtx) {
    // 角落小星野
    starfield(slide, { x: 11.8, y: 6.7, w: 1.3, h: 0.7 }, 5, ctx.seq * 5 + 1, mix(COS.ink, COS.bg, 0.7))
    // 較大標籤星：x 按 seq 沿底邊推進
    const sx = 9.2 + (ctx.seq % 6) * 0.5
    glowStar(slide, sx, 7.18, 0.08, mix(COS.gold, COS.bg, 0.3), mix(COS.gold, COS.bg, 0.7))
  },

  cover(slide, deck, brand, img) {
    slide.background = { color: COS.bg }
    const hasImg = Boolean(img)
    if (img) {
      // full-bleed 相 + 午夜 scrim（星空疊喺暗景上）
      addCoverImage(slide, img, { x: 0, y: 0, w: 13.33, h: 7.5 })
      slide.addShape('rect', { x: 0, y: 0, w: 13.33, h: 7.5, fill: { color: COS.bg, transparency: 32 }, line: { type: 'none' } })
      photoCreditOnImage(slide, img.credit, { x: 0, y: 0, w: 13.33, h: 7.5 })
    }
    // 無相時：版底極淡午夜藍深度漸層（頂部微帶金暈，底沉）
    if (!img) {
      slide.addShape('rect', {
        x: 0,
        y: 0,
        w: 13.33,
        h: 7.5,
        fill: {
          color: gradLinear(90, [
            { pos: 0, color: mix(COS.bg, COS.gold, 0.06) },
            { pos: 100, color: COS.bg },
          ]),
        },
        line: { type: 'none' },
      })
      // 題後柔金輝光（放射，淡出至全透）
      slide.addShape('ellipse', {
        x: -1.6,
        y: 1.3,
        w: 7.0,
        h: 4.0,
        fill: {
          color: gradRadial([
            { pos: 0, color: mix(COS.gold, COS.bg, 0.5), alpha: 22 },
            { pos: 100, color: COS.bg, alpha: 0 },
          ]),
        },
        line: { type: 'none' },
      })
    }
    // 全版淡星野
    starfield(slide, { x: 0, y: 0, w: 13.33, h: 7.5 }, hasImg ? 30 : 60, 17, mix(COS.ink, COS.bg, hasImg ? 0.5 : 0.68))
    // 金軌道弧（右上同心環）+ 一粒行星
    orbitRings(slide, 11.2, 1.7, 0.7, 3, 0.45, mix(COS.gold, COS.bg, hasImg ? 0.3 : 0.55))
    glowStar(slide, 11.95, 1.05, 0.12, COS.gold, mix(COS.gold, COS.bg, 0.5))
    // 小星座（連幾粒星，左中）
    if (!hasImg) {
      constellation(slide, [[1.0, 5.1], [1.8, 4.6], [2.5, 5.0], [3.1, 4.4], [3.9, 4.8]], mix(COS.cyan, COS.bg, 0.45), COS.cyan)
    }
    // kicker
    tx(slide, 'TEACHING DECK · 教學簡報', { x: 0.9, y: 1.0, w: 8, h: 0.3, fontSize: 10, color: COS.gold, charSpacing: 4, bold: true })
    // 題 + 副題（浮喺星野上）
    const titleW = hasImg ? 7.6 : 9.4
    const fit = fitTitle(deck.title, 'cover')
    const lines = Math.max(1, Math.min(2, estimateLines(deck.title, fit.fontPt, titleW)))
    tx(slide, deck.title, { x: 0.9, y: 2.4, w: titleW, h: 1.55, fontSize: fit.fontPt, bold: true, color: COS.ink, lineSpacingMultiple: 1.08, fit: 'shrink' })
    if (deck.subtitle) {
      const subY = 2.4 + (lines * fit.fontPt * 1.08) / 72 + 0.24
      tx(slide, deck.subtitle, { x: 0.9, y: subY, w: titleW, h: 0.5, fontSize: 15, color: COS.soft })
    }
    // 期 + brand
    tx(slide, dateLabel(), { x: 0.9, y: 6.85, w: 5, h: 0.3, fontSize: 10, color: COS.gold })
    tx(slide, brand, { x: 9.43, y: 7.05, w: 3, h: 0.3, fontSize: 9, color: COS.faint, align: 'right' })
  },

  section(slide, no, title) {
    slide.background = { color: COS.bg }
    // 全版淡星野
    starfield(slide, { x: 0, y: 0, w: 13.33, h: 7.5 }, 50, no * 11 + 5, mix(COS.ink, COS.bg, 0.66))
    // 「星」+ 號入金環（章節 = 一顆命名星）
    const cx = 9.6
    const cy = 3.0
    orbitRings(slide, cx, cy, 1.5, 2, 0.42, mix(COS.gold, COS.bg, 0.5))
    glowStar(slide, cx, cy, 0.2, COS.gold, mix(COS.gold, COS.bg, 0.45))
    tx(slide, pad2(no), { x: 0.8, y: 1.2, w: 6, h: 2.9, fontSize: 150, bold: true, color: mix(COS.gold, COS.bg, 0.3), fontFace: 'Georgia' })
    tx(slide, title, { x: 0.9, y: 4.55, w: 8.0, h: 1.2, fontSize: 32, bold: true, color: COS.ink })
    tx(slide, `SECTION ${sectionWord(no)}`, { x: 0.9, y: 5.78, w: 6, h: 0.3, fontSize: 9, color: COS.gold, charSpacing: 4 })
  },

  contentFrame(slide, ctx) {
    slide.background = { color: COS.bg }
    const { body } = scaffold(slide, cosmos, ctx, { kickerY: 0.58, titleY: 0.9, hairline: true })
    // 右上小軌道環 + 星（配圖出血版省略）
    if (!ctx.hasPhoto) {
      orbitRings(slide, 12.1, 0.85, 0.3, 2, 0.18, mix(COS.gold, COS.bg, 0.5))
      glowStar(slide, 12.34, 0.6, 0.07, COS.gold, mix(COS.gold, COS.bg, 0.6))
    }
    drawFooter(slide, cosmos, ctx)
    return body
  },
}

// ───────── 滙出 ─────────

export const GALLERY_PACKS_6: Pack[] = [vapor, bauhaus, cosmos]
