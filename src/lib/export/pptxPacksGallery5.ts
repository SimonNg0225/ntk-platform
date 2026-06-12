// ============================================================
//  pptx template packs — gallery 第五輯（漫畫／手抄本／立體／故障）
//  ------------------------------------------------------------
//  · 漫畫 comic      — 美式漫畫：粗黑外框 + 爆炸星 + 半調網點 panel
//  · 手抄本 manuscript — 中世紀泥金：泥金大寫首字 + 雙金線 + 藤蔓角飾
//  · 立體 isometric  — 積木立體：硬偏移塊做假 3D pop-out
//  · 故障 glitch     — 賽博龐克：青／洋紅色差錯位 + 掃描線 + HUD 角括
//  鐵律同 pptxPacks.ts：所有文字經 tx()；色 6 位 hex 無 #；
//  shadow 只准 outer；無 gradient／SVG；rectRadius 單位吋。
//  形狀只准 rect/roundRect/ellipse/line/chevron/triangle —— 花樣靠基本六款砌。
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
import { coverTextureUri } from './slideTextures'

// ============================================================
//  漫畫 comic — 美式漫畫
//  奶白底 + 黑墨 + 大紅點睛（加黃）：成個 deck 粗黑外框（2.5pt）兜底，
//  封面爆炸星（兩塊旋轉紅／黃 rect 疊）+ 半調網點；cards 做漫畫格仔。
// ============================================================

const COM = { bg: 'FAF6EE', ink: '15151A', soft: '4A4A52', faint: '8A8A90', hair: 'D9D5CC', accent: 'E63B2E', yellow: 'F2C53D', panel: 'FFFFFF' }

/** 漫畫粗黑外框（2.5pt，inset 吋；漫畫 panel 語言） */
function comFrame(slide: PptxGenJS.Slide, x: number, y: number, w: number, h: number, fill: string, pt = 2.5): void {
  slide.addShape('rect', { x, y, w, h, fill: { color: fill }, line: { color: COM.ink, width: pt } })
}

/** 爆炸星：兩塊重疊旋轉 rect（紅 45°／黃 20°）+ 黑邊，似漫畫 BAM! 爆光 */
function comBurst(slide: PptxGenJS.Slide, cx: number, cy: number, size: number): void {
  slide.addShape('rect', { x: cx - size / 2, y: cy - size / 2, w: size, h: size, rotate: 20, fill: { color: COM.yellow }, line: { color: COM.ink, width: 2 } })
  slide.addShape('rect', { x: cx - size / 2, y: cy - size / 2, w: size, h: size, rotate: 45, fill: { color: COM.accent }, line: { color: COM.ink, width: 2 } })
}

/** 半調網點：cols×rows 粒細黑點，每 step 吋一粒（漫畫印刷網點意象） */
function comHalftone(slide: PptxGenJS.Slide, x: number, y: number, cols: number, rows: number, step: number, dot: number, color: string): void {
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      slide.addShape('ellipse', { x: x + c * step, y: y + r * step, w: dot, h: dot, fill: { color }, line: { type: 'none' } })
    }
  }
}

/**
 * 招牌：cards 渲染成「漫畫格仔」——
 * 粗黑外框白 panel 網格（留 gutter），各格角落粗黑編號 tag、
 * 粗標題 + 正文；其中一格加一粒細爆炸星點睛。漫畫分鏡感。2–6 格。
 */
function renderComicPanels(slide: PptxGenJS.Slide, body: Rect, pack: Pack, s: Slide): void {
  const items = (s.cards ?? []).slice(0, 6)
  if (items.length < 2) return
  const n = items.length
  const cols = n <= 2 ? n : n <= 4 ? 2 : 3
  const rows = Math.ceil(n / cols)
  const gap = 0.32 // gutter
  const cw = (body.w - gap * (cols - 1)) / cols
  const ch = (body.h - gap * (rows - 1)) / rows
  const burstIdx = n - 1 // 最後一格點睛
  items.forEach((card, i) => {
    const r = Math.floor(i / cols)
    const c = i % cols
    const cx = body.x + c * (cw + gap)
    const cy = body.y + r * (ch + gap)
    // 粗黑外框白 panel
    comFrame(slide, cx, cy, cw, ch, pack.panel, 2.5)
    // 角落粗黑編號 tag（黑方 + 白字）
    const tag = 0.42
    slide.addShape('rect', { x: cx, y: cy, w: tag, h: tag, fill: { color: pack.ink }, line: { type: 'none' } })
    tx(slide, String(i + 1), { x: cx, y: cy, w: tag, h: tag, fontSize: 16, bold: true, color: pack.panel, align: 'center', valign: 'middle', fontFace: pack.displayFont })
    // 其中一格細爆炸星
    if (i === burstIdx) comBurst(slide, cx + cw - 0.34, cy + 0.34, 0.5)
    // 粗標題（tag 右起）
    tx(slide, clampText(card.title.trim(), 14), { x: cx + tag + 0.14, y: cy + 0.04, w: cw - tag - 0.5, h: tag, fontSize: 17, bold: true, color: pack.ink, valign: 'middle', lineSpacingMultiple: 1.02, fontFace: pack.displayFont, fit: 'shrink' })
    // 正文
    if (card.desc) {
      tx(slide, clampText(card.desc.trim(), 84), { x: cx + 0.18, y: cy + tag + 0.12, w: cw - 0.36, h: ch - tag - 0.26, fontSize: 12, color: pack.inkSoft, lineSpacingMultiple: 1.2, fit: 'shrink' })
    }
  })
}

