// ============================================================
//  資源分享區 — 縮略圖生成
//  - image → canvas max 480px → JPEG blob
//  - pdf   → lazy pdf.js → 第一頁 render → JPEG blob
//  - else  → null（顯示 placeholder）
//  NEVER throws — 任何失敗都 return null。
// ============================================================

const MAX_DIM = 480

/** 由圖片檔案生成縮略圖 Blob（JPEG 0.8）。 */
async function thumbFromImage(file: File): Promise<Blob | null> {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      try {
        const ratio = Math.min(MAX_DIM / img.width, MAX_DIM / img.height, 1)
        const w = Math.round(img.width * ratio)
        const h = Math.round(img.height * ratio)
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) { resolve(null); return }
        ctx.drawImage(img, 0, 0, w, h)
        canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.8)
      } catch {
        resolve(null)
      } finally {
        URL.revokeObjectURL(url)
      }
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null) }
    img.src = url
  })
}

/** 由 PDF 檔案生成第一頁縮略圖 Blob（lazy import pdf.js）。 */
async function thumbFromPdf(file: File): Promise<Blob | null> {
  // 延遲載入 pdfjs-dist，避免初始 bundle 太大
  const [pdfjsLib, { default: workerUrl }] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ])
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

  const buf = await file.arrayBuffer()
  const doc = await pdfjsLib.getDocument({ data: buf }).promise
  const page = await doc.getPage(1)
  const viewport = page.getViewport({ scale: 1 })
  const scale = Math.min(MAX_DIM / viewport.width, 1)
  const scaled = page.getViewport({ scale })

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(scaled.width)
  canvas.height = Math.round(scaled.height)
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  await page.render({ canvas, canvasContext: ctx, viewport: scaled }).promise
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.8))
}

/**
 * 為上載檔案生成縮略圖。
 * - image：縮至 480px
 * - pdf：渲染第一頁
 * - 其他或失敗：回 null（caller 顯示 placeholder）
 */
export async function generateThumb(file: File): Promise<Blob | null> {
  try {
    const mime = file.type.toLowerCase()
    if (mime.startsWith('image/')) {
      return await thumbFromImage(file)
    }
    if (mime === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      return await thumbFromPdf(file)
    }
    return null
  } catch {
    return null
  }
}
