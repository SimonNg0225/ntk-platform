import type { Topic, ClassProgress, ProgressStatus } from '../../../data/types'

// ============================================================
//  課程進度（教學進度表 / Scheme of Work）核心工具
//  參考真實工具：Planboard 課程覆蓋追蹤、Chalk Atlas 課程地圖、
//  香港學校「教學進度表」（pacing guide）。
//  ------------------------------------------------------------
//  本檔只放純函數 + 型別，方便主元件同圖表共用、易測。
// ============================================================

// ───── 本檔自定義持久化型別（唔改 data/types.ts）─────
// 每班每課題嘅「教學計劃」：計劃週次、節數、目標完成日。
// 同現有 ClassProgress（只存 status / dateDone）分開存，互不干擾。
export interface CurriculumPlan {
  id: string
  classId: string
  topicId: string
  plannedWeek?: number // 第幾教學週（1 起）
  periods?: number // 預計節數
  targetDate?: string // YYYY-MM-DD 目標完成日
  note?: string
}

export type PaceState = 'ahead' | 'on_track' | 'behind' | 'due_soon' | 'none'

// ───── 日期工具（本地時區，避開 toISOString 時差）─────
export function toKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function todayKey(): string {
  return toKey(new Date())
}

export function fmtDate(iso?: string): string {
  if (!iso) return ''
  // 純日期（YYYY-MM-DD）要當「本地日期」解析，
  // 否則 new Date('2026-03-01') 會當 UTC 午夜，喺 UTC 以西時區
  // getMonth/getDate 會退一日（off-by-one），同 toKey 嘅本地時區原則不一致。
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (m) {
    const month = Number(m[2])
    const day = Number(m[3])
    return `${month}月${day}日`
  }
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

/** 兩個 YYYY-MM-DD 之間嘅日數（b - a） */
export function daysBetween(aKey: string, bKey: string): number {
  const [ay, am, ad] = aKey.split('-').map(Number)
  const [by, bm, bd] = bKey.split('-').map(Number)
  const a = Date.UTC(ay, (am ?? 1) - 1, ad ?? 1)
  const b = Date.UTC(by, (bm ?? 1) - 1, bd ?? 1)
  return Math.round((b - a) / 86400000)
}

// ───── 進度狀態樣式 ─────
export const STATUS_META: Record<
  ProgressStatus,
  { label: string; tone: 'slate' | 'amber' | 'green'; dot: string; fill: string }
> = {
  not_started: { label: '未開始', tone: 'slate', dot: 'bg-slate-300 dark:bg-slate-600', fill: 'fill-slate-300 dark:fill-slate-600' },
  in_progress: { label: '進行中', tone: 'amber', dot: 'bg-amber-400', fill: 'fill-amber-400' },
  done: { label: '完成', tone: 'green', dot: 'bg-emerald-500', fill: 'fill-emerald-500' },
}

export const NEXT_STATUS: Record<ProgressStatus, ProgressStatus> = {
  not_started: 'in_progress',
  in_progress: 'done',
  done: 'not_started',
}

// ───── 進度查詢 helper（純函數，傳入已過濾資料）─────
export function recordOf(
  progress: ClassProgress[],
  classId: string,
  topicId: string,
): ClassProgress | undefined {
  return progress.find((p) => p.classId === classId && p.topicId === topicId)
}

export function statusOf(
  progress: ClassProgress[],
  classId: string,
  topicId: string,
): ProgressStatus {
  return recordOf(progress, classId, topicId)?.status ?? 'not_started'
}

export function planOf(
  plans: CurriculumPlan[],
  classId: string,
  topicId: string,
): CurriculumPlan | undefined {
  return plans.find((p) => p.classId === classId && p.topicId === topicId)
}

// ───── 教學進度 pacing 判定 ─────
// 對住目標完成日（targetDate）同今日比較，得出落後/準時/超前。
export const PACE_META: Record<
  PaceState,
  { label: string; tone: 'slate' | 'amber' | 'green' | 'rose' | 'blue'; text: string }
> = {
  ahead: { label: '超前', tone: 'green', text: 'text-emerald-600 dark:text-emerald-400' },
  on_track: { label: '準時', tone: 'blue', text: 'text-blue-600 dark:text-blue-400' },
  behind: { label: '落後', tone: 'rose', text: 'text-rose-600 dark:text-rose-400' },
  due_soon: { label: '臨近', tone: 'amber', text: 'text-amber-600 dark:text-amber-400' },
  none: { label: '未排期', tone: 'slate', text: 'text-slate-400 dark:text-slate-500' },
}

export function paceOf(
  status: ProgressStatus,
  targetDate: string | undefined,
  today: string,
): PaceState {
  if (!targetDate) return 'none'
  if (status === 'done') return 'on_track' // 已完成就唔算落後
  const diff = daysBetween(today, targetDate) // 目標 - 今日；負數 = 已過期
  if (diff < 0) return 'behind'
  if (diff <= 7) return 'due_soon'
  return 'ahead'
}

// ───── CSV 匯出（共用層，見 ../shared/csv）─────
export { csvEscape, downloadCsv } from '../shared/csv'

// ───── 分組（部分 → 範疇）─────
export interface AreaGroup {
  area: string
  items: Topic[]
}
export interface PartGroup {
  part: string
  areas: AreaGroup[]
  items: Topic[] // 攤平方便統計
}

export function groupTopics(topics: Topic[]): PartGroup[] {
  const sorted = [...topics].sort((a, b) => a.order - b.order)
  const parts: PartGroup[] = []
  for (const tp of sorted) {
    let part = parts.find((p) => p.part === tp.part)
    if (!part) {
      part = { part: tp.part, areas: [], items: [] }
      parts.push(part)
    }
    part.items.push(tp)
    let area = part.areas.find((a) => a.area === tp.area)
    if (!area) {
      area = { area: tp.area, items: [] }
      part.areas.push(area)
    }
    area.items.push(tp)
  }
  return parts
}

// ───── 完成度統計 ─────
export interface Counts {
  done: number
  inProgress: number
  notStarted: number
  total: number
  pct: number
}

export function countStatuses(
  progress: ClassProgress[],
  classId: string,
  topicIds: string[],
): Counts {
  let done = 0
  let inProgress = 0
  for (const id of topicIds) {
    const s = statusOf(progress, classId, id)
    if (s === 'done') done++
    else if (s === 'in_progress') inProgress++
  }
  const total = topicIds.length
  const notStarted = total - done - inProgress
  const pct = total ? Math.round((done / total) * 100) : 0
  return { done, inProgress, notStarted, total, pct }
}