const comic: Pack = {
  id: 'comic',
  name: '漫畫',
  hint: '美式漫畫 · 趣味',
  swatches: ['#E63B2E', '#F2C53D', '#15151A'],
  dark: false,
  bg: COM.bg,
  ink: COM.ink,
  inkSoft: COM.soft,
  faint: COM.faint,
  hair: COM.hair,
  accent: COM.accent,
  statColor: COM.accent,
  panel: COM.panel,
  cardRadius: 0.02,
  displayFont: 'Arial Black',
  displayItalic: false,
  pageNoColor: COM.soft,
  chartColors: ['E63B2E', 'F2C53D', '15151A', '8A8A90'],
  chartGridColor: COM.hair,
  bulletPt: [18, 18, 17, 17, 16],
  titlePt: 28,
  marker: { kind: 'square', size: 0.11, color: COM.accent, indent: 0.32 },
  tileStyle: 'cellBorder',
  compareStyle: 'cards',
  stepNode: { kind: 'squareFill', size: 0.34, color: COM.ink, numColor: COM.yellow },
  quoteMark: { kind: 'square', size: 0.16, color: COM.accent },
  splitPhoto: 'bleedHair',
  overrides: { cards: renderComicPanels },

  // 逐版母題：右下角極邊一撮半調網點（3-6 粒），粒數按 seq % 4 遞進
  deco(slide, ctx) {
    const cols = 3 + (ctx.seq % 4) // 3..6
    comHalftone(slide, 12.42, 7.04, cols, 1, 0.12, 0.06, mix(COM.ink, COM.bg, 0.4))
  },

  cover(slide, deck, brand, img) {
    slide.background = { color: COM.bg }
    const hasImg = Boolean(img)
    // 招牌半調網點紋理底圖（瀏覽器 Canvas raster；冇 canvas 時 fallback 漸層底）
    const tex = coverTextureUri('comic')
    const coverBg = gradLinear(90, [
      { pos: 0, color: mix(COM.bg, 'FFFFFF', 0.04) },
      { pos: 100, color: mix(COM.bg, COM.ink, 0.06) },
    ])
    if (tex) {
      slide.addImage({ data: tex, x: 0, y: 0, w: 13.333, h: 7.5, sizing: { type: 'cover', w: 13.333, h: 7.5 } })
      // 粗黑外框（無填色，等紋理透出）
      slide.addShape('rect', { x: 0.3, y: 0.3, w: 12.73, h: 6.9, fill: { type: 'none' }, line: { color: COM.ink, width: 2.5 } })
    } else {
      comFrame(slide, 0.3, 0.3, 12.73, 6.9, coverBg, 2.5)
    }
    // 左上半調網點 + kicker
    comHalftone(slide, 0.7, 0.66, 8, 2, 0.16, 0.07, mix(COM.ink, COM.bg, 0.18))
    tx(slide, 'COMIC DECK · 教學簡報', { x: 0.9, y: 1.18, w: 7, h: 0.3, fontSize: 10, color: COM.accent, charSpacing: 3, bold: true, fontFace: 'Arial' })
    // 粗黑外框題目 box（爆炸星感）
    const titleW = hasImg ? 6.3 : 9.6
    const boxY = 2.2
    const fit = fitTitle(deck.title, 'cover')
    const pt = Math.min(40, fit.fontPt)
    const lines = Math.max(1, Math.min(2, estimateLines(deck.title, pt, titleW - 0.5)))
    const boxH = lines === 2 ? 2.3 : 1.5
    const panelGrad = gradLinear(90, [
      { pos: 0, color: mix(COM.panel, 'FFFFFF', 0.04) },
      { pos: 100, color: mix(COM.panel, COM.ink, 0.05) },
    ])
    comFrame(slide, 0.9, boxY, titleW, boxH, panelGrad, 2.5)
    tx(slide, deck.title, { x: 1.2, y: boxY, w: titleW - 0.6, h: boxH, fontSize: pt, bold: true, color: COM.ink, valign: 'middle', lineSpacingMultiple: 1.04, fontFace: 'Arial Black', fit: 'shrink' })
    let cursorY = boxY + boxH + 0.24
    if (deck.subtitle) {
      tx(slide, deck.subtitle, { x: 0.95, y: cursorY, w: hasImg ? 6.1 : 9.4, h: 0.5, fontSize: 15, color: COM.soft })
      cursorY += 0.55
    }
    // 大爆炸星（無相時右下、有相時細粒貼題框）
    if (img) {
      // 右側相 + 粗黑框
      const frame: Rect = { x: 7.7, y: 1.5, w: 4.9, h: 3.9 }
      addCoverImage(slide, img, frame)
      slide.addShape('rect', { x: frame.x, y: frame.y, w: frame.w, h: frame.h, fill: { type: 'none' }, line: { color: COM.ink, width: 2.5 } })
      comBurst(slide, frame.x + 0.1, frame.y - 0.05, 0.7)
      photoCreditOnImage(slide, img.credit, frame)
    } else {
      comBurst(slide, 10.6, 4.7, 2.2)
      tx(slide, 'BAM!', { x: 9.5, y: 4.42, w: 2.2, h: 0.56, fontSize: 28, bold: true, color: COM.panel, align: 'center', valign: 'middle', fontFace: 'Arial Black', rotate: 8 })
    }
    // 底部日期 + brand
    tx(slide, dateLabel(), { x: 0.95, y: 6.5, w: 5, h: 0.3, fontSize: 10, color: COM.soft })
    tx(slide, brand, { x: 0.95, y: 6.82, w: 5, h: 0.3, fontSize: 9, color: COM.faint })
  },

  section(slide, no, title) {
    slide.background = { color: COM.bg }
    // 全版半調網點底紋（左上稀疏一片）
    comHalftone(slide, 0.7, 0.7, 10, 4, 0.5, 0.1, mix(COM.ink, COM.bg, 0.1))
    // 章節號入粗黑框（似漫畫大格）
    comFrame(slide, 0.85, 1.2, 3.1, 2.9, COM.panel, 2.5)
    tx(slide, pad2(no), { x: 0.85, y: 1.2, w: 3.1, h: 2.9, fontSize: 130, bold: true, color: COM.accent, align: 'center', valign: 'middle', fontFace: 'Arial Black' })
    comBurst(slide, 3.95, 1.35, 0.7)
    tx(slide, title, { x: 0.9, y: 4.6, w: 11.2, h: 1.0, fontSize: 32, bold: true, color: COM.ink, fontFace: 'Arial' })
    tx(slide, `CHAPTER ${sectionWord(no)}`, { x: 0.9, y: 5.7, w: 6, h: 0.3, fontSize: 9, color: COM.soft, charSpacing: 4, bold: true, fontFace: 'Arial' })
  },

  contentFrame(slide, ctx) {
    slide.background = { color: COM.bg }
    const { body } = scaffold(slide, comic, ctx, { kickerY: 0.58, titleY: 0.9, hairline: true })
    // 右上細爆炸星（配圖出血版省略）
    if (!ctx.hasPhoto) comBurst(slide, 12.2, 0.72, 0.5)
    drawFooter(slide, comic, ctx)
    return body
  },
}

