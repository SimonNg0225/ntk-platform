import { cx } from '../../../ui'
import type { MetricDef } from './types'

// ============================================================
//  健康圖表（自製 SVG，配合海軍藍 token；無第三方圖表庫）
// ============================================================

export const TONE_COLOR: Record<MetricDef['tone'], string> = {
  accent: 'var(--accent)',
  indigo: '#6366f1',
  emerald: '#10b981',
  sky: '#0ea5e9',
  amber: '#f59e0b',
}

interface Pt {
  date: string
  value: number | null
}

/** 折線趨勢圖：連接有資料嘅點（跳過空日斷成段），底部漸變填色 + 端點。 */
export function LineTrend({
  points,
  tone,
  height = 96,
  unit = '',
  decimals = 0,
}: {
  points: Pt[]
  tone: MetricDef['tone']
  height?: number
  unit?: string
  decimals?: number
}) {
  const color = TONE_COLOR[tone]
  const W = 320
  const H = height
  const padTop = 14
  const padBottom = 18
  const vals = points.map((p) => p.value).filter((v): v is number => v !== null)
  const hasData = vals.length > 0

  if (!hasData) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-dashed border-slate-200 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400"
        style={{ height: H }}
        role="img"
        aria-label="未有足夠資料"
      >
        未有足夠資料
      </div>
    )
  }

  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const span = max - min || 1
  const stepX = points.length > 1 ? W / (points.length - 1) : W
  const y = (v: number) => padTop + (H - padTop - padBottom) * (1 - (v - min) / span)
  const x = (i: number) => (points.length > 1 ? i * stepX : W / 2)

  // 連續段（跳過 null）
  const segments: { i: number; v: number }[][] = []
  let cur: { i: number; v: number }[] = []
  points.forEach((p, i) => {
    if (p.value === null) {
      if (cur.length) segments.push(cur)
      cur = []
    } else {
      cur.push({ i, v: p.value })
    }
  })
  if (cur.length) segments.push(cur)

  const gid = `grad-${tone}`
  const lastPt = (() => {
    for (let i = points.length - 1; i >= 0; i -= 1) if (points[i].value !== null) return { i, v: points[i].value as number }
    return null
  })()

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      style={{ height: H }}
      preserveAspectRatio="none"
      role="img"
      focusable="false"
      aria-label={lastPt ? `趨勢圖，最新 ${lastPt.v.toFixed(decimals)}${unit}` : '趨勢圖'}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {segments.map((seg, si) => {
        if (seg.length === 1) {
          return <circle key={si} cx={x(seg[0].i)} cy={y(seg[0].v)} r={3} fill={color} />
        }
        const line = seg.map((p, k) => `${k === 0 ? 'M' : 'L'}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')
        const area = `${line} L${x(seg[seg.length - 1].i).toFixed(1)},${H - padBottom} L${x(seg[0].i).toFixed(1)},${H - padBottom} Z`
        return (
          <g key={si}>
            <path d={area} fill={`url(#${gid})`} />
            <path d={line} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          </g>
        )
      })}
      {lastPt && <circle cx={x(lastPt.i)} cy={y(lastPt.v)} r={3.5} fill={color} stroke="white" strokeWidth={1.5} />}
    </svg>
  )
}

/** 一週柱狀圖（運動）：可選目標虛線（target = 每日平均目標）。 */
export function WeekBars({
  data,
  tone,
  unit = '',
}: {
  data: { label: string; value: number; highlight?: boolean }[]
  tone: MetricDef['tone']
  unit?: string
}) {
  const color = TONE_COLOR[tone]
  // 守衞缺值 / NaN / 負值 → 0，避免高度算式回 NaN。
  const safe = (v: number) => (Number.isFinite(v) && v > 0 ? v : 0)
  const max = Math.max(1, ...data.map((d) => safe(d.value)))
  const label = data.length
    ? `每日${unit ? `（${unit}）` : ''}：${data.map((d) => `${d.label} ${safe(d.value)}`).join('、')}`
    : '未有資料'
  return (
    <div
      className="flex items-end justify-between gap-1.5"
      style={{ height: 96 }}
      role="img"
      aria-label={label}
    >
      {data.map((d, i) => {
        const h = Math.round((safe(d.value) / max) * 72)
        return (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex w-full flex-1 items-end justify-center">
              <div
                aria-hidden="true"
                className={cx('w-full max-w-[26px] rounded-md transition-all', safe(d.value) === 0 && 'opacity-30')}
                style={{ height: Math.max(3, h), background: color, opacity: d.highlight ? 1 : 0.78 }}
                title={`${safe(d.value)}${unit}`}
              />
            </div>
            <span className="text-[10px] tabular-nums text-slate-500 dark:text-slate-400" aria-hidden="true">
              {d.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

/** 圓形進度環（飲水 / 運動達標）。 */
export function GoalRing({
  pct,
  tone,
  size = 72,
  stroke = 8,
  children,
}: {
  pct: number
  tone: MetricDef['tone']
  size?: number
  stroke?: number
  children?: React.ReactNode
}) {
  const color = TONE_COLOR[tone]
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  // 守衞 NaN / Infinity / 缺值 → 0，避免 strokeDasharray 變 NaN 令環消失。
  const clamped = Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 0
  const dash = (clamped / 100) * c
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      {/* 進度數值已由 children 以文字呈現，環本身純裝飾 → 對 SR 隱藏 */}
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true" focusable="false">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-slate-200 dark:text-slate-700" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center leading-none">
        {children}
      </div>
    </div>
  )
}
