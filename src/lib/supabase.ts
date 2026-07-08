import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// ============================================================
//  Supabase client
//  ------------------------------------------------------------
//  讀取 .env.local / Vercel 中的兩個變數：
//    VITE_SUPABASE_URL
//    VITE_SUPABASE_ANON_KEY   ← anon key 係設計成可以放前端的
//
//  上線建議：
//    若 Supabase 已啟用 custom domain（例：https://auth.eziteach.hk），
//    VITE_SUPABASE_URL 請填 custom domain，而不是 project-ref.supabase.co。
//    這樣 Google OAuth 頁面先會顯示品牌域名，不會露出隨機 Supabase project URL。
//
//  如果未設定（例如 demo / 未接 Supabase），supabase 會係 null，
//  成個 App 會以「訪客模式」運作（資料暫存在瀏覽器）。
// ============================================================

const rawUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const url = rawUrl?.trim().replace(/\/+$/, '')
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(url && anonKey)

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // PKCE：OAuth 回流用 ?code=… 再換 session，access/refresh token 不會
        // 出現在網址 hash / 瀏覽器歷史，比預設 implicit flow 安全。
        flowType: 'pkce',
      },
    })
  : null
