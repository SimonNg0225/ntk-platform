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
export interface Slide {
  title: string
  bullets: string[]
  /** 講者備註（選填） */
  notes?: string
}

export interface Deck {
  title: string
  subtitle?: string
  slides: Slide[]
}
