// ============================================================
//  免費圖庫（Pexels）— 封面背景相片（marketing 級，零至低成本）
//  ------------------------------------------------------------
//  · 未設 VITE_PEXELS_KEY → 一律回 null（簡報照用純色封面，唔影響）。
//  · 免費 key：https://www.pexels.com/api/
//  · Pexels 規定：盡量注明 Pexels + 攝影師（我哋喺封面角落加署名）。
// ============================================================

const PEXELS_KEY = import.meta.env.VITE_PEXELS_KEY as string | undefined

export const isStockConfigured = Boolean(PEXELS_KEY)

export interface StockPhoto {
  /** base64 data URI（已嵌入，可直接交畀 pptxgenjs addImage） */
  dataUri: string
  /** 署名（Pexels 規定注明攝影師 + Pexels） */
  credit: string
  /** 原圖頁面 */
  sourceUrl: string
}

function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(new Error('讀取相片失敗'))
    r.readAsDataURL(blob)
  })
}

/**
 * 按關鍵字攞一張橫向相片並嵌成 data URI。
 * 未設 key / 搜尋失敗 / CORS 失敗 → 回 null（呼叫方 fallback 用純色封面）。
 */
export async function fetchCoverPhoto(query: string): Promise<StockPhoto | null> {
  if (!PEXELS_KEY) return null
  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape&size=large`,
      { headers: { Authorization: PEXELS_KEY } },
    )
    if (!res.ok) return null
    const json = (await res.json()) as {
      photos?: { src?: Record<string, string>; photographer?: string; url?: string }[]
    }
    const photo = json.photos?.[0]
    const imgUrl = photo?.src?.large2x || photo?.src?.large || photo?.src?.landscape
    if (!photo || !imgUrl) return null
    const imgRes = await fetch(imgUrl)
    if (!imgRes.ok) return null
    const dataUri = await blobToDataUri(await imgRes.blob())
    return {
      dataUri,
      credit: `相片：${photo.photographer ?? 'Pexels'} / Pexels`,
      sourceUrl: photo.url ?? 'https://www.pexels.com',
    }
  } catch {
    return null
  }
}
