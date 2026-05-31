import { recentDays } from '../common'
import type {
  FoodEntry,
  FrequentFood,
  Macros,
  MealSlot,
  RawFoodItem,
} from './types'

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

// ============================================================
//  每餐分段 + 常食快速再記（新增純函式）
// ============================================================

/** 餐段顯示次序（同 MealSlot；'other' 永遠排尾） */
export const MEAL_ORDER: readonly MealSlot[] = [
  'breakfast',
  'lunch',
  'dinner',
  'snack',
  'other',
] as const

const MEAL_SET = new Set<MealSlot>(MEAL_ORDER)

/**
 * 把任意值收斂成合法 MealSlot；缺值 / 唔識 → 'other'（向後相容舊資料）。
 */
export function normalizeMeal(v: unknown): MealSlot {
  return typeof v === 'string' && MEAL_SET.has(v as MealSlot)
    ? (v as MealSlot)
    : 'other'
}

/** 一個餐段嘅分組結果：該餐全部紀錄（保留傳入次序）+ 四大營養小計。 */
export interface MealGroup {
  meal: MealSlot
  entries: FoodEntry[]
  subtotal: Macros
}

/**
 * 把某一日嘅飲食紀錄按餐分組 + 各餐小計，依 MEAL_ORDER 排序。
 * 只回「當日 + 有紀錄」嘅餐段（空段唔出，免日誌堆白卡）。
 * 舊資料無 meal 歸入 'other'；缺 / 負值經 safeNum 收斂。
 * 注意：純分組，唔改原陣列次序（呼叫端自行決定新→舊定舊→新）。
 */
export function mealGroups(entries: FoodEntry[], date: string): MealGroup[] {
  if (!Array.isArray(entries) || entries.length === 0 || !date) return []
  const buckets = new Map<MealSlot, MealGroup>()
  for (const e of entries) {
    if (!e || e.date !== date) continue
    const meal = normalizeMeal(e.meal)
    let g = buckets.get(meal)
    if (!g) {
      g = { meal, entries: [], subtotal: { ...ZERO } }
      buckets.set(meal, g)
    }
    g.entries.push(e)
    g.subtotal.calories += safeNum(e.calories)
    g.subtotal.proteinG += safeNum(e.proteinG)
    g.subtotal.fatG += safeNum(e.fatG)
    g.subtotal.carbG += safeNum(e.carbG)
  }
  return MEAL_ORDER.map((m) => buckets.get(m)).filter(
    (g): g is MealGroup => g !== undefined,
  )
}

/** 把 label + macros 組成穩定去重 key（同名同營養 = 同一款常食）。 */
function foodKey(
  label: string,
  m: { calories: number; proteinG: number; fatG: number; carbG: number },
): string {
  return [label, m.calories, m.proteinG, m.fatG, m.carbG].join('|')
}

/**
 * 由歷史 FoodEntry 去重統計「常食」清單，最常用排先（次數多→次數同則名先）。
 * 同名 + 四個 macros 完全相同視為同一款；label 去前後空白後比較。
 * 空 label（trim 後）唔計。負 / 缺值經 safeNum 收斂後先做 key（保證穩定）。
 * limit ≤ 0 → 回空陣列；預設取前 8 款。
 */
export function frequentFoods(
  entries: FoodEntry[],
  limit = 8,
): FrequentFood[] {
  if (!Array.isArray(entries) || entries.length === 0) return []
  const max = Math.floor(safeNum(limit))
  if (max <= 0) return []
  const acc = new Map<string, FrequentFood>()
  for (const e of entries) {
    if (!e) continue
    const label = typeof e.label === 'string' ? e.label.trim() : ''
    if (!label) continue
    const calories = safeNum(e.calories)
    const proteinG = safeNum(e.proteinG)
    const fatG = safeNum(e.fatG)
    const carbG = safeNum(e.carbG)
    const key = foodKey(label, { calories, proteinG, fatG, carbG })
    const cur = acc.get(key)
    if (cur) cur.count += 1
    else
      acc.set(key, { key, label, calories, proteinG, fatG, carbG, count: 1 })
  }
  return Array.from(acc.values())
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, max)
}