// ============================================================
//  手抄本 manuscript — 中世紀泥金
//  羊皮紙底 + 牛血墨 + 泥金點睛（加青金石）：泥金大寫首字方塊、
//  雙金線（double rule）做章法、藤蔓角飾；bullets 做泥金抄本欄。
// ============================================================

const MAN = { bg: 'F3E9D2', ink: '3A2218', soft: '6B5240', faint: '9C8568', hair: 'D8C7A6', gilt: 'B68A2E', lapis: '27408B', panel: 'EFE2C4' }

/** 泥金雙線（double rule）：1.25pt 粗金線 + 0.06" 下一條 0.5pt（章法分界） */
function manRule(slide: PptxGenJS.Slide, x: number, y: number, w: number, color: string): void {
  hline(slide, x, y, w, color, 1.25)
  hline(slide, x, y + 0.06, w, color, 0.5)
}

/** 泥金大寫首字塊：金邊方框（panel 底）載一個大 Georgia 字（drop-cap） */
function manInitial(slide: PptxGenJS.Slide, x: number, y: number, size: number, ch: string, fontPt: number): void {
  slide.addShape('rect', { x, y, w: size, h: size, fill: { color: MAN.panel }, line: { color: MAN.gilt, width: 2 } })
  slide.addShape('rect', { x: x + 0.06, y: y + 0.06, w: size - 0.12, h: size - 0.12, fill: { type: 'none' }, line: { color: mix(MAN.lapis, MAN.panel, 0.6), width: 0.75 } })
  tx(slide, ch, { x, y, w: size, h: size, fontSize: fontPt, bold: true, color: MAN.gilt, align: 'center', valign: 'middle', fontFace: 'Georgia' })
}

/** 泥金藤蔓角飾：幾條短金線 + 一片葉（ellipse）；dir 控制伸展方向（1=右下 / -1=左上等） */
function manVine(slide: PptxGenJS.Slide, x: number, y: number, dx: number, dy: number, color: string): void {
  hline(slide, x, y, dx, color, 1)
  vline(slide, x, y, dy, color, 1)
  hline(slide, x + dx * 0.5, y + dy * 0.6, dx * 0.4, color, 0.75)
  // 葉（細 ellipse）
  slide.addShape('ellipse', { x: x + dx - 0.04, y: y + dy * 0.6 - 0.03, w: 0.1, h: 0.06, fill: { color }, line: { type: 'none' } })
}

/**
 * 招牌：bullets 渲染成「泥金抄本欄」——
 * 左側泥金大寫首字塊（取版題首字）+ 雙金章法線，
 * 各點作抄本行（牛血墨）排於首字右，行間細金分行線。中世紀手抄本氣派。
 */
function renderManuscriptColumn(slide: PptxGenJS.Slide, body: Rect, pack: Pack, s: Slide): void {
  const bullets = (s.bullets ?? []).filter((b) => b.trim()).slice(0, 6)
  if (bullets.length === 0) return
  const n = bullets.length
  // 泥金大寫首字塊（左上）
  const capSize = Math.min(1.6, body.h * 0.42)
  manInitial(slide, body.x, body.y, capSize, [...s.title.trim()][0] ?? 'A', Math.round(capSize * 52))
  // 抄本欄左界（首字下接續排版）+ 文字區
  const textX = body.x + capSize + 0.5
  const textW = body.x + body.w - textX
  // 頂部雙金章法線（壓首字頂）
  manRule(slide, textX, body.y + 0.04, textW, pack.accent)
  // 首字下方延伸金竪線（抄本欄左飾界）
  vline(slide, body.x + capSize / 2, body.y + capSize + 0.1, Math.max(0, body.h - capSize - 0.2), mix(pack.accent, pack.bg, 0.4), 0.75)
  const listY = body.y + 0.36
  const rowH = (body.h - 0.5) / n
  bullets.forEach((b, i) => {
    const ry = listY + i * rowH
    // 行首泥金細方點
    slide.addShape('rect', { x: textX, y: ry + rowH / 2 - 0.05, w: 0.1, h: 0.1, fill: { color: pack.accent }, line: { type: 'none' } })
    tx(slide, clampText(b.trim(), 56), { x: textX + 0.26, y: ry, w: textW - 0.26, h: rowH, fontSize: pack.bulletPt[Math.min(Math.max(n, 2), 6) - 2], color: pack.ink, valign: 'middle', lineSpacingMultiple: 1.2, fit: 'shrink' })
    // 行間細金分行線（抄本 ruled lines）
    if (i < n - 1) hline(slide, textX, ry + rowH, textW, mix(pack.accent, pack.bg, 0.55), 0.5)
  })
}

