import { recentDays } from '../common'
import type { FoodEntry, Macros, RawFoodItem } from './types'

// ============================================================
//  AI 飲食營養 — 純函式（無 React / 無 AI；全部可測）
//  ------------------------------------------------------------
//  聚合 / 進度 / 剩餘 / 近 7 日卡路里。全部要守空陣列、除零、
//  負值、缺值（NaN / undefined）—— 永不回 NaN / Infinity。
// ============================================================

/** 把任意值收斂成「安全非負有限數」；唔合法（NaN/Infinity/負/非數）一律當 0。 */
export function safeNum(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n) || n < 0) return 0
  return n
}

const ZERO: Macros = { calories: 0, proteinG: 0, fatG: 0, carbG: 0 }

/**
 * 某一日全部飲食紀錄嘅四大營養總和。
 * 缺值 / 負值經 safeNum 收斂；冇紀錄回全 0（非 NaN）。
 */
export function dayTotals(entries: FoodEntry[], date: string): Macros {
  if (!Array.isArray(entries) || entries.length === 0 || !date) return { ...ZERO }
  return entries.reduce<Macros>((acc, e) => {
    if (!e || e.date !== date) return acc
    acc.calories += safeNum(e.calories)
    acc.proteinG += safeNum(e.proteinG)
    acc.fatG += safeNum(e.fatG)
    acc.carbG += safeNum(e.carbG)
    return acc
  }, { ...ZERO })
}

/**
 * 達標百分比（value / target × 100），夾 0–100、四捨五入整數。
 * target ≤ 0 → 回 0（避除零 / Infinity）；value 缺值當 0。
 * 註：上限封頂 100 係畀進度環 / 進度條用（唔會爆出界）。
 */
export function macroPct(value: unknown, target: unknown): number {
  const t = safeNum(target)
  if (t <= 0) return 0
  const v = safeNum(value)
  const pct = (v / t) * 100
  if (!Number.isFinite(pct)) return 0
  return Math.min(100, Math.max(0, Math.round(pct)))
}

/**
 * 剩餘額度（target − total），下限封 0（唔回負數）。
 * target 缺值當 0；total 缺值當 0。
 */
export function remaining(total: unknown, target: unknown): number {
  const t = safeNum(target)
  const v = safeNum(total)
  return Math.max(0, Math.round(t - v))
}

/** 近 7 日（含 anchor 當日）每日卡路里，由舊到新。 */
export interface DayCalories {
  key: string // 本地日期 key
  calories: number
}

/**
 * 由 anchor 起回推 7 日（含當日）嘅每日卡路里總和，舊→新。
 * 無紀錄嘅日子回 0（非缺項），方便柱狀圖等寬鋪。
 */
export function weeklyCalories(
  entries: FoodEntry[],
  anchor: Date = new Date(),
): DayCalories[] {
  const days = recentDays(7, anchor)
  const sum = new Map<string, number>()
  if (Array.isArray(entries)) {
    for (const e of entries) {
      if (!e || !e.date) continue
      sum.set(e.date, (sum.get(e.date) ?? 0) + safeNum(e.calories))
    }
  }
  return days.map((key) => ({ key, calories: sum.get(key) ?? 0 }))
}

/**
 * 把 AI 回嘅原始項收斂成乾淨 Macros + label。
 * label 缺 / 非字串 → 空字串（呼叫端再決定是否丟棄）；
 * 四個營養值經 safeNum。回 null 代表整項唔可用（連 label 都冇）。
 */
export function normalizeItem(
  raw: RawFoodItem,
): (Macros & { label: string }) | null {
  if (!raw || typeof raw !== 'object') return null
  const label = typeof raw.label === 'string' ? raw.label.trim() : ''
  const calories = safeNum(raw.calories)
  const proteinG = safeNum(raw.proteinG)
  const fatG = safeNum(raw.fatG)
  const carbG = safeNum(raw.carbG)
  // 連名都冇、四個值又全 0 嘅項視為廢項
  if (!label && calories === 0 && proteinG === 0 && fatG === 0 && carbG === 0) {
    return null
  }
  return { label, calories, proteinG, fatG, carbG }
}

/** 三大營養素「克 → 卡路里」換算（蛋白 4 / 碳水 4 / 脂肪 9）供顯示參考。 */
export function macroKcal(macros: Macros): {
  protein: number
  fat: number
  carb: number
} {
  return {
    protein: Math.round(safeNum(macros.proteinG) * 4),
    fat: Math.round(safeNum(macros.fatG) * 9),
    carb: Math.round(safeNum(macros.carbG) * 4),
  }
}
