import type { AIModel } from '../../../lib/aiClient'

// ============================================================
//  簡報內容指紋 — 同一內容自動重用（慳 AI）
//  ------------------------------------------------------------
//  由「決定簡報內容的輸入」砌一個 stable hash；同 key = 之前生成過，
//  直接取得返舊份不再行 AI。不計 pack／配相（下載先套，不影響內容）。
// ============================================================

export interface SourceKeyInput {
  mode: 'topic' | 'text'
  /** text 模式的貼文內容 */
  text: string
  /** topic 模式的課題 id */
  topicId: string
  /** topic 模式的課題文字（課題改名都當新內容） */
  topicText: string
  /** 非框架模式的版數 */
  count: number
  /** 係咪「跟我的按段落分頁」框架模式 */
  framework: boolean
  /** 框架模式的分頁數（框架模式用這個代替 count） */
  pageCount: number
  model: AIModel
}

/** 正規化文字：摺疊空白 + 去前後空白（細微排版差異不當新內容）。 */
function norm(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

/** FNV-1a 32-bit → base36（穩定、無依賴）。 */
function hash(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36)
}

/** 由輸入砌內容指紋（決定內容的欄位先計入）。 */
export function slideSourceKey(input: SourceKeyInput): string {
  const source =
    input.mode === 'topic'
      ? `topic|${input.topicId}|${norm(input.topicText)}`
      : `text|${norm(input.text)}`
  // 框架模式：版數由分頁決定，不查看 count；非框架：查看 count。
  const sizePart = input.framework ? `fw:${input.pageCount}` : `n:${input.count}`
  return hash([input.mode, source, sizePart, input.model].join(''))
}
