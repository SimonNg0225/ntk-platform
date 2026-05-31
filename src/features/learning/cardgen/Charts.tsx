import { useMemo } from 'react'
import { cx } from '../../../ui'
import { CARD_TYPE_LABEL } from './prompts'
import type { CardType, GenRecord } from './types'

// ============================================================
//  自製圖表（純 SVG / div，零 npm 依賴）
//  全部支援深色 + tabular-nums + 海軍藍 accent。
//  畀生成歷史統計用：每日生成趨勢 + 卡型占比甜甜圈。
// ============================================================

// ───────── 本地日期 key（避時區）─────────
function dayKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

// ───────── 1. 每日生成量趨勢（垂直長條，過去 N 日）─────────
export function GenTrend({
  records,
  days = 14,
}: {
  records: GenRecord[]
  days?: number
}) {
  const data = useMemo(() => {
    const gen = new Map<string, number>()
    const sav = new Map<string, number>()
    for (const r of records) {
      // r.ts 係 UTC ISO，要用本地日期 key 先同下面 dayKey(本地) 對齊
      const k = dayKey(new Date(r.ts))
      gen.set(k, (gen.get(k) ?? 0) + r.generated)
      sav.set(k, (sav.get(k) ?? 0) + r.saved)
    }
    const today = new Date()
    const out: { key: string; label: string; gen: number; sav: number }[] = []
    for (let i = days - 1; i >= 0; i--) {
      const k = dayKey(addDays(today, -i))
      out.push({
        key: k,
        label: k.slice(8),
        gen: gen.get(k) ?? 0,
        sav: sav.get(k) ?? 0,
      })
    }
    return out
  }, [records, days])

  const max = useMemo(() => Math.max(1, ...data.map((d) => d.gen)), [data])
  const total = data.reduce((s, d) => s + d.gen, 0)
  if (total === 0)
    return (
      <p className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">
        近 {days} 日未有生成紀錄
      </p>
    )

  return (
    <div>
      <div className="flex h-28 items-end gap-1.5">
        {data.map((d) => {
          const h = (d.gen / max) * 100
          const savH = d.gen > 0 ? (d.sav / d.gen) * 100 : 0
          return (
            <div
              key={d.key}
              className="group flex flex-1 flex-col items-center justify-end"
              title={`${d.key}：生成 ${d.gen} · 已存 ${d.sav}`}
            >
              <span className="mb-1 text-[10px] font-medium tabular-nums text-slate-500 opacity-0 transition group-hover:opacity-100 dark:text-slate-400">
                {d.gen || ''}
              </span>
              <div
                className="relative w-full overflow-hidden rounded-t-md bg-accent/30 transition-all duration-500"
                style={{ height: `${Math.max(h, d.gen > 0 ? 4 : 0)}%` }}
              >
                {/* 已存部分（深色覆蓋底部） */}
                <div
                  className="absolute inset-x-0 bottom-0 bg-accent"
                  style={{ height: `${savH}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        {data.map((d, i) => (
          <span
            key={d.key}
            className="flex-1 text-center text-[9px] tabular-nums text-slate-400 dark:text-slate-500"
          >
            {i % 2 === 0 ? d.label : ''}
          </span>
        ))}
      </div>
      <Legend
        items={[
          { color: 'bg-accent', label: '已存入牌組' },
          { color: 'bg-accent/30', label: '生成（未存）' },
        ]}
      />
    </div>
  )
}

// ───────── 2. 卡型占比（甜甜圈，SVG）─────────
const TYPE_COLOR: Record<CardType, string> = {
  qa: 'stroke-accent',
  term: 'stroke-blue-500',
  cloze: 'stroke-amber-500',
  tf: 'stroke-emerald-500',
}

export function TypeDonut({
  records,
  size = 128,
}: {
  records: GenRecord[]
  size?: number
}) {
  const segments = useMemo(() => {
    const by: Record<CardType, number> = { qa: 0, term: 0, cloze: 0, tf: 0 }
    for (const r of records) by[r.type] += r.generated
    return (Object.keys(by) as CardType[])
      .map((t) => ({ value: by[t], color: TYPE_COLOR[t], label: CARD_TYPE_LABEL[t] }))
      .filter((s) => s.value > 0)
  }, [records])

  const total = segments.reduce((s, x) => s + x.value, 0)
  const r = (size - 18) / 2
  const c = 2 * Math.PI * r
  const cx0 = size / 2
  let offset = 0

  if (total === 0)
    return (
      <p className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">
        未有資料
      </p>
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
            y={cx0 - 2}
            textAnchor="middle"
            className="fill-slate-800 text-[20px] font-bold tabular-nums dark:fill-slate-100"
          >
            {total}
          </text>
          <text
            x={cx0}
            y={cx0 + 14}
            textAnchor="middle"
            className="fill-slate-400 text-[10px] dark:fill-slate-500"
          >
            張
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
