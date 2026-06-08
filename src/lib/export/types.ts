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

export interface Slide {
  title: string
  bullets: string[]
  /** 講者備註（選填） */
  notes?: string
  /** 數據圖表（選填） */
  chart?: SlideChart
}

export interface Deck {
  title: string
  subtitle?: string
  slides: Slide[]
}
