// ============================================================
//  pptx template packs — gallery 第四輯（典藏／摺紙／菲林／揮春）
//  ------------------------------------------------------------
//  · 典藏 marble   — 美術館：暖米白展牆 + thick-thin 雙金線展板 + Georgia
//  · 摺紙 origami  — 幾何摺疊：三角 motif 逐步旋轉摺序 + 鶴紅點睛
//  · 菲林 cinema   — 戲院敘事：齒孔菲林帶 + marquee 燈泡 + 場記號 SC
//  · 揮春 festival — 節慶喜慶：金框 + 揮春直幡 + 燈籠圈 + 利是封卡
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

// ============================================================
//  典藏 marble — 美術館
//  暖米白展牆 + 炭黑墨 + 古金點睛：成個 deck 似一場小型展覽 —
//  thick-thin 雙金線（scotch rule）做展板語言，相片裱成「掛牆作品」
//  （炭黑外框 + 米白裱邊），引文版係一塊裱框 placard。
// ============================================================

const MAR = { bg: 'F5F2EC', ink: '262421', soft: '6B645A', faint: '9C9384', hair: 'E2DBCD', accent: 'A8852E', panel: 'EDE6D8' }

/** 展板雙金線（scotch rule）：1.25pt 粗線 + 0.07" 下一條 0.5pt 細線 */
function marbleRule(slide: PptxGenJS.Slide, x: number, y: number, w: number, color: string): void {
  hline(slide, x, y, w, color, 1.25)
  hline(slide, x, y + 0.07, w, color, 0.5)
}

/** 古金菱形徽記 */
function marbleDiamond(slide: PptxGenJS.Slide, x: number, y: number, size: number): void {
  slide.addShape('diamond', { x, y, w: size, h: size, fill: { color: MAR.accent }, line: { type: 'none' } })
}

/**
 * 招牌：quote 渲染成「美術館展板」——
 * 一塊裱邊 panel（panel 底 + 外髮線框 + 內金髮線框）盛住引文，
 * Georgia 居中大字，出處做展品說明 caption，前置一粒金菱形。
 */
function renderMarblePlacard(slide: PptxGenJS.Slide, body: Rect, pack: Pack, s: Slide): void {
  const q = s.quote
  if (!q || !q.text.trim()) return
  const pw = Math.min(9.8, body.w - 0.8)
  const ph = Math.min(3.9, body.h - 0.3)
  const px = body.x + (body.w - pw) / 2
  const py = body.y + (body.h - ph) / 2
  // 裱框展板：panel 底 + 外髮線框
  slide.addShape('rect', { x: px, y: py, w: pw, h: ph, fill: { color: pack.panel }, line: { color: pack.hair, width: 1 } })
  // 內金髮線框（裱邊）
  slide.addShape('rect', {
    x: px + 0.14,
    y: py + 0.14,
    w: pw - 0.28,
    h: ph - 0.28,
    fill: { type: 'none' },
    line: { color: mix(pack.accent, pack.panel, 0.5), width: 0.75 },
  })
  // 引文 Georgia 居中
  tx(slide, `「${clampText(q.text.trim(), 60)}」`, {
    x: px + 0.55,
    y: py + 0.38,
    w: pw - 1.1,
    h: ph - 1.3,
    fontSize: 26,
    color: pack.ink,
    align: 'center',
    valign: 'middle',
    fontFace: pack.displayFont,
    lineSpacingMultiple: 1.3,
    fit: 'shrink',
  })
  // 金菱形 + 出處 caption（似展品說明標籤）
  marbleDiamond(slide, px + pw / 2 - 0.05, py + ph - 0.8, 0.1)
  if (q.attribution) {
    tx(slide, clampText(q.attribution.trim(), 30), {
      x: px + 0.55,
      y: py + ph - 0.58,
      w: pw - 1.1,
      h: 0.32,
      fontSize: 12,
      color: pack.inkSoft,
      align: 'center',
      fontFace: pack.displayFont,
    })
  }
}

