// ============================================================
//  行政文件 — PDF 引擎（pdf-lib，純邏輯，可測）
//  ------------------------------------------------------------
//  支援有填寫欄位嘅 PDF（AcroForm）：讀欄位（名 / 類型 / 選項 / 座標）
//  → 按類型填值 → 存返 PDF Blob，版面 100% 保留（唔 flatten、唔重排）。
//  全部 client-side。docx 路徑（docxEngine）獨立，互不影響。
// ============================================================

import {
  PDFDocument,
  PDFField as PdfLibField,
  PDFTextField,
  PDFCheckBox,
  PDFDropdown,
  PDFOptionList,
  PDFName,
  PDFBool,
} from 'pdf-lib'

const PDF_MIME = 'application/pdf'

/** PDF 表單欄位類型（對齊 adminDocStore 將擴充嘅 AdminDocFieldType）。 */
export type PdfFieldType = 'text' | 'multiline' | 'checkbox' | 'dropdown'

/** 單個 widget 喺某頁嘅矩形（PDF 單位，原點左下）。 */
export interface PdfFieldRect {
  /** 頁 index（0-based）；搵唔到對應頁嘅 widget 唔會收錄。 */
  page: number
  x: number
  y: number
  w: number
  h: number
}

/** 一個 AcroForm 欄位（可跨多頁有多個 widget）。 */
export interface PdfField {
  /** PDF field 全名（填值時用呢個 key）。 */
  name: string
  type: PdfFieldType
  /** dropdown 嘅選項（其餘類型 undefined）。 */
  options?: string[]
  /** 每個 widget 嘅位置（畀預覽疊彩色框用）。 */
  rects: PdfFieldRect[]
}

// ------------------------------------------------------------
//  讀取欄位
// ------------------------------------------------------------

/**
 * 讀 PDF 嘅 AcroForm，抽出所有欄位（名 / 類型 / 選項 / widget 座標）。
 *
 * - 冇 AcroForm 欄位（普通 / 掃描 PDF）→ 回空陣列（唔當錯誤）。
 * - 壞檔 / 加密 PDF → 拋友善中文 Error。
 *
 * 座標：每個欄位可能有多個 widget（同名跨頁）。用 widget 嘅
 * `getRectangle()` 取 x/y/w/h；頁 index 先試 widget 嘅 `P()`（指向頁嘅 ref），
 * 失敗就掃每頁 `node.Annots()` 搵含該 widget dict 嗰頁。兩者皆搵唔到 → 略過
 * 該 widget 嘅座標（欄位仍會收錄，照樣可填，只係冇得疊框）。
 */
export async function extractPdfFields(
  buf: ArrayBuffer,
): Promise<PdfField[]> {
  const doc = await loadPdf(buf)

  let fields
  try {
    fields = doc.getForm().getFields()
  } catch {
    // getForm 對某些壞 AcroForm 結構可能拋錯 → 當冇欄位處理。
    return []
  }

  // 頁 ref.tag → index，畀 widget.P() 快速對應。
  const pages = doc.getPages()
  const pageIndexByRefTag = new Map<string, number>()
  pages.forEach((page, idx) => {
    pageIndexByRefTag.set(page.ref.tag, idx)
  })

  const out: PdfField[] = []
  for (const field of fields) {
    const type = classifyField(field)
    if (!type) continue // 簽名 / radio / button 等：第一版範圍外，略過。

    const name = field.getName()
    const options =
      type === 'dropdown' && isDropdownLike(field)
        ? safeGetOptions(field)
        : undefined

    const rects = collectRects(field, pages, pageIndexByRefTag)

    out.push({ name, type, ...(options ? { options } : {}), rects })
  }

  return out
}

/** 判斷欄位類型；唔支援嘅類型回 undefined（由 caller 略過）。 */
function classifyField(field: PdfLibField): PdfFieldType | undefined {
  if (field instanceof PDFTextField) {
    return field.isMultiline() ? 'multiline' : 'text'
  }
  if (field instanceof PDFCheckBox) return 'checkbox'
  if (field instanceof PDFDropdown || field instanceof PDFOptionList) {
    return 'dropdown'
  }
  return undefined
}

function isDropdownLike(field: unknown): field is PDFDropdown | PDFOptionList {
  return field instanceof PDFDropdown || field instanceof PDFOptionList
}

function safeGetOptions(field: PDFDropdown | PDFOptionList): string[] {
  try {
    return field.getOptions()
  } catch {
    return []
  }
}

/**
 * 收集一個欄位所有 widget 嘅 rect（連頁 index）。
 * 搵唔到頁 index 嘅 widget 唔收錄（避免錯頁疊框）。
 */
function collectRects(
  field: PdfLibField,
  pages: ReturnType<PDFDocument['getPages']>,
  pageIndexByRefTag: Map<string, number>,
): PdfFieldRect[] {
  const rects: PdfFieldRect[] = []
  let widgets: unknown[]
  try {
    widgets = field.acroField.getWidgets()
  } catch {
    return rects
  }

  for (const w of widgets) {
    const widget = w as {
      getRectangle: () => { x: number; y: number; width: number; height: number }
      P: () => { tag: string } | undefined
      dict: unknown
    }

    const pageIdx = resolveWidgetPage(widget, pages, pageIndexByRefTag)
    if (pageIdx === undefined) continue

    let rect
    try {
      rect = widget.getRectangle()
    } catch {
      continue
    }
    rects.push({
      page: pageIdx,
      x: rect.x,
      y: rect.y,
      w: rect.width,
      h: rect.height,
    })
  }
  return rects
}

