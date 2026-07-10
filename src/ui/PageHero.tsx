import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { GuideHelpButton } from './FeatureGuide'

// ============================================================
//  PageHero — 功能頁標準 masthead
//  以留白和底部分隔線建立層次，避免每個功能頁都由一張大型卡片開始。
// ============================================================

export type PageHeroProps = {
  /** 左上 icon chip（lucide 元件） */
  icon: LucideIcon
  /** 細字 kicker，例如 "Slide Studio"。可選。 */
  kicker?: string
  /** 大標題 */
  title: string
  /** 副題。可選。 */
  description?: string
  /** 右上操作掣。舊式白字/半透明白底 action 會由 CSS compatibility layer 自動轉淡。 */
  actions?: ReactNode
  /** hero 內底部分頁切換（紫底上的白色 pill）。可選。 */
  tabs?: ReactNode
  /** 傳教學引導的 storageKey → hero 右上自動加「使用說明」掣，隨時叫返該功能教學。 */
  guideKey?: string
  /** 額外 class（接落最外層 header） */
  className?: string
}

function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

/**
 * 功能頁頂部標準 masthead。
 *
 * @example
 * <PageHero
 *   icon={Presentation}
 *   kicker={t('slideGen.kicker', { defaultValue: 'Slide Studio' })}
 *   title={t('slideGen.title', { defaultValue: '簡報工作室' })}
 *   description={t('slideGen.subtitle', { defaultValue: '四步引導砌好教學簡報…' })}
 *   actions={<button className="…">設定</button>}
 *   tabs={<nav className="…">…</nav>}
 * />
 */
export function PageHero({
  icon: IconCmp,
  kicker,
  title,
  description,
  actions,
  tabs,
  guideKey,
  className,
}: PageHeroProps) {
  return (
    <header
      className={cx(
        'et-feature-hero relative border-b border-slate-200/80 px-1 pb-5 pt-1 text-slate-900 dark:border-slate-800 dark:text-slate-100 sm:pb-6',
        className,
      )}
    >
      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-3.5">
        {/* icon chip + 標題（永遠同一行；手機不會給操作掣逼到爆行斷字） */}
        <div className="flex min-w-0 items-start gap-3.5 sm:flex-1">
          {/* icon chip */}
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
            <IconCmp size={22} strokeWidth={1.75} />
          </span>

          <div className="min-w-0 flex-1">
            {kicker && (
              <p className="text-xs font-semibold text-accent">
                {kicker}
              </p>
            )}
            <h1 className="mt-0.5 text-[24px] font-semibold leading-tight text-slate-950 dark:text-slate-100 sm:text-[28px]">
              {title}
            </h1>
            {description && (
              <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                {description}
              </p>
            )}
          </div>
        </div>

        {/* 操作區：手機跌落標題下面（flex-wrap，不逼標題），sm+ 返右上角。 */}
        {(actions || guideKey) && (
          <div className="et-feature-hero-actions relative flex flex-wrap items-center gap-2 text-slate-600 sm:ml-auto sm:shrink-0 dark:text-slate-300">
            {guideKey && <GuideHelpButton storageKey={guideKey} />}
            {actions}
          </div>
        )}
      </div>

      {/* hero 內底部分頁切換 */}
      {tabs && <div className="et-feature-hero-tabs relative mt-4 flex flex-wrap gap-1.5">{tabs}</div>}
    </header>
  )
}

export default PageHero