const marble: Pack = {
  id: 'marble',
  name: '典藏',
  hint: '美術館 · 人文藝術',
  swatches: ['#A8852E', '#262421', '#F5F2EC'],
  dark: false,
  bg: MAR.bg,
  ink: MAR.ink,
  inkSoft: MAR.soft,
  faint: MAR.faint,
  hair: MAR.hair,
  accent: MAR.accent,
  statColor: MAR.accent,
  panel: MAR.panel,
  cardRadius: 0,
  displayFont: 'Georgia',
  displayItalic: false,
  pageNoColor: MAR.faint,
  chartColors: ['A8852E', '262421', '7A6A4F', 'CDBE9C'],
  chartGridColor: MAR.hair,
  bulletPt: [18, 18, 17, 17, 16],
  titlePt: 28,
  marker: { kind: 'dot', size: 0.08, color: MAR.accent, indent: 0.3 },
  tileStyle: 'hairline',
  compareStyle: 'hairline',
  stepNode: { kind: 'circleOutline', size: 0.34, color: MAR.accent, numColor: MAR.ink },
  quoteMark: { kind: 'glyph', color: mix(MAR.accent, MAR.bg, 0.45) },
  splitPhoto: 'bleedHair',
  overrides: { quote: renderMarblePlacard },

  // 逐版母題：右下角極邊一條小金「展品標籤」rule + 點列，點數按 seq % 3 遞進（似展品編目）
  deco(slide, ctx) {
    const n = (ctx.seq % 3) + 1
    const y = 6.92
    const c = mix(MAR.accent, MAR.bg, 0.5)
    hline(slide, 12.0, y, 0.42, c, 0.75)
    for (let k = 0; k < n; k++) {
      slide.addShape('ellipse', { x: 12.52 + k * 0.12, y: y - 0.025, w: 0.05, h: 0.05, fill: { color: c }, line: { type: 'none' } })
    }
  },

  cover(slide, deck, brand, img) {
    slide.background = { color: MAR.bg }
    const hasImg = Boolean(img)
    if (img) {
      // 掛牆作品：炭黑外框 + 米白裱邊（matte）+ 相四邊內髮線
      const frame: Rect = { x: 7.6, y: 1.0, w: 4.8, h: 4.5 }
      slide.addShape('rect', { x: frame.x, y: frame.y, w: frame.w, h: frame.h, fill: { color: 'FCFAF4' }, line: { color: MAR.ink, width: 2.5 } })
      const inset = 0.32
      const art: Rect = { x: frame.x + inset, y: frame.y + inset, w: frame.w - inset * 2, h: frame.h - inset * 2 }
      addCoverImage(slide, img, art)
      slide.addShape('rect', { x: art.x, y: art.y, w: art.w, h: art.h, fill: { type: 'none' }, line: { color: MAR.hair, width: 0.75 } })
      photoCreditOnImage(slide, img.credit, art)
      // 框下展品標籤
      tx(slide, 'EXHIBIT 01', { x: frame.x, y: frame.y + frame.h + 0.16, w: frame.w, h: 0.24, fontSize: 8, color: MAR.faint, charSpacing: 3, bold: true, align: 'center', fontFace: 'Georgia' })
    }
    // 展板：上下雙金線夾住題（無相 = 置中展牆 placard；有相 = 左欄）
    const px = 0.9
    const pw = hasImg ? 6.2 : 11.53
    const align = hasImg ? 'left' : 'center'
    const ruleX = hasImg ? px : px + pw / 2 - 1.3
    marbleDiamond(slide, hasImg ? px : px + pw / 2 - 0.07, 1.3, 0.14)
    tx(slide, 'COLLECTION · 教學典藏', { x: px, y: 1.62, w: pw, h: 0.3, fontSize: 10, color: MAR.accent, charSpacing: 4, bold: true, align })
    marbleRule(slide, ruleX, 2.18, 2.6, MAR.accent)
    const fit = fitTitle(deck.title, 'cover')
    const lines = Math.max(1, Math.min(2, estimateLines(deck.title, fit.fontPt, pw)))
    tx(slide, deck.title, { x: px, y: 2.55, w: pw, h: 1.55, fontSize: fit.fontPt, bold: true, color: MAR.ink, align, lineSpacingMultiple: 1.08, fit: 'shrink' })
    let cursorY = 2.55 + (lines * fit.fontPt * 1.08) / 72 + 0.2
    if (deck.subtitle) {
      tx(slide, deck.subtitle, { x: px, y: cursorY, w: pw, h: 0.5, fontSize: 15, color: MAR.soft, align })
      cursorY += 0.55
    }
    marbleRule(slide, ruleX, cursorY + 0.12, 2.6, MAR.accent)
    // 底部館藏標籤行：brand · 日期
    tx(slide, `${brand} · ${dateLabel()}`, { x: px, y: 6.85, w: pw, h: 0.3, fontSize: 9, color: MAR.faint, charSpacing: 1, align })
  },

  section(slide, no, title) {
    slide.background = { color: MAR.bg }
    // 展室號：Georgia ghost 金巨號 — 展牆大片留白
    tx(slide, pad2(no), { x: 0.8, y: 1.05, w: 6, h: 2.9, fontSize: 150, bold: true, color: mix(MAR.accent, MAR.bg, 0.22), fontFace: 'Georgia' })
    // 展室標籤 placard
    tx(slide, `GALLERY ${sectionWord(no)} · 展室`, { x: 0.9, y: 4.1, w: 8, h: 0.3, fontSize: 10, color: MAR.accent, charSpacing: 4, bold: true })
    marbleRule(slide, 0.9, 4.46, 2.6, MAR.accent)
    tx(slide, title, { x: 0.9, y: 4.78, w: 11.2, h: 1.2, fontSize: 32, bold: true, color: MAR.ink })
    marbleRule(slide, 0.9, 6.45, 2.6, MAR.accent)
    marbleDiamond(slide, 12.31, 6.42, 0.12)
  },

  contentFrame(slide, ctx) {
    slide.background = { color: MAR.bg }
    const { body, contentW } = scaffold(slide, marble, ctx, { kickerY: 0.58, titleY: 0.9, hairline: false })
    // 展板 scotch 雙金線代 folio 髮線（位置 = scaffold 髮線位 body.y−0.3 起）
    marbleRule(slide, 0.9, body.y - 0.33, contentW, mix(MAR.accent, MAR.bg, 0.6))
    drawFooter(slide, marble, ctx)
    return body
  },
}

// ============================================================
//  摺紙 origami — 幾何摺疊
//  白底 + 板岩墨 + 鶴紅：三角形係唯一 motif —— 封面角落 2-3 塊
//  大淡摺痕三角層疊，鶴摺徽記係一對紅三角；steps 變成摺紙說明書
//  式「摺序」，三角節點逐步旋轉 0/90/180/270。
// ============================================================

const ORI = { ink: '1F2937', soft: '5B6573', faint: '99A2AD', hair: 'E2E6EB', accent: 'E0314B', panel: 'EEF1F5' }

