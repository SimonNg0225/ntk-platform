// ============================================================
//  pptx template packs — gallery 第二輯（藍曬／翠廬／習字／月台／深海）
//  ------------------------------------------------------------
//  · 藍曬 blueprint — 工程圖紙：sysDash 圖紙框 + 間尺刻度 + 標題欄
//  · 翠廬 ivy       — 常春藤學院：左綠右白雙欄 + 學刊雙細線 + 金菱形
//  · 習字 redgrid   — 田字格書法：淡朱田字格 + 朱紅點睛
//  · 月台 transit   — 交通指示：站牌 pill + 信號黃 chevron + 月台邊線
//  · 深海 ocean     — 分層海浪：版底三層浪 + 上升氣泡
//  鐵律同 pptxPacks.ts：所有文字經 tx()；色 6 位 hex 無 #；
//  shadow 只准 outer；無 gradient／SVG；rectRadius 單位吋。
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
  vline,
  type Pack,
  type Rect,
} from './pptxPacks'
import type { Slide } from './types'
import { clampText, estimateLines, fitTitle, mix } from './pptxText'
import { gradLinear } from './pptxGradients'

// ============================================================
//  藍曬 blueprint — 工程圖紙
//  深藍曬圖底、白藍細線：成個 deck 似一張 D&T 工程圖則 —
//  sysDash 圖紙邊框、間尺刻度做 motif、右下角四格「圖紙標題欄」。
// ============================================================

const BLU = { bg: '0F3F6E', ink: 'F0F6FF', soft: 'A9C3E0', faint: '6E8DB3', hair: '3A6494', accent: 'BFD7F2', panel: '1B4C86' }

/** 間尺刻度：沿橫線每 0.25" 一條垂直 tick，高度梅花間竹 0.11/0.07（0.75pt accent） */
function ruler(slide: PptxGenJS.Slide, x: number, y: number, w: number): void {
  hline(slide, x, y, w, BLU.accent, 0.75)
  const n = Math.floor(w / 0.25)
  for (let k = 0; k <= n; k++) {
    vline(slide, x + k * 0.25, y, k % 2 === 0 ? 0.11 : 0.07, BLU.accent, 0.75)
  }
}

/** 相框四角「十字 tick」（制圖對位記號） */
function bluCross(slide: PptxGenJS.Slide, cx: number, cy: number, len: number): void {
  hline(slide, cx - len / 2, cy, len, BLU.accent, 0.75)
  vline(slide, cx, cy - len / 2, len, BLU.accent, 0.75)
}

/**
 * 招牌：steps 渲染成「技術圖則 callout」——
 * 全版淡藍曬方格底，各步一粒小方節點沿基線排，
 * L 形引線由節點拉出至 title+desc，四角細座標／編號標籤。2–5 步。
 */
function renderBlueprintSchematic(slide: PptxGenJS.Slide, body: Rect, pack: Pack, s: Slide): void {
  const items = (s.steps ?? []).slice(0, 5)
  if (items.length < 2) return
  const n = items.length
  const grid = mix(pack.accent, pack.bg, 0.18)
  // 淡藍曬方格底（每 0.5" 一格）
  const gx0 = body.x
  const gy0 = body.y
  const cols = Math.floor(body.w / 0.5)
  const rows = Math.floor(body.h / 0.5)
  for (let c = 0; c <= cols; c++) vline(slide, gx0 + c * 0.5, gy0, rows * 0.5, grid, 0.5)
  for (let r = 0; r <= rows; r++) hline(slide, gx0, gy0 + r * 0.5, cols * 0.5, grid, 0.5)
  // 四角座標／編號標籤
  tx(slide, `A1 · ${n} NODES`, { x: body.x + 0.06, y: body.y + 0.04, w: 3, h: 0.24, fontSize: 8, color: pack.faint, charSpacing: 2, bold: true, fontFace: pack.displayFont })
  tx(slide, 'SCALE 1:1', { x: body.x + body.w - 3.06, y: body.y + 0.04, w: 3, h: 0.24, fontSize: 8, color: pack.faint, charSpacing: 2, bold: true, align: 'right', fontFace: pack.displayFont })
  tx(slide, 'SHEET STEP', { x: body.x + 0.06, y: body.y + body.h - 0.26, w: 3, h: 0.24, fontSize: 8, color: pack.faint, charSpacing: 2, bold: true, fontFace: pack.displayFont })
  // 基線：各節點沿其排
  const baseY = body.y + body.h - 0.7
  const x0 = body.x + 0.7
  const x1 = body.x + body.w - 0.7
  const seg = (x1 - x0) / (n - 1)
  hline(slide, x0, baseY, x1 - x0, pack.accent, 1)
  const node = 0.18
  items.forEach((st, i) => {
    const cx = x0 + seg * i
    // 小方節點
    slide.addShape('rect', { x: cx - node / 2, y: baseY - node / 2, w: node, h: node, fill: { color: pack.accent }, line: { color: pack.ink, width: 0.75 } })
    tx(slide, String(i + 1), { x: cx - node / 2, y: baseY - node / 2, w: node, h: node, fontSize: 9, bold: true, color: pack.bg, align: 'center', valign: 'middle', fontFace: pack.displayFont })
    // L 形引線：由節點向上至 callout 列
    const calloutY = body.y + 0.5 + (i % 2) * 0.18
    const colW = Math.min(seg * 0.92, 2.4)
    const cxText = Math.max(body.x + 0.1, Math.min(cx - colW / 2, body.x + body.w - colW - 0.1))
    const leaderTopY = calloutY + 0.9
    vline(slide, cx, leaderTopY, baseY - node / 2 - leaderTopY, pack.accent, 0.75)
    hline(slide, Math.min(cx, cxText + 0.12), leaderTopY, Math.abs(cx - (cxText + 0.12)), pack.accent, 0.75)
    // callout：title + desc
    tx(slide, clampText(st.title.trim(), 14), { x: cxText, y: calloutY, w: colW, h: 0.34, fontSize: 14, bold: true, color: pack.ink, align: 'center', fontFace: pack.displayFont })
    if (st.desc) {
      tx(slide, clampText(st.desc.trim(), 40), { x: cxText, y: calloutY + 0.34, w: colW, h: 0.56, fontSize: 10, color: pack.inkSoft, align: 'center', lineSpacingMultiple: 1.18, fit: 'shrink' })
    }
  })
}

/**
 * 第二招牌：stats 渲染成「工程規格標籤」——
 * 全版淡藍曬方格底，各 stat 入一個方框（square frame + 四角對位十字），
 * 值用巨號 displayFont，標籤做尺寸標註（dimension caption）。2–4 項。
 */
function renderBlueprintSpecTags(slide: PptxGenJS.Slide, body: Rect, pack: Pack, s: Slide): void {
  const items = (s.stats ?? []).slice(0, 4)
  if (items.length < 2) return
  const n = items.length
  const grid = mix(pack.accent, pack.bg, 0.18)
  // 淡藍曬方格底（每 0.5" 一格）
  const cols = Math.floor(body.w / 0.5)
  const rows = Math.floor(body.h / 0.5)
  for (let c = 0; c <= cols; c++) vline(slide, body.x + c * 0.5, body.y, rows * 0.5, grid, 0.5)
  for (let r = 0; r <= rows; r++) hline(slide, body.x, body.y + r * 0.5, cols * 0.5, grid, 0.5)
  const gap = 0.4
  const cw = (body.w - gap * (n - 1)) / n
  const th = Math.min(2.6, body.h - 0.6)
  const ty = body.y + (body.h - th) / 2
  items.forEach((st, i) => {
    const cx = body.x + i * (cw + gap)
    // 規格方框
    slide.addShape('rect', { x: cx, y: ty, w: cw, h: th, fill: { type: 'none' }, line: { color: pack.accent, width: 1 } })
    // 四角對位十字 tick
    bluCross(slide, cx, ty, 0.14)
    bluCross(slide, cx + cw, ty, 0.14)
    bluCross(slide, cx, ty + th, 0.14)
    bluCross(slide, cx + cw, ty + th, 0.14)
    // 頂部 spec 編號
    tx(slide, `SPEC ${pad2(i + 1)}`, { x: cx + 0.12, y: ty + 0.08, w: cw - 0.24, h: 0.22, fontSize: 8, color: pack.faint, charSpacing: 2, bold: true, fontFace: pack.displayFont })
    // 巨號數值
    tx(slide, clampText(st.value.trim(), 8), { x: cx + 0.1, y: ty + 0.34, w: cw - 0.2, h: th * 0.5, fontSize: 56, bold: true, color: pack.ink, align: 'center', valign: 'middle', fontFace: pack.displayFont, fit: 'shrink' })
    // 尺寸標註：register ticks 夾住 label
    const dy = ty + th - 0.5
    ruler(slide, cx + 0.16, dy, cw - 0.32)
    tx(slide, clampText(st.label.trim(), 22), { x: cx + 0.12, y: dy + 0.14, w: cw - 0.24, h: 0.34, fontSize: 11, color: pack.inkSoft, align: 'center', fit: 'shrink' })
  })
}

/**
 * 第三招牌：compare 渲染成「工程規格對照」——
 * 全版淡藍曬方格底，左右兩塊規格 panel（accent 細框 + 四角對位十字），
 * 各 panel 頂部標題列（dimension 間尺壓底），下接 register-tick 行點。2 欄對照。
 */
