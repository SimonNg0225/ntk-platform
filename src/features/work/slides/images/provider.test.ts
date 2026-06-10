import { describe, it, expect, vi, beforeEach } from 'vitest'
import { isImageSearchConfigured, searchImages } from './provider'

describe('slides/images/provider', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('未配置 key → 停用、回空陣列', async () => {
    vi.stubEnv('VITE_PEXELS_API_KEY', '')
    expect(isImageSearchConfigured()).toBe(false)
    expect(await searchImages('inflation')).toEqual([])
  })

  it('有 key → 解析回應為 ImageRef[]', async () => {
    vi.stubEnv('VITE_PEXELS_API_KEY', 'k')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ photos: [{ src: { large: 'http://img/1' }, photographer: 'Jo' }] }),
    }))
    const res = await searchImages('inflation')
    expect(res[0]).toMatchObject({ kind: 'stock', src: 'http://img/1', credit: 'Jo' })
  })
})
