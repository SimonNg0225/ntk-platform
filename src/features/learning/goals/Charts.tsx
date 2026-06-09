// ============================================================
//  學習目標 — 自製 SVG / div 圖表（零 npm 依賴）
//  登山母題：進度 = 海拔，里程碑 = 沿途路標。
//  ① ProgressRing   單目標環形進度
//  ② StatusDonut    狀態分佈甜甜圈 + 中心總數
//  ③ MomentumChart  動量折線 / 面積圖（含 hover tooltip）
//  ④ CategoryBars   分類橫向長條（平均海拔）
//  ⑤ AscentMeter    Hero 用：整體平均海拔半圓儀錶（攀升軌跡 + 山頂旗）
// ============================================================
import { useState } from 'react'
import { Flag } from 'lucide-react'
import { cx } from '../../../ui'
import type { MomentumPoint } from './util'

// ───────── ① 環形進度（單目標卡用）─────────
export function ProgressRing({
  value,
  size = 44,
  stroke = 5,
  tone = 'accent',
}: {
  value: number
  size?: number
  stroke?: number
  tone?: 'accent' | 'green' | 'amber' | 'rose'
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(100, value))
  const off = c - (v / 100) * c
  const color =
    tone === 'green'
      ? 'stroke-emerald-500'
      : tone === 'amber'
        ? 'stroke-amber-500'
        : tone === 'rose'
          ? 'stroke-rose-500'
          : 'stroke-accent'
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className="shrink-0 -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={stroke}
        className="stroke-slate-100 dark:stroke-slate-700"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={off}
        className={cx(color, 'transition-all duration-500 ease-out')}
      />
    </svg>
  )
}

// ───────── ② 狀態分佈甜甜圈 ─────────
const DONUT_COLORS: Record<string, string> = {
  active: 'var(--accent)',
  paused: '#f59e0b',
  done: '#10b981',
}

