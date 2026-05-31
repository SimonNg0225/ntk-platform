import type { LucideIcon } from 'lucide-react'
import {
  HelpCircle,
  BookA,
  SquareDashedBottom,
  CheckCheck,
} from 'lucide-react'
import type {
  CardType,
  Difficulty,
  OutLang,
  Preset,
  RawCard,
} from './types'

// ============================================================
//  生成設定 metadata + prompt 組裝 + 草稿映射
//  ------------------------------------------------------------
//  純資料 / 純函式，唔 import React。每種卡型自己一套：
//    - JSON shape 描述（教 Gemini 點吐）
//    - runtime 抽 front/back 邏輯（assembleDraft）
//    - 草稿渲染提示（背面 placeholder 等留俾 UI）
// ============================================================

// ───────── 卡型 ─────────
export const CARD_TYPES: {
  id: CardType
  label: string
  desc: string
  icon: LucideIcon
}[] = [
  { id: 'qa', label: '問答', desc: '問題 → 答案', icon: HelpCircle },
  { id: 'term', label: '詞彙', desc: '名詞 → 定義', icon: BookA },
  { id: 'cloze', label: '填空', desc: '句子挖空填字', icon: SquareDashedBottom },
  { id: 'tf', label: '是非', desc: '命題 → 真假 + 解釋', icon: CheckCheck },
]

export const CARD_TYPE_LABEL: Record<CardType, string> = {
  qa: '問答',
  term: '詞彙',
  cloze: '填空',
  tf: '是非',
}

// ───────── 難度 ─────────
export const DIFFICULTIES: { id: Difficulty; label: string; hint: string }[] = [
  { id: 'basic', label: '基礎', hint: '定義 / 事實，啱啱入門' },
  { id: 'intermediate', label: '進階', hint: '理解 + 應用，溫書主力' },
  { id: 'challenge', label: '挑戰', hint: '分析 / 比較 / 易混淆位' },
]

const DIFFICULTY_INSTRUCT: Record<Difficulty, string> = {
  basic: '卡片要簡單直接，集中喺核心定義同基本事實，啱啱接觸呢個題目嘅人都明。',
  intermediate:
    '卡片要考理解同應用，包含關鍵概念之間嘅關係，適合溫習主力使用。',
  challenge:
    '卡片要有深度，包含分析、比較、容易混淆嘅地方同常見錯誤，挑戰高階理解。',
}

// ───────── 語言 ─────────
export const LANGS: { id: OutLang; label: string }[] = [
  { id: 'zh', label: '繁體中文' },
  { id: 'en', label: 'English' },
  { id: 'bi', label: '中英對照' },
]

const LANG_INSTRUCT: Record<OutLang, string> = {
  zh: '全部內容用繁體中文。',
  en: 'Write every field in English only.',
  bi: '每個欄位用「繁體中文（English）」嘅雙語格式，中文行先、括號內附對應英文。',
}

// ───────── 每種卡型嘅 JSON 結構說明 ─────────
const SHAPE_INSTRUCT: Record<CardType, string> = {
  qa: '陣列每一項係 {"front":"問題","back":"答案"}。front 為簡短問題或提示，back 為清晰、完整但精煉嘅答案。',
  term: '陣列每一項係 {"front":"名詞或術語","back":"定義同解釋"}。front 淨係該名詞本身，back 為其定義（可加一句例子）。',
  cloze:
    '陣列每一項係 {"text":"一句完整句子，但將關鍵字眼用兩重花括號包住做挖空","answer":"被挖空嗰個字眼","hint":"可選提示"}。例如 {"text":"光合作用喺植物嘅{{葉綠體}}入面發生","answer":"葉綠體"}。每句只挖一個最重要嘅空。',
  tf: '陣列每一項係 {"statement":"一句可判斷真假嘅命題","answer":"true 或 false（細楷字串）","explain":"一句解釋點解"}。真同假嘅命題大致各半，唔好全部都係真。',
}

