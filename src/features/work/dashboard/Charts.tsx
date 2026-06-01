import { useId, useMemo } from 'react'
import { cx } from '../../../ui'
import type { DayLoad, GradeBin, HeatCell, TrendPoint } from './types'

// ============================================================
//  工作儀表板自製圖表（純 SVG / div，零 npm 依賴）
//  全部支援深色 + tabular-nums + 主題 accent（工作＝青藍）。
//   - TaskTrendChart：每日「新增 vs 完成」雙色長條 + 折線
//   - HeatStrip：完成熱力橫帶（近 N 日，GitHub 草地風）
//   - Donut：通用環形（出席率 / 課程整體進度）
//   - GradeHistogram：成績分數區間直方圖
//   - WeekLoadBars：本週每日課擔長條
//   - MiniRing：單值迷你環（畀 Bento 小磚用）
// ============================================================

const ACCENT = 'var(--accent)'

// ───────── 0. 迷你環形（單值，給 Bento 小磚用）─────────
export function MiniRing({
  value,
  size = 56,
  stroke = 6,
  tone = 'accent',
  children,
}: {
  value: number // 0-100
  size?: number
  stroke?: number
  tone?: 'accent' | 'green' | 'amber' | 'rose'
  children?: React.ReactNode
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, value))
  const len = (pct / 100) * c
  const strokeCls =
    tone === 'green'
      ? 'stroke-emerald-500'
      : tone === 'amber'
        ? 'stroke-amber-500'
        : tone === 'rose'
          ? 'stroke-rose-500'
          : 'stroke-accent'
  return (
    <div className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-slate-100 dark:stroke-slate-800" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          className={cx('transition-all duration-700 ease-out', strokeCls)}
          strokeDasharray={`${len} ${c - len}`}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center">{children}</span>
    </div>
  )
}

// ───────── 1. 待辦完成趨勢（新增 vs 完成）─────────
export function TaskTrendChart({ data }: { data: TrendPoint[] }) {
  const gid = useId().replace(/:/g, '')
  const max = useMemo(
    () => Math.max(1, ...data.map((d) => Math.max(d.created, d.completed))),
    [data],
  )
  const hasData = data.some((d) => d.created > 0 || d.completed > 0)
  // 完成折線（SVG 比例座標）
  const W = 100
  const x = (i: number) =>
    data.length <= 1 ? W / 2 : (i / (data.length - 1)) * W
  const y = (v: number) => 100 - (v / max) * 92 - 4
  const line = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(d.completed)}`)
    .join(' ')

  if (!hasData)
    return (
      <p className="py-10 text-center text-sm text-slate-400 dark:text-slate-500">
        近期未有待辦活動。
      </p>
    )

  return (
    <div>
      <div className="relative">
        {/* 長條層 */}
        <div className="flex h-40 items-end gap-[3px]">
          {data.map((d) => (
            <div
              key={d.key}
              className="group flex flex-1 flex-col items-center justify-end"
              title={`${d.key}：新增 ${d.created} · 完成 ${d.completed}`}
            >
              <div className="flex w-full items-end justify-center gap-[2px]">
                <div
                  className="w-1/2 max-w-[10px] rounded-t-sm bg-slate-200 transition-all duration-500 group-hover:bg-slate-300 dark:bg-slate-700 dark:group-hover:bg-slate-600"
                  style={{ height: `${Math.max((d.created / max) * 140, d.created > 0 ? 3 : 0)}px` }}
                />
                <div
                  className="w-1/2 max-w-[10px] rounded-t-sm bg-accent transition-all duration-500 group-hover:bg-accent-strong"
                  style={{ height: `${Math.max((d.completed / max) * 140, d.completed > 0 ? 3 : 0)}px` }}
                />
              </div>
            </div>
          ))}
        </div>
        {/* 完成折線層（覆蓋） */}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 h-40 w-full overflow-visible"
        >
          <defs>
            <linearGradient id={`tt-${gid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={ACCENT} stopOpacity="0.18" />
              <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d={`${line} L ${x(data.length - 1)} 100 L ${x(0)} 100 Z`}
            fill={`url(#tt-${gid})`}
          />
          <path
            d={line}
            fill="none"
            className="stroke-accent"
            strokeWidth={1.4}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
      <div className="mt-1.5 flex gap-[3px]">
        {data.map((d, i) => (
          <span
            key={d.key}
            className="flex-1 text-center text-[9px] tabular-nums text-slate-400 dark:text-slate-500"
          >
            {data.length <= 14 || i % 3 === 0 ? d.label : ''}
          </span>
        ))}
      </div>
      <Legend
        items={[
          { color: 'bg-slate-200 dark:bg-slate-700', label: '新增' },
          { color: 'bg-accent', label: '完成' },
        ]}
      />
    </div>
  )
}

