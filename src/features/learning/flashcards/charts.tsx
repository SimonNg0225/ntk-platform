import { useMemo } from 'react'
import { cx } from '../../../ui'
import type { Rating } from '../../../lib/srs'
import {
  type ForecastBar,
  type HeatCell,
  type IntervalBin,
} from './srs'
import type { CardState } from './types'

// ============================================================
//  自製圖表（純 SVG / div，零 npm 依賴）
//  全部支援深色 + tabular-nums + 海軍藍 accent。
// ============================================================

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

// ───────── 1. 複習熱力圖（GitHub 草地風，17 週）─────────
export function Heatmap({ cells }: { cells: HeatCell[] }) {
  const max = useMemo(() => Math.max(1, ...cells.map((c) => c.count)), [cells])
  // 切成「週」直欄：由第一格嘅星期幾頂部補白
  const weeks: (HeatCell | null)[][] = useMemo(() => {
    if (cells.length === 0) return []
    const first = cells[0]
    const [y, m, d] = first.key.split('-').map(Number)
    const dow = new Date(y, (m ?? 1) - 1, d ?? 1).getDay()
    const padded: (HeatCell | null)[] = [...Array(dow).fill(null), ...cells]
    const out: (HeatCell | null)[][] = []
    for (let i = 0; i < padded.length; i += 7) out.push(padded.slice(i, i + 7))
    return out
  }, [cells])

  const level = (count: number): number => {
    if (count === 0) return 0
    const r = count / max
    if (r <= 0.25) return 1
    if (r <= 0.5) return 2
    if (r <= 0.75) return 3
    return 4
  }
  const LEVEL_CLS = [
    'bg-slate-100 dark:bg-slate-800',
    'bg-accent/25',
    'bg-accent/45',
    'bg-accent/70',
    'bg-accent',
  ]

  const total = cells.reduce((s, c) => s + c.count, 0)
  const activeDays = cells.filter((c) => c.count > 0).length

  return (
    <div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {/* 星期標籤 */}
        <div className="mr-0.5 flex flex-col gap-[3px] pt-[2px] text-[9px] leading-none text-slate-400 dark:text-slate-500">
          {WEEKDAYS.map((w, i) => (
            <span key={w} className="h-[11px]">
              {i % 2 === 1 ? w : ''}
            </span>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-[3px]">
            {Array.from({ length: 7 }).map((_, di) => {
              const cell = week[di]
              if (!cell) return <span key={di} className="h-[11px] w-[11px]" />
              return (
                <span
                  key={di}
                  title={`${cell.key}：${cell.count} 次複習`}
                  className={cx(
                    'h-[11px] w-[11px] rounded-[2px] ring-1 ring-inset ring-slate-900/5 transition dark:ring-white/5',
                    LEVEL_CLS[level(cell.count)],
                  )}
                />
              )
            })}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500">
        <span className="tabular-nums">
          近 {cells.length} 日 · 複習{' '}
          <span className="font-semibold text-slate-600 dark:text-slate-300">
            {total}
          </span>{' '}
          次 · 活躍 {activeDays} 日
        </span>
        <span className="flex items-center gap-1">
          少
          {LEVEL_CLS.map((c, i) => (
            <span key={i} className={cx('h-[10px] w-[10px] rounded-[2px]', c)} />
          ))}
          多
        </span>
      </div>
    </div>
  )
}

// ───────── 2. 到期預測（堆疊長條：生卡 / 熟卡）─────────
export function ForecastChart({ bars }: { bars: ForecastBar[] }) {
  const max = useMemo(
    () => Math.max(1, ...bars.map((b) => b.young + b.mature)),
    [bars],
  )
  const totalDue = bars.reduce((s, b) => s + b.young + b.mature, 0)
  if (totalDue === 0) {
    return (
      <p className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">
        未來冇卡到期 🎉
      </p>
    )
  }
  return (
    <div>
      <div className="flex h-36 items-end gap-1.5">
        {bars.map((b) => {
          const sum = b.young + b.mature
          const h = (sum / max) * 100
          return (
            <div
              key={b.key}
              className="group flex flex-1 flex-col items-center justify-end"
              title={`${b.key}：生卡 ${b.young} · 熟卡 ${b.mature}`}
            >
              <span className="mb-1 text-[10px] font-medium tabular-nums text-slate-500 opacity-0 transition group-hover:opacity-100 dark:text-slate-400">
                {sum || ''}
              </span>
              <div
                className="flex w-full flex-col-reverse overflow-hidden rounded-md"
                style={{ height: `${Math.max(h, sum > 0 ? 4 : 0)}%` }}
              >
                <div
                  className="bg-accent transition-all"
                  style={{ height: `${sum ? (b.young / sum) * 100 : 0}%` }}
                />
                <div
                  className="bg-emerald-500 transition-all"
                  style={{ height: `${sum ? (b.mature / sum) * 100 : 0}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        {bars.map((b) => (
          <span
            key={b.key}
            className="flex-1 text-center text-[10px] tabular-nums text-slate-400 dark:text-slate-500"
          >
            {b.label}
          </span>
        ))}
      </div>
      <Legend
        items={[
          { color: 'bg-accent', label: '生卡' },
          { color: 'bg-emerald-500', label: '熟卡' },
        ]}
      />
    </div>
  )
}

// ───────── 3. 留存率 / 狀態占比（甜甜圈，SVG）─────────
export function Donut({
  segments,
  centerLabel,
  centerValue,
  size = 132,
}: {
  segments: { value: number; color: string; label: string }[]
  centerLabel: string
  centerValue: string
  size?: number
}) {
  const total = segments.reduce((s, x) => s + x.value, 0)
  const r = (size - 18) / 2
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
          strokeWidth={14}
          className="stroke-slate-100 dark:stroke-slate-800"
        />
        {total > 0 &&
          segments.map((seg, i) => {
            const frac = seg.value / total
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
                className={seg.color}
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
            {centerValue}
          </text>
          <text
            x={cx0}
            y={cx0 + 14}
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
              <span
                className={cx('h-2.5 w-2.5 rounded-sm', seg.color.replace('stroke-', 'bg-'))}
              />
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

// ───────── 4. 答題掣分布（水平條）─────────
const RATING_META: Record<Rating, { label: string; bar: string; text: string }> = {
  again: { label: '唔記得', bar: 'bg-rose-500', text: 'text-rose-600 dark:text-rose-400' },
  hard: { label: '有啲難', bar: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' },
  good: { label: '記得', bar: 'bg-accent', text: 'text-accent-strong dark:text-accent' },
  easy: { label: '好易', bar: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
}

export function AnswerBars({ data }: { data: Record<Rating, number> }) {
  const order: Rating[] = ['again', 'hard', 'good', 'easy']
  const total = order.reduce((s, r) => s + data[r], 0)
  if (total === 0)
    return (
      <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">
        仲未有複習紀錄
      </p>
    )
  return (
    <div className="space-y-2.5">
      {order.map((r) => {
        const v = data[r]
        const pct = (v / total) * 100
        const m = RATING_META[r]
        return (
          <div key={r} className="flex items-center gap-2">
            <span className={cx('w-14 shrink-0 text-xs font-medium', m.text)}>
              {m.label}
            </span>
            <div className="h-5 flex-1 overflow-hidden rounded-md bg-slate-100 dark:bg-slate-800">
              <div
                className={cx('flex h-full items-center justify-end rounded-md px-1.5 transition-all duration-500', m.bar)}
                style={{ width: `${Math.max(pct, v > 0 ? 8 : 0)}%` }}
              >
                {v > 0 && (
                  <span className="text-[10px] font-semibold tabular-nums text-white">
                    {v}
                  </span>
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

// ───────── 5. 間隔分布直方圖（垂直長條）─────────
export function IntervalChart({ bins }: { bins: IntervalBin[] }) {
  const max = useMemo(() => Math.max(1, ...bins.map((b) => b.count)), [bins])
  const total = bins.reduce((s, b) => s + b.count, 0)
  if (total === 0)
    return (
      <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">
        仲未有已排程嘅卡
      </p>
    )
  return (
    <div>
      <div className="flex h-28 items-end gap-2">
        {bins.map((b) => (
          <div
            key={b.label}
            className="group flex flex-1 flex-col items-center justify-end"
            title={`${b.label}：${b.count} 張`}
          >
            <span className="mb-1 text-[10px] font-medium tabular-nums text-slate-500 dark:text-slate-400">
              {b.count || ''}
            </span>
            <div
              className="w-full rounded-t-md bg-gradient-to-t from-accent-strong to-accent transition-all duration-500"
              style={{ height: `${Math.max((b.count / max) * 100, b.count > 0 ? 4 : 0)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-2">
        {bins.map((b) => (
          <span
            key={b.label}
            className="flex-1 text-center text-[9px] leading-tight text-slate-400 dark:text-slate-500"
          >
            {b.label}
          </span>
        ))}
      </div>
    </div>
  )
}

// ───────── 6. 每日複習趨勢（迷你長條）─────────
export function DailyTrend({
  data,
}: {
  data: { key: string; label: string; count: number }[]
}) {
  const max = useMemo(() => Math.max(1, ...data.map((d) => d.count)), [data])
  return (
    <div>
      <div className="flex h-20 items-end gap-1">
        {data.map((d) => (
          <div
            key={d.key}
            className="group flex flex-1 flex-col items-center justify-end"
            title={`${d.key}：${d.count} 次`}
          >
            <div
              className={cx(
                'w-full rounded-sm transition-all duration-500',
                d.count > 0 ? 'bg-accent group-hover:bg-accent-strong' : 'bg-slate-100 dark:bg-slate-800',
              )}
              style={{ height: `${Math.max((d.count / max) * 100, d.count > 0 ? 6 : 3)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1">
        {data.map((d, i) => (
          <span
            key={d.key}
            className="flex-1 text-center text-[9px] tabular-nums text-slate-400 dark:text-slate-500"
          >
            {i % 2 === 0 ? d.label : ''}
          </span>
        ))}
      </div>
    </div>
  )
}

// ───────── 圖例 ─────────
function Legend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
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

// ───────── 狀態色（畀 Donut 用）─────────
export const STATE_DONUT_COLOR: Record<CardState, string> = {
  new: 'stroke-blue-500',
  learning: 'stroke-amber-500',
  young: 'stroke-accent',
  mature: 'stroke-emerald-500',
  suspended: 'stroke-slate-400',
}

// 小工具：可重用嘅互動切換（給 stats 時間範圍）
export function RangeToggle({
  value,
  onChange,
  options,
}: {
  value: number
  onChange: (v: number) => void
  options: { value: number; label: string }[]
}) {
  return (
    <div className="inline-flex gap-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'rounded-md px-2 py-0.5 text-[11px] font-medium transition',
            value === o.value
              ? 'bg-accent text-white'
              : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
