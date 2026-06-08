import { parseJsonArray } from '../../../lib/aiJson'
import type { Difficulty } from '../../../data/types'

// ============================================================
//  DSE 操練 — Prompt 建構 + 解析（純函式，可單元測試）
// ============================================================

export type DsePaper = 'mc' | 'short' | 'essay'

export const DSE_PAPERS: { id: DsePaper; label: string }[] = [
  { id: 'mc', label: '選擇題' },
  { id: 'short', label: '資料回應／短答' },
  { id: 'essay', label: '論述／長題' },
]

export interface DseQuestion {
  stem: string
  marks: number
  options?: string[]
  answerIndex?: number
  /** 評分／答題要點 */
  markingPoints: string[]
  /** 達標（高分）答案特徵 */
  levelHint: string
}

const PAPER_WORD: Record<DsePaper, string> = {
  mc: '選擇題（MC）',
  short: '資料回應／短答題',
  essay: '論述／結構式長題目',
}

export function buildDseSystem(
  subjectName: string | undefined,
  paper: DsePaper,
  difficulty: Difficulty,
  count: number,
): string {
  const subj = subjectName ? `${subjectName}` : '相關科目'
  const mcLine =
    paper === 'mc'
      ? '每題提供 4 個選項（options）同正確答案索引（answerIndex，0 起）。'
      : '適當使用 command word（解釋／分析／評估／比較／論證），並標明分數。'
  return [
    `你係香港 DSE ${subj} 資深考評老師。根據用家俾嘅課題，出 ${count} 條 DSE 公開試風格嘅${PAPER_WORD[paper]}。`,
    mcLine,
    '只輸出一個 JSON 陣列，每個元素：',
    '{"stem":"題幹","marks":分數,"options":["A…","B…"](MC才需要),"answerIndex":0(MC才需要),"markingPoints":["評分／答題要點"],"levelHint":"高分（達標）答案嘅特徵，一兩句"}',
    `規則：繁體中文；貼香港 DSE 課程同評卷標準；難度＝${difficulty}；只輸出 JSON 陣列，唔好其他文字或 code fence。`,
  ].join('\n')
}

export function parseDse(raw: string): DseQuestion[] {
  const rows = parseJsonArray<unknown>(raw)
  if (rows === null) throw new Error('AI 回應格式唔正確，請再試一次。')
  const out: DseQuestion[] = []
  for (const r of rows) {
    if (!r || typeof r !== 'object') continue
    const o = r as Record<string, unknown>
    const stem = typeof o.stem === 'string' ? o.stem.trim() : ''
    if (!stem) continue
    const marks = typeof o.marks === 'number' ? o.marks : Number(o.marks) || 0
    const markingPoints = Array.isArray(o.markingPoints)
      ? o.markingPoints.filter((x): x is string => typeof x === 'string').map((s) => s.trim()).filter(Boolean)
      : []
    const levelHint = typeof o.levelHint === 'string' ? o.levelHint.trim() : ''
    const options = Array.isArray(o.options)
      ? o.options.filter((x): x is string => typeof x === 'string')
      : undefined
    const answerIndex =
      typeof o.answerIndex === 'number' ? o.answerIndex : Number.isFinite(Number(o.answerIndex)) ? Number(o.answerIndex) : undefined
    out.push({
      stem,
      marks,
      markingPoints,
      levelHint,
      ...(options && options.length ? { options } : {}),
      ...(answerIndex != null ? { answerIndex } : {}),
    })
  }
  if (out.length === 0) throw new Error('AI 出唔到題目，試吓換 Pro 或補充課題。')
  return out
}
