// ============================================================
//  行政文件 — docx 引擎（純邏輯，可測）
//  ------------------------------------------------------------
//  保留原 .docx 格式，淨係換 `{標籤}` 文字（佔位填充）：
//  輸出係真正 .docx，格式 100% 不變（唔做 HTML 重 render）。
//  全部 client-side：PizZip 讀 / 砌 zip、docxtemplater 抽標籤 + 填充。
// ============================================================

import PizZip from 'pizzip'
import Docxtemplater from 'docxtemplater'

const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

/**
 * 建立 docxtemplater 實例（統一設定）。
 * - delimiters `{` … `}`：對齊老師手動寫嘅 `{標籤}`。
 * - paragraphLoop / linebreaks：對 Word 段落結構較友善。
 */
function makeDoc(buf: ArrayBuffer): Docxtemplater {
  const zip = new PizZip(buf)
  return new Docxtemplater(zip, {
    delimiters: { start: '{', end: '}' },
    paragraphLoop: true,
    linebreaks: true,
  })
}

/**
 * 抽出範本入面所有 `{標籤}`（去重、保留首次出現次序）。
 *
 * docxtemplater 嘅 `getFullText()` 會把分散喺多個 `<w:t>` run 嘅文字接返一齊，
 * 解決 Word 將一個標籤拆散落唔同 run 嘅問題；再用正則抽 `{…}` 內容。
 */
export function extractTags(buf: ArrayBuffer): string[] {
  const doc = makeDoc(buf)
  const fullText = doc.getFullText()
  const out: string[] = []
  const seen = new Set<string>()
  const re = /\{([^{}]+)\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(fullText)) !== null) {
    const tag = m[1].trim()
    if (tag && !seen.has(tag)) {
      seen.add(tag)
      out.push(tag)
    }
  }
  return out
}

/**
 * 以 `data` 填充範本，回傳填好嘅 .docx Blob（格式原封不動）。
 *
 * @throws 友善 Error —— 當 docxtemplater 因標籤錯誤（如未閉合 `{`、
 *         未知標籤等）拋 TemplateError 時，盡量列出問題標籤。
 */
export function fillDocx(buf: ArrayBuffer, data: Record<string, string>): Blob {
  let doc: Docxtemplater
  try {
    // 注意：docxtemplater v3 喺 constructor 階段就 parse/compile 範本，
    // 未閉合 `{` 等標籤錯誤會喺 `new Docxtemplater` 拋（唔係喺 render），
    // 故 construction + render 一齊包喺 try 入面。
    doc = makeDoc(buf)
    doc.render(data)
  } catch (e) {
    throw toFriendlyTemplateError(e)
  }
  return doc.getZip().generate({
    type: 'blob',
    mimeType: DOCX_MIME,
    compression: 'DEFLATE', // 壓縮輸出；否則預設 STORE 會令生成檔脹大約 7x
  }) as unknown as Blob
}

/**
 * 把 docxtemplater TemplateError 轉成畀用戶睇得明嘅 Error。
 * docxtemplater 會喺 `e.properties.errors[]` 列出每個有問題嘅標籤
 * （每項通常有 `.properties.id` / `.properties.context` / `.message`）。
 */
function toFriendlyTemplateError(e: unknown): Error {
  const err = e as {
    properties?: {
      errors?: Array<{
        message?: string
        properties?: { id?: string; context?: string; explanation?: string }
      }>
    }
    message?: string
  }
  const list = err?.properties?.errors
  if (Array.isArray(list) && list.length > 0) {
    const details = list
      .map((it) => {
        const ctx = it.properties?.context
        const explanation = it.properties?.explanation
        return explanation || ctx || it.message || it.properties?.id || '未知標籤'
      })
      .filter(Boolean)
    const uniq = [...new Set(details)]
    return new Error(`範本標籤有問題：${uniq.join('；')}。請檢查 { } 是否成對。`)
  }
  return new Error(
    `範本填充失敗：${err?.message || '標籤格式可能有誤'}。請檢查 { } 是否成對。`,
  )
}

/**
 * 抽範本嘅純文字（畀 Phase 2 AI 讀範本內容用）。
 * 直接讀 `word/document.xml` → strip `<…>` tag → 解基本 XML entity。
 * 失敗（壞檔 / 冇 document.xml）回空字串，唔拋錯。
 */
export function extractText(buf: ArrayBuffer): string {
  try {
    const zip = new PizZip(buf)
    const xml = zip.file('word/document.xml')?.asText()
    if (!xml) return ''
    // 段落 / 換行先轉做空白，避免相鄰字黐埋
    const spaced = xml
      .replace(/<\/w:p>/g, '\n')
      .replace(/<w:br\s*\/?>/g, '\n')
      .replace(/<w:tab\s*\/?>/g, '\t')
    const stripped = spaced.replace(/<[^>]+>/g, '')
    return decodeXmlEntities(stripped).replace(/\n{3,}/g, '\n\n').trim()
  } catch {
    return ''
  }
}

/** 解基本 XML entity（&amp; &lt; &gt; &quot; &apos; + 數字實體）。 */
function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, '&') // 最後先解 &amp;，免得二次解碼
}

// ------------------------------------------------------------
//  base64 ↔ ArrayBuffer helper
//  範本以 base64 存落 localStorage（adminDocStore），用時轉返 buffer。
// ------------------------------------------------------------

/** ArrayBuffer → base64 字串。 */
export function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let binary = ''
  const chunk = 0x8000 // 分段避免 String.fromCharCode 爆 stack
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

/** base64 字串 → ArrayBuffer。 */
export function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64)
  const len = binary.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}
