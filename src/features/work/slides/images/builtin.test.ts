import { describe, it, expect } from 'vitest'
import { BUILTIN_ILLUSTRATIONS } from './builtin'

describe('slides/images/builtin', () => {
  it('有一批內建插圖，每個有 id / label / data URL svg', () => {
    expect(BUILTIN_ILLUSTRATIONS.length).toBeGreaterThanOrEqual(4)
    for (const x of BUILTIN_ILLUSTRATIONS) {
      expect(x.id).toBeTruthy()
      expect(x.label).toBeTruthy()
      expect(x.src.startsWith('data:image/svg+xml')).toBe(true)
    }
  })
})
