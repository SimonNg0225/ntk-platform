import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { Check, ArrowLeft } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useSubscription } from '../hooks/useSubscription'
import {
  PLANS,
  isBillingConfigured,
  startCheckout,
  openBillingPortal,
  priceForCycle,
  type Plan,
  type BillingCycle,
} from '../lib/billing'
import { track } from '../lib/observability'

const HAS_ANNUAL = PLANS.some((p) => p.annualPriceId)

// ============================================================
//  商業化 · 定價頁（/pricing）
//  ------------------------------------------------------------
//  顯示方案 + 升級 / 管理訂閱入口。
//  未登入 → 先引導 Google 登入；未接 Stripe → 提示「即將推出」。
// ============================================================

export default function Pricing() {
  const { user, configured, signInWithGoogle } = useAuth()
  const sub = useSubscription()
  const toast = useToast()
  const [busy, setBusy] = useState<string | null>(null)
  const [cycle, setCycle] = useState<BillingCycle>('monthly')

  async function onPick(plan: Plan) {
    track('pricing_cta_click', { plan: plan.id, cycle })
    if (plan.id === 'free') {
      window.location.href = '/app'
      return
    }
    if (!isBillingConfigured) {
      toast.info('收費功能即將推出，敬請期待 🙏')
      return
    }
    if (!user) {
      if (!configured) {
        toast.error('未接 Supabase，暫時無法登入升級。')
        return
      }
      await signInWithGoogle()
      return
    }
    const { priceId } = priceForCycle(plan, cycle)
    if (!priceId) return
    try {
      setBusy(plan.id)
      await startCheckout(priceId)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '開啟付款頁失敗。')
      setBusy(null)
    }
  }

  async function onManage() {
    try {
      setBusy('portal')
      await openBillingPortal()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '開啟客戶中心失敗。')
      setBusy(null)
    }
  }

  return (
    <div className="min-h-screen bg-[color:var(--app-bg)] px-6 py-12 text-slate-900 dark:text-slate-100">
      <Helmet>
        <title>定價 · NTK Platform</title>
        <meta name="description" content="NTK Platform 方案與定價：免費版永久免費，Pro 解鎖無限 AI 同多裝置同步。" />
      </Helmet>

      <div className="mx-auto max-w-4xl">
        <div className="text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-sm text-slate-400 transition hover:text-accent"
          >
            <ArrowLeft size={14} strokeWidth={1.75} /> 返回首頁
          </Link>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            簡單透明嘅定價
          </h1>
          <p className="mt-3 text-slate-500 dark:text-slate-400">
            老師免費用齊教學功能，需要時先升級。
          </p>

          {HAS_ANNUAL && (
            <div className="mt-6 inline-flex rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-1 text-sm">
              {(['monthly', 'annual'] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setCycle(c)}
                  className={`rounded-lg px-4 py-1.5 font-medium transition ${
                    cycle === c
                      ? 'bg-accent text-white'
                      : 'text-slate-500 hover:text-accent dark:text-slate-400'
                  }`}
                >
                  {c === 'monthly' ? '月繳' : '年繳'}
                  {c === 'annual' && (
                    <span
                      className={`ml-1.5 text-xs ${cycle === c ? 'text-white/80' : 'text-accent'}`}
                    >
                      慳 2 個月
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {PLANS.map((plan) => {
            const isCurrent =
              (plan.id === 'pro' && sub.isPro) ||
              (plan.id === 'free' && !sub.isPro)
            return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-2xl border p-7 shadow-sm ${
                  plan.highlighted
                    ? 'border-accent ring-1 ring-accent'
                    : 'border-slate-200 dark:border-slate-800'
                } bg-white/70 dark:bg-slate-900/40`}
              >
                {plan.highlighted && (
                  <span className="absolute -top-3 right-6 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-white">
                    最受歡迎
                  </span>
                )}
                <h2 className="text-xl font-bold">{plan.name}</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {plan.tagline}
                </p>
                <div className="mt-4 text-3xl font-bold">
                  {priceForCycle(plan, cycle).label}
                </div>
                {cycle === 'annual' && plan.annualNote && (
                  <p className="mt-1 text-xs font-medium text-accent">
                    {plan.annualNote}
                  </p>
                )}

                <ul className="mt-5 flex-1 space-y-2.5 text-sm">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check
                        size={16}
                        strokeWidth={2}
                        className="mt-0.5 shrink-0 text-accent"
                      />
                      <span className="text-slate-600 dark:text-slate-300">
                        {f}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="mt-6">
                  {isCurrent ? (
                    plan.id === 'pro' ? (
                      <button
                        onClick={onManage}
                        disabled={busy === 'portal'}
                        className="w-full rounded-xl border border-slate-300 py-3 font-semibold text-slate-700 transition hover:border-accent hover:text-accent disabled:opacity-50 dark:border-slate-700 dark:text-slate-200"
                      >
                        {busy === 'portal' ? '開啟中…' : '管理訂閱'}
                      </button>
                    ) : (
                      <div className="w-full rounded-xl bg-slate-100 py-3 text-center font-semibold text-slate-400 dark:bg-slate-800">
                        目前方案
                      </div>
                    )
                  ) : (
                    <button
                      onClick={() => onPick(plan)}
                      disabled={busy === plan.id}
                      className={`w-full rounded-xl py-3 font-semibold transition disabled:opacity-50 ${
                        plan.highlighted
                          ? 'bg-accent text-white hover:opacity-90'
                          : 'border border-slate-300 text-slate-700 hover:border-accent hover:text-accent dark:border-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {busy === plan.id
                        ? '處理中…'
                        : plan.id === 'pro'
                          ? '升級 Pro'
                          : '免費開始'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {!isBillingConfigured && (
          <p className="mt-8 text-center text-xs text-slate-400">
            ⓘ 收費功能尚未啟用（未設定 Stripe）。設定步驟見{' '}
            <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">
              docs/COMMERCIALIZATION.md
            </code>
          </p>
        )}
      </div>
    </div>
  )
}
