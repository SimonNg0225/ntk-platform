// ============================================================
//  pptx 模板 pack — gallery 第一輯（5 套）
//  ------------------------------------------------------------
//  · 粉筆 chalk    — 黑板手感：墨綠底、粉筆黃／粉紅、虛線代實線
//  · 號外 press    — 活字報紙：雙線報頭、Georgia 巨號、朱紅號外印
//  · 霓虹 neon     — 終端螢光：cyan／magenta 錯位、corner bracket
//  · 彩斑 confetti — Memphis 幾何：三角圓點加號散落、幼小活潑
//  · 粉彩 pastel   — 雲朵軟糖：三色 blob、圓裁相、初小溫柔
//  鐵律同 pptxPacks.ts：文字必經 tx()、fontSize 整數、shadow 只 outer、
//  淡色一律 mix() 預混、嚴禁 SVG／gradient；rectRadius 單位吋。
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
//  粉筆 chalk — 黑板手感
//  墨綠黑板底，結構線全部用 sysDash 虛線（粉筆 stroke 感）；
//  點睛色 = 粉筆黃 + 粉筆粉紅；motif 係三支圓端小粉筆，
//  好似擺喺黑板槽咁微微唔同角度孖埋一齊。
// ============================================================

const CHK = { bg: '25382F', ink: 'F4F1E8', soft: 'C2CABB', faint: '8E988C', hair: '4A5A50', accent: 'F5D76E', pink: 'F1B8C4', panel: '2F4439' }

/** 粉筆虛線（橫）— sysDash 1pt 代替實線做結構 */
function dashH(slide: PptxGenJS.Slide, x: number, y: number, w: number, color: string, pt = 1): void {
  slide.addShape('line', { x, y, w, h: 0, line: { color, width: pt, dashType: 'sysDash' } })
}

/** 粉筆虛線（直） */
function dashV(slide: PptxGenJS.Slide, x: number, y: number, h: number, color: string, pt = 1): void {
  slide.addShape('line', { x, y, w: 0, h, line: { color, width: pt, dashType: 'sysDash' } })
}

/** 粉筆條 motif：三支圓端 roundRect（黃／粉紅／白）微微唔同 rotate 疊排 */
function chalkSticks(slide: PptxGenJS.Slide, x: number, y: number, w = 0.42, h = 0.09): void {
  const sticks = [
    { color: CHK.accent, rotate: -8, dx: 0 },
    { color: CHK.pink, rotate: 0, dx: 0.08 },
    { color: CHK.ink, rotate: 6, dx: 0.03 },
  ]
  sticks.forEach((s, i) => {
    slide.addShape('roundRect', {
      x: x + s.dx,
      y: y + i * (h + 0.05),
      w,
      h,
      rectRadius: h / 2,
      fill: { color: s.color },
      line: { type: 'none' },
      rotate: s.rotate,
    })
  })
}

