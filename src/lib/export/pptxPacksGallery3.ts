// ============================================================
//  pptx template packs — gallery 第三輯（和紙／終端／像素／標本）
//  ------------------------------------------------------------
//  · 和紙 washi    — 侘寂留白：左緣柿色簾邊 + 撕紙錯位面板 + 短冊引文
//  · 終端 terminal — 程式終端：視窗頂欄三點 + ~/path kicker + 指令日誌
//  · 像素 pixel    — 8-bit 街機：零圓角粗墨框 + 像素梯級 + 街機計分牌
//  · 標本 botanic  — 植物標本：雙細線台紙框 + 角位膠紙 + 標本標籤卡
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
import { coverTextureUri } from './slideTextures'

// ============================================================
//  和紙 washi — 侘寂留白
//  暖米和紙底、墨色字、柿色一點：成個 deck 似一疊手揭和紙 —
//  左緣柿色簾邊、撕紙錯位淡面板做角飾，題目沉喺左下大片留白入面。
// ============================================================

const WAS = { bg: 'F7F3EA', ink: '2B2B27', soft: '6E685B', faint: 'A89F8C', hair: 'E2DAC8', accent: 'C8501F', panel: 'FDFBF5' }

/** 撕紙錯位面板：柿色淡影錯位墊底 + 墨色淡面疊上（侘寂手感） */
function tornPair(slide: PptxGenJS.Slide, x: number, y: number, w: number, h: number): void {
  slide.addShape('rect', { x: x + 0.14, y: y + 0.12, w, h, fill: { color: mix(WAS.accent, WAS.bg, 0.12) }, line: { type: 'none' } })
  slide.addShape('rect', { x, y, w, h, fill: { color: mix(WAS.ink, WAS.bg, 0.05) }, line: { type: 'none' } })
}

/**
 * 招牌：quote 渲染成「短冊 tanzaku」——
 * 一條高身窄直幅和紙（柿色冊頭帶 + 紐穴）偏左企喺大片留白入面，
 * 引文直幅內逐行落，冊腳髮線下 attribution 做落款 + 柿印方。
 * 旁邊大片空白就係侘寂設計。
 */
function renderWashiTanzaku(slide: PptxGenJS.Slide, body: Rect, pack: Pack, s: Slide): void {
  const q = s.quote
  if (!q || !q.text.trim()) return
  const sw = 2.7
  const sx = body.x + body.w * 0.3 - sw / 2
  const sy = body.y
  const sh = body.h
  // 撕紙錯位淡影（柿色，右下露邊）
  slide.addShape('rect', { x: sx + 0.12, y: sy + 0.1, w: sw, h: sh, fill: { color: mix(pack.accent, pack.bg, 0.12) }, line: { type: 'none' } })
  // 短冊本體
  slide.addShape('rect', { x: sx, y: sy, w: sw, h: sh, fill: { color: pack.panel }, line: { color: pack.hair, width: 1 } })
  // 冊頭柿色帶 + 紐穴
  slide.addShape('rect', { x: sx, y: sy, w: sw, h: 0.14, fill: { color: pack.accent }, line: { type: 'none' } })
  slide.addShape('ellipse', { x: sx + sw / 2 - 0.045, y: sy + 0.26, w: 0.09, h: 0.09, fill: { type: 'none' }, line: { color: pack.faint, width: 1 } })
  // 引文（窄欄逐行落，書名號夾住）
  tx(slide, `「${clampText(q.text.trim(), 60)}」`, {
    x: sx + 0.3,
    y: sy + 0.5,
    w: sw - 0.6,
    h: sh - 1.55,
    fontSize: 18,
    color: pack.ink,
    lineSpacingMultiple: 1.55,
    valign: 'top',
    fit: 'shrink',
  })
  // 冊腳：髮線 + 落款 + 柿印方
  hline(slide, sx + 0.3, sy + sh - 0.95, sw - 0.6, pack.hair, 0.75)
  if (q.attribution) {
    tx(slide, clampText(q.attribution.trim(), 16), { x: sx + 0.3, y: sy + sh - 0.82, w: sw - 0.6, h: 0.3, fontSize: 11, color: pack.inkSoft, align: 'center' })
  }
  slide.addShape('rect', { x: sx + sw / 2 - 0.08, y: sy + sh - 0.42, w: 0.16, h: 0.16, fill: { color: pack.accent }, line: { type: 'none' } })
  // 右側留白直排微註（配圖版欄窄就免）
  if (body.w > 8) {
    tx(slide, 'TANZAKU · 短冊', {
      x: body.x + body.w - 2.05,
      y: sy + sh / 2 - 0.15,
      w: 3.2,
      h: 0.3,
      rotate: 90,
      align: 'center',
      fontSize: 8,
      color: mix(WAS.faint, WAS.bg, 0.85),
      charSpacing: 4,
    })
  }
}