/** 三角形（左上角 x/y 定位；rotate 繞中心） */
function oriTri(slide: PptxGenJS.Slide, x: number, y: number, size: number, color: string, rotate = 0): void {
  slide.addShape('triangle', { x, y, w: size, h: size, fill: { color }, line: { type: 'none' }, rotate })
}

/**
 * 招牌：steps 渲染成「摺序圖」——
 * 摺紙說明書語言：細 sysDash 摺線做基線，各步一塊摺疊三角節點
 * （按序旋轉 0/90/180/270、紅 tint 逐步加深），步號喺節點上，
 * 摺向小三角指住下一步，title+desc 喺節點下。2–5 步。
 */
function renderOrigamiFoldSequence(slide: PptxGenJS.Slide, body: Rect, pack: Pack, s: Slide): void {
  const items = (s.steps ?? []).slice(0, 5)
  if (items.length < 2) return
  const n = items.length
  const x0 = body.x + 0.6
  const x1 = body.x + body.w - 0.6
  const seg = (x1 - x0) / (n - 1)
  const baseY = body.y + Math.min(1.9, body.h * 0.42)
  // 細摺線基線（sysDash = 摺紙圖嘅谷摺虛線）
  slide.addShape('line', { x: x0, y: baseY, w: x1 - x0, h: 0, line: { color: pack.hair, width: 1, dashType: 'sysDash' } })
  const node = 0.62
  items.forEach((st, i) => {
    const cx = x0 + seg * i
    // 摺疊三角節點：rotate 逐步轉、紅 tint 逐步加深（愈摺愈實）
    slide.addShape('triangle', {
      x: cx - node / 2,
      y: baseY - node / 2,
      w: node,
      h: node,
      rotate: (i * 90) % 360,
      fill: { color: mix(pack.accent, 'FFFFFF', 0.16 + i * 0.1) },
      line: { color: pack.accent, width: 1.25 },
    })
    // 步號（節點上方）
    tx(slide, pad2(i + 1), { x: cx - 0.4, y: baseY - node / 2 - 0.38, w: 0.8, h: 0.26, fontSize: 11, bold: true, color: pack.accent, align: 'center', fontFace: pack.displayFont })
    // 摺向小三角（節點之間，指向下一步）
    if (i < n - 1) oriTri(slide, cx + seg / 2 - 0.08, baseY - 0.08, 0.16, pack.faint, 90)
    // 節點下 title + desc
    const colW = Math.min(seg * 0.94, 2.5)
    const tcx = Math.max(body.x + 0.05, Math.min(cx - colW / 2, body.x + body.w - colW - 0.05))
    const labelY = baseY + node / 2 + 0.2
    tx(slide, clampText(st.title.trim(), 12), { x: tcx, y: labelY, w: colW, h: 0.36, fontSize: 15, bold: true, color: pack.ink, align: 'center', fit: 'shrink' })
    if (st.desc) {
      tx(slide, clampText(st.desc.trim(), 40), {
        x: tcx,
        y: labelY + 0.4,
        w: colW,
        h: Math.max(0.3, body.y + body.h - labelY - 0.5),
        fontSize: 11,
        color: pack.inkSoft,
        align: 'center',
        lineSpacingMultiple: 1.18,
        fit: 'shrink',
      })
    }
  })
}

