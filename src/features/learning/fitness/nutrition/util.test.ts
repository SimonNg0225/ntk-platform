import { describe, it, expect } from 'vitest'
import {
  safeNum,
  dayTotals,
  macroPct,
  remaining,
  weeklyCalories,
  normalizeItem,
  macroKcal,
  normalizeMeal,
  mealGroups,
  frequentFoods,
  MEAL_ORDER,
} from './util'
import type { FoodEntry } from './types'

// ============================================================
//  AI 飲食營養 — 純函式測試（vitest, node 環境，唔 render React）
//  斷言具體數值；專測空 / 除零 / 負值 / 缺值守衞。
// ============================================================

function entry(over: Partial<FoodEntry>): FoodEntry {
  return {
    id: over.id ?? 'x',
    date: over.date ?? '2026-05-31',
    label: over.label ?? '食物',
    calories: over.calories ?? 0,
    proteinG: over.proteinG ?? 0,
    fatG: over.fatG ?? 0,
    carbG: over.carbG ?? 0,
    createdAt: over.createdAt ?? '2026-05-31T00:00:00.000Z',
    ...(over.meal !== undefined ? { meal: over.meal } : {}),
  }
}

describe('safeNum', () => {
  it('保留正常非負數', () => {
    expect(safeNum(42)).toBe(42)
    expect(safeNum(0)).toBe(0)
    expect(safeNum(3.5)).toBe(3.5)
  })
  it('字串數字會轉', () => {
    expect(safeNum('120')).toBe(120)
  })
  it('負值 → 0', () => {
    expect(safeNum(-10)).toBe(0)
  })
  it('NaN / Infinity / 非數 / 缺值 → 0', () => {
    expect(safeNum(NaN)).toBe(0)
    expect(safeNum(Infinity)).toBe(0)
    expect(safeNum(-Infinity)).toBe(0)
    expect(safeNum('abc')).toBe(0)
    expect(safeNum(undefined)).toBe(0)
    expect(safeNum(null)).toBe(0)
    expect(safeNum({})).toBe(0)
  })
})

describe('dayTotals', () => {
  it('空陣列回全 0（非 NaN）', () => {
    const t = dayTotals([], '2026-05-31')
    expect(t).toEqual({ calories: 0, proteinG: 0, fatG: 0, carbG: 0 })
  })

  it('只加當日、聚合四欄', () => {
    const entries: FoodEntry[] = [
      entry({ id: 'a', date: '2026-05-31', calories: 300, proteinG: 20, fatG: 10, carbG: 40 }),
      entry({ id: 'b', date: '2026-05-31', calories: 500, proteinG: 35, fatG: 18, carbG: 55 }),
      entry({ id: 'c', date: '2026-05-30', calories: 999, proteinG: 99, fatG: 99, carbG: 99 }),
    ]
    const t = dayTotals(entries, '2026-05-31')
    expect(t.calories).toBe(800)
    expect(t.proteinG).toBe(55)
    expect(t.fatG).toBe(28)
    expect(t.carbG).toBe(95)
  })

  it('缺值 / 負值經 safeNum 收斂', () => {
    const entries = [
      entry({ id: 'a', date: '2026-05-31', calories: -50, proteinG: NaN as unknown as number, fatG: 5, carbG: 10 }),
      entry({ id: 'b', date: '2026-05-31', calories: 200, proteinG: 10, fatG: 5, carbG: 10 }),
    ]
    const t = dayTotals(entries, '2026-05-31')
    expect(t.calories).toBe(200) // -50 當 0
    expect(t.proteinG).toBe(10) // NaN 當 0
    expect(t.fatG).toBe(10)
    expect(t.carbG).toBe(20)
  })

  it('冇匹配日子回全 0', () => {
    const entries = [entry({ date: '2026-01-01', calories: 500 })]
    expect(dayTotals(entries, '2026-05-31')).toEqual({
      calories: 0,
      proteinG: 0,
      fatG: 0,
      carbG: 0,
    })
  })

  it('空日期字串 → 全 0', () => {
    const entries = [entry({ date: '2026-05-31', calories: 500 })]
    expect(dayTotals(entries, '')).toEqual({
      calories: 0,
      proteinG: 0,
      fatG: 0,
      carbG: 0,
    })
  })
})

describe('macroPct', () => {
  it('一般百分比四捨五入', () => {
    expect(macroPct(50, 200)).toBe(25)
    expect(macroPct(150, 200)).toBe(75)
    expect(macroPct(1, 3)).toBe(33) // 33.33 → 33
    expect(macroPct(2, 3)).toBe(67) // 66.66 → 67
  })
  it('封頂 100（超標唔爆出界）', () => {
    expect(macroPct(300, 200)).toBe(100)
  })
  it('target ≤ 0 → 0（避除零 / Infinity）', () => {
    expect(macroPct(100, 0)).toBe(0)
    expect(macroPct(100, -50)).toBe(0)
  })
  it('value 缺值 → 0', () => {
    expect(macroPct(undefined, 200)).toBe(0)
    expect(macroPct(NaN, 200)).toBe(0)
  })
  it('value 0 → 0', () => {
    expect(macroPct(0, 2000)).toBe(0)
  })
})