const manuscript: Pack = {
  id: 'manuscript',
  name: '手抄本',
  hint: '中世紀泥金 · 人文/歷史',
  swatches: ['#B68A2E', '#27408B', '#3A2218'],
  dark: false,
  bg: MAN.bg,
  ink: MAN.ink,
  inkSoft: MAN.soft,
  faint: MAN.faint,
  hair: MAN.hair,
  accent: MAN.gilt,
  statColor: MAN.lapis,
  panel: MAN.panel,
  cardRadius: 0.02,
  displayFont: 'Georgia',
  displayItalic: false,
  pageNoColor: MAN.faint,
  chartColors: ['B68A2E', '27408B', '8C6A3E', 'C8B68A'],
  chartGridColor: MAN.hair,
  bulletPt: [18, 18, 17, 17, 16],
  titlePt: 28,
  marker: { kind: 'square', size: 0.1, color: MAN.gilt, indent: 0.32 },
  tileStyle: 'hairline',
  compareStyle: 'panels',
  stepNode: { kind: 'circleOutline', size: 0.34, color: MAN.gilt, numColor: MAN.ink },
  quoteMark: { kind: 'glyph', color: mix(MAN.gilt, MAN.bg, 0.4) },
  splitPhoto: 'bleedHair',
  overrides: { bullets: renderManuscriptColumn },

  // 逐版母題：角落一個泥金藤蔓角飾（短金線 + 葉），角位按 seq % 4 輪換
  deco(slide, ctx) {
    const c = mix(MAN.gilt, MAN.bg, 0.4)
    const spots: [number, number, number, number][] = [
      [0.46, 0.46, 0.34, 0.34], // 左上：向右下伸
      [12.87, 0.46, -0.34, 0.34], // 右上：向左下伸
      [12.87, 7.04, -0.34, -0.34], // 右下：向左上伸
      [0.46, 7.04, 0.34, -0.34], // 左下：向右上伸
    ]
    const [x, y, dx, dy] = spots[ctx.seq % 4]
    manVine(slide, x, y, dx, dy, c)
  },

  cover(slide, deck, brand, img) {
    slide.background = { color: MAN.bg }
    const hasImg = Boolean(img)
    // 招牌羊皮紙紋理底圖（瀏覽器 Canvas raster；冇 canvas 時 fallback 全版極淡羊皮紙深度漸層）
    const tex = coverTextureUri('manuscript')
    if (tex) {
      slide.addImage({ data: tex, x: 0, y: 0, w: 13.333, h: 7.5, sizing: { type: 'cover', w: 13.333, h: 7.5 } })
    } else {
      // 全版極淡羊皮紙深度漸層（壓底，元素浮其上）
      slide.addShape('rect', {
        x: 0,
        y: 0,
        w: 13.33,
        h: 7.5,
        fill: {
          color: gradLinear(90, [
            { pos: 0, color: mix(MAN.bg, 'FFFFFF', 0.04) },
            { pos: 100, color: mix(MAN.bg, MAN.ink, 0.06) },
          ]),
        },
        line: { type: 'none' },
      })
    }
    // 左上泥金大寫首字塊（似抄本開篇）
    const first = [...deck.title.trim()][0] ?? 'A'
    manInitial(slide, 0.9, 0.95, 1.7, first, 86)
    tx(slide, 'ILLUMINATED · 教學簡報', { x: 2.9, y: 1.1, w: 7, h: 0.3, fontSize: 10, color: MAN.gilt, charSpacing: 3, bold: true })
    manRule(slide, 2.9, 1.5, hasImg ? 3.6 : 5.2, MAN.gilt)
    // 藤蔓角飾（四角細點綴）
    manVine(slide, 0.5, 0.5, 0.4, 0.4, mix(MAN.gilt, MAN.bg, 0.35))
    manVine(slide, 12.83, 7.0, -0.4, -0.4, mix(MAN.gilt, MAN.bg, 0.35))
    // 題低位 + 上下雙金線夾住
    const titleW = hasImg ? 6.4 : 11.2
    const fit = fitTitle(deck.title, 'cover')
    const lines = Math.max(1, Math.min(2, estimateLines(deck.title, fit.fontPt, titleW)))
    manRule(slide, 0.9, 3.7, hasImg ? 6.4 : 4.2, MAN.gilt)
    tx(slide, deck.title, { x: 0.9, y: 4.0, w: titleW, h: 1.55, fontSize: fit.fontPt, bold: true, color: MAN.ink, lineSpacingMultiple: 1.08, fontFace: 'Georgia', fit: 'shrink' })
    let cursorY = 4.0 + (lines * fit.fontPt * 1.08) / 72 + 0.2
    if (deck.subtitle) {
      tx(slide, deck.subtitle, { x: 0.9, y: cursorY, w: titleW, h: 0.5, fontSize: 15, color: MAN.soft })
      cursorY += 0.5
    }
    manRule(slide, 0.9, cursorY + 0.12, 2.6, MAN.gilt)
    if (img) {
      // 右側相 + 金髮線框
      const frame: Rect = { x: 7.6, y: 1.7, w: 5.0, h: 3.8 }
      addCoverImage(slide, img, frame)
      slide.addShape('rect', { x: frame.x, y: frame.y, w: frame.w, h: frame.h, fill: { type: 'none' }, line: { color: MAN.gilt, width: 1.5 } })
      photoCreditOnImage(slide, img.credit, frame)
    }
    // 底部館藏行
    tx(slide, `${brand} · ${dateLabel()}`, { x: 0.9, y: 6.85, w: 8, h: 0.3, fontSize: 9, color: MAN.faint })
  },

  section(slide, no, title) {
    slide.background = { color: MAN.panel }
    // 泥金大寫章節塊（frontispiece）+ 青金石雙線
    manInitial(slide, 0.9, 1.2, 2.7, pad2(no), 92)
    manVine(slide, 0.5, 0.5, 0.46, 0.46, mix(MAN.gilt, MAN.panel, 0.3))
    manVine(slide, 12.83, 7.0, -0.46, -0.46, mix(MAN.gilt, MAN.panel, 0.3))
    tx(slide, `CAPITULUM ${sectionWord(no)} · 章`, { x: 4.0, y: 1.5, w: 8.5, h: 0.32, fontSize: 11, color: MAN.lapis, charSpacing: 4, bold: true })
    manRule(slide, 4.0, 1.9, 3.0, MAN.gilt)
    tx(slide, title, { x: 4.0, y: 2.25, w: 8.5, h: 1.6, fontSize: 32, bold: true, color: MAN.ink, lineSpacingMultiple: 1.06, fontFace: 'Georgia' })
    manRule(slide, 0.9, 4.3, 12.0, MAN.lapis)
  },

  contentFrame(slide, ctx) {
    slide.background = { color: MAN.bg }
    const { body, contentW } = scaffold(slide, manuscript, ctx, { kickerY: 0.58, titleY: 0.9, hairline: false })
    // 雙金章法線代 folio 髮線（位置 = scaffold 髮線位 body.y−0.3）
    manRule(slide, 0.9, body.y - 0.33, contentW, mix(MAN.gilt, MAN.bg, 0.4))
    drawFooter(slide, manuscript, ctx)
    return body
  },
}

