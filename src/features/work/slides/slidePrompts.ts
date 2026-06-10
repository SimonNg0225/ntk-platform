import { extractJsonObject } from '../../../lib/aiJson'
import type {
  Deck,
  Slide,
  SlideChart,
  SlideCompare,
  SlideLayout,
  SlideQuote,
  SlideStat,
  SlideStep,
} from '../../../lib/export/types'

// ============================================================
//  教學簡報 — Prompt 建構 + 解析（純函式，可單元測試）
// ============================================================

export function buildSlideSystem(subjectName: string | undefined, count: number): string {
  const subjectLine = subjectName ? `任教科目：${subjectName}。` : ''
  const lines = [
    `你係教學簡報設計助手。${subjectLine}根據用家俾嘅課題或內容，設計一套教學 PowerPoint 大綱。`,
    '只輸出一個 JSON 物件，唔好有任何其他文字或 markdown code fence：',
    '{',
    '  "title": "簡報標題",',
    '  "subtitle": "副標題（科目／課題／班級，簡短）",',
    '  "coverImageQuery": "封面相英文搜尋詞（1-4 個英文字）",',
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
    '- 內容啱先好揀 "layout" 版式（唔填 = 普通要點版）；揀咗 layout 嗰版都一樣要出 bullets（同一內容嘅要點版本，做後備同講義），再另出對應欄位：',
    '  · "layout":"stats" — 有 2-4 個關鍵數字想做大先用（全套最多 2 版），另加：',
    '    "stats":[{"value":"75%","label":"合格率"},{"value":"1842","label":"南京條約年份"}]（value ≤8 字、label ≤20 字）',
    '  · "layout":"compare" — 正反／異同／A 對 B 先用，另加：',
    '    "compare":{"leftTitle":"優點","left":["要點一","要點二"],"rightTitle":"缺點","right":["要點一","要點二"]}（兩邊各 2-4 點，每點 ≤30 字）',
    '  · "layout":"steps" — 流程／步驟／時序先用，另加：',
    '    "steps":[{"title":"步驟名","desc":"簡短說明（選填）"}]（2-5 步，title ≤12 字、desc ≤40 字）',
    '  · "layout":"quote" — 金句／定義一句想做大先用（全套最多 1 版），另加：',
    '    "quote":{"text":"一句金句或定義","attribution":"出處（選填）"}（text ≤60 字）',
  ]
  if (count >= 8) {
    lines.push('- 可以插 1-2 版章節分隔版：title 係章節名、"bullets": []，唔使 layout，用嚟分大段落。')
  }
  lines.push(
    '- 講具體實物／場景、值得配相嘅版，可加 "imageQuery"：1-4 個字嘅英文 Pexels 搜尋詞（例 "great wall china"）；全套最多 4 版有 imageQuery。',
    '- "coverImageQuery" 必須出：1-4 個字嘅英文搜尋詞，配合簡報主題搵封面相。',
    '- 只輸出 JSON，唔好有多餘文字。',
  )
  return lines.join('\n')
}

// ───────── 解析小工具 ─────────

/** 截長：超過 max 就斬到 max-1 加 '…'（結果長度 ≤ max）。 */
function clamp(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, Math.max(0, max - 1)) + '…'
}

/** trim 後非空先回傳，否則 undefined。 */
function cleanStr(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined
  const s = raw.trim()
  return s ? s : undefined
}

/** 英文搜尋詞：trim + 摺疊空白 + 最多 4 個字。 */
function parseImageQuery(raw: unknown): string | undefined {
  const s = cleanStr(raw)
  if (!s) return undefined
  return s.split(/\s+/).slice(0, 4).join(' ')
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

/** stats：逐項要 value+label 字串，截長後 2-4 項先有效；唔合格回 undefined。 */
function parseStats(raw: unknown): SlideStat[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const items: SlideStat[] = []
  for (const it of raw) {
    if (!it || typeof it !== 'object') continue
    const r = it as Record<string, unknown>
    const value = cleanStr(r.value)
    const label = cleanStr(r.label)
    if (!value || !label) continue
    items.push({ value: clamp(value, 8), label: clamp(label, 20) })
  }
  return items.length >= 2 && items.length <= 4 ? items : undefined
}

/** compare：兩邊 title 非空 + 各 2-4 點（每點 ≤30 字）先有效。 */
function parseCompare(raw: unknown): SlideCompare | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const r = raw as Record<string, unknown>
  const leftTitle = cleanStr(r.leftTitle)
  const rightTitle = cleanStr(r.rightTitle)
  if (!leftTitle || !rightTitle) return undefined
  const side = (v: unknown): string[] =>
    Array.isArray(v)
      ? v
          .filter((x): x is string => typeof x === 'string')
          .map((x) => x.trim())
          .filter(Boolean)
          .map((x) => clamp(x, 30))
      : []
  const left = side(r.left)
  const right = side(r.right)
  const ok = (a: string[]) => a.length >= 2 && a.length <= 4
  if (!ok(left) || !ok(right)) return undefined
  return { leftTitle, rightTitle, left, right }
}

