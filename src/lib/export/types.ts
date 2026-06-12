// ============================================================
//  匯出 — 統一內容模型
//  ------------------------------------------------------------
//  各功能將自己嘅資料轉成 ExportDoc（文件）或 Deck（簡報），
//  再交畀 docx / print / pptx 砌成檔案。Gemini 只負責出內容。
// ============================================================

export type ExportBlock =
  | { kind: 'heading'; text: string; level?: 1 | 2 }
  | { kind: 'paragraph'; text: string }
  | { kind: 'bullets'; items: string[] }
  | { kind: 'numbered'; items: string[] }

export interface ExportDoc {
  title: string
  subtitle?: string
  blocks: ExportBlock[]
}

// ───────── 簡報 ─────────
/** 數據圖表（選填）— 數據課題用，pptx 以 addChart 渲染（零成本） */
export interface SlideChart {
  type: 'bar' | 'line' | 'pie'
  /** x 軸（bar/line）或圓餅切片 標籤 */
  categories: string[]
  /** 數據系列（pie 只用第一條）；values 長度應同 categories 一致 */
  series: { name: string; values: number[] }[]
  /** 單位（選填，如「%」「萬元」） */
  unit?: string
}

/** 版式 — 缺省 'bullets'；bullets.length===0 視為 'section'（章節分隔） */
export type SlideLayout = 'bullets' | 'stats' | 'compare' | 'steps' | 'quote' | 'cards' | 'section'

/** 並列概念卡 — title ≤12 字，desc ≤36 字 */
export interface SlideCard {
  title: string
  desc?: string
}

/** 大數字 tile — value ≤8 字（'75%'/'1842'），label ≤20 字 */
export interface SlideStat {
  value: string
  label: string
}

/** 兩欄對比 — 每邊 2-4 點，每點 ≤30 字 */
export interface SlideCompare {
  leftTitle: string
  left: string[]
  rightTitle: string
  right: string[]
}

/** 流程步驟 — title ≤12 字，desc ≤40 字 */
export interface SlideStep {
  title: string
  desc?: string
}

/** 大引文 — text ≤60 字 */
export interface SlideQuote {
  text: string
  attribution?: string
}

export interface Slide {
  title: string
  /** 短副題（選填）— 多數係英文對照（雙語課堂），版題下細字 */
  subtitle?: string
  /** 永遠必填（兜底 + 兼容舊紀錄）；每點 ≤60 字，≤6 點 */
  bullets: string[]
  /** 講者備註（選填） */
  notes?: string
  /** 數據圖表（選填） */
  chart?: SlideChart
  /** 版式（選填）— 缺省 'bullets'；bullets.length===0 視為 'section' */
  layout?: SlideLayout
  /** layout='stats' 用 — 2-4 項先有效 */
  stats?: SlideStat[]
  /** layout='compare' 用 */
  compare?: SlideCompare
  /** layout='steps' 用 — 2-5 步先有效 */
  steps?: SlideStep[]
  /** layout='quote' 用 */
  quote?: SlideQuote
  /** layout='cards' 用 — 2-6 張並列概念卡先有效 */
  cards?: SlideCard[]
  /** 包底重點（選填）— 一句 ≤46 字，render 做版底色帶 */
  takeaway?: string
  /** 英文 Pexels 搜尋詞（1-4 個字），值得配相嘅版先有 */
  imageQuery?: string
  /** 重點版（選填）— AI 標全套 1-3 版最重要嘅，引擎加重處理（accent L-frame）造輕重節奏 */
  emphasis?: boolean
}

export interface Deck {
  title: string
  subtitle?: string
  slides: Slide[]
  /** 英文封面搜尋詞（選填） */
  coverImageQuery?: string
}

/** 高擬真標題圖（Canvas 用招牌字體 render 嘅標題 PNG）— 高擬真模式封面用 */
export interface CoverTitle {
  /** PNG data URI */
  dataUri: string
  /** 圖闊/高比例 */
  aspect: number
}
