import { cx } from '../../../ui'
import { type ClassTone } from './types'
import { TONE_FILL, TONE_STROKE } from './util'

// ============================================================
//  班別管理 — 自製圖表（純 SVG / div，零 npm 依賴）
//  全部支援深色 + tabular-nums + 海軍藍 accent。
// ============================================================

// ───────── 1. 環形圖（性別 / 狀態占比）─────────
export interface DonutSeg {
  value: number
  tone: ClassTone
  label: string
}

export function Donut({
  segments,
  centerValue,
  centerLabel,
  size = 124,
}: {
  segments: DonutSeg[]
  centerValue: string
  centerLabel: string
  size?: number
}) {
  const total = segments.reduce((s, x) => s + x.value, 0)
  const r = (size - 16) / 2
  const c = 2 * Math.PI * r
  const cx0 = size / 2
  let offset = 0
  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} className="shrink-0 -rotate-90">
        <circle
          cx={cx0}
          cy={cx0}
          r={r}
          fill="none"
          strokeWidth={13}
          className="stroke-slate-100 dark:stroke-slate-800"
        />
        {total > 0 &&
          segments.map((seg, i) => {
            if (seg.value === 0) return null
            const len = (seg.value / total) * c
            const el = (
              <circle
                key={i}
                cx={cx0}
                cy={cx0}
                r={r}
                fill="none"
                strokeWidth={13}
                strokeLinecap="butt"
                className={TONE_STROKE[seg.tone]}
                strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={-offset}
              >
                <title>
                  {seg.label}：{seg.value}（{Math.round((seg.value / total) * 100)}%）
                </title>
              </circle>
            )
            offset += len
            return el
          })}
        <g className="rotate-90" style={{ transformOrigin: 'center' }}>
          <text
            x={cx0}
            y={cx0 - 3}
            textAnchor="middle"
            className="fill-slate-800 text-[21px] font-bold tabular-nums dark:fill-slate-100"
          >
            {centerValue}
          </text>
          <text
            x={cx0}
            y={cx0 + 13}
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
              <span className={cx('h-2.5 w-2.5 rounded-sm', TONE_FILL[seg.tone])} />
              {seg.label}
            </span>
            <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">
              {seg.value}
              <span className="ml-1 text-xs font-normal text-slate-400">
                {total ? Math.round((seg.value / total) * 100) : 0}%
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ───────── 2. 完成度圓環（單值 progress ring）─────────
export function ProgressRing({
  pct,
  size = 96,
  tone = 'accent',
  label,
}: {
  pct: number
  size?: number
  tone?: ClassTone
  label?: string
}) {
  const r = (size - 12) / 2
  const c = 2 * Math.PI * r
  const cx0 = size / 2
  const v = Math.max(0, Math.min(100, pct))
  const len = (v / 100) * c
  return (
    <div className="relative inline-flex" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={cx0}
          cy={cx0}
          r={r}
          fill="none"
          strokeWidth={9}
          className="stroke-slate-100 dark:stroke-slate-800"
        />
        <circle
          cx={cx0}
          cy={cx0}
          r={r}
          fill="none"
          strokeWidth={9}
          strokeLinecap="round"
          className={cx(TONE_STROKE[tone], 'transition-all duration-700')}
          strokeDasharray={`${len} ${c - len}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold tabular-nums text-slate-800 dark:text-slate-100">
          {Math.round(v)}%
        </span>
        {label && (
          <span className="text-[10px] text-slate-400 dark:text-slate-500">
            {label}
          </span>
        )}
      </div>
    </div>
  )
}

// ───────── 3. 水平條形圖（班社分布 / 任意類別）─────────
export function BarList({
  items,
  emptyHint = '未有資料',
}: {
  items: { label: string; value: number; tone?: ClassTone }[]
  emptyHint?: string
}) {
  const max = Math.max(1, ...items.map((i) => i.value))
  if (items.length === 0)
    return (
      <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">
        {emptyHint}
      </p>
    )
  return (
    <div className="space-y-2.5">
      {items.map((it) => {
        const pct = (it.value / max) * 100
        const tone = it.tone ?? 'accent'
        return (
          <div key={it.label} className="flex items-center gap-2">
            <span className="w-16 shrink-0 truncate text-xs font-medium text-slate-600 dark:text-slate-300">
              {it.label}
            </span>
            <div className="h-5 flex-1 overflow-hidden rounded-md bg-slate-100 dark:bg-slate-800">
              <div
                className={cx(
                  'flex h-full items-center justify-end rounded-md px-1.5 transition-all duration-500',
                  TONE_FILL[tone],
                )}
                style={{ width: `${Math.max(pct, it.value > 0 ? 10 : 0)}%` }}
              >
                {it.value > 0 && (
                  <span className="text-[10px] font-semibold tabular-nums text-white">
                    {it.value}
                  </span>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ───────── 4. 班級規模垂直長條（跨班比較）─────────
export function ClassSizeChart({
  data,
  activeId,
  onPick,
}: {
  data: { id: string; label: string; count: number; tone: ClassTone }[]
  activeId?: string
  onPick?: (id: string) => void
}) {
  const max = Math.max(1, ...data.map((d) => d.count))
  if (data.length === 0)
    return (
      <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">
        仲未有班別
      </p>
    )
  return (
    <div>
      <div className="flex h-32 items-end gap-2">
        {data.map((d) => {
          const h = (d.count / max) * 100
          const on = d.id === activeId
          return (
            <button
              key={d.id}
              type="button"
              onClick={onPick ? () => onPick(d.id) : undefined}
              className={cx(
                'group flex flex-1 flex-col items-center justify-end',
                onPick && 'cursor-pointer',
              )}
              title={`${d.label}：${d.count} 位`}
            >
              <span className="mb-1 text-[10px] font-semibold tabular-nums text-slate-500 dark:text-slate-400">
                {d.count || ''}
              </span>
              <div
                className={cx(
                  'w-full rounded-t-md transition-all duration-500',
                  TONE_FILL[d.tone],
                  on ? 'opacity-100 ring-2 ring-accent/40' : 'opacity-80 group-hover:opacity-100',
                )}
                style={{ height: `${Math.max(h, d.count > 0 ? 6 : 2)}%` }}
              />
            </button>
          )
        })}
      </div>
      <div className="mt-1.5 flex gap-2">
        {data.map((d) => (
          <span
            key={d.id}
            className={cx(
              'flex-1 truncate text-center text-[10px]',
              d.id === activeId
                ? 'font-semibold text-slate-600 dark:text-slate-300'
                : 'text-slate-400 dark:text-slate-500',
            )}
          >
            {d.label}
          </span>
        ))}
      </div>
    </div>
  )
}

// ───────── 5. 性別比例迷你橫條（班卡內聯用）─────────
export function GenderStrip({
  m,
  f,
  x,
}: {
  m: number
  f: number
  x: number
}) {
  const total = m + f + x
  if (total === 0) return null
  const seg = (n: number, cls: string) =>
    n > 0 ? (
      <div className={cls} style={{ width: `${(n / total) * 100}%` }} />
    ) : null
  return (
    <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
      {seg(m, 'bg-blue-500')}
      {seg(f, 'bg-rose-500')}
      {seg(x, 'bg-slate-400')}
    </div>
  )
}