const chalk: Pack = {
  id: 'chalk',
  name: '粉筆',
  hint: '黑板手感 · 全科',
  swatches: ['#25382F', '#F5D76E', '#F1B8C4'],
  dark: true,
  bg: CHK.bg,
  ink: CHK.ink,
  inkSoft: CHK.soft,
  faint: CHK.faint,
  hair: CHK.hair,
  accent: CHK.accent,
  statColor: CHK.pink,
  panel: CHK.panel,
  cardRadius: 0.06,
  displayFont: 'Microsoft JhengHei',
  displayItalic: false,
  pageNoColor: CHK.faint,
  chartColors: ['F5D76E', 'F1B8C4', 'BFD9C9', '8E988C'],
  chartGridColor: CHK.hair,
  bulletPt: [19, 18, 18, 17, 16],
  titlePt: 29,
  marker: { kind: 'circle', size: 0.11, linePt: 1.5, color: CHK.accent, indent: 0.32 },
  tileStyle: 'panel',
  compareStyle: 'panels',
  stepNode: { kind: 'circleOutline', size: 0.34, color: CHK.accent, numColor: CHK.accent },
  quoteMark: { kind: 'glyph', color: CHK.accent },
  splitPhoto: 'bleedScrim',
  structDash: true, // 版式結構線都行虛線，貫徹粉筆 stroke

  cover(slide, deck, brand, img) {
    slide.background = { color: CHK.bg }
    if (img) {
      // full-bleed 相 + 黑板色 scrim（70% 不透明保字）；虛線框照畫喺 scrim 上
      addCoverImage(slide, img, { x: 0, y: 0, w: 13.33, h: 7.5 })
      slide.addShape('rect', { x: 0, y: 0, w: 13.33, h: 7.5, fill: { color: CHK.bg, transparency: 30 }, line: { type: 'none' } })
    }
    // 粉筆畫框：四條 sysDash 線 inset 0.32
    dashH(slide, 0.32, 0.32, 12.69, CHK.hair)
    dashH(slide, 0.32, 7.18, 12.69, CHK.hair)
    dashV(slide, 0.32, 0.32, 6.86, CHK.hair)
    dashV(slide, 13.01, 0.32, 6.86, CHK.hair)
    tx(slide, 'TEACHING DECK · 教學簡報', { x: 0.95, y: 1.0, w: 7, h: 0.3, fontSize: 10, color: CHK.accent, charSpacing: 3, bold: true })
    const fit = fitTitle(deck.title, 'cover')
    const lines = Math.max(1, Math.min(2, estimateLines(deck.title, fit.fontPt, 11.2)))
    tx(slide, deck.title, { x: 0.95, y: 2.4, w: 11.2, h: 2.0, fontSize: fit.fontPt, bold: true, color: CHK.ink, lineSpacingMultiple: 1.08, fit: 'shrink' })
    if (deck.subtitle) {
      const subY = 2.4 + (lines * fit.fontPt * 1.08) / 72 + 0.25
      tx(slide, deck.subtitle, { x: 0.95, y: subY, w: 10.8, h: 0.5, fontSize: 15, color: CHK.soft })
    }
    tx(slide, `${dateLabel()} · 共 ${deck.slides.length + 1} 版`, { x: 0.95, y: 6.45, w: 7, h: 0.3, fontSize: 10, color: CHK.soft })
    tx(slide, brand, { x: 0.95, y: 6.85, w: 5, h: 0.3, fontSize: 9, color: CHK.faint })
    chalkSticks(slide, 11.2, 6.5)
    if (img) photoCreditOnImage(slide, img.credit, { x: 0, y: 0, w: 13.33, h: 7.5 })
  },

  section(slide, no, title) {
    slide.background = { color: CHK.bg }
    // 粉筆圈住個巨號（sysDash ellipse 無 fill）
    slide.addShape('ellipse', { x: 0.55, y: 1.05, w: 4.4, h: 3.3, fill: { type: 'none' }, line: { color: CHK.accent, width: 1.25, dashType: 'sysDash' } })
    tx(slide, pad2(no), { x: 0.8, y: 1.2, w: 6, h: 2.9, fontSize: 150, bold: true, color: mix(CHK.accent, CHK.bg, 0.62) })
    tx(slide, title, { x: 0.9, y: 4.6, w: 11.2, h: 1.2, fontSize: 32, bold: true, color: CHK.ink })
    chalkSticks(slide, 0.9, 6.6)
  },

  contentFrame(slide, ctx) {
    slide.background = { color: CHK.bg }
    const { body, contentW } = scaffold(slide, chalk, ctx, { kickerY: 0.58, titleY: 0.9, hairline: false })
    // 用虛線代 folio 髮線
    dashH(slide, 0.9, body.y - 0.3, contentW, CHK.hair)
    if (!ctx.hasPhoto) chalkSticks(slide, 11.7, 0.62, 0.32, 0.07)
    drawFooter(slide, chalk, ctx)
    return body
  },
}

// ============================================================
//  號外 press — 活字報紙
//  白報紙底 + 印章朱紅；報頭用「粗+細」雙線（傳統報紙 masthead），
//  封面右上一個 rotate 12° 嘅「特刊」朱紅印章，巨號用 Georgia
//  老活字；contentFrame 右上印「第 N 版」延續報紙語言。
// ============================================================

const PRS = { ink: '141414', soft: '5A5A5A', faint: '9A9A9A', hair: 'D9D4CC', accent: 'B3271E', panel: 'F4F1EA' }

/** 報頭雙線：上粗 2.25pt + 下細 0.75pt 相距 0.06 */
function doubleRule(slide: PptxGenJS.Slide, x: number, y: number, w: number, color = PRS.ink): void {
  hline(slide, x, y, w, color, 2.25)
  hline(slide, x, y + 0.06, w, color, 0.75)
}

