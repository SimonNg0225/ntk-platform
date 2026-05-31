import { describe, it, expect } from 'vitest'
import { freqLabel, isScheduledDay, type HabitFrequency } from './types'

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