export function StatusDonut({
  segments,
  total,
}: {
  segments: { id: string; label: string; value: number }[]
  total: number
}) {
  const size = 132
  const stroke = 16
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const sum = segments.reduce((s, x) => s + x.value, 0) || 1
  let acc = 0
  return (
    <div className="flex items-center gap-5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-slate-100 dark:stroke-slate-700" />
          {segments.map((seg) => {
            if (seg.value === 0) return null
            const frac = seg.value / sum
            const dash = frac * c
            const gap = c - dash
            const offset = -acc * c
            acc += frac
            return (
              <circle
                key={seg.id}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                strokeWidth={stroke}
                strokeDasharray={`${dash} ${gap}`}
                strokeDashoffset={offset}
                style={{ stroke: DONUT_COLORS[seg.id] ?? '#94a3b8' }}
                className="transition-all duration-500"
              />
            )
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold tabular-nums text-slate-800 dark:text-slate-100">{total}</span>
          <span className="text-[11px] text-slate-400">個目標</span>
        </div>
      </div>
      <ul className="space-y-1.5">
        {segments.map((seg) => (
          <li key={seg.id} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: DONUT_COLORS[seg.id] ?? '#94a3b8' }} />
            <span className="text-slate-600 dark:text-slate-300">{seg.label}</span>
            <span className="ml-auto tabular-nums font-medium text-slate-800 dark:text-slate-100">{seg.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ───────── ③ 動量折線 / 面積圖 ─────────
export function MomentumChart({
  data,
  height = 120,
}: {
  data: MomentumPoint[]
  height?: number
}) {
  const [hover, setHover] = useState<number | null>(null)
  const width = 320
  const padL = 4
  const padR = 4
  const padT = 8
  const padB = 8
  const innerW = width - padL - padR
  const innerH = height - padT - padB
  const n = data.length

  if (n < 2) {
    return (
      <div className="flex h-[120px] items-center justify-center text-xs text-slate-400">
        簽到 2 次以上即顯示動量曲線
      </div>
    )
  }

  const x = (i: number) => padL + (i / (n - 1)) * innerW
  const y = (v: number) => padT + (1 - v / 100) * innerH

  const linePts = data.map((d, i) => `${x(i)},${y(d.value)}`).join(' ')
  const areaPts = `${padL},${padT + innerH} ${linePts} ${padL + innerW},${padT + innerH}`

  const hp = hover != null ? data[hover] : null

  return (
    <div className="relative">
      <svg
        width="100%"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        aria-hidden="true"
        className="overflow-visible"
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="goalMomentumFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* 水平格線 25/50/75 */}
        {[25, 50, 75].map((g) => (
          <line
            key={g}
            x1={padL}
            x2={padL + innerW}
            y1={y(g)}
            y2={y(g)}
            className="stroke-slate-100 dark:stroke-slate-700/70"
            strokeWidth={1}
            strokeDasharray="3 4"
          />
        ))}
        <polygon points={areaPts} fill="url(#goalMomentumFill)" />
        <polyline
          points={linePts}
          fill="none"
          className="stroke-accent"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        {/* hover 點 */}
        {hp && (
          <>
            <line x1={x(hover!)} x2={x(hover!)} y1={padT} y2={padT + innerH} className="stroke-accent/40" strokeWidth={1} />
            <circle cx={x(hover!)} cy={y(hp.value)} r={3.5} className="fill-accent" />
          </>
        )}
        {/* 透明 hover 區（用 rect 覆蓋，定位用） */}
        {data.map((_, i) => (
          <rect
            key={i}
            x={x(i) - innerW / (n - 1) / 2}
            y={0}
            width={innerW / (n - 1)}
            height={height}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        ))}
      </svg>
      {hp && (
        <div
          className="pointer-events-none absolute -top-1 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] font-medium text-white shadow-md dark:bg-slate-700"
          style={{ left: `${(hover! / (n - 1)) * 100}%` }}
        >
          <span className="tabular-nums">{hp.value}%</span>
          <span className="ml-1.5 text-white/60">{hp.key.slice(5)}</span>
        </div>
      )}
    </div>
  )
}

// ───────── ④ 分類橫向長條（各路線平均海拔；終點山頂旗標）─────────
export function CategoryBars({
  rows,
}: {
  rows: { id: string; label: string; dot: string; count: number; avg: number }[]
}) {
  if (rows.length === 0)
    return <p className="py-4 text-center text-xs text-slate-400">未有資料</p>
  return (
    <ul className="space-y-3">
      {rows.map((r) => {
        const w = Math.max(0, Math.min(100, r.avg))
        const summit = w >= 100
        return (
          <li key={r.id} className="flex items-center gap-3">
            <div className="flex w-20 shrink-0 items-center gap-1.5">
              <span className={cx('h-2 w-2 rounded-full', r.dot)} />
              <span className="truncate text-xs text-slate-600 dark:text-slate-300">{r.label}</span>
            </div>
            {/* 海拔軌：底軌 + 已攀升段 + 沿途攀升者點 */}
            <div className="relative h-2.5 flex-1">
              <span aria-hidden="true" className="absolute inset-0 rounded-full bg-slate-100 dark:bg-slate-700" />
              <span
                aria-hidden="true"
                className={cx('absolute inset-y-0 left-0 rounded-full transition-all duration-500', summit ? 'bg-emerald-500' : 'bg-accent')}
                style={{ width: `${w}%` }}
              />
              {w > 0 && w < 100 && (
                <span
                  aria-hidden="true"
                  className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent ring-2 ring-white dark:ring-slate-800"
                  style={{ left: `${w}%` }}
                />
              )}
              {/* 終點山頂旗 */}
              <span
                aria-hidden="true"
                className={cx(
                  'absolute right-0 top-1/2 flex h-4 w-4 -translate-y-1/2 translate-x-1.5 items-center justify-center rounded-full ring-2 transition-colors',
                  summit ? 'bg-emerald-500 text-white ring-white dark:ring-slate-800' : 'bg-white text-slate-300 ring-slate-200 dark:bg-slate-800 dark:text-slate-500 dark:ring-slate-600',
                )}
              >
                <Flag size={9} className={summit ? 'fill-current' : ''} />
              </span>
            </div>
            <span className="flex w-16 shrink-0 items-baseline justify-end gap-1 text-right tabular-nums">
              <span className={cx('text-sm font-semibold', summit ? 'text-emerald-500' : 'text-slate-700 dark:text-slate-200')}>{r.avg}%</span>
              <span className="text-[11px] text-slate-400">·{r.count}</span>
            </span>
          </li>
        )
      })}
    </ul>
  )
}

// ───────── ⑤ 海拔儀錶（Hero 用，鋪喺 accent 漸變底 → 純白色系）─────────
// 半圓「攀升軌跡」：底軌虛、已攀升段實白、山頂位放面旗。中央 serif 大海拔數字。
export function AscentMeter({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, Math.round(value)))
  const size = 132
  const stroke = 9
  const r = (size - stroke) / 2 - 2
  const cx0 = size / 2
  const cy0 = size / 2
  // 半圓：180°(左) → 0°(右)，掃過頂部。用 path 描下半圈軌跡。
  const semi = Math.PI * r // 半圓弧長
  const off = semi - (v / 100) * semi
  // 山頂旗位置（沿半圓，由左 180° 行到右 0°）
  const ang = Math.PI - (v / 100) * Math.PI
  const fx = cx0 + r * Math.cos(ang)
  const fy = cy0 - r * Math.sin(ang)
  return (
    <div className="relative shrink-0" style={{ width: size, height: size / 2 + 28 }}>
      <svg width={size} height={size / 2 + 8} viewBox={`0 0 ${size} ${size / 2 + 8}`} aria-hidden="true" className="overflow-visible">
        {/* 底軌（虛白，代表整段山路）*/}
        <path
          d={`M ${cx0 - r} ${cy0} A ${r} ${r} 0 0 1 ${cx0 + r} ${cy0}`}
          fill="none"
          stroke="white"
          strokeOpacity="0.25"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray="2 7"
        />
        {/* 已攀升段（實白）*/}
        <path
          d={`M ${cx0 - r} ${cy0} A ${r} ${r} 0 0 1 ${cx0 + r} ${cy0}`}
          fill="none"
          stroke="white"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={semi}
          strokeDashoffset={off}
          className="transition-all duration-700 ease-out"
        />
        {/* 攀升者位置點 */}
        {v > 0 && v < 100 && (
          <circle cx={fx} cy={fy} r={4} fill="white" className="drop-shadow" />
        )}
      </svg>
      {/* 山頂旗（去到 100% 先點亮）*/}
      <span
        className={cx(
          'absolute right-1 top-0 flex h-6 w-6 items-center justify-center rounded-full transition-colors',
          v >= 100 ? 'bg-white text-accent-strong' : 'bg-white/20 text-white/70',
        )}
      >
        <Flag size={13} className={v >= 100 ? 'fill-current' : ''} />
      </span>
      {/* 中央：serif 大海拔數字 */}
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
        <span className="text-3xl font-semibold leading-none tabular-nums text-white">
          {v}<span className="ml-0.5 align-top font-sans text-base font-medium text-white/70">%</span>
        </span>
        <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.2em] text-white/65">平均海拔</span>
      </div>
    </div>
  )
}
