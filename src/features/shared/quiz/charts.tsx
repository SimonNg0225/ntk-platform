import { useMemo } from 'react'
import { cx } from '../../../ui'
import type { Difficulty } from '../../../data/types'
import {
  DIFF_LABEL,
  type HeatCell,
  type ScorePoint,
  type TopicMastery,
} from './util'

// ============================================================
//  QuizMode 自製圖表（純 SVG / div，零 npm 依賴）
//  全部支援深色 + tabular-nums + 海軍藍 accent。
// ============================================================

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

// ───────── 1. 命中率折線圖（每次測驗 → 一點，含平滑漸層填充）─────────
export function ScoreLineChart({ points }: { points: ScorePoint[] }) {
  const W = 320
  const H = 120
  const PAD_X = 8
  const PAD_Y = 12

  const path = useMemo(() => {
    if (points.length === 0) return { line: '', area: '', dots: [] as { x: number; y: number; p: ScorePoint }[] }
    const n = points.length
    const innerW = W - PAD_X * 2
    const innerH = H - PAD_Y * 2
    const x = (i: number) => (n === 1 ? W / 2 : PAD_X + (i / (n - 1)) * innerW)
    const y = (v: number) => PAD_Y + (1 - v / 100) * innerH
    const dots = points.map((p, i) => ({ x: x(i), y: y(p.pct), p }))
    const line = dots.map((d, i) => `${i === 0 ? 'M' : 'L'}${d.x.toFixed(1)},${d.y.toFixed(1)}`).join(' ')
    const area =
      n === 1
        ? ''
        : `${line} L${dots[n - 1].x.toFixed(1)},${H - PAD_Y} L${dots[0].x.toFixed(1)},${H - PAD_Y} Z`
    return { line, area, dots }
  }, [points])

  if (points.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">
        仲未有測驗紀錄
      </p>
    )
  }

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none">
        {/* 60% 及格基準線 */}
        <line
          x1={PAD_X}
          x2={W - PAD_X}
          y1={PAD_Y + (1 - 60 / 100) * (H - PAD_Y * 2)}
          y2={PAD_Y + (1 - 60 / 100) * (H - PAD_Y * 2)}
          strokeDasharray="3 3"
          className="stroke-slate-200 dark:stroke-slate-700"
          strokeWidth={1}
        />
        <defs>
          <linearGradient id="quizScoreFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" className="text-accent" stopColor="currentColor" stopOpacity={0.28} />
            <stop offset="100%" className="text-accent" stopColor="currentColor" stopOpacity={0} />
          </linearGradient>
        </defs>
        {path.area && <path d={path.area} fill="url(#quizScoreFill)" className="text-accent" />}
        <path
          d={path.line}
          fill="none"
          className="stroke-accent"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        {path.dots.map((d, i) => (
          <circle
            key={i}
            cx={d.x}
            cy={d.y}
            r={2.6}
            className="fill-white stroke-accent dark:fill-slate-800"
            strokeWidth={1.6}
            vectorEffect="non-scaling-stroke"
          >
            <title>{`${d.p.pct}% · ${d.p.correct}/${d.p.total}`}</title>
          </circle>
        ))}
      </svg>
      <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500">
        <span>最早</span>
        <span className="tabular-nums">
          共 {points.length} 次 · 最近{' '}
          <span className="font-semibold text-slate-600 dark:text-slate-300">
            {points[points.length - 1].pct}%
          </span>
        </span>
        <span>最近</span>
      </div>
    </div>
  )
}

