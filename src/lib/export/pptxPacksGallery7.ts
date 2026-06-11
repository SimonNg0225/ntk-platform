// ============================================================
//  pptx template packs — gallery 第七輯（手帳拼貼／水墨／粗獷主義）
//  ------------------------------------------------------------
//  · 手帳 scrapbook — 拼貼手帳：牛皮卡紙底 + washi 紙膠帶 + 紙片貼卡 + 塗鴉箭
//  · 水墨 sumi      — 水墨留白：宣紙底 + 層疊灰塊偽水墨筆 + 飛白分隔 + 朱砂印
//  · 粗獷 brutalist — Brutalist：硬黑粗框 + 零圓角 + 超大字 + 巨頁碼 + mono 標籤
//  鐵律同 pptxPacks.ts：所有文字經 tx()；色 6 位 hex 無 #；
//  shadow 只准 outer；無 gradient／SVG；rectRadius 單位吋；
//  形狀只用 rect／roundRect／ellipse／line／chevron／triangle —— motif 由六款基本形砌。
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
//  手帳 scrapbook — 拼貼手帳
//  暖牛皮卡紙底 + 炭墨：成個 deck 似一本貼滿嘢嘅手帳 ——
//  washi 紙膠帶（薄薄旋轉 rect，mix tint 做半透感）貼住嘢、
//  白紙片（roundRect + 柔外陰影 + 微旋）做卡、塗鴉箭（line + chevron 頭）指方向。
// ============================================================

const SCR = { bg: 'EFE7D6', ink: '3A352C', soft: '6E6557', faint: 'A39A88', hair: 'DCD2BF', accent: '5BB0A6', coral: 'EF7D6A', panel: 'FFFFFF' }
/** 紙片圓角（同 pack.cardRadius；cover/section 唔收 pack 形參，提早定義） */
const SCR_RADIUS = 0.06

/** washi 紙膠帶：一條薄旋轉 rect（mix tint 做半透感 + 兩端深少少做撕口暗示） */
function washiTape(slide: PptxGenJS.Slide, x: number, y: number, w: number, h: number, color: string, rotate: number): void {
  slide.addShape('rect', { x, y, w, h, fill: { color: mix(color, SCR.bg, 0.62) }, line: { type: 'none' }, rotate })
  slide.addShape('rect', { x, y, w: w * 0.14, h, fill: { color: mix(color, SCR.bg, 0.78) }, line: { type: 'none' }, rotate })
  slide.addShape('rect', { x: x + w * 0.86, y, w: w * 0.14, h, fill: { color: mix(color, SCR.bg, 0.78) }, line: { type: 'none' }, rotate })
}

/** 白紙片：白 roundRect + 柔外陰影 + 微旋（手帳貼上去嘅紙仔） */
function paperScrap(slide: PptxGenJS.Slide, r: Rect, rotate: number, radius: number): void {
  slide.addShape('roundRect', {
    x: r.x,
    y: r.y,
    w: r.w,
    h: r.h,
    rectRadius: radius,
    rotate,
    fill: { color: SCR.panel },
    line: { color: SCR.hair, width: 0.75 },
    shadow: { type: 'outer', color: '3A352C', opacity: 0.22, blur: 5, offset: 3, angle: 90 },
  })
}

/** 塗鴉箭：一條短 line + 一個細 chevron 頭（指向右下手感記號） */
function doodleArrow(slide: PptxGenJS.Slide, x: number, y: number, len: number, color: string): void {
  slide.addShape('line', { x, y, w: len, h: len * 0.34, line: { color, width: 1.75 } })
  slide.addShape('chevron', { x: x + len - 0.06, y: y + len * 0.34 - 0.08, w: 0.16, h: 0.16, fill: { color }, line: { type: 'none' }, rotate: 38 })
}

/** 塗鴉小星：兩條交叉短線扮一粒手畫星 */
function doodleStar(slide: PptxGenJS.Slide, cx: number, cy: number, r: number, color: string): void {
  slide.addShape('line', { x: cx - r, y: cy, w: r * 2, h: 0, line: { color, width: 1.5 } })
  slide.addShape('line', { x: cx, y: cy - r, w: 0, h: r * 2, line: { color, width: 1.5 } })
  slide.addShape('line', { x: cx - r * 0.72, y: cy - r * 0.72, w: r * 1.44, h: r * 1.44, line: { color, width: 1.25 } })
  slide.addShape('line', { x: cx - r * 0.72, y: cy + r * 0.72, w: r * 1.44, h: -r * 1.44, line: { color, width: 1.25 } })
}

