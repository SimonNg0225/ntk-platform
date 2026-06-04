import { describe, it, expect } from 'vitest'
import PizZip from 'pizzip'
import { autoTagFields, injectTagsIntoCells } from './docxTableInject'
import type { SuggestedField } from './docxAi'
import { extractTags, extractText } from './docxEngine'

// ============================================================
//  合成 docx fixture（PizZip 砌，node 環境即可，唔使 jsdom）。
//  模仿真表單結構：<w:tbl>/<w:tr>/<w:tc>，格文字喺 <w:t>，空格 =
//  只有 <w:p><w:pPr/></w:p>（無 run）。
// ============================================================

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

/** 一格：txt 非空 → 有 run；txt='' → 空格（只 <w:pPr>）。可指定 gridSpan。 */
function tc(txt: string, gridSpan = 1): string {
  const span = gridSpan > 1 ? `<w:gridSpan w:val="${gridSpan}"/>` : ''
  const tcPr = `<w:tcPr><w:tcW w:w="3000" w:type="dxa"/>${span}</w:tcPr>`
  const para =
    txt === ''
      ? '<w:p w:rsidR="00000000" w:rsidRDefault="00000000"><w:pPr><w:rPr><w:rFonts w:eastAsia="標楷體"/></w:rPr></w:pPr></w:p>'
      : `<w:p w:rsidR="00000000" w:rsidRDefault="00000000"><w:pPr><w:rPr><w:rFonts w:eastAsia="標楷體"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:eastAsia="標楷體"/></w:rPr><w:t xml:space="preserve">${txt}</w:t></w:r></w:p>`
  return `<w:tc>${tcPr}${para}</w:tc>`
}

/** 一行：cells = tc[] 字串。 */
function tr(cells: string[]): string {
  return `<w:tr w:rsidR="00000000"><w:trPr><w:trHeight w:val="500"/></w:trPr>${cells.join('')}</w:tr>`
}

/** 一個表：rows = tr[] 字串。 */
function tbl(rows: string[]): string {
  return (
    '<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/></w:tblPr>' +
    '<w:tblGrid><w:gridCol w:w="3000"/><w:gridCol w:w="3000"/></w:tblGrid>' +
    rows.join('') +
    '</w:tbl>'
  )
}

