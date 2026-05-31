import { useMemo } from 'react'
import { cx } from '../../../ui'
import type { BadgeTone, MonthBar, TypeSlice } from './util'

// ============================================================
//  會議筆記 — 自製圖表（純 SVG / div，零 npm 依賴）
//  全部支援深色 + tabular-nums + 海軍藍 accent。
// ============================================================

// tone → 實心填色 class（div 用）
const TONE_BG: Record<BadgeTone, string> = {
  slate: 'bg-slate-400 dark:bg-slate-500',
  accent: 'bg-accent',
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
  blue: 'bg-blue-500',
}
// tone → SVG stroke class（甜甜圈用）
const TONE_STROKE: Record<BadgeTone, string> = {
  slate: 'stroke-slate-400',
  accent: 'stroke-accent',
  green: 'stroke-emerald-500',
  amber: 'stroke-amber-500',
  rose: 'stroke-rose-500',
  blue: 'stroke-blue-500',
}

// ───────── 1. 月度會議數（垂直長條）─────────
export function MonthlyBars({ bars }: { bars: MonthBar[] }) {
  const max = useMemo(() => Math.max(1, ...bars.map((b) => b.count)), [bars])
  const total = bars.reduce((s, b) => s + b.count, 0)
  if (total === 0)
    return (
      <p className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">
        呢段期間未有會議紀錄
      </p>
    )
  return (
    <div>
      <div className="flex h-32 items-end gap-2">
        {bars.map((b) => (
          <div
            key={b.key}
            className="group flex flex-1 flex-col items-center justify-end"
            title={`${b.label}：${b.count} 場`}
          >
            <span className="mb-1 text-[10px] font-medium tabular-nums text-slate-500 dark:text-slate-400">
              {b.count || ''}
            </span>
            <div
              className="w-full rounded-t-md bg-gradient-to-t from-accent-strong to-accent transition-all duration-500"
              style={{
                height: `${Math.max((b.count / max) * 100, b.count > 0 ? 5 : 0)}%`,
              }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-2">
        {bars.map((b) => (
          <span
            key={b.key}
            className="flex-1 text-center text-[10px] tabular-nums text-slate-400 dark:text-slate-500"
          >
            {b.label}
          </span>
        ))}
      </div>
    </div>
  )
}

// ───────── 2. 類型分布（甜甜圈，SVG）─────────
export function TypeDonut({
  slices,
  size = 132,
}: {
  slices: TypeSlice[]
  size?: number
}) {
  const total = slices.reduce((s, x) => s + x.count, 0)
  const r = (size - 18) / 2
  const c = 2 * Math.PI * r
  const cx0 = size / 2
  let offset = 0

  if (total === 0)
    return (
      <p className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">
        未有分類資料
      </p>
    )

  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} className="shrink-0 -rotate-90">
        <circle
          cx={cx0}
          cy={cx0}
          r={r}
          fill="none"
          strokeWidth={14}
          className="stroke-slate-100 dark:stroke-slate-800"
        />
        {slices.map((seg, i) => {
          const frac = seg.count / total
          const len = frac * c
          const el = (
            <circle
              key={i}
              cx={cx0}
              cy={cx0}
              r={r}
              fill="none"
              strokeWidth={14}
              strokeLinecap="butt"
              className={TONE_STROKE[seg.tone]}
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
            />
          )
          offset += len
          return el
        })}
        <g className="rotate-90" style={{ transformOrigin: 'center' }}>
          <text
            x={cx0}
            y={cx0 - 4}
            textAnchor="middle"
            className="fill-slate-800 text-[22px] font-bold tabular-nums dark:fill-slate-100"
          >
            {total}
          </text>
          <text
            x={cx0}
            y={cx0 + 14}
            textAnchor="middle"
            className="fill-slate-400 text-[10px] dark:fill-slate-500"
          >
            場會議
          </text>
        </g>
      </svg>
      <ul className="flex-1 space-y-1.5">
        {slices.map((seg) => (
          <li
            key={seg.type}
            className="flex items-center justify-between gap-2 text-sm"
          >
            <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
              <span className={cx('h-2.5 w-2.5 rounded-sm', TONE_BG[seg.tone])} />
              {seg.label}
            </span>
            <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">
              {seg.count}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ───────── 3. 行動項目完成率（環形進度，SVG）─────────
export function CompletionRing({
  done,
  total,
  size = 120,
}: {
  done: number
  total: number
  size?: number
}) {
  const pct = total > 0 ? done / total : 0
  const r = (size - 16) / 2
  const c = 2 * Math.PI * r
  const cx0 = size / 2
  const len = pct * c
  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} className="shrink-0 -rotate-90">
        <circle
          cx={cx0}
          cy={cx0}
          r={r}
          fill="none"
          strokeWidth={12}
          className="stroke-slate-100 dark:stroke-slate-800"
        />
        <circle
          cx={cx0}
          cy={cx0}
          r={r}
          fill="none"
          strokeWidth={12}
          strokeLinecap="round"
          className="stroke-emerald-500 transition-all duration-700"
          strokeDasharray={`${len} ${c - len}`}
        />
        <g className="rotate-90" style={{ transformOrigin: 'center' }}>
          <text
            x={cx0}
            y={cx0 - 2}
            textAnchor="middle"
            className="fill-slate-800 text-[20px] font-bold tabular-nums dark:fill-slate-100"
          >
            {Math.round(pct * 100)}%
          </text>
          <text
            x={cx0}
            y={cx0 + 15}
            textAnchor="middle"
            className="fill-slate-400 text-[10px] dark:fill-slate-500"
          >
            已完成
          </text>
        </g>
      </svg>
      <ul className="flex-1 space-y-1.5 text-sm">
        <li className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
            <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
            已完成
          </span>
          <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">
            {done}
          </span>
        </li>
        <li className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
            <span className="h-2.5 w-2.5 rounded-sm bg-slate-300 dark:bg-slate-600" />
            待跟進
          </span>
          <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">
            {Math.max(0, total - done)}
          </span>
        </li>
      </ul>
    </div>
  )
}
