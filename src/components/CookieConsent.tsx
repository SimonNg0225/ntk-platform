import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Cookie } from 'lucide-react'
import {
  isAnalyticsConfigured,
  getConsent,
  acceptAnalytics,
  rejectAnalytics,
} from '../lib/observability'
import { isSupportConfigured, loadCrisp } from '../lib/support'

// ============================================================
//  Cookie 同意橫額（私隱合規）
//  ------------------------------------------------------------
//  只喺「有設定產品分析 (PostHog)」且「用戶未決定」時先出現。
//  接受 → 即時啟用分析；拒絕 → 唔載入分析。兩者都記低，唔再彈。
//  未設 analytics（預設 / 訪客模式）→ 唔追蹤、唔出橫額。
// ============================================================

export default function CookieConsent() {
  const [decided, setDecided] = useState(() => getConsent() !== null)

  // 有分析或客服（兩者都設 cookie）需要同意時先出橫額。
  if ((!isAnalyticsConfigured && !isSupportConfigured) || decided) return null

  return (
    <div
      role="region"
      aria-label="Cookie 同意"
      className="fixed inset-x-0 bottom-0 z-[60] px-4 pb-4"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-overlay sm:flex-row sm:items-center">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
          <Cookie size={18} strokeWidth={1.75} />
        </span>
        <p className="flex-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          我哋用分析 cookie 改善產品體驗。你可以選擇接受或拒絕；詳情見{' '}
          <Link to="/privacy" className="font-medium text-accent hover:underline">
            私隱政策
          </Link>
          。
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => {
              rejectAnalytics()
              setDecided(true)
            }}
            className="rounded-lg border border-[color:var(--border-strong)] px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-[color:var(--surface-2)] dark:text-slate-300"
          >
            拒絕
          </button>
          <button
            onClick={() => {
              void acceptAnalytics()
              loadCrisp()
              setDecided(true)
            }}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-strong"
          >
            接受
          </button>
        </div>
      </div>
    </div>
  )
}
