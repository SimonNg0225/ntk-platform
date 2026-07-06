export type ComposerMaterialTool = 'mc' | 'short' | 'long' | 'case' | 'worksheet' | 'paper'

export interface ComposerHandoff {
  featureId: string
  text: string
  materialTool?: ComposerMaterialTool
  createdAt: string
}

const COMPOSER_HANDOFF_KEY = 'eziteach.composerHandoff.v1'
const MAX_HANDOFF_AGE_MS = 10 * 60 * 1000

export function writeComposerHandoff(input: Omit<ComposerHandoff, 'createdAt'>): void {
  const text = input.text.trim()
  if (!text) return
  try {
    localStorage.setItem(
      COMPOSER_HANDOFF_KEY,
      JSON.stringify({ ...input, text, createdAt: new Date().toISOString() } satisfies ComposerHandoff),
    )
  } catch {
    /* ignore */
  }
}

export function readComposerHandoff(featureId: string): ComposerHandoff | null {
  try {
    const raw = localStorage.getItem(COMPOSER_HANDOFF_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<ComposerHandoff>
    if (parsed.featureId !== featureId || typeof parsed.text !== 'string') return null
    const createdAt = parsed.createdAt ? new Date(parsed.createdAt).getTime() : 0
    if (!Number.isFinite(createdAt) || Date.now() - createdAt > MAX_HANDOFF_AGE_MS) {
      localStorage.removeItem(COMPOSER_HANDOFF_KEY)
      return null
    }
    return {
      featureId,
      text: parsed.text.trim(),
      materialTool: parsed.materialTool,
      createdAt: parsed.createdAt ?? new Date().toISOString(),
    }
  } catch {
    return null
  }
}

export function clearComposerHandoff(featureId: string): void {
  try {
    if (readComposerHandoff(featureId)) {
      localStorage.removeItem(COMPOSER_HANDOFF_KEY)
    }
  } catch {
    /* ignore */
  }
}

export function consumeComposerHandoff(featureId: string): ComposerHandoff | null {
  const handoff = readComposerHandoff(featureId)
  if (handoff) clearComposerHandoff(featureId)
  return handoff
}
