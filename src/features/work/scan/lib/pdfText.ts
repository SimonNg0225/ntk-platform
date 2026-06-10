// A4 長邊 842pt、短邊 595pt（72dpi）。我哋只用長邊封頂，短邊跟比例。
const A4_LONG = 842

export interface Dims { w: number; h: number }

/** 由圖片像素尺寸計 PDF 頁面點尺寸：長邊封頂 A4 長邊，保持比例。 */
export function pageDimsFromImage(imgW: number, imgH: number): Dims {
  const longEdge = Math.max(imgW, imgH)
  const k = A4_LONG / longEdge
  return { w: Math.round(imgW * k), h: Math.round(imgH * k) }
}

export interface Rect { x: number; y: number; w: number; h: number }

/**
 * 將 OCR bbox（像素、原點左上）換算成 pdf-lib 矩形（pt、原點左下）。
 * @param img  OCR 當時圖片像素尺寸
 * @param page PDF 頁面點尺寸
 */
export function mapBboxToPdf(
  bbox: { x0: number; y0: number; x1: number; y1: number },
  img: Dims,
  page: Dims,
): Rect {
  const sx = page.w / img.w
  const sy = page.h / img.h
  const w = (bbox.x1 - bbox.x0) * sx
  const h = (bbox.y1 - bbox.y0) * sy
  const x = bbox.x0 * sx
  const y = page.h - bbox.y1 * sy // 翻 Y：用 y1（bbox 底）做基線
  return { x, y, w, h }
}