/**
 * 招牌：cards 渲染成「貼紙片卡」——
 * 每卡係一張白紙片（微旋 ±2–3°、柔外陰影），頂角斜貼一條 washi 紙膠帶
 * （teal／coral 輪換），紙片內粗標題 + 正文。手帳拼貼感。2–6 卡。
 */
function renderScrapbookTapedCards(slide: PptxGenJS.Slide, body: Rect, pack: Pack, s: Slide): void {
  const items = (s.cards ?? []).slice(0, 6)
  if (items.length < 2) return
  const n = items.length
  const cols = n <= 2 ? n : n <= 4 ? 2 : 3
  const rows = Math.ceil(n / cols)
  const gap = 0.42
  const cw = (body.w - gap * (cols - 1)) / cols
  const ch = (body.h - gap * (rows - 1)) / rows
  const tints = [pack.accent, pack.statColor]
  items.forEach((card, i) => {
    const r = Math.floor(i / cols)
    const c = i % cols
    const cx = body.x + c * (cw + gap)
    const cy = body.y + r * (ch + gap)
    // 紙片本身收身少少俾陰影／旋轉位
    const pad = 0.12
    const scrap: Rect = { x: cx + pad, y: cy + pad, w: cw - pad * 2, h: ch - pad * 2 }
    const rot = (i % 2 === 0 ? -2.4 : 2.6)
    // 白紙片（微旋 + 柔影）
    paperScrap(slide, scrap, rot, pack.cardRadius)
    // 頂角斜貼 washi 膠帶（teal／coral 輪換）
    const tape = tints[i % tints.length]
    washiTape(slide, scrap.x + scrap.w * 0.46, scrap.y - 0.12, Math.min(1.5, scrap.w * 0.6), 0.26, tape, rot - 18)
    // 粗標題（手帳字感用 displayFont）
    tx(slide, clampText(card.title.trim(), 14), {
      x: scrap.x + 0.26,
      y: scrap.y + 0.34,
      w: scrap.w - 0.5,
      h: 0.46,
      fontSize: 17,
      bold: true,
      color: pack.ink,
      lineSpacingMultiple: 1.04,
      fit: 'shrink',
    })
    // 一條手畫底線（accent tint）
    hline(slide, scrap.x + 0.26, scrap.y + 0.82, Math.min(1.4, scrap.w - 0.5), mix(tape, pack.bg, 0.55), 1.25)
    // 正文
    if (card.desc) {
      tx(slide, clampText(card.desc.trim(), 80), {
        x: scrap.x + 0.26,
        y: scrap.y + 0.96,
        w: scrap.w - 0.5,
        h: scrap.h - 1.18,
        fontSize: 12,
        color: pack.inkSoft,
        lineSpacingMultiple: 1.22,
        fit: 'shrink',
      })
    }
  })
}

