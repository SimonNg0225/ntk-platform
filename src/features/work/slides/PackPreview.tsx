import { SLIDE_PACKS } from '../../../lib/export'

/**
 * 模板 pack 縮圖 —— token-driven 代表性封面 mock（16:9）。
 *
 * 注意：呢個唔係真 pptx 引擎 render（引擎喺瀏覽器跑唔抵），
 * 只係用 pack 設計 token（bg / ink / accent / dark / displayFont）砌
 * 一個會視覺上分得開每套 pack 嘅 SVG 模擬封面：背景、faux kicker 點睛條、
 * 大標題色塊、幾條內文線同一粒 accent 結構 motif。零依賴、純 inline SVG。
 */

/** SLIDE_PACKS 元素型 —— 縮圖只食 design token，避過引擎欄位 */
type PackOption = (typeof SLIDE_PACKS)[number]

/** token 係純 hex（冇 #）—— SVG fill 需要補返 */
function hex(c: string): string {
  return c.startsWith('#') ? c : `#${c}`
}

/** 喺淡／深底之間揀一隻夠對比嘅 muted 線色（faux 內文線用） */
function lineColor(dark: boolean): string {
  return dark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)'
}

export interface PackPreviewProps {
  pack: PackOption
  /** 額外 class（外層 wrapper） */
  className?: string
}

/**
 * 16:9 縮圖。viewBox 100×56；外層用 aspect-video 撐滿可用闊度。
 * aria-hidden — 名／hint 由父按鈕負責朗讀（避免重複報讀色塊）。
 */
export default function PackPreview({ pack, className }: PackPreviewProps) {
  const bg = hex(pack.bg)
  const ink = hex(pack.ink)
  const accent = hex(pack.accent)
  const line = lineColor(pack.dark)

  return (
    <svg
      viewBox="0 0 100 56"
      className={`block aspect-video w-full rounded-md ring-1 ring-black/10 dark:ring-white/10 ${className ?? ''}`}
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label={`${pack.name} 模板預覽`}
    >
      {/* 背景 */}
      <rect x="0" y="0" width="100" height="56" fill={bg} />

      {/* faux kicker — accent 短點睛條 */}
      <rect x="8" y="9" width="20" height="3" rx="1.5" fill={accent} />

      {/* faux 大標題 — ink 粗塊（顯示字體只係語意提示，縮圖用色塊代） */}
      <rect x="8" y="16" width="52" height="6" rx="1" fill={ink} />
      <rect x="8" y="24.5" width="34" height="4" rx="1" fill={ink} opacity={0.55} />

      {/* 分隔髮線 */}
      <line x1="8" y1="34" x2="78" y2="34" stroke={line} strokeWidth="1" />

      {/* faux 內文 marker + 線 ×3 */}
      <circle cx="9.5" cy="39" r="1.5" fill={accent} />
      <rect x="13" y="38" width="40" height="2.5" rx="1.25" fill={line} />
      <circle cx="9.5" cy="44.5" r="1.5" fill={accent} />
      <rect x="13" y="43.5" width="46" height="2.5" rx="1.25" fill={line} />
      <circle cx="9.5" cy="50" r="1.5" fill={accent} />
      <rect x="13" y="49" width="32" height="2.5" rx="1.25" fill={line} />

      {/* 右側 accent 結構 motif — pack 標誌色塊（深底用環，淡底用實心圓角方） */}
      {pack.dark ? (
        <circle cx="84" cy="30" r="11" fill="none" stroke={accent} strokeWidth="2.5" />
      ) : (
        <rect x="73" y="19" width="22" height="22" rx="3" fill={accent} opacity={0.92} />
      )}
    </svg>
  )
}
