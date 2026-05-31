import { describe, it, expect } from 'vitest'
import {
  bandsOf,
  defaultBandCuts,
  gradeOf,
  resolveBands,
} from './util'

// ============================================================
//  自訂等級分界（resolveBands / defaultBandCuts / gradeOf bands 覆蓋）
//  守則：空/缺值/亂序/越界/最底級固定 0 + 唔污染內建 bands
// ============================================================

describe('defaultBandCuts', () => {
  it('回內建每級下限（label → min）', () => {
    expect(defaultBandCuts('simple')).toEqual({
      A: 80,
      B: 70,
      C: 60,
      D: 50,
      F: 0,
    })
    expect(defaultBandCuts('percent')).toEqual({
      優: 75,
      良: 60,
      及格: 50,
      待改進: 0,
    })
  })

  it('hkdse 八級齊全', () => {
    const cuts = defaultBandCuts('hkdse')
    expect(Object.keys(cuts)).toHaveLength(8)
    expect(cuts['5**']).toBe(88)
    expect(cuts.U).toBe(0)
  })
})

describe('resolveBands 守邊界 / 缺值 / 亂序', () => {
  it('undefined / 空物件 → 直接回內建（同一參考）', () => {
    expect(resolveBands('hkdse')).toBe(bandsOf('hkdse'))
    expect(resolveBands('hkdse', {})).toBe(bandsOf('hkdse'))
  })

  it('覆蓋單一級下限（其餘沿用內建）', () => {
    const r = resolveBands('simple', { A: 85 })
    expect(r.find((b) => b.label === 'A')!.min).toBe(85)
    expect(r.find((b) => b.label === 'B')!.min).toBe(70) // 未改
    // 仍係 5 級、label/tone/gpa 保留
    expect(r).toHaveLength(5)
    expect(r.find((b) => b.label === 'A')!.gpa).toBe(4)
  })

  it('越界 clamp 落 0–100', () => {
    const r = resolveBands('simple', { A: 150, B: -20 })
    expect(r.find((b) => b.label === 'A')!.min).toBe(100)
    expect(r.find((b) => b.label === 'B')!.min).toBe(0)
  })

  it('最底一級（內建 min=0）拒絕覆蓋，永遠由 0 起', () => {
    const r = resolveBands('simple', { F: 30 })
    expect(r.find((b) => b.label === 'F')!.min).toBe(0)
  })

  it('非 finite 數值（NaN / Infinity / null）忽略，沿用內建', () => {
    const r = resolveBands('simple', {
      A: NaN,
      B: Infinity,
      // @ts-expect-error 故意傳 null 測守衛
      C: null,
    })
    expect(r.find((b) => b.label === 'A')!.min).toBe(80)
    expect(r.find((b) => b.label === 'B')!.min).toBe(70)
    expect(r.find((b) => b.label === 'C')!.min).toBe(60)
  })

  it('亂序輸入會按 min 由高到低重新排序', () => {
    // 把 B 設到 90（高過 A 的 80）→ 排序後 B 應在 A 之前
    const r = resolveBands('simple', { B: 90 })
    expect(r.map((b) => b.label)).toEqual(['B', 'A', 'C', 'D', 'F'])
    expect(r.map((b) => b.min)).toEqual([90, 80, 60, 50, 0])
  })

  it('唔污染內建 bands（回傳新陣列 / 新物件）', () => {
    const before = bandsOf('simple').map((b) => ({ ...b }))
    const r = resolveBands('simple', { A: 85 })
    expect(r).not.toBe(bandsOf('simple'))
    // 內建未被改動
    expect(bandsOf('simple')).toEqual(before)
    // 被改嗰個 band 係新物件
    expect(r.find((b) => b.label === 'A')).not.toBe(
      bandsOf('simple').find((b) => b.label === 'A'),
    )
  })

  it('值同預設一樣 → 沿用原 band 物件（唔必要 clone）', () => {
    const r = resolveBands('simple', { A: 80 }) // 80 = 預設
    expect(r.find((b) => b.label === 'A')).toBe(
      bandsOf('simple').find((b) => b.label === 'A'),
    )
  })
})

describe('gradeOf 套用自訂 bands', () => {
  it('收緊 A 到 85：84 變 B、85 仍 A', () => {
    const bands = resolveBands('simple', { A: 85 })
    expect(gradeOf(84, 'simple', bands).label).toBe('B')
    expect(gradeOf(85, 'simple', bands).label).toBe('A')
    // 對照：唔傳 bands 用內建，84 = A
    expect(gradeOf(84, 'simple').label).toBe('A')
  })

  it('降低合格線：hkdse 把「3」由 50 降到 45，47 變合格(3)', () => {
    const bands = resolveBands('hkdse', { '3': 45 })
    expect(gradeOf(47, 'hkdse', bands).label).toBe('3') // 原本 47 -> 2
    expect(gradeOf(44, 'hkdse', bands).label).toBe('2')
    expect(gradeOf(47, 'hkdse').label).toBe('2') // 對照內建
  })

  it('亂序自訂後 gradeOf 仍揀到正確（排序保障）', () => {
    // B 設 90、A 維持 80：92 應該係 B（最高級），85 係 A
    const bands = resolveBands('simple', { B: 90 })
    expect(gradeOf(92, 'simple', bands).label).toBe('B')
    expect(gradeOf(85, 'simple', bands).label).toBe('A')
    expect(gradeOf(0, 'simple', bands).label).toBe('F') // 漏唔到底
  })

  it('任何分數（含負 / 超 100）都有等級', () => {
    const bands = resolveBands('percent', { 優: 80 })
    expect(gradeOf(-10, 'percent', bands).label).toBe('待改進')
    expect(gradeOf(999, 'percent', bands).label).toBe('優')
  })
})
