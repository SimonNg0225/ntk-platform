import { useMemo } from 'react'
import { cx } from '../../../ui'
import {
  CATEGORY_STYLE,
  CHANNEL_BAR,
  CHANNEL_STROKE,
  OUTCOME_LABEL,
  OUTCOME_STYLE,
  type Category,
  type CountSlice,
  type MonthlyPoint,
  type Outcome,
} from './util'

// ============================================================
//  家長溝通 — 自製圖表（純 SVG / div，零 npm 依賴）
//  全部支援深色 + tabular-nums + 海軍藍 accent。
// ============================================================

function ChartEmpty({ text }: { text: string }) {
  return (
    <p className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">
      {text}
    </p>
  )
}

// ───────── 1. 聯絡方式占比（甜甜圈，SVG）─────────
export function ChannelDonut({
  slices,
  size = 132,
}: {
  slices: CountSlice[]
  size?: number
}) {
  const total = slices.reduce((s, x) => s + x.count, 0)
  const r = (size - 18) / 2
  const c = 2 * Math.PI * r
  const cc = size / 2
  let offset = 0

  if (total === 0) return <ChartEmpty text="仲未有溝通記錄" />

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <svg width={size} height={size} className="shrink-0 -rotate-90" aria-hidden>
        <circle
          cx={cc}
          cy={cc}
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
              cx={cc}
              cy={cc}
              r={r}
              fill="none"
              strokeWidth={14}
              strokeLinecap="butt"
              className={CHANNEL_STROKE[seg.key] ?? 'stroke-slate-400'}
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
            />
          )
          offset += len
          return el
        })}
        <g className="rotate-90" style={{ transformOrigin: 'center' }}>
          <text
            x={cc}
            y={cc - 4}
            textAnchor="middle"
            className="fill-slate-800 text-[22px] font-bold tabular-nums dark:fill-slate-100"
          >
            {total}
          </text>
          <text
            x={cc}
            y={cc + 14}
            textAnchor="middle"
            className="fill-slate-400 text-[10px] dark:fill-slate-500"
          >
            次溝通
          </text>
        </g>
      </svg>
      <ul className="w-full flex-1 space-y-1.5">
        {slices.map((seg) => (
          <li key={seg.key} className="flex items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
              <span className={cx('h-2.5 w-2.5 rounded-sm', CHANNEL_BAR[seg.key] ?? 'bg-slate-400')} />
              {seg.label}
            </span>
            <span className="tabular-nums text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-slate-700 dark:text-slate-200">{seg.count}</span>
              <span className="ml-1 text-xs">{Math.round((seg.count / total) * 100)}%</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ───────── 2. 每月溝通量（堆疊長條：主動 / 來訊）─────────
export function MonthlyTrendChart({ points }: { points: MonthlyPoint[] }) {
  const max = useMemo(
    () => Math.max(1, ...points.map((p) => p.total)),
    [points],
  )
  const grandTotal = points.reduce((s, p) => s + p.total, 0)
  if (grandTotal === 0) return <ChartEmpty text="近期未有溝通記錄" />

  return (
    <div>
      <div className="flex h-40 items-end gap-1.5">
        {points.map((p) => {
          const h = (p.total / max) * 100
          return (
            <div
              key={p.key}
              className="group flex flex-1 flex-col items-center justify-end"
              title={`${p.label}：主動 ${p.outgoing} · 來訊 ${p.incoming}`}
            >
              <span className="mb-1 text-[10px] font-medium tabular-nums text-slate-500 opacity-0 transition group-hover:opacity-100 dark:text-slate-400">
                {p.total || ''}
              </span>
              <div
                className="flex w-full flex-col-reverse overflow-hidden rounded-md"
                style={{ height: `${Math.max(h, p.total > 0 ? 4 : 0)}%` }}
              >
                <div
                  className="bg-accent transition-all"
                  style={{ height: `${p.total ? (p.outgoing / p.total) * 100 : 0}%` }}
                />
                <div
                  className="bg-blue-400 transition-all dark:bg-blue-500"
                  style={{ height: `${p.total ? (p.incoming / p.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        {points.map((p) => (
          <span
            key={p.key}
            className="flex-1 text-center text-[10px] tabular-nums text-slate-400 dark:text-slate-500"
          >
            {p.label}
          </span>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-accent" />
          主動聯絡
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-blue-400 dark:bg-blue-500" />
          家長來訊
        </span>
      </div>
    </div>
  )
}

// ───────── 3. 主題分類分布（水平條）─────────
export function CategoryBars({
  data,
}: {
  data: { key: Category | 'unset'; label: string; count: number }[]
}) {
  const total = data.reduce((s, d) => s + d.count, 0)
  if (total === 0) return <ChartEmpty text="仲未有分類記錄" />
  const max = Math.max(1, ...data.map((d) => d.count))
  return (
    <div className="space-y-2">
      {data.map((d) => {
        const pct = (d.count / max) * 100
        const bar = d.key === 'unset' ? 'bg-slate-300 dark:bg-slate-600' : CATEGORY_STYLE[d.key].bar
        return (
          <div key={d.key} className="flex items-center gap-2">
            <span className="w-12 shrink-0 text-right text-xs text-slate-500 dark:text-slate-400">
              {d.label}
            </span>
            <div className="h-5 flex-1 overflow-hidden rounded-md bg-slate-100 dark:bg-slate-800">
              <div
                className={cx('flex h-full items-center justify-end rounded-md px-1.5 transition-all duration-500', bar)}
                style={{ width: `${Math.max(pct, d.count > 0 ? 10 : 0)}%` }}
              >
                {d.count > 0 && (
                  <span className="text-[10px] font-semibold tabular-nums text-white">{d.count}</span>
                )}
              </div>
            </div>
            <span className="w-9 shrink-0 text-right text-xs tabular-nums text-slate-400 dark:text-slate-500">
              {Math.round((d.count / total) * 100)}%
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ───────── 4. 溝通結果觀感（水平條）─────────
export function OutcomeBars({ data }: { data: Record<Outcome, number> }) {
  const order: Outcome[] = ['positive', 'neutral', 'concern']
  const total = order.reduce((s, o) => s + data[o], 0)
  if (total === 0) return <ChartEmpty text="仲未標記溝通觀感" />
  return (
    <div className="space-y-2.5">
      {order.map((o) => {
        const v = data[o]
        const pct = (v / total) * 100
        const m = OUTCOME_STYLE[o]
        return (
          <div key={o} className="flex items-center gap-2">
            <span className={cx('w-12 shrink-0 text-xs font-medium', m.text)}>
              {OUTCOME_LABEL[o]}
            </span>
            <div className="h-5 flex-1 overflow-hidden rounded-md bg-slate-100 dark:bg-slate-800">
              <div
                className={cx('flex h-full items-center justify-end rounded-md px-1.5 transition-all duration-500', m.bar)}
                style={{ width: `${Math.max(pct, v > 0 ? 8 : 0)}%` }}
              >
                {v > 0 && (
                  <span className="text-[10px] font-semibold tabular-nums text-white">{v}</span>
                )}
              </div>
            </div>
            <span className="w-9 shrink-0 text-right text-xs tabular-nums text-slate-400 dark:text-slate-500">
              {Math.round(pct)}%
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ───────── 5. 最常聯絡學生（橫向排行條）─────────
export function TopStudentsBars({
  data,
}: {
  data: { id: string; name: string; count: number }[]
}) {
  if (data.length === 0) return <ChartEmpty text="仲未有指定學生嘅記錄" />
  const max = Math.max(1, ...data.map((d) => d.count))
  return (
    <div className="space-y-2">
      {data.map((d, i) => (
        <div key={d.id} className="flex items-center gap-2">
          <span className="w-5 shrink-0 text-right text-[11px] font-semibold tabular-nums text-slate-400 dark:text-slate-500">
            {i + 1}
          </span>
          <span className="w-20 shrink-0 truncate text-xs text-slate-600 dark:text-slate-300" title={d.name}>
            {d.name}
          </span>
          <div className="h-4 flex-1 overflow-hidden rounded-md bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full rounded-md bg-gradient-to-r from-accent to-accent-strong transition-all duration-500"
              style={{ width: `${Math.max((d.count / max) * 100, 8)}%` }}
            />
          </div>
          <span className="w-6 shrink-0 text-right text-xs font-semibold tabular-nums text-slate-600 dark:text-slate-300">
            {d.count}
          </span>
        </div>
      ))}
    </div>
  )
}
