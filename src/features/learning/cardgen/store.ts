import { createCollection } from '../../../lib/store'
import type { GenRecord } from './types'

// ============================================================
//  AI 生成知識卡 — 本功能專屬持久化（唔掂 data/collections.ts）
//  ------------------------------------------------------------
//  只新增「生成歷史」一個 collection，記低每次生成嘅參數同結果，
//  畀歷史列表 + 統計圖表用。卡本身仍然寫去共用 cardsCol；卡嘅
//  tag 寫去 flashcards 嘅 cardMetaCol（重用，唔重複造）。
//  唯一 key（已喺 newCollections 申報）：cardgen_history
// ============================================================

export const genHistoryCol = createCollection<GenRecord>('cardgen_history', [])

/** 最近 N 條歷史（新→舊） */
export function recentHistory(limit = 30): GenRecord[] {
  return [...genHistoryCol.get()]
    .sort((a, b) => b.ts.localeCompare(a.ts))
    .slice(0, limit)
}

/** 標記某條歷史「已存入牌組」（補回 saved / deckName） */
export function markSaved(id: string, saved: number, deckName: string) {
  genHistoryCol.update(id, { saved, deckName })
}
