import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { BRAND_FULL_ZH, BRAND_NAME } from '../lib/brand'

export default function AuthCallback() {
  const { user, loading, signInWithGoogle } = useAuth()
  const navigate = useNavigate()
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    if (user) navigate('/app', { replace: true })
  }, [navigate, user])

  useEffect(() => {
    const id = window.setTimeout(() => setTimedOut(true), 9000)
    return () => window.clearTimeout(id)
  }, [])

  return (
    <div className="flex min-h-screen items-center justify-center bg-[color:var(--app-bg)] px-4 text-[color:var(--text)]">
      <Helmet>
        <title>登入中 · {BRAND_FULL_ZH}</title>
      </Helmet>

      <main className="w-full max-w-md rounded-[28px] border border-[color:var(--border)] bg-white p-7 text-center shadow-sm dark:bg-slate-900">
        <img src="/favicon.svg" alt="" className="mx-auto h-12 w-12 rounded-2xl" />
        <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent-strong dark:bg-accent/10 dark:text-indigo-200">
          {timedOut ? <CheckCircle2 size={14} /> : <Loader2 size={14} className="animate-spin" />}
          {BRAND_NAME}
        </div>
        <h1 className="mt-5 text-2xl font-bold text-slate-950 dark:text-white">
          {timedOut ? '登入未完成' : '正在完成登入'}
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
          {timedOut
            ? '如果畫面停留太久，請重新開啟 Google 登入，或返回工作台稍後再試。'
            : '請稍等一陣，我們正在安全地連接你的 EziTeach AI 帳戶。'}
        </p>
        {timedOut && !loading && !user ? (
          <div className="mt-6 grid gap-3">
            <button
              type="button"
              onClick={() => void signInWithGoogle()}
              className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-2xl bg-accent px-4 text-sm font-semibold text-white transition hover:bg-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2"
            >
              重新登入
            </button>
            <Link
              to="/app"
              className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-[color:var(--border)] bg-white px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              返回工作台
            </Link>
          </div>
        ) : null}
      </main>
    </div>
  )
}
