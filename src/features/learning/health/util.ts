import type { HealthLog, HealthGoals, MetricKey } from './types'

// ============================================================
//  健康統計引擎（純函式；本地時區 key，避開 toISOString UTC 漂移）
//  全部聚合對「無資料」「除零」「空窗」有守衞，唔會回 NaN / Infinity。
// ============================================================

export const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'] as const

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

/** 由 anchor 起回推 n 日（含 anchor 當日），由舊到新。 */
export function recentDays(n: number, anchor: Date = new Date()): string[] {
  const out: string[] = []
  for (let i = n - 1; i >= 0; i -= 1) out.push(toKey(addDays(anchor, -i)))
  return out
}

/** 每日一條：date → log（後者覆寫，防重複日期） */
export function byDate(logs: HealthLog[]): Map<string, HealthLog> {
  const m = new Map<string, HealthLog>()
  for (const l of logs) m.set(l.date, l)
  return m
}

/** 某日某指標值（無 → undefined） */
export function valueOn(logs: HealthLog[], date: string, key: MetricKey): number | undefined {
  const v = byDate(logs).get(date)?.[key]
  return typeof v === 'number' && !Number.isNaN(v) ? v : undefined
}

/** 該指標有效記錄（日期升序、值為有限數字），共用於趨勢 / 平均 / 最新。 */
export function entriesOf(
  logs: HealthLog[],
  key: MetricKey,
): { date: string; value: number }[] {
  return logs
    .map((l) => ({ date: l.date, value: l[key] }))
    .filter((e): e is { date: string; value: number } => typeof e.value === 'number' && Number.isFinite(e.value))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}

/** 最新一筆該指標（無 → null） */
export function latestEntry(
  logs: HealthLog[],
  key: MetricKey,
): { date: string; value: number } | null {
  const e = entriesOf(logs, key)
  return e.length ? e[e.length - 1] : null
}

/** 近 n 日逐日序列（無資料嗰日 value=null，畀圖表斷點） */
export function seriesOf(
  logs: HealthLog[],
  key: MetricKey,
  days: number,
  anchor: Date = new Date(),
): { date: string; value: number | null }[] {
  const map = byDate(logs)
  return recentDays(days, anchor).map((date) => {
    const v = map.get(date)?.[key]
    return { date, value: typeof v === 'number' && Number.isFinite(v) ? v : null }
  })
}

/** 近 n 日該指標平均（只計有記錄嘅日；全無 → null，唔回 NaN） */
export function average(
  logs: HealthLog[],
  key: MetricKey,
  days: number,
  anchor: Date = new Date(),
): number | null {
  const vals = seriesOf(logs, key, days, anchor)
    .map((p) => p.value)
    .filter((v): v is number => v !== null)
  if (vals.length === 0) return null
  return vals.reduce((s, v) => s + v, 0) / vals.length
}

/** 近 7 日運動總分鐘（缺 = 0） */
export function weeklyExercise(logs: HealthLog[], anchor: Date = new Date()): number {
  return seriesOf(logs, 'exerciseMin', 7, anchor).reduce((s, p) => s + (p.value ?? 0), 0)
}

/** 某日飲水（缺 = 0） */
export function waterOn(logs: HealthLog[], date: string): number {
  return valueOn(logs, date, 'waterMl') ?? 0
}

/**
 * 體重趨勢：最新體重 + 對比約 days 日前嘅變化（kg）。
 * 唔夠兩筆（或只得當日一筆）→ delta = null。
 */
export function weightTrend(
  logs: HealthLog[],
  days = 7,
  anchor: Date = new Date(),
): { latestKg: number; deltaKg: number | null } | null {
  const entries = entriesOf(logs, 'weightKg')
  if (entries.length === 0) return null
  const latest = entries[entries.length - 1]
  const cutoff = toKey(addDays(anchor, -days))
  // 取截止日或之前最近一筆做比較基準；冇就用最早一筆。
  let prev: { date: string; value: number } | undefined
  for (const e of entries) {
    if (e.date <= cutoff) prev = e
  }
  if (!prev) prev = entries[0]
  const deltaKg = prev.date === latest.date ? null : latest.value - prev.value
  return { latestKg: latest.value, deltaKg }
}

/**
 * 達標百分比（value / target）。target<=0 → 0；可超過 100（呼叫端決定要唔要封頂）。
 * 負值 value → 0。
 */
export function goalPct(value: number, target: number): number {
  if (!Number.isFinite(target) || target <= 0) return 0
  if (!Number.isFinite(value) || value <= 0) return 0
  return Math.round((value / target) * 100)
}

/**
 * 記錄連續日數（streak）：由今日（無記錄則由琴日）往前數，連續有「任何指標記錄」嘅日。
 * 用日曆連續日定義（最直觀）。
 */
export function loggingStreak(logs: HealthLog[], anchor: Date = new Date()): number {
  const days = new Set(byDate(logs).keys())
  const today = toKey(anchor)
  let cursor = days.has(today) ? today : addDaysKey(today, -1)
  let streak = 0
  let guard = 0
  while (days.has(cursor) && guard++ < 5000) {
    streak += 1
    cursor = addDaysKey(cursor, -1)
  }
  return streak
}

// ───────── CSV 匯出 ─────────
/**
 * 健康每日記錄 → CSV（UTF-8，呼叫端自行加 BOM 畀 Excel）。
 * 表頭固定 5 指標 + 備註，按 date 升序，缺值留空白；
 * 備註換行轉空格。CSV 砌法（esc 雙引號跳脫 + 每格包引號 + join）
 * 對齊 focus/store.ts logsToCsv，全 repo 同一風格。
 */
export function logsToCsv(logs: HealthLog[]): string {
  const head = ['日期', '體重(kg)', '睡眠(小時)', '運動(分鐘)', '飲水(ml)', '心情(1-5)', '備註']
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`
  // 缺值（undefined / 非有限）→ 空白；有效數字 → 原值字串。
  const num = (v: number | undefined) =>
    typeof v === 'number' && Number.isFinite(v) ? String(v) : ''
  const rows = logs
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((l) =>
      [
        l.date,
        num(l.weightKg),
        num(l.sleepHrs),
        num(l.exerciseMin),
        num(l.waterMl),
        num(l.mood),
        (l.note ?? '').replace(/\n/g, ' '),
      ]
        .map(esc)
        .join(','),
    )
  return [head.map(esc).join(','), ...rows].join('\n')
}

export interface HealthSummary {
  weightKg: number | null
  weightDelta7: number | null
  sleepAvg7: number | null
  exerciseWeek: number
  exercisePct: number
  waterToday: number
  waterPct: number
  moodAvg7: number | null
  streak: number
  loggedToday: boolean
}

/** 儀表板 / 概覽用嘅一站式快照。 */
export function summarize(
  logs: HealthLog[],
  goals: HealthGoals,
  anchor: Date = new Date(),
): HealthSummary {
  const today = toKey(anchor)
  const wt = weightTrend(logs, 7, anchor)
  const exerciseWeek = weeklyExercise(logs, anchor)
  const waterToday = waterOn(logs, today)
  return {
    weightKg: wt?.latestKg ?? null,
    weightDelta7: wt?.deltaKg ?? null,
    sleepAvg7: average(logs, 'sleepHrs', 7, anchor),
    exerciseWeek,
    exercisePct: goalPct(exerciseWeek, goals.exerciseTargetMin),
    waterToday,
    waterPct: goalPct(waterToday, goals.waterTargetMl),
    moodAvg7: average(logs, 'mood', 7, anchor),
    streak: loggingStreak(logs, anchor),
    loggedToday: byDate(logs).has(today),
  }
}
