// ============================================================
//  資源縮略圖生成（共用）
//  - image → canvas max 480px → JPEG blob
//  - pdf   → lazy pdf.js（Vite ?worker）→ 第一頁 → JPEG blob
//  - else  → null（顯示 placeholder）
//  NEVER throws — 任何失敗都 return null（並 console.warn 方便排查）。
// ============================================================

const MAX_DIM = 480

type ThumbInput = Blob & { name?: string }

async function thumbFromImage(file: ThumbInput): Promise<Blob | null> {
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

// pdfjs worker：用 Vite `?worker` 由打包器正確 emit（避免 production 用 `?url`
// 時 worker 路徑 404 → 回 index.html →「text/html is not a valid JavaScript
// MIME type」）。只 init 一次共用同一個 worker port。
let pdfjsReady: Promise<typeof import('pdfjs-dist')> | null = null
function loadPdfjs(): Promise<typeof import('pdfjs-dist')> {
  if (!pdfjsReady) {
    pdfjsReady = (async () => {
      const [pdfjsLib, { default: PdfWorker }] = await Promise.all([
        import('pdfjs-dist'),
        import('pdfjs-dist/build/pdf.worker.min.mjs?worker'),
      ])
      pdfjsLib.GlobalWorkerOptions.workerPort = new PdfWorker()
      return pdfjsLib
    })()
  }
  return pdfjsReady
}

async function thumbFromPdf(file: ThumbInput): Promise<Blob | null> {
  const pdfjsLib = await loadPdfjs()
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
 * 為上載檔案生成縮略圖（image / pdf）。其他類型或失敗 → null（caller 出 placeholder）。
 */
export async function generateThumb(file: ThumbInput): Promise<Blob | null> {
  try {
    const mime = (file.type || '').toLowerCase()
    const name = (file.name || '').toLowerCase()
    if (mime.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/.test(name)) {
      return await thumbFromImage(file)
    }
    if (mime === 'application/pdf' || name.endsWith('.pdf')) {
      return await thumbFromPdf(file)
    }
    return null
  } catch (e) {
    console.warn('[thumb] generateThumb 失敗：', e)
    return null
  }
}
