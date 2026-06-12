import { supabase, isSupabaseConfigured } from './supabase'
import { uploadCommunityFile, communitySignedUrl } from './supabaseStorage'
import type {
  PublishInput,
  ResourceFilter,
  ResourceSort,
} from '../features/work/community/util'

// ============================================================
//  資源分享區 — Supabase I/O（query / RPC / storage）
//  ------------------------------------------------------------
//  全部經登入 session（RLS gating）；未接 Supabase 一律 throw。
//  純函式（署名 / 驗證 / 篩選排序）喺 features/work/community/util.ts。
// ============================================================

export const isCommunityConfigured = isSupabaseConfigured

export type CommunityResourceType = 'handout' | 'slides' | 'paper' | 'link' | 'video' | 'note'

export interface CommunityProfile {
  id: string
  displayName: string
  school: string | null
  showSchool: boolean
  anonymous: boolean
  avatarColor: string | null
  bio: string | null
  subjects: string[]
}

export interface CommunityResource {
  id: string
  ownerId: string
  title: string
  description: string | null
  subjectPackId: string | null
  topicId: string | null
  grade: string | null
  type: CommunityResourceType
  tags: string[]
  filePath: string | null
  fileName: string | null
  fileMime: string | null
  fileSize: number | null
  externalUrl: string | null
  license: 'original' | 'shareable'
  status: 'published' | 'draft' | 'removed'
  downloadCount: number
  saveCount: number
  ratingSum: number
  ratingCount: number
  createdAt: string
  updatedAt: string
  /** join 落嚟嘅發佈者檔案（listResources / getResource 會帶） */
  owner?: CommunityProfile
}

function need() {
  if (!supabase) throw new Error('未接 Supabase。')
  return supabase
}

async function uid(): Promise<string> {
  const {
    data: { session },
  } = await need().auth.getSession()
  if (!session) throw new Error('請先登入。')
  return session.user.id
}

// ───────── row ↔ 物件 mapper ─────────

type ProfileRow = {
  id: string
  display_name: string
  school: string | null
  show_school: boolean
  anonymous: boolean
  avatar_color: string | null
  bio: string | null
  subjects: string[] | null
}

function toProfile(r: ProfileRow): CommunityProfile {
  return {
    id: r.id,
    displayName: r.display_name,
    school: r.school,
    showSchool: r.show_school,
    anonymous: r.anonymous,
    avatarColor: r.avatar_color,
    bio: r.bio,
    subjects: r.subjects ?? [],
  }
}

type ResourceRow = {
  id: string
  owner_id: string
  title: string
  description: string | null
  subject_pack_id: string | null
  topic_id: string | null
  grade: string | null
  type: CommunityResourceType
  tags: string[] | null
  file_path: string | null
  file_name: string | null
  file_mime: string | null
  file_size: number | null
  external_url: string | null
  license: 'original' | 'shareable'
  status: 'published' | 'draft' | 'removed'
  download_count: number
  save_count: number
  rating_sum: number
  rating_count: number
  created_at: string
  updated_at: string
}