// ============================================================
//  立體 isometric — 積木立體
//  淺灰底 + 板岩墨 + 鮮藍點睛：假 3D 靠硬偏移塊（面 rect + 後偏移
//  深藍 rect 做硬陰影）砌出「pop-out」積木感；stats 做積木彈出塊。
// ============================================================

const ISO = { bg: 'EEF1F5', ink: '222834', soft: '5A6473', faint: '99A2B0', hair: 'D7DDE6', accent: '3D6CF0', panel: 'FFFFFF' }

/** pop-out 塊：後偏移深色塊（硬陰影）+ 前面 rect（chunky 3D 感）。回傳前面 Rect */
function isoBlock(slide: PptxGenJS.Slide, x: number, y: number, w: number, h: number, off: number, face: string, shadow: string, borderPt = 2): Rect {
  // 後偏移塊（硬陰影，深色）
  slide.addShape('rect', { x: x + off, y: y + off, w, h, fill: { color: shadow }, line: { type: 'none' } })
  // 前面塊（粗墨邊）+ 受光漸層：頂亮 → 面色 → 底暗（真立體受光，由 gradFill 注入）
  const lit = gradLinear(90, [
    { pos: 0, color: mix(face, 'FFFFFF', 0.32) },
    { pos: 55, color: face },
    { pos: 100, color: mix(face, ISO.ink, 0.14) },
  ])
  slide.addShape('rect', { x, y, w, h, fill: { color: lit }, line: { color: ISO.ink, width: borderPt } })
  return { x, y, w, h }
}

/**
 * 招牌：stats 渲染成「積木彈出塊」——
 * 各 stat 一塊 pop-out 積木（白／panel 面 + 粗墨邊 + 後偏移鮮藍硬陰影），
 * 巨號 Arial-bold 值居中，標籤喺塊下。積木彈出感。2–4 項。
 */
function renderIsometricBlocks(slide: PptxGenJS.Slide, body: Rect, pack: Pack, s: Slide): void {
  const items = (s.stats ?? []).slice(0, 4)
  if (items.length < 2) return
  const n = items.length
  const gap = 0.5
  const off = 0.16
  const cw = (body.w - gap * (n - 1) - off) / n
  const bh = Math.min(2.5, body.h - 0.7)
  const by = body.y + (body.h - bh - off) / 2
  items.forEach((st, i) => {
    const cx = body.x + i * (cw + gap)
    // pop-out 積木（白面 + 後偏移鮮藍硬陰影）
    isoBlock(slide, cx, by, cw, bh, off, pack.panel, pack.accent, 2)
    // 巨號值（Arial-bold）
    tx(slide, clampText(st.value.trim(), 8), { x: cx + 0.12, y: by + 0.16, w: cw - 0.24, h: bh * 0.58, fontSize: 54, bold: true, color: pack.ink, align: 'center', valign: 'middle', fontFace: pack.displayFont, fit: 'shrink' })
    // 塊內鮮藍底界（值／標籤分隔）
    hline(slide, cx + 0.24, by + bh * 0.62, cw - 0.48, mix(pack.accent, pack.panel, 0.5), 1.5)
    // 標籤（塊內下方）
    tx(slide, clampText(st.label.trim(), 22), { x: cx + 0.16, y: by + bh * 0.64, w: cw - 0.32, h: bh * 0.32, fontSize: 13, color: pack.inkSoft, align: 'center', valign: 'middle', lineSpacingMultiple: 1.12, fit: 'shrink' })
  })
}

