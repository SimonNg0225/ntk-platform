import { cx } from '../../../ui'
import type { AreaCoverage } from './util'

// ============================================================
//  課程覆蓋率橫向長條圖（自製 SVG/div，零依賴）
//  ------------------------------------------------------------
//  每個 BAFS 課題範疇一行：底 = 已備課(planned)，深 = 已授課(taught)，
//  灰底 = 全部課題。展示「教咗 / 備咗 / 全部」三層覆蓋。
// ============================================================

export default function CoverageChart({
  rows,
  onSelectArea,
  activeArea,
}: {
  rows: AreaCoverage[]
  onSelectArea?: (area: string) => void
  activeArea?: string
}) {
  if (rows.length === 0) return null

  return (
    <div className="space-y-2.5">
      {rows.map((r) => {
        const plannedPct = r.totalTopics
          ? Math.round((r.plannedTopics / r.totalTopics) * 100)
          : 0
        const taughtPct = r.totalTopics
          ? Math.round((r.taughtTopics / r.totalTopics) * 100)
          : 0
        const on = activeArea === r.area
        const interactive = !!onSelectArea
        return (
          <button
            key={r.area}
            type="button"
            onClick={() => onSelectArea?.(on ? '' : r.area)}
            disabled={!interactive}
            className={cx(
              'block w-full rounded-lg px-2 py-1.5 text-left transition-colors',
              interactive &&
                'hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:hover:bg-slate-800/60',
              on && 'bg-accent-soft/60 dark:bg-accent/10',
              !interactive && 'cursor-default',
            )}
          >
            <div className="flex items-baseline justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="truncate text-xs font-medium text-slate-700 dark:text-slate-200">
                  {r.area}
                </span>
                <span className="shrink-0 text-[10px] text-slate-400 dark:text-slate-500">
                  {r.part === '必修' ? '必修' : '選修'}
                </span>
              </div>
              <span className="shrink-0 text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
                {r.taughtTopics}/{r.plannedTopics}/{r.totalTopics}
              </span>
            </div>

            {/* 三層堆疊條：全部(底) → 已備(中) → 已授(深) */}
            <div className="relative mt-1 h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700/70">
              {/* 已備課（accent 淺） */}
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-accent/35 transition-all duration-500 dark:bg-accent/30"
                style={{ width: `${plannedPct}%` }}
              />
              {/* 已授課（accent 實） */}
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-accent transition-all duration-500"
                style={{ width: `${taughtPct}%` }}
              />
            </div>
          </button>
        )
      })}

      {/* 圖例 */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2 pt-0.5 text-[10px] text-slate-400 dark:text-slate-500">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-accent" />
          已授課
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-accent/35" />
          已備課
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-slate-200 dark:bg-slate-600" />
          全部課題
        </span>
        <span className="ml-auto tabular-nums">數字：授 / 備 / 總</span>
      </div>
    </div>
  )
}
