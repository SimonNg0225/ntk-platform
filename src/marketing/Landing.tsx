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
  CirclePlus,
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
//  EziTeach AI Landing — late-night teacher workspace story
//  ------------------------------------------------------------
//  首屏以「老師深夜備課」痛點切入，視覺方向對齊 launch-grid
//  的深色、青色、玻璃感 AI 面板。下方按「問題 → 工作流 → 功能
//  → 信任 → CTA」串成完整轉化敘事。所有互動目標維持 44px+，
//  並尊重 reduced motion。
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

const USE_CASE_ITEMS: { icon: LucideIcon; k: string; tone: string }[] = [
  { icon: BookOpenCheck, k: 'nextLesson', tone: 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300' },
  { icon: Presentation, k: 'materials', tone: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300' },
  { icon: Highlighter, k: 'marking', tone: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
  { icon: MessageSquareText, k: 'admin', tone: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
]

const FAQ_ITEMS = ['school', 'studentData', 'subjects', 'pricing', 'export', 'aiReview'] as const
const HERO_STATS = ['time', 'tools', 'solo'] as const
const SCENE_ROWS = ['prep', 'quiz', 'slides', 'marking', 'parents'] as const
const TOOL_PILLS = ['prep', 'teachingAI', 'lessonPlan', 'materials', 'slides', 'gradeAnalytics', 'scan', 'transcribe'] as const

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
          content={t('landingMeta.description')}
        />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content={BRAND_NAME} />
        <meta property="og:title" content={BRAND_FULL_ZH} />
        <meta
          property="og:description"
          content={t('landingMeta.socialDescription')}
        />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content={BRAND_FULL_ZH} />
        <meta
          name="twitter:description"
          content={t('landingMeta.socialDescription')}
        />
      </Helmet>

      <motion.header
        initial={{ opacity: 0, y: reduce ? 0 : -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduce ? 0 : 0.5, ease }}
        className="sticky top-0 z-40 border-b border-white/10 bg-[#070b18]/90 backdrop-blur-xl"
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link
            to="/"
            className="flex min-h-11 cursor-pointer items-center gap-3 rounded-full bg-white/10 py-1 pl-1 pr-4 shadow-sm shadow-black/20 ring-1 ring-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70"
            aria-label={BRAND_NAME}
          >
            <img src="/favicon.svg" alt="" className="h-9 w-9 rounded-full shadow-sm shadow-black/30" />
            <span className="text-lg font-bold text-white">
              {BRAND_NAME}
            </span>
          </Link>
          <nav className="flex items-center gap-2 text-sm sm:gap-3">
            <a
              href="#workflow"
              className="hidden min-h-11 cursor-pointer items-center rounded-full px-3 font-medium text-slate-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 sm:inline-flex"
            >
              {t('landingNav.workflow')}
            </a>
            <a
              href="#features"
              className="hidden min-h-11 cursor-pointer items-center rounded-full px-3 font-medium text-slate-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 md:inline-flex"
            >
              {t('landingNav.features')}
            </a>
            <a
              href="#faq"
              className="hidden min-h-11 cursor-pointer items-center rounded-full px-3 font-medium text-slate-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 lg:inline-flex"
            >
              {t('landingNav.faq')}
            </a>
            <Link
              to="/pricing"
              className="inline-flex min-h-11 cursor-pointer items-center rounded-full px-3 font-semibold text-slate-200 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70"
            >
              {t('nav.pricing')}
            </Link>
            <Link
              to="/app"
              className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full bg-[#5b4dff] px-4 font-semibold text-white shadow-sm shadow-indigo-500/30 transition hover:-translate-y-0.5 hover:bg-[#6c63ff] hover:shadow-md hover:shadow-indigo-500/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 active:translate-y-0"
            >
              {user ? t('nav.enterApp') : t('nav.start')}
            </Link>
          </nav>
        </div>
      </motion.header>

      <main>
        <section className="relative isolate overflow-hidden border-b border-white/10 bg-[#070b18] text-white">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.45]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(34,211,238,0.09) 1px, transparent 1px), linear-gradient(90deg, rgba(129,140,248,0.08) 1px, transparent 1px)',
              backgroundSize: '46px 46px',
              maskImage: 'linear-gradient(to bottom, transparent 0%, #000 14%, #000 72%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, #000 14%, #000 72%, transparent 100%)',
            }}
          />
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_78%,rgba(34,211,238,0.22),transparent_26%),radial-gradient(circle_at_82%_16%,rgba(91,77,255,0.42),transparent_32%),linear-gradient(120deg,rgba(7,11,24,0.96)_0%,rgba(8,14,32,0.92)_46%,rgba(24,24,76,0.88)_100%)]" />
          <div aria-hidden="true" className="pointer-events-none absolute bottom-[-18rem] left-[-10rem] h-[36rem] w-[36rem] rounded-full bg-cyan-400/15 blur-3xl" />
          <div aria-hidden="true" className="pointer-events-none absolute bottom-[-12rem] right-[-8rem] h-[30rem] w-[30rem] rounded-full bg-indigo-500/30 blur-3xl" />

          <div className="relative z-10 mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 sm:py-14 md:grid-cols-[0.86fr_1.14fr] md:items-center lg:min-h-[calc(88svh-4.5rem)] lg:px-8 lg:py-0">
            <motion.div
              variants={container}
              initial="hidden"
              animate="show"
              className="max-w-2xl lg:max-w-[34rem] xl:max-w-[36rem]"
            >
              <motion.span
                variants={item}
                className="inline-flex min-h-11 items-center gap-3 rounded-full bg-white/[0.12] py-1 pl-1.5 pr-5 text-sm font-bold text-white shadow-lg shadow-black/20 ring-1 ring-white/10 backdrop-blur-md"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#5b4dff] text-white shadow-sm shadow-indigo-500/40">
                  <CirclePlus size={21} strokeWidth={2.6} />
                </span>
                {BRAND_NAME}
              </motion.span>

              <motion.p
                variants={item}
                className="mt-10 text-2xl font-black text-cyan-300 sm:text-3xl lg:mt-14"
              >
                {t('hero.painLabel')}
              </motion.p>

              <motion.h1
                variants={item}
                aria-label={t('hero.h1Title')}
                className="mt-7 max-w-3xl text-[2.55rem] font-black leading-[1.1] text-white sm:text-[3.7rem] lg:text-[4.25rem] xl:text-[4.7rem]"
              >
                <span className="block">{t('hero.h1Line1')}</span>
                <span className="block">
                  {t('hero.h1Line2')}
                  <span className="sm:hidden">
                    <br />
                  </span>
                  <span className="hidden sm:inline">{t('hero.h1Joiner')}</span>
                  {t('hero.h1Line3')}
                </span>
              </motion.h1>

              <motion.div
                variants={item}
                className="mt-7 h-2 w-72 max-w-full rounded-full bg-cyan-300 shadow-[0_0_28px_rgba(34,211,238,0.6)]"
              />

              <motion.p
                variants={item}
                className="mt-8 max-w-[34rem] text-xl font-bold leading-9 text-slate-200 sm:text-2xl sm:leading-10"
              >
                {t('hero.sub')}
              </motion.p>

              <motion.div variants={item} className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link
                  to="/app"
                  onClick={() => track('landing_cta_click', { target: 'hero' })}
                  className="inline-flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-full bg-[#5b4dff] px-7 text-base font-bold text-white shadow-lg shadow-indigo-500/30 transition hover:-translate-y-0.5 hover:bg-[#6c63ff] hover:shadow-xl hover:shadow-indigo-500/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 active:translate-y-0"
                >
                  {user ? t('hero.ctaEnter') : t('hero.ctaStart')}
                  <ArrowRight size={19} strokeWidth={2.25} />
                </Link>
                <Link
                  to="/pricing"
                  className="inline-flex min-h-14 cursor-pointer items-center justify-center rounded-full border border-white/15 bg-white/10 px-7 text-base font-bold text-white shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/15 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 active:translate-y-0"
                >
                  {t('hero.ctaPricing')}
                </Link>
              </motion.div>

              <motion.div variants={item} className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-300">
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck size={16} className="text-cyan-300" />
                  {t('hero.noCard')}
                </span>
              </motion.div>

              <motion.div variants={container} className="mt-9 hidden max-w-xl grid-cols-3 gap-2 sm:grid sm:gap-3">
                {HERO_STATS.map((k) => (
                  <motion.div
                    key={k}
                    variants={item}
                    className="rounded-2xl border border-white/10 bg-white/10 p-3 shadow-sm shadow-black/20 backdrop-blur"
                  >
                    <p className="text-xl font-black tabular-nums text-white">
                      {t(`hero.stats.${k}.value`)}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-300">
                      {t(`hero.stats.${k}.label`)}
                    </p>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>

            <WorkspaceScene reduce={reduce} ease={ease} />
          </div>
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

        <section className="border-y border-slate-200 bg-slate-50 py-20 dark:border-slate-800 dark:bg-slate-900/55 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <motion.div {...reveal} variants={container} className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
              <motion.div variants={item}>
                <span className="text-sm font-bold uppercase tracking-[0.2em] text-indigo-700 dark:text-indigo-300">
                  {t('useCases.eyebrow')}
                </span>
                <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl dark:text-white">
                  {t('useCases.title')}
                </h2>
                <p className="mt-4 text-base leading-8 text-slate-600 dark:text-slate-300">
                  {t('useCases.sub')}
                </p>
              </motion.div>

              <motion.div variants={container} className="grid gap-3 sm:grid-cols-2">
                {USE_CASE_ITEMS.map((useCase) => {
                  const Icon = useCase.icon
                  return (
                    <motion.article
                      key={useCase.k}
                      variants={item}
                      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-950/70 dark:hover:border-slate-700"
                    >
                      <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${useCase.tone}`}>
                        <Icon size={22} strokeWidth={1.85} />
                      </span>
                      <h3 className="mt-5 text-lg font-bold text-slate-950 dark:text-white">
                        {t(`useCases.${useCase.k}.title`)}
                      </h3>
                      <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">
                        {t(`useCases.${useCase.k}.desc`)}
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
                  {t(`toolPills.${tool}`)}
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

        <section id="faq" className="border-y border-slate-200 bg-slate-50 py-20 dark:border-slate-800 dark:bg-slate-900/55 sm:py-24">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.72fr_1.28fr] lg:px-8">
            <motion.div {...reveal} variants={item}>
              <span className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300">
                {t('faq.eyebrow')}
              </span>
              <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl dark:text-white">
                {t('faq.title')}
              </h2>
              <p className="mt-4 text-base leading-8 text-slate-600 dark:text-slate-300">
                {t('faq.sub')}
              </p>
            </motion.div>

            <motion.dl {...reveal} variants={container} className="grid gap-3 sm:grid-cols-2">
              {FAQ_ITEMS.map((faq) => (
                <motion.div
                  key={faq}
                  variants={item}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950/70"
                >
                  <dt className="text-base font-bold text-slate-950 dark:text-white">
                    {t(`faq.${faq}.q`)}
                  </dt>
                  <dd className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">
                    {t(`faq.${faq}.a`)}
                  </dd>
                </motion.div>
              ))}
            </motion.dl>
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
        <p className="mx-auto mt-3 max-w-3xl px-4 leading-relaxed">
          {t('footer.dataNotice')}
        </p>
      </footer>
    </div>
  )
}

function WorkspaceScene({ reduce, ease }: { reduce: boolean; ease: [number, number, number, number] }) {
  const { t } = useTranslation()
  return (
    <motion.div
      aria-hidden="true"
      initial={{ opacity: 0, y: reduce ? 0 : 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0 : 0.75, delay: reduce ? 0 : 0.2, ease }}
      className="pointer-events-none relative z-0 hidden min-h-[560px] md:block lg:min-h-[690px] lg:self-stretch"
    >
      <div className="absolute inset-x-[-1rem] bottom-0 top-3 sm:top-0 lg:inset-y-0 lg:left-[-2rem] lg:right-[-8vw]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_58%_17%,rgba(34,211,238,0.18),transparent_25%),radial-gradient(circle_at_76%_78%,rgba(91,77,255,0.34),transparent_34%),linear-gradient(115deg,rgba(9,13,31,0)_0%,rgba(10,17,44,0.72)_38%,rgba(22,28,67,0.9)_100%)]" />
        <div className="absolute inset-y-8 right-0 w-[84%] overflow-hidden rounded-l-[2rem] border border-white/10 bg-[#101733]/[0.45] shadow-[0_36px_120px_rgba(0,0,0,0.46)] backdrop-blur-sm sm:inset-y-4 lg:w-[88%]">
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,11,24,0.88)_0%,rgba(7,11,24,0.38)_48%,rgba(35,42,87,0.2)_100%)]" />
          <div className="absolute right-0 top-0 h-full w-[72%] bg-[radial-gradient(circle_at_70%_23%,rgba(255,255,255,0.18),transparent_17%),linear-gradient(180deg,rgba(255,255,255,0.1),rgba(255,255,255,0.02))]" />

          <div className="absolute right-4 top-20 grid h-64 w-[54%] grid-cols-4 gap-2 opacity-25 sm:right-8 sm:h-80">
            {Array.from({ length: 16 }).map((_, index) => (
              <span key={index} className="rounded-sm border border-white/30 bg-white/10" />
            ))}
          </div>

          <div className="absolute bottom-0 left-0 right-0 h-36 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.54))]" />
        </div>

        <div className="absolute left-[4%] top-[7%] h-1 w-1 rounded-full bg-cyan-200 shadow-[90px_34px_0_rgba(125,211,252,0.7),190px_12px_0_rgba(255,255,255,0.55),310px_80px_0_rgba(129,140,248,0.6),420px_24px_0_rgba(34,211,238,0.5),540px_100px_0_rgba(255,255,255,0.42)]" />

        <div className="absolute right-4 top-6 w-56 rotate-[2deg] rounded-2xl border border-white/15 bg-white/[0.12] p-3 text-white shadow-2xl shadow-black/30 backdrop-blur-md sm:right-8 sm:top-8 sm:w-72 lg:right-12 lg:top-16">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-400/25 text-indigo-100">
              <Presentation size={16} />
            </span>
            <div>
              <p className="text-xs font-black">{t('scene.slideTitle')}</p>
              <p className="text-[10px] text-slate-300">{t('scene.slideMeta')}</p>
            </div>
          </div>
          <div className="relative mt-3 aspect-[16/9] overflow-hidden rounded-xl border border-white/10 bg-[linear-gradient(135deg,rgba(91,77,255,0.52),rgba(34,211,238,0.2))]">
            <img
              src="/favicon.svg"
              alt=""
              className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 opacity-70"
            />
            <span className="absolute inset-x-4 bottom-4 h-2 rounded-full bg-white/25" />
            <span className="absolute bottom-8 left-4 h-2 w-20 rounded-full bg-cyan-200/80" />
          </div>
          <div className="mt-3 flex gap-2">
            <span className="h-2 flex-1 rounded-full bg-white/30" />
            <span className="h-2 w-12 rounded-full bg-cyan-300/80" />
          </div>
        </div>

        <div className="absolute left-2 top-[31%] hidden w-56 rotate-[-4deg] rounded-2xl border border-cyan-300/25 bg-cyan-300/10 p-4 text-cyan-50 shadow-2xl shadow-black/25 backdrop-blur-md sm:block lg:left-3">
          <div className="flex items-center gap-2 text-sm font-black">
            <WandSparkles size={17} />
            {t('scene.generatedTitle')}
          </div>
          <div className="mt-4 space-y-2">
            {['lessonFocus', 'classActivity', 'rubric'].map((label) => (
              <div key={label} className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold">
                <CheckCircle2 size={14} />
                {t(`scene.generatedItems.${label}`)}
              </div>
            ))}
          </div>
        </div>

        <div className="absolute right-2 top-[42%] w-48 rotate-[4deg] rounded-2xl border border-white/15 bg-white/[0.12] p-4 text-white shadow-2xl shadow-black/30 backdrop-blur-md sm:right-12 sm:w-56 lg:right-20">
          <div className="flex items-center gap-2 text-sm font-black">
            <FileText size={17} />
            {t('scene.taskPackTitle')}
          </div>
          <div className="mt-4 space-y-3">
            {['worksheet', 'shortAnswer', 'parentMessage'].map((label, index) => (
              <div key={label} className="flex items-center justify-between gap-3">
                <span className="text-xs font-bold text-slate-200">{t(`scene.taskPackItems.${label}`)}</span>
                <span className={`h-2.5 rounded-full ${index === 0 ? 'w-20 bg-cyan-300' : index === 1 ? 'w-16 bg-indigo-300' : 'w-12 bg-amber-200'}`} />
              </div>
            ))}
          </div>
        </div>

        <div className="absolute bottom-[26%] left-6 hidden w-56 rounded-2xl border border-white/15 bg-white/10 p-3 text-white shadow-2xl shadow-black/25 backdrop-blur-md md:block lg:left-12">
          <div className="grid grid-cols-4 gap-2">
            {[BookOpenCheck, FileText, Presentation, Highlighter, BarChart3, Users, ScanLine, MessageSquareText].map((Icon, index) => (
              <span key={index} className="flex h-10 items-center justify-center rounded-xl bg-white/10 text-cyan-100">
                <Icon size={17} />
              </span>
            ))}
          </div>
        </div>

        <div className="absolute bottom-7 left-1/2 w-[86%] max-w-[560px] -translate-x-1/2 sm:bottom-8 lg:left-[52%] lg:w-[76%]">
          <div className="overflow-hidden rounded-t-2xl border border-white/15 bg-[#0d1534] shadow-[0_32px_90px_rgba(0,0,0,0.58)]">
            <div className="flex min-h-12 items-center gap-3 border-b border-white/10 bg-white/[0.07] px-4">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#5b4dff]/[0.35] text-indigo-100">
                <WandSparkles size={17} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-white">{t('scene.workspaceTitle')}</p>
                <p className="text-[10px] font-semibold text-slate-400">{t('scene.workspaceMeta')}</p>
              </div>
              <span className="ml-auto rounded-full bg-cyan-300/15 px-3 py-1 text-[10px] font-black text-cyan-200">
                {t('scene.syncing')}
              </span>
            </div>

            <div className="grid gap-0 sm:grid-cols-[1fr_0.86fr]">
              <div className="divide-y divide-white/[0.08]">
                {SCENE_ROWS.slice(0, 4).map((row, index) => (
                  <div key={row} className="flex min-h-14 items-center gap-3 px-4 py-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-cyan-100">
                      {index === 0 ? <BookOpenCheck size={17} /> : null}
                      {index === 1 ? <FileText size={17} /> : null}
                      {index === 2 ? <Presentation size={17} /> : null}
                      {index === 3 ? <Highlighter size={17} /> : null}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-black text-slate-100">
                        {t(`scene.rows.${row}.title`)}
                      </p>
                      <p className="mt-0.5 truncate text-[10px] font-semibold text-slate-300">
                        {t(`scene.rows.${row}.meta`)}
                      </p>
                    </div>
                    <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-black text-slate-300">
                      {index === 3 ? t('scene.statusActive') : t('scene.statusReady')}
                    </span>
                  </div>
                ))}
              </div>

              <div className="hidden border-l border-white/10 bg-white/5 p-4 sm:block">
                <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-4">
                  <div className="flex items-center gap-2 text-sm font-black text-cyan-100">
                    <BarChart3 size={17} />
                    {t('scene.weaknessTitle')}
                  </div>
                  <div className="mt-4 space-y-3">
                    {['cashflow', 'depreciation', 'positioning'].map((label, index) => (
                      <div key={label}>
                        <div className="mb-1 flex justify-between text-[10px] font-bold text-slate-300">
                          <span>{t(`scene.weaknesses.${label}`)}</span>
                          <span>{[68, 52, 41][index]}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-cyan-300"
                            style={{ width: `${[68, 52, 41][index]}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-3 rounded-2xl border border-amber-200/20 bg-amber-200/10 p-4">
                  <div className="flex items-center gap-2 text-sm font-black text-amber-100">
                    <Clock3 size={17} />
                    {t('scene.downloadTitle')}
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-amber-100/70">
                    {t('scene.downloadBody')}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="mx-auto h-4 w-[92%] rounded-b-[2rem] bg-[linear-gradient(90deg,#030712,#334155_48%,#030712)] shadow-[0_18px_36px_rgba(0,0,0,0.42)]" />
        </div>

        <div className="absolute bottom-10 right-0 hidden w-32 rotate-[5deg] opacity-80 lg:block">
          {Array.from({ length: 5 }).map((_, index) => (
            <span
              key={index}
              className="absolute h-16 w-28 rounded-lg border border-white/10 bg-white/15 shadow-lg backdrop-blur-sm"
              style={{ bottom: index * 7, right: index * 4 }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  )
}
