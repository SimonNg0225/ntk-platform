import { extractJsonObject } from '../../../lib/aiJson'
import type { Deck, Slide, SlideChart } from '../../../lib/export'

// ============================================================
//  教學簡報 — Prompt 建構 + 解析（純函式，可單元測試）
// ============================================================

export function buildSlideSystem(subjectName: string | undefined, count: number): string {
  const subjectLine = subjectName ? `任教科目：${subjectName}。` : ''
  return [
    `你係教學簡報設計助手。${subjectLine}根據用家俾嘅課題或內容，設計一套教學 PowerPoint 大綱。`,
    '只輸出一個 JSON 物件，唔好有任何其他文字或 markdown code fence：',
    '{',
    '  "title": "簡報標題",',
    '  "subtitle": "副標題（科目／課題／班級，簡短）",',
    '  "slides": [',
    '    {"title": "版面標題", "bullets": ["3-5 個要點，每點精簡一句，唔好成段"], "notes": "講者備註（老師講解提示，1-2 句）", "chart": null}',
    '  ]',
    '}',
    '規則：',
    '- 一律用繁體中文（可書面廣東話）。',
    `- 約 ${count} 版內容（唔計封面）；由淺入深、有教學邏輯（導入→概念→例子→練習→總結）。`,
    '- 每版 3-5 個要點，係短句／關鍵詞，唔好成段文字。',
    '- notes 寫老師口頭講解提示。',
    '- 涉及數據（佔比／趨勢／比較）嘅版，可加 "chart"，否則一律 "chart": null：',
    '    {"type":"bar|line|pie","categories":["標籤1","標籤2"],"series":[{"name":"系列名","values":[數字,…]}],"unit":"%（選填）"}',
    '  · pie 只放一條 series；每條 series 嘅 values 數量要同 categories 一致（用真實合理數字）。',
    '  · 全套最多 1-2 版有圖表，揀最值得視覺化嗰啲，唔好版版都加。',
    '- 只輸出 JSON，唔好有多餘文字。',
  ].join('\n')
}

/** 解析 chart 欄位；唔合格回 undefined（向後相容）。 */
function parseChart(raw: unknown): SlideChart | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const c = raw as Record<string, unknown>
  const type = c.type
  if (type !== 'bar' && type !== 'line' && type !== 'pie') return undefined
  const categories = Array.isArray(c.categories)
    ? c.categories.filter((x): x is string => typeof x === 'string').map((x) => x.trim()).filter(Boolean)
    : []
  const series = (Array.isArray(c.series) ? c.series : [])
    .map((s): { name: string; values: number[] } | null => {
      if (!s || typeof s !== 'object') return null
      const r = s as Record<string, unknown>
      const values = Array.isArray(r.values)
        ? r.values.filter((v): v is number => typeof v === 'number' && isFinite(v))
        : []
      if (values.length === 0) return null
      return { name: typeof r.name === 'string' && r.name.trim() ? r.name.trim() : '數據', values }
    })
    .filter((x): x is { name: string; values: number[] } => x !== null)
  if (categories.length === 0 || series.length === 0) return undefined
  const unit = typeof c.unit === 'string' && c.unit.trim() ? c.unit.trim() : undefined
  return { type, categories, series, unit }
}

/** 解析 AI 簡報回應；格式唔正確 throw。 */
export function parseDeck(raw: string, fallbackTitle: string): Deck {
  const o = extractJsonObject<Record<string, unknown>>(raw)
  if (!o || typeof o !== 'object') {
    throw new Error('AI 回應格式唔正確，請再試一次。')
  }

  const title =
    typeof o.title === 'string' && o.title.trim() ? o.title.trim() : fallbackTitle || '教學簡報'
  const subtitle =
    typeof o.subtitle === 'string' && o.subtitle.trim() ? o.subtitle.trim() : undefined

  const slides: Slide[] = []
  if (Array.isArray(o.slides)) {
    for (const s of o.slides) {
      if (!s || typeof s !== 'object') continue
      const rec = s as Record<string, unknown>
      const slideTitle = typeof rec.title === 'string' ? rec.title.trim() : ''
      const bullets = Array.isArray(rec.bullets)
        ? rec.bullets
            .filter((x): x is string => typeof x === 'string')
            .map((x) => x.trim())
            .filter(Boolean)
        : []
      if (!slideTitle && bullets.length === 0) continue
      const notes = typeof rec.notes === 'string' && rec.notes.trim() ? rec.notes.trim() : undefined
      const chart = parseChart(rec.chart)
      slides.push({ title: slideTitle || '（未命名）', bullets, notes, chart })
    }
  }

  if (slides.length === 0) {
    throw new Error('AI 出唔到簡報內容，試吓換 Pro 或補充課題。')
  }

  return { title, subtitle, slides }
}
