import { createCollection } from '../../../lib/store'
import type { ThreadMeta, PromptTemplate, Persona } from './types'

// ============================================================
//  AI 助手 — 功能專屬持久化（唔掂 data/collections）
// ============================================================

/** 每個 thread 嘅旁掛 metadata（pin / archive / model / persona / context） */
export const threadMetaCol = createCollection<ThreadMeta>('ai_thread_meta_v1', [])

/** 用戶自訂 prompt 範本 */
export const promptTemplatesCol = createCollection<PromptTemplate>(
  'ai_prompt_templates_v1',
  [],
)

// ───────── 人格（語氣風格）─────────
export const PERSONAS: Persona[] = [
  {
    id: 'default',
    label: '預設',
    directive: '',
    hint: '跟模式預設語氣',
  },
  {
    id: 'concise',
    label: '精簡',
    directive:
      '請務必極度精簡：用最少字數、直接點列，避免開場白同客套。',
    hint: '短、直接、點列',
  },
  {
    id: 'detailed',
    label: '詳盡',
    directive:
      '請詳盡解釋：分段、舉例、補充背景同常見誤解，務求清楚易明。',
    hint: '深入、有例子',
  },
  {
    id: 'socratic',
    label: '蘇格拉底',
    directive:
      '用蘇格拉底式教學：唔好即刻俾答案，先用引導問題帶我思考，逐步啟發，最後先總結。',
    hint: '反問引導思考',
  },
  {
    id: 'exam',
    label: '考評',
    directive:
      '以香港公開試評卷員角度回答：標明答題重點、評分準則（marking scheme）、常見失分位，用考試語言。',
    hint: 'DSE 評卷視角',
  },
]

export function personaById(id: string | undefined): Persona {
  return PERSONAS.find((p) => p.id === id) ?? PERSONAS[0]
}
