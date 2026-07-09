import type { ModeId } from '../../../modes/modes'

const AI_HANDOFF_KEY = 'eziteach.aiHandoff.v1'
const MAX_HANDOFF_AGE_MS = 10 * 60 * 1000

interface AiHandoff {
  mode: ModeId
  text: string
  autoSend?: boolean
  createdAt: string
}

export function writeAiHandoff(
  mode: ModeId,
  text: string,
  options: { autoSend?: boolean } = {},
): void {
  const value = text.trim()
  if (!value) return
  try {
    localStorage.setItem(
      AI_HANDOFF_KEY,
      JSON.stringify({
        mode,
        text: value,
        autoSend: options.autoSend,
        createdAt: new Date().toISOString(),
      } satisfies AiHandoff),
    )
  } catch {
    /* ignore */
  }
}

export function consumeAiHandoff(mode: ModeId): Pick<AiHandoff, 'text' | 'autoSend'> | null {
  try {
    const raw = localStorage.getItem(AI_HANDOFF_KEY)
    if (!raw) return null
    localStorage.removeItem(AI_HANDOFF_KEY)
    const parsed = JSON.parse(raw) as Partial<AiHandoff>
    if (parsed.mode !== mode || typeof parsed.text !== 'string') return null
    const createdAt = parsed.createdAt ? new Date(parsed.createdAt).getTime() : 0
    if (!Number.isFinite(createdAt) || Date.now() - createdAt > MAX_HANDOFF_AGE_MS) return null
    const text = parsed.text.trim()
    return text ? { text, autoSend: parsed.autoSend === true } : null
  } catch {
    return null
  }
}
