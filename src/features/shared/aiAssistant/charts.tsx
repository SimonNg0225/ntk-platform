import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { cx } from '../../../ui'
import './i18n'

// ============================================================
//  AI 助手 — 自製迷你圖表（純 SVG / div，零依賴）
// ============================================================

/** 近 N 日訊息活躍長條圖 */
export function ActivityBars({
  data,
  className,
}: {
  data: { label: string; count: number }[]
  className?: string
}) {
  const { t } = useTranslation()
  const max = useMemo(() => Math.max(1, ...data.map((d) => d.count)), [data])
  return (
    <div className={className}>
      <div className="flex h-24 items-end gap-1">
        {data.map((d, i) => {
          const h = (d.count / max) * 100
          return (
            <div
              key={i}
              className="group relative flex flex-1 flex-col items-center justify-end"
              title={t('aiasst.chartBarTooltip', { defaultValue: `${d.label}：${d.count} 則`, label: d.label, count: d.count })}
            >
              <div
                className={cx(
                  'w-full rounded-t-sm transition-all duration-300',
                  d.count > 0 ? 'bg-accent/70 group-hover:bg-accent' : 'bg-slate-100 dark:bg-slate-800',
                )}
                style={{ height: `${Math.max(h, d.count > 0 ? 6 : 3)}%` }}
              />
            </div>
          )
        })}
      </div>
      <div className="mt-1 flex gap-1">
        {data.map((d, i) => (
          <span
            key={i}
            className="flex-1 text-center text-[9px] tabular-nums text-slate-400 dark:text-slate-500"
          >
            {i % 2 === 0 ? d.label : ''}
          </span>
        ))}
      </div>
    </div>
  )
}

/** 用 / 答 比例水平條 */
export function RatioBar({
  user,
  model,
}: {
  user: number
  model: number
}) {
  const { t } = useTranslation()
  const total = Math.max(1, user + model)
  return (
    <div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className="bg-accent transition-all" style={{ width: `${(user / total) * 100}%` }} />
        <div className="bg-emerald-500 transition-all" style={{ width: `${(model / total) * 100}%` }} />
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-accent" /> {t('aiasst.ratioMe', { defaultValue: `我 ${user}`, count: user })}
        </span>
        <span className="inline-flex items-center gap-1">
          {t('aiasst.ratioAi', { defaultValue: `AI ${model}`, count: model })} <span className="h-2 w-2 rounded-full bg-emerald-500" />
        </span>
      </div>
    </div>
  )
}
