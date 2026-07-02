import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useTranslation } from 'react-i18next'
import {
  Check,
  ArrowLeft,
  Ticket,
  ClipboardList,
  Cloud,
  ShieldCheck,
  Sparkles,
  UserRound,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useSubscription } from '../hooks/useSubscription'
import { redeemTestCode, clearTestPro } from '../lib/testPro'
import { useConfirm } from '../context/ConfirmContext'
import { refundEstimate, refundRequest, hkd } from '../lib/refund'
import { COMPANY } from '../lib/companyInfo'
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
// 方案層級（升 / 降級判斷）
const RANK: Record<string, number> = { free: 0, plus: 1, pro: 2 }

const PLAN_FIT: Record<
  Plan['id'],
  { label: string; bestFor: string; outcome: string; icon: LucideIcon }
> = {
  free: {
    label: '試用起步',
    bestFor: '想先試 AI 備課、出題和教案流程',
    outcome: '每月 30 點，足夠試完整個「下一堂課」流程',
    icon: UserRound,
  },
  plus: {
    label: '日常老師',
    bestFor: '每星期都要備課、出教材、同步多部裝置',
    outcome: '300 點覆蓋日常備課，適合每週穩定使用',
    icon: ClipboardList,
  },
  pro: {
    label: '密集備課',
    bestFor: '全日校老師、公開試班、需要高階模型和更多額度',
    outcome: '1000 點 + Pro 模型，適合密集出卷、簡報和回饋',
    icon: Sparkles,
  },
}

const TRUST_ITEMS: { icon: LucideIcon; title: string; desc: string }[] = [
  {
    icon: UserRound,
    title: '散戶老師先行',
    desc: '不用學校帳戶，一位老師都可即開即用。',
  },
  {
    icon: ShieldCheck,
    title: '私隱先行',
    desc: 'AI 內容作初稿，學生資料需由老師按校本政策處理。',
  },
  {
    icon: Cloud,
    title: '本機到雲端',
    desc: '免費版可本機使用，升級後加強跨裝置同步。',
  },
]

const COMPARISON_ROWS = [
  ['下一堂課任務包', '可用', '可用', '可用'],
  ['每月 AI 點數', '30', '300', '1000'],
  ['多裝置雲端同步', '單裝置', '即時同步', '即時同步'],
  ['錄音轉文字', '試用額度', '包括', '更多額度'],
  ['高階 AI 模型', '標準', '標準', 'Pro 模型'],
] as const

// ============================================================
//  商業化 · 定價頁（/pricing）
//  ------------------------------------------------------------
//  顯示方案 + 升級 / 管理訂閱入口。
//  未登入 → 先引導 Google 登入；未接 Stripe → 提示「即將推出」。
// ============================================================

