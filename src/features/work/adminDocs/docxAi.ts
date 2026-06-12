// ============================================================
//  行政文件 — Phase 2 AI 輔助（純邏輯，可測）
//  ------------------------------------------------------------
//  全部 best-effort：失敗一律唔好整爛 Phase 1 可靠流程。
//  本檔三件事：
//   1) suggestFields()  —— 餵範本純文字畀 AI，回建議欄位
//      [{ tag, label, type, anchor }]（anchor=AI 喺文中見到嘅錨點字，
//      如「姓名：____」），用戶可接受／改／棄。
//   2) injectTags()     —— **保守**將明顯空格（連續底線、全形括號、
//      冒號後空白）對應 anchor 喺 document.xml 字串層面換成 {tag}。
//      做唔到嘅就保留、指示用戶手動加。以唔整爛 docx 為先。
//   3) draftContent()   —— 餵欄位 label 清單 + 用戶指示畀 AI，回
//      JSON 物件 { tag: 內容 } 填入表單。
//
//  AI I/O 經 src/lib/aiClient（complete）+ src/lib/aiJson（抽 JSON）。
//  字串 / docx 操作部分純函式，唔 import React / UI。
// ============================================================

import PizZip from 'pizzip'
import { complete, type AIModel } from '../../../lib/aiClient'
import { extractJsonArray, extractJsonObject } from '../../../lib/aiJson'
import type { AdminDocFieldType } from './adminDocStore'

const DEFAULT_MODEL: AIModel = 'gemini-2.5-flash'

/** AI 建議欄位（未落地，用戶可接受／改／棄）。 */
export interface SuggestedField {
  tag: string
  label: string
  type: AdminDocFieldType
  /** AI 喺文中見到嘅錨點字（如「姓名：____」）；用嚟試自動加標籤。 */
  anchor: string
}

// ───────── 1) suggestFields ─────────

const FIELD_TYPES: AdminDocFieldType[] = ['text', 'multiline', 'date']

/** 把任意字串收斂做合法 tag（去 { }、空白、控制字元；限長）。 */
export function sanitizeTag(raw: string): string {
  return raw
    .replace(/[{}]/g, '')
    .replace(/[\r\n\t]+/g, ' ')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 40)
}

/** 把 AI 回嘅 type 字眼收斂做合法 AdminDocFieldType（預設 text）。 */
function coerceType(raw: unknown): AdminDocFieldType {
  const s = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
  return (FIELD_TYPES as string[]).includes(s)
    ? (s as AdminDocFieldType)
    : 'text'
}