const press: Pack = {
  id: 'press',
  name: '號外',
  hint: '報章活字 · 人文',
  swatches: ['#141414', '#B3271E', '#F4F1EA'],
  dark: false,
  bg: 'FFFFFF',
  ink: PRS.ink,
  inkSoft: PRS.soft,
  faint: PRS.faint,
  hair: PRS.hair,
  accent: PRS.accent,
  statColor: PRS.ink,
  panel: PRS.panel,
  cardRadius: 0,
  displayFont: 'Georgia',
  displayItalic: false,
  pageNoColor: PRS.faint,
  chartColors: ['141414', 'B3271E', '8A8A8A', 'D0CBC2'],
  chartGridColor: PRS.hair,
  bulletPt: [18, 17, 17, 16, 15],
  titlePt: 30,
  marker: { kind: 'number', color: PRS.accent, indent: 0.42 },
  tileStyle: 'hairline',
  compareStyle: 'hairline',
  stepNode: { kind: 'bare', size: 0.34, color: PRS.accent, numColor: PRS.accent },
  quoteMark: { kind: 'glyph', color: PRS.accent },
  splitPhoto: 'bleedHair',

  cover(slide, deck, brand, img) {
    slide.background = { color: 'FFFFFF' }
    const hasImg = Boolean(img)
    // 報頭：雙線 + 報名 + 右對齊日期
    doubleRule(slide, 0.9, 0.55, 11.53)
    tx(slide, 'EZITEACH DAILY · 教學日報', { x: 0.9, y: 0.72, w: 7, h: 0.3, fontSize: 11, color: PRS.ink, charSpacing: 3, bold: true })
    tx(slide, dateLabel(), { x: 8.43, y: 0.74, w: 4, h: 0.28, fontSize: 9, color: PRS.soft, align: 'right' })
    // 特大活字題（cover 階梯 +2，cap 46）
    const fit = fitTitle(deck.title, 'cover')
    const pt = Math.min(46, fit.fontPt + 2)
    const titleW = hasImg ? 6.4 : 9.6
    const lines = Math.max(1, Math.min(2, estimateLines(deck.title, pt, titleW)))
    tx(slide, deck.title, { x: 0.9, y: 2.1, w: titleW, h: 2.2, fontSize: pt, bold: true, color: PRS.ink, lineSpacingMultiple: 1.04, fit: 'shrink' })
    if (deck.subtitle) {
      const subY = 2.1 + (lines * pt * 1.04) / 72 + 0.22
      tx(slide, deck.subtitle, { x: 0.9, y: subY, w: hasImg ? 6.2 : 9.4, h: 0.5, fontSize: 15, color: PRS.soft, italic: true })
    }
    // 號外印：rotate 12° 朱紅框 + 「特刊」
    slide.addShape('rect', { x: 10.6, y: 1.6, w: 1.9, h: 0.9, fill: { type: 'none' }, line: { color: PRS.accent, width: 2 }, rotate: 12 })
    tx(slide, '特刊', { x: 10.6, y: 1.6, w: 1.9, h: 0.9, fontSize: 26, bold: true, color: PRS.accent, align: 'center', valign: 'middle', rotate: 12 })
    // 底部雙線 + 版數
    doubleRule(slide, 0.9, 6.6, 11.53)
    tx(slide, `共 ${deck.slides.length + 1} 版 ｜ ${brand}`, { x: 0.9, y: 6.78, w: 8, h: 0.3, fontSize: 9, color: PRS.soft })
    if (img) {
      // 報相：右下窗 + 幼黑框；署名用相內 chip（相底貼近雙線，相外冇位）
      const frame: Rect = { x: 7.6, y: 3.4, w: 5.0, h: 3.0 }
      addCoverImage(slide, img, frame)
      slide.addShape('rect', { x: frame.x, y: frame.y, w: frame.w, h: frame.h, fill: { type: 'none' }, line: { color: PRS.ink, width: 0.75 } })
      photoCreditOnImage(slide, img.credit, frame)
    }
  },

  section(slide, no, title) {
    slide.background = { color: 'FFFFFF' }
    // 「第二版」概念：Georgia 巨號 ghost + 雙線 + 章題
    tx(slide, pad2(no), { x: 0.7, y: 1.3, w: 6.5, h: 2.9, fontSize: 150, bold: true, color: mix(PRS.ink, 'FFFFFF', 0.09), fontFace: 'Georgia' })
    doubleRule(slide, 0.9, 4.35, 5.2)
    tx(slide, title, { x: 0.9, y: 4.6, w: 11.2, h: 1.2, fontSize: 32, bold: true, color: PRS.ink })
    tx(slide, `SECTION ${sectionWord(no)}`, { x: 0.9, y: 5.9, w: 5, h: 0.3, fontSize: 9, color: PRS.soft, charSpacing: 4, fontFace: 'Georgia' })
  },

  contentFrame(slide, ctx) {
    slide.background = { color: 'FFFFFF' }
    const { body, contentW } = scaffold(slide, press, ctx, { kickerY: 0.58, titleY: 0.9, hairline: false })
    // 雙線代 folio 髮線
    doubleRule(slide, 0.9, body.y - 0.3, contentW)
    // 右上「第 N 版」報紙頁角（配圖出血時省略）
    if (!ctx.hasPhoto) {
      tx(slide, `第 ${ctx.pageNo} 版`, { x: 11.4, y: 0.6, w: 1.03, h: 0.3, fontSize: 10, color: PRS.faint, align: 'right' })
    }
    drawFooter(slide, press, ctx)
    return body
  },
}

