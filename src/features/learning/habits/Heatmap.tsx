import { useMemo } from 'react'
import { cx, Tooltip } from '../../../ui'
import { colorOf, type HabitColor } from './types'
import {
  buildHeatGrid,
  heatLevel,
  longDateLabel,
  todayKey,
  WEEKDAY_LABELS,
} from './util'

// ============================================================
//  年度 heatmap（GitHub 貢獻圖式）— 純 div，零依賴
//  列 = 星期（日→六），欄 = 週。色深 = 完成氣勢（連續密度）。
// ============================================================

export default function Heatmap({
  done,
  color,
  weeks = 27,
  endKey = todayKey(),
}: {
  done: Set<string>
  color: HabitColor
  weeks?: number
  endKey?: string
}) {
  const spec = colorOf(color)
  const grid = useMemo(() => buildHeatGrid(endKey, weeks), [endKey, weeks])
  const tKey = todayKey()

  return (
    <div className="w-full overflow-x-auto pb-1">
      <div className="inline-flex min-w-full flex-col gap-1">
        {/* 月份標籤列 */}
        <div className="flex pl-6">
          <div
            className="relative h-3 flex-1"
            style={{ minWidth: `${grid.weeks.length * 14}px` }}
          >
            {grid.monthMarks.map((m) => (
              <span
                key={`${m.col}-${m.label}`}
                className="absolute top-0 text-[9px] text-slate-400 dark:text-slate-500"
                style={{ left: `${m.col * 14}px` }}
              >
                {m.label}
              </span>
            ))}
          </div>
        </div>

        <div className="flex gap-1">
          {/* 星期標籤（只標 一/三/五） */}
          <div className="flex w-5 shrink-0 flex-col gap-[3px] pt-[1px]">
            {WEEKDAY_LABELS.map((w, i) => (
              <span
                key={w}
                className="flex h-[11px] items-center text-[9px] leading-none text-slate-400 dark:text-slate-500"
              >
                {i % 2 === 1 ? w : ''}
              </span>
            ))}
          </div>

          {/* 格網 */}
          <div className="flex gap-[3px]">
            {grid.weeks.map((col, ci) => (
              <div key={ci} className="flex flex-col gap-[3px]">
                {col.map((cell) => {
                  if (!cell.inRange) {
                    return <span key={cell.key} className="h-[11px] w-[11px]" />
                  }
                  const lvl = heatLevel(done, cell.key)
                  const isToday = cell.key === tKey
                  const label = done.has(cell.key)
                    ? `${longDateLabel(cell.key)} · 已完成`
                    : `${longDateLabel(cell.key)} · 未完成`
                  return (
                    <Tooltip key={cell.key} label={label}>
                      <span
                        className={cx(
                          'h-[11px] w-[11px] rounded-[3px] ring-1 ring-inset ring-black/5 dark:ring-white/5',
                          spec.heat[lvl],
                          isToday && 'outline outline-1 outline-offset-1 outline-slate-400 dark:outline-slate-500',
                        )}
                      />
                    </Tooltip>
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        {/* 圖例 */}
        <div className="flex items-center justify-end gap-1.5 pt-1 text-[10px] text-slate-400 dark:text-slate-500">
          <span>少</span>
          {spec.heat.map((h, i) => (
            <span
              key={i}
              className={cx('h-[11px] w-[11px] rounded-[3px] ring-1 ring-inset ring-black/5 dark:ring-white/5', h)}
            />
          ))}
          <span>多</span>
        </div>
      </div>
    </div>
  )
}
