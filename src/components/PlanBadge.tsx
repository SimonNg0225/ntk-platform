import { Crown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSubscription } from '../hooks/useSubscription'

// ============================================================
//  方案徽章（免費版 / Pro / Pro 試用）
//  ------------------------------------------------------------
//  企業級訂閱服務慣例：帳戶區顯示目前方案。
//   - 免費版：中性灰 pill
//   - Pro：實色 accent + 皇冠（premium 感，唔用漸變光暈，跟機構級方向）
//   - 試用中（status=trialing）：Pro · 試用
// ============================================================

export default function PlanBadge({ className = '' }: { className?: string }) {
  const { t } = useTranslation()
  const { isPro, status, loading, isTest } = useSubscription()

  if (loading) {
    return (
      <span
        className={`inline-flex h-[18px] w-12 animate-pulse rounded-md bg-slate-200 dark:bg-slate-700 ${className}`}
        aria-hidden
      />
    )
  }

  if (isPro) {
    const trial = status === 'trialing'
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-md bg-accent px-2 py-0.5 text-[11px] font-bold text-white ${className}`}
      >
        <Crown size={11} strokeWidth={2.25} />
        {isTest
          ? t('shell.planProTest', { defaultValue: 'Pro · 測試' })
          : trial
            ? t('shell.planProTrial', { defaultValue: 'Pro · 試用' })
            : t('shell.planPro', { defaultValue: 'Pro' })}
      </span>
    )
  }

  return (
    <span
      className={`inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400 ${className}`}
    >
      {t('shell.planFree', { defaultValue: '免費版' })}
    </span>
  )
}
