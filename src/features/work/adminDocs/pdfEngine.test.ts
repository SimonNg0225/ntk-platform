import { describe, it, expect } from 'vitest'
import {
  PDFDocument,
  PDFCheckBox,
  PDFTextField,
  PDFDropdown,
} from 'pdf-lib'
import { extractPdfFields, fillPdf, type PdfField } from './pdfEngine'

// ------------------------------------------------------------
//  Fixture：用 pdf-lib 自建一個有 4 個欄位嘅 fillable PDF。
//   - text:      「姓名」
//   - multiline: 「自我介紹」（enableMultiline）
//   - checkbox:  「同意」
//   - dropdown:  「班別」options ['5A','5B']
//  全部 addToPage（連座標）→ save 做 input ArrayBuffer。
// ------------------------------------------------------------
async function makeFillablePdf(): Promise<ArrayBuffer> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([400, 600]) // 寬 400 / 高 600（PDF 單位）
  const form = doc.getForm()

  const name = form.createTextField('姓名')
  name.addToPage(page, { x: 50, y: 500, width: 200, height: 20 })

  const intro = form.createTextField('自我介紹')
  intro.enableMultiline()
  intro.addToPage(page, { x: 50, y: 400, width: 300, height: 80 })

  const agree = form.createCheckBox('同意')
  agree.addToPage(page, { x: 50, y: 350, width: 16, height: 16 })

  const klass = form.createDropdown('班別')
  klass.setOptions(['5A', '5B'])
  klass.addToPage(page, { x: 50, y: 300, width: 100, height: 20 })

  const bytes = await doc.save()
  return toArrayBuffer(bytes)
}

/** 無欄位嘅普通 PDF（只有一頁文字）。 */
async function makePlainPdf(): Promise<ArrayBuffer> {
  const doc = await PDFDocument.create()
  doc.addPage([400, 600])
  return toArrayBuffer(await doc.save())
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy.buffer
}

function byName(fields: PdfField[], name: string): PdfField | undefined {
  return fields.find((f) => f.name === name)
}

describe('pdfEngine — extractPdfFields', () => {
  it('抽到全部 4 個欄位', async () => {
    const buf = await makeFillablePdf()
    const fields = await extractPdfFields(buf)
    expect(fields).toHaveLength(4)
    expect(fields.map((f) => f.name).sort()).toEqual(
      ['同意', '姓名', '班別', '自我介紹'].sort(),
    )
  })

  it('欄位類型正確（text / multiline / checkbox / dropdown）', async () => {
    const buf = await makeFillablePdf()
    const fields = await extractPdfFields(buf)
    expect(byName(fields, '姓名')?.type).toBe('text')
    expect(byName(fields, '自我介紹')?.type).toBe('multiline')
    expect(byName(fields, '同意')?.type).toBe('checkbox')
    expect(byName(fields, '班別')?.type).toBe('dropdown')
  })

  it('dropdown 帶有 options，其餘類型冇 options', async () => {
    const buf = await makeFillablePdf()
    const fields = await extractPdfFields(buf)
    expect(byName(fields, '班別')?.options).toEqual(['5A', '5B'])
    expect(byName(fields, '姓名')?.options).toBeUndefined()
    expect(byName(fields, '同意')?.options).toBeUndefined()
  })

  it('每個欄位有 rect（連正確頁 index 0 + 合理座標）', async () => {
    const buf = await makeFillablePdf()
    const fields = await extractPdfFields(buf)
    const name = byName(fields, '姓名')
    expect(name?.rects).toHaveLength(1)
    const rect = name!.rects[0]
    expect(rect.page).toBe(0)
    // addToPage 用 x:50 y:500 w:200 h:20。pdf-lib 生成欄位邊框時會把 rect
    // 內縮約半個 border 寬度（≈0.5pt），故用 ±1.5pt 容差比對（足夠精準畀疊框用）。
    const near = (got: number, want: number) =>
      expect(Math.abs(got - want)).toBeLessThanOrEqual(1.5)
    near(rect.x, 50)
    near(rect.y, 500)
    near(rect.w, 200)
    near(rect.h, 20)
  })

  it('冇 AcroForm 欄位嘅普通 PDF → 回空陣列', async () => {
    const buf = await makePlainPdf()
    const fields = await extractPdfFields(buf)
    expect(fields).toEqual([])
  })

  it('壞檔 → 拋友善中文 Error', async () => {
    const garbage = new TextEncoder().encode('this is not a pdf at all').buffer
    await expect(extractPdfFields(garbage)).rejects.toThrow(/PDF/)
  })
})

describe('pdfEngine — fillPdf', () => {
  it('填值後重新 load 確認值入咗 + checkbox 已勾 + dropdown 已選', async () => {
    const buf = await makeFillablePdf()
    const blob = await fillPdf(buf, {
      姓名: '陳大文',
      自我介紹: '我係五年級學生。\n好高興認識你。',
      同意: 'yes',
      班別: '5A',
    })
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('application/pdf')

    // 重新 load 輸出 → 確認係有效 PDF + 值已寫入。
    const outBuf = await blob.arrayBuffer()
    const reloaded = await PDFDocument.load(outBuf)
    const form = reloaded.getForm()

    const name = form.getField('姓名')
    expect(name).toBeInstanceOf(PDFTextField)
    expect((name as PDFTextField).getText()).toBe('陳大文')

    const intro = form.getTextField('自我介紹')
    expect(intro.getText()).toContain('我係五年級學生')

    const agree = form.getField('同意')
    expect(agree).toBeInstanceOf(PDFCheckBox)
    expect((agree as PDFCheckBox).isChecked()).toBe(true)

    const klass = form.getField('班別')
    expect(klass).toBeInstanceOf(PDFDropdown)
    expect((klass as PDFDropdown).getSelected()).toContain('5A')
  })

  it('checkbox 值唔屬 truthy → uncheck', async () => {
    const buf = await makeFillablePdf()
    // 先填一個 fixture：預設 checkbox 未勾，傳 'no' 應保持未勾。
    const blob = await fillPdf(buf, { 同意: 'no' })
    const reloaded = await PDFDocument.load(await blob.arrayBuffer())
    const agree = reloaded.getForm().getCheckBox('同意')
    expect(agree.isChecked()).toBe(false)
  })

  it('dropdown 值唔喺 options → 略過，唔拋錯，輸出仍有效', async () => {
    const buf = await makeFillablePdf()
    const blob = await fillPdf(buf, { 班別: '9Z' /* 非法值 */, 姓名: '李小明' })
    // 唔應拋錯；姓名仍要正常填入。
    const reloaded = await PDFDocument.load(await blob.arrayBuffer())
    const form = reloaded.getForm()
    expect(form.getTextField('姓名').getText()).toBe('李小明')
    // 班別冇被改成非法值（getSelected 唔含 '9Z'）。
    expect(form.getDropdown('班別').getSelected()).not.toContain('9Z')
  })

  it('values 含範本冇嘅欄位 → 略過，其餘照填', async () => {
    const buf = await makeFillablePdf()
    const blob = await fillPdf(buf, { 姓名: '王小華', 不存在欄位: '隨便' })
    const reloaded = await PDFDocument.load(await blob.arrayBuffer())
    expect(reloaded.getForm().getTextField('姓名').getText()).toBe('王小華')
  })

  it('壞檔 → 拋友善中文 Error', async () => {
    const garbage = new TextEncoder().encode('nope').buffer
    await expect(fillPdf(garbage, { 姓名: 'x' })).rejects.toThrow(/PDF/)
  })
})
