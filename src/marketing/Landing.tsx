import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useAuth } from '../context/AuthContext'

// ============================================================
//  商業化 · 行銷首頁（Landing）
//  ------------------------------------------------------------
//  公開頁（'/'）：講賣點 + 轉化入口。
//  真正嘅產品喺 '/app'，定價喺 '/pricing'。
// ============================================================

const HIGHLIGHTS: { icon: string; title: string; desc: string }[] = [
  {
    icon: '🧠',
    title: '學習 / 工作雙模式',
    desc: '一撳切換，知識卡間隔重複、番茄鐘、目標進度，全部喺一個入口。',
  },
  {
    icon: '🤖',
    title: 'AI 助手 + AI 教練',
    desc: '飲食拆解、健身教練、拍照識別器材，仲可以基於你自己資料問答。',
  },
  {
    icon: '☁️',
    title: '雲端同步 · 離線可用',
    desc: '登入即多裝置同步，PWA 可安裝、冇網都用得，資料喺你手。',
  },
  {
    icon: '📅',
    title: 'Apple 級行事曆',
    desc: '月 / 週 / 日 / 年檢視、重複事件、拖拉縮放，工作學習一覽。',
  },
]

export default function Landing() {
  const { user } = useAuth()
  return (
    <div className="min-h-screen bg-[color:var(--app-bg)] text-slate-900 dark:text-slate-100">
      <Helmet>
        <title>NTK Platform · 個人學習與工作平台</title>
        <meta
          name="description"
          content="一個可隨時切換學習 / 工作模式嘅個人平台 —— 知識卡、AI 助手、健身中心、行事曆、雲端同步，30+ 功能一站式。"
        />
        <meta property="og:title" content="NTK Platform" />
        <meta
          property="og:description"
          content="學習 / 工作雙模式 · AI 助手 · 雲端同步 · 30+ 功能"
        />
      </Helmet>

      {/* 頂欄 */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <span className="text-lg font-bold">NTK Platform</span>
        <nav className="flex items-center gap-4 text-sm">
          <Link to="/pricing" className="text-slate-500 hover:text-accent">
            定價
          </Link>
          <Link
            to="/app"
            className="rounded-lg bg-accent px-4 py-2 font-medium text-white shadow-sm transition hover:opacity-90"
          >
            {user ? '進入平台' : '免費開始'}
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 pb-16 pt-12 text-center sm:pt-20">
        <h1 className="text-4xl font-bold leading-tight sm:text-5xl">
          學習同工作，
          <span className="text-accent">一個入口</span>搞掂
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base text-slate-500 dark:text-slate-400 sm:text-lg">
          知識增長 + 工作效能 + 健康健身，30+ 功能可隨時切換模式。
          AI 接 Gemini、資料雲端同步、PWA 離線可用。
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to="/app"
            className="rounded-xl bg-accent px-7 py-3 font-semibold text-white shadow-md transition hover:opacity-90"
          >
            {user ? '進入平台 →' : '免費試用 →'}
          </Link>
          <Link
            to="/pricing"
            className="rounded-xl border border-slate-300 px-7 py-3 font-semibold text-slate-700 transition hover:border-accent hover:text-accent dark:border-slate-700 dark:text-slate-200"
          >
            睇定價
          </Link>
        </div>
        <p className="mt-4 text-xs text-slate-400">
          無需信用卡 · 訪客模式即開即用
        </p>
      </section>

      {/* 賣點 */}
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <div className="grid gap-5 sm:grid-cols-2">
          {HIGHLIGHTS.map((h) => (
            <div
              key={h.title}
              className="rounded-2xl border border-slate-200 bg-white/60 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/40"
            >
              <div className="text-3xl">{h.icon}</div>
              <h3 className="mt-3 text-lg font-semibold">{h.title}</h3>
              <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
                {h.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-slate-200 py-8 text-center text-xs text-slate-400 dark:border-slate-800">
        © {new Date().getFullYear()} NTK Platform
      </footer>
    </div>
  )
}
