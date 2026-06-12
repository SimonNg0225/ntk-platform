// ============================================================
//  資源分享區 — 純函式（身份署名 / 檔案 + 發佈驗證 / 篩選排序）
//  ------------------------------------------------------------
//  本檔零 runtime 依賴（只 import type），可 node 直接單元測試。
// ============================================================

import type {
  CommunityProfile,
  CommunityResource,
  CommunityResourceType,
} from '../../../lib/community'

// ───────── 身份署名 ─────────

/** 稱謂選項（引導式建立 display_name 用） */
export const HONORIFICS = ['老師', 'Sir', 'Miss', '先生', '小姐'] as const
export type Honorific = (typeof HONORIFICS)[number]

/** 姓氏 + 稱謂 → 署名（例：「陳」+「老師」=「陳老師」）。姓氏空 → 空字串。 */
export function buildDisplayName(surname: string, honorific: string): string {
  const s = surname.trim()
  return s ? `${s}${honorific}` : ''
}

/**
 * 公開署名規則：
 *  匿名         → 「匿名老師」
 *  顯示學校     → 「XX中學 陳老師」
 *  否則         → 「陳老師」
 */
export function publicName(
  p: Pick<CommunityProfile, 'displayName' | 'school' | 'showSchool' | 'anonymous'>,
): string {
  if (p.anonymous) return '匿名老師'
  const name = p.displayName.trim() || '老師'
  const school = p.school?.trim()
  return p.showSchool && school ? `${school} ${name}` : name
}

/** 平均評分（0 = 未有評分）。 */
export function avgRating(r: Pick<CommunityResource, 'ratingSum' | 'ratingCount'>): number {
  return r.ratingCount > 0 ? r.ratingSum / r.ratingCount : 0
}

// ───────── 檔案驗證 ─────────

/** 容許嘅副檔名 → MIME（白名單）。 */
export const ALLOWED_FILE_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
}

/** 檔案大細上限（25MB）。 */
export const MAX_FILE_BYTES = 25 * 1024 * 1024

function extOf(name: string): string {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i + 1).toLowerCase() : ''
}

/** 驗證上載檔案（副檔名白名單 + 大細）。 */
export function validateFile(file: { name: string; size: number }): { ok: boolean; error?: string } {
  const ext = extOf(file.name)
  if (!ext || !(ext in ALLOWED_FILE_TYPES)) {
    return { ok: false, error: '只支援 PDF / PPTX / Word / 圖片檔。' }
  }
  if (file.size <= 0) return { ok: false, error: '檔案似乎係空嘅。' }
  if (file.size > MAX_FILE_BYTES) {
    return { ok: false, error: `檔案太大（上限 ${Math.floor(MAX_FILE_BYTES / 1024 / 1024)}MB）。` }
  }
  return { ok: true }
}

// ───────── 發佈驗證 ─────────

export type ResourceLicense = 'original' | 'shareable'

/** 發佈表單輸入（檔案 or 連結二擇一）。 */
export interface PublishInput {
  title: string
  description?: string
  subjectPackId?: string
  topicId?: string
  grade?: string
  type: CommunityResourceType
  tags?: string[]
  /** 有上載檔案（檔案型） */
  hasFile?: boolean
  /** 純連結型 URL */
  externalUrl?: string
  license: ResourceLicense
}

const RESOURCE_TYPES: CommunityResourceType[] = ['handout', 'slides', 'paper', 'link', 'video', 'note']

function isHttpUrl(s: string): boolean {
  return /^https?:\/\/\S+$/i.test(s.trim())
}

/** 驗證發佈 payload；唔合格回 error 訊息。 */
export function validatePublish(input: PublishInput): { ok: boolean; error?: string } {
  if (!input.title.trim()) return { ok: false, error: '請填寫標題。' }
  if (input.title.trim().length > 120) return { ok: false, error: '標題太長（上限 120 字）。' }
  if (!RESOURCE_TYPES.includes(input.type)) return { ok: false, error: '請揀資源類型。' }
  if (input.license !== 'original' && input.license !== 'shareable') {
    return { ok: false, error: '請確認版權聲明。' }
  }
  const hasFile = Boolean(input.hasFile)
  const url = (input.externalUrl ?? '').trim()
  if (!hasFile && !url) return { ok: false, error: '請上載檔案或貼連結。' }
  if (!hasFile && url && !isHttpUrl(url)) return { ok: false, error: '連結要以 http(s):// 開頭。' }
  if ((input.tags?.length ?? 0) > 12) return { ok: false, error: '標籤最多 12 個。' }
  return { ok: true }
}

// ───────── 篩選 + 排序（純函式，亦俾測試用）─────────

export interface ResourceFilter {
  q?: string
  subjectPackId?: string
  topicId?: string
  grade?: string
  type?: CommunityResourceType
}

export type ResourceSort = 'recent' | 'downloads' | 'rating' | 'saves'

export const SORT_LABELS: Record<ResourceSort, string> = {
  recent: '最新',
  downloads: '最多下載',
  rating: '最高評分',
  saves: '最多收藏',
}

/** 一份資源係咪符合篩選（q 比對標題/描述/標籤）。 */
export function matchesFilter(r: CommunityResource, f: ResourceFilter): boolean {
  if (f.subjectPackId && r.subjectPackId !== f.subjectPackId) return false
  if (f.topicId && r.topicId !== f.topicId) return false
  if (f.grade && r.grade !== f.grade) return false
  if (f.type && r.type !== f.type) return false
  const q = f.q?.trim().toLowerCase()
  if (q) {
    const hay = [r.title, r.description ?? '', ...(r.tags ?? [])].join(' ').toLowerCase()
    if (!hay.includes(q)) return false
  }
  return true
}

/** 按排序鍵排（純函式，回新陣列）。 */
export function sortResources(list: CommunityResource[], sort: ResourceSort): CommunityResource[] {
  const arr = [...list]
  switch (sort) {
    case 'downloads':
      return arr.sort((a, b) => b.downloadCount - a.downloadCount)
    case 'saves':
      return arr.sort((a, b) => b.saveCount - a.saveCount)
    case 'rating':
      return arr.sort((a, b) => avgRating(b) - avgRating(a) || b.ratingCount - a.ratingCount)
    default:
      return arr.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }
}
