import { extractJsonObject } from '../../../lib/aiJson'
import type { AggregatedData, ResolvedRange } from './reportRange'

// ============================================================
//  工作週報／月報 — Prompt + 解析（純函式，可單元測試）
//  輸入係老師自己的 行事曆／待辦／會議筆記聚合（零學生 PII）。
// ============================================================

export interface WorkReportResult {
  done: string[] // 已完成事項
  followUps: string[] // 待跟進
  highlights: string[] // 重點同建議
}

// 控長度 / 慳 token：每類最多 N 項、content 截斷。
const MAX_ITEMS = 40
const CONTENT_CAP = 200

function clip(s: string, max: number): string {
  const t = s.trim()
  return t.length > max ? t.slice(0, max) + '…' : t
}

export function buildWorkReportSystem(): string {
  return [
    '你是香港老師的「工作週報／月報」助手。使用者會提供自己的行事曆事件、待辦、會議筆記聚合資料。',
    '請扼要撮要成一頁報告。只輸出一個 JSON 物件，不要有任何其他文字或 markdown code fence：',
    '{',
    '  "done": ["已完成事項（已發生／已完成，3-8 點）"],',
    '  "followUps": ["待跟進（未完成待辦、會議跟進事項，3-8 點）"],',
    '  "highlights": ["重點同建議（值得留意的事 + 下一步建議，3-8 點）"]',
    '}',
    '規則：',
    '- 繁體中文（廣東話 OK）、扼要、每段 3-8 點。',
    '- 只根據給你的資料，不要杜撰沒有出現過的內容。',
    '- 不要包含或推斷學生個人姓名（資料本身已零學生個人資料，請保持）。',
    '- 沒有內容的欄位用空陣列 []。',
    '- 只輸出 JSON。',
  ].join('\n')
}

export function buildWorkReportUser(agg: AggregatedData, range: ResolvedRange): string {
  const lines: string[] = []
  lines.push(`時段：${range.start} 至 ${range.end}`)
  lines.push('（注意：待辦以「建立日期」計，並非完成日期。）')
  lines.push('')

  // 行事曆事件
  lines.push('【行事曆事件】')
  if (agg.events.length === 0) {
    lines.push('- （無）')
  } else {
    for (const e of agg.events.slice(0, MAX_ITEMS)) {
      const type = e.type ? ` [${e.type}]` : ''
      const time = e.time ? ` ${e.time}` : ''
      lines.push(`- ${clip(e.title || '（無題）', 80)}（${e.date}${time}${type}）`)
    }
    if (agg.events.length > MAX_ITEMS) lines.push(`- …等共 ${agg.events.length} 項`)
  }
  lines.push('')

  // 已完成待辦
  lines.push('【已完成待辦】')
  if (agg.tasksDone.length === 0) {
    lines.push('- （無）')
  } else {
    for (const t of agg.tasksDone.slice(0, MAX_ITEMS)) lines.push(`- ${clip(t.text || '', 120)}`)
    if (agg.tasksDone.length > MAX_ITEMS) lines.push(`- …等共 ${agg.tasksDone.length} 項`)
  }
  lines.push('')

  // 未完成待辦
  lines.push('【未完成待辦】')
  if (agg.tasksOpen.length === 0) {
    lines.push('- （無）')
  } else {
    for (const t of agg.tasksOpen.slice(0, MAX_ITEMS)) lines.push(`- ${clip(t.text || '', 120)}`)
    if (agg.tasksOpen.length > MAX_ITEMS) lines.push(`- …等共 ${agg.tasksOpen.length} 項`)
  }
  lines.push('')

  // 會議筆記 / 跟進
  lines.push('【會議筆記／跟進】')
  if (agg.notes.length === 0) {
    lines.push('- （無）')
  } else {
    for (const n of agg.notes.slice(0, MAX_ITEMS)) {
      const body = n.content ? `：${clip(n.content, CONTENT_CAP)}` : ''
      lines.push(`- ${clip(n.title || '（無題）', 80)}（${n.date}）${body}`)
    }
    if (agg.notes.length > MAX_ITEMS) lines.push(`- …等共 ${agg.notes.length} 項`)
  }

  return lines.join('\n')
}

export function parseWorkReport(raw: string): WorkReportResult {
  const o = extractJsonObject<Record<string, unknown>>(raw)
  if (!o || typeof o !== 'object') throw new Error('AI 回應格式不正確，請再試一次。')
  const arr = (v: unknown): string[] =>
    Array.isArray(v)
      ? v.filter((x): x is string => typeof x === 'string').map((s) => s.trim()).filter(Boolean)
      : []
  return {
    done: arr(o.done),
    followUps: arr(o.followUps),
    highlights: arr(o.highlights),
  }
}