/** 由任意 body XML 砌一個有效 docx。 */
function makeDocxRaw(bodyXml: string): ArrayBuffer {
  const documentXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    `<w:body>${bodyXml}</w:body>` +
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

function rereadXml(b64: string): string {
  const zip = new PizZip(base64ToBuf(b64))
  return zip.file('word/document.xml')?.asText() ?? ''
}

describe('docxTableInject · injectTagsIntoCells', () => {
  it('2 欄 [label]|[空] → 右鄰空格塞 {tag}，其餘格不變，輸出有效 docx', () => {
    const buf = makeDocxRaw(tbl([tr([tc('姓名'), tc('')])]))
    const res = injectTagsIntoCells(buf, [{ tag: '姓名', label: '姓名' }])

    expect(res.injected).toEqual(['姓名'])
    expect(res.failed).toEqual([])

    const outBuf = base64ToBuf(res.base64)
    // 重開有效 + 抽到標籤
    expect(extractTags(outBuf)).toContain('姓名')
    const xml = rereadXml(res.base64)
    // 空格內已含 {姓名}
    expect(xml).toContain('<w:t xml:space="preserve">{姓名}</w:t>')
    // label 格文字不變（仍見「姓名」label run）
    expect(xml).toContain('<w:t xml:space="preserve">姓名</w:t>')
    // 標籤只出現一次（冇覆蓋去 label 格）
    expect(xml.match(/\{姓名\}/g)?.length).toBe(1)
  })

  it('4 欄 [a]|[空]|[b]|[空] → a/b 各入右鄰格', () => {
    const buf = makeDocxRaw(tbl([tr([tc('活動名稱'), tc(''), tc('帶隊老師'), tc('')])]))
    const res = injectTagsIntoCells(buf, [
      { tag: '活動名稱', label: '活動名稱' },
      { tag: '帶隊老師', label: '帶隊老師' },
    ])

    expect(res.injected.sort()).toEqual(['帶隊老師', '活動名稱'].sort())
    expect(res.failed).toEqual([])

    const xml = rereadXml(res.base64)
    expect(xml).toContain('{活動名稱}')
    expect(xml).toContain('{帶隊老師}')
    // 各一次
    expect(xml.match(/\{活動名稱\}/g)?.length).toBe(1)
    expect(xml.match(/\{帶隊老師\}/g)?.length).toBe(1)
  })

  it('下方格規則：[label] 上、空格喺正下方同列 → 入下方格', () => {
    // 第一欄係 label，右鄰非空（已填佔位 X）→ 唔可用右鄰；
    // 下一行同 column index 係空格 → 用下方。
    const buf = makeDocxRaw(
      tbl([
        tr([tc('簽署'), tc('其他內容')]),
        tr([tc(''), tc('')]),
      ]),
    )
    const res = injectTagsIntoCells(buf, [{ tag: '簽署', label: '簽署' }])

    expect(res.injected).toEqual(['簽署'])
    expect(res.failed).toEqual([])

    const xml = rereadXml(res.base64)
    expect(xml).toContain('{簽署}')
    // 確認標籤入咗下方格（第二行第一格），即 label run 之後、隔一段先出 tag。
    // 簡單斷言：'其他內容' 唔變、tag 出現一次。
    expect(xml).toContain('其他內容')
    expect(xml.match(/\{簽署\}/g)?.length).toBe(1)
  })

  it('去尾冒號變體：label「日期」對到格文字「日期：」', () => {
    const buf = makeDocxRaw(tbl([tr([tc('日期：'), tc('')])]))
    const res = injectTagsIntoCells(buf, [{ tag: '日期', label: '日期' }])
    expect(res.injected).toEqual(['日期'])
    expect(rereadXml(res.base64)).toContain('{日期}')
  })

  it('收斂內部空白：label「日期」對到格文字「日　　期」（中間空格）', () => {
    const buf = makeDocxRaw(tbl([tr([tc('日　　期'), tc('')])]))
    const res = injectTagsIntoCells(buf, [{ tag: '日期', label: '日期' }])
    expect(res.injected).toEqual(['日期'])
    expect(rereadXml(res.base64)).toContain('{日期}')
  })

  it('目標格非空 → 該 field failed（唔覆蓋已有文字）', () => {
    // 右鄰已有「已填」、下方無 → 搵唔到空格 → failed。
    const buf = makeDocxRaw(tbl([tr([tc('地點'), tc('已填內容')])]))
    const res = injectTagsIntoCells(buf, [{ tag: '地點', label: '地點' }])

    expect(res.injected).toEqual([])
    expect(res.failed).toEqual(['地點'])

    const xml = rereadXml(res.base64)
    // 原內容不變、冇插標籤
    expect(xml).toContain('已填內容')
    expect(xml).not.toContain('{地點}')
  })

  it('& 等字元：sanitize + escape，寫返 XML 唔爛（label 用顯示名比對）', () => {
    // tag 含 &，label 對到格文字「班別/學會」
    const buf = makeDocxRaw(tbl([tr([tc('班別/學會'), tc('')])]))
    const res = injectTagsIntoCells(buf, [{ tag: '班別_學會', label: '班別/學會' }])
    expect(res.injected).toEqual(['班別_學會'])
    const xml = rereadXml(res.base64)
    // escapeXml 後（無特殊字元）仍係 {班別_學會}；重開有效
    expect(xml).toContain('{班別_學會}')
    expect(extractTags(base64ToBuf(res.base64))).toContain('班別_學會')
  })

  it('搵唔到 label → 該 field failed、原檔不變', () => {
    const buf = makeDocxRaw(tbl([tr([tc('姓名'), tc('')])]))
    const res = injectTagsIntoCells(buf, [{ tag: '神秘', label: '銀行戶口' }])
    expect(res.injected).toEqual([])
    expect(res.failed).toEqual(['神秘'])
    expect(extractText(base64ToBuf(res.base64))).not.toContain('{神秘}')
  })

  it('合併格保守：下方目標牽涉 gridSpan / 行寬不一致 → 跳過（failed，唔錯插）', () => {
    // label 格右鄰非空（佔位）→ 唔用右鄰；
    // 下一行 tc 數唔同（合併） → below 規則保守跳過 → failed。
    const buf = makeDocxRaw(
      tbl([
        tr([tc('校長批示'), tc('右鄰佔位')]),
        tr([tc('', 2)]), // 下一行得 1 格且 gridSpan=2 → 寬度不一致
      ]),
    )
    const res = injectTagsIntoCells(buf, [{ tag: '校長批示', label: '校長批示' }])
    expect(res.injected).toEqual([])
    expect(res.failed).toEqual(['校長批示'])
    expect(rereadXml(res.base64)).not.toContain('{校長批示}')
  })

  it('混合：部分成功部分失敗，成功者仍出有效 docx', () => {
    const buf = makeDocxRaw(
      tbl([
        tr([tc('姓名'), tc('')]),
        tr([tc('班別'), tc('已填')]), // 右鄰非空、無下方 → failed
      ]),
    )
    const res = injectTagsIntoCells(buf, [
      { tag: '姓名', label: '姓名' },
      { tag: '班別', label: '班別' },
    ])
    expect(res.injected).toEqual(['姓名'])
    expect(res.failed).toEqual(['班別'])
    const xml = rereadXml(res.base64)
    expect(xml).toContain('{姓名}')
    expect(xml).not.toContain('{班別}')
    expect(extractTags(base64ToBuf(res.base64))).toEqual(['姓名'])
  })

  it('安全：餵壞 buffer → 唔 throw、回原檔 + 全 failed', () => {
    const garbage = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]).buffer
    let res: ReturnType<typeof injectTagsIntoCells> | undefined
    expect(() => {
      res = injectTagsIntoCells(garbage, [
        { tag: 'a', label: 'a' },
        { tag: 'b', label: 'b' },
      ])
    }).not.toThrow()
    expect(res!.injected).toEqual([])
    expect(res!.failed).toEqual(['a', 'b'])
  })

  it('安全：docx 內冇表格 → 全 failed、原檔不變（唔 throw）', () => {
    const buf = makeDocxRaw('<w:p><w:r><w:t>一段冇表格嘅文字</w:t></w:r></w:p>')
    const res = injectTagsIntoCells(buf, [{ tag: '姓名', label: '姓名' }])
    expect(res.injected).toEqual([])
    expect(res.failed).toEqual(['姓名'])
    expect(extractText(base64ToBuf(res.base64))).toContain('一段冇表格嘅文字')
  })

  it('injected=0 時回原檔 base64（可重開）', () => {
    const buf = makeDocxRaw(tbl([tr([tc('姓名'), tc('已填')])]))
    const res = injectTagsIntoCells(buf, [{ tag: '姓名', label: '姓名' }])
    expect(res.injected).toEqual([])
    // 回原檔：仍可重開、抽到原文字
    expect(extractText(base64ToBuf(res.base64))).toContain('姓名')
  })
})

