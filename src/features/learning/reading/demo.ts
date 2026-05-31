import { uid } from '../../../lib/store'
import { booksCol, type Book } from './types'
import { addDays, toKey, todayKey } from './util'

// ============================================================
//  閱讀庫：示範資料 seeder
//  ------------------------------------------------------------
//  畀新用戶／示範場景一鍵填入真實感、連貫嘅樣本（一個有上進心、
//  生活忙碌嘅人嘅書架）。只喺 collection 係空先種（idempotent）。
//  日期一律用本地 helper（todayKey / addDays / toKey），分佈喺
//  最近 1–4 週，唔會撞晒同一日，亦唔會落未來。
// ============================================================

/** N 日前嘅本地 key（N 為正整數） */
function daysAgo(n: number): string {
  return toKey(addDays(new Date(), -n))
}

/** 砌一個閱讀時段 */
function session(date: string, pages: number, minutes?: number) {
  return { id: uid(), date, pages, minutes }
}

/**
 * 種閱讀示範資料。
 * 只負責 booksCol（reading_books_v2）。已有資料就跳過，回傳新加 row 數。
 */
export function seedDemo(): number {
  let added = 0

  if (booksCol.get().length === 0) {
    const now = new Date().toISOString()

    const books: Array<Omit<Book, 'id'>> = [
      // ───── 已讀完（有評分 + 心得）─────
      {
        title: '原子習慣',
        author: 'James Clear',
        status: 'done',
        rating: 5,
        review: '今年到目前為止最實用嘅一本。「系統大過目標」呢個概念直接改咗我嘅晨間流程，已經連續記咗三星期閱讀。',
        format: 'paper',
        shelves: ['自我提升', '習慣養成', '今年最愛'],
        totalPages: 320,
        currentPage: 320,
        favorite: true,
        startedOn: daysAgo(26),
        finishedOn: daysAgo(18),
        sessions: [
          session(daysAgo(26), 48, 50),
          session(daysAgo(24), 60, 55),
          session(daysAgo(22), 72, 65),
          session(daysAgo(20), 64, 60),
          session(daysAgo(18), 76, 70),
        ],
        createdAt: now,
      },
      {
        title: '深度工作力',
        author: 'Cal Newport',
        status: 'done',
        rating: 4.5,
        review: '對抗分心嘅好書。已經試緊每朝開頭兩個鐘關通知做深度工作，產出明顯多咗。後半段有少少重複。',
        format: 'ebook',
        shelves: ['生產力', '職涯'],
        totalPages: 296,
        currentPage: 296,
        favorite: false,
        startedOn: daysAgo(16),
        finishedOn: daysAgo(9),
        sessions: [
          session(daysAgo(16), 55, 45),
          session(daysAgo(14), 70, 60),
          session(daysAgo(12), 80, 70),
          session(daysAgo(9), 91, 75),
        ],
        createdAt: now,
      },

      // ───── 在讀（有進度 + 近期時段）─────
      {
        title: '思考，快與慢',
        author: 'Daniel Kahneman',
        status: 'reading',
        format: 'paper',
        shelves: ['心理學', '行為經濟'],
        totalPages: 512,
        currentPage: 248,
        favorite: false,
        startedOn: daysAgo(11),
        sessions: [
          session(daysAgo(11), 42, 40),
          session(daysAgo(8), 55, 50),
          session(daysAgo(5), 60, 55),
          session(daysAgo(2), 50, 45),
          session(todayKey(), 41, 35),
        ],
        notes: '系統一 vs 系統二嘅例子好精彩，記低咗幾個認知偏誤想之後喺教學用。',
        createdAt: now,
      },
      {
        title: '人類大歷史',
        author: 'Yuval Noah Harari',
        status: 'reading',
        format: 'audio',
        shelves: ['歷史', '通識'],
        totalPages: 464,
        currentPage: 96,
        favorite: false,
        startedOn: daysAgo(4),
        sessions: [
          session(daysAgo(4), 40, 45),
          session(daysAgo(3), 32, 40),
          session(daysAgo(1), 24, 30),
        ],
        notes: '通勤聽有聲書版，認知革命嗰章好有啟發。',
        createdAt: now,
      },

      // ───── 想讀（書架清單）─────
      {
        title: '快速致富',
        author: 'MJ DeMarco',
        status: 'to_read',
        format: 'paper',
        shelves: ['理財', '創業'],
        totalPages: 336,
        favorite: false,
        sessions: [],
        notes: '朋友大力推薦，等手上嗰兩本讀完先開。',
        createdAt: now,
      },
      {
        title: '被討厭的勇氣',
        author: '岸見一郎、古賀史健',
        status: 'to_read',
        format: 'ebook',
        shelves: ['心理學', '自我提升'],
        totalPages: 304,
        favorite: false,
        sessions: [],
        createdAt: now,
      },
      {
        title: '原則',
        author: 'Ray Dalio',
        status: 'to_read',
        format: 'paper',
        shelves: ['理財', '職涯', '決策'],
        totalPages: 592,
        favorite: false,
        sessions: [],
        notes: '想用嚟整理自己嘅一套做事原則。',
        createdAt: now,
      },
    ]

    for (const b of books) {
      booksCol.add(b)
      added += 1
    }
  }

  return added
}
