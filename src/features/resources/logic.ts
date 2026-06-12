// ============================================================
//  資源分享區 — 純邏輯函式（無副作用，可測試）
// ============================================================

import type { ResourceSort, ResourceType } from './types'

// 允許嘅檔案 MIME / 副檔名
const ALLOWED_EXTS = new Set(['pdf', 'ppt', 'pptx', 'doc', 'docx', 'png', 'jpg', 'jpeg'])
const MAX_SIZE = 50 * 1024 * 1024 // 50 MB

// 需要檔案嘅 type（link / video 用 external_url）
const FILE_TYPES: ResourceType[] = ['handout', 'slides', 'paper', 'note']

export interface ValidateUploadInput {
  title: string
  type: ResourceType
  file?: File | null
  externalUrl?: string
}

/** 驗證上載表單。回 null = 通過；回 string = 錯誤訊息。 */
export function validateUpload({ title, type, file, externalUrl }: ValidateUploadInput): string | null {
  const t = title.trim()
  if (!t) return '請填寫標題。'
  if (t.length > 120) return '標題不可超過 120 個字。'

  if (type === 'link' || type === 'video') {
    // 需要合法 http(s) URL
    if (!externalUrl || !externalUrl.trim()) return '請提供連結網址。'
    try {
      const url = new URL(externalUrl.trim())
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return '連結必須以 http:// 或 https:// 開頭。'
    } catch {
      return '連結格式不正確，請提供完整 URL。'
    }
    return null
  }

  // 需要檔案嘅 type
  if (FILE_TYPES.includes(type)) {
    if (!file) return '請選擇上載檔案。'
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (!ALLOWED_EXTS.has(ext)) return `不支援此檔案格式（.${ext}）。支援：PDF、PPT/PPTX、DOC/DOCX、PNG、JPG/JPEG。`
    if (file.size > MAX_SIZE) return `檔案大小不可超過 50 MB（目前：${(file.size / 1024 / 1024).toFixed(1)} MB）。`
    return null
  }

  return null
}

/** 由 MIME type + 檔案名稱判斷檔案種類。 */
export function fileKind(mime: string, name: string): 'pdf' | 'image' | 'office' | 'other' {
  const m = mime.toLowerCase()
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (m === 'application/pdf' || ext === 'pdf') return 'pdf'
  if (m.startsWith('image/')) return 'image'
  if (
    m === 'application/vnd.ms-powerpoint' ||
    m === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    m === 'application/msword' ||
    m === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    ['ppt', 'pptx', 'doc', 'docx'].includes(ext)
  ) return 'office'
  return 'other'
}

/** 格式化檔案大小，例如 '2.3 MB'。 */
export function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
}

/** 計算評分平均值（count 為 0 時回 0）。 */
export function avg(sum: number, count: number): number {
  if (count === 0) return 0
  return sum / count
}

/** 將 ResourceSort 轉換為 Supabase .order() 參數。 */
export function sortOrder(sort: ResourceSort): { column: string; ascending: boolean } {
  if (sort === 'popular') return { column: 'download_count', ascending: false }
  return { column: 'created_at', ascending: false }
}
