import { useId } from 'react'
import { cx } from '../../../../ui'
import { FIT_TONE } from '../common'

// ============================================================
//  訓練週期圖表（純 SVG / div，零 npm 依賴）
//  ------------------------------------------------------------
//   - VolumeBars  ：每日 / 每週總 volume 柱狀（標今日 / 本週）
//   - RpeTrend    ：RPE（疲勞）走勢折線（1-10 軸，缺值斷線）
//  全部支援深色 + tabular-nums + 海軍藍 accent。
// ============================================================

const ACCENT = FIT_TONE.navy

// ───────── 1. 總 volume 柱狀 ─────────
export function VolumeBars({
  bars,
  highlightLast = false,
}: {
  bars: { label: string; volume: number }[]
  highlightLast?: boolean
}) {
  const max = Math.max(1, ...bars.map((b) => b.volume))
  const hasData = bars.some((b) => b.volume > 0)
  if (bars.length === 0)
    return (
      <p className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">
        記低一次訓練就見到訓練量。
      </p>
    )
  // 畀讀屏軟件嘅文字摘要（純視覺柱狀圖否則無資訊）。
  const total = bars.reduce((s, b) => s + (b.volume > 0 ? b.volume : 0), 0)
  const peak = bars.reduce(
    (best, b) => (b.volume > best.volume ? b : best),
    bars[0],
  )
  const chartLabel = hasData
    ? `總訓練量柱狀圖，共 ${bars.length} 段，合計 ${fmtVol(total)} kg，最高 ${peak.label} ${fmtVol(peak.volume)} kg`
    : `總訓練量柱狀圖，共 ${bars.length} 段，呢段時間未有訓練量`
  return (
    <div role="img" aria-label={chartLabel}>
      <div className="flex h-40 items-end gap-1.5" aria-hidden="true">
        {bars.map((b, i) => {
          const isLast = highlightLast && i === bars.length - 1
          const pct = hasData
            ? Math.max((b.volume / max) * 100, b.volume > 0 ? 4 : 1.5)
            : 1.5
          return (
            <div
              key={`${b.label}-${i}`}
              className="group flex flex-1 flex-col items-center justify-end"
              title={`${b.label}：${fmtVol(b.volume)} kg`}
            >
              <div
                className={cx(
                  'w-full max-w-[2.4rem] rounded-t-md transition-all duration-500',
                  b.volume > 0
                    ? isLast
                      ? 'bg-accent-strong'
                      : 'bg-accent/70 group-hover:bg-accent'
                    : 'bg-slate-100 dark:bg-slate-800',
                  isLast &&
                    'ring-1 ring-accent ring-offset-1 ring-offset-white dark:ring-offset-slate-800',
                )}
                style={{ height: `${pct}%` }}
              />
              <span
                className={cx(
                  'mt-1 truncate text-[10px] tabular-nums',
                  isLast
                    ? 'font-semibold text-accent-strong dark:text-accent'
                    : 'text-slate-400 dark:text-slate-500',
                )}
              >
                {b.label}
              </span>
            </div>
          )
        })}
      </div>
      {!hasData && (
        <p className="mt-2 text-center text-xs text-slate-400 dark:text-slate-500">
          呢段時間未有訓練量。
        </p>
      )}
    </div>
  )
}