const scrapbook: Pack = {
  id: 'scrapbook',
  name: '手帳',
  hint: '拼貼手帳 · 通識/班務',
  swatches: ['#5BB0A6', '#EF7D6A', '#EFE7D6'],
  dark: false,
  bg: SCR.bg,
  ink: SCR.ink,
  inkSoft: SCR.soft,
  faint: SCR.faint,
  hair: SCR.hair,
  accent: SCR.accent,
  statColor: SCR.coral,
  panel: SCR.panel,
  cardRadius: 0.06,
  displayFont: 'Georgia',
  displayItalic: false,
  pageNoColor: SCR.soft,
  chartColors: ['5BB0A6', 'EF7D6A', '8FBF86', 'D9A85E'],
  chartGridColor: SCR.hair,
  bulletPt: [18, 18, 17, 17, 16],
  titlePt: 28,
  marker: { kind: 'roundSquare', size: 0.11, radius: 0.03, color: SCR.accent, indent: 0.32 },
  tileStyle: 'panel',
  compareStyle: 'cards',
  stepNode: { kind: 'roundSquareFill', size: 0.32, color: SCR.accent, numColor: 'FFFFFF' },
  quoteMark: { kind: 'roundSquare', size: 0.14, radius: 0.03, color: SCR.coral },
  splitPhoto: 'bleedHair',
  overrides: { cards: renderScrapbookTapedCards },

  // 逐版母題：角落一小條 washi 膠帶（薄旋轉 rect），角位／角度／色（teal↔coral）按 seq 輪換
  deco(slide, ctx) {
    const spots: [number, number, number][] = [
      [11.95, 0.95, -14], // 右上
      [0.95, 6.65, 12], // 左下
      [11.95, 6.65, 16], // 右下
      [0.95, 0.95, -10], // 左上
    ]
    const [dx, dy, rot] = spots[ctx.seq % 4]
    const c = ctx.seq % 2 === 0 ? SCR.accent : SCR.coral
    washiTape(slide, dx, dy, 0.62, 0.16, c, rot)
  },

  cover(slide, deck, brand, img) {
    slide.background = { color: SCR.bg }
    const hasImg = Boolean(img)
    // 全版極淡牛皮卡紙深度漸層（壓底，貼紙浮其上）
    slide.addShape('rect', {
      x: 0,
      y: 0,
      w: 13.33,
      h: 7.5,
      fill: {
        color: gradLinear(90, [
          { pos: 0, color: mix(SCR.bg, 'FFFFFF', 0.04) },
          { pos: 100, color: mix(SCR.bg, SCR.ink, 0.06) },
        ]),
      },
      line: { type: 'none' },
    })
    // 牛皮卡紙板感：極淡內裱髮線框
    slide.addShape('rect', { x: 0.32, y: 0.32, w: 12.69, h: 6.86, fill: { type: 'none' }, line: { color: mix(SCR.ink, SCR.bg, 0.16), width: 0.75 } })
    if (img) {
      // 右側拍立得相片紙片（白邊 roundRect + 微旋 + 柔影 + washi 貼住頂角）
      const frameW = 4.7
      const frame: Rect = { x: 7.9, y: 1.3, w: frameW, h: 4.4 }
      paperScrap(slide, frame, 2.2, SCR_RADIUS)
      const inset = 0.2
      const art: Rect = { x: frame.x + inset, y: frame.y + inset, w: frame.w - inset * 2, h: frame.h - inset * 2 - 0.4 }
      addCoverImage(slide, img, art)
      slide.addShape('rect', { x: art.x, y: art.y, w: art.w, h: art.h, fill: { type: 'none' }, line: { color: SCR.hair, width: 0.5 } })
      washiTape(slide, frame.x + frame.w * 0.4, frame.y - 0.14, 1.5, 0.28, SCR.accent, -16)
      tx(slide, img.credit, { x: art.x, y: frame.y + frame.h - 0.5, w: art.w, h: 0.3, fontSize: 9, color: SCR.soft, align: 'center', fontFace: 'Georgia' })
    }
    // 主角：白紙片貼住題（微旋 -2°）+ 兩條 washi 膠帶
    const card: Rect = { x: 0.95, y: 2.25, w: hasImg ? 6.3 : 8.4, h: 2.6 }
    paperScrap(slide, card, -2, SCR_RADIUS)
    washiTape(slide, card.x + 0.4, card.y - 0.13, 1.7, 0.3, SCR.accent, -8)
    washiTape(slide, card.x + card.w - 2.0, card.y + card.h - 0.16, 1.7, 0.3, SCR.coral, -6)
    tx(slide, '手帳 · 教學簡報', { x: card.x + 0.4, y: card.y + 0.34, w: card.w - 0.8, h: 0.32, fontSize: 11, color: SCR.accent, charSpacing: 3, bold: true })
    const titleW = card.w - 0.9
    const fit = fitTitle(deck.title, 'cover')
    const lines = Math.max(1, Math.min(2, estimateLines(deck.title, fit.fontPt, titleW)))
    tx(slide, deck.title, { x: card.x + 0.4, y: card.y + 0.78, w: titleW, h: 1.2, fontSize: fit.fontPt, bold: true, color: SCR.ink, lineSpacingMultiple: 1.08, fit: 'shrink' })
    if (deck.subtitle) {
      const subY = card.y + 0.78 + (lines * fit.fontPt * 1.08) / 72 + 0.16
      tx(slide, deck.subtitle, { x: card.x + 0.4, y: subY, w: titleW, h: 0.5, fontSize: 14, color: SCR.soft })
    }
    // 塗鴉小星 + 塗鴉箭（指向題）
    doodleStar(slide, card.x + card.w - 0.5, card.y + 0.5, 0.14, SCR.coral)
    doodleArrow(slide, 0.95, 5.35, 0.8, SCR.ink)
    // 底部手帳日期 + brand
    tx(slide, `${dateLabel()} · ${brand}`, { x: 0.95, y: 6.78, w: 8, h: 0.3, fontSize: 9, color: SCR.faint })
  },

  section(slide, no, title) {
    slide.background = { color: SCR.bg }
    // 大白紙片貼住章節號（微旋）+ 三條 washi 膠帶
    const card: Rect = { x: 0.95, y: 1.3, w: 5.4, h: 4.7 }
    paperScrap(slide, card, -1.6, SCR_RADIUS)
    washiTape(slide, card.x + 0.5, card.y - 0.14, 2.0, 0.32, SCR.accent, -7)
    washiTape(slide, card.x + card.w - 2.4, card.y - 0.12, 2.0, 0.32, SCR.coral, 6)
    tx(slide, pad2(no), { x: card.x, y: card.y + 0.5, w: card.w, h: 2.6, fontSize: 150, bold: true, color: mix(SCR.accent, SCR.panel, 0.5), align: 'center', fontFace: 'Georgia' })
    tx(slide, `SECTION ${sectionWord(no)}`, { x: card.x + 0.4, y: card.y + card.h - 0.8, w: card.w - 0.8, h: 0.3, fontSize: 10, color: SCR.accent, charSpacing: 4, bold: true, align: 'center' })
    tx(slide, title, { x: 6.7, y: 3.1, w: 5.7, h: 1.4, fontSize: 32, bold: true, color: SCR.ink, valign: 'middle', lineSpacingMultiple: 1.1 })
    doodleArrow(slide, 6.5, 4.65, 0.9, SCR.coral)
  },

  contentFrame(slide, ctx) {
    slide.background = { color: SCR.bg }
    const { body } = scaffold(slide, scrapbook, ctx, { kickerY: 0.58, titleY: 0.9, hairline: true })
    // 右上一條短 washi 膠帶（配圖出血版省略）
    if (!ctx.hasPhoto) washiTape(slide, 11.5, 0.55, 1.0, 0.2, SCR.accent, -8)
    drawFooter(slide, scrapbook, ctx)
    return body
  },
}

