// ============================================================
//  逐 layout 螢幕子 render（純展示元件）
//  ------------------------------------------------------------
//  全部收 { slide, theme }，用 CSS 變數（preview/theme.ts 落喺外層）
//  上色。螢幕版係「近似」：配色 + 版式結構對齊 .pptx，唔求像素完美。
// ============================================================

import type { Slide } from '../../../../lib/export/types'
import type { PackTheme } from '../../../../lib/export'
import { pickKicker } from '../../../../lib/export/pptxPacks'
import { hash } from './theme'

interface ViewProps {
  slide: Slide
  theme: PackTheme
  index: number
}

/** 細 kicker 字（版頂小標）+ 標題 + 可選副題 */
function Header({ slide, index }: { slide: Slide; index: number }) {
  const kicker = pickKicker(slide.title, index, Boolean(slide.chart))
  return (
    <div className="min-w-0">
      <p
        className="truncate text-[0.42em] font-semibold uppercase tracking-[0.25em]"
        style={{ color: 'var(--pv-accent)' }}
      >
        {kicker}
      </p>
      <h3
        className="mt-[0.15em] line-clamp-2 text-[0.95em] font-semibold leading-tight"
        style={{ color: 'var(--pv-ink)', fontFamily: 'var(--pv-display-font)' }}
      >
        {slide.title}
      </h3>
      {slide.subtitle && (
        <p className="mt-[0.1em] truncate text-[0.46em]" style={{ color: 'var(--pv-faint)' }}>
          {slide.subtitle}
        </p>
      )}
    </div>
  )
}

