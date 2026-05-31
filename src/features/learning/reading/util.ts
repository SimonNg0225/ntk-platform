import type { Book, BookFormat, BookStatus, ReadingSession } from './types'
import { FORMAT_LABEL } from './types'

// ============================================================
//  閱讀庫工具：日期 key、統計彙總、CSV/JSON 匯出入
// ============================================================

export const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'] as const
export const MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'] as const

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

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12)
}

export function todayKey(): string {
  return toKey(new Date())
}

export function thisYear(): number {
  return new Date().getFullYear()
}

/** 兩個 YYYY-MM-DD 相差幾多日（含頭尾，至少 1） */
export function daysBetween(a?: string, b?: string): number | undefined {
  if (!a || !b) return undefined
  const ms = fromKey(b).getTime() - fromKey(a).getTime()
  return Math.max(1, Math.round(ms / 86400000) + 1)
}

export function relativeLabel(key?: string): string {
  if (!key) return ''
  const diff = Math.round((fromKey(key).getTime() - fromKey(todayKey()).getTime()) / 86400000)
  if (diff === 0) return '今日'
  if (diff === 1) return '聽日'
  if (diff === -1) return '尋日'
  if (diff < 0) return `${-diff} 日前`
  return `${diff} 日後`
}

export function progressPct(book: Book): number {
  if (book.status === 'done') return 100
  if (!book.totalPages || book.totalPages <= 0) return 0
  // 未讀完用 floor：99.5%（如 199/200）唔應 round 成 100%，否則同真·讀完冇得分。
  return Math.min(100, Math.floor(((book.currentPage ?? 0) / book.totalPages) * 100))
}

export function totalPagesRead(book: Book): number {
  // 讀完：當作整本；否則用 session 累計或 currentPage（取大者）
  if (book.status === 'done' && book.totalPages) return book.totalPages
  const fromSessions = book.sessions.reduce((s, x) => s + x.pages, 0)
  return Math.max(fromSessions, book.currentPage ?? 0)
}

// ───────── 統計彙總 ─────────
export interface Stats {
  total: number
  byStatus: Record<BookStatus, number>
  byFormat: { format: BookFormat; count: number }[]
  rated: number
  avgRating: number
  totalPagesAll: number
  totalMinutes: number
  ratingDist: number[] // index 1..5 → 本數（半星向上歸到整星嘅 bucket 顯示）
  topShelves: { name: string; count: number }[]
  longestStreak: number
  currentStreak: number
}

export function computeStats(books: Book[]): Stats {
  const byStatus: Record<BookStatus, number> = {
    to_read: 0,
    reading: 0,
    done: 0,
    dnf: 0,
  }
  const formatCount = new Map<BookFormat, number>()
  const shelfCount = new Map<string, number>()
  const ratingDist = [0, 0, 0, 0, 0, 0] // 0 未用，1..5
  let rated = 0
  let ratingSum = 0
  let totalPagesAll = 0
  let totalMinutes = 0

  for (const b of books) {
    byStatus[b.status] += 1
    if (b.format) formatCount.set(b.format, (formatCount.get(b.format) ?? 0) + 1)
    for (const s of b.shelves) shelfCount.set(s, (shelfCount.get(s) ?? 0) + 1)
    if (b.rating && b.rating > 0) {
      rated += 1
      ratingSum += b.rating
      const bucket = Math.max(1, Math.min(5, Math.round(b.rating)))
      ratingDist[bucket] += 1
    }
    totalPagesAll += totalPagesRead(b)
    totalMinutes += b.sessions.reduce((s, x) => s + (x.minutes ?? 0), 0)
  }

  const byFormat = (Object.keys(FORMAT_LABEL) as BookFormat[]).map((format) => ({
    format,
    count: formatCount.get(format) ?? 0,
  }))

  const topShelves = [...shelfCount.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)

  const { longestStreak, currentStreak } = computeStreaks(books)

  return {
    total: books.length,
    byStatus,
    byFormat,
    rated,
    avgRating: rated ? ratingSum / rated : 0,
    totalPagesAll,
    totalMinutes,
    ratingDist,
    topShelves,
    longestStreak,
    currentStreak,
  }
}

/** 連續閱讀日（有任何 session 即當日有讀） */
export function computeStreaks(books: Book[]): {
  longestStreak: number
  currentStreak: number
} {
  const days = new Set<string>()
  for (const b of books) for (const s of b.sessions) days.add(s.date)
  if (days.size === 0) return { longestStreak: 0, currentStreak: 0 }

  const sorted = [...days].sort()
  let longest = 1
  let run = 1
  for (let i = 1; i < sorted.length; i++) {
    const prev = fromKey(sorted[i - 1])
    const cur = fromKey(sorted[i])
    const gap = Math.round((cur.getTime() - prev.getTime()) / 86400000)
    if (gap === 1) {
      run += 1
      longest = Math.max(longest, run)
    } else {
      run = 1
    }
  }

  // 目前連續：由今日（或尋日）往回數
  let current = 0
  let cursor = todayKey()
  if (!days.has(cursor)) {
    const y = toKey(addDays(new Date(), -1))
    if (days.has(y)) cursor = y
    else return { longestStreak: longest, currentStreak: 0 }
  }
  while (days.has(cursor)) {
    current += 1
    cursor = toKey(addDays(fromKey(cursor), -1))
  }
  return { longestStreak: longest, currentStreak: current }
}

// ───────── 每月讀完本數（過去 12 個月）─────────
export interface MonthBucket {
  label: string
  key: string // YYYY-MM
  books: number
  pages: number
}

