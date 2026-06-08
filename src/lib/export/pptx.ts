import type { Deck } from './types'
import { safeFilename } from './file'

// ============================================================
//  匯出 PowerPoint (.pptx) — 動態 import pptxgenjs
//  中文由 PowerPoint 字體處理，無需嵌字型。封面 + 逐版（標題+重點+講者備註）。
// ============================================================

export async function downloadPptx(deck: Deck, name?: string): Promise<void> {
  const PptxGenJS = (await import('pptxgenjs')).default
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE' // 16:9

  // 封面
  const cover = pptx.addSlide()
  cover.background = { color: 'F8FAFC' }
  cover.addText(deck.title, {
    x: 0.5,
    y: 2.0,
    w: '90%',
    h: 1.3,
    fontSize: 40,
    bold: true,
    color: '1E293B',
    align: 'center',
  })
  if (deck.subtitle) {
    cover.addText(deck.subtitle, {
      x: 0.5,
      y: 3.4,
      w: '90%',
      h: 0.8,
      fontSize: 20,
      color: '64748B',
      align: 'center',
    })
  }

  // 內容版
  for (const s of deck.slides) {
    const slide = pptx.addSlide()
    slide.addText(s.title, {
      x: 0.5,
      y: 0.4,
      w: '90%',
      h: 0.9,
      fontSize: 28,
      bold: true,
      color: '2563EB',
    })
    if (s.bullets.length > 0) {
      slide.addText(
        s.bullets.map((b) => ({ text: b, options: { bullet: true, breakLine: true } })),
        {
          x: 0.6,
          y: 1.5,
          w: '88%',
          h: 4.6,
          fontSize: 18,
          color: '1E293B',
          valign: 'top',
          lineSpacingMultiple: 1.25,
        },
      )
    }
    if (s.notes) slide.addNotes(s.notes)
  }

  await pptx.writeFile({ fileName: safeFilename(name ?? deck.title, 'pptx') })
}