const isometric: Pack = {
  id: 'isometric',
  name: '立體',
  hint: '積木立體 · 數理/STEM',
  swatches: ['#3D6CF0', '#222834', '#EEF1F5'],
  dark: false,
  bg: ISO.bg,
  ink: ISO.ink,
  inkSoft: ISO.soft,
  faint: ISO.faint,
  hair: ISO.hair,
  accent: ISO.accent,
  statColor: ISO.accent,
  panel: ISO.panel,
  cardRadius: 0.04,
  displayFont: 'Arial',
  displayItalic: false,
  pageNoColor: ISO.soft,
  chartColors: ['3D6CF0', '222834', '7C93C9', 'B7C3DC'],
  chartGridColor: ISO.hair,
  bulletPt: [18, 18, 17, 17, 16],
  titlePt: 28,
  marker: { kind: 'square', size: 0.11, color: ISO.accent, indent: 0.32 },
  tileStyle: 'panel',
  compareStyle: 'panels',
  stepNode: { kind: 'squareFill', size: 0.34, color: ISO.accent, numColor: 'FFFFFF' },
  quoteMark: { kind: 'square', size: 0.16, color: ISO.accent },
  splitPhoto: 'bleedHair',
  overrides: { stats: renderIsometricBlocks },

  // 逐版母題：右下角極邊一塊細 pop-out 塊（rect + 偏移陰影），大細按 seq % 3 遞進
  deco(slide, ctx) {
    const sz = 0.14 + (ctx.seq % 3) * 0.05
    const off = 0.06
    const x = 12.56 - sz
    const y = 6.98 - sz
    slide.addShape('rect', { x: x + off, y: y + off, w: sz, h: sz, fill: { color: mix(ISO.accent, ISO.bg, 0.4) }, line: { type: 'none' } })
    slide.addShape('rect', { x, y, w: sz, h: sz, fill: { color: mix(ISO.panel, ISO.bg, 0.4) }, line: { color: mix(ISO.ink, ISO.bg, 0.4), width: 1 } })
  },

  cover(slide, deck, brand, img) {
    slide.background = { color: ISO.bg }
    const hasImg = Boolean(img)
    // 招牌等距積木格紋理底圖（瀏覽器 Canvas raster；冇 canvas 時 fallback 全版極淺灰深度漸層）
    const tex = coverTextureUri('isometric')
    if (tex) {
      slide.addImage({ data: tex, x: 0, y: 0, w: 13.333, h: 7.5, sizing: { type: 'cover', w: 13.333, h: 7.5 } })
    } else {
      // 全版極淺灰深度漸層（壓底，積木浮其上）
      slide.addShape('rect', {
        x: 0,
        y: 0,
        w: 13.33,
        h: 7.5,
        fill: {
          color: gradLinear(90, [
            { pos: 0, color: mix(ISO.bg, 'FFFFFF', 0.04) },
            { pos: 100, color: mix(ISO.bg, ISO.ink, 0.06) },
          ]),
        },
        line: { type: 'none' },
      })
    }
    // kicker
    tx(slide, 'BUILD DECK · 教學簡報', { x: 0.9, y: 1.1, w: 7, h: 0.3, fontSize: 10, color: ISO.accent, charSpacing: 3, bold: true })
    // 題目嵌一塊大 pop-out 塊（白面 + 後偏移鮮藍硬陰影）
    const titleW = hasImg ? 6.3 : 9.4
    const boxY = 2.2
    const fit = fitTitle(deck.title, 'cover')
    const pt = Math.min(40, fit.fontPt)
    const lines = Math.max(1, Math.min(2, estimateLines(deck.title, pt, titleW - 0.6)))
    const boxH = lines === 2 ? 2.2 : 1.5
    const face = isoBlock(slide, 0.9, boxY, titleW, boxH, 0.2, ISO.panel, ISO.accent, 2.5)
    tx(slide, deck.title, { x: face.x + 0.28, y: face.y, w: face.w - 0.56, h: face.h, fontSize: pt, bold: true, color: ISO.ink, valign: 'middle', lineSpacingMultiple: 1.06, fit: 'shrink' })
    let cursorY = boxY + boxH + 0.42
    if (deck.subtitle) {
      tx(slide, deck.subtitle, { x: 0.95, y: cursorY, w: hasImg ? 6.1 : 9.2, h: 0.5, fontSize: 15, color: ISO.soft })
      cursorY += 0.55
    }
    if (img) {
      // 右側相 + 後偏移塊（pop-out 相框）
      const frame: Rect = { x: 7.8, y: 1.6, w: 4.7, h: 3.8 }
      slide.addShape('rect', { x: frame.x + 0.18, y: frame.y + 0.18, w: frame.w, h: frame.h, fill: { color: ISO.accent }, line: { type: 'none' } })
      addCoverImage(slide, img, frame)
      slide.addShape('rect', { x: frame.x, y: frame.y, w: frame.w, h: frame.h, fill: { type: 'none' }, line: { color: ISO.ink, width: 2.5 } })
      photoCreditOnImage(slide, img.credit, frame)
    } else {
      // 無相：三塊遞減 pop-out 積木疊角（右下）
      isoBlock(slide, 8.6, 3.4, 1.7, 1.7, 0.2, mix(ISO.accent, ISO.panel, 0.25), ISO.accent, 2)
      isoBlock(slide, 10.6, 4.2, 1.3, 1.3, 0.18, ISO.panel, ISO.accent, 2)
      isoBlock(slide, 9.9, 5.5, 1.0, 1.0, 0.14, mix(ISO.accent, ISO.panel, 0.4), ISO.accent, 2)
    }
    // 底部日期 + brand
    tx(slide, dateLabel(), { x: 0.95, y: 6.5, w: 5, h: 0.3, fontSize: 10, color: ISO.soft })
    tx(slide, brand, { x: 0.95, y: 6.82, w: 5, h: 0.3, fontSize: 9, color: ISO.faint })
  },

  section(slide, no, title) {
    slide.background = { color: ISO.bg }
    // 章節號入大 pop-out 塊
    const face = isoBlock(slide, 0.9, 1.3, 3.2, 2.9, 0.22, ISO.panel, ISO.accent, 2.5)
    tx(slide, pad2(no), { x: face.x, y: face.y, w: face.w, h: face.h, fontSize: 130, bold: true, color: ISO.accent, align: 'center', valign: 'middle', fontFace: 'Arial' })
    tx(slide, `MODULE ${sectionWord(no)}`, { x: 0.9, y: 4.6, w: 8, h: 0.3, fontSize: 10, color: ISO.accent, charSpacing: 4, bold: true })
    tx(slide, title, { x: 0.9, y: 4.95, w: 11.2, h: 1.0, fontSize: 32, bold: true, color: ISO.ink })
  },

  contentFrame(slide, ctx) {
    slide.background = { color: ISO.bg }
    const { body } = scaffold(slide, isometric, ctx, { kickerY: 0.58, titleY: 0.9, hairline: true })
    // 右上細 pop-out 塊（配圖出血版省略）
    if (!ctx.hasPhoto) {
      slide.addShape('rect', { x: 12.18, y: 0.66, w: 0.26, h: 0.26, fill: { color: ISO.accent }, line: { type: 'none' } })
      slide.addShape('rect', { x: 12.06, y: 0.54, w: 0.26, h: 0.26, fill: { color: ISO.panel }, line: { color: ISO.ink, width: 1.25 } })
    }
    drawFooter(slide, isometric, ctx)
    return body
  },
}

// ============================================================
//  故障 glitch — 賽博龐克
//  近黑底 + 淡墨 + 洋紅點睛（加青）：色差錯位（同一 label 畫三次：
//  青→洋紅→墨疊上）+ 細掃描線 + HUD 角括；compare 做 RGB 雙通道。
// ============================================================

const GLI = { bg: '0A0A12', ink: 'E8E8F0', soft: 'A6A6C0', faint: '6A6A88', hair: '262638', accent: 'FF2D6F', cyan: '16E0E0', panel: '141426' }

/** 色差錯位文字：同一字畫三次（青 / 洋紅 各偏移 ~0.03"，墨疊正中） */
function glitchText(slide: PptxGenJS.Slide, text: string, opts: PptxGenJS.TextPropsOptions): void {
  const baseX = typeof opts.x === 'number' ? opts.x : 0
  const baseY = typeof opts.y === 'number' ? opts.y : 0
  tx(slide, text, { ...opts, x: baseX - 0.03, y: baseY + 0.02, color: GLI.cyan })
  tx(slide, text, { ...opts, x: baseX + 0.03, y: baseY - 0.02, color: GLI.accent })
  tx(slide, text, { ...opts, x: baseX, y: baseY })
}

