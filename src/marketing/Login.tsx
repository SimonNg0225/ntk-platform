import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { ArrowLeft, CheckCircle2, Cloud, CreditCard, Loader2, ShieldCheck } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { BRAND_FULL_ZH, BRAND_NAME, BRAND_TAGLINE_ZH } from '../lib/brand'
import { track } from '../lib/observability'

const TRUST_POINTS = [
  {
    icon: Cloud,
    title: '雲端同步',
    desc: '登入後可在不同裝置延續教案、教材、成績分析和工作資料。',
  },
  {
    icon: CreditCard,
    title: '訂閱管理',
    desc: '同一帳戶管理 Pro 方案、AI 點數和付款狀態。',
  },
  {
    icon: ShieldCheck,
    title: '私隱清晰',
    desc: '教學資料由你的帳戶持有；學生資料請按校本政策先匿名化。',
  },
] as const

export default function Login() {
  const { user, configured, signInWithGoogle, loading } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (user) navigate('/app', { replace: true })
  }, [navigate, user])

  async function handleGoogleLogin() {
    if (!configured || busy) return
    try {
      setBusy(true)
      track('login_page_cta_click', { provider: 'google' })
      await signInWithGoogle()
    } catch (e) {
      setBusy(false)
      toast.error(e instanceof Error ? e.message : '暫時未能開啟 Google 登入。')
    }
  }

  return (
    <div className="min-h-screen bg-[color:var(--app-bg)] text-[color:var(--text)]">
      <Helmet>
        <title>登入 · {BRAND_FULL_ZH}</title>
        <meta
          name="description"
          content="登入 EziTeach AI，使用香港老師的 AI 工作台。"
        />
      </Helmet>

      <header className="border-b border-[color:var(--border)] bg-white/88 backdrop-blur-xl dark:bg-slate-950/80">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link
            to="/"
            className="inline-flex min-h-11 items-center gap-3 rounded-full pr-3 text-sm font-semibold text-slate-800 transition hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:text-slate-100"
            aria-label={BRAND_NAME}
          >
            <img src="/favicon.svg" alt="" className="h-9 w-9 rounded-xl" />
            <span>{BRAND_NAME}</span>
          </Link>
          <Link
            to="/app"
            className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <ArrowLeft size={16} strokeWidth={1.9} />
            返回工作台
          </Link>
        </div>
      </header>

      <main className="mx-auto flex min-h-[calc(100svh-4rem)] max-w-6xl items-center px-4 py-8 sm:px-6 lg:py-12">
        <section className="grid w-full overflow-hidden rounded-[28px] border border-[color:var(--border)] bg-white shadow-sm md:grid-cols-[1.05fr_0.95fr] dark:bg-slate-900">
          <div className="px-6 py-8 sm:px-10 sm:py-12 lg:px-12">
            <div className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent-soft px-3 py-1 text-xs font-semibold text-accent-strong dark:bg-accent/10 dark:text-indigo-200">
              <CheckCircle2 size={14} strokeWidth={2} />
              {BRAND_TAGLINE_ZH}
            </div>

            <h1 className="mt-7 max-w-xl text-4xl font-bold tracking-normal text-slate-950 sm:text-5xl dark:text-white">
              登入你的 EziTeach AI 帳戶
            </h1>
            <p className="mt-4 max-w-xl text-base leading-8 text-slate-600 dark:text-slate-300">
              同步你的教學工作、管理訂閱，並使用雲端 AI 工具。所有資料仍由你控制，可在設定中匯出或清除。
            </p>

            <div className="mt-8 max-w-md space-y-3">
              <button
                type="button"
                onClick={() => void handleGoogleLogin()}
                disabled={!configured || loading || busy}
                className="inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-55 dark:border-slate-700 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
              >
                {busy || loading ? <Loader2 size={18} className="animate-spin" /> : <GoogleIcon />}
                使用 Google 繼續
              </button>

              {!configured ? (
                <p className="text-sm leading-6 text-amber-700 dark:text-amber-300">
                  目前未接好雲端登入；可先返回工作台以本機模式使用。
                </p>
              ) : (
                <p className="text-xs leading-6 text-slate-500 dark:text-slate-400">
                  登入即代表你會按所屬學校政策處理學生資料，並同意平台服務條款及私隱政策。
                </p>
              )}
            </div>
          </div>

          <aside className="border-t border-[color:var(--border)] bg-slate-50 px-6 py-8 sm:px-10 md:border-l md:border-t-0 lg:px-12 dark:bg-slate-950/36">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Account Workspace
            </p>
            <h2 className="mt-3 text-2xl font-bold text-slate-950 dark:text-white">
              一個帳戶，連起你的日常教學流程。
            </h2>
            <div className="mt-7 space-y-4">
              {TRUST_POINTS.map((item) => {
                const Icon = item.icon
                return (
                  <div
                    key={item.title}
                    className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent-strong dark:bg-accent/10 dark:text-indigo-200">
                      <Icon size={20} strokeWidth={1.9} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {item.title}
                      </h3>
                      <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </aside>
        </section>
      </main>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
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