/** 決定 widget 喺邊一頁：先用 P()，再退而掃 Annots。 */
function resolveWidgetPage(
  widget: { P: () => { tag: string } | undefined; dict: unknown },
  pages: ReturnType<PDFDocument['getPages']>,
  pageIndexByRefTag: Map<string, number>,
): number | undefined {
  // 1) widget.P() 直接指向頁 ref。
  try {
    const pRef = widget.P()
    if (pRef && pageIndexByRefTag.has(pRef.tag)) {
      return pageIndexByRefTag.get(pRef.tag)
    }
  } catch {
    /* 落 fallback */
  }

  // 2) 掃每頁 Annots，比對 widget 嘅 dict（dereference 後做身份比較）。
  for (let i = 0; i < pages.length; i++) {
    const node = pages[i].node as {
      Annots?: () => { size: () => number; lookup: (idx: number) => unknown } | undefined
    }
    let annots
    try {
      annots = node.Annots?.()
    } catch {
      continue
    }
    if (!annots) continue
    const size = annots.size()
    for (let j = 0; j < size; j++) {
      let entry
      try {
        entry = annots.lookup(j)
      } catch {
        continue
      }
      if (entry === widget.dict) return i
    }
  }

  return undefined
}

// ------------------------------------------------------------
//  填值
// ------------------------------------------------------------

/** checkbox 當「勾」嘅值（大小寫不敏感）。 */
const TRUTHY = new Set(['yes', 'true', '1', 'on', '是', '✓', 'x'])

/**
 * 按 `values`（field name → 字串）逐欄填值，回傳填好嘅 PDF Blob。
 *
 * - text / multiline → `setText`
 * - checkbox → 值屬 TRUTHY 就 `check()`，否則 `uncheck()`
 * - dropdown → `select(value)`；值唔喺 options 就 try/catch 略過（保留原值）
 * - 缺對應欄位 / 個別欄位填值出錯 → 略過該欄，唔中斷其餘欄位。
 * - **唔 flatten**：保持欄位可再編輯。
 *
 * @throws 友善中文 Error（壞檔 / 加密 / save 失敗）。
 */
export async function fillPdf(
  buf: ArrayBuffer,
  values: Record<string, string>,
): Promise<Blob> {
  const doc = await loadPdf(buf)
  const form = doc.getForm()

  for (const [name, rawValue] of Object.entries(values)) {
    let field
    try {
      field = form.getField(name)
    } catch {
      continue // 範本冇呢個欄位 → 略過。
    }

    const value = rawValue ?? ''
    try {
      if (field instanceof PDFTextField) {
        field.setText(value)
      } else if (field instanceof PDFCheckBox) {
        if (TRUTHY.has(value.trim().toLowerCase())) field.check()
        else field.uncheck()
      } else if (
        field instanceof PDFDropdown ||
        field instanceof PDFOptionList
      ) {
        // pdf-lib 嘅 select() 對唔喺 options 嘅值唔會拋錯（會照加落去），
        // 故要主動比對 options：值唔喺選項就略過（保留原狀），免得寫入無效值。
        // 空字串當「清除選擇」處理（亦只係略過 select）。
        const opts = safeGetOptions(field)
        if (value !== '' && opts.includes(value)) {
          try {
            field.select(value)
          } catch {
            /* 個別 select 意外出錯：略過 */
          }
        }
      }
      // 其餘類型（簽名 / radio / button）：略過。
    } catch {
      // 個別欄位填值意外出錯 → 略過該欄，繼續填其餘。
      continue
    }
  }

  // CJK（中文）填值：pdf-lib 內建 standard font（Helvetica/WinAnsi）無法 encode
  // 中文字，若 save 時重新生成欄位 appearance 會拋「WinAnsi cannot encode」。
  // 故設 AcroForm 嘅 NeedAppearances=true（指示 PDF 閱讀器自行用自身字型重繪），
  // 並 save 時關閉 pdf-lib 嘅 appearance 生成——欄位「值」(/V) 照樣寫入，
  // Adobe / Chrome / 預覽程式打開時會正確顯示中文，版面不受影響。
  try {
    form.acroForm.dict.set(PDFName.of('NeedAppearances'), PDFBool.True)
  } catch {
    /* 個別 PDF 結構特殊：設唔到就算，唔影響填值本身 */
  }

  let bytes: Uint8Array
  try {
    bytes = await doc.save({ updateFieldAppearances: false })
  } catch (e) {
    throw new Error(
      `PDF 儲存失敗：${(e as Error)?.message ?? '檔案可能已損壞'}。請重新上載範本後再試。`,
    )
  }
  // 用 ArrayBuffer copy 包 Blob，避免 Uint8Array 底層 buffer 型別差異。
  return new Blob([toArrayBuffer(bytes)], { type: PDF_MIME })
}

// ------------------------------------------------------------
//  共用
// ------------------------------------------------------------

/** 載入 PDF；壞檔 / 加密 → 拋友善中文 Error。 */
async function loadPdf(buf: ArrayBuffer): Promise<PDFDocument> {
  try {
    // ignoreEncryption: 容許部分加密 PDF 仍可讀；真正壞檔仍會喺 load 拋。
    return await PDFDocument.load(buf, { ignoreEncryption: true })
  } catch (e) {
    const msg = (e as Error)?.message ?? ''
    if (/encrypt|password/i.test(msg)) {
      throw new Error('此 PDF 已加密，無法讀取。請先解除密碼保護後再上載。')
    }
    throw new Error('無法讀取此 PDF（檔案可能已損壞或格式不支援）。請改用其他檔案。')
  }
}

/** Uint8Array → 全新 ArrayBuffer（精確長度 copy）。 */
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy.buffer
}
