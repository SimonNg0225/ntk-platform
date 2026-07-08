// ============================================================
//  螢幕預覽主題 → CSS 變數
//  ------------------------------------------------------------
//  把 export 層的 PackTheme（純 hex 無 #）轉成帶 # 的 CSS 變數，
//  令 DeckPreview / SlidePreview 用一致配色貼近 .pptx。
//  螢幕版係近似（不行真引擎），漸層／招牌 override 不會 1:1。
// ============================================================

import { packTheme, type PackTheme, type SlidePackId } from '../../../../lib/export'

/** PackTheme token（hex 無 #）→ CSS 色（加 #） */
function h(hex: string): string {
  return `#${hex}`
}

/** preview 用的 CSS 變數集（帶 #） */
export interface PreviewCssVars {
  '--pv-bg': string
  '--pv-ink': string
  '--pv-ink-soft': string
  '--pv-faint': string
  '--pv-hair': string
  '--pv-accent': string
  '--pv-stat': string
  '--pv-panel': string
  '--pv-panel-alt': string
  '--pv-chart-grid': string
  '--pv-display-font': string
}

/** 由 PackTheme 砌 CSS 變數（已加 #）。 */
export function cssVarsFromTheme(t: PackTheme): PreviewCssVars {
  return {
    '--pv-bg': h(t.bg),
    '--pv-ink': h(t.ink),
    '--pv-ink-soft': h(t.inkSoft),
    '--pv-faint': h(t.faint),
    '--pv-hair': h(t.hair),
    '--pv-accent': h(t.accent),
    '--pv-stat': h(t.statColor),
    '--pv-panel': h(t.panel),
    '--pv-panel-alt': h(t.panelAlt ?? t.panel),
    '--pv-chart-grid': h(t.chartGridColor),
    '--pv-display-font': `${t.displayFont}, Georgia, serif`,
  }
}

/** 由 pack id 直接取得 CSS 變數（UI helper）。 */
export function cssTheme(id: SlidePackId): PreviewCssVars {
  return cssVarsFromTheme(packTheme(id))
}

/** 加 # 的單色（子元件偶然要直接落 inline color 時用）。 */
export function hash(hex: string): string {
  return h(hex)
}