// ============================================================
//  霓虹 neon — 終端機螢光
//  深夜藍黑底，cyan 主光 + magenta 副光：雙色錯位線、ghost 重影
//  巨號玩 glitch；corner bracket（L 形括角）框住版面似 HUD；
//  kicker 加 [ ] 括號、純拉丁元素用 Consolas 等寬字。
// ============================================================

const NEO = { bg: '0B0F1A', ink: 'E6F1FF', soft: '8FA0B8', faint: '5A6B82', hair: '1F2A3D', accent: '2DE2E6', magenta: 'FF2E97', panel: '121A2B' }

/** corner bracket：兩條 1.25pt 線砌 L 形（x/y = bracket 範圍左上角） */
function cornerBracket(slide: PptxGenJS.Slide, x: number, y: number, size: number, color: string, corner: 'tl' | 'br'): void {
  if (corner === 'tl') {
    // ┌ 開口向右下
    hline(slide, x, y, size, color, 1.25)
    vline(slide, x, y, size, color, 1.25)
  } else {
    // ┘ 開口向左上
    hline(slide, x, y + size, size, color, 1.25)
    vline(slide, x + size, y, size, color, 1.25)
  }
}

const neon: Pack = {
  id: 'neon',
  name: '霓虹',
  hint: '螢光終端 · STEM',
  swatches: ['#0B0F1A', '#2DE2E6', '#FF2E97'],
  dark: true,
  bg: NEO.bg,
  ink: NEO.ink,
  inkSoft: NEO.soft,
  faint: NEO.faint,
  hair: NEO.hair,
  accent: NEO.accent,
  statColor: NEO.magenta,
  panel: NEO.panel,
  cardRadius: 0.04,
  displayFont: 'Consolas',
  displayItalic: false,
  pageNoColor: NEO.accent,
  chartColors: ['2DE2E6', 'FF2E97', '6BE3A2', '8FA0B8'],
  chartGridColor: NEO.hair,
  bulletPt: [19, 18, 18, 17, 16],
  titlePt: 28,
  marker: { kind: 'square', size: 0.09, color: NEO.accent, indent: 0.3 },
  tileStyle: 'panel',
  compareStyle: 'panels',
  stepNode: { kind: 'squareFill', size: 0.32, color: NEO.accent, numColor: NEO.bg },
  quoteMark: { kind: 'square', size: 0.14, color: NEO.magenta },
  splitPhoto: 'bleedScrim',

  cover(slide, deck, brand, img) {
    slide.background = { color: NEO.bg }
    if (img) {
      addCoverImage(slide, img, { x: 0, y: 0, w: 13.33, h: 7.5 })
      // scrim 要夠深，先保得住近黑 neon 底色身份（30 會俾相搶走色溫）
      slide.addShape('rect', { x: 0, y: 0, w: 13.33, h: 7.5, fill: { color: NEO.bg, transparency: 18 }, line: { type: 'none' } })
    }
    tx(slide, '[ TEACHING DECK · 教學簡報 ]', { x: 0.9, y: 1.0, w: 8, h: 0.3, fontSize: 10, color: NEO.accent, charSpacing: 2, bold: true })
    // 雙色錯位線（glitch 訊號）
    hline(slide, 0.9, 1.45, 2.6, NEO.accent, 1.5)
    hline(slide, 0.96, 1.51, 2.6, NEO.magenta, 1.5)
    const fit = fitTitle(deck.title, 'cover')
    const lines = Math.max(1, Math.min(2, estimateLines(deck.title, fit.fontPt, 11.4)))
    tx(slide, deck.title, { x: 0.9, y: 2.45, w: 11.4, h: 2.0, fontSize: fit.fontPt, bold: true, color: NEO.ink, lineSpacingMultiple: 1.08, fit: 'shrink' })
    if (deck.subtitle) {
      const subY = 2.45 + (lines * fit.fontPt * 1.08) / 72 + 0.25
      tx(slide, deck.subtitle, { x: 0.9, y: subY, w: 11, h: 0.5, fontSize: 15, color: NEO.soft })
    }
    tx(slide, `// ${dateLabel()}`, { x: 0.9, y: 6.45, w: 6, h: 0.3, fontSize: 10, color: NEO.faint })
    tx(slide, brand, { x: 0.9, y: 6.85, w: 5, h: 0.3, fontSize: 9, color: NEO.faint })
    // 右下 bracket 錨實版角（浮喺半空會似框住空氣）
    cornerBracket(slide, 12.69, 6.92, 0.26, NEO.accent, 'br')
    if (img) photoCreditOnImage(slide, img.credit, { x: 0, y: 0, w: 13.33, h: 7.5 })
  },

  section(slide, no, title) {
    slide.background = { color: NEO.bg }
    // glitch 重影巨號：先畫 magenta 錯位，再疊 cyan 主體（兩層都要夠光先似著咗燈嘅 neon）
    tx(slide, pad2(no), { x: 0.86, y: 1.26, w: 6, h: 2.9, fontSize: 150, bold: true, color: mix(NEO.magenta, NEO.bg, 0.38), fontFace: 'Consolas' })
    tx(slide, pad2(no), { x: 0.8, y: 1.2, w: 6, h: 2.9, fontSize: 150, bold: true, color: mix(NEO.accent, NEO.bg, 0.55), fontFace: 'Consolas' })
    tx(slide, `[ SECTION ${sectionWord(no)} ]`, { x: 0.9, y: 4.15, w: 6, h: 0.3, fontSize: 10, color: NEO.accent, charSpacing: 2, fontFace: 'Consolas' })
    tx(slide, title, { x: 0.9, y: 4.55, w: 11.2, h: 1.2, fontSize: 32, bold: true, color: NEO.ink })
  },

  contentFrame(slide, ctx) {
    slide.background = { color: NEO.bg }
    // HUD 括角：左上 ┌ + 右下 ┘（配圖出血時右下省略）
    cornerBracket(slide, 0.55, 0.5, 0.22, NEO.accent, 'tl')
    if (!ctx.hasPhoto) cornerBracket(slide, 12.56, 6.78, 0.22, NEO.accent, 'br')
    const { body } = scaffold(slide, neon, { ...ctx, kicker: `[ ${ctx.kicker} ]` }, { kickerY: 0.58, titleY: 0.9, hairline: true })
    drawFooter(slide, neon, ctx)
    return body
  },
}

