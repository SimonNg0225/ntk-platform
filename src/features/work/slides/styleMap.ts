import type { CSSProperties } from 'react'
import type { Theme } from './themes'

// theme → CSS custom properties（HTML renderer 與 Phase 2 pptx 都讀同一套值）
export function themeVars(theme: Theme): Record<string, string> {
  const { palette, fonts } = theme.tokens
  return {
    '--sl-bg': palette.bg,
    '--sl-surface': palette.surface,
    '--sl-primary': palette.primary,
    '--sl-accent': palette.accent,
    '--sl-text': palette.text,
    '--sl-muted': palette.muted,
    '--sl-font-display': fonts.display,
    '--sl-font-body': fonts.body,
    '--sl-radius': `${theme.tokens.shape.radius}px`,
  }
}

export function themeStyle(theme: Theme): CSSProperties {
  return themeVars(theme) as CSSProperties
}