function renderBlueprintSpecCompare(slide: PptxGenJS.Slide, body: Rect, pack: Pack, s: Slide): void {
  const cmp = s.compare
  if (!cmp || cmp.left.length === 0 || cmp.right.length === 0) return
  const grid = mix(pack.accent, pack.bg, 0.18)
  // 淡藍曬方格底（每 0.5" 一格）
  const cols = Math.floor(body.w / 0.5)
  const rows = Math.floor(body.h / 0.5)
  for (let c = 0; c <= cols; c++) vline(slide, body.x + c * 0.5, body.y, rows * 0.5, grid, 0.5)
  for (let r = 0; r <= rows; r++) hline(slide, body.x, body.y + r * 0.5, cols * 0.5, grid, 0.5)
  const gap = 0.5
  const pw = (body.w - gap) / 2
  const ph = body.h
  const sides: [string, string[], number, string][] = [
    [cmp.leftTitle, cmp.left.slice(0, 4), body.x, 'SPEC L'],
    [cmp.rightTitle, cmp.right.slice(0, 4), body.x + pw + gap, 'SPEC R'],
  ]
  sides.forEach(([title, pts, px, tag]) => {
    // 規格 panel 框
    slide.addShape('rect', { x: px, y: body.y, w: pw, h: ph, fill: { type: 'none' }, line: { color: pack.accent, width: 1 } })
    // 四角對位十字 tick
    bluCross(slide, px, body.y, 0.14)
    bluCross(slide, px + pw, body.y, 0.14)
    bluCross(slide, px, body.y + ph, 0.14)
    bluCross(slide, px + pw, body.y + ph, 0.14)
    // 頂部 spec 編號
    tx(slide, tag, { x: px + 0.18, y: body.y + 0.14, w: pw - 0.36, h: 0.22, fontSize: 8, color: pack.faint, charSpacing: 2, bold: true, fontFace: pack.displayFont })
    // 標題列
    tx(slide, clampText(title.trim(), 18), { x: px + 0.18, y: body.y + 0.36, w: pw - 0.36, h: 0.44, fontSize: 18, bold: true, color: pack.ink, fontFace: pack.displayFont, fit: 'shrink' })
    // dimension 間尺壓標題列底
    ruler(slide, px + 0.18, body.y + 0.86, pw - 0.36)
    // register-tick 行點
    const listY = body.y + 1.16
    const rowH = Math.min(0.62, (ph - 1.3) / pts.length)
    pts.forEach((pt, j) => {
      const ry = listY + j * rowH
      // register tick（行首方點）
      slide.addShape('rect', { x: px + 0.22, y: ry + rowH / 2 - 0.05, w: 0.1, h: 0.1, fill: { color: pack.accent }, line: { color: pack.ink, width: 0.5 } })
      tx(slide, clampText(pt.trim(), 30), { x: px + 0.46, y: ry, w: pw - 0.66, h: rowH, fontSize: 12, color: pack.inkSoft, valign: 'middle', lineSpacingMultiple: 1.12, fit: 'shrink' })
      // dimension-style 細分隔線
      if (j < pts.length - 1) hline(slide, px + 0.22, ry + rowH, pw - 0.44, grid, 0.5)
    })
  })
}

const blueprint: Pack = {
  id: 'blueprint',
  name: '藍曬',
  hint: '工程藍曬 · D&T',
  swatches: ['#0F3F6E', '#BFD7F2', '#1B4C86'],
  dark: true,
  bg: BLU.bg,
  ink: BLU.ink,
  inkSoft: BLU.soft,
  faint: BLU.faint,
  hair: BLU.hair,
  accent: BLU.accent,
  statColor: 'FFFFFF',
  panel: BLU.panel,
  cardRadius: 0,
  displayFont: 'Arial',
  displayItalic: false,
  pageNoColor: BLU.soft,
  chartColors: ['BFD7F2', 'FFFFFF', '7FA8D9', '4A77AC'],
  chartGridColor: BLU.hair,
  bulletPt: [18, 18, 17, 17, 16],
  titlePt: 28,
  marker: { kind: 'square', size: 0.09, color: BLU.accent, indent: 0.3 },
  tileStyle: 'cellBorder',
  compareStyle: 'panels',
  stepNode: { kind: 'squareFill', size: 0.3, color: BLU.accent, numColor: BLU.bg },
  quoteMark: { kind: 'square', size: 0.14, color: BLU.accent },
  splitPhoto: 'bleedHair',
  overrides: { steps: renderBlueprintSchematic, stats: renderBlueprintSpecTags, compare: renderBlueprintSpecCompare },

  // 逐版母題：右下角極邊一個遞增座標標籤 + 小對位十字（似圖則格網座標 A1/B2…）
  deco(slide, ctx) {
    const col = String.fromCharCode(65 + (ctx.seq % 6)) // A,B,C…
    const row = (ctx.seq % 6) + 1
    const cx = 12.62
    const cy = 7.0
    bluCross(slide, cx, cy, 0.12)
    tx(slide, `${col}${row}`, { x: cx - 0.6, y: cy - 0.28, w: 0.5, h: 0.2, fontSize: 8, color: blueprint.faint, charSpacing: 1, bold: true, align: 'right', valign: 'middle', fontFace: blueprint.displayFont })
  },

  cover(slide, deck, brand, img) {
    slide.background = { color: BLU.bg }
    const hasImg = Boolean(img)
    // 藍曬紙微微受光：頂部一抹淡藍 accent → 底部沉藍，俾圖紙底一點縱深
    slide.addShape('rect', {
      x: 0,
      y: 0,
      w: 13.33,
      h: 7.5,
      fill: { color: gradLinear(90, [{ pos: 0, color: mix(BLU.bg, BLU.accent, 0.1) }, { pos: 100, color: BLU.bg }]) },
      line: { type: 'none' },
    })
    // 全框 sysDash 圖紙邊（inset 0.3）
    slide.addShape('rect', { x: 0.3, y: 0.3, w: 12.73, h: 6.9, fill: { type: 'none' }, line: { color: BLU.accent, width: 1, dashType: 'sysDash' } })
    // 頂部間尺 + kicker
    ruler(slide, 0.9, 0.85, 7)
    tx(slide, 'TEACHING DECK · 教學簡報', { x: 0.9, y: 1.1, w: 7, h: 0.3, fontSize: 10, color: BLU.accent, charSpacing: 3, bold: true })
    // 題 + 副題（有相時收窄文字欄避開右半相框）
    const titleW = hasImg ? 6.1 : 11
    const fit = fitTitle(deck.title, 'cover')
    const lines = Math.max(1, Math.min(2, estimateLines(deck.title, fit.fontPt, titleW)))
    tx(slide, deck.title, { x: 0.9, y: 2.45, w: titleW, h: 1.55, fontSize: fit.fontPt, bold: true, color: BLU.ink, lineSpacingMultiple: 1.08, fit: 'shrink' })
    if (deck.subtitle) {
      const subY = 2.45 + (lines * fit.fontPt * 1.08) / 72 + 0.22
      tx(slide, deck.subtitle, { x: 0.9, y: subY, w: hasImg ? 5.9 : 10, h: 0.5, fontSize: 15, color: BLU.soft })
    }
    if (img) {
      // 右半相 + accent 細框 + 四角十字 tick（圖則貼相感）
      const frame: Rect = { x: 7.4, y: 1.3, w: 5.2, h: 3.8 }
      addCoverImage(slide, img, frame)
      slide.addShape('rect', { x: frame.x, y: frame.y, w: frame.w, h: frame.h, fill: { type: 'none' }, line: { color: BLU.accent, width: 0.75 } })
      bluCross(slide, frame.x, frame.y, 0.16)
      bluCross(slide, frame.x + frame.w, frame.y, 0.16)
      bluCross(slide, frame.x, frame.y + frame.h, 0.16)
      bluCross(slide, frame.x + frame.w, frame.y + frame.h, 0.16)
      tx(slide, img.credit, { x: 7.4, y: 5.18, w: 5.2, h: 0.24, fontSize: 8, color: BLU.faint, align: 'right' })
    }
    // 圖紙標題欄（右下 2×2 格：DATE／PAGES／DRAWN／SCALE）
    const tb: Rect = { x: 8.6, y: 5.7, w: 3.9, h: 1.3 }
    slide.addShape('rect', { x: tb.x, y: tb.y, w: tb.w, h: tb.h, fill: { type: 'none' }, line: { color: BLU.accent, width: 0.75 } })
    hline(slide, tb.x, tb.y + tb.h / 2, tb.w, BLU.accent, 0.75)
    vline(slide, tb.x + tb.w / 2, tb.y, tb.h, BLU.accent, 0.75)
    const cells: [string, number, number][] = [
      [`DATE ${dateLabel()}`, tb.x, tb.y],
      [`PAGES 共 ${deck.slides.length + 1} 版`, tb.x + tb.w / 2, tb.y],
      [`DRAWN ${brand}`, tb.x, tb.y + tb.h / 2],
      ['SCALE 16:9', tb.x + tb.w / 2, tb.y + tb.h / 2],
    ]
    for (const [label, cx, cy] of cells) {
      tx(slide, label, { x: cx + 0.12, y: cy, w: tb.w / 2 - 0.22, h: tb.h / 2, fontSize: 8, color: BLU.soft, valign: 'middle' })
    }
  },

  section(slide, no, title) {
    slide.background = { color: BLU.bg }
    tx(slide, pad2(no), { x: 0.8, y: 1.2, w: 6, h: 2.9, fontSize: 150, bold: true, color: mix(BLU.accent, BLU.bg, 0.3), fontFace: 'Arial' })
    ruler(slide, 0.9, 4.3, 4.5)
    tx(slide, title, { x: 0.9, y: 4.65, w: 11.2, h: 1.2, fontSize: 32, bold: true, color: BLU.ink })
  },

  contentFrame(slide, ctx) {
    slide.background = { color: BLU.bg }
    const { body } = scaffold(slide, blueprint, ctx, { kickerY: 0.58, titleY: 0.9, hairline: true })
    // 右上短間尺（配圖出血版省略）
    if (!ctx.hasPhoto) ruler(slide, 10.6, 0.7, 1.85)
    drawFooter(slide, blueprint, ctx)
    return body
  },
}

// ============================================================
//  翠廬 ivy — 常春藤學院
//  森綠 × 米金嘅老學院書卷氣：封面左綠右白雙欄似精裝書封，
//  學刊雙細線做分隔、細金菱形做徽記，Georgia 巨號照應學報排版。
// ============================================================

const IVY = { ink: '1B3A2C', soft: '5E7568', faint: '93A89B', hair: 'DCE5DE', accent: '1E4D38', gold: 'C5A572', panel: 'F2EFE6' }