// ───────── 2. 完成熱力橫帶 ─────────
export function HeatStrip({ cells }: { cells: HeatCell[] }) {
  const max = useMemo(() => Math.max(1, ...cells.map((c) => c.count)), [cells])
  const total = cells.reduce((s, c) => s + c.count, 0)
  const level = (n: number): number => {
    if (n === 0) return 0
    const r = n / max
    if (r <= 0.25) return 1
    if (r <= 0.5) return 2
    if (r <= 0.75) return 3
    return 4
  }
  const LEVEL = [
    'bg-slate-100 dark:bg-slate-800',
    'bg-accent/25',
    'bg-accent/45',
    'bg-accent/70',
    'bg-accent',
  ]
  return (
    <div>
      <div className="flex flex-wrap gap-[3px]">
        {cells.map((c) => (
          <span
            key={c.key}
            title={`${c.key}：完成 ${c.count} 件`}
            className={cx(
              'h-3 w-3 rounded-[3px] ring-1 ring-inset ring-slate-900/5 transition dark:ring-white/5',
              LEVEL[level(c.count)],
            )}
          />
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500">
        <span className="tabular-nums">
          近 {cells.length} 日完成{' '}
          <span className="font-semibold text-slate-600 dark:text-slate-300">
            {total}
          </span>{' '}
          件
        </span>
        <span className="flex items-center gap-1">
          少
          {LEVEL.map((cls, i) => (
            <span key={i} className={cx('h-[10px] w-[10px] rounded-[2px]', cls)} />
          ))}
          多
        </span>
      </div>
    </div>
  )
}

// ───────── 3. 通用環形圖 ─────────
export function Donut({
  segments,
  centerValue,
  centerLabel,
  size = 116,
  thickness = 13,
}: {
  segments: { value: number; color: string; label: string }[]
  centerValue: string
  centerLabel: string
  size?: number
  thickness?: number
}) {
  const total = segments.reduce((s, x) => s + x.value, 0)
  const r = (size - thickness - 4) / 2
  const c = 2 * Math.PI * r
  const cc = size / 2
  let offset = 0
  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} className="shrink-0 -rotate-90">
        <circle
          cx={cc}
          cy={cc}
          r={r}
          fill="none"
          strokeWidth={thickness}
          className="stroke-slate-100 dark:stroke-slate-800"
        />
        {total > 0 &&
          segments.map((seg, i) => {
            const len = (seg.value / total) * c
            const el = (
              <circle
                key={i}
                cx={cc}
                cy={cc}
                r={r}
                fill="none"
                strokeWidth={thickness}
                stroke={seg.color}
                strokeLinecap="butt"
                strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={-offset}
                className="transition-all duration-500"
              >
                <title>
                  {seg.label}：{seg.value}
                </title>
              </circle>
            )
            offset += len
            return el
          })}
        <g className="rotate-90" style={{ transformOrigin: 'center' }}>
          <text
            x={cc}
            y={cc - 2}
            textAnchor="middle"
            className="fill-slate-800 text-[20px] font-bold tabular-nums dark:fill-slate-100"
          >
            {centerValue}
          </text>
          <text
            x={cc}
            y={cc + 14}
            textAnchor="middle"
            className="fill-slate-400 text-[10px] dark:fill-slate-500"
          >
            {centerLabel}
          </text>
        </g>
      </svg>
      <ul className="flex-1 space-y-1.5">
        {segments.map((seg, i) => (
          <li key={i} className="flex items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: seg.color }} />
              {seg.label}
            </span>
            <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">
              {seg.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ───────── 4. 成績分數區間直方圖 ─────────
export function GradeHistogram({ bins }: { bins: GradeBin[] }) {
  const max = useMemo(() => Math.max(1, ...bins.map((b) => b.count)), [bins])
  const total = bins.reduce((s, b) => s + b.count, 0)
  // 由低到高漸變色（紅→琥珀→海軍藍→綠）
  const BAR = [
    'bg-rose-400 dark:bg-rose-500',
    'bg-amber-400 dark:bg-amber-500',
    'bg-amber-300 dark:bg-amber-400',
    'bg-accent/80',
    'bg-emerald-400 dark:bg-emerald-500',
  ]
  if (total === 0)
    return (
      <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">
        未有評分紀錄。
      </p>
    )
  return (
    <div>
      <div className="flex h-28 items-end gap-2">
        {bins.map((b, i) => (
          <div
            key={b.label}
            className="group flex flex-1 flex-col items-center justify-end"
            title={`${b.label} 分：${b.count} 人`}
          >
            <span className="mb-1 text-[10px] font-medium tabular-nums text-slate-500 dark:text-slate-400">
              {b.count || ''}
            </span>
            <div
              className={cx('w-full rounded-t-md transition-all duration-500', BAR[i])}
              style={{ height: `${Math.max((b.count / max) * 100, b.count > 0 ? 5 : 0)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-2">
        {bins.map((b) => (
          <span
            key={b.label}
            className="flex-1 text-center text-[9px] tabular-nums text-slate-400 dark:text-slate-500"
          >
            {b.label}
          </span>
        ))}
      </div>
    </div>
  )
}

// ───────── 5. 本週每日課擔長條 ─────────
export function WeekLoadBars({ data }: { data: DayLoad[] }) {
  const max = useMemo(() => Math.max(1, ...data.map((d) => d.periods)), [data])
  const totalPeriods = data.reduce((s, d) => s + d.periods, 0)
  return (
    <div>
      <div className="flex h-24 items-end gap-2">
        {data.map((d) => (
          <div
            key={d.day}
            className="group flex flex-1 flex-col items-center justify-end gap-1"
            title={`星期${d.label}：${d.periods} 節`}
          >
            <span className="text-[10px] font-medium tabular-nums text-slate-500 dark:text-slate-400">
              {d.periods || ''}
            </span>
            <div
              className={cx(
                'w-full rounded-t-md transition-all duration-500',
                d.periods > 0
                  ? d.isToday
                    ? 'bg-accent-strong'
                    : 'bg-accent/70 group-hover:bg-accent'
                  : 'bg-slate-100 dark:bg-slate-800',
                d.isToday && 'ring-1 ring-accent ring-offset-1 ring-offset-white dark:ring-offset-slate-800',
              )}
              style={{ height: `${Math.max((d.periods / max) * 100, d.periods > 0 ? 6 : 3)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-2">
        {data.map((d) => (
          <span
            key={d.day}
            className={cx(
              'flex-1 text-center text-[10px]',
              d.isToday
                ? 'font-semibold text-accent-strong dark:text-accent'
                : 'text-slate-400 dark:text-slate-500',
            )}
          >
            {d.label}
          </span>
        ))}
      </div>
      <p className="mt-2 text-center text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
        本週共{' '}
        <span className="font-semibold text-slate-600 dark:text-slate-300">
          {totalPeriods}
        </span>{' '}
        節
      </p>
    </div>
  )
}

// ───────── 圖例 ─────────
function Legend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <div className="mt-2.5 flex flex-wrap items-center justify-center gap-3">
      {items.map((it) => (
        <span
          key={it.label}
          className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400"
        >
          <span className={cx('h-2.5 w-2.5 rounded-sm', it.color)} />
          {it.label}
        </span>
      ))}
    </div>
  )
}
