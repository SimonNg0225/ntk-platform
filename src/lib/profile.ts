import { supabase, isSupabaseConfigured } from './supabase'

// ============================================================
//  全 app 統一身份 — Supabase I/O（首次登記 / 讀檔）
//  ------------------------------------------------------------
//  讀寫 public.profiles（0012 建 + 0014 擴充）。同一張表畀資源分享區
//  （lib/community.ts）共用，所以呢度只負責「登記相關」嘅讀寫，唔重複
//  community 嗰套瀏覽 / 發佈邏輯。
//  純選項 / 驗證喺 features/onboarding/logic.ts。
// ============================================================

export const isProfileConfigured = isSupabaseConfigured

export type TeacherRole = 'teacher' | 'pre_service' | 'tutor' | 'other'
export type SchoolBand = 'primary' | 'junior' | 'senior'

export interface AppProfile {
  id: string
  displayName: string
  role: TeacherRole | null
  subjects: string[]
  bands: SchoolBand[]
  school: string | null
  showSchool: boolean
  bio: string | null
  avatarColor: string | null
  /** 完成首次登記嘅時間（null = 未登記） */
  onboardedAt: string | null
  acceptedTermsAt: string | null
}

/** 首次登記表單輸出。 */
export interface RegistrationInput {
  displayName: string
  role: TeacherRole
  subjects: string[]
  bands: SchoolBand[]
  school: string | null
  showSchool: boolean
  bio: string | null
  avatarColor: string | null
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

type AppProfileRow = {
  id: string
  display_name: string
  role: string | null
  subjects: string[] | null
  bands: string[] | null
  school: string | null
  show_school: boolean
  bio: string | null
  avatar_color: string | null
  onboarded_at: string | null
  accepted_terms_at: string | null
}

const COLS =
  'id, display_name, role, subjects, bands, school, show_school, bio, avatar_color, onboarded_at, accepted_terms_at'

function toAppProfile(r: AppProfileRow): AppProfile {
  return {
    id: r.id,
    displayName: r.display_name,
    role: (r.role as TeacherRole | null) ?? null,
    subjects: r.subjects ?? [],
    bands: (r.bands as SchoolBand[] | null) ?? [],
    school: r.school,
    showSchool: r.show_school,
    bio: r.bio,
    avatarColor: r.avatar_color,
    onboardedAt: r.onboarded_at,
    acceptedTermsAt: r.accepted_terms_at,
  }
}

/** 攞目前登入用戶嘅檔案（未接 / 未登入 / 查唔到 → null）。 */
export async function getMyAppProfile(): Promise<AppProfile | null> {
  if (!supabase) return null
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) return null
  const { data, error } = await supabase
    .from('profiles')
    .select(COLS)
    .eq('id', session.user.id)
    .maybeSingle()
  if (error) return null
  return data ? toAppProfile(data as AppProfileRow) : null
}

/**
 * 已登入但未完成登記（onboarded_at 為 NULL / 無 profile）→ true。
 * 任何情況（未接 Supabase / 未登入 / 未跑 0014 migration / 查詢出錯）一律
 * 回 false，務求「唔好阻住用戶用 app」。
 */
export async function needsRegistration(): Promise<boolean> {
  if (!supabase) return false
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) return false
  const { data, error } = await supabase
    .from('profiles')
    .select('onboarded_at')
    .eq('id', session.user.id)
    .maybeSingle()
  if (error) return false
  return !data || !(data as { onboarded_at: string | null }).onboarded_at
}

/**
 * 完成首次登記：寫 canonical profiles（即時標記 onboarded_at / accepted_terms_at），
 * 並 best-effort 同步論壇公開檔案（forum_profiles），令論壇即時有正確署名。
 * 論壇同步失敗（表唔存在 / 網絡）唔影響登記成功。
 */
export async function completeRegistration(input: RegistrationInput): Promise<void> {
  const id = await uid()
  const now = new Date().toISOString()
  const { error } = await need()
    .from('profiles')
    .upsert(
      {
        id,
        display_name: input.displayName,
        role: input.role,
        subjects: input.subjects,
        bands: input.bands,
        school: input.school,
        show_school: input.showSchool,
        bio: input.bio,
        avatar_color: input.avatarColor,
        onboarded_at: now,
        accepted_terms_at: now,
      },
      { onConflict: 'id' },
    )
  if (error) throw new Error(error.message)

  // 同步論壇公開檔案（一處填、論壇即見正確署名 / 學校 / 科目）。best-effort。
  try {
    await need()
      .from('forum_profiles')
      .upsert(
        {
          user_id: id,
          display_name: input.displayName,
          school: input.school,
          subjects: input.subjects,
        },
        { onConflict: 'user_id' },
      )
  } catch {
    /* 論壇同步係加分項，失敗都當登記成功 */
  }
}
