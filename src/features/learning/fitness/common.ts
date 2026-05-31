// ============================================================
//  健身中心共用基礎（本地時區日期 helper）
//  ------------------------------------------------------------
//  各健身模組（體態 / 訓練 / 飲食 / 教練 / 動作庫）統一由呢度
//  攞日期 key，確保同 health / habits 一致用「本地日」，避開
//  toISOString() 的 UTC 漂移（P8 揪過呢類 bug）。
// ============================================================

/** 本地時區 YYYY-MM-DD */
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

export function addDaysKey(key: string, n: number): string {
  return toKey(addDays(fromKey(key), n))
}

export function todayKey(anchor: Date = new Date()): string {
  return toKey(anchor)
}

/** 由 anchor 起回推 n 日（含當日），由舊到新。 */
export function recentDays(n: number, anchor: Date = new Date()): string[] {
  const out: string[] = []
  for (let i = n - 1; i >= 0; i -= 1) out.push(toKey(addDays(anchor, -i)))
  return out
}

/** 兩 key 相差日數（b - a） */
export function daysBetween(a: string, b: string): number {
  return Math.round((fromKey(b).getTime() - fromKey(a).getTime()) / 864e5)
}

export const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'] as const

/** 健身指標色調 token（配合海軍藍 + 科技感點綴） */
export const FIT_TONE = {
  navy: 'var(--accent)',
  emerald: '#10b981',
  sky: '#0ea5e9',
  amber: '#f59e0b',
  indigo: '#6366f1',
  rose: '#f43f5e',
} as const

export type FitTone = keyof typeof FIT_TONE
