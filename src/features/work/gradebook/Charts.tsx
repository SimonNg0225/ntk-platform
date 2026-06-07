import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import './i18n'
import { cx } from '../../../ui'
import {
  TONE_FILL,
  TONE_STROKE,
  TONE_TEXT,
  bandsOf,
  gradeOf,
  type GradeBand,
  type GradeScaleKey,
  type GradeTone,
  type HistBin,
} from './util'

// ============================================================
//  自製圖表（零依賴，SVG / div）
//  - Histogram：分數分佈
//  - GradeDonut：等級佔比環形圖
//  - TrendLine：各評估全班平均趨勢
//  - BoxPlot：箱形圖（離散度）
//  - MiniSpark：學生成績走勢迷你折線
// ============================================================

// ───────── 分數分佈直方圖 ─────────
export function Histogram({
  bins,
  passMark = 50,
}: {
  bins: HistBin[]
  passMark?: number
}) {
  const { t } = useTranslation()
  const maxCount = Math.max(1, ...bins.map((b) => b.count))
  return (
    <div className="flex items-end gap-1.5" style={{ height: 160 }}>
      {bins.map((b) => {
        const h = (b.count / maxCount) * 100
        const fail = b.to <= passMark
        return (
          <div
            key={b.from}
            className="group flex flex-1 flex-col items-center justify-end gap-1"
          >
            <span
              className={cx(
                'font-serif text-[11px] font-semibold tabular-nums slashed-zero transition-opacity',
                b.count ? 'text-slate-500 dark:text-slate-400' : 'opacity-0',
              )}
            >
              {b.count}
            </span>
            <div
              className={cx(
                'w-full rounded-t-md transition-all duration-500 group-hover:opacity-90',
                fail
                  ? 'bg-rose-400/85 dark:bg-rose-500/60'
                  : 'bg-accent/85 dark:bg-accent/70',
                b.count === 0 && 'bg-slate-100 dark:bg-slate-800',
              )}
              style={{ height: `${Math.max(h, b.count ? 4 : 2)}%` }}
              title={t('gradebook.chartCountPeople', {
                label: `${b.label} 分`,
                count: b.count,
                defaultValue: '{{label}}：{{count}} 人',
              })}
            />
            <span className="text-[9px] tabular-nums text-slate-400 dark:text-slate-500">
              {b.from}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ───────── 等級佔比環形圖 ─────────
export function GradeDonut({
  counts,
  scale,
  bands,
  size = 132,
}: {
  counts: { band: GradeBand; n: number }[]
  scale: GradeScaleKey
  /** 自訂分界後嘅 bands（圖例用）；未提供則用內建 */
  bands?: GradeBand[]
  size?: number
}) {
  const { t } = useTranslation()
  const total = counts.reduce((a, b) => a + b.n, 0)
  const r = size / 2 - 10
  const c = 2 * Math.PI * r
  const cx0 = size / 2
  let offset = 0

  const colorByTone: Record<GradeTone, string> = {
    green: '#10b981',
    accent: 'var(--accent)',
    blue: '#3b82f6',
    amber: '#f59e0b',
    rose: '#f43f5e',
    slate: '#94a3b8',
  }

  if (total === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-full border border-dashed border-slate-200 text-xs text-slate-400 dark:border-slate-700 dark:text-slate-500"
        style={{ width: size, height: size }}
      >
        {t('gradebook.chartNoGrade', { defaultValue: '未有等級' })}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={cx0}
          cy={cx0}
          r={r}
          fill="none"
          strokeWidth={14}
          className="stroke-slate-100 dark:stroke-slate-800"
        />
        {counts.map(({ band, n }) => {
          if (n === 0) return null
          const frac = n / total
          const dash = frac * c
          const seg = (
            <circle
              key={band.label}
              cx={cx0}
              cy={cx0}
              r={r}
              fill="none"
              strokeWidth={14}
              stroke={colorByTone[band.tone]}
              strokeDasharray={`${dash} ${c - dash}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
            >
              <title>
                {t('gradebook.chartGradeCount', {
                  label: band.label,
                  count: n,
                  pct: Math.round(frac * 100),
                  defaultValue: '{{label}}：{{count}} 人（{{pct}}%）',
                })}
              </title>
            </circle>
          )
          offset += dash
          return seg
        })}
      </svg>
      <div className="space-y-1">
        {(bands ?? bandsOf(scale))
          .map((band) => ({
            band,
            n: counts.find((c2) => c2.band.label === band.label)?.n ?? 0,
          }))
          .filter((x) => x.n > 0)
          .map(({ band, n }) => (
            <div
              key={band.label}
              className="flex items-center gap-1.5 text-xs"
            >
              <span
                className={cx('h-2.5 w-2.5 rounded-sm', TONE_FILL[band.tone])}
              />
              <span className="font-medium text-slate-600 dark:text-slate-300">
                {band.label}
              </span>
              <span className="tabular-nums text-slate-400">
                {n}（{Math.round((n / total) * 100)}%）
              </span>
            </div>
          ))}
      </div>
    </div>
  )
}

// ───────── 各評估全班平均趨勢（折線）─────────
export interface TrendPoint {
  label: string
  value: number // 0–100
  sub?: string
}

export function TrendLine({
  points,
  passMark = 50,
  height = 180,
}: {
  points: TrendPoint[]
  passMark?: number
  height?: number
}) {
  const { t } = useTranslation()
  const gid = useId().replace(/[:]/g, '')
  if (points.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-dashed border-slate-200 text-xs text-slate-400 dark:border-slate-700 dark:text-slate-500" style={{ height }}>
        {t('gradebook.chartTrendEmpty', { defaultValue: '入分後即見走勢' })}
      </div>
    )
  }
  const W = 100 // viewBox 寬（百分比座標）
  const padX = 4
  const usableW = W - padX * 2
  const x = (i: number) =>
    points.length === 1 ? W / 2 : padX + (i / (points.length - 1)) * usableW
  const y = (v: number) => 100 - v // 0 在底、100 在頂（再翻轉 viewBox）

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(p.value)}`)
    .join(' ')
  const areaPath =
    `M ${x(0)} 100 ` +
    points.map((p, i) => `L ${x(i)} ${y(p.value)}`).join(' ') +
    ` L ${x(points.length - 1)} 100 Z`

  return (
    <div className="w-full">
      <div className="relative w-full" style={{ height }}>
        {/* 橫格線 + 標籤 */}
        {[100, 75, 50, 25, 0].map((g) => (
          <div
            key={g}
            className="absolute left-0 right-0 flex items-center gap-1"
            style={{ top: `${((100 - g) / 100) * 100}%` }}
          >
            <span className="w-7 shrink-0 text-right text-[9px] tabular-nums text-slate-300 dark:text-slate-600">
              {g}
            </span>
            <span
              className={cx(
                'h-px flex-1',
                g === passMark
                  ? 'bg-rose-300/70 dark:bg-rose-500/40'
                  : 'bg-slate-100 dark:bg-slate-800',
              )}
            />
          </div>
        ))}
        {/* SVG 折線（留出左邊 label 空間）*/}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 ml-8 h-full w-[calc(100%-2rem)] overflow-visible"
        >
          <defs>
            <linearGradient id={`grad-${gid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.25" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill={`url(#grad-${gid})`} />
          <path
            d={linePath}
            fill="none"
            className="stroke-accent"
            strokeWidth={1.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          {points.map((p, i) => (
            <circle
              key={i}
              cx={x(i)}
              cy={y(p.value)}
              r={2.2}
              className={cx(
                p.value < passMark ? 'fill-rose-500' : 'fill-accent',
              )}
              vectorEffect="non-scaling-stroke"
            >
              <title>
                {p.sub
                  ? t('gradebook.chartTrendPointSub', {
                      label: p.label,
                      sub: p.sub,
                      value: Math.round(p.value),
                      defaultValue: '{{label}} · {{sub}}：{{value}}%',
                    })
                  : t('gradebook.chartTrendPoint', {
                      label: p.label,
                      value: Math.round(p.value),
                      defaultValue: '{{label}}：{{value}}%',
                    })}
              </title>
            </circle>
          ))}
        </svg>
      </div>
      {/* X 軸標籤 */}
      <div className="ml-8 mt-1 flex justify-between gap-1">
        {points.map((p, i) => (
          <span
            key={i}
            className="flex-1 truncate text-center text-[9px] text-slate-400 dark:text-slate-500"
            title={p.label}
          >
            {p.label}
          </span>
        ))}
      </div>
    </div>
  )
}

// ───────── 箱形圖（離散度）─────────
export function BoxPlot({
  stats,
  passMark = 50,
}: {
  stats: { min: number; q1: number; med: number; q3: number; max: number; mean: number } | null
  passMark?: number
}) {
  const { t } = useTranslation()
  if (!stats) {
    return (
      <div className="flex h-12 items-center text-xs text-slate-400 dark:text-slate-500">
        {t('gradebook.chartBoxEmpty', { defaultValue: '未夠資料畫箱形圖' })}
      </div>
    )
  }
  const pos = (v: number) => `${Math.max(0, Math.min(100, v))}%`
  return (
    <div className="space-y-2">
      <div className="relative h-10">
        {/* 0–100 軸底 */}
        <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-slate-100 dark:bg-slate-800" />
        {/* 及格線 */}
        <div
          className="absolute top-1 bottom-1 w-px border-l border-dashed border-rose-300 dark:border-rose-500/40"
          style={{ left: pos(passMark) }}
        />
        {/* 鬚（min–max）*/}
        <div
          className="absolute top-1/2 h-px -translate-y-1/2 bg-slate-300 dark:bg-slate-600"
          style={{ left: pos(stats.min), right: `${100 - stats.max}%` }}
        />
        {/* 盒（q1–q3）*/}
        <div
          className="absolute top-1/2 h-6 -translate-y-1/2 rounded-md border border-accent/40 bg-accent/15 dark:border-accent/50"
          style={{ left: pos(stats.q1), right: `${100 - stats.q3}%` }}
        />
        {/* 中位數 */}
        <div
          className="absolute top-1/2 h-6 w-0.5 -translate-y-1/2 bg-accent"
          style={{ left: pos(stats.med) }}
        />
        {/* 平均（菱形）*/}
        <div
          className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-slate-700 dark:bg-slate-200"
          style={{ left: pos(stats.mean) }}
          title={t('gradebook.chartMean', {
            value: Math.round(stats.mean),
            defaultValue: '平均 {{value}}%',
          })}
        />
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] tabular-nums text-slate-400 dark:text-slate-500">
        <span>
          {t('gradebook.chartMin', {
            value: Math.round(stats.min),
            defaultValue: '最低 {{value}}',
          })}
        </span>
        <span>Q1 {Math.round(stats.q1)}</span>
        <span className="font-semibold text-accent">
          {t('gradebook.chartMedian', {
            value: Math.round(stats.med),
            defaultValue: '中位 {{value}}',
          })}
        </span>
        <span>Q3 {Math.round(stats.q3)}</span>
        <span>
          {t('gradebook.chartMax', {
            value: Math.round(stats.max),
            defaultValue: '最高 {{value}}',
          })}
        </span>
      </div>
    </div>
  )
}

// ───────── 學生成績走勢迷你折線（report card 用）─────────
export function MiniSpark({
  values,
  scale,
  width = 120,
  height = 36,
}: {
  values: number[]
  scale: GradeScaleKey
  width?: number
  height?: number
}) {
  if (values.length === 0) {
    return <span className="text-xs text-slate-300">—</span>
  }
  if (values.length === 1) {
    const tone = gradeOf(values[0], scale).tone
    return (
      <span className={cx('text-xs font-semibold tabular-nums', TONE_TEXT[tone])}>
        {Math.round(values[0])}%
      </span>
    )
  }
  const padY = 4
  const x = (i: number) => (i / (values.length - 1)) * width
  const y = (v: number) => padY + (1 - v / 100) * (height - padY * 2)
  const path = values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(v)}`).join(' ')
  const last = values[values.length - 1]
  const tone = gradeOf(last, scale).tone
  return (
    <svg width={width} height={height} className="overflow-visible">
      <path
        d={path}
        fill="none"
        className={TONE_STROKE[tone]}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {values.map((v, i) => (
        <circle
          key={i}
          cx={x(i)}
          cy={y(v)}
          r={i === values.length - 1 ? 2.4 : 1.6}
          className={cx(TONE_FILL[gradeOf(v, scale).tone], 'fill-current')}
        />
      ))}
    </svg>
  )
}
