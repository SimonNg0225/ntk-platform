import { useMemo, useState } from 'react'
import { cx } from '../../../ui'
import type { NotesStats, TagCount } from './util'

// ============================================================
//  自製 SVG / div 圖表（零依賴）
//  - ActivityChart：過去 30 日新增筆記面積折線圖（hover tooltip）
//  - TagBars：標籤用量水平長條
//  - DonutChart：筆記本分佈環圈圖
// ============================================================

// ───────── 30 日活躍面積折線圖 ─────────
export function ActivityChart({ daily }: { daily: NotesStats['daily'] }) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 640
  const H = 150
  const padX = 8
  const padY = 14
  const max = Math.max(1, ...daily.map((d) => d.count))
  const n = daily.length
  const innerW = W - padX * 2
  const innerH = H - padY * 2
  const x = (i: number) => padX + (n <= 1 ? 0 : (i / (n - 1)) * innerW)
  const y = (v: number) => padY + innerH - (v / max) * innerH

  const { line, area } = useMemo(() => {
    if (!daily.length) return { line: '', area: '' }
    const pts = daily.map((d, i) => `${x(i).toFixed(1)},${y(d.count).toFixed(1)}`)
    const l = `M ${pts.join(' L ')}`
    const a = `${l} L ${x(n - 1).toFixed(1)},${(H - padY).toFixed(1)} L ${x(0).toFixed(1)},${(H - padY).toFixed(1)} Z`
    return { line: l, area: a }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daily])

  const total = daily.reduce((s, d) => s + d.count, 0)

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label="過去 30 日新增筆記"
      >
        <defs>
          <linearGradient id="notesAreaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* 水平基準線 */}
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={padX}
            x2={W - padX}
            y1={padY + innerH * f}
            y2={padY + innerH * f}
            className="stroke-slate-100 dark:stroke-slate-700/50"
            strokeWidth={1}
          />
        ))}
        {total > 0 && (
          <>
            <path d={area} fill="url(#notesAreaFill)" />
            <path
              d={line}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </>
        )}
        {/* hover 點 + 命中區 */}
        {daily.map((d, i) => (
          <g key={d.key}>
            {d.count > 0 && (
              <circle
                cx={x(i)}
                cy={y(d.count)}
                r={hover === i ? 4 : 2.5}
                className={cx(
                  'transition-all',
                  hover === i ? 'fill-accent-strong' : 'fill-accent',
                )}
              />
            )}
            <rect
              x={x(i) - innerW / n / 2}
              y={0}
              width={innerW / n}
              height={H}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          </g>
        ))}
      </svg>
      {hover !== null && daily[hover] && (
        <div
          className="pointer-events-none absolute -top-1 z-10 -translate-x-1/2 -translate-y-full rounded-lg bg-slate-900 px-2 py-1 text-center text-[11px] font-medium text-white shadow-md dark:bg-slate-700"
          style={{ left: `${(hover / Math.max(1, daily.length - 1)) * 100}%` }}
        >
          <div className="tabular-nums">{daily[hover].label}</div>
          <div className="tabular-nums text-accent-soft">
            {daily[hover].count} 則
          </div>
        </div>
      )}
      {/* X 軸標籤（首 / 中 / 尾） */}
      <div className="mt-1 flex justify-between px-1 text-[10px] tabular-nums text-slate-400 dark:text-slate-500">
        <span>{daily[0]?.label}</span>
        <span>{daily[Math.floor(daily.length / 2)]?.label}</span>
        <span>{daily[daily.length - 1]?.label}</span>
      </div>
    </div>
  )
}

