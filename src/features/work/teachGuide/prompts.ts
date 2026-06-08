import { extractJsonObject } from '../../../lib/aiJson'

// ============================================================
//  教學指引 — Prompt 建構 + 解析（純函式，可單元測試）
// ============================================================

export interface GuideResult {
  keyPoints: string[]
  misconceptions: string[]
  steps: string[]
  activities: string[]
  differentiation: string[]
  assessment: string[]
}

export const GUIDE_KEYS: (keyof GuideResult)[] = [
  'keyPoints',
  'misconceptions',
  'steps',
  'activities',
  'differentiation',
  'assessment',
]

export function buildGuideSystem(subjectName?: string): string {
  const subjectLine = subjectName
    ? `任教科目：${subjectName}。`
    : ''
  return [
    `你係香港資深教師嘅備課顧問。${subjectLine}用家會俾你一個課題，請出一份「教學指引」，幫老師諗清楚「點教」，唔係淨係出材料。`,
    '只輸出一個 JSON 物件，唔好有任何其他文字或 markdown code fence：',
    '{',
    '  "keyPoints": ["3-5 個教學重點（學生最需要掌握嘅核心）"],',
    '  "misconceptions": ["3-5 個學生常見誤解／錯概念，每個簡述點解會錯"],',
    '  "steps": ["建議教學步驟，由淺入深（導入→講解→練習→總結），每步一句"],',
    '  "activities": ["2-3 個可落地嘅課堂活動（簡述點做）"],',
    '  "differentiation": ["對能力強同弱嘅學生分別點調整（2-4 點）"],',
    '  "assessment": ["2-3 個檢視學生係咪學識嘅方法（口頭／小測／觀察等）"]',
    '}',
    '規則：',
    '- 一律用繁體中文（可書面廣東話）。',
    '- 貼香港課程同實際課堂情況；具體、可落地，唔好空泛。',
    '- 每個陣列至少 2 項；冇就回空陣列 []。',
    '- 只輸出 JSON，唔好有多餘文字。',
  ].join('\n')
}

/** 解析 AI 教學指引回應；格式唔正確 throw。 */
export function parseGuide(raw: string): GuideResult {
  const o = extractJsonObject<Record<string, unknown>>(raw)
  if (!o || typeof o !== 'object') {
    throw new Error('AI 回應格式唔正確，請再試一次。')
  }
  const arr = (v: unknown): string[] =>
    Array.isArray(v)
      ? v.filter((x): x is string => typeof x === 'string').map((s) => s.trim()).filter(Boolean)
      : []
  return {
    keyPoints: arr(o.keyPoints),
    misconceptions: arr(o.misconceptions),
    steps: arr(o.steps),
    activities: arr(o.activities),
    differentiation: arr(o.differentiation),
    assessment: arr(o.assessment),
  }
}

/** 一份指引係咪完全空（六段都冇內容）。 */
export function isEmptyGuide(g: GuideResult): boolean {
  return GUIDE_KEYS.every((k) => g[k].length === 0)
}
