import { extractJsonObject } from '../../../lib/aiJson'

// ============================================================
//  評分準則 — Prompt 建構 + 解析（純函式，可單元測試）
//  兩個模式：
//   · scheme = 評分指引（參考答案 + 評分點 + 分數）
//   · rubric = 分析式評分量表（準則 × 表現等級）
// ============================================================

export type RubricMode = 'scheme' | 'rubric'

// ── 評分指引 ──
export interface SchemePoint {
  text: string
  marks: number
}
export interface MarkingScheme {
  modelAnswer: string
  points: SchemePoint[]
  total: number
}

// ── 評分量表 ──
export interface RubricLevel {
  label: string
  descriptor: string
  marks: number
}
export interface RubricCriterion {
  name: string
  levels: RubricLevel[]
}
export interface Rubric {
  criteria: RubricCriterion[]
}

function num(v: unknown, d = 0): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : d
}

function subjLine(subjectName?: string): string {
  return subjectName ? `你係香港${subjectName}科老師。` : '你係香港老師。'
}

// ───────── 評分指引 ─────────
export function buildSchemeSystem(subjectName: string | undefined, totalMarks: number): string {
  return [
    `${subjLine(subjectName)}為用家俾嘅題目擬一份評分指引（marking scheme），總分 ${totalMarks} 分。`,
    '只輸出一個 JSON 物件，唔好有任何其他文字或 markdown code fence：',
    '{',
    '  "modelAnswer": "參考答案（精簡要點或範例）",',
    '  "points": [{"text": "評分點（要具體、可操作）", "marks": 分數}],',
    `  "total": ${totalMarks}`,
    '}',
    '規則：繁體中文；各評分點分數加起來等於 total；只輸出 JSON。',
  ].join('\n')
}

export function parseScheme(raw: string): MarkingScheme {
  const o = extractJsonObject<Record<string, unknown>>(raw)
  if (!o || typeof o !== 'object') throw new Error('AI 回應格式唔正確，請再試一次。')
  const points: SchemePoint[] = Array.isArray(o.points)
    ? o.points
        .map((p) => {
          if (!p || typeof p !== 'object') return null
          const r = p as Record<string, unknown>
          const text = typeof r.text === 'string' ? r.text.trim() : ''
          if (!text) return null
          return { text, marks: num(r.marks) }
        })
        .filter((x): x is SchemePoint => x !== null)
    : []
  return {
    modelAnswer: typeof o.modelAnswer === 'string' ? o.modelAnswer.trim() : '',
    points,
    total: num(o.total, points.reduce((s, p) => s + p.marks, 0)),
  }
}

// ───────── 評分量表 ─────────
export function buildRubricSystem(subjectName: string | undefined, levelCount: number): string {
  return [
    `${subjLine(subjectName)}為用家俾嘅題目／任務擬一份分析式評分量表（analytic rubric），每個準則 ${levelCount} 個表現等級（由高到低）。`,
    '只輸出一個 JSON 物件，唔好有任何其他文字或 markdown code fence：',
    '{',
    '  "criteria": [{"name": "準則名", "levels": [{"label": "等級（如 優/良/可/待改進）", "descriptor": "該等級具體表現描述", "marks": 分數}]}]',
    '}',
    `規則：繁體中文；每個準則都要 ${levelCount} 個等級（由高分到低分）；descriptor 具體可觀察；只輸出 JSON。`,
  ].join('\n')
}

export function parseRubric(raw: string): Rubric {
  const o = extractJsonObject<Record<string, unknown>>(raw)
  if (!o || typeof o !== 'object') throw new Error('AI 回應格式唔正確，請再試一次。')
  const criteria: RubricCriterion[] = Array.isArray(o.criteria)
    ? o.criteria
        .map((c) => {
          if (!c || typeof c !== 'object') return null
          const r = c as Record<string, unknown>
          const name = typeof r.name === 'string' ? r.name.trim() : ''
          if (!name) return null
          const levels: RubricLevel[] = Array.isArray(r.levels)
            ? r.levels
                .map((l) => {
                  if (!l || typeof l !== 'object') return null
                  const lr = l as Record<string, unknown>
                  const label = typeof lr.label === 'string' ? lr.label.trim() : ''
                  const descriptor = typeof lr.descriptor === 'string' ? lr.descriptor.trim() : ''
                  if (!label && !descriptor) return null
                  return { label: label || '—', descriptor, marks: num(lr.marks) }
                })
                .filter((x): x is RubricLevel => x !== null)
            : []
          if (levels.length === 0) return null
          return { name, levels }
        })
        .filter((x): x is RubricCriterion => x !== null)
    : []
  if (criteria.length === 0) throw new Error('AI 出唔到評分量表，試吓換 Pro 或補充題目。')
  return { criteria }
}
