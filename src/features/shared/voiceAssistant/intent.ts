import { inferWorkToolRoute, type ComposerRoute } from '../../../pages/homeRouting'

export type VoiceIntent =
  | { kind: 'tool'; route: ComposerRoute }
  | { kind: 'assistant' }

export function resolveVoiceIntent(input: string): VoiceIntent {
  const route = inferWorkToolRoute(input)
  if (route && route.featureId !== 'work-voice-assistant') {
    return { kind: 'tool', route }
  }
  return { kind: 'assistant' }
}
