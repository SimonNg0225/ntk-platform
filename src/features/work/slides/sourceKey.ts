import type { AIModel } from '../../../lib/aiClient'

// ============================================================
//  簡報內容指紋 — 同一內容自動重用（慳 AI）
//  ------------------------------------------------------------
//  由「決定簡報內容嘅輸入」砌一個 stable hash；同 key = 之前生成過，
//  直接攞返舊份唔再行 AI。唔計 pack／配相（下載先套，唔影響內容）。
// ============================================================

export interface SourceKeyInput {
  mode: 'topic' | 'text'
  /** text 模式嘅貼文內容 */
  text: string
  /** topic 模式嘅課題 id */
  topicId: string
  /** topic 模式嘅課題文字（課題改名都當新內容） */
  topicText: string
  /** 非框架模式嘅版數 */
  count: number
  /** 係咪「跟我嘅分段分版」框架模式 */
  framework: boolean
  /** 框架模式嘅分頁數（框架模式用呢個代替 count） */
  pageCount: number
  model: AIModel
}

/** 正規化文字：摺疊空白 + 去前後空白（細微排版差異唔當新內容）。 */
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

/** 由輸入砌內容指紋（決定內容嘅欄位先計入）。 */
export function slideSourceKey(input: SourceKeyInput): string {
  const source =
    input.mode === 'topic'
      ? `topic|${input.topicId}|${norm(input.topicText)}`
      : `text|${norm(input.text)}`
  // 框架模式：版數由分頁決定，唔睇 count；非框架：睇 count。
  const sizePart = input.framework ? `fw:${input.pageCount}` : `n:${input.count}`
  return hash([input.mode, source, sizePart, input.model].join(''))
}
