export const SLIDE_TYPES = [
  'title', 'section', 'bullets', 'twoCol', 'imageText',
  'quote', 'compare', 'timeline', 'quiz', 'summary',
] as const
export type SlideType = (typeof SLIDE_TYPES)[number]

export interface ImageRef {
  kind: 'builtin' | 'upload' | 'stock'
  src: string
  credit?: string
  alt?: string
}

export interface TitleContent { heading: string; subheading?: string }
export interface SectionContent { heading: string; kicker?: string }
export interface BulletsContent { heading: string; items: string[] }
export interface TwoColContent { heading: string; left: string[]; right: string[] }
export interface ImageTextContent { heading: string; body: string; imageSide: 'left' | 'right' | 'full' }
export interface QuoteContent { text: string; attribution?: string }
export interface CompareContent { heading: string; rows: { label: string; a: string; b: string }[] }
export interface TimelineContent { heading: string; steps: { label: string; detail?: string }[] }
export interface QuizContent { question: string; options: string[]; answerIndex?: number }
export interface SummaryContent { heading: string; points: string[] }

export type SlideContent =
  | ({ type: 'title' } & TitleContent)
  | ({ type: 'section' } & SectionContent)
  | ({ type: 'bullets' } & BulletsContent)
  | ({ type: 'twoCol' } & TwoColContent)
  | ({ type: 'imageText' } & ImageTextContent)
  | ({ type: 'quote' } & QuoteContent)
  | ({ type: 'compare' } & CompareContent)
  | ({ type: 'timeline' } & TimelineContent)
  | ({ type: 'quiz' } & QuizContent)
  | ({ type: 'summary' } & SummaryContent)

export interface Slide {
  id: string
  content: SlideContent
  imageRef?: ImageRef
  speakerNotes?: string
}

export interface SlideDeck {
  id: string
  title: string
  subjectPackId?: string
  themeId: string
  slides: Slide[]
  createdAt: string
  updatedAt: string
}

// 各 type 的空白 content（手動新增 / 解析容錯時用）
export function emptyContent(type: SlideType): Omit<SlideContent, 'type'> {
  switch (type) {
    case 'title': return { heading: '' }
    case 'section': return { heading: '' }
    case 'bullets': return { heading: '', items: [] }
    case 'twoCol': return { heading: '', left: [], right: [] }
    case 'imageText': return { heading: '', body: '', imageSide: 'right' }
    case 'quote': return { text: '' }
    case 'compare': return { heading: '', rows: [] }
    case 'timeline': return { heading: '', steps: [] }
    case 'quiz': return { question: '', options: [] }
    case 'summary': return { heading: '', points: [] }
  }
}
