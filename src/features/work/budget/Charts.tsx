import { useId, useMemo } from 'react'
import { LineChart } from 'lucide-react'
import { cx } from '../../../ui'
import {
  WEEKDAY_LABEL,
  dowOf,
  fmtMoney,
  fmtMoneyShort,
  type DayCell,
  type TrendRow,
} from './util'

// ============================================================
//  自製圖表（純 SVG / div，零 npm 依賴）
//  全部支援深色 + tabular-nums + 海軍藍 accent。
//   - CategoryDonut：支出分類佔比環形圖
//   - CashflowBars：每月收 / 支雙色長條
//   - BalanceTrend：每月淨結餘折線（含零軸 + 漸層）
//   - DailySpendChart：本月逐日支出長條（標今日）
//   - SpendingHeatmap：本月支出熱力日曆
//   - BudgetRing：單分類預算使用環（迷你）
// ============================================================

const ACCENT = 'var(--accent)'

// 圖表內柔和空狀態（細 icon + 一句友善文案，唔好淨係寫「無資料」）
function ChartEmpty({ message, height }: { message: string; height?: number }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-6 text-center dark:border-slate-700/60 dark:bg-slate-800/30"
      style={height ? { minHeight: height } : undefined}
      role="img"
      aria-label={message}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-700/60 dark:text-slate-500">
        <LineChart size={17} strokeWidth={1.75} />
      </span>
      <p className="text-xs text-slate-500 dark:text-slate-400">{message}</p>
    </div>
  )
}

// 分類佔比循環色（HEX，畀 SVG stroke / fill 用）
export const SLICE_HEX = [
  ACCENT,
  '#60a5fa', // blue-400
  '#fbbf24', // amber-400
  '#34d399', // emerald-400
  '#fb7185', // rose-400
  '#a78bfa', // violet-400
  '#22d3ee', // cyan-400
  '#f472b6', // pink-400
]

