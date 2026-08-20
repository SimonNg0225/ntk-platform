import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TeachingAssistantProfile } from './types'
import { consumeAiHandoff, writeAiHandoff } from './handoff'

function makeLocalStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, String(value)),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
  }
}

const assistant: TeachingAssistantProfile = {
  id: 'lesson-plan',
  name: '教案準備師',
  task: '準備下一堂課',
  summary: '把課題整理成可直接上堂的教案。',
  starter: '輸入課題、年級和課時。',
  instruction: '先收集必要資料，再輸出教案。',
}

beforeEach(() => {
  vi.stubGlobal('localStorage', makeLocalStorage())
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-07-13T09:00:00+08:00'))
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('AI assistant handoff', () => {
  it('can hand off an assistant profile without exposing a prompt in the composer', () => {
    writeAiHandoff('work', '', { assistant })

    expect(consumeAiHandoff('work')).toEqual({
      text: undefined,
      autoSend: false,
      assistant,
    })
    expect(consumeAiHandoff('work')).toBeNull()
  })

  it('keeps existing text and auto-send handoffs backward compatible', () => {
    writeAiHandoff('work', '幫我整一份簡報', { autoSend: true })

    expect(consumeAiHandoff('work')).toEqual({
      text: '幫我整一份簡報',
      autoSend: true,
      assistant: undefined,
    })
  })

  it('rejects an expired handoff', () => {
    writeAiHandoff('work', '', { assistant })
    vi.setSystemTime(new Date('2026-07-13T09:11:00+08:00'))

    expect(consumeAiHandoff('work')).toBeNull()
  })
})
