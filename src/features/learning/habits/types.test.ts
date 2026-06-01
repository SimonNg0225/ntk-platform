import { describe, it, expect } from 'vitest'
import {
  colorOf,
  freqLabel,
  isScheduledDay,
  HABIT_COLORS,
  HABIT_COLOR_KEYS,
  type HabitFrequency,
} from './types'

// ============================================================
//  頻率標籤 + 排程日判斷（純函式，無時間 / DOM 依賴）
// ============================================================

describe('freqLabel（頻率 → 中文標籤）', () => {
  it('daily → 每日', () => {
    expect(freqLabel({ kind: 'daily' })).toBe('每日')
  })

  it('weekly → 每週 N 次（含 N=1）', () => {
    expect(freqLabel({ kind: 'weekly', times: 1 })).toBe('每週 1 次')
    expect(freqLabel({ kind: 'weekly', times: 3 })).toBe('每週 3 次')
  })

  it('weekdays 全 7 日 → 每日（特例）', () => {
    expect(freqLabel({ kind: 'weekdays', days: [0, 1, 2, 3, 4, 5, 6] })).toBe('每日')
  })

  it('weekdays 空陣列 → 未設定（邊界）', () => {
    expect(freqLabel({ kind: 'weekdays', days: [] })).toBe('未設定')
  })

  it('weekdays 單一星期日 [0] → 逢週日', () => {
    expect(freqLabel({ kind: 'weekdays', days: [0] })).toBe('逢週 日')
  })

  it('weekdays 亂序 [5,1,3] → 排序輸出 逢週 一、三、五', () => {
    expect(freqLabel({ kind: 'weekdays', days: [5, 1, 3] })).toBe('逢週 一、三、五')
  })

  it('weekdays 逢一至五 [1,2,3,4,5] → 逢週 一、二、三、四、五', () => {
    expect(freqLabel({ kind: 'weekdays', days: [1, 2, 3, 4, 5] })).toBe(
      '逢週 一、二、三、四、五',
    )
  })

  it('排序不破壞原陣列（用 slice 複製）', () => {
    const f: HabitFrequency = { kind: 'weekdays', days: [6, 0, 2] }
    freqLabel(f)
    expect((f as { days: number[] }).days).toEqual([6, 0, 2]) // 原陣列未被 sort 改動
  })
})

describe('isScheduledDay（某星期 0-6 係咪應做日）', () => {
  it('daily → 任何星期皆 true', () => {
    for (let wd = 0; wd <= 6; wd += 1) {
      expect(isScheduledDay({ kind: 'daily' }, wd)).toBe(true)
    }
  })

  it('weekly → 任何星期皆 true（任何日都可做）', () => {
    for (let wd = 0; wd <= 6; wd += 1) {
      expect(isScheduledDay({ kind: 'weekly', times: 2 }, wd)).toBe(true)
    }
  })

  it('weekdays 命中嘅星期 → true', () => {
    const f: HabitFrequency = { kind: 'weekdays', days: [1, 3, 5] }
    expect(isScheduledDay(f, 1)).toBe(true)
    expect(isScheduledDay(f, 3)).toBe(true)
    expect(isScheduledDay(f, 5)).toBe(true)
  })

  it('weekdays 唔命中嘅星期 → false', () => {
    const f: HabitFrequency = { kind: 'weekdays', days: [1, 3, 5] }
    expect(isScheduledDay(f, 0)).toBe(false)
    expect(isScheduledDay(f, 2)).toBe(false)
    expect(isScheduledDay(f, 6)).toBe(false)
  })

  it('weekdays 空陣列 → 全部星期皆 false（邊界）', () => {
    const f: HabitFrequency = { kind: 'weekdays', days: [] }
    for (let wd = 0; wd <= 6; wd += 1) {
      expect(isScheduledDay(f, wd)).toBe(false)
    }
  })
})

// ============================================================
//  colorOf（顏色 key → HabitColorSpec，含 fallback 到 accent）
//  純查表函式，無時間 / DOM 依賴。
// ============================================================

describe('colorOf（顏色查找 + fallback）', () => {
  it('已知 key 回對應 spec（同 HABIT_COLORS[key] 為同一引用）', () => {
    expect(colorOf('blue')).toBe(HABIT_COLORS.blue)
    expect(colorOf('rose')).toBe(HABIT_COLORS.rose)
    // 抽查欄位值，確保唔係意外指錯 spec
    expect(colorOf('blue').label).toBe('藍')
    expect(colorOf('rose').heat).toEqual(HABIT_COLORS.rose.heat)
  })

  it('全部已知 key 都回各自對應 spec（覆蓋整個 union）', () => {
    for (const key of HABIT_COLOR_KEYS) {
      expect(colorOf(key)).toBe(HABIT_COLORS[key])
    }
  })

  it('undefined → fallback 到 accent', () => {
    expect(colorOf(undefined)).toBe(HABIT_COLORS.accent)
  })

  it('未知字串 → fallback 到 accent', () => {
    expect(colorOf('bogus')).toBe(HABIT_COLORS.accent)
    expect(colorOf('BLUE')).toBe(HABIT_COLORS.accent) // 大小寫敏感：唔等於 'blue'
  })

  it('空字串 → fallback 到 accent（邊界）', () => {
    expect(colorOf('')).toBe(HABIT_COLORS.accent)
  })

  // NOTE: 原型鍵（'toString' / 'constructor' 等）case 暫不加 —— 見下方說明：
  // colorOf 用 HABIT_COLORS[c] ?? accent，普通物件 index 會撞到 Object.prototype，
  // colorOf('toString') 會回 Object.prototype.toString（函式）而非 accent spec，?? 唔兜底。
  // 屬 source bug，呢輪只報告唔改 source，亦唔加會編碼錯誤行為嘅斷言。

  it('回傳 heat 永遠係 5 個元素（heatmap 唔會 index out of range）', () => {
    // 已知色、fallback、空字串 — 任何輸入都要 5 級填色
    for (const input of ['blue', 'rose', 'bogus', '', undefined] as const) {
      const spec = colorOf(input)
      expect(Array.isArray(spec.heat)).toBe(true)
      expect(spec.heat).toHaveLength(5)
      spec.heat.forEach((cls) => expect(typeof cls).toBe('string'))
    }
  })
})
