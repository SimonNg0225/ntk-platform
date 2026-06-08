import { createElement, forwardRef, useEffect, useId, useRef, useState } from 'react'
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'
import { Illustration } from '../components/Illustration'
import {
  ArrowDownRight,
  ArrowUpRight,
  Loader2,
  Minus,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

// ============================================================
//  NTK UI Kit — 精煉海軍藍設計系統
//  俐落圓角、克制陰影、線性圖示、完整深色 + focus-visible。
//  全部元件向後相容（保留 export 名 + prop 簽名，只加有預設嘅新 prop）。
// ============================================================

function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

// ───────── Icon helper（emoji 字串 或 lucide 元件都收，向後相容）─────────
export type IconType = string | LucideIcon

function Icon({
  source,
  size = 16,
  strokeWidth = 2,
  className,
}: {
  source?: IconType
  size?: number
  strokeWidth?: number
  className?: string
}) {
  if (!source) return null
  if (typeof source === 'string')
    return <span className={className}>{source}</span>
  const C = source
  return <C size={size} strokeWidth={strokeWidth} className={className} />
}

// ───────── Button ─────────
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

const BTN_BASE =
  'inline-flex items-center justify-center gap-1.5 rounded-xl font-medium transition duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900'
const BTN_VARIANT: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-white hover:bg-accent-strong shadow-sm dark:shadow-none',
  secondary:
    'border border-black/[0.08] bg-white text-slate-700 hover:bg-black/[0.03] dark:border-white/10 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-white/[0.06]',
  ghost:
    'text-slate-600 hover:bg-black/[0.04] hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/[0.06] dark:hover:text-slate-100',
  danger:
    'bg-rose-600 text-white hover:bg-rose-700 dark:bg-rose-600 dark:hover:bg-rose-500',
}
const BTN_SIZE: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  icon,
  iconRight,
  loading = false,
  fullWidth = false,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: LucideIcon
  iconRight?: LucideIcon
  loading?: boolean
  fullWidth?: boolean
}) {
  const LeftIcon = icon
  const RightIcon = iconRight
  return (
    <button
      className={cx(
        BTN_BASE,
        BTN_VARIANT[variant],
        BTN_SIZE[size],
        fullWidth && 'w-full',
        className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <Loader2 size={16} className="animate-spin" />
      ) : (
        LeftIcon && <LeftIcon size={16} strokeWidth={2} />
      )}
      {children}
      {RightIcon && !loading && <RightIcon size={16} strokeWidth={2} />}
    </button>
  )
}

// ───────── Input / Textarea / Select（共用 FIELD）─────────
// ⚠️ 字級：手機強制 16px（text-base），sm: 以上先收返 14px（text-sm）。
//    原因：iOS Safari 撞到 font-size < 16px 嘅 input/textarea/select，focus
//    嗰刻會自動放大 viewport → 用戶見到「每 focus 跳一跳」。≥16px 就唔會 zoom。
//    全 app 表單共用呢個 FIELD，所以喺源頭修一次就全部受惠。
const FIELD =
  'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-base sm:text-sm text-slate-800 shadow-xs outline-none transition placeholder:text-slate-400 focus:border-accent focus:ring-2 focus:ring-accent/30 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:shadow-none dark:disabled:bg-slate-900'

const INVALID = 'border-rose-400 focus:border-rose-400 focus:ring-rose-500/30'

export function Input({
  className,
  icon,
  invalid,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & {
  icon?: LucideIcon
  invalid?: boolean
}) {
  const LeftIcon = icon
  if (LeftIcon) {
    return (
      <div className="relative">
        <LeftIcon
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          className={cx(FIELD, 'pl-9', invalid && INVALID, className)}
          {...rest}
        />
      </div>
    )
  }
  return <input className={cx(FIELD, invalid && INVALID, className)} {...rest} />
}

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      className={cx(FIELD, 'min-h-[80px] resize-y', className)}
      {...rest}
    />
  )
})

export function Select({
  className,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(FIELD, 'cursor-pointer pr-8', className)} {...rest}>
      {children}
    </select>
  )
}