// ============================================================
//  彩斑 confetti — Memphis 幾何
//  白底 + 鈷藍／珊瑚／檸黃／湖水綠四色彩斑：三角、圓點、加號、
//  短斜線散落右半似拋彩紙；motif trio（三角+圓點+加號）做角標，
//  奶黃 tint 卡 + 圓角，幼小常識堂啱用。
// ============================================================

const CFT = { ink: '1F2430', soft: '6A7280', faint: 'A1A8B3', hair: 'E8EAEF', accent: '2B59C3', coral: 'FF5D5D', panel: 'FFF6E0', yellow: 'FFC53D', teal: '2EC4B6' }

/** 加號彩斑：兩條 rect 疊十字（cx/cy = 中心） */
function confettiPlus(slide: PptxGenJS.Slide, cx: number, cy: number, size: number, color: string): void {
  const arm = size * 0.31
  slide.addShape('rect', { x: cx - size / 2, y: cy - arm / 2, w: size, h: arm, fill: { color }, line: { type: 'none' } })
  slide.addShape('rect', { x: cx - arm / 2, y: cy - size / 2, w: arm, h: size, fill: { color }, line: { type: 'none' } })
}

/** confetti trio motif：細三角 + 圓點 + 加號（總闊約 0.8）；flip 輪換排法令逐版有少少生氣 */
function confettiTrio(slide: PptxGenJS.Slide, x: number, y: number, flip = false): void {
  if (flip) {
    confettiPlus(slide, x + 0.08, y + 0.08, 0.16, CFT.teal)
    slide.addShape('ellipse', { x: x + 0.34, y: y + 0.2, w: 0.12, h: 0.12, fill: { color: CFT.coral }, line: { type: 'none' } })
    slide.addShape('triangle', { x: x + 0.6, y, w: 0.16, h: 0.16, fill: { color: CFT.yellow }, line: { type: 'none' }, rotate: -22 })
    return
  }
  slide.addShape('triangle', { x, y, w: 0.16, h: 0.16, fill: { color: CFT.yellow }, line: { type: 'none' }, rotate: 18 })
  slide.addShape('ellipse', { x: x + 0.32, y: y + 0.16, w: 0.12, h: 0.12, fill: { color: CFT.teal }, line: { type: 'none' } })
  confettiPlus(slide, x + 0.64, y + 0.1, 0.16, CFT.coral)
}

