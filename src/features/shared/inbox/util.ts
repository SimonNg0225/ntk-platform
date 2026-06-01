// ============================================================
//  Inbox 純工具：分類元資料、標籤 parse、相對時間、分組、
//  離線啟發式分類建議、統計。零副作用、零 npm 依賴。
// ============================================================

import {
  CheckSquare,
  NotebookPen,
  CalendarPlus,
  HelpCircle,
  Hourglass,
  Bookmark,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { InboxItem } from '../../../data/types'
import type { InboxKind, InboxMeta, KindDef } from './types'

// ───────── 分類元資料（順序 = triage 鍵 1..6）─────────
export const KINDS: KindDef[] = [
  { id: 'task', label: '待辦', short: '轉做待辦', feature: 'work-tasks' },
  { id: 'note', label: '筆記', short: '轉做筆記', feature: 'learning-notes' },
  { id: 'event', label: '行事曆', short: '加入行事曆', feature: 'calendar' },
  { id: 'question', label: '題目', short: '存入題庫', feature: 'work-questions' },
  { id: 'countdown', label: '倒數', short: '加入倒數', feature: 'countdown' },
  { id: 'reference', label: '參考', short: '只歸檔', feature: null },
]

export const KIND_ICON: Record<InboxKind, LucideIcon> = {
  task: CheckSquare,
  note: NotebookPen,
  event: CalendarPlus,
  question: HelpCircle,
  countdown: Hourglass,
  reference: Bookmark,
}

export type BadgeTone = 'slate' | 'accent' | 'green' | 'amber' | 'rose' | 'blue'
export const KIND_TONE: Record<InboxKind, BadgeTone> = {
  task: 'blue',
  note: 'accent',
  event: 'green',
  question: 'amber',
  countdown: 'rose',
  reference: 'slate',
}

export function kindDef(id: InboxKind): KindDef {
  return KINDS.find((k) => k.id === id) ?? KINDS[KINDS.length - 1]
}

export function kindLabel(id: InboxKind): string {
  return kindDef(id).label
}

// ───────── 標籤 parse（#tag）─────────
const TAG_RE = /#([\p{L}\p{N}_/-]{1,32})/gu

/** 由文字抽出 #標籤（去重、保留次序、轉細階）*/
export function parseTags(text: string): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const m of text.matchAll(TAG_RE)) {
    const t = m[1].toLowerCase()
    if (!seen.has(t)) {
      seen.add(t)
      out.push(t)
    }
  }
  return out
}

/** 把文字中嘅 #標籤起首符號剝走（轉做正式資料時用）*/
export function stripTags(text: string): string {
  return text.replace(TAG_RE, '$1').trim()
}

// ───────── 相對時間 ─────────
export function relativeTime(iso: string, now = Date.now()): string {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const diff = now - t
  const min = Math.floor(diff / 60000)
  if (min < 1) return '啱啱'
  if (min < 60) return `${min} 分鐘前`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} 小時前`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day} 日前`
  const wk = Math.floor(day / 7)
  if (wk < 5) return `${wk} 週前`
  const mo = Math.floor(day / 30)
  if (mo < 12) return `${mo} 個月前`
  // 用月份基準換算年（避免 day/30 與 day/365 唔一致，喺第 360–364 日
  // 出現「0 年前」嘅錯值）
  return `${Math.floor(mo / 12)} 年前`
}

