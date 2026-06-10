// src/features/work/slides/pptx/export.ts
import PptxGenJS from 'pptxgenjs'
import type { SlideDeck } from '../types'
import type { Theme } from '../themes'
import { buildSlideOps, type SlideOp } from './spec'

// 檔名消毒：去走 OS 不容許嘅字元，補 .pptx
export function pptxFileName(title: string): string {
  const safe = (title.trim() || 'slides').replace(/[\\/:*?"<>|]/g, '_')
  return `${safe}.pptx`
}

function applyOp(slide: PptxGenJS.Slide, pptx: PptxGenJS, op: SlideOp): void {
  switch (op.kind) {
    case 'fill':
      slide.background = { color: op.color }
      break
    case 'text':
      slide.addText(op.text, {
        x: op.x, y: op.y, w: op.w, h: op.h,
        fontSize: op.fontSize, bold: op.bold, italic: op.italic,
        color: op.color, align: op.align, fontFace: op.fontFace,
        valign: 'top',
      })
      break
    case 'bullets':
      slide.addText(
        op.items.map((text) => ({ text, options: { bullet: op.bullet, fontSize: op.fontSize, color: op.color, fontFace: op.fontFace } })),
        { x: op.x, y: op.y, w: op.w, h: op.h, valign: 'top' },
      )
      break
    case 'table':
      slide.addTable(
        op.rows.map((row) => row.map((cell) => ({ text: cell, options: { fontSize: op.fontSize, color: op.color, fontFace: op.fontFace } }))),
        { x: op.x, y: op.y, w: op.w, border: { type: 'solid', pt: 0.5, color: op.headColor } },
      )
      break
    case 'shape':
      slide.addShape(pptx.ShapeType.rect, { x: op.x, y: op.y, w: op.w, h: op.h, fill: { color: op.color } })
      break
  }
}

// 主入口：把一份 deck 匯出成 .pptx 並觸發下載（瀏覽器）。
export async function exportDeckPptx(deck: SlideDeck, theme: Theme): Promise<void> {
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_16x9'
  for (const s of deck.slides) {
    const slide = pptx.addSlide()
    for (const op of buildSlideOps(s, theme)) applyOp(slide, pptx, op)
    if (s.speakerNotes) slide.addNotes(s.speakerNotes)
  }
  await pptx.writeFile({ fileName: pptxFileName(deck.title) })
}
