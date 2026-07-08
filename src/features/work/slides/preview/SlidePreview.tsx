// ============================================================
//  單版螢幕預覽 — 按 effectiveLayout 分派（同 .pptx 一致降級）
//  ------------------------------------------------------------
//  固定 16:9，內層用 em 為單位做 padding-based 縮放（card / full 兩 mode
//  靠外層 font-size 控制比例）。螢幕係近似：takeaway 色帶／emphasis L-frame／
//  imageQuery 圖位都係仿引擎示意，不是像素對齊。
// ============================================================

import { Image as ImageIcon } from 'lucide-react'
import type { JSX } from 'react'
import type { Slide } from '../../../../lib/export/types'
import { effectiveLayout, type PackTheme } from '../../../../lib/export'
import {
  BulletsView,
  CardsView,
  ChartView,
  CompareView,
  QuoteView,
  SectionView,
  StatsView,
  StepsView,
} from './layouts'

export function SlidePreview(props: {
  slide: Slide
  index: number
  theme: PackTheme
  mode?: 'card' | 'full'
}): JSX.Element {
  const { slide, index, theme, mode = 'card' } = props
  const layout = effectiveLayout(slide)
  // em 基準字級：card 縮細、full 放大；所有子元件用 em 自動縮放
  const fontSize = mode === 'full' ? '34px' : '20px'

  let body: JSX.Element
  switch (layout) {
    case 'stats':
      body = <StatsView slide={slide} index={index} theme={theme} />
      break
    case 'compare':
      body = <CompareView slide={slide} index={index} theme={theme} />
      break
    case 'steps':
      body = <StepsView slide={slide} index={index} theme={theme} />
      break
    case 'quote':
      body = <QuoteView slide={slide} index={index} theme={theme} />
      break
    case 'cards':
      body = <CardsView slide={slide} index={index} theme={theme} />
      break
    case 'section':
      body = <SectionView slide={slide} index={index} theme={theme} />
      break
    default:
      body = <BulletsView slide={slide} index={index} theme={theme} />
  }

  const hasChart = layout === 'bullets' && Boolean(slide.chart)

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{ fontSize, background: 'var(--pv-bg)', color: 'var(--pv-ink)' }}
    >
      {/* emphasis：accent L-frame 角飾（仿引擎 renderEmphasisFrame） */}
      {slide.emphasis && (
        <>
          <span className="pointer-events-none absolute left-[0.5em] top-[0.5em] h-[0.9em] w-[0.9em] border-l-2 border-t-2" style={{ borderColor: 'var(--pv-accent)' }} />
          <span className="pointer-events-none absolute bottom-[0.5em] right-[0.5em] h-[0.9em] w-[0.9em] border-b-2 border-r-2" style={{ borderColor: 'var(--pv-accent)' }} />
        </>
      )}

      <div className="flex h-full flex-col p-[0.7em]">
        <div className="min-h-0 flex-1">{body}</div>

        {/* bullets 版有 chart → 底部疊極簡 SVG */}
        {hasChart && (
          <div className="mt-[0.3em] h-[2.2em] w-full">
            <ChartView slide={slide} theme={theme} />
          </div>
        )}

        {/* takeaway 色帶（仿引擎 takeaway band） */}
        {slide.takeaway && layout !== 'section' && (
          <div
            className="mt-[0.3em] line-clamp-1 rounded-[0.2em] px-[0.5em] py-[0.25em] text-[0.44em] font-medium"
            style={{ background: 'var(--pv-panel)', color: 'var(--pv-ink)' }}
          >
            {slide.takeaway}
          </div>
        )}
      </div>

      {/* imageQuery 角落小圖位（螢幕不 fetch，慳 API） */}
      {slide.imageQuery && (
        <span
          className="pointer-events-none absolute right-[0.5em] top-[0.5em] inline-flex items-center gap-[0.2em] rounded-[0.2em] px-[0.3em] py-[0.15em] text-[0.36em]"
          style={{ background: 'var(--pv-panel)', color: 'var(--pv-faint)' }}
        >
          <ImageIcon className="h-[0.9em] w-[0.9em]" /> 配圖
        </span>
      )}
    </div>
  )
}