// ============================================================
//  autoTagFields（inline + 表格格 合併）
//  ------------------------------------------------------------
//  以合成 fixture 驗：inline-only / 表格格-only / 兩者混合 / 安全。
//  inline 段落（非表格）：「label：」/「label____」喺同一 <w:t> run 內。
// ============================================================

/** 一個含 inline 空格嘅段落（非表格），label 喺單一 <w:t> run 內。 */
function inlinePara(text: string): string {
  return `<w:p><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`
}

/** SuggestedField helper（type 預設 text）。 */
function sf(
  tag: string,
  label: string,
  anchor: string,
  type: SuggestedField['type'] = 'text',
): SuggestedField {
  return { tag, label, type, anchor }
}

describe('docxTableInject · autoTagFields（inline + 表格格 合併）', () => {
  it('純 inline：冒號後補 {tag}（行 step1，唔使 step2）', () => {
    const buf = makeDocxRaw(inlinePara('姓名：'))
    const res = autoTagFields(buf, [sf('姓名', '姓名', '姓名：')])
    expect(res.injected).toEqual(['姓名'])
    expect(res.failed).toEqual([])
    expect(rereadXml(res.base64)).toContain('{姓名}')
  })

  it('純表格格：inline 失手（無 anchor 形態）→ step2 由 label 入右鄰空格', () => {
    const buf = makeDocxRaw(tbl([tr([tc('班別'), tc('')])]))
    // anchor 唔係底線／括號／冒號形態 → step1 inline 必失手 → 靠 step2 表格格。
    const res = autoTagFields(buf, [sf('班別', '班別', '班別')])
    expect(res.injected).toEqual(['班別'])
    expect(res.failed).toEqual([])
    const xml = rereadXml(res.base64)
    expect(xml).toContain('{班別}')
    expect(xml.match(/\{班別\}/g)?.length).toBe(1)
  })

  it('混合：一個 inline 命中 + 一個表格格命中 → 兩者皆 injected', () => {
    // 段落「日期：」(inline) + 表格 [活動名稱]|[空]（表格格）。
    const body =
      inlinePara('日期：') + tbl([tr([tc('活動名稱'), tc('')])])
    const buf = makeDocxRaw(body)
    const res = autoTagFields(buf, [
      sf('日期', '日期', '日期：', 'date'),
      sf('活動名稱', '活動名稱', '活動名稱'),
    ])
    expect(res.injected.sort()).toEqual(['日期', '活動名稱'].sort())
    expect(res.failed).toEqual([])
    const xml = rereadXml(res.base64)
    // 兩步嘅插入都喺同一份輸出檔內（鏈式累積）
    expect(xml).toContain('{日期}')
    expect(xml).toContain('{活動名稱}')
    // extractTags 可由最終 docx 抽到兩者
    expect(extractTags(base64ToBuf(res.base64)).sort()).toEqual(
      ['日期', '活動名稱'].sort(),
    )
  })

  it('合併命中率 ≥ 純表格格：inline 嗰個係表格格搞唔掂、淨靠 inline 補', () => {
    // ROW 形態：[參加人數]|[老師︰]（value 格 label 喺格內、冒號後填）。
    // 表格格引擎：右鄰格非空（有「老師︰」）→ 失手；
    // inline 引擎：anchor「老師︰」冒號後補 → 命中。
    // 故合併後該 field 仍 injected（示範 inline 補表格格之不足）。
    const buf = makeDocxRaw(tbl([tr([tc('參加人數'), tc('老師︰')])]))
    const fields = [sf('帶隊老師', '老師', '老師︰')]

    // 對照：純表格格（用 label「老師」搵唔到右鄰空格）→ failed。
    const cellOnly = injectTagsIntoCells(buf, [
      { tag: '帶隊老師', label: '老師' },
    ])
    expect(cellOnly.injected).toEqual([])

    // 合併：inline 由 anchor「老師︰」補到 → injected。
    const res = autoTagFields(buf, fields)
    expect(res.injected).toEqual(['帶隊老師'])
    expect(res.failed).toEqual([])
    expect(rereadXml(res.base64)).toContain('{帶隊老師}')
  })

  it('兩步都失手 → 該 field 入最終 failed（原檔不變）', () => {
    // 表格格右鄰非空、無下方；anchor 又唔係 inline 形態 → 兩步皆失。
    const buf = makeDocxRaw(tbl([tr([tc('地點'), tc('已填內容')])]))
    const res = autoTagFields(buf, [sf('地點', '地點', '地點')])
    expect(res.injected).toEqual([])
    expect(res.failed).toEqual(['地點'])
    const xml = rereadXml(res.base64)
    expect(xml).toContain('已填內容')
    expect(xml).not.toContain('{地點}')
  })

  it('部分成功部分失敗：injected/failed 正確分流，輸出有效 docx', () => {
    // 表格 [姓名]|[空]（表格格命中） + 段落「事由：」（inline 命中）
    // + 表格 [地點]|[已填]（兩步皆失）。
    const body =
      tbl([tr([tc('姓名'), tc('')])]) +
      inlinePara('事由：') +
      tbl([tr([tc('地點'), tc('已填內容')])])
    const buf = makeDocxRaw(body)
    const res = autoTagFields(buf, [
      sf('姓名', '姓名', '姓名'),
      sf('事由', '事由', '事由：', 'multiline'),
      sf('地點', '地點', '地點'),
    ])
    expect(res.injected.sort()).toEqual(['事由', '姓名'].sort())
    expect(res.failed).toEqual(['地點'])
    const out = extractTags(base64ToBuf(res.base64)).sort()
    expect(out).toEqual(['事由', '姓名'].sort())
  })

  it('安全：餵壞 buffer → 唔 throw、全部 failed', () => {
    const garbage = new Uint8Array([9, 8, 7, 6, 5]).buffer
    let res: ReturnType<typeof autoTagFields> | undefined
    expect(() => {
      res = autoTagFields(garbage, [
        sf('a', 'a', 'a：'),
        sf('b', 'b', 'b'),
      ])
    }).not.toThrow()
    expect(res!.injected).toEqual([])
    expect(res!.failed.sort()).toEqual(['a', 'b'].sort())
  })

  it('空 fields → injected/failed 皆空、回有效檔', () => {
    const buf = makeDocxRaw(tbl([tr([tc('姓名'), tc('')])]))
    const res = autoTagFields(buf, [])
    expect(res.injected).toEqual([])
    expect(res.failed).toEqual([])
    // 仍可重開
    expect(extractText(base64ToBuf(res.base64))).toContain('姓名')
  })
})
