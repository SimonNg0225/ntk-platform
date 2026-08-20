import type { ModeId } from '../../../modes/modes'
import type { TeachingAssistantProfile } from './types'

const AI_HANDOFF_KEY = 'eziteach.aiHandoff.v1'
const MAX_HANDOFF_AGE_MS = 10 * 60 * 1000

interface AiHandoff {
  mode: ModeId
  text?: string
  autoSend?: boolean
  assistant?: TeachingAssistantProfile
  createdAt: string
}

function validAssistant(value: unknown): value is TeachingAssistantProfile {
  if (!value || typeof value !== 'object') return false
  const profile = value as Partial<TeachingAssistantProfile>
  return [
    profile.id,
    profile.name,
    profile.task,
    profile.summary,
    profile.starter,
    profile.instruction,
  ].every((field) => typeof field === 'string' && field.trim().length > 0)
}

export function writeAiHandoff(
  mode: ModeId,
  text: string,
  options: { autoSend?: boolean; assistant?: TeachingAssistantProfile } = {},
): void {
  const value = text.trim()
  if (!value && !options.assistant) return
  try {
    localStorage.setItem(
      AI_HANDOFF_KEY,
      JSON.stringify({
        mode,
        text: value || undefined,
        autoSend: value ? options.autoSend : undefined,
        assistant: options.assistant,
        createdAt: new Date().toISOString(),
      } satisfies AiHandoff),
    )
  } catch {
    /* ignore */
  }
}

export function consumeAiHandoff(
  mode: ModeId,
): Pick<AiHandoff, 'text' | 'autoSend' | 'assistant'> | null {
  try {
    const raw = localStorage.getItem(AI_HANDOFF_KEY)
    if (!raw) return null
    localStorage.removeItem(AI_HANDOFF_KEY)
    const parsed = JSON.parse(raw) as Partial<AiHandoff>
    if (parsed.mode !== mode) return null
    const createdAt = parsed.createdAt ? new Date(parsed.createdAt).getTime() : 0
    if (!Number.isFinite(createdAt) || Date.now() - createdAt > MAX_HANDOFF_AGE_MS) return null
    const text = typeof parsed.text === 'string' ? parsed.text.trim() : ''
    const assistant = validAssistant(parsed.assistant) ? parsed.assistant : undefined
    if (!text && !assistant) return null
    return {
      text: text || undefined,
      autoSend: Boolean(text && parsed.autoSend === true),
      assistant,
    }
  } catch {
    return null
  }
}
