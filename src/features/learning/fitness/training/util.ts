import { recentDays, daysBetween } from '../common'
import type { Workout, WorkoutSet, Exercise } from './types'

// ============================================================
//  訓練記錄 — 純函式（全部可單元測試，唔掂 React / DOM）
//  ------------------------------------------------------------
//  設計守則：
//   - 空陣列 / 0 / 負值 / 缺 rpe 都有守衞，永不 NaN / Infinity。
//   - 重量 / 次數一律 clamp 落 >= 0（防手動亂填負數污染統計）。
//   - 日期一律用本地 key（由 common 攞），唔用 toISOString。
// ============================================================

/** 安全數值：NaN / 非有限 → 0；可選 clamp 最小值。 */
function num(v: unknown, min = -Infinity): number {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return Number.isFinite(min) ? Math.max(0, min) : 0
  return min === -Infinity ? n : Math.max(min, n)
}

/** 單組 volume = reps × weightKg（負值當 0）。 */
export function setVolume(set: WorkoutSet): number {
  if (!set) return 0
  return num(set.reps, 0) * num(set.weightKg, 0)
}

/** 一個動作所有 set 嘅總 volume。 */
export function exerciseVolume(ex: Exercise): number {
  if (!ex || !Array.isArray(ex.sets)) return 0
  return ex.sets.reduce((s, set) => s + setVolume(set), 0)
}

/** 一次訓練嘅總 volume（所有動作所有 set）。 */
export function workoutVolume(w: Workout): number {
  if (!w || !Array.isArray(w.exercises)) return 0
  return w.exercises.reduce((s, ex) => s + exerciseVolume(ex), 0)
}

/** 一次訓練嘅總 set 數。 */
export function workoutSetCount(w: Workout): number {
  if (!w || !Array.isArray(w.exercises)) return 0
  return w.exercises.reduce(
    (s, ex) => s + (Array.isArray(ex.sets) ? ex.sets.length : 0),
    0,
  )
}

/**
 * Epley 估算 1RM：weight × (1 + reps/30)。
 * reps = 1 → 即等於 weight；reps <= 0 或 weight <= 0 → 0。
 */
export function est1RM(weightKg: number, reps: number): number {
  const w = num(weightKg, 0)
  const r = num(reps, 0)
  if (w <= 0 || r <= 0) return 0
  return w * (1 + r / 30)
}

/**
 * 由 anchor 起回推 n 日（含當日）嘅每日 volume，由舊到新。
 * 回 { key, volume }[]，長度恒為 n。
 */
export function dailyVolume(
  workouts: Workout[],
  days: number,
  anchor: Date = new Date(),
): { key: string; volume: number }[] {
  const n = Math.max(0, Math.floor(days))
  const keys = recentDays(n, anchor)
  const list = Array.isArray(workouts) ? workouts : []
  return keys.map((key) => ({
    key,
    volume: list
      .filter((w) => w && w.date === key)
      .reduce((s, w) => s + workoutVolume(w), 0),
  }))
}

/**
 * 由 anchor 起回推 n 日（含當日）嘅每日 volume + 平均 RPE，由舊到新。
 * 一次過 group-by-date 計，避免逐日重掃全部 workouts。
 * 回 { key, volume, avgRpe }[]，長度恒為 n。
 * （每日 avgRpe 等同 avgRpe(workouts, 1, fromKey(key))，行為一致。）
 */
export function dailyVolumeRpe(
  workouts: Workout[],
  days: number,
  anchor: Date = new Date(),
): { key: string; volume: number; avgRpe: number }[] {
  const n = Math.max(0, Math.floor(days))
  const keys = recentDays(n, anchor)
  const list = Array.isArray(workouts) ? workouts : []
  // 按日期分組，避免每個 key 各自 filter 全表。
  const byDate = new Map<string, Workout[]>()
  for (const w of list) {
    if (!w) continue
    const bucket = byDate.get(w.date)
    if (bucket) bucket.push(w)
    else byDate.set(w.date, [w])
  }
  return keys.map((key) => {
    const sameDay = byDate.get(key) ?? []
    return {
      key,
      volume: sameDay.reduce((s, w) => s + workoutVolume(w), 0),
      avgRpe: avgRpeOf(sameDay),
    }
  })
}

