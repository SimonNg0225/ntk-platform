// ============================================================
//  pptx 文字 metrics — 純函式層（有單元測試）
//  ------------------------------------------------------------
//  · mix()           — 預混色：pptxgenjs text transparency 靠唔住，
//                      所有「淡色」一律喺 build 時預混做實色
//  · estimateLines() — CJK 行數估算（row 引擎排版用，寧鬆勿迫）
//  · fitTitle()      — 長題階梯（版題 / 封面兩條梯）
//  · clampText()     — 截長加省略號
//  本檔唔准 import pptxgenjs（保持純函式、node 直接測）。
// ============================================================

/** 行高（吋）— 全引擎統一 1.32 倍行距 */
export function lineHeightIn(fontPt: number): number {
  return (fontPt * 1.32) / 72
}

function hexChannel(hex: string, i: number): number {
  return parseInt(hex.slice(i * 2, i * 2 + 2), 16)
}

/**
 * 預混色：將前景色按 t（前景比重 0-1）混入背景色，輸出 6 位 hex（無 #）。
 * 用嚟取代 text transparency（pptxgenjs 冇 color 配對時會略過 alpha）。
 */
export function mix(fgHex: string, bgHex: string, t: number): string {
  const fg = fgHex.replace('#', '').toUpperCase()
  const bg = bgHex.replace('#', '').toUpperCase()
  const k = Math.min(1, Math.max(0, t))
  let out = ''
  for (let i = 0; i < 3; i++) {
    const v = Math.round(hexChannel(fg, i) * k + hexChannel(bg, i) * (1 - k))
    out += v.toString(16).padStart(2, '0').toUpperCase()
  }
  return out
}

/** 單字闊度（em）：CJK／全形標點 = 1.0，ASCII／數字 = 0.55 */
function charEm(ch: string): number {
  const cp = ch.codePointAt(0) ?? 0
  return cp <= 0xff ? 0.55 : 1
}

/**
 * 估算一段文字喺指定字級／欄闊下佔幾多行（≥1）。
 * 估闊 = Σem × pt/72 × 1.06（1.06 係保守係數：字距 + 標點擠壓）。
 */
export function estimateLines(text: string, fontPt: number, widthIn: number): number {
  if (widthIn <= 0) return 1
  let em = 0
  for (const ch of text) em += charEm(ch)
  const estWidth = ((em * fontPt) / 72) * 1.06
  return Math.max(1, Math.ceil(estWidth / widthIn))
}

export interface TitleFit {
  fontPt: number
  /** 階梯分配嘅行數上限（實際行數另用 estimateLines 計） */
  lines: 1 | 2
}

/**
 * 長題階梯 — 字級全部 code 計死，唔依賴 fit:'shrink'。
 * 版題：≤12 字 30pt/1 行、13-16 字 28pt/1 行、17-22 字 26pt/2 行、>22 字 24pt/2 行。
 * 封面：≤14 字 44pt、15-20 字 40pt、>20 字 36pt（一律俾 2 行位）。
 */
export function fitTitle(title: string, mode: 'content' | 'cover' = 'content'): TitleFit {
  const len = [...title.trim()].length
  if (mode === 'cover') {
    if (len <= 14) return { fontPt: 44, lines: 2 }
    if (len <= 20) return { fontPt: 40, lines: 2 }
    return { fontPt: 36, lines: 2 }
  }
  if (len <= 12) return { fontPt: 30, lines: 1 }
  if (len <= 16) return { fontPt: 28, lines: 1 }
  if (len <= 22) return { fontPt: 26, lines: 2 }
  return { fontPt: 24, lines: 2 }
}

/** 截長：超過 max 字元就裁短加「…」（結果長度 = max） */
export function clampText(s: string, max: number): string {
  const chars = [...s]
  if (chars.length <= max) return s
  return chars.slice(0, Math.max(0, max - 1)).join('') + '…'
}