// ───────── 標籤水平長條 ─────────
const BAR_COLORS = [
  'bg-accent',
  'bg-blue-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-violet-500',
  'bg-rose-500',
  'bg-cyan-500',
  'bg-pink-500',
]
export function TagBars({
  tags,
  onPick,
}: {
  tags: TagCount[]
  onPick?: (tag: string) => void
}) {
  const max = Math.max(1, ...tags.map((t) => t.count))
  if (!tags.length)
    return (
      <p className="py-6 text-center text-xs text-slate-400 dark:text-slate-500">
        仲未有 #標籤
      </p>
    )
  return (
    <div className="space-y-2">
      {tags.map((t, i) => (
        <button
          key={t.tag}
          type="button"
          onClick={() => onPick?.(t.tag)}
          className="group block w-full text-left"
        >
          <div className="mb-0.5 flex items-center justify-between text-xs">
            <span className="truncate font-medium text-slate-600 group-hover:text-accent-strong dark:text-slate-300 dark:group-hover:text-accent">
              #{t.tag}
            </span>
            <span className="tabular-nums text-slate-400 dark:text-slate-500">
              {t.count}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700/60">
            <div
              className={cx(
                'h-full rounded-full transition-all duration-500 ease-out',
                BAR_COLORS[i % BAR_COLORS.length],
              )}
              style={{ width: `${(t.count / max) * 100}%` }}
            />
          </div>
        </button>
      ))}
    </div>
  )
}

// ───────── 環圈圖（筆記本分佈）─────────
export interface DonutSlice {
  label: string
  value: number
  color: string // tailwind text-* 用嚟取 stroke
}
const DONUT_STROKE: Record<string, string> = {
  slate: 'stroke-slate-400',
  accent: 'stroke-accent',
  blue: 'stroke-blue-500',
  green: 'stroke-emerald-500',
  amber: 'stroke-amber-500',
  rose: 'stroke-rose-500',
  violet: 'stroke-violet-500',
  cyan: 'stroke-cyan-500',
}
const DONUT_DOT: Record<string, string> = {
  slate: 'bg-slate-400',
  accent: 'bg-accent',
  blue: 'bg-blue-500',
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
  violet: 'bg-violet-500',
  cyan: 'bg-cyan-500',
}
export function DonutChart({ slices }: { slices: DonutSlice[] }) {
  const total = slices.reduce((s, x) => s + x.value, 0)
  const R = 42
  const C = 2 * Math.PI * R
  let acc = 0
  if (!total)
    return (
      <p className="py-6 text-center text-xs text-slate-400 dark:text-slate-500">
        仲未有資料
      </p>
    )
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 100 100" className="h-28 w-28 shrink-0 -rotate-90">
        <circle
          cx="50"
          cy="50"
          r={R}
          fill="none"
          className="stroke-slate-100 dark:stroke-slate-700/60"
          strokeWidth={12}
        />
        {slices.map((s) => {
          const frac = s.value / total
          const dash = frac * C
          const seg = (
            <circle
              key={s.label}
              cx="50"
              cy="50"
              r={R}
              fill="none"
              className={cx(DONUT_STROKE[s.color] ?? DONUT_STROKE.slate)}
              strokeWidth={12}
              strokeDasharray={`${dash.toFixed(2)} ${(C - dash).toFixed(2)}`}
              strokeDashoffset={(-acc).toFixed(2)}
              strokeLinecap="butt"
            />
          )
          acc += dash
          return seg
        })}
        <text
          x="50"
          y="50"
          className="rotate-90 fill-slate-700 text-[16px] font-bold tabular-nums dark:fill-slate-100"
          textAnchor="middle"
          dominantBaseline="central"
          transform="rotate(90 50 50)"
        >
          {total}
        </text>
      </svg>
      <div className="min-w-0 flex-1 space-y-1.5">
        {slices.map((s) => (
          <div key={s.label} className="flex items-center gap-2 text-xs">
            <span
              className={cx(
                'h-2.5 w-2.5 shrink-0 rounded-full',
                DONUT_DOT[s.color] ?? DONUT_DOT.slate,
              )}
            />
            <span className="min-w-0 flex-1 truncate text-slate-600 dark:text-slate-300">
              {s.label}
            </span>
            <span className="tabular-nums text-slate-400 dark:text-slate-500">
              {s.value}
            </span>
            <span className="w-9 text-right tabular-nums text-slate-400 dark:text-slate-500">
              {Math.round((s.value / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
