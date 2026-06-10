import { useId, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  FolderTree,
  Hash,
  LineChart as LineChartIcon,
  PieChart,
  Tags,
  TrendingUp,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cx } from '../../../ui'
import { TYPE_COLOR, TYPE_LABEL, folderColor } from './util'
import type { FolderStat, TypeStat } from './util'

// ============================================================
//  自製 SVG / div 圖表（零 npm 依賴）— 資源庫專用
//  全部支援深色 + tabular-nums + 海軍藍 accent。
// ============================================================

// 類型 → SVG stroke / fill class（由 bar bg- 推導）
function strokeOfBar(bar: string): string {
  return bar.replace('bg-', 'stroke-')
}

// 友善空狀態（柔和大 icon + 一句鼓勵文案，取代生硬「未有資料」）
function ChartEmpty({
  icon: I,
  children,
}: {
  icon: LucideIcon
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
        <I size={20} strokeWidth={1.75} />
      </span>
      <p className="max-w-[16rem] text-xs leading-relaxed text-slate-400 dark:text-slate-500">
        {children}
      </p>
    </div>
  )
}

// ───────── 1. 類型占比甜甜圈（SVG，多段）─────────
export function TypeDonut({ stats, total }: { stats: TypeStat[]; total: number }) {
  const { t } = useTranslation()
  const size = 132
  const stroke = 14
  const r = (size - stroke) / 2
  const c = size / 2
  const circ = 2 * Math.PI * r
  const sum = stats.reduce((s, x) => s + x.count, 0) || 1
  let offset = 0

  if (total === 0)
    return (
      <ChartEmpty icon={PieChart}>
        {t('res.chart_type_empty', { defaultValue: '加入資源後，呢度會顯示各類型嘅占比。' })}
      </ChartEmpty>
    )

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
          role="img"
          aria-label={t('res.chart_type_donut_aria', { defaultValue: '資源類型占比' })}
        >
          <circle
            cx={c}
            cy={c}
            r={r}
            fill="none"
            strokeWidth={stroke}
            className="stroke-slate-100 dark:stroke-slate-800"
          />
          {stats
            .filter((s) => s.count > 0)
            .map((s) => {
              const frac = s.count / sum
              const len = frac * circ
              const node = (
                <circle
                  key={s.type}
                  cx={c}
                  cy={c}
                  r={r}
                  fill="none"
                  strokeWidth={stroke}
                  strokeLinecap="butt"
                  className={strokeOfBar(TYPE_COLOR[s.type].bar)}
                  strokeDasharray={`${len} ${circ - len}`}
                  strokeDashoffset={-offset}
                  style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                />
              )
              offset += len
              return node
            })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold tabular-nums text-slate-800 dark:text-slate-100">
            {total}
          </span>
          <span className="text-[11px] text-slate-400 dark:text-slate-500">
            {t('res.chart_type_total_label', { defaultValue: '總資源' })}
          </span>
        </div>
      </div>
      <ul className="flex-1 space-y-1.5">
        {stats
          .filter((s) => s.count > 0)
          .map((s) => (
            <li
              key={s.type}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                <span className={cx('h-2.5 w-2.5 rounded-sm', TYPE_COLOR[s.type].bar)} />
                {TYPE_LABEL[s.type]}
              </span>
              <span className="tabular-nums font-semibold text-slate-700 dark:text-slate-200">
                {s.count}
                <span className="ml-1 font-normal text-slate-400">
                  {Math.round((s.count / sum) * 100)}%
                </span>
              </span>
            </li>
          ))}
      </ul>
    </div>
  )
}

