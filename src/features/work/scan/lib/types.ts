export interface Pt { x: number; y: number }
export interface Corners { tl: Pt; tr: Pt; br: Pt; bl: Pt }
export type Filter = 'color' | 'gray' | 'bw'
export type OutputMode = 'merged' | 'perPage'

export interface OcrWord { text: string; bbox: { x0: number; y0: number; x1: number; y1: number } }

export interface ScanPage {
  id: string
  rawDataUrl: string          // 原圖（可重新裁切）
  corners: Corners | null     // null = 未偵到 / 用全幅
  filter: Filter
  processedDataUrl: string     // 拉正＋濾鏡後（render / OCR / PDF 用）
}
