import { Link } from 'react-router-dom'
import { Lock, Loader2, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { FeatureIcon } from '../features/featureIcons'
import type { Feature } from '../features/types'

// ============================================================
//  付費功能上鎖提示
//  ------------------------------------------------------------
//  免費用戶開到要付費嘅功能（requiresPaid）時，唔 render 功能本體，
//  改顯示升級引導。訂閱狀態載入中 → spinner（避免閃一閃）。
// ============================================================

export default function PaidGate({
  feature,
  loading,
}: {
  feature: Feature
  loading?: boolean
}) {
  const { t } = useTranslation()

  if (loading) {
    return (
      <div className="flex justify-center py-20 text-slate-300 dark:text-slate-600">
        <Loader2 size={24} className="animate-spin" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md py-12 text-center">
      <div className="relative mx-auto mb-4 inline-flex">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-soft dark:bg-accent/15">
          <FeatureIcon icon={feature.icon} size={30} className="text-accent" />
        </span>
        <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-accent text-white shadow">
          <Lock size={14} strokeWidth={2.5} />
        </span>
      </div>
      <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">
        {t('gate.title', {
          name: feature.name,
          defaultValue: `「${feature.name}」係付費功能`,
        })}
      </h2>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        {t('gate.desc', {
          defaultValue: '升級 Plus 或 Pro 即可解鎖，仲有更多 AI 點數同錄音額度。',
        })}
      </p>
      <Link
        to="/pricing"
        className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-strong"
      >
        <Sparkles size={15} strokeWidth={2.25} />
        {t('gate.cta', { defaultValue: '睇方案升級' })}
      </Link>
    </div>
  )
}
