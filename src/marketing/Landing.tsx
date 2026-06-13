import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { motion, useReducedMotion, type Variants } from 'framer-motion'
import {
  ClipboardList,
  FileText,
  TrendingUp,
  CalendarDays,
  MessagesSquare,
  Sparkles,
  Presentation,
  Highlighter,
  Users,
  FolderOpen,
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
//  「作業簿・改簿」風（editorial）：襯線標題、橫間線紙、主題色筆圈重點、
//  「閱」印章、✓ 評改記號。配色全用 token（--accent / --surface …），
//  自動跟 ModeContext 主題色同深／淺色模式；動態用 framer-motion，
//  並尊重「減少動態」(prefers-reduced-motion)。
//  產品入口 '/app'，定價 '/pricing'。
// ============================================================

// icon + i18n key（文案喺 src/i18n）
const FEATURE_ITEMS: { icon: LucideIcon; k: string }[] = [
  { icon: ClipboardList, k: 'prep' }, // 備課與教案
  { icon: FileText, k: 'ai' }, // 出題與教材生成
  { icon: Presentation, k: 'aia' }, // 教學簡報（PowerPoint）
  { icon: Highlighter, k: 'grade' }, // 批改 · 成績 · 評語
  { icon: Users, k: 'att' }, // 班務 · 點名 · 課堂
  { icon: FolderOpen, k: 'comm' }, // 家長 · 行政 · 文件
]

const TRUST_ITEMS: { icon: LucideIcon; k: string }[] = [
  { icon: ShieldCheck, k: 'local' },
  { icon: Cloud, k: 'offline' },
  { icon: FileText, k: 'a11y' },
]

// 手繪感 ✓（評改記號）；color 預設跟主題色。
function PenTick({ className = '', color = 'var(--accent)' }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <path d="M4 13l5 5L20 6" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// 紅筆圈（跟主題色）：橢圓 + 一道底線 swash，雙筆畫由 pathLength 畫出。
function PenCircle({ reduce }: { reduce: boolean }) {
  const draw = (delay: number): Variants => ({
    hidden: { pathLength: reduce ? 1 : 0, opacity: reduce ? 1 : 0 },
    show: {
      pathLength: 1,
      opacity: 1,
      transition: { pathLength: { duration: reduce ? 0 : 0.85, delay: reduce ? 0 : delay, ease: 'easeInOut' }, opacity: { duration: 0.01, delay: reduce ? 0 : delay } },
    },
  })
  return (
    <svg
      viewBox="0 0 300 104"
      preserveAspectRatio="none"
      aria-hidden
      className="pointer-events-none absolute left-[-13px] top-[-10px] h-[calc(100%+22px)] w-[calc(100%+26px)] overflow-visible"
    >
      <motion.path
        d="M40 54 C 10 24, 130 9, 214 13 C 288 17, 298 44, 280 64 C 260 86, 138 94, 70 87 C 18 81, 12 58, 46 44"
        fill="none"
        stroke="var(--accent)"
        strokeWidth={3}
        strokeLinecap="round"
        variants={draw(0.95)}
      />
      <motion.path
        d="M30 96 C 110 89, 198 93, 282 86"
        fill="none"
        stroke="var(--accent)"
        strokeWidth={2.4}
        strokeLinecap="round"
        opacity={0.55}
        variants={draw(1.5)}
      />
    </svg>
  )
}

export default function Landing() {
  const { user } = useAuth()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const reduce = !!useReducedMotion()

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
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[color:var(--app-bg)] text-[color:var(--text-secondary)]">
        <Loader2 size={28} strokeWidth={1.75} className="animate-spin text-accent" />
        <p className="text-sm font-medium">{t('signingIn')}</p>
      </div>
    )
  }

  // 標題受控斷行：第一行到逗號收，第二行（一個平台…+ 重點）整句唔拆。中／英通用。
  const h1pre = t('hero.h1pre')
  const h1accent = t('hero.h1accent')
  const m = h1pre.match(/^(.*?[，,])\s*(.*)$/)
  const line1 = m ? m[1] : h1pre
  const line2pre = m ? m[2] : ''

  // 動態：逐項浮現 + 「減少動態」時即時定格。
  const ease: [number, number, number, number] = [0.22, 1, 0.36, 1]
  const container: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: reduce ? 0 : 0.08, delayChildren: reduce ? 0 : 0.05 } },
  }
  const item: Variants = {
    hidden: { opacity: 0, y: reduce ? 0 : 16 },
    show: { opacity: 1, y: 0, transition: { duration: reduce ? 0 : 0.55, ease } },
  }
  const reveal = { initial: 'hidden', whileInView: 'show', viewport: { once: true, margin: '-80px' } } as const

  return (
    <div className="min-h-screen bg-[color:var(--app-bg)] text-[color:var(--text)]">
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
      <motion.header
        initial={{ opacity: 0, y: reduce ? 0 : -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduce ? 0 : 0.5, ease }}
        className="sticky top-0 z-30 border-b border-[color:var(--border)] bg-[color:var(--app-bg)]/85 backdrop-blur-md"
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent font-serif text-base font-bold text-white shadow-sm">
              E
            </span>
            <span className="font-serif text-[17px] font-bold tracking-tight">
              {t('shell.brandName', { defaultValue: '教學易' })}
            </span>
          </div>
          <nav className="flex items-center gap-5 text-sm">
            <Link
              to="/pricing"
              className="font-medium text-[color:var(--text-secondary)] transition hover:text-accent"
            >
              {t('nav.pricing')}
            </Link>
            <Link
              to="/app"
              className="rounded-full bg-accent px-4 py-2 font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-accent-strong hover:shadow-md"
            >
              {user ? t('nav.enterApp') : t('nav.start')}
            </Link>
          </nav>
        </div>
      </motion.header>

      {/* Hero — 作業簿頁：橫間線 + margin 線 + 主題色筆圈重點 + 印章 */}
      <section className="relative mx-auto max-w-6xl overflow-hidden px-6 pb-20 pt-16 sm:pt-24">
        {/* 極淡主題色光暈（color-mix，深淺色都啱） */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(115% 72% at 88% -10%, color-mix(in srgb, var(--accent) 9%, transparent), transparent 62%)',
          }}
        />
        {/* 作業簿橫間線（跟邊框 token，深淺色自適應） */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'repeating-linear-gradient(to bottom, transparent 0 38px, var(--border) 38px 39px)',
            opacity: 0.65,
          }}
        />
        {/* 左 margin 線（跟主題色）+ 頂部紙釘點 */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-3 w-[2px] sm:left-[58px]"
          style={{ background: 'var(--accent)', opacity: 0.3 }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute left-[7px] top-6 h-2 w-2 rounded-full sm:left-[54px]"
          style={{ background: 'var(--accent)', opacity: 0.55 }}
        />

        <div className="relative grid items-center gap-x-12 gap-y-14 lg:grid-cols-[1.05fr_0.95fr]">
          {/* 文案 */}
          <motion.div variants={container} initial="hidden" animate="show">
            <motion.span
              variants={item}
              className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3.5 py-1.5 font-serif text-sm italic text-accent-strong shadow-xs dark:text-accent"
            >
              <PenTick className="h-[17px] w-[17px]" />
              {t('hero.badge')}
            </motion.span>

            <motion.h1
              variants={item}
              className="mt-6 font-serif text-[2.6rem] font-bold leading-[1.14] tracking-tight sm:text-[3.4rem] sm:leading-[1.1]"
            >
              <span className="block">{line1}</span>
              <span className="block whitespace-normal sm:whitespace-nowrap">
                {line2pre}
                <span className="relative inline-block text-accent">
                  {h1accent}
                  <PenCircle reduce={reduce} />
                </span>
              </span>
            </motion.h1>

            <motion.p
              variants={item}
              className="mt-7 max-w-xl text-base leading-[1.85] text-[color:var(--text-secondary)] sm:text-[17px]"
            >
              {t('hero.sub')}
            </motion.p>

            <motion.div variants={item} className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/app"
                onClick={() => track('landing_cta_click', { target: 'hero' })}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-7 py-3.5 font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-accent-strong hover:shadow-md active:translate-y-0"
              >
                {user ? t('hero.ctaEnter') : t('hero.ctaStart')}
                <ArrowRight size={18} strokeWidth={2} />
              </Link>
              <Link
                to="/pricing"
                className="inline-flex items-center justify-center rounded-full border-2 border-[color:var(--border-strong)] px-7 py-3.5 font-semibold text-[color:var(--text-secondary)] transition hover:-translate-y-0.5 hover:border-accent hover:text-accent"
              >
                {t('hero.ctaPricing')}
              </Link>
            </motion.div>

            <motion.p variants={item} className="mt-5 flex items-center gap-2 font-serif text-sm italic text-[color:var(--text-muted)]">
              <PenTick className="h-[15px] w-[15px]" color="var(--text-muted)" />
              {t('hero.noCard')}
            </motion.p>
          </motion.div>

          {/* 產品預覽：批改過嘅迷你工作儀表板 + 「閱」印章 */}
          <DashboardPreview reduce={reduce} ease={ease} />
        </div>
      </section>

      {/* 功能 */}
      <section className="border-t border-[color:var(--border)] bg-[color:var(--surface)]">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <motion.div {...reveal} variants={item} className="flex items-baseline gap-3">
            <span className="font-serif text-sm italic text-accent">／</span>
            <h2 className="font-serif text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--text-muted)]">
              {t('featuresTitle')}
            </h2>
          </motion.div>
          <motion.div
            {...reveal}
            variants={container}
            className="mt-8 grid gap-px overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--border)] sm:grid-cols-2 lg:grid-cols-3"
          >
            {FEATURE_ITEMS.map((f, i) => {
              const I = f.icon
              return (
                <motion.div
                  key={f.k}
                  variants={item}
                  className="group relative bg-[color:var(--surface)] p-7 transition hover:bg-[color:var(--surface-2)]"
                >
                  <span className="absolute right-5 top-5 font-serif text-sm italic text-[color:var(--text-muted)]/70">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent-strong transition group-hover:scale-105 dark:bg-accent/15 dark:text-accent">
                    <I size={21} strokeWidth={1.75} />
                  </span>
                  <h3 className="mt-5 font-serif text-lg font-bold">{t(`f.${f.k}Title`)}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[color:var(--text-secondary)]">
                    {t(`f.${f.k}Desc`)}
                  </p>
                </motion.div>
              )
            })}
          </motion.div>

          {/* 仲有更多：長尾功能標籤雲（忠實反映 registry 真實功能） */}
          <motion.div {...reveal} variants={item} className="mt-7">
            <div className="flex items-center gap-2 font-serif text-sm italic text-accent">
              <Sparkles size={16} strokeWidth={1.75} />
              {t('f.moreTitle')}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {t('f.more')
                .split(/[、,]/)
                .map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-[color:var(--border)] bg-[color:var(--app-bg)] px-3 py-1 text-xs text-[color:var(--text-secondary)] transition hover:border-accent hover:text-accent"
                  >
                    {tag.trim()}
                  </span>
                ))}
            </div>
          </motion.div>

          {/* 信任條 */}
          <motion.div {...reveal} variants={container} className="mt-9 flex flex-wrap gap-x-8 gap-y-3">
            {TRUST_ITEMS.map((it) => {
              const I = it.icon
              return (
                <motion.div
                  key={it.k}
                  variants={item}
                  className="flex items-center gap-2 text-sm text-[color:var(--text-secondary)]"
                >
                  <I size={16} strokeWidth={1.75} className="text-accent" />
                  {t(`trust.${it.k}`)}
                </motion.div>
              )
            })}
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <motion.section {...reveal} variants={item} className="relative mx-auto max-w-5xl overflow-hidden px-6 py-24 text-center">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'repeating-linear-gradient(to bottom, transparent 0 38px, var(--border) 38px 39px)',
            opacity: 0.4,
          }}
        />
        <div className="relative">
          <h2 className="font-serif text-3xl font-bold tracking-tight sm:text-4xl">{t('ctaTitle')}</h2>
          <p className="mt-4 text-[color:var(--text-secondary)]">{t('ctaSub')}</p>
          <Link
            to="/app"
            onClick={() => track('landing_cta_click', { target: 'footer' })}
            className="mt-8 inline-flex items-center justify-center gap-2 rounded-full bg-accent px-8 py-4 font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-accent-strong hover:shadow-md"
          >
            {t('hero.ctaStart')}
            <ArrowRight size={18} strokeWidth={2} />
          </Link>
        </div>
      </motion.section>

      <footer className="border-t border-[color:var(--border)] py-8 text-center text-xs text-[color:var(--text-muted)]">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <Link to="/privacy" className="transition hover:text-accent">{t('footer.privacy')}</Link>
          <span aria-hidden>·</span>
          <Link to="/terms" className="transition hover:text-accent">{t('footer.terms')}</Link>
          <span aria-hidden>·</span>
          <Link to="/guidelines" className="transition hover:text-accent">{t('footer.guidelines')}</Link>
          <span aria-hidden>·</span>
          <Link to="/pricing" className="transition hover:text-accent">{t('footer.pricing')}</Link>
        </div>
        <p className="mt-3">© {new Date().getFullYear()} {t('shell.brandName', { defaultValue: '教學易' })} · {t('footer.copy')}</p>
      </footer>
    </div>
  )
}

