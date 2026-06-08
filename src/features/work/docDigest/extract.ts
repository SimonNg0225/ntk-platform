import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { extractText as extractDocxText } from '../adminDocs/docxEngine'
import type { AIImage } from '../../../lib/aiClient'
import type { DigestSource } from './digestStore'

// ============================================================
//  文件速讀 — 由檔案抽出文字／圖片
//  · .docx → 用行政文件已有嘅 extractText
//  · .pdf  → pdf.js 逐頁 getTextContent（掃描件抽唔到字 → 回空，由上層提示影相）
//  · 圖片  → base64 AIImage，交畀 Gemini Vision
// ============================================================

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

export interface ExtractResult {
  text: string
  image?: AIImage
  sourceType: DigestSource
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
    return { text: (await extractPdfText(await file.arrayBuffer())).trim(), sourceType: 'pdf' }
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

async function extractPdfText(buf: ArrayBuffer): Promise<string> {
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise
  const parts: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const line = content.items
      .map((it) => ('str' in it ? it.str : ''))
      .join(' ')
    parts.push(line)
  }
  return parts.join('\n')
}