// ───────── 1. 支出分類佔比環形圖 ─────────
export function CategoryDonut({
  segments,
  centerValue,
  centerLabel,
  size = 148,
}: {
  segments: { label: string; value: number; color: string }[]
  centerValue: string
  centerLabel: string
  size?: number
}) {
  const total = segments.reduce((s, x) => s + x.value, 0)
  const r = (size - 22) / 2
  const c = 2 * Math.PI * r
  const cx0 = size / 2
  let offset = 0

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <svg width={size} height={size} className="shrink-0 -rotate-90">
        <circle
          cx={cx0}
          cy={cx0}
          r={r}
          fill="none"
          strokeWidth={16}
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
                strokeWidth={16}
                stroke={seg.color}
                strokeLinecap="butt"
                strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={-offset}
                className="transition-all duration-500"
              >
                <title>
                  {seg.label}：{fmtMoney(seg.value)}（{Math.round(frac * 100)}%）
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
            className="fill-slate-800 text-[19px] font-semibold tabular-nums dark:fill-slate-100"
          >
            {centerValue}
          </text>
          <text
            x={cx0}
            y={cx0 + 15}
            textAnchor="middle"
            className="fill-slate-400 text-[10px] dark:fill-slate-500"
          >
            {centerLabel}
          </text>
        </g>
      </svg>
      <ul className="w-full flex-1 space-y-0.5">
        {segments.slice(0, 7).map((seg, i) => {
          const pct = total > 0 ? Math.round((seg.value / total) * 100) : 0
          return (
            <li
              key={i}
              className="flex items-center justify-between gap-2 rounded-lg px-2 py-1 text-sm transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60"
            >
              <span className="flex min-w-0 items-center gap-2 text-slate-600 dark:text-slate-300">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: seg.color }}
                />
                <span className="truncate">{seg.label}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2.5">
                <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                  {fmtMoney(seg.value)}
                </span>
                <span className="min-w-[2.75rem] rounded-full bg-slate-100 px-1.5 py-0.5 text-right text-[11px] font-medium tabular-nums text-slate-500 dark:bg-slate-700/60 dark:text-slate-400">
                  {pct}%
                </span>
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ───────── 2. 每月收 / 支雙色長條 ─────────
export function CashflowBars({ rows }: { rows: TrendRow[] }) {
  const max = useMemo(
    () => Math.max(1, ...rows.map((r) => Math.max(r.income, r.expense))),
    [rows],
  )
  const hasData = rows.some((r) => r.income > 0 || r.expense > 0)
  if (!hasData) return <ChartEmpty message="累積幾個月記錄，就會見到收支趨勢。" height={176} />
  return (
    <div>
      <div className="flex h-44 items-end gap-2">
        {rows.map((r) => {
          const [, m] = r.key.split('-').map(Number)
          return (
            <div key={r.key} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex w-full flex-1 items-end justify-center gap-1">
                <div
                  title={`收入 ${fmtMoney(r.income)}`}
                  className="w-1/2 max-w-[1.4rem] rounded-t-md bg-emerald-400 transition-all duration-500 hover:bg-emerald-500 dark:bg-emerald-500"
                  style={{ height: `${Math.max((r.income / max) * 100, r.income > 0 ? 3 : 0)}%` }}
                />
                <div
                  title={`支出 ${fmtMoney(r.expense)}`}
                  className="w-1/2 max-w-[1.4rem] rounded-t-md bg-rose-400 transition-all duration-500 hover:bg-rose-500 dark:bg-rose-500"
                  style={{ height: `${Math.max((r.expense / max) * 100, r.expense > 0 ? 3 : 0)}%` }}
                />
              </div>
              <span className="text-[10px] tabular-nums text-slate-400">{m}月</span>
            </div>
          )
        })}
      </div>
      <Legend
        items={[
          { color: 'bg-emerald-400 dark:bg-emerald-500', label: '收入' },
          { color: 'bg-rose-400 dark:bg-rose-500', label: '支出' },
        ]}
      />
    </div>
  )
}

// ───────── 3. 每月淨結餘折線（含零軸 + 漸層）─────────
export function BalanceTrend({ rows, height = 168 }: { rows: TrendRow[]; height?: number }) {
  const gid = useId().replace(/[:]/g, '')
  const values = rows.map((r) => r.balance)
  const hasData = rows.some((r) => r.income > 0 || r.expense > 0)
  const max = Math.max(1, ...values.map((v) => Math.abs(v)))
  if (!hasData) return <ChartEmpty message="記低幾個月收支，淨結餘走勢會喺度顯示。" height={height} />
  const W = 100
  const padX = 3
  const usableW = W - padX * 2
  const x = (i: number) =>
    rows.length === 1 ? W / 2 : padX + (i / (rows.length - 1)) * usableW
  // y：0 結餘 = 中線；+max 頂、-max 底
  const y = (v: number) => 50 - (v / max) * 46
  const line = rows.map((r, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(r.balance)}`).join(' ')
  const area =
    `M ${x(0)} 50 ` +
    rows.map((r, i) => `L ${x(i)} ${y(r.balance)}`).join(' ') +
    ` L ${x(rows.length - 1)} 50 Z`

  return (
    <div className="w-full">
      <div className="relative w-full" style={{ height }}>
        {/* 零軸 */}
        <div className="absolute left-8 right-0 top-1/2 h-px -translate-y-1/2 bg-slate-200 dark:bg-slate-700" />
        <span className="absolute left-0 top-1/2 -translate-y-1/2 text-[9px] tabular-nums text-slate-300 dark:text-slate-600">
          0
        </span>
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 ml-8 h-full w-[calc(100%-2rem)] overflow-visible"
        >
          <defs>
            <linearGradient id={`bal-${gid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={ACCENT} stopOpacity="0.28" />
              <stop offset="50%" stopColor={ACCENT} stopOpacity="0.04" />
              <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#bal-${gid})`} />
          <path
            d={line}
            fill="none"
            className="stroke-accent"
            strokeWidth={1.6}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          {rows.map((r, i) => (
            <circle
              key={i}
              cx={x(i)}
              cy={y(r.balance)}
              r={2.2}
              className={cx(r.balance < 0 ? 'fill-rose-500' : 'fill-accent')}
              vectorEffect="non-scaling-stroke"
            >
              <title>
                {r.key}：結餘 {fmtMoney(r.balance)}
              </title>
            </circle>
          ))}
        </svg>
      </div>
      <div className="ml-8 mt-1 flex justify-between gap-1">
        {rows.map((r, i) => {
          const [, m] = r.key.split('-').map(Number)
          return (
            <span
              key={i}
              className="flex-1 text-center text-[9px] tabular-nums text-slate-400 dark:text-slate-500"
            >
              {m}月
            </span>
          )
        })}
      </div>
    </div>
  )
}

// ───────── 4. 本月逐日支出長條（標今日）─────────
export function DailySpendChart({
  cells,
  todayDay,
}: {
  cells: DayCell[]
  todayDay: number | null
}) {
  const max = useMemo(() => Math.max(1, ...cells.map((c) => c.expense)), [cells])
  const hasData = cells.some((c) => c.expense > 0)
  if (!hasData) return <ChartEmpty message="今個月仲未有支出，記低第一筆就見到走勢。" height={112} />
  return (
    <div>
      <div className="flex h-28 items-end gap-px">
        {cells.map((c) => {
          const isToday = c.day === todayDay
          return (
            <div
              key={c.day}
              className="group flex flex-1 flex-col items-center justify-end"
              title={`${c.day} 日：支出 ${fmtMoney(c.expense)}`}
            >
              <div
                className={cx(
                  'w-full rounded-t-sm transition-all duration-300',
                  c.expense > 0
                    ? isToday
                      ? 'bg-accent-strong'
                      : 'bg-accent/70 group-hover:bg-accent'
                    : 'bg-slate-100 dark:bg-slate-800',
                  isToday && 'ring-1 ring-accent ring-offset-1 ring-offset-white dark:ring-offset-slate-800',
                )}
                style={{ height: `${Math.max((c.expense / max) * 100, c.expense > 0 ? 4 : 2)}%` }}
              />
            </div>
          )
        })}
      </div>
      <div className="mt-1 flex justify-between text-[9px] tabular-nums text-slate-400 dark:text-slate-500">
        <span>1</span>
        <span>{Math.ceil(cells.length / 2)}</span>
        <span>{cells.length}</span>
      </div>
    </div>
  )
}

// ───────── 5. 本月支出熱力日曆 ─────────
export function SpendingHeatmap({ cells }: { cells: DayCell[] }) {
  const max = useMemo(() => Math.max(1, ...cells.map((c) => c.expense)), [cells])
  const total = cells.reduce((s, c) => s + c.expense, 0)
  const activeDays = cells.filter((c) => c.expense > 0).length
  const leadPad = cells.length ? dowOf(cells[0].date) : 0

  const level = (v: number): number => {
    if (v === 0) return 0
    const r = v / max
    if (r <= 0.25) return 1
    if (r <= 0.5) return 2
    if (r <= 0.75) return 3
    return 4
  }
  const LEVEL_CLS = [
    'bg-slate-100 dark:bg-slate-800',
    'bg-rose-200 dark:bg-rose-500/30',
    'bg-rose-300 dark:bg-rose-500/50',
    'bg-rose-400 dark:bg-rose-500/70',
    'bg-rose-500 dark:bg-rose-500',
  ]

  return (
    <div>
      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[9px] text-slate-400 dark:text-slate-500">
        {WEEKDAY_LABEL.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: leadPad }).map((_, i) => (
          <span key={`pad-${i}`} />
        ))}
        {cells.map((c) => (
          <span
            key={c.day}
            title={`${c.day} 日：支出 ${fmtMoney(c.expense)}`}
            className={cx(
              'flex aspect-square items-center justify-center rounded-[5px] text-[9px] tabular-nums ring-1 ring-inset ring-slate-900/5 transition dark:ring-white/5',
              LEVEL_CLS[level(c.expense)],
              level(c.expense) >= 3 ? 'text-white' : 'text-slate-400 dark:text-slate-500',
            )}
          >
            {c.day}
          </span>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500">
        <span className="tabular-nums">
          消費{' '}
          <span className="font-semibold text-slate-600 dark:text-slate-300">{activeDays}</span> 日 ·
          共{' '}
          <span className="font-semibold text-slate-600 dark:text-slate-300">
            {fmtMoneyShort(total)}
          </span>
        </span>
        <span className="flex items-center gap-1">
          少
          {LEVEL_CLS.map((cls, i) => (
            <span key={i} className={cx('h-[11px] w-[11px] rounded-[3px] ring-1 ring-inset ring-slate-900/5 dark:ring-white/5', cls)} />
          ))}
          多
        </span>
      </div>
    </div>
  )
}

// ───────── 6. 單分類預算使用環（迷你）─────────
export function BudgetRing({
  pct,
  over,
  size = 40,
}: {
  pct: number
  over: boolean
  size?: number
}) {
  const r = size / 2 - 4
  const c = 2 * Math.PI * r
  const clamped = Math.min(100, Math.max(0, pct))
  const len = (clamped / 100) * c
  const stroke = over ? '#f43f5e' : clamped >= 80 ? '#f59e0b' : ACCENT
  return (
    <svg width={size} height={size} className="-rotate-90 shrink-0">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={5}
        className="stroke-slate-100 dark:stroke-slate-700"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={5}
        stroke={stroke}
        strokeLinecap="round"
        strokeDasharray={`${len} ${c - len}`}
        className="transition-all duration-500"
      />
    </svg>
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
