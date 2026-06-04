import { describe, it, expect } from 'vitest'
import PizZip from 'pizzip'
import {
  extractTags,
  fillDocx,
  extractText,
  arrayBufferToBase64,
  base64ToArrayBuffer,
} from './docxEngine'

const CONTENT_TYPES =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
  '</Types>'

const RELS =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
  '</Relationships>'

/** 砌一個最小有效 docx，document.xml 段落內含指定文字。 */
function makeDocx(innerText: string): ArrayBuffer {
  const documentXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    `<w:body><w:p><w:r><w:t>${innerText}</w:t></w:r></w:p></w:body>` +
    '</w:document>'
  const zip = new PizZip()
  zip.file('[Content_Types].xml', CONTENT_TYPES)
  zip.file('_rels/.rels', RELS)
  zip.file('word/document.xml', documentXml)
  return zip.generate({ type: 'arraybuffer' }) as unknown as ArrayBuffer
}

/** 由 Blob 讀返 ArrayBuffer（fillDocx 回 Blob）。 */
async function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  return await blob.arrayBuffer()
}

describe('docxEngine', () => {
  it('extractTags 抽到 {name} 同 {day}（去重、保留次序）', () => {
    const buf = makeDocx('{name} 你好，{day}')
    expect(extractTags(buf)).toEqual(['name', 'day'])
  })

  it('extractTags 去重重複標籤', () => {
    const buf = makeDocx('{name} 你好 {name}，今日 {day}')
    expect(extractTags(buf)).toEqual(['name', 'day'])
  })

  it('fillDocx 填入資料後仍係有效 docx，且內含填入文字', async () => {
    const buf = makeDocx('{name} 你好，{day}')
    const blob = fillDocx(buf, { name: '陳大文', day: '星期一' })
    expect(blob).toBeInstanceOf(Blob)

    // 重開生成嘅 Blob → document.xml 應含填入嘅中文
    const outBuf = await blobToArrayBuffer(blob)
    const zip = new PizZip(outBuf)
    const xml = zip.file('word/document.xml')?.asText() ?? ''
    expect(xml).toContain('陳大文')
    expect(xml).toContain('星期一')
    // 標籤已被替換，唔應再有原始 {name}/{day}
    expect(xml).not.toContain('{name}')
    expect(xml).not.toContain('{day}')
  })

  it('fillDocx 遇標籤錯誤拋友善 Error', () => {
    // 未閉合嘅標籤 → docxtemplater render 應拋錯
    const buf = makeDocx('{name 你好')
    expect(() => fillDocx(buf, { name: '陳大文' })).toThrow(/範本/)
  })

  it('extractText 抽到純文字（去 tag、解 entity）', () => {
    const buf = makeDocx('陳大文 &amp; 李小明 你好')
    const text = extractText(buf)
    expect(text).toContain('陳大文')
    expect(text).toContain('李小明')
    expect(text).toContain('&') // &amp; 已解碼
    expect(text).not.toContain('<w:t>') // tag 已 strip
  })

  it('base64 ↔ ArrayBuffer round-trip 不變', () => {
    const buf = makeDocx('{name}')
    const b64 = arrayBufferToBase64(buf)
    expect(typeof b64).toBe('string')
    const back = base64ToArrayBuffer(b64)
    // round-trip 後重開仍抽到標籤
    expect(extractTags(back)).toEqual(['name'])
  })
})
