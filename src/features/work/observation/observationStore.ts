import { observationsCol } from '../../../data/collections'
import type { Observation } from '../../../data/types'
import type { ExportBlock, ExportDoc } from '../../../lib/export'
import { CRITERIA } from './observationPrompts'

// collection 本體放 collections.ts（硬性要求）；本檔只係就近 re-export，方便 component import
export { observationsCol }
export type { Observation }

// 判斷一個記錄有冇實際分析到（六準則任一有 note）；list/detail/匯出共用，避免重複組裝
export function hasCriteriaNotes(rec: Observation): boolean {
  return rec.criteria.some((c) => c.note.trim() !== '')
}

// 列印／匯出／複製共用（仿 Transcribe.tsx recToDoc）
export function observationToDoc(rec: Observation): ExportDoc {
  const blocks: ExportBlock[] = []

  // meta 段
  const metaLine = [
    rec.date && `日期：${rec.date}`,
    rec.period && `節次：${rec.period}`,
    rec.topic && `課題：${rec.topic}`,
  ]
    .filter(Boolean)
    .join('　')
  if (metaLine) blocks.push({ kind: 'paragraph', text: metaLine })

  // 六準則逐項
  if (hasCriteriaNotes(rec)) {
    blocks.push({ kind: 'heading', text: '觀課準則', level: 1 })
    for (const { key, label } of CRITERIA) {
      const note = rec.criteria.find((c) => c.key === key)?.note?.trim()
      blocks.push({ kind: 'heading', text: label, level: 2 })
      blocks.push({ kind: 'paragraph', text: note || '—' })
    }
  }

  if (rec.highlights.length) {
    blocks.push({ kind: 'heading', text: '整體亮點', level: 1 })
    blocks.push({ kind: 'bullets', items: rec.highlights })
  }
  if (rec.improvements.length) {
    blocks.push({ kind: 'heading', text: '改進建議', level: 1 })
    blocks.push({ kind: 'bullets', items: rec.improvements })
  }

  if (rec.source.trim()) {
    blocks.push({ kind: 'heading', text: '課堂內容', level: 1 })
    blocks.push({ kind: 'paragraph', text: rec.source.trim() })
  }

  const title = `觀課記錄 — ${rec.teacher}（${rec.subject} ${rec.klass}）`.trim()
  return { title, blocks }
}
