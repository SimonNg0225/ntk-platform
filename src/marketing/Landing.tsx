import { Link } from 'react-router-dom'
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
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

// ============================================================
//  商業化 · 行銷首頁（Landing）—— 對象：全港老師
//  ------------------------------------------------------------
//  機構級 SaaS 風：克制配色、line icon、無 emoji、無漸變光暈。
//  產品入口 '/app'，定價 '/pricing'。
// ============================================================

const FEATURES: { icon: LucideIcon; title: string; desc: string }[] = [
  {
    icon: ClipboardList,
    title: '備課與課程進度',
    desc: '撰寫教案、對住課程大綱逐班追蹤教學進度，學期規劃一目了然。',
  },
  {
    icon: FileText,
    title: 'AI 出題與試卷',
    desc: '輸入課題即生成 MC／短答／長題，一鍵入題庫、自動砌成試卷與工作紙。',
  },
  {
    icon: TrendingUp,
    title: '成績與弱項分析',
    desc: '記分自動計算平均與排名，標出全班弱項，評估數據變成教學決策。',
  },
  {
    icon: CalendarDays,
    title: '時間表與點名',
    desc: '每週課堂時間表、逐堂點名統計出席率，代課調堂一眼睇晒。',
  },
  {
    icon: MessagesSquare,
    title: '家長溝通與行政',
    desc: '聯絡記錄連範本、會議筆記、Word 行政文件逐欄填好即印。',
  },
  {
    icon: Sparkles,
    title: '教學 AI 助手',
    desc: '出題、教案大綱、批改評語、課堂活動 —— 適用於任何任教科目。',
  },
]

const TRUST: { icon: LucideIcon; label: string }[] = [
  { icon: ShieldCheck, label: '資料存你部機，登入先雲端同步' },
  { icon: Cloud, label: '可安裝、離線可用（PWA）' },
  { icon: FileText, label: '無障礙設計 · 手機 / 平板適配' },
]

export default function Landing() {
  const { user } = useAuth()
  return (
    <div className="min-h-screen bg-[color:var(--app-bg)] text-slate-900 dark:text-slate-100">
      <Helmet>
        <title>NTK Platform · 香港教師一站式工作台</title>
        <meta
          name="description"
          content="為香港老師而設的一站式工作台：備課、AI 出題、成績與弱項分析、點名、家長溝通、行政文件。資料在地、雲端同步、適用任何科目。"
        />
        <meta property="og:title" content="NTK Platform · 香港教師工作台" />
        <meta
          property="og:description"
          content="備課 · AI 出題 · 成績分析 · 點名 · 家長溝通 —— 老師的日常工作，一個平台搞掂。"
        />
      </Helmet>

      {/* 頂欄 */}
      <header className="border-b border-[color:var(--border)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-sm font-bold text-white">
              N
            </span>
            <span className="text-[15px] font-bold tracking-tight">NTK Platform</span>
          </div>
          <nav className="flex items-center gap-5 text-sm">
            <Link
              to="/pricing"
              className="font-medium text-slate-500 transition hover:text-accent dark:text-slate-400"
            >
              定價
            </Link>
            <Link
              to="/app"
              className="rounded-lg bg-accent px-4 py-2 font-semibold text-white transition hover:bg-accent-strong"
            >
              {user ? '進入工作台' : '免費開始'}
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 pb-16 pt-16 sm:pt-24">
        <div className="max-w-3xl">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-1 text-xs font-medium text-slate-500 dark:text-slate-400">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            專為香港老師而設
          </span>
          <h1 className="mt-5 text-4xl font-bold leading-[1.12] tracking-tight sm:text-5xl">
            老師的日常工作，
            <br className="hidden sm:block" />
            一個平台<span className="text-accent">由頭到尾搞掂</span>
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-500 dark:text-slate-400 sm:text-lg">
            備課、AI 出題、成績與弱項分析、點名、家長溝通、行政文件 ——
            散落喺 Excel、WhatsApp、紙張嘅教學工作，收返埋一個專業工作台。
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/app"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-7 py-3.5 font-semibold text-white transition hover:bg-accent-strong"
            >
              {user ? '進入工作台' : '免費開始使用'}
              <ArrowRight size={18} strokeWidth={2} />
            </Link>
            <Link
              to="/pricing"
              className="inline-flex items-center justify-center rounded-xl border border-[color:var(--border-strong)] px-7 py-3.5 font-semibold text-slate-700 transition hover:border-accent hover:text-accent dark:text-slate-200"
            >
              查看定價
            </Link>
          </div>
          <p className="mt-3 text-xs text-slate-400">
            無需信用卡 · 即開即用 · 適用任何任教科目
          </p>
        </div>
      </section>

      {/* 功能 */}
      <section className="border-t border-[color:var(--border)] bg-[color:var(--surface)]">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
            涵蓋老師的一週
          </h2>
          <div className="mt-6 grid gap-px overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--border)] sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => {
              const I = f.icon
              return (
                <div
                  key={f.title}
                  className="bg-[color:var(--surface)] p-6 transition hover:bg-[color:var(--surface-2)]"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
                    <I size={20} strokeWidth={1.75} />
                  </span>
                  <h3 className="mt-4 text-base font-semibold">{f.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                    {f.desc}
                  </p>
                </div>
              )
            })}
          </div>

          {/* 信任條 */}
          <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3">
            {TRUST.map((t) => {
              const I = t.icon
              return (
                <div
                  key={t.label}
                  className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400"
                >
                  <I size={16} strokeWidth={1.75} className="text-accent" />
                  {t.label}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-5xl px-6 py-20 text-center">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          今個學期，由更有條理開始
        </h2>
        <p className="mt-3 text-slate-500 dark:text-slate-400">
          免費試用全部教學功能，需要時先升級。
        </p>
        <Link
          to="/app"
          className="mt-7 inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-8 py-3.5 font-semibold text-white transition hover:bg-accent-strong"
        >
          免費開始使用
          <ArrowRight size={18} strokeWidth={2} />
        </Link>
      </section>

      <footer className="border-t border-[color:var(--border)] py-8 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} NTK Platform · 為香港教育工作者而設
      </footer>
    </div>
  )
}