const origami: Pack = {
  id: 'origami',
  name: '摺紙',
  hint: '幾何摺疊 · 數學',
  swatches: ['#E0314B', '#1F2937', '#EEF1F5'],
  dark: false,
  bg: 'FFFFFF',
  ink: ORI.ink,
  inkSoft: ORI.soft,
  faint: ORI.faint,
  hair: ORI.hair,
  accent: ORI.accent,
  statColor: ORI.accent,
  panel: ORI.panel,
  cardRadius: 0,
  displayFont: 'Trebuchet MS',
  displayItalic: false,
  pageNoColor: ORI.faint,
  chartColors: ['E0314B', '1F2937', '7C8794', 'F2B3BD'],
  chartGridColor: ORI.hair,
  bulletPt: [18, 18, 17, 17, 16],
  titlePt: 28,
  marker: { kind: 'triangle', size: 0.11, color: ORI.accent, indent: 0.32 },
  tileStyle: 'tintCard',
  compareStyle: 'abGrid',
  stepNode: { kind: 'squareFill', size: 0.3, color: ORI.accent, numColor: 'FFFFFF' },
  quoteMark: { kind: 'square', size: 0.14, color: ORI.accent },
  splitPhoto: 'bleedHair',
  overrides: { steps: renderOrigamiFoldSequence },

  // 逐版母題：一塊極小淡紅三角，rotate = (seq*45)%360、角位按 seq % 4 輪換（逐版摺多一摺）
  deco(slide, ctx) {
    const spots: [number, number][] = [
      [12.78, 0.5], // 右上
      [12.78, 7.02], // 右下
      [0.4, 7.02], // 左下
      [0.4, 0.5], // 左上
    ]
    const [dx, dy] = spots[ctx.seq % 4]
    slide.addShape('triangle', {
      x: dx,
      y: dy,
      w: 0.16,
      h: 0.16,
      rotate: (ctx.seq * 45) % 360,
      fill: { color: mix(ORI.accent, 'FFFFFF', 0.3) },
      line: { type: 'none' },
    })
  },

  cover(slide, deck, brand, img) {
    slide.background = { color: 'FFFFFF' }
    const hasImg = Boolean(img)
    if (img) {
      // 右側相 + 髮線框 + 紅摺角（似摺起咗嘅頁角）
      const frame: Rect = { x: 7.9, y: 1.5, w: 4.7, h: 4.0 }
      addCoverImage(slide, img, frame)
      slide.addShape('rect', { x: frame.x, y: frame.y, w: frame.w, h: frame.h, fill: { type: 'none' }, line: { color: ORI.hair, width: 1 } })
      oriTri(slide, frame.x + frame.w - 0.55, frame.y, 0.55, ORI.accent, 90)
      photoCreditOnImage(slide, img.credit, frame)
    } else {
      // 右下角 3 塊大摺痕三角層疊（兩塊淡摺灰 + 一塊極淡鶴紅）
      oriTri(slide, 8.4, 2.4, 4.6, mix(ORI.ink, 'FFFFFF', 0.06), 90)
      oriTri(slide, 9.6, 3.9, 3.4, mix(ORI.ink, 'FFFFFF', 0.1), 180)
      oriTri(slide, 11.2, 5.4, 2.0, mix(ORI.accent, 'FFFFFF', 0.12), 0)
    }
    // 鶴摺徽記：一對紅三角（一實一淡、一正一斜）
    oriTri(slide, 0.9, 1.02, 0.3, ORI.accent, 0)
    oriTri(slide, 1.2, 0.94, 0.24, mix(ORI.accent, 'FFFFFF', 0.55), 45)
    tx(slide, 'ORIGAMI DECK · 教學簡報', { x: 1.6, y: 1.06, w: 7, h: 0.3, fontSize: 10, color: ORI.accent, charSpacing: 3, bold: true })
    // 題 + 副題
    const titleW = hasImg ? 6.3 : 7.3
    const fit = fitTitle(deck.title, 'cover')
    const lines = Math.max(1, Math.min(2, estimateLines(deck.title, fit.fontPt, titleW)))
    tx(slide, deck.title, { x: 0.9, y: 2.6, w: titleW, h: 1.55, fontSize: fit.fontPt, bold: true, color: ORI.ink, lineSpacingMultiple: 1.08, fit: 'shrink' })
    if (deck.subtitle) {
      const subY = 2.6 + (lines * fit.fontPt * 1.08) / 72 + 0.22
      tx(slide, deck.subtitle, { x: 0.9, y: subY, w: titleW - 0.2, h: 0.5, fontSize: 15, color: ORI.soft })
    }
    // 底部摺線 + 紅摺角 + 日期 + brand
    hline(slide, 0.9, 6.45, hasImg ? 5.6 : 4.4, ORI.hair, 1)
    oriTri(slide, 0.9, 6.6, 0.16, ORI.accent, 0)
    tx(slide, dateLabel(), { x: 1.18, y: 6.56, w: 4, h: 0.3, fontSize: 10, color: ORI.soft })
    tx(slide, brand, { x: 0.9, y: 7.0, w: 5, h: 0.3, fontSize: 9, color: ORI.faint })
  },

  section(slide, no, title) {
    slide.background = { color: 'FFFFFF' }
    // 大摺紙構圖：左上極淡摺灰 + 右下淡鶴紅
    oriTri(slide, -1.1, -1.3, 4.4, mix(ORI.ink, 'FFFFFF', 0.05), 180)
    oriTri(slide, 10.3, 4.6, 3.6, mix(ORI.accent, 'FFFFFF', 0.1), 0)
    tx(slide, pad2(no), { x: 0.85, y: 1.2, w: 6, h: 2.8, fontSize: 150, bold: true, color: mix(ORI.accent, 'FFFFFF', 0.22), fontFace: 'Trebuchet MS' })
    // 摺步標記：三粒細三角 0/90/180
    for (let k = 0; k < 3; k++) oriTri(slide, 0.92 + k * 0.34, 4.32, 0.2, ORI.accent, (k * 90) % 360)
    tx(slide, title, { x: 0.9, y: 4.72, w: 10.6, h: 1.2, fontSize: 32, bold: true, color: ORI.ink })
    tx(slide, `SECTION ${sectionWord(no)}`, { x: 0.9, y: 5.95, w: 6, h: 0.3, fontSize: 9, color: ORI.faint, charSpacing: 4 })
  },

  contentFrame(slide, ctx) {
    slide.background = { color: 'FFFFFF' }
    // kicker 前小紅摺角（指向右嘅摺記）
    oriTri(slide, 0.62, 0.6, 0.16, ORI.accent, 90)
    const { body } = scaffold(slide, origami, ctx, { kickerY: 0.58, titleY: 0.9, hairline: true })
    // 右上摺痕三角對（配圖出血版省略）
    if (!ctx.hasPhoto) {
      oriTri(slide, 11.9, 0.5, 0.26, mix(ORI.accent, 'FFFFFF', 0.25), 180)
      oriTri(slide, 12.22, 0.56, 0.2, ORI.accent, 0)
    }
    drawFooter(slide, origami, ctx)
    return body
  },
}

// ============================================================
//  菲林 cinema — 戲院敘事
//  暖近黑底 + 米白墨 + marquee 琥珀：齒孔菲林帶（一行小圓角孔）
//  沿邊掃過，封面係戲院 marquee（燈泡行 + 雙琥珀線夾置中題），
//  steps 變成 storyboard 菲林條，逐版場記號 SC 遞進。
// ============================================================

const CIN = { bg: '151210', ink: 'EFE7D8', soft: 'C9BFAC', faint: '8A8071', hair: '3A332B', accent: 'E8A33D', panel: '241F1A' }