// ───────── 2. RPE（疲勞）走勢折線 ─────────
export function RpeTrend({
  points,
  height = 150,
}: {
  /** value 為該段平均 RPE（0 = 無資料，會斷線） */
  points: { label: string; value: number }[]
  height?: number
}) {
  const gid = useId().replace(/[:]/g, '')
  const hasData = points.some((p) => p.value > 0)
  if (points.length === 0 || !hasData)
    return (
      <div
        className="flex items-center justify-center text-sm text-slate-400 dark:text-slate-500"
        style={{ height }}
      >
        未有 RPE 資料 — 喺 set 填 1-10 即見疲勞走勢。
      </div>
    )

  const W = 100
  const padX = 3
  const usableW = W - padX * 2
  const x = (i: number) =>
    points.length === 1 ? W / 2 : padX + (i / (points.length - 1)) * usableW
  // RPE 1-10 → y（10 頂、1 底，留少少邊距）
  const y = (v: number) => {
    const clamped = Math.min(10, Math.max(1, v))
    return 92 - ((clamped - 1) / 9) * 84
  }

  // 只連有資料（value>0）嘅相鄰點，缺值處斷開
  const segs: string[] = []
  let cur = ''
  points.forEach((p, i) => {
    if (p.value > 0) {
      cur += `${cur === '' ? 'M' : 'L'} ${x(i)} ${y(p.value)} `
    } else if (cur !== '') {
      segs.push(cur.trim())
      cur = ''
    }
  })
  if (cur !== '') segs.push(cur.trim())

  // 讀屏摘要：有資料嘅點數 + 最新值 + 高疲勞（>=8）段數。
  const withData = points.filter((p) => p.value > 0)
  const latest = withData[withData.length - 1]
  const highCount = withData.filter((p) => p.value >= 8).length
  const rpeLabel =
    `平均 RPE（疲勞）走勢折線，共 ${withData.length} 段有資料` +
    (latest ? `，最新 ${latest.label} RPE ${latest.value}` : '') +
    (highCount > 0 ? `，其中 ${highCount} 段達高疲勞（RPE 8 或以上）` : '')

  return (
    <div className="w-full">
      <div className="relative w-full" style={{ height }}>
        {/* 參考線：RPE 8（高疲勞警戒）— 純視覺輔助線 */}
        <div
          className="absolute left-7 right-0 border-t border-dashed border-amber-300/70 dark:border-amber-500/30"
          style={{ top: `${y(8)}%` }}
          aria-hidden="true"
        />
        <span
          className="absolute left-0 -translate-y-1/2 text-[9px] tabular-nums text-amber-500 dark:text-amber-500/80"
          style={{ top: `${y(8)}%` }}
          aria-hidden="true"
        >
          8
        </span>
        <span
          className="absolute left-0 top-0 text-[9px] tabular-nums text-slate-400 dark:text-slate-500"
          aria-hidden="true"
        >
          10
        </span>
        <span
          className="absolute bottom-3 left-0 text-[9px] tabular-nums text-slate-400 dark:text-slate-500"
          aria-hidden="true"
        >
          1
        </span>
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 ml-7 h-full w-[calc(100%-1.75rem)] overflow-visible"
          role="img"
          aria-label={rpeLabel}
        >
          <defs>
            <linearGradient id={`rpe-${gid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={FIT_TONE.amber} stopOpacity="0.22" />
              <stop offset="100%" stopColor={FIT_TONE.amber} stopOpacity="0" />
            </linearGradient>
          </defs>
          {segs.map((d, i) => (
            <path
              key={i}
              d={d}
              fill="none"
              stroke={FIT_TONE.amber}
              strokeWidth={1.8}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {points.map((p, i) =>
            p.value > 0 ? (
              <circle
                key={i}
                cx={x(i)}
                cy={y(p.value)}
                r={2.2}
                fill={p.value >= 8 ? FIT_TONE.rose : FIT_TONE.amber}
                vectorEffect="non-scaling-stroke"
              >
                <title>
                  {p.label}：平均 RPE {p.value}
                </title>
              </circle>
            ) : null,
          )}
        </svg>
      </div>
      <div className="ml-7 mt-1 flex justify-between gap-1">
        {points.map((p, i) => (
          <span
            key={i}
            className="flex-1 truncate text-center text-[9px] tabular-nums text-slate-400 dark:text-slate-500"
          >
            {p.label}
          </span>
        ))}
      </div>
    </div>
  )
}

// ───────── 共用格式化 ─────────
/** volume 千位分隔；過萬用 k 簡寫畀軸 / tooltip 用。 */
export function fmtVol(v: number): string {
  if (!Number.isFinite(v)) return '0'
  return Math.round(v).toLocaleString('en-US')
}

export { ACCENT }
