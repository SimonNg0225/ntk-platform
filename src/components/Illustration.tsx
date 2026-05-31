import { useState } from 'react'

// ============================================================
//  Illustration —— 顯示 public/art/<name>.png 嘅插圖位。
//  ------------------------------------------------------------
//  圖未生成（跑 scripts/generate-art.mjs 之前）就靜靜唔 render，
//  令 UI 喺有圖／無圖兩種狀態都正常（graceful degradation）。
//  純裝飾預設 aria-hidden；有 alt 先當內容圖。
// ============================================================

export function Illustration({
  name,
  className,
  alt = '',
}: {
  name: string
  className?: string
  alt?: string
}) {
  const [ok, setOk] = useState(true)
  if (!ok) return null
  return (
    <img
      src={`/art/${name}.png`}
      alt={alt}
      aria-hidden={alt ? undefined : true}
      loading="lazy"
      onError={() => setOk(false)}
      className={className}
    />
  )
}