function trimStr(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

/**
 * 把 AI 回應 parse 成建議欄位。寬鬆容錯：逐項試，無 tag 嘅略過、
 * tag 去重（保留首次）。純函式，方便測試（畀 raw AI 字串）。
 */
export function parseSuggestedFields(raw: string): SuggestedField[] {
  let rows: unknown[]
  try {
    rows = extractJsonArray<unknown>(raw)
  } catch {
    return []
  }
  const out: SuggestedField[] = []
  const seen = new Set<string>()
  for (const r of rows) {
    if (typeof r !== 'object' || r === null) continue
    const o = r as Record<string, unknown>
    const tag = sanitizeTag(trimStr(o.tag) || trimStr(o.label))
    if (!tag || seen.has(tag)) continue
    seen.add(tag)
    out.push({
      tag,
      label: trimStr(o.label) || tag,
      type: coerceType(o.type),
      anchor: trimStr(o.anchor),
    })
  }
  return out
}

function buildSuggestPrompt(text: string): string {
  // 限長：避免太大範本谷爆 prompt（保守取前段，多數表單欄位喺前面）。
  const clipped = text.length > 6000 ? `${text.slice(0, 6000)}…` : text
  return [
    '你係香港學校行政文件助手。下面係一份 Word 範本（通知／申請表／表格等）抽出嚟嘅純文字。',
    '請搵出所有「需要老師逐次填寫」嘅欄位（例如：學生姓名、班別、日期、事由、家長簽名等），通常係冒號後空白、連續底線「____」、或全形括號「（　）」嘅位置。',
    '唔好把固定文字（標題、說明、客套語）當成欄位。',
    '',
    '只回一個 JSON 陣列（唔好任何解釋文字、唔好 markdown），每個元素格式：',
    '{ "tag": "簡短英文或中文標籤（之後會變成 {tag}，唔好含空格／大括號）", "label": "畀老師睇嘅中文欄位名", "type": "text 或 multiline 或 date", "anchor": "你喺原文見到呢個欄位嘅錨點字（連同冒號／底線／括號原樣，例如「姓名：____」或「日期：」）" }',
    'type 規則：日期類用 date；多行（如事由、備註、地址）用 multiline；其餘用 text。',
    '陣列以外唔好有任何文字。',
    '',
    '範本文字：',
    clipped,
  ].join('\n')
}

/**
 * 餵範本純文字畀 AI，回建議欄位。任何錯誤 throw（呼叫端 try/catch +
 * toast）；extractJsonArray 失敗會 throw 友善中文 Error。
 */
export async function suggestFields(
  text: string,
  model: AIModel = DEFAULT_MODEL,
): Promise<SuggestedField[]> {
  const trimmed = text.trim()
  if (!trimmed) {
    throw new Error('範本冇可讀文字，無法建議欄位。請手動加 {標籤}。')
  }
  const out = await complete({
    model,
    messages: [{ role: 'user', content: buildSuggestPrompt(trimmed) }],
    source: 'admin-docs',
  })
  return parseSuggestedFields(out)
}

// ───────── 2) injectTags（保守自動加標籤） ─────────

export interface InjectResult {
  /** 處理後嘅 docx（base64）；無任何替換時 = 原檔。 */
  base64: string
  /** 成功喺 docx 入面換到 {tag} 嘅 tag 清單。 */
  injected: string[]
  /** 試過但搵唔到 anchor、要用戶手動加嘅 tag 清單。 */
  failed: string[]
}

/**
 * XML escape（把錨點字 / tag 放返 document.xml 前先 escape，
 * 對齊 Word 的 entity；只處理會搞亂 XML 嘅 5 個字元）。
 */
function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** regex 特殊字元 escape（把 anchor 當字面 pattern 用）。 */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * 由一個 anchor 砌出「保守」嘅替換正則 + 換出嚟嘅字串。
 * 支援三種明顯空格形態（全部要喺**同一個 `<w:t>` run 內**，避免跨 run
 * 替換搞爛 XML）：
 *   A. 連續底線：`label____`（半／全形底線 ≥2）→ `label{tag}`
 *   B. 全形括號空白：`label（　）` / `label(  )` → `label（{tag}）`
 *   C. 冒號後空白：`label：` / `label:`（後面係空白 / run 結尾）→ `label：{tag}`
 * anchor 內已有大括號 → 跳過（已係標籤）。搵唔到 → 回 null。
 *
 * 注意：只喺 `<w:t …>…</w:t>` 文字節點內搵 + 換，唔掂任何 XML 標籤。
 */
function buildAnchorReplacer(
  anchorRaw: string,
  tag: string,
): { run: (xml: string) => { xml: string; changed: boolean } } | null {
  const anchor = anchorRaw.trim()
  if (!anchor || /[{}]/.test(anchor)) return null

  // anchor 嘅「標籤文字」部分 = 去掉尾段空白標記（底線／括號／冒號／空白）。
  // 例：「姓名：____」→ label 文字 = 「姓名：」；「事由（　）」→「事由」。
  const label = anchor
    .replace(/[_＿]{2,}\s*$/u, '') // 尾段連續底線
    .replace(/[（(][\s　]*[)）]\s*$/u, '') // 尾段空括號
    .replace(/[\s　]+$/u, '') // 尾段空白
    .trim()
  if (!label) return null

  const tagXml = `{${escapeXml(tag)}}`

  // 偵測 anchor 屬於邊種形態（睇原 anchor 結尾）。
  const hasUnderscore = /[_＿]{2,}\s*$/u.test(anchor)
  const hasParen = /[（(][\s　]*[)）]\s*$/u.test(anchor)
  // 冒號：含全形（U+FF1A）、ASCII（:）、presentation-form ︰（U+FE30）、﹕（U+FE55）、︓（U+FE13）
  const hasColon = /[：:︰﹕︓]\s*$/u.test(label) || /[：:︰﹕︓]/u.test(anchor)

  // 喺 <w:t> 文字內容上做替換嘅 helper：只動文字節點，唔動 tag。
  const onTextNodes = (
    xml: string,
    transform: (text: string) => { text: string; changed: boolean },
  ): { xml: string; changed: boolean } => {
    let changed = false
    // 比對 <w:t> 或 <w:t xml:space="preserve"> … </w:t>
    const re = /(<w:t\b[^>]*>)([\s\S]*?)(<\/w:t>)/g
    const next = xml.replace(re, (whole, open, inner, close) => {
      // inner 係已 XML-escape 嘅文字；我哋喺 escape 後嘅層面比對
      const r = transform(inner as string)
      if (r.changed) changed = true
      return r.changed ? `${open}${r.text}${close}` : whole
    })
    return { xml: next, changed }
  }

  // 用「已 escape」嘅 label 去比對（document.xml 內文字係 escaped）。
  const labelEsc = escapeXml(label)

  if (hasUnderscore) {
    // label 之後緊接連續底線（半／全形）→ 換底線做 {tag}
    const pat = new RegExp(`(${escapeRegExp(labelEsc)})\\s*[_＿]{2,}`, 'u')
    return {
      run: (xml) =>
        onTextNodes(xml, (inner) => {
          if (!pat.test(inner)) return { text: inner, changed: false }
          return { text: inner.replace(pat, `$1${tagXml}`), changed: true }
        }),
    }
  }

  if (hasParen) {
    // label 之後緊接空括號 → 括號內塞 {tag}
    const pat = new RegExp(`(${escapeRegExp(labelEsc)})\\s*[（(][\\s　]*[)）]`, 'u')
    return {
      run: (xml) =>
        onTextNodes(xml, (inner) => {
          if (!pat.test(inner)) return { text: inner, changed: false }
          return {
            text: inner.replace(pat, `$1（${tagXml}）`),
            changed: true,
          }
        }),
    }
  }

  if (hasColon) {
    // label（含冒號）之後係空白 / run 結尾 → 後面補 {tag}
    // 確保唔會喺已有內容（非空白）後亂插。
    const pat = new RegExp(`(${escapeRegExp(labelEsc)})([\\s　]*)$`, 'u')
    return {
      run: (xml) =>
        onTextNodes(xml, (inner) => {
          if (!pat.test(inner)) return { text: inner, changed: false }
          return { text: inner.replace(pat, `$1${tagXml}`), changed: true }
        }),
    }
  }

  return null
}

/**
 * **保守** best-effort 自動加標籤：把每個 (tag, anchor) 喺 document.xml
 * 字串層面試替換成 {tag}。只動 `<w:t>` 文字節點、要求 anchor 喺同一 run
 * 內、形態明顯（底線／空括號／冒號後空白）先換。任何一個 tag 換唔到就
 * 列入 failed（畀 UI 提示用戶手動加）。
 *
 * 安全保證：
 *  - 改完即時用 PizZip 重砌 + 嘗試重新讀文字（sanity）；任何 throw →
 *    放棄全部改動，回原檔 + 全部 failed（**寧願唔改，唔好整爛 docx**）。
 *  - 完全唔掂 XML 結構標籤，只喺文字節點內字面替換。
 */
export function injectTags(
  buf: ArrayBuffer,
  items: { tag: string; anchor: string }[],
): InjectResult {
  const fallback = (): InjectResult => ({
    base64: arrayBufferToBase64Safe(buf),
    injected: [],
    failed: items.map((i) => i.tag),
  })

  let zip: PizZip
  let xml: string | undefined
  try {
    zip = new PizZip(buf)
    xml = zip.file('word/document.xml')?.asText()
  } catch {
    return fallback()
  }
  if (!xml) return fallback()

  const injected: string[] = []
  const failed: string[] = []
  let working = xml

  for (const item of items) {
    const tag = sanitizeTag(item.tag)
    if (!tag) {
      failed.push(item.tag)
      continue
    }
    // 已有此標籤 → 當完成（避免重複插）。
    if (working.includes(`{${escapeXml(tag)}}`)) {
      injected.push(tag)
      continue
    }
    const replacer = buildAnchorReplacer(item.anchor, tag)
    if (!replacer) {
      failed.push(tag)
      continue
    }
    const res = replacer.run(working)
    if (res.changed) {
      working = res.xml
      injected.push(tag)
    } else {
      failed.push(tag)
    }
  }

  if (injected.length === 0) {
    // 冇任何改動，回原檔（base64）。
    return { base64: arrayBufferToBase64Safe(buf), injected: [], failed }
  }

  // 寫返 + sanity：重砌 zip、重新讀文字。任何問題 → 放棄全部改動。
  try {
    zip.file('word/document.xml', working)
    const outBuf = zip.generate({
      type: 'arraybuffer',
      compression: 'DEFLATE', // 壓縮；否則加完標籤嘅範本 base64 會脹大、谷大 localStorage
    }) as unknown as ArrayBuffer
    // sanity：重新開能讀返文字（即 zip / xml 結構未爛）。
    const check = new PizZip(outBuf)
    const reread = check.file('word/document.xml')?.asText()
    if (!reread) throw new Error('reread failed')
    return {
      base64: arrayBufferToBase64Safe(outBuf),
      injected,
      failed,
    }
  } catch {
    // 重砌出問題 → 寧願唔改。
    return fallback()
  }
}

/**
 * base64 helper（與 docxEngine 同款；本檔自帶一份避免循環依賴語意，
 * 行為一致：分段 fromCharCode + btoa）。
 */
function arrayBufferToBase64Safe(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

// ───────── 3) draftContent（AI 草擬內容） ─────────

/**
 * 把 AI 回應 parse 成 { tag: 內容 } map。只收 fields 內存在嘅 tag、
 * 值收斂做字串（非字串者 stringify／略過）。純函式，方便測試。
 */
export function parseDraftContent(
  raw: string,
  fields: { tag: string }[],
): Record<string, string> {
  const obj = extractJsonObject<Record<string, unknown>>(raw)
  if (!obj) return {}
  const allow = new Set(fields.map((f) => f.tag))
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (!allow.has(k)) continue
    if (typeof v === 'string') out[k] = v.trim()
    else if (typeof v === 'number' || typeof v === 'boolean') out[k] = String(v)
    // 其餘類型（object / array / null）略過
  }
  return out
}

function buildDraftPrompt(
  fields: { tag: string; label: string; type: AdminDocFieldType }[],
  instruction: string,
): string {
  const list = fields
    .map((f) => {
      const hint =
        f.type === 'date'
          ? '（日期，格式 YYYY-MM-DD）'
          : f.type === 'multiline'
            ? '（可較長，多句）'
            : ''
      return `- ${f.tag}：${f.label}${hint}`
    })
    .join('\n')
  return [
    '你係香港學校行政文件助手，請根據以下指示，幫老師草擬一份文件各欄位嘅內容。',
    '用繁體中文，語氣正式、得體、貼合香港學校情境。日期欄用 YYYY-MM-DD。',
    '冇足夠資料嘅欄位可留空字串，唔好亂作具體人名／電話／金額。',
    '',
    `老師指示：${instruction.trim()}`,
    '',
    '欄位清單（tag：說明）：',
    list,
    '',
    '只回一個 JSON 物件（唔好任何解釋文字、唔好 markdown），key 為上面嘅 tag，value 為該欄內容字串。',
    '例如：{ "學生姓名": "", "日期": "2026-06-10", "事由": "下週三因校舍維修停課一天。" }',
    'JSON 物件以外唔好有任何文字。',
  ].join('\n')
}

/**
 * 餵欄位 label 清單 + 用戶指示畀 AI，回 { tag: 內容 } 草擬。
 * 任何錯誤 throw（呼叫端 try/catch + toast）。
 */
export async function draftContent(
  fields: { tag: string; label: string; type: AdminDocFieldType }[],
  instruction: string,
  model: AIModel = DEFAULT_MODEL,
): Promise<Record<string, string>> {
  const trimmed = instruction.trim()
  if (!trimmed) {
    throw new Error('請先輸入草擬指示。')
  }
  if (fields.length === 0) {
    throw new Error('此範本冇欄位可草擬。')
  }
  const out = await complete({
    model,
    messages: [{ role: 'user', content: buildDraftPrompt(fields, trimmed) }],
    source: 'admin-docs',
  })
  return parseDraftContent(out, fields)
}
