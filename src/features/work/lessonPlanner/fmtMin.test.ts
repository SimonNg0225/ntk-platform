import { describe, it, expect } from 'vitest'
import { fmtMin } from './PlanEditor'

// ============================================================
//  fmtMin — 分鐘 → 人類可讀時長
//  <60：「X 分鐘」；≥60：「H 小時」或「H 小時 M 分」
//  （Math.floor(min/60) + min%60；無餘數時唔顯示「分」）
// ============================================================
describe('fmtMin', () => {
  it('0 → 「0 分鐘」', () => {
    expect(fmtMin(0)).toBe('0 分鐘')
  })

  it('純分鐘（<60）', () => {
    expect(fmtMin(1)).toBe('1 分鐘')
    expect(fmtMin(30)).toBe('30 分鐘')
  })

  it('59 係 <60 邊界，仍用分鐘', () => {
    expect(fmtMin(59)).toBe('59 分鐘')
  })

  it('60 → 「1 小時」（無餘數，唔顯示分）', () => {
    expect(fmtMin(60)).toBe('1 小時')
  })

  it('整點小時（無餘數）', () => {
    expect(fmtMin(120)).toBe('2 小時')
    expect(fmtMin(180)).toBe('3 小時')
  })

  it('90 → 「1 小時 30 分」', () => {
    expect(fmtMin(90)).toBe('1 小時 30 分')
  })

  it('125 → 「2 小時 5 分」（floor(125/60)=2、餘 5）', () => {
    expect(fmtMin(125)).toBe('2 小時 5 分')
  })

  it('61 → 「1 小時 1 分」（最細餘數）', () => {
    expect(fmtMin(61)).toBe('1 小時 1 分')
  })

  it('負數落 <60 分支，照樣顯示（input 已 clamp ≥0，此為純函式邊界）', () => {
    expect(fmtMin(-5)).toBe('-5 分鐘')
  })
})
