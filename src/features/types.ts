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
  /** 屬於邊啲模式 */
  modes: ModeId[]
  /** 顯示名稱 */
  name: string
  /** 一句簡介 */
  description: string
  /** emoji 圖示 */
  icon: string
  /** 分組（側邊欄 / 首頁用嚟歸類），例如 '概覽'、'教學' */
  group: string
  /** 功能本體 (React 元件)。'soon' 狀態可以唔提供。可為動態載入 (lazy)。 */
  component?: ComponentType | LazyExoticComponent<ComponentType>
  /** 'ready' = 可用；'soon' = 預留位（即將推出） */
  status: 'ready' | 'soon'
}
