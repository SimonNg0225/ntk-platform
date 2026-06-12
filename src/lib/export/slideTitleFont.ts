// ============================================================
//  高擬真標題 — Canvas 把標題用招牌字體 render 成圖（跨平台一致）
//  ------------------------------------------------------------
//  嵌入字體跨平台唔可靠（Mac/Keynote/Google Slides 會走樣），所以改成：
//  瀏覽器用招牌 webfont 喺 Canvas 畫標題 → PNG → 當圖擺落封面。
//  係圖片，所以邊個 app 開都一致；正文維持原生可編輯。
//  字體唔打包：用先至從 CDN（jsdelivr）載 fontsource CSS（unicode-range
//  分割，瀏覽器只攞用到嗰幾隻字 ~50KB），deploy 零字體重量。
//  全程 browser-guarded + try/catch：任何失敗回 null → cover 用返原生標題。
// ============================================================

import type { CoverTitle } from './types'
export type { CoverTitle }

// CDN（jsdelivr）fontsource CSS — 用先至載，瀏覽器按 unicode-range 只攞用到嗰幾隻字
const WENKAI = 'https://cdn.jsdelivr.net/npm/@fontsource/lxgw-wenkai-tc@5/index.css' // 文楷（繁體楷/毛筆）OFL
const NOTOSERIF = 'https://cdn.jsdelivr.net/npm/@fontsource/noto-serif-tc@5/index.css' // 思源宋（繁體明體）OFL
const PRESSSTART = 'https://cdn.jsdelivr.net/npm/@fontsource/press-start-2p@5/index.css' // 像素（latin）OFL

/** pack → 招牌標題字體（family + CDN CSS + latinOnly）。只列有招牌字體嘅 pack。 */
const FONT_BY_PACK: Record<string, { family: string; css: string; latinOnly?: boolean }> = {
  // 文楷 — 書卷／學院／研討／青瓷／夜讀／水墨（楷書毛筆，文氣）
  sumi: { family: 'LXGW WenKai TC', css: WENKAI },
  inkwell: { family: 'LXGW WenKai TC', css: WENKAI },
  ivy: { family: 'LXGW WenKai TC', css: WENKAI },
  seminar: { family: 'LXGW WenKai TC', css: WENKAI },
  celadon: { family: 'LXGW WenKai TC', css: WENKAI },
  nocturne: { family: 'LXGW WenKai TC', css: WENKAI },
  // 思源宋 — 典藏／手抄本（明體，古典正式）
  marble: { family: 'Noto Serif TC', css: NOTOSERIF },
  manuscript: { family: 'Noto Serif TC', css: NOTOSERIF },
  // 像素 latin（英文題先有，中文 fallback）
  pixel: { family: 'Press Start 2P', css: PRESSSTART, latinOnly: true },
}

const CJK = /[㐀-鿿豈-﫿]/

/** 邊個 pack 有招牌字體（UI 決定顯唔顯「高擬真」toggle 用） */
export function hasTitleFont(packId: string): boolean {
  return packId in FONT_BY_PACK
}

const cssLoaded = new Map<string, Promise<void>>()
function ensureCss(href: string): Promise<void> {
  const cached = cssLoaded.get(href)
  if (cached) return cached
  const p = new Promise<void>((resolve) => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = href
    link.onload = () => resolve()
    link.onerror = () => resolve() // 失敗都 resolve，靠下面 fonts.load 兜
    document.head.appendChild(link)
  })
  cssLoaded.set(href, p)
  return p
}

/**
 * 把 text 用 packId 嘅招牌字體 render 成 PNG。
 * 瀏覽器先有；無字體／失敗回 null（cover fallback 原生標題）。
 */
export async function renderTitleImage(text: string, packId: string, color: string, sizePx = 160): Promise<CoverTitle | null> {
  if (typeof document === 'undefined') return null
  const f = FONT_BY_PACK[packId]
  if (!f || !text.trim()) return null
  if (f.latinOnly && CJK.test(text)) return null // latin 字體遇中文 → 回 null（用原生標題）
  try {
    await ensureCss(f.css)
    const fontSpec = `${sizePx}px "${f.family}"`
    if (typeof document.fonts !== 'undefined' && document.fonts.load) {
      await document.fonts.load(fontSpec, text)
    }
    const measure = document.createElement('canvas').getContext('2d')
    if (!measure) return null
    measure.font = fontSpec
    const padX = Math.ceil(sizePx * 0.18)
    const w = Math.ceil(measure.measureText(text).width) + padX * 2
    const h = Math.ceil(sizePx * 1.5)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const x = canvas.getContext('2d')
    if (!x) return null
    x.font = fontSpec
    x.fillStyle = color.startsWith('#') ? color : `#${color}`
    x.textBaseline = 'middle'
    x.fillText(text, padX, h / 2)
    return { dataUri: canvas.toDataURL('image/png'), aspect: w / h }
  } catch {
    return null
  }
}