// ============================================================
//  水墨 sumi — 水墨留白
//  宣紙白底 + 純黑墨 + 朱砂印：大片留白係主角 ——
//  水墨「筆」由 2-3 塊微錯位灰 roundRect（黑→宣紙 0.2/0.4/0.6）層疊扮濕筆，
//  飛白分隔 = 粗黑線中間留幾粒宣紙色缺口，朱砂方印點睛。
// ============================================================

const SUM = { bg: 'F6F3EC', ink: '1C1B19', soft: '57544E', faint: '948F86', hair: 'DAD5CA', accent: 'B33A26', panel: 'EEEAE0' }

/** 水墨筆：2-3 塊微錯位灰 roundRect（黑→宣紙 0.2/0.4/0.6）層疊扮濕筆 */
function inkStroke(slide: PptxGenJS.Slide, r: Rect, rotate = 0): void {
  // 真墨韻濃淡：對角線性漸層（焦墨 → 淡墨 → 飛白），由 gradFill 注入
  slide.addShape('roundRect', {
    x: r.x,
    y: r.y,
    w: r.w,
    h: r.h,
    rectRadius: Math.min(r.w, r.h) * 0.42,
    rotate,
    fill: {
      color: gradLinear(118, [
        { pos: 0, color: SUM.ink },
        { pos: 58, color: mix(SUM.ink, SUM.bg, 0.34) },
        { pos: 100, color: mix(SUM.ink, SUM.bg, 0.64) },
      ]),
    },
    line: { type: 'none' },
  })
}

/** 朱砂方印：實心朱砂 rect（落款印章） */
function sealMark(slide: PptxGenJS.Slide, x: number, y: number, size: number): void {
  slide.addShape('rect', { x, y, w: size, h: size, fill: { color: SUM.accent }, line: { type: 'none' } })
}

/** 飛白分隔：粗黑線，中間留幾粒宣紙色缺口（扮乾筆飛白） */
function flyingWhite(slide: PptxGenJS.Slide, x: number, y: number, w: number, pt: number): void {
  hline(slide, x, y, w, SUM.ink, pt)
  // 三粒宣紙色缺口，蓋穿黑線造飛白
  const gaps = [0.32, 0.58, 0.78]
  const gh = (pt / 72) * 1.4
  for (const g of gaps) {
    slide.addShape('rect', { x: x + w * g, y: y - gh / 2, w: w * 0.04, h: gh, fill: { color: SUM.bg }, line: { type: 'none' } })
  }
}

/**
 * 招牌：quote 渲染成「水墨題字」——
 * 一大塊柔灰水墨筆 blob（層疊 roundRect）墊喺大黑引文後，
 * 朱砂方印 + 出處做落款（attribution）喺腳，四圍大量留白。
 */
