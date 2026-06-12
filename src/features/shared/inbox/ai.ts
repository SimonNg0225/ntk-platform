// ============================================================
//  Inbox AI triage：批量請 Gemini 替待處理項目建議分類。
//  ------------------------------------------------------------
//  經 complete()（內部 streamChat）+ parseJsonArray 安全落地。
//  守門（isAIConfigured / 未登入）留俾呼叫端（Inbox.tsx）。
// ============================================================

import { complete, type AIMessage } from '../../../lib/aiClient'
import { parseJsonArray } from '../../../lib/aiJson'
import type { InboxKind } from './types'

const VALID: InboxKind[] = [
  'task',
  'note',
  'event',
  'question',
  'countdown',
  'reference',
]

const SYSTEM = `你係一個 GTD（Getting Things Done）整理助手，服務一位香港中學老師兼自學者。
用家會掉低一堆「快速擷取」嘅碎片諗法（中英夾雜、口語）。你要替每一條判斷最啱嘅去向分類：
- task：要去做嘅行動（批改、買嘢、跟進、提交…）
- note：知識重點、想法、靈感，值得留低參考但唔係行動
- event：有特定日期／時間嘅安排（會議、約會、課堂）
- question：一條想搞清楚／想問 AI／想研究嘅問題
- countdown：有死線／考試／限期，想倒數提自己
- reference：純連結、書籍、資料，淨係想 bookmark
只准用以上 6 個英文 key。回應「只准」係一個 JSON 陣列，每個元素 {"i": <原本索引>, "kind": "<key>", "why": "<10 字內極短中文理由>"}，唔好有任何其他文字或 markdown。`

export interface AiTriageResult {
  i: number
  kind: InboxKind
  why: string
}

/**
 * 批量分類。texts 順序 = 索引。回傳 Map<index, {kind, why}>。
 * 失敗（parse 唔到）會 throw 帶友善中文 message。
 */
export async function aiTriage(
  texts: string[],
  signal?: AbortSignal,
): Promise<Map<number, { kind: InboxKind; why: string }>> {
  const list = texts
    .map((t, i) => `${i}. ${t.replace(/\s+/g, ' ').slice(0, 200)}`)
    .join('\n')
  const messages: AIMessage[] = [
    {
      role: 'user',
      content: `以下係待整理嘅擷取項目（格式「索引. 內容」）：\n\n${list}\n\n替每一條判斷分類，回 JSON 陣列。`,
    },
  ]
  const raw = await complete({ messages, system: SYSTEM, signal, source: 'inbox' })
  const arr = parseJsonArray<AiTriageResult>(raw)
  if (!arr) throw new Error('AI 回應唔係有效 JSON，請再試一次。')

  const out = new Map<number, { kind: InboxKind; why: string }>()
  for (const r of arr) {
    if (
      r &&
      typeof r.i === 'number' &&
      r.i >= 0 &&
      r.i < texts.length &&
      VALID.includes(r.kind)
    ) {
      out.set(r.i, {
        kind: r.kind,
        why: typeof r.why === 'string' ? r.why.slice(0, 20) : '',
      })
    }
  }
  return out
}
