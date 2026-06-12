// ============================================================
//  資源分享區 — API（RLS 直接查詢，無 Edge Function）
// ============================================================

import { supabase } from '../../lib/supabase'
import { sortOrder } from './logic'
import { generateThumb } from './thumb'
import type { SharedResource, ResourceType, ResourceSort } from './types'

const PAGE_SIZE = 24

function requireSupabase() {
  if (!supabase) throw new Error('未接 Supabase。')
  return supabase
}

async function requireUser() {
  const sb = requireSupabase()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new Error('請先登入。')
  return user
}

/** 批量為 resources 加入 thumbUrl（signed URL）+ authorName。 */
async function attachMeta(rows: SharedResource[]): Promise<SharedResource[]> {
  if (rows.length === 0) return rows
  const sb = requireSupabase()

  // Signed URLs for thumbnails
  const thumbPaths = rows.map((r) => r.thumb_path).filter((p): p is string => Boolean(p))
  let thumbMap = new Map<string, string>()
  if (thumbPaths.length > 0) {
    const { data: signedList } = await sb.storage.from('community').createSignedUrls(thumbPaths, 3600)
    if (signedList) {
      for (const item of signedList) {
        if (item.signedUrl && item.path) thumbMap.set(item.path, item.signedUrl)
      }
    }
  }

  // Author names from profiles
  const ownerIds = [...new Set(rows.map((r) => r.owner_id))]
  const { data: profiles } = await sb.from('profiles').select('id, display_name').in('id', ownerIds)
  const nameMap = new Map((profiles ?? []).map((p: { id: string; display_name: string }) => [p.id, p.display_name]))

  return rows.map((r) => ({
    ...r,
    thumbUrl: r.thumb_path ? (thumbMap.get(r.thumb_path) ?? null) : null,
    authorName: nameMap.get(r.owner_id) ?? '老師',
  }))
}

export interface ListResourcesOptions {
  type?: ResourceType | ''
  subject?: string
  sort: ResourceSort
  q?: string
  page?: number
}

export async function listResources(opts: ListResourcesOptions): Promise<{ resources: SharedResource[]; hasMore: boolean }> {
  const sb = requireSupabase()
  const { type, subject, sort, q, page = 0 } = opts
  const { column, ascending } = sortOrder(sort)
  const from = page * PAGE_SIZE

  let query = sb.from('shared_resources').select('*').eq('status', 'published')

  if (type) query = query.eq('type', type)
  if (subject) query = query.eq('subject_pack_id', subject)
  if (q && q.trim()) {
    const like = `*${q.trim()}*`
    query = query.or(`title.ilike.${like},description.ilike.${like}`)
  }

  query = query.order(column, { ascending }).range(from, from + PAGE_SIZE - 1)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const resources = await attachMeta((data ?? []) as SharedResource[])
  return { resources, hasMore: resources.length === PAGE_SIZE }
}

export async function getResource(id: string): Promise<SharedResource | null> {
  const sb = requireSupabase()
  const { data, error } = await sb.from('shared_resources').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  const [r] = await attachMeta([data as SharedResource])
  return r
}

/** 取得 file_path 的 signed URL（供詳情頁用）。 */
export async function getFileSignedUrl(filePath: string): Promise<string> {
  const sb = requireSupabase()
  const { data, error } = await sb.storage.from('community').createSignedUrl(filePath, 3600)
  if (error || !data?.signedUrl) throw new Error(error?.message ?? '無法取得下載連結。')
  return data.signedUrl
}

export interface UploadResourceInput {
  title: string
  description?: string
  type: SharedResource['type']
  subject_pack_id?: string
  tags?: string[]
  file?: File | null
  externalUrl?: string
  license?: SharedResource['license']
}

