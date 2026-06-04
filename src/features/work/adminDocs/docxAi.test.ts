import { describe, it, expect } from 'vitest'
import PizZip from 'pizzip'
import {
  parseSuggestedFields,
  parseDraftContent,
  sanitizeTag,
  injectTags,
} from './docxAi'
import { extractTags, extractText } from './docxEngine'

// ── 共用：砌最小有效 docx（document.xml 段落內含指定文字）──
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

/** paras：每個元素 = 一個 <w:p> 內、一個 <w:t> 嘅文字。 */
function makeDocx(paras: string[]): ArrayBuffer {
  const body = paras
    .map((t) => `<w:p><w:r><w:t xml:space="preserve">${t}</w:t></w:r></w:p>`)
    .join('')
  const documentXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    `<w:body>${body}</w:body>` +
    '</w:document>'
  const zip = new PizZip()
  zip.file('[Content_Types].xml', CONTENT_TYPES)
  zip.file('_rels/.rels', RELS)
  zip.file('word/document.xml', documentXml)
  return zip.generate({ type: 'arraybuffer' }) as unknown as ArrayBuffer
}

function base64ToBuf(b64: string): ArrayBuffer {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes.buffer
}

describe('docxAi · sanitizeTag', () => {
  it('去 { } / 空白變底線 / 限長', () => {
    expect(sanitizeTag('  {學生 姓名}  ')).toBe('學生_姓名')
    expect(sanitizeTag('date')).toBe('date')
    expect(sanitizeTag('a'.repeat(60)).length).toBe(40)
  })
})

describe('docxAi · parseSuggestedFields', () => {
  it('抽合法欄位、收斂 type、去重 tag', () => {
    const raw = JSON.stringify([
      { tag: '學生姓名', label: '學生姓名', type: 'text', anchor: '姓名：____' },
      { tag: '日期', label: '通告日期', type: 'date', anchor: '日期：' },
      { tag: '事由', label: '事由', type: 'WEIRD', anchor: '事由（　）' },
      { tag: '學生姓名', label: '重複', type: 'text', anchor: 'x' }, // 重複 → 略過
      { label: '冇 tag 用 label', type: 'multiline', anchor: 'y' },
    ])
    const out = parseSuggestedFields(raw)
    expect(out.map((f) => f.tag)).toEqual([
      '學生姓名',
      '日期',
      '事由',
      '冇_tag_用_label',
    ])
    expect(out[0].type).toBe('text')
    expect(out[1].type).toBe('date')
    expect(out[2].type).toBe('text') // WEIRD → text
    expect(out[3].type).toBe('multiline')
    expect(out[0].anchor).toBe('姓名：____')
  })

  it('夾雜解說文字 / code fence 都抽到（靠 extractJsonArray）', () => {
    const raw =
      '好的，以下係建議：\n```json\n[{"tag":"班別","label":"班別","type":"text","anchor":"班別："}]\n```\n希望幫到你。'
    const out = parseSuggestedFields(raw)
    expect(out).toHaveLength(1)
    expect(out[0].tag).toBe('班別')
  })

  it('非 JSON / 空 → 回空陣列（唔拋）', () => {
    expect(parseSuggestedFields('完全唔係 JSON')).toEqual([])
    expect(parseSuggestedFields('')).toEqual([])
  })
})

describe('docxAi · parseDraftContent', () => {
  const fields = [{ tag: '日期' }, { tag: '事由' }, { tag: '稱謂' }]

  it('只收 fields 內 tag、值收斂做字串', () => {
    const raw = JSON.stringify({
      日期: '2026-06-10',
      事由: '下週三停課。',
      稱謂: 123, // number → "123"
      多餘: '唔喺 fields，略過',
    })
    const out = parseDraftContent(raw, fields)
    expect(out).toEqual({
      日期: '2026-06-10',
      事由: '下週三停課。',
      稱謂: '123',
    })
    expect('多餘' in out).toBe(false)
  })

  it('夾解說 / fence 都抽到物件', () => {
    const raw = '當然：\n```json\n{"日期":"2026-06-10"}\n```'
    expect(parseDraftContent(raw, fields)).toEqual({ 日期: '2026-06-10' })
  })

  it('非物件 / 空 → 回空物件', () => {
    expect(parseDraftContent('唔係 JSON', fields)).toEqual({})
    expect(parseDraftContent('[1,2,3]', fields)).toEqual({}) // 陣列唔收
  })
})

