import { useState } from 'react'
import { cx } from '../../../ui'
import { fmtDuration } from './store'

// ============================================================
//  自製圖表（純 SVG / div，零 npm 依賴）
//  - 全部用 currentColor / accent，深色自動跟主題
//  - 數字 tabular-nums；hover tooltip 用純 state
// ============================================================

// 8 色調色盤（對齊 calendar CalColor，但喺自己檔重新定義以免 import 共用）
export const PALETTE = {
  accent: { dot: 'bg-accent', text: 'text-accent-strong dark:text-accent', fill: 'var(--accent)', soft: 'bg-accent/15' },
  blue: { dot: 'bg-blue-500', text: 'text-blue-700 dark:text-blue-300', fill: '#3b82f6', soft: 'bg-blue-500/15' },
  green: { dot: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-300', fill: '#10b981', soft: 'bg-emerald-500/15' },
  amber: { dot: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-300', fill: '#f59e0b', soft: 'bg-amber-500/15' },
  rose: { dot: 'bg-rose-500', text: 'text-rose-700 dark:text-rose-300', fill: '#f43f5e', soft: 'bg-rose-500/15' },
  violet: { dot: 'bg-violet-500', text: 'text-violet-700 dark:text-violet-300', fill: '#8b5cf6', soft: 'bg-violet-500/15' },
  cyan: { dot: 'bg-cyan-500', text: 'text-cyan-700 dark:text-cyan-300', fill: '#06b6d4', soft: 'bg-cyan-500/15' },
  pink: { dot: 'bg-pink-500', text: 'text-pink-700 dark:text-pink-300', fill: '#ec4899', soft: 'bg-pink-500/15' },
} as const
export type PaletteKey = keyof typeof PALETTE
export const PALETTE_KEYS = Object.keys(PALETTE) as PaletteKey[]
export function paletteOf(c?: string) {
  return PALETTE[c as PaletteKey] ?? PALETTE.accent
}

// ───────── 直條圖（每日分鐘 / 節數）─────────
export function BarChart({
  data,
  height = 160,
  unit = '分',
  highlightKey,
  goal,
}: {
  data: { key: string; value: number; label: string }[]
  height?: number
  unit?: string
  highlightKey?: string
  goal?: number // 畫一條目標虛線（同 value 單位）
}) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(goal ?? 0, ...data.map((d) => d.value), 1)
  const goalY = goal ? height - (goal / max) * height : null

  return (
    <div className="relative w-full select-none" style={{ height }}>
      {goalY !== null && (
        <div
          className="pointer-events-none absolute inset-x-0 border-t border-dashed border-accent/50"
          style={{ top: goalY }}
        >
          <span className="absolute -top-2 right-0 rounded bg-accent-soft px-1 text-[10px] font-medium tabular-nums text-accent-strong dark:bg-accent/15 dark:text-accent">
            目標 {goal}
          </span>
        </div>
      )}
      <div className="flex h-full items-end gap-[3px]">
        {data.map((d, i) => {
          const h = (d.value / max) * 100
          const on = hover === i
          const isHi = d.key === highlightKey
          return (
            <div
              key={d.key}
              className="group relative flex h-full flex-1 flex-col justify-end"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              <div
                className={cx(
                  'w-full rounded-t-[3px] transition-all duration-300',
                  d.value === 0
                    ? 'bg-slate-100 dark:bg-slate-800'
                    : isHi
                      ? 'bg-accent'
                      : on
                        ? 'bg-accent/80'
                        : 'bg-accent/45 dark:bg-accent/40',
                )}
                style={{ height: `${Math.max(h, d.value > 0 ? 4 : 1.5)}%` }}
              />
              {on && (
                <div className="pointer-events-none absolute -top-1 left-1/2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-slate-900 px-2 py-1 text-center text-[11px] text-white shadow-lg dark:bg-slate-700">
                  <div className="font-medium tabular-nums">{d.value} {unit}</div>
                  <div className="text-[10px] text-slate-300">{d.label}</div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// 直條圖 X 軸標籤（每隔 step 個顯示一次）
export function BarAxis({
  data,
  step = 1,
}: {
  data: { key: string; short: string }[]
  step?: number
}) {
  return (
    <div className="mt-1 flex gap-[3px]">
      {data.map((d, i) => (
        <div
          key={d.key}
          className="flex-1 text-center text-[10px] tabular-nums text-slate-400 dark:text-slate-500"
        >
          {i % step === 0 ? d.short : ''}
        </div>
      ))}
    </div>
  )
}

// ───────── 折線 / 面積圖（趨勢）─────────
export function LineChart({
  values,
  height = 120,
  labels,
}: {
  values: number[]
  height?: number
  labels?: string[]
}) {
  const [hover, setHover] = useState<number | null>(null)
  const w = 300
  const pad = 6
  const max = Math.max(...values, 1)
  const n = values.length
  const x = (i: number) => (n <= 1 ? w / 2 : pad + (i / (n - 1)) * (w - pad * 2))
  const y = (v: number) => height - pad - (v / max) * (height - pad * 2)
  const pts = values.map((v, i) => `${x(i)},${y(v)}`).join(' ')
  const area = `${pad},${height} ${pts} ${w - pad},${height}`

  return (
    <div className="relative w-full" style={{ height }}>
      <svg
        viewBox={`0 0 ${w} ${height}`}
        preserveAspectRatio="none"
        className="h-full w-full overflow-visible"
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="fc-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={area} fill="url(#fc-area)" />
        <polyline
          points={pts}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        {values.map((v, i) => (
          <g key={i}>
            <circle
              cx={x(i)}
              cy={y(v)}
              r={hover === i ? 3.5 : 2}
              fill="var(--accent)"
              stroke="white"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
            <rect
              x={x(i) - (w / n) / 2}
              y={0}
              width={w / n}
              height={height}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
            />
          </g>
        ))}
      </svg>
      {hover !== null && labels && (
        <div
          className="pointer-events-none absolute top-0 -translate-x-1/2 -translate-y-1 rounded-lg bg-slate-900 px-2 py-1 text-center text-[11px] text-white shadow-lg dark:bg-slate-700"
          style={{ left: `${(x(hover) / w) * 100}%` }}
        >
          <div className="font-medium tabular-nums">{fmtDuration(values[hover])}</div>
          <div className="text-[10px] text-slate-300">{labels[hover]}</div>
        </div>
      )}
    </div>
  )
}

// ───────── 環形圖（專案佔比）─────────
export function DonutChart({
  segments,
  size = 132,
  thickness = 16,
  centerLabel,
  centerSub,
}: {
  segments: { value: number; color: string; label: string }[]
  size?: number
  thickness?: number
  centerLabel?: string
  centerSub?: string
}) {
  const [hover, setHover] = useState<number | null>(null)
  const total = segments.reduce((s, x) => s + x.value, 0)
  const r = (size - thickness) / 2
  const c = 2 * Math.PI * r
  let offset = 0

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          className="stroke-slate-100 dark:stroke-slate-800"
          strokeWidth={thickness}
        />
        {total > 0 &&
          segments.map((s, i) => {
            const frac = s.value / total
            const len = frac * c
            const dash = `${len} ${c - len}`
            const dashoffset = -offset
            offset += len
            return (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={paletteOf(s.color).fill}
                strokeWidth={hover === i ? thickness + 3 : thickness}
                strokeDasharray={dash}
                strokeDashoffset={dashoffset}
                className="cursor-pointer transition-all duration-200"
                style={{ opacity: hover === null || hover === i ? 1 : 0.4 }}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
            )
          })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {hover !== null ? (
          <>
            <span className="text-lg font-bold tabular-nums text-slate-800 dark:text-slate-100">
              {Math.round((segments[hover].value / total) * 100)}%
            </span>
            <span className="max-w-[80%] truncate text-[10px] text-slate-400">
              {segments[hover].label}
            </span>
          </>
        ) : (
          <>
            <span className="text-lg font-bold tabular-nums text-slate-800 dark:text-slate-100">
              {centerLabel}
            </span>
            {centerSub && <span className="text-[10px] text-slate-400">{centerSub}</span>}
          </>
        )}
      </div>
    </div>
  )
}

// ───────── 貢獻熱力圖（GitHub 風；近 N 週）─────────
export function Heatmap({
  cells,
  weeks = 18,
  onSelect,
}: {
  cells: { key: string; value: number; label: string }[] // 由舊到新、連續日
  weeks?: number
  onSelect?: (key: string) => void
}) {
  const [hover, setHover] = useState<{ key: string; label: string; value: number } | null>(null)
  const max = Math.max(...cells.map((c) => c.value), 1)
  // 切成 7×weeks（行 = 星期日→六）
  const cols: typeof cells[] = []
  for (let i = 0; i < cells.length; i += 7) cols.push(cells.slice(i, i + 7))

  const level = (v: number) => {
    if (v === 0) return 'bg-slate-100 dark:bg-slate-800'
    const r = v / max
    if (r < 0.3) return 'bg-accent/25'
    if (r < 0.6) return 'bg-accent/50'
    if (r < 0.85) return 'bg-accent/75'
    return 'bg-accent'
  }

  return (
    <div className="relative">
      <div className="flex gap-[3px] overflow-x-auto pb-1">
        {cols.slice(-weeks).map((col, ci) => (
          <div key={ci} className="flex flex-col gap-[3px]">
            {col.map((cell) => (
              <button
                key={cell.key}
                type="button"
                onClick={() => onSelect?.(cell.key)}
                onMouseEnter={() => setHover(cell)}
                onMouseLeave={() => setHover(null)}
                className={cx(
                  'h-3 w-3 shrink-0 rounded-[3px] transition-transform hover:scale-125 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
                  level(cell.value),
                )}
                aria-label={`${cell.label}: ${cell.value} 分`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-end gap-1.5 text-[10px] text-slate-400">
        <span>少</span>
        <span className="h-2.5 w-2.5 rounded-[2px] bg-slate-100 dark:bg-slate-800" />
        <span className="h-2.5 w-2.5 rounded-[2px] bg-accent/25" />
        <span className="h-2.5 w-2.5 rounded-[2px] bg-accent/50" />
        <span className="h-2.5 w-2.5 rounded-[2px] bg-accent/75" />
        <span className="h-2.5 w-2.5 rounded-[2px] bg-accent" />
        <span>多</span>
      </div>
      {hover && (
        <div className="pointer-events-none absolute -top-9 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2 py-1 text-center text-[11px] text-white shadow-lg dark:bg-slate-700">
          <span className="font-medium tabular-nums">{hover.value} 分</span>
          <span className="ml-1 text-[10px] text-slate-300">{hover.label}</span>
        </div>
      )}
    </div>
  )
}

// ───────── 24 小時雷達 / 環形（黃金時段）─────────
export function HourRadial({ hours }: { hours: number[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const size = 168
  const cx2 = size / 2
  const cy2 = size / 2
  const inner = 30
  const outer = 76
  const max = Math.max(...hours, 1)
  const peak = hours.indexOf(max)

  return (
    <div className="relative inline-flex" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={cx2} cy={cy2} r={inner - 4} className="fill-slate-50 dark:fill-slate-800/50" />
        {hours.map((v, h) => {
          const a0 = (h / 24) * 2 * Math.PI - Math.PI / 2
          const a1 = ((h + 1) / 24) * 2 * Math.PI - Math.PI / 2
          const rad = inner + (v / max) * (outer - inner)
          const x0 = cx2 + inner * Math.cos(a0)
          const y0 = cy2 + inner * Math.sin(a0)
          const x1 = cx2 + rad * Math.cos(a0)
          const y1 = cy2 + rad * Math.sin(a0)
          const x2 = cx2 + rad * Math.cos(a1)
          const y2 = cy2 + rad * Math.sin(a1)
          const x3 = cx2 + inner * Math.cos(a1)
          const y3 = cy2 + inner * Math.sin(a1)
          const on = hover === h
          return (
            <path
              key={h}
              d={`M${x0},${y0} L${x1},${y1} A${rad},${rad} 0 0 1 ${x2},${y2} L${x3},${y3} A${inner},${inner} 0 0 0 ${x0},${y0} Z`}
              fill="var(--accent)"
              className="cursor-pointer transition-opacity"
              style={{ opacity: v === 0 ? 0.08 : on ? 1 : 0.55 }}
              onMouseEnter={() => setHover(h)}
              onMouseLeave={() => setHover(null)}
            />
          )
        })}
        {[0, 6, 12, 18].map((h) => {
          const a = (h / 24) * 2 * Math.PI - Math.PI / 2
          const x = cx2 + (outer + 9) * Math.cos(a)
          const y = cy2 + (outer + 9) * Math.sin(a)
          return (
            <text
              key={h}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-slate-400 text-[9px]"
            >
              {h === 0 ? '0' : h}
            </text>
          )
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {hover !== null ? (
          <>
            <span className="text-sm font-bold tabular-nums text-slate-800 dark:text-slate-100">
              {hover}:00
            </span>
            <span className="text-[10px] text-slate-400 tabular-nums">{hours[hover]} 分</span>
          </>
        ) : max > 1 ? (
          <>
            <span className="text-[10px] text-slate-400">黃金時段</span>
            <span className="text-sm font-bold tabular-nums text-accent-strong dark:text-accent">
              {peak}:00
            </span>
          </>
        ) : (
          <span className="text-[10px] text-slate-400">未有資料</span>
        )}
      </div>
    </div>
  )
}