describe('remaining', () => {
  it('剩餘 = target − total', () => {
    expect(remaining(800, 2000)).toBe(1200)
    expect(remaining(0, 2000)).toBe(2000)
  })
  it('超標封 0（唔回負）', () => {
    expect(remaining(2500, 2000)).toBe(0)
  })
  it('剛好食晒回 0', () => {
    expect(remaining(2000, 2000)).toBe(0)
  })
  it('缺值守衞', () => {
    expect(remaining(undefined, 2000)).toBe(2000)
    expect(remaining(500, undefined)).toBe(0)
    expect(remaining(NaN, NaN)).toBe(0)
  })
  it('四捨五入', () => {
    expect(remaining(799.4, 2000)).toBe(1201) // 1200.6 → 1201
  })
})

describe('weeklyCalories', () => {
  const anchor = new Date(2026, 4, 31, 12) // 2026-05-31 本地正午

  it('永遠回 7 日、由舊到新、末項係 anchor 當日', () => {
    const out = weeklyCalories([], anchor)
    expect(out).toHaveLength(7)
    expect(out[0].key).toBe('2026-05-25')
    expect(out[6].key).toBe('2026-05-31')
  })

  it('空陣列每日 0（柱狀圖等寬，非 NaN）', () => {
    const out = weeklyCalories([], anchor)
    expect(out.every((d) => d.calories === 0)).toBe(true)
  })

  it('按本地日期 key 聚合卡路里', () => {
    const entries: FoodEntry[] = [
      entry({ id: '1', date: '2026-05-31', calories: 300 }),
      entry({ id: '2', date: '2026-05-31', calories: 200 }),
      entry({ id: '3', date: '2026-05-29', calories: 700 }),
      entry({ id: '4', date: '2026-01-01', calories: 9999 }), // 範圍外唔計
    ]
    const out = weeklyCalories(entries, anchor)
    const byKey = Object.fromEntries(out.map((d) => [d.key, d.calories]))
    expect(byKey['2026-05-31']).toBe(500)
    expect(byKey['2026-05-29']).toBe(700)
    expect(byKey['2026-05-30']).toBe(0)
    // 範圍外唔應該出現
    expect(out.some((d) => d.key === '2026-01-01')).toBe(false)
  })

  it('負 / 缺值卡路里經 safeNum', () => {
    const entries = [
      entry({ id: '1', date: '2026-05-31', calories: -100 }),
      entry({ id: '2', date: '2026-05-31', calories: 250 }),
    ]
    const out = weeklyCalories(entries, anchor)
    const last = out[6]
    expect(last.key).toBe('2026-05-31')
    expect(last.calories).toBe(250) // -100 當 0
  })
})

describe('normalizeItem', () => {
  it('正常項收斂 label + 四欄', () => {
    const r = normalizeItem({
      label: '  雞胸肉  ',
      calories: 165,
      proteinG: 31,
      fatG: 3.6,
      carbG: 0,
    })
    expect(r).toEqual({
      label: '雞胸肉',
      calories: 165,
      proteinG: 31,
      fatG: 3.6,
      carbG: 0,
    })
  })

  it('負 / 缺值收斂做 0、仍保留（因有 label）', () => {
    const r = normalizeItem({ label: '飯', calories: -50, proteinG: undefined })
    expect(r).not.toBeNull()
    expect(r?.calories).toBe(0)
    expect(r?.proteinG).toBe(0)
  })

  it('字串數字會轉', () => {
    const r = normalizeItem({ label: '蛋', calories: '78', proteinG: '6' })
    expect(r?.calories).toBe(78)
    expect(r?.proteinG).toBe(6)
  })

  it('連 label 都冇、四欄又全 0 → null（廢項）', () => {
    expect(normalizeItem({})).toBeNull()
    expect(normalizeItem({ label: '   ' })).toBeNull()
    expect(normalizeItem({ label: 123 as unknown as string })).toBeNull()
  })

  it('無 label 但有營養值 → 保留（label 空字串）', () => {
    const r = normalizeItem({ calories: 100 })
    expect(r).not.toBeNull()
    expect(r?.label).toBe('')
    expect(r?.calories).toBe(100)
  })

  it('非物件 → null', () => {
    expect(normalizeItem(null as unknown as never)).toBeNull()
  })
})