const washi: Pack = {
  id: 'washi',
  name: '和紙',
  hint: '侘寂留白 · 人文',
  swatches: ['#C8501F', '#F7F3EA', '#2B2B27'],
  dark: false,
  bg: WAS.bg,
  ink: WAS.ink,
  inkSoft: WAS.soft,
  faint: WAS.faint,
  hair: WAS.hair,
  accent: WAS.accent,
  statColor: WAS.accent,
  panel: WAS.panel,
  cardRadius: 0.02,
  displayFont: 'Times New Roman',
  displayItalic: false,
  pageNoColor: WAS.faint,
  chartColors: ['C8501F', '6B675C', 'D9A05B', 'B7AE99'],
  chartGridColor: WAS.hair,
  bulletPt: [18, 18, 17, 17, 16],
  titlePt: 28,
  marker: { kind: 'dash', color: WAS.accent, indent: 0.4 },
  tileStyle: 'hairline',
  compareStyle: 'hairline',
  stepNode: { kind: 'bare', size: 0.34, color: WAS.accent, numColor: WAS.accent },
  quoteMark: { kind: 'square', size: 0.14, color: WAS.accent },
  splitPhoto: 'bleedHair',
  overrides: { quote: renderWashiTanzaku },

  // 逐版母題：一粒極淡柿印小方，角位按 seq % 4 遊走（右上→右下→左下→左上）
  deco(slide, ctx) {
    const spots: [number, number][] = [
      [12.55, 0.62],
      [12.55, 6.92],
      [0.55, 6.92],
      [0.55, 0.62],
    ]
    const [cx, cy] = spots[ctx.seq % 4]
    const sSize = 0.13
    slide.addShape('rect', { x: cx - sSize / 2, y: cy - sSize / 2, w: sSize, h: sSize, fill: { color: mix(WAS.accent, WAS.bg, 0.28) }, line: { type: 'none' } })
  },

  cover(slide, deck, brand, img) {
    slide.background = { color: WAS.bg }
    const hasImg = Boolean(img)
    // 招牌和紙紋理底圖（瀏覽器 Canvas raster；冇 canvas 時 fallback 純色底）
    const tex = coverTextureUri('washi')
    if (tex) slide.addImage({ data: tex, x: 0, y: 0, w: 13.333, h: 7.5, sizing: { type: 'cover', w: 13.333, h: 7.5 } })
    // 左緣柿色簾邊（直條貼死左邊；垂直漸層柿色微深淺）
    slide.addShape('rect', { x: 0, y: 0, w: 0.16, h: 7.5, fill: { color: gradLinear(90, [{ pos: 0, color: mix(WAS.accent, 'FFFFFF', 0.18) }, { pos: 100, color: mix(WAS.accent, WAS.ink, 0.14) }]) }, line: { type: 'none' } })
    if (img) {
      // 右上相框：撕紙錯位淡層墊底，相片 + 髮線框疊上（柿淡影右下露邊）
      tornPair(slide, 7.6, 1.0, 4.9, 3.3)
      const frame: Rect = { x: 7.6, y: 1.0, w: 4.9, h: 3.3 }
      addCoverImage(slide, img, frame)
      slide.addShape('rect', { x: frame.x, y: frame.y, w: frame.w, h: frame.h, fill: { type: 'none' }, line: { color: WAS.hair, width: 0.75 } })
      tx(slide, img.credit, { x: 7.6, y: 4.46, w: 4.9, h: 0.24, fontSize: 8, color: WAS.faint, align: 'right' })
    } else {
      // 右上角撕紙錯位面板（出血落角 — 上半大片留白就係設計）
      tornPair(slide, 10.3, -0.6, 3.6, 2.7)
    }
    // 題目沉喺左下（不對稱留白）
    tx(slide, '教學簡報 · TEACHING DECK', { x: 0.9, y: 3.95, w: 7, h: 0.3, fontSize: 9, color: WAS.accent, charSpacing: 4, bold: true })
    const titleW = hasImg ? 6.4 : 9.6
    const fit = fitTitle(deck.title, 'cover')
    const lines = Math.max(1, Math.min(2, estimateLines(deck.title, fit.fontPt, titleW)))
    tx(slide, deck.title, { x: 0.9, y: 4.4, w: titleW, h: 1.55, fontSize: fit.fontPt, bold: true, color: WAS.ink, lineSpacingMultiple: 1.1, fit: 'shrink' })
    if (deck.subtitle) {
      const subY = 4.4 + (lines * fit.fontPt * 1.1) / 72 + 0.16
      tx(slide, deck.subtitle, { x: 0.9, y: subY, w: titleW, h: 0.42, fontSize: 14, color: WAS.soft })
    }
    // 底部落款：柿印小方 + 日期（左）、brand（右）
    slide.addShape('rect', { x: 0.9, y: 6.82, w: 0.14, h: 0.14, fill: { color: WAS.accent }, line: { type: 'none' } })
    tx(slide, dateLabel(), { x: 1.16, y: 6.74, w: 4, h: 0.3, fontSize: 10, color: WAS.soft, valign: 'middle' })
    tx(slide, brand, { x: 8.5, y: 6.78, w: 4, h: 0.3, fontSize: 9, color: WAS.faint, align: 'right' })
  },

  section(slide, no, title) {
    slide.background = { color: WAS.bg }
    slide.addShape('rect', { x: 0, y: 0, w: 0.16, h: 7.5, fill: { color: WAS.accent }, line: { type: 'none' } })
    // 右上撕紙面板 + Times New Roman 淡柿巨號（靠右）
    tornPair(slide, 10.4, -0.5, 3.5, 2.4)
    tx(slide, pad2(no), { x: 7.0, y: 1.0, w: 5.4, h: 2.6, fontSize: 140, bold: true, color: mix(WAS.accent, WAS.bg, 0.2), align: 'right', fontFace: 'Times New Roman' })
    // 章節題沉喺左下
    tx(slide, `SECTION ${sectionWord(no)}`, { x: 0.9, y: 4.2, w: 6, h: 0.3, fontSize: 9, color: WAS.faint, charSpacing: 5 })
    tx(slide, title, { x: 0.9, y: 4.6, w: 10.5, h: 1.2, fontSize: 32, bold: true, color: WAS.ink })
    // 柿色短刻線（毛筆一捺）
    slide.addShape('rect', { x: 0.9, y: 6.0, w: 1.2, h: 0.05, fill: { color: WAS.accent }, line: { type: 'none' } })
  },

  contentFrame(slide, ctx) {
    slide.background = { color: WAS.bg }
    // 左緣柿色頁籤（呼應封面簾邊，標記 header 高度；貼死左極邊唔撞相）
    slide.addShape('rect', { x: 0, y: 0.55, w: 0.09, h: 1.15, fill: { color: WAS.accent }, line: { type: 'none' } })
    const { body } = scaffold(slide, washi, ctx, { kickerY: 0.58, titleY: 0.9, hairline: false })
    // kicker 前柿印小方（無髮線 — 留白靠呼吸）
    slide.addShape('rect', { x: 0.72, y: 0.61, w: 0.1, h: 0.1, fill: { color: WAS.accent }, line: { type: 'none' } })
    drawFooter(slide, washi, ctx)
    return body
  },
}

// ============================================================
//  終端 terminal — 程式終端
//  近黑底、磷光綠一點：成個 deck 似一隻開咗嘅 terminal 視窗 —
//  頂欄三點、kicker 變 ~/path、steps 變指令 scrollback 日誌。
// ============================================================

const TRM = { bg: '0D1117', ink: 'E6EDF3', soft: '8B949E', faint: '6E7681', hair: '30363D', accent: '3FB950', panel: '161B22' }