function toResource(r: ResourceRow): CommunityResource {
  return {
    id: r.id,
    ownerId: r.owner_id,
    title: r.title,
    description: r.description,
    subjectPackId: r.subject_pack_id,
    topicId: r.topic_id,
    grade: r.grade,
    type: r.type,
    tags: r.tags ?? [],
    filePath: r.file_path,
    fileName: r.file_name,
    fileMime: r.file_mime,
    fileSize: r.file_size,
    externalUrl: r.external_url,
    license: r.license,
    status: r.status,
    downloadCount: r.download_count,
    saveCount: r.save_count,
    ratingSum: r.rating_sum,
    ratingCount: r.rating_count,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

const RES_COLS =
  'id, owner_id, title, description, subject_pack_id, topic_id, grade, type, tags, file_path, file_name, file_mime, file_size, external_url, license, status, download_count, save_count, rating_sum, rating_count, created_at, updated_at'

/** 為一批資源帶埋發佈者檔案（owner_id → profiles，第二 query 併入）。 */
async function attachOwners(rows: CommunityResource[]): Promise<CommunityResource[]> {
  if (rows.length === 0) return rows
  const ids = [...new Set(rows.map((r) => r.ownerId))]
  const { data } = await need().from('profiles').select('*').in('id', ids)
  const map = new Map<string, CommunityProfile>()
  for (const p of (data ?? []) as ProfileRow[]) map.set(p.id, toProfile(p))
  return rows.map((r) => ({ ...r, owner: map.get(r.ownerId) }))
}

// ───────── Profile ─────────

export async function getProfile(userId: string): Promise<CommunityProfile | null> {
  const { data, error } = await need().from('profiles').select('*').eq('id', userId).maybeSingle()
  if (error) throw new Error(error.message)
  return data ? toProfile(data as ProfileRow) : null
}

export async function getMyProfile(): Promise<CommunityProfile | null> {
  return getProfile(await uid())
}

export interface ProfileInput {
  displayName: string
  school?: string | null
  showSchool: boolean
  anonymous: boolean
  avatarColor?: string | null
  bio?: string | null
  subjects?: string[]
}

export async function upsertMyProfile(input: ProfileInput): Promise<void> {
  const id = await uid()
  const { error } = await need()
    .from('profiles')
    .upsert(
      {
        id,
        display_name: input.displayName,
        school: input.school ?? null,
        show_school: input.showSchool,
        anonymous: input.anonymous,
        avatar_color: input.avatarColor ?? null,
        bio: input.bio ?? null,
        subjects: input.subjects ?? [],
      },
      { onConflict: 'id' },
    )
  if (error) throw new Error(error.message)
}

// ───────── 瀏覽 / 詳情 ─────────

const PAGE_SIZE = 24

export async function listResources(
  filter: ResourceFilter,
  sort: ResourceSort,
  page = 0,
): Promise<CommunityResource[]> {
  let q = need().from('shared_resources').select(RES_COLS).eq('status', 'published')
  if (filter.subjectPackId) q = q.eq('subject_pack_id', filter.subjectPackId)
  if (filter.topicId) q = q.eq('topic_id', filter.topicId)
  if (filter.grade) q = q.eq('grade', filter.grade)
  if (filter.type) q = q.eq('type', filter.type)
  if (filter.q?.trim()) {
    const term = `%${filter.q.trim()}%`
    q = q.or(`title.ilike.${term},description.ilike.${term}`)
  }
  const col =
    sort === 'downloads'
      ? 'download_count'
      : sort === 'saves'
        ? 'save_count'
        : sort === 'rating'
          ? 'rating_sum'
          : 'created_at'
  const { data, error } = await q
    .order(col, { ascending: false })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)
  if (error) throw new Error(error.message)
  return attachOwners(((data ?? []) as ResourceRow[]).map(toResource))
}

export async function getResource(id: string): Promise<CommunityResource | null> {
  const { data, error } = await need().from('shared_resources').select(RES_COLS).eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  const [withOwner] = await attachOwners([toResource(data as ResourceRow)])
  return withOwner
}

export async function myResources(): Promise<CommunityResource[]> {
  const id = await uid()
  const { data, error } = await need()
    .from('shared_resources')
    .select(RES_COLS)
    .eq('owner_id', id)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return ((data ?? []) as ResourceRow[]).map(toResource)
}

// ───────── 發佈 / 管理 ─────────

export interface PublishPayload extends PublishInput {
  /** 上載嘅檔案（檔案型先有） */
  file?: Blob & { name?: string }
  fileName?: string
  status?: 'published' | 'draft'
}

/** 發佈新資源：先（檔案型）上載去 community bucket，再插 shared_resources。回新 id。 */
export async function publishResource(p: PublishPayload): Promise<string> {
  const ownerId = await uid()
  const id = crypto.randomUUID()
  let filePath: string | null = null
  let fileMime: string | null = null
  let fileSize: number | null = null
  let fileName: string | null = null
  if (p.file && p.hasFile) {
    const up = await uploadCommunityFile(p.file, p.fileName ?? p.file.name ?? 'file', ownerId, id)
    filePath = up.path
    fileMime = p.file.type || null
    fileSize = p.file.size
    fileName = p.fileName ?? p.file.name ?? null
  }
  const { error } = await need()
    .from('shared_resources')
    .insert({
      id,
      owner_id: ownerId,
      title: p.title.trim(),
      description: p.description?.trim() || null,
      subject_pack_id: p.subjectPackId || null,
      topic_id: p.topicId || null,
      grade: p.grade || null,
      type: p.type,
      tags: p.tags ?? [],
      file_path: filePath,
      file_name: fileName,
      file_mime: fileMime,
      file_size: fileSize,
      external_url: p.hasFile ? null : p.externalUrl?.trim() || null,
      license: p.license,
      status: p.status ?? 'published',
    })
  if (error) throw new Error(error.message)
  return id
}

export async function setResourceStatus(id: string, status: 'published' | 'draft'): Promise<void> {
  const { error } = await need().from('shared_resources').update({ status }).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteResource(id: string): Promise<void> {
  const { error } = await need().from('shared_resources').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ───────── 評分 / 收藏 / 下載 / 檢舉 ─────────

export async function getMyRating(resourceId: string): Promise<number | null> {
  const id = await uid()
  const { data } = await need()
    .from('resource_ratings')
    .select('stars')
    .eq('resource_id', resourceId)
    .eq('user_id', id)
    .maybeSingle()
  return data ? (data as { stars: number }).stars : null
}

export async function rateResource(resourceId: string, stars: number): Promise<void> {
  const id = await uid()
  const { error } = await need()
    .from('resource_ratings')
    .upsert({ resource_id: resourceId, user_id: id, stars }, { onConflict: 'resource_id,user_id' })
  if (error) throw new Error(error.message)
}

export async function isSaved(resourceId: string): Promise<boolean> {
  const id = await uid()
  const { data } = await need()
    .from('resource_saves')
    .select('resource_id')
    .eq('resource_id', resourceId)
    .eq('user_id', id)
    .maybeSingle()
  return Boolean(data)
}

export async function saveResource(resourceId: string): Promise<void> {
  const id = await uid()
  const { error } = await need()
    .from('resource_saves')
    .upsert({ resource_id: resourceId, user_id: id }, { onConflict: 'resource_id,user_id' })
  if (error) throw new Error(error.message)
}

export async function unsaveResource(resourceId: string): Promise<void> {
  const id = await uid()
  const { error } = await need()
    .from('resource_saves')
    .delete()
    .eq('resource_id', resourceId)
    .eq('user_id', id)
  if (error) throw new Error(error.message)
}

export async function bumpDownload(resourceId: string): Promise<void> {
  await need().rpc('bump_download', { p_resource: resourceId })
}

export async function reportResource(resourceId: string, reason: string, detail?: string): Promise<void> {
  const id = await uid()
  const { error } = await need()
    .from('resource_reports')
    .insert({ resource_id: resourceId, reporter_id: id, reason, detail: detail?.trim() || null })
  if (error) throw new Error(error.message)
}

/** 攞檔案嘅短期下載/預覽連結（private bucket → 要登入 session 簽名）。 */
export async function resourceFileUrl(filePath: string): Promise<string | null> {
  return communitySignedUrl(filePath)
}