export function BulletsView({ slide, index }: ViewProps) {
  return (
    <div className="flex h-full flex-col">
      <Header slide={slide} index={index} />
      <ul className="mt-[0.4em] flex-1 space-y-[0.32em] overflow-hidden">
        {slide.bullets.slice(0, 6).map((b, i) => (
          <li key={i} className="flex gap-[0.4em] text-[0.5em] leading-snug" style={{ color: 'var(--pv-ink-soft)' }}>
            <span
              className="mt-[0.45em] h-[0.3em] w-[0.3em] shrink-0 rounded-full"
              style={{ background: 'var(--pv-accent)' }}
            />
            <span className="line-clamp-2">{b}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function StatsView({ slide, index }: ViewProps) {
  const stats = (slide.stats ?? []).slice(0, 4)
  return (
    <div className="flex h-full flex-col">
      <Header slide={slide} index={index} />
      <div
        className="mt-[0.4em] grid flex-1 items-center gap-[0.4em]"
        style={{ gridTemplateColumns: `repeat(${Math.min(stats.length || 1, stats.length > 2 ? 2 : stats.length || 1)}, minmax(0,1fr))` }}
      >
        {stats.map((s, i) => (
          <div key={i} className="min-w-0">
            <p className="truncate text-[1.1em] font-bold leading-none" style={{ color: 'var(--pv-stat)', fontFamily: 'var(--pv-display-font)' }}>
              {s.value}
            </p>
            <p className="mt-[0.3em] line-clamp-2 text-[0.44em]" style={{ color: 'var(--pv-ink-soft)' }}>
              {s.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

export function CompareView({ slide, index, theme }: ViewProps) {
  const c = slide.compare
  if (!c) return <BulletsView slide={slide} index={index} theme={theme} />
  const dash = theme.structDash
  const col = (title: string, items: string[], alt: boolean) => (
    <div
      className="flex min-w-0 flex-1 flex-col rounded-[0.3em] p-[0.4em]"
      style={{ background: alt ? 'var(--pv-panel-alt)' : 'var(--pv-panel)' }}
    >
      <p
        className="truncate pb-[0.25em] text-[0.5em] font-semibold"
        style={{ color: 'var(--pv-ink)', borderBottom: `1px ${dash ? 'dashed' : 'solid'} var(--pv-accent)` }}
      >
        {title}
      </p>
      <ul className="mt-[0.3em] space-y-[0.2em] overflow-hidden">
        {items.slice(0, 4).map((it, i) => (
          <li key={i} className="line-clamp-1 text-[0.44em]" style={{ color: 'var(--pv-ink-soft)' }}>
            · {it}
          </li>
        ))}
      </ul>
    </div>
  )
  return (
    <div className="flex h-full flex-col">
      <Header slide={slide} index={index} />
      <div className="mt-[0.4em] flex flex-1 gap-[0.4em] overflow-hidden">
        {col(c.leftTitle, c.left, false)}
        {col(c.rightTitle, c.right, true)}
      </div>
    </div>
  )
}

export function StepsView({ slide, index, theme }: ViewProps) {
  const steps = (slide.steps ?? []).slice(0, 5)
  return (
    <div className="flex h-full flex-col">
      <Header slide={slide} index={index} />
      <div className="mt-[0.4em] flex flex-1 items-stretch gap-[0.3em] overflow-hidden">
        {steps.map((st, i) => (
          <div key={i} className="flex min-w-0 flex-1 items-center gap-[0.3em]">
            <div className="flex min-w-0 flex-1 flex-col items-center text-center">
              <span
                className="flex h-[1.1em] w-[1.1em] items-center justify-center rounded-full text-[0.42em] font-bold"
                style={{ background: 'var(--pv-accent)', color: 'var(--pv-bg)' }}
              >
                {i + 1}
              </span>
              <p className="mt-[0.25em] line-clamp-1 text-[0.42em] font-semibold" style={{ color: 'var(--pv-ink)' }}>
                {st.title}
              </p>
              {st.desc && (
                <p className="mt-[0.1em] line-clamp-2 text-[0.36em]" style={{ color: 'var(--pv-faint)' }}>
                  {st.desc}
                </p>
              )}
            </div>
            {i < steps.length - 1 && (
              <span
                className="h-0 w-[0.6em] shrink-0"
                style={{ borderTop: `1.5px ${theme.structDash ? 'dashed' : 'solid'} var(--pv-hair)` }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export function QuoteView({ slide, theme }: ViewProps) {
  const q = slide.quote
  return (
    <div className="flex h-full flex-col justify-center">
      <div className="flex gap-[0.4em]">
        <span className="h-full w-[0.3em] shrink-0 rounded-[0.1em]" style={{ background: 'var(--pv-accent)' }} />
        <div className="min-w-0">
          <p
            className="line-clamp-4 text-[0.68em] leading-snug"
            style={{
              color: 'var(--pv-ink)',
              fontFamily: 'var(--pv-display-font)',
              fontStyle: theme.displayItalic ? 'italic' : 'normal',
            }}
          >
            {q?.text ?? slide.title}
          </p>
          {q?.attribution && (
            <p className="mt-[0.3em] text-[0.46em]" style={{ color: 'var(--pv-faint)' }}>
              — {q.attribution}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export function CardsView({ slide, index, theme }: ViewProps) {
  const cards = (slide.cards ?? []).slice(0, 6)
  const radius = `${Math.min(0.6, theme.cardRadius * 2)}em`
  return (
    <div className="flex h-full flex-col">
      <Header slide={slide} index={index} />
      <div
        className="mt-[0.4em] grid flex-1 gap-[0.3em] overflow-hidden"
        style={{ gridTemplateColumns: `repeat(${cards.length <= 2 ? cards.length : cards.length <= 4 ? 2 : 3}, minmax(0,1fr))` }}
      >
        {cards.map((card, i) => (
          <div key={i} className="min-w-0 p-[0.35em]" style={{ background: 'var(--pv-panel)', borderRadius: radius }}>
            <p className="line-clamp-1 text-[0.46em] font-semibold" style={{ color: 'var(--pv-ink)' }}>
              {card.title}
            </p>
            {card.desc && (
              <p className="mt-[0.1em] line-clamp-2 text-[0.38em]" style={{ color: 'var(--pv-ink-soft)' }}>
                {card.desc}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export function SectionView({ slide, index }: ViewProps) {
  return (
    <div className="flex h-full flex-col justify-center">
      <p className="text-[0.6em] font-bold" style={{ color: 'var(--pv-accent)', fontFamily: 'var(--pv-display-font)' }}>
        {String(index + 1).padStart(2, '0')}
      </p>
      <h3
        className="mt-[0.2em] line-clamp-3 text-[0.95em] font-semibold leading-tight"
        style={{ color: 'var(--pv-ink)', fontFamily: 'var(--pv-display-font)' }}
      >
        {slide.title}
      </h3>
      <span className="mt-[0.3em] h-[0.12em] w-[2em] rounded-full" style={{ background: 'var(--pv-accent)' }} />
    </div>
  )
}

/** 極簡 SVG chart（純前端，零依賴）— 求色系一致，唔求精準 */
export function ChartView({ slide, theme }: { slide: Slide; theme: PackTheme }) {
  const chart = slide.chart
  if (!chart) return null
  const colors = theme.chartColors.map(hash)
  const grid = hash(theme.chartGridColor)
  const cats = chart.categories.slice(0, 6)
  const series = chart.series.slice(0, 3)
  const all = series.flatMap((s) => s.values.slice(0, cats.length))
  const max = Math.max(1, ...all.filter((v) => Number.isFinite(v)))
  const W = 100
  const H = 40

  if (chart.type === 'pie') {
    const vals = (series[0]?.values ?? []).slice(0, cats.length)
    const total = Math.max(1, vals.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0))
    let acc = 0
    const cx = 20
    const cy = 20
    const r = 16
    return (
      <svg viewBox="0 0 100 40" className="h-full w-full" preserveAspectRatio="xMidYMid meet">
        {vals.map((v, i) => {
          const a0 = (acc / total) * Math.PI * 2 - Math.PI / 2
          acc += v
          const a1 = (acc / total) * Math.PI * 2 - Math.PI / 2
          const large = a1 - a0 > Math.PI ? 1 : 0
          const x0 = cx + r * Math.cos(a0)
          const y0 = cy + r * Math.sin(a0)
          const x1 = cx + r * Math.cos(a1)
          const y1 = cy + r * Math.sin(a1)
          return (
            <path
              key={i}
              d={`M${cx},${cy} L${x0.toFixed(2)},${y0.toFixed(2)} A${r},${r} 0 ${large} 1 ${x1.toFixed(2)},${y1.toFixed(2)} Z`}
              fill={colors[i % colors.length]}
            />
          )
        })}
      </svg>
    )
  }

  const n = cats.length || 1
  const groupW = W / n
  if (chart.type === 'line') {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" preserveAspectRatio="none">
        <line x1="0" y1={H - 1} x2={W} y2={H - 1} stroke={grid} strokeWidth="0.5" />
        {series.map((s, si) => {
          const pts = s.values
            .slice(0, n)
            .map((v, i) => `${(i * groupW + groupW / 2).toFixed(1)},${(H - (Math.max(0, v) / max) * (H - 4)).toFixed(1)}`)
            .join(' ')
          return <polyline key={si} points={pts} fill="none" stroke={colors[si % colors.length]} strokeWidth="1" />
        })}
      </svg>
    )
  }

  // bar
  const barW = (groupW * 0.7) / Math.max(1, series.length)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" preserveAspectRatio="none">
      <line x1="0" y1={H - 1} x2={W} y2={H - 1} stroke={grid} strokeWidth="0.5" />
      {cats.map((_, ci) =>
        series.map((s, si) => {
          const v = Math.max(0, s.values[ci] ?? 0)
          const bh = (v / max) * (H - 4)
          const x = ci * groupW + groupW * 0.15 + si * barW
          return <rect key={`${ci}-${si}`} x={x.toFixed(1)} y={(H - 1 - bh).toFixed(1)} width={barW.toFixed(1)} height={bh.toFixed(1)} fill={colors[si % colors.length]} />
        }),
      )}
    </svg>
  )
}