/**
 * 由 anchor 起回推 weeks 個「7 日週」嘅每週 volume + 平均 RPE，由舊到新。
 * 每週 = [anchor-7k-6 .. anchor-7k]。回 { label, volume, avgRpe, sessions }[]。
 */
export function weeklyTrend(
  workouts: Workout[],
  weeks: number,
  anchor: Date = new Date(),
): { label: string; volume: number; avgRpe: number; sessions: number }[] {
  const n = Math.max(0, Math.floor(weeks))
  const list = Array.isArray(workouts) ? workouts : []
  const out: {
    label: string
    volume: number
    avgRpe: number
    sessions: number
  }[] = []
  // 由最舊（n-1 週前）到最新（本週）
  for (let i = n - 1; i >= 0; i -= 1) {
    const end = new Date(
      anchor.getFullYear(),
      anchor.getMonth(),
      anchor.getDate() - i * 7,
      12,
    )
    const startKey = toLocalKey(addLocalDays(end, -6))
    const endKey = toLocalKey(end)
    const inWeek = list.filter(
      (w) => w && w.date >= startKey && w.date <= endKey,
    )
    out.push({
      label: i === 0 ? '本週' : `${i}週前`,
      volume: inWeek.reduce((s, w) => s + workoutVolume(w), 0),
      avgRpe: avgRpeOf(inWeek),
      sessions: inWeek.length,
    })
  }
  return out
}

/**
 * 本週（anchor 當日及之前 6 日，共 7 日）總 volume。
 */
export function weeklyVolume(
  workouts: Workout[],
  anchor: Date = new Date(),
): number {
  return dailyVolume(workouts, 7, anchor).reduce((s, d) => s + d.volume, 0)
}

/**
 * 本週 session 數（anchor 當日及之前 6 日內有記錄嘅 workout 筆數）。
 */
export function weeklySessions(
  workouts: Workout[],
  anchor: Date = new Date(),
): number {
  const list = Array.isArray(workouts) ? workouts : []
  const keys = new Set(recentDays(7, anchor))
  return list.filter((w) => w && keys.has(w.date)).length
}

/**
 * 近 `days` 日（含當日）所有有填 RPE 嘅 set 嘅平均值（四捨五入到 0.1）。
 * 完全冇 RPE → 0。
 */
export function avgRpe(
  workouts: Workout[],
  days: number,
  anchor: Date = new Date(),
): number {
  const n = Math.max(0, Math.floor(days))
  const list = Array.isArray(workouts) ? workouts : []
  const keys = new Set(recentDays(n, anchor))
  const within = list.filter((w) => w && keys.has(w.date))
  return avgRpeOf(within)
}

/** 內部：一批 workouts 所有有填 RPE 嘅 set 平均（四捨五入 0.1）。 */
function avgRpeOf(workouts: Workout[]): number {
  let sum = 0
  let count = 0
  for (const w of workouts) {
    if (!w || !Array.isArray(w.exercises)) continue
    for (const ex of w.exercises) {
      if (!Array.isArray(ex.sets)) continue
      for (const set of ex.sets) {
        if (typeof set?.rpe === 'number' && Number.isFinite(set.rpe)) {
          sum += set.rpe
          count += 1
        }
      }
    }
  }
  if (count === 0) return 0
  return Math.round((sum / count) * 10) / 10
}

export interface ExercisePR {
  maxWeight: number
  best1RM: number
}

/**
 * 每個動作（按 name）嘅 PR：最大單組 weightKg + 最佳估算 1RM。
 * 名以 trim 後做 key（空名跳過）。回 Map<name, {maxWeight, best1RM}>。
 */