/** 視窗三點（紅黃綠 traffic lights） */
function termDots(slide: PptxGenJS.Slide, x: number, y: number): void {
  const cols = ['FF5F56', 'FFBD2E', '27C93F']
  cols.forEach((c, i) => {
    slide.addShape('ellipse', { x: x + i * 0.18, y, w: 0.1, h: 0.1, fill: { color: c }, line: { type: 'none' } })
  })
}

/**
 * 招牌：steps 渲染成「指令日誌 scrollback」——
 * 每步一行 `$ <步題>`（Consolas 磷光綠提示符），下面一行暗階「輸出」做說明，
 * 行右細進度 [i/n]，全部冇連接線 — 就係 terminal 捲動紀錄本身。
 * 末尾一個待命提示符 + 淡塊狀游標。2–5 步。
 */
function renderTerminalLog(slide: PptxGenJS.Slide, body: Rect, pack: Pack, s: Slide): void {
  const items = (s.steps ?? []).slice(0, 5)
  if (items.length < 2) return
  const n = items.length
  const rowH = Math.min(1.2, body.h / (n + 0.5))
  const promptW = 0.34
  items.forEach((st, i) => {
    const ry = body.y + 0.1 + i * rowH
    // $ 提示符（Consolas 磷光綠）
    tx(slide, '$', { x: body.x, y: ry, w: promptW, h: 0.36, fontSize: 16, bold: true, color: pack.accent, fontFace: pack.displayFont })
    // 指令行 = 步題（綠粗體）
    tx(slide, clampText(st.title.trim(), 20), { x: body.x + promptW + 0.06, y: ry, w: body.w - promptW - 1.3, h: 0.36, fontSize: 16, bold: true, color: pack.accent, fit: 'shrink' })
    // 行右進度 [ i/n ]
    tx(slide, `[ ${i + 1}/${n} ]`, { x: body.x + body.w - 1.1, y: ry + 0.04, w: 1.1, h: 0.26, fontSize: 9, color: pack.faint, align: 'right', fontFace: pack.displayFont })
    // 輸出行 = 說明（暗一階、無提示符、齊指令縮排）
    if (st.desc) {
      tx(slide, clampText(st.desc.trim(), 44), {
        x: body.x + promptW + 0.06,
        y: ry + 0.4,
        w: body.w - promptW - 0.4,
        h: Math.max(0.24, rowH - 0.46),
        fontSize: 12,
        color: pack.inkSoft,
        lineSpacingMultiple: 1.2,
        fit: 'shrink',
      })
    }
  })
  // 末行待命提示符 + 淡塊狀游標（位夠先畫）
  const py = body.y + 0.1 + n * rowH
  if (py + 0.32 <= body.y + body.h) {
    tx(slide, '$', { x: body.x, y: py, w: promptW, h: 0.32, fontSize: 16, bold: true, color: mix(pack.accent, pack.bg, 0.55), fontFace: pack.displayFont })
    slide.addShape('rect', { x: body.x + promptW + 0.06, y: py + 0.04, w: 0.13, h: 0.24, fill: { color: mix(pack.accent, pack.bg, 0.45) }, line: { type: 'none' } })
  }
}

