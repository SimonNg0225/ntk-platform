import { useMemo } from 'react'
import { cx } from '../../../ui'
import { WEEKDAYS, type DaySignal } from './util'

// ============================================================
//  儀表板自製圖表（純 SVG / div，零 npm 依賴）
//  全部支援深色 + tabular-nums + 海軍藍 accent。
// ============================================================

// ───────── 1. 今日聚焦三環（Apple Fitness 風）─────────
export interface RingSpec {
  label: string
  value: number
  goal: number
  unit: string
  stroke: string // tailwind stroke-*
  text: string // tailwind text-*
}

export function ActivityRings({ rings, size = 132 }: { rings: RingSpec[]; size?: number }) {
  const center = size / 2
  const stroke = 11
  const gap = 5
  // 由外到內
  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} className="shrink-0 -rotate-90">
        {rings.map((r, i) => {
          const radius = center - stroke / 2 - i * (stroke + gap)
          if (radius <= 2) return null
          const c = 2 * Math.PI * radius
          const pct = r.goal > 0 ? Math.min(1, r.value / r.goal) : 0
          const len = pct * c
          return (
            <g key={r.label}>
              <circle
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                strokeWidth={stroke}
                className="stroke-slate-100 dark:stroke-slate-800"
              />
              <circle
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                strokeWidth={stroke}
                strokeLinecap="round"
                className={cx('transition-all duration-700 ease-out', r.stroke)}
                strokeDasharray={`${len} ${c - len}`}
              />
            </g>
          )
        })}
      </svg>
      <ul className="flex-1 space-y-2">
        {rings.map((r) => {
          const pct = r.goal > 0 ? Math.round((r.value / r.goal) * 100) : 0
          return (
            <li key={r.label} className="leading-tight">
              <div className="flex items-baseline justify-between gap-2">
                <span className={cx('text-xs font-medium', r.text)}>{r.label}</span>
                <span className="text-xs font-semibold tabular-nums text-slate-500 dark:text-slate-400">
                  {pct}%
                </span>
              </div>
              <span className="text-sm font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                {Math.round(r.value)}
                <span className="text-xs font-normal text-slate-400">
                  {' '}
                  / {r.goal} {r.unit}
                </span>
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ───────── 2. 活動面積走勢（平滑 SVG area + hover 點）─────────
export function ActivityArea({
  signals,
  height = 90,
}: {
  signals: DaySignal[]
  height?: number
}) {
  const W = 600
  const H = height
  const pad = 4
  const max = useMemo(() => Math.max(1, ...signals.map((s) => s.score)), [signals])
  const n = signals.length

  const pts = useMemo(() => {
    if (n === 0) return [] as { x: number; y: number; s: DaySignal }[]
    return signals.map((s, i) => {
      const x = n === 1 ? W / 2 : pad + (i / (n - 1)) * (W - pad * 2)
      const y = H - pad - (s.score / max) * (H - pad * 2)
      return { x, y, s }
    })
  }, [signals, n, max, H])

  if (n === 0) return null

  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const area = `${line} L${pts[pts.length - 1].x.toFixed(1)},${H} L${pts[0].x.toFixed(1)},${H} Z`
  const total = signals.reduce((s, x) => s + x.score, 0)
  const activeDays = signals.filter((s) => s.score > 0).length

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" style={{ height }}>
        <defs>
          <linearGradient id="dashArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" className="text-accent" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" className="text-accent" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#dashArea)" className="text-accent" />
        <path
          d={line}
          fill="none"
          strokeWidth={2}
          className="stroke-accent"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        {pts.map((p) => (
          <circle key={p.s.key} cx={p.x} cy={p.y} r={2.5} className="fill-accent">
            <title>{`${p.s.label}：專注 ${Math.round(p.s.focusMin)} 分 · 複習 ${p.s.reviews} · 習慣 ${p.s.habitsDone}`}</title>
          </circle>
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
        <span>{signals[0]?.label}</span>
        <span>
          活躍 <span className="font-semibold text-slate-600 dark:text-slate-300">{activeDays}</span> 日 · 累計動量{' '}
          {total.toFixed(0)}
        </span>
        <span>{signals[n - 1]?.label}</span>
      </div>
    </div>
  )
}

// ───────── 3. 本週專注長條（每日分鐘）─────────
export function WeekBars({ signals }: { signals: DaySignal[] }) {
  const last7 = signals.slice(-7)
  const max = useMemo(() => Math.max(1, ...last7.map((s) => s.focusMin)), [last7])
  const todayK = last7.length ? last7[last7.length - 1].key : ''
  return (
    <div>
      <div className="flex h-24 items-end gap-2">
        {last7.map((s) => {
          const h = (s.focusMin / max) * 100
          const isToday = s.key === todayK
          return (
            <div
              key={s.key}
              className="group flex flex-1 flex-col items-center justify-end"
              title={`${s.label}：專注 ${Math.round(s.focusMin)} 分`}
            >
              <span className="mb-1 text-[10px] font-medium tabular-nums text-slate-500 opacity-0 transition group-hover:opacity-100 dark:text-slate-400">
                {s.focusMin ? Math.round(s.focusMin) : ''}
              </span>
              <div
                className={cx(
                  'w-full rounded-md transition-all duration-500',
                  s.focusMin > 0
                    ? isToday
                      ? 'bg-gradient-to-t from-accent-strong to-accent'
                      : 'bg-accent/60 group-hover:bg-accent'
                    : 'bg-slate-100 dark:bg-slate-800',
                )}
                style={{ height: `${Math.max(h, s.focusMin > 0 ? 5 : 3)}%` }}
              />
            </div>
          )
        })}
      </div>
      <div className="mt-1.5 flex gap-2">
        {last7.map((s) => (
          <span
            key={s.key}
            className={cx(
              'flex-1 text-center text-[10px] tabular-nums',
              s.key === todayK
                ? 'font-semibold text-accent-strong dark:text-accent'
                : 'text-slate-400 dark:text-slate-500',
            )}
          >
            {WEEKDAYS[s.weekday]}
          </span>
        ))}
      </div>
    </div>
  )
}

// ───────── 4. 心情走勢（折線 + emoji 軸；近 N 日）─────────
export function MoodTrend({
  points,
  height = 70,
}: {
  points: { key: string; label: string; score: number | null; emoji?: string }[]
  height?: number
}) {
  const W = 600
  const H = height
  const pad = 8
  const n = points.length
  const present = points.filter((p) => p.score != null)
  if (present.length === 0) return null
  const xy = (i: number, score: number) => {
    const x = n === 1 ? W / 2 : pad + (i / (n - 1)) * (W - pad * 2)
    // score 1..5 → 底到頂
    const y = H - pad - ((score - 1) / 4) * (H - pad * 2)
    return { x, y }
  }
  // 串連有值嘅點
  const segs: string[] = []
  let started = false
  points.forEach((p, i) => {
    if (p.score == null) {
      started = false
      return
    }
    const { x, y } = xy(i, p.score)
    segs.push(`${started ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`)
    started = true
  })
  const moodColor = ['#f43f5e', '#f97316', '#f59e0b', '#14b8a6', '#10b981'] // 1..5
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" style={{ height }}>
        {[1, 2, 3, 4, 5].map((g) => {
          const y = H - pad - ((g - 1) / 4) * (H - pad * 2)
          return (
            <line
              key={g}
              x1={0}
              y1={y}
              x2={W}
              y2={y}
              className="stroke-slate-100 dark:stroke-slate-800"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          )
        })}
        <path
          d={segs.join(' ')}
          fill="none"
          strokeWidth={2}
          className="stroke-accent"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        {points.map((p, i) => {
          if (p.score == null) return null
          const { x, y } = xy(i, p.score)
          return (
            <circle key={p.key} cx={x} cy={y} r={3} style={{ fill: moodColor[p.score - 1] }}>
              <title>{`${p.label}：${p.emoji ?? ''} ${p.score}/5`}</title>
            </circle>
          )
        })}
      </svg>
      <div className="mt-1 flex justify-between text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
        <span>{points[0]?.label}</span>
        <span>{points[n - 1]?.label}</span>
      </div>
    </div>
  )
}

// ───────── 5. 迷你環形（單值，給小卡用）─────────
export function MiniRing({
  value,
  size = 44,
  stroke = 5,
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
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
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

// ───────── 6. 活動小色點（時間線用）─────────
export function ActivityDot({ className }: { className: string }) {
  return <span className={cx('mt-1.5 h-2 w-2 shrink-0 rounded-full', className)} />
}
