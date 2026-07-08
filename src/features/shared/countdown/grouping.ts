// ============================================================
//  Countdown 純工具：將「即將到來」的倒數按曆法時間分段
//  （本週內 / 本月內 / 更遠），以及分類篩選。
//  全部基於 YYYY-MM-DD key + 本地時區語意，零副作用、零 npm 依賴。
//  時間語意刻意同 Countdown.tsx 的 fromKey/daysUntil 一致
//  （本地正午錨點，避 toISOString 的 UTC 漂移同 DST 邊界）。
// ============================================================

import { fromKey } from '../Countdown'
import type { Countdown, CountdownCategory } from '../../../data/types'

/** 時間分段：本週內 / 本月內 / 更遠。只覆蓋「未過去」的倒數。 */
export type TimeBucket = 'week' | 'month' | 'far'

/**
 * 將目標日子（已知未過去）歸入時間段。曆法語意：
 *  - week：今日起、直到「本曆週」的星期日（含）為止
 *  - month：不屬本週、但仍在「本曆月」內（同年同月）
 *  - far：本月之後
 * today / target 都用 YYYY-MM-DD（本地時區）。畸形 key 一律當 'far'
 * （不丟錯、不影響上層排序）。
 */
export function timeBucket(dateKey: string, todayKey: string): TimeBucket {
  const today = fromKey(todayKey)
  const target = fromKey(dateKey)
  if (Number.isNaN(today.getTime()) || Number.isNaN(target.getTime())) return 'far'

  // 本曆週尾（星期日，香港慣用週一頭、週日尾）：getDay() 0=日…6=六；
  // 由今日去到本週日的日數 = (7 - getDay()) % 7（今日已係星期日時 = 0）。
  const endOfWeek = new Date(today)
  endOfWeek.setDate(today.getDate() + ((7 - today.getDay()) % 7))
  if (target.getTime() <= endOfWeek.getTime()) return 'week'

  // 本曆月內（同年同月）。
  if (
    target.getFullYear() === today.getFullYear() &&
    target.getMonth() === today.getMonth()
  ) {
    return 'month'
  }

  return 'far'
}

/** 分段顯示用元資料（次序 = 由近到遠）。 */
export const BUCKET_META: { id: TimeBucket; label: string; hint: string }[] = [
  { id: 'week', label: '本週內', hint: '今個星期就到，要留意' },
  { id: 'month', label: '本月內', hint: '今個月之內，開始預備' },
  { id: 'far', label: '更遠', hint: '時間還充裕' },
]

/** 一段分組結果：段 id + 該段倒數（已沿用中原有次序）。 */
export interface BucketGroup<T> {
  bucket: TimeBucket
  label: string
  hint: string
  items: T[]
}

/**
 * 將一批（已篩選、已排序的）即將到來倒數分入三段，保留中原有次序。
 * 只回有內容的段，方便 UI 直接 map（無嘢的段不出標題）。
 */
export function groupByTime<T extends { date: string }>(
  upcoming: T[],
  todayKey: string,
): BucketGroup<T>[] {
  const buckets: Record<TimeBucket, T[]> = { week: [], month: [], far: [] }
  for (const item of upcoming) {
    buckets[timeBucket(item.date, todayKey)].push(item)
  }
  return BUCKET_META.filter((m) => buckets[m.id].length > 0).map((m) => ({
    bucket: m.id,
    label: m.label,
    hint: m.hint,
    items: buckets[m.id],
  }))
}

/** 分類篩選值：實際分類，或 'all'（不篩）。 */
export type CategoryFilter = CountdownCategory | 'all'

/**
 * 按分類篩選。'all' 原樣回傳（不 copy，留給上層 memo 控制）。
 * 選擇了某分類時：只留 category 等於該值的項（無 category 的項不會中）。
 */
export function filterByCategory<T extends Pick<Countdown, 'category'>>(
  items: T[],
  filter: CategoryFilter,
): T[] {
  if (filter === 'all') return items
  return items.filter((c) => c.category === filter)
}

/**
 * 統計每個分類的項數（給 pill 顯示用），連 'all' 總數。
 * 只數有出現的分類；無分類的項只計入 all。
 */
export function categoryCounts<T extends Pick<Countdown, 'category'>>(
  items: T[],
): Record<CategoryFilter, number> {
  const counts: Record<CategoryFilter, number> = {
    all: items.length,
    exam: 0,
    deadline: 0,
    assessment: 0,
    event: 0,
    other: 0,
  }
  for (const c of items) {
    if (c.category) counts[c.category] += 1
  }
  return counts
}
