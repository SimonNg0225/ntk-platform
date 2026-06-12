import { supabase } from './supabase'

// ============================================================
//  全站公告（用戶端讀取）
//  ------------------------------------------------------------
//  RLS 只回「生效中」嘅公告（active + 喺時間窗內），故前端直接 select。
//  AnnouncementBanner 用呢個喺登入後顯示橫額。
// ============================================================

export interface PublicAnnouncement {
  id: string
  title: string
  body: string
  level: 'info' | 'warning' | 'success'
  created_at: string
}

export async function listActiveAnnouncements(): Promise<PublicAnnouncement[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('announcements')
    .select('id, title, body, level, created_at')
    .order('created_at', { ascending: false })
    .limit(5)
  if (error) return []
  return (data ?? []) as PublicAnnouncement[]
}