export default function Pricing() {
  const { user, configured, signInWithGoogle } = useAuth()
  const { t } = useTranslation()
  const sub = useSubscription()
  const toast = useToast()
  const confirm = useConfirm()
  const [busy, setBusy] = useState<string | null>(null)
  const [cycle, setCycle] = useState<BillingCycle>('monthly')
  const [promo, setPromo] = useState('')

  function applyPromo() {
    if (redeemTestCode(promo)) {
      toast.success('已啟用 Pro 試用。')
      setPromo('')
    } else {
      toast.error('推廣代碼無效')
    }
  }

  async function onPick(plan: Plan) {
    track('pricing_cta_click', { plan: plan.id, cycle })
    if (plan.id === 'free') {
      window.location.href = '/app'
      return
    }
    if (!isBillingConfigured) {
      toast.info(t('pricing.comingSoon'))
      return
    }
    if (!user) {
      if (!configured) {
        toast.error(t('pricing.noAuth'))
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
      toast.error(e instanceof Error ? e.message : t('pricing.checkoutFailed'))
      setBusy(null)
    }
  }

  async function onManage() {
    try {
      setBusy('portal')
      await openBillingPortal()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('pricing.portalFailed'))
      setBusy(null)
    }
  }

  async function onRefund() {
    try {
      setBusy('refund')
      const est = await refundEstimate()
      setBusy(null)
      const ok = await confirm({
        title: '申請退款',
        tone: 'danger',
        confirmText: '確認退款',
        message: `你可退 ${hkd(est.refundCents)}（本期已用 ${Math.round(est.usagePct * 100)}% AI 點數；已扣付款平台手續費 ${hkd(est.feeCents)}）。確認後會即時取消訂閱、收返付費功能。`,
      })
      if (!ok) return
      setBusy('refund')
      const r = await refundRequest()
      if (r.status === 'done') {
        toast.success(`已退款 ${hkd(r.refundCents)}，訂閱已取消。`)
      } else {
        toast.info('退款申請已提交，待管理員審批後處理。')
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '退款失敗，請稍後再試。')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="min-h-screen bg-[color:var(--app-bg)] px-4 py-8 text-slate-900 dark:text-slate-100 sm:px-6 sm:py-12">
      <Helmet>
        <title>{t('pricing.metaTitle')}</title>
        <meta name="description" content={t('pricing.metaDesc')} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={t('pricing.metaTitle')} />
        <meta property="og:description" content={t('pricing.metaDesc')} />
        <meta name="twitter:card" content="summary" />
      </Helmet>

      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-sm text-slate-400 transition hover:text-accent"
          >
            <ArrowLeft size={14} strokeWidth={1.75} /> {t('common.backHome')}
          </Link>
          <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent-soft px-3 py-1 text-xs font-semibold text-accent-strong dark:bg-accent/15 dark:text-accent">
            <UserRound size={14} strokeWidth={1.75} />
            個人老師可即開即用
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            {t('pricing.title')}
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-slate-500 dark:text-slate-400 sm:text-base">
            {t('pricing.subtitle')}
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
                  {c === 'monthly' ? t('pricing.monthly') : t('pricing.annual')}
                  {c === 'annual' && (
                    <span
                      className={`ml-1.5 text-xs ${cycle === c ? 'text-white/80' : 'text-accent'}`}
                    >
                      {t('pricing.annualSave')}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {TRUST_ITEMS.map((item) => {
            const Icon = item.icon
            return (
              <div
                key={item.title}
                className="rounded-xl border border-[color:var(--border)] bg-white/70 p-4 dark:bg-slate-900/40"
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
                    <Icon size={16} strokeWidth={1.75} />
                  </span>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {item.title}
                  </p>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  {item.desc}
                </p>
              </div>
            )
          })}
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {PLANS.map((plan) => {
            const isCurrent = plan.id === sub.plan
            const isUpgrade = (RANK[plan.id] ?? 0) > (RANK[sub.plan] ?? 0)
            const fit = PLAN_FIT[plan.id]
            const FitIcon = fit.icon
            return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-2xl border p-5 shadow-sm sm:p-6 ${
                  plan.highlighted
                    ? 'border-accent bg-white ring-1 ring-accent dark:bg-slate-900/60'
                    : 'border-slate-200 dark:border-slate-800'
                } bg-white/70 dark:bg-slate-900/40`}
              >
                {plan.highlighted && (
                  <span className="absolute -top-3 right-6 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-white">
                    {t('pricing.mostPopular')}
                  </span>
                )}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold">{plan.name}</h2>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {plan.tagline}
                    </p>
                  </div>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
                    <FitIcon size={18} strokeWidth={1.75} />
                  </span>
                </div>
                <div className="mt-4 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-2)] p-3">
                  <p className="text-xs font-semibold text-accent">{fit.label}</p>
                  <p className="mt-1 text-sm font-semibold leading-snug text-slate-800 dark:text-slate-100">
                    {fit.bestFor}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                    {fit.outcome}
                  </p>
                </div>
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
                    plan.id !== 'free' ? (
                      <div className="space-y-2">
                        <button
                          onClick={onManage}
                          disabled={busy === 'portal'}
                          className="w-full rounded-xl border border-slate-300 py-3 font-semibold text-slate-700 transition hover:border-accent hover:text-accent disabled:opacity-50 dark:border-slate-700 dark:text-slate-200"
                        >
                          {busy === 'portal' ? t('pricing.opening') : t('pricing.manage')}
                        </button>
                        <button
                          onClick={onRefund}
                          disabled={busy === 'refund'}
                          className="w-full text-center text-xs text-slate-400 transition hover:text-rose-500 disabled:opacity-50"
                        >
                          {busy === 'refund' ? '處理中…' : '申請退款（按 AI 用量退未用份額）'}
                        </button>
                      </div>
                    ) : (
                      <div className="w-full rounded-xl bg-slate-100 py-3 text-center font-semibold text-slate-400 dark:bg-slate-800">
                        {t('pricing.current')}
                      </div>
                    )
                  ) : sub.isPaid ? (
                    // 已付費用戶轉方案（升 / 降）→ 走 Stripe Portal，Stripe 自動按比例計費
                    <button
                      onClick={onManage}
                      disabled={busy === 'portal'}
                      className="w-full rounded-xl border border-slate-300 py-3 font-semibold text-slate-700 transition hover:border-accent hover:text-accent disabled:opacity-50 dark:border-slate-700 dark:text-slate-200"
                    >
                      {busy === 'portal'
                        ? t('pricing.opening')
                        : `${isUpgrade ? t('pricing.upgrade', { defaultValue: '升級' }) : t('pricing.downgrade', { defaultValue: '降級' })} ${plan.name}`}
                    </button>
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
                        ? t('pricing.processing')
                        : plan.id === 'free'
                          ? t('pricing.startFree')
                          : `${t('pricing.upgrade', { defaultValue: '升級' })} ${plan.name}`}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <section className="mt-8 overflow-hidden rounded-2xl border border-[color:var(--border)] bg-white/80 shadow-sm dark:bg-slate-900/40">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--border)] px-4 py-4 sm:px-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">
                方案建議
              </p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-800 dark:text-slate-100">
                一眼睇清邊個方案啱你
              </h2>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent-strong dark:bg-accent/15 dark:text-accent">
              <Zap size={13} strokeWidth={1.75} />
              先免費試，再按用量升級
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-[0.08em] text-slate-400 dark:bg-slate-800/60 dark:text-slate-500">
                <tr>
                  <th className="px-4 py-3 sm:px-6">項目</th>
                  <th className="px-4 py-3">免費</th>
                  <th className="px-4 py-3">Plus</th>
                  <th className="px-4 py-3">Pro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {COMPARISON_ROWS.map(([label, free, plus, pro]) => (
                  <tr key={label}>
                    <th className="px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 sm:px-6">
                      {label}
                    </th>
                    {[free, plus, pro].map((value, index) => (
                      <td
                        key={`${label}-${index}`}
                        className="px-4 py-3 text-slate-500 dark:text-slate-400"
                      >
                        {value}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 推廣代碼（測試：輸入「NTK」即解鎖 Pro 體驗，未接付款前用） */}
        <div className="mx-auto mt-8 max-w-sm">
          {sub.isTest ? (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-accent/40 bg-accent-soft px-4 py-3 dark:bg-accent/10">
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-accent-strong dark:text-accent">
                <Ticket size={15} /> 已啟用 Pro 試用
              </span>
              <button
                onClick={() => {
                  clearTestPro()
                  toast.info('已取消 Pro 試用')
                }}
                className="inline-flex min-h-11 items-center rounded-lg px-3 text-xs font-medium text-slate-500 transition hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              >
                取消
              </button>
            </div>
          ) : (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
                有推廣代碼？
              </label>
              <div className="flex gap-2">
                <input
                  value={promo}
                  onChange={(e) => setPromo(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && applyPromo()}
                  placeholder="輸入代碼"
                  className="min-h-11 flex-1 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-sm text-slate-800 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30 dark:text-slate-100"
                />
                <button
                  onClick={applyPromo}
                  disabled={!promo.trim()}
                  className="min-h-11 rounded-lg bg-accent px-4 text-sm font-semibold text-white transition hover:bg-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-50"
                >
                  套用
                </button>
              </div>
            </div>
          )}
        </div>

        {!isBillingConfigured && (
          <p className="mt-8 text-center text-xs text-slate-400">
            {t('pricing.notConfiguredPre')}
          </p>
        )}
        <p className="mt-6 text-center text-[11px] leading-relaxed text-slate-400">
          {COMPANY.legalName || COMPANY.brand}
          {COMPANY.brNumber ? ` · 商業登記證 ${COMPANY.brNumber}` : ''}
          {' · 聯絡 '}
          <a className="underline transition hover:text-accent" href={`mailto:${COMPANY.supportEmail}`}>
            {COMPANY.supportEmail}
          </a>
          {' · 價格以港幣（HKD）計。'}
        </p>
      </div>
    </div>
  )
}
