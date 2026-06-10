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
import { estimateLines, fitTitle, mix } from './pptxText'

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

  cover(slide, deck, brand, img) {
    slide.background = { color: BLU.bg }
    const hasImg = Boolean(img)
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

  cover(slide, deck, brand, img) {
    slide.background = { color: 'FFFFFF' }
    // 左綠欄（書脊）：徽記 + kicker + 白雙細線 + 底部日期／brand
    slide.addShape('rect', { x: 0, y: 0, w: 4.6, h: 7.5, fill: { color: IVY.accent }, line: { type: 'none' } })
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

  cover(slide, deck, brand, img) {
    slide.background = { color: 'FFFFFF' }
    const hasImg = Boolean(img)
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

  cover(slide, deck, brand, img) {
    slide.background = { color: 'FFFFFF' }
    const hasImg = Boolean(img)
    // kicker 行：chevron 隊 + 字
    chevronRow(slide, 0.9, 1.85, 0.2, 0.26)
    tx(slide, 'TEACHING DECK · 教學簡報', { x: 1.75, y: 1.82, w: 7, h: 0.3, fontSize: 10, color: TRN.ink, charSpacing: 2, bold: true })
    // 站牌式 title：黑 pill 載白字（有相時 pill 上移收薄讓位俾橫幅相）
    const pillY = hasImg ? 2.2 : 2.4
    const pillH = hasImg ? 1.5 : 1.7
    slide.addShape('roundRect', { x: 0.9, y: pillY, w: 11.53, h: pillH, rectRadius: 0.12, fill: { color: TRN.ink }, line: { type: 'none' } })
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
    wave(slide, -1.0, 7.0, 15.3, 3.0, OCE.band3)
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
