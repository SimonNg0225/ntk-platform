export interface ForumBoard {
  id: string; slug: string; name: string; description: string
  sort: number; archived: boolean; created_at: string
}
export interface ForumProfile {
  user_id: string; display_name: string; school: string | null
  subjects: string[]; created_at: string; updated_at: string
}
export type ThreadStatus = 'active' | 'locked' | 'removed'
export interface ForumThread {
  id: string; board_id: string; author_id: string
  title: string; body: string; tags: string[]
  status: ThreadStatus; pinned: boolean; featured: boolean
  reply_count: number; score: number
  last_activity_at: string; created_at: string; updated_at: string
  authorName?: string         // 由 profile 併入
  mineUp?: boolean; mineSave?: boolean
}
export interface ForumPost {
  id: string; thread_id: string; author_id: string
  body: string; status: 'active' | 'removed'; score: number
  created_at: string; updated_at: string
  authorName?: string; mineUp?: boolean
}
export type ThreadSort = 'new' | 'replies' | 'top'