/** 學刊雙細線：兩條 0.5pt 線相距 0.05"（封面白、內文森綠） */
function ivyPair(slide: PptxGenJS.Slide, x: number, y: number, w: number, color: string): void {
  hline(slide, x, y, w, color, 0.5)
  hline(slide, x, y + 0.05, w, color, 0.5)
}

/** 金菱形徽記 */
function ivyDiamond(slide: PptxGenJS.Slide, x: number, y: number, size: number): void {
  slide.addShape('diamond', { x, y, w: size, h: size, fill: { color: IVY.gold }, line: { type: 'none' } })
}

/**
 * 招牌：cards 渲染成「徽章卡」——
 * 每卡髮線細框，頂部森綠 serif 標題欄載白字，角落金菱形 + 常春藤葉 flourish，
 * 卡身正文。學刊證書／紋章氣派。2–6 卡。
 */
function renderIvyCrests(slide: PptxGenJS.Slide, body: Rect, pack: Pack, s: Slide): void {
  const items = (s.cards ?? []).slice(0, 6)
  if (items.length < 2) return
  const n = items.length
  const cols = n <= 2 ? n : n <= 4 ? 2 : 3
  const rows = Math.ceil(n / cols)
  const gap = 0.3
  const cw = (body.w - gap * (cols - 1)) / cols
  const ch = (body.h - gap * (rows - 1)) / rows
  const barH = Math.min(0.5, ch * 0.32)
  items.forEach((card, i) => {
    const r = Math.floor(i / cols)
    const c = i % cols
    const cx = body.x + c * (cw + gap)
    const cy = body.y + r * (ch + gap)
    // 髮線細框（雙線：外框 + 內細邊）
    slide.addShape('roundRect', { x: cx, y: cy, w: cw, h: ch, rectRadius: pack.cardRadius, fill: { color: 'FFFFFF' }, line: { color: pack.hair, width: 1 } })
    slide.addShape('rect', { x: cx + 0.07, y: cy + 0.07, w: cw - 0.14, h: ch - 0.14, fill: { type: 'none' }, line: { color: mix(pack.accent, 'FFFFFF', 0.35), width: 0.5 } })
    // 頂部森綠 serif 標題欄
    slide.addShape('rect', { x: cx + 0.07, y: cy + 0.07, w: cw - 0.14, h: barH, fill: { color: pack.accent }, line: { type: 'none' } })
    tx(slide, clampText(card.title.trim(), 18), { x: cx + 0.24, y: cy + 0.07, w: cw - 0.6, h: barH, fontSize: 14, bold: true, color: 'FFFFFF', valign: 'middle', fontFace: pack.displayFont })
    // 金菱形徽記（標題欄右端）
    ivyDiamond(slide, cx + cw - 0.28, cy + 0.07 + barH / 2 - 0.05, 0.1)
    // 常春藤葉 flourish（左下角，學刊雙細線做葉脈意象）
    ivyPair(slide, cx + 0.24, cy + ch - 0.26, Math.min(0.9, cw - 0.48), pack.accent)
    // 卡身正文
    if (card.desc) {
      tx(slide, clampText(card.desc.trim(), 90), {
        x: cx + 0.24,
        y: cy + 0.07 + barH + 0.14,
        w: cw - 0.48,
        h: ch - barH - 0.6,
        fontSize: 12,
        color: pack.inkSoft,
        lineSpacingMultiple: 1.22,
        fit: 'shrink',
      })
    }
  })
}

/**
 * 第二招牌：quote 渲染成「學院題詞」——
 * 金菱形 + 常春藤葉 flourish 開首，大號 Georgia 引文居中，
 * 金學刊雙細線壓底，attribution 做落款。學報卷首題詞氣派。
 */
function renderIvyEpigraph(slide: PptxGenJS.Slide, body: Rect, pack: Pack, s: Slide): void {
  const q = s.quote
  if (!q || !q.text.trim()) return
  const cw = Math.min(9.6, body.w - 1.2)
  const cx = body.x + (body.w - cw) / 2
  // 頂部金菱形 + 葉脈雙細線 flourish
  ivyDiamond(slide, cx + cw / 2 - 0.07, body.y + 0.2, 0.14)
  ivyPair(slide, cx + cw / 2 - 0.7, body.y + 0.5, 1.4, pack.accent)
  // 大號 serif 引文（書名號夾住，居中）
  const quoteY = body.y + 0.95
  const quoteH = Math.max(1.6, body.h - 2.4)
  tx(slide, `「${clampText(q.text.trim(), 60)}」`, {
    x: cx,
    y: quoteY,
    w: cw,
    h: quoteH,
    fontSize: 30,
    color: pack.ink,
    align: 'center',
    valign: 'middle',
    italic: true,
    lineSpacingMultiple: 1.3,
    fontFace: pack.displayFont,
    fit: 'shrink',
  })
  // 金學刊雙細線
  const ruleY = quoteY + quoteH + 0.18
  ivyPair(slide, cx + cw / 2 - 1.0, ruleY, 2.0, IVY.gold)
  // 落款 attribution
  if (q.attribution) {
    tx(slide, `— ${clampText(q.attribution.trim(), 30)}`, {
      x: cx,
      y: ruleY + 0.2,
      w: cw,
      h: 0.4,
      fontSize: 14,
      color: pack.inkSoft,
      align: 'center',
      italic: true,
      fontFace: pack.displayFont,
    })
  }
}

/**
 * 第三招牌：steps 渲染成「學院年表」——
 * 左側森綠垂直主線，各步一粒金菱形節點（ivyDiamond），
 * 節點右接 serif 年／步標題 + 說明，學刊雙細線（ivyPair）做行底葉脈。學報年表氣派。2–5 步。
 */
function renderIvyTimeline(slide: PptxGenJS.Slide, body: Rect, pack: Pack, s: Slide): void {
  const items = (s.steps ?? []).slice(0, 5)
  if (items.length < 2) return
  const n = items.length
  const lineX = body.x + 0.5
  // 森綠垂直主線
  vline(slide, lineX, body.y + 0.1, body.h - 0.2, pack.accent, 1.5)
  const rowH = (body.h - 0.2) / n
  const textX = lineX + 0.5
  const textW = body.w - (textX - body.x) - 0.3
  items.forEach((st, i) => {
    const cy = body.y + 0.1 + i * rowH
    const nodeC = cy + rowH * 0.28
    // 金菱形節點（壓喺主線上）
    ivyDiamond(slide, lineX - 0.1, nodeC - 0.1, 0.2)
    // 步序（金號小字）
    tx(slide, pad2(i + 1), { x: textX, y: cy, w: textW, h: 0.24, fontSize: 10, bold: true, color: pack.statColor, charSpacing: 3, fontFace: pack.displayFont })
    // serif 年／步標題
    tx(slide, clampText(st.title.trim(), 22), { x: textX, y: cy + 0.24, w: textW, h: 0.4, fontSize: 17, bold: true, color: pack.ink, fontFace: pack.displayFont, fit: 'shrink' })
    // 說明
    if (st.desc) {
      tx(slide, clampText(st.desc.trim(), 50), { x: textX, y: cy + 0.64, w: textW, h: rowH - 0.84, fontSize: 12, color: pack.inkSoft, lineSpacingMultiple: 1.2, fit: 'shrink' })
    }
    // 學刊雙細線葉脈（行底，非最後一行）
    if (i < n - 1) ivyPair(slide, textX, cy + rowH - 0.14, Math.min(2.4, textW), pack.accent)
  })
}

