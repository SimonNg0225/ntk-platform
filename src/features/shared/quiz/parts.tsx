import { Check, X } from 'lucide-react'
import { cx } from '../../../ui'

// ============================================================
//  QuizMode 共用小元件（做題 + 結果頁共用）
// ============================================================

// ───────── MC 選項列 ─────────
export function OptionRow({
  index,
  text,
  selected,
  graded,
  isAnswer,
  disabled,
  shortcut,
  onClick,
}: {
  index: number
  text: string
  selected: boolean
  graded: boolean // 已批改（顯示對錯著色）
  isAnswer: boolean // 係正確答案
  disabled?: boolean
  shortcut?: string // 鍵盤提示（A/B/C…）
  onClick?: () => void
}) {
  const wrongPick = graded && selected && !isAnswer

  let tone: string
  if (graded) {
    if (isAnswer)
      tone =
        'border-emerald-400 bg-emerald-50 text-emerald-700 dark:border-emerald-500/50 dark:bg-emerald-500/15 dark:text-emerald-300'
    else if (wrongPick)
      tone =
        'border-rose-400 bg-rose-50 text-rose-700 dark:border-rose-500/50 dark:bg-rose-500/15 dark:text-rose-300'
    else
      tone =
        'border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
  } else if (selected) {
    tone =
      'border-accent bg-accent-soft text-accent-strong dark:border-accent/60 dark:bg-accent/15 dark:text-accent'
  } else {
    tone =
      'border-slate-200 bg-white text-slate-700 hover:border-accent/50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cx(
        'flex w-full items-start gap-2.5 rounded-xl border p-3 text-left text-sm transition disabled:cursor-default',
        tone,
      )}
    >
      <span
        className={cx(
          'flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold',
          selected && !graded
            ? 'bg-accent text-white'
            : graded && isAnswer
              ? 'bg-emerald-500 text-white'
              : wrongPick
                ? 'bg-rose-500 text-white'
                : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300',
        )}
      >
        {shortcut ?? String.fromCharCode(65 + index)}
      </span>
      <span className="flex-1 pt-0.5">{text}</span>
      {graded && isAnswer && (
        <Check size={16} strokeWidth={2.5} className="mt-1 shrink-0 text-emerald-600 dark:text-emerald-400" />
      )}
      {wrongPick && (
        <X size={16} strokeWidth={2.5} className="mt-1 shrink-0 text-rose-600 dark:text-rose-400" />
      )}
    </button>
  )
}

// ───────── 計時環（Kahoot 風，SVG 進度環）─────────
export function CountdownRing({
  remaining,
  total,
  size = 52,
}: {
  remaining: number
  total: number
  size?: number
}) {
  const r = (size - 8) / 2
  const c = 2 * Math.PI * r
  const ratio = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0
  const danger = remaining <= 5
  const warn = remaining <= 10
  const stroke = danger
    ? 'stroke-rose-500'
    : warn
      ? 'stroke-amber-500'
      : 'stroke-accent'
  const textCls = danger
    ? 'fill-rose-600 dark:fill-rose-400'
    : warn
      ? 'fill-amber-600 dark:fill-amber-400'
      : 'fill-slate-700 dark:fill-slate-200'
  return (
    <svg width={size} height={size} className={cx('-rotate-90', danger && 'animate-pulse')}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={5}
        className="stroke-slate-100 dark:stroke-slate-800"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={5}
        strokeLinecap="round"
        className={cx(stroke, 'transition-[stroke-dashoffset] duration-1000 ease-linear')}
        strokeDasharray={c}
        strokeDashoffset={c * (1 - ratio)}
      />
      <text
        x={size / 2}
        y={size / 2}
        textAnchor="middle"
        dominantBaseline="central"
        transform={`rotate(90 ${size / 2} ${size / 2})`}
        className={cx('text-sm font-bold tabular-nums', textCls)}
      >
        {Math.ceil(remaining)}
      </text>
    </svg>
  )
}
