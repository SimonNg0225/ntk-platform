import { Coins } from 'lucide-react'
import { useCredits } from '../hooks/useCredits'

// ============================================================
//  AI 點數計量條（擺喺 AI 生成掣附近）
//  ------------------------------------------------------------
//  顯示「呢次要幾多點 + 本月剩餘 / 總額」，畀用戶心裡有數。
//  source = complete() 嘅 source tag；transcribe 要傳 feature="transcribe"；
//  有 model 揀（Flash/Pro）就傳 model，Pro 會 ×4 反映成本。
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
  if (pool <= 0) return null // 未有方案（理論上唔會）— 唔顯示
  const cost = costOf({ source, feature, model })
  const low = !loading && remaining < cost
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500 ${className}`}
      title={`呢個動作扣 ${cost} 點；本月 AI 點數剩 ${loading ? '…' : remaining} / ${pool}`}
    >
      <Coins size={12} className="shrink-0" />
      <span>
        呢次{' '}
        <b className="tabular-nums text-slate-500 dark:text-slate-300">{cost}</b> 點
      </span>
      <span aria-hidden>·</span>
      <span className={low ? 'font-medium text-rose-500 dark:text-rose-400' : ''}>
        本月剩{' '}
        <b className="tabular-nums">{loading ? '…' : remaining}</b>
        <span className="text-slate-300 dark:text-slate-600">/{pool}</span>
      </span>
    </span>
  )
}
