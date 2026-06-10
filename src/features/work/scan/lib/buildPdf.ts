import { PDFDocument, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import type { ScanPage, OcrWord } from './types'
import { pageDimsFromImage, mapBboxToPdf } from './pdfText'
import { recognize } from './ocr'

// Noto Sans TC（繁中）靜態字重 Regular 單一 instance，嵌入時子集化 → 輸出 PDF 唔脹。
// 用 @expo-google-fonts npm 套件（pin 版本）經 jsDelivr：
//   - content-type: font/ttf、access-control-allow-origin: *（瀏覽器 fetch CORS OK）
//   - sfnt magic 00 01 00 00（真 TrueType，pdf-lib + fontkit 可子集嵌入）
//   - 靜態字重（非 variable）→ 子集化穩陣。
// （原 plan 嘅 notofonts.github.io hinted 路徑已 403，故改用此可靠來源。）
const CJK_FONT_URL =
  'https://cdn.jsdelivr.net/npm/@expo-google-fonts/noto-sans-tc@0.4.3/400Regular/NotoSansTC_400Regular.ttf'

let fontBytesP: Promise<ArrayBuffer> | null = null
function cjkFontBytes(): Promise<ArrayBuffer> {
  if (!fontBytesP) {
    fontBytesP = fetch(CJK_FONT_URL).then((r) => {
      if (!r.ok) throw new Error('CJK 字型載入失敗')
      return r.arrayBuffer()
    })
  }
  return fontBytesP
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const b64 = dataUrl.split(',')[1]
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function imgDims(dataUrl: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
    img.onerror = () => reject(new Error('圖片量度失敗'))
    img.src = dataUrl
  })
}

export interface BuildOptions {
  ocr: boolean
  /** 進度回呼（0..1） */
  onProgress?: (done: number, total: number) => void
}

/**
 * 將多頁掃描砌成一個 PDF（Uint8Array）。
 * ocr=true → 對每頁跑 OCR，於 word bbox 畫透明文字做可搜尋層。
 * OCR 任何一步失敗（離線/CDN）→ 靜默跳過該頁文字層（仍出圖片 PDF）。
 */
export async function buildScanPdf(pages: ScanPage[], opts: BuildOptions): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  let font: Awaited<ReturnType<PDFDocument['embedFont']>> | null = null
  if (opts.ocr) {
    try {
      doc.registerFontkit(fontkit)
      font = await doc.embedFont(await cjkFontBytes(), { subset: true })
    } catch {
      font = null // 字型攞唔到 → 全部跳過文字層
    }
  }

  for (let i = 0; i < pages.length; i++) {
    const p = pages[i]
    const { w: imgW, h: imgH } = await imgDims(p.processedDataUrl)
    const dims = pageDimsFromImage(imgW, imgH)
    const page = doc.addPage([dims.w, dims.h])
    // 黑白濾鏡輸出 PNG（無損）；彩色/灰階係 JPEG。按格式 embed。
    const bytes = dataUrlToBytes(p.processedDataUrl)
    const embedded = p.processedDataUrl.startsWith('data:image/png')
      ? await doc.embedPng(bytes)
      : await doc.embedJpg(bytes)
    page.drawImage(embedded, { x: 0, y: 0, width: dims.w, height: dims.h })

    if (opts.ocr && font) {
      try {
        const words: OcrWord[] = await recognize(p.processedDataUrl)
        for (const wd of words) {
          const r = mapBboxToPdf(wd.bbox, { w: imgW, h: imgH }, dims)
          if (r.h <= 0 || r.w <= 0) continue
          try {
            page.drawText(wd.text, {
              x: r.x,
              y: r.y,
              size: r.h,
              font,
              color: rgb(0, 0, 0),
              opacity: 0, // 隱形：可搜尋但唔遮圖
            })
          } catch {
            // 子集字型 cmap 缺某字 → pdf-lib 會喺 drawText 度 throw；
            // 跳過呢個字，唔好整冧成頁文字層。
          }
        }
      } catch {
        /* OCR 失敗 → 此頁無文字層，照出 */
      }
    }
    opts.onProgress?.(i + 1, pages.length)
  }
  return doc.save()
}

/** 逐張分檔：每頁獨立一個 PDF。 */
export async function buildPerPagePdfs(
  pages: ScanPage[],
  opts: BuildOptions,
): Promise<Uint8Array[]> {
  const out: Uint8Array[] = []
  for (let i = 0; i < pages.length; i++) {
    out.push(await buildScanPdf([pages[i]], { ocr: opts.ocr }))
    opts.onProgress?.(i + 1, pages.length)
  }
  return out
}
