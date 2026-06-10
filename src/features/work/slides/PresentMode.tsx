import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import type { SlideDeck } from './types'
import { getTheme } from './themes'
import SlidePreview from './SlidePreview'

interface Props {
  deck: SlideDeck
  onClose: () => void
}

// 全螢幕放映：← → / Space 翻頁，Esc 離開。
export default function PresentMode({ deck, onClose }: Props) {
  const { t } = useTranslation()
  const [i, setI] = useState(0)
  const theme = getTheme(deck.themeId)
  const total = deck.slides.length

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight' || e.key === ' ') setI((n) => Math.min(n + 1, total - 1))
      else if (e.key === 'ArrowLeft') setI((n) => Math.max(n - 1, 0))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [total, onClose])

  const slide = deck.slides[i]
  if (!slide) return null

  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/95">
      <div className="w-full max-w-6xl px-4">
        <SlidePreview slide={slide} theme={theme} className="rounded-lg shadow-2xl" />
      </div>
      <div className="mt-4 flex items-center gap-4 text-white">
        <button onClick={() => setI((n) => Math.max(n - 1, 0))} aria-label="prev"><ChevronLeft /></button>
        <span className="tabular-nums text-sm">{t('slides.slideOf', { defaultValue: 'Slide {{n}} / {{total}}', n: i + 1, total })}</span>
        <button onClick={() => setI((n) => Math.min(n + 1, total - 1))} aria-label="next"><ChevronRight /></button>
      </div>
      {slide.speakerNotes && (
        <p className="mt-3 max-w-3xl px-4 text-center text-xs text-white/60">{slide.speakerNotes}</p>
      )}
      <button onClick={onClose} className="absolute right-5 top-5 text-white/80 hover:text-white" aria-label={t('slides.exitPresent', { defaultValue: 'Exit (Esc)' })}>
        <X size={24} />
      </button>
    </div>
  )
}
