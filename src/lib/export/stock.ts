// ============================================================
//  免費圖庫（Pexels）— 簡報封面 / 內頁配相（marketing 級，零至低成本）
//  ------------------------------------------------------------
//  · 未設 VITE_PEXELS_KEY → 一律回 null（簡報照用純色版面，唔影響）。
//  · 免費 key：https://www.pexels.com/api/
//  · Pexels 規定：盡量注明 Pexels + 攝影師（engine 會喺相旁加署名）。
//  · 回傳原圖 width/height（engine 計 cover 裁切必需 — addImage 嘅 w/h
//    要係真實長寬比）；large2x / large / medium 都係等比例縮圖，
//    揀邊個 src 唔影響長寬比。
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
  /** 原圖闊度（pixel）— engine 計真實長寬比用 */
  width: number
  /** 原圖高度（pixel）— engine 計真實長寬比用 */
  height: number
}

/** Pexels search API 回應入面我哋用到嘅欄位 */
interface PexelsPhoto {
  width?: number
  height?: number
  src?: Record<string, string | undefined>
  photographer?: string
  url?: string
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
 * 共用核心：按關鍵字搜一張橫向相片 → pickSrc 揀解像度 → 嵌成 data URI。
 * 未設 key / 搜尋失敗 / 缺尺寸 / CORS 失敗 → 回 null（呼叫方降級用純色版面）。
 * 函式 stateless，多版並行 call 安全。
 */
async function fetchPhoto(
  query: string,
  pickSrc: (src: Record<string, string | undefined>) => string | undefined,
): Promise<StockPhoto | null> {
  if (!PEXELS_KEY) return null
  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape&size=large`,
      { headers: { Authorization: PEXELS_KEY } },
    )
    if (!res.ok) return null
    const json = (await res.json()) as { photos?: PexelsPhoto[] }
    const photo = json.photos?.[0]
    const imgUrl = photo?.src ? pickSrc(photo.src) : undefined
    if (!photo || !imgUrl || !photo.width || !photo.height) return null
    const imgRes = await fetch(imgUrl)
    if (!imgRes.ok) return null
    const dataUri = await blobToDataUri(await imgRes.blob())
    return {
      dataUri,
      credit: `相片：${photo.photographer ?? 'Pexels'} / Pexels`,
      sourceUrl: photo.url ?? 'https://www.pexels.com',
      width: photo.width,
      height: photo.height,
    }
  } catch {
    return null
  }
}

/**
 * 封面相：large2x 優先（全版背景要較高解像度），缺就退 large。
 */
export async function fetchCoverPhoto(query: string): Promise<StockPhoto | null> {
  return fetchPhoto(query, (src) => src.large2x || src.large)
}

/**
 * 內頁配相：用 large（缺就退 medium）— 側欄面板夠用，檔案細好多。
 */
export async function fetchSlidePhoto(query: string): Promise<StockPhoto | null> {
  return fetchPhoto(query, (src) => src.large || src.medium)
}
