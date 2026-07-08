import { parseJsonArray } from '../../../lib/aiJson'

// ============================================================
//  筆記校對 — AI 檢查「錯字」+「知識/事實錯誤」（純函式，可單元測試）
// ============================================================

export type ProofIssueType = 'typo' | 'fact'

export interface ProofIssue {
  type: ProofIssueType
  /** 原文中有問題的片段（照抄，方便定位替換） */
  quote: string
  /** 建議改成 */
  suggestion: string
  /** 一句原因 */
  note: string
}

export const PROOFREAD_SYSTEM = [
  '你是一位嚴謹的校對助手。檢查使用者的筆記，找出兩類問題：',
  '① typo：錯別字、錯字、標點或明顯文法問題；',
  '② fact：知識／事實／概念錯誤（例如定義錯、數據錯、因果關係錯）。',
  '只輸出一個 JSON 陣列，每個元素格式：',
  '{"type":"typo|fact","quote":"原文照抄的有問題片段（要短、要係原文真實出現）","suggestion":"建議改成","note":"一句精簡原因（繁體中文）"}',
  '規則：',
  '- quote 必須係原文中真實出現的文字（照抄，不要改寫或加省略號），方便定位替換。',
  '- 只報真正有問題的地方；完全沒有問題就回 []。',
  '- 不要報純風格／個人喜好；fact 類要有把握先報。',
  '- 只輸出 JSON 陣列，不要有任何其他文字或 markdown code fence。',
].join('\n')

/** 解析 AI 校對回應；格式不正確 throw，無問題回 []。 */
export function parseProofread(raw: string): ProofIssue[] {
  const rows = parseJsonArray<unknown>(raw)
  if (rows === null) throw new Error('AI 回應格式不正確，請再試一次。')

  const out: ProofIssue[] = []
  for (const r of rows) {
    if (!r || typeof r !== 'object') continue
    const o = r as Record<string, unknown>
    const quote = typeof o.quote === 'string' ? o.quote.trim() : ''
    const suggestion = typeof o.suggestion === 'string' ? o.suggestion.trim() : ''
    if (!quote || !suggestion) continue
    const type: ProofIssueType = o.type === 'fact' ? 'fact' : 'typo'
    const note = typeof o.note === 'string' ? o.note.trim() : ''
    out.push({ type, quote, suggestion, note })
  }
  return out
}
