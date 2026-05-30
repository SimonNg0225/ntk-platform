import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'

// ============================================================
//  NTK UI Kit — 全站共用嘅基礎元件（統一視覺語言）
//  海軍藍主題、圓潤、柔和陰影、一致間距。
// ============================================================

function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

// ───────── Button ─────────
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

const BTN_BASE =
  'inline-flex items-center justify-center gap-1.5 rounded-xl font-medium transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40'
const BTN_VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-strong shadow-sm',
  secondary:
    'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
  ghost: 'text-slate-600 hover:bg-slate-100',
  danger: 'bg-rose-600 text-white hover:bg-rose-700',
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
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
}) {
  return (
    <button
      className={cx(BTN_BASE, BTN_VARIANT[variant], BTN_SIZE[size], className)}
      {...rest}
    >
      {children}
    </button>
  )
}

// ───────── Input / Textarea / Select ─────────
const FIELD =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-accent focus:ring-2 focus:ring-accent/25 disabled:bg-slate-50'

export function Input({
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(FIELD, className)} {...rest} />
}

export function Textarea({
  className,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(FIELD, 'resize-y', className)} {...rest} />
}

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
}: {
  label?: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="block space-y-1">
      {label && (
        <span className="text-xs font-medium text-slate-600">{label}</span>
      )}
      {children}
      {hint && <span className="block text-xs text-slate-400">{hint}</span>}
    </label>
  )
}

// ───────── Card ─────────
export function Card({
  className,
  children,
  onClick,
  hover,
}: {
  className?: string
  children: ReactNode
  onClick?: () => void
  hover?: boolean
}) {
  return (
    <div
      onClick={onClick}
      className={cx(
        'rounded-2xl border border-slate-200/80 bg-white shadow-sm',
        hover && 'transition hover:-translate-y-0.5 hover:shadow-md',
        onClick && 'cursor-pointer',
        className,
      )}
    >
      {children}
    </div>
  )
}

// ───────── Badge ─────────
type BadgeTone = 'slate' | 'accent' | 'green' | 'amber' | 'rose' | 'blue'
const BADGE_TONE: Record<BadgeTone, string> = {
  slate: 'bg-slate-100 text-slate-600',
  accent: 'bg-accent-soft text-accent-strong',
  green: 'bg-emerald-100 text-emerald-700',
  amber: 'bg-amber-100 text-amber-700',
  rose: 'bg-rose-100 text-rose-700',
  blue: 'bg-blue-100 text-blue-700',
}

export function Badge({
  tone = 'slate',
  className,
  children,
}: {
  tone?: BadgeTone
  className?: string
  children: ReactNode
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium',
        BADGE_TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

// ───────── SectionTitle ─────────
export function SectionTitle({
  children,
  right,
}: {
  children: ReactNode
  right?: ReactNode
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        {children}
      </h2>
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
}: {
  icon?: string
  title: string
  hint?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-12 text-center">
      <span className="text-3xl">{icon}</span>
      <p className="mt-3 text-sm font-medium text-slate-600">{title}</p>
      {hint && <p className="mt-1 max-w-xs text-xs text-slate-400">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

// ───────── ProgressBar ─────────
export function ProgressBar({
  value,
  className,
}: {
  value: number // 0-100
  className?: string
}) {
  return (
    <div
      className={cx(
        'h-2 w-full overflow-hidden rounded-full bg-slate-100',
        className,
      )}
    >
      <div
        className="h-full rounded-full bg-accent transition-all"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
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
}: {
  label: string
  value: ReactNode
  unit?: string
  icon?: string
  highlight?: boolean
  onClick?: () => void
}) {
  return (
    <div
      onClick={onClick}
      className={cx(
        'rounded-2xl border p-4 transition',
        highlight
          ? 'border-accent/30 bg-accent-soft'
          : 'border-slate-200 bg-white',
        onClick && 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md',
      )}
    >
      <div className="flex items-center gap-1.5">
        {icon && <span className="text-sm">{icon}</span>}
        <p className="text-xs text-slate-500">{label}</p>
      </div>
      <p
        className={cx(
          'mt-1 text-2xl font-bold',
          highlight ? 'text-accent-strong' : 'text-slate-800',
        )}
      >
        {value}
        {unit && (
          <span className="ml-1 text-sm font-normal text-slate-400">
            {unit}
          </span>
        )}
      </p>
    </div>
  )
}

// ───────── Tabs ─────────
export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: T; label: string }[]
  active: T
  onChange: (id: T) => void
}) {
  return (
    <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cx(
            'flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition',
            active === t.id
              ? 'bg-white text-slate-800 shadow-sm'
              : 'text-slate-500 hover:text-slate-700',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

// ───────── Pills（橫向選擇）─────────
export function Pills<T extends string>({
  options,
  active,
  onChange,
}: {
  options: { id: T; label: string }[]
  active: T
  onChange: (id: T) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={cx(
            'rounded-full px-4 py-1.5 text-sm font-medium transition',
            active === o.id
              ? 'bg-accent text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ───────── Modal ─────────
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6">
        {title && (
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-800">{title}</h3>
            <button
              onClick={onClose}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              aria-label="關閉"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path
                  d="M6 6l12 12M18 6L6 18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        )}
        {children}
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
}: {
  label: string
  onClick?: () => void
  children: ReactNode
  className?: string
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={cx(
        'rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600',
        className,
      )}
    >
      {children}
    </button>
  )
}

export { cx }