describe('macroKcal', () => {
  it('蛋白 ×4 / 脂肪 ×9 / 碳水 ×4', () => {
    const k = macroKcal({ calories: 0, proteinG: 10, fatG: 10, carbG: 10 })
    expect(k.protein).toBe(40)
    expect(k.fat).toBe(90)
    expect(k.carb).toBe(40)
  })
  it('缺值守衞 → 0', () => {
    const k = macroKcal({
      calories: 0,
      proteinG: NaN as unknown as number,
      fatG: -5,
      carbG: 0,
    })
    expect(k.protein).toBe(0)
    expect(k.fat).toBe(0)
    expect(k.carb).toBe(0)
  })
})

describe('normalizeMeal', () => {
  it('合法餐段原樣保留', () => {
    expect(normalizeMeal('breakfast')).toBe('breakfast')
    expect(normalizeMeal('lunch')).toBe('lunch')
    expect(normalizeMeal('dinner')).toBe('dinner')
    expect(normalizeMeal('snack')).toBe('snack')
    expect(normalizeMeal('other')).toBe('other')
  })
  it('缺值 / 唔識字串 / 非字串 → other（向後相容舊資料）', () => {
    expect(normalizeMeal(undefined)).toBe('other')
    expect(normalizeMeal(null)).toBe('other')
    expect(normalizeMeal('')).toBe('other')
    expect(normalizeMeal('brunch')).toBe('other')
    expect(normalizeMeal(123)).toBe('other')
    expect(normalizeMeal({})).toBe('other')
  })
})

describe('mealGroups', () => {
  it('空陣列 / 空日期 → 空陣列', () => {
    expect(mealGroups([], '2026-05-31')).toEqual([])
    expect(mealGroups([entry({ date: '2026-05-31' })], '')).toEqual([])
  })

  it('按 MEAL_ORDER 排序、各餐小計、空段唔出', () => {
    const entries: FoodEntry[] = [
      entry({ id: 'd1', date: '2026-05-31', meal: 'dinner', calories: 600, proteinG: 40, fatG: 20, carbG: 50 }),
      entry({ id: 'b1', date: '2026-05-31', meal: 'breakfast', calories: 300, proteinG: 15, fatG: 8, carbG: 40 }),
      entry({ id: 'b2', date: '2026-05-31', meal: 'breakfast', calories: 100, proteinG: 5, fatG: 2, carbG: 12 }),
    ]
    const g = mealGroups(entries, '2026-05-31')
    // 只得早餐 + 晚餐有嘢；午餐 / 小食 / 其他空段唔出現
    expect(g.map((x) => x.meal)).toEqual(['breakfast', 'dinner'])
    // 早餐排序先過晚餐（MEAL_ORDER）
    expect(g[0].meal).toBe('breakfast')
    expect(g[0].entries).toHaveLength(2)
    expect(g[0].subtotal.calories).toBe(400)
    expect(g[0].subtotal.proteinG).toBe(20)
    expect(g[0].subtotal.fatG).toBe(10)
    expect(g[0].subtotal.carbG).toBe(52)
    expect(g[1].subtotal.calories).toBe(600)
  })

  it('舊資料無 meal → 歸入 other（向後相容）', () => {
    const entries: FoodEntry[] = [
      entry({ id: 'old', date: '2026-05-31', calories: 200 }), // 無 meal
      entry({ id: 'lu', date: '2026-05-31', meal: 'lunch', calories: 500 }),
    ]
    const g = mealGroups(entries, '2026-05-31')
    expect(g.map((x) => x.meal)).toEqual(['lunch', 'other'])
    const other = g.find((x) => x.meal === 'other')
    expect(other?.subtotal.calories).toBe(200)
  })

  it('唔識嘅 meal 值都歸 other', () => {
    const entries: FoodEntry[] = [
      entry({ id: 'x', date: '2026-05-31', meal: 'brunch' as never, calories: 150 }),
    ]
    const g = mealGroups(entries, '2026-05-31')
    expect(g).toHaveLength(1)
    expect(g[0].meal).toBe('other')
    expect(g[0].subtotal.calories).toBe(150)
  })

  it('只計當日；缺 / 負值經 safeNum', () => {
    const entries: FoodEntry[] = [
      entry({ id: 'a', date: '2026-05-31', meal: 'lunch', calories: -50, proteinG: NaN as unknown as number, fatG: 5, carbG: 10 }),
      entry({ id: 'b', date: '2026-05-30', meal: 'lunch', calories: 999 }), // 第二日唔計
    ]
    const g = mealGroups(entries, '2026-05-31')
    expect(g).toHaveLength(1)
    expect(g[0].subtotal.calories).toBe(0) // -50 → 0
    expect(g[0].subtotal.proteinG).toBe(0) // NaN → 0
    expect(g[0].subtotal.fatG).toBe(5)
  })

  it('保留傳入次序（同餐內唔重排）', () => {
    const entries: FoodEntry[] = [
      entry({ id: 'first', date: '2026-05-31', meal: 'snack', calories: 50 }),
      entry({ id: 'second', date: '2026-05-31', meal: 'snack', calories: 80 }),
    ]
    const g = mealGroups(entries, '2026-05-31')
    expect(g[0].entries.map((e) => e.id)).toEqual(['first', 'second'])
  })

  it('MEAL_ORDER 係 5 段、other 排尾', () => {
    expect(MEAL_ORDER).toEqual(['breakfast', 'lunch', 'dinner', 'snack', 'other'])
  })
})