function renderSumiInkQuote(slide: PptxGenJS.Slide, body: Rect, pack: Pack, s: Slide): void {
  const q = s.quote
  if (!q || !q.text.trim()) return
  const cw = Math.min(8.4, body.w - 2.2)
  const cx = body.x + (body.w - cw) / 2
  // 柔灰水墨筆 blob（墊喺引文後、偏左上掃過）
  inkStroke(slide, { x: cx - 0.3, y: body.y + 0.3, w: cw * 0.62, h: 1.5 }, -8)
  // 大黑引文（書名號夾住）
  const quoteY = body.y + 0.5
  const quoteH = Math.max(1.8, body.h - 2.0)
  tx(slide, `「${clampText(q.text.trim(), 50)}」`, {
    x: cx,
    y: quoteY,
    w: cw,
    h: quoteH,
    fontSize: 34,
    color: pack.ink,
    valign: 'middle',
    lineSpacingMultiple: 1.34,
    fit: 'shrink',
  })
  // 腳部落款：朱砂方印 + 出處
  const footY = quoteY + quoteH + 0.2
  if (q.attribution) {
    sealMark(slide, cx, footY + 0.02, 0.26)
    tx(slide, clampText(q.attribution.trim(), 30), {
      x: cx + 0.42,
      y: footY,
      w: cw - 0.42,
      h: 0.36,
      fontSize: 14,
      color: pack.inkSoft,
      valign: 'middle',
      fontFace: pack.displayFont,
    })
  } else {
    sealMark(slide, cx, footY + 0.02, 0.26)
  }
}

