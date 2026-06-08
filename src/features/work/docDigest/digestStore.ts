import { createCollection, type Entity } from '../../../lib/store'

// ============================================================
//  文件速讀 — 本機儲存
//  ------------------------------------------------------------
//  只存「速讀結果」（類別 / 標題 / 摘要 / 跟進事項 + 原文頭一截），
//  唔存成份原文或相片，慳 localStorage。
// ============================================================

export interface DigestAction {
  text: string
  /** YYYY-MM-DD；無明確截止日就省略 */
  date?: string
}

export type DigestSource = 'text' | 'docx' | 'pdf' | 'photo'

export interface DigestRecord extends Entity {
  createdAt: string
  title: string
  category: string
  summary: string[]
  actions: DigestAction[]
  sourceType: DigestSource
  /** 原文頭 ~500 字（畀返去重溫；相片來源則為空/標題） */
  snippet: string
  model: string
}

export const docDigestCol = createCollection<DigestRecord>('work_doc_digest', [])
