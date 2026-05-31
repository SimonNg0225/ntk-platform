// ============================================================
//  動作 / 器材庫 — 純函式（可測）
//  ------------------------------------------------------------
//  全部唔 import React，只做篩選 / 聚合 / 字串處理，方便 vitest
//  （node 環境）直接測。空陣列 / 缺值 / 大小寫都有守衞。
// ============================================================

import type { Exercise, ExerciseCategory } from './data'

export interface ExerciseFilter {
  /** 搜尋字（對名稱做大小寫無關 substring 比對；trim 後空字串 = 唔篩） */
  q?: string
  /** 限定 category；'全部' / undefined = 唔篩 */
  category?: ExerciseCategory | '全部'
  /** 限定器材；'全部' / undefined = 唔篩 */
  equipment?: string | '全部'
}

/**
 * 按搜尋字、分類、器材篩選動作。三個條件係 AND（同時成立先收）。
 * - q：對 name 做大小寫無關 substring；trim 後空 = 略過。
 * - category：等於 '全部' 或 undefined = 略過。
 * - equipment：動作 equipment 陣列「包含」該器材先收；'全部'/undefined = 略過。
 * 守衞：all 非陣列回 []；保留原本次序（穩定）。
 */
export function filterExercises(
  all: Exercise[],
  filter: ExerciseFilter = {},
): Exercise[] {
  if (!Array.isArray(all)) return []
  const q = (filter.q ?? '').trim().toLowerCase()
  const category = filter.category
  const equipment = filter.equipment

  return all.filter((ex) => {
    if (q && !ex.name.toLowerCase().includes(q)) return false
    if (category && category !== '全部' && ex.category !== category) return false
    if (
      equipment &&
      equipment !== '全部' &&
      !(ex.equipment ?? []).includes(equipment)
    )
      return false
    return true
  })
}

export interface MuscleBucket {
  muscle: string
  /** 以此肌群為「主」嘅動作 */
  primary: Exercise[]
  /** 以此肌群為「次」嘅動作 */
  secondary: Exercise[]
}

/**
 * 按肌群歸類所有動作。每個出現過嘅肌群一個 bucket，分主 / 次兩格。
 * - 同一動作可出現喺多個肌群（多對多）。
 * - primaryMuscles / secondaryMuscles 缺失或非陣列會當空處理。
 * - 結果按「總出現次數（主+次）」由多到少排，次序穩定（同次數保插入序）。
 * 守衞：all 非陣列回 []。
 */
export function muscleIndex(all: Exercise[]): MuscleBucket[] {
  if (!Array.isArray(all)) return []
  const map = new Map<string, MuscleBucket>()
  const order: string[] = []

  const ensure = (muscle: string): MuscleBucket => {
    let b = map.get(muscle)
    if (!b) {
      b = { muscle, primary: [], secondary: [] }
      map.set(muscle, b)
      order.push(muscle)
    }
    return b
  }

  for (const ex of all) {
    for (const m of ex.primaryMuscles ?? []) {
      if (m) ensure(m).primary.push(ex)
    }
    for (const m of ex.secondaryMuscles ?? []) {
      if (m) ensure(m).secondary.push(ex)
    }
  }

  return order
    .map((m) => map.get(m) as MuscleBucket)
    .sort((a, b) => {
      const ca = a.primary.length + a.secondary.length
      const cb = b.primary.length + b.secondary.length
      return cb - ca
    })
}

/**
 * 由動作資料歸納所有出現過嘅器材（去重、保插入序）。
 * 用嚟動態整器材篩選 chips，唔使硬寫一份清單。
 * 守衞：all 非陣列回 []。
 */
export function equipmentList(all: Exercise[]): string[] {
  if (!Array.isArray(all)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const ex of all) {
    for (const e of ex.equipment ?? []) {
      if (e && !seen.has(e)) {
        seen.add(e)
        out.push(e)
      }
    }
  }
  return out
}

/** 每個 category 嘅動作數（用嚟顯示 chip 旁邊計數 / 確認分佈均衡）。 */
export function countByCategory(
  all: Exercise[],
): Record<ExerciseCategory, number> {
  const out = {
    胸: 0,
    背: 0,
    腿: 0,
    肩: 0,
    手臂: 0,
    核心: 0,
    全身: 0,
  } as Record<ExerciseCategory, number>
  if (!Array.isArray(all)) return out
  for (const ex of all) {
    if (ex.category in out) out[ex.category] += 1
  }
  return out
}
