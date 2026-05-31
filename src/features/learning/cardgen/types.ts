import type { Entity } from '../../../lib/store'
import type { AIModel } from '../../../lib/aiClient'

// ============================================================
//  AI 生成知識卡 — 本功能專屬型別
//  ------------------------------------------------------------
//  共用 data/types 嘅 Card / Deck 不可改。凡係「生成階段」先有
//  嘅嘢（草稿狀態、卡型、難度、生成歷史）一律喺呢度定義，落卡
//  時先映射返標準 Card 欄位。tag 借用 flashcards 嘅 cardMetaCol
//  寫入（唔重複造輪），故此處只記字串陣列。
// ============================================================

/** 卡型（決定 prompt 結構 + 草稿渲染 + 落卡時 front/back 組裝） */
export type CardType =
  | 'qa' // 問題 → 答案
  | 'term' // 詞彙 → 定義
  | 'cloze' // 填空（句子挖空）
  | 'tf' // 是非題（命題 → 真/假 + 解釋）

/** 難度（影響 prompt 措辭同卡片深淺） */
export type Difficulty = 'basic' | 'intermediate' | 'challenge'

/** 輸出語言 */
export type OutLang = 'zh' | 'en' | 'bi' // 繁中 / 英文 / 中英對照

/**
 * AI 回一張卡嘅原始 shape（未必齊，逐欄 runtime validate）。
 * 唔同卡型用唔同欄位：
 *  - qa/term：front + back
 *  - cloze ：text（含 {{挖空}}）+ answer（被挖嘅字）+ 可選 hint
 *  - tf    ：statement + answer('true'|'false') + 可選 explain
 */
export interface RawCard {
  front?: unknown
  back?: unknown
  text?: unknown
  answer?: unknown
  hint?: unknown
  statement?: unknown
  explain?: unknown
}

/** 預覽 / 編輯階段嘅草稿卡（本地，唔持久化；落卡先轉 Card） */
export interface DraftCard extends Entity {
  type: CardType
  front: string // 已組裝好嘅正面（問題 / 詞彙 / 填空題幹 / 命題）
  back: string // 已組裝好嘅背面（答案 / 定義 / 填空答案 / 真假+解釋）
  tags: string[] // 落卡時寫入 cardMetaCol
  include: boolean // 是否加入
  flipped: boolean // 預覽翻面狀態
  dup: boolean // 同目標牌組已有卡重複（front 撞）
  regenning?: boolean // 單卡重新生成中
}

/** 一次生成嘅歷史紀錄（持久化，畀歷史 / 統計用） */
export interface GenRecord extends Entity {
  ts: string // ISO，生成完成一刻
  topic: string // 當時主題（截短保存）
  type: CardType
  difficulty: Difficulty
  lang: OutLang
  model: AIModel
  generated: number // 生成咗幾多張
  saved: number // 最終存咗入牌組幾多張（0 = 未存）
  deckName?: string // 存入嘅牌組名
}

/** Prompt 範本（快速填主題） */
export interface Preset {
  id: string
  label: string
  topic: string
  type: CardType
  emoji: string
}