/** 菲林齒孔帶：一行小圓角孔（0.11×0.08）每 0.26" 一粒 */
function sprocketStrip(slide: PptxGenJS.Slide, x: number, y: number, w: number, color: string): void {
  const step = 0.26
  const n = Math.max(1, Math.floor((w - 0.11) / step))
  for (let k = 0; k <= n; k++) {
    slide.addShape('roundRect', { x: x + k * step, y, w: 0.11, h: 0.08, rectRadius: 0.02, fill: { color }, line: { type: 'none' } })
  }
}

/** marquee 燈泡行：n 粒小圓燈以 cx 置中排開 */
function marqueeBulbs(slide: PptxGenJS.Slide, cx: number, y: number, n: number, color: string): void {
  const step = 0.3
  const x0 = cx - ((n - 1) * step) / 2
  for (let k = 0; k < n; k++) {
    slide.addShape('ellipse', { x: x0 + k * step - 0.045, y: y - 0.045, w: 0.09, h: 0.09, fill: { color }, line: { type: 'none' } })
  }
}

/** marquee 雙琥珀線：1.25pt + 0.09" 下一條 0.5pt */
function cinRule(slide: PptxGenJS.Slide, x: number, y: number, w: number): void {
  hline(slide, x, y, w, CIN.accent, 1.25)
  hline(slide, x, y + 0.09, w, CIN.accent, 0.5)
}

/**
 * 招牌：steps 渲染成「storyboard 菲林條」——
 * 一條橫向菲林：上下齒孔帶夾住逐格「frame」（米白細框 + 暖黑 panel 底），
 * 格內 SC 場號 tag + ghost 大序號，格下 title+desc。2–5 格。
 */
function renderCinemaStoryboard(slide: PptxGenJS.Slide, body: Rect, pack: Pack, s: Slide): void {
  const items = (s.steps ?? []).slice(0, 5)
  if (items.length < 2) return
  const n = items.length
  const gap = 0.3
  const fw = (body.w - gap * (n - 1)) / n
  const fh = Math.min(1.9, body.h * 0.46)
  const stripY = body.y + 0.34
  const holes = mix(pack.accent, pack.bg, 0.35)
  // 齒孔帶（菲林條上、下緣）
  sprocketStrip(slide, body.x, stripY - 0.2, body.w, holes)
  sprocketStrip(slide, body.x, stripY + fh + 0.12, body.w, holes)
  items.forEach((st, i) => {
    const fx = body.x + i * (fw + gap)
    // 一格 frame：米白細框 + 暖黑 panel 底
    slide.addShape('rect', { x: fx, y: stripY, w: fw, h: fh, fill: { color: pack.panel }, line: { color: pack.ink, width: 1 } })
    // SC 場號 tag（格內左上琥珀）
    tx(slide, `SC ${pad2(i + 1)}`, { x: fx + 0.12, y: stripY + 0.1, w: fw - 0.24, h: 0.24, fontSize: 9, bold: true, color: pack.accent, charSpacing: 2, fontFace: pack.displayFont })
    // 格中央 ghost 大序號（似底片入面隱約嘅畫面）
    tx(slide, String(i + 1), { x: fx, y: stripY + 0.2, w: fw, h: fh - 0.3, fontSize: 44, bold: true, color: mix(pack.ink, pack.panel, 0.3), align: 'center', valign: 'middle', fontFace: pack.displayFont })
    // 格下 title + desc
    const labelY = stripY + fh + 0.34
    tx(slide, clampText(st.title.trim(), 12), { x: fx, y: labelY, w: fw, h: 0.36, fontSize: 15, bold: true, color: pack.ink, align: 'center', fit: 'shrink' })
    if (st.desc) {
      tx(slide, clampText(st.desc.trim(), 40), {
        x: fx,
        y: labelY + 0.4,
        w: fw,
        h: Math.max(0.3, body.y + body.h - labelY - 0.5),
        fontSize: 11,
        color: pack.inkSoft,
        align: 'center',
        lineSpacingMultiple: 1.18,
        fit: 'shrink',
      })
    }
  })
}

