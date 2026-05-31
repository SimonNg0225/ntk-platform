import { createCollection } from '../../../lib/store'
import type { Entity } from '../../../lib/store'

// ============================================================
//  閱讀庫資料模型（Goodreads / StoryGraph 級）
//  ------------------------------------------------------------
//  刻意自成一格（唔掂 data/types.ts）：新增評分、頁數、進度、
//  書架標籤、閱讀時段（用嚟砌活動熱圖同統計圖表）。
//  舊 reading_items 嘅資料會喺 ReadingList 首次載入時自動遷移入嚟。
// ============================================================

export type BookStatus = 'to_read' | 'reading' | 'done' | 'dnf'

export interface ReadingSession {
  id: string
  date: string // YYYY-MM-DD
  pages: number // 當次讀咗幾多頁
  minutes?: number // 當次用時（分鐘，選填）
}

export interface Book extends Entity {
  title: string
  author?: string
  url?: string
  cover?: string // 封面圖 URL（選填）
  status: BookStatus
  rating?: number // 0–5（半星：0.5 步進）
  review?: string // 心得 / 評語
  notes?: string // 私人筆記
  format?: BookFormat
  shelves: string[] // 自訂書架 / 分類標籤
  totalPages?: number
  currentPage?: number // 進度（status = reading 時用）
  sessions: ReadingSession[] // 閱讀時段記錄
  startedOn?: string // YYYY-MM-DD（開始閱讀）
  finishedOn?: string // YYYY-MM-DD（讀完）
  favorite?: boolean
  createdAt: string
}

export type BookFormat = 'paper' | 'ebook' | 'audio'

export const FORMAT_LABEL: Record<BookFormat, string> = {
  paper: '實體書',
  ebook: '電子書',
  audio: '有聲書',
}

export const STATUS_LABEL: Record<BookStatus, string> = {
  to_read: '想讀',
  reading: '在讀',
  done: '讀完',
  dnf: '棄讀',
}

export const STATUS_ORDER: BookStatus[] = ['to_read', 'reading', 'done', 'dnf']

// Badge tone 對應（只用 UI kit 容許嘅 tone）
export const STATUS_TONE: Record<BookStatus, 'slate' | 'accent' | 'green' | 'amber'> = {
  to_read: 'slate',
  reading: 'accent',
  done: 'green',
  dnf: 'amber',
}

// 自家持久化集合（key 在 newCollections 申報）
export const booksCol = createCollection<Book>('reading_books_v2', [])

// 閱讀挑戰目標（每年讀幾多本）
export interface ChallengeConfig extends Entity {
  year: number
  target: number
}
export const challengeCol = createCollection<ChallengeConfig>('reading_challenge', [])