const ivy: Pack = {
  id: 'ivy',
  name: '翠廬',
  hint: '學院書卷 · 文史',
  swatches: ['#1E4D38', '#C5A572', '#F2EFE6'],
  dark: false,
  bg: 'FFFFFF',
  ink: IVY.ink,
  inkSoft: IVY.soft,
  faint: IVY.faint,
  hair: IVY.hair,
  accent: IVY.accent,
  statColor: '9A7B3F', // 深金 — 米白卡上 C5A572 對比僅 ~2:1（QA major）
  panel: IVY.panel,
  cardRadius: 0.03,
  displayFont: 'Georgia',
  displayItalic: false,
  pageNoColor: IVY.faint,
  chartColors: ['1E4D38', 'C5A572', '7FA08E', 'C8D4CC'],
  chartGridColor: IVY.hair,
  bulletPt: [18, 17, 17, 16, 15],
  titlePt: 29,
  marker: { kind: 'dot', size: 0.09, color: IVY.accent, indent: 0.3 },
  tileStyle: 'tintCard',
  compareStyle: 'panels',
  stepNode: { kind: 'circleOutline', size: 0.34, color: IVY.gold, numColor: IVY.accent },
  quoteMark: { kind: 'glyph', color: IVY.gold },
  splitPhoto: 'bleedHair',
  overrides: { cards: renderIvyCrests, quote: renderIvyEpigraph, steps: renderIvyTimeline },

  // 逐版母題：角落一粒小金菱形 + 學刊細線，左下／右下角按 seq 交替（書卷頁角徽）
  deco(slide, ctx) {
    const right = ctx.seq % 2 === 1
    const dx = right ? 12.34 : 0.74
    const dy = 6.96
    ivyDiamond(slide, dx, dy, 0.1)
    ivyPair(slide, right ? dx - 0.7 : dx + 0.16, dy + 0.04, 0.6, mix(IVY.gold, 'FFFFFF', 0.2))
  },

  cover(slide, deck, brand, img) {
    slide.background = { color: 'FFFFFF' }
    // 左綠欄（書脊）：徽記 + kicker + 白雙細線 + 底部日期／brand
    // 書脊森綠微微縱深漸層（頂部提亮 → 底部沉墨綠），似精裝布封受光
    slide.addShape('rect', {
      x: 0,
      y: 0,
      w: 4.6,
      h: 7.5,
      fill: { color: gradLinear(90, [{ pos: 0, color: mix(IVY.accent, 'FFFFFF', 0.12) }, { pos: 100, color: mix(IVY.accent, IVY.ink, 0.16) }]) },
      line: { type: 'none' },
    })
    ivyDiamond(slide, 0.9, 1.0, 0.16)
    tx(slide, 'TEACHING DECK', { x: 0.9, y: 1.35, w: 3.4, h: 0.3, fontSize: 9, color: 'FFFFFF', charSpacing: 4, bold: true })
    ivyPair(slide, 0.9, 1.7, 2.2, 'FFFFFF')
    tx(slide, dateLabel(), { x: 0.9, y: 6.4, w: 3.4, h: 0.3, fontSize: 10, color: IVY.gold })
    tx(slide, brand, { x: 0.9, y: 6.8, w: 3.4, h: 0.3, fontSize: 9, color: 'FFFFFF' })
    // 右白欄：金菱形 + 題 + 副題
    ivyDiamond(slide, 5.1, 1.85, 0.14)
    const fit = fitTitle(deck.title, 'cover')
    const lines = Math.max(1, Math.min(2, estimateLines(deck.title, fit.fontPt, 7.6)))
    tx(slide, deck.title, { x: 5.1, y: 2.3, w: 7.6, h: 1.6, fontSize: fit.fontPt, bold: true, color: IVY.ink, lineSpacingMultiple: 1.08, fit: 'shrink' })
    if (deck.subtitle) {
      const subY = 2.3 + (lines * fit.fontPt * 1.08) / 72 + 0.22
      tx(slide, deck.subtitle, { x: 5.1, y: subY, w: 7.4, h: 0.5, fontSize: 15, color: IVY.soft })
    }
    if (img) {
      // 右欄底部橫幅相 + 髮線框
      const frame: Rect = { x: 5.1, y: 4.6, w: 7.3, h: 2.0 }
      addCoverImage(slide, img, frame)
      slide.addShape('rect', { x: frame.x, y: frame.y, w: frame.w, h: frame.h, fill: { type: 'none' }, line: { color: IVY.hair, width: 0.75 } })
      tx(slide, img.credit, { x: 5.1, y: 6.68, w: 7.3, h: 0.24, fontSize: 8, color: IVY.faint, align: 'right' })
    }
  },

  section(slide, no, title) {
    slide.background = { color: IVY.panel }
    // Georgia 淡森綠巨號 — 米白底大片留白係學報語言
    tx(slide, pad2(no), { x: 0.75, y: 1.3, w: 6, h: 2.6, fontSize: 140, bold: true, color: mix(IVY.accent, IVY.panel, 0.16), fontFace: 'Georgia' })
    ivyDiamond(slide, 0.9, 4.47, 0.16)
    tx(slide, title, { x: 1.18, y: 4.3, w: 10.8, h: 1.2, fontSize: 30, bold: true, color: IVY.ink })
    ivyPair(slide, 0.9, 6.7, 2.6, IVY.accent)
  },

  contentFrame(slide, ctx) {
    slide.background = { color: 'FFFFFF' }
    const { body, contentW } = scaffold(slide, ivy, ctx, { kickerY: 0.58, titleY: 0.9, hairline: false })
    // 學刊雙細線代 folio 髮線（位置 = scaffold 髮線位 body.y−0.3）
    ivyPair(slide, 0.9, body.y - 0.3, contentW, IVY.accent)
    // 金菱形徽記 13/13 出齊：配圖版右上被相佔，移入文字欄右端
    ivyDiamond(slide, ctx.hasPhoto ? 6.9 : 12.31, 0.6, 0.12)
    drawFooter(slide, ivy, ctx)
    return body
  },
}

// ============================================================
//  習字 redgrid — 田字格書法
//  中文科習字簿語言：淡朱田字格（實框 + sysDash 十字中線）做 motif，
//  封面將題目第一個字放入大格 — 似書法帖開筆；朱紅一色點睛。
// ============================================================

const RED = { ink: '262220', soft: '6E6660', faint: 'A39A92', hair: 'EAE2DA', accent: 'A93226', panel: 'FAF4EC', gridline: 'E8C2BC' }

/** 田字格：實線外框 + 兩條 sysDash 中線（橫＋直）十字 */
function tianGrid(slide: PptxGenJS.Slide, x: number, y: number, size: number, linePt: number, color: string): void {
  slide.addShape('rect', { x, y, w: size, h: size, fill: { type: 'none' }, line: { color, width: linePt } })
  slide.addShape('line', { x, y: y + size / 2, w: size, h: 0, line: { color, width: linePt, dashType: 'sysDash' } })
  slide.addShape('line', { x: x + size / 2, y, w: 0, h: size, line: { color, width: linePt, dashType: 'sysDash' } })
}

/**
 * 招牌：stats 渲染成「雜誌大數字」——
 * 各 stat 一個 module，頂部朱紅粗條，displayFont 巨號數字，標籤喺下，
 * module 間以粗朱紅 rule 分隔。編輯雜誌版面感。2–4 項。
 */
function renderRedgridBigNumbers(slide: PptxGenJS.Slide, body: Rect, pack: Pack, s: Slide): void {
  const items = (s.stats ?? []).slice(0, 4)
  if (items.length < 2) return
  const n = items.length
  const gap = 0.4
  const cw = (body.w - gap * (n - 1)) / n
  items.forEach((st, i) => {
    const cx = body.x + i * (cw + gap)
    // 頂部朱紅粗條
    slide.addShape('rect', { x: cx, y: body.y + 0.1, w: cw, h: 0.12, fill: { color: pack.accent }, line: { type: 'none' } })
    // 巨號數字
    tx(slide, clampText(st.value.trim(), 8), {
      x: cx,
      y: body.y + 0.4,
      w: cw,
      h: Math.min(2.2, body.h * 0.5),
      fontSize: 74,
      bold: true,
      color: pack.ink,
      fontFace: pack.displayFont,
      valign: 'top',
      fit: 'shrink',
    })
    // 標籤
    tx(slide, clampText(st.label.trim(), 26), {
      x: cx,
      y: body.y + 0.4 + Math.min(2.2, body.h * 0.5) + 0.1,
      w: cw,
      h: 0.9,
      fontSize: 14,
      color: pack.inkSoft,
      lineSpacingMultiple: 1.2,
      fit: 'shrink',
    })
    // module 間粗朱紅 rule
    if (i < n - 1) {
      vline(slide, cx + cw + gap / 2, body.y + 0.1, body.h - 0.4, pack.accent, 2)
    }
  })
}

/**
 * 第二招牌：cards 渲染成「雜誌格子卡」——
 * 緊密編輯網格，各卡頂部朱紅 rule、displayFont 粗標題、正文，
 * 卡與卡之間以細朱紅 gutter rule 分隔。編輯雜誌版面感。2–6 卡。
 */
function renderRedgridMagCards(slide: PptxGenJS.Slide, body: Rect, pack: Pack, s: Slide): void {
  const items = (s.cards ?? []).slice(0, 6)
  if (items.length < 2) return
  const n = items.length
  const cols = n <= 2 ? n : n <= 4 ? 2 : 3
  const rows = Math.ceil(n / cols)
  const gap = 0.34
  const cw = (body.w - gap * (cols - 1)) / cols
  const ch = (body.h - gap * (rows - 1)) / rows
  items.forEach((card, i) => {
    const r = Math.floor(i / cols)
    const c = i % cols
    const cx = body.x + c * (cw + gap)
    const cy = body.y + r * (ch + gap)
    // 頂部朱紅 rule
    slide.addShape('rect', { x: cx, y: cy, w: cw, h: 0.1, fill: { color: pack.accent }, line: { type: 'none' } })
    // 卡號
    tx(slide, pad2(i + 1), { x: cx, y: cy + 0.2, w: cw, h: 0.3, fontSize: 11, bold: true, color: pack.accent, charSpacing: 2, fontFace: pack.displayFont })
    // 粗標題
    tx(slide, clampText(card.title.trim(), 14), { x: cx, y: cy + 0.52, w: cw, h: 0.6, fontSize: 19, bold: true, color: pack.ink, lineSpacingMultiple: 1.06, fontFace: pack.displayFont, fit: 'shrink' })
    // 正文
    if (card.desc) {
      tx(slide, clampText(card.desc.trim(), 80), { x: cx, y: cy + 1.18, w: cw, h: ch - 1.3, fontSize: 12, color: pack.inkSoft, lineSpacingMultiple: 1.24, fit: 'shrink' })
    }
    // gutter rule（右側欄縫，非最後一欄）
    if (c < cols - 1) {
      vline(slide, cx + cw + gap / 2, cy, ch, mix(pack.accent, pack.bg, 0.6), 0.75)
    }
  })
}

/**
 * 第三招牌：compare 渲染成「雜誌跨頁」——
 * 兩塊對望「書頁」由中央粗朱紅 rule 一分為二，各頁頂部朱紅 rule + 粗標題，
 * 下接編號 points，行間細朱紅分隔。編輯雜誌跨頁感。2 欄對照。
 */
function renderRedgridSpread(slide: PptxGenJS.Slide, body: Rect, pack: Pack, s: Slide): void {
  const cmp = s.compare
  if (!cmp || cmp.left.length === 0 || cmp.right.length === 0) return
  const gutter = 0.6
  const pw = (body.w - gutter) / 2
  // 中央粗朱紅 center rule
  vline(slide, body.x + pw + gutter / 2, body.y, body.h, pack.accent, 3)
  const pages: [string, string[], number][] = [
    [cmp.leftTitle, cmp.left.slice(0, 4), body.x],
    [cmp.rightTitle, cmp.right.slice(0, 4), body.x + pw + gutter],
  ]
  pages.forEach(([title, pts, px]) => {
    // 頂部朱紅 rule
    slide.addShape('rect', { x: px, y: body.y, w: pw, h: 0.1, fill: { color: pack.accent }, line: { type: 'none' } })
    // 粗標題
    tx(slide, clampText(title.trim(), 16), { x: px, y: body.y + 0.22, w: pw, h: 0.6, fontSize: 21, bold: true, color: pack.ink, lineSpacingMultiple: 1.04, fontFace: pack.displayFont, fit: 'shrink' })
    // 編號 points
    const listY = body.y + 0.92
    const rowH = Math.min(0.66, (body.h - 1.0) / pts.length)
    pts.forEach((pt, j) => {
      const ry = listY + j * rowH
      // 朱紅編號
      tx(slide, pad2(j + 1), { x: px, y: ry, w: 0.5, h: rowH, fontSize: 13, bold: true, color: pack.accent, valign: 'middle', fontFace: pack.displayFont })
      tx(slide, clampText(pt.trim(), 30), { x: px + 0.52, y: ry, w: pw - 0.52, h: rowH, fontSize: 12, color: pack.inkSoft, valign: 'middle', lineSpacingMultiple: 1.16, fit: 'shrink' })
      // 行間細朱紅分隔
      if (j < pts.length - 1) hline(slide, px, ry + rowH, pw, mix(pack.accent, pack.bg, 0.6), 0.75)
    })
  })
}

