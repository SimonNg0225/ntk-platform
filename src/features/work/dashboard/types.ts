// ============================================================
//  工作儀表板：功能專屬型別
//  ------------------------------------------------------------
//  儀表板本身唔產生新資料（除咗版面設定，見 store.ts），
//  以下純粹係「彙整後嘅記憶體 view model」型別。
// ============================================================

// 可配置 widget 嘅穩定 id（順序見 store DEFAULT_WIDGET_ORDER）
export type WidgetId =
  | 'kpi' // 四宮格 KPI（含週對比趨勢）
  | 'focus' // 今日聚焦（一句話 + 重點數字）
  | 'agenda' // 今日議程（課堂＋事件＋到期待辦時間軸）
  | 'taskTrend' // 待辦完成趨勢（長條 + 熱力 + streak）
  | 'curriculum' // 各班課程進度（橫條）
  | 'attendance' // 出席率（甜甜圈 + 近日）
  | 'grades' // 成績分布（直方圖 + 平均）
  | 'parentFollowUp' // 待跟進家長
  | 'countdown' // 重要日子倒數
  | 'classLoad' // 本週課擔（每日節數長條）
  | 'quickActions' // 快速動作

// ───────── 今日議程一格（時間軸合併課堂 / 事件 / 待辦）─────────
export type AgendaKind = 'class' | 'event' | 'task' | 'countdown'
export interface AgendaItem {
  id: string
  kind: AgendaKind
  time?: string // HH:mm（無 = 全日 / 無時間）
  sortKey: number // 排序用（分鐘；全日 = -1）
  title: string
  subtitle?: string
  colorClass: string // dot / accent 色 class
  badge?: string // 右側標籤（課室 / 分類…）
  overdue?: boolean
  done?: boolean
  taskId?: string // kind=task：可一鍵完成
  navTo?: string // 點擊跳去邊個功能
}

// ───────── 趨勢資料點（待辦完成）─────────
export interface TrendPoint {
  key: string // YYYY-MM-DD
  label: string // 日
  created: number
  completed: number
}

export interface HeatCell {
  key: string
  count: number
}

// ───────── 班別課程進度 ─────────
export interface ClassProgressRow {
  id: string
  name: string
  done: number
  inProgress: number
  total: number
  percent: number
}

// ───────── 成績分布 bin ─────────
export interface GradeBin {
  label: string // 分數區間
  count: number
}

// ───────── 本週課擔（每日節數）─────────
export interface DayLoad {
  day: number // 0=日 … 6=六
  label: string
  periods: number
  isToday: boolean
}

// ───────── KPI（含週對比）─────────
export interface Kpi {
  key: string
  label: string
  value: number
  unit?: string
  icon: 'tasks' | 'class' | 'parent' | 'event'
  delta?: { dir: 'up' | 'down' | 'flat'; text: string }
  highlight?: boolean
  navTo: string
}
