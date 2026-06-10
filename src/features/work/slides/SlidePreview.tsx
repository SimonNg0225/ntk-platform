import type { Slide } from './types'
import type { Theme } from './themes'
import { themeStyle } from './styleMap'
import { cx } from '../../../ui'

interface Props {
  slide: Slide
  theme: Theme
  className?: string
}

// 固定 16:9 舞台；用 CSS 變數令同一組件適配所有 theme。
export default function SlidePreview({ slide, theme, className = '' }: Props) {
  return (
    <div
      className={`relative aspect-video w-full overflow-hidden ${className}`}
      style={{
        ...themeStyle(theme),
        background: 'var(--sl-bg)',
        color: 'var(--sl-text)',
        fontFamily: 'var(--sl-font-body)',
      }}
    >
      <div className="flex h-full flex-col justify-center px-[6%] py-[5%]">
        <Body slide={slide} />
      </div>
      {slide.imageRef?.credit && (
        <span className="absolute bottom-1 right-2 text-[10px]" style={{ color: 'var(--sl-muted)' }}>
          {slide.imageRef.credit}
        </span>
      )}
    </div>
  )
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-[2.6vw] font-bold leading-tight" style={{ color: 'var(--sl-primary)', fontFamily: 'var(--sl-font-display)' }}>
      {children}
    </h2>
  )
}

function Body({ slide }: { slide: Slide }) {
  const c = slide.content
  switch (c.type) {
    case 'title':
      return (
        <div className="text-center">
          <h1 className="text-[4vw] font-extrabold" style={{ color: 'var(--sl-primary)', fontFamily: 'var(--sl-font-display)' }}>{c.heading}</h1>
          {c.subheading && <p className="mt-2 text-[1.8vw]" style={{ color: 'var(--sl-muted)' }}>{c.subheading}</p>}
        </div>
      )
    case 'section':
      return (
        <div className="text-center">
          {c.kicker && <p className="text-[1.4vw]" style={{ color: 'var(--sl-muted)' }}>{c.kicker}</p>}
          <h1 className="text-[3.4vw] font-bold" style={{ color: 'var(--sl-primary)', fontFamily: 'var(--sl-font-display)' }}>{c.heading}</h1>
        </div>
      )
    case 'bullets':
      return (
        <>
          <Heading>{c.heading}</Heading>
          <ul className="space-y-2 text-[1.6vw]">
            {c.items.map((it, i) => (
              <li key={i} className="flex gap-2"><span style={{ color: 'var(--sl-accent)' }}>•</span><span>{it}</span></li>
            ))}
          </ul>
        </>
      )
    case 'twoCol':
      return (
        <>
          <Heading>{c.heading}</Heading>
          <div className="grid grid-cols-2 gap-[4%] text-[1.4vw]">
            <ul className="space-y-1.5">{c.left.map((x, i) => <li key={i}>• {x}</li>)}</ul>
            <ul className="space-y-1.5">{c.right.map((x, i) => <li key={i}>• {x}</li>)}</ul>
          </div>
        </>
      )
    case 'imageText': {
      const img = slide.imageRef?.src
      const full = c.imageSide === 'full'
      return (
        <>
          <Heading>{c.heading}</Heading>
          {full && img ? (
            <img src={img} alt={slide.imageRef?.alt ?? ''} className="mx-auto max-h-[55%] rounded object-contain" />
          ) : (
            <div className={cx('flex gap-[4%]', c.imageSide === 'left' && 'flex-row-reverse')}>
              <p className="flex-1 text-[1.5vw]">{c.body}</p>
              {img && <img src={img} alt={slide.imageRef?.alt ?? ''} className="w-[38%] rounded object-contain" />}
            </div>
          )}
        </>
      )
    }
    case 'quote':
      return (
        <blockquote className="text-center">
          <p className="text-[2.6vw] font-semibold italic" style={{ fontFamily: 'var(--sl-font-display)' }}>「{c.text}」</p>
          {c.attribution && <footer className="mt-3 text-[1.3vw]" style={{ color: 'var(--sl-muted)' }}>— {c.attribution}</footer>}
        </blockquote>
      )
    case 'compare':
      return (
        <>
          <Heading>{c.heading}</Heading>
          <table className="w-full text-[1.3vw]">
            <tbody>
              {c.rows.map((r, i) => (
                <tr key={i} className="border-b" style={{ borderColor: 'var(--sl-muted)' }}>
                  <td className="py-1 font-semibold">{r.label}</td><td className="py-1">{r.a}</td><td className="py-1">{r.b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )
    case 'timeline':
      return (
        <>
          <Heading>{c.heading}</Heading>
          <ol className="space-y-2 text-[1.4vw]">
            {c.steps.map((s, i) => (
              <li key={i} className="flex gap-2"><span className="font-bold" style={{ color: 'var(--sl-accent)' }}>{i + 1}.</span><span>{s.label}{s.detail ? ` — ${s.detail}` : ''}</span></li>
            ))}
          </ol>
        </>
      )
    case 'quiz':
      return (
        <>
          <Heading>{c.question}</Heading>
          <ul className="space-y-2 text-[1.5vw]">
            {c.options.map((o, i) => (
              <li key={i} className="rounded px-3 py-1" style={{ background: 'var(--sl-surface)' }}>{String.fromCharCode(65 + i)}. {o}</li>
            ))}
          </ul>
        </>
      )
    case 'summary':
      return (
        <>
          <Heading>{c.heading}</Heading>
          <ul className="space-y-2 text-[1.6vw]">{c.points.map((p, i) => <li key={i}>✓ {p}</li>)}</ul>
        </>
      )
  }
}
