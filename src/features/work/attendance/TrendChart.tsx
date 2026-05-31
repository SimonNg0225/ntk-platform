import { useMemo, useState } from 'react'
import { cx } from '../../../ui'
import { shortDateLabel, weekdayOf } from './util'

// ============================================================
//  出席率趨勢圖（純 SVG，零依賴）
//  ------------------------------------------------------------
//  - 折線 + 漸層填充 + 互動 hover tooltip
//  - 90% 參考線（一般學校關注線）
//  - 只畫「有點名」嘅日子，斷點用虛線連接
// ============================================================

export interface TrendPoint {
  dateKey: string
  rate: number | null // 出席率 %；null = 當日未點名
  present: number
  late: number
  absent: number
}

const W = 640
const H = 200
const PAD_L = 32
const PAD_R = 12
const PAD_T = 14
const PAD_B = 26

export default function TrendChart({ points }: { points: TrendPoint[] }) {
  const [hover, setHover] = useState<number | null>(null)

  const marked = useMemo(() => points.filter((p) => p.rate != null), [points])

  const geom = useMemo(() => {
    const n = points.length
    if (n === 0) return null
    const innerW = W - PAD_L - PAD_R
    const innerH = H - PAD_T - PAD_B
    const x = (i: number) => PAD_L + (n === 1 ? innerW / 2 : (innerW * i) / (n - 1))
    // y 軸固定 0–100%，方便跨期比較
    const y = (rate: number) => PAD_T + innerH * (1 - rate / 100)
    return { x, y, innerW, innerH }
  }, [points])

  if (!geom || marked.length === 0) return null

  const { x, y, innerH } = geom

  // 折線路徑（只連有值嘅點；中間斷開）
  const segments: string[] = []
  let curr: string[] = []
  points.forEach((p, i) => {
    if (p.rate == null) {
      if (curr.length) segments.push(curr.join(' '))
      curr = []
      return
    }
    curr.push(`${curr.length ? 'L' : 'M'} ${x(i).toFixed(1)} ${y(p.rate).toFixed(1)}`)
  })
  if (curr.length) segments.push(curr.join(' '))

  // 漸層填充（用第一段到最後一段嘅包絡；簡化為整條 marked 區）
  const firstIdx = points.findIndex((p) => p.rate != null)
  const lastIdx =
    points.length -
    1 -
    [...points].reverse().findIndex((p) => p.rate != null)
  const areaPath =
    segments.length === 1
      ? `${segments[0]} L ${x(lastIdx).toFixed(1)} ${(PAD_T + innerH).toFixed(1)} L ${x(
          firstIdx,
        ).toFixed(1)} ${(PAD_T + innerH).toFixed(1)} Z`
      : ''

  const gridLines = [0, 25, 50, 75, 100]
  const ref = 90 // 關注線

  const avg = Math.round(
    marked.reduce((s, p) => s + (p.rate ?? 0), 0) / marked.length,
  )

  const hp = hover != null ? points[hover] : null

  return (
    <div className="relative w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="出席率趨勢圖"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="att-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* 水平格線 + Y 軸標籤 */}
        {gridLines.map((g) => (
          <g key={g}>
            <line
              x1={PAD_L}
              x2={W - PAD_R}
              y1={y(g)}
              y2={y(g)}
              className="stroke-slate-200 dark:stroke-slate-700"
              strokeWidth={1}
            />
            <text
              x={PAD_L - 6}
              y={y(g) + 3}
              textAnchor="end"
              className="fill-slate-400 text-[9px] tabular-nums dark:fill-slate-500"
            >
              {g}
            </text>
          </g>
        ))}

        {/* 90% 關注參考線 */}
        <line
          x1={PAD_L}
          x2={W - PAD_R}
          y1={y(ref)}
          y2={y(ref)}
          className="stroke-amber-400/70"
          strokeWidth={1}
          strokeDasharray="4 4"
        />
        <text
          x={W - PAD_R}
          y={y(ref) - 3}
          textAnchor="end"
          className="fill-amber-500 text-[9px] font-medium"
        >
          關注線 90%
        </text>

        {/* 面積 */}
        {areaPath && <path d={areaPath} fill="url(#att-area)" />}

        {/* 折線（多段 = 中間有未點名日，自然斷開） */}
        {segments.map((d, i) => (
          <path
            key={i}
            d={d}
            fill="none"
            className="stroke-accent"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}

        {/* 數據點 + hover 命中區 */}
        {points.map((p, i) =>
          p.rate == null ? null : (
            <circle
              key={p.dateKey}
              cx={x(i)}
              cy={y(p.rate)}
              r={hover === i ? 4 : 2.8}
              className={cx(
                'stroke-white transition-all dark:stroke-slate-800',
                p.rate < ref ? 'fill-amber-500' : 'fill-accent',
              )}
              strokeWidth={1.5}
            />
          ),
        )}

        {/* hover 垂直線 */}
        {hp && hp.rate != null && (
          <line
            x1={x(hover!)}
            x2={x(hover!)}
            y1={PAD_T}
            y2={PAD_T + innerH}
            className="stroke-slate-300 dark:stroke-slate-600"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        )}

        {/* 透明 hit 區（覆蓋整個寬度，按比例分配）*/}
        {points.map((p, i) => (
          <rect
            key={`hit-${p.dateKey}`}
            x={x(i) - (W - PAD_L - PAD_R) / points.length / 2}
            y={PAD_T}
            width={(W - PAD_L - PAD_R) / points.length}
            height={innerH}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          />
        ))}

        {/* X 軸標籤（疏化：頭、尾、約每 1/4）*/}
        {points.map((p, i) => {
          const step = Math.max(1, Math.ceil(points.length / 6))
          if (i % step !== 0 && i !== points.length - 1) return null
          return (
            <text
              key={`x-${p.dateKey}`}
              x={x(i)}
              y={H - 8}
              textAnchor="middle"
              className="fill-slate-400 text-[9px] tabular-nums dark:fill-slate-500"
            >
              {shortDateLabel(p.dateKey)}
            </text>
          )
        })}
      </svg>

      {/* 平均線說明 */}
      <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500">
        <span>
          期內平均出席率{' '}
          <span className="font-semibold tabular-nums text-slate-600 dark:text-slate-300">
            {avg}%
          </span>
        </span>
        <span className="tabular-nums">{marked.length} 個有點名日</span>
      </div>

      {/* Tooltip */}
      {hp && hp.rate != null && (
        <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md dark:border-slate-700 dark:bg-slate-800">
          <div className="font-semibold text-slate-700 dark:text-slate-200">
            {shortDateLabel(hp.dateKey)}（{weekdayOf(hp.dateKey)}）· {hp.rate}%
          </div>
          <div className="mt-0.5 flex gap-2 tabular-nums text-slate-500 dark:text-slate-400">
            <span className="text-accent-strong dark:text-accent">出 {hp.present}</span>
            <span className="text-amber-600 dark:text-amber-300">遲 {hp.late}</span>
            <span className="text-rose-600 dark:text-rose-300">缺 {hp.absent}</span>
          </div>
        </div>
      )}
    </div>
  )
}