export async function uploadResource(input: UploadResourceInput): Promise<SharedResource> {
  const sb = requireSupabase()
  const user = await requireUser()
  const id = crypto.randomUUID()

  let filePath: string | null = null
  let thumbPath: string | null = null
  let fileName: string | null = null
  let fileMime: string | null = null
  let fileSize: number | null = null

  if (input.file) {
    const ext = input.file.name.split('.').pop()?.toLowerCase() ?? 'bin'
    const storagePath = `${user.id}/${id}.${ext}`
    const { error: uploadErr } = await sb.storage.from('community').upload(storagePath, input.file)
    if (uploadErr) throw new Error(uploadErr.message)

    filePath = storagePath
    fileName = input.file.name
    fileMime = input.file.type
    fileSize = input.file.size

    // Generate thumbnail
    const thumbBlob = await generateThumb(input.file)
    if (thumbBlob) {
      const tp = `${user.id}/${id}.thumb.jpg`
      const { error: thumbErr } = await sb.storage.from('community').upload(tp, thumbBlob, { contentType: 'image/jpeg' })
      if (!thumbErr) thumbPath = tp
    }
  }

  const row = {
    id,
    owner_id: user.id,
    title: input.title.trim(),
    description: input.description?.trim() ?? null,
    type: input.type,
    subject_pack_id: input.subject_pack_id ?? null,
    tags: input.tags ?? [],
    file_path: filePath,
    file_name: fileName,
    file_mime: fileMime,
    file_size: fileSize,
    external_url: input.externalUrl ?? null,
    thumb_path: thumbPath,
    license: input.license ?? 'original',
    status: 'published' as const,
  }

  const { data, error } = await sb.from('shared_resources').insert(row).select().single()
  if (error) throw new Error(error.message)
  return data as SharedResource
}

export async function downloadResource(r: SharedResource): Promise<void> {
  const sb = requireSupabase()
  const user = await requireUser()

  if (r.file_path) {
    const { data, error } = await sb.storage.from('community').createSignedUrl(r.file_path, 3600)
    if (error || !data?.signedUrl) throw new Error(error?.message ?? '無法取得下載連結。')
    window.open(data.signedUrl, '_blank')
  } else if (r.external_url) {
    window.open(r.external_url, '_blank')
  }

  // Bump download count (trigger handles the actual increment server-side)
  try { await sb.rpc('bump_download', { p_resource: r.id }) } catch { /* ignore */ }
  void user // suppress unused warning
}

export async function rateResource(id: string, stars: number): Promise<void> {
  const sb = requireSupabase()
  const user = await requireUser()
  const { error } = await sb.from('resource_ratings').upsert(
    { resource_id: id, user_id: user.id, stars },
    { onConflict: 'resource_id,user_id' },
  )
  if (error) throw new Error(error.message)
}

export async function getMyRating(id: string): Promise<number | null> {
  const sb = requireSupabase()
  const user = await requireUser()
  const { data } = await sb.from('resource_ratings').select('stars').eq('resource_id', id).eq('user_id', user.id).maybeSingle()
  return (data as { stars: number } | null)?.stars ?? null
}

export async function toggleSave(id: string, on: boolean): Promise<void> {
  const sb = requireSupabase()
  const user = await requireUser()
  if (on) {
    const { error } = await sb.from('resource_saves').upsert(
      { resource_id: id, user_id: user.id },
      { onConflict: 'resource_id,user_id' },
    )
    if (error) throw new Error(error.message)
  } else {
    const { error } = await sb.from('resource_saves').delete().eq('resource_id', id).eq('user_id', user.id)
    if (error) throw new Error(error.message)
  }
}

export async function isSaved(id: string): Promise<boolean> {
  const sb = requireSupabase()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return false
  const { data } = await sb.from('resource_saves').select('resource_id').eq('resource_id', id).eq('user_id', user.id).maybeSingle()
  return Boolean(data)
}

export async function reportResource(id: string, reason: string, detail?: string): Promise<void> {
  const sb = requireSupabase()
  const user = await requireUser()
  const { error } = await sb.from('resource_reports').insert({
    resource_id: id,
    reporter_id: user.id,
    reason,
    detail: detail ?? null,
  })
  if (error) throw new Error(error.message)
}

export interface ResourceProfile {
  id: string
  display_name: string | null
  school: string | null
  show_school: boolean
  anonymous: boolean
  avatar_color: string | null
  bio: string | null
  subjects: string[]
}

export async function getMyProfile(): Promise<ResourceProfile | null> {
  const sb = requireSupabase()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return null
  const { data } = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle()
  return (data as ResourceProfile) ?? null
}

export async function ensureProfile(displayName: string): Promise<void> {
  const sb = requireSupabase()
  const user = await requireUser()
  const { error } = await sb.from('profiles').upsert(
    { id: user.id, display_name: displayName },
    { onConflict: 'id' },
  )
  if (error) throw new Error(error.message)
}

export async function deleteResource(id: string): Promise<void> {
  const sb = requireSupabase()
  const { error } = await sb.from('shared_resources').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
