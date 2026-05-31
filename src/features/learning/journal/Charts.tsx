import { useMemo, useState } from 'react'
import { Tooltip } from '../../../ui'
import {
  MOODS,
  WEEKDAYS,
  heatLevel,
  longDate,
  mediumDate,
  type HeatGrid,
  type MoodDef,
  type MoodPoint,
} from './util'

// ============================================================
//  學習日誌 — 自製圖表（SVG / div，零 npm 依賴）
//  全部吃彙整好嘅資料，theme 用 accent + 各色 dark: 變體
// ============================================================

const moodByScore = new Map<number, MoodDef>(MOODS.map((m) => [m.score, m]))

// ───────── 心情趨勢折線圖（含漸層面積 + hover 點）─────────
export function MoodTrendChart({ points }: { points: MoodPoint[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 320
  const H = 132
  const padL = 26
  const padR = 10
  const padT = 12
  const padB = 22
  const innerW = W - padL - padR
  const innerH = H - padT - padB
  const gid = 'jrnl-mood-grad'

  const geom = useMemo(() => {
    const n = points.length
    const x = (i: number) => (n <= 1 ? padL + innerW / 2 : padL + (i / (n - 1)) * innerW)
    const y = (score: number) => padT + innerH - ((score - 1) / 4) * innerH
    const pts = points.map((p, i) => ({ ...p, cx: x(i), cy: y(p.score) }))
    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.cx.toFixed(1)},${p.cy.toFixed(1)}`).join(' ')
    const area = pts.length
      ? `${line} L${pts[pts.length - 1].cx.toFixed(1)},${(padT + innerH).toFixed(1)} L${pts[0].cx.toFixed(1)},${(padT + innerH).toFixed(1)} Z`
      : ''
    return { pts, line, area }
  }, [points, innerW, innerH])

  if (points.length === 0) {
    return <ChartEmpty label="未有足夠心情資料" />
  }

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="心情趨勢折線圖">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" className="text-accent" stopColor="currentColor" stopOpacity="0.28" />
            <stop offset="100%" className="text-accent" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* 水平格線 + 心情 emoji 軸 */}
        {[5, 4, 3, 2, 1].map((s) => {
          const gy = padT + innerH - ((s - 1) / 4) * innerH
          return (
            <g key={s}>
              <line
                x1={padL}
                y1={gy}
                x2={W - padR}
                y2={gy}
                className="text-slate-200 dark:text-slate-700"
                stroke="currentColor"
                strokeWidth={1}
                strokeDasharray={s === 1 ? '0' : '3 3'}
              />
              <text x={padL - 6} y={gy + 4} textAnchor="end" className="fill-slate-400 text-[9px]">
                {moodByScore.get(s)?.emoji}
              </text>
            </g>
          )
        })}
        {/* 面積 + 線 */}
        {geom.area && <path d={geom.area} fill={`url(#${gid})`} />}
        <path d={geom.line} className="text-accent" stroke="currentColor" strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
        {/* 資料點 */}
        {geom.pts.map((p, i) => (
          <g key={p.key}>
            <circle
              cx={p.cx}
              cy={p.cy}
              r={hover === i ? 5 : 3.2}
              className="text-accent"
              fill="currentColor"
              stroke="white"
              strokeWidth={1.5}
            />
            <rect
              x={p.cx - 9}
              y={padT}
              width={18}
              height={innerH}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          </g>
        ))}
      </svg>
      {hover !== null && geom.pts[hover] && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-lg bg-slate-900 px-2 py-1 text-[11px] font-medium text-white shadow-md dark:bg-slate-700"
          style={{ left: `${(geom.pts[hover].cx / W) * 100}%`, top: `${(geom.pts[hover].cy / H) * 100}%` }}
        >
          {geom.pts[hover].emoji} {mediumDate(geom.pts[hover].key)}
        </div>
      )}
    </div>
  )
}

// ───────── 心情分佈（橫向條，依量表 5→1）─────────
export function MoodDistributionChart({ data }: { data: { def: MoodDef; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count))
  const total = data.reduce((s, d) => s + d.count, 0)
  if (total === 0) return <ChartEmpty label="未標記過心情" />
  return (
    <div className="space-y-2">
      {data.map(({ def, count }) => {
        const pct = total ? Math.round((count / total) * 100) : 0
        return (
          <div key={def.emoji} className="flex items-center gap-2">
            <span className="w-12 shrink-0 text-sm">
              {def.emoji}
              <span className="ml-1 text-[10px] text-slate-400">{def.label}</span>
            </span>
            <div className="h-3.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${(count / max) * 100}%`, backgroundColor: def.hex }}
              />
            </div>
            <span className="w-14 shrink-0 text-right text-xs tabular-nums text-slate-500 dark:text-slate-400">
              {count} · {pct}%
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ───────── 每月日誌數（直條圖）─────────
export function MonthlyBars({ data }: { data: { label: string; ym: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count))
  const total = data.reduce((s, d) => s + d.count, 0)
  if (total === 0) return <ChartEmpty label="未有日誌紀錄" />
  return (
    <div className="flex items-end gap-1.5" style={{ height: 132 }}>
      {data.map((d) => {
        const h = d.count === 0 ? 2 : Math.max(4, (d.count / max) * 104)
        return (
          <Tooltip key={d.ym} label={`${d.ym} · ${d.count} 篇`}>
            <div className="flex flex-1 flex-col items-center justify-end gap-1">
              {d.count > 0 && (
                <span className="text-[9px] font-medium tabular-nums text-slate-400">{d.count}</span>
              )}
              <div
                className={
                  'w-full rounded-t-md transition-all duration-500 ' +
                  (d.count > 0 ? 'bg-accent hover:bg-accent-strong' : 'bg-slate-200 dark:bg-slate-700')
                }
                style={{ height: h }}
              />
              <span className="text-[9px] text-slate-400">{d.label}</span>
            </div>
          </Tooltip>
        )
      })}
    </div>
  )
}

// ───────── 星期分佈（直條圖）─────────
export function WeekdayBars({ counts }: { counts: number[] }) {
  const max = Math.max(1, ...counts)
  const total = counts.reduce((s, c) => s + c, 0)
  if (total === 0) return <ChartEmpty label="未有日誌紀錄" />
  return (
    <div className="flex items-end gap-2" style={{ height: 116 }}>
      {counts.map((c, i) => {
        const h = c === 0 ? 2 : Math.max(4, (c / max) * 88)
        const weekend = i === 0 || i === 6
        return (
          <Tooltip key={i} label={`星期${WEEKDAYS[i]} · ${c} 篇`}>
            <div className="flex flex-1 flex-col items-center justify-end gap-1">
              <div
                className={
                  'w-full rounded-t-md transition-all duration-500 ' +
                  (c === 0
                    ? 'bg-slate-200 dark:bg-slate-700'
                    : weekend
                      ? 'bg-accent/60'
                      : 'bg-accent')
                }
                style={{ height: h }}
              />
              <span className="text-[10px] text-slate-400">{WEEKDAYS[i]}</span>
            </div>
          </Tooltip>
        )
      })}
    </div>
  )
}

// ───────── 年度熱力圖（GitHub contribution grid）─────────
export function YearHeatmap({
  grid,
  onPick,
}: {
  grid: HeatGrid
  onPick?: (key: string) => void
}) {
  return (
    <div className="overflow-x-auto pb-1">
      <div className="inline-flex flex-col gap-1">
        {/* 月份標籤列 */}
        <div className="relative ml-6 h-3" style={{ width: grid.weeks.length * 14 }}>
          {grid.monthLabels.map((m) => (
            <span
              key={`${m.col}-${m.label}`}
              className="absolute text-[9px] text-slate-400"
              style={{ left: m.col * 14 }}
            >
              {m.label}
            </span>
          ))}
        </div>
        <div className="flex gap-1">
          {/* 星期軸（隔行顯示） */}
          <div className="mr-0.5 flex w-5 flex-col gap-1">
            {WEEKDAYS.map((w, i) => (
              <span key={i} className="h-2.5 text-[8px] leading-[10px] text-slate-400">
                {i % 2 === 1 ? w : ''}
              </span>
            ))}
          </div>
          {/* 週 columns */}
          {grid.weeks.map((week, ci) => (
            <div key={ci} className="flex flex-col gap-1">
              {week.map((cell) =>
                cell.inYear ? (
                  <Tooltip key={cell.key} label={`${longDate(cell.key)} · ${cell.count} 篇`}>
                    <button
                      type="button"
                      aria-label={`${longDate(cell.key)} · ${cell.count} 篇`}
                      onClick={onPick ? () => onPick(cell.key) : undefined}
                      className={
                        'h-2.5 w-2.5 rounded-[2px] ring-1 ring-inset ring-black/5 transition hover:ring-accent dark:ring-white/5 ' +
                        heatLevel(cell.count)
                      }
                    />
                  </Tooltip>
                ) : (
                  <div key={cell.key} className="h-2.5 w-2.5 rounded-[2px] bg-transparent" />
                ),
              )}
            </div>
          ))}
        </div>
        {/* 圖例 */}
        <div className="ml-6 mt-1 flex items-center gap-1 text-[9px] text-slate-400">
          <span>少</span>
          {[0, 1, 2, 3, 4].map((n) => (
            <span key={n} className={'h-2.5 w-2.5 rounded-[2px] ' + heatLevel(n)} />
          ))}
          <span>多</span>
        </div>
      </div>
    </div>
  )
}

// ───────── 共用：圖表空狀態 ─────────
function ChartEmpty({ label }: { label: string }) {
  return (
    <div className="flex h-28 items-center justify-center rounded-lg border border-dashed border-slate-200 text-xs text-slate-400 dark:border-slate-700">
      {label}
    </div>
  )
}
