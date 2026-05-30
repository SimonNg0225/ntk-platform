import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// ============================================================
//  Supabase client
//  ------------------------------------------------------------
//  讀取 .env.local 入面嘅兩個變數：
//    VITE_SUPABASE_URL
//    VITE_SUPABASE_ANON_KEY   ← anon key 係設計成可以放前端嘅
//
//  如果未設定（例如 demo / 未接 Supabase），supabase 會係 null，
//  成個 App 會以「訪客模式」運作（資料暫存喺瀏覽器）。
// ============================================================

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(url && anonKey)

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null