// ───────── 2. 收藏夾資源數橫條 ─────────
export function FolderBars({ stats }: { stats: FolderStat[] }) {
  const { t } = useTranslation()
  const max = useMemo(() => Math.max(1, ...stats.map((s) => s.count)), [stats])
  const visible = stats.filter((s) => s.count > 0)
  if (visible.length === 0)
    return (
      <ChartEmpty icon={FolderTree}>
        {t('res.chart_folder_empty', { defaultValue: '將資源放入收藏夾，就會見到每個夾嘅分佈。' })}
      </ChartEmpty>
    )
  return (
    <ul className="space-y-2.5">
      {visible.map((s) => {
        const col = folderColor(s.color)
        return (
          <li key={s.id}>
            <div className="mb-1 flex items-center justify-between gap-2 text-xs">
              <span className="flex items-center gap-1.5 truncate text-slate-600 dark:text-slate-300">
                <span className={cx('h-2 w-2 shrink-0 rounded-full', col.dot)} />
                {s.name}
              </span>
              <span className="shrink-0 tabular-nums text-slate-400 dark:text-slate-500">
                {s.count}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className={cx('h-full rounded-full transition-all duration-500', col.dot)}
                style={{ width: `${(s.count / max) * 100}%` }}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

// ───────── 3. 雙序列折線（新增 vs 開啟，30 日）─────────
export interface TrendPoint {
  key: string
  label: string
  count: number
}
export function ActivityChart({
  added,
  opened,
}: {
  added: TrendPoint[]
  opened: TrendPoint[]
}) {
  const { t } = useTranslation()
  const gradId = useId()
  const W = 520
  const H = 170
  const padL = 26
  const padR = 10
  const padT = 12
  const padB = 24
  const innerW = W - padL - padR
  const innerH = H - padT - padB
  const n = Math.max(added.length, opened.length)
  const maxY = Math.max(
    1,
    ...added.map((d) => d.count),
    ...opened.map((d) => d.count),
  )
  const totalAdded = added.reduce((s, d) => s + d.count, 0)
  const totalOpened = opened.reduce((s, d) => s + d.count, 0)

  const x = (i: number) => padL + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW)
  const y = (v: number) => padT + innerH - (v / maxY) * innerH

  const line = (vals: number[]) =>
    vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')

  const addedVals = added.map((d) => d.count)
  const openedVals = opened.map((d) => d.count)
  const areaPath =
    openedVals.length > 0
      ? `${line(openedVals)} L${x(openedVals.length - 1).toFixed(1)},${y(0).toFixed(1)} L${x(0).toFixed(1)},${y(0).toFixed(1)} Z`
      : ''

  const ticks = Array.from(new Set([0, Math.ceil(maxY / 2), maxY]))

  if (totalAdded === 0 && totalOpened === 0)
    return (
      <ChartEmpty icon={LineChartIcon}>
        {t('res.chart_activity_empty', { defaultValue: '近 30 日未有新增或開啟紀錄，開幾條資源就會見到趨勢。' })}
      </ChartEmpty>
    )

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label={t('res.chart_activity_aria', { defaultValue: '新增與開啟活動折線圖' })}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" className="[stop-color:theme(colors.blue.400)]" stopOpacity={0.22} />
            <stop offset="100%" className="[stop-color:theme(colors.blue.400)]" stopOpacity={0} />
          </linearGradient>
        </defs>
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={padL}
              x2={W - padR}
              y1={y(tick)}
              y2={y(tick)}
              className="stroke-slate-100 dark:stroke-slate-800"
              strokeWidth={1}
            />
            <text
              x={padL - 5}
              y={y(tick) + 3}
              textAnchor="end"
              className="fill-slate-400 text-[9px] tabular-nums dark:fill-slate-500"
            >
              {tick}
            </text>
          </g>
        ))}
        {added.map((p, i) =>
          i % 5 === 0 ? (
            <text
              key={p.key}
              x={x(i)}
              y={H - 7}
              textAnchor="middle"
              className="fill-slate-400 text-[9px] dark:fill-slate-500"
            >
              {p.label}
            </text>
          ) : null,
        )}
        {areaPath && <path d={areaPath} fill={`url(#${gradId})`} />}
        <path
          d={line(openedVals)}
          fill="none"
          className="stroke-blue-500"
          strokeWidth={2.4}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <path
          d={line(addedVals)}
          fill="none"
          className="stroke-accent"
          strokeWidth={2.4}
          strokeLinejoin="round"
          strokeLinecap="round"
          strokeDasharray="5 4"
        />
      </svg>
      <div className="mt-1.5 flex items-center justify-center gap-4 text-[11px] text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded bg-accent" />
          {t('res.chart_legend_added', { defaultValue: '新增' })} <span className="tabular-nums font-medium">{totalAdded}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded bg-blue-500" />
          {t('res.chart_legend_opened', { defaultValue: '開啟' })} <span className="tabular-nums font-medium">{totalOpened}</span>
        </span>
      </div>
    </div>
  )
}

// ───────── 4. 標籤雲（字級隨次數）─────────
export function TagCloud({
  tags,
  active,
  onToggle,
}: {
  tags: { tag: string; count: number }[]
  active: string[]
  onToggle: (tag: string) => void
}) {
  const { t } = useTranslation()
  const max = useMemo(() => Math.max(1, ...tags.map((tag) => tag.count)), [tags])
  if (tags.length === 0)
    return (
      <ChartEmpty icon={Hash}>
        {t('res.chart_tags_empty', { defaultValue: '畀資源加啲標籤，常用標籤就會喺呢度浮現。' })}
      </ChartEmpty>
    )
  return (
    <div className="flex flex-wrap items-center gap-2">
      {tags.map((tag) => {
        const ratio = tag.count / max
        const fs = 11 + Math.round(ratio * 8) // 11–19px
        const on = active.includes(tag.tag)
        return (
          <button
            key={tag.tag}
            onClick={() => onToggle(tag.tag)}
            style={{ fontSize: fs }}
            className={cx(
              'inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-medium leading-none transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
              on
                ? 'bg-accent text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
            )}
          >
            #{tag.tag}
            <span
              className={cx(
                'tabular-nums text-[10px]',
                on ? 'text-white/75' : 'text-slate-400',
              )}
            >
              {tag.count}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ───────── 5. 開啟排行榜（水平條，畀 Insights 用）─────────
export function OpenLeaderboard({
  rows,
}: {
  rows: { id: string; title: string; opens: number }[]
}) {
  const { t } = useTranslation()
  const max = useMemo(() => Math.max(1, ...rows.map((r) => r.opens)), [rows])
  if (rows.length === 0)
    return (
      <ChartEmpty icon={TrendingUp}>
        {t('res.chart_leaderboard_empty', { defaultValue: '開過嘅教材會喺呢度排名，睇下邊份用得最多。' })}
      </ChartEmpty>
    )
  return (
    <ol className="space-y-2.5">
      {rows.map((r, i) => (
        <li key={r.id} className="flex items-center gap-2.5">
          <span
            className={cx(
              'flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-bold tabular-nums',
              i === 0
                ? 'bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent'
                : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500',
            )}
          >
            {i + 1}
          </span>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="truncate text-xs text-slate-600 dark:text-slate-300">
                {r.title}
              </span>
              <span className="shrink-0 tabular-nums text-xs font-semibold text-slate-500 dark:text-slate-400">
                {r.opens}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-accent to-accent-strong transition-all duration-500"
                style={{ width: `${(r.opens / max) * 100}%` }}
              />
            </div>
          </div>
        </li>
      ))}
    </ol>
  )
}

// ───────── 6. 課題覆蓋條 ─────────
export function CoverageBars({
  rows,
}: {
  rows: { id: string; name: string; count: number }[]
}) {
  const { t } = useTranslation()
  const max = useMemo(() => Math.max(1, ...rows.map((r) => r.count)), [rows])
  if (rows.length === 0)
    return (
      <ChartEmpty icon={Tags}>
        {t('res.chart_coverage_empty', { defaultValue: '將資源連結到課題，就會見到各課題嘅覆蓋情況。' })}
      </ChartEmpty>
    )
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.id}>
          <div className="mb-1 flex items-center justify-between gap-2 text-xs">
            <span className="truncate text-slate-600 dark:text-slate-300">{r.name}</span>
            <span className="shrink-0 tabular-nums text-slate-400 dark:text-slate-500">
              {r.count}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className={cx(
                'h-full rounded-full transition-all duration-500',
                r.id === '__none' ? 'bg-slate-300 dark:bg-slate-600' : 'bg-accent',
              )}
              style={{ width: `${(r.count / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}
