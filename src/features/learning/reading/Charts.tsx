import { useState } from 'react'
import { cx } from '../../../ui'
import type { HeatCell, MonthBucket } from './util'
import { relativeLabel } from './util'

// ============================================================
//  自製 SVG / div 圖表（零外部依賴）
//  - DonutChart：狀態 / 格式佔比
//  - BarChart：每月讀完本數（hover tooltip）
//  - RatingBars：星級分佈
//  - Heatmap：閱讀活動熱圖（GitHub 式）
// ============================================================

export interface DonutSlice {
  label: string
  value: number
  className: string // fill 用 Tailwind text-* + currentColor
}

export function DonutChart({
  slices,
  size = 132,
  thickness = 16,
  centerTop,
  centerBottom,
}: {
  slices: DonutSlice[]
  size?: number
  thickness?: number
  centerTop?: string
  centerBottom?: string
}) {
  const total = slices.reduce((s, x) => s + x.value, 0)
  const r = (size - thickness) / 2
  const c = 2 * Math.PI * r
  const cx0 = size / 2
  let offset = 0

  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle
            cx={cx0}
            cy={cx0}
            r={r}
            fill="none"
            strokeWidth={thickness}
            className="stroke-slate-100 dark:stroke-slate-700/60"
          />
          {total > 0 &&
            slices.map((s, i) => {
              if (s.value <= 0) return null
              const frac = s.value / total
              const len = frac * c
              const dash = `${len} ${c - len}`
              const el = (
                <circle
                  key={i}
                  cx={cx0}
                  cy={cx0}
                  r={r}
                  fill="none"
                  strokeWidth={thickness}
                  strokeDasharray={dash}
                  strokeDashoffset={-offset}
                  strokeLinecap="butt"
                  className={cx('transition-all duration-500', s.className)}
                  style={{ stroke: 'currentColor' }}
                />
              )
              offset += len
              return el
            })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {centerTop && (
            <span className="text-2xl font-semibold tabular-nums text-slate-800 dark:text-slate-100">
              {centerTop}
            </span>
          )}
          {centerBottom && (
            <span className="text-[11px] text-slate-400 dark:text-slate-500">
              {centerBottom}
            </span>
          )}
        </div>
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        {slices.map((s) => (
          <div key={s.label} className="flex items-center gap-2 text-xs">
            <span className={cx('h-2.5 w-2.5 shrink-0 rounded-sm', s.className)} style={{ backgroundColor: 'currentColor' }} />
            <span className="truncate text-slate-600 dark:text-slate-300">{s.label}</span>
            <span className="ml-auto tabular-nums font-medium text-slate-500 dark:text-slate-400">
              {s.value}
              {total > 0 && (
                <span className="ml-1 text-slate-400 dark:text-slate-500">
                  {Math.round((s.value / total) * 100)}%
                </span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function BarChart({
  data,
  unit = '本',
}: {
  data: MonthBucket[]
  unit?: string
}) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(1, ...data.map((d) => d.books))
  return (
    <div>
      <div className="flex h-36 items-end gap-1">
        {data.map((d, i) => {
          const h = (d.books / max) * 100
          const on = hover === i
          return (
            <div
              key={d.key}
              className="group relative flex flex-1 flex-col items-center justify-end"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              {on && (
                <div className="pointer-events-none absolute -top-1 z-10 -translate-y-full whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] text-white shadow-md dark:bg-slate-700">
                  <span className="tabular-nums font-semibold">{d.books}</span> {unit}
                  {d.pages > 0 && (
                    <span className="ml-1 text-slate-300">
                      · <span className="tabular-nums">{d.pages.toLocaleString()}</span> 頁
                    </span>
                  )}
                </div>
              )}
              <div
                className={cx(
                  'w-full rounded-t-md transition-all duration-300',
                  d.books > 0
                    ? on
                      ? 'bg-accent-strong'
                      : 'bg-accent'
                    : 'bg-slate-100 dark:bg-slate-700/50',
                )}
                style={{ height: `${Math.max(d.books > 0 ? 6 : 2, h)}%` }}
              />
            </div>
          )
        })}
      </div>
      <div className="mt-1.5 flex gap-1">
        {data.map((d) => (
          <span
            key={d.key}
            className="flex-1 text-center text-[9px] text-slate-400 dark:text-slate-500"
          >
            {d.label}
          </span>
        ))}
      </div>
    </div>
  )
}

export function RatingBars({ dist }: { dist: number[] }) {
  const max = Math.max(1, ...dist.slice(1))
  return (
    <div className="space-y-1.5">
      {[5, 4, 3, 2, 1].map((star) => {
        const v = dist[star] ?? 0
        return (
          <div key={star} className="flex items-center gap-2 text-xs">
            <span className="flex w-7 items-center justify-end gap-0.5 tabular-nums text-amber-500">
              {star}
              <span className="text-amber-400">★</span>
            </span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700/60">
              <div
                className="h-full rounded-full bg-amber-400 transition-all duration-500 dark:bg-amber-500"
                style={{ width: `${(v / max) * 100}%` }}
              />
            </div>
            <span className="w-6 text-right tabular-nums text-slate-500 dark:text-slate-400">
              {v}
            </span>
          </div>
        )
      })}
    </div>
  )
}

const HEAT_LEVELS = [
  'bg-slate-100 dark:bg-slate-800',
  'bg-accent/25',
  'bg-accent/45',
  'bg-accent/70',
  'bg-accent',
]

export function heatLevel(pages: number): number {
  if (pages <= 0) return 0
  if (pages < 15) return 1
  if (pages < 40) return 2
  if (pages < 80) return 3
  return 4
}

export function Heatmap({ cols }: { cols: HeatCell[][] }) {
  const [tip, setTip] = useState<{ key: string; pages: number; sessions: number } | null>(null)
  return (
    <div>
      <div className="flex gap-[3px] overflow-x-auto pb-1">
        {cols.map((col, ci) => (
          <div key={ci} className="flex flex-col gap-[3px]">
            {col.map((cell) => (
              <div
                key={cell.key}
                onMouseEnter={() => setTip(cell)}
                onMouseLeave={() => setTip(null)}
                className={cx(
                  'h-3 w-3 shrink-0 rounded-[3px] transition-colors',
                  HEAT_LEVELS[heatLevel(cell.pages)],
                  cell.pages > 0 && 'ring-1 ring-inset ring-black/5 dark:ring-white/5',
                )}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500">
        <span className="tabular-nums">
          {tip
            ? `${relativeLabel(tip.key)} · ${tip.pages} 頁 · ${tip.sessions} 次`
            : '每格 = 一日；顏色越深，當日讀得越多'}
        </span>
        <span className="flex items-center gap-1">
          少
          {HEAT_LEVELS.map((c, i) => (
            <span key={i} className={cx('h-2.5 w-2.5 rounded-[2px]', c)} />
          ))}
          多
        </span>
      </div>
    </div>
  )
}
