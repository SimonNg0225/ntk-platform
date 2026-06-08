// ============================================================
//  文件速讀 — Prompt 建構 + 回應解析（純函式，可單元測試）
// ============================================================

export const DIGEST_CATEGORIES = [
  '校務通告',
  '家長通告',
  '會議文件',
  '行政表格',
  '政策指引',
  '課程相關',
  '其他',
] as const

export type DigestCategory = (typeof DIGEST_CATEGORIES)[number]

export interface DigestResult {
  title: string
  category: string
  summary: string[]
  actions: { text: string; date?: string }[]
}

/** 組裝 system prompt。today = 今日 YYYY-MM-DD，用嚟換算相對日期。 */
export function buildDigestSystem(today: string): string {
  return [
    '你係香港學校嘅行政文件助手。用家會俾你一份行政／校務文件（通告、會議文件、表格、政策、家長信等，可能係文字或圖片）。',
    '請快速「速讀」，然後**只輸出一個 JSON 物件**，唔好有任何其他文字、解釋或 markdown code fence。',
    '格式：',
    '{',
    '  "title": "一句精簡標題（≤20字）",',
    `  "category": "由以下其中一個揀最貼切：${DIGEST_CATEGORIES.join(' / ')}",`,
    '  "summary": ["3至6個重點，每點一句精簡繁體中文"],',
    '  "actions": [{"text": "老師要跟進嘅事項（動作＋對象）", "date": "YYYY-MM-DD（無明確截止日就省略）"}]',
    '}',
    '規則：',
    '- 一律用繁體中文（可書面廣東話）。',
    '- summary 抽最重要嘅資訊：決定、時間、地點、要求、金額等。',
    '- actions 只放「老師要做」嘅跟進事項；冇就用空陣列 []。',
    `- 日期換算成實際 YYYY-MM-DD（今日係 ${today}）。相對日期（如「下星期五」）盡量推算；唔肯定就唔好作 date，直接省略。`,
    '- 一定要係有效 JSON，唔可以有多餘文字。',
  ].join('\n')
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** 由模型原始輸出抽出 JSON 並穩健解析；失敗 throw。 */
export function parseDigest(raw: string): DigestResult {
  const json = extractJsonObject(raw)
  if (!json) throw new Error('AI 回應格式唔正確，請再試一次。')

  let obj: unknown
  try {
    obj = JSON.parse(json)
  } catch {
    throw new Error('AI 回應格式唔正確，請再試一次。')
  }
  if (!obj || typeof obj !== 'object') {
    throw new Error('AI 回應格式唔正確，請再試一次。')
  }

  const o = obj as Record<string, unknown>

  const title =
    typeof o.title === 'string' && o.title.trim() ? o.title.trim() : '未命名文件'

  const category =
    typeof o.category === 'string' &&
    (DIGEST_CATEGORIES as readonly string[]).includes(o.category.trim())
      ? o.category.trim()
      : '其他'

  const summary = Array.isArray(o.summary)
    ? o.summary
        .filter((s): s is string => typeof s === 'string')
        .map((s) => s.trim())
        .filter(Boolean)
    : []

  const actions: DigestResult['actions'] = []
  if (Array.isArray(o.actions)) {
    for (const a of o.actions) {
      if (!a || typeof a !== 'object') continue
      const rec = a as Record<string, unknown>
      const text = typeof rec.text === 'string' ? rec.text.trim() : ''
      if (!text) continue
      const date =
        typeof rec.date === 'string' && DATE_RE.test(rec.date.trim())
          ? rec.date.trim()
          : undefined
      actions.push(date ? { text, date } : { text })
    }
  }

  return { title, category, summary, actions }
}

/** 由可能夾雜 code fence / 前後文字嘅字串，抽出第一個 {...} JSON 區塊。 */
function extractJsonObject(raw: string): string | null {
  if (!raw) return null
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  return raw.slice(start, end + 1)
}