// ───────── 2. 課題掌握度（水平條，弱在前）─────────
export function TopicMasteryBars({
  rows,
  nameOf,
  onPick,
}: {
  rows: TopicMastery[]
  nameOf: (id: string) => string
  onPick?: (topicId: string) => void
}) {
  if (rows.length === 0)
    return (
      <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">
        仲未有課題資料
      </p>
    )
  return (
    <div className="space-y-2.5">
      {rows.map((r) => {
        const tone =
          r.pct >= 80 ? 'bg-emerald-500' : r.pct >= 50 ? 'bg-amber-500' : 'bg-rose-500'
        return (
          <button
            key={r.topicId}
            type="button"
            disabled={!onPick}
            onClick={() => onPick?.(r.topicId)}
            aria-label={onPick ? `練習「${nameOf(r.topicId)}」課題（命中 ${r.pct}%）` : undefined}
            className={cx(
              'flex w-full items-center gap-2 rounded-lg px-1 py-0.5 text-left transition',
              onPick && 'hover:bg-slate-50 dark:hover:bg-slate-800/60',
            )}
          >
            <span className="w-24 shrink-0 truncate text-xs font-medium text-slate-600 dark:text-slate-300">
              {nameOf(r.topicId)}
            </span>
            <div className="h-4 flex-1 overflow-hidden rounded-md bg-slate-100 dark:bg-slate-800">
              <div
                className={cx('h-full rounded-md transition-all duration-500', tone)}
                style={{ width: `${Math.max(r.pct, r.total > 0 ? 4 : 0)}%` }}
              />
            </div>
            <span className="w-16 shrink-0 text-right text-xs tabular-nums text-slate-400 dark:text-slate-500">
              {r.correct}/{r.total}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ───────── 3. 難度占比（甜甜圈，SVG）─────────
const DIFF_DONUT: Record<Difficulty, string> = {
  easy: 'stroke-emerald-500',
  medium: 'stroke-amber-500',
  hard: 'stroke-rose-500',
}

export function DifficultyDonut({
  rows,
  size = 132,
}: {
  rows: { diff: Difficulty; correct: number; total: number }[]
  size?: number
}) {
  const segments = rows
    .map((r) => ({
      value: r.total,
      correct: r.correct,
      color: DIFF_DONUT[r.diff],
      label: DIFF_LABEL[r.diff],
    }))
    .filter((s) => s.value > 0)
  const total = segments.reduce((s, x) => s + x.value, 0)
  const totalCorrect = segments.reduce((s, x) => s + x.correct, 0)
  const r = (size - 18) / 2
  const c = 2 * Math.PI * r
  const cx0 = size / 2
  let offset = 0

  if (total === 0)
    return (
      <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">冇資料</p>
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
        {segments.map((seg, i) => {
          const len = (seg.value / total) * c
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
            className="fill-slate-800 text-[20px] font-bold tabular-nums dark:fill-slate-100"
          >
            {Math.round((totalCorrect / total) * 100)}%
          </text>
          <text
            x={cx0}
            y={cx0 + 14}
            textAnchor="middle"
            className="fill-slate-400 text-[10px] dark:fill-slate-500"
          >
            整體命中
          </text>
        </g>
      </svg>
      <ul className="flex-1 space-y-1.5">
        {segments.map((seg, i) => (
          <li key={i} className="flex items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
              <span className={cx('h-2.5 w-2.5 rounded-sm', seg.color.replace('stroke-', 'bg-'))} />
              {seg.label}
            </span>
            <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">
              {seg.correct}/{seg.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ───────── 4. 練習熱力圖（GitHub 草地風）─────────
export function PracticeHeatmap({ cells }: { cells: HeatCell[] }) {
  const max = useMemo(() => Math.max(1, ...cells.map((c) => c.count)), [cells])
  const weeks: (HeatCell | null)[][] = useMemo(() => {
    if (cells.length === 0) return []
    const first = cells[0]
    const [y, m, d] = first.key.split('-').map(Number)
    const rawDow = new Date(y, (m ?? 1) - 1, d ?? 1).getDay()
    // 防呆：若 key 損壞令日期變 NaN，getDay() 會回 NaN，Array(NaN) 會擲 RangeError
    const dow = Number.isNaN(rawDow) ? 0 : rawDow
    const padded: (HeatCell | null)[] = [...Array(dow).fill(null), ...cells]
    const out: (HeatCell | null)[][] = []
    for (let i = 0; i < padded.length; i += 7) out.push(padded.slice(i, i + 7))
    return out
  }, [cells])

  const level = (count: number): number => {
    if (count === 0) return 0
    const ratio = count / max
    if (ratio <= 0.25) return 1
    if (ratio <= 0.5) return 2
    if (ratio <= 0.75) return 3
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
                  title={`${cell.key}：做 ${cell.count} 題`}
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
          近 {cells.length} 日 · 做{' '}
          <span className="font-semibold text-slate-600 dark:text-slate-300">{total}</span> 題 ·
          活躍 {activeDays} 日
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

// ───────── 小工具：時間範圍切換 ─────────
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
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
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
