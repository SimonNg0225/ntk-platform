import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Lightbulb, X } from 'lucide-react'

// ============================================================
//  FeatureGuide — 統一「功能頁教學引導」
//  顯示某功能「如何使用」的 2–4 步精簡引導（序號 chip + 標題 + 一句說明）。
//  默認不顯示；由 hero「使用說明」掣（GuideHelpButton / PageHero guideKey）
//  toggle 開／關（按一下開、再按收）。transient — 不記 localStorage。
//  視覺跟產品首頁設計系統：白底、淡邊框、清楚步驟、低干擾。
// ============================================================

const TOGGLE_EVENT = 'featureGuide:toggle'

/** Toggle 某功能的教學引導開／關（給 hero「使用說明」掣用）。 */
export function toggleFeatureGuide(storageKey: string) {
  try {
    window.dispatchEvent(new CustomEvent(TOGGLE_EVENT, { detail: storageKey }))
  } catch {
    /* 環境沒有 window 就算 */
  }
}

export type FeatureGuideStep = {
  /** 步驟標題（一句短語） */
  title: string
  /** 一句說明，說明這一步具體做什麼 */
  desc: string
}

export function FeatureGuide({
  title,
  steps,
  storageKey,
}: {
  /** 卡片標題；不傳就用預設「使用說明」 */
  title?: string
  /** 2–4 步引導 */
  steps: FeatureGuideStep[]
  /** 唯一 key（每功能一個）；對應 hero guideKey，給「使用說明」掣 toggle。 */
  storageKey: string
}) {
  const { t } = useTranslation()

  // 默認不顯示；由 hero「使用說明」掣 toggle。transient — 換頁就回復默認收起。
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onToggle = (e: Event) => {
      if ((e as CustomEvent).detail === storageKey) setOpen((v) => !v)
    }
    window.addEventListener(TOGGLE_EVENT, onToggle)
    return () => window.removeEventListener(TOGGLE_EVENT, onToggle)
  }, [storageKey])

  if (!open || steps.length === 0) return null

  const heading = title ?? t('featureGuide.title', { defaultValue: '使用說明' })

  return (
    <section
      aria-label={heading}
      className="rounded-[16px] border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-700/60 dark:bg-slate-900"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-300">
          <Lightbulb size={13} className="shrink-0 text-accent" />
          <span className="truncate">{heading}</span>
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label={t('featureGuide.close', { defaultValue: '收起教學' })}
          className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-3 text-xs font-medium text-slate-400 transition hover:bg-slate-50 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.98] dark:text-slate-500 dark:hover:bg-slate-800/60 dark:hover:text-slate-300"
        >
          {t('featureGuide.dismiss', { defaultValue: '知道了' })}
          <X size={13} className="ml-1" />
        </button>
      </div>

      <ol className="mt-3 space-y-2.5">
        {steps.slice(0, 4).map((step, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-[9px] bg-accent-soft text-xs font-semibold tabular-nums text-accent-strong dark:bg-accent/15 dark:text-accent">
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                {step.title}
              </p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {step.desc}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

/** Hero「使用說明」掣：擺落 PageHero（guideKey），toggle 該功能的教學引導開／關。 */
export function GuideHelpButton({
  storageKey,
  label,
}: {
  storageKey: string
  label?: string
}) {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      onClick={() => toggleFeatureGuide(storageKey)}
      title={t('featureGuide.toggleHint', { defaultValue: '開／關功能教學' })}
      className="inline-flex min-h-11 items-center gap-1.5 rounded-[14px] border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 shadow-xs transition hover:border-accent/30 hover:text-accent active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:text-accent"
    >
      <Lightbulb size={15} />
      {label ?? t('featureGuide.reopen', { defaultValue: '使用說明' })}
    </button>
  )
}