export function Field({
  label,
  hint,
  children,
  required,
  error,
}: {
  label?: string
  hint?: string
  children: ReactNode
  required?: boolean
  error?: string
}) {
  return (
    <label className="block space-y-1.5">
      {label && (
        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
          {label}
          {required && <span className="ml-0.5 text-rose-500">*</span>}
        </span>
      )}
      {children}
      {error ? (
        <span className="block text-xs text-rose-500">{error}</span>
      ) : hint ? (
        <span className="block text-xs text-slate-400 dark:text-slate-500">
          {hint}
        </span>
      ) : null}
    </label>
  )
}

// ───────── Card ─────────
export function Card({
  className,
  children,
  onClick,
  hover,
  as = 'div',
  padded = false,
  clip = false,
}: {
  className?: string
  children: ReactNode
  onClick?: () => void
  hover?: boolean
  as?: 'div' | 'section' | 'article'
  padded?: boolean
  clip?: boolean
}) {
  return createElement(
    as,
    {
      onClick,
      className: cx(
        'rounded-2xl border border-black/[0.06] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-white/[0.08] dark:bg-slate-800 dark:shadow-none',
        hover &&
          'transition duration-200 hover:border-black/[0.1] hover:shadow-[0_8px_24px_rgba(15,23,42,0.08)] dark:hover:border-white/15',
        onClick && 'cursor-pointer',
        padded && 'p-4 sm:p-5',
        clip && 'overflow-hidden',
        className,
      ),
    },
    children,
  )
}

// ───────── Badge ─────────
type BadgeTone = 'slate' | 'accent' | 'green' | 'amber' | 'rose' | 'blue'
const BADGE_TONE: Record<BadgeTone, string> = {
  slate:
    'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700',
  accent:
    'bg-accent-soft text-accent-strong ring-accent/20 dark:bg-accent/15 dark:text-accent dark:ring-accent/25',
  green:
    'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20',
  amber:
    'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20',
  rose: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/20',
  blue: 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500/20',
}
const BADGE_DOT: Record<BadgeTone, string> = {
  slate: 'bg-slate-400',
  accent: 'bg-accent',
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
  blue: 'bg-blue-500',
}

export function Badge({
  tone = 'slate',
  className,
  children,
  dot,
  icon: I,
}: {
  tone?: BadgeTone
  className?: string
  children: ReactNode
  dot?: boolean
  icon?: LucideIcon
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset',
        BADGE_TONE[tone],
        className,
      )}
    >
      {dot && <span className={cx('h-1.5 w-1.5 rounded-full', BADGE_DOT[tone])} />}
      {I && <I size={11} />}
      {children}
    </span>
  )
}

// ───────── SectionTitle ─────────
export function SectionTitle({
  children,
  right,
  description,
  icon: I,
}: {
  children: ReactNode
  right?: ReactNode
  description?: string
  icon?: LucideIcon
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <div>
        <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          {I && <I size={14} />}
          {children}
        </h2>
        {description && (
          <p className="mt-0.5 text-xs font-normal normal-case text-slate-400">
            {description}
          </p>
        )}
      </div>
      {right}
    </div>
  )
}

