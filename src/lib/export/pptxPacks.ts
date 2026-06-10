// ============================================================
//  pptx 模板 pack — 5 套設計（tokens + 封面/章節/內容框 renderer）
//  ------------------------------------------------------------
//  · 墨韻 inkwell — 人文書卷（預設）：白底、朱砂點睛、Georgia 老式數字
//  · 青瓷 celadon — 科學自然：正圓 motif、tint 卡、圓裁相
//  · 曙光 dawn    — 初小活潑：琥珀、圓角方、全 pack 最大字級
//  · 夜讀 nocturne— 深底投影：藍黑 + 燙金雙細線、浮面板
//  · 方格 grid    — 數理精準：Swiss 網格、準星角標、鈷藍方
//  鐵律（spec §0）：每個 addText 必設 fontFace + lang；無 SVG；
//  淡色一律 mix() 預混；shadow 只用 outer；fontSize 整數 pt。
// ============================================================

import type PptxGenJS from 'pptxgenjs'
import type { Deck, SlideLayout } from './types'
import { mix, estimateLines, fitTitle, clampText } from './pptxText'

export type SlidePackId =
  | 'inkwell'
  | 'celadon'
  | 'dawn'
  | 'nocturne'
  | 'grid'
  | 'seminar'
  // gallery（pptxPacksGallery1/2）
  | 'chalk'
  | 'press'
  | 'neon'
  | 'confetti'
  | 'pastel'
  | 'blueprint'
  | 'ivy'
  | 'redgrid'
  | 'transit'
  | 'ocean'

