import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import {
  ClipboardList,
  FileText,
  TrendingUp,
  CalendarDays,
  MessagesSquare,
  Sparkles,
  ShieldCheck,
  Cloud,
  ArrowRight,
  Loader2,
  type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { track } from '../lib/observability'

// ============================================================
//  商業化 · 行銷首頁（Landing）—— 對象：全港老師
//  ------------------------------------------------------------
//  機構級 SaaS 風：克制配色、line icon、無 emoji、無漸變光暈。
//  產品入口 '/app'，定價 '/pricing'。
// ============================================================

// icon + i18n key（文案喺 src/i18n）
const FEATURE_ITEMS: { icon: LucideIcon; k: string }[] = [
  { icon: ClipboardList, k: 'prep' },
  { icon: FileText, k: 'ai' },
  { icon: TrendingUp, k: 'grade' },
  { icon: CalendarDays, k: 'att' },
  { icon: MessagesSquare, k: 'comm' },
  { icon: Sparkles, k: 'aia' },
]

const TRUST_ITEMS: { icon: LucideIcon; k: string }[] = [
  { icon: ShieldCheck, k: 'local' },
  { icon: Cloud, k: 'offline' },
  { icon: FileText, k: 'a11y' },
]

export default function Landing() {
  const { user } = useAuth()
  const { t } = useTranslation()
  const navigate = useNavigate()

  // OAuth 回流偵測：Google 登入後 Supabase 會帶住 token 落到根目錄。
  //   · PKCE flow → ?code=…（query string）
  //   · 舊 implicit flow → #access_token=…（hash）
  // 兩種都認，喺首次 render（supabase-js 清走之前）capture 住，session 一好就
  // 自動轉去產品 /app。逾時 fallback：避免設定有誤時永遠卡住過場。
  const [oauthReturn] = useState(
    () =>
      typeof window !== 'undefined' &&
      (/[?&]code=/.test(window.location.search) ||
        /[#&]access_token=/.test(window.location.hash)),
  )
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    // 只喺 OAuth 回流時自動轉去產品；正常已登入訪問首頁唔強制彈走。
    if (oauthReturn && user) navigate('/app', { replace: true })
  }, [oauthReturn, user, navigate])

  useEffect(() => {
    if (!oauthReturn) return
    const id = window.setTimeout(() => setTimedOut(true), 8000)
    return () => window.clearTimeout(id)
  }, [oauthReturn])

  // 登入處理中：顯示過場，唔閃住行銷內容（逾時就照常顯示 Landing）。
  if (oauthReturn && !user && !timedOut) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[color:var(--app-bg)] text-slate-600 dark:text-slate-300">
        <Loader2 size={28} strokeWidth={1.75} className="animate-spin text-accent" />
        <p className="text-sm font-medium">{t('signingIn')}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[color:var(--app-bg)] text-slate-900 dark:text-slate-100">
      <Helmet>
        <title>EziTeach 教學易 · 香港教師一站式工作台</title>
        <meta
          name="description"
          content="為香港老師而設的一站式工作台：備課、AI 出題、成績與弱項分析、點名、家長溝通、行政文件。資料在地、雲端同步、適用任何科目。"
        />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="EziTeach 教學易" />
        <meta property="og:title" content="EziTeach 教學易 · 香港教師工作台" />
        <meta
          property="og:description"
          content="備課 · AI 出題 · 成績分析 · 點名 · 家長溝通 —— 老師的日常工作，一個平台搞掂。"
        />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="EziTeach 教學易 · 香港教師工作台" />
        <meta
          name="twitter:description"
          content="備課 · AI 出題 · 成績分析 · 點名 · 家長溝通 —— 老師的日常工作，一個平台搞掂。"
        />
      </Helmet>

      {/* 頂欄 */}
      <header className="border-b border-[color:var(--border)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-sm font-bold text-white">
              E
            </span>
            <span className="text-[15px] font-bold tracking-tight">
              {t('shell.brandName', { defaultValue: '教學易' })}
            </span>
          </div>
          <nav className="flex items-center gap-5 text-sm">
            <Link
              to="/pricing"
              className="font-medium text-slate-500 transition hover:text-accent dark:text-slate-400"
            >
              {t('nav.pricing')}
            </Link>
            <Link
              to="/app"
              className="rounded-lg bg-accent px-4 py-2 font-semibold text-white transition hover:bg-accent-strong"
            >
              {user ? t('nav.enterApp') : t('nav.start')}
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero — 文案 + 真實感產品預覽（Operations Landing pattern） */}
      <section className="mx-auto max-w-6xl px-6 pb-16 pt-16 sm:pt-20">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-1 text-xs font-medium text-slate-500 dark:text-slate-400">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              {t('hero.badge')}
            </span>
            <h1 className="mt-5 text-4xl font-bold leading-[1.12] tracking-tight sm:text-5xl">
              {t('hero.h1pre')}
              <span className="text-accent">{t('hero.h1accent')}</span>
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-500 dark:text-slate-400 sm:text-lg">
              {t('hero.sub')}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/app"
                onClick={() => track('landing_cta_click', { target: 'hero' })}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-7 py-3.5 font-semibold text-white transition hover:bg-accent-strong"
              >
                {user ? t('hero.ctaEnter') : t('hero.ctaStart')}
                <ArrowRight size={18} strokeWidth={2} />
              </Link>
              <Link
                to="/pricing"
                className="inline-flex items-center justify-center rounded-xl border border-[color:var(--border-strong)] px-7 py-3.5 font-semibold text-slate-700 transition hover:border-accent hover:text-accent dark:text-slate-200"
              >
                {t('hero.ctaPricing')}
              </Link>
            </div>
            <p className="mt-3 text-xs text-slate-400">{t('hero.noCard')}</p>
          </div>

          {/* 產品預覽：迷你工作儀表板（純 CSS，鏡像真實介面） */}
          <DashboardPreview />
        </div>
      </section>


      {/* 功能 */}
      <section className="border-t border-[color:var(--border)] bg-[color:var(--surface)]">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
            {t('featuresTitle')}
          </h2>
          <div className="mt-6 grid gap-px overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--border)] sm:grid-cols-2 lg:grid-cols-3">
            {FEATURE_ITEMS.map((f) => {
              const I = f.icon
              return (
                <div
                  key={f.k}
                  className="bg-[color:var(--surface)] p-6 transition hover:bg-[color:var(--surface-2)]"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
                    <I size={20} strokeWidth={1.75} />
                  </span>
                  <h3 className="mt-4 text-base font-semibold">{t(`f.${f.k}Title`)}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                    {t(`f.${f.k}Desc`)}
                  </p>
                </div>
              )
            })}
          </div>

          {/* 信任條 */}
          <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3">
            {TRUST_ITEMS.map((item) => {
              const I = item.icon
              return (
                <div
                  key={item.k}
                  className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400"
                >
                  <I size={16} strokeWidth={1.75} className="text-accent" />
                  {t(`trust.${item.k}`)}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-5xl px-6 py-20 text-center">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {t('ctaTitle')}
        </h2>
        <p className="mt-3 text-slate-500 dark:text-slate-400">{t('ctaSub')}</p>
        <Link
          to="/app"
          onClick={() => track('landing_cta_click', { target: 'footer' })}
          className="mt-7 inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-8 py-3.5 font-semibold text-white transition hover:bg-accent-strong"
        >
          {t('hero.ctaStart')}
          <ArrowRight size={18} strokeWidth={2} />
        </Link>
      </section>

      <footer className="border-t border-[color:var(--border)] py-8 text-center text-xs text-slate-400">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <Link to="/privacy" className="transition hover:text-accent">{t('footer.privacy')}</Link>
          <span aria-hidden>·</span>
          <Link to="/terms" className="transition hover:text-accent">{t('footer.terms')}</Link>
          <span aria-hidden>·</span>
          <Link to="/pricing" className="transition hover:text-accent">{t('footer.pricing')}</Link>
        </div>
        <p className="mt-3">© {new Date().getFullYear()} {t('shell.brandName', { defaultValue: '教學易' })} · {t('footer.copy')}</p>
      </footer>
    </div>
  )
}

// 產品預覽：純 CSS 迷你工作儀表板，鏡像真實 app 介面。純裝飾，aria-hidden。
const PREVIEW_KPIS: { label: string; value: string; unit: string; icon: LucideIcon }[] = [
  { label: '未完成待辦', value: '6', unit: '件', icon: ClipboardList },
  { label: '今日課堂', value: '4', unit: '節', icon: CalendarDays },
  { label: '出席率', value: '97', unit: '%', icon: TrendingUp },
  { label: '待跟進家長', value: '2', unit: '位', icon: MessagesSquare },
]

const PREVIEW_AGENDA: { time: string; label: string; dot: string }[] = [
  { time: '09:15', label: '5A 課堂 · 會計入門', dot: 'bg-accent' },
  { time: '11:00', label: '交 5B 測驗評分', dot: 'bg-amber-400' },
  { time: '14:30', label: '家長會面 · 陳同學', dot: 'bg-rose-400' },
]

function DashboardPreview() {
  return (
    <div aria-hidden className="relative hidden lg:block">
      <div className="overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-lg">
        {/* 視窗列 */}
        <div className="flex items-center gap-1.5 border-b border-[color:var(--border)] bg-[color:var(--surface-2)] px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300 dark:bg-slate-600" />
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300 dark:bg-slate-600" />
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300 dark:bg-slate-600" />
          <span className="ml-3 text-[11px] font-medium text-slate-400">工作儀表板</span>
        </div>

        <div className="space-y-3 p-4">
          {/* hero 條 */}
          <div className="flex items-center justify-between rounded-xl bg-accent px-4 py-3 text-white">
            <div>
              <p className="text-[10px] text-white/70">星期三 · 5 月 7 日</p>
              <p className="text-sm font-bold">早晨，陳老師</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold tabular-nums leading-none">2/4</p>
              <p className="text-[10px] text-white/70">今日課堂</p>
            </div>
          </div>

          {/* KPI 磚 */}
          <div className="grid grid-cols-2 gap-2.5">
            {PREVIEW_KPIS.map((k) => {
              const I = k.icon
              return (
                <div
                  key={k.label}
                  className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-medium text-slate-400">{k.label}</span>
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
                      <I size={13} strokeWidth={1.75} />
                    </span>
                  </div>
                  <p className="mt-1.5 flex items-baseline gap-0.5">
                    <span className="text-xl font-bold tabular-nums text-slate-800 dark:text-slate-100">
                      {k.value}
                    </span>
                    <span className="text-[10px] font-medium text-slate-400">{k.unit}</span>
                  </p>
                </div>
              )
            })}
          </div>

          {/* 今日議程 */}
          <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              今日議程
            </p>
            <ul className="space-y-1.5">
              {PREVIEW_AGENDA.map((a) => (
                <li key={a.time} className="flex items-center gap-2.5">
                  <span className="w-9 text-right text-[10px] font-semibold tabular-nums text-slate-500">
                    {a.time}
                  </span>
                  <span className={`h-1.5 w-1.5 rounded-full ${a.dot}`} />
                  <span className="truncate text-xs text-slate-600 dark:text-slate-300">
                    {a.label}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
