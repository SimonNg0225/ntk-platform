import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { motion, useReducedMotion, type Variants } from 'framer-motion'
import {
  ArrowRight,
  BarChart3,
  Bell,
  BookOpenCheck,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Cloud,
  FileText,
  FolderOpen,
  Highlighter,
  Loader2,
  MessageSquareText,
  Presentation,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Users,
  WandSparkles,
  type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { COMPANY } from '../lib/companyInfo'
import { useAuth } from '../context/AuthContext'
import { track } from '../lib/observability'
import { BRAND_NAME, BRAND_FULL_ZH, BRAND_TAGLINE_ZH } from '../lib/brand'

// ============================================================
//  EziTeach AI Landing — full-bleed workspace story
//  ------------------------------------------------------------
//  首屏不再用左右分欄白卡；改成產品工作台場景做背景，文案直接疊在
//  full-bleed 畫面上。下方按「問題 → 工作流 → 功能 → 信任 → CTA」
//  串成完整轉化敘事。所有互動目標維持 44px+，並尊重 reduced motion。
// ============================================================

const FEATURE_ITEMS: { icon: LucideIcon; k: string }[] = [
  { icon: ClipboardList, k: 'prep' },
  { icon: FileText, k: 'ai' },
  { icon: Presentation, k: 'aia' },
  { icon: Highlighter, k: 'grade' },
  { icon: Users, k: 'att' },
  { icon: FolderOpen, k: 'comm' },
]

const WORKFLOW_ITEMS: { icon: LucideIcon; k: string; tone: string }[] = [
  { icon: BookOpenCheck, k: 'before', tone: 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300' },
  { icon: Bell, k: 'during', tone: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300' },
  { icon: BarChart3, k: 'after', tone: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
]

const PROOF_ITEMS: { icon: LucideIcon; k: string }[] = [
  { icon: Users, k: 'solo' },
  { icon: ShieldCheck, k: 'privacy' },
  { icon: Cloud, k: 'portable' },
]

const HERO_STATS = ['time', 'tools', 'solo'] as const
const SCENE_ROWS = ['prep', 'quiz', 'slides', 'marking', 'parents'] as const
const TOOL_PILLS = ['備課', 'AI 出題', '成績分析', '點名', '家長訊息', '文件速讀', '掃描 PDF', '會議轉錄']

export default function Landing() {
  const { user } = useAuth()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const reduce = !!useReducedMotion()

  const [oauthReturn] = useState(
    () =>
      typeof window !== 'undefined' &&
      (/[?&]code=/.test(window.location.search) ||
        /[#&]access_token=/.test(window.location.hash)),
  )
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    if (oauthReturn && user) navigate('/app', { replace: true })
  }, [oauthReturn, user, navigate])

  useEffect(() => {
    if (!oauthReturn) return
    const id = window.setTimeout(() => setTimedOut(true), 8000)
    return () => window.clearTimeout(id)
  }, [oauthReturn])

  if (oauthReturn && !user && !timedOut) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[color:var(--app-bg)] text-[color:var(--text-secondary)]">
        <Loader2 size={28} strokeWidth={1.75} className="animate-spin text-accent" />
        <p className="text-sm font-medium">{t('signingIn')}</p>
      </div>
    )
  }

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
        <title>{BRAND_FULL_ZH}</title>
        <meta
          name="description"
          content="EziTeach AI 是香港老師的 AI 工作台：個人老師可先免費使用，備課、AI 出題、成績與弱項分析、點名、家長溝通、行政文件一個地方完成。"
        />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content={BRAND_NAME} />
        <meta property="og:title" content={BRAND_FULL_ZH} />
        <meta
          property="og:description"
          content="一位老師都開得起：備課 · AI 出題 · 成績分析 · 點名 · 家長溝通，由備課到回饋一條龍。"
        />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content={BRAND_FULL_ZH} />
        <meta
          name="twitter:description"
          content="一位老師都開得起：備課 · AI 出題 · 成績分析 · 點名 · 家長溝通，由備課到回饋一條龍。"
        />
      </Helmet>

      <motion.header
        initial={{ opacity: 0, y: reduce ? 0 : -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduce ? 0 : 0.5, ease }}
        className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/85"
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link
            to="/"
            className="flex min-h-11 cursor-pointer items-center gap-3 rounded-full pr-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            aria-label={BRAND_NAME}
          >
            <img src="/favicon.svg" alt="" className="h-11 w-11 rounded-2xl shadow-sm" />
            <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
              {BRAND_NAME}
            </span>
          </Link>
          <nav className="flex items-center gap-2 text-sm sm:gap-3">
            <a
              href="#workflow"
              className="hidden min-h-11 cursor-pointer items-center rounded-full px-3 font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white sm:inline-flex"
            >
              {t('landingNav.workflow')}
            </a>
            <a
              href="#features"
              className="hidden min-h-11 cursor-pointer items-center rounded-full px-3 font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white md:inline-flex"
            >
              {t('landingNav.features')}
            </a>
            <Link
              to="/pricing"
              className="inline-flex min-h-11 cursor-pointer items-center rounded-full px-3 font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              {t('nav.pricing')}
            </Link>
            <Link
              to="/app"
              className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full bg-[color:var(--accent)] px-4 font-semibold text-white shadow-sm shadow-indigo-500/20 transition hover:-translate-y-0.5 hover:bg-[color:var(--accent-strong)] hover:shadow-md hover:shadow-indigo-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:translate-y-0"
            >
              {user ? t('nav.enterApp') : t('nav.start')}
            </Link>
          </nav>
        </div>
      </motion.header>

      <main>
        <section className="relative isolate overflow-hidden border-b border-indigo-100/80 bg-[#f5f8ff] dark:border-slate-800 dark:bg-slate-950">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-80 dark:opacity-30"
            style={{
              backgroundImage:
                'linear-gradient(rgba(79,70,229,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(14,165,233,0.08) 1px, transparent 1px)',
              backgroundSize: '44px 44px',
              maskImage: 'linear-gradient(to bottom, #000 0%, #000 62%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to bottom, #000 0%, #000 62%, transparent 100%)',
            }}
          />

          <div className="relative z-10 mx-auto flex max-w-7xl items-center px-4 py-12 sm:px-6 sm:py-16 lg:min-h-[calc(100svh-5rem)] lg:px-8 lg:py-0">
            <motion.div
              variants={container}
              initial="hidden"
              animate="show"
              className="max-w-2xl lg:max-w-[32rem] xl:max-w-[34rem]"
            >
              <motion.span
                variants={item}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-indigo-200 bg-white/85 px-3.5 text-sm font-semibold text-indigo-800 shadow-sm backdrop-blur dark:border-indigo-400/20 dark:bg-slate-900/80 dark:text-indigo-200"
              >
                <CheckCircle2 size={17} strokeWidth={2} />
                {t('hero.badge')}
              </motion.span>

              <motion.h1
                variants={item}
                aria-label={t('hero.h1Title')}
                className="mt-6 max-w-2xl text-4xl font-black leading-[1.02] tracking-tight text-slate-950 sm:text-6xl lg:text-[4.25rem] xl:text-[4.75rem] dark:text-white"
              >
                <span className="block">{t('hero.h1Line1')}</span>
                <span className="block">{t('hero.h1Line2')}</span>
              </motion.h1>

              <motion.p
                variants={item}
                className="mt-6 max-w-[32rem] text-lg leading-8 text-slate-700 sm:text-xl dark:text-slate-300"
              >
                {t('hero.sub')}
              </motion.p>

              <motion.div variants={item} className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link
                  to="/app"
                  onClick={() => track('landing_cta_click', { target: 'hero' })}
                  className="inline-flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-full bg-[color:var(--accent)] px-7 text-base font-bold text-white shadow-lg shadow-indigo-500/20 transition hover:-translate-y-0.5 hover:bg-[color:var(--accent-strong)] hover:shadow-xl hover:shadow-indigo-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:translate-y-0"
                >
                  {user ? t('hero.ctaEnter') : t('hero.ctaStart')}
                  <ArrowRight size={19} strokeWidth={2.25} />
                </Link>
                <Link
                  to="/pricing"
                  className="inline-flex min-h-14 cursor-pointer items-center justify-center rounded-full border border-slate-300 bg-white/80 px-7 text-base font-bold text-slate-800 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:border-slate-400 hover:bg-white hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:translate-y-0 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-100 dark:hover:bg-slate-900"
                >
                  {t('hero.ctaPricing')}
                </Link>
              </motion.div>

              <motion.div variants={item} className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-600 dark:text-slate-300">
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck size={16} className="text-[color:var(--accent-strong)] dark:text-accent" />
                  {t('hero.noCard')}
                </span>
              </motion.div>

              <motion.div variants={container} className="mt-9 grid max-w-xl grid-cols-3 gap-2 sm:gap-3">
                {HERO_STATS.map((k) => (
                  <motion.div
                    key={k}
                    variants={item}
                    className="rounded-2xl border border-white/80 bg-white/80 p-3 shadow-sm backdrop-blur dark:border-slate-700/80 dark:bg-slate-900/70"
                  >
                    <p className="text-xl font-black tabular-nums text-slate-950 dark:text-white">
                      {t(`hero.stats.${k}.value`)}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                      {t(`hero.stats.${k}.label`)}
                    </p>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
          </div>

          <WorkspaceScene reduce={reduce} ease={ease} />
        </section>

        <section id="workflow" className="bg-white py-20 dark:bg-slate-950 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <motion.div {...reveal} variants={container} className="grid gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:items-start">
              <motion.div variants={item}>
                <span className="text-sm font-bold uppercase tracking-[0.2em] text-amber-600 dark:text-amber-300">
                  {t('workflow.eyebrow')}
                </span>
                <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl dark:text-white">
                  {t('workflow.title')}
                </h2>
                <p className="mt-4 text-base leading-8 text-slate-600 dark:text-slate-300">
                  {t('workflow.sub')}
                </p>
              </motion.div>

              <motion.div variants={container} className="grid gap-3 md:grid-cols-3">
                {WORKFLOW_ITEMS.map((step, index) => {
                  const Icon = step.icon
                  return (
                    <motion.article
                      key={step.k}
                      variants={item}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-5 transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${step.tone}`}>
                          <Icon size={22} strokeWidth={1.85} />
                        </span>
                        <span className="font-mono text-sm font-bold text-slate-300 dark:text-slate-600">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                      </div>
                      <h3 className="mt-5 text-lg font-bold text-slate-950 dark:text-white">
                        {t(`workflow.${step.k}.title`)}
                      </h3>
                      <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">
                        {t(`workflow.${step.k}.desc`)}
                      </p>
                    </motion.article>
                  )
                })}
              </motion.div>
            </motion.div>
          </div>
        </section>

        <section id="features" className="border-y border-slate-200 bg-slate-50 py-20 dark:border-slate-800 dark:bg-slate-900/55 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <motion.div {...reveal} variants={item} className="max-w-2xl">
              <span className="text-sm font-bold uppercase tracking-[0.2em] text-sky-700 dark:text-sky-300">
                {t('featuresTitle')}
              </span>
              <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl dark:text-white">
                {t('featuresHeadline')}
              </h2>
            </motion.div>

            <motion.div {...reveal} variants={container} className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURE_ITEMS.map((feature, index) => {
                const Icon = feature.icon
                return (
                  <motion.article
                    key={feature.k}
                    variants={item}
                    className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-950/70 dark:hover:border-slate-700"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700 transition group-hover:bg-indigo-600 group-hover:text-white dark:bg-indigo-500/15 dark:text-indigo-300 dark:group-hover:bg-indigo-500 dark:group-hover:text-white">
                        <Icon size={22} strokeWidth={1.85} />
                      </span>
                      <span className="font-mono text-sm font-bold text-slate-300 dark:text-slate-600">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                    </div>
                    <h3 className="mt-5 text-lg font-bold text-slate-950 dark:text-white">
                      {t(`f.${feature.k}Title`)}
                    </h3>
                    <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">
                      {t(`f.${feature.k}Desc`)}
                    </p>
                  </motion.article>
                )
              })}
            </motion.div>

            <motion.div {...reveal} variants={item} className="mt-8 flex flex-wrap gap-2">
              {TOOL_PILLS.map((tool) => (
                <span
                  key={tool}
                  className="inline-flex min-h-9 items-center rounded-full border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
                >
                  {tool}
                </span>
              ))}
            </motion.div>
          </div>
        </section>

        <section className="bg-white py-20 dark:bg-slate-950 sm:py-24">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
            <motion.div {...reveal} variants={item} className="rounded-3xl bg-indigo-950 p-7 text-white shadow-overlay shadow-indigo-500/10 dark:bg-slate-900">
              <div className="flex items-center gap-2 text-sm font-bold text-amber-200">
                <Sparkles size={17} strokeWidth={1.8} />
                {t('proof.eyebrow')}
              </div>
              <blockquote className="mt-5 text-2xl font-black leading-tight tracking-tight sm:text-3xl">
                {t('proof.quote')}
              </blockquote>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-300">
                {t('proof.quoteBy')}
              </p>
            </motion.div>

            <motion.div {...reveal} variants={container} className="grid gap-3">
              {PROOF_ITEMS.map((proof) => {
                const Icon = proof.icon
                return (
                  <motion.div
                    key={proof.k}
                    variants={item}
                    className="flex min-h-24 items-start gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900/70"
                  >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
                      <Icon size={21} strokeWidth={1.85} />
                    </span>
                    <div>
                      <h3 className="text-base font-bold text-slate-950 dark:text-white">
                        {t(`proof.${proof.k}.title`)}
                      </h3>
                      <p className="mt-1 text-sm leading-7 text-slate-600 dark:text-slate-300">
                        {t(`proof.${proof.k}.desc`)}
                      </p>
                    </div>
                  </motion.div>
                )
              })}
            </motion.div>
          </div>
        </section>

        <motion.section
          {...reveal}
          variants={item}
          className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 sm:pb-24 lg:px-8"
        >
          <div className="relative overflow-hidden rounded-3xl bg-[color:var(--accent)] px-6 py-12 text-center text-white shadow-overlay shadow-indigo-500/20 sm:px-10 sm:py-16">
            <div
              aria-hidden="true"
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage:
                  'linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)',
                backgroundSize: '32px 32px',
              }}
            />
            <div className="relative mx-auto max-w-3xl">
              <h2 className="text-3xl font-black tracking-tight sm:text-5xl">{t('ctaTitle')}</h2>
              <p className="mt-4 text-base leading-8 text-indigo-50 sm:text-lg">{t('ctaSub')}</p>
              <Link
                to="/app"
                onClick={() => track('landing_cta_click', { target: 'footer' })}
                className="mt-8 inline-flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-full bg-white px-8 text-base font-black text-[color:var(--accent-strong)] shadow-sm transition hover:-translate-y-0.5 hover:bg-indigo-50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white active:translate-y-0"
              >
                {t('hero.ctaStart')}
                <ArrowRight size={19} strokeWidth={2.25} />
              </Link>
            </div>
          </div>
        </motion.section>
      </main>

      <footer className="border-t border-slate-200 bg-white py-8 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <Link to="/privacy" className="transition hover:text-accent">{t('footer.privacy')}</Link>
          <span aria-hidden="true">·</span>
          <Link to="/terms" className="transition hover:text-accent">{t('footer.terms')}</Link>
          <span aria-hidden="true">·</span>
          <Link to="/guidelines" className="transition hover:text-accent">{t('footer.guidelines')}</Link>
          <span aria-hidden="true">·</span>
          <Link to="/pricing" className="transition hover:text-accent">{t('footer.pricing')}</Link>
        </div>
        <p className="mt-3">© {new Date().getFullYear()} {BRAND_NAME} · {BRAND_TAGLINE_ZH}</p>
        <p className="mt-1">
          {COMPANY.legalName ? (
            <>
              {COMPANY.legalName}
              {COMPANY.brNumber ? ` · 商業登記證 ${COMPANY.brNumber}` : ''}
              {' · '}
            </>
          ) : null}
          <a className="transition hover:text-accent" href={`mailto:${COMPANY.supportEmail}`}>
            {COMPANY.supportEmail}
          </a>
        </p>
      </footer>
    </div>
  )
}

function WorkspaceScene({ reduce, ease }: { reduce: boolean; ease: [number, number, number, number] }) {
  return (
    <motion.div
      aria-hidden="true"
      initial={{ opacity: 0, y: reduce ? 0 : 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0 : 0.75, delay: reduce ? 0 : 0.2, ease }}
      className="pointer-events-none relative z-0 mx-auto h-[430px] max-w-7xl px-4 pb-10 sm:h-[500px] sm:px-6 lg:absolute lg:inset-y-0 lg:right-0 lg:h-auto lg:w-[56%] lg:max-w-none lg:p-0"
    >
      <div className="absolute inset-x-4 top-2 h-[410px] rounded-[2rem] border border-white/80 bg-white/58 shadow-overlay backdrop-blur-md dark:border-slate-700/70 dark:bg-slate-900/58 sm:top-6 sm:h-[450px] lg:left-8 lg:right-12 lg:top-28 lg:h-[520px]" />

      <div className="absolute left-8 right-8 top-8 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900 sm:left-14 sm:right-20 sm:top-14 lg:left-16 lg:right-24 lg:top-36">
        <div className="flex min-h-14 items-center gap-3 border-b border-slate-200 bg-slate-950 px-4 text-white dark:border-slate-700">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
            <WandSparkles size={18} />
          </span>
          <div>
            <p className="text-sm font-bold">{'今日工作台'}</p>
            <p className="text-[11px] text-white/55">{'5 個任務 · 32 本待批改'}</p>
          </div>
          <span className="ml-auto rounded-full bg-sky-400/20 px-3 py-1 text-xs font-bold text-sky-100">
            {'同步中'}
          </span>
        </div>

        <div className="grid gap-0 md:grid-cols-[1fr_0.82fr]">
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {SCENE_ROWS.map((row, index) => (
              <div key={row} className="flex min-h-16 items-center gap-3 px-4 py-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  {index === 0 ? <BookOpenCheck size={18} /> : null}
                  {index === 1 ? <FileText size={18} /> : null}
                  {index === 2 ? <Presentation size={18} /> : null}
                  {index === 3 ? <Highlighter size={18} /> : null}
                  {index === 4 ? <MessageSquareText size={18} /> : null}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">
                    {row === 'prep' ? '中三商業環境教案' : null}
                    {row === 'quiz' ? 'DSE 個案題 12 題' : null}
                    {row === 'slides' ? '課堂簡報草稿' : null}
                    {row === 'marking' ? '短答批改隊列' : null}
                    {row === 'parents' ? '家長跟進訊息' : null}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-slate-400 dark:text-slate-500">
                    {row === 'prep' ? 'AI 已整理重點、活動、常見誤解' : null}
                    {row === 'quiz' ? '連評分準則與參考答案' : null}
                    {row === 'slides' ? '封面與版式已配好' : null}
                    {row === 'marking' ? '今日已改 32 本' : null}
                    {row === 'parents' ? '可先覆核再發送' : null}
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {index === 3 ? '進行中' : '已準備'}
                </span>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40 md:border-l md:border-t-0">
            <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 dark:border-sky-500/20 dark:bg-sky-500/10">
              <div className="flex items-center gap-2 text-sm font-bold text-sky-900 dark:text-sky-200">
                <BarChart3 size={17} />
                {'全班弱項'}
              </div>
              <div className="mt-4 space-y-3">
                {['現金流', '折舊', '市場定位'].map((label, index) => (
                  <div key={label}>
                    <div className="mb-1 flex justify-between text-xs font-semibold text-slate-600 dark:text-slate-300">
                      <span>{label}</span>
                      <span>{[68, 52, 41][index]}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white dark:bg-slate-800">
                      <div
                        className="h-full rounded-full bg-sky-500"
                        style={{ width: `${[68, 52, 41][index]}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/20 dark:bg-amber-500/10">
              <div className="flex items-center gap-2 text-sm font-bold text-amber-900 dark:text-amber-200">
                <Clock3 size={17} />
                {'下堂前 18 分鐘'}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-amber-900/75 dark:text-amber-100/70">
                {'已把教案、簡報、工作紙放入同一個課堂包。'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-8 left-7 hidden w-56 rotate-[-3deg] rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sky-950 shadow-lg dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-100 sm:block lg:bottom-24 lg:left-0">
        <div className="flex items-center gap-2 text-sm font-black">
          <CheckCircle2 size={17} />
          {'學生資料先遮蔽'}
        </div>
        <p className="mt-2 text-xs leading-relaxed opacity-75">
          {'輸入前提示老師用代號，AI 初稿再由老師覆核。'}
        </p>
      </div>

      <div className="absolute bottom-5 right-8 hidden w-64 rotate-[2deg] rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-indigo-950 shadow-lg dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-100 sm:block lg:bottom-16 lg:right-8">
        <div className="flex items-center gap-2 text-sm font-black">
          <ScanLine size={17} />
          {'掃描入庫'}
        </div>
        <p className="mt-2 text-xs leading-relaxed opacity-75">
          {'PDF、相片、錄音和筆記都可整理成可搜尋資料。'}
        </p>
      </div>
    </motion.div>
  )
}