const sumi: Pack = {
  id: 'sumi',
  name: '水墨',
  hint: '水墨留白 · 中文/藝術',
  swatches: ['#1C1B19', '#B33A26', '#F6F3EC'],
  dark: false,
  bg: SUM.bg,
  ink: SUM.ink,
  inkSoft: SUM.soft,
  faint: SUM.faint,
  hair: SUM.hair,
  accent: SUM.accent,
  statColor: SUM.accent,
  panel: SUM.panel,
  cardRadius: 0.02,
  displayFont: 'Georgia',
  displayItalic: false,
  pageNoColor: SUM.faint,
  chartColors: ['1C1B19', 'B33A26', '7A776F', 'BFBAB0'],
  chartGridColor: SUM.hair,
  bulletPt: [18, 18, 17, 17, 16],
  titlePt: 29,
  marker: { kind: 'square', size: 0.09, color: SUM.ink, indent: 0.3 },
  tileStyle: 'hairline',
  compareStyle: 'hairline',
  stepNode: { kind: 'bare', size: 0.3, color: SUM.ink, numColor: SUM.ink },
  quoteMark: { kind: 'square', size: 0.14, color: SUM.accent },
  splitPhoto: 'bleedHair',
  overrides: { quote: renderSumiInkQuote },

  // 逐版母題：一細朱砂方印 + 一粒淡灰墨漬（細 ellipse），角位按 seq % 2 交替
  deco(slide, ctx) {
    const right = ctx.seq % 2 === 0
    const sx = right ? 12.5 : 0.6
    sealMark(slide, sx, 6.78, 0.14)
    slide.addShape('ellipse', {
      x: right ? sx - 0.26 : sx + 0.2,
      y: 6.82,
      w: 0.1,
      h: 0.08,
      fill: { color: mix(SUM.ink, SUM.bg, 0.32) },
      line: { type: 'none' },
    })
  },

  cover(slide, deck, brand, img) {
    slide.background = { color: SUM.bg }
    const hasImg = Boolean(img)
    // 全版極淡宣紙色深度漸層（壓底，水墨／題字浮其上）
    slide.addShape('rect', {
      x: 0,
      y: 0,
      w: 13.33,
      h: 7.5,
      fill: {
        color: gradLinear(90, [
          { pos: 0, color: mix(SUM.bg, 'FFFFFF', 0.04) },
          { pos: 100, color: mix(SUM.bg, SUM.ink, 0.05) },
        ]),
      },
      line: { type: 'none' },
    })
    // 一道大水墨筆掃過右上角（層疊灰 roundRect）
    inkStroke(slide, { x: 8.8, y: -0.6, w: 5.4, h: 2.6 }, 12)
    if (img) {
      // 右下相 + 細髮線框（裱於留白）
      const frame: Rect = { x: 8.2, y: 3.7, w: 4.4, h: 3.0 }
      addCoverImage(slide, img, frame)
      slide.addShape('rect', { x: frame.x, y: frame.y, w: frame.w, h: frame.h, fill: { type: 'none' }, line: { color: SUM.hair, width: 0.75 } })
      photoCreditOnImage(slide, img.credit, frame)
    }
    // 題在大片留白中（左下偏上）
    tx(slide, '水墨 · 教學簡報', { x: 0.95, y: 2.55, w: 8, h: 0.3, fontSize: 11, color: SUM.accent, charSpacing: 4, bold: true })
    const titleW = hasImg ? 6.6 : 9.4
    const fit = fitTitle(deck.title, 'cover')
    const lines = Math.max(1, Math.min(2, estimateLines(deck.title, fit.fontPt, titleW)))
    tx(slide, deck.title, { x: 0.95, y: 3.05, w: titleW, h: 1.55, fontSize: fit.fontPt, bold: true, color: SUM.ink, lineSpacingMultiple: 1.1, fit: 'shrink' })
    if (deck.subtitle) {
      const subY = 3.05 + (lines * fit.fontPt * 1.1) / 72 + 0.2
      tx(slide, deck.subtitle, { x: 0.95, y: subY, w: titleW, h: 0.5, fontSize: 15, color: SUM.soft })
    }
    // 飛白分隔
    flyingWhite(slide, 0.95, 5.35, 4.2, 3)
    // 朱砂方印 + 日期（落款）
    sealMark(slide, 0.95, 5.62, 0.3)
    tx(slide, dateLabel(), { x: 1.4, y: 5.64, w: 4, h: 0.3, fontSize: 11, color: SUM.soft, valign: 'middle', fontFace: 'Georgia' })
    tx(slide, brand, { x: 0.95, y: 6.78, w: 6, h: 0.3, fontSize: 9, color: SUM.faint })
  },

  section(slide, no, title) {
    slide.background = { color: SUM.bg }
    // 大水墨筆掃過 + Georgia 淡灰巨號喺留白
    inkStroke(slide, { x: -0.8, y: 1.0, w: 5.2, h: 2.4 }, -10)
    tx(slide, pad2(no), { x: 0.85, y: 1.2, w: 6, h: 2.9, fontSize: 150, bold: true, color: mix(SUM.ink, SUM.bg, 0.16), fontFace: 'Georgia' })
    flyingWhite(slide, 0.95, 4.4, 3.6, 3)
    sealMark(slide, 0.95, 4.62, 0.28)
    tx(slide, title, { x: 1.4, y: 4.6, w: 11, h: 0.7, fontSize: 32, bold: true, color: SUM.ink, valign: 'middle' })
    tx(slide, `SECTION ${sectionWord(no)} · 章`, { x: 0.95, y: 5.55, w: 6, h: 0.3, fontSize: 9, color: SUM.faint, charSpacing: 4 })
  },

  contentFrame(slide, ctx) {
    slide.background = { color: SUM.bg }
    const { body, contentW } = scaffold(slide, sumi, ctx, { kickerY: 0.58, titleY: 0.9, hairline: false })
    // 飛白分隔代 folio 髮線（位置 = scaffold 髮線位 body.y−0.3）
    flyingWhite(slide, 0.9, body.y - 0.3, contentW, 2.5)
    // 朱砂方印（配圖版移入文字欄右端）
    sealMark(slide, ctx.hasPhoto ? 6.78 : 12.39, 0.62, 0.12)
    drawFooter(slide, sumi, ctx)
    return body
  },
}

// ============================================================
//  粗獷 brutalist — Brutalist
//  慘白米底 + 純黑墨 + 一抹刺橙：硬粗框（3pt）零圓角、超大字、
//  巨頁碼、mono 微標籤（Consolas）。冇半粒柔。
// ============================================================

const BRU = { bg: 'F4F4F0', ink: '000000', soft: '3A3A38', faint: '8A8A86', hair: '000000', accent: 'FF4D00', panel: 'FFFFFF' }

/** 硬框：3pt 純黑零圓角 rect（無填／指定填） */
function hardBox(slide: PptxGenJS.Slide, r: Rect, fill: string | null, pt = 3): void {
  slide.addShape('rect', {
    x: r.x,
    y: r.y,
    w: r.w,
    h: r.h,
    fill: fill ? { color: fill } : { type: 'none' },
    line: { color: BRU.ink, width: pt },
  })
}