// ───────── EmptyState ─────────
export function EmptyState({
  icon = '✨',
  title,
  hint,
  action,
  art,
}: {
  icon?: IconType
  title: string
  hint?: string
  action?: ReactNode
  /** public/art/<art>.png 插圖名；有圖就顯示（取代 icon），未生成則靜靜退回 icon/無 */
  art?: string
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-black/[0.1] bg-slate-50/60 px-6 py-12 text-center dark:border-white/[0.12] dark:bg-slate-800/40">
      {art ? (
        <Illustration name={art} className="mb-1 h-28 w-28 object-contain" />
      ) : typeof icon === 'string' ? (
        <span className="text-3xl">{icon}</span>
      ) : (
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
          <Icon source={icon} size={24} strokeWidth={1.75} />
        </span>
      )}
      <p className="mt-3 text-sm font-medium text-slate-600 dark:text-slate-300">
        {title}
      </p>
      {hint && (
        <p className="mt-1 max-w-xs text-xs text-slate-400 dark:text-slate-500">
          {hint}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

// ───────── ProgressBar ─────────
export function ProgressBar({
  value,
  className,
  tone = 'accent',
  size = 'md',
  showValue = false,
}: {
  value: number
  className?: string
  tone?: 'accent' | 'green' | 'amber' | 'rose'
  size?: 'sm' | 'md'
  showValue?: boolean
}) {
  const fill =
    tone === 'green'
      ? 'bg-emerald-500'
      : tone === 'amber'
        ? 'bg-amber-500'
        : tone === 'rose'
          ? 'bg-rose-500'
          : 'bg-accent'
  const v = Math.max(0, Math.min(100, value))
  const bar = (
    <div
      className={cx(
        'w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700',
        size === 'sm' ? 'h-1.5' : 'h-2',
        className,
      )}
    >
      <div
        className={cx('h-full rounded-full transition-all duration-500 ease-out', fill)}
        style={{ width: `${v}%` }}
      />
    </div>
  )
  if (!showValue) return bar
  return (
    <div className="flex items-center gap-2">
      {bar}
      <span className="tabular-nums text-xs text-slate-500 dark:text-slate-400">
        {Math.round(v)}%
      </span>
    </div>
  )
}

// ───────── StatCard ─────────
export function StatCard({
  label,
  value,
  unit,
  icon,
  highlight,
  onClick,
  trend,
  hint,
}: {
  label: string
  value: ReactNode
  unit?: string
  icon?: IconType
  highlight?: boolean
  onClick?: () => void
  trend?: { value: string; dir: 'up' | 'down' | 'flat' }
  hint?: string
}) {
  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick()
              }
            }
          : undefined
      }
      className={cx(
        'relative rounded-2xl border p-4 transition duration-200',
        highlight
          ? 'border-accent/30 bg-accent-soft dark:border-accent/40 dark:bg-accent/15'
          : 'border-black/[0.06] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-white/[0.08] dark:bg-slate-800 dark:shadow-none',
        onClick &&
          'cursor-pointer hover:shadow-[0_8px_24px_rgba(15,23,42,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
      )}
    >
      <div className="flex items-center gap-1.5">
        {icon && (
          <Icon source={icon} size={15} strokeWidth={2} className="text-slate-400" />
        )}
        <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      </div>
      <p
        className={cx(
          'mt-1 text-2xl font-bold tabular-nums slashed-zero',
          highlight
            ? 'text-accent-strong dark:text-accent'
            : 'text-slate-800 dark:text-slate-100',
        )}
      >
        {value}
        {unit && (
          <span className="ml-1 text-sm font-normal text-slate-400">{unit}</span>
        )}
      </p>
      {hint && (
        <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{hint}</p>
      )}
      {trend && (
        <span
          className={cx(
            'absolute right-3 top-3 inline-flex items-center gap-0.5 text-xs font-medium tabular-nums',
            trend.dir === 'up'
              ? 'text-emerald-500'
              : trend.dir === 'down'
                ? 'text-rose-500'
                : 'text-slate-400',
          )}
        >
          {trend.dir === 'up' ? (
            <ArrowUpRight size={14} />
          ) : trend.dir === 'down' ? (
            <ArrowDownRight size={14} />
          ) : (
            <Minus size={14} />
          )}
          {trend.value}
        </span>
      )}
    </div>
  )
}