const terminal: Pack = {
  id: 'terminal',
  name: '終端',
  hint: '程式碼 · ICT',
  swatches: ['#0D1117', '#3FB950', '#161B22'],
  dark: true,
  bg: TRM.bg,
  ink: TRM.ink,
  inkSoft: TRM.soft,
  faint: TRM.faint,
  hair: TRM.hair,
  accent: TRM.accent,
  statColor: TRM.accent,
  panel: TRM.panel,
  cardRadius: 0.05,
  displayFont: 'Consolas',
  displayItalic: false,
  pageNoColor: TRM.accent,
  chartColors: ['3FB950', '58A6FF', 'D29922', '8B949E'],
  chartGridColor: TRM.hair,
  bulletPt: [17, 17, 17, 16, 16],
  titlePt: 28,
  marker: { kind: 'square', size: 0.09, color: TRM.accent, indent: 0.3 },
  tileStyle: 'panel',
  compareStyle: 'panels',
  stepNode: { kind: 'squareFill', size: 0.32, color: TRM.accent, numColor: TRM.bg },
  quoteMark: { kind: 'square', size: 0.14, color: TRM.accent },
  splitPhoto: 'bleedScrim',
  overrides: { steps: renderTerminalLog },

  // 逐版母題：右下角一個淡 `>` 提示符 + 塊狀游標，游標 x 按 seq 前進（似逐版打緊字）
  deco(slide, ctx) {
    tx(slide, '>', { x: 11.38, y: 6.8, w: 0.2, h: 0.2, fontSize: 9, bold: true, color: mix(TRM.accent, TRM.bg, 0.5), fontFace: 'Consolas' })
    slide.addShape('rect', { x: 11.6 + (ctx.seq % 4) * 0.14, y: 6.84, w: 0.09, h: 0.16, fill: { color: mix(TRM.accent, TRM.bg, 0.4) }, line: { type: 'none' } })
  },

  cover(slide, deck, brand, img) {
    slide.background = { color: TRM.bg }
    const hasImg = Boolean(img)
    // 全闊視窗頂欄 + 三點 + 視窗名（頂欄垂直漸層：頂淡綠暈 → panel）
    slide.addShape('rect', { x: 0, y: 0, w: 13.33, h: 0.5, fill: { color: gradLinear(90, [{ pos: 0, color: mix(TRM.panel, TRM.accent, 0.1) }, { pos: 100, color: TRM.panel }]) }, line: { type: 'none' } })
    termDots(slide, 0.42, 0.2)
    tx(slide, 'eziteach — bash', { x: 4.67, y: 0.13, w: 4, h: 0.26, fontSize: 9, color: TRM.faint, align: 'center', fontFace: 'Consolas' })
    hline(slide, 0, 0.5, 13.33, TRM.hair, 0.75)
    // kicker 註解行
    tx(slide, '# TEACHING DECK · 教學簡報', { x: 0.9, y: 1.25, w: 8, h: 0.3, fontSize: 10, color: TRM.soft, charSpacing: 2, bold: true })
    // 巨號 $ 提示符 + 題目做指令行
    const fit = fitTitle(deck.title, 'cover')
    const pt = Math.min(40, fit.fontPt)
    tx(slide, '$', { x: 0.9, y: 2.35, w: 0.75, h: 1.0, fontSize: pt, bold: true, color: TRM.accent, fontFace: 'Consolas' })
    const titleX = 0.9 + (pt * 0.55) / 72 + 0.22
    const titleW = (hasImg ? 7.3 : 12.4) - titleX
    const lines = Math.max(1, Math.min(2, estimateLines(deck.title, pt, titleW)))
    tx(slide, deck.title, { x: titleX, y: 2.35, w: titleW, h: 1.6, fontSize: pt, bold: true, color: TRM.ink, lineSpacingMultiple: 1.1, fit: 'shrink' })
    // 輸出行：副題（暗一階）
    if (deck.subtitle) {
      const subY = 2.35 + (lines * pt * 1.1) / 72 + 0.2
      tx(slide, deck.subtitle, { x: titleX, y: subY, w: titleW, h: 0.45, fontSize: 14, color: TRM.soft })
    }
    // 待命提示符 + 淡塊狀游標
    tx(slide, '$', { x: 0.9, y: 5.45, w: 0.3, h: 0.34, fontSize: 18, bold: true, color: mix(TRM.accent, TRM.bg, 0.6), fontFace: 'Consolas' })
    slide.addShape('rect', { x: 1.28, y: 5.5, w: 0.16, h: 0.28, fill: { color: mix(TRM.accent, TRM.bg, 0.45) }, line: { type: 'none' } })
    // 註解行：日期 + brand
    tx(slide, `# ${dateLabel()}`, { x: 0.9, y: 6.45, w: 6, h: 0.3, fontSize: 10, color: TRM.faint })
    tx(slide, `# ${brand}`, { x: 0.9, y: 6.85, w: 6, h: 0.3, fontSize: 9, color: TRM.faint })
    if (img) {
      // 右側子視窗：面板框 + 頂欄三點，相片做視窗內容
      const frame: Rect = { x: 7.7, y: 1.95, w: 4.8, h: 3.4 }
      slide.addShape('rect', { x: frame.x - 0.06, y: frame.y - 0.44, w: frame.w + 0.12, h: frame.h + 0.5, fill: { color: TRM.panel }, line: { color: TRM.hair, width: 1 } })
      termDots(slide, frame.x + 0.12, frame.y - 0.31)
      addCoverImage(slide, img, frame)
      photoCreditOnImage(slide, img.credit, frame)
    }
  },

  section(slide, no, title) {
    slide.background = { color: TRM.bg }
    slide.addShape('rect', { x: 0, y: 0, w: 13.33, h: 0.5, fill: { color: TRM.panel }, line: { type: 'none' } })
    termDots(slide, 0.42, 0.2)
    hline(slide, 0, 0.5, 13.33, TRM.hair, 0.75)
    // cd 指令行 + 巨號 Consolas 淡綠 ghost
    tx(slide, `$ cd ~/lesson/${sectionWord(no).toLowerCase()}`, { x: 0.9, y: 1.15, w: 9, h: 0.34, fontSize: 13, bold: true, color: TRM.accent, fontFace: 'Consolas' })
    tx(slide, pad2(no), { x: 0.82, y: 1.55, w: 6.5, h: 2.9, fontSize: 150, bold: true, color: mix(TRM.accent, TRM.bg, 0.3), fontFace: 'Consolas' })
    tx(slide, title, { x: 0.9, y: 4.7, w: 11.4, h: 1.1, fontSize: 32, bold: true, color: TRM.ink })
    tx(slide, `# SECTION ${sectionWord(no)}`, { x: 0.9, y: 5.95, w: 6, h: 0.3, fontSize: 10, color: TRM.faint, charSpacing: 2, fontFace: 'Consolas' })
    // 待命塊狀游標
    slide.addShape('rect', { x: 0.92, y: 6.5, w: 0.16, h: 0.28, fill: { color: mix(TRM.accent, TRM.bg, 0.5) }, line: { type: 'none' } })
  },

  contentFrame(slide, ctx) {
    slide.background = { color: TRM.bg }
    // 仿終端視窗：薄頂欄 + 三點 + 中央視窗名（配圖出血版視窗名省略）
    slide.addShape('rect', { x: 0, y: 0, w: 13.33, h: 0.42, fill: { color: TRM.panel }, line: { type: 'none' } })
    termDots(slide, 0.36, 0.16)
    if (!ctx.hasPhoto) tx(slide, 'bash', { x: 5.67, y: 0.09, w: 2, h: 0.24, fontSize: 8, color: TRM.faint, align: 'center', fontFace: 'Consolas' })
    hline(slide, 0, 0.42, 13.33, TRM.hair, 0.75)
    // kicker 變路徑 ~/lesson/<kicker>
    const { body } = scaffold(slide, terminal, { ...ctx, kicker: `~/lesson/${ctx.kicker}` }, { kickerY: 0.58, titleY: 0.9, hairline: true })
    drawFooter(slide, terminal, ctx)
    return body
  },
}

// ============================================================
//  像素 pixel — 8-bit 街機
//  淺灰底、深藏青墨、街機桃紅 + 天藍二色：零圓角、粗墨框、
//  chunky 方塊梯級做 motif，stats 變 HI-SCORE 計分牌。
// ============================================================

const PIX = { bg: 'F4F4F6', ink: '1A1C2C', soft: '5B5E70', faint: '9A9DAC', hair: 'DCDEE6', accent: 'FF004D', cyan: '29ADFF', coin: 'FFA300', panel: 'FFFFFF' }

/** 像素梯級：chunky 方塊逐格上樓梯（由 (x,y) 起向右上） */
function pixelStair(slide: PptxGenJS.Slide, x: number, y: number, cell: number, n: number, hues: string[] = [PIX.accent, PIX.ink, PIX.cyan]): void {
  for (let k = 0; k < n; k++) {
    slide.addShape('rect', { x: x + k * cell, y: y - (k + 1) * cell, w: cell, h: cell, fill: { color: hues[k % hues.length] }, line: { type: 'none' } })
  }
}

