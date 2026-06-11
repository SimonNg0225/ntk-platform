import type { Deck, Slide } from '../../../lib/export/types'

// ============================================================
//  「跟我嘅分段分版」— 分隔符分頁（純函式，可單元測試）
//  ------------------------------------------------------------
//  用戶貼內容時用 `---` 行或空行斬版：每段首行＝該版標題、其餘＝內文行。
//  AI 收到呢個框架後只准精煉每版內文（buildFrameworkSystem 鎖死版數／
//  標題／次序）；AI 失靈（版數對唔上）就用 frameworkToDeck 照搬入版，
//  保證用戶嘅分頁永遠唔會被打亂。
// ============================================================

export interface ManualPage {
  /** 該版標題（段首行） */
  title: string
  /** 內文行（已 trim、去空行） */
  lines: string[]
}

/** 截長（同 slidePrompts clamp 一致：≤max，超出斬到 max-1 加 …）。 */
function clamp(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, Math.max(0, max - 1)) + '…'
}

/**
 * 斬版：`---` 行（3 個或以上連字號）或連續空行做分隔。
 * 每段首行＝標題、其餘＝內文行；空段過濾。
 */
export function parseManualPages(text: string): ManualPage[] {
  const normalized = text.replace(/\r\n?/g, '\n')
  // `---` 行統一換做空段分隔，再用「空行（可含空白）」斬段。
  const blocks = normalized
    .replace(/^[ \t]*-{3,}[ \t]*$/gm, '\n')
    .split(/\n[ \t]*\n+/)
  const pages: ManualPage[] = []
  for (const block of blocks) {
    const lines = block
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    if (lines.length === 0) continue
    pages.push({ title: clamp(lines[0], 40), lines: lines.slice(1) })
  }
  return pages
}

/**
 * 照搬入版（AI 失靈保險）：每版標題＋內文行直接做 bullets（≤6 點、每點 ≤60 字）；
 * 冇內文行嘅段＝章節分隔版（layout 'section'、空 bullets）。
 */
export function frameworkToDeck(pages: ManualPage[], fallbackTitle: string): Deck {
  const slides: Slide[] = pages.map((p) => {
    if (p.lines.length === 0) {
      return { title: p.title || '（未命名）', bullets: [], layout: 'section' }
    }
    return {
      title: p.title || '（未命名）',
      bullets: p.lines.slice(0, 6).map((l) => clamp(l, 60)),
    }
  })
  return { title: fallbackTitle || '教學簡報', slides }
}

/**
 * 偵測內容係咪似有「自己分咗頁」：有 `---` 分隔，或者有 ≥2 段
 * （空行分隔、其中至少一段多過一行）→ 用嚟喺 UI 提示開「跟我嘅分段分版」。
 */
export function detectManualPages(text: string): boolean {
  if (/^[ \t]*-{3,}[ \t]*$/m.test(text.replace(/\r\n?/g, '\n'))) {
    return parseManualPages(text).length >= 2
  }
  const pages = parseManualPages(text)
  return pages.length >= 2 && pages.some((p) => p.lines.length > 0)
}
