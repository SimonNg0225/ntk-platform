import { uid } from '../../../lib/store'
import { emptyContent, type Slide, type SlideContent, type SlideType } from './types'

// 移動一張 slide（dir = -1 上移 / +1 下移）；邊界回傳原陣列副本
export function reorderSlides(slides: Slide[], index: number, dir: -1 | 1): Slide[] {
  const j = index + dir
  if (index < 0 || index >= slides.length || j < 0 || j >= slides.length) return slides.slice()
  const next = slides.slice()
  ;[next[index], next[j]] = [next[j], next[index]]
  return next
}

// 換版面 type：重置 content（emptyContent），保留 id / imageRef / speakerNotes
export function changeSlideType(slide: Slide, type: SlideType): Slide {
  const content = { type, ...emptyContent(type) } as SlideContent
  return { ...slide, content }
}

// 新空白 slide（指定 type）
export function newSlide(type: SlideType): Slide {
  return { id: uid(), content: { type, ...emptyContent(type) } as SlideContent }
}
