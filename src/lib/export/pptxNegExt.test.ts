// @vitest-environment node
import { test, expect } from 'vitest'
import PizZip from 'pizzip'
import { buildPptxFile, SLIDE_PACKS } from './pptx'
import type { Deck } from './types'

// 防回歸：OOXML <a:ext cx/cy> 必須 ≥ 0，否則 PowerPoint「無法讀取」。
// 斜線／向上線經 pptxgenjs 會出負 ext，必須由 normalizeNegExt 修正。
const deck: Deck = {
  title: '香港的營商環境',
  slides: [
    { title: '導入', bullets: ['自由港', '低稅率', '法治'] },
    { title: '數據', bullets: ['x'], layout: 'stats', stats: [{ value: '3%', label: '稅率' }, { value: 'No.1', label: '自由度' }] },
    { title: '步驟', bullets: ['x'], layout: 'steps', steps: [{ title: 'A' }, { title: 'B' }, { title: 'C' }] },
    { title: '對比', bullets: ['x'], layout: 'compare', compare: { leftTitle: '甲', left: ['a', 'b'], rightTitle: '乙', right: ['c', 'd'] } },
    { title: '卡', bullets: ['x'], layout: 'cards', cards: [{ title: 'A' }, { title: 'B' }, { title: 'C' }, { title: 'D' }] },
  ],
}

test('全 34 套 slide XML 無非法負 <a:ext>（PowerPoint 可讀）', async () => {
  for (const p of SLIDE_PACKS) {
    const out = await buildPptxFile(deck, { pack: p.id })
    const buf = out instanceof Uint8Array ? Buffer.from(out) : Buffer.from(await (out as Blob).arrayBuffer())
    const zip = new PizZip(buf)
    const files = (zip as unknown as { files: Record<string, unknown> }).files
    const xml = Object.keys(files)
      .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
      .map((n) => zip.file(n)!.asText())
      .join('')
    expect(xml, `${p.id} 有負 cx`).not.toMatch(/<a:ext cx="-\d+"/)
    expect(xml, `${p.id} 有負 cy`).not.toMatch(/<a:ext cx="\d+" cy="-\d+"/)
  }
}, 120000)
