import { createCollection, type Entity } from '../../../lib/store'
import type { Slide } from '../../../lib/export'

// ============================================================
//  教學簡報 — 本機儲存（存簡報大綱，可重溫 / 再下載）
// ============================================================

export interface DeckRecord extends Entity {
  createdAt: string
  topicName: string
  model: string
  title: string
  subtitle?: string
  slides: Slide[]
}

export const slideDecksCol = createCollection<DeckRecord>('work_slide_decks', [])