export function prByExercise(workouts: Workout[]): Map<string, ExercisePR> {
  const map = new Map<string, ExercisePR>()
  const list = Array.isArray(workouts) ? workouts : []
  for (const w of list) {
    if (!w || !Array.isArray(w.exercises)) continue
    for (const ex of w.exercises) {
      const name = (ex?.name ?? '').trim()
      if (!name || !Array.isArray(ex.sets)) continue
      const prev = map.get(name) ?? { maxWeight: 0, best1RM: 0 }
      let { maxWeight, best1RM } = prev
      for (const set of ex.sets) {
        const wt = num(set?.weightKg, 0)
        if (wt > maxWeight) maxWeight = wt
        const e1 = est1RM(set?.weightKg, set?.reps)
        if (e1 > best1RM) best1RM = e1
      }
      map.set(name, { maxWeight, best1RM })
    }
  }
  return map
}

/** 一次訓練嘅最高單組 RPE（用嚟標疲勞，缺則 null）。 */
export function maxRpe(w: Workout): number | null {
  if (!w || !Array.isArray(w.exercises)) return null
  let max: number | null = null
  for (const ex of w.exercises) {
    if (!Array.isArray(ex.sets)) continue
    for (const set of ex.sets) {
      if (typeof set?.rpe === 'number' && Number.isFinite(set.rpe)) {
        max = max === null ? set.rpe : Math.max(max, set.rpe)
      }
    }
  }
  return max
}

/** 按日期倒序（新→舊）排序，tie 用 createdAt 倒序。唔改原陣列。 */
export function sortWorkoutsDesc(workouts: Workout[]): Workout[] {
  const list = Array.isArray(workouts) ? [...workouts] : []
  return list.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1
    const ca = a.createdAt ?? ''
    const cb = b.createdAt ?? ''
    return ca < cb ? 1 : ca > cb ? -1 : 0
  })
}

/**
 * 訓練量趨勢方向：比較最新一週 vs 前一週 volume。
 * 資料不足（少於兩週有量）→ 'flat'。
 */
export function volumeTrend(
  workouts: Workout[],
  anchor: Date = new Date(),
): { dir: 'up' | 'down' | 'flat'; pct: number } {
  const weeks = weeklyTrend(workouts, 2, anchor)
  if (weeks.length < 2) return { dir: 'flat', pct: 0 }
  const prev = weeks[0].volume
  const cur = weeks[1].volume
  if (prev <= 0) return { dir: cur > 0 ? 'up' : 'flat', pct: 0 }
  const pct = Math.round(((cur - prev) / prev) * 100)
  if (pct > 0) return { dir: 'up', pct }
  if (pct < 0) return { dir: 'down', pct }
  return { dir: 'flat', pct: 0 }
}

/** 距上次訓練幾多日（用最新一筆 workout.date vs anchor）；無記錄 → null。 */
export function daysSinceLastWorkout(
  workouts: Workout[],
  anchor: Date = new Date(),
): number | null {
  const sorted = sortWorkoutsDesc(workouts)
  if (sorted.length === 0) return null
  const anchorKey = toLocalKey(anchor)
  const diff = daysBetween(sorted[0].date, anchorKey)
  return diff < 0 ? 0 : diff
}

/**
 * 由全部訓練紀錄搵某動作（按 trim 後同名）最近一次嘅最後一組 set。
 * 用嚟記錄新一組時預填 reps / weightKg（加快輸入）。
 * 「最近」= date 最新；同日 tie 用 createdAt 最新；同筆內取 sets 最後一組。
 * 搵唔到（無同名 / 嗰次無 set）→ null。rpe 故意唔帶（每組自覺費力唔同）。
 */