const confetti: Pack = {
  id: 'confetti',
  name: '彩斑',
  hint: 'Memphis 彩斑 · 幼小',
  swatches: ['#2B59C3', '#FF5D5D', '#FFC53D'],
  dark: false,
  bg: 'FFFFFF',
  ink: CFT.ink,
  inkSoft: CFT.soft,
  faint: CFT.faint,
  hair: CFT.hair,
  accent: CFT.accent,
  statColor: CFT.accent, // 鈷藍 — 珊瑚喺奶黃卡上對比唔夠（QA 2.6:1）
  panel: CFT.panel,
  cardRadius: 0.1,
  displayFont: 'Arial',
  displayItalic: false,
  pageNoColor: CFT.faint,
  chartColors: ['2B59C3', 'FF5D5D', 'FFC53D', '2EC4B6'],
  chartGridColor: CFT.hair,
  bulletPt: [19, 19, 18, 17, 16],
  titlePt: 30,
  marker: { kind: 'triangle', size: 0.12, color: CFT.accent, indent: 0.32 },
  tileStyle: 'tintCard',
  compareStyle: 'cards',
  stepNode: { kind: 'roundSquareFill', size: 0.34, color: CFT.coral, numColor: 'FFFFFF' },
  quoteMark: { kind: 'circle', size: 0.5, linePt: 2, color: CFT.yellow },
  splitPhoto: 'bleedMotif',

  cover(slide, deck, brand, img) {
    slide.background = { color: 'FFFFFF' }
    if (img) {
      // 右半大方相（直角），四角各遮一細彩斑；credit 喺相下
      const frame: Rect = { x: 7.4, y: 1.5, w: 5.0, h: 4.2 }
      addCoverImage(slide, img, frame)
      slide.addShape('triangle', { x: 7.22, y: 1.32, w: 0.3, h: 0.3, fill: { color: CFT.yellow }, line: { type: 'none' }, rotate: 18 })
      slide.addShape('ellipse', { x: 12.22, y: 1.36, w: 0.26, h: 0.26, fill: { color: CFT.teal }, line: { type: 'none' } })
      confettiPlus(slide, 7.36, 5.66, 0.26, CFT.coral)
      slide.addShape('triangle', { x: 12.2, y: 5.5, w: 0.3, h: 0.3, fill: { color: CFT.accent }, line: { type: 'none' }, rotate: -20 })
      tx(slide, img.credit, { x: 7.4, y: 5.82, w: 5.0, h: 0.24, fontSize: 8, color: CFT.faint, align: 'right' })
    } else {
      // 右半 confetti field：9 件形狀、四色輪流、大細散落
      slide.addShape('triangle', { x: 8.1, y: 1.1, w: 0.4, h: 0.4, fill: { color: CFT.yellow }, line: { type: 'none' }, rotate: 18 })
      slide.addShape('ellipse', { x: 10.2, y: 0.9, w: 0.28, h: 0.28, fill: { color: CFT.teal }, line: { type: 'none' } })
      confettiPlus(slide, 12.05, 1.65, 0.3, CFT.coral)
      confettiPlus(slide, 7.55, 2.0, 0.24, CFT.yellow)
      slide.addShape('ellipse', { x: 9.3, y: 2.6, w: 0.18, h: 0.18, fill: { color: CFT.coral }, line: { type: 'none' } })
      slide.addShape('triangle', { x: 12.0, y: 3.1, w: 0.3, h: 0.3, fill: { color: CFT.accent }, line: { type: 'none' }, rotate: -25 })
      slide.addShape('roundRect', { x: 10.5, y: 4.5, w: 0.5, h: 0.06, rectRadius: 0.03, fill: { color: CFT.teal }, line: { type: 'none' }, rotate: 35 })
      slide.addShape('triangle', { x: 8.6, y: 5.2, w: 0.5, h: 0.5, fill: { color: CFT.coral }, line: { type: 'none' }, rotate: 40 })
      slide.addShape('ellipse', { x: 11.6, y: 5.5, w: 0.34, h: 0.34, fill: { color: CFT.accent }, line: { type: 'none' } })
    }
    tx(slide, 'TEACHING DECK · 教學簡報', { x: 0.9, y: 1.8, w: 6.5, h: 0.32, fontSize: 10, color: CFT.accent, charSpacing: 2, bold: true })
    const fit = fitTitle(deck.title, 'cover')
    const lines = Math.max(1, Math.min(3, estimateLines(deck.title, fit.fontPt, 6.4)))
    tx(slide, deck.title, { x: 0.9, y: 2.3, w: 6.4, h: 2.4, fontSize: fit.fontPt, bold: true, color: CFT.ink, lineSpacingMultiple: 1.08, fit: 'shrink' })
    if (deck.subtitle) {
      const subY = 2.3 + (lines * fit.fontPt * 1.08) / 72 + 0.22
      tx(slide, deck.subtitle, { x: 0.9, y: subY, w: 6.2, h: 0.5, fontSize: 15, color: CFT.soft })
    }
    tx(slide, dateLabel(), { x: 0.9, y: 6.45, w: 5, h: 0.3, fontSize: 10, color: CFT.soft })
    tx(slide, brand, { x: 0.9, y: 6.85, w: 5, h: 0.3, fontSize: 9, color: CFT.faint })
  },

  section(slide, no, title) {
    slide.background = { color: 'FFFFFF' }
    tx(slide, pad2(no), { x: 0.7, y: 1.35, w: 6.5, h: 2.8, fontSize: 140, bold: true, color: mix(CFT.accent, 'FFFFFF', 0.13), fontFace: 'Arial' })
    confettiTrio(slide, 5.6, 1.6)
    tx(slide, title, { x: 0.9, y: 4.7, w: 11.2, h: 1.2, fontSize: 30, bold: true, color: CFT.ink })
    hline(slide, 0.9, 6.6, 11.53, CFT.hair)
  },

  contentFrame(slide, ctx) {
    slide.background = { color: 'FFFFFF' }
    const { body } = scaffold(slide, confetti, ctx, { kickerY: 0.58, titleY: 0.9, hairline: true })
    if (!ctx.hasPhoto) confettiTrio(slide, 11.5, 0.55, ctx.pageNo % 2 === 0)
    drawFooter(slide, confetti, ctx)
    return body
  },
}

