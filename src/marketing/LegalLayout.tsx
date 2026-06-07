import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { ArrowLeft } from 'lucide-react'

// 法律頁共用版面（私隱政策 / 服務條款）。機構級、克制排版。
export default function LegalLayout({
  title,
  updated,
  children,
}: {
  title: string
  updated: string
  children: ReactNode
}) {
  return (
    <div className="min-h-screen bg-[color:var(--app-bg)] px-6 py-12 text-slate-900 dark:text-slate-100">
      <Helmet>
        <title>{title} · NTK Platform</title>
        <meta name="robots" content="all" />
      </Helmet>
      <article className="mx-auto max-w-3xl">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-sm text-slate-400 transition hover:text-accent"
        >
          <ArrowLeft size={14} strokeWidth={1.75} /> 返回首頁
        </Link>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-slate-400">最後更新：{updated}</p>

        <div className="legal-body mt-8 space-y-6 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          {children}
        </div>

        <p className="mt-12 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-2)] p-4 text-xs text-slate-400">
          ⓘ 本文件為一般範本，僅供參考，並不構成法律意見。正式商業營運前，
          請交由合資格法律顧問按你的實際情況審閱及修訂。
        </p>
      </article>
    </div>
  )
}

// 段落標題小工具
export function LegalSection({
  no,
  title,
  children,
}: {
  no: number
  title: string
  children: ReactNode
}) {
  return (
    <section>
      <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
        {no}. {title}
      </h2>
      <div className="mt-2 space-y-2">{children}</div>
    </section>
  )
}