// 產品預覽：純 CSS 迷你工作儀表板，鏡像真實 app 介面，加咗「改簿」記號。純裝飾，aria-hidden。
const PREVIEW_KPIS: { label: string; value: string; unit: string; icon: LucideIcon; tint?: string }[] = [
  { label: '未完成待辦', value: '6', unit: '件', icon: ClipboardList },
  { label: '今日課堂', value: '4', unit: '節', icon: CalendarDays },
  { label: '出席率', value: '97', unit: '%', icon: TrendingUp, tint: 'var(--success)' },
  { label: '待跟進家長', value: '2', unit: '位', icon: MessagesSquare },
]

const PREVIEW_AGENDA: { time: string; label: string; tick: string }[] = [
  { time: '09:15', label: '5A 課堂 · 會計入門', tick: 'var(--success)' },
  { time: '11:00', label: '交 5B 測驗評分', tick: 'var(--accent)' },
  { time: '14:30', label: '家長會面 · 陳同學', tick: 'var(--warning)' },
]

function DashboardPreview({ reduce, ease }: { reduce: boolean; ease: [number, number, number, number] }) {
  return (
    <motion.div
      aria-hidden
      initial={{ opacity: 0, y: reduce ? 0 : 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0 : 0.7, delay: reduce ? 0 : 0.45, ease }}
      className="relative hidden lg:block"
    >
      <div className="overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-overlay">
        {/* 視窗列 */}
        <div className="flex items-center gap-1.5 border-b border-[color:var(--border)] bg-[color:var(--surface-2)] px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--border-strong)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--border-strong)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--border-strong)]" />
          <span className="ml-3 font-serif text-[12px] italic text-[color:var(--text-muted)]">工作儀表板</span>
        </div>

        <div className="space-y-3 p-4">
          {/* hero 條 */}
          <div className="flex items-center justify-between rounded-xl bg-accent px-4 py-3.5 text-white">
            <div>
              <p className="text-[10px] text-white/70">星期三 · 5 月 7 日</p>
              <p className="font-serif text-[15px] font-bold">早晨，陳老師</p>
            </div>
            <div className="text-right">
              <p className="font-serif text-xl font-bold leading-none">2/4</p>
              <p className="mt-0.5 text-[10px] text-white/70">今日課堂</p>
            </div>
          </div>

          {/* KPI 磚 */}
          <div className="grid grid-cols-2 gap-2.5">
            {PREVIEW_KPIS.map((k) => {
              const I = k.icon
              return (
                <div
                  key={k.label}
                  className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-3 transition hover:border-[color:var(--border-strong)]"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-medium text-[color:var(--text-muted)]">{k.label}</span>
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
                      <I size={13} strokeWidth={1.75} />
                    </span>
                  </div>
                  <p className="mt-2 flex items-baseline gap-0.5">
                    <span
                      className="font-serif text-2xl font-bold leading-none"
                      style={k.tint ? { color: k.tint } : { color: 'var(--text)' }}
                    >
                      {k.value}
                    </span>
                    <span className="text-[10px] font-medium text-[color:var(--text-muted)]">{k.unit}</span>
                  </p>
                </div>
              )
            })}
          </div>

          {/* 今日議程 */}
          <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-3.5">
            <p className="mb-2.5 font-serif text-[11px] italic text-[color:var(--text-muted)]">今日議程</p>
            <ul className="space-y-2">
              {PREVIEW_AGENDA.map((a) => (
                <li key={a.time} className="flex items-center gap-2.5">
                  <span className="w-9 text-right font-serif text-[11px] font-semibold text-[color:var(--text-secondary)]">
                    {a.time}
                  </span>
                  <PenTick className="h-[15px] w-[15px] flex-none" color={a.tick} />
                  <span className="truncate text-xs text-[color:var(--text-secondary)]">{a.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* 「閱」印章：蓋喺卡右下角，半露出、旋轉 */}
      <motion.div
        aria-hidden
        initial={{ scale: reduce ? 1 : 1.7, opacity: 0, rotate: -34 }}
        animate={{ scale: 1, opacity: 0.92, rotate: -12 }}
        transition={reduce ? { duration: 0 } : { delay: 1.6, type: 'spring', stiffness: 260, damping: 13 }}
        className="absolute -bottom-5 -right-3 grid h-[78px] w-[78px] place-items-center rounded-full border-[3px] border-double text-accent"
        style={{ borderColor: 'var(--accent)', background: 'color-mix(in srgb, var(--surface) 86%, transparent)' }}
      >
        <span className="font-serif text-3xl font-black">閱</span>
      </motion.div>
    </motion.div>
  )
}
