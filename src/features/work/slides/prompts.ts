import { SLIDE_TYPES } from './types'

export function buildSlidesSystem(subjectName?: string): string {
  const subj = subjectName ? `你而家為「${subjectName}」科備課。` : ''
  return [
    `你係香港資深教師嘅簡報助理。${subj}`,
    '請就用戶課題，產出一份教學簡報，輸出**純 JSON 陣列**（唔好有 markdown fence 或多餘文字）。',
    '每個元素代表一頁，格式：{ "type": <type>, "content": {…}, "speakerNotes"?: string }。',
    `合法 type：${SLIDE_TYPES.join(', ')}。`,
    'content 欄位按 type：',
    '- title: { heading, subheading? }',
    '- section: { heading, kicker? }',
    '- bullets: { heading, items: string[] }',
    '- twoCol: { heading, left: string[], right: string[] }',
    '- imageText: { heading, body, imageSide: "left"|"right"|"full" }',
    '- quote: { text, attribution? }',
    '- compare: { heading, rows: [{ label, a, b }] }',
    '- timeline: { heading, steps: [{ label, detail? }] }',
    '- quiz: { question, options: string[], answerIndex? }',
    '- summary: { heading, points: string[] }',
    '第一頁用 title，最後一頁用 summary。內容用繁體中文（港式用語），精煉、適合投影。',
  ].join('\n')
}

export function buildSlidesPrompt(o: { topic: string; slideCount: number; extra?: string }): string {
  const lines = [`課題：${o.topic}`, `頁數：約 ${o.slideCount} 頁`]
  if (o.extra?.trim()) lines.push(`額外要求：${o.extra.trim()}`)
  return lines.join('\n')
}
