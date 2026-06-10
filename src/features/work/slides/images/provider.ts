import type { ImageRef } from '../types'

const KEY = () => (import.meta.env.VITE_PEXELS_API_KEY as string | undefined) ?? ''

export function isImageSearchConfigured(): boolean {
  return Boolean(KEY())
}

// 預設 Pexels provider；未配置 key 時優雅停用（回空陣列）。
export async function searchImages(query: string): Promise<ImageRef[]> {
  const key = KEY()
  if (!key || !query.trim()) return []
  try {
    const url = `https://api.pexels.com/v1/search?per_page=12&query=${encodeURIComponent(query)}`
    const r = await fetch(url, { headers: { Authorization: key } })
    if (!r.ok) return []
    const data = (await r.json()) as { photos?: { src?: { large?: string }; photographer?: string }[] }
    return (data.photos ?? [])
      .filter((p) => p.src?.large)
      .map((p) => ({ kind: 'stock' as const, src: p.src!.large!, credit: p.photographer, alt: query }))
  } catch {
    return []
  }
}
