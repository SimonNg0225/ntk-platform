import type { Entity } from '../../../lib/store'
import type { Rating } from '../../../lib/srs'

// ============================================================
//  知識卡（Anki 級）— 本功能專屬型別
//  ------------------------------------------------------------
//  共用 data/types 嘅 Card / Deck 不可改，所以凡係要「加落卡」嘅
//  額外屬性（標籤、暫停、leech…）一律存喺本功能自家 collection，
//  以 cardId 關聯。複習歷史亦然（heatmap / 留存率 / 預測都靠佢）。
// ============================================================

/** 每張卡嘅額外中繼資料（以 cardId 關聯共用 Card） */
export interface CardMeta extends Entity {
  // id === cardId（直接用卡 id 做 key，唔使另一層對照）
  tags: string[]
  suspended: boolean // 暫停：唔會出現喺複習隊列
  flagged: boolean // 標記（紅旗）方便篩
  lapses: number // 累計「唔記得」次數（用嚟判 leech）
  note?: string // 私人備註（額外提示）
  updatedAt: string
}

/** 一次複習嘅 log（每答一張卡寫一條，係統計核心） */
export interface ReviewLog extends Entity {
  cardId: string
  deckId: string
  ts: string // ISO，答題一刻
  rating: Rating // again / hard / good / easy
  prevInterval: number // 答之前嘅 intervalDays
  newInterval: number // 答之後嘅 intervalDays
  elapsedMs: number // 由翻面到評分用咗幾耐（思考 + 回答）
  mode: StudyMode // 喺邊種模式複習
}

/** 每個牌組嘅學習設定（每日上限等） */
export interface DeckPref extends Entity {
  // id === deckId
  newPerDay: number // 每日新卡上限
  reviewPerDay: number // 每日複習上限（0 = 不限）
  order: 'due' | 'random' | 'added' // 隊列排序
}

// ───── 學習模式（Anki 嘅 study 形態）─────
export type StudyMode =
  | 'srs' // 標準間隔重複（會更新排程）
  | 'cram' // 衝刺：全部卡、唔影響排程
  | 'typed' // 打字作答：要打答案、自動對比
  | 'starred' // 只溫已標記（紅旗）

// ───── 卡片狀態（由 SRS 欄位推導，唔使存）─────
export type CardState = 'new' | 'learning' | 'young' | 'mature' | 'suspended'

// ───── Browse 篩選 / 排序 ─────
export type BrowseStateFilter = 'all' | CardState | 'due' | 'flagged' | 'leech'
export type BrowseSort =
  | 'created_desc'
  | 'created_asc'
  | 'due_asc'
  | 'due_desc'
  | 'interval_desc'
  | 'lapses_desc'
  | 'alpha'

// ───── 頂層視圖 ─────
export type TopView = 'decks' | 'browse' | 'stats'