/** 像素底線：一排交替色小方塊（blocky 分隔 rule） */
function pixelRule(slide: PptxGenJS.Slide, x: number, y: number, n: number): void {
  const hues = [PIX.accent, PIX.cyan, PIX.ink]
  for (let k = 0; k < n; k++) {
    slide.addShape('rect', { x: x + k * 0.2, y, w: 0.14, h: 0.14, fill: { color: hues[k % 3] }, line: { type: 'none' } })
  }
}

/** 像素方塊群：2×2 缺一（sprite 角章），副格逐級淡階 */
function pixelCluster(slide: PptxGenJS.Slide, x: number, y: number, cell: number, color: string): void {
  const g = 0.03
  slide.addShape('rect', { x, y, w: cell, h: cell, fill: { color }, line: { type: 'none' } })
  slide.addShape('rect', { x: x + cell + g, y, w: cell, h: cell, fill: { color: mix(color, 'FFFFFF', 0.55) }, line: { type: 'none' } })
  slide.addShape('rect', { x, y: y + cell + g, w: cell, h: cell, fill: { color: mix(color, 'FFFFFF', 0.35) }, line: { type: 'none' } })
}

/**
 * 招牌：stats 渲染成「街機計分牌」——
 * 每個 stat 一塊零圓角白 tile：粗墨框 + 硬影（blur 0 似 8-bit 投影），
 * 頂部 HI-SCORE 式 caption（桃紅／天藍輪替）、角落像素方塊群、
 * Arial 粗體巨號數值、底部髮線上 label。2–4 項。
 */
function renderPixelScoreboard(slide: PptxGenJS.Slide, body: Rect, pack: Pack, s: Slide): void {
  const items = (s.stats ?? []).slice(0, 4)
  if (items.length < 2) return
  const n = items.length
  const gap = 0.45
  const cw = (body.w - gap * (n - 1)) / n
  const th = Math.min(2.9, body.h - 0.3)
  const ty = body.y + (body.h - th) / 2
  items.forEach((st, i) => {
    const cx = body.x + i * (cw + gap)
    const hue = i % 2 === 0 ? pack.accent : PIX.cyan
    // 零圓角計分 tile：白底 + 粗墨框 + 硬影
    slide.addShape('rect', {
      x: cx,
      y: ty,
      w: cw,
      h: th,
      fill: { color: pack.panel },
      line: { color: pack.ink, width: 2.5 },
      shadow: { type: 'outer', color: pack.ink, opacity: 0.3, blur: 0, offset: 4, angle: 45 },
    })
    // 頂部計分 caption
    tx(slide, i === 0 ? 'HI-SCORE' : `SCORE ${pad2(i + 1)}`, { x: cx + 0.2, y: ty + 0.18, w: cw - 0.8, h: 0.26, fontSize: 10, bold: true, color: hue, charSpacing: 2, fontFace: pack.displayFont, fit: 'shrink' })
    // 角落像素方塊群
    pixelCluster(slide, cx + cw - 0.5, ty + 0.18, 0.09, hue)
    // 巨號數值（Arial 粗體 — 街機讀分）
    tx(slide, clampText(st.value.trim(), 8), {
      x: cx + 0.15,
      y: ty + 0.5,
      w: cw - 0.3,
      h: th - 1.3,
      fontSize: 50,
      bold: true,
      color: pack.ink,
      align: 'center',
      valign: 'middle',
      fontFace: pack.displayFont,
      fit: 'shrink',
    })
    // 底部髮線 + label
    hline(slide, cx + 0.2, ty + th - 0.68, cw - 0.4, pack.hair, 1)
    tx(slide, clampText(st.label.trim(), 22), { x: cx + 0.2, y: ty + th - 0.56, w: cw - 0.4, h: 0.44, fontSize: 12, color: pack.inkSoft, align: 'center', fit: 'shrink' })
  })
}

