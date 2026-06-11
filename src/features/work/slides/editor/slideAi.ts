import { complete, type AIModel } from '../../../../lib/aiClient'
import type { Slide, SlideLayout } from '../../../../lib/export/types'
import { parseSlideJson } from '../slidePrompts'

// ============================================================
//  單版 AI 助力 — 「AI 重寫呢版」「AI 幫我轉版式」
//  ------------------------------------------------------------
//  輸入成版 Slide JSON，AI 回同 schema 嘅一版；parseSlideJson 驗唔過
//  就 throw（UI toast、原版唔郁）。轉版式會額外檢查 layout 有冇跟到。
// ============================================================

const LAYOUT_ZH: Record<SlideLayout, string> = {
  bullets: '要點',
  stats: '大數字',
  compare: '對比',
  steps: '流程',
  quote: '金句',
  cards: '分類卡',
  section: '章節',
}

const SLIDE_SCHEMA = [
  '輸出一版嘅 JSON 物件（只輸出 JSON，唔好有其他文字或 code fence）：',
  '{"title":"版面標題","bullets":["3-5 個精簡要點"],"notes":"講者備註（選填）","subtitle":"英文對照副題（選填）","takeaway":"一句包底重點（選填，≤40 字）","imageQuery":"英文配相搜尋詞（選填，1-4 個字）","chart":null,',
  ' "layout":"bullets|stats|compare|steps|quote|cards（選填）",',
  ' "stats":[{"value":"75%","label":"合格率"}]（layout=stats 先出，2-4 項，value ≤8 字、label ≤20 字）,',
  ' "compare":{"leftTitle":"優點","left":["…"],"rightTitle":"缺點","right":["…"]}（layout=compare 先出，兩邊各 2-4 點）,',
  ' "steps":[{"title":"步驟名","desc":"說明（選填）"}]（layout=steps 先出，2-5 步）,',
  ' "quote":{"text":"金句","attribution":"出處（選填）"}（layout=quote 先出，text ≤60 字）,',
  ' "cards":[{"title":"卡題","desc":"說明（選填）"}]（layout=cards 先出，2-6 張）}',
  '規則：繁體中文（可書面廣東話）；揀咗 layout 都一樣要出 bullets（同一內容嘅要點版本）；唔好作框架以外嘅新事實。',
].join('\n')

function systemFor(subjectName: string | undefined, jobLine: string): string {
  const subjectLine = subjectName ? `任教科目：${subjectName}。` : ''
  return [`你係教學簡報編輯助手。${subjectLine}${jobLine}`, SLIDE_SCHEMA].join('\n')
}

/** AI 重寫一版（可附一句指示，例如「淺白啲，俾中一學生」）。失敗 throw。 */
export async function rewriteSlide(
  slide: Slide,
  instruction: string,
  model: AIModel,
): Promise<Slide> {
  const job = instruction.trim()
    ? `按用家指示重寫下面呢一版簡報：「${instruction.trim()}」。保持同一主題，內容可以精煉重組。`
    : '重寫下面呢一版簡報：精煉文字、執靚結構，保持同一主題同內容範圍。'
  const raw = await complete({
    system: systemFor(undefined, job),
    messages: [{ role: 'user', content: JSON.stringify(slide) }],
    model,
    temperature: 0.5,
  })
  return parseSlideJson(raw)
}

/** AI 將一版轉做指定版式（規則轉唔靚時用）。轉完 layout 唔對 → throw。 */
export async function aiConvertSlide(
  slide: Slide,
  target: SlideLayout,
  model: AIModel,
): Promise<Slide> {
  const job = `將下面呢一版簡報轉做「${LAYOUT_ZH[target]}」版式（"layout":"${target}"），將現有內容重組入對應結構欄位，唔好加入新事實。`
  const raw = await complete({
    system: systemFor(undefined, job),
    messages: [{ role: 'user', content: JSON.stringify(slide) }],
    model,
    temperature: 0.4,
  })
  const out = parseSlideJson(raw)
  const outLayout = out.layout ?? 'bullets'
  if (outLayout !== target) {
    throw new Error('AI 轉唔到呢個版式（內容可能唔夾），可以試吓手動執。')
  }
  return out
}