const cinema: Pack = {
  id: 'cinema',
  name: '菲林',
  hint: '戲院敘事 · 語文戲劇',
  swatches: ['#151210', '#E8A33D', '#EFE7D8'],
  dark: true,
  bg: CIN.bg,
  ink: CIN.ink,
  inkSoft: CIN.soft,
  faint: CIN.faint,
  hair: CIN.hair,
  accent: CIN.accent,
  statColor: CIN.accent,
  panel: CIN.panel,
  cardRadius: 0.04,
  displayFont: 'Georgia',
  displayItalic: false,
  pageNoColor: CIN.accent,
  chartColors: ['E8A33D', 'EFE7D8', 'C75B39', '9C8E76'],
  chartGridColor: CIN.hair,
  bulletPt: [18, 18, 17, 17, 16],
  titlePt: 28,
  marker: { kind: 'dot', size: 0.1, color: CIN.accent, indent: 0.3 },
  tileStyle: 'panel',
  compareStyle: 'panels',
  stepNode: { kind: 'roundSquareFill', size: 0.32, color: CIN.accent, numColor: CIN.bg },
  quoteMark: { kind: 'glyph', color: mix(CIN.accent, CIN.bg, 0.5) },
  splitPhoto: 'bleedScrim',
  overrides: { steps: renderCinemaStoryboard },

  // 逐版母題：右上角極邊一個遞進場記號 SC 01 → SC 02…（Georgia 淡琥珀）
  deco(slide, ctx) {
    tx(slide, `SC ${pad2(ctx.seq + 1)}`, {
      x: 12.3,
      y: 0.52,
      w: 0.72,
      h: 0.2,
      fontSize: 8,
      bold: true,
      color: mix(CIN.accent, CIN.bg, 0.45),
      charSpacing: 1,
      align: 'right',
      fontFace: 'Georgia',
    })
  },

  cover(slide, deck, brand, img) {
    slide.background = { color: CIN.bg }
    const hasImg = Boolean(img)
    if (img) {
      // full-bleed 相 + 暖黑 scrim（戲院熄燈感），署名chip先畫、齒孔帶疊上
      addCoverImage(slide, img, { x: 0, y: 0, w: 13.33, h: 7.5 })
      slide.addShape('rect', { x: 0, y: 0, w: 13.33, h: 7.5, fill: { color: CIN.bg, transparency: 30 }, line: { type: 'none' } })
      photoCreditOnImage(slide, img.credit, { x: 0, y: 0, w: 13.33, h: 7.5 })
    }
    // 上下菲林齒孔帶
    const holes = hasImg ? mix(CIN.ink, CIN.bg, 0.55) : mix(CIN.accent, CIN.bg, 0.25)
    sprocketStrip(slide, 0.5, 0.3, 12.35, holes)
    sprocketStrip(slide, 0.5, 7.12, 12.35, holes)
    // marquee：燈泡行 + 雙琥珀線夾住置中題
    marqueeBulbs(slide, 6.665, 1.32, 9, CIN.accent)
    tx(slide, 'NOW SHOWING · 教學簡報', { x: 1.9, y: 1.6, w: 9.53, h: 0.3, fontSize: 10, color: CIN.accent, charSpacing: 4, bold: true, align: 'center' })
    cinRule(slide, 3.47, 2.14, 6.4)
    const fit = fitTitle(deck.title, 'cover')
    const lines = Math.max(1, Math.min(2, estimateLines(deck.title, fit.fontPt, 10.5)))
    tx(slide, deck.title, { x: 1.4, y: 2.5, w: 10.53, h: 1.6, fontSize: fit.fontPt, bold: true, color: CIN.ink, align: 'center', lineSpacingMultiple: 1.08, fit: 'shrink' })
    let subY = 2.5 + (lines * fit.fontPt * 1.08) / 72 + 0.22
    if (deck.subtitle) {
      tx(slide, deck.subtitle, { x: 1.9, y: subY, w: 9.53, h: 0.5, fontSize: 15, color: CIN.soft, align: 'center' })
      subY += 0.5
    }
    cinRule(slide, 3.47, subY + 0.12, 6.4)
    marqueeBulbs(slide, 6.665, subY + 0.55, 9, CIN.accent)
    // 底部：戲票式日期 + brand
    tx(slide, `${dateLabel()} 上映`, { x: 1.9, y: 6.4, w: 9.53, h: 0.3, fontSize: 10, color: CIN.accent, align: 'center', fontFace: 'Georgia' })
    tx(slide, brand, { x: 1.9, y: 6.74, w: 9.53, h: 0.3, fontSize: 9, color: CIN.faint, align: 'center' })
  },

  section(slide, no, title) {
    slide.background = { color: CIN.bg }
    // 默片字卡（intertitle）：上下齒孔帶 + 置中 SCENE 巨號
    sprocketStrip(slide, 0.5, 0.36, 12.35, mix(CIN.accent, CIN.bg, 0.3))
    sprocketStrip(slide, 0.5, 7.06, 12.35, mix(CIN.accent, CIN.bg, 0.3))
    tx(slide, `SCENE ${sectionWord(no)} · 場`, { x: 1.9, y: 1.95, w: 9.53, h: 0.32, fontSize: 11, color: CIN.accent, charSpacing: 6, bold: true, align: 'center', fontFace: 'Georgia' })
    tx(slide, pad2(no), { x: 3.67, y: 2.3, w: 6, h: 2.3, fontSize: 130, bold: true, color: mix(CIN.accent, CIN.bg, 0.45), align: 'center', fontFace: 'Georgia' })
    cinRule(slide, 5.17, 4.88, 3.0)
    tx(slide, title, { x: 1.4, y: 5.15, w: 10.53, h: 1.1, fontSize: 30, bold: true, color: CIN.ink, align: 'center' })
  },

  contentFrame(slide, ctx) {
    slide.background = { color: CIN.bg }
    const { body } = scaffold(slide, cinema, ctx, { kickerY: 0.58, titleY: 0.9, hairline: true })
    // 右上短齒孔帶（配圖出血版省略）
    if (!ctx.hasPhoto) sprocketStrip(slide, 9.6, 0.62, 2.8, mix(CIN.accent, CIN.bg, 0.3))
    drawFooter(slide, cinema, ctx)
    return body
  },
}

// ============================================================
//  揮春 festival — 節慶喜慶
//  深節慶紅底 + 暖米墨 + 金點睛：封面右側一條金邊揮春直幡
//  （直書教學簡報）、全版細金框；章節係金環燈籠 + 燈穗；
//  cards 變成利是封（深紅圓角封 + 金頂帶 + 金封印）。
// ============================================================

const FES = { bg: '9E1B1B', deep: '7E1111', ink: 'FFF6E8', soft: 'F4DDBE', faint: 'D9A263', hair: 'B5532E', accent: 'E8B14E', panel: '8A1515' }

