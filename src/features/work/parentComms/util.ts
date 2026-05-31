import type { ParentComm } from '../../../data/types'
import type { Entity } from '../../../lib/store'

// ============================================================
//  家長 / 學生溝通 — 核心工具（對齊真實 CRM 活動記錄）
//  ------------------------------------------------------------
//  - 共用 parentCommsCol 維持原本欄位（classId / studentId / date /
//    channel / summary / followUp / createdAt），向後相容。
//  - 進階 metadata（方向、分類、結果觀感、跟進到期日、提醒…）放喺
//    本功能自己嘅 parent_comm_meta 集合，用 commId 一對一掛鈎，
//    完全唔改 data/collections.ts 或 types.ts。
//  - 設計參考：CRM「聯絡活動時間線 + 跟進管道」（HubSpot / Salesforce
//    activity timeline）改造成老師對家長 / 學生溝通嘅情境。
// ============================================================

// ───────── 進階 metadata（本功能專屬，一對一掛鈎 ParentComm）─────────
export type Direction = 'outgoing' | 'incoming'
export type Outcome = 'positive' | 'neutral' | 'concern'
export type Category =
  | 'academic'
  | 'behaviour'
  | 'attendance'
  | 'praise'
  | 'admin'
  | 'wellbeing'
  | 'other'

export interface CommMeta extends Entity {
  commId: string // 對應 ParentComm.id（一對一）
  direction?: Direction // 主動聯絡 / 家長來訊
  category?: Category // 溝通主題分類
  outcome?: Outcome // 觀感：正面 / 中性 / 需關注
  contactName?: string // 聯絡人（例如「陳太」）
  followUpDate?: string // 跟進到期日 YYYY-MM-DD（followUp=true 時生效）
  followUpNote?: string // 跟進待辦內容
  remindMinutes?: number // 提前提醒（分鐘，顯示用）
  updatedAt: string
}

// ───────── 訊息範本（本功能專屬）─────────
export interface CommTemplate extends Entity {
  title: string
  category: Category
  channel: string
  body: string
  builtIn?: boolean
  createdAt: string
}

// ───────── 顯示常數 ─────────
export const CHANNELS = ['電話', '電郵', '面談', '手冊', '訊息'] as const
export type Channel = (typeof CHANNELS)[number]

export const DIRECTION_LABEL: Record<Direction, string> = {
  outgoing: '主動聯絡',
  incoming: '家長來訊',
}

export const CATEGORY_LABEL: Record<Category, string> = {
  academic: '學業',
  behaviour: '行為',
  attendance: '出席',
  praise: '表揚',
  admin: '行政',
  wellbeing: '身心',
  other: '其他',
}

export const CATEGORY_OPTIONS: { value: Category; label: string }[] = (
  Object.keys(CATEGORY_LABEL) as Category[]
).map((value) => ({ value, label: CATEGORY_LABEL[value] }))

export interface CategoryStyle {
  badge: 'slate' | 'accent' | 'green' | 'amber' | 'rose' | 'blue'
  bar: string // Tailwind bg-*（圖表 / 圓點）
}

export const CATEGORY_STYLE: Record<Category, CategoryStyle> = {
  academic: { badge: 'accent', bar: 'bg-accent' },
  behaviour: { badge: 'amber', bar: 'bg-amber-500' },
  attendance: { badge: 'blue', bar: 'bg-blue-500' },
  praise: { badge: 'green', bar: 'bg-emerald-500' },
  admin: { badge: 'slate', bar: 'bg-slate-400' },
  wellbeing: { badge: 'rose', bar: 'bg-rose-500' },
  other: { badge: 'slate', bar: 'bg-slate-300 dark:bg-slate-600' },
}

export const OUTCOME_LABEL: Record<Outcome, string> = {
  positive: '正面',
  neutral: '中性',
  concern: '需關注',
}

export interface OutcomeStyle {
  badge: 'green' | 'slate' | 'rose'
  bar: string
  text: string
}