export function monthlyFinished(books: Book[], months = 12): MonthBucket[] {
  const now = new Date()
  const buckets: MonthBucket[] = []
  const index = new Map<string, MonthBucket>()
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const b: MonthBucket = { label: MONTHS[d.getMonth()], key, books: 0, pages: 0 }
    buckets.push(b)
    index.set(key, b)
  }
  for (const book of books) {
    if (book.status !== 'done') continue
    const key = finishedMonthKey(book) // YYYY-MM（本地 key，無 UTC 漂移）
    const bucket = index.get(key)
    if (bucket) {
      bucket.books += 1
      bucket.pages += totalPagesRead(book)
    }
  }
  return buckets
}

/**
 * 一本書「讀完」嘅本地年月 key（YYYY-MM）。
 * finishedOn 已是本地 key；createdAt 係 ISO(UTC)，要先轉本地 key，
 * 否則 HK 凌晨建立嘅書 UTC 會跌去前一日 → 落錯月份（甚至跌出今年）。
 */
function finishedKey(book: Book): string {
  return book.finishedOn ?? toKey(new Date(book.createdAt))
}

function finishedMonthKey(book: Book): string {
  return finishedKey(book).slice(0, 7)
}

/**
 * 指定年份「讀完」嘅本數（年度閱讀挑戰用）。
 * 只計 status='done'，按 finishedOn 本地年份歸類；缺 finishedOn 用 createdAt 本地年份。
 * 不受 monthlyFinished 嘅 12 個月窗口限制 → 任何時候統計都準。
 */
export function finishedInYear(books: Book[], year: number): number {
  const prefix = `${year}-`
  let n = 0
  for (const book of books) {
    if (book.status !== 'done') continue
    if (finishedKey(book).startsWith(prefix)) n += 1
  }
  return n
}

/** 今年讀完本數（thisYear() 即時年份）。 */
export function finishedThisYear(books: Book[]): number {
  return finishedInYear(books, thisYear())
}

// ───────── 活動熱圖（過去 N 週，每日 session 頁數）─────────
export interface HeatCell {
  key: string
  pages: number
  sessions: number
}

export function activityHeatmap(books: Book[], weeks = 18): HeatCell[][] {
  const perDay = new Map<string, { pages: number; sessions: number }>()
  for (const b of books) {
    for (const s of b.sessions) {
      const cur = perDay.get(s.date) ?? { pages: 0, sessions: 0 }
      cur.pages += s.pages
      cur.sessions += 1
      perDay.set(s.date, cur)
    }
  }
  // 由本週日往前推 weeks 週
  const today = new Date()
  const endSun = addDays(today, 6 - today.getDay())
  const start = addDays(endSun, -(weeks * 7 - 1))
  const cols: HeatCell[][] = []
  for (let w = 0; w < weeks; w++) {
    const col: HeatCell[] = []
    for (let d = 0; d < 7; d++) {
      const key = toKey(addDays(start, w * 7 + d))
      const hit = perDay.get(key)
      col.push({ key, pages: hit?.pages ?? 0, sessions: hit?.sessions ?? 0 })
    }
    cols.push(col)
  }
  return cols
}

// ───────── 匯出 / 匯入 ─────────
export function exportJson(books: Book[]): string {
  return JSON.stringify(books, null, 2)
}

export function download(filename: string, text: string, type = 'application/json') {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** 寬鬆解析匯入的 JSON，補齊缺欄位（容忍舊格式 / 部分欄位） */
export function parseImport(raw: string): Book[] | null {
  try {
    const data = JSON.parse(raw)
    if (!Array.isArray(data)) return null
    return data.map((d: Record<string, unknown>): Book => {
      const sessions: ReadingSession[] = Array.isArray(d.sessions)
        ? (d.sessions as Record<string, unknown>[]).map((s) => ({
            id: typeof s.id === 'string' ? s.id : `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            date: typeof s.date === 'string' ? s.date : todayKey(),
            pages: Number(s.pages) || 0,
            minutes: s.minutes != null ? Number(s.minutes) : undefined,
          }))
        : []
      const status = (['to_read', 'reading', 'done', 'dnf'] as BookStatus[]).includes(
        d.status as BookStatus,
      )
        ? (d.status as BookStatus)
        : 'to_read'
      return {
        id: typeof d.id === 'string' ? d.id : `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title: typeof d.title === 'string' && d.title ? d.title : '未命名',
        author: typeof d.author === 'string' ? d.author : undefined,
        url: typeof d.url === 'string' ? d.url : undefined,
        cover: typeof d.cover === 'string' ? d.cover : undefined,
        status,
        rating: d.rating != null ? Number(d.rating) : undefined,
        review: typeof d.review === 'string' ? d.review : undefined,
        notes: typeof d.notes === 'string' ? d.notes : undefined,
        format: (['paper', 'ebook', 'audio'] as BookFormat[]).includes(d.format as BookFormat)
          ? (d.format as BookFormat)
          : undefined,
        shelves: Array.isArray(d.shelves) ? (d.shelves as unknown[]).map(String) : [],
        totalPages: d.totalPages != null ? Number(d.totalPages) : undefined,
        currentPage: d.currentPage != null ? Number(d.currentPage) : undefined,
        sessions,
        startedOn: typeof d.startedOn === 'string' ? d.startedOn : undefined,
        finishedOn: typeof d.finishedOn === 'string' ? d.finishedOn : undefined,
        favorite: d.favorite === true,
        createdAt: typeof d.createdAt === 'string' ? d.createdAt : new Date().toISOString(),
      }
    })
  } catch {
    return null
  }
}