/** 全版細金框（inset 吋；外框語言 = 揮春裱邊） */
function fesFrame(slide: PptxGenJS.Slide, inset: number, color: string, pt: number): void {
  slide.addShape('rect', { x: inset, y: inset, w: 13.33 - inset * 2, h: 7.5 - inset * 2, fill: { type: 'none' }, line: { color, width: pt } })
}

/** 燈籠墜：金環 + 短穗線 + 菱形結（cx/cy = 環心，d = 環直徑） */
function fesLantern(slide: PptxGenJS.Slide, cx: number, cy: number, d: number, color: string, pt: number): void {
  slide.addShape('ellipse', { x: cx - d / 2, y: cy - d / 2, w: d, h: d, fill: { type: 'none' }, line: { color, width: pt } })
  vline(slide, cx, cy + d / 2, d * 0.18, color, pt)
  slide.addShape('diamond', { x: cx - d * 0.07, y: cy + d * 0.68, w: d * 0.14, h: d * 0.14, fill: { color }, line: { type: 'none' } })
}

/**
 * 招牌：cards 渲染成「利是封」——
 * 每卡一個深紅圓角利是封（mix 黑入紅做封身）+ 金頂帶 +
 * 騎住頂帶嘅金圓封印（內序號），金題、米白正文。2–6 封。
 */
function renderFestivalLaisee(slide: PptxGenJS.Slide, body: Rect, pack: Pack, s: Slide): void {
  const items = (s.cards ?? []).slice(0, 6)
  if (items.length < 2) return
  const n = items.length
  const cols = n <= 2 ? n : n <= 4 ? 2 : 3
  const rows = Math.ceil(n / cols)
  const gap = 0.35
  const cw = (body.w - gap * (cols - 1)) / cols
  const ch = (body.h - gap * (rows - 1)) / rows
  const packetFill = mix('000000', pack.bg, 0.3)
  items.forEach((card, i) => {
    const r = Math.floor(i / cols)
    const c = i % cols
    const cx = body.x + c * (cw + gap)
    const cy = body.y + r * (ch + gap)
    // 利是封：更深紅圓角 + 淡金細邊
    slide.addShape('roundRect', { x: cx, y: cy, w: cw, h: ch, rectRadius: pack.cardRadius, fill: { color: packetFill }, line: { color: mix(pack.accent, pack.bg, 0.55), width: 0.75 } })
    // 金頂帶
    const bandH = Math.min(0.34, ch * 0.2)
    slide.addShape('rect', { x: cx + 0.06, y: cy + 0.06, w: cw - 0.12, h: bandH, fill: { color: pack.accent }, line: { type: 'none' } })
    // 金圓封印騎住頂帶（內序號）
    const seal = 0.34
    const sealY = cy + 0.06 + bandH - seal / 2
    slide.addShape('ellipse', { x: cx + cw / 2 - seal / 2, y: sealY, w: seal, h: seal, fill: { color: packetFill }, line: { color: pack.accent, width: 1.25 } })
    tx(slide, String(i + 1), { x: cx + cw / 2 - seal / 2, y: sealY, w: seal, h: seal, fontSize: 12, bold: true, color: pack.accent, align: 'center', valign: 'middle', fontFace: pack.displayFont })
    // 金題（封印下）
    const titleY = cy + 0.06 + bandH + seal / 2 + 0.08
    tx(slide, clampText(card.title.trim(), 12), { x: cx + 0.2, y: titleY, w: cw - 0.4, h: 0.4, fontSize: 16, bold: true, color: pack.accent, align: 'center', fit: 'shrink' })
    // 米白正文
    if (card.desc) {
      tx(slide, clampText(card.desc.trim(), 70), {
        x: cx + 0.24,
        y: titleY + 0.44,
        w: cw - 0.48,
        h: Math.max(0.3, cy + ch - titleY - 0.56),
        fontSize: 11,
        color: pack.inkSoft,
        align: 'center',
        lineSpacingMultiple: 1.2,
        fit: 'shrink',
      })
    }
  })
}