const pixel: Pack = {
  id: 'pixel',
  name: '像素',
  hint: '8-bit 遊戲 · 趣味',
  swatches: ['#FF004D', '#29ADFF', '#1A1C2C'],
  dark: false,
  bg: PIX.bg,
  ink: PIX.ink,
  inkSoft: PIX.soft,
  faint: PIX.faint,
  hair: PIX.hair,
  accent: PIX.accent,
  statColor: 'D6003F', // 深一階桃紅 — F4F4F6 上保大字對比
  panel: PIX.panel,
  cardRadius: 0,
  displayFont: 'Arial',
  displayItalic: false,
  pageNoColor: PIX.soft,
  chartColors: ['FF004D', '29ADFF', '1A1C2C', 'FFA300'],
  chartGridColor: PIX.hair,
  bulletPt: [17, 17, 17, 16, 16],
  titlePt: 28,
  marker: { kind: 'square', size: 0.12, color: PIX.accent, indent: 0.34 },
  tileStyle: 'cellBorder',
  compareStyle: 'abGrid',
  stepNode: { kind: 'squareFill', size: 0.34, color: PIX.accent, numColor: 'FFFFFF' },
  quoteMark: { kind: 'square', size: 0.16, color: PIX.accent },
  splitPhoto: 'bleedHair',
  overrides: { stats: renderPixelScoreboard },

  // 逐版母題：右下角一排像素金幣（小方塊），粒數 = (seq % 4) + 1，逐版儲多粒
  deco(slide, ctx) {
    const nCoins = (ctx.seq % 4) + 1
    for (let k = 0; k < nCoins; k++) {
      slide.addShape('rect', { x: 12.4 - (k + 1) * 0.16, y: 6.88, w: 0.1, h: 0.1, fill: { color: mix(PIX.coin, PIX.bg, 0.5) }, line: { type: 'none' } })
    }
  },

  cover(slide, deck, brand, img) {
    slide.background = { color: PIX.bg }
    const hasImg = Boolean(img)
    // 頂部雙色像素方塊 + kicker（各自垂直漸層微亮→微深，保 8-bit 硬塊感）
    slide.addShape('rect', { x: 0.9, y: 0.92, w: 0.16, h: 0.16, fill: { color: gradLinear(90, [{ pos: 0, color: mix(PIX.accent, 'FFFFFF', 0.18) }, { pos: 100, color: mix(PIX.accent, PIX.ink, 0.14) }]) }, line: { type: 'none' } })
    slide.addShape('rect', { x: 1.1, y: 0.92, w: 0.16, h: 0.16, fill: { color: gradLinear(90, [{ pos: 0, color: mix(PIX.cyan, 'FFFFFF', 0.18) }, { pos: 100, color: mix(PIX.cyan, PIX.ink, 0.14) }]) }, line: { type: 'none' } })
    tx(slide, 'TEACHING DECK · 教學簡報', { x: 1.4, y: 0.88, w: 7, h: 0.3, fontSize: 10, bold: true, color: PIX.ink, charSpacing: 3 })
    // blocky 題目 + 像素底線
    const titleW = hasImg ? 6.3 : 10.6
    const fit = fitTitle(deck.title, 'cover')
    const lines = Math.max(1, Math.min(2, estimateLines(deck.title, fit.fontPt, titleW)))
    tx(slide, deck.title, { x: 0.9, y: 2.2, w: titleW, h: 1.6, fontSize: fit.fontPt, bold: true, color: PIX.ink, lineSpacingMultiple: 1.1, fit: 'shrink' })
    const ruleY = 2.2 + (lines * fit.fontPt * 1.1) / 72 + 0.18
    pixelRule(slide, 0.92, ruleY, 8)
    if (deck.subtitle) {
      tx(slide, deck.subtitle, { x: 0.9, y: ruleY + 0.3, w: titleW, h: 0.45, fontSize: 14, color: PIX.soft })
    }
    // 左下 PRESS START + 日期 + brand
    tx(slide, 'PRESS START', { x: 0.9, y: 6.1, w: 4, h: 0.26, fontSize: 9, bold: true, color: PIX.accent, charSpacing: 5, fontFace: 'Arial' })
    tx(slide, dateLabel(), { x: 0.9, y: 6.42, w: 4, h: 0.3, fontSize: 10, color: PIX.soft })
    tx(slide, brand, { x: 0.9, y: 6.95, w: 5, h: 0.3, fontSize: 9, color: PIX.faint })
    if (img) {
      // 右側相框：粗墨框（零圓角）+ 左上角 sprite 像素章
      const frame: Rect = { x: 7.7, y: 1.3, w: 4.8, h: 3.4 }
      slide.addShape('rect', { x: frame.x - 0.07, y: frame.y - 0.07, w: frame.w + 0.14, h: frame.h + 0.14, fill: { type: 'none' }, line: { color: PIX.ink, width: 3 } })
      addCoverImage(slide, img, frame)
      photoCreditOnImage(slide, img.credit, frame)
      slide.addShape('rect', { x: frame.x - 0.18, y: frame.y - 0.18, w: 0.2, h: 0.2, fill: { color: PIX.accent }, line: { type: 'none' } })
      // 細梯級讓位俾相
      pixelStair(slide, 10.6, 6.85, 0.36, 4)
    } else {
      // 右下 chunky 像素梯級（無相時做主 motif）
      pixelStair(slide, 9.7, 6.7, 0.46, 6)
    }
  },

  section(slide, no, title) {
    // LEVEL 過場畫面：成版反白深藏青（街機 level screen）
    slide.background = { color: PIX.ink }
    tx(slide, `LEVEL ${pad2(no)}`, { x: 0.9, y: 1.7, w: 6, h: 0.34, fontSize: 11, bold: true, color: PIX.cyan, charSpacing: 6, fontFace: 'Arial' })
    tx(slide, pad2(no), { x: 0.82, y: 2.0, w: 6, h: 2.6, fontSize: 140, bold: true, color: PIX.accent, fontFace: 'Arial' })
    tx(slide, title, { x: 0.9, y: 4.85, w: 9.2, h: 1.1, fontSize: 32, bold: true, color: PIX.bg })
    tx(slide, `SECTION ${sectionWord(no)}`, { x: 0.9, y: 6.05, w: 6, h: 0.3, fontSize: 9, color: mix('FFFFFF', PIX.ink, 0.45), charSpacing: 4 })
    // 右下像素梯級（深底配白格先夠跳）
    pixelStair(slide, 10.3, 7.1, 0.4, 5, [PIX.accent, PIX.cyan, 'FFFFFF'])
  },

  contentFrame(slide, ctx) {
    slide.background = { color: PIX.bg }
    // kicker 前 chunky 像素方塊
    slide.addShape('rect', { x: 0.66, y: 0.61, w: 0.13, h: 0.13, fill: { color: PIX.accent }, line: { type: 'none' } })
    const { body } = scaffold(slide, pixel, ctx, { kickerY: 0.58, titleY: 0.9, hairline: true })
    // 右上三連像素（配圖出血版省略）
    if (!ctx.hasPhoto) {
      const hues = [PIX.accent, PIX.cyan, PIX.ink]
      hues.forEach((c, k) => {
        slide.addShape('rect', { x: 11.92 + k * 0.18, y: 0.62, w: 0.12, h: 0.12, fill: { color: c }, line: { type: 'none' } })
      })
    }
    drawFooter(slide, pixel, ctx)
    return body
  },
}

// ============================================================
//  標本 botanic — 植物標本
//  米白台紙、深植物綠墨、苔蘚綠一點、淡 tan 膠紙：成個 deck 似
//  一本 herbarium 標本冊 — 雙細線台紙框、四角膠紙、標本標籤塊。
// ============================================================

const BOT = { bg: 'FBF8F1', ink: '23402B', soft: '5E6E58', faint: 'A89E83', hair: 'E2DAC4', accent: '6B8F3C', deep: '5C7A33', tape: 'DCCFAC', panel: 'F2EDDC' }

/** 雙細線標本台紙框（外 1pt + 內 0.5pt） */
function botFrame(slide: PptxGenJS.Slide, x: number, y: number, w: number, h: number, color: string): void {
  slide.addShape('rect', { x, y, w, h, fill: { type: 'none' }, line: { color, width: 1 } })
  slide.addShape('rect', { x: x + 0.07, y: y + 0.07, w: w - 0.14, h: h - 0.14, fill: { type: 'none' }, line: { color, width: 0.5 } })
}

