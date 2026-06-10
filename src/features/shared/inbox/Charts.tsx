import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { cx } from '../../../ui'
import { KIND_ICON, KINDS, kindLabel } from './util'
import type { InboxKind } from './types'

// ============================================================
//  Inbox 自製圖表（純 div / SVG，零 npm 依賴）
//  深色 + tabular-nums + 海軍藍 accent。
// ============================================================

// ───────── 近 14 日擷取量（迷你長條 + hover）─────────
export function CaptureTrend({
  data,
}: {
  data: { key: string; label: string; count: number }[]
}) {
  const { t } = useTranslation()
  const max = useMemo(() => Math.max(1, ...data.map((d) => d.count)), [data])
  const total = data.reduce((s, d) => s + d.count, 0)
  return (
    <div>
      <div className="flex h-24 items-end gap-1">
        {data.map((d) => (
          <div
            key={d.key}
            className="group relative flex flex-1 flex-col items-center justify-end"
            title={t('inbox.chartBarTooltip', { key: d.key, count: d.count, defaultValue: `${d.key}：擷取 ${d.count} 項` })}
          >
            <span className="mb-1 text-[10px] font-medium tabular-nums text-slate-500 opacity-0 transition group-hover:opacity-100 dark:text-slate-400">
              {d.count || ''}
            </span>
            <div
              className={cx(
                'w-full rounded-t-md transition-all duration-500',
                d.count > 0
                  ? 'bg-gradient-to-t from-accent-strong to-accent group-hover:from-accent group-hover:to-accent'
                  : 'bg-slate-100 dark:bg-slate-800',
              )}
              style={{
                height: `${Math.max((d.count / max) * 100, d.count > 0 ? 8 : 4)}%`,
              }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1">
        {data.map((d, i) => (
          <span
            key={d.key}
            className="flex-1 text-center text-[9px] tabular-nums text-slate-400 dark:text-slate-500"
          >
            {i % 2 === 0 ? d.label : ''}
          </span>
        ))}
      </div>
      <p className="mt-2 text-center text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
        {t('inbox.chartTrendTotal', { count: total, defaultValue: `近 14 日共擷取 ${total} 項` })}
      </p>
    </div>
  )
}

// ───────── 分類分布（水平條，可點擊過濾）─────────
const TONE_BAR: Record<InboxKind, string> = {
  task: 'bg-blue-500',
  note: 'bg-accent',
  event: 'bg-emerald-500',
  question: 'bg-amber-500',
  countdown: 'bg-rose-500',
  reference: 'bg-slate-400',
}

export function KindBars({
  byKind,
  onPick,
}: {
  byKind: Record<InboxKind, number>
  onPick?: (kind: InboxKind) => void
}) {
  const { t } = useTranslation()
  const total = KINDS.reduce((s, k) => s + byKind[k.id], 0)
  if (total === 0)
    return (
      <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">
        {t('inbox.chartNoPending', { defaultValue: '未有待處理項目' })}
      </p>
    )
  return (
    <div className="space-y-2">
      {KINDS.map((k) => {
        const v = byKind[k.id]
        const pct = (v / total) * 100
        const Icon = KIND_ICON[k.id]
        const row = (
          <>
            <span className="flex w-16 shrink-0 items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
              <Icon size={12} className="shrink-0" />
              {kindLabel(k.id)}
            </span>
            <div className="h-5 flex-1 overflow-hidden rounded-md bg-slate-100 dark:bg-slate-800">
              <div
                className={cx(
                  'flex h-full items-center justify-end rounded-md px-1.5 transition-all duration-500',
                  TONE_BAR[k.id],
                )}
                style={{ width: `${Math.max(pct, v > 0 ? 10 : 0)}%` }}
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
          </>
        )
        return onPick && v > 0 ? (
          <button
            key={k.id}
            type="button"
            onClick={() => onPick(k.id)}
            className="flex w-full items-center gap-2 rounded-md text-left transition hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            {row}
          </button>
        ) : (
          <div key={k.id} className="flex items-center gap-2">
            {row}
          </div>
        )
      })}
    </div>
  )
}
