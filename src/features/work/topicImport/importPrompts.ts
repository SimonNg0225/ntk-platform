import { parseJsonArray } from '../../../lib/aiJson'

// ============================================================
//  課題匯入 — 由官方課程文件抽出課題結構（純函式，可單元測試）
// ============================================================

export interface ImportedTopic {
  part: string
  area: string
  topic: string
}

export function buildImportSystem(subjectName?: string): string {
  const subj = subjectName ? `（科目：${subjectName}）` : ''
  return [
    `你係香港課程助手${subj}。用家會俾你一份官方課程文件（課程及評估指引／補充資料／syllabus）。請抽出課題結構。`,
    '只輸出一個 JSON 陣列，每個元素：',
    '{"part":"部分（如 必修／選修；冇就空字串）","area":"單元／範疇（如 1(a) 營商環境）","topic":"課題名"}',
    '規則：',
    '- 照官方用詞同編號；由大到細保持原文次序。',
    '- 只抽「課題」層級，唔使逐條學習元素細節。',
    '- 繁體中文；只輸出 JSON 陣列，唔好其他文字或 code fence。',
  ].join('\n')
}

export function parseTopics(raw: string): ImportedTopic[] {
  const rows = parseJsonArray<unknown>(raw)
  if (rows === null) throw new Error('AI 回應格式唔正確，請再試一次。')
  const out: ImportedTopic[] = []
  for (const r of rows) {
    if (!r || typeof r !== 'object') continue
    const o = r as Record<string, unknown>
    const topic = typeof o.topic === 'string' ? o.topic.trim() : ''
    if (!topic) continue
    out.push({
      part: typeof o.part === 'string' ? o.part.trim() : '',
      area: typeof o.area === 'string' ? o.area.trim() : '',
      topic,
    })
  }
  if (out.length === 0) throw new Error('抽唔到課題，試吓換 Pro 或確認文件內容。')
  return out
}
