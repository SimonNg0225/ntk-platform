import { useAuth } from '../context/AuthContext'

// 帳戶區（側邊欄底）：未登入顯示 Google 登入掣；登入後顯示用戶 + 登出
export default function AccountBox() {
  const { user, configured, signInWithGoogle, signOut, loading } = useAuth()

  // 未接 Supabase：顯示訪客模式提示
  if (!configured) {
    return (
      <div className="px-5 py-3 text-xs text-slate-400 dark:text-slate-500">
        👤 訪客模式 · 資料暫存本機
      </div>
    )
  }

  if (loading) {
    return <div className="px-5 py-3 text-xs text-slate-400 dark:text-slate-500">載入中…</div>
  }

  if (!user) {
    return (
      <div className="px-4 py-3">
        <button
          onClick={signInWithGoogle}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          <GoogleIcon />
          用 Google 登入
        </button>
      </div>
    )
  }

  const name =
    (user.user_metadata?.full_name as string) ||
    (user.user_metadata?.name as string) ||
    user.email ||
    '已登入'
  const avatar = user.user_metadata?.avatar_url as string | undefined

  return (
    <div className="flex items-center gap-2.5 px-4 py-3">
      {avatar ? (
        <img
          src={avatar}
          alt=""
          className="h-8 w-8 rounded-full object-cover"
        />
      ) : (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-sm font-bold text-accent-strong">
          {name.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-slate-700 dark:text-slate-200">{name}</p>
      </div>
      <button
        onClick={signOut}
        className="text-xs text-slate-400 transition hover:text-red-500 dark:text-slate-500"
      >
        登出
      </button>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C39.9 35.8 44 30.5 44 24c0-1.3-.1-2.3-.4-3.5z"
      />
    </svg>
  )
}