const redgrid: Pack = {
  id: 'redgrid',
  name: '習字',
  hint: '田字格 · 中文',
  swatches: ['#A93226', '#E8C2BC', '#FAF4EC'],
  dark: false,
  bg: 'FFFFFF',
  ink: RED.ink,
  inkSoft: RED.soft,
  faint: RED.faint,
  hair: RED.hair,
  accent: RED.accent,
  statColor: RED.accent,
  panel: RED.panel,
  cardRadius: 0.02,
  displayFont: 'Microsoft JhengHei',
  displayItalic: false,
  pageNoColor: RED.faint,
  chartColors: ['A93226', 'C97B5A', '8C8077', 'D9CFC5'],
  chartGridColor: RED.hair,
  bulletPt: [18, 17, 17, 16, 15],
  titlePt: 29,
  marker: { kind: 'square', size: 0.1, color: RED.accent, indent: 0.32 },
  tileStyle: 'hairline',
  compareStyle: 'hairline',
  stepNode: { kind: 'squareFill', size: 0.32, color: RED.accent, numColor: 'FFFFFF' },
  quoteMark: { kind: 'glyph', color: RED.accent },
  splitPhoto: 'bleedHair',
  overrides: { stats: renderRedgridBigNumbers, cards: renderRedgridMagCards, compare: renderRedgridSpread },

  // 逐版母題：右下角極邊一個小淡朱田字格，內裡一粒朱點按 seq 走過四格（似逐格寫字）
  deco(slide, ctx) {
    const size = 0.26
    const gx = 12.4
    const gy = 6.86
    tianGrid(slide, gx, gy, size, 0.5, RED.gridline)
    const cell = ctx.seq % 4 // 0=左上 1=右上 2=左下 3=右下
    const dot = 0.07
    const ox = (cell % 2 === 1 ? size * 0.5 : 0) + size * 0.25 - dot / 2
    const oy = (cell >= 2 ? size * 0.5 : 0) + size * 0.25 - dot / 2
    slide.addShape('ellipse', { x: gx + ox, y: gy + oy, w: dot, h: dot, fill: { color: mix(RED.accent, 'FFFFFF', 0.25) }, line: { type: 'none' } })
  },

  cover(slide, deck, brand, img) {
    slide.background = { color: 'FFFFFF' }
    const hasImg = Boolean(img)
    // 習字簿宣紙微微泛色：頂部一抹暖白 → 底部極淡朱墨，俾白底一點縱深
    slide.addShape('rect', {
      x: 0,
      y: 0,
      w: 13.33,
      h: 7.5,
      fill: { color: gradLinear(90, [{ pos: 0, color: mix('FFFFFF', RED.accent, 0.03) }, { pos: 100, color: mix('FFFFFF', RED.ink, 0.05) }]) },
      line: { type: 'none' },
    })
    // 左上大田字格 — 內放題目第一個字（書法帖開筆）
    tianGrid(slide, 0.9, 0.95, 2.1, 1.25, RED.gridline)
    const first = [...deck.title.trim()][0] ?? '習'
    tx(slide, first, { x: 0.9, y: 0.95, w: 2.1, h: 2.1, fontSize: 90, bold: true, color: RED.accent, align: 'center', valign: 'middle' })
    tx(slide, '教學簡報 · TEACHING DECK', { x: 3.35, y: 1.05, w: 7, h: 0.3, fontSize: 10, color: RED.accent, charSpacing: 3, bold: true })
    // 全題 + 副題（有相時收窄避開右下相框）
    const titleW = hasImg ? 6.9 : 11.2
    const fit = fitTitle(deck.title, 'cover')
    const lines = Math.max(1, Math.min(2, estimateLines(deck.title, fit.fontPt, titleW)))
    tx(slide, deck.title, { x: 0.9, y: 3.5, w: titleW, h: 1.55, fontSize: fit.fontPt, bold: true, color: RED.ink, lineSpacingMultiple: 1.08, fit: 'shrink' })
    if (deck.subtitle) {
      const subY = 3.5 + (lines * fit.fontPt * 1.08) / 72 + 0.22
      tx(slide, deck.subtitle, { x: 0.9, y: subY, w: hasImg ? 6.7 : 10, h: 0.5, fontSize: 15, color: RED.soft })
    }
    // 底部一行細田字格（空格仔等緊寫字）+ 日期 + brand
    for (let i = 0; i < 5; i++) tianGrid(slide, 0.9 + i * 0.52, 6.35, 0.4, 0.75, RED.gridline)
    tx(slide, dateLabel(), { x: 3.6, y: 6.43, w: 4, h: 0.3, fontSize: 10, color: RED.soft })
    tx(slide, brand, { x: 0.9, y: 6.95, w: 5, h: 0.3, fontSize: 9, color: RED.faint })
    if (img) {
      const frame: Rect = { x: 8.0, y: 3.9, w: 4.6, h: 2.9 }
      addCoverImage(slide, img, frame)
      slide.addShape('rect', { x: frame.x, y: frame.y, w: frame.w, h: frame.h, fill: { type: 'none' }, line: { color: RED.hair, width: 0.75 } })
      tx(slide, img.credit, { x: 8.0, y: 6.86, w: 4.6, h: 0.24, fontSize: 8, color: RED.faint, align: 'right' })
    }
  },

  section(slide, no, title) {
    slide.background = { color: 'FFFFFF' }
    // 大田字格內寫章節號（唔 pad — 似格仔入面寫咗一個字）
    tianGrid(slide, 0.9, 1.2, 3.0, 1.5, RED.gridline)
    tx(slide, String(no), { x: 0.9, y: 1.2, w: 3.0, h: 3.0, fontSize: 132, bold: true, color: RED.accent, align: 'center', valign: 'middle' })
    tx(slide, title, { x: 0.9, y: 4.85, w: 11.2, h: 0.85, fontSize: 30, bold: true, color: RED.ink })
    tx(slide, `SECTION ${sectionWord(no)}`, { x: 0.9, y: 5.75, w: 6, h: 0.3, fontSize: 9, color: RED.soft, charSpacing: 4 })
  },

  contentFrame(slide, ctx) {
    slide.background = { color: 'FFFFFF' }
    const { body } = scaffold(slide, redgrid, ctx, { kickerY: 0.58, titleY: 0.9, hairline: true })
    // 右上三個細田字格（配圖出血版省略）
    if (!ctx.hasPhoto) {
      for (let i = 0; i < 3; i++) tianGrid(slide, 11.3 + i * 0.4, 0.55, 0.3, 0.75, RED.gridline)
    }
    drawFooter(slide, redgrid, ctx)
    return body
  },
}

// ============================================================
//  月台 transit — 交通指示
//  車站指示系統語言：黑站牌 pill 載住版題、信號黃 chevron 指方向、
//  月台邊黃粗線壓陣；kicker 喺內容版變成迷你站牌。
// ============================================================

const TRN = { ink: '17191C', soft: '5F6670', faint: '9CA3AC', hair: 'E3E5E8', accent: 'F2B705', panel: 'F5F6F8' }

/** 信號黃箭咀隊：三粒 chevron 排隊指向右 */
function chevronRow(slide: PptxGenJS.Slide, x: number, y: number, size: number, step: number): void {
  for (let k = 0; k < 3; k++) {
    slide.addShape('chevron', { x: x + k * step, y, w: size, h: size, fill: { color: TRN.accent }, line: { type: 'none' } })
  }
}

/** 站牌 pill 闊度：按 kicker 字符估闊（CJK=1em／ASCII=0.55em），cap 3.2" */
function pillW(kicker: string): number {
  let em = 0
  for (const ch of kicker) em += (ch.codePointAt(0) ?? 0) <= 0xff ? 0.55 : 1
  return Math.min(3.2, 0.42 + ((em * 9) / 72) * 1.1)
}

/** Underground roundel 站徽：信號黃環 + 黑橫條（終點站用） */
function roundel(slide: PptxGenJS.Slide, cx: number, cy: number, r: number): void {
  slide.addShape('ellipse', { x: cx - r, y: cy - r, w: 2 * r, h: 2 * r, fill: { type: 'none' }, line: { color: TRN.accent, width: r * 13 } })
  slide.addShape('rect', { x: cx - r * 1.5, y: cy - r * 0.32, w: r * 3, h: r * 0.64, fill: { color: TRN.ink }, line: { type: 'none' } })
}

/**
 * 招牌：steps 渲染成「地鐵線路圖」——
 * 站點沿信號黃主線排，起點實心、終點 roundel、站間方向 chevron、
 * 站號黑牌喺線上，站名／說明喺線下。2–5 站。
 */