/** mono 微標籤：Consolas 細字大字距 */
function monoLabel(slide: PptxGenJS.Slide, text: string, x: number, y: number, w: number, color = BRU.ink, align: 'left' | 'right' | 'center' = 'left'): void {
  tx(slide, text, { x, y, w, h: 0.24, fontSize: 9, color, charSpacing: 2, bold: true, align, fontFace: 'Consolas' })
}

/**
 * 招牌：stats 渲染成「硬框生數字」——
 * 各 stat 一個硬框 box（3pt 黑框、零圓角），內裡 Arial-bold 巨號值
 * + 細 mono 大寫標籤；box 之間以粗黑 rule 分隔。Brutalist 生鏽感。2–4 項。
 */
function renderBrutalistRawStats(slide: PptxGenJS.Slide, body: Rect, pack: Pack, s: Slide): void {
  const items = (s.stats ?? []).slice(0, 4)
  if (items.length < 2) return
  const n = items.length
  const gap = 0.4
  const cw = (body.w - gap * (n - 1)) / n
  const bh = Math.min(3.0, body.h - 0.4)
  const by = body.y + (body.h - bh) / 2
  items.forEach((st, i) => {
    const cx = body.x + i * (cw + gap)
    // 硬框 box
    hardBox(slide, { x: cx, y: by, w: cw, h: bh }, pack.panel, 3)
    // 頂部 mono 序號標籤
    monoLabel(slide, `// ${pad2(i + 1)}`, cx + 0.16, by + 0.16, cw - 0.32, pack.ink)
    // 巨號值（Arial-bold，黑）
    tx(slide, clampText(st.value.trim(), 7), {
      x: cx + 0.12,
      y: by + 0.5,
      w: cw - 0.24,
      h: bh * 0.55,
      fontSize: 72,
      bold: true,
      color: pack.ink,
      align: 'left',
      valign: 'middle',
      fontFace: 'Arial Black',
      fit: 'shrink',
    })
    // 底部硬黑 rule + mono 大寫標籤
    hline(slide, cx + 0.16, by + bh - 0.6, cw - 0.32, pack.ink, 3)
    monoLabel(slide, clampText(st.label.trim().toUpperCase(), 22), cx + 0.16, by + bh - 0.44, cw - 0.32, pack.inkSoft)
    // box 之間粗黑 rule
    if (i < n - 1) vline(slide, cx + cw + gap / 2, by, bh, pack.ink, 3)
  })
}

