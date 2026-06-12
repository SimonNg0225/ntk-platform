// ============================================================
//  資源分享區 — 型別定義
// ============================================================

export type ResourceType = 'handout' | 'slides' | 'paper' | 'link' | 'video' | 'note'
export type ResourceLicense = 'original' | 'shareable'
export type ResourceStatus = 'published' | 'draft' | 'removed'
export type ResourceSort = 'new' | 'popular'

export interface SharedResource {
  id: string
  owner_id: string
  title: string
  description: string | null
  subject_pack_id: string | null
  topic_id: string | null
  grade: string | null
  type: ResourceType
  tags: string[]
  file_path: string | null
  file_name: string | null
  file_mime: string | null
  file_size: number | null
  external_url: string | null
  license: ResourceLicense
  status: ResourceStatus
  download_count: number
  save_count: number
  rating_sum: number
  rating_count: number
  thumb_path: string | null
  created_at: string
  updated_at: string
  // Attached by client after fetch
  thumbUrl?: string | null
  authorName?: string
}
