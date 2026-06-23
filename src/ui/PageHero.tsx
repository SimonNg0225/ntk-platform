import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

// ============================================================
//  PageHero — accent masthead（功能頁頂部大色塊）
//  bg-accent 大色塊 + icon chip + uppercase kicker + 大白標題 + 半透明副題。
//  抽自「簡報工作室」SlideGen masthead / WorkDashboard hero，統一各功能頁頂部語言。
//  dark mode 兼容（bg-accent 本身已跨主題）；文字用 props，唔碰共用 i18n。
// ============================================================

export type PageHeroProps = {
  /** 左上 icon chip（lucide 元件） */
  icon: LucideIcon
  /** 細字 kicker（自動轉大寫 + 寬字距），例如 "Slide Studio"。可選。 */
  kicker?: string
  /** 大標題（白色 font-semibold） */
  title: string
  /** 副題（白色半透明）。可選。 */
  description?: string
  /** 右上操作掣（紫底適配，建議用半透明白底掣）。可選。 */
  actions?: ReactNode
  /** hero 內底部分頁切換（紫底上嘅白色 pill）。可選。 */
  tabs?: ReactNode
  /** 額外 class（接落最外層 header） */
  className?: string
}

function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

/**
 * 功能頁頂部 accent hero。
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
  className,
}: PageHeroProps) {
  return (
    <header
      className={cx(
        'relative overflow-hidden rounded-2xl bg-accent px-5 py-5 text-white shadow-sm sm:px-7 sm:py-6',
        className,
      )}
    >
      {/* 裝飾光暈（純視覺） */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/10 blur-3xl"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 -left-10 h-48 w-48 rounded-full bg-white/[0.06] blur-3xl"
      />

      <div className="relative flex items-start gap-3.5">
        {/* icon chip */}
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-white ring-1 ring-inset ring-white/20 backdrop-blur-sm">
          <IconCmp size={24} strokeWidth={1.75} />
        </span>

        <div className="min-w-0 flex-1">
          {kicker && (
            <p className="text-[11px] font-medium uppercase tracking-[0.32em] text-white/70">
              {kicker}
            </p>
          )}
          <h1 className="mt-1 text-2xl font-semibold leading-tight tracking-tight text-white sm:text-3xl">
            {title}
          </h1>
          {description && (
            <p className="mt-1.5 max-w-md text-sm text-white/80">{description}</p>
          )}
        </div>

        {/* 右上操作區（紫底半透明白掣） */}
        {actions && (
          <div className="relative ml-auto flex shrink-0 items-center gap-2 [&_button]:text-white">
            {actions}
          </div>
        )}
      </div>

      {/* hero 內底部分頁切換 */}
      {tabs && <div className="relative mt-4 flex flex-wrap gap-1.5">{tabs}</div>}
    </header>
  )
}

export default PageHero