// ───────── Tabs（滿寬等分；generic）─────────
export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
  size = 'md',
  icons,
}: {
  tabs: { id: T; label: string }[]
  active: T
  onChange: (id: T) => void
  size?: 'sm' | 'md'
  icons?: Partial<Record<T, LucideIcon>>
}) {
  const pad = size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm'
  return (
    <div className="flex w-full gap-1 rounded-xl bg-black/[0.05] p-1 dark:bg-white/[0.07]">
      {tabs.map((t) => {
        const I: LucideIcon | undefined = icons?.[t.id]
        const on = active === t.id
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={cx(
              'flex flex-1 items-center justify-center gap-1.5 rounded-lg font-medium transition duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-1',
              pad,
              on
                ? 'bg-white text-slate-800 shadow-[0_1px_2px_rgba(0,0,0,0.08)] ring-1 ring-black/[0.04] dark:bg-slate-700 dark:text-slate-100 dark:ring-white/10'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200',
            )}
          >
            {I && <I size={15} />}
            {t.label}
          </button>
        )
      })}
    </div>
  )
}

// ───────── Pills（橫向選擇；generic）─────────
export function Pills<T extends string>({
  options,
  active,
  onChange,
  size = 'md',
  counts,
}: {
  options: { id: T; label: string }[]
  active: T
  onChange: (id: T) => void
  size?: 'sm' | 'md'
  counts?: Partial<Record<T, number>>
}) {
  const pad = size === 'sm' ? 'px-3 py-1 text-xs' : 'px-4 py-1.5 text-sm'
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = active === o.id
        const c = counts?.[o.id]
        return (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            className={cx(
              'inline-flex items-center gap-1.5 rounded-full font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900',
              pad,
              on
                ? 'bg-accent text-white shadow-sm dark:shadow-none'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
            )}
          >
            {o.label}
            {typeof c === 'number' && (
              <span
                className={cx(
                  'tabular-nums text-xs',
                  on ? 'text-white/80' : 'text-slate-400',
                )}
              >
                {c}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ───────── Modal ─────────
export function Modal({
  open,
  onClose,
  title,
  children,
  size = 'md',
  footer,
  closeOnBackdrop = true,
  ariaLabel,
}: {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  footer?: ReactNode
  closeOnBackdrop?: boolean
  /** 無障礙名稱：當唔傳 title（自管 masthead）時用。唔傳就自動由面板第一個標題推導。 */
  ariaLabel?: string
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()

  // onClose 經 ref 取最新值。⚠️ 千祈唔好將 onClose 放入下面 effect 嘅 deps：
  // 好多 caller 傳 inline arrow（onClose={() => {…}}），每次父組件 render 都係新
  // ref。若入 deps，喺 modal 入面打字（每個 keystroke setState → 父 re-render →
  // 新 onClose）就會令 effect 重跑：cleanup 嘅 prevActive.focus() 同 effect 嘅
  // panel.focus() 會喺每一下打字搶走輸入框焦點 → 用戶見到「每打一字跳一跳／
  // 打唔到字」。改用 ref 後，focus 管理 effect 只喺 open 真正切換先跑一次。
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  // 開啟時：鎖 body 捲動、初始焦點入面板、Esc 關閉、Tab focus-trap；
  // 關閉/卸載時還原焦點同捲動（無障礙對話框標準行為）。
  useEffect(() => {
    if (!open) return
    const prevActive = document.activeElement as HTMLElement | null
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // 無障礙名稱（dialog accessible name）：完全由呢個 effect 以 DOM 管理，
    // JSX 唔再宣告 aria-labelledby/aria-label，咁 parent re-render（例如喺 modal
    // 入面打字）就唔會 reconcile 清走佢。title 模式 → 指返個預設 h3；自管 masthead
    // （無 title）模式 → 指面板第一個標題（h1/h2/h3 或 [data-modal-title]），
    // 冇標題就用 ariaLabel prop / 通用 fallback。喺 focus 前 set，focus 入嚟即讀到。
    const panel = panelRef.current
    if (panel) {
      let labelId: string | null = null
      if (title) {
        labelId = titleId
      } else {
        const heading = panel.querySelector<HTMLElement>('h1, h2, h3, [data-modal-title]')
        if (heading) {
          if (!heading.id) heading.id = titleId
          labelId = heading.id
        }
      }
      if (labelId) {
        panel.setAttribute('aria-labelledby', labelId)
        panel.removeAttribute('aria-label')
      } else {
        panel.removeAttribute('aria-labelledby')
        panel.setAttribute('aria-label', ariaLabel ?? '對話框')
      }
    }

    panel?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab') return
      const panel = panelRef.current
      if (!panel) return
      const nodes = panel.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])',
      )
      if (nodes.length === 0) return
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      const active = document.activeElement
      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      prevActive?.focus?.()
    }
    // 只跟 open；onClose 走 ref（見上）。唔好加返 onClose 入 deps。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null
  const maxW =
    size === 'sm'
      ? 'max-w-sm'
      : size === 'lg'
        ? 'max-w-2xl'
        : size === 'xl'
          ? 'max-w-3xl'
          : 'max-w-lg'
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 animate-fade-in bg-slate-900/50 backdrop-blur-sm"
        onClick={closeOnBackdrop ? onClose : undefined}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={cx(
          'relative z-10 max-h-[85vh] w-full animate-scale-in overflow-y-auto rounded-t-3xl border border-black/[0.06] bg-white p-5 shadow-overlay focus:outline-none dark:border-white/[0.08] dark:bg-slate-800 sm:rounded-3xl sm:p-6',
          maxW,
        )}
      >
        {title && (
          <div className="mb-4 flex items-center justify-between">
            <h3
              id={titleId}
              className="text-[17px] font-semibold tracking-tight text-slate-800 dark:text-slate-100"
            >
              {title}
            </h3>
            <button
              onClick={onClose}
              className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:hover:bg-slate-700"
              aria-label="關閉"
            >
              <X size={18} />
            </button>
          </div>
        )}
        {children}
        {footer && (
          <div className="mt-5 flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

// ───────── IconButton ─────────
export function IconButton({
  label,
  onClick,
  children,
  className,
  size = 'md',
  tone = 'default',
  disabled,
  active,
}: {
  label: string
  onClick?: () => void
  children: ReactNode
  className?: string
  size?: 'sm' | 'md'
  tone?: 'default' | 'danger'
  disabled?: boolean
  active?: boolean
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      disabled={disabled}
      className={cx(
        'inline-flex items-center justify-center rounded-xl transition duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-1 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-40 dark:focus-visible:ring-offset-slate-900',
        size === 'sm' ? 'p-1' : 'p-1.5',
        active
          ? 'bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent'
          : tone === 'danger'
            ? 'text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:text-slate-500 dark:hover:bg-rose-500/10'
            : 'text-slate-400 hover:bg-black/[0.05] hover:text-slate-600 dark:text-slate-500 dark:hover:bg-white/[0.06] dark:hover:text-slate-300',
        className,
      )}
    >
      {children}
    </button>
  )
}

// ============================================================
//  新 primitives（專業 UI 必備）
// ============================================================

// ───────── Kbd ─────────
export function Kbd({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <kbd
      className={cx(
        'inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-[5px] border border-slate-200 bg-slate-50 px-1.5 font-mono text-[10px] font-medium leading-none tabular-nums text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400',
        className,
      )}
    >
      {children}
    </kbd>
  )
}

// ───────── Separator ─────────
export function Separator({
  orientation = 'horizontal',
  label,
  className,
}: {
  orientation?: 'horizontal' | 'vertical'
  label?: string
  className?: string
}) {
  if (label)
    return (
      <div className={cx('flex items-center gap-3', className)} role="separator">
        <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700/60" />
        <span className="text-xs text-slate-400">{label}</span>
        <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700/60" />
      </div>
    )
  return (
    <div
      role="separator"
      className={cx(
        orientation === 'vertical' ? 'h-full w-px' : 'h-px w-full',
        'bg-slate-200 dark:bg-slate-700/60',
        className,
      )}
    />
  )
}

// ───────── Skeleton ─────────
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cx(
        'relative overflow-hidden rounded-md bg-slate-100 dark:bg-slate-800',
        className,
      )}
    >
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent dark:via-slate-700/40" />
    </div>
  )
}

export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number
  className?: string
}) {
  return (
    <div className={cx('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cx('h-3.5', i === lines - 1 ? 'w-2/3' : 'w-full')}
        />
      ))}
    </div>
  )
}

