import { extractJsonObject } from '../../../lib/aiJson'

// ============================================================
//  錄音轉文字 — Prompt + 解析（純函式，可單元測試）
// ============================================================

export interface TranscriptResult {
  summary: string[]
  decisions: string[]
  actions: string[]
  transcript: string
}

export function buildTranscribeSystem(): string {
  return [
    '你是會議／課堂錄音助手。使用者會提供一段錄音。請聽完後，用繁體中文處理。',
    '只輸出一個 JSON 物件，不要有任何其他文字或 markdown code fence：',
    '{',
    '  "summary": ["重點摘要（3-8 點）"],',
    '  "decisions": ["決議／結論（如有）"],',
    '  "actions": ["待跟進事項（哪個做乜，如有）"],',
    '  "transcript": "較完整的轉錄文字（抓住內容，不用逐字）"',
    '}',
    '規則：繁體中文；沒有的欄位用空陣列／空字串；只輸出 JSON。',
  ].join('\n')
}

export function parseTranscript(raw: string): TranscriptResult {
  const o = extractJsonObject<Record<string, unknown>>(raw)
  if (!o || typeof o !== 'object') throw new Error('AI 回應格式不正確，請再試一次。')
  const arr = (v: unknown): string[] =>
    Array.isArray(v)
      ? v.filter((x): x is string => typeof x === 'string').map((s) => s.trim()).filter(Boolean)
      : []
  return {
    summary: arr(o.summary),
    decisions: arr(o.decisions),
    actions: arr(o.actions),
    transcript: typeof o.transcript === 'string' ? o.transcript.trim() : '',
  }
}
