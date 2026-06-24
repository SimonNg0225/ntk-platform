// ============================================================
//  行銷內容資產：共用型別 + 標籤
//  ------------------------------------------------------------
//  雲端共享版：資料存喺 Supabase `marketing_content` 表（migration
//  0016），經 `admin` Edge Function（service_role）讀寫,全部管理員
//  共用。CRUD API 喺 src/lib/admin.ts：
//    adminListMarketing / adminSaveMarketing / adminDeleteMarketing
//  呢個檔只放 UI 同 API 共用嘅型別同標籤（單一 source of truth）。
// ============================================================

export type MarketingAssetType =
  | 'landing'
  | 'demo-script'
  | 'seo-article'
  | 'social'
  | 'email'
  | 'other'

export type MarketingStatus = 'idea' | 'draft' | 'review' | 'published'

/** 對應 Supabase `marketing_content` 一行。 */
export interface MarketingAsset {
  id: string
  type: MarketingAssetType
  title: string
  channel: string
  status: MarketingStatus
  body: string
  notes: string
  created_by: string | null
  created_at: string
  updated_at: string
}

export const ASSET_TYPE_LABEL: Record<MarketingAssetType, string> = {
  landing: 'Landing 文案',
  'demo-script': '示範腳本',
  'seo-article': 'SEO 文章',
  social: '社交帖文',
  email: 'Email',
  other: '其他',
}

export const STATUS_LABEL: Record<MarketingStatus, string> = {
  idea: '構思',
  draft: '草稿',
  review: '待審',
  published: '已發佈',
}

// 對應 ui Badge 嘅 BadgeTone 子集
export const STATUS_TONE: Record<MarketingStatus, 'slate' | 'amber' | 'blue' | 'green'> = {
  idea: 'slate',
  draft: 'amber',
  review: 'blue',
  published: 'green',
}

export const ASSET_TYPE_OPTIONS: MarketingAssetType[] = [
  'landing',
  'demo-script',
  'seo-article',
  'social',
  'email',
  'other',
]

export const STATUS_OPTIONS: MarketingStatus[] = ['idea', 'draft', 'review', 'published']