/** 嵌入簡報嘅相（由 stock 層提供；width/height 係真實 pixel，計裁切比例必需） */
export interface SlideImage {
  dataUri: string
  credit: string
  width: number
  height: number
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** 中文主字體 — run 級設定先寫到 a:ea（theme 級靠 §6 patch 補底） */
export const FONT = 'Microsoft JhengHei'

// ───────── pack token 形態 ─────────

/** 列點 marker 形態（row 引擎按此繪畫；indent = 內文相對列點區左移吋數） */
export type MarkerSpec =
  | { kind: 'number'; color: string; indent: number } // 墨韻：display 字體序號「1.」
  | { kind: 'circle'; size: number; linePt: number; color: string; indent: number }
  | { kind: 'roundSquare'; size: number; radius: number; color: string; indent: number }
  | { kind: 'square'; size: number; color: string; indent: number }
  | { kind: 'dot'; size: number; color: string; indent: number } // 講堂：實心圓點
  | { kind: 'triangle'; size: number; color: string; indent: number } // 彩斑：▶ 三角
  | { kind: 'dash'; color: string; indent: number } // 夜讀：金「—」文字 run

export type TileStyle = 'hairline' | 'tintCard' | 'whiteOnTint' | 'panel' | 'cellBorder'
export type CompareStyle = 'hairline' | 'cards' | 'panels' | 'abGrid'

export interface StepNodeSpec {
  kind: 'bare' | 'circleOutline' | 'roundSquareFill' | 'squareFill'
  size: number
  color: string
  numColor: string
}

export type QuoteMarkSpec =
  | { kind: 'glyph'; color: string }
  | { kind: 'circle'; size: number; linePt: number; color: string }
  | { kind: 'roundSquare'; size: number; radius: number; color: string }
  | { kind: 'square'; size: number; color: string }

/** split（配圖）版相片形態 */
export type SplitPhotoStyle = 'bleedHair' | 'circle' | 'bleedMotif' | 'bleedScrim'

/** 內容框 render 上下文 */
export interface FrameCtx {
  title: string
  /** 版題下短副題（多數係英文對照） */
  subtitle?: string
  kicker: string
  /** 真實版號（封面 = 1） */
  pageNo: number
  /** 全 deck 總版數（連封面）— 分數頁碼「13 / 23」用 */
  pageTotal: number
  brand: string
  layout: SlideLayout
  /** split 配圖版 — 影響題闊、右上角飾物同頁碼位置 */
  hasPhoto: boolean
  hasChart: boolean
}

export interface Pack {
  id: SlidePackId
  name: string
  hint: string
  /** 揀選卡 UI 用嘅 3 粒代表色（連 #） */
  swatches: [string, string, string]
  dark: boolean
  bg: string
  ink: string
  inkSoft: string
  /** 註腳／署名色 */
  faint: string
  hair: string
  accent: string
  /** stats 數值色（青瓷用陶土點睛，其他 = accent） */
  statColor: string
  /** 卡片／浮面板底色 */
  panel: string
  cardRadius: number
  displayFont: string
  displayItalic: boolean
  pageNoColor: string
  /** true = 頁碼用「13 / 23」分數格式（講堂） */
  pageNoFraction?: boolean
  /** true = 版式結構線（steps 連接線／compare 欄題線）用虛線（粉筆） */
  structDash?: boolean
  /** compare 右欄面板用嘅另一隻色（粉彩 A/B 對照）；缺省同 panel */
  panelAlt?: string
  chartColors: string[]
  chartGridColor: string
  /** bullets 字級階梯：n=2 / 3 / 4 / 5 / ≥6 */
  bulletPt: [number, number, number, number, number]
  titlePt: number
  marker: MarkerSpec
  tileStyle: TileStyle
  compareStyle: CompareStyle
  stepNode: StepNodeSpec
  quoteMark: QuoteMarkSpec
  splitPhoto: SplitPhotoStyle
  cover(slide: PptxGenJS.Slide, deck: Deck, brand: string, img?: SlideImage): void
  section(slide: PptxGenJS.Slide, no: number, title: string): void
  /** 畫 kicker／版題／髮線／頁尾，回傳 body 區域俾 layout 用 */
  contentFrame(slide: PptxGenJS.Slide, ctx: FrameCtx): Rect
}

// ───────── 共用繪圖小工具 ─────────

/** addText 統一入口：強制 fontFace + lang + bullet:false + margin 0（鐵律 §0.1/§0.2） */
export function tx(slide: PptxGenJS.Slide, text: string, opts: PptxGenJS.TextPropsOptions): void {
  slide.addText(text, { fontFace: FONT, lang: 'zh-HK', bullet: false, margin: 0, valign: 'top', ...opts })
}

/** 橫髮線（dash = 虛線版，粉筆等手感 pack 用） */
export function hline(slide: PptxGenJS.Slide, x: number, y: number, w: number, color: string, pt = 0.75, dash = false): void {
  slide.addShape('line', { x, y, w, h: 0, line: { color, width: pt, ...(dash ? { dashType: 'sysDash' as const } : {}) } })
}

/** 直髮線（dash = 虛線版） */
export function vline(slide: PptxGenJS.Slide, x: number, y: number, h: number, color: string, pt = 0.75, dash = false): void {
  slide.addShape('line', { x, y, w: 0, h, line: { color, width: pt, ...(dash ? { dashType: 'sysDash' as const } : {}) } })
}

/**
 * 以 cover 模式擺一張相：addImage 嘅 w/h 必須係相片真實比例，
 * sizing{w,h} 先係目標框（api-audit imageFinding — 比例俾錯會裁歪）。
 */
export function addCoverImage(slide: PptxGenJS.Slide, img: SlideImage, frame: Rect, rounding = false): void {
  const ar = img.width > 0 && img.height > 0 ? img.width / img.height : frame.w / frame.h
  slide.addImage({
    data: img.dataUri,
    x: frame.x,
    y: frame.y,
    w: frame.h * ar,
    h: frame.h,
    sizing: { type: 'cover', w: frame.w, h: frame.h },
    rounding,
  })
}

/** full-bleed 相底部署名：12% 黑 chip + 白字 8pt（Pexels 規定） */
export function photoCreditOnImage(slide: PptxGenJS.Slide, credit: string, frame: Rect): void {
  slide.addShape('rect', {
    x: frame.x,
    y: frame.y + frame.h - 0.32,
    w: frame.w,
    h: 0.32,
    fill: { color: '000000', transparency: 88 },
    line: { type: 'none' },
  })
  tx(slide, credit, {
    x: frame.x + 0.12,
    y: frame.y + frame.h - 0.28,
    w: frame.w - 0.24,
    h: 0.24,
    fontSize: 8,
    color: 'FFFFFF',
    align: 'right',
  })
}

/** 方格 pack 嘅「+」準星：兩條 1pt 線十字交叉（cx/cy = 中心，len = 全長） */
function crosshair(slide: PptxGenJS.Slide, cx: number, cy: number, len: number, color: string): void {
  slide.addShape('line', { x: cx - len / 2, y: cy, w: len, h: 0, line: { color, width: 1 } })
  slide.addShape('line', { x: cx, y: cy - len / 2, w: 0, h: len, line: { color, width: 1 } })
}

/** 夜讀「燙金書脊」雙細線：兩條 0.5pt 金線相距 0.045" */
function goldPair(slide: PptxGenJS.Slide, x: number, y: number, w: number): void {
  hline(slide, x, y, w, 'D4A94E', 0.5)
  hline(slide, x, y + 0.045, w, 'D4A94E', 0.5)
}

export function dateLabel(): string {
  const d = new Date()
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

const SECTION_WORDS = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN', 'ELEVEN', 'TWELVE']

export function sectionWord(no: number): string {
  return SECTION_WORDS[no - 1] ?? String(no)
}

// ───────── 語義 kicker（typographic，零 icon 依賴）─────────

const KICKER_RULES: { re: RegExp; label: string }[] = [
  { re: /導入|引入|簡介|概覽|目標|開始/, label: 'INTRO · 導入' },
  { re: /概念|定義|原理|理論|是甚麼|乜嘢|重點/, label: 'CONCEPT · 概念' },
  { re: /例子|個案|案例|示範|應用|情境/, label: 'EXAMPLE · 例子' },
  { re: /練習|活動|試做|實作|工作紙/, label: 'PRACTICE · 練習' },
  { re: /討論|思考|問題|反思|辯論/, label: 'DISCUSS · 討論' },
  { re: /總結|重溫|回顧|小結|結論|延伸/, label: 'SUMMARY · 總結' },
  { re: /數據|圖表|統計|趨勢|比較|數字/, label: 'DATA · 數據' },
]

const KICKER_CYCLE = ['INTRO · 導入', 'CONCEPT · 概念', 'EXAMPLE · 例子', 'PRACTICE · 練習', 'SUMMARY · 總結']

/** 按版題揀語義 kicker（純文字標籤，任何 Office/WPS 100% 顯示） */
export function pickKicker(title: string, index: number, hasChart = false): string {
  const hit = KICKER_RULES.find((r) => r.re.test(title))
  if (hit) return hit.label
  if (hasChart) return 'DATA · 數據'
  return KICKER_CYCLE[index % KICKER_CYCLE.length]
}

// ───────── 內容框共用骨架 ─────────

interface ScaffoldOpts {
  kickerY: number
  titleY: number
  /** false = 唔畫 header 髮線（曙光） */
  hairline: boolean
  /** 整體下移（講堂 header band 佔咗頂部） */
  offset?: number
}

interface ScaffoldOut {
  body: Rect
  /** 長題兩行時整體下移量 */
  shift: number
  /** 內容有效闊（配圖版收窄） */
  contentW: number
}

/** kicker + 版題 + （選擇性）folio 髮線；回傳 body 區域同位移 */
export function scaffold(slide: PptxGenJS.Slide, p: Pack, ctx: FrameCtx, opt: ScaffoldOpts): ScaffoldOut {
  const titleW = ctx.hasPhoto ? 6.5 : 10.4
  const fit = fitTitle(ctx.title)
  const pt = Math.min(p.titlePt, fit.fontPt)
  const lines = Math.min(fit.lines, Math.max(1, estimateLines(ctx.title, pt, titleW))) as 1 | 2
  tx(slide, ctx.kicker, {
    x: 0.9,
    y: opt.kickerY,
    w: 6,
    h: 0.3,
    fontSize: p.id === 'dawn' ? 10 : 9,
    color: p.accent,
    charSpacing: p.id === 'grid' || p.id === 'dawn' ? 2 : 3,
    bold: true,
  })
  tx(slide, clampText(ctx.title, 30), {
    x: 0.9,
    y: opt.titleY,
    w: titleW,
    h: lines === 2 ? 1.3 : 0.7,
    fontSize: pt,
    bold: true,
    color: p.ink,
    lineSpacingMultiple: 1.1,
  })
  const off = opt.offset ?? 0
  const shift = lines === 2 ? 0.35 : 0
  // 副題（英文對照）：版題下細字，body 順延
  let subShift = 0
  if (ctx.subtitle) {
    subShift = lines === 2 ? 0.42 : 0.3
    tx(slide, clampText(ctx.subtitle, 48), {
      x: 0.9,
      y: opt.titleY + (lines === 2 ? 1.3 : 0.62),
      w: titleW,
      h: 0.32,
      fontSize: 12,
      color: p.inkSoft,
    })
  }
  const contentW = ctx.hasPhoto ? 6.6 : 11.53
  if (opt.hairline) hline(slide, 0.9, 1.95 + off + shift + subShift, contentW, p.hair)
  const bodyY = 2.25 + off + shift + subShift
  return {
    body: { x: 0.9, y: bodyY, w: ctx.hasPhoto ? 6.2 : 11.53, h: 6.55 - bodyY },
    shift,
    contentW,
  }
}

/** 頁尾：brand 8pt 左 + 頁碼 9pt（pack display 字體）右；配圖出血版頁碼移入文字欄 */
export function drawFooter(slide: PptxGenJS.Slide, p: Pack, ctx: FrameCtx): void {
  tx(slide, ctx.brand, { x: 0.9, y: 7.05, w: 5, h: 0.3, fontSize: 8, color: p.faint })
  const movePage = ctx.hasPhoto && p.splitPhoto !== 'circle'
  const label = p.pageNoFraction ? `${ctx.pageNo} / ${ctx.pageTotal}` : pad2(ctx.pageNo)
  tx(slide, label, {
    x: movePage ? 6.15 : 11.23,
    y: 7.03,
    w: 1.2,
    h: 0.3,
    fontSize: 9,
    align: 'right',
    color: p.pageNoColor,
    fontFace: p.displayFont,
    italic: p.displayItalic,
  })
}

// ============================================================
//  墨韻 inkwell
// ============================================================

const INK = { ink: '1C1917', soft: '78716C', faint: 'A8A29E', hair: 'E7E2DC', accent: 'C2410C' }

const inkwell: Pack = {
  id: 'inkwell',
  name: '墨韻',
  hint: '人文書卷 · 預設',
  swatches: ['#1C1917', '#C2410C', '#E7E2DC'],
  dark: false,
  bg: 'FFFFFF',
  ink: INK.ink,
  inkSoft: INK.soft,
  faint: INK.faint,
  hair: INK.hair,
  accent: INK.accent,
  statColor: INK.accent,
  panel: 'F7F3EF',
  cardRadius: 0,
  displayFont: 'Georgia',
  displayItalic: true,
  pageNoColor: INK.faint,
  chartColors: ['C2410C', 'E0A186', '78716C', 'D6D3D1'],
  chartGridColor: INK.hair,
  bulletPt: [19, 18, 17, 16, 15],
  titlePt: 30,
  marker: { kind: 'number', color: INK.accent, indent: 0.52 },
  tileStyle: 'hairline',
  compareStyle: 'hairline',
  stepNode: { kind: 'bare', size: 0.34, color: INK.accent, numColor: INK.accent },
  quoteMark: { kind: 'glyph', color: mix(INK.accent, 'FFFFFF', 0.18) },
  splitPhoto: 'bleedHair',

  cover(slide, deck, brand, img) {
    slide.background = { color: 'FFFFFF' }
    const hasImg = Boolean(img)
    // 頂部 folio 髮線 + kicker
    hline(slide, 0.9, 0.78, hasImg ? 7.9 : 11.53, INK.hair)
    tx(slide, '教學簡報 · TEACHING NOTES', { x: 0.9, y: 0.42, w: 7, h: 0.3, fontSize: 9, color: INK.accent, charSpacing: 4, bold: true })
    // 題 + 副題（雜誌封面式：有相時收窄文字欄）
    const titleW = hasImg ? 7.6 : 10.6
    const fit = fitTitle(deck.title, 'cover')
    const lines = Math.max(1, Math.min(2, estimateLines(deck.title, fit.fontPt, titleW)))
    tx(slide, deck.title, { x: 0.9, y: 2.35, w: titleW, h: 1.55, fontSize: fit.fontPt, bold: true, color: INK.ink, lineSpacingMultiple: 1.08, fit: 'shrink' })
    if (deck.subtitle) {
      const subY = 2.35 + (lines * fit.fontPt * 1.08) / 72 + 0.25
      tx(slide, deck.subtitle, { x: 0.9, y: subY, w: hasImg ? 7.4 : 10, h: 0.5, fontSize: 16, color: INK.soft })
    }
    // 左下：朱砂方印 + 日期
    slide.addShape('rect', { x: 0.9, y: 6.55, w: 0.14, h: 0.14, fill: { color: INK.accent }, line: { type: 'none' } })
    tx(slide, dateLabel(), { x: 1.18, y: 6.46, w: 4, h: 0.32, fontSize: 10, color: INK.soft, valign: 'middle' })
    // 右下 brand（有相時靠入文字欄）
    tx(slide, brand, { x: hasImg ? 4.8 : 8.43, y: 7.08, w: 4, h: 0.3, fontSize: 8, color: INK.faint, align: 'right' })
    if (img) {
      // 右欄直幅 full-bleed 相 + 左緣髮線（唔使 scrim）
      const frame: Rect = { x: 9.23, y: 0, w: 4.1, h: 7.5 }
      addCoverImage(slide, img, frame)
      vline(slide, 9.23, 0, 7.5, INK.hair)
      photoCreditOnImage(slide, img.credit, frame)
    } else {
      // 書脊式直排 microcopy
      tx(slide, 'EZITEACH · TEACHING DECK', { x: 10.37, y: 3.55, w: 5.5, h: 0.4, rotate: 90, align: 'center', fontSize: 8, color: INK.hair, charSpacing: 4 })
    }
  },

  section(slide, no, title) {
    slide.background = { color: 'FFFFFF' }
    // Georgia italic 淡朱砂巨號 — 大片留白就係設計
    tx(slide, pad2(no), { x: 0.75, y: 1.3, w: 5, h: 2.4, fontSize: 130, color: mix(INK.accent, 'FFFFFF', 0.14), fontFace: 'Georgia', italic: true })
    tx(slide, title, { x: 0.9, y: 4.35, w: 11, h: 1.2, fontSize: 32, bold: true, color: INK.ink })
    tx(slide, `SECTION ${sectionWord(no)}`, { x: 7.43, y: 6.42, w: 5, h: 0.3, fontSize: 9, color: INK.soft, charSpacing: 4, align: 'right' })
    hline(slide, 0.9, 6.9, 11.53, INK.hair)
  },

  contentFrame(slide, ctx) {
    slide.background = { color: 'FFFFFF' }
    const { body } = scaffold(slide, inkwell, ctx, { kickerY: 0.58, titleY: 0.9, hairline: true })
    // folio 只留 footer 一個（編輯排版一版一個 folio，右上重複會似 template 漏嘢）
    drawFooter(slide, inkwell, ctx)
    return body
  },
}

// ============================================================
//  青瓷 celadon
// ============================================================

const CEL = { ink: '1F2A27', soft: '5F6F6A', faint: 'A4B0AB', hair: 'DCE7E2', accent: '2C6E63', pop: 'C97B2D', panel: 'ECF3F0' }

const celadon: Pack = {
  id: 'celadon',
  name: '青瓷',
  hint: '科學自然 · 圓相清雅',
  swatches: ['#2C6E63', '#ECF3F0', '#C97B2D'],
  dark: false,
  bg: 'FFFFFF',
  ink: CEL.ink,
  inkSoft: CEL.soft,
  faint: CEL.faint,
  hair: CEL.hair,
  accent: CEL.accent,
  statColor: CEL.pop,
  panel: CEL.panel,
  cardRadius: 0.08,
  displayFont: 'Arial',
  displayItalic: false,
  pageNoColor: CEL.faint,
  chartColors: ['2C6E63', '8FB5AC', 'C97B2D', '5F6F6A'],
  chartGridColor: CEL.hair,
  bulletPt: [18, 17, 17, 16, 15],
  titlePt: 29,
  marker: { kind: 'circle', size: 0.11, linePt: 1.5, color: CEL.accent, indent: 0.34 },
  tileStyle: 'tintCard',
  compareStyle: 'cards',
  stepNode: { kind: 'circleOutline', size: 0.34, color: CEL.accent, numColor: CEL.accent },
  quoteMark: { kind: 'circle', size: 0.5, linePt: 1.5, color: CEL.accent },
  splitPhoto: 'circle',

  cover(slide, deck, brand, img) {
    slide.background = { color: 'FFFFFF' }
    // 正圓 motif：tint 實心細圓 →（相）→ 大 outline 圓 → 陶土細點
    slide.addShape('ellipse', { x: 8.05, y: 5.35, w: 1.6, h: 1.6, fill: { color: CEL.panel }, line: { type: 'none' } })
    if (img) addCoverImage(slide, img, { x: 8.1, y: 1.45, w: 4.6, h: 4.6 }, true)
    slide.addShape('ellipse', { x: 7.6, y: 0.95, w: 5.6, h: 5.6, fill: { type: 'none' }, line: { color: CEL.accent, width: 2.5 } })
    slide.addShape('ellipse', { x: 12.55, y: 1.5, w: 0.22, h: 0.22, fill: { color: CEL.pop }, line: { type: 'none' } })
    // 左欄文字
    tx(slide, '教學簡報 · TEACHING DECK', { x: 0.9, y: 2.08, w: 6.5, h: 0.3, fontSize: 9, color: CEL.accent, charSpacing: 3, bold: true })
    const fit = fitTitle(deck.title, 'cover')
    const pt = Math.min(42, fit.fontPt)
    const lines = Math.max(1, Math.min(3, estimateLines(deck.title, pt, 6.6)))
    tx(slide, deck.title, { x: 0.9, y: 2.5, w: 6.6, h: 2.3, fontSize: pt, bold: true, color: CEL.ink, lineSpacingMultiple: 1.12, fit: 'shrink' })
    if (deck.subtitle) {
      const subY = 2.5 + (lines * pt * 1.12) / 72 + 0.22
      tx(slide, deck.subtitle, { x: 0.9, y: subY, w: 6.4, h: 0.5, fontSize: 15, color: CEL.soft })
    }
    tx(slide, brand, { x: 0.9, y: 6.7, w: 5, h: 0.3, fontSize: 8, color: CEL.faint })
    if (img) {
      // 圓相喺白底 — 署名放圓相下方
      tx(slide, img.credit, { x: 8.1, y: 6.15, w: 4.6, h: 0.26, fontSize: 8, color: CEL.faint, align: 'center' })
    }
  },

  section(slide, no, title) {
    slide.background = { color: CEL.panel }
    // 同心圓 + Arial 巨號（圓喺號碼右後，先畫；圓底同章節題保持 ≥0.2" 呼吸位）
    slide.addShape('ellipse', { x: 3.35, y: 1.35, w: 3.0, h: 3.0, fill: { type: 'none' }, line: { color: mix(CEL.accent, CEL.panel, 0.3), width: 1.5 } })
    tx(slide, pad2(no), { x: 0.9, y: 2.2, w: 4, h: 1.9, fontSize: 110, bold: true, color: CEL.accent, fontFace: 'Arial' })
    tx(slide, title, { x: 0.9, y: 4.6, w: 11, h: 1.2, fontSize: 30, bold: true, color: CEL.ink })
    hline(slide, 0.9, 6.85, 11.53, mix(CEL.accent, CEL.panel, 0.25))
  },

  contentFrame(slide, ctx) {
    slide.background = { color: 'FFFFFF' }
    const { body } = scaffold(slide, celadon, ctx, { kickerY: 0.58, titleY: 0.9, hairline: true })
    // 右上 0.16" outline 圓角標 — 全版式一致（圓裁相喺 y1.3 以下，唔會撞）
    slide.addShape('ellipse', { x: 12.27, y: 0.6, w: 0.16, h: 0.16, fill: { type: 'none' }, line: { color: CEL.accent, width: 1.25 } })
    drawFooter(slide, celadon, ctx)
    return body
  },
}

// ============================================================
//  曙光 dawn
// ============================================================

const DAWN = { ink: '292524', soft: '79716B', faint: 'B3ABA3', hair: 'EDE5DB', accent: 'D97706', panel: 'FDF1E1' }

const dawn: Pack = {
  id: 'dawn',
  name: '曙光',
  hint: '初小活潑 · 大字暖色',
  swatches: ['#D97706', '#FDF1E1', '#292524'],
  dark: false,
  bg: 'FFFFFF',
  ink: DAWN.ink,
  inkSoft: DAWN.soft,
  faint: DAWN.faint,
  hair: DAWN.hair,
  accent: DAWN.accent,
  statColor: DAWN.accent,
  panel: DAWN.panel,
  cardRadius: 0.12,
  displayFont: 'Arial',
  displayItalic: false,
  pageNoColor: DAWN.faint,
  chartColors: ['D97706', 'ECB16A', '79716B', 'D6CFC7'],
  chartGridColor: DAWN.hair,
  bulletPt: [19, 19, 18, 17, 16],
  titlePt: 30,
  marker: { kind: 'roundSquare', size: 0.13, radius: 0.04, color: DAWN.accent, indent: 0.36 },
  tileStyle: 'whiteOnTint',
  compareStyle: 'cards',
  stepNode: { kind: 'roundSquareFill', size: 0.4, color: DAWN.accent, numColor: 'FFFFFF' },
  quoteMark: { kind: 'roundSquare', size: 0.4, radius: 0.1, color: DAWN.accent },
  splitPhoto: 'bleedMotif',

  cover(slide, deck, brand, img) {
    slide.background = { color: 'FFFFFF' }
    // 右下「日出三階」：底邊齊 y6.3，由淡到實
    slide.addShape('roundRect', { x: 9.0, y: 5.4, w: 0.9, h: 0.9, rectRadius: 0.12, fill: { color: mix(DAWN.accent, 'FFFFFF', 0.18) }, line: { type: 'none' } })
    slide.addShape('roundRect', { x: 10.05, y: 4.9, w: 1.4, h: 1.4, rectRadius: 0.12, fill: { color: mix(DAWN.accent, 'FFFFFF', 0.45) }, line: { type: 'none' } })
    if (img) {
      // 最大一階換成方裁相
      const frame: Rect = { x: 10.4, y: 3.4, w: 2.6, h: 2.6 }
      addCoverImage(slide, img, frame)
      tx(slide, img.credit, { x: 9.4, y: 6.08, w: 3.6, h: 0.45, fontSize: 8, color: DAWN.soft, align: 'right' })
    } else {
      slide.addShape('roundRect', { x: 11.6, y: 4.3, w: 2.0, h: 2.0, rectRadius: 0.12, fill: { color: DAWN.accent }, line: { type: 'none' } })
    }
    tx(slide, '教學簡報 · TEACHING DECK', { x: 0.9, y: 1.75, w: 6.5, h: 0.32, fontSize: 10, color: DAWN.accent, charSpacing: 2, bold: true })
    const fit = fitTitle(deck.title, 'cover')
    const lines = Math.max(1, Math.min(2, estimateLines(deck.title, fit.fontPt, 7.7)))
    tx(slide, deck.title, { x: 0.9, y: 2.2, w: 7.7, h: 1.55, fontSize: fit.fontPt, bold: true, color: DAWN.ink, lineSpacingMultiple: 1.08, fit: 'shrink' })
    if (deck.subtitle) {
      const subY = 2.2 + (lines * fit.fontPt * 1.08) / 72 + 0.25
      tx(slide, deck.subtitle, { x: 0.9, y: subY, w: 7.5, h: 0.5, fontSize: 16, color: DAWN.soft })
    }
    tx(slide, `${brand} · ${dateLabel()}`, { x: 0.9, y: 6.6, w: 7, h: 0.32, fontSize: 9, color: DAWN.soft })
  },

  section(slide, no, title) {
    // 全版琥珀滿色 — 大膽、低年級啱（白字大字 contrast 達標）
    slide.background = { color: DAWN.accent }
    tx(slide, pad2(no), { x: 8.7, y: 1.95, w: 3.8, h: 2.1, fontSize: 120, bold: true, color: mix('FFFFFF', DAWN.accent, 0.25), fontFace: 'Arial', align: 'right' })
    tx(slide, title, { x: 0.9, y: 3.35, w: 8, h: 1.6, fontSize: 34, bold: true, color: 'FFFFFF' })
    hline(slide, 0.9, 6.8, 3.6, 'FFFFFF')
  },

  contentFrame(slide, ctx) {
    slide.background = { color: 'FFFFFF' }
    const { body, shift } = scaffold(slide, dawn, ctx, { kickerY: 0.56, titleY: 0.88, hairline: false })
    // 結構靠卡片：bullets／配圖版 body 包喺 tint 圓角大卡
    if (ctx.layout === 'bullets') {
      const cardW = ctx.hasPhoto ? 6.8 : ctx.hasChart ? 5.45 : 11.63
      const cardY = 2.15 + shift
      slide.addShape('roundRect', { x: 0.85, y: cardY, w: cardW, h: 6.6 - cardY, rectRadius: 0.12, fill: { color: DAWN.panel }, line: { type: 'none' } })
      drawFooter(slide, dawn, ctx)
      // 內文喺卡內縮入 0.45
      return { x: 1.3, y: cardY + 0.25, w: cardW - 0.9, h: 6.6 - cardY - 0.5 }
    }
    drawFooter(slide, dawn, ctx)
    return body
  },
}

// ============================================================
//  夜讀 nocturne
// ============================================================

const NOC = { bg: '101826', ink: 'F8FAFC', soft: '94A3B8', faint: '55657F', hair: '2A3447', accent: 'D4A94E', panel: '1B2435' }

const nocturne: Pack = {
  id: 'nocturne',
  name: '夜讀',
  hint: '投影最佳 · 列印耗墨',
  swatches: ['#101826', '#D4A94E', '#1B2435'],
  dark: true,
  bg: NOC.bg,
  ink: NOC.ink,
  inkSoft: NOC.soft,
  faint: NOC.faint,
  hair: NOC.hair,
  accent: NOC.accent,
  statColor: NOC.accent,
  panel: NOC.panel,
  cardRadius: 0.06,
  displayFont: 'Georgia',
  displayItalic: true,
  pageNoColor: NOC.accent,
  chartColors: ['D4A94E', '7E93B8', 'F8FAFC', '55657F'],
  chartGridColor: NOC.hair,
  bulletPt: [18, 18, 17, 16, 16],
  titlePt: 28,
  marker: { kind: 'dash', color: NOC.accent, indent: 0.4 },
  tileStyle: 'panel',
  compareStyle: 'panels',
  stepNode: { kind: 'circleOutline', size: 0.34, color: NOC.accent, numColor: NOC.accent },
  quoteMark: { kind: 'glyph', color: mix(NOC.accent, NOC.bg, 0.3) },
  splitPhoto: 'bleedScrim',

  cover(slide, deck, brand, img) {
    slide.background = { color: NOC.bg }
    if (img) {
      // full-bleed 相打底 + 深底 scrim（shape fill transparency 正常 work）
      addCoverImage(slide, img, { x: 0, y: 0, w: 13.33, h: 7.5 })
      slide.addShape('rect', { x: 0, y: 0, w: 13.33, h: 7.5, fill: { color: NOC.bg, transparency: 62 }, line: { type: 'none' } })
    }
    goldPair(slide, 0.9, 0.7, 3.3)
    tx(slide, '教學簡報 · TEACHING DECK', { x: 0.9, y: 0.95, w: 7, h: 0.32, fontSize: 10, color: NOC.accent, charSpacing: 4, bold: true })
    const fit = fitTitle(deck.title, 'cover')
    const pt = Math.min(42, fit.fontPt)
    const lines = Math.max(1, Math.min(2, estimateLines(deck.title, pt, 10.8)))
    tx(slide, deck.title, { x: 0.9, y: 2.55, w: 10.8, h: 1.5, fontSize: pt, bold: true, color: NOC.ink, lineSpacingMultiple: 1.1, fit: 'shrink' })
    if (deck.subtitle) {
      const subY = 2.55 + (lines * pt * 1.1) / 72 + 0.25
      tx(slide, deck.subtitle, { x: 0.9, y: subY, w: 10.5, h: 0.5, fontSize: 15, color: NOC.soft })
    }
    tx(slide, brand, { x: 0.9, y: 7.05, w: 5, h: 0.3, fontSize: 8, color: NOC.faint })
    if (img) {
      tx(slide, img.credit, { x: 9.4, y: 6.72, w: 3.4, h: 0.26, fontSize: 8, color: NOC.soft, align: 'right' })
    }
    tx(slide, dateLabel(), { x: 9.4, y: 7.02, w: 3.4, h: 0.3, fontSize: 10, color: NOC.accent, fontFace: 'Georgia', italic: true, align: 'right' })
  },

  section(slide, no, title) {
    slide.background = { color: NOC.bg }
    // ghost 數字提亮到 50% 金，深底投影都讀到「金」
    tx(slide, pad2(no), { x: 0.8, y: 1.15, w: 6, h: 2.9, fontSize: 150, color: mix(NOC.accent, NOC.bg, 0.5), fontFace: 'Georgia', italic: true })
    tx(slide, title, { x: 0.9, y: 4.5, w: 11, h: 1.2, fontSize: 30, bold: true, color: NOC.ink })
    goldPair(slide, 0.9, 6.85, 2.7)
  },

  contentFrame(slide, ctx) {
    slide.background = { color: NOC.bg }
    const { body } = scaffold(slide, nocturne, ctx, { kickerY: 0.58, titleY: 0.9, hairline: true })
    drawFooter(slide, nocturne, ctx)
    return body
  },
}

// ============================================================
//  方格 grid
// ============================================================

const GRD = { ink: '0F172A', soft: '64748B', faint: '94A3B8', hair: 'E2E8F0', accent: '1E40AF', cross: '94A3B8', crossSoft: 'CBD5E1' }

const grid: Pack = {
  id: 'grid',
  name: '方格',
  hint: '數理精準 · 網格理性',
  swatches: ['#1E40AF', '#0F172A', '#E2E8F0'],
  dark: false,
  bg: 'FFFFFF',
  ink: GRD.ink,
  inkSoft: GRD.soft,
  faint: GRD.faint,
  hair: GRD.hair,
  accent: GRD.accent,
  statColor: GRD.accent,
  panel: 'F1F5F9',
  cardRadius: 0,
  displayFont: 'Arial',
  displayItalic: false,
  pageNoColor: GRD.soft,
  chartColors: ['1E40AF', '8BA0D7', '64748B', 'CBD5E1'],
  chartGridColor: GRD.hair,
  bulletPt: [17, 17, 16, 16, 15],
  titlePt: 28,
  marker: { kind: 'square', size: 0.1, color: GRD.accent, indent: 0.32 },
  tileStyle: 'cellBorder',
  compareStyle: 'abGrid',
  stepNode: { kind: 'squareFill', size: 0.3, color: GRD.accent, numColor: 'FFFFFF' },
  quoteMark: { kind: 'square', size: 0.14, color: GRD.accent },
  splitPhoto: 'bleedHair',

  cover(slide, deck, brand, img) {
    slide.background = { color: 'FFFFFF' }
    // 四角準星
    crosshair(slide, 0.55, 0.55, 0.28, GRD.cross)
    crosshair(slide, 12.78, 0.55, 0.28, GRD.cross)
    crosshair(slide, 0.55, 6.95, 0.28, GRD.cross)
    crosshair(slide, 12.78, 6.95, 0.28, GRD.cross)
    // meta 行
    tx(slide, 'TEACHING DECK · 教學簡報', { x: 0.9, y: 0.95, w: 6, h: 0.3, fontSize: 9, color: GRD.soft, charSpacing: 2, bold: true })
    tx(slide, dateLabel(), { x: 8.43, y: 0.95, w: 4, h: 0.3, fontSize: 9, color: GRD.soft, align: 'right' })
    // 鈷藍方 + 題
    slide.addShape('rect', { x: 0.9, y: 2.42, w: 0.16, h: 0.16, fill: { color: GRD.accent }, line: { type: 'none' } })
    const titleW = img ? 5.6 : 11
    const fit = fitTitle(deck.title, 'cover')
    const pt = Math.min(40, fit.fontPt)
    const lines = Math.max(1, Math.min(2, estimateLines(deck.title, pt, titleW)))
    tx(slide, deck.title, { x: 0.9, y: 2.7, w: titleW, h: 1.5, fontSize: pt, bold: true, color: GRD.ink, lineSpacingMultiple: 1.08, fit: 'shrink' })
    if (deck.subtitle) {
      const subY = 2.7 + (lines * pt * 1.08) / 72 + 0.22
      tx(slide, deck.subtitle, { x: 0.9, y: subY, w: img ? 5.4 : 10, h: 0.5, fontSize: 15, color: GRD.soft })
    }
    // 底部 meta（tabular 感）
    tx(slide, `共 ${deck.slides.length + 1} 版 ｜ ${brand}`, { x: 0.9, y: 6.35, w: 6, h: 0.3, fontSize: 9, color: GRD.soft })
    if (img) {
      // 右半精準方裁 + 框線（制圖感）
      const frame: Rect = { x: 6.87, y: 1.6, w: 5.9, h: 4.3 }
      addCoverImage(slide, img, frame)
      slide.addShape('rect', { x: frame.x, y: frame.y, w: frame.w, h: frame.h, fill: { type: 'none' }, line: { color: GRD.hair, width: 0.75 } })
      tx(slide, img.credit, { x: 6.87, y: 5.98, w: 5.9, h: 0.26, fontSize: 8, color: GRD.faint, align: 'right' })
    }
  },

  section(slide, no, title) {
    slide.background = { color: 'FFFFFF' }
    crosshair(slide, 0.55, 0.55, 0.28, GRD.cross)
    crosshair(slide, 12.78, 6.95, 0.28, GRD.cross)
    tx(slide, pad2(no), { x: 0.7, y: 1.4, w: 7, h: 2.8, fontSize: 140, bold: true, color: mix(GRD.accent, 'FFFFFF', 0.12), fontFace: 'Arial' })
    slide.addShape('rect', { x: 0.9, y: 4.45, w: 0.16, h: 0.16, fill: { color: GRD.accent }, line: { type: 'none' } })
    tx(slide, title, { x: 0.9, y: 4.72, w: 11, h: 1.2, fontSize: 30, bold: true, color: GRD.ink })
    hline(slide, 0.9, 6.6, 11.53, GRD.hair)
  },

  contentFrame(slide, ctx) {
    slide.background = { color: 'FFFFFF' }
    // 左上 + 右下細準星（減噪版；配圖出血時右下省略）
    crosshair(slide, 0.55, 0.55, 0.2, GRD.crossSoft)
    if (!ctx.hasPhoto) crosshair(slide, 12.78, 6.95, 0.2, GRD.crossSoft)
    const { body } = scaffold(slide, grid, ctx, { kickerY: 0.6, titleY: 0.9, hairline: true })
    drawFooter(slide, grid, ctx)
    return body
  },
}

// ============================================================
//  講堂 seminar — 研討發佈級深藍金（參照 EDB sharing deck 風格）
//  · header band：深藍頂帶 + 金線（running header，雙語 microcopy）
//  · 雙語層次：中文大題 + 英文副題（subtitle）係本 pack 嘅靈魂
//  · 章節：全藍 + 右上超大 ghost 數字；頁碼「13 / 23」分數格式
// ============================================================

const SEM = {
  ink: '14283C',
  soft: '5B6B7C',
  faint: '93A1B0',
  hair: 'D9E1E8',
  navy: '0A2C51', // header／包底帶
  coverBg: '16395E',
  accent: '155E74', // teal kicker／marker
  gold: 'B08C3E',
  panel: 'EBF3F5', // 冰青 callout
}

/** 講堂 header band：深藍頂帶 + 金線 + 雙語 microcopy */
function seminarHeaderBand(slide: PptxGenJS.Slide, brand: string): void {
  slide.addShape('rect', { x: 0, y: 0, w: 13.33, h: 0.42, fill: { color: SEM.navy }, line: { type: 'none' } })
  slide.addShape('rect', { x: 0, y: 0.42, w: 13.33, h: 0.024, fill: { color: SEM.gold }, line: { type: 'none' } })
  tx(slide, brand.toUpperCase(), { x: 0.9, y: 0.1, w: 6, h: 0.26, fontSize: 8, color: 'FFFFFF', charSpacing: 2, bold: true })
  tx(slide, '教學簡報 · TEACHING DECK', { x: 7.43, y: 0.1, w: 5, h: 0.26, fontSize: 8, color: 'A9BDD1', charSpacing: 1, align: 'right' })
}

const seminar: Pack = {
  id: 'seminar',
  name: '講堂',
  hint: '研討發佈 · 深藍金',
  swatches: ['#0A2C51', '#B08C3E', '#EBF3F5'],
  dark: false,
  bg: 'FFFFFF',
  ink: SEM.ink,
  inkSoft: SEM.soft,
  faint: SEM.faint,
  hair: SEM.hair,
  accent: SEM.accent,
  statColor: SEM.navy,
  panel: SEM.panel,
  cardRadius: 0.05,
  displayFont: 'Arial',
  displayItalic: false,
  pageNoColor: SEM.soft,
  pageNoFraction: true,
  chartColors: ['0A2C51', '155E74', 'B08C3E', '8FA3B5'],
  chartGridColor: SEM.hair,
  bulletPt: [18, 17, 16, 16, 15],
  titlePt: 30,
  marker: { kind: 'dot', size: 0.09, color: SEM.accent, indent: 0.3 },
  tileStyle: 'hairline',
  compareStyle: 'panels',
  stepNode: { kind: 'circleOutline', size: 0.34, color: SEM.accent, numColor: SEM.accent },
  quoteMark: { kind: 'glyph', color: SEM.gold },
  splitPhoto: 'bleedHair',

  cover(slide, deck, brand, img) {
    slide.background = { color: SEM.coverBg }
    if (img) {
      addCoverImage(slide, img, { x: 0, y: 0, w: 13.33, h: 7.5 })
      // 深藍 scrim 保白字（shape fill transparency 正常 work）
      slide.addShape('rect', { x: 0, y: 0, w: 13.33, h: 7.5, fill: { color: SEM.coverBg, transparency: 28 }, line: { type: 'none' } })
    }
    // 金短線 + kicker
    slide.addShape('rect', { x: 0.9, y: 0.82, w: 1.1, h: 0.03, fill: { color: SEM.gold }, line: { type: 'none' } })
    tx(slide, 'TEACHING DECK · 教學簡報', { x: 0.9, y: 1.0, w: 8, h: 0.3, fontSize: 10, color: SEM.gold, charSpacing: 4, bold: true })
    const fit = fitTitle(deck.title, 'cover')
    tx(slide, deck.title, { x: 0.9, y: 2.45, w: 11.4, h: 2.0, fontSize: fit.fontPt, bold: true, color: 'FFFFFF', lineSpacingMultiple: 1.08, fit: 'shrink' })
    if (deck.subtitle) {
      tx(slide, deck.subtitle, { x: 0.9, y: 4.55, w: 10.5, h: 0.5, fontSize: 16, color: 'C7D3DF' })
    }
    // 底部 meta block（研討會式：金髮線 + 日期／版數／品牌兩行）
    slide.addShape('rect', { x: 0.9, y: 6.18, w: 1.1, h: 0.024, fill: { color: SEM.gold }, line: { type: 'none' } })
    tx(slide, `${dateLabel()} ｜ 共 ${deck.slides.length + 1} 版`, { x: 0.9, y: 6.38, w: 8, h: 0.3, fontSize: 10, color: 'C7D3DF' })
    tx(slide, brand, { x: 0.9, y: 6.74, w: 8, h: 0.3, fontSize: 9, color: '8FA3B5' })
    if (img?.credit) {
      tx(slide, img.credit, { x: 8.93, y: 7.06, w: 3.9, h: 0.26, fontSize: 8, color: '8FA3B5', align: 'right' })
    }
  },

  section(slide, no, title) {
    slide.background = { color: SEM.navy }
    // 右上超大 ghost 數字（研討 deck 標誌）
    tx(slide, pad2(no), {
      x: 6.9,
      y: 0.45,
      w: 6,
      h: 3.2,
      fontSize: 170,
      bold: true,
      color: mix('FFFFFF', SEM.navy, 0.14),
      fontFace: 'Arial',
      align: 'right',
    })
    slide.addShape('rect', { x: 0.9, y: 3.95, w: 1.1, h: 0.03, fill: { color: SEM.gold }, line: { type: 'none' } })
    tx(slide, `SECTION ${sectionWord(no)}`, { x: 0.9, y: 4.12, w: 6, h: 0.3, fontSize: 10, color: SEM.gold, charSpacing: 4, bold: true })
    tx(slide, title, { x: 0.9, y: 4.55, w: 11.2, h: 1.4, fontSize: 32, bold: true, color: 'FFFFFF', lineSpacingMultiple: 1.08 })
  },

  contentFrame(slide, ctx) {
    slide.background = { color: 'FFFFFF' }
    seminarHeaderBand(slide, ctx.brand)
    const { body } = scaffold(slide, seminar, ctx, { kickerY: 0.85, titleY: 1.15, hairline: true, offset: 0.25 })
    hline(slide, 0.9, 6.92, 11.53, SEM.hair)
    drawFooter(slide, seminar, ctx)
    return body
  },
}

// ───────── 滙出 ─────────
// 完整 PACKS／PACK_LIST 喺 pptx.ts 組裝（本檔 6 套核心 + gallery 兩檔 10 套）

export const CORE_PACKS: Pack[] = [inkwell, celadon, dawn, nocturne, grid, seminar]