// ───────── Tooltip（純 CSS group-hover）─────────
export function Tooltip({
  label,
  side = 'top',
  children,
}: {
  label: string
  side?: 'top' | 'bottom' | 'left' | 'right'
  children: ReactNode
}) {
  const pos =
    side === 'bottom'
      ? 'left-1/2 top-full mt-1.5 -translate-x-1/2'
      : side === 'left'
        ? 'right-full top-1/2 mr-1.5 -translate-y-1/2'
        : side === 'right'
          ? 'left-full top-1/2 ml-1.5 -translate-y-1/2'
          : 'bottom-full left-1/2 mb-1.5 -translate-x-1/2'
  return (
    <span className="group relative inline-flex">
      {children}
      <span
        role="tooltip"
        className={cx(
          'pointer-events-none absolute z-50 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-md transition-opacity group-hover:opacity-100 dark:bg-slate-700',
          pos,
        )}
      >
        {label}
      </span>
    </span>
  )
}

// ───────── PageHeader ─────────
export function PageHeader({
  title,
  description,
  icon: I,
  breadcrumb,
  actions,
}: {
  title: string
  description?: string
  icon?: LucideIcon
  breadcrumb?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-3">
        {I && (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
            <I size={18} />
          </span>
        )}
        <div>
          {breadcrumb && (
            <div className="mb-0.5 text-xs text-slate-400">{breadcrumb}</div>
          )}
          <h1 className="text-lg font-semibold tracking-tight text-slate-800 dark:text-slate-100">
            {title}
          </h1>
          {description && (
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              {description}
            </p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </div>
  )
}

// ───────── Table 家族 ─────────
export function Table({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cx(
        'overflow-x-auto rounded-2xl border border-black/[0.06] dark:border-white/[0.08]',
        className,
      )}
    >
      <table className="w-full text-sm">{children}</table>
    </div>
  )
}
export function Thead({ children }: { children: ReactNode }) {
  return (
    <thead className="border-b border-slate-200 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-800/60">
      {children}
    </thead>
  )
}
export function Tbody({ children }: { children: ReactNode }) {
  return (
    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
      {children}
    </tbody>
  )
}
export function Tr({
  children,
  onClick,
}: {
  children: ReactNode
  onClick?: () => void
}) {
  return (
    <tr
      onClick={onClick}
      className={cx(
        'transition-colors',
        onClick && 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50',
      )}
    >
      {children}
    </tr>
  )
}
export function Th({
  children,
  align = 'left',
  className,
}: {
  children?: ReactNode
  align?: 'left' | 'center' | 'right'
  className?: string
}) {
  return (
    <th
      className={cx(
        'px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400',
        align === 'right'
          ? 'text-right'
          : align === 'center'
            ? 'text-center'
            : 'text-left',
        className,
      )}
    >
      {children}
    </th>
  )
}
export function Td({
  children,
  align = 'left',
  numeric = false,
  className,
}: {
  children?: ReactNode
  align?: 'left' | 'center' | 'right'
  numeric?: boolean
  className?: string
}) {
  return (
    <td
      className={cx(
        'px-3 py-2.5 text-slate-700 dark:text-slate-200',
        numeric
          ? 'text-right tabular-nums slashed-zero'
          : align === 'right'
            ? 'text-right'
            : align === 'center'
              ? 'text-center'
              : 'text-left',
        className,
      )}
    >
      {children}
    </td>
  )
}

// ───────── Menu（下拉，outside-click + Esc 關閉）─────────
export function Menu({
  trigger,
  items,
  align = 'end',
  label = '更多操作',
}: {
  trigger: ReactNode
  items: {
    id: string
    label: string
    icon?: LucideIcon
    onSelect: () => void
    tone?: 'default' | 'danger'
    disabled?: boolean
  }[]
  align?: 'start' | 'end'
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])
  return (
    <div ref={ref} className="relative inline-flex">
      <button
        type="button"
        className="inline-flex"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {trigger}
      </button>
      {open && (
        <div
          className={cx(
            'absolute top-full z-50 mt-1 min-w-[10rem] animate-scale-in rounded-xl border border-black/[0.08] bg-white p-1 shadow-lg dark:border-white/10 dark:bg-slate-800',
            align === 'end' ? 'right-0' : 'left-0',
          )}
        >
          {items.map((it) => (
            <button
              key={it.id}
              type="button"
              disabled={it.disabled}
              onClick={() => {
                it.onSelect()
                setOpen(false)
              }}
              className={cx(
                'flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors disabled:opacity-40',
                it.tone === 'danger'
                  ? 'text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10'
                  : 'text-slate-700 hover:bg-black/[0.04] dark:text-slate-200 dark:hover:bg-white/[0.06]',
              )}
            >
              {it.icon && <it.icon size={15} />}
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ───────── SegmentedControl（緊湊二三選一；generic）─────────
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
}: {
  options: { id: T; label: string; icon?: LucideIcon }[]
  value: T
  onChange: (id: T) => void
  size?: 'sm' | 'md'
}) {
  const pad = size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm'
  return (
    <div className="inline-flex rounded-full bg-black/[0.05] p-0.5 dark:bg-white/[0.07]">
      {options.map((o) => {
        const on = value === o.id
        return (
          <button
            key={o.id}
            type="button"
            aria-label={o.label || o.id}
            aria-pressed={on}
            onClick={() => onChange(o.id)}
            className={cx(
              'inline-flex items-center gap-1.5 rounded-full font-medium transition duration-200 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
              pad,
              on
                ? 'bg-white text-slate-800 shadow-[0_1px_2px_rgba(0,0,0,0.08)] ring-1 ring-black/[0.04] dark:bg-slate-700 dark:text-slate-100 dark:ring-white/10'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200',
            )}
          >
            {o.icon && <o.icon size={15} />}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

// ───────── OptionButtons（滿寬描邊選項；揀一個；generic）─────────
// 同 SegmentedControl 唔同：呢個係 flex-1 平分嘅描邊大按鈕，選中用 accent 實色填充，
// 適合放入 Field 做表單揀選（性別、就讀狀態…）。
// clearable=true：再撳返已選嗰個會清空（onChange 收 ''），用喺可有可無嘅欄位（如性別）；
// clearable=false（預設）：淨係切換，唔會取消，用喺必填欄位（如就讀狀態）。
export function OptionButtons<T extends string>({
  options,
  value,
  onChange,
  clearable = false,
}: {
  options: { id: T; label: string }[]
  value: T | ''
  onChange: (value: T | '') => void
  clearable?: boolean
}) {
  return (
    <div className="flex gap-2">
      {options.map((o) => {
        const on = value === o.id
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(clearable && on ? '' : o.id)}
            className={cx(
              'flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900',
              on
                ? 'border-accent bg-accent text-white shadow-sm shadow-accent/20'
                : 'border-black/[0.08] bg-white text-slate-600 hover:bg-black/[0.03] dark:border-white/10 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-white/[0.06]',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

// ───────── Avatar ─────────
export function Avatar({
  name,
  src,
  size = 'sm',
}: {
  name?: string
  src?: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
}) {
  const dim =
    size === 'xs'
      ? 'h-5 w-5 text-[10px]'
      : size === 'md'
        ? 'h-9 w-9 text-sm'
        : size === 'lg'
          ? 'h-11 w-11 text-base'
          : 'h-7 w-7 text-xs'
  if (src)
    return (
      <img
        src={src}
        alt={name ?? ''}
        className={cx(
          'rounded-full object-cover ring-1 ring-inset ring-slate-900/5 dark:ring-white/10',
          dim,
        )}
      />
    )
  const initials = (name ?? '?').trim().charAt(0).toUpperCase()
  return (
    <span
      className={cx(
        'inline-flex items-center justify-center rounded-full bg-accent-soft font-medium text-accent-strong dark:bg-accent/15 dark:text-accent',
        dim,
      )}
    >
      {initials}
    </span>
  )
}

export { cx }