/** 細掃描線：n 行極淡 hline，每 step 吋一條（CRT 掃描意象） */
function scanlines(slide: PptxGenJS.Slide, x: number, y: number, w: number, rows: number, step: number, color: string): void {
  for (let r = 0; r < rows; r++) hline(slide, x, y + r * step, w, color, 0.5)
}

/** HUD 角括：一對短 L 形線（cx/cy = 角，dir 控制朝向：sx/sy ±1） */
function hudBracket(slide: PptxGenJS.Slide, cx: number, cy: number, len: number, sx: number, sy: number, color: string, pt = 1.25): void {
  hline(slide, sx > 0 ? cx : cx - len, cy, len, color, pt)
  vline(slide, cx, sy > 0 ? cy : cy - len, len, color, pt)
}

/** 四角 HUD 括（框住一個 Rect） */
function hudFrame(slide: PptxGenJS.Slide, r: Rect, len: number, color: string, pt = 1.25): void {
  hudBracket(slide, r.x, r.y, len, 1, 1, color, pt)
  hudBracket(slide, r.x + r.w, r.y, len, -1, 1, color, pt)
  hudBracket(slide, r.x, r.y + r.h, len, 1, -1, color, pt)
  hudBracket(slide, r.x + r.w, r.y + r.h, len, -1, -1, color, pt)
}

/**
 * 招牌：compare 渲染成「RGB 雙通道」——
 * 左欄偏青 tint、右欄偏洋紅 tint，中央一條「鋸齒接縫」（一列細偏移 rect），
 * 各欄 HUD 角括 + 色差錯位標題、掃描線、通道點列。賽博故障感。2 欄對照。
 */
function renderGlitchChannels(slide: PptxGenJS.Slide, body: Rect, pack: Pack, s: Slide): void {
  const cmp = s.compare
  if (!cmp || cmp.left.length === 0 || cmp.right.length === 0) return
  const seam = 0.5
  const pw = (body.w - seam) / 2
  const sides: [string, string[], number, string][] = [
    [cmp.leftTitle, cmp.left.slice(0, 4), body.x, GLI.cyan],
    [cmp.rightTitle, cmp.right.slice(0, 4), body.x + pw + seam, GLI.accent],
  ]
  sides.forEach(([title, pts, px, chan]) => {
    // 通道 panel（偏色 tint）
    slide.addShape('rect', { x: px, y: body.y, w: pw, h: body.h, fill: { color: mix(chan, pack.bg, 0.1) }, line: { type: 'none' } })
    // 掃描線
    scanlines(slide, px, body.y + 0.1, pw, Math.floor((body.h - 0.2) / 0.16), 0.16, mix(chan, pack.bg, 0.14))
    // HUD 角括
    hudFrame(slide, { x: px, y: body.y, w: pw, h: body.h }, 0.3, mix(chan, pack.bg, 0.55))
    // 色差錯位標題
    glitchText(slide, clampText(title.trim(), 16), { x: px + 0.22, y: body.y + 0.2, w: pw - 0.44, h: 0.46, fontSize: 18, bold: true, color: pack.ink, fontFace: pack.displayFont })
    // 通道點列
    const listY = body.y + 0.92
    const rowH = Math.min(0.62, (body.h - 1.0) / pts.length)
    pts.forEach((pt, j) => {
      const ry = listY + j * rowH
      // 通道方點（偏色）
      slide.addShape('rect', { x: px + 0.24, y: ry + rowH / 2 - 0.05, w: 0.1, h: 0.1, fill: { color: chan }, line: { type: 'none' } })
      tx(slide, clampText(pt.trim(), 30), { x: px + 0.48, y: ry, w: pw - 0.68, h: rowH, fontSize: 12, color: pack.inkSoft, valign: 'middle', lineSpacingMultiple: 1.14, fontFace: pack.displayFont, fit: 'shrink' })
    })
  })
  // 中央鋸齒接縫（一列細偏移 rect，左右交錯）
  const cx = body.x + pw + seam / 2
  const teeth = Math.floor(body.h / 0.3)
  for (let k = 0; k < teeth; k++) {
    const jut = k % 2 === 0 ? -0.08 : 0.08
    slide.addShape('rect', { x: cx - 0.05 + jut, y: body.y + k * 0.3, w: 0.1, h: 0.22, fill: { color: k % 2 === 0 ? GLI.cyan : GLI.accent }, line: { type: 'none' } })
  }
}

