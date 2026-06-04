// ============================================================
//  行政文件 — 表格格 auto-tag 引擎（純邏輯，可測）
//  ------------------------------------------------------------
//  針對港式「表格型」未填表單：一格 label + 隔離格填寫。
//  injectTags（docxAi）只做同 run inline（底線／空括號／冒號），對
//  「label 喺一格、空格喺右鄰／下方」嘅表完全失手（真檔命中率 22%）。
//  本檔補上：parse <w:tbl>/<w:tr>/<w:tc>，搵到 label 格 → 喺右鄰／正下方
//  空格塞 {標籤}。
//
//  安全第一（沿用 injectTags 原則）：全部插完先重砌 zip + sanity 重讀；
//  任何 throw / 重讀失敗 → 放棄全部、回原檔 + 全 failed。寧願唔改，
//  唔好整爛 docx。純字串／XML 操作，唔 import React / UI。
// ============================================================

import PizZip from 'pizzip'
import {
  injectTags,
  sanitizeTag,
  type InjectResult,
  type SuggestedField,
} from './docxAi'
import { base64ToArrayBuffer } from './docxEngine'

// ───────── XML helpers（本檔自帶細份，避免改 docxAi export 面） ─────────

/** XML escape（寫返 document.xml 前；只處理會搞亂 XML 嘅 5 個字元）。 */
function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** 解基本 XML entity（淨係為咗比對格文字；唔會寫返呢個解碼結果）。 */
function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, '&') // 最後先解 &amp;，免二次解碼
}