// ───────── 組總 system prompt ─────────
export function buildSystemPrompt(
  type: CardType,
  difficulty: Difficulty,
  lang: OutLang,
): string {
  return [
    '你係一個專業嘅知識卡（flashcards）製作助手，幫人將學習材料變成高質素溫習卡。',
    `卡型：${SHAPE_INSTRUCT[type]}`,
    `難度：${DIFFICULTY_INSTRUCT[difficulty]}`,
    `語言：${LANG_INSTRUCT[lang]}`,
    '每張卡必須獨立成立、無歧義、可直接用嚟自我測驗；唔好重複內容。',
    '只輸出一個 JSON 陣列，唔好有任何解說文字，唔好用 markdown，唔好加 ``` 圍欄，淨係回個 JSON 陣列本身。',
  ].join('\n')
}

export function buildUserPrompt(
  topic: string,
  count: number,
  avoidFronts: string[],
): string {
  let p = `主題 / 筆記材料：\n${topic}\n\n請根據以上材料生成 ${count} 張知識卡。`
  if (avoidFronts.length > 0) {
    const sample = avoidFronts.slice(0, 40).join('、')
    p += `\n\n以下卡已經存在，唔好重複生成相同或極相似嘅卡：${sample}`
  }
  return p
}

// ───────── RawCard → 草稿 front/back（逐卡型映射 + 驗證）─────────
function s(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

/**
 * 將 AI 回嘅一項 raw 物件，按卡型抽出 { front, back }。
 * 任何必要欄位缺失 / 空白 → 回 null（呼叫端會 filter 走）。
 */
export function assembleDraft(
  type: CardType,
  raw: RawCard,
): { front: string; back: string } | null {
  if (type === 'cloze') {
    const text = s(raw.text)
    const answer = s(raw.answer)
    if (!text || !answer) return null
    const hint = s(raw.hint)
    // 正面：將 {{答案}} 換成 ____；背面：答案（+ 提示）
    const front = text.replace(/\{\{[^}]*\}\}/g, '＿＿＿＿')
    const back = hint ? `${answer}（提示：${hint}）` : answer
    // 若無成功挖空（AI 冇用花括號），當無效
    if (front === text) return null
    return { front, back }
  }
  if (type === 'tf') {
    const statement = s(raw.statement)
    const ans = s(raw.answer).toLowerCase()
    if (!statement || (ans !== 'true' && ans !== 'false')) return null
    const explain = s(raw.explain)
    const verdict = ans === 'true' ? '✓ 正確' : '✗ 錯誤'
    const back = explain ? `${verdict} — ${explain}` : verdict
    return { front: `【是非】${statement}`, back }
  }
  // qa / term 共用 front/back
  const front = s(raw.front)
  const back = s(raw.back)
  if (!front || !back) return null
  return { front, back }
}

// ───────── Prompt 範本庫 ─────────
export const PRESETS: Preset[] = [
  {
    id: 'p-bafs-4p',
    label: '市場營銷 4P',
    emoji: '📈',
    type: 'term',
    topic:
      '市場營銷組合 4P：產品（Product）、價格（Price）、地點（Place）、推廣（Promotion）。逐個解釋定義同例子。',
  },
  {
    id: 'p-econ-demand',
    label: '經濟：需求定律',
    emoji: '💹',
    type: 'qa',
    topic:
      '需求定律、供應定律、市場均衡、價格機制、彈性（需求 / 供應彈性）等微觀經濟核心概念。',
  },
  {
    id: 'p-bio-cell',
    label: '生物：細胞',
    emoji: '🧬',
    type: 'cloze',
    topic:
      '細胞結構與功能：細胞膜、細胞核、線粒體、葉綠體、核糖體、內質網等胞器嘅功能。',
  },
  {
    id: 'p-hist-china',
    label: '歷史：辛亥革命',
    emoji: '📜',
    type: 'qa',
    topic: '辛亥革命嘅背景、經過、主要人物、結果同歷史意義。',
  },
  {
    id: 'p-eng-idioms',
    label: 'English idioms',
    emoji: '🔤',
    type: 'term',
    topic:
      'Common English idioms for DSE writing: break the ice, hit the books, piece of cake, under the weather, etc. Give meaning and example.',
  },
  {
    id: 'p-acct-ratio',
    label: '會計：財務比率',
    emoji: '🧾',
    type: 'qa',
    topic:
      '會計財務比率：流動比率、速動比率、毛利率、純利率、存貨周轉率，計算公式同意義。',
  },
]