const glitch: Pack = {
  id: 'glitch',
  name: '故障',
  hint: '賽博龐克 · ICT/科技',
  swatches: ['#FF2D6F', '#16E0E0', '#0A0A12'],
  dark: true,
  bg: GLI.bg,
  ink: GLI.ink,
  inkSoft: GLI.soft,
  faint: GLI.faint,
  hair: GLI.hair,
  accent: GLI.accent,
  statColor: GLI.cyan,
  panel: GLI.panel,
  cardRadius: 0,
  displayFont: 'Consolas',
  displayItalic: false,
  pageNoColor: GLI.soft,
  chartColors: ['FF2D6F', '16E0E0', 'B0B0D8', '6A6A88'],
  chartGridColor: GLI.hair,
  bulletPt: [18, 18, 17, 17, 16],
  titlePt: 28,
  marker: { kind: 'square', size: 0.1, color: GLI.accent, indent: 0.32 },
  tileStyle: 'panel',
  compareStyle: 'panels',
  stepNode: { kind: 'squareFill', size: 0.32, color: GLI.accent, numColor: GLI.bg },
  quoteMark: { kind: 'square', size: 0.14, color: GLI.accent },
  splitPhoto: 'bleedScrim',
  overrides: { compare: renderGlitchChannels },

  // 逐版母題：右下角極邊一條細掃描線 + 偏移 HUD 角括，位置按 seq % 4 微移
  deco(slide, ctx) {
    const dy = 6.92 + (ctx.seq % 4) * 0.02
    scanlines(slide, 12.0, dy, 0.6, 3, 0.05, mix(GLI.cyan, GLI.bg, 0.3))
    hudBracket(slide, 12.64, dy - 0.02, 0.14, -1, 1, mix(GLI.accent, GLI.bg, 0.45), 1)
  },

  cover(slide, deck, brand, img) {
    slide.background = { color: GLI.bg }
    const hasImg = Boolean(img)
    if (img) {
      // full-bleed 相 + 近黑 scrim（熄機感）
      addCoverImage(slide, img, { x: 0, y: 0, w: 13.33, h: 7.5 })
      slide.addShape('rect', { x: 0, y: 0, w: 13.33, h: 7.5, fill: { color: GLI.bg, transparency: 28 }, line: { type: 'none' } })
      photoCreditOnImage(slide, img.credit, { x: 0, y: 0, w: 13.33, h: 7.5 })
    }
    // 無相時：招牌故障掃描紋理底圖（瀏覽器 Canvas raster；冇 canvas 時 fallback 洋紅→青斜向漸層）
    if (!img) {
      const tex = coverTextureUri('glitch')
      if (tex) {
        slide.addImage({ data: tex, x: 0, y: 0, w: 13.333, h: 7.5, sizing: { type: 'cover', w: 13.333, h: 7.5 } })
      } else {
        slide.addShape('rect', {
          x: 0,
          y: 0,
          w: 13.33,
          h: 7.5,
          fill: {
            color: gradLinear(120, [
              { pos: 0, color: mix(GLI.bg, GLI.accent, 0.1) },
              { pos: 60, color: GLI.bg },
              { pos: 100, color: mix(GLI.bg, GLI.cyan, 0.08) },
            ]),
          },
          line: { type: 'none' },
        })
      }
    }
    // 全版掃描線（極淡）
    scanlines(slide, 0.3, 0.5, 12.73, Math.floor(6.5 / 0.18), 0.18, mix(GLI.cyan, GLI.bg, hasImg ? 0.12 : 0.08))
    // 四角 HUD 括
    hudFrame(slide, { x: 0.4, y: 0.4, w: 12.53, h: 6.7 }, 0.42, mix(GLI.accent, GLI.bg, 0.5))
    // kicker
    glitchText(slide, 'SYSTEM ONLINE · 教學簡報', { x: 0.95, y: 1.15, w: 8, h: 0.3, fontSize: 10, color: GLI.ink, charSpacing: 3, bold: true, fontFace: 'Consolas' })
    // 色差錯位巨題
    const titleW = hasImg ? 7.0 : 10.8
    const fit = fitTitle(deck.title, 'cover')
    const lines = Math.max(1, Math.min(2, estimateLines(deck.title, fit.fontPt, titleW)))
    glitchText(slide, deck.title, { x: 0.95, y: 2.5, w: titleW, h: 1.6, fontSize: fit.fontPt, bold: true, color: GLI.ink, lineSpacingMultiple: 1.08, fontFace: 'Consolas', fit: 'shrink' })
    let cursorY = 2.5 + (lines * fit.fontPt * 1.08) / 72 + 0.24
    if (deck.subtitle) {
      tx(slide, deck.subtitle, { x: 0.95, y: cursorY, w: titleW, h: 0.5, fontSize: 15, color: GLI.soft, fontFace: 'Consolas' })
      cursorY += 0.5
    }
    // 接縫線（細鋸齒）+ 日期 + brand
    hline(slide, 0.95, cursorY + 0.2, hasImg ? 6.0 : 5.2, mix(GLI.accent, GLI.bg, 0.5), 1.5)
    tx(slide, `> ${dateLabel()}`, { x: 0.95, y: 6.5, w: 6, h: 0.3, fontSize: 10, color: GLI.cyan, fontFace: 'Consolas' })
    tx(slide, brand, { x: 0.95, y: 6.82, w: 5, h: 0.3, fontSize: 9, color: GLI.faint, fontFace: 'Consolas' })
  },

  section(slide, no, title) {
    slide.background = { color: GLI.bg }
    // 全版掃描線
    scanlines(slide, 0.3, 0.5, 12.73, Math.floor(6.5 / 0.2), 0.2, mix(GLI.cyan, GLI.bg, 0.07))
    hudFrame(slide, { x: 0.4, y: 0.4, w: 12.53, h: 6.7 }, 0.42, mix(GLI.accent, GLI.bg, 0.45))
    glitchText(slide, `SECTOR ${sectionWord(no)}`, { x: 0.95, y: 1.7, w: 8, h: 0.32, fontSize: 11, color: GLI.ink, charSpacing: 5, bold: true, fontFace: 'Consolas' })
    glitchText(slide, pad2(no), { x: 0.9, y: 2.2, w: 6, h: 2.6, fontSize: 150, bold: true, color: GLI.ink, fontFace: 'Consolas' })
    hline(slide, 0.95, 5.1, 4.0, mix(GLI.accent, GLI.bg, 0.5), 1.5)
    tx(slide, title, { x: 0.95, y: 5.35, w: 11.2, h: 1.1, fontSize: 32, bold: true, color: GLI.ink, fontFace: 'Consolas' })
  },

  contentFrame(slide, ctx) {
    slide.background = { color: GLI.bg }
    // 全版極淡掃描線（壓底，內容浮其上）
    if (!ctx.hasPhoto) scanlines(slide, 0.9, 2.1, 11.53, Math.floor(4.8 / 0.26), 0.26, mix(GLI.cyan, GLI.bg, 0.05))
    const { body } = scaffold(slide, glitch, ctx, { kickerY: 0.58, titleY: 0.9, hairline: true })
    // 右上 HUD 角括（配圖出血版省略）
    if (!ctx.hasPhoto) hudBracket(slide, 12.43, 0.58, 0.26, -1, 1, mix(GLI.accent, GLI.bg, 0.45), 1.25)
    drawFooter(slide, glitch, ctx)
    return body
  },
}

// ───────── 滙出 ─────────

export const GALLERY_PACKS_5: Pack[] = [comic, manuscript, isometric, glitch]