/** ArrayBuffer → base64（分段 fromCharCode + btoa，與 docxAi/docxEngine 同款）。 */
function arrayBufferToBase64Safe(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

// ───────── 表格 parse（regex；唔掂 XML，只記 offset） ─────────

/** 一個 <w:tc>…</w:tc> 格嘅位置 + 抽到嘅資料。 */
interface Cell {
  /** 喺 document.xml 入面，<w:tc> 開標籤起點。 */
  start: number
  /** </w:tc> 之後（exclusive）。 */
  end: number
  /** 完整 <w:tc>…</w:tc> 內容（含標籤）。 */
  xml: string
  /** 格內所有 <w:t> 文字 concat + decode + trim（用嚟比對 label）。 */
  text: string
  /** 是否空格（冇任何非空白 <w:t> 文字）。 */
  empty: boolean
  /** <w:gridSpan w:val> 值（無則 1）。 */
  gridSpan: number
}

/**
 * 由 <w:tr>…</w:tr> 內文抽出所有 <w:tc>…</w:tc>。
 *
 * 注意：
 *  - <w:tc> 開標籤喺真檔一律係 `<w:tc>`（無屬性、非 self-close），
 *    但我哋仍用 `<w:tc\b` 容錯（萬一有屬性）；關鍵係**唔好**撈到
 *    `<w:tcPr>`（開標籤係 `<w:tcPr`，`\b` 後面係 `P`，唔會中
 *    `<w:tc>` 嘅 `>` 或空白，所以用 `<w:tc(?=[ >])` 精準分辨）。
 *  - 用「開／閉計數」配對，容許 <w:tc> 內部理論上嵌套（實際唔會，
 *    但穩陣）。offset 相對 trInner。
 */
function parseCells(trInner: string): Cell[] {
  const cells: Cell[] = []
  // 同時搵 tc 開（非 tcPr）同 tc 閉。
  const re = /<w:tc(?=[ >])(?:[^>]*)>|<\/w:tc>/g
  let m: RegExpExecArray | null
  let depth = 0
  let openAt = -1
  while ((m = re.exec(trInner)) !== null) {
    const isClose = m[0] === '</w:tc>'
    if (!isClose) {
      if (depth === 0) openAt = m.index
      depth++
    } else {
      depth--
      if (depth === 0 && openAt >= 0) {
        const start = openAt
        const end = re.lastIndex
        const xml = trInner.slice(start, end)
        cells.push(buildCell(start, end, xml))
        openAt = -1
      }
    }
  }
  return cells
}

function buildCell(start: number, end: number, xml: string): Cell {
  // 抽格內所有 <w:t …>…</w:t> 文字
  const texts: string[] = []
  const tre = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g
  let tm: RegExpExecArray | null
  while ((tm = tre.exec(xml)) !== null) {
    texts.push(decodeXmlEntities(tm[1]))
  }
  const joined = texts.join('')
  const text = joined.trim()
  const empty = text.length === 0
  const gsMatch = /<w:gridSpan\b[^>]*\bw:val="(\d+)"/.exec(xml)
  const gridSpan = gsMatch ? Math.max(1, parseInt(gsMatch[1], 10) || 1) : 1
  return { start, end, xml, text, empty, gridSpan }
}

// ───────── label 比對 ─────────

/** 去尾冒號變體（全形／ASCII／presentation-form）。 */
function stripTrailingColon(s: string): string {
  return s.replace(/[：:︰﹕︓]\s*$/u, '').trim()
}

/** 收斂內部空白（真檔有「日    期」呢類兩字中間落空格嘅 label）。 */
function collapseWs(s: string): string {
  return s.replace(/[\s　]+/gu, '').trim()
}

/**
 * 格文字係咪等於 field.label（faithful 比對 + 兩種寬鬆變體）：
 *  1. trimmed 完全相等；
 *  2. 各自去尾冒號後相等；
 *  3. 各自收斂所有空白後相等（解「日    期」vs「日期」）。
 */
function cellMatchesLabel(cellText: string, label: string): boolean {
  const a = cellText.trim()
  const b = label.trim()
  if (!a || !b) return false
  if (a === b) return true
  if (stripTrailingColon(a) === stripTrailingColon(b)) return true
  if (collapseWs(a) === collapseWs(b)) return true
  if (collapseWs(stripTrailingColon(a)) === collapseWs(stripTrailingColon(b)))
    return true
  return false
}

// ───────── 插入：喺目標格第一個 <w:p> 塞 run ───────── //

/**
 * 喺一個 <w:tc>…</w:tc> 格 xml 入面，第一個 <w:p> 的
 * （<w:pPr>…</w:pPr> 之後、否則 <w:p…> 開標籤之後）、</w:p> 之前，
 * 加 <w:r><w:t xml:space="preserve">{escapedTag}</w:t></w:r>。
 *
 * 回新 xml；若搵唔到 <w:p> 對（理論上每格都至少一個 <w:p>）→ 回 null。
 */
function insertRunInFirstParagraph(cellXml: string, tagText: string): string | null {
  const runXml = `<w:r><w:t xml:space="preserve">${tagText}</w:t></w:r>`

  // 搵第一個 <w:p …> 開標籤（非 <w:pPr>、非 <w:pict> 等：用 (?=[ >])）。
  const pOpen = /<w:p(?=[ >])[^>]*>/.exec(cellXml)
  if (!pOpen) return null
  const pOpenEnd = pOpen.index + pOpen[0].length

  // 喺呢個 <w:p> 範圍內搵對應 </w:p>（取開標籤之後第一個 </w:p>；
  // 格內第一個段落唔會嵌套另一段落，安全）。
  const pCloseIdx = cellXml.indexOf('</w:p>', pOpenEnd)
  if (pCloseIdx < 0) return null

  // 段落內容（開標籤之後 → </w:p> 之前）
  const innerStart = pOpenEnd
  const innerEnd = pCloseIdx
  const inner = cellXml.slice(innerStart, innerEnd)

  // 若有 <w:pPr>…</w:pPr>，run 要喺佢之後（pPr 必須係段落第一個子節點）。
  let insertAt = innerStart
  const pPr = /^\s*<w:pPr\b[^>]*>[\s\S]*?<\/w:pPr>/.exec(inner)
  if (pPr) {
    insertAt = innerStart + pPr[0].length
  } else {
    // 亦可能係 self-close <w:pPr/>
    const pPrSelf = /^\s*<w:pPr\b[^>]*\/>/.exec(inner)
    if (pPrSelf) insertAt = innerStart + pPrSelf[0].length
  }

  return cellXml.slice(0, insertAt) + runXml + cellXml.slice(insertAt)
}

// ───────── 主 API ───────── //

/**
 * 把每個 field 嘅 {標籤} 插入「表格內 label 格旁邊嘅空格」。
 *
 * 流程：
 *  1. 讀 word/document.xml；抽 <w:tbl> → <w:tr> → <w:tc>。
 *  2. 每格 trimmed 文字 vs field.label（含去尾冒號 / 收斂空白變體）。
 *  3. 目標格：(a) 同行右鄰空格 → 用；(b) 否則正下方（下一行同 tc index）
 *     空格 → 用；(c) 都唔得 → failed。
 *  4. 插入 <w:r><w:t>{tag}</w:t></w:r>（escapeXml(sanitizeTag(tag))）。
 *  5. gridSpan / 合併格保守：行 tc 數不一致或目標牽涉 gridSpan 時，
 *     below 規則跳過（寧 failed 唔錯插）。
 *  6. 安全：插完重砌 + sanity 重讀；任何 throw / 重讀失敗 / injected=0
 *     → 回原檔 + 全 failed。
 *
 * 同 docxAi InjectResult 形狀。
 */
export function injectTagsIntoCells(
  buf: ArrayBuffer,
  fields: { tag: string; label: string }[],
): InjectResult {
  const allTags = fields.map((f) => f.tag)
  const fallback = (): InjectResult => ({
    base64: arrayBufferToBase64Safe(buf),
    injected: [],
    failed: allTags,
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

  // ── 抽所有表 → 行 → 格（記 absolute offset 喺 document.xml）──
  // 注意：用 regex 抽 <w:tbl>…</w:tbl> / <w:tr>…</w:tr>；表唔會喺 cell
  // 文字層出現呢啲標籤，故 split-by-tag 安全。為咗保留 absolute offset，
  // 我哋用 matchAll + index。
  const rowsAbs: { cells: Cell[] }[] = []
  // 表格嵌套（表入面有表）罕見；用簡單方法：逐個 <w:tr ...>…</w:tr>。
  // tr 唔會嵌套 tr（OOXML 唔容許表格直接嵌 tr），故 non-greedy 配對安全，
  // 但表中表會令外層 tr 含內層 tr —— 我哋用「最內」策略：直接全局抽所有
  // <w:tr …>…</w:tr>（non-greedy 取最短，即最內層先中），足夠本用途。
  const trRe = /<w:tr\b[^>]*>([\s\S]*?)<\/w:tr>/g
  let trm: RegExpExecArray | null
  while ((trm = trRe.exec(xml)) !== null) {
    const trInner = trm[1]
    // trInner 起點 = trm.index + 開標籤長度
    const innerOffset = trm.index + (trm[0].length - trInner.length - '</w:tr>'.length)
    const cells = parseCells(trInner).map((c) => ({
      ...c,
      start: c.start + innerOffset,
      end: c.end + innerOffset,
    }))
    rowsAbs.push({ cells })
  }

  if (rowsAbs.length === 0) {
    // 冇表格 → 全 failed（呢個引擎只處理表格；inline 由 injectTags 負責）。
    return { base64: arrayBufferToBase64Safe(buf), injected: [], failed: allTags }
  }

  // ── 為每個 field 搵目標格，紀錄一個「插入動作」（先唔改 xml）──
  interface Plan {
    tag: string
    sanitized: string
    cellStart: number // 目標格 start offset（拎嚟排序 + 切片）
    cellXml: string
  }
  const plans: Plan[] = []
  const injected: string[] = []
  const failed: string[] = []
  // 已被佔用嘅目標格（同一格唔好畀兩個 tag 搶）。
  const usedCellStarts = new Set<number>()

  for (const field of fields) {
    const sanitized = sanitizeTag(field.tag)
    if (!sanitized || !field.label.trim()) {
      failed.push(field.tag)
      continue
    }

    let target: Cell | null = null

    // 逐行逐格搵 label 格
    outer: for (let ri = 0; ri < rowsAbs.length; ri++) {
      const row = rowsAbs[ri]
      for (let ci = 0; ci < row.cells.length; ci++) {
        const cell = row.cells[ci]
        if (!cellMatchesLabel(cell.text, field.label)) continue

        // (a) 同行右鄰空格
        const right = row.cells[ci + 1]
        if (
          right &&
          right.empty &&
          !usedCellStarts.has(right.start)
        ) {
          target = right
          break outer
        }

        // (b) 正下方（下一行同 tc index）空格 —— 保守處理合併格
        const below = rowsAbs[ri + 1]
        if (below) {
          // 保守：兩行 tc 數一致、且 label 格與目標格都冇 gridSpan，
          // 先當 column 對齊得住；否則跳過（寧 failed 唔錯插）。
          const sameWidth = below.cells.length === row.cells.length
          const labelHasSpan = cell.gridSpan > 1
          const belowCell = below.cells[ci]
          if (
            sameWidth &&
            !labelHasSpan &&
            belowCell &&
            belowCell.gridSpan === 1 &&
            belowCell.empty &&
            !usedCellStarts.has(belowCell.start)
          ) {
            target = belowCell
            break outer
          }
        }

        // 呢個 label 格搵唔到目標 → 繼續搵其他相同 label 格（罕有）
      }
    }

    if (!target) {
      failed.push(field.tag)
      continue
    }

    const tagText = `{${escapeXml(sanitized)}}`
    const newCellXml = insertRunInFirstParagraph(target.xml, tagText)
    if (!newCellXml) {
      failed.push(field.tag)
      continue
    }

    usedCellStarts.add(target.start)
    plans.push({
      tag: field.tag,
      sanitized,
      cellStart: target.start,
      cellXml: newCellXml,
    })
    injected.push(field.tag)
  }

  if (plans.length === 0) {
    return { base64: arrayBufferToBase64Safe(buf), injected: [], failed }
  }

  // ── 套用所有插入：由後向前切片，offset 唔會位移 ──
  // 重新由原 cell 範圍切（用 target.start + 原 cell 長度）。我哋喺 plan
  // 只存咗 cellStart 同新 cellXml；需要原 cell 長度 → 由 rowsAbs 搵返。
  const startToCell = new Map<number, Cell>()
  for (const row of rowsAbs) for (const c of row.cells) startToCell.set(c.start, c)

  let working = xml
  const ordered = [...plans].sort((a, b) => b.cellStart - a.cellStart)
  try {
    for (const p of ordered) {
      const orig = startToCell.get(p.cellStart)
      if (!orig) throw new Error('cell offset lost')
      // sanity：切片位置確實係原 cell（防 offset 算錯整爛 XML）
      if (working.slice(orig.start, orig.end) !== orig.xml) {
        throw new Error('cell slice mismatch')
      }
      working = working.slice(0, orig.start) + p.cellXml + working.slice(orig.end)
    }

    // 寫返 + 重砌 + sanity 重讀
    zip.file('word/document.xml', working)
    const outBuf = zip.generate({
      type: 'arraybuffer',
      compression: 'DEFLATE',
    }) as unknown as ArrayBuffer
    const check = new PizZip(outBuf)
    const reread = check.file('word/document.xml')?.asText()
    if (!reread) throw new Error('reread failed')
    return {
      base64: arrayBufferToBase64Safe(outBuf),
      injected,
      failed,
    }
  } catch {
    // 任何 throw → 放棄全部，回原檔 + 全 failed
    return fallback()
  }
}

// ───────── 合併策略：inline + 表格格 ───────── //

/**
 * 對整批 AI 建議欄位做「兩段式」自動加標籤，合併兩種引擎嘅命中：
 *
 *  步驟 1（inline，docxAi.injectTags）：用每個 field 嘅 anchor，喺同一個
 *    `<w:t>` run 內把明顯空格（連續底線／空括號／冒號後空白）換成 `{tag}`。
 *    呢步覆蓋「label 同填寫位喺同一格／同一段」嘅情況（如 ROW3/4 嘅
 *    「老師︰」「學生︰」，靠冒號後補）。
 *
 *  步驟 2（表格格，injectTagsIntoCells）：對步驟 1 **失手** 嗰批 field，
 *    用 field 嘅 label 喺表格裏面搵 label 格 → 右鄰／正下方空格塞 `{tag}`。
 *    呢步覆蓋港式「一格 label + 隔離格填寫」嘅大宗（ROW0-2、5-13、
 *    14-19 等）。
 *
 * 合併：
 *  - base64 = 步驟 2 之後嘅檔（若步驟 2 冇任何命中，injectTagsIntoCells
 *    會回返「步驟 1 之後嘅檔」原樣 base64，故鏈式安全）。
 *  - injected = injected1 ∪ injected2（兩步任一成功即算成功）。
 *  - failed = failed2（兩步都失手嗰批先入最終 failed）。
 *
 * 兩步都各自守安全原則（內部重砌 zip + sanity 重讀；任何 throw → 該步
 * 放棄全部、回該步輸入檔 + 全 failed）。因此即使其中一步整體失敗，
 * 都只會「冇加到嘢」，唔會整爛 docx。
 *
 * 注意：步驟 2 以「fields 入面 tag 對應嘅原始 tag 字串」做配對 key，
 * 確保兩步 injected/failed 清單用同一套 tag 命名（injectTags /
 * injectTagsIntoCells 內部都會 sanitizeTag，但兩者一致，故對得返）。
 */
export function autoTagFields(
  buf: ArrayBuffer,
  fields: SuggestedField[],
): InjectResult {
  // 步驟 1：inline（底線／空括號／冒號）
  const res1 = injectTags(
    buf,
    fields.map((f) => ({ tag: f.tag, anchor: f.anchor })),
  )

  // 邊啲 field 喺步驟 1 失手？（injected1 用 sanitizeTag 後嘅 tag 入清單，
  // 故用同一 sanitize 規則判斷某 field 係咪已命中。）
  const injectedSet1 = new Set(res1.injected)
  const failedFields = fields.filter(
    (f) => !injectedSet1.has(sanitizeTag(f.tag)),
  )

  // 全部 inline 已搞掂 → 唔使再開表格引擎，直接回步驟 1 結果。
  if (failedFields.length === 0) {
    return res1
  }

  // 步驟 2：表格格（只試 inline 失手嗰批）。由步驟 1 之後嘅檔接力，
  // 令兩步嘅插入累積喺同一份 docx。
  let buf1: ArrayBuffer
  try {
    buf1 = base64ToArrayBuffer(res1.base64)
  } catch {
    // 理論上唔會（injectTags 永遠回有效 base64）；保守：當步驟 2 全失手。
    return {
      base64: res1.base64,
      injected: res1.injected,
      failed: failedFields.map((f) => f.tag),
    }
  }

  const res2 = injectTagsIntoCells(
    buf1,
    failedFields.map((f) => ({ tag: f.tag, label: f.label })),
  )

  // 合併：base64 取步驟 2（已累積步驟 1）；injected 兩步相加；
  // failed 只取步驟 2 仲失手嗰批。
  return {
    base64: res2.base64,
    injected: res1.injected.concat(res2.injected),
    failed: res2.failed,
  }
}

// ───────── 結構偵測（免 AI）：由表格列出候選欄位 ───────── //

/** 由 label 字眼推斷欄位類型。 */
function inferFieldType(label: string): SuggestedField['type'] {
  if (/日\s*期|date|\d+\s*年.*月.*日/iu.test(label)) return 'date'
  if (/內容|備註|事由|地址|原因|詳情|其他|說明|備考/u.test(label)) return 'multiline'
  return 'text'
}

/** 格文字似唔似「填寫欄位 label」（短、非區段標題、非純數字／列號）。 */
function isLikelyFieldLabel(text: string): boolean {
  const t = text.trim()
  if (t.length < 1 || t.length > 30) return false
  if (/[【】]/.test(t)) return false // 區段標題如【家長通知書】
  if (/^\d+[.、)）·]?$/u.test(t)) return false // 純數字／列號（如名冊 1. 2.）
  return true
}

/**
 * 免 AI 結構偵測：掃表格，搵「非空 label 格 → 右鄰／正下方空格」對，
 * 列出候選欄位（label = 格文字、tag = sanitize、type 由字眼推斷、
 * anchor = 原 label）。對港式表格表單最準、即時、唔靠 AI、唔會截斷。
 *
 * 同 injectTagsIntoCells 用同一套表格解析 / 目標格規則，故偵測到嘅
 * 欄位之後交畀 autoTagFields 亦會成功落標籤（一致）。
 */
export function detectTemplateFields(buf: ArrayBuffer): SuggestedField[] {
  let xml: string | undefined
  try {
    xml = new PizZip(buf).file('word/document.xml')?.asText()
  } catch {
    return []
  }
  if (!xml) return []

  const rows: Cell[][] = []
  const trRe = /<w:tr\b[^>]*>([\s\S]*?)<\/w:tr>/g
  let trm: RegExpExecArray | null
  while ((trm = trRe.exec(xml)) !== null) rows.push(parseCells(trm[1]))

  const out: SuggestedField[] = []
  const seen = new Set<string>()
  for (let ri = 0; ri < rows.length; ri++) {
    const row = rows[ri]
    for (let ci = 0; ci < row.length; ci++) {
      const cell = row[ci]
      if (cell.empty) continue
      const label = cell.text.trim()
      if (!isLikelyFieldLabel(label)) continue

      // 目標格：右鄰空格 → 否則正下方同列空格（保守：同寬、無 gridSpan）。
      const right = row[ci + 1]
      let hasTarget = !!(right && right.empty)
      if (!hasTarget) {
        const below = rows[ri + 1]
        if (below && below.length === row.length && cell.gridSpan === 1) {
          const b = below[ci]
          if (b && b.gridSpan === 1 && b.empty) hasTarget = true
        }
      }
      if (!hasTarget) continue

      const labelClean = stripTrailingColon(label)
      const tag = sanitizeTag(labelClean)
      if (!tag || seen.has(tag)) continue
      seen.add(tag)
      out.push({
        tag,
        label: labelClean || label,
        type: inferFieldType(label),
        anchor: label,
      })
    }
  }
  return out
}