describe('frequentFoods', () => {
  it('空陣列 → 空', () => {
    expect(frequentFoods([])).toEqual([])
  })

  it('同名同 macros 去重 + 計次、最常用排先', () => {
    const entries: FoodEntry[] = [
      entry({ id: '1', date: '2026-05-31', label: '雞胸肉', calories: 165, proteinG: 31, fatG: 4, carbG: 0 }),
      entry({ id: '2', date: '2026-05-30', label: '雞胸肉', calories: 165, proteinG: 31, fatG: 4, carbG: 0 }),
      entry({ id: '3', date: '2026-05-29', label: '雞胸肉', calories: 165, proteinG: 31, fatG: 4, carbG: 0 }),
      entry({ id: '4', date: '2026-05-31', label: '白飯', calories: 200, proteinG: 4, fatG: 0, carbG: 44 }),
    ]
    const f = frequentFoods(entries)
    expect(f).toHaveLength(2)
    expect(f[0].label).toBe('雞胸肉')
    expect(f[0].count).toBe(3)
    expect(f[0].calories).toBe(165)
    expect(f[1].label).toBe('白飯')
    expect(f[1].count).toBe(1)
  })

  it('同名但 macros 唔同 → 當兩款唔同', () => {
    const entries: FoodEntry[] = [
      entry({ id: '1', label: '蛋', calories: 78, proteinG: 6, fatG: 5, carbG: 1 }),
      entry({ id: '2', label: '蛋', calories: 90, proteinG: 7, fatG: 6, carbG: 1 }),
    ]
    const f = frequentFoods(entries)
    expect(f).toHaveLength(2)
    expect(f.every((x) => x.count === 1)).toBe(true)
  })

  it('label 去前後空白後比較（同款唔會分裂）', () => {
    const entries: FoodEntry[] = [
      entry({ id: '1', label: '  奶  ', calories: 60, proteinG: 3, fatG: 3, carbG: 5 }),
      entry({ id: '2', label: '奶', calories: 60, proteinG: 3, fatG: 3, carbG: 5 }),
    ]
    const f = frequentFoods(entries)
    expect(f).toHaveLength(1)
    expect(f[0].label).toBe('奶')
    expect(f[0].count).toBe(2)
  })

  it('空 label（trim 後）唔計', () => {
    const entries: FoodEntry[] = [
      entry({ id: '1', label: '   ', calories: 100 }),
      entry({ id: '2', label: '', calories: 50 }),
      entry({ id: '3', label: '茶', calories: 0 }),
    ]
    const f = frequentFoods(entries)
    expect(f).toHaveLength(1)
    expect(f[0].label).toBe('茶')
  })

  it('負 / 缺值經 safeNum 後做 key（同款穩定合併）', () => {
    const entries: FoodEntry[] = [
      entry({ id: '1', label: '飯', calories: -50, proteinG: NaN as unknown as number, fatG: 0, carbG: 44 }),
      entry({ id: '2', label: '飯', calories: 0, proteinG: 0, fatG: 0, carbG: 44 }),
    ]
    const f = frequentFoods(entries)
    expect(f).toHaveLength(1) // -50→0, NaN→0 後兩筆 key 一致
    expect(f[0].count).toBe(2)
    expect(f[0].calories).toBe(0)
    expect(f[0].proteinG).toBe(0)
  })

  it('limit 截斷；count 相同時依 label localeCompare', () => {
    const entries: FoodEntry[] = [
      entry({ id: '1', label: 'C', calories: 10 }),
      entry({ id: '2', label: 'A', calories: 20 }),
      entry({ id: '3', label: 'B', calories: 30 }),
    ]
    const f = frequentFoods(entries, 2)
    expect(f).toHaveLength(2)
    // 全部 count=1，依字母序 A、B 先
    expect(f.map((x) => x.label)).toEqual(['A', 'B'])
  })

  it('limit ≤ 0 → 空陣列', () => {
    const entries: FoodEntry[] = [entry({ id: '1', label: '飯', calories: 200 })]
    expect(frequentFoods(entries, 0)).toEqual([])
    expect(frequentFoods(entries, -3)).toEqual([])
  })
})
