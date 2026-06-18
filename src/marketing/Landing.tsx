import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { motion, useReducedMotion, type Variants } from 'framer-motion'
import {
  ClipboardList,
  FileText,
  Sparkles,
  Presentation,
  Highlighter,
  Users,
  FolderOpen,
  ShieldCheck,
  Cloud,
  ArrowRight,
  Bell,
  Loader2,
  type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { track } from '../lib/observability'

// ============================================================
//  商業化 · 行銷首頁（Landing）—— 對象：全港老師
//  ------------------------------------------------------------
//  Hero =「改簿枱面 + 課堂時間表」：左邊一張白紙（sans 標題跟功能頁 + 鋼藍底線 +
//  紅筆感 ✓ 清單 + 靛藍「閱」印），右邊一張真‧課堂表做產品預覽，貼住
//  黃調便利貼。配色用 hero 專用鋼藍盤（--hero-*，高級藍白、自帶深色），
//  其餘版塊續用 --accent / --surface token。動態用 framer-motion，
//  並尊重「減少動態」(prefers-reduced-motion)。產品入口 '/app'，定價 '/pricing'。
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

// hero 紙面 ✓ 清單：六大功能（i18n hero.ck1..6）
const CHECK_KEYS = ['ck1', 'ck2', 'ck3', 'ck4', 'ck5', 'ck6'] as const

// 手繪感 ✓（評改記號）；color 預設跟主題色。
function PenTick({ className = '', color = 'var(--accent)' }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <path d="M4 13l5 5L20 6" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// 鋼藍手繪底線：一道波浪 stroke 喺重點字下面，由左至右畫出（pathLength）。
function SteelUnderline({ reduce }: { reduce: boolean }) {
  return (
    <svg
      viewBox="0 0 260 12"
      preserveAspectRatio="none"
      aria-hidden
      className="pointer-events-none absolute -bottom-2 left-0 h-[11px] w-full overflow-visible"
    >
      <motion.path
        d="M3 7 Q 66 2 130 6 T 257 5"
        fill="none"
        stroke="var(--hero-steel)"
        strokeWidth={3}
        strokeLinecap="round"
        initial={{ pathLength: reduce ? 1 : 0, opacity: reduce ? 1 : 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{
          pathLength: { duration: reduce ? 0 : 0.85, delay: reduce ? 0 : 0.7, ease: 'easeInOut' },
          opacity: { duration: 0.01, delay: reduce ? 0 : 0.7 },
        }}
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
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-base font-bold text-white shadow-sm">
              E
            </span>
            <span className="text-[17px] font-bold tracking-tight">
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

      {/* Hero — 改簿枱面 + 課堂時間表（鋼藍藍白） */}
      <section className="relative overflow-hidden" style={{ background: 'var(--hero-mist)' }}>
        {/* 冷調鋼藍光暈 */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(120% 80% at 85% -8%, color-mix(in srgb, var(--hero-steel) 13%, transparent), transparent 60%)',
          }}
        />
        {/* 極淡網格質感（頂部顯、向下淡出） */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(var(--hero-line) 1px, transparent 1px), linear-gradient(90deg, var(--hero-line) 1px, transparent 1px)',
            backgroundSize: '34px 34px',
            maskImage: 'radial-gradient(125% 85% at 50% 0%, #000, transparent 72%)',
            WebkitMaskImage: 'radial-gradient(125% 85% at 50% 0%, #000, transparent 72%)',
          }}
        />

        <div className="relative mx-auto max-w-6xl px-6 pb-24 pt-16 sm:pt-24">
          <div className="grid items-center gap-x-10 gap-y-14 lg:grid-cols-[1.04fr_0.96fr]">
            {/* 左：改簿紙面 */}
            <motion.div variants={container} initial="hidden" animate="show" className="relative">
              <div
                className="relative rounded-[14px] border px-7 py-8 shadow-overlay sm:-rotate-[0.6deg] sm:px-10 sm:py-11"
                style={{ background: 'var(--hero-paper)', borderColor: 'var(--hero-paper-border)' }}
              >
                {/* 紙張左 margin 線 */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-y-6 left-4 w-[2px] sm:left-6"
                  style={{ background: 'var(--hero-margin)' }}
                />
                <div className="sm:pl-5">
                  <motion.span
                    variants={item}
                    className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium"
                    style={{ background: 'var(--hero-chip-bg)', color: 'var(--hero-steel)' }}
                  >
                    <PenTick className="h-[16px] w-[16px]" color="var(--hero-steel)" />
                    {t('hero.badge')}
                  </motion.span>

                  <motion.h1
                    variants={item}
                    className="mt-5 text-[1.95rem] font-semibold leading-[1.18] tracking-tight sm:text-[3.05rem] sm:leading-[1.1]"
                    style={{ color: 'var(--hero-ink)' }}
                  >
                    <span className="block">{line1}</span>
                    <span className="block whitespace-normal sm:whitespace-nowrap">
                      {line2pre}
                      <span className="relative inline-block" style={{ color: 'var(--hero-steel)' }}>
                        {h1accent}
                        <SteelUnderline reduce={reduce} />
                      </span>
                    </span>
                  </motion.h1>

                  <motion.p variants={item} className="mt-6 text-[15px]" style={{ color: 'var(--hero-slate)' }}>
                    {t('hero.checkLead')}
                  </motion.p>

                  {/* ✓ 清單：六大功能，鋼藍手繪打勾 */}
                  <motion.ul variants={item} className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2.5">
                    {CHECK_KEYS.map((k) => (
                      <li
                        key={k}
                        className="flex items-center gap-2 text-[15px] font-medium"
                        style={{ color: 'var(--hero-ink)' }}
                      >
                        <PenTick className="h-[17px] w-[17px] flex-none" color="var(--hero-steel)" />
                        {t(`hero.${k}`)}
                      </li>
                    ))}
                  </motion.ul>

                  <motion.div variants={item} className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                    <Link
                      to="/app"
                      onClick={() => track('landing_cta_click', { target: 'hero' })}
                      className="inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:translate-y-0"
                      style={{ background: 'var(--hero-btn)' }}
                    >
                      {user ? t('hero.ctaEnter') : t('hero.ctaStart')}
                      <ArrowRight size={18} strokeWidth={2} />
                    </Link>
                    <Link
                      to="/pricing"
                      className="inline-flex items-center justify-center rounded-full border-2 px-7 py-3.5 font-semibold transition hover:-translate-y-0.5"
                      style={{
                        borderColor: 'color-mix(in srgb, var(--hero-steel) 40%, transparent)',
                        color: 'var(--hero-steel)',
                      }}
                    >
                      {t('hero.ctaPricing')}
                    </Link>
                  </motion.div>

                  <motion.p
                    variants={item}
                    className="mt-5 flex items-center gap-2 text-sm"
                    style={{ color: 'var(--hero-muted)' }}
                  >
                    <PenTick className="h-[14px] w-[14px]" color="var(--hero-muted)" />
                    {t('hero.noCard')}
                  </motion.p>
                </div>
              </div>

              {/* 靛藍「閱」印：蓋喺紙右上角 */}
              <motion.div
                aria-hidden
                initial={{ scale: reduce ? 1 : 1.7, opacity: 0, rotate: -32 }}
                animate={{ scale: 1, opacity: 0.95, rotate: -9 }}
                transition={reduce ? { duration: 0 } : { delay: 1.5, type: 'spring', stiffness: 260, damping: 13 }}
                className="absolute -right-1 -top-4 grid h-[62px] w-[62px] place-items-center rounded-[12px] border-[3px] text-3xl font-bold sm:-right-3 sm:-top-5"
                style={{
                  borderColor: 'var(--hero-seal)',
                  color: 'var(--hero-seal)',
                  background: 'color-mix(in srgb, var(--hero-paper) 62%, transparent)',
                }}
              >
                閱
              </motion.div>
            </motion.div>

            {/* 右：課堂時間表 */}
            <TimetablePreview reduce={reduce} ease={ease} />
          </div>
        </div>
      </section>

      {/* 功能 */}
      <section className="border-t border-[color:var(--border)] bg-[color:var(--surface)]">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <motion.div {...reveal} variants={item} className="flex items-baseline gap-3">
            <span className="text-sm text-accent">／</span>
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--text-muted)]">
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
                  <span className="absolute right-5 top-5 text-sm font-medium tabular-nums text-[color:var(--text-muted)]/70">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent-strong transition group-hover:scale-105 dark:bg-accent/15 dark:text-accent">
                    <I size={21} strokeWidth={1.75} />
                  </span>
                  <h3 className="mt-5 text-lg font-semibold">{t(`f.${f.k}Title`)}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[color:var(--text-secondary)]">
                    {t(`f.${f.k}Desc`)}
                  </p>
                </motion.div>
              )
            })}
          </motion.div>

          {/* 仲有更多：長尾功能標籤雲（忠實反映 registry 真實功能） */}
          <motion.div {...reveal} variants={item} className="mt-7">
            <div className="flex items-center gap-2 text-sm text-accent">
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
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t('ctaTitle')}</h2>
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

