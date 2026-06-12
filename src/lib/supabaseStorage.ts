// ============================================================
//  掃描 PDF → Supabase Storage（private bucket「scans」）
//  ------------------------------------------------------------
//  資源庫只存 metadata + 連結，無 blob 儲存。要真・雲端存檔，
//  就將 PDF 上載去 Storage（檔案物件，唔係塞落 collection 同步），
//  路徑 `${userId}/<timestamp>-<safe>.pdf`，回傳長效「簽名連結」
//  （bucket 不公開；簽名 URL 喺有效期內任何人有連結都打得開）。
//  需要已接雲端 + 已登入；否則 throw，呼叫端降級返本機 metadata + 下載。
//  ⚠️ 要先喺 Supabase 跑 migration 0008（開 bucket + RLS）。
// ============================================================

import { supabase, isSupabaseConfigured } from './supabase'

export const SCAN_BUCKET = 'scans'

// Supabase Storage 物件 key 唔收非 ASCII（中文 → "Invalid key"）。
// 將檔名轉做 ASCII-safe 片段；全部唔合 → fallback 'scan'。
// （人類可讀中文標題照樣存喺資源庫 Resource.title，唔靠 storage key。）
function asciiKeySegment(name: string): string {
  const base = name
    .replace(/\.pdf$/i, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
  return base || 'scan'
}

// 簽名連結有效期：1 年（夠長，當「永久」用；過期可日後重簽）。
const SIGNED_URL_TTL = 60 * 60 * 24 * 365

/** 有接雲端先有得存 Supabase（同 isSupabaseConfigured 一致）。 */
export const isScanStorageConfigured = isSupabaseConfigured

export interface UploadedScan {
  /** Storage 物件路徑（bucket 內，例 `<uid>/169...-掃描.pdf`） */
  path: string
  /** 長效簽名連結（資源庫直接 click 開） */
  url: string
}

/**
 * 上載掃描 PDF 去 Storage 並回傳簽名連結。
 * @param blob     PDF Blob
 * @param filename 建議檔名（會去 .pdf、清不合法字元、加時間戳）
 * @param userId   登入用戶 id（路徑首段；對應 RLS 只准存自己 uid 資料夾）
 * @throws 未接雲端 / 未登入 / 上載或簽名失敗
 */
export async function uploadScanPdf(
  blob: Blob,
  filename: string,
  userId: string,
): Promise<UploadedScan> {
  if (!supabase) throw new Error('未接雲端')
  if (!userId) throw new Error('未登入')

  const path = `${userId}/${Date.now()}-${asciiKeySegment(filename)}.pdf`

  const up = await supabase.storage.from(SCAN_BUCKET).upload(path, blob, {
    contentType: 'application/pdf',
    upsert: false,
  })
  if (up.error) throw up.error

  const signed = await supabase.storage
    .from(SCAN_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL)
  if (signed.error || !signed.data?.signedUrl) {
    throw signed.error ?? new Error('簽名連結產生失敗')
  }

  return { path, url: signed.data.signedUrl }
}

// ============================================================
//  資源分享區（private bucket「community」）
//  ------------------------------------------------------------
//  老師上載教學資源檔案；private bucket → 只有登入老師簽名先下載到
//  （未登入冇 session → 簽唔到 → 下載唔到）。⚠️ 要先跑 migration 0012。
// ============================================================

export const COMMUNITY_BUCKET = 'community'

// 下載/預覽簽名連結有效期：1 個鐘（短期，過期重簽）。
const COMMUNITY_URL_TTL = 60 * 60

function extOf(name: string): string {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i + 1).toLowerCase().replace(/[^a-z0-9]/g, '') : ''
}

export interface UploadedCommunityFile {
  /** Storage 物件路徑（bucket 內，例 `<uid>/<resourceId>-教案.pdf`） */
  path: string
}

/**
 * 上載資源檔案去 community bucket。路徑 `<userId>/<resourceId>-<safe>.<ext>`
 * 對應 RLS 只准存自己 uid 資料夾。唔即時簽 URL（下載時先用 communitySignedUrl 短期簽）。
 */
export async function uploadCommunityFile(
  blob: Blob,
  filename: string,
  userId: string,
  resourceId: string,
): Promise<UploadedCommunityFile> {
  if (!supabase) throw new Error('未接雲端')
  if (!userId) throw new Error('未登入')

  const ext = extOf(filename)
  const safe = asciiKeySegment(filename.replace(/\.[^.]+$/, ''))
  const path = `${userId}/${resourceId}-${safe}${ext ? '.' + ext : ''}`

  const up = await supabase.storage.from(COMMUNITY_BUCKET).upload(path, blob, {
    contentType: blob.type || 'application/octet-stream',
    upsert: true,
  })
  if (up.error) throw up.error
  return { path }
}

/** 攞短期（1 個鐘）簽名連結；private bucket 要登入 session（RLS）。失敗回 null。 */
export async function communitySignedUrl(path: string): Promise<string | null> {
  if (!supabase) return null
  const signed = await supabase.storage.from(COMMUNITY_BUCKET).createSignedUrl(path, COMMUNITY_URL_TTL)
  return signed.data?.signedUrl ?? null
}

/** 批量簽名（gallery 顯示縮圖用）。回 path → signedUrl map。 */
export async function communitySignedUrls(paths: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (!supabase || paths.length === 0) return map
  const { data } = await supabase.storage.from(COMMUNITY_BUCKET).createSignedUrls(paths, COMMUNITY_URL_TTL)
  for (const item of data ?? []) {
    if (item.signedUrl && item.path) map.set(item.path, item.signedUrl)
  }
  return map
}

/** 上載縮圖去 community bucket（路徑 `<userId>/<resourceId>.thumb.jpg`）。回 path，失敗回 null。 */
export async function uploadCommunityThumb(
  blob: Blob,
  userId: string,
  resourceId: string,
): Promise<string | null> {
  if (!supabase || !userId) return null
  const path = `${userId}/${resourceId}.thumb.jpg`
  const up = await supabase.storage.from(COMMUNITY_BUCKET).upload(path, blob, {
    contentType: 'image/jpeg',
    upsert: true,
  })
  if (up.error) {
    console.warn('[thumb] 上載縮圖失敗：', up.error)
    return null
  }
  return path
}
