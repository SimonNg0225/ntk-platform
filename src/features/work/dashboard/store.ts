import { createCollection } from '../../../lib/store'
import type { WidgetId } from './types'

// ============================================================
//  工作儀表板：功能專屬持久化（唔掂 data/collections.ts）
//  ------------------------------------------------------------
//  儀表板嘅資料全部係跨功能彙整返嚟（tasks / timetable / events…），
//  本身唯一需要持久化嘅係「版面設定」：
//    - 邊啲 widget 顯示 / 隱藏
//    - widget 排列次序
//    - 統計時間範圍（7 / 14 / 30 日）
//  以「單一 row」存喺自己嘅 collection（id 固定 'layout'）。
//  唯一 key（已喺 newCollections 申報）：work_dashboard_layout
// ============================================================

export interface DashboardLayout {
  id: string // 固定 'layout'
  order: WidgetId[] // widget 排列次序（同時決定顯示者）
  hidden: WidgetId[] // 明確收起嘅 widget
  rangeDays: number // 趨勢圖時間範圍（7 / 14 / 30）
  greetingName: string // 自訂稱呼（空 = 用「老師」）
  updatedAt: string
}

// 預設顯示次序（涵蓋老師日常最重要嘅彙整）
export const DEFAULT_WIDGET_ORDER: WidgetId[] = [
  'kpi',
  'focus',
  'agenda',
  'taskTrend',
  'curriculum',
  'attendance',
  'grades',
  'parentFollowUp',
  'countdown',
  'classLoad',
  'quickActions',
]

const DEFAULT_LAYOUT: DashboardLayout = {
  id: 'layout',
  order: DEFAULT_WIDGET_ORDER,
  hidden: [],
  rangeDays: 14,
  greetingName: '',
  updatedAt: new Date().toISOString(),
}

export const dashboardLayoutCol = createCollection<DashboardLayout>(
  'work_dashboard_layout',
  [DEFAULT_LAYOUT],
)

/** 讀取版面（補底：缺欄位用預設；補上後加入嘅新 widget）。 */
export function readLayout(): DashboardLayout {
  const row = dashboardLayoutCol.get().find((r) => r.id === 'layout')
  if (!row) {
    dashboardLayoutCol.add(DEFAULT_LAYOUT)
    return DEFAULT_LAYOUT
  }
  // 將「新加入但 saved order 未有」嘅 widget 補去尾，確保升級唔會漏 widget
  const known = new Set(row.order)
  const missing = DEFAULT_WIDGET_ORDER.filter((w) => !known.has(w))
  if (missing.length === 0) return row
  const merged = { ...row, order: [...row.order, ...missing] }
  return merged
}

function commit(patch: Partial<Omit<DashboardLayout, 'id'>>) {
  // readLayout 必定回傳一個 row（無就會 add 預設），亦會補上升級後新增嘅 widget。
  // 用 set 整批覆寫（順帶把 migration 嘅 order 落地），避免 update 漏咗 migrated 欄位。
  const cur = readLayout()
  const next: DashboardLayout = { ...cur, ...patch, updatedAt: new Date().toISOString() }
  dashboardLayoutCol.set([next])
}

export function toggleWidget(id: WidgetId) {
  const cur = readLayout()
  const hidden = cur.hidden.includes(id)
    ? cur.hidden.filter((w) => w !== id)
    : [...cur.hidden, id]
  commit({ hidden })
}

export function moveWidget(id: WidgetId, dir: -1 | 1) {
  const cur = readLayout()
  const order = [...cur.order]
  const i = order.indexOf(id)
  if (i === -1) return
  const j = i + dir
  if (j < 0 || j >= order.length) return
  ;[order[i], order[j]] = [order[j], order[i]]
  commit({ order })
}

export function setRange(rangeDays: number) {
  commit({ rangeDays })
}

export function setGreetingName(greetingName: string) {
  commit({ greetingName })
}

export function resetLayout() {
  commit({ order: DEFAULT_WIDGET_ORDER, hidden: [] })
}
