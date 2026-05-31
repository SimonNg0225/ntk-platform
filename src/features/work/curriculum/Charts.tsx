import { useId } from 'react'
import { cx } from '../../../ui'

// ============================================================
//  自製 SVG 圖表（零依賴）— 課程進度專用
//  - DonutChart：整體完成度環形圖（多段）
//  - PacingChart：計劃 vs 實際累積完成（折線 + 區域）
//  - AreaBars：各範疇完成度橫條
// ============================================================

// ───────── 共用色 token（同 STATUS_META 對齊）─────────
const SEG_FILL = {
  green: 'fill-emerald-500',
  amber: 'fill-amber-400',
  slate: 'fill-slate-200 dark:fill-slate-700',
  accent: 'fill-accent',
} as const

type SegColor = keyof typeof SEG_FILL

// ───────── DonutWithLegend（環形多段 + 圖例，自管 relative 容器）─────────
export function DonutWithLegend({
  segments,
  centerLabel,
  centerSub,
}: {
  segments: { value: number; color: SegColor; label: string }[]
  centerLabel: string
  centerSub?: string
}) {
  const size = 132
  const stroke = 14
  const r = (size - stroke) / 2
  const c = size / 2
  const circ = 2 * Math.PI * r
  const total = segments.reduce((s, x) => s + x.value, 0) || 1
  let offset = 0

  const dotClass: Record<SegColor, string> = {
    green: 'bg-emerald-500',
    amber: 'bg-amber-400',
    slate: 'bg-slate-200 dark:bg-slate-700',
    accent: 'bg-accent',
  }

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
          role="img"
          aria-label={`完成度 ${centerLabel}`}
        >
          <circle
            cx={c}
            cy={c}
            r={r}
            fill="none"
            strokeWidth={stroke}
            className="stroke-slate-100 dark:stroke-slate-800"
          />
          {segments
            .filter((s) => s.value > 0)
            .map((s, i) => {
              const frac = s.value / total
              const len = frac * circ
              const node = (
                <circle
                  key={i}
                  cx={c}
                  cy={c}
                  r={r}
                  fill="none"
                  strokeWidth={stroke}
                  strokeLinecap="butt"
                  className={SEG_FILL[s.color].replace('fill-', 'stroke-')}
                  strokeDasharray={`${len} ${circ - len}`}
                  strokeDashoffset={-offset}
                  style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                />
              )
              offset += len
              return node
            })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold tabular-nums text-slate-800 dark:text-slate-100">
            {centerLabel}
          </span>
          {centerSub && (
            <span className="text-[11px] text-slate-400 dark:text-slate-500">
              {centerSub}
            </span>
          )}
        </div>
      </div>
      <ul className="space-y-1.5">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-2 text-sm">
            <span className={cx('h-2.5 w-2.5 rounded-sm', dotClass[s.color])} />
            <span className="text-slate-600 dark:text-slate-300">{s.label}</span>
            <span className="tabular-nums font-semibold text-slate-800 dark:text-slate-100">
              {s.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ───────── PacingChart（計劃 vs 實際累積完成折線圖）─────────
export interface PacingPoint {
  label: string // x 軸標籤（例如「9月」「第3週」）
  planned: number // 累積計劃完成數
  actual: number | null // 累積實際完成數（未到嘅未來點 = null）
}

export function PacingChart({
  points,
  total,
}: {
  points: PacingPoint[]
  total: number
}) {
  const gradId = useId()
  const W = 520
  const H = 180
  const padL = 30
  const padR = 12
  const padT = 12
  const padB = 26
  const innerW = W - padL - padR
  const innerH = H - padT - padB
  const maxY = Math.max(total, 1)
  const n = points.length

  const x = (i: number) => padL + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW)
  const y = (v: number) => padT + innerH - (v / maxY) * innerH

  const lineFrom = (vals: (number | null)[]) => {
    let d = ''
    let started = false
    vals.forEach((v, i) => {
      if (v == null) return
      d += `${started ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)} `
      started = true
    })
    return d.trim()
  }

  const plannedVals = points.map((p) => p.planned)
  const actualVals = points.map((p) => p.actual)

  // 實際線嘅區域填色（到最後一個非 null 點）
  const lastActualIdx = (() => {
    for (let i = actualVals.length - 1; i >= 0; i--) if (actualVals[i] != null) return i
    return -1
  })()
  const areaPath =
    lastActualIdx >= 0
      ? `${lineFrom(actualVals.slice(0, lastActualIdx + 1))} L${x(lastActualIdx).toFixed(1)},${y(0).toFixed(1)} L${x(0).toFixed(1)},${y(0).toFixed(1)} Z`
      : ''

  // y 軸刻度（0, 25%, 50%, 75%, 100% of total）
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(maxY * f))
  const uniqTicks = Array.from(new Set(ticks))

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      preserveAspectRatio="none"
      role="img"
      aria-label="計劃對實際進度折線圖"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" className="[stop-color:theme(colors.emerald.400)]" stopOpacity={0.25} />
          <stop offset="100%" className="[stop-color:theme(colors.emerald.400)]" stopOpacity={0} />
        </linearGradient>
      </defs>

      {/* 水平格線 + y 標籤 */}
      {uniqTicks.map((t) => (
        <g key={t}>
          <line
            x1={padL}
            x2={W - padR}
            y1={y(t)}
            y2={y(t)}
            className="stroke-slate-100 dark:stroke-slate-800"
            strokeWidth={1}
          />
          <text
            x={padL - 6}
            y={y(t) + 3}
            textAnchor="end"
            className="fill-slate-400 text-[9px] tabular-nums dark:fill-slate-500"
          >
            {t}
          </text>
        </g>
      ))}

      {/* x 標籤 */}
      {points.map((p, i) => (
        <text
          key={p.label + i}
          x={x(i)}
          y={H - 8}
          textAnchor="middle"
          className="fill-slate-400 text-[9px] dark:fill-slate-500"
        >
          {p.label}
        </text>
      ))}

      {/* 實際區域 */}
      {areaPath && <path d={areaPath} fill={`url(#${gradId})`} />}

      {/* 計劃線（虛線、slate） */}
      <path
        d={lineFrom(plannedVals)}
        fill="none"
        className="stroke-slate-300 dark:stroke-slate-600"
        strokeWidth={2}
        strokeDasharray="4 4"
      />

      {/* 實際線（綠實線） */}
      <path
        d={lineFrom(actualVals)}
        fill="none"
        className="stroke-emerald-500"
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* 實際點 */}
      {points.map((p, i) =>
        p.actual == null ? null : (
          <circle
            key={i}
            cx={x(i)}
            cy={y(p.actual)}
            r={2.5}
            className="fill-emerald-500"
          />
        ),
      )}
    </svg>
  )
}

// ───────── AreaBars（各範疇完成度橫條 + 計數）─────────
export function AreaBars({
  rows,
}: {
  rows: { label: string; pct: number; done: number; total: number }[]
}) {
  const tone = (pct: number) =>
    pct >= 80
      ? 'bg-emerald-500'
      : pct >= 50
        ? 'bg-accent'
        : pct >= 25
          ? 'bg-amber-400'
          : 'bg-slate-300 dark:bg-slate-600'
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="mb-1 flex items-center justify-between gap-2 text-xs">
            <span className="truncate text-slate-600 dark:text-slate-300">{r.label}</span>
            <span className="shrink-0 tabular-nums text-slate-400 dark:text-slate-500">
              {r.done}/{r.total} · {r.pct}%
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className={cx('h-full rounded-full transition-all duration-500', tone(r.pct))}
              style={{ width: `${r.pct}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}