export const OUTCOME_STYLE: Record<Outcome, OutcomeStyle> = {
  positive: { badge: 'green', bar: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-300' },
  neutral: { badge: 'slate', bar: 'bg-slate-400', text: 'text-slate-500 dark:text-slate-400' },
  concern: { badge: 'rose', bar: 'bg-rose-500', text: 'text-rose-600 dark:text-rose-300' },
}

// 聯絡方式圖表填色（畀 donut / 條形圖）
export const CHANNEL_BAR: Record<string, string> = {
  電話: 'bg-accent',
  電郵: 'bg-blue-500',
  面談: 'bg-emerald-500',
  手冊: 'bg-amber-500',
  訊息: 'bg-violet-500',
}
export const CHANNEL_STROKE: Record<string, string> = {
  電話: 'stroke-accent',
  電郵: 'stroke-blue-500',
  面談: 'stroke-emerald-500',
  手冊: 'stroke-amber-500',
  訊息: 'stroke-violet-500',
}

// ───────── 日期工具（本地時區，避開 toISOString 時差）─────────
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'] as const

export function toKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function fromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0)
}

export function todayKey(): string {
  return toKey(new Date())
}

export function shiftKey(key: string, days: number): string {
  const d = fromKey(key)
  return toKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + days, 12))
}

export function monthKeyOf(key: string): string {
  return key.slice(0, 7) // YYYY-MM
}

export function weekdayOf(key: string): string {
  return WEEKDAYS[fromKey(key).getDay()]
}

export function longDateLabel(key: string): string {
  const d = fromKey(key)
  return `${d.getMonth() + 1}月${d.getDate()}日（星期${WEEKDAYS[d.getDay()]}）`
}

export function shortDateLabel(key: string): string {
  const d = fromKey(key)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number)
  return `${y}年${m}月`
}

/** 相對日子（今日 / 昨日 / N 日前 / N 日後） */
export function relativeDayLabel(key: string, anchor = todayKey()): string {
  const diff = Math.round(
    (fromKey(key).getTime() - fromKey(anchor).getTime()) / 864e5,
  )
  if (diff === 0) return '今日'
  if (diff === 1) return '明日'
  if (diff === -1) return '昨日'
  if (diff < 0) return `${-diff} 日前`
  return `${diff} 日後`
}

/** 由今日倒數 n 個月（含今月）嘅 YYYY-MM（由舊到新） */
export function recentMonthKeys(n: number, anchor = new Date()): string[] {
  const out: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(anchor.getFullYear(), anchor.getMonth() - i, 1)
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return out
}

// ───────── 跟進管道狀態 ─────────
export type FollowUpBucket = 'overdue' | 'today' | 'soon' | 'later' | 'nodate'

export function followUpBucket(date: string | undefined, anchor = todayKey()): FollowUpBucket {
  if (!date) return 'nodate'
  if (date < anchor) return 'overdue'
  if (date === anchor) return 'today'
  if (date <= shiftKey(anchor, 7)) return 'soon'
  return 'later'
}

export const BUCKET_LABEL: Record<FollowUpBucket, string> = {
  overdue: '逾期',
  today: '今日到期',
  soon: '未來 7 日',
  later: '稍後',
  nodate: '未設日期',
}

export const BUCKET_TONE: Record<FollowUpBucket, 'rose' | 'amber' | 'accent' | 'slate'> = {
  overdue: 'rose',
  today: 'amber',
  soon: 'accent',
  later: 'slate',
  nodate: 'slate',
}

// ───────── 合併視圖：ParentComm + CommMeta ─────────
export interface CommRow {
  comm: ParentComm
  meta?: CommMeta
}

// ───────── 統計 ─────────
export interface Overview {
  total: number
  thisMonth: number
  lastMonth: number
  openFollowUps: number
  overdue: number
  positiveRate: number | null // 正面占有觀感記錄嘅 %
  contactedStudents: number // 有溝通記錄嘅學生數
}

