// ============================================================
//  行政文件 — PDF 預覽引擎（pdf.js 渲染 + 彩色欄位框）
//  ------------------------------------------------------------
//  目的：似 docx 嗰個彩色預覽 —— 用 pdf.js 逐頁 render 落 <canvas>，
//  再喺每頁上面按 AcroForm 欄位嘅 widget 座標疊半透彩色框，逐欄分辨。
//
//  - PDF 原點喺左下、HTML 原點喺左上 → overlay top 要 y 翻轉。
//  - 每頁包一層 position:relative wrapper：canvas 喺底、彩色框 div 喺面。
//  - render 失敗照 throw，畀上層（PdfTemplatePreview）退「純清單」fallback。
//  - 純 DOM 操作（唔依賴 React），同 highlight.ts 嘅 renderWithHighlights 平行。
// ============================================================

import * as pdfjsLib from 'pdfjs-dist'
import type { PDFDocumentProxy } from 'pdfjs-dist'
// Vite：?url 會將 worker 打包成獨立 asset 並回傳其 URL，喺 build 後 worker 仍可載入。
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { PdfFieldRect } from './pdfEngine'

/**
 * 渲染所需嘅最小欄位形狀（畀疊框用）：
 * 只需 `name`（= 對應 fieldColors / data-tag）+ `rects`（widget 座標連頁 index）。
 * `PdfField`（pdfEngine）天然兼容此形狀。
 */
export interface RenderableField {
  name: string
  rects: PdfFieldRect[]
}

// 全模組設定一次 worker（重設同值無害）。
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

/** 單頁最大 render 闊度（device px）——避免超大 PDF 撐爆記憶體；scale 以容器闊度為準但封頂。 */
const MAX_RENDER_WIDTH = 1400
/** 容器量唔到闊度時嘅後備 CSS 闊度（px）。 */
const FALLBACK_WIDTH = 360

/**
 * 喺 `container` 內用 pdf.js 渲染 `buf`（PDF ArrayBuffer）每一頁，
 * 並按 `fields` 嘅 widget 座標疊半透彩色框（顏色由 `fieldColors`：欄位 name → 色）。
 *
 * - 清空 container → 逐頁 render → 每頁一個 `.adoc-pdf-page` relative wrapper
 *   （canvas 在底、`.adoc-pdf-box` 彩色框 div 在面，`data-tag` = 欄位 name）。
 * - scale 自適容器闊度（fit-width），封頂 MAX_RENDER_WIDTH。
 * - 座標換算（見檔頭）：
 *     left = rect.x * scale
 *     top  = (該頁 PDF 高度 − rect.y − rect.h) * scale
 *     w/h  = rect.w/h * scale
 * - render 失敗 → throw（上層 fallback）。成功後 container 內就係完整彩色預覽。
 *
 * @param container 目標容器元素
 * @param buf       PDF 內容（ArrayBuffer）
 * @param fields    欄位陣列（rects 連頁 index + PDF 單位座標）
 * @param fieldColors 欄位 name → CSS 顏色（疊框背景 + 邊框用）
 */
