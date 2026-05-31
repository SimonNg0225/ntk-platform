import { useId } from 'react'
import { cx } from '../../../../ui'
import { fmtDate, round } from './util'

// ============================================================
//  自製折線圖（純 SVG，零 npm 依賴；深色 + 海軍藍 accent）
//  ------------------------------------------------------------
//  TrendChart：單指標逐日折線（含漸層面積、缺值斷線、min/max 軸標）。
//  每個指標各用自己嘅 y 軸（體重 / 體脂% / 骨骼肌 量級唔同，唔可硬疊）。
// ============================================================

export interface SeriesPoint {
  date: string
  value: number | null
}

export function TrendChart({
  data,
  color,
  unit = '',
  height = 180,
}: {
  data: SeriesPoint[]
  color: string
  unit?: string
  height?: number
}) {
  const gid = useId().replace(/[:]/g, '')
  const pts = data
    .map((d, i) => ({ i, date: d.date, value: d.value }))
    .filter((d): d is { i: number; date: string; value: number } => d.value !== null)

  if (pts.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm text-slate-400 dark:text-slate-500"
        style={{ height }}
      >
        呢個區間未有記錄。
      </div>
    )
  }

  const values = pts.map((p) => p.value)
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  // y 軸加少少 padding，單點時造一個對稱範圍避免除零。
  const pad = hi === lo ? Math.max(Math.abs(hi) * 0.05, 1) : (hi - lo) * 0.15
  const yMin = lo - pad
  const yMax = hi + pad
  const span = yMax - yMin || 1

  const n = data.length
  const W = 100
  const padX = 2
  const usableW = W - padX * 2
  const x = (i: number) => (n <= 1 ? W / 2 : padX + (i / (n - 1)) * usableW)
  const y = (v: number) => 6 + (1 - (v - yMin) / span) * 88

  const line = pts.map((p, k) => `${k === 0 ? 'M' : 'L'} ${x(p.i)} ${y(p.value)}`).join(' ')
  const area =
    `M ${x(pts[0].i)} 94 ` +
    pts.map((p) => `L ${x(p.i)} ${y(p.value)}`).join(' ') +
    ` L ${x(pts[pts.length - 1].i)} 94 Z`

  const last = pts[pts.length - 1]

  return (
    <div className="w-full">
      <div className="relative w-full" style={{ height }}>
        {/* y 軸 min / max 標籤 */}
        <span className="absolute left-0 top-0 text-[10px] tabular-nums text-slate-300 dark:text-slate-600">
          {round(hi, 1)}
          {unit}
        </span>
        <span className="absolute bottom-4 left-0 text-[10px] tabular-nums text-slate-300 dark:text-slate-600">
          {round(lo, 1)}
          {unit}
        </span>
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 ml-9 h-full w-[calc(100%-2.25rem)] overflow-visible"
        >
          <defs>
            <linearGradient id={`area-${gid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.26" />
              <stop offset="60%" stopColor={color} stopOpacity="0.04" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#area-${gid})`} />
          <path
            d={line}
            fill="none"
            stroke={color}
            strokeWidth={1.8}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          {pts.map((p) => (
            <circle
              key={p.i}
              cx={x(p.i)}
              cy={y(p.value)}
              r={p.i === last.i ? 2.6 : 1.9}
              fill={color}
              vectorEffect="non-scaling-stroke"
            >
              <title>
                {fmtDate(p.date)}：{round(p.value, 1)}
                {unit}
              </title>
            </circle>
          ))}
        </svg>
      </div>
      {/* x 軸：首 / 中 / 尾日期 */}
      <div className="ml-9 mt-1 flex justify-between text-[10px] tabular-nums text-slate-400 dark:text-slate-500">
        <span>{fmtDate(data[0].date)}</span>
        {n > 2 && <span>{fmtDate(data[Math.floor((n - 1) / 2)].date)}</span>}
        <span>{fmtDate(data[n - 1].date)}</span>
      </div>
    </div>
  )
}

// ───────── 迷你 Sparkline（KPI 卡 / 列表用，無軸） ─────────
export function Sparkline({
  data,
  color,
  width = 72,
  height = 24,
}: {
  data: SeriesPoint[]
  color: string
  width?: number
  height?: number
}) {
  const pts = data
    .map((d, i) => ({ i, value: d.value }))
    .filter((d): d is { i: number; value: number } => d.value !== null)
  if (pts.length < 2) return <span className="inline-block" style={{ width, height }} />

  const values = pts.map((p) => p.value)
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const span = hi - lo || 1
  const n = data.length
  const x = (i: number) => (i / (n - 1)) * width
  const y = (v: number) => 2 + (1 - (v - lo) / span) * (height - 4)
  const line = pts.map((p, k) => `${k === 0 ? 'M' : 'L'} ${x(p.i)} ${y(p.value)}`).join(' ')

  return (
    <svg width={width} height={height} className={cx('overflow-visible')} aria-hidden="true">
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}
