import { extractText as extractDocxText } from '../adminDocs/docxEngine'
import type { AIImage } from '../../../lib/aiClient'
import type { DigestSource } from './digestStore'

// ============================================================
//  文件速讀 — 由檔案抽出文字／圖片
//  · .docx → 用行政文件已有嘅 extractText
//  · .pdf  → pdf.js 逐頁 getTextContent；空頁 fallback Gemini Vision（hybrid）
//  · 圖片  → base64 AIImage，交畀 Gemini Vision
//  ⚠️ pdfjs 改為「用到先 import」：避免喺模組載入時 touch DOMMatrix
//     （測試 / SSR 環境冇 DOMMatrix），亦慳首屏 bundle。
//  Vision fallback：字數 < BLANK_THRESHOLD 嘅頁 → canvas render → 批次一個 call
//  成本控制：上限 MAX_VISION_PAGES 頁；超出部分保留 pdf.js 原文（可能為空）。
// ============================================================

/** 字數少於此閾值嘅頁視為掃描頁 / 空頁，交 Vision 補字 */
const BLANK_THRESHOLD = 50
/** 每份文件最多幾多頁交 Vision 處理（~50頁≈HK$0.04，超出部分留空） */
const MAX_VISION_PAGES = 50

export interface ExtractResult {
  text: string
  image?: AIImage
  sourceType: DigestSource
  /** PDF 含掃描頁，已用 Gemini Vision 補字 */
  usedVision?: boolean
  /** 掃描頁超出上限、未處理（留空）嘅頁數；0 = 全部處理到 */
  scanPagesDropped?: number
}

export async function extractFromFile(file: File): Promise<ExtractResult> {
  const name = file.name.toLowerCase()

  if (file.type.startsWith('image/')) {
    return { text: '', image: await fileToImage(file), sourceType: 'photo' }
  }
  if (name.endsWith('.docx')) {
    const buf = await file.arrayBuffer()
    return { text: extractDocxText(buf).trim(), sourceType: 'docx' }
  }
  if (name.endsWith('.pdf')) {
    const { text, usedVision, scanPagesDropped } = await extractPdfText(await file.arrayBuffer())
    return { text: text.trim(), sourceType: 'pdf', usedVision, scanPagesDropped }
  }
  // 其他：當純文字（.txt 等）
  return { text: (await file.text()).trim(), sourceType: 'docx' }
}

export async function fileToImage(file: File): Promise<AIImage> {
  const data = await fileToBase64(file)
  return { mimeType: file.type || 'image/jpeg', data }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result)
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = () => reject(new Error('讀取檔案失敗'))
    reader.readAsDataURL(file)
  })
}

async function extractPdfText(
  buf: ArrayBuffer,
): Promise<{ text: string; usedVision: boolean; scanPagesDropped: number }> {
  const pdfjsLib = await import('pdfjs-dist')
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise

  // ── 第一輪：pdf.js 抽字，標記字數不足嘅空頁 ──────────────────────
  const pageTexts: string[] = []
  const blankNums: number[] = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const text = content.items.map((it) => ('str' in it ? it.str : '')).join(' ')
    pageTexts.push(text)
    if (text.trim().length < BLANK_THRESHOLD) blankNums.push(i)
  }

  if (blankNums.length === 0) {
    return { text: pageTexts.join('\n'), usedVision: false, scanPagesDropped: 0 }
  }

  // ── 第二輪：空頁 canvas render → batch Gemini Vision ──────────────
  const visionNums = blankNums.slice(0, MAX_VISION_PAGES)
  const scanPagesDropped = blankNums.length - visionNums.length

  const images: (AIImage | null)[] = await Promise.all(
    visionNums.map(async (num) => {
      try {
        const page = await pdf.getPage(num)
        const viewport = page.getViewport({ scale: 1.5 })
        const canvas = document.createElement('canvas')
        canvas.width = viewport.width
        canvas.height = viewport.height
        await page.render({ canvas, viewport }).promise
        const data = canvas.toDataURL('image/jpeg', 0.85).split(',')[1]
        return { mimeType: 'image/jpeg', data } satisfies AIImage
      } catch {
        return null
      }
    }),
  )

  const validPairs = visionNums
    .map((num, i) => ({ num, img: images[i] }))
    .filter((p): p is { num: number; img: AIImage } => p.img !== null && p.img.data.length > 0)

  if (validPairs.length > 0) {
    const visionTexts = await batchVisionExtract(
      validPairs.map((p) => p.img),
      validPairs.map((p) => p.num),
    )
    for (let i = 0; i < validPairs.length; i++) {
      pageTexts[validPairs[i].num - 1] = visionTexts[i]
    }
  }

  return { text: pageTexts.join('\n'), usedVision: true, scanPagesDropped }
}

/**
 * 一次 Gemini Vision call 批次抽多頁圖片文字。
 * 回傳陣列長度同 images 一致；call 失敗或某頁無內容均回空字串。
 */
async function batchVisionExtract(images: AIImage[], pageNums: number[]): Promise<string[]> {
  const { complete } = await import('../../../lib/aiClient')
  const isMulti = images.length > 1
  const prompt = isMulti
    ? `以下 ${images.length} 張圖片係掃描文件嘅第 ${pageNums.join('、')} 頁。請逐頁抽出所有文字，每頁之間用「---PAGE---」分隔，唔需要其他說明。`
    : '請抽出這頁掃描文件的所有文字，保留原有格式，唔需要其他說明。'

  try {
    const result = await complete({
      messages: [{ role: 'user', content: prompt, images }],
      model: 'gemini-2.5-flash',
      source: 'doc-digest',
    })
    if (!isMulti) return [result.trim()]
    const parts = result.split('---PAGE---')
    return pageNums.map((_, i) => parts[i]?.trim() ?? '')
  } catch {
    return pageNums.map(() => '')
  }
}
