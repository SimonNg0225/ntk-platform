import type { ComponentType, LazyExoticComponent } from 'react'
import type { ModeId } from '../modes/modes'

// ============================================================
//  Feature 型別
//  ------------------------------------------------------------
//  平台上每一個「功能」都係一個 Feature。
//  功能可以屬於一個或多個模式（modes）。
// ============================================================

export interface Feature {
  /** 唯一 id，例如 'notes'、'lesson-plan' */
  id: string
  /** 屬於邊些模式 */
  modes: ModeId[]
  /** 顯示名稱 */
  name: string
  /** 一句簡介 */
  description: string
  /** emoji 圖示 */
  icon: string
  /** 分組（側邊欄 / 首頁用來歸類），例如 '概覽'、'教學' */
  group: string
  /** 功能本體 (React 元件)。'soon' 狀態可以不提供。可為動態載入 (lazy)。 */
  component?: ComponentType | LazyExoticComponent<ComponentType>
  /** 'ready' = 可用；'soon' = 預留位（即將推出） */
  status: 'ready' | 'soon'
  /**
   * 自管 header：true 時 App host 不再 render 預設的 feature 名 + 描述 h1，
   * 由功能組件自己的 bespoke masthead 全權負責頂部（避免「header 疊 header」）。
   * 返回掣仍然由 host 提供。預設 false / undefined = host render 標準 header。
   */
  selfManagedHeader?: boolean
  /** 要付費方案（Plus / Pro）先用得；免費用戶會見到升級提示。 */
  requiresPaid?: boolean
  /**
   * 仍可用 id 直接開啟，但不出現在側欄、首頁分類、常用入口等主導航。
   * 適合被首頁 composer / command palette 承擔的內嵌能力。
   */
  hideFromNavigation?: boolean
}
