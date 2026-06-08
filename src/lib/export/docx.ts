import type { ExportDoc } from './types'
import { downloadBlob, safeFilename } from './file'

// ============================================================
//  匯出 Word (.docx) — 動態 import docx（撳先載入，唔谷大首屏）
//  中文由 Word 字體處理，無需嵌字型。
// ============================================================

export async function downloadDocx(doc: ExportDoc, name?: string): Promise<void> {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx')

  const children: InstanceType<typeof Paragraph>[] = []
  children.push(new Paragraph({ text: doc.title, heading: HeadingLevel.TITLE }))
  if (doc.subtitle) {
    children.push(
      new Paragraph({ children: [new TextRun({ text: doc.subtitle, color: '888888', italics: true })] }),
    )
  }

  for (const b of doc.blocks) {
    if (b.kind === 'heading') {
      children.push(
        new Paragraph({
          text: b.text,
          heading: b.level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_1,
        }),
      )
    } else if (b.kind === 'paragraph') {
      children.push(new Paragraph({ text: b.text }))
    } else if (b.kind === 'bullets') {
      for (const it of b.items) {
        children.push(new Paragraph({ text: it, bullet: { level: 0 } }))
      }
    } else if (b.kind === 'numbered') {
      // 用手動編號（避免 docx numbering 設定複雜），中文閱讀一樣清楚
      b.items.forEach((it, i) => children.push(new Paragraph({ text: `${i + 1}. ${it}` })))
    }
  }

  const document = new Document({ sections: [{ children }] })
  const blob = await Packer.toBlob(document)
  downloadBlob(blob, safeFilename(name ?? doc.title, 'docx'))
}
