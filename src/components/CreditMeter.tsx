import { Coins } from 'lucide-react'
import { useCredits } from '../hooks/useCredits'

// ============================================================
//  AI 點數計量條（擺在 AI 生成掣附近）
//  ------------------------------------------------------------
//  顯示「呢次要幾多點 + 本月剩餘 / 總額」，給用戶心裡有數。
//  source = complete() 的 source tag；transcribe 要傳 feature="transcribe"；
//  有 model 選擇（Flash/Pro）就傳 model，Pro 會 ×4 反映成本。
// ============================================================

export default function CreditMeter({
  source,
  feature,
  model,
  className = '',
}: {
  source: string
  feature?: string
  model?: string
  className?: string
}) {
  const { remaining, pool, costOf, loading } = useCredits()
  if (pool <= 0) return null // 未有方案（理論上不會）— 不顯示
  const cost = costOf({ source, feature, model })
  const insufficient = !loading && remaining < cost
  const low = !loading && !insufficient && remaining <= Math.max(cost * 2, Math.ceil(pool * 0.15))
  const tone = insufficient
    ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300'
    : low
      ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300'
      : 'border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-400'
  return (
    <span
      className={`inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] ${tone} ${className}`}
      title={`此動作扣 ${cost} 點；本月 AI 點數剩 ${loading ? '…' : remaining} / ${pool}`}
      aria-label={`AI 點數：此動作扣 ${cost} 點，本月剩 ${loading ? '載入中' : remaining} / ${pool}`}
    >
      <Coins size={12} className="shrink-0" />
      <span>
        扣 <b className="tabular-nums">{cost}</b> 點
      </span>
      <span aria-hidden>·</span>
      <span className={insufficient || low ? 'font-semibold' : ''}>
        {insufficient ? '點數不足' : '剩'}{' '}
        <b className="tabular-nums">{loading ? '…' : remaining}</b>
        <span className="text-slate-300 dark:text-slate-600">/{pool}</span>
      </span>
    </span>
  )
}