export function fullTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('zh-HK', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// 本地 YYYY-MM-DD（避開 toISOString 時差）
export function dayKey(iso: string): string {
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function todayKey(now = Date.now()): string {
  return dayKey(new Date(now).toISOString())
}

/** 「今日 / 昨日 / X月X日」分組標題 */
export function dayGroupLabel(key: string, now = Date.now()): string {
  const today = todayKey(now)
  const yesterday = dayKey(new Date(now - 864e5).toISOString())
  if (key === today) return '今日'
  if (key === yesterday) return '昨日'
  const [y, m, d] = key.split('-').map(Number)
  const sameYear = y === new Date(now).getFullYear()
  return sameYear ? `${m}月${d}日` : `${y}年${m}月${d}日`
}

// ───────── 離線啟發式分類建議（唔使 AI 都有得用）─────────
interface Rule {
  kind: InboxKind
  re: RegExp
}
// 次序 = 優先（先 match 先用）
const RULES: Rule[] = [
  { kind: 'question', re: /[?？]\s*$|^(?:點解|為何|為什麼|乜嘢|什麼|如何|whether|explain|解釋|計算|證明)/i },
  { kind: 'countdown', re: /(倒數|deadline|死線|限期|考試|測驗|exam|due|到期|限\s*\d|還有.*日)/i },
  { kind: 'event', re: /(\d{1,2}\s*[:：]\s*\d{2}|\d{1,2}\s*月\s*\d{1,2}|今晚|聽日|明天|下午|上午|早上|傍晚|開會|會議|約|meeting|appointment|預約|星期[一二三四五六日])/i },
  { kind: 'task', re: /(記得|要|做|交|買|寄|聯絡|跟進|完成|批改|預備|準備|todo|follow\s*up|回覆|提交|安排|處理)/i },
  { kind: 'reference', re: /(https?:\/\/|www\.|參考|reference|連結|link|睇下|bookmark)/i },
]

/** 由文字猜分類（離線、規則式）；猜唔到回 'note' */
export function guessKind(text: string): InboxKind {
  const t = text.trim()
  for (const r of RULES) if (r.re.test(t)) return r.kind
  return 'note'
}

// ───────── 合併 item + meta（畀 UI 用）─────────
export interface InboxRow {
  item: InboxItem
  meta?: InboxMeta
  kind?: InboxKind // meta.kind ?? guessKind()
  guessed: boolean // kind 係咪靠估（meta 冇 kind）
  tags: string[] // meta.tags ?? parseTags(text)
  pinned: boolean
  archived: boolean
}

export function buildRow(item: InboxItem, meta?: InboxMeta): InboxRow {
  const explicitKind = meta?.kind
  const kind = explicitKind ?? guessKind(item.text)
  const tags = meta?.tags && meta.tags.length ? meta.tags : parseTags(item.text)
  return {
    item,
    meta,
    kind,
    guessed: !explicitKind,
    tags,
    pinned: meta?.pinned ?? false,
    archived: meta?.status === 'archived',
  }
}

// ───────── 排序：置頂優先，再按時間新→舊 ─────────
export function sortRows(a: InboxRow, b: InboxRow): number {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
  return b.item.createdAt.localeCompare(a.item.createdAt)
}

// ───────── 統計 ─────────
export interface InboxStats {
  inboxCount: number
  archivedCount: number
  pinnedCount: number
  byKind: Record<InboxKind, number> // 只計待處理
  perDay: { key: string; label: string; count: number }[] // 近 14 日擷取量
  todayCaptured: number
  weekCaptured: number
  oldestInboxIso?: string // 最舊待處理（拖延指標）
  topTags: { tag: string; count: number }[]
}

const EMPTY_BY_KIND = (): Record<InboxKind, number> => ({
  task: 0,
  note: 0,
  event: 0,
  question: 0,
  countdown: 0,
  reference: 0,
})

export function computeStats(rows: InboxRow[], now = Date.now()): InboxStats {
  const inbox = rows.filter((r) => !r.archived)
  const archived = rows.filter((r) => r.archived)
  const byKind = EMPTY_BY_KIND()
  for (const r of inbox) if (r.kind) byKind[r.kind] += 1

  // 近 14 日擷取量（用全部 rows 嘅 createdAt）
  const days: { key: string; label: string; count: number }[] = []
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now - i * 864e5)
    const key = dayKey(d.toISOString())
    days.push({ key, label: `${d.getMonth() + 1}/${d.getDate()}`, count: 0 })
  }
  const idx = new Map(days.map((d, i) => [d.key, i]))
  const today = todayKey(now)
  const weekAgo = dayKey(new Date(now - 6 * 864e5).toISOString())
  let todayCaptured = 0
  let weekCaptured = 0
  for (const r of rows) {
    const k = dayKey(r.item.createdAt)
    const i = idx.get(k)
    if (i !== undefined) days[i].count += 1
    if (k === today) todayCaptured += 1
    if (k >= weekAgo) weekCaptured += 1
  }

  // 最舊待處理
  let oldest: string | undefined
  for (const r of inbox) {
    if (!oldest || r.item.createdAt < oldest) oldest = r.item.createdAt
  }

  // 熱門標籤（待處理）
  const tagCount = new Map<string, number>()
  for (const r of inbox) {
    for (const t of r.tags) tagCount.set(t, (tagCount.get(t) ?? 0) + 1)
  }
  const topTags = [...tagCount.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    .slice(0, 8)

  return {
    inboxCount: inbox.length,
    archivedCount: archived.length,
    pinnedCount: inbox.filter((r) => r.pinned).length,
    byKind,
    perDay: days,
    todayCaptured,
    weekCaptured,
    oldestInboxIso: oldest,
    topTags,
  }
}

// ───────── 「拖延中」：久未處理嘅待處理項 ─────────
// GTD inbox 大忌係嘢掉咗入去就沉底。揾出擱置超過 N 日嘅待處理項，
// 喺頂顯示輕量提示並可一 click 揭最舊。純衍生、零 schema 改動。
export const STALE_DAYS = 7

/**
 * 篩出擱置超過 `days` 日嘅「待處理」項目（已歸檔不計），按最舊→最新排。
 * `days <= 0` 視為「全部待處理」。無效 createdAt 一律排除。
 */
export function staleInboxRows(
  rows: InboxRow[],
  days = STALE_DAYS,
  now = Date.now(),
): InboxRow[] {
  const cutoff = now - days * 864e5
  return rows
    .filter((r) => !r.archived)
    .filter((r) => {
      const t = new Date(r.item.createdAt).getTime()
      return !Number.isNaN(t) && t <= cutoff
    })
    .sort(byOldest)
}

/** 純粹按時間舊→新（最舊排頭），畀「按最舊排」用 */
export function byOldest(a: InboxRow, b: InboxRow): number {
  return a.item.createdAt.localeCompare(b.item.createdAt)
}

// ───────── 全部已用標籤（畀 filter 用）─────────
export function allTags(rows: InboxRow[]): string[] {
  const set = new Set<string>()
  for (const r of rows) for (const t of r.tags) set.add(t)
  return [...set].sort((a, b) => a.localeCompare(b))
}