// ============================================================
//  粉彩 pastel — 雲朵軟糖
//  白底 + 玫瑰粉主色，腮紅／粉藍／薄荷三色 blob（實心 ellipse）
//  梳化疊出雲朵感；相一律圓裁、卡片圓角最大；初小温柔路線，
//  分隔線用一條圓端粉紅 soft bar 代替髮線。
// ============================================================

// accent 用深一級玫瑰（D4738B）— 細字 eyebrow 喺白底先夠對比；blob 先用淡 blush
const PAS = { ink: '4A4458', soft: '8E8AA0', faint: 'B9B5C6', hair: 'EFEAF2', accent: 'D4738B', deepRose: 'C2566F', panel: 'F9EFF2', blush: 'F9E1E6', sky: 'DCEBF7', mint: 'E2F3EA' }

/** 軟糖 blob：實心 ellipse（預設正圓） */
function blob(slide: PptxGenJS.Slide, x: number, y: number, w: number, color: string, h = w): void {
  slide.addShape('ellipse', { x, y, w, h, fill: { color }, line: { type: 'none' } })
}

const pastel: Pack = {
  id: 'pastel',
  name: '粉彩',
  hint: '粉彩圓潤 · 初小',
  swatches: ['#D4738B', '#DCEBF7', '#F9E1E6'],
  dark: false,
  bg: 'FFFFFF',
  ink: PAS.ink,
  inkSoft: PAS.soft,
  faint: PAS.faint,
  hair: PAS.hair,
  accent: PAS.accent,
  statColor: PAS.deepRose, // 淡粉藍喺 blush 卡上對比 <3:1（QA major）→ 深玫瑰
  panel: PAS.panel,
  panelAlt: PAS.sky, // compare 右欄轉粉藍，A/B 對照即時清晰
  cardRadius: 0.16,
  displayFont: 'Microsoft JhengHei',
  displayItalic: false,
  pageNoColor: PAS.faint,
  chartColors: ['D4738B', '8AAFE0', '9DD3B8', 'C9C4D6'],
  chartGridColor: PAS.hair,
  bulletPt: [19, 19, 18, 17, 16],
  titlePt: 30,
  marker: { kind: 'dot', size: 0.1, color: PAS.accent, indent: 0.3 },
  tileStyle: 'tintCard',
  compareStyle: 'panels',
  stepNode: { kind: 'circleOutline', size: 0.34, color: PAS.accent, numColor: PAS.accent },
  quoteMark: { kind: 'circle', size: 0.5, linePt: 1.5, color: PAS.accent },
  splitPhoto: 'bleedMotif',

  cover(slide, deck, brand, img) {
    slide.background = { color: 'FFFFFF' }
    // 右上三色 blob（有相時做相嘅底層 — 先畫 blob 後畫相）
    blob(slide, 9.2, -1.6, 5.6, PAS.blush)
    blob(slide, 7.9, 1.15, 2.6, PAS.sky)
    blob(slide, 11.3, 4.0, 1.2, PAS.mint)
    if (img) {
      // 圓裁相（rounding = ellipse 裁切，框必須正方先出正圓）
      addCoverImage(slide, img, { x: 8.3, y: 1.35, w: 4.4, h: 4.4 }, true)
      tx(slide, img.credit, { x: 8.3, y: 5.85, w: 4.4, h: 0.24, fontSize: 8, color: PAS.faint, align: 'center' })
    }
    tx(slide, 'TEACHING DECK · 教學簡報', { x: 0.9, y: 2.05, w: 6.5, h: 0.3, fontSize: 10, color: PAS.accent, charSpacing: 2, bold: true })
    // 有相時題收窄（圓相左緣 x8.3，預返 safe margin 唔好頂到）
    const titleW = img ? 6.9 : 7.4
    const fit = fitTitle(deck.title, 'cover')
    const lines = Math.max(1, Math.min(2, estimateLines(deck.title, fit.fontPt, titleW)))
    tx(slide, deck.title, { x: 0.9, y: 2.5, w: titleW, h: 2.0, fontSize: fit.fontPt, bold: true, color: PAS.ink, lineSpacingMultiple: 1.08, fit: 'shrink' })
    if (deck.subtitle) {
      const subY = 2.5 + (lines * fit.fontPt * 1.08) / 72 + 0.22
      tx(slide, deck.subtitle, { x: 0.9, y: subY, w: titleW - 0.2, h: 0.5, fontSize: 15, color: PAS.soft })
    }
    tx(slide, dateLabel(), { x: 0.9, y: 6.45, w: 5, h: 0.3, fontSize: 10, color: PAS.soft })
    tx(slide, brand, { x: 0.9, y: 6.85, w: 5, h: 0.3, fontSize: 9, color: PAS.faint })
  },

  section(slide, no, title) {
    slide.background = { color: PAS.blush }
    // 白色大 ellipse 出血右下做層次
    blob(slide, 7.6, 2.4, 8, 'FFFFFF')
    tx(slide, pad2(no), { x: 0.9, y: 2.0, w: 5, h: 2.4, fontSize: 120, bold: true, color: PAS.accent })
    tx(slide, title, { x: 0.9, y: 4.7, w: 11.2, h: 1.2, fontSize: 30, bold: true, color: PAS.ink })
  },

  contentFrame(slide, ctx) {
    slide.background = { color: 'FFFFFF' }
    // 右上 sky + mint 細 blob（配圖出血時省略）
    if (!ctx.hasPhoto) {
      blob(slide, 12.0, 0.45, 0.5, PAS.sky)
      blob(slide, 11.6, 1.0, 0.26, PAS.mint)
    }
    const { body, contentW } = scaffold(slide, pastel, ctx, { kickerY: 0.58, titleY: 0.9, hairline: false })
    // 圓端粉紅 soft bar 代替髮線（本 pack 嘅圓潤語言）
    slide.addShape('roundRect', { x: 0.9, y: body.y - 0.32, w: contentW, h: 0.06, rectRadius: 0.03, fill: { color: PAS.blush }, line: { type: 'none' } })
    drawFooter(slide, pastel, ctx)
    return body
  },
}

// ───────── 滙出 ─────────

export const GALLERY_PACKS_1: Pack[] = [chalk, press, neon, confetti, pastel]