export function lastSetOf(
  workouts: Workout[],
  name: string,
): { reps: number; weightKg: number } | null {
  const target = (name ?? '').trim()
  if (target === '') return null
  const sorted = sortWorkoutsDesc(workouts)
  for (const w of sorted) {
    if (!w || !Array.isArray(w.exercises)) continue
    for (const ex of w.exercises) {
      if ((ex?.name ?? '').trim() !== target) continue
      if (!Array.isArray(ex.sets) || ex.sets.length === 0) continue
      const last = ex.sets[ex.sets.length - 1]
      return { reps: num(last?.reps, 0), weightKg: num(last?.weightKg, 0) }
    }
  }
  return null
}

/**
 * 槓片計算器：目標總重 targetKg、空槓 barKg、每邊可用槓片（kg，預設標準片）。
 * 回每邊要上嘅槓片組合（由重到輕）+ 實際可達總重 + 差額（湊唔齊嘅餘數）。
 * 守則：
 *  - targetKg <= barKg（含等於 / 低過槓重）→ plates 空、差額即 target-bar（負或 0）。
 *  - 每邊重量 = (target - bar) / 2；用貪心由大到細擺片。
 *  - 「奇數 / 唔夠片」→ remainderKg > 0（湊唔到部分），achievableKg 為實際可達。
 *  - 全程守 NaN / 負 → 0；available 會過濾非正值並由大到細排。
 */
export interface PlatePlan {
  /** 每邊由重到輕嘅槓片（kg）。total = bar + 2×Σ。 */
  perSide: number[]
  /** 實際可達總重（kg）：bar + 2 × 每邊片總和。 */
  achievableKg: number
  /** 湊唔齊嘅餘數（kg，>= 0）；0 = 啱啱好。 */
  remainderKg: number
  /** 是否低過空槓（target < bar）。 */
  belowBar: boolean
}

export const DEFAULT_PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25] as const

export function computePlates(
  targetKg: number,
  barKg = 20,
  available: readonly number[] = DEFAULT_PLATES_KG,
): PlatePlan {
  const target = num(targetKg, 0)
  const bar = num(barKg, 0)
  const belowBar = target < bar
  // 低過 / 等於空槓：無得上片，餘數為差距（clamp >= 0）。
  if (target <= bar) {
    return {
      perSide: [],
      achievableKg: bar,
      remainderKg: Math.max(0, target - bar),
      belowBar,
    }
  }
  // 每邊需要嘅重量（總額外重量除以二）。
  let perSideRemaining = (target - bar) / 2
  // 只收正值、由大到細（複製避免改原陣列）。
  const plates = [...available]
    .map((p) => num(p, 0))
    .filter((p) => p > 0)
    .sort((a, b) => b - a)
  const perSide: number[] = []
  // 浮點容差：1.25kg 片相加會有微誤差，用 epsilon 防卡死。
  const EPS = 1e-9
  for (const plate of plates) {
    while (perSideRemaining + EPS >= plate) {
      perSide.push(plate)
      perSideRemaining -= plate
    }
  }
  const perSideUsed = perSide.reduce((s, p) => s + p, 0)
  const achievableKg = bar + perSideUsed * 2
  // 餘數 = 目標 - 實際（每邊湊唔到嘅 ×2）；clamp 微負為 0。
  const remainderKg = Math.max(0, Math.round((target - achievableKg) * 1e6) / 1e6)
  return {
    perSide,
    achievableKg: Math.round(achievableKg * 1e6) / 1e6,
    remainderKg,
    belowBar,
  }
}

/**
 * 秒數格式化做 M:SS（畀組間休息計時器顯示）。
 * 負 / NaN → '0:00'；會向下取整秒。
 */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(num(totalSeconds, 0)))
  const m = Math.floor(s / 60)
  const rem = s % 60
  return `${m}:${String(rem).padStart(2, '0')}`
}

// ── 內部本地日期 helper（避免 import toKey/addDays 造成耦合，行為一致）──
function toLocalKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function addLocalDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12)
}