export function buildOverview(rows: CommRow[], anchor = todayKey()): Overview {
  const thisM = monthKeyOf(anchor)
  const lastMonthDate = new Date(fromKey(anchor).getFullYear(), fromKey(anchor).getMonth() - 1, 1)
  const lastM = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`

  let thisMonth = 0
  let lastMonth = 0
  let openFollowUps = 0
  let overdue = 0
  let positive = 0
  let rated = 0
  const studentSet = new Set<string>()

  for (const { comm, meta } of rows) {
    const mk = monthKeyOf(comm.date)
    if (mk === thisM) thisMonth += 1
    if (mk === lastM) lastMonth += 1
    if (comm.followUp) {
      openFollowUps += 1
      if (followUpBucket(meta?.followUpDate, anchor) === 'overdue') overdue += 1
    }
    if (meta?.outcome) {
      rated += 1
      if (meta.outcome === 'positive') positive += 1
    }
    if (comm.studentId) studentSet.add(comm.studentId)
  }

  return {
    total: rows.length,
    thisMonth,
    lastMonth,
    openFollowUps,
    overdue,
    positiveRate: rated === 0 ? null : Math.round((positive / rated) * 100),
    contactedStudents: studentSet.size,
  }
}

export interface CountSlice {
  key: string
  label: string
  count: number
}

export function countByChannel(rows: CommRow[]): CountSlice[] {
  const map = new Map<string, number>()
  for (const { comm } of rows) map.set(comm.channel, (map.get(comm.channel) ?? 0) + 1)
  return [...map.entries()]
    .map(([key, count]) => ({ key, label: key, count }))
    .sort((a, b) => b.count - a.count)
}

export function countByCategory(rows: CommRow[]): { key: Category | 'unset'; label: string; count: number }[] {
  const map = new Map<Category | 'unset', number>()
  for (const { meta } of rows) {
    const k = meta?.category ?? 'unset'
    map.set(k, (map.get(k) ?? 0) + 1)
  }
  return [...map.entries()]
    .map(([key, count]) => ({
      key,
      label: key === 'unset' ? '未分類' : CATEGORY_LABEL[key],
      count,
    }))
    .sort((a, b) => b.count - a.count)
}

export function countByOutcome(rows: CommRow[]): Record<Outcome, number> {
  const out: Record<Outcome, number> = { positive: 0, neutral: 0, concern: 0 }
  for (const { meta } of rows) if (meta?.outcome) out[meta.outcome] += 1
  return out
}

export interface MonthlyPoint {
  key: string // YYYY-MM
  label: string // 例如「5月」
  outgoing: number
  incoming: number
  total: number
}

export function monthlyTrend(rows: CommRow[], months: number, anchor = new Date()): MonthlyPoint[] {
  const keys = recentMonthKeys(months, anchor)
  const idx = new Map<string, MonthlyPoint>(
    keys.map((k) => {
      const m = Number(k.slice(5))
      return [k, { key: k, label: `${m}月`, outgoing: 0, incoming: 0, total: 0 }]
    }),
  )
  for (const { comm, meta } of rows) {
    const point = idx.get(monthKeyOf(comm.date))
    if (!point) continue
    point.total += 1
    if (meta?.direction === 'incoming') point.incoming += 1
    else point.outgoing += 1
  }
  return keys.map((k) => idx.get(k)!)
}

// ───────── 每位學生彙總（CRM 名冊）─────────
export interface StudentSummary {
  studentId: string
  count: number
  lastDate?: string // 最近一次溝通
  openFollowUps: number
  nextFollowUp?: string // 最近一個未完成跟進到期日
  positive: number
  neutral: number
  concern: number
}

export function summarizeByStudent(rows: CommRow[]): Map<string, StudentSummary> {
  const map = new Map<string, StudentSummary>()
  for (const { comm, meta } of rows) {
    if (!comm.studentId) continue
    let s = map.get(comm.studentId)
    if (!s) {
      s = {
        studentId: comm.studentId,
        count: 0,
        openFollowUps: 0,
        positive: 0,
        neutral: 0,
        concern: 0,
      }
      map.set(comm.studentId, s)
    }
    s.count += 1
    if (!s.lastDate || comm.date > s.lastDate) s.lastDate = comm.date
    if (comm.followUp) {
      s.openFollowUps += 1
      const due = meta?.followUpDate
      if (due && (!s.nextFollowUp || due < s.nextFollowUp)) s.nextFollowUp = due
    }
    if (meta?.outcome) s[meta.outcome] += 1
  }
  return map
}

// ───────── 排序 ─────────
export type SortKey = 'date' | 'channel' | 'category' | 'followUp'
export type SortDir = 'asc' | 'desc'

export function sortRows(
  rows: CommRow[],
  key: SortKey,
  dir: SortDir,
  fallbackName: (r: CommRow) => string,
): CommRow[] {
  const sign = dir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    let cmp = 0
    if (key === 'date') {
      cmp = a.comm.date < b.comm.date ? -1 : a.comm.date > b.comm.date ? 1 : 0
      if (cmp === 0) cmp = (a.comm.createdAt ?? '').localeCompare(b.comm.createdAt ?? '')
    } else if (key === 'channel') {
      cmp = a.comm.channel.localeCompare(b.comm.channel)
    } else if (key === 'category') {
      cmp = (a.meta?.category ?? 'zzz').localeCompare(b.meta?.category ?? 'zzz')
    } else {
      // followUp：未完成（true）排先；同樣按到期日
      const af = a.comm.followUp ? 0 : 1
      const bf = b.comm.followUp ? 0 : 1
      cmp = af - bf
      if (cmp === 0) cmp = (a.meta?.followUpDate ?? 'zzzz').localeCompare(b.meta?.followUpDate ?? 'zzzz')
    }
    if (cmp === 0) cmp = fallbackName(a).localeCompare(fallbackName(b))
    return cmp * sign
  })
}

// ───────── CSV 匯出（BOM，Excel 正確讀中文）─────────
function esc(v: string | number): string {
  const s = String(v ?? '')
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map(esc).join(',')).join('\r\n')
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ───────── 內建範本（首次寫入本地集合）─────────
export const BUILTIN_TEMPLATES: Omit<CommTemplate, 'id' | 'createdAt'>[] = [
  {
    title: '學習進度（正面）',
    category: 'academic',
    channel: '電郵',
    body: '陳太您好，想同您分享 [學生] 喺最近嘅課堂表現有明顯進步，特別係 [科目／課題] 方面。多謝您喺家中嘅支持，我哋會繼續留意佢嘅學習。',
    builtIn: true,
  },
  {
    title: '學業需關注',
    category: 'academic',
    channel: '電話',
    body: '想同您反映 [學生] 最近喺 [科目] 嘅功課 / 測驗表現有啲落後，想了解吓家中嘅學習情況，睇吓可以點樣一齊幫到佢。',
    builtIn: true,
  },
  {
    title: '缺席跟進',
    category: 'attendance',
    channel: '電話',
    body: '[學生] 喺 [日期] 缺席咗，想確認吓佢嘅情況，以及需唔需要安排補課 / 補交功課。',
    builtIn: true,
  },
  {
    title: '行為提醒',
    category: 'behaviour',
    channel: '面談',
    body: '想同您傾吓 [學生] 喺校內 [情況] 嘅行為，希望可以一齊商量適合嘅跟進方法。',
    builtIn: true,
  },
  {
    title: '表揚通知',
    category: 'praise',
    channel: '手冊',
    body: '恭喜 [學生] 喺 [活動／表現] 取得好成績 / 表現出色，特此通知並表揚。多謝家長一直以來嘅支持！',
    builtIn: true,
  },
]
