import { describe, it, expect } from 'vitest'
import { fmtVol } from './Charts'

// ============================================================
//  fmtVol — volume / 重量顯示格式化（純函式）
//  ------------------------------------------------------------
//  Charts.tsx 內唯一純函式，全 training UI（KPI / 圖 / 槓片 / 預覽）
//  都靠佢出數。守則：非有限（NaN / Infinity）→ '0'，唔好喺畫面出
//  「NaN」/「Infinity」；有限值四捨五入到整數 + 千位分隔。
// ============================================================

describe('fmtVol', () => {
  it('整數加千位分隔', () => {
    expect(fmtVol(0)).toBe('0')
    expect(fmtVol(500)).toBe('500')
    expect(fmtVol(1000)).toBe('1,000')
    expect(fmtVol(1260)).toBe('1,260')
    expect(fmtVol(1234567)).toBe('1,234,567')
  })

  it('四捨五入到整數（畀軸 / KPI 用）', () => {
    expect(fmtVol(62.5)).toBe('63') // .5 進位
    expect(fmtVol(62.4)).toBe('62')
    expect(fmtVol(999.9)).toBe('1,000')
  })

  it('非有限值守衞 → "0"（唔出 NaN / Infinity）', () => {
    expect(fmtVol(NaN)).toBe('0')
    expect(fmtVol(Infinity)).toBe('0')
    expect(fmtVol(-Infinity)).toBe('0')
  })

  it('負值照格式化（唔當 0；上游已 clamp，呢度只負責顯示）', () => {
    // 防回歸：fmtVol 唔應該偷偷食咗負號。
    expect(fmtVol(-50)).toBe('-50')
  })

  it('細小正餘數（槓片計算器「差 X kg」）', () => {
    expect(fmtVol(0.5)).toBe('1') // 0.5 → 進位 1
    expect(fmtVol(0.4)).toBe('0')
    expect(fmtVol(25)).toBe('25')
  })
})