/** 角位淡 tan 膠紙（cx/cy = 膠紙中心，rotate = 斜貼角度） */
function botTape(slide: PptxGenJS.Slide, cx: number, cy: number, rotate: number): void {
  slide.addShape('rect', { x: cx - 0.4, y: cy - 0.11, w: 0.8, h: 0.22, fill: { color: BOT.tape }, line: { type: 'none' }, rotate })
}

/** 苔蘚葉點對：短斜莖線 + 兩小葉橢圓（角落母題） */
function botSprig(slide: PptxGenJS.Slide, x: number, y: number, color: string): void {
  slide.addShape('line', { x, y, w: 0.18, h: 0.26, line: { color, width: 1 } })
  slide.addShape('ellipse', { x: x - 0.07, y: y - 0.05, w: 0.13, h: 0.09, fill: { color }, line: { type: 'none' } })
  slide.addShape('ellipse', { x: x + 0.08, y: y + 0.08, w: 0.13, h: 0.09, fill: { color }, line: { type: 'none' } })
}

/**
 * 招牌：cards 渲染成「標本標籤」——
 * 每卡一張白底標籤：雙細線框、頂沿一條微斜淡 tan 膠紙（似貼喺台紙上）、
 * 右上 Georgia 斜體拉丁式索引 No.{i+1}、標題髮線下接說明。2–6 卡。
 */
function renderBotanicSpecimens(slide: PptxGenJS.Slide, body: Rect, pack: Pack, s: Slide): void {
  const items = (s.cards ?? []).slice(0, 6)
  if (items.length < 2) return
  const n = items.length
  const cols = n <= 2 ? n : n <= 4 ? 2 : 3
  const rows = Math.ceil(n / cols)
  const gap = 0.34
  const topPad = 0.14 // 預留膠紙凸出位
  const cw = (body.w - gap * (cols - 1)) / cols
  const chRaw = (body.h - topPad - gap * (rows - 1)) / rows
  const ch = Math.min(3.0, chRaw)
  items.forEach((card, i) => {
    const r = Math.floor(i / cols)
    const c = i % cols
    const cx = body.x + c * (cw + gap)
    const cy = body.y + topPad + r * (chRaw + gap) + (chRaw - ch) / 2
    // 標籤：白底 + 雙細線框
    slide.addShape('rect', { x: cx, y: cy, w: cw, h: ch, fill: { color: 'FFFFFF' }, line: { color: mix(pack.ink, pack.bg, 0.5), width: 0.75 } })
    slide.addShape('rect', { x: cx + 0.06, y: cy + 0.06, w: cw - 0.12, h: ch - 0.12, fill: { type: 'none' }, line: { color: pack.hair, width: 0.5 } })
    // 頂沿淡 tan 膠紙（微斜交替）
    botTape(slide, cx + cw / 2, cy + 0.01, i % 2 === 0 ? -3 : 2)
    // 拉丁式索引 No.
    tx(slide, `No.${i + 1}`, { x: cx + cw - 1.0, y: cy + 0.18, w: 0.8, h: 0.26, fontSize: 11, italic: true, color: pack.statColor, align: 'right', fontFace: pack.displayFont })
    // 標題 + 髮線 + 說明
    tx(slide, clampText(card.title.trim(), 14), { x: cx + 0.22, y: cy + 0.18, w: cw - 1.24, h: 0.4, fontSize: 15, bold: true, color: pack.ink, fit: 'shrink' })
    hline(slide, cx + 0.22, cy + 0.62, cw - 0.44, pack.hair, 0.75)
    if (card.desc) {
      tx(slide, clampText(card.desc.trim(), 80), {
        x: cx + 0.22,
        y: cy + 0.74,
        w: cw - 0.44,
        h: ch - 0.92,
        fontSize: 11,
        color: pack.inkSoft,
        lineSpacingMultiple: 1.22,
        fit: 'shrink',
      })
    }
  })
}

