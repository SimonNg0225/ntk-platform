import { supabase } from '../../lib/supabase'
import { sortColumn } from './logic'
import type { ForumBoard, ForumThread, ForumPost, ForumProfile, ThreadSort } from './types'

const PAGE = 20

async function callForum<T>(action: string, body: Record<string, unknown> = {}): Promise<T> {
  if (!supabase) throw new Error('未接 Supabase。')
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('請先登入。')
  const base = (import.meta.env.VITE_SUPABASE_URL as string).replace(/\/$/, '')
  const res = await fetch(`${base}/functions/v1/forum`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
    },
    body: JSON.stringify({ action, ...body }),
  })
  const data = (await res.json().catch(() => null)) as { data?: T; error?: string } | null
  if (!res.ok || !data) throw new Error(data?.error ?? '操作失敗。')
  return data.data as T
}

// 併入作者顯示名（一個 .in() 查 forum_profiles）
async function attachAuthors<T extends { author_id: string; authorName?: string }>(rows: T[]): Promise<T[]> {
  if (!supabase || rows.length === 0) return rows
  const ids = [...new Set(rows.map((r) => r.author_id))]
  const { data } = await supabase.from('forum_profiles').select('user_id, display_name').in('user_id', ids)
  const map = new Map((data ?? []).map((p) => [p.user_id, p.display_name]))
  return rows.map((r) => ({ ...r, authorName: map.get(r.author_id) ?? '老師' }))
}

async function myReactions(targetType: 'thread' | 'post', ids: string[]): Promise<Set<string>> {
  if (!supabase || ids.length === 0) return new Set()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Set()
  const { data } = await supabase.from('forum_reactions').select('target_id')
    .eq('user_id', user.id).eq('target_type', targetType).eq('kind', 'up').in('target_id', ids)
  return new Set((data ?? []).map((r) => r.target_id))
}

export async function listBoards(): Promise<ForumBoard[]> {
  if (!supabase) return []
  const { data, error } = await supabase.from('forum_boards').select('*').eq('archived', false).order('sort')
  if (error) throw new Error(error.message)
  return (data ?? []) as ForumBoard[]
}

export async function listThreads(boardId: string, sort: ThreadSort, page = 0): Promise<{ threads: ForumThread[]; hasMore: boolean }> {
  if (!supabase) return { threads: [], hasMore: false }
  const { column, ascending } = sortColumn(sort)
  const from = page * PAGE
  const { data, error } = await supabase.from('forum_threads').select('*')
    .eq('board_id', boardId).eq('status', 'active')
    .order('pinned', { ascending: false }).order(column, { ascending })
    .range(from, from + PAGE - 1)
  if (error) throw new Error(error.message)
  let threads = (data ?? []) as ForumThread[]
  threads = await attachAuthors(threads)
  const up = await myReactions('thread', threads.map((t) => t.id))
  threads = threads.map((t) => ({ ...t, mineUp: up.has(t.id) }))
  return { threads, hasMore: threads.length === PAGE }
}

export async function searchThreads(boardId: string, q: string): Promise<ForumThread[]> {
  if (!supabase || !q.trim()) return []
  const like = `*${q.trim()}*` // PostgREST .or() 內 ilike 用 * 做萬用字元（唔係 %）
  const { data, error } = await supabase.from('forum_threads').select('*')
    .eq('board_id', boardId).eq('status', 'active')
    .or(`title.ilike.${like},body.ilike.${like}`)
    .order('last_activity_at', { ascending: false }).limit(30)
  if (error) throw new Error(error.message)
  return attachAuthors((data ?? []) as ForumThread[])
}

export async function getThread(id: string): Promise<ForumThread | null> {
  if (!supabase) return null
  const { data, error } = await supabase.from('forum_threads').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  const [t] = await attachAuthors([data as ForumThread])
  const up = await myReactions('thread', [id])
  return { ...t, mineUp: up.has(id) }
}

export async function listPosts(threadId: string, page = 0): Promise<{ posts: ForumPost[]; hasMore: boolean }> {
  if (!supabase) return { posts: [], hasMore: false }
  const from = page * PAGE
  const { data, error } = await supabase.from('forum_posts').select('*')
    .eq('thread_id', threadId).eq('status', 'active')
    .order('created_at', { ascending: true }).range(from, from + PAGE - 1)
  if (error) throw new Error(error.message)
  let posts = (data ?? []) as ForumPost[]
  posts = await attachAuthors(posts)
  const up = await myReactions('post', posts.map((p) => p.id))
  posts = posts.map((p) => ({ ...p, mineUp: up.has(p.id) }))
  return { posts, hasMore: posts.length === PAGE }
}

export async function getMyProfile(): Promise<ForumProfile | null> {
  if (!supabase) return null
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('forum_profiles').select('*').eq('user_id', user.id).maybeSingle()
  return (data as ForumProfile) ?? null
}

// 讚（樂觀，呼叫端自己回滾）：client 直接寫 forum_reactions（RLS write own），trigger 改 score
export async function setUpvote(targetType: 'thread' | 'post', targetId: string, on: boolean): Promise<void> {
  if (!supabase) throw new Error('未接 Supabase。')
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('請先登入。')
  if (on) {
    const { error } = await supabase.from('forum_reactions')
      .upsert({ user_id: user.id, target_type: targetType, target_id: targetId, kind: 'up' },
        { onConflict: 'user_id,target_type,target_id,kind' })
    if (error) throw new Error(error.message)
  } else {
    const { error } = await supabase.from('forum_reactions').delete()
      .eq('user_id', user.id).eq('target_type', targetType).eq('target_id', targetId).eq('kind', 'up')
    if (error) throw new Error(error.message)
  }
}

// 寫入（經 forum Edge Function）
export const createThread = (board_id: string, title: string, body: string, tags: string[]) =>
  callForum<{ id: string }>('create-thread', { board_id, title, body, tags })
export const createPost = (thread_id: string, body: string) =>
  callForum<{ id: string }>('create-post', { thread_id, body })
export const editOwn = (type: 'thread' | 'post', id: string, body: string, title?: string) =>
  callForum<{ ok: true }>('edit-own', { type, id, body, title })
export const deleteOwn = (type: 'thread' | 'post', id: string) =>
  callForum<{ ok: true }>('delete-own', { type, id })
export const reportContent = (target_type: 'thread' | 'post', target_id: string, reason: string) =>
  callForum<{ ok: true }>('report', { target_type, target_id, reason })
export const setProfile = (display_name: string, school: string, subjects: string[]) =>
  callForum<{ ok: true }>('set-profile', { display_name, school, subjects })
