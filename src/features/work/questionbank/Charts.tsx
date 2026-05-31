import { useState } from 'react'
import type { Difficulty, QuestionType } from '../../../data/types'
import { cx } from '../../../ui'
import {
  DIFF_LABEL,
  DIFF_ORDER,
  TYPE_LABEL,
  TYPE_ORDER,
  type TopicRow,
} from './util'

// ============================================================
//  BAFS 題庫自製圖表（純 SVG / div，零 npm 依賴）
//  - TypeDonut：題型佔比甜甜圈
//  - DifficultyBars：三難度水平條（含百分比）
//  - CoverageMatrix：課題 × 難度 熱力矩陣（找出覆蓋缺口）
//  全部支援深色 + tabular-nums + 海軍藍 accent。
// ============================================================

// ───────── 1. 題型佔比甜甜圈（SVG）─────────
const TYPE_STROKE: Record<QuestionType, string> = {
  mc: 'stroke-blue-500',
  short: 'stroke-accent',
  long: 'stroke-violet-500',
  case: 'stroke-cyan-500',
}
const TYPE_BG: Record<QuestionType, string> = {
  mc: 'bg-blue-500',
  short: 'bg-accent',
  long: 'bg-violet-500',
  case: 'bg-cyan-500',
}

export function TypeDonut({
  byType,
  size = 140,
}: {
  byType: Record<QuestionType, number>
  size?: number
}) {
  const total = TYPE_ORDER.reduce((s, t) => s + byType[t], 0)
  const thickness = 16
  const r = (size - thickness) / 2
  const c = 2 * Math.PI * r
  const cx0 = size / 2
  let offset = 0

  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle
            cx={cx0}
            cy={cx0}
            r={r}
            fill="none"
            strokeWidth={thickness}
            className="stroke-slate-100 dark:stroke-slate-700/60"
          />
          {total > 0 &&
            TYPE_ORDER.map((t) => {
              const v = byType[t]
              if (v <= 0) return null
              const len = (v / total) * c
              const el = (
                <circle
                  key={t}
                  cx={cx0}
                  cy={cx0}
                  r={r}
                  fill="none"
                  strokeWidth={thickness}
                  strokeLinecap="butt"
                  strokeDasharray={`${len} ${c - len}`}
                  strokeDashoffset={-offset}
                  className={cx('transition-all duration-500', TYPE_STROKE[t])}
                />
              )
              offset += len
              return el
            })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold tabular-nums text-slate-800 dark:text-slate-100">
            {total}
          </span>
          <span className="text-[11px] text-slate-400 dark:text-slate-500">
            題
          </span>
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-1.5">
        {TYPE_ORDER.map((t) => (
          <li key={t} className="flex items-center gap-2 text-xs">
            <span className={cx('h-2.5 w-2.5 shrink-0 rounded-sm', TYPE_BG[t])} />
            <span className="truncate text-slate-600 dark:text-slate-300">
              {TYPE_LABEL[t]}
            </span>
            <span className="ml-auto font-medium tabular-nums text-slate-500 dark:text-slate-400">
              {byType[t]}
              {total > 0 && (
                <span className="ml-1 text-slate-400 dark:text-slate-500">
                  {Math.round((byType[t] / total) * 100)}%
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ───────── 2. 難度分佈（水平條）─────────
const DIFF_BAR: Record<Difficulty, string> = {
  easy: 'bg-emerald-500',
  medium: 'bg-amber-500',
  hard: 'bg-rose-500',
}
const DIFF_TEXT: Record<Difficulty, string> = {
  easy: 'text-emerald-600 dark:text-emerald-400',
  medium: 'text-amber-600 dark:text-amber-400',
  hard: 'text-rose-600 dark:text-rose-400',
}

export function DifficultyBars({
  byDiff,
}: {
  byDiff: Record<Difficulty, number>
}) {
  const total = DIFF_ORDER.reduce((s, d) => s + byDiff[d], 0)
  if (total === 0)
    return (
      <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">
        仲未有題目
      </p>
    )
  return (
    <div className="space-y-2.5">
      {DIFF_ORDER.map((d) => {
        const v = byDiff[d]
        const pct = (v / total) * 100
        return (
          <div key={d} className="flex items-center gap-2">
            <span className={cx('w-8 shrink-0 text-xs font-medium', DIFF_TEXT[d])}>
              {DIFF_LABEL[d]}
            </span>
            <div className="h-5 flex-1 overflow-hidden rounded-md bg-slate-100 dark:bg-slate-800">
              <div
                className={cx(
                  'flex h-full items-center justify-end rounded-md px-1.5 transition-all duration-500',
                  DIFF_BAR[d],
                )}
                style={{ width: `${Math.max(pct, v > 0 ? 9 : 0)}%` }}
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

// ───────── 3. 課題覆蓋矩陣（課題 × 難度 熱力格）─────────
// 顏色深淺 = 該格題數相對全表最大值。0 題顯示淺灰（= 缺口）。
function heatClass(v: number, max: number): string {
  if (v <= 0) return 'bg-slate-50 text-slate-300 dark:bg-slate-800/40 dark:text-slate-600'
  const r = v / max
  if (r <= 0.25) return 'bg-accent/15 text-accent-strong dark:bg-accent/15 dark:text-accent'
  if (r <= 0.5) return 'bg-accent/35 text-accent-strong dark:text-accent'
  if (r <= 0.75) return 'bg-accent/55 text-white'
  return 'bg-accent text-white'
}

export function CoverageMatrix({ rows }: { rows: TopicRow[] }) {
  const [sort, setSort] = useState<'topic' | 'total'>('topic')
  const visible = rows.filter((r) => r.topic !== '未分類')
  const max = Math.max(
    1,
    ...visible.flatMap((r) => DIFF_ORDER.map((d) => r.byDiff[d])),
  )
  const sorted =
    sort === 'total'
      ? [...visible].sort((a, b) => b.total - a.total)
      : visible

  if (visible.length === 0)
    return (
      <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">
        未有課題資料
      </p>
    )

  return (
    <div>
      <div className="mb-2 flex items-center justify-end gap-1">
        <button
          onClick={() => setSort('topic')}
          aria-pressed={sort === 'topic'}
          className={cx(
            'rounded-md px-2 py-0.5 text-[11px] font-medium transition',
            sort === 'topic'
              ? 'bg-accent text-white'
              : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700',
          )}
        >
          按課題序
        </button>
        <button
          onClick={() => setSort('total')}
          aria-pressed={sort === 'total'}
          className={cx(
            'rounded-md px-2 py-0.5 text-[11px] font-medium transition',
            sort === 'total'
              ? 'bg-accent text-white'
              : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700',
          )}
        >
          按題數
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-y-1 text-xs">
          <thead>
            <tr className="text-slate-400 dark:text-slate-500">
              <th className="px-2 py-1 text-left font-medium">課題</th>
              {DIFF_ORDER.map((d) => (
                <th key={d} className="w-12 px-1 py-1 text-center font-medium">
                  {DIFF_LABEL[d]}
                </th>
              ))}
              <th className="w-12 px-1 py-1 text-center font-medium">合計</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.topicId}>
                <td className="max-w-[180px] truncate py-1 pr-2 text-slate-700 dark:text-slate-200">
                  {r.topic}
                </td>
                {DIFF_ORDER.map((d) => (
                  <td key={d} className="px-1">
                    <div
                      className={cx(
                        'mx-auto flex h-7 w-9 items-center justify-center rounded-md text-[11px] font-semibold tabular-nums transition-colors',
                        heatClass(r.byDiff[d], max),
                      )}
                      title={`${r.topic} · ${DIFF_LABEL[d]}：${r.byDiff[d]} 題`}
                    >
                      {r.byDiff[d] || ''}
                    </div>
                  </td>
                ))}
                <td className="px-1 text-center">
                  <span
                    className={cx(
                      'text-[12px] font-bold tabular-nums',
                      r.total === 0
                        ? 'text-rose-400'
                        : 'text-slate-700 dark:text-slate-200',
                    )}
                  >
                    {r.total}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">
        顏色越深代表該（課題 × 難度）題目越多；
        <span className="text-rose-400">紅色合計 0</span> = 仲未出題嘅課題。
      </p>
    </div>
  )
}