export async function renderPdfWithFieldBoxes(
  container: HTMLElement,
  buf: ArrayBuffer,
  fields: RenderableField[],
  fieldColors: Map<string, string>,
): Promise<void> {
  container.innerHTML = ''

  // pdf.js 會「轉移」傳入嘅 buffer（detach），故傳 copy，唔好整爛 caller 個 buf。
  const data = buf.slice(0)

  const loadingTask = pdfjsLib.getDocument({ data })
  let pdf: PDFDocumentProxy
  try {
    pdf = await loadingTask.promise
  } catch (e) {
    throw new Error(
      `PDF 預覽載入失敗：${(e as Error)?.message ?? '檔案可能已損壞'}`,
    )
  }

  try {
    // fit-width scale：以容器內可用闊度為準（量唔到用後備）。
    const containerWidth =
      container.clientWidth > 0 ? container.clientWidth : FALLBACK_WIDTH

    // 按頁 index 歸類欄位 rect（連顏色），畀逐頁疊框。
    // 每項 = { name, color, x, y, w, h }（PDF 單位）。
    const rectsByPage = groupRectsByPage(fields, fieldColors)

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum)

      // 該頁 PDF 單位尺寸（scale=1）——畀 y 翻轉計頁高。
      const baseViewport = page.getViewport({ scale: 1 })
      const pdfPageHeight = baseViewport.height

      // 自適 scale（封頂 MAX_RENDER_WIDTH），令窄屏 375px 都見到全頁、
      // 又唔會 render 過大谷爆記憶體。
      const cappedWidth = Math.min(containerWidth, MAX_RENDER_WIDTH)
      const scale = cappedWidth / baseViewport.width

      const viewport = page.getViewport({ scale })

      // 每頁 wrapper（relative）：canvas 在底、彩色框在面。
      const pageWrap = container.ownerDocument.createElement('div')
      pageWrap.className = 'adoc-pdf-page'
      pageWrap.style.position = 'relative'
      pageWrap.style.margin = '0 auto 14px'
      pageWrap.style.width = `${viewport.width}px`
      pageWrap.style.maxWidth = '100%'

      const canvas = container.ownerDocument.createElement('canvas')
      canvas.width = Math.floor(viewport.width)
      canvas.height = Math.floor(viewport.height)
      // CSS 闊 = render 尺寸；max-width:100% + height:auto 令過闊時等比縮。
      canvas.style.display = 'block'
      canvas.style.width = `${viewport.width}px`
      canvas.style.maxWidth = '100%'
      canvas.style.height = 'auto'
      canvas.style.borderRadius = '6px'
      canvas.style.boxShadow = '0 1px 8px rgba(0,0,0,0.12)'
      pageWrap.appendChild(canvas)

      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('PDF 預覽失敗：無法取得 canvas 繪圖內容。')

      await page.render({ canvas, canvasContext: ctx, viewport }).promise

      // ── 疊彩色欄位框（該頁）──
      // 用獨立 overlay 層（絕對定位、撐滿 wrapper），令 canvas max-width 縮放時
      // overlay 亦跟住（百分比定位，唔受 device px 影響）。
      const overlay = container.ownerDocument.createElement('div')
      overlay.className = 'adoc-pdf-overlay'
      overlay.style.position = 'absolute'
      overlay.style.inset = '0'
      overlay.style.pointerEvents = 'none'

      const pageRects = rectsByPage.get(pageNum - 1) // rects 用 0-based page
      if (pageRects) {
        for (const r of pageRects) {
          // 以「render 尺寸」為基準計百分比（overlay 與 canvas 同框、會一齊縮）。
          const leftPct = ((r.x * scale) / viewport.width) * 100
          const topPct =
            (((pdfPageHeight - r.y - r.h) * scale) / viewport.height) * 100
          const wPct = ((r.w * scale) / viewport.width) * 100
          const hPct = ((r.h * scale) / viewport.height) * 100

          const box = container.ownerDocument.createElement('div')
          box.className = 'adoc-pdf-box'
          box.setAttribute('data-tag', r.name)
          box.style.position = 'absolute'
          box.style.left = `${leftPct}%`
          box.style.top = `${topPct}%`
          box.style.width = `${wPct}%`
          box.style.height = `${hPct}%`
          box.style.background = r.color
          box.style.border = `1.5px solid ${solidify(r.color)}`
          box.style.borderRadius = '3px'
          box.style.boxSizing = 'border-box'
          box.style.boxShadow = '0 0 0 1px rgba(0,0,0,0.08)'
          overlay.appendChild(box)
        }
      }
      pageWrap.appendChild(overlay)
      container.appendChild(pageWrap)

      // 釋放該頁資源（大型 PDF 慳記憶體）。
      page.cleanup()
    }
  } finally {
    // 收尾：銷毀此 document 嘅 transport（GlobalWorkerOptions 嘅 worker 仍共用、
    // 唔受影響）。pdfjs v6：PDFDocumentProxy 冇 destroy，改由 loadingTask.destroy。
    try {
      await loadingTask.destroy()
    } catch {
      /* destroy 失敗無傷大雅 */
    }
  }
}

/** 每頁（0-based index）→ 該頁所有欄位 rect（連 name + 色）。 */
interface PlacedRect {
  name: string
  color: string
  x: number
  y: number
  w: number
  h: number
}

function groupRectsByPage(
  fields: RenderableField[],
  fieldColors: Map<string, string>,
): Map<number, PlacedRect[]> {
  const byPage = new Map<number, PlacedRect[]>()
  const fallbackColor = 'rgba(20, 184, 166, 0.4)' // teal，欄位無對應色時用。
  for (const f of fields) {
    const color = fieldColors.get(f.name) ?? fallbackColor
    for (const rect of f.rects) {
      const list = byPage.get(rect.page) ?? []
      list.push({
        name: f.name,
        color,
        x: rect.x,
        y: rect.y,
        w: rect.w,
        h: rect.h,
      })
      byPage.set(rect.page, list)
    }
  }
  return byPage
}

/**
 * 將半透 rgba 顏色轉成較實淨嘅邊框色（提高 alpha）。
 * 接受 `rgba(r, g, b, a)`；其餘格式原樣回傳（border 用原色都可接受）。
 */
function solidify(color: string): string {
  const m = color.match(
    /^rgba\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*[\d.]+\s*\)$/i,
  )
  if (!m) return color
  return `rgba(${m[1]}, ${m[2]}, ${m[3]}, 0.95)`
}
