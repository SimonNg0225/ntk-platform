import { createCollection } from '../../../lib/store'
import type { CardMeta, DeckPref, ReviewLog } from './types'

// ============================================================
//  知識卡功能專屬持久化（唔掂 data/collections.ts）
//  ------------------------------------------------------------
//  共用 decksCol / cardsCol 維持唔變；本功能需要而 Card 型別冇嘅
//  屬性（標籤 / 暫停 / leech）+ 複習歷史，全部存呢度。
//  唯一 key（已喺 newCollections 申報）：
//    flashcard_card_meta / flashcard_review_log / flashcard_deck_pref
// ============================================================

export const cardMetaCol = createCollection<CardMeta>('flashcard_card_meta', [])
export const reviewLogCol = createCollection<ReviewLog>('flashcard_review_log', [])
export const deckPrefCol = createCollection<DeckPref>('flashcard_deck_pref', [])

// ───────── 中繼資料 upsert（以 cardId 做 id）─────────
export function upsertMeta(cardId: string, patch: Partial<Omit<CardMeta, 'id'>>) {
  const existing = cardMetaCol.get().find((m) => m.id === cardId)
  if (existing) {
    cardMetaCol.update(cardId, { ...patch, updatedAt: new Date().toISOString() })
  } else {
    cardMetaCol.add({
      id: cardId,
      tags: [],
      suspended: false,
      flagged: false,
      lapses: 0,
      ...patch,
      updatedAt: new Date().toISOString(),
    })
  }
}

// ───────── 牌組設定 upsert（以 deckId 做 id）─────────
export function upsertPref(deckId: string, patch: Partial<Omit<DeckPref, 'id'>>) {
  const existing = deckPrefCol.get().find((p) => p.id === deckId)
  if (existing) {
    deckPrefCol.update(deckId, patch)
  } else {
    deckPrefCol.add({
      id: deckId,
      newPerDay: 20,
      reviewPerDay: 0,
      order: 'due',
      ...patch,
    })
  }
}

// ───────── 清掉孤兒中繼（卡 / 牌組已刪）─────────
export function pruneMeta(validCardIds: Set<string>) {
  for (const m of cardMetaCol.get()) {
    if (!validCardIds.has(m.id)) cardMetaCol.remove(m.id)
  }
}
