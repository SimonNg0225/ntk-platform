import { extractJsonObject } from '../../../lib/aiJson'
import type { MarkingProfile } from './markingProfiles'

// ============================================================
//  結構化批改 — Prompt 建構 + 解析（純函式，可單元測試）
//  ------------------------------------------------------------
//  由 MarkingProfile（逐科）驅動：persona + 評分準則 + 錯處分類 + 批改慣例
//  → 要求 AI 回一個 JSON：逐準則分數 + 錯處標示 + 總評。
//  通用化自原「作文批改」（essayPrompts），now 適用每一科。
// ============================================================

export interface GradeScore {
  criterion: string
  score: number
  max: number
  comment: string
}
export interface GradeIssue {
  /** 原文照抄嘅病句 / 失分點。 */
  quote: string
  /** 錯處分類 key（對應 MarkingProfile.issues）。 */
  type: string
  /** 建議改法。 */
  suggestion: string
}
export interface GradeResult {
  total: number
  maxTotal: number
  scores: GradeScore[]
  issues: GradeIssue[]
  overall: string
}

export interface StructuredOpts {
  /** 自訂 rubric（蓋過該科預設）。 */
  rubric?: string
  /** 題目 / 寫作提示（選填）。 */
  question?: string
  /** 滿分（選填；蓋過該科 rubric 合計）。 */
  totalMarks?: string
  /** 學生作答係咪以附圖提供。 */
  hasImage?: boolean
}

const rubricSum = (p: MarkingProfile) => p.rubric.reduce((s, r) => s + r.max, 0)

/** 砌結構化批改嘅 system prompt（逐科）。 */
export function buildStructuredSystem(profile: MarkingProfile, opts: StructuredOpts = {}): string {
  const isEn = profile.lang === 'en'
  const defaultRubric = profile.rubric
    .map((r) => `${r.criterion}（${r.max}）`)
    .join('、')
  const rubricLine = opts.rubric?.trim()
    ? `按以下老師自訂評分準則批改：\n${opts.rubric.trim()}`
    : `按以下${profile.label}科常見準則評分：${defaultRubric}。`
  const maxNote = opts.totalMarks?.trim()
    ? `總滿分為 ${opts.totalMarks.trim()}，請按比例分配各準則。`
    : `如無另定，總滿分 = 各準則滿分合計（約 ${rubricSum(profile)}）。`
  const issueKeys = profile.issues.map((i) => i.key).join('|')
  const issueHint = profile.issues.map((i) => `${i.key}=${i.label}`).join('、')
  const langNote = isEn
    ? 'Write "comment", "suggestion" and "overall" in English.'
    : 'comment / suggestion / overall 用繁體中文撰寫。'

  const parts: string[] = [profile.persona, profile.notes, rubricLine, maxNote]
  if (opts.question?.trim()) parts.push(`【題目 / 提示】\n${opts.question.trim()}`)
  parts.push(
    '只輸出一個 JSON 物件，唔好有任何其他文字或 markdown code fence：',
    '{',
    '  "total": 總分(數字), "maxTotal": 滿分(數字),',
    '  "scores": [{"criterion":"準則名","score":得分,"max":該項滿分,"comment":"一句評語"}],',
    `  "issues": [{"quote":"原文失分點/錯處（照抄，短）","type":"${issueKeys}","suggestion":"建議改法"}],`,
    '  "overall": "總評（2-4 句，具體、有建設性，避免人身批評）"',
    '}',
    '規則：',
    `- 錯處分類 type 只可用：${issueHint}。`,
    '- issues 嘅 quote 必須係學生作答中真實出現嘅文字（照抄，唔好改寫）；數理科可引錯誤步驟 / 算式。',
    '- 方法 / 步驟啱但答案錯，應酌量畀方法分；公平、有理據；只輸出 JSON。',
    `- ${langNote}`,
  )
  return parts.join('\n')
}

/** 解析 AI 回應（容錯）。 */
export function parseStructured(raw: string): GradeResult {
  const o = extractJsonObject<Record<string, unknown>>(raw)
  if (!o || typeof o !== 'object') {
    throw new Error('AI 回應格式唔正確，請再試一次。')
  }
  const num = (v: unknown, d = 0): number => {
    const n = typeof v === 'number' ? v : Number(v)
    return Number.isFinite(n) ? n : d
  }
  const scores: GradeScore[] = Array.isArray(o.scores)
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
        .filter((x): x is GradeScore => x !== null)
    : []
  const issues: GradeIssue[] = Array.isArray(o.issues)
    ? o.issues
        .map((s) => {
          if (!s || typeof s !== 'object') return null
          const r = s as Record<string, unknown>
          const quote = typeof r.quote === 'string' ? r.quote.trim() : ''
          const suggestion = typeof r.suggestion === 'string' ? r.suggestion.trim() : ''
          if (!quote || !suggestion) return null
          return { quote, type: typeof r.type === 'string' ? r.type : 'content', suggestion }
        })
        .filter((x): x is GradeIssue => x !== null)
    : []
  return {
    total: num(o.total),
    maxTotal: num(o.maxTotal, scores.reduce((s, x) => s + x.max, 0)),
    scores,
    issues,
    overall: typeof o.overall === 'string' ? o.overall.trim() : '',
  }
}