const brutalist: Pack = {
  id: 'brutalist',
  name: '粗獷',
  hint: 'Brutalist · 設計/前衛',
  swatches: ['#000000', '#FF4D00', '#F4F4F0'],
  dark: false,
  bg: BRU.bg,
  ink: BRU.ink,
  inkSoft: BRU.soft,
  faint: BRU.faint,
  hair: BRU.hair,
  accent: BRU.accent,
  statColor: BRU.ink,
  panel: BRU.panel,
  cardRadius: 0,
  displayFont: 'Consolas',
  displayItalic: false,
  pageNoColor: BRU.ink,
  chartColors: ['000000', 'FF4D00', '7A7A76', 'C4C4BE'],
  chartGridColor: BRU.faint,
  bulletPt: [19, 18, 18, 17, 16],
  titlePt: 30,
  marker: { kind: 'square', size: 0.12, color: BRU.ink, indent: 0.32 },
  tileStyle: 'cellBorder',
  compareStyle: 'panels',
  stepNode: { kind: 'squareFill', size: 0.34, color: BRU.ink, numColor: 'FFFFFF' },
  quoteMark: { kind: 'square', size: 0.16, color: BRU.accent },
  splitPhoto: 'bleedHair',
  overrides: { stats: renderBrutalistRawStats },

  // 逐版母題：一個巨型極淡 outline 頁式數字（seq+1，部分出血到角邊）+ 一粒 mono tick
  deco(slide, ctx) {
    const right = ctx.seq % 2 === 0
    const num = String(ctx.seq + 1)
    tx(slide, num, {
      x: right ? 11.7 : -0.3,
      y: 5.65,
      w: 1.9,
      h: 1.8,
      fontSize: 150,
      bold: true,
      color: mix(BRU.ink, BRU.bg, 0.06),
      align: right ? 'right' : 'left',
      valign: 'bottom',
      fontFace: 'Arial Black',
    })
    monoLabel(slide, `[${pad2(ctx.seq + 1)}]`, right ? 11.9 : 0.5, 6.95, 0.9, BRU.faint, right ? 'right' : 'left')
  },

  cover(slide, deck, brand, img) {
    slide.background = { color: BRU.bg }
    const hasImg = Boolean(img)
    // 全版極淡米白深度漸層（壓底，硬框／巨字浮其上 —— 保持生硬僅添微深度）
    slide.addShape('rect', {
      x: 0,
      y: 0,
      w: 13.33,
      h: 7.5,
      fill: {
        color: gradLinear(90, [
          { pos: 0, color: mix(BRU.bg, 'FFFFFF', 0.04) },
          { pos: 100, color: mix(BRU.bg, BRU.ink, 0.06) },
        ]),
      },
      line: { type: 'none' },
    })
    // 巨型極淡 outline 頁式數字（背景，部分出右下）
    tx(slide, '01', { x: 7.0, y: 2.4, w: 7.0, h: 5.4, fontSize: 400, bold: true, color: mix(BRU.ink, BRU.bg, 0.05), align: 'right', valign: 'bottom', fontFace: 'Arial Black' })
    // 頂部 mono 標籤
    monoLabel(slide, 'DECK / 01 · 教學簡報', 0.7, 0.6, 8, BRU.accent)
    if (img) {
      // 右側硬框相
      const frame: Rect = { x: 8.2, y: 1.5, w: 4.6, h: 3.6 }
      addCoverImage(slide, img, frame)
      hardBox(slide, frame, null, 3)
      photoCreditOnImage(slide, img.credit, frame)
    }
    // 超大黑題 flush-left
    const titleW = hasImg ? 7.0 : 11.8
    const fit = fitTitle(deck.title, 'cover')
    const pt = Math.min(54, fit.fontPt + 10)
    const lines = Math.max(1, Math.min(2, estimateLines(deck.title, pt, titleW)))
    tx(slide, deck.title, { x: 0.7, y: 1.7, w: titleW, h: 2.4, fontSize: pt, bold: true, color: BRU.ink, align: 'left', lineSpacingMultiple: 0.98, fit: 'shrink', fontFace: 'Arial Black' })
    let cursorY = 1.7 + (lines * pt * 0.98) / 72 + 0.18
    // 重黑粗 rule
    hline(slide, 0.7, cursorY, hasImg ? 6.8 : 11.8, BRU.ink, 3)
    cursorY += 0.2
    if (deck.subtitle) {
      tx(slide, deck.subtitle, { x: 0.7, y: cursorY, w: titleW, h: 0.5, fontSize: 16, color: BRU.soft })
    }
    // 底部 mono：brand · 日期
    monoLabel(slide, `${brand.toUpperCase()} · ${dateLabel()}`, 0.7, 6.95, 9, BRU.ink)
  },

  section(slide, no, title) {
    slide.background = { color: BRU.bg }
    // 超巨黑章節號填滿版面（flush-left，部分出血）
    tx(slide, pad2(no), { x: 0.4, y: -0.7, w: 12.5, h: 7.0, fontSize: 480, bold: true, color: BRU.ink, align: 'left', valign: 'middle', fontFace: 'Arial Black' })
    // 一抹橙粗 rule
    slide.addShape('rect', { x: 0.7, y: 5.9, w: 4.0, h: 0.14, fill: { color: BRU.accent }, line: { type: 'none' } })
    // mono 標題列（底部）
    monoLabel(slide, `SECTION ${sectionWord(no)}`, 0.7, 6.15, 8, BRU.accent)
    tx(slide, title, { x: 0.7, y: 6.4, w: 12.0, h: 0.8, fontSize: 30, bold: true, color: BRU.ink, fontFace: 'Arial Black' })
  },

  contentFrame(slide, ctx) {
    slide.background = { color: BRU.bg }
    const { body } = scaffold(slide, brutalist, ctx, { kickerY: 0.58, titleY: 0.9, hairline: false })
    // header 之下一條重黑粗 rule（代髮線）
    hline(slide, 0.9, body.y - 0.3, ctx.hasPhoto ? 6.6 : 11.53, BRU.ink, 3)
    // 右上巨頁碼（Consolas，配圖出血版省略）
    if (!ctx.hasPhoto) {
      tx(slide, pad2(ctx.pageNo), { x: 11.0, y: 0.42, w: 1.9, h: 0.7, fontSize: 40, bold: true, color: mix(BRU.ink, BRU.bg, 0.2), align: 'right', fontFace: 'Consolas' })
    }
    drawFooter(slide, brutalist, ctx)
    return body
  },
}

// ───────── 滙出 ─────────

export const GALLERY_PACKS_7: Pack[] = [scrapbook, sumi, brutalist]
