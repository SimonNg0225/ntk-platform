// ============================================================
//  aiJson — 由 AI 回應安全抽取 JSON 嘅共用 helper
//  ------------------------------------------------------------
//  complete()（src/lib/aiClient.ts）只回「純字串」，而 Gemini
//  唔保證淨係吐 JSON：可能前後夾住解說文字，又或者用 ```json
//  code fence 包住。所以凡係要將 AI 輸出「落地成資料」嘅功能，
//  都經呢度做兩件事：
//    1) stripJsonFence  — 剝走 ```json / ``` 包裹同前後空白。
//    2) parseJsonArray  — 安全 parse 成陣列；唔得就用 regex 抽
//                          第一個 '[' 至最後一個 ']' 之間嘅子字串
//                          再試一次。
//  全程 try/catch，永不 throw（失敗一律回 null），等呼叫方自己
//  決定點出友善 toast。本檔純字串 + JSON 處理，唔 import 任何嘢。
// ============================================================

/**
 * 剝走 AI 回應外層嘅 markdown code fence（```json … ``` 或 ``` … ```），
 * 並 trim 前後空白。若無 fence 就原樣（已 trim）回傳。
 */
export function stripJsonFence(raw: string): string {
  let s = raw.trim()
  // 去開頭 ```（可帶語言標籤，例如 ```json / ```JSON）
  s = s.replace(/^```[a-zA-Z]*\s*\n?/, '')
  // 去結尾 ```
  s = s.replace(/\n?```$/, '')
  return s.trim()
}

/**
 * 嘗試由 AI 回應抽取一個 JSON 陣列。
 * 步驟：先 stripJsonFence → JSON.parse；若整段唔係合法 JSON，
 * 退而求其次，用 regex 抽 raw 第一個 '[' 至最後一個 ']' 之間嘅
 * 子字串再 parse。最終結果係 Array 先回傳（cast 做 T[]），
 * 否則回 null。全程唔會 throw。
 */
export function parseJsonArray<T = unknown>(raw: string): T[] | null {
  if (!raw) return null

  const tryParse = (text: string): T[] | null => {
    try {
      const parsed = JSON.parse(text)
      return Array.isArray(parsed) ? (parsed as T[]) : null
    } catch {
      return null
    }
  }

  // 1) 去 fence 後直接 parse
  const cleaned = stripJsonFence(raw)
  const direct = tryParse(cleaned)
  if (direct) return direct

  // 2) 後備：抽第一個 '[' 至最後一個 ']' 之間嘅子字串
  const start = cleaned.indexOf('[')
  const end = cleaned.lastIndexOf(']')
  if (start !== -1 && end !== -1 && end > start) {
    const slice = cleaned.slice(start, end + 1)
    const sliced = tryParse(slice)
    if (sliced) return sliced
  }

  return null
}

/**
 * 同 parseJsonArray 一樣抽 JSON 陣列，但失敗時 **throw** 一個帶
 * 友善中文 message 嘅 Error（而唔係回 null）。適合呼叫端用
 * try/catch + toast.error 直接顯示嘅情境（例如 AI 出題 / 製卡）。
 * 泛型只做 shape 假設，逐條 validation 留俾呼叫端。
 */
export function extractJsonArray<T = unknown>(raw: string): T[] {
  const result = parseJsonArray<T>(raw)
  if (result === null) {
    throw new Error('AI 回應唔係有效 JSON，請再試一次。')
  }
  return result
}

/**
 * 嘗試由 AI 回應抽取**單一 JSON 物件** `{ … }`（object 版，對應
 * parseJsonArray 嘅 array 版）。步驟與 array 版對稱：
 *   1) stripJsonFence → JSON.parse；結果係「非陣列嘅 object」先收。
 *   2) 後備：抽第一個 '{' 至最後一個 '}' 之間嘅子字串再 parse。
 * 注意：JSON 陣列同 `null` 喺 JS 都係 typeof 'object'，故特別排除
 * （Array.isArray / === null），只接受真正嘅 plain object。
 * 失敗一律回 null，永不 throw —— 由呼叫端決定點出友善提示。
 */
export function extractJsonObject<T = unknown>(raw: string): T | null {
  if (!raw) return null

  const tryParse = (text: string): T | null => {
    try {
      const parsed = JSON.parse(text)
      return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as T)
        : null
    } catch {
      return null
    }
  }

  // 1) 去 fence 後直接 parse
  const cleaned = stripJsonFence(raw)
  const direct = tryParse(cleaned)
  if (direct) return direct

  // 2) 後備：抽第一個 '{' 至最後一個 '}' 之間嘅子字串
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start !== -1 && end !== -1 && end > start) {
    const slice = cleaned.slice(start, end + 1)
    const sliced = tryParse(slice)
    if (sliced) return sliced
  }

  return null
}