describe('docxAi · injectTags（保守自動加標籤）', () => {
  it('連續底線形態：「姓名：____」→ 寫入 {tag}，且仍係有效 docx', () => {
    const buf = makeDocx(['學生姓名：________'])
    const res = injectTags(buf, [{ tag: '學生姓名', anchor: '學生姓名：____' }])
    expect(res.injected).toEqual(['學生姓名'])
    expect(res.failed).toEqual([])
    // 重開：抽到 {學生姓名} 標籤、底線已被替換
    const outBuf = base64ToBuf(res.base64)
    expect(extractTags(outBuf)).toContain('學生姓名')
    const text = extractText(outBuf)
    expect(text).toContain('{學生姓名}')
    expect(text).not.toContain('________')
  })

  it('全形空括號形態：「事由（　）」→ 括號內塞 {tag}', () => {
    const buf = makeDocx(['請假事由（　）'])
    const res = injectTags(buf, [{ tag: '事由', anchor: '請假事由（　）' }])
    expect(res.injected).toEqual(['事由'])
    const outBuf = base64ToBuf(res.base64)
    expect(extractTags(outBuf)).toContain('事由')
  })

  it('冒號後 run 結尾形態：「日期：」→ 後補 {tag}', () => {
    const buf = makeDocx(['通告日期：'])
    const res = injectTags(buf, [{ tag: '日期', anchor: '通告日期：' }])
    expect(res.injected).toEqual(['日期'])
    const outBuf = base64ToBuf(res.base64)
    expect(extractTags(outBuf)).toContain('日期')
  })

  it('搵唔到 anchor → 列入 failed、原檔不變（安全後路）', () => {
    const buf = makeDocx(['一段完全冇相關錨點嘅固定文字。'])
    const res = injectTags(buf, [{ tag: '神秘欄', anchor: '銀行戶口號碼：____' }])
    expect(res.injected).toEqual([])
    expect(res.failed).toEqual(['神秘欄'])
    // 原檔仍可讀、冇 {神秘欄}
    const outBuf = base64ToBuf(res.base64)
    expect(extractText(outBuf)).not.toContain('{神秘欄}')
  })

  it('anchor 含大括號（已係標籤）→ 跳過列 failed', () => {
    const buf = makeDocx(['姓名：{姓名}'])
    const res = injectTags(buf, [{ tag: '姓名', anchor: '{姓名}' }])
    // anchor 已含 { } → buildAnchorReplacer 回 null → failed
    // （但文中其實已有 {姓名}，injectTags 會先偵測到 → 當 injected）
    expect(res.injected).toContain('姓名')
  })

  it('多個欄位混合：部分成功部分失敗，成功者仍出有效 docx', () => {
    const buf = makeDocx(['學生姓名：____', '固定說明文字'])
    const res = injectTags(buf, [
      { tag: '學生姓名', anchor: '學生姓名：____' },
      { tag: '不存在', anchor: '冇呢個錨點：____' },
    ])
    expect(res.injected).toEqual(['學生姓名'])
    expect(res.failed).toEqual(['不存在'])
    const outBuf = base64ToBuf(res.base64)
    expect(extractTags(outBuf)).toEqual(['學生姓名'])
  })

  it('唔會替換固定文字（無 anchor 對應就保留原樣）', () => {
    const buf = makeDocx(['敬啟者：（固定客套語，唔應變欄位）'])
    // anchor 指向唔存在嘅 label
    const res = injectTags(buf, [{ tag: '稱謂', anchor: '收件人：____' }])
    expect(res.failed).toEqual(['稱謂'])
    const outBuf = base64ToBuf(res.base64)
    expect(extractText(outBuf)).toContain('敬啟者')
  })
})
