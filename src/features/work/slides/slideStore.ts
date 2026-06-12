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
  /** AI 出嘅英文封面搜尋詞（選填）— 下載時攞 Pexels 封面相用 */
  coverImageQuery?: string
  /** 內容指紋（選填）— 同一內容再生成時自動攞返呢份、唔再行 AI（slideSourceKey） */
  sourceKey?: string
}

export const slideDecksCol = createCollection<DeckRecord>('work_slide_decks', [])
