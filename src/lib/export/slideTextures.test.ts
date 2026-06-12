// @vitest-environment node
import { test, expect } from 'vitest'
import { coverTextureUri } from './slideTextures'

// SSR/node 無 canvas → 必須回 null（pack 自動 fallback 原本底，永不 throw）
test('node/SSR 無 canvas → coverTextureUri 回 null', () => {
  for (const k of ['sumi', 'cosmos', 'washi'] as const) {
    expect(coverTextureUri(k)).toBeNull()
  }
})