function renderTransitMetro(slide: PptxGenJS.Slide, body: Rect, pack: Pack, s: Slide): void {
  const items = (s.steps ?? []).slice(0, 5)
  if (items.length < 2) return
  const n = items.length
  const x0 = body.x + 0.7
  const x1 = body.x + body.w - 0.7
  const lineY = body.y + Math.min(1.7, body.h * 0.42)
  const seg = (x1 - x0) / (n - 1)
  // 主線（信號黃粗線）
  hline(slide, x0, lineY, x1 - x0, pack.accent, 7)
  items.forEach((st, i) => {
    const cx = x0 + seg * i
    // 站號黑牌（線上方）
    slide.addShape('roundRect', { x: cx - 0.16, y: lineY - 0.74, w: 0.32, h: 0.3, rectRadius: 0.05, fill: { color: pack.ink }, line: { type: 'none' } })
    tx(slide, String(i + 1), { x: cx - 0.16, y: lineY - 0.74, w: 0.32, h: 0.3, fontSize: 13, bold: true, color: pack.accent, align: 'center', valign: 'middle', fontFace: pack.displayFont })
    // 站點：起點實心 / 終點 roundel / 中途白圓黑環
    if (i === 0) {
      slide.addShape('ellipse', { x: cx - 0.13, y: lineY - 0.13, w: 0.26, h: 0.26, fill: { color: pack.ink }, line: { type: 'none' } })
    } else if (i === n - 1) {
      roundel(slide, cx, lineY, 0.17)
    } else {
      slide.addShape('ellipse', { x: cx - 0.12, y: lineY - 0.12, w: 0.24, h: 0.24, fill: { color: 'FFFFFF' }, line: { color: pack.ink, width: 2.5 } })
    }
    // 方向 chevron（站之間，線上）
    if (i < n - 1) {
      slide.addShape('chevron', { x: cx + seg * 0.5 - 0.09, y: lineY - 0.1, w: 0.2, h: 0.2, fill: { color: pack.ink }, line: { type: 'none' } })
    }
    // 站名 + 說明（線下方）
    const labelY = lineY + 0.34
    const colW = seg * 0.94
    tx(slide, clampText(st.title.trim(), 14), { x: cx - colW / 2, y: labelY, w: colW, h: 0.34, fontSize: 15, bold: true, color: pack.ink, align: 'center' })
    if (st.desc) {
      tx(slide, clampText(st.desc.trim(), 40), {
        x: cx - colW / 2,
        y: labelY + 0.36,
        w: colW,
        h: Math.max(0.3, body.y + body.h - labelY - 0.5),
        fontSize: 11,
        color: pack.inkSoft,
        align: 'center',
        lineSpacingMultiple: 1.2,
        fit: 'shrink',
      })
    }
  })
}

/**
 * 第二招牌：stats 渲染成「月台離站顯示板」——
 * 黑底顯示板，各 stat 一行 split-flap LED 感：信號黃 displayFont 數值（左），
 * 標籤做「目的地」（右），行間細灰分隔線。配合 metro steps。2–4 項。
 */
function renderTransitDepartureBoard(slide: PptxGenJS.Slide, body: Rect, pack: Pack, s: Slide): void {
  const items = (s.stats ?? []).slice(0, 4)
  if (items.length < 2) return
  const n = items.length
  // 黑顯示板
  slide.addShape('roundRect', { x: body.x, y: body.y, w: body.w, h: body.h, rectRadius: pack.cardRadius, fill: { color: pack.ink }, line: { type: 'none' } })
  const padX = 0.4
  const headH = 0.42
  // 板頭：欄目標題
  tx(slide, 'TIME', { x: body.x + padX, y: body.y + 0.12, w: 2.0, h: headH - 0.12, fontSize: 9, bold: true, color: pack.faint, charSpacing: 3, fontFace: pack.displayFont })
  tx(slide, 'DESTINATION 目的地', { x: body.x + padX + 2.4, y: body.y + 0.12, w: body.w - padX * 2 - 2.4, h: headH - 0.12, fontSize: 9, bold: true, color: pack.faint, charSpacing: 2, fontFace: pack.displayFont })
  hline(slide, body.x + padX, body.y + headH, body.w - padX * 2, mix(pack.accent, pack.ink, 0.5), 1)
  const rowH = (body.h - headH - 0.16) / n
  items.forEach((st, i) => {
    const ry = body.y + headH + i * rowH
    // split-flap LED 數值（信號黃，左）
    tx(slide, clampText(st.value.trim(), 8), { x: body.x + padX, y: ry, w: 2.2, h: rowH, fontSize: 30, bold: true, color: pack.accent, valign: 'middle', fontFace: pack.displayFont, fit: 'shrink' })
    // 目的地標籤（白，右）
    tx(slide, clampText(st.label.trim(), 28), { x: body.x + padX + 2.4, y: ry, w: body.w - padX * 2 - 2.4, h: rowH, fontSize: 15, bold: true, color: 'FFFFFF', valign: 'middle', fontFace: pack.displayFont, fit: 'shrink' })
    // 行間分隔線
    if (i < n - 1) hline(slide, body.x + padX, ry + rowH, body.w - padX * 2, mix(pack.faint, pack.ink, 0.4), 0.5)
  })
}

/**
 * 第三招牌：compare 渲染成「對望月台」——
 * 上下兩塊月台 panel，中央一條路軌（兩條月台邊黃線夾住 sleeper ties 枕木）貫穿，
 * 各 panel 信號黃 line-color 標題列 + 站名式 points。月台對望感。2 欄對照。
 */
function renderTransitPlatforms(slide: PptxGenJS.Slide, body: Rect, pack: Pack, s: Slide): void {
  const cmp = s.compare
  if (!cmp || cmp.left.length === 0 || cmp.right.length === 0) return
  const trackH = 0.5
  const ph = (body.h - trackH) / 2
  const topY = body.y
  const botY = body.y + ph + trackH
  const trackY = body.y + ph
  const sides: [string, string[], number][] = [
    [cmp.leftTitle, cmp.left.slice(0, 4), topY],
    [cmp.rightTitle, cmp.right.slice(0, 4), botY],
  ]
  sides.forEach(([title, pts, py]) => {
    // 信號黃標題列（line-color header）
    slide.addShape('rect', { x: body.x, y: py, w: body.w, h: 0.46, fill: { color: pack.accent }, line: { type: 'none' } })
    tx(slide, clampText(title.trim(), 30), { x: body.x + 0.24, y: py, w: body.w - 0.48, h: 0.46, fontSize: 16, bold: true, color: pack.ink, valign: 'middle', fontFace: pack.displayFont, fit: 'shrink' })
    // 站名式 points
    const listY = py + 0.56
    const cols = Math.min(pts.length, 4)
    const gap = 0.3
    const cw = (body.w - gap * (cols - 1)) / cols
    pts.forEach((pt, j) => {
      const cx = body.x + j * (cw + gap)
      // 站號方牌
      slide.addShape('roundRect', { x: cx, y: listY, w: 0.3, h: 0.28, rectRadius: 0.05, fill: { color: pack.ink }, line: { type: 'none' } })
      tx(slide, String(j + 1), { x: cx, y: listY, w: 0.3, h: 0.28, fontSize: 12, bold: true, color: pack.accent, align: 'center', valign: 'middle', fontFace: pack.displayFont })
      tx(slide, clampText(pt.trim(), 30), { x: cx, y: listY + 0.34, w: cw, h: ph - 0.94, fontSize: 12, color: pack.inkSoft, lineSpacingMultiple: 1.16, fit: 'shrink' })
    })
  })
  // 中央路軌：兩條月台邊黃線夾住枕木（sleeper ties）
  hline(slide, body.x, trackY + 0.08, body.w, pack.accent, 3)
  hline(slide, body.x, trackY + trackH - 0.08, body.w, pack.accent, 3)
  const tieN = Math.floor(body.w / 0.4)
  for (let k = 0; k <= tieN; k++) {
    vline(slide, body.x + k * 0.4, trackY + 0.1, trackH - 0.2, mix(pack.ink, pack.bg, 0.5), 1.5)
  }
}