/** steps：逐步要 title（≤12 字），desc 選填（≤40 字）；2-5 步先有效。 */
function parseSteps(raw: unknown): SlideStep[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const items: SlideStep[] = []
  for (const it of raw) {
    if (!it || typeof it !== 'object') continue
    const r = it as Record<string, unknown>
    const title = cleanStr(r.title)
    if (!title) continue
    const desc = cleanStr(r.desc)
    items.push({ title: clamp(title, 12), desc: desc ? clamp(desc, 40) : undefined })
  }
  return items.length >= 2 && items.length <= 5 ? items : undefined
}

/** quote：text 非空（≤60 字）先有效，attribution 選填。 */
function parseQuote(raw: unknown): SlideQuote | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const r = raw as Record<string, unknown>
  const text = cleanStr(r.text)
  if (!text) return undefined
  const attribution = cleanStr(r.attribution)
  return { text: clamp(text, 60), attribution }
}

/**
 * 逐款 layout 嚴格驗證：合格先保留 layout + 對應欄位；
 * 唔合格靜默回退普通要點版（永不因 layout 問題 throw）。
 */
function parseLayoutFields(rec: Record<string, unknown>): Partial<Slide> {
  const layout = rec.layout
  if (layout === 'stats') {
    const stats = parseStats(rec.stats)
    return stats ? { layout: 'stats' satisfies SlideLayout, stats } : {}
  }
  if (layout === 'compare') {
    const compare = parseCompare(rec.compare)
    return compare ? { layout: 'compare' satisfies SlideLayout, compare } : {}
  }
  if (layout === 'steps') {
    const steps = parseSteps(rec.steps)
    return steps ? { layout: 'steps' satisfies SlideLayout, steps } : {}
  }
  if (layout === 'quote') {
    const quote = parseQuote(rec.quote)
    return quote ? { layout: 'quote' satisfies SlideLayout, quote } : {}
  }
  // 'section' 喺 parseDeck 處理（normalize bullets=[]）；'bullets'／未知值 = 預設要點版
  return {}
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
  const coverImageQuery = parseImageQuery(o.coverImageQuery)

  const slides: Slide[] = []
  if (Array.isArray(o.slides)) {
    for (const s of o.slides) {
      if (!s || typeof s !== 'object') continue
      const rec = s as Record<string, unknown>
      const slideTitle = typeof rec.title === 'string' ? rec.title.trim() : ''
      // AI 顯式出 layout:'section' → normalize 成空 bullets（之後由 bullets.length===0 推斷）
      const isSection = rec.layout === 'section'
      const bullets = isSection
        ? []
        : Array.isArray(rec.bullets)
          ? rec.bullets
              .filter((x): x is string => typeof x === 'string')
              .map((x) => x.trim())
              .filter(Boolean)
              .slice(0, 6)
              .map((x) => clamp(x, 60))
          : []
      if (!slideTitle && bullets.length === 0) continue
      const notes = typeof rec.notes === 'string' && rec.notes.trim() ? rec.notes.trim() : undefined
      const chart = parseChart(rec.chart)
      const imageQuery = parseImageQuery(rec.imageQuery)
      const layoutFields: Partial<Slide> = isSection ? { layout: 'section' } : parseLayoutFields(rec)
      slides.push({ title: slideTitle || '（未命名）', bullets, notes, chart, imageQuery, ...layoutFields })
    }
  }

  if (slides.length === 0) {
    throw new Error('AI 出唔到簡報內容，試吓換 Pro 或補充課題。')
  }

  return { title, subtitle, slides, coverImageQuery }
}
