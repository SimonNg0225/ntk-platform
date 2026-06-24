import { extractJsonObject } from '../../../lib/aiJson'
import type { ObservationCriterionKey } from '../../../data/types'

// ============================================================
//  觀課／評課 — Prompt + 解析（純函式，可單元測試）
//  仿 transcribePrompts.ts「叫 AI 回 JSON + parse + 容錯」模式
// ============================================================

// 六準則固定次序 + 廣東話 label（UI 同 prompt 共用呢個 single source of truth）
export const CRITERIA: { key: ObservationCriterionKey; label: string }[] = [
  { key: 'objectives', label: '教學目標達成' },
  { key: 'classroom', label: '課堂管理' },
  { key: 'engagement', label: '學生參與' },
  { key: 'questioning', label: '提問技巧' },
  { key: 'timing', label: '時間運用' },
  { key: 'differentiation', label: '差異化照顧' },
]

export interface ObservationSummary {
  criteria: { key: ObservationCriterionKey; note: string }[]
  highlights: string[]
  improvements: string[]
}

// 表單 meta（component 傳入）
export interface ObservationMeta {
  teacher: string
  subject: string
  klass: string
  topic: string
  period: string
  date: string
}

export function buildObservationSystem(): string {
  return [
    '你係資深教師發展主任，幫同事做觀課評課。用家會俾你一段課堂內容（文字稿）。',
    '請對住以下六個觀課準則逐項觀察（每準則 key → 中文意思）：',
    '• objectives = 教學目標達成（教學目標清唔清晰、有冇達成）',
    '• classroom = 課堂管理（秩序、流程、指令、節奏）',
    '• engagement = 學生參與（學生投入度、互動、回應）',
    '• questioning = 提問技巧（問題層次、追問、候答）',
    '• timing = 時間運用（環節分配、有冇拖／趕）',
    '• differentiation = 差異化照顧（照顧不同程度學生、支援與延伸）',
    '只輸出一個 JSON 物件，唔好有任何其他文字或 markdown code fence：',
    '{',
    '  "criteria": [',
    '    {"key":"objectives","note":"一兩句觀察"},',
    '    {"key":"classroom","note":"一兩句觀察"},',
    '    {"key":"engagement","note":"一兩句觀察"},',
    '    {"key":"questioning","note":"一兩句觀察"},',
    '    {"key":"timing","note":"一兩句觀察"},',
    '    {"key":"differentiation","note":"一兩句觀察"}',
    '  ],',
    '  "highlights": ["整體亮點（2-3 點）"],',
    '  "improvements": ["改進建議（2-3 點）"]',
    '}',
    '規則：繁體中文（廣東話書面語）；針對老師教學，零學生個人資料；',
    '每準則 note 一兩句；criteria 六項齊；只輸出 JSON。',
  ].join('\n')
}

export function buildObservationUser(meta: ObservationMeta, source: string): string {
  const lines = [
    '【觀課資料】',
    `被觀老師：${meta.teacher || '（未填）'}`,
    `科目：${meta.subject || '（未填）'}`,
    `班別：${meta.klass || '（未填）'}`,
    `課題：${meta.topic || '（未填）'}`,
    `節次：${meta.period || '（未填）'}`,
    `日期：${meta.date || '（未填）'}`,
    '',
    '【課堂內容文字稿】',
    source.trim(),
  ]
  return lines.join('\n')
}

export function parseObservationSummary(raw: string): ObservationSummary {
  const o = extractJsonObject<Record<string, unknown>>(raw)
  if (!o || typeof o !== 'object') throw new Error('AI 回應格式唔正確，請再試一次。')

  const arr = (v: unknown): string[] =>
    Array.isArray(v)
      ? v.filter((x): x is string => typeof x === 'string').map((s) => s.trim()).filter(Boolean)
      : []

  // criteria 按 CRITERIA 固定六項對齊（AI 漏項補空 note，順序穩定）
  const rawCriteria = Array.isArray(o.criteria) ? (o.criteria as unknown[]) : []
  const noteByKey = new Map<string, string>()
  for (const item of rawCriteria) {
    if (item && typeof item === 'object') {
      const k = (item as Record<string, unknown>).key
      const n = (item as Record<string, unknown>).note
      if (typeof k === 'string' && typeof n === 'string') {
        noteByKey.set(k, n.trim())
      }
    }
  }
  const criteria = CRITERIA.map(({ key }) => ({ key, note: noteByKey.get(key) ?? '' }))

  const highlights = arr(o.highlights)
  const improvements = arr(o.improvements)

  // 全空（六準則 note 皆空 + 冇亮點 + 冇建議）= AI 實質上冇撮要到嘢，
  // 視為失敗 throw，行返 retry 流程，唔好落地一個全空嘅死記錄。
  const hasAnything =
    criteria.some((c) => c.note.trim()) || highlights.length > 0 || improvements.length > 0
  if (!hasAnything) throw new Error('AI 今次抽唔到觀察內容，請再試一次。')

  return {
    criteria,
    highlights,
    improvements,
  }
}
