// ============================================================
//  整套簡報螢幕預覽 — 16:9 卡片格
//  ------------------------------------------------------------
//  封面卡 + 每版一張 SlidePreview，responsive grid。
//  配色／字體由 packTheme 抽真實 token，貼近 .pptx（近似，非像素完美）。
//  click 卡 → onSelect（回 SlideGen 入逐版編輯）；streaming 時追 skeleton 卡。
// ============================================================

import { Loader2 } from 'lucide-react'
import type { CSSProperties, JSX } from 'react'
import type { Slide } from '../../../../lib/export/types'
import { packTheme, type SlidePackId } from '../../../../lib/export'
import { cx } from '../../../../ui'
import { cssVarsFromTheme } from './theme'
import { SlidePreview } from './SlidePreview'

export interface DeckPreviewDeck {
  title: string
  subtitle?: string
  slides: Slide[]
  coverImageQuery?: string
}

export default function DeckPreview(props: {
  deck: DeckPreviewDeck
  pack: SlidePackId
  activeIndex?: number
  onSelect?: (i: number) => void
  streaming?: boolean
  /** 固定欄數（窄面板用）；不傳就跟 viewport 響應式 1/2/3 欄 */
  cols?: 1 | 2 | 3
}): JSX.Element {
  const { deck, pack, activeIndex, onSelect, streaming, cols } = props
  const gridCols =
    cols === 1 ? 'grid-cols-1' : cols === 2 ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
  const theme = packTheme(pack)
  const vars = cssVarsFromTheme(theme)

  return (
    <div style={vars as unknown as CSSProperties}>
      <p className="mb-2 text-[11px] text-slate-400 dark:text-slate-500">
        畫面會貼近下載檔；下載後可在 PowerPoint 或 Google Slides 繼續編輯。
      </p>
      <div className={`grid gap-3 ${gridCols}`}>
        {/* 封面卡 */}
        <div
          className="aspect-[16/9] overflow-hidden rounded-xl ring-1 ring-black/[0.06] dark:ring-white/[0.08]"
          style={{ background: 'var(--pv-bg)' }}
        >
          <div className="flex h-full flex-col justify-center p-[1.2em]" style={{ fontSize: '20px' }}>
            <span className="h-[0.15em] w-[2em] rounded-full" style={{ background: 'var(--pv-accent)' }} />
            <h3
              className="mt-[0.4em] line-clamp-3 text-[1.05em] font-semibold leading-tight"
              style={{ color: 'var(--pv-ink)', fontFamily: 'var(--pv-display-font)', fontStyle: theme.displayItalic ? 'italic' : 'normal' }}
            >
              {deck.title}
            </h3>
            {deck.subtitle && (
              <p className="mt-[0.25em] line-clamp-2 text-[0.5em]" style={{ color: 'var(--pv-faint)' }}>
                {deck.subtitle}
              </p>
            )}
          </div>
        </div>

        {/* 逐版卡 */}
        {deck.slides.map((s, i) => {
          const selectable = Boolean(onSelect)
          return (
            <button
              key={i}
              type="button"
              disabled={!selectable}
              onClick={() => onSelect?.(i)}
              className={cx(
                'group relative aspect-[16/9] overflow-hidden rounded-xl text-left ring-1 transition',
                selectable && 'hover:ring-accent/50 active:scale-[0.99]',
                activeIndex === i
                  ? 'ring-2 ring-accent'
                  : 'ring-black/[0.06] dark:ring-white/[0.08]',
              )}
            >
              <SlidePreview slide={s} index={i} theme={theme} />
              <span className="absolute bottom-1 right-1.5 rounded bg-black/45 px-1 text-[10px] font-medium leading-tight text-white">
                {i + 1}
              </span>
            </button>
          )
        })}

        {/* streaming：生成中…骨架卡 */}
        {streaming && (
          <div
            className="flex aspect-[16/9] items-center justify-center gap-2 rounded-xl ring-1 ring-dashed ring-accent/30"
            style={{ background: 'var(--pv-panel)' }}
          >
            <Loader2 className="h-4 w-4 animate-spin" style={{ color: 'var(--pv-accent)' }} />
            <span className="text-xs" style={{ color: 'var(--pv-faint)' }}>
              生成中…
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
