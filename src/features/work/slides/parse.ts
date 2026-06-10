import { uid } from '../../../lib/store'
import { SLIDE_TYPES, emptyContent, type Slide, type SlideContent, type SlideType } from './types'

// 由 AI 回應（可能帶 fence / 雜訊）抽出 JSON 陣列字串
function extractArray(raw: string): string {
  const start = raw.indexOf('[')
  const end = raw.lastIndexOf(']')
  if (start >= 0 && end > start) return raw.slice(start, end + 1)
  return raw
}

export function parseSlides(raw: string): Slide[] {
  let arr: unknown
  try {
    arr = JSON.parse(extractArray(raw))
  } catch {
    return []
  }
  if (!Array.isArray(arr)) return []

  const out: Slide[] = []
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue
    const rec = item as Record<string, unknown>
    const type = rec.type as SlideType
    if (!SLIDE_TYPES.includes(type)) continue
    const incoming = (rec.content && typeof rec.content === 'object' ? rec.content : {}) as Record<string, unknown>
    const content = { type, ...emptyContent(type), ...incoming } as SlideContent
    out.push({
      id: uid(),
      content,
      speakerNotes: typeof rec.speakerNotes === 'string' ? rec.speakerNotes : undefined,
    })
  }
  return out
}
