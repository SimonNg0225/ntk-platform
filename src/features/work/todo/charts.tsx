import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import './i18n'
import { cx } from '../../../ui'
import type { HeatCell, TrendPoint } from './util'

// ============================================================
//  待辦統計圖表（純 SVG / div，零 npm 依賴）
//  深色 + tabular-nums + 海軍藍 accent。
// ============================================================

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

// ───────── 1. 完成 / 新增雙線趨勢（迷你長條 + 折線）─────────
export function TrendChart({ data }: { data: TrendPoint[] }) {
  const { t } = useTranslation()
  const max = useMemo(
    () => Math.max(1, ...data.map((d) => Math.max(d.created, d.completed))),
    [data],
  )
  const totalDone = data.reduce((s, d) => s + d.completed, 0)
  const totalNew = data.reduce((s, d) => s + d.created, 0)

  // 折線（完成）座標
  const w = 100
  const h = 100
  const pts = data.map((d, i) => {
    const x = data.length > 1 ? (i / (data.length - 1)) * w : w / 2
    const y = h - (d.completed / max) * h
    return `${x.toFixed(2)},${y.toFixed(2)}`
  })

  return (
    <div>
      {/* 90 日時固定 gap 會撐爆窄螢幕 → 外層可橫捲；內層 min-w-full 平時填滿卡，
          bar 最小闊度 min-w-[4px]：bar 多到平均 <4px（如 90 日窄機）就溢出觸發橫捲 */}
      <div className="overflow-x-auto pb-1">
        <div className="min-w-full">
          <div className="relative flex h-32 items-end gap-1">
            {/* 新增：底層淺長條 */}
            {data.map((d) => (
              <div
                key={d.key}
                className="group flex min-w-[4px] flex-1 flex-col items-center justify-end"
                title={`${d.key}：${t('todo.legendAdded', { count: d.created, defaultValue: `新增 ${d.created}` })} · ${t('todo.legendCompleted', { count: d.completed, defaultValue: `完成 ${d.completed}` })}`}
              >
                <div
                  className="w-full rounded-md bg-slate-100 transition-all duration-300 group-hover:bg-slate-200 dark:bg-slate-800 dark:group-hover:bg-slate-700"
                  style={{ height: `${(d.created / max) * 100}%` }}
                />
              </div>
            ))}
            {/* 完成：折線 overlay */}
            {data.length > 1 && (
              <svg
                viewBox={`0 0 ${w} ${h}`}
                preserveAspectRatio="none"
                className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
              >
                <polyline
                  points={pts.join(' ')}
                  fill="none"
                  className="stroke-accent"
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
                {data.map((d, i) => {
                  const x = (i / (data.length - 1)) * w
                  const y = h - (d.completed / max) * h
                  return (
                    <circle
                      key={d.key}
                      cx={x}
                      cy={y}
                      r={2.5}
                      className="fill-accent"
                      vectorEffect="non-scaling-stroke"
                    />
                  )
                })}
              </svg>
            )}
          </div>
          <div className="mt-1.5 flex gap-1">
            {data.map((d, i) => (
              <span
                key={d.key}
                className="min-w-[4px] flex-1 text-center text-[9px] tabular-nums text-slate-400 dark:text-slate-500"
              >
                {i % Math.ceil(data.length / 7) === 0 ? d.label : ''}
              </span>
            ))}
          </div>
        </div>
      </div>
      <Legend
        items={[
          {
            color: 'bg-accent',
            label: t('todo.legendCompleted', { count: totalDone, defaultValue: `完成 ${totalDone}` }),
          },
          {
            color: 'bg-slate-200 dark:bg-slate-700',
            label: t('todo.legendAdded', { count: totalNew, defaultValue: `新增 ${totalNew}` }),
          },
        ]}
      />
    </div>
  )
}

// ───────── 2. 完成熱力圖（GitHub 草地風）─────────
export function CompletionHeatmap({ cells }: { cells: HeatCell[] }) {
  const { t } = useTranslation()
  const max = useMemo(() => Math.max(1, ...cells.map((c) => c.count)), [cells])
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
    'bg-emerald-500/25',
    'bg-emerald-500/45',
    'bg-emerald-500/70',
    'bg-emerald-500',
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
                  title={`${cell.key}：${t('todo.heatCellTip', { count: cell.count, defaultValue: `完成 ${cell.count} 項` })}`}
                  className={cx(
                    'h-[11px] w-[11px] rounded-[3px] ring-1 ring-inset ring-slate-900/5 transition hover:ring-slate-900/15 dark:ring-white/5 dark:hover:ring-white/15',
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
          {t('todo.heatSummary', { days: cells.length, defaultValue: `近 ${cells.length} 日 · 完成` })}{' '}
          <span className="font-semibold text-slate-600 dark:text-slate-300">
            {total}
          </span>{' '}
          {t('todo.heatSummaryItems', { active: activeDays, defaultValue: `項 · 活躍 ${activeDays} 日` })}
        </span>
        <span className="flex items-center gap-1">
          {t('todo.heatLess', { defaultValue: '少' })}
          {LEVEL_CLS.map((c, i) => (
            <span key={i} className={cx('h-[10px] w-[10px] rounded-[2px]', c)} />
          ))}
          {t('todo.heatMore', { defaultValue: '多' })}
        </span>
      </div>
    </div>
  )
}

// ───────── 3. 占比甜甜圈（SVG）─────────
export function Donut({
  segments,
  centerLabel,
  centerValue,
  size = 124,
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
                className={cx(
                  'h-2.5 w-2.5 rounded-sm',
                  seg.color.replace('stroke-', 'bg-'),
                )}
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

// ───────── 4. 水平條（畀「按專案」分布用）─────────
export function HBars({
  data,
}: {
  data: { label: string; value: number; bar: string }[]
}) {
  const { t } = useTranslation()
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0)
    return (
      <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">
        {t('todo.hbarsAllClear', { defaultValue: '全部專案都清空咗 🎉' })}
      </p>
    )
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <div className="space-y-2.5">
      {data.map((d) => {
        const pct = (d.value / max) * 100
        return (
          <div key={d.label} className="flex items-center gap-2">
            <span className="w-20 shrink-0 truncate text-xs font-medium text-slate-600 dark:text-slate-300">
              {d.label}
            </span>
            <div className="h-5 flex-1 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
              <div
                className={cx(
                  'flex h-full items-center justify-end rounded-lg px-1.5 transition-all duration-500',
                  d.bar,
                )}
                style={{ width: `${Math.max(pct, d.value > 0 ? 10 : 0)}%` }}
              >
                {d.value > 0 && (
                  <span className="text-[10px] font-semibold tabular-nums text-white">
                    {d.value}
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

// ───────── 圖例 ─────────
function Legend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
      {items.map((it) => (
        <span
          key={it.label}
          className="flex items-center gap-1.5 text-[11px] tabular-nums text-slate-500 dark:text-slate-400"
        >
          <span className={cx('h-2.5 w-2.5 rounded-sm', it.color)} />
          {it.label}
        </span>
      ))}
    </div>
  )
}