// 產品預覽：課堂時間表（六大功能擺入堂節，「現正一節」實色鋼藍跳出）+ 改簿便利貼。純裝飾。
const TIMETABLE: { period: string; time: string; label: string; tone: 'soft' | 'soft2' | 'active' }[] = [
  { period: '第一節', time: '08:30', label: '備課', tone: 'soft' },
  { period: '第二節', time: '09:25', label: '教案', tone: 'soft2' },
  { period: '第三節', time: '10:40', label: '教學簡報', tone: 'active' },
  { period: '午息', time: '', label: '改簿存檔', tone: 'soft' },
  { period: '第四節', time: '13:30', label: '會議記錄', tone: 'soft2' },
  { period: '放學', time: '', label: '掃描存檔', tone: 'soft' },
]

function TimetablePreview({ reduce, ease }: { reduce: boolean; ease: [number, number, number, number] }) {
  return (
    <motion.div
      aria-hidden
      initial={{ opacity: 0, y: reduce ? 0 : 22 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0 : 0.7, delay: reduce ? 0 : 0.4, ease }}
      className="relative hidden lg:block"
    >
      <div
        className="overflow-hidden rounded-[14px] border shadow-overlay lg:rotate-[0.8deg]"
        style={{ background: 'var(--hero-paper)', borderColor: 'var(--hero-paper-border)' }}
      >
        {/* 頂欄：課鐘 */}
        <div className="flex items-center gap-2 px-4 py-3 text-white" style={{ background: 'var(--hero-bar)' }}>
          <Bell size={15} strokeWidth={2} />
          <span className="text-[13px] font-semibold tracking-wide">今日課堂表</span>
          <span className="ml-auto text-[11px] text-white/70">星期一</span>
        </div>
        <ul>
          {TIMETABLE.map((r, i) => (
            <li
              key={r.period}
              className="flex items-center justify-between px-4 py-3"
              style={{
                borderTop: i === 0 ? 'none' : '1px solid var(--hero-line)',
                background: r.tone === 'active' ? 'color-mix(in srgb, var(--hero-steel) 8%, transparent)' : 'transparent',
              }}
            >
              <span className="flex items-baseline gap-2">
                <span
                  className="text-[12.5px] font-medium"
                  style={{ color: r.tone === 'active' ? 'var(--hero-steel)' : 'var(--hero-muted)' }}
                >
                  {r.period}
                </span>
                {r.time && (
                  <span className="text-[11px] tabular-nums" style={{ color: 'var(--hero-muted)' }}>
                    {r.time}
                  </span>
                )}
              </span>
              <span
                className="rounded-lg px-2.5 py-1 text-[12px] font-semibold"
                style={
                  r.tone === 'active'
                    ? { background: 'var(--hero-btn)', color: '#fff' }
                    : {
                        background: r.tone === 'soft2' ? 'var(--hero-chip-bg2)' : 'var(--hero-chip-bg)',
                        color: 'var(--hero-chip-ink)',
                      }
                }
              >
                {r.label}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* 改簿便利貼：蓋喺右下角 */}
      <motion.div
        initial={{ opacity: 0, scale: reduce ? 1 : 0.8, rotate: reduce ? 5 : 14 }}
        animate={{ opacity: 1, scale: 1, rotate: 5 }}
        transition={reduce ? { duration: 0 } : { delay: 1.2, type: 'spring', stiffness: 240, damping: 14 }}
        className="absolute -bottom-5 -right-4 rounded-[3px] px-3.5 py-2 text-[13px] font-semibold shadow-sm"
        style={{ background: 'var(--hero-sticky-bg)', color: 'var(--hero-sticky-ink)' }}
      >
        今日改 32 本 ✓
      </motion.div>
    </motion.div>
  )
}
