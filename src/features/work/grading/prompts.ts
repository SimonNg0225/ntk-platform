// ============================================================
//  AI 批改 · prompt builders（純函式，方便單元測試）
//  ------------------------------------------------------------
//  兩種用途：
//   1. 批改學生答案（文字 / 相片）→ 分數 + 逐點評語 + 改善建議
//   2. 成績表評語（report card comment）→ 一段得體評語
//  科目語境（subject）可選，令出題用詞貼合任教科。
// ============================================================

export interface GradeInput {
  question: string
  /** 評分準則 / marking scheme（選填）。 */
  scheme?: string
  /** 滿分（選填，例如 '10'）。 */
  totalMarks?: string
  /** 學生答案文字（相片批改時可留空）。 */
  answer?: string
  /** 學生答案係咪以附圖提供。 */
  hasImage?: boolean
}

const SUBJECT_CTX = (subject?: string) =>
  subject ? `\n任教科目：${subject}，請以此科標準批改。` : ''

export function buildGradingSystem(subject?: string): string {
  return (
    '你係資深香港中學老師，幫手批改學生功課 / 試卷答案。請按以下格式用繁體中文輸出（可用 Markdown）：\n' +
    '**分數 / 等級**：如有滿分就畀「X / 滿分」，否則畀等級（A–F）。\n' +
    '**評語**：逐點指出做得好同唔足嘅地方，講埋點解。\n' +
    '**改善建議**：具體、可行嘅下一步。\n' +
    '語氣專業、建設性、有鼓勵性。緊扣題目同（如有）評分準則，唔好捏造學生冇寫嘅內容。' +
    SUBJECT_CTX(subject)
  )
}

export function buildGradingPrompt(input: GradeInput): string {
  const parts: string[] = []
  parts.push(`【題目】\n${input.question.trim()}`)
  if (input.totalMarks?.trim()) parts.push(`【滿分】${input.totalMarks.trim()}`)
  if (input.scheme?.trim()) parts.push(`【評分準則】\n${input.scheme.trim()}`)
  if (input.hasImage) {
    parts.push('【學生答案】見附圖，請先讀出 / 理解圖中作答內容再批改。')
  } else {
    parts.push(`【學生答案】\n${(input.answer ?? '').trim()}`)
  }
  parts.push('請批改。')
  return parts.join('\n\n')
}

export type CommentTone = 'encouraging' | 'balanced' | 'firm'

export const COMMENT_TONES: { id: CommentTone; label: string; hint: string }[] = [
  { id: 'encouraging', label: '鼓勵', hint: '正面、肯定為主' },
  { id: 'balanced', label: '中肯', hint: '強項與不足並重' },
  { id: 'firm', label: '嚴謹', hint: '直接點出需改善處' },
]

const TONE_DIRECTIVE: Record<CommentTone, string> = {
  encouraging: '語氣以鼓勵、肯定為主，溫和指出可改善處。',
  balanced: '語氣中肯，強項同不足並重。',
  firm: '語氣認真直接，清楚點出需改善之處，但保持尊重。',
}

export function buildCommentSystem(subject?: string): string {
  return (
    '你係香港中學班主任 / 科任，幫手撰寫成績表評語（report card comment）。' +
    '根據提供嘅學生表現摘要，寫**一段** 60–120 字、家長睇得明嘅繁體中文評語：' +
    '先肯定強項，再具體指出需改善之處，最後一句鼓勵。' +
    '唔好分點、唔好標題、唔好捏造冇提供嘅資料。' +
    SUBJECT_CTX(subject)
  )
}

export interface CommentInput {
  studentName?: string
  /** 學生表現摘要（成績、操行、出席等，老師輸入或由成績冊帶入）。 */
  summary: string
  tone: CommentTone
}

export function buildCommentPrompt(input: CommentInput): string {
  const who = input.studentName?.trim()
    ? `學生：${input.studentName.trim()}`
    : '學生'
  return (
    `${who}\n【表現摘要】\n${input.summary.trim()}\n\n` +
    `${TONE_DIRECTIVE[input.tone]}\n請寫評語。`
  )
}
