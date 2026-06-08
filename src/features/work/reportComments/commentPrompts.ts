import { parseJsonArray } from '../../../lib/aiJson'

// ============================================================
//  成績表評語 — Prompt 建構 + 解析（純函式，可單元測試）
// ============================================================

export type CommentTone = 'encourage' | 'balanced' | 'strict'
export type CommentLang = 'zh' | 'en'
export type CommentLength = 'short' | 'medium'

export interface CommentOpts {
  tone: CommentTone
  lang: CommentLang
  length: CommentLength
  subjectName?: string
}

const TONE_WORD: Record<CommentTone, string> = {
  encourage: '鼓勵、正面、肯定努力',
  balanced: '中肯、平衡、有讚有改善',
  strict: '嚴謹、實事求是、聚焦改善',
}
const LEN_WORD: Record<CommentLength, string> = {
  short: '約 40 字',
  medium: '約 70–90 字',
}

export function buildCommentSystem(o: CommentOpts): string {
  const subj = o.subjectName ? `（科目：${o.subjectName}）` : ''
  const langInstr = o.lang === 'en' ? '評語用英文撰寫。' : '評語用繁體中文撰寫。'
  return [
    `你係香港學校老師助手${subj}，為每個學生寫成績表評語。`,
    `語氣：${TONE_WORD[o.tone]}。每段長度：${LEN_WORD[o.length]}。${langInstr}`,
    '我會俾你一張學生表現清單（編號＋姓名＋數據）。請為每位學生寫一段個人化評語，扣返佢嘅表現（強項、弱項、進步、學習態度），具體唔空泛，避免負面標籤同人身批評。',
    '只輸出一個 JSON 陣列，順序同輸入一致，每個元素：{"idx": 編號(數字), "comment": "評語"}。唔好有任何其他文字或 markdown code fence。',
  ].join('\n')
}

/** 解析評語回應 → 按 1..count 對位嘅評語陣列（缺嘅留空字串）。格式錯 throw。 */
export function parseComments(raw: string, count: number): string[] {
  const rows = parseJsonArray<unknown>(raw)
  if (rows === null) throw new Error('AI 回應格式唔正確，請再試一次。')
  const out: string[] = new Array(count).fill('')
  for (const r of rows) {
    if (!r || typeof r !== 'object') continue
    const o = r as Record<string, unknown>
    const idx = typeof o.idx === 'number' ? o.idx : Number(o.idx)
    const comment = typeof o.comment === 'string' ? o.comment.trim() : ''
    if (Number.isInteger(idx) && idx >= 1 && idx <= count && comment) {
      out[idx - 1] = comment
    }
  }
  return out
}