const festival: Pack = {
  id: 'festival',
  name: '揮春',
  hint: '節慶喜慶 · 中文文化',
  swatches: ['#9E1B1B', '#E8B14E', '#FFF6E8'],
  dark: true,
  bg: FES.bg,
  ink: FES.ink,
  inkSoft: FES.soft,
  faint: FES.faint,
  hair: FES.hair,
  accent: FES.accent,
  statColor: FES.accent,
  panel: FES.panel,
  cardRadius: 0.08,
  displayFont: 'Microsoft JhengHei',
  displayItalic: false,
  pageNoColor: FES.accent,
  chartColors: ['E8B14E', 'FFF6E8', 'F4A26B', 'BFD3A8'],
  chartGridColor: FES.hair,
  bulletPt: [18, 18, 17, 17, 16],
  titlePt: 28,
  marker: { kind: 'roundSquare', size: 0.11, radius: 0.03, color: FES.accent, indent: 0.32 },
  tileStyle: 'panel',
  compareStyle: 'panels',
  stepNode: { kind: 'circleOutline', size: 0.34, color: FES.accent, numColor: FES.accent },
  quoteMark: { kind: 'glyph', color: mix(FES.accent, FES.bg, 0.55) },
  splitPhoto: 'bleedScrim',
  overrides: { cards: renderFestivalLaisee },

  // 逐版母題：一對極小淡金燈籠結（環 + 結點），左右下角按 seq % 2 交替
  deco(slide, ctx) {
    const right = ctx.seq % 2 === 0
    const cx = right ? 12.78 : 0.52
    const c = mix(FES.accent, FES.bg, 0.45)
    slide.addShape('ellipse', { x: cx - 0.055, y: 6.9, w: 0.11, h: 0.11, fill: { type: 'none' }, line: { color: c, width: 1 } })
    slide.addShape('ellipse', { x: cx - 0.03, y: 7.08, w: 0.06, h: 0.06, fill: { color: c }, line: { type: 'none' } })
  },

  cover(slide, deck, brand, img) {
    slide.background = { color: FES.bg }
    // 全版金細框（外 1.5pt + 內 0.5pt 淡金）
    fesFrame(slide, 0.28, FES.accent, 1.5)
    fesFrame(slide, 0.4, mix(FES.accent, FES.bg, 0.5), 0.5)
    // 右側揮春直幡：深紅底 + 金邊 + 直書「教學簡報」+ 金菱結 + 期
    const bx = 10.7
    const by = 0.85
    const bw = 1.45
    const bh = 5.8
    slide.addShape('rect', { x: bx, y: by, w: bw, h: bh, fill: { color: FES.deep }, line: { color: FES.accent, width: 1.25 } })
    tx(slide, '教\n學\n簡\n報', { x: bx, y: by + 0.38, w: bw, h: 3.6, fontSize: 28, bold: true, color: FES.ink, align: 'center', lineSpacingMultiple: 1.25 })
    slide.addShape('diamond', { x: bx + bw / 2 - 0.07, y: by + 4.2, w: 0.14, h: 0.14, fill: { color: FES.accent }, line: { type: 'none' } })
    tx(slide, dateLabel(), { x: bx + 0.08, y: by + bh - 0.68, w: bw - 0.16, h: 0.5, fontSize: 9, color: FES.accent, align: 'center', lineSpacingMultiple: 1.2 })
    // 左欄：kicker + 題 + 副題
    tx(slide, 'FESTIVE DECK · 教學簡報', { x: 0.95, y: 1.15, w: 7, h: 0.3, fontSize: 10, color: FES.accent, charSpacing: 4, bold: true })
    const titleW = 8.9
    const fit = fitTitle(deck.title, 'cover')
    const lines = Math.max(1, Math.min(2, estimateLines(deck.title, fit.fontPt, titleW)))
    tx(slide, deck.title, { x: 0.95, y: 2.5, w: titleW, h: 1.6, fontSize: fit.fontPt, bold: true, color: FES.ink, lineSpacingMultiple: 1.1, fit: 'shrink' })
    if (deck.subtitle) {
      const subY = 2.5 + (lines * fit.fontPt * 1.1) / 72 + 0.22
      tx(slide, deck.subtitle, { x: 0.95, y: subY, w: 8.7, h: 0.5, fontSize: 15, color: FES.soft })
    }
    if (img) {
      // 左下金框相
      const frame: Rect = { x: 0.95, y: 4.55, w: 6.0, h: 2.0 }
      addCoverImage(slide, img, frame)
      slide.addShape('rect', { x: frame.x, y: frame.y, w: frame.w, h: frame.h, fill: { type: 'none' }, line: { color: FES.accent, width: 1 } })
      photoCreditOnImage(slide, img.credit, frame)
    } else {
      // 無相：一對金燈籠墜（一實一淡）
      fesLantern(slide, 1.35, 5.25, 0.5, FES.accent, 1.25)
      fesLantern(slide, 2.3, 5.5, 0.34, mix(FES.accent, FES.bg, 0.6), 1)
    }
    tx(slide, brand, { x: 0.95, y: 6.72, w: 5, h: 0.3, fontSize: 9, color: FES.faint })
  },

  section(slide, no, title) {
    slide.background = { color: FES.bg }
    fesFrame(slide, 0.28, mix(FES.accent, FES.bg, 0.6), 0.75)
    // 大燈籠：金環 + 章節號 + 燈穗 + 菱形結
    const cx = 6.665
    const cy = 2.95
    const d = 2.7
    slide.addShape('ellipse', { x: cx - d / 2, y: cy - d / 2, w: d, h: d, fill: { type: 'none' }, line: { color: FES.accent, width: 2.5 } })
    tx(slide, pad2(no), { x: cx - d / 2, y: cy - d / 2, w: d, h: d, fontSize: 92, bold: true, color: FES.accent, align: 'center', valign: 'middle', fontFace: 'Microsoft JhengHei' })
    vline(slide, cx, cy + d / 2, 0.4, FES.accent, 1.5)
    slide.addShape('diamond', { x: cx - 0.09, y: cy + d / 2 + 0.4, w: 0.18, h: 0.18, fill: { color: FES.accent }, line: { type: 'none' } })
    tx(slide, title, { x: 1.4, y: 5.15, w: 10.53, h: 1.0, fontSize: 30, bold: true, color: FES.ink, align: 'center' })
    tx(slide, `SECTION ${sectionWord(no)}`, { x: 1.4, y: 6.22, w: 10.53, h: 0.3, fontSize: 9, color: FES.faint, charSpacing: 5, align: 'center' })
  },

  contentFrame(slide, ctx) {
    slide.background = { color: FES.bg }
    const { body } = scaffold(slide, festival, ctx, { kickerY: 0.58, titleY: 0.9, hairline: true })
    // 右上小燈籠墜（配圖出血版省略）
    if (!ctx.hasPhoto) fesLantern(slide, 12.16, 0.64, 0.3, mix(FES.accent, FES.bg, 0.75), 1.25)
    drawFooter(slide, festival, ctx)
    return body
  },
}

// ───────── 滙出 ─────────

export const GALLERY_PACKS_4: Pack[] = [marble, origami, cinema, festival]
