import type { Entity } from '../../../lib/store'
import type { AIModel } from '../../../lib/aiClient'

// ============================================================
//  AI 助手 — 功能專屬型別
//  ------------------------------------------------------------
//  共用嘅 AiThread / AiMessage 留喺 data/collections（唔改）。
//  呢度只加「附加 metadata」（用 threadId 做 key 旁掛）同自訂
//  prompt 範本，全部存喺本功能自己嘅 collection。
// ============================================================

/** 對話人格（語氣風格）— 套喺 system prompt 後面 */
export type PersonaId = 'default' | 'concise' | 'detailed' | 'socratic' | 'exam'

export interface Persona {
  id: PersonaId
  label: string
  /** 加落 system prompt 嘅一段指令（空 = 唔加） */
  directive: string
  hint: string
}

/** 一個附加上下文（連結筆記 或 自由文字），會注入 system prompt */
export interface ContextRef {
  id: string
  kind: 'note' | 'meeting' | 'journal' | 'text'
  /** 顯示用標題 */
  title: string
  /** 真正注入嘅內容 */
  content: string
}

/**
 * 每個 thread 嘅附加設定（旁掛，用 threadId 做主鍵）。
 * 唔存喺 AiThread 度，避免改共用型別。
 */
export interface ThreadMeta extends Entity {
  // id === threadId
  pinned?: boolean
  archived?: boolean
  model?: AIModel
  temperature?: number
  persona?: PersonaId
  /** 注入嘅上下文 */
  contexts?: ContextRef[]
  /** 手動改過嘅標題（覆蓋自動標題） */
  customTitle?: string
  updatedAt?: string
}

/** 自訂 prompt 範本（用戶自己加） */
export interface PromptTemplate extends Entity {
  mode: 'learning' | 'work' | 'both'
  title: string
  body: string
  category?: string
  createdAt: string
  /** 使用次數（用嚟排「最常用」） */
  uses?: number
}