const transit: Pack = {
  id: 'transit',
  name: '月台',
  hint: '車站指示 · 旅地',
  swatches: ['#17191C', '#F2B705', '#F5F6F8'],
  dark: false,
  bg: 'FFFFFF',
  ink: TRN.ink,
  inkSoft: TRN.soft,
  faint: TRN.faint,
  hair: TRN.hair,
  accent: TRN.accent,
  statColor: TRN.ink,
  panel: TRN.panel,
  cardRadius: 0.08,
  displayFont: 'Arial',
  displayItalic: false,
  pageNoColor: TRN.soft,
  chartColors: ['17191C', 'F2B705', '6F7782', 'C9CDD3'],
  chartGridColor: TRN.hair,
  bulletPt: [17, 17, 16, 16, 15],
  titlePt: 28,
  marker: { kind: 'square', size: 0.1, color: TRN.accent, indent: 0.32 },
  tileStyle: 'cellBorder',
  compareStyle: 'panels',
  stepNode: { kind: 'squareFill', size: 0.34, color: TRN.ink, numColor: TRN.accent },
  quoteMark: { kind: 'square', size: 0.14, color: TRN.accent },
  splitPhoto: 'bleedHair',
  overrides: { steps: renderTransitMetro, stats: renderTransitDepartureBoard, compare: renderTransitPlatforms },

  // 逐版母題：右下角極邊一個遞增「站 N」小信號黃牌（逐版前進一站）
  deco(slide, ctx) {
    const n = ctx.seq + 1
    const w = 0.5
    const h = 0.2
    const bx = 12.43 - w
    const by = 6.92
    slide.addShape('roundRect', { x: bx, y: by, w, h, rectRadius: 0.04, fill: { color: mix(TRN.accent, 'FFFFFF', 0.12) }, line: { type: 'none' } })
    tx(slide, `站 ${n}`, { x: bx, y: by, w, h, fontSize: 8, bold: true, color: TRN.ink, align: 'center', valign: 'middle', fontFace: transit.displayFont })
  },

  cover(slide, deck, brand, img) {
    slide.background = { color: 'FFFFFF' }
    const hasImg = Boolean(img)
    // kicker 行：chevron 隊 + 字
    chevronRow(slide, 0.9, 1.85, 0.2, 0.26)
    tx(slide, 'TEACHING DECK · 教學簡報', { x: 1.75, y: 1.82, w: 7, h: 0.3, fontSize: 10, color: TRN.ink, charSpacing: 2, bold: true })
    // 站牌式 title：黑 pill 載白字（有相時 pill 上移收薄讓位俾橫幅相）
    const pillY = hasImg ? 2.2 : 2.4
    const pillH = hasImg ? 1.5 : 1.7
    // 黑站牌微微縱深漸層（頂部一絲信號黃暖光 → 底部沉黑），似搪瓷站牌受光
    slide.addShape('roundRect', {
      x: 0.9,
      y: pillY,
      w: 11.53,
      h: pillH,
      rectRadius: 0.12,
      fill: { color: gradLinear(90, [{ pos: 0, color: mix(TRN.ink, TRN.accent, 0.08) }, { pos: 100, color: TRN.ink }]) },
      line: { type: 'none' },
    })
    const fit = fitTitle(deck.title, 'cover')
    const pt = Math.min(38, fit.fontPt)
    tx(slide, deck.title, { x: 1.25, y: pillY, w: 10.9, h: pillH, fontSize: pt, bold: true, color: 'FFFFFF', valign: 'middle', lineSpacingMultiple: 1.05, fit: 'shrink' })
    // 月台邊黃粗線 + 副題
    const edgeY = hasImg ? 3.95 : 4.45
    hline(slide, 0.9, edgeY, 11.53, TRN.accent, 4)
    if (deck.subtitle) {
      tx(slide, deck.subtitle, { x: 0.9, y: edgeY + 0.3, w: 10.5, h: 0.45, fontSize: 15, color: TRN.soft })
    }
    if (img) {
      // 右側站牌式相卡（AR 合理先唔會裁到淨低天空 — 全闊窄條係 QA major 教訓）
      const frame: Rect = { x: 8.0, y: 4.85, w: 4.43, h: 2.1 }
      addCoverImage(slide, img, frame)
      slide.addShape('rect', { x: frame.x, y: frame.y, w: frame.w, h: frame.h, fill: { type: 'none' }, line: { color: TRN.ink, width: 1 } })
      photoCreditOnImage(slide, img.credit, frame)
    }
    // 「開往下一站」資訊牌（有相無相都喺左下）
    tx(slide, '前往 NEXT', { x: 0.9, y: 6.4, w: 4, h: 0.26, fontSize: 9, color: TRN.soft, charSpacing: 2 })
    tx(slide, dateLabel(), { x: 0.9, y: 6.66, w: 5, h: 0.34, fontSize: 12, bold: true, color: TRN.ink })
    tx(slide, brand, { x: 0.9, y: 7.05, w: 5, h: 0.3, fontSize: 9, color: TRN.faint })
  },

  section(slide, no, title) {
    slide.background = { color: 'FFFFFF' }
    // 左黑站柱全高：信號黃巨號 + SECTION 字
    slide.addShape('rect', { x: 0, y: 0, w: 4.3, h: 7.5, fill: { color: TRN.ink }, line: { type: 'none' } })
    tx(slide, pad2(no), { x: 0.7, y: 2.5, w: 3.3, h: 2.2, fontSize: 130, bold: true, color: TRN.accent, fontFace: 'Arial' })
    tx(slide, `SECTION ${sectionWord(no)}`, { x: 0.75, y: 4.6, w: 3.3, h: 0.3, fontSize: 9, color: 'FFFFFF', charSpacing: 3 })
    tx(slide, title, { x: 4.85, y: 3.3, w: 7.8, h: 1.1, fontSize: 32, bold: true, color: TRN.ink })
    chevronRow(slide, 4.85, 4.5, 0.2, 0.26)
  },

  contentFrame(slide, ctx) {
    slide.background = { color: 'FFFFFF' }
    // kicker 站牌 pill：scaffold 傳空格（唔顯示），pill 自畫黑底白字
    const w = pillW(ctx.kicker)
    slide.addShape('roundRect', { x: 0.9, y: 0.5, w, h: 0.36, rectRadius: 0.18, fill: { color: TRN.ink }, line: { type: 'none' } })
    tx(slide, ctx.kicker, { x: 0.9, y: 0.5, w, h: 0.36, fontSize: 9, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle', charSpacing: 1 })
    const { body } = scaffold(slide, transit, { ...ctx, kicker: ' ' }, { kickerY: 0.58, titleY: 0.9, hairline: true })
    // 右上細 chevron 隊（配圖出血版省略）
    if (!ctx.hasPhoto) chevronRow(slide, 11.7, 0.6, 0.16, 0.21)
    drawFooter(slide, transit, ctx)
    return body
  },
}

// ============================================================
//  深海 ocean — 分層海浪
//  地理／生物科海洋分層意象：版底三層浪（超闊 ellipse 只露頂弧）
//  由淺入深疊起，氣泡逐粒上升；章節版成版潛入深海色。
// ============================================================

const OCE = { ink: '103B47', soft: '54707A', faint: '8FA6AE', hair: 'DCEBEC', accent: '15808D', deep: '0E3D49', panel: 'E4F4F5', band1: 'DCF1F2', band2: '9FD6D8', band3: '4FA8AE' }

/** 海浪帶：超闊 ellipse 由版底升起，只露頂弧 */
function wave(slide: PptxGenJS.Slide, x: number, y: number, w: number, h: number, color: string): void {
  slide.addShape('ellipse', { x, y, w, h, fill: { color }, line: { type: 'none' } })
}

/** 氣泡：outline 正圓（d = 直徑） */
function bubble(slide: PptxGenJS.Slide, x: number, y: number, d: number, color: string): void {
  slide.addShape('ellipse', { x, y, w: d, h: d, fill: { type: 'none' }, line: { color, width: 1.25 } })
}

/**
 * 招牌：steps 渲染成「分層下潛」——
 * 由上而下，各步一條海色橫帶，逐層加深（mix accent→ink 按深度），
 * 左側深度標籤（序號／「-10m」式），右側 title+desc，幾粒上升氣泡。
 * 潛入海層意象。2–5 步。
 */
function renderOceanDescent(slide: PptxGenJS.Slide, body: Rect, pack: Pack, s: Slide): void {
  const items = (s.steps ?? []).slice(0, 5)
  if (items.length < 2) return
  const n = items.length
  const gap = 0.12
  const bh = (body.h - gap * (n - 1)) / n
  const tagW = 1.5
  items.forEach((st, i) => {
    const by = body.y + i * (bh + gap)
    const depth = n === 1 ? 0 : i / (n - 1)
    const bandColor = mix(pack.accent, pack.ink, depth * 0.7)
    // 海色橫帶（逐層加深）
    slide.addShape('rect', { x: body.x, y: by, w: body.w, h: bh, fill: { color: bandColor }, line: { type: 'none' } })
    // 左側深度標籤
    const onDark = depth > 0.35
    const labelColor = onDark ? mix('FFFFFF', bandColor, 0.85) : pack.ink
    tx(slide, `-${(i + 1) * 10}m`, { x: body.x + 0.24, y: by, w: tagW, h: bh, fontSize: 20, bold: true, color: labelColor, valign: 'middle', fontFace: pack.displayFont })
    // 右側 title + desc
    const tx0 = body.x + tagW + 0.4
    const textW = body.w - tagW - 0.7
    const titleColor = onDark ? 'FFFFFF' : pack.ink
    const descColor = onDark ? mix('FFFFFF', bandColor, 0.7) : pack.inkSoft
    if (st.desc) {
      tx(slide, clampText(st.title.trim(), 16), { x: tx0, y: by + 0.08, w: textW, h: bh * 0.5, fontSize: 15, bold: true, color: titleColor, valign: 'middle' })
      tx(slide, clampText(st.desc.trim(), 50), { x: tx0, y: by + bh * 0.5, w: textW, h: bh * 0.5 - 0.06, fontSize: 11, color: descColor, valign: 'middle', lineSpacingMultiple: 1.15, fit: 'shrink' })
    } else {
      tx(slide, clampText(st.title.trim(), 16), { x: tx0, y: by, w: textW, h: bh, fontSize: 15, bold: true, color: titleColor, valign: 'middle' })
    }
    // 上升氣泡（帶右端）
    const bubbleColor = onDark ? mix('FFFFFF', bandColor, 0.6) : pack.accent
    bubble(slide, body.x + body.w - 0.5, by + bh * 0.55, 0.16, bubbleColor)
    bubble(slide, body.x + body.w - 0.72, by + bh * 0.3, 0.1, bubbleColor)
  })
}

/**
 * 第二招牌：stats 渲染成「深度計氣泡」——
 * 各 stat 一粒實心海色氣泡（由淺入深逐粒下沉），值入圓內、標籤喺下，
 * 小上升氣泡點綴。深度計讀數意象。2–4 項。
 */
function renderOceanDepthGauge(slide: PptxGenJS.Slide, body: Rect, pack: Pack, s: Slide): void {
  const items = (s.stats ?? []).slice(0, 4)
  if (items.length < 2) return
  const n = items.length
  const gap = 0.4
  const cw = (body.w - gap * (n - 1)) / n
  const d = Math.min(cw - 0.3, 2.2, body.h - 0.9)
  items.forEach((st, i) => {
    const cx = body.x + i * (cw + gap) + cw / 2
    const depth = n === 1 ? 0 : i / (n - 1)
    // 逐粒下沉：氣泡 y 按深度遞增
    const cy = body.y + 0.2 + depth * Math.max(0, body.h - d - 1.1)
    const fillColor = mix(pack.accent, pack.ink, depth * 0.7)
    // 實心海色氣泡圓
    slide.addShape('ellipse', { x: cx - d / 2, y: cy, w: d, h: d, fill: { color: fillColor }, line: { color: mix('FFFFFF', fillColor, 0.4), width: 1.25 } })
    // 值入圓內
    tx(slide, clampText(st.value.trim(), 8), { x: cx - d / 2, y: cy, w: d, h: d, fontSize: 36, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle', fontFace: pack.displayFont, fit: 'shrink' })
    // 小上升氣泡點綴（圓上方）
    bubble(slide, cx + d / 2 - 0.18, cy - 0.18, 0.14, fillColor)
    bubble(slide, cx + d / 2 - 0.02, cy - 0.42, 0.09, fillColor)
    // 標籤喺圓下
    tx(slide, clampText(st.label.trim(), 22), { x: cx - cw / 2, y: cy + d + 0.14, w: cw, h: 0.6, fontSize: 13, color: pack.inkSoft, align: 'center', lineSpacingMultiple: 1.15, fit: 'shrink' })
  })
}

/**
 * 第三招牌：cards 渲染成「生態分層卡」——
 * 各卡一條海色橫帶，由上而下逐層加深（mix accent→ink 按深度），似海洋生態分層，
 * 左側 title + desc，右端一兩粒上升氣泡。海層生態意象。2–6 卡。
 */
function renderOceanStrata(slide: PptxGenJS.Slide, body: Rect, pack: Pack, s: Slide): void {
  const items = (s.cards ?? []).slice(0, 6)
  if (items.length < 2) return
  const n = items.length
  const gap = 0.12
  const bh = (body.h - gap * (n - 1)) / n
  items.forEach((card, i) => {
    const by = body.y + i * (bh + gap)
    const depth = n === 1 ? 0 : i / (n - 1)
    const bandColor = mix(pack.accent, pack.ink, depth * 0.7)
    // 海色橫帶（逐層加深）
    slide.addShape('rect', { x: body.x, y: by, w: body.w, h: bh, fill: { color: bandColor }, line: { type: 'none' } })
    const onDark = depth > 0.35
    const titleColor = onDark ? 'FFFFFF' : pack.ink
    const descColor = onDark ? mix('FFFFFF', bandColor, 0.7) : pack.inkSoft
    const textX = body.x + 0.3
    const textW = body.w - 1.2
    // title + desc
    if (card.desc) {
      tx(slide, clampText(card.title.trim(), 18), { x: textX, y: by + 0.08, w: textW, h: bh * 0.5, fontSize: 16, bold: true, color: titleColor, valign: 'middle', fontFace: pack.displayFont })
      tx(slide, clampText(card.desc.trim(), 70), { x: textX, y: by + bh * 0.5, w: textW, h: bh * 0.5 - 0.06, fontSize: 11, color: descColor, valign: 'middle', lineSpacingMultiple: 1.15, fit: 'shrink' })
    } else {
      tx(slide, clampText(card.title.trim(), 18), { x: textX, y: by, w: textW, h: bh, fontSize: 16, bold: true, color: titleColor, valign: 'middle', fontFace: pack.displayFont })
    }
    // 上升氣泡（帶右端）
    const bubbleColor = onDark ? mix('FFFFFF', bandColor, 0.6) : pack.accent
    bubble(slide, body.x + body.w - 0.5, by + bh * 0.55, 0.16, bubbleColor)
    bubble(slide, body.x + body.w - 0.72, by + bh * 0.28, 0.1, bubbleColor)
  })
}

const ocean: Pack = {
  id: 'ocean',
  name: '深海',
  hint: '海洋分層 · 地生',
  swatches: ['#15808D', '#9FD6D8', '#0E3D49'],
  dark: false,
  bg: 'FFFFFF',
  ink: OCE.ink,
  inkSoft: OCE.soft,
  faint: OCE.faint,
  hair: OCE.hair,
  accent: OCE.accent,
  statColor: OCE.deep,
  panel: OCE.panel,
  cardRadius: 0.1,
  displayFont: 'Arial',
  displayItalic: false,
  pageNoColor: OCE.faint,
  chartColors: ['15808D', '4FA8AE', '0E3D49', '9FD6D8'],
  chartGridColor: OCE.hair,
  bulletPt: [18, 17, 17, 16, 15],
  titlePt: 29,
  marker: { kind: 'dot', size: 0.1, color: OCE.accent, indent: 0.3 },
  tileStyle: 'tintCard',
  compareStyle: 'panels',
  stepNode: { kind: 'circleOutline', size: 0.34, color: OCE.accent, numColor: OCE.accent },
  quoteMark: { kind: 'circle', size: 0.5, linePt: 1.5, color: OCE.accent },
  splitPhoto: 'bleedScrim',
  overrides: { steps: renderOceanDescent, stats: renderOceanDepthGauge, cards: renderOceanStrata },

  // 逐版母題：右下角極邊一個遞增深度標籤 + 小氣泡，氣泡逐版往上、深度逐版加深（愈潛愈深）
  deco(slide, ctx) {
    const depth = (ctx.seq + 1) * 10
    const lx = 12.43
    const ly = 6.96
    // 深度標籤（海色淡字）
    tx(slide, `-${depth}m`, { x: lx - 0.9, y: ly - 0.04, w: 0.9, h: 0.2, fontSize: 8, bold: true, color: mix(OCE.accent, 'FFFFFF', 0.25), align: 'right', valign: 'middle', fontFace: ocean.displayFont })
    // 小氣泡：逐版往上升（y 隨 seq 減）
    const rise = (ctx.seq % 5) * 0.04
    bubble(slide, lx - 1.06, ly - 0.02 - rise, 0.1, mix(OCE.accent, 'FFFFFF', 0.35))
  },

  cover(slide, deck, brand, img) {
    slide.background = { color: 'FFFFFF' }
    const hasImg = Boolean(img)
    if (img) {
      // full-bleed 相 + 深海 scrim，文字轉白（浪照畫 — 實色疊喺 scrim 上）
      addCoverImage(slide, img, { x: 0, y: 0, w: 13.33, h: 7.5 })
      slide.addShape('rect', { x: 0, y: 0, w: 13.33, h: 7.5, fill: { color: OCE.deep, transparency: 40 }, line: { type: 'none' } })
    }
    // 版底三層浪：由淺到深逐層疊上
    wave(slide, -1.5, 5.9, 16.3, 3.4, OCE.band1)
    wave(slide, -2.2, 6.45, 17.7, 3.4, OCE.band2)
    // 最前一層浪：頂弧受光提亮 → 深處沉入 accent 海色，俾招牌浪帶縱深
    slide.addShape('ellipse', {
      x: -1.0,
      y: 7.0,
      w: 15.3,
      h: 3.0,
      fill: { color: gradLinear(90, [{ pos: 0, color: mix(OCE.band3, 'FFFFFF', 0.14) }, { pos: 100, color: mix(OCE.band3, OCE.accent, 0.22) }]) },
      line: { type: 'none' },
    })
    // 右側上升氣泡
    const bubbleColor = hasImg ? 'FFFFFF' : OCE.accent
    bubble(slide, 11.6, 3.2, 0.3, bubbleColor)
    bubble(slide, 11.95, 2.6, 0.2, bubbleColor)
    bubble(slide, 11.75, 2.1, 0.12, bubbleColor)
    // kicker + 題 + 副題（有相轉白保 contrast）
    tx(slide, 'TEACHING DECK · 教學簡報', { x: 0.9, y: 1.1, w: 7, h: 0.3, fontSize: 10, color: hasImg ? OCE.band2 : OCE.accent, charSpacing: 3, bold: true })
    const fit = fitTitle(deck.title, 'cover')
    const lines = Math.max(1, Math.min(2, estimateLines(deck.title, fit.fontPt, 10.8)))
    tx(slide, deck.title, { x: 0.9, y: 2.3, w: 10.8, h: 1.55, fontSize: fit.fontPt, bold: true, color: hasImg ? 'FFFFFF' : OCE.ink, lineSpacingMultiple: 1.08, fit: 'shrink' })
    if (deck.subtitle) {
      const subY = 2.3 + (lines * fit.fontPt * 1.08) / 72 + 0.22
      tx(slide, deck.subtitle, { x: 0.9, y: subY, w: 10.5, h: 0.5, fontSize: 15, color: hasImg ? 'FFFFFF' : OCE.soft })
    }
    // 日期浮喺浪上、brand 沉喺中浪 — 用深海色字先讀到（白字喺 band2/3 上隱形係 QA major）
    tx(slide, dateLabel(), { x: 0.9, y: 5.5, w: 5, h: 0.3, fontSize: 10, color: hasImg ? OCE.band1 : OCE.soft })
    if (img) photoCreditOnImage(slide, img.credit, { x: 0, y: 0, w: 13.33, h: 7.5 })
    tx(slide, brand, { x: 0.9, y: 7.06, w: 5, h: 0.3, fontSize: 9, bold: true, color: OCE.deep })
  },

  section(slide, no, title) {
    slide.background = { color: OCE.deep }
    // 巨號要夠白先似透光水面（淡 ghost 喺深海底會蒸發）
    tx(slide, pad2(no), { x: 0.8, y: 1.2, w: 6, h: 2.9, fontSize: 150, bold: true, color: mix('FFFFFF', OCE.deep, 0.65), fontFace: 'Arial' })
    tx(slide, title, { x: 0.9, y: 4.55, w: 11.2, h: 1.2, fontSize: 32, bold: true, color: 'FFFFFF' })
    // 深海版底兩層浪 + 白氣泡
    wave(slide, -1.5, 6.6, 16.3, 2.6, mix(OCE.accent, OCE.deep, 0.5))
    wave(slide, -2.0, 7.0, 17.0, 2.4, mix(OCE.accent, OCE.deep, 0.3))
    bubble(slide, 11.8, 4.7, 0.18, 'FFFFFF')
    bubble(slide, 12.05, 4.3, 0.1, 'FFFFFF')
  },

  contentFrame(slide, ctx) {
    slide.background = { color: 'FFFFFF' }
    const { body } = scaffold(slide, ocean, ctx, { kickerY: 0.58, titleY: 0.9, hairline: true })
    // 右上氣泡組（配圖出血版省略）
    if (!ctx.hasPhoto) {
      bubble(slide, 12.15, 0.55, 0.2, OCE.accent)
      bubble(slide, 12.0, 0.95, 0.12, OCE.accent)
    }
    // 版底極矮浪 — 必須先畫，footer 字浮喺浪上面
    wave(slide, -1.5, 7.28, 16.3, 0.7, OCE.band1)
    drawFooter(slide, ocean, ctx)
    return body
  },
}

// ───────── 滙出 ─────────

export const GALLERY_PACKS_2: Pack[] = [blueprint, ivy, redgrid, transit, ocean]
