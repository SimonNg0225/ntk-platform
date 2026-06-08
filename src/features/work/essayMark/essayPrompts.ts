import { extractJsonObject } from '../../../lib/aiJson'

// ============================================================
//  作文批改 — Prompt 建構 + 解析（純函式，可單元測試）
// ============================================================

export type EssaySubject = 'zh' | 'en'

export interface EssayScore {
  criterion: string
  score: number
  max: number
  comment: string
}
export interface EssayIssue {
  quote: string
  /** grammar | wording | spelling | content */
  type: string
  suggestion: string
}
export interface EssayResult {
  total: number
  maxTotal: number
  scores: EssayScore[]
  issues: EssayIssue[]
  overall: string
}

export function buildEssaySystem(subject: EssaySubject, rubric?: string): string {
  const isEn = subject === 'en'
  const subjLine = isEn
    ? '你係香港英文科老師，批改學生 English essay／composition。'
    : '你係香港中文科老師，批改學生作文。'
  const rubricLine = rubric?.trim()
    ? `按以下評分準則批改：\n${rubric.trim()}`
    : isEn
      ? '按常見準則評分：Content & Ideas、Language、Organisation、Mechanics（拼寫/標點）。'
      : '按常見準則評分：內容、表達／語境、結構組織、錯別字標點。'
  const langNote = isEn
    ? 'issues 同 overall 用英文撰寫。'
    : '用繁體中文撰寫。'
  return [
    subjLine,
    rubricLine,
    '只輸出一個 JSON 物件，唔好有任何其他文字或 markdown code fence：',
    '{',
    '  "total": 總分(數字), "maxTotal": 滿分(數字),',
    '  "scores": [{"criterion":"準則名","score":得分,"max":該項滿分,"comment":"一句評語"}],',
    '  "issues": [{"quote":"原文病句/錯處（照抄，短）","type":"grammar|wording|spelling|content","suggestion":"建議改法"}],',
    '  "overall": "總評（2-4 句，具體、有建設性，避免人身批評）"',
    '}',
    '規則：',
    `- ${langNote}`,
    '- issues 嘅 quote 必須係原文真實出現嘅文字（照抄，唔好改寫）。',
    '- 公平、有理據；只輸出 JSON。',
  ].join('\n')
}

export function parseEssay(raw: string): EssayResult {
  const o = extractJsonObject<Record<string, unknown>>(raw)
  if (!o || typeof o !== 'object') {
    throw new Error('AI 回應格式唔正確，請再試一次。')
  }
  const num = (v: unknown, d = 0): number => {
    const n = typeof v === 'number' ? v : Number(v)
    return Number.isFinite(n) ? n : d
  }
  const scores: EssayScore[] = Array.isArray(o.scores)
    ? o.scores
        .map((s) => {
          if (!s || typeof s !== 'object') return null
          const r = s as Record<string, unknown>
          const criterion = typeof r.criterion === 'string' ? r.criterion.trim() : ''
          if (!criterion) return null
          return {
            criterion,
            score: num(r.score),
            max: num(r.max, 0),
            comment: typeof r.comment === 'string' ? r.comment.trim() : '',
          }
        })
        .filter((x): x is EssayScore => x !== null)
    : []
  const issues: EssayIssue[] = Array.isArray(o.issues)
    ? o.issues
        .map((s) => {
          if (!s || typeof s !== 'object') return null
          const r = s as Record<string, unknown>
          const quote = typeof r.quote === 'string' ? r.quote.trim() : ''
          const suggestion = typeof r.suggestion === 'string' ? r.suggestion.trim() : ''
          if (!quote || !suggestion) return null
          return { quote, type: typeof r.type === 'string' ? r.type : 'wording', suggestion }
        })
        .filter((x): x is EssayIssue => x !== null)
    : []
  return {
    total: num(o.total),
    maxTotal: num(o.maxTotal, scores.reduce((s, x) => s + x.max, 0)),
    scores,
    issues,
    overall: typeof o.overall === 'string' ? o.overall.trim() : '',
  }
}