const botanic: Pack = {
  id: 'botanic',
  name: '標本',
  hint: '田野筆記 · 生物地理',
  swatches: ['#6B8F3C', '#FBF8F1', '#23402B'],
  dark: false,
  bg: BOT.bg,
  ink: BOT.ink,
  inkSoft: BOT.soft,
  faint: BOT.faint,
  hair: BOT.hair,
  accent: BOT.accent,
  statColor: BOT.deep, // 深一階苔蘚 — 米白底上保數值對比
  panel: BOT.panel,
  cardRadius: 0.02,
  displayFont: 'Georgia',
  displayItalic: true,
  pageNoColor: BOT.faint,
  chartColors: ['6B8F3C', '23402B', 'C2A36B', '94A87E'],
  chartGridColor: BOT.hair,
  bulletPt: [18, 18, 17, 17, 16],
  titlePt: 28,
  marker: { kind: 'circle', size: 0.1, linePt: 1.25, color: BOT.accent, indent: 0.32 },
  tileStyle: 'tintCard',
  compareStyle: 'cards',
  stepNode: { kind: 'circleOutline', size: 0.34, color: BOT.accent, numColor: BOT.ink },
  quoteMark: { kind: 'glyph', color: BOT.accent },
  splitPhoto: 'bleedHair',
  overrides: { cards: renderBotanicSpecimens },

  // 逐版母題：一對苔蘚葉點（短莖 + 兩小葉），角位按 seq % 2 左右交替，極淡
  deco(slide, ctx) {
    const right = ctx.seq % 2 === 0
    botSprig(slide, right ? 12.52 : 0.42, 6.85, mix(BOT.accent, BOT.bg, 0.4))
  },

  cover(slide, deck, brand, img) {
    slide.background = { color: BOT.bg }
    // 標本台紙：雙細線框 + 四角膠紙
    botFrame(slide, 0.42, 0.42, 12.49, 6.66, mix(BOT.ink, BOT.bg, 0.5))
    botTape(slide, 0.42, 0.42, -45)
    botTape(slide, 12.91, 0.42, 45)
    botTape(slide, 0.42, 7.08, 45)
    botTape(slide, 12.91, 7.08, -45)
    if (img) {
      // 標本相：髮線框 + 相頂兩條膠紙貼住
      const frame: Rect = { x: 7.35, y: 1.05, w: 4.85, h: 3.5 }
      addCoverImage(slide, img, frame)
      slide.addShape('rect', { x: frame.x, y: frame.y, w: frame.w, h: frame.h, fill: { type: 'none' }, line: { color: BOT.hair, width: 1 } })
      botTape(slide, frame.x + 0.5, frame.y + 0.02, -6)
      botTape(slide, frame.x + frame.w - 0.5, frame.y + 0.02, 5)
      tx(slide, img.credit, { x: frame.x, y: frame.y + frame.h + 0.08, w: frame.w, h: 0.24, fontSize: 8, color: BOT.faint, align: 'right' })
    } else {
      // 壓花植物 motif（右上）：直莖 + 交錯葉橢圓 + 頂膠紙
      const px = 9.9
      vline(slide, px, 1.3, 2.9, BOT.accent, 1.5)
      const leaves: [number, number, number, number][] = [
        [9.12, 1.62, -28, 0.62],
        [10.06, 2.1, 24, 0.7],
        [9.05, 2.62, -20, 0.74],
        [10.04, 3.18, 16, 0.6],
      ]
      for (const [lx, ly, rot, lw] of leaves) {
        slide.addShape('ellipse', { x: lx, y: ly, w: lw, h: 0.3, fill: { color: mix(BOT.accent, BOT.bg, 0.55) }, line: { color: BOT.accent, width: 0.75 }, rotate: rot })
      }
      botTape(slide, px, 1.32, -4)
    }
    // 標本標籤塊（左下）：白底雙細線 + 編目欄位（極淡台紙漸層：純白 → 米白底微沉）
    const lb: Rect = { x: 0.9, y: 4.25, w: 6.9, h: 2.55 }
    slide.addShape('rect', { x: lb.x, y: lb.y, w: lb.w, h: lb.h, fill: { color: gradLinear(90, [{ pos: 0, color: mix('FFFFFF', BOT.bg, 0.04) }, { pos: 100, color: mix(BOT.bg, BOT.ink, 0.06) }]) }, line: { color: mix(BOT.ink, BOT.bg, 0.5), width: 1 } })
    slide.addShape('rect', { x: lb.x + 0.06, y: lb.y + 0.06, w: lb.w - 0.12, h: lb.h - 0.12, fill: { type: 'none' }, line: { color: BOT.hair, width: 0.5 } })
    tx(slide, 'HERBARIUM · 教學簡報', { x: lb.x + 0.3, y: lb.y + 0.22, w: 4.5, h: 0.28, fontSize: 9, bold: true, color: BOT.accent, charSpacing: 3 })
    tx(slide, 'No.001', { x: lb.x + lb.w - 1.5, y: lb.y + 0.22, w: 1.2, h: 0.28, fontSize: 11, italic: true, color: BOT.deep, align: 'right', fontFace: 'Georgia' })
    hline(slide, lb.x + 0.3, lb.y + 0.58, lb.w - 0.6, BOT.hair, 0.75)
    const fit = fitTitle(deck.title, 'cover')
    const pt = Math.min(30, fit.fontPt)
    const lines = Math.max(1, Math.min(2, estimateLines(deck.title, pt, lb.w - 0.6)))
    tx(slide, deck.title, { x: lb.x + 0.3, y: lb.y + 0.74, w: lb.w - 0.6, h: 1.0, fontSize: pt, bold: true, color: BOT.ink, lineSpacingMultiple: 1.1, fit: 'shrink' })
    if (deck.subtitle) {
      const subY = lb.y + 0.74 + (lines * pt * 1.1) / 72 + 0.08
      tx(slide, deck.subtitle, { x: lb.x + 0.3, y: subY, w: lb.w - 0.6, h: 0.32, fontSize: 13, color: BOT.soft })
    }
    // 採集行：Col.（採集人 = brand）+ 日期
    tx(slide, `Col. ${brand}`, { x: lb.x + 0.3, y: lb.y + lb.h - 0.4, w: 3.4, h: 0.3, fontSize: 10, color: BOT.soft })
    tx(slide, dateLabel(), { x: lb.x + lb.w - 3.0, y: lb.y + lb.h - 0.4, w: 2.7, h: 0.3, fontSize: 10, color: BOT.soft, align: 'right' })
  },

  section(slide, no, title) {
    slide.background = { color: BOT.bg }
    botFrame(slide, 0.42, 0.42, 12.49, 6.66, mix(BOT.ink, BOT.bg, 0.5))
    // 兩角膠紙（不對稱先似手貼）
    botTape(slide, 0.42, 0.42, -45)
    botTape(slide, 12.91, 7.08, -45)
    // Georgia 斜體淡苔蘚巨號 — 圖版編號感
    tx(slide, pad2(no), { x: 0.95, y: 1.15, w: 6, h: 2.6, fontSize: 130, bold: true, italic: true, color: mix(BOT.accent, BOT.bg, 0.25), fontFace: 'Georgia' })
    tx(slide, `PLATE ${sectionWord(no)} · 圖版`, { x: 0.95, y: 4.25, w: 7, h: 0.3, fontSize: 10, bold: true, color: BOT.accent, charSpacing: 4 })
    tx(slide, title, { x: 0.95, y: 4.65, w: 10.8, h: 1.1, fontSize: 30, bold: true, color: BOT.ink })
    // 右下壓花小枝
    vline(slide, 11.5, 5.0, 1.3, BOT.accent, 1.25)
    slide.addShape('ellipse', { x: 11.0, y: 5.2, w: 0.5, h: 0.24, fill: { color: mix(BOT.accent, BOT.bg, 0.5) }, line: { color: BOT.accent, width: 0.75 }, rotate: -24 })
    slide.addShape('ellipse', { x: 11.6, y: 5.7, w: 0.5, h: 0.24, fill: { color: mix(BOT.accent, BOT.bg, 0.5) }, line: { color: BOT.accent, width: 0.75 }, rotate: 20 })
  },

  contentFrame(slide, ctx) {
    slide.background = { color: BOT.bg }
    const { body } = scaffold(slide, botanic, ctx, { kickerY: 0.58, titleY: 0.9, hairline: true })
    // 右上微斜小膠紙（配圖出血版省略）
    if (!ctx.hasPhoto) botTape(slide, 12.06, 0.66, -7)
    drawFooter(slide, botanic, ctx)
    return body
  },
}

// ───────── 滙出 ─────────

export const GALLERY_PACKS_3: Pack[] = [washi, terminal, pixel, botanic]
